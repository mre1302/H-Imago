'use strict';

/* H-IMAGO · Bloques de registro
   Renderizador genérico a partir del esquema declarativo generado desde el ODS.
   Datos por bloque: { valores, personas, patrimonios, grupos }. Cada bloque de
   personas/patrimonios es repetible; los grupos admiten instancias múltiples. */

const BloquesRegistro = (() => {

  const cacheResumen = new Map();
  const TTL_RESUMEN = 15000;

  function invalidarCache() {
    cacheResumen.clear();
    if (window.HimagoCache) window.HimagoCache.invalidar();
  }

  async function cargarResumen(tipo, proyectoId) {
    const clave = `${proyectoId}:${tipo}`;
    const ahora = Date.now();
    const guardado = cacheResumen.get(clave);
    if (guardado && ahora - guardado.instante < TTL_RESUMEN) return guardado.filas;
    const filas = window.HimagoCache
      ? await window.HimagoCache.listar(tipo, proyectoId)
      : await llamar(api.entidadListarResumen(tipo, proyectoId));
    cacheResumen.set(clave, { instante: ahora, filas });
    return filas;
  }

  function filaPersona() {
    return {
      titulo: '', nombres: '', apellidos: '', empleo: '', institucion_id: '', institucion_texto: '', persona_id: '',
      empleos: [],
    };
  }

  function filaPatrimonio() {
    return { nombre: '', tipo: '', valor: '', patrimonio_id: '' };
  }

  function filaServicio() {
    return { empleo: '', inicio: '', inicio_meta: '', anios: '', meses: '', dias: '' };
  }

  function filaItem() {
    return {
      anio: '', fecha: '', fecha_meta: '', item: '', cantidad: '',
      peso: '', reales: '', cuartillos: '',
    };
  }

  function cuartillosDeValor(valor) {
    const texto = String(valor ?? '').trim();
    if (texto === '1/4') return 1;
    if (texto === '1/2') return 2;
    if (texto === '3/4') return 3;
    const numero = Number(texto.replace(',', '.'));
    if (!Number.isFinite(numero)) return 0;
    return Math.max(0, Math.min(3, Math.round(numero * 4)));
  }

  function etiquetaCuartillos(cuartillos) {
    return ['', '1/4', '1/2', '3/4'][Math.max(0, Math.min(3, cuartillos))] || '';
  }

  function valorACuartillos(peso, reales, cuartillos) {
    const p = Number(String(peso ?? '').replace(',', '.'));
    const r = Number(String(reales ?? '').replace(',', '.'));
    const pesos = Number.isFinite(p) ? p : 0;
    const realesNumero = Number.isFinite(r) ? r : 0;
    return Math.round(pesos * 32 + realesNumero * 4) + cuartillosDeValor(cuartillos);
  }

  function repartirCuartillos(total) {
    const signo = total < 0 ? -1 : 1;
    let resto = Math.abs(Math.round(total));
    const peso = Math.floor(resto / 32) * signo;
    resto %= 32;
    const reales = Math.floor(resto / 4);
    const cuartillos = resto % 4;
    return { peso, reales, cuartillos };
  }

  /* Fechas estructuradas y diferencias calendario-aware para SERVICIOS. */
  function fechaEstructurada(texto, metaCrudo) {
    let meta = null;
    if (metaCrudo) {
      try {
        meta = typeof metaCrudo === 'string' ? JSON.parse(metaCrudo) : metaCrudo;
      } catch { meta = null; }
    }
    if (meta && meta.anio != null && meta.mes != null && meta.dia != null) return meta;
    const parseada = FechaHistorica.parsear(texto);
    if (parseada && parseada.anio != null && parseada.mes != null && parseada.dia != null) {
      return parseada;
    }
    return null;
  }

  function calendarioDeFecha(meta) {
    return meta && (meta.sistema === 'juliano' || meta.sistema === 'era')
      ? 'juliano'
      : 'gregoriano';
  }

  function diasDelMes(anio, mes, calendario) {
    if (mes === 2) {
      const bisiesto = calendario === 'juliano'
        ? anio % 4 === 0
        : (anio % 4 === 0 && anio % 100 !== 0) || anio % 400 === 0;
      return bisiesto ? 29 : 28;
    }
    return [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][mes - 1];
  }

  function sumarMeses(desde, meses, calendario) {
    const total = desde.anio * 12 + (desde.mes - 1) + meses;
    const anio = Math.floor(total / 12);
    const mes = ((total % 12) + 12) % 12 + 1;
    const dia = Math.min(desde.dia, diasDelMes(anio, mes, calendario));
    return { anio, mes, dia };
  }

  function diferenciaYMD(desde, hasta) {
    const calendario = calendarioDeFecha(desde);
    const jdnDesde = FechaHistorica.jdn(calendario, desde.anio, desde.mes, desde.dia);
    const jdnHasta = FechaHistorica.jdn(
      calendarioDeFecha(hasta), hasta.anio, hasta.mes, hasta.dia
    );
    if (jdnHasta < jdnDesde) return null;
    const fin = FechaHistorica.desdeJdn(calendario, jdnHasta);
    let mesesTotales = (fin.anio - desde.anio) * 12 + (fin.mes - desde.mes);
    let candidato = sumarMeses(desde, mesesTotales, calendario);
    if (FechaHistorica.jdn(calendario, candidato.anio, candidato.mes, candidato.dia) > jdnHasta) {
      mesesTotales -= 1;
      candidato = sumarMeses(desde, mesesTotales, calendario);
    }
    const dias = jdnHasta - FechaHistorica.jdn(calendario, candidato.anio, candidato.mes, candidato.dia);
    return {
      anios: Math.floor(mesesTotales / 12),
      meses: ((mesesTotales % 12) + 12) % 12,
      dias,
    };
  }

  function normalizar(esquema, datos) {
    if (!datos || typeof datos !== 'object' || Array.isArray(datos)) {
      throw new Error('El bloque de registro no contiene datos válidos.');
    }
    const estado = JSON.parse(JSON.stringify(datos));
    for (const clave of ['valores', 'personas', 'patrimonios', 'instituciones', 'servicios', 'items', 'grupos']) {
      if (!estado[clave] || typeof estado[clave] !== 'object' || Array.isArray(estado[clave])) {
        estado[clave] = {};
      }
    }
    preparar(esquema.bloques, estado);
    migrarHipotecasAnidadas(esquema, estado);
    migrarInventario(esquema, estado);
    migrarMontosOctavales(esquema, estado);
    return estado;
  }

  /* Los bloques HIPOTECA que antes eran independientes guardaban sus filas
     en `estado.patrimonios`. Ahora viven dentro de una fila de persona. Si
     un bloque antiguo tiene datos, se trasladan a la primera fila de la
     persona que corresponde; si sólo tenía filas vacías, se descartan. */
  function migrarHipotecasAnidadas(esquema, estado) {
    const conDatos = (filas) => Array.isArray(filas) && filas.some((f) => f && (
      String(f.nombre || '').trim() !== ''
      || String(f.valor || '').trim() !== ''
      || String(f.tipo || '').trim() !== ''
      || Boolean(f.patrimonio_id)
    ));
    for (const bloque of esquema.bloques) {
      if (bloque.tipo !== 'personas' || !Array.isArray(bloque.bloques)) continue;
      const filasPersona = estado.personas?.[bloque.id] || [];
      for (const hijo of bloque.bloques) {
        if (hijo.tipo !== 'patrimonios') continue;
        const antiguos = estado.patrimonios?.[hijo.id];
        if (!Array.isArray(antiguos)) continue;
        const fila = filasPersona[0];
        if (fila) {
          fila.patrimonios = fila.patrimonios || {};
          if (conDatos(antiguos) && !conDatos(fila.patrimonios[hijo.id])) {
            fila.patrimonios[hijo.id] = antiguos;
          }
        }
        delete estado.patrimonios[hijo.id];
      }
    }
  }



  function convertirValorMonetario(contenedor, claveValor, clavePeso, claveReales, claveCuartillos) {
    if (!contenedor || !claveValor) return;
    const valor = contenedor[claveValor];
    if (valor === undefined || valor === '') return;
    const tieneComponentes = [claveReales, claveCuartillos].some(
      (clave) => clave && contenedor[clave] !== undefined && contenedor[clave] !== ''
    );
    if (tieneComponentes) return;
    const numero = Number(String(valor).replace(',', '.'));
    if (!Number.isFinite(numero)) return;
    const { peso, reales, cuartillos } = repartirCuartillos(Math.round(numero * 32));
    contenedor[clavePeso] = String(peso);
    if (claveReales) contenedor[claveReales] = String(reales);
    if (claveCuartillos) contenedor[claveCuartillos] = etiquetaCuartillos(cuartillos);
    if (clavePeso !== claveValor) delete contenedor[claveValor];
  }

  function migrarMontosOctavales(esquema, estado) {
    for (const conversion of esquema.montosOctavales || []) {
      convertirValorMonetario(
        estado.valores,
        conversion.base,
        conversion.base,
        conversion.reales,
        conversion.cuartillos
      );
    }
    const gruposInv = (esquema.bloques || []).filter((b) => b.tipo === 'grupo'
      && b.bloques.some((h) => h.tipo === 'items-inventario'));
    for (const bloqueGrupo of gruposInv) {
      const bloqueItems = bloqueGrupo.bloques.find((h) => h.tipo === 'items-inventario');
      const indiceGrupo = esquema.bloques.indexOf(bloqueGrupo);
      const bloqueTotales = esquema.bloques.slice(indiceGrupo + 1)
        .find((b) => b.tipo === 'totales-inventario');
      const campos = bloqueItems?.campos || {};
      const instancias = estado.grupos?.[bloqueGrupo.id] || [];
      for (const instancia of instancias) {
        const filas = instancia.items?.[bloqueItems?.id] || [];
        for (const fila of filas) {
          convertirValorMonetario(fila, 'monto', 'peso', 'reales', 'cuartillos');
        }
        convertirValorMonetario(
          instancia.valores,
          campos.subtotalMonto?.id || campos.subtotalPeso?.id,
          campos.subtotalPeso?.id || campos.subtotalMonto?.id,
          campos.subtotalReales?.id,
          campos.subtotalCuartillos?.id
        );
      }
      convertirValorMonetario(
        estado.valores,
        bloqueTotales?.campos?.totalMonto?.id || bloqueTotales?.campos?.totalPeso?.id,
        bloqueTotales?.campos?.totalPeso?.id || bloqueTotales?.campos?.totalMonto?.id,
        bloqueTotales?.campos?.totalReales?.id,
        bloqueTotales?.campos?.totalCuartillos?.id
      );
    }
  }

  /* Los bloques antiguos de inventario guardaban la primera categoría en el
     nivel raíz; al pasar a grupo repetible se copia en la primera instancia. */
  function migrarInventario(esquema, estado) {
    const gruposInv = esquema.bloques.filter((b) => b.tipo === 'grupo'
      && b.bloques.some((h) => h.tipo === 'items-inventario'));
    for (const bloqueGrupo of gruposInv) {
      const bloqueItems = bloqueGrupo.bloques.find((h) => h.tipo === 'items-inventario');
      const indiceGrupo = esquema.bloques.indexOf(bloqueGrupo);
      const bloqueTotales = esquema.bloques.slice(indiceGrupo + 1)
        .find((b) => b.tipo === 'totales-inventario');
      const instancias = estado.grupos[bloqueGrupo.id];
      if (!Array.isArray(instancias) || !instancias.length) continue;
      const categoria = bloqueGrupo.bloques
        .filter((b) => Array.isArray(b.campos))
        .flatMap((b) => b.campos)
        .find((c) => c.nombre === 'CATEGORÍAS');
      const campos = bloqueItems?.campos || {};
      const clavesGrupo = [
        categoria?.id,
        campos.anio?.id,
        campos.fecha?.id,
        campos.fecha?.id ? `${campos.fecha.id}_meta` : null,
        campos.item?.id,
        campos.cantidad?.id,
        campos.monto?.id,
        campos.subtotalCantidad?.id,
        campos.subtotalMonto?.id,
      ].filter(Boolean);
      const destino = instancias[0].valores;
      for (const clave of clavesGrupo) {
        if (destino[clave] === undefined && estado.valores[clave] !== undefined) {
          destino[clave] = estado.valores[clave];
        }
      }
      const clavesTotales = [
        bloqueTotales?.campos?.totalCantidad?.id,
        bloqueTotales?.campos?.totalMonto?.id,
      ].filter(Boolean);
      for (const clave of clavesTotales) {
        if (estado.valores[clave] === undefined || estado.valores[clave] === '') {
          const valor = instancias
            .map((instancia) => instancia.valores?.[clave])
            .find((v) => v !== undefined && v !== '');
          if (valor !== undefined) estado.valores[clave] = valor;
        }
      }
      const mapaItem = {
        anio: campos.anio?.id,
        fecha: campos.fecha?.id,
        fecha_meta: campos.fecha?.id ? `${campos.fecha.id}_meta` : null,
        item: campos.item?.id,
        cantidad: campos.cantidad?.id,
        monto: campos.monto?.id,
      };
      for (const instancia of instancias) {
        const filas = instancia.items?.[bloqueItems?.id];
        if (!Array.isArray(filas) || !filas.length) continue;
        const fila = filas[0];
        for (const [campoDestino, clave] of Object.entries(mapaItem)) {
          if (clave && !fila[campoDestino] && instancia.valores[clave] !== undefined) {
            fila[campoDestino] = instancia.valores[clave];
          }
        }
      }
    }
  }

  function preparar(bloques, estado) {
    for (const bloque of bloques) {
      if (bloque.tipo === 'personas') {
        if (!Array.isArray(estado.personas[bloque.id]) || !estado.personas[bloque.id].length) {
          estado.personas[bloque.id] = [filaPersona()];
        }
        if (Array.isArray(bloque.bloques) && bloque.bloques.length) {
          for (const fila of estado.personas[bloque.id]) {
            fila.personas = fila.personas || {};
            fila.patrimonios = fila.patrimonios || {};
            fila.instituciones = fila.instituciones || {};
            fila.servicios = fila.servicios || {};
            fila.items = fila.items || {};
            fila.grupos = fila.grupos || {};
            preparar(bloque.bloques, fila);
          }
        }
      } else if (bloque.tipo === 'patrimonios') {
        if (!Array.isArray(estado.patrimonios[bloque.id]) || !estado.patrimonios[bloque.id].length) {
          estado.patrimonios[bloque.id] = [filaPatrimonio()];
        }
      } else if (bloque.tipo === 'instituciones') {
        if (!Array.isArray(estado.instituciones[bloque.id]) || !estado.instituciones[bloque.id].length) {
          estado.instituciones[bloque.id] = [{ texto: '', institucion_id: '' }];
        }
      } else if (bloque.tipo === 'servicios') {
        if (!Array.isArray(estado.servicios[bloque.id]) || !estado.servicios[bloque.id].length) {
          estado.servicios[bloque.id] = [filaServicio()];
        }
      } else if (bloque.tipo === 'items-inventario') {
        if (!Array.isArray(estado.items[bloque.id]) || !estado.items[bloque.id].length) {
          estado.items[bloque.id] = [filaItem()];
        }
      } else if (bloque.tipo === 'grupo') {
        if (!Array.isArray(estado.grupos[bloque.id]) || !estado.grupos[bloque.id].length) {
          estado.grupos[bloque.id] = [{}];
        }
        for (const instancia of estado.grupos[bloque.id]) {
          instancia.valores = instancia.valores || {};
          instancia.personas = instancia.personas || {};
          instancia.patrimonios = instancia.patrimonios || {};
          instancia.instituciones = instancia.instituciones || {};
          instancia.servicios = instancia.servicios || {};
          instancia.items = instancia.items || {};
          instancia.grupos = instancia.grupos || {};
          preparar(bloque.bloques, instancia);
        }
      }
    }
  }

  /** Devuelve el TÍTULO de la sección REGISTRO de un bloque, si lo hay. */
  /** Datos identificativos de la sección REGISTRO para describir un bloque
      guardado en FUENTES: TÍTULO y SIGNATURA. */
  function datosRegistro(esquema, datos) {
    const valores = datos?.valores || {};
    const bloques = esquema?.bloques || [];
    const salida = { titulo: '', signatura: '' };
    const valorDe = (campo) => {
      const valor = valores[campo.id];
      return valor == null ? '' : String(valor).trim();
    };
    let enRegistro = false;
    for (const bloque of bloques) {
      if (bloque.tipo === 'seccion') {
        const nombre = String(bloque.titulo || '').trim().toUpperCase();
        if (nombre === 'REGISTRO') enRegistro = true;
        else if (enRegistro) break;
        continue;
      }
      if (!enRegistro || bloque.tipo !== 'campos') continue;
      for (const campo of bloque.campos || []) {
        const nombre = String(campo.nombre || '').trim().toUpperCase();
        if (!salida.titulo && (nombre === 'TÍTULO' || nombre === 'TITULO')) {
          salida.titulo = valorDe(campo);
        }
        if (!salida.signatura && nombre === 'SIGNATURA') {
          salida.signatura = valorDe(campo);
        }
      }
    }
    return salida;
  }

  function tituloRegistro(esquema, datos) {
    return datosRegistro(esquema, datos).titulo;
  }

  function anchoCampo(campo) {
    if (campo.tipo === 'area') return 12;
    if (campo.tipo === 'anio') return 2;
    if (campo.tipo === 'fecha') return 4;
    return 4;
  }

  async function crearEditor(esquema, datosIniciales, opciones = {}) {
    const proyectoId = opciones.proyectoId;
    const [personas, instituciones, lugares, patrimonios] = await Promise.all([
      cargarResumen('persona', proyectoId),
      cargarResumen('institucion', proyectoId),
      cargarResumen('lugar', proyectoId),
      cargarResumen('patrimonio', proyectoId),
    ]);
    const estado = normalizar(esquema, datosIniciales);
    const raiz = el('div', 'form-bloque');
    const sugerenciasExternas = opciones.sugerencias || {};
    const marcarCambio = typeof opciones.marcarCambio === 'function'
      ? opciones.marcarCambio
      : () => {};
    const notificarContadores = () => document.dispatchEvent(new CustomEvent('himago:contadores'));

    function normalizarSugerencia(valor) {
      return String(valor == null ? '' : valor).replace(/\s+/g, ' ').trim();
    }

    function agregarSugerencias(destino, valores) {
      for (const valor of (valores || [])) {
        const texto = normalizarSugerencia(valor);
        if (texto) destino.add(texto);
      }
    }

    const cacheSugerencias = new Map();
    const cacheOpcionesEntidad = new Map();
    function valoresSugeridos(nombre) {
      const claveCache = String(nombre || '').trim().toUpperCase();
      if (!cacheSugerencias.has(claveCache)) cacheSugerencias.set(claveCache, calcularSugerencias(nombre));
      return cacheSugerencias.get(claveCache);
    }

    function calcularSugerencias(nombre) {
      const clave = String(nombre || '').trim().toUpperCase();
      const valores = new Set();
      agregarSugerencias(valores, sugerenciasExternas[clave]);
      if (clave === 'AÑO' || clave === 'ANIO') {
        for (const p of personas) {
          if (p.anio_nacimiento != null) valores.add(String(p.anio_nacimiento));
          if (p.anio_defuncion != null) valores.add(String(p.anio_defuncion));
        }
        for (const i of instituciones) {
          if (i.anio_fundacion != null) valores.add(String(i.anio_fundacion));
          if (i.anio_disolucion != null) valores.add(String(i.anio_disolucion));
        }
        for (const valor of sugerenciasExternas['*'] || []) {
          if (/^-?\d{3,4}$/.test(String(valor).trim())) valores.add(String(valor).trim());
        }
        agregarSugerencias(valores, sugerenciasExternas.ANIO);
        return [...valores]
          .filter((valor) => {
            const numero = Number(valor);
            return Number.isInteger(numero) && numero >= 1000 && numero <= 2100;
          })
          .sort((a, b) => Number(b) - Number(a))
          .slice(0, 250);
      }
      const especificas = new Set([
        'NOMBRES', 'APELLIDOS', 'TRATAMIENTO/TÍTULO', 'TRATAMIENTO',
        'EMPLEO/OFICIO', 'OFICIO', 'OCUPACIÓN', 'OCUPACION',
        'INSTITUCIÓN', 'INSTITUCION', 'LUGAR', 'NOMBRE', 'PATRIMONIO',
        'TIPO', 'VALOR/TASACIÓN', 'ÍTEM',
      ]);
      if (!especificas.has(clave)) agregarSugerencias(valores, sugerenciasExternas['*']);
      const personasCon = (campo) => agregarSugerencias(valores, personas.map((p) => p[campo]));
      if (clave === 'NOMBRES') personasCon('nombre');
      else if (clave === 'APELLIDOS') personasCon('apellidos');
      else if (clave === 'TRATAMIENTO/TÍTULO' || clave === 'TRATAMIENTO') personasCon('tratamiento');
      else if (['EMPLEO/OFICIO', 'OFICIO', 'OCUPACIÓN', 'OCUPACION'].includes(clave)) personasCon('ocupacion');
      else if (clave === 'INSTITUCIÓN' || clave === 'INSTITUCION') {
        agregarSugerencias(valores, instituciones.map((i) => i.nombre));
      } else if (clave === 'LUGAR') {
        agregarSugerencias(valores, lugares.map((l) => l.nombre));
      } else if (clave === 'NOMBRE' || clave === 'PATRIMONIO') {
        agregarSugerencias(valores, patrimonios.map((p) => p.nombre));
      }
      return [...valores].sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' })).slice(0, 250);
    }

    function adjuntarSugerencias(entrada, nombre, contenedor) {
      if (!entrada || !['INPUT'].includes(entrada.tagName)) return;
      if (entrada.readOnly || entrada.type === 'password' || entrada.type === 'date') return;
      if (entrada.dataset.sugerencias === '1') return;
      const valores = valoresSugeridos(nombre);
      if (!valores.length) return;
      entrada.dataset.sugerencias = '1';
      entrada.autocomplete = 'off';
      contenedor.classList.add('campo-con-sugerencias');

      const panel = el('div', 'sugerencias-bloque');
      panel.hidden = true;
      panel.setAttribute('role', 'listbox');
      contenedor.appendChild(panel);

      let opciones = [];
      let indice = -1;
      const normalizar = (valor) => String(valor || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLocaleLowerCase('es')
        .trim();

      function cerrar() {
        panel.hidden = true;
        indice = -1;
      }

      function marcar() {
        [...panel.children].forEach((boton, i) => {
          boton.classList.toggle('resaltada', i === indice);
          boton.setAttribute('aria-selected', i === indice ? 'true' : 'false');
        });
      }

      function elegir(valor) {
        entrada.value = valor;
        entrada.dispatchEvent(new Event('input', { bubbles: true }));
        entrada.dispatchEvent(new Event('change', { bubbles: true }));
        cerrar();
      }

      function pintar() {
        const buscado = normalizar(entrada.value);
        const numerico = /^\d/.test(buscado);
        opciones = valores
          .filter((valor) => {
            if (!buscado) return true;
            const normalizado = normalizar(valor);
            return numerico ? normalizado.startsWith(buscado) : normalizado.includes(buscado);
          })
          .slice(0, 12);
        panel.innerHTML = '';
        indice = -1;
        for (const valor of opciones) {
          const boton = el('button', 'sugerencia-opcion', valor);
          boton.type = 'button';
          boton.setAttribute('role', 'option');
          boton.setAttribute('aria-selected', 'false');
          boton.addEventListener('mousedown', (ev) => ev.preventDefault());
          boton.addEventListener('click', () => elegir(valor));
          panel.appendChild(boton);
        }
        panel.hidden = opciones.length === 0;
      }

      entrada.addEventListener('focus', pintar);
      entrada.addEventListener('click', pintar);
      entrada.addEventListener('input', pintar);
      entrada.addEventListener('keydown', (ev) => {
        if (panel.hidden || !opciones.length) return;
        if (ev.key === 'ArrowDown') {
          ev.preventDefault();
          indice = Math.min(opciones.length - 1, indice + 1);
          marcar();
        } else if (ev.key === 'ArrowUp') {
          ev.preventDefault();
          indice = Math.max(0, indice - 1);
          marcar();
        } else if (ev.key === 'Enter' && indice >= 0) {
          ev.preventDefault();
          elegir(opciones[indice]);
        } else if (ev.key === 'Escape') {
          ev.preventDefault();
          cerrar();
        }
      });
      entrada.addEventListener('blur', () => setTimeout(cerrar, 120));
    }

    /* Inventarios: SUBTOTAL por categoría = suma de sus ítems; TOTAL GENERAL =
       suma de los subtotales de todas las categorías. Admite varias secciones
       de inventario independientes (DEBE y HABER en Cuenta personal). */
    function recalcularInventario() {
      const gruposInv = esquema.bloques.filter((b) => b.tipo === 'grupo'
        && b.bloques.some((h) => h.tipo === 'items-inventario'));
      if (!gruposInv.length) return;
      for (const bloqueGrupo of gruposInv) {
        const bloqueItems = bloqueGrupo.bloques.find((h) => h.tipo === 'items-inventario');
        const indiceGrupo = esquema.bloques.indexOf(bloqueGrupo);
        const bloqueTotales = esquema.bloques.slice(indiceGrupo + 1)
          .find((b) => b.tipo === 'totales-inventario');
        const grupo = estado.grupos[bloqueGrupo.id];
        if (!Array.isArray(grupo)) continue;
        const claveSubCantidad = bloqueItems?.campos?.subtotalCantidad?.id;
        const claveSubPeso = bloqueItems?.campos?.subtotalPeso?.id
          || bloqueItems?.campos?.subtotalMonto?.id;
        const claveSubReales = bloqueItems?.campos?.subtotalReales?.id;
        const claveSubCuartillos = bloqueItems?.campos?.subtotalCuartillos?.id;
        const claveTotalCantidad = bloqueTotales?.campos?.totalCantidad?.id;
        const claveTotalPeso = bloqueTotales?.campos?.totalPeso?.id
          || bloqueTotales?.campos?.totalMonto?.id;
        const claveTotalReales = bloqueTotales?.campos?.totalReales?.id;
        const claveTotalCuartillos = bloqueTotales?.campos?.totalCuartillos?.id;
        const domGrupo = raiz.querySelector(`.grupo-bloque[data-grupo="${bloqueGrupo.id}"]`);
        const instancias = [...(domGrupo?.querySelectorAll('.grupo-instancia') || [])]
          .filter((dom) => dom.querySelector('.inventario-items'));
        let totalCantidad = 0;
        let totalCuartillos = 0;
        grupo.forEach((instancia, indice) => {
          const items = instancia.items?.[bloqueItems?.id] || [];
          const sumar = (campo) => items.reduce((acc, fila) => {
            const numero = Number(String(fila[campo] ?? '').replace(',', '.'));
            return acc + (Number.isFinite(numero) ? numero : 0);
          }, 0);
          const subtotalCantidad = sumar('cantidad');
          const subtotalCuartillos = items.reduce((acc, fila) => (
            acc + valorACuartillos(fila.peso, fila.reales, fila.cuartillos)
          ), 0);
          const subtotal = repartirCuartillos(subtotalCuartillos);
          if (claveSubCantidad) instancia.valores[claveSubCantidad] = String(subtotalCantidad);
          if (claveSubPeso) instancia.valores[claveSubPeso] = String(subtotal.peso);
          if (claveSubReales) instancia.valores[claveSubReales] = String(subtotal.reales);
          if (claveSubCuartillos) instancia.valores[claveSubCuartillos] = etiquetaCuartillos(subtotal.cuartillos);
          totalCantidad += subtotalCantidad;
          totalCuartillos += subtotalCuartillos;
          const dom = instancias[indice];
          const eSubtotalCantidad = dom?.querySelector('.entrada-subtotal-cantidad');
          const eSubtotalPeso = dom?.querySelector('.entrada-subtotal-peso');
          const eSubtotalReales = dom?.querySelector('.entrada-subtotal-reales');
          const eSubtotalCuartillos = dom?.querySelector('.entrada-subtotal-cuartillos');
          if (eSubtotalCantidad) eSubtotalCantidad.value = String(subtotalCantidad);
          if (eSubtotalPeso) eSubtotalPeso.value = String(subtotal.peso);
          if (eSubtotalReales) eSubtotalReales.value = String(subtotal.reales);
          if (eSubtotalCuartillos) eSubtotalCuartillos.value = etiquetaCuartillos(subtotal.cuartillos);
        });
        const total = repartirCuartillos(totalCuartillos);
        if (claveTotalCantidad) estado.valores[claveTotalCantidad] = String(totalCantidad);
        if (claveTotalPeso) estado.valores[claveTotalPeso] = String(total.peso);
        if (claveTotalReales) estado.valores[claveTotalReales] = String(total.reales);
        if (claveTotalCuartillos) estado.valores[claveTotalCuartillos] = etiquetaCuartillos(total.cuartillos);
        const domTotales = raiz.querySelector(`.totales-inventario[data-totales="${bloqueTotales?.id}"]`);
        const eTotalCantidad = domTotales?.querySelector('.entrada-total-cantidad');
        const eTotalPeso = domTotales?.querySelector('.entrada-total-peso');
        const eTotalReales = domTotales?.querySelector('.entrada-total-reales');
        const eTotalCuartillos = domTotales?.querySelector('.entrada-total-cuartillos');
        if (eTotalCantidad) eTotalCantidad.value = String(totalCantidad);
        if (eTotalPeso) eTotalPeso.value = String(total.peso);
        if (eTotalReales) eTotalReales.value = String(total.reales);
        if (eTotalCuartillos) eTotalCuartillos.value = etiquetaCuartillos(total.cuartillos);
      }
    }

    const opcionesEntidad = (lista, tipo) => {
      const claveCache = `${tipo}:${lista.length}:${lista[0]?.id || ''}:${lista[lista.length - 1]?.id || ''}`;
      if (cacheOpcionesEntidad.has(claveCache)) return cacheOpcionesEntidad.get(claveCache);
      const normalizar = (valor) => String(valor || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLocaleLowerCase('es')
        .trim();
      const particulas = /^(?:de|del|la|las|los|el|do|da|dos|das)\s+/i;
      const comparador = new Intl.Collator('es', { sensitivity: 'base' });
      const clavePersona = (f) => {
        const original = String(f.apellidos || '').trim() || String(f.nombre || '').trim();
        let texto = original;
        let anterior = null;
        while (anterior !== texto) {
          anterior = texto;
          texto = texto.replace(particulas, '').trim();
        }
        return normalizar(texto || original);
      };
      const salida = lista
        .slice()
        .sort((a, b) => {
          if (tipo === 'persona') {
            const cmp = comparador.compare(clavePersona(a), clavePersona(b));
            if (cmp) return cmp;
            return comparador.compare(normalizar(a.nombre), normalizar(b.nombre));
          }
          return comparador.compare(normalizar(etiquetaEntidad(tipo, a)), normalizar(etiquetaEntidad(tipo, b)));
        })
        .map((f) => ({
          valor: String(f.id),
          etiqueta: `${f.identificador ? `${f.identificador} · ` : ''}${etiquetaEntidad(tipo, f)}`,
        }));
      cacheOpcionesEntidad.set(claveCache, salida);
      return salida;
    };

    function crearCampo(campo, contenedor, nivel, opciones = {}) {
      const envoltura = el('div', `campo campo-${campo.ancho || anchoCampo(campo)}`);
      if (campo.columna) {
        envoltura.style.gridColumn = `${campo.columna} / span ${campo.ancho || anchoCampo(campo)}`;
      }
      envoltura.appendChild(el('label', '', campo.nombre));
      let entrada;
      const valor = nivel.valores[campo.id] ?? '';

      if (campo.tipo === 'area') {
        entrada = el('textarea', 'entrada');
        entrada.rows = (campo.nombre === 'NOTAS' || campo.nombre === 'MATERIA') ? 3 : (campo.filas || 2);
        entrada.value = valor;
      } else if (campo.tipo === 'select') {
        entrada = el('select', 'entrada');
        entrada.appendChild(new Option('—', ''));
        const opcionesSelect = campo.opciones || [];
        for (const opcion of opcionesSelect) entrada.appendChild(new Option(opcion, opcion));
        const canonica = valor
          ? opcionesSelect.find((opcion) => String(opcion).toLocaleLowerCase('es') === String(valor).toLocaleLowerCase('es'))
          : null;
        if (valor && !opcionesSelect.includes(valor) && !canonica) {
          entrada.appendChild(new Option(`(actual) ${valor}`, valor));
        }
        entrada.value = canonica || valor;
        if (canonica) nivel.valores[campo.id] = canonica;
      } else if (campo.tipo === 'lugar' || campo.tipo === 'institucion') {
        entrada = el('select', 'entrada');
        entrada.appendChild(new Option('—', ''));
        const lista = campo.tipo === 'lugar' ? lugares : instituciones;
        for (const opcion of opcionesEntidad(lista, campo.tipo)) entrada.appendChild(new Option(opcion.etiqueta, opcion.valor));
        entrada.value = valor ? String(valor) : '';
      } else if (campo.tipo === 'tipo_patrimonio') {
        entrada = el('input', 'entrada');
        entrada.placeholder = 'Tipo';
        entrada.value = valor;
      } else if (campo.tipo === 'fecha') {
        const caja = el('div', 'fecha-historica');
        entrada = el('input', 'entrada');
        entrada.value = valor;
        entrada.placeholder = 'Fecha exacta';
        caja.appendChild(entrada);
        envoltura.appendChild(caja);
        let meta = {};
        try {
          meta = nivel.valores[`${campo.id}_meta`] ? JSON.parse(nivel.valores[`${campo.id}_meta`]) : {};
        } catch { meta = {}; }
        FechaHistorica.adjuntar(entrada, meta, (nueva) => {
          nivel.valores[`${campo.id}_meta`] = JSON.stringify(nueva);
        }, { anio: opciones.anio });
      } else if (campo.tipo === 'entero') {
        entrada = el('input', 'entrada');
        entrada.type = 'number';
        entrada.step = '1';
        entrada.min = '0';
        entrada.inputMode = 'numeric';
        entrada.placeholder = '0';
        entrada.value = valor;
      } else if (campo.tipo === 'anio') {
        entrada = el('input', 'entrada');
        entrada.type = 'number';
        entrada.step = '1';
        entrada.placeholder = 'aaaa';
        entrada.value = valor;
      } else {
        entrada = el('input', 'entrada');
        entrada.value = valor;
      }

      if (campo.tipo !== 'fecha') {
        entrada.addEventListener('input', () => { nivel.valores[campo.id] = entrada.value; });
        entrada.addEventListener('change', () => { nivel.valores[campo.id] = entrada.value; });
      } else {
        entrada.addEventListener('input', () => {
          nivel.valores[campo.id] = entrada.value;
          nivel.valores[`${campo.id}_meta`] = '';
        });
      }
      if (['texto', 'anio', 'tipo_patrimonio'].includes(campo.tipo)) {
        adjuntarSugerencias(entrada, campo.nombre, envoltura);
      }
      if (!entrada.parentElement) envoltura.appendChild(entrada);
      contenedor.appendChild(envoltura);
    }

    function crearPersonas(bloque, contenedor, nivel) {
      const dosLineas = bloque.disposicion === 'dos-lineas';
      const institucionTexto = bloque.institucionTexto === true;
      const caja = el('div', 'bloque-personas');
      const cab = el('div', 'bloque-personas-cab');
      cab.appendChild(el('h6', 'rol-titulo', bloque.titulo));
      const btnAdd = el('button', 'btn btn-mini', '+');
      btnAdd.title = 'Añadir persona';
      btnAdd.hidden = dosLineas;
      cab.appendChild(btnAdd);
      caja.appendChild(cab);
      const filas = el('div', 'filas-persona');
      caja.appendChild(filas);

      function envolturaCampo(etiqueta, entrada) {
        const envoltura = el('div', 'campo');
        envoltura.appendChild(el('label', '', etiqueta));
        envoltura.appendChild(entrada);
        adjuntarSugerencias(entrada, etiqueta, envoltura);
        return envoltura;
      }

      function crearSelectPersona(fila) {
        const sel = el('select', 'entrada');
        sel.appendChild(new Option('—', ''));
        for (const opcion of opcionesEntidad(personas, 'persona')) {
          sel.appendChild(new Option(opcion.etiqueta, opcion.valor));
        }
        sel.value = fila.persona_id ? String(fila.persona_id) : '';
        sel.addEventListener('change', () => { fila.persona_id = sel.value; });
        return sel;
      }

      function crearSelectInstitucion(fila) {
        const sel = el('select', 'entrada');
        sel.appendChild(new Option('—', ''));
        for (const opcion of opcionesEntidad(instituciones, 'institucion')) {
          sel.appendChild(new Option(opcion.etiqueta, opcion.valor));
        }
        sel.value = fila.institucion_id ? String(fila.institucion_id) : '';
        sel.addEventListener('change', () => {
          fila.institucion_id = sel.value;
          if (Array.isArray(fila.empleos) && fila.empleos[0]) {
            fila.empleos[0].institucion_id = sel.value;
          }
        });
        return sel;
      }

      function crearInputInstitucionTexto(fila) {
        const entrada = el('input', 'entrada');
        entrada.placeholder = 'Nombre de la institución (texto)';
        entrada.value = fila.institucion_texto || '';
        entrada.addEventListener('input', () => { fila.institucion_texto = entrada.value; });
        return entrada;
      }

      function crearBotonPersona(fila) {
        const btn = el('button', 'btn btn-mini', '＋ Crear persona');
        let creando = false;
        btn.title = 'Crea una persona con los datos de esta línea';
        btn.addEventListener('click', async () => {
          if (creando) return;
          if (!String(fila.nombres || '').trim() && !String(fila.apellidos || '').trim()) {
            aviso('Escribe al menos el nombre o los apellidos para crear la persona.', 'error');
            return;
          }
          creando = true;
          btn.disabled = true;
          try {
            const creada = await llamar(api.entidadCrear('persona', proyectoId, {
              nombre: fila.nombres,
              apellidos: fila.apellidos,
              tratamiento: fila.titulo,
              ocupacion: (fila.empleos && fila.empleos[0] ? fila.empleos[0].empleo : fila.empleo) || '',
            }));
            personas.push(creada);
            fila.persona_id = String(creada.id);
            invalidarCache(); notificarContadores();
            marcarCambio();
            aviso(`Persona ${creada.identificador} creada y vinculada`, 'exito');
            pintarFilas();
          } catch (err) { aviso(err.message, 'error'); }
          finally {
            creando = false;
            if (btn.isConnected) btn.disabled = false;
          }
        });
        return btn;
      }

      function crearBotonInstitucion(fila) {
        const btn = el('button', 'btn btn-mini', '＋ Crear institución');
        let creando = false;
        btn.title = 'Crea una institución con el nombre escrito en el campo INSTITUCIÓN';
        btn.addEventListener('click', async () => {
          if (creando) return;
          const nombre = String((fila.empleos && fila.empleos[0] ? fila.empleos[0].institucion_texto : fila.institucion_texto) || '').trim();
          if (!nombre) { aviso('Escribe el nombre de la institución en el campo INSTITUCIÓN.', 'error'); return; }
          creando = true;
          btn.disabled = true;
          try {
            const creada = await llamar(api.entidadCrear('institucion', proyectoId, { nombre }));
            instituciones.push(creada);
            fila.institucion_id = String(creada.id);
            if (fila.empleos && fila.empleos[0]) fila.empleos[0].institucion_id = String(creada.id);
            invalidarCache(); notificarContadores();
            marcarCambio();
            aviso(`Institución ${creada.identificador} creada`, 'exito');
            pintarFilas();
          } catch (err) { aviso(err.message, 'error'); }
          finally {
            creando = false;
            if (btn.isConnected) btn.disabled = false;
          }
        });
        return btn;
      }

      /* Cada línea de empleo puede vincular su propia institución: selector
         de instituciones existentes y creación desde el nombre escrito. */
      function crearSelectInstitucionEmpleo(fila, empleoObj, indiceEmpleo) {
        const sel = el('select', 'entrada');
        sel.appendChild(new Option('—', ''));
        for (const opcion of opcionesEntidad(instituciones, 'institucion')) {
          sel.appendChild(new Option(opcion.etiqueta, opcion.valor));
        }
        sel.value = empleoObj.institucion_id ? String(empleoObj.institucion_id) : '';
        sel.addEventListener('change', () => {
          empleoObj.institucion_id = sel.value;
          if (indiceEmpleo === 0) fila.institucion_id = sel.value;
        });
        return sel;
      }

      function crearBotonInstitucionEmpleo(fila, empleoObj, indiceEmpleo) {
        const btn = el('button', 'btn btn-mini', '＋ Crear institución');
        let creando = false;
        btn.title = 'Crea una institución con el nombre escrito en esta línea';
        btn.addEventListener('click', async () => {
          if (creando) return;
          const nombre = String(empleoObj.institucion_texto || '').trim();
          if (!nombre) {
            aviso('Escribe el nombre de la institución en esta línea.', 'error');
            return;
          }
          creando = true;
          btn.disabled = true;
          try {
            const creada = await llamar(api.entidadCrear('institucion', proyectoId, { nombre }));
            instituciones.push(creada);
            empleoObj.institucion_id = String(creada.id);
            if (indiceEmpleo === 0) {
              fila.institucion_id = String(creada.id);
              fila.institucion_texto = empleoObj.institucion_texto;
            }
            invalidarCache(); notificarContadores();
            marcarCambio();
            aviso(`Institución ${creada.identificador} creada y vinculada a esta línea`, 'exito');
            pintarFilas();
          } catch (err) { aviso(err.message, 'error'); }
          finally {
            creando = false;
            if (btn.isConnected) btn.disabled = false;
          }
        });
        return btn;
      }

      function agregarPersona() {
        nivel.personas[bloque.id].push(filaPersona());
        marcarCambio();
        pintarFilas();
      }

      function quitarPersona(indice) {
        if (nivel.personas[bloque.id].length <= 1) {
          aviso('Debe quedar al menos una persona.', 'error');
          return;
        }
        nivel.personas[bloque.id].splice(indice, 1);
        marcarCambio();
        pintarFilas();
      }

      function botonera(indice) {
        const grupo = el('div', 'persona-linea-botones');
        const mas = el('button', 'btn btn-mini', '+');
        mas.title = 'Añadir persona';
        mas.setAttribute('aria-label', 'Añadir persona');
        mas.addEventListener('click', agregarPersona);
        const menos = el('button', 'btn btn-mini btn-peligroso', '✕');
        menos.title = 'Quitar persona';
        menos.setAttribute('aria-label', 'Quitar persona');
        menos.addEventListener('click', () => quitarPersona(indice));
        grupo.append(mas, menos);
        return grupo;
      }

      /* Línea de empleo: EMPLEO/OFICIO + INSTITUCIÓN con sus propios
         botones AÑADIR EMPLEO / ELIMINAR EMPLEO. */
      function lineaEmpleo(fila, indiceEmpleo) {
        const empleoObj = fila.empleos[indiceEmpleo];
        const linea = el('div', 'persona-linea');

        const eEmpleo = el('input', 'entrada');
        eEmpleo.value = empleoObj.empleo || '';
        eEmpleo.addEventListener('input', () => {
          empleoObj.empleo = eEmpleo.value;
          if (indiceEmpleo === 0) fila.empleo = eEmpleo.value;
        });
        linea.appendChild(envolturaCampo('EMPLEO/OFICIO', eEmpleo));

        let eInstitucion;
        if (institucionTexto) {
          eInstitucion = el('input', 'entrada');
          eInstitucion.placeholder = 'Nombre de la institución (texto)';
          eInstitucion.value = empleoObj.institucion_texto || '';
          eInstitucion.addEventListener('input', () => {
            empleoObj.institucion_texto = eInstitucion.value;
            if (indiceEmpleo === 0) fila.institucion_texto = eInstitucion.value;
          });
        } else {
          eInstitucion = el('select', 'entrada');
          eInstitucion.appendChild(new Option('—', ''));
          for (const opcion of opcionesEntidad(instituciones, 'institucion')) {
            eInstitucion.appendChild(new Option(opcion.etiqueta, opcion.valor));
          }
          eInstitucion.value = empleoObj.institucion_id ? String(empleoObj.institucion_id) : '';
          eInstitucion.addEventListener('change', () => {
            empleoObj.institucion_id = eInstitucion.value;
            if (indiceEmpleo === 0) fila.institucion_id = eInstitucion.value;
          });
        }
        linea.appendChild(envolturaCampo('INSTITUCIÓN', eInstitucion));
        if (institucionTexto) {
          linea.appendChild(envolturaCampo('VINCULAR INSTITUCIÓN',
            crearSelectInstitucionEmpleo(fila, empleoObj, indiceEmpleo)));
        }

        const grupo = el('div', 'persona-linea-botones');
        if (institucionTexto) {
          grupo.appendChild(crearBotonInstitucionEmpleo(fila, empleoObj, indiceEmpleo));
        }
        const mas = el('button', 'btn btn-mini', '+');
        mas.title = 'Añadir empleo';
        mas.setAttribute('aria-label', 'Añadir empleo');
        mas.addEventListener('click', () => {
          fila.empleos.splice(indiceEmpleo + 1, 0, { empleo: '', institucion_texto: '', institucion_id: '' });
          marcarCambio();
          pintarFilas();
        });
        const menos = el('button', 'btn btn-mini btn-peligroso', '✕');
        menos.title = 'Eliminar empleo';
        menos.setAttribute('aria-label', 'Eliminar empleo');
        menos.addEventListener('click', () => {
          if (fila.empleos.length <= 1) {
            aviso('Debe quedar al menos un empleo.', 'error');
            return;
          }
          fila.empleos.splice(indiceEmpleo, 1);
          fila.empleo = fila.empleos[0].empleo;
          fila.institucion_texto = fila.empleos[0].institucion_texto;
          fila.institucion_id = fila.empleos[0].institucion_id;
          marcarCambio();
          pintarFilas();
        });
        grupo.append(mas, menos);
        linea.appendChild(grupo);
        return linea;
      }

      function renderSubbloques(fila, contenedor) {
        if (!Array.isArray(bloque.bloques) || !bloque.bloques.length) return;
        const caja = el('div', 'persona-subbloques');
        contenedor.appendChild(caja);
        const nivelHijo = {
          personas: fila.personas || (fila.personas = {}),
          patrimonios: fila.patrimonios || (fila.patrimonios = {}),
          instituciones: fila.instituciones || (fila.instituciones = {}),
          servicios: fila.servicios || (fila.servicios = {}),
          items: fila.items || (fila.items = {}),
          grupos: fila.grupos || (fila.grupos = {}),
        };
        renderBloques(bloque.bloques, caja, nivelHijo);
      }

      function pintarFilas() {
        filas.innerHTML = '';
        nivel.personas[bloque.id].forEach((fila, indice) => {
          const cont = el('div', 'fila-persona');

          if (dosLineas) {
            if (!Array.isArray(fila.empleos) || !fila.empleos.length) {
              fila.empleos = [{
                empleo: fila.empleo || '',
                institucion_texto: fila.institucion_texto || '',
                institucion_id: fila.institucion_id || '',
              }];
            }
            const linea1 = el('div', 'persona-linea');
            const linea3 = el('div', 'persona-linea persona-vinculos');
            cont.appendChild(linea1);

            for (const [clave, etiqueta] of [['titulo', 'TRATAMIENTO/TÍTULO'], ['nombres', 'NOMBRES'], ['apellidos', 'APELLIDOS']]) {
              const entrada = el('input', 'entrada');
              entrada.value = fila[clave] || '';
              entrada.addEventListener('input', () => { fila[clave] = entrada.value; });
              linea1.appendChild(envolturaCampo(etiqueta, entrada));
            }
            if (bloque.sinBotones !== true) {
              linea1.appendChild(botonera(indice));
            }

            if (Array.isArray(bloque.extras) && bloque.extras.length) {
              const lineaExtra = el('div', 'persona-linea');
              for (const extra of bloque.extras) {
                const clave = extra.clave || extra.nombre.toLowerCase().replace(/[^a-z0-9]+/g, '_');
                let entrada;
                if (extra.tipo === 'lugar') {
                  entrada = el('select', 'entrada');
                  entrada.appendChild(new Option('—', ''));
                  for (const opcion of opcionesEntidad(lugares, 'lugar')) {
                    entrada.appendChild(new Option(opcion.etiqueta, opcion.valor));
                  }
                  entrada.value = fila[clave] ? String(fila[clave]) : '';
                  entrada.addEventListener('change', () => { fila[clave] = entrada.value; });
                } else {
                  entrada = el('input', 'entrada');
                  entrada.value = fila[clave] || '';
                  entrada.addEventListener('input', () => { fila[clave] = entrada.value; });
                }
                lineaExtra.appendChild(envolturaCampo(extra.nombre, entrada));
              }
              cont.appendChild(lineaExtra);
            }

            for (let i = 0; i < fila.empleos.length; i++) {
              if (bloque.sinEmpleo) break;
              cont.appendChild(lineaEmpleo(fila, i));
            }

            cont.appendChild(linea3);
            linea3.appendChild(envolturaCampo('VINCULAR PERSONA', crearSelectPersona(fila)));
            const accionesLinea = el('div', 'fila-acciones-inline');
            if (institucionTexto && bloque.soloVinculos !== true
              && !(Array.isArray(fila.empleos) && fila.empleos.length)) {
              accionesLinea.appendChild(crearBotonInstitucion(fila));
            }
            accionesLinea.appendChild(crearBotonPersona(fila));
            linea3.appendChild(accionesLinea);
          } else {
            for (const [clave, etiqueta] of [['titulo', 'TRATAMIENTO/TÍTULO'], ['nombres', 'NOMBRES'], ['apellidos', 'APELLIDOS'], ['empleo', 'EMPLEO/OFICIO']]) {
              const entrada = el('input', 'entrada');
              entrada.value = fila[clave] || '';
              entrada.addEventListener('input', () => { fila[clave] = entrada.value; });
              cont.appendChild(envolturaCampo(etiqueta, entrada));
            }
            cont.appendChild(envolturaCampo('INSTITUCIÓN',
              institucionTexto ? crearInputInstitucionTexto(fila) : crearSelectInstitucion(fila)));
            cont.appendChild(envolturaCampo('VINCULAR PERSONA', crearSelectPersona(fila)));

            const acciones = el('div', 'fila-acciones');
            if (institucionTexto) acciones.appendChild(crearBotonInstitucion(fila));
            acciones.appendChild(crearBotonPersona(fila));
            if (nivel.personas[bloque.id].length > 1) {
              const btnQuitar = el('button', 'btn btn-mini btn-peligroso', '✕');
              btnQuitar.title = 'Quitar persona';
              btnQuitar.addEventListener('click', () => quitarPersona(indice));
              acciones.appendChild(btnQuitar);
            }
            cont.appendChild(acciones);
          }

          renderSubbloques(fila, cont);
          filas.appendChild(cont);
        });
      }

      btnAdd.addEventListener('click', agregarPersona);
      pintarFilas();
      contenedor.appendChild(caja);
    }

    function crearItemsInventario(bloque, contenedor, nivel) {
      const caja = el('div', 'inventario-items');
      caja.appendChild(el('div', 'inventario-items-titulo', bloque.titulo || 'AÑADIR/ELIMINAR ÍTEM'));
      const filas = el('div', 'filas-inventario');
      caja.appendChild(filas);
      if (!Array.isArray(nivel.items[bloque.id]) || !nivel.items[bloque.id].length) {
        nivel.items[bloque.id] = [filaItem()];
      }
      const campos = bloque.campos || {};
      const etiquetaDe = (campo, porDefecto) => campo?.nombre || porDefecto;

      function campo(etiqueta, entrada, clase) {
        const envoltura = el('div', `campo${clase ? ` ${clase}` : ''}`);
        envoltura.appendChild(el('label', '', etiqueta));
        envoltura.appendChild(entrada);
        adjuntarSugerencias(entrada, etiqueta, envoltura);
        return envoltura;
      }

      function entradaTexto(valor) {
        const entrada = el('input', 'entrada');
        entrada.value = valor ?? '';
        return entrada;
      }

      function entradaNumero(valor) {
        const entrada = entradaTexto(valor);
        entrada.inputMode = 'numeric';
        entrada.maxLength = 6;
        entrada.classList.add('entrada-numero');
        return entrada;
      }

      function entradaEntero(valor) {
        const entrada = entradaNumero(valor);
        entrada.type = 'number';
        entrada.step = '1';
        entrada.min = '0';
        return entrada;
      }

      function entradaSelect(valor, opciones) {
        const entrada = el('select', 'entrada');
        entrada.appendChild(new Option('—', ''));
        for (const opcion of opciones) entrada.appendChild(new Option(opcion, opcion));
        entrada.value = valor !== undefined && valor !== null ? String(valor) : '';
        return entrada;
      }

      function valorResumen(campoResumen, clase) {
        const clave = campoResumen?.id;
        const entrada = entradaNumero(clave ? nivel.valores[clave] : '');
        entrada.readOnly = true;
        entrada.title = 'Se calcula automáticamente sumando los ítems de la categoría';
        if (clase) entrada.classList.add(clase);
        return entrada;
      }

      function valorResumenTexto(campoResumen, clase) {
        const clave = campoResumen?.id;
        const entrada = entradaTexto(clave ? nivel.valores[clave] : '');
        entrada.readOnly = true;
        if (clase) entrada.classList.add(clase);
        return entrada;
      }

      function pintar() {
        filas.innerHTML = '';
        const items = nivel.items[bloque.id];
        items.forEach((fila, indice) => {
          const linea = el('div', 'fila-inventario');

          const eAnio = el('input', 'entrada');
          eAnio.type = 'number';
          eAnio.step = '1';
          eAnio.placeholder = 'aaaa';
          eAnio.value = fila.anio || '';
          eAnio.addEventListener('input', () => { fila.anio = eAnio.value; });
          linea.appendChild(campo(etiquetaDe(campos.anio, 'AÑO'), eAnio));

          const cajaFecha = el('div', 'fecha-historica');
          const eFecha = el('input', 'entrada');
          eFecha.value = fila.fecha || '';
          eFecha.placeholder = 'Fecha exacta';
          eFecha.addEventListener('input', () => {
            fila.fecha = eFecha.value;
            fila.fecha_meta = '';
          });
          cajaFecha.appendChild(eFecha);
          linea.appendChild(campo(etiquetaDe(campos.fecha, 'FECHA EXACTA'), cajaFecha));
          let meta = {};
          try { meta = fila.fecha_meta ? JSON.parse(fila.fecha_meta) : {}; } catch { meta = {}; }
          FechaHistorica.adjuntar(eFecha, meta, (nueva) => {
            fila.fecha_meta = JSON.stringify(nueva);
          }, { anio: () => eAnio.value });

          const eItem = entradaTexto(fila.item);
          eItem.addEventListener('input', () => { fila.item = eItem.value; });
          linea.appendChild(campo(etiquetaDe(campos.item, 'ÍTEM'), eItem));

          const eCantidad = entradaNumero(fila.cantidad);
          eCantidad.addEventListener('input', () => { fila.cantidad = eCantidad.value; });
          linea.appendChild(campo(etiquetaDe(campos.cantidad, 'CANTIDAD'), eCantidad, 'campo-numero'));

          const ePeso = entradaEntero(fila.peso);
          ePeso.addEventListener('input', () => { fila.peso = ePeso.value; });
          linea.appendChild(campo(etiquetaDe(campos.peso, 'PESO'), ePeso, 'campo-numero'));

          const eReales = entradaSelect(fila.reales, ['0', '1', '2', '3', '4', '5', '6', '7', '8']);
          eReales.addEventListener('change', () => { fila.reales = eReales.value; });
          linea.appendChild(campo(etiquetaDe(campos.reales, 'REALES'), eReales, 'campo-numero'));

          const eCuartillos = entradaSelect(fila.cuartillos, ['1/4', '1/2', '3/4']);
          eCuartillos.addEventListener('change', () => { fila.cuartillos = eCuartillos.value; });
          linea.appendChild(campo(etiquetaDe(campos.cuartillos, 'CUARTILLOS'), eCuartillos, 'campo-numero'));

          const botones = el('div', 'inventario-botones');
          botones.title = 'AÑADIR/ELIMINAR ÍTEM';
          const mas = el('button', 'btn btn-mini', '+');
          mas.type = 'button';
          mas.title = 'Añadir ítem';
          mas.setAttribute('aria-label', 'Añadir ítem');
          mas.addEventListener('click', () => {
            items.splice(indice + 1, 0, filaItem());
            marcarCambio();
            pintar();
          });
          const menos = el('button', 'btn btn-mini btn-peligroso', '✕');
          menos.type = 'button';
          menos.title = 'Eliminar ítem';
          menos.setAttribute('aria-label', 'Eliminar ítem');
          menos.addEventListener('click', () => {
            if (items.length <= 1) { aviso('Debe quedar al menos un ítem.', 'error'); return; }
            items.splice(indice, 1);
            marcarCambio();
            pintar();
          });
          botones.append(mas, menos);
          linea.appendChild(botones);
          filas.appendChild(linea);
        });

        const subtotal = el('div', 'fila-inventario fila-resumen');
        subtotal.append(
          el('div', 'inventario-hueco'),
          el('div', 'inventario-hueco'),
          el('div', 'inventario-hueco')
        );
        subtotal.appendChild(campo(
          etiquetaDe(campos.subtotalCantidad, 'SUBTOTAL CANTIDAD'),
          valorResumen(campos.subtotalCantidad, 'entrada-subtotal-cantidad'),
          'campo-numero'
        ));
        subtotal.appendChild(campo(
          etiquetaDe(campos.subtotalPeso, 'SUBTOTAL PESO'),
          valorResumen(campos.subtotalPeso, 'entrada-subtotal-peso'),
          'campo-numero'
        ));
        subtotal.appendChild(campo(
          etiquetaDe(campos.subtotalReales, 'SUBTOTAL REALES'),
          valorResumen(campos.subtotalReales, 'entrada-subtotal-reales'),
          'campo-numero'
        ));
        subtotal.appendChild(campo(
          etiquetaDe(campos.subtotalCuartillos, 'SUBTOTAL CUARTILLOS'),
          valorResumenTexto(campos.subtotalCuartillos, 'entrada-subtotal-cuartillos'),
          'campo-numero'
        ));
        subtotal.appendChild(el('div', 'inventario-hueco'));
        filas.appendChild(subtotal);
        recalcularInventario();
      }

      pintar();
      contenedor.appendChild(caja);
    }

    function crearTotalesInventario(bloque, contenedor, nivel) {
      const caja = el('div', 'totales-inventario');
      caja.dataset.totales = bloque.id;
      const fila = el('div', 'fila-inventario fila-resumen');
      const campos = bloque.campos || {};
      const etiquetaDe = (campo, porDefecto) => campo?.nombre || porDefecto;

      function campo(etiqueta, entrada, clase) {
        const envoltura = el('div', `campo${clase ? ` ${clase}` : ''}`);
        envoltura.appendChild(el('label', '', etiqueta));
        envoltura.appendChild(entrada);
        adjuntarSugerencias(entrada, etiqueta, envoltura);
        return envoltura;
      }

      function entradaNumero(valor) {
        const entrada = el('input', 'entrada');
        entrada.value = valor ?? '';
        entrada.inputMode = 'numeric';
        entrada.maxLength = 6;
        entrada.classList.add('entrada-numero');
        return entrada;
      }

      function valorResumen(campoResumen, clase) {
        const clave = campoResumen?.id;
        const entrada = entradaNumero(clave ? nivel.valores[clave] : '');
        entrada.readOnly = true;
        entrada.title = 'Se calcula automáticamente sumando los subtotales de las categorías';
        if (clase) entrada.classList.add(clase);
        return entrada;
      }

      function valorResumenTexto(campoResumen, clase) {
        const clave = campoResumen?.id;
        const entrada = el('input', 'entrada');
        entrada.value = clave && nivel.valores[clave] !== undefined ? nivel.valores[clave] : '';
        entrada.readOnly = true;
        if (clase) entrada.classList.add(clase);
        return entrada;
      }

      fila.append(
        el('div', 'inventario-hueco'),
        el('div', 'inventario-hueco'),
        el('div', 'inventario-hueco')
      );
      fila.appendChild(campo(
        etiquetaDe(campos.totalCantidad, 'TOTAL SUBTOTALES CANTIDAD'),
        valorResumen(campos.totalCantidad, 'entrada-total-cantidad'),
        'campo-numero'
      ));
      fila.appendChild(campo(
        etiquetaDe(campos.totalPeso, 'TOTAL SUBTOTALES PESO'),
        valorResumen(campos.totalPeso, 'entrada-total-peso'),
        'campo-numero'
      ));
      fila.appendChild(campo(
        etiquetaDe(campos.totalReales, 'TOTAL SUBTOTALES REALES'),
        valorResumen(campos.totalReales, 'entrada-total-reales'),
        'campo-numero'
      ));
      fila.appendChild(campo(
        etiquetaDe(campos.totalCuartillos, 'TOTAL SUBTOTALES CUARTILLOS'),
        valorResumenTexto(campos.totalCuartillos, 'entrada-total-cuartillos'),
        'campo-numero'
      ));
      fila.appendChild(el('div', 'inventario-hueco'));
      caja.appendChild(fila);
      contenedor.appendChild(caja);
    }

    function crearServicios(bloque, contenedor, nivel) {
      const caja = el('div', 'bloque-servicios');
      const filas = el('div', 'filas-servicio');
      caja.appendChild(filas);
      if (!Array.isArray(nivel.servicios[bloque.id]) || !nivel.servicios[bloque.id].length) {
        nivel.servicios[bloque.id] = [filaServicio()];
      }
      const claveTotal = (sufijo) => `total_${sufijo}_${bloque.id}`;
      const entradasTotales = {};

      function recalcularTotales() {
        const items = nivel.servicios[bloque.id];
        const sumar = (campo) => items.reduce((total, fila) => {
          const numero = Number(String(fila[campo] ?? '').replace(',', '.'));
          return total + (Number.isFinite(numero) ? numero : 0);
        }, 0);
        /* Auditoría entre columnas: 30 días = 1 mes y 12 meses = 1 año. */
        let dias = sumar('dias');
        let meses = sumar('meses') + Math.floor(dias / 30);
        dias %= 30;
        const anios = sumar('anios') + Math.floor(meses / 12);
        meses %= 12;
        const totales = { anios, meses, dias };
        for (const sufijo of ['anios', 'meses', 'dias']) {
          nivel.valores[claveTotal(sufijo)] = String(totales[sufijo]);
          if (entradasTotales[sufijo]) entradasTotales[sufijo].value = String(totales[sufijo]);
        }
      }

      function entradaDeFila(filaDom, etiqueta) {
        const campoFila = [...filaDom.querySelectorAll('.campo')]
          .find((c) => c.querySelector('label')?.textContent === etiqueta);
        return campoFila ? campoFila.querySelector('input') : null;
      }

      /* Cada línea dura desde su INICIO hasta el INICIO de la siguiente; la
         última se cierra con la FECHA EXACTA de REGISTRO. */
      function recalcularServicios() {
        const items = nivel.servicios[bloque.id];
        const filasDom = [...filas.querySelectorAll('.fila-servicio:not(.fila-servicio-totales)')];
        const cierre = bloque.campoFechaCierre
          ? fechaEstructurada(
            nivel.valores[bloque.campoFechaCierre] || '',
            nivel.valores[`${bloque.campoFechaCierre}_meta`]
          )
          : null;
        items.forEach((fila, indice) => {
          const inicio = fechaEstructurada(fila.inicio, fila.inicio_meta);
          const siguiente = items[indice + 1];
          const fin = siguiente
            ? fechaEstructurada(siguiente.inicio, siguiente.inicio_meta)
            : cierre;
          const diferencia = inicio && fin ? diferenciaYMD(inicio, fin) : null;
          fila.anios = diferencia ? String(diferencia.anios) : '';
          fila.meses = diferencia ? String(diferencia.meses) : '';
          fila.dias = diferencia ? String(diferencia.dias) : '';
          const filaDom = filasDom[indice];
          if (filaDom) {
            const eAniosFila = entradaDeFila(filaDom, 'AÑOS');
            const eMesesFila = entradaDeFila(filaDom, 'MESES');
            const eDiasFila = entradaDeFila(filaDom, 'DÍAS');
            if (eAniosFila) eAniosFila.value = fila.anios;
            if (eMesesFila) eMesesFila.value = fila.meses;
            if (eDiasFila) eDiasFila.value = fila.dias;
          }
        });
        recalcularTotales();
      }

      function campo(etiqueta, entrada) {
        const envoltura = el('div', 'campo');
        envoltura.appendChild(el('label', '', etiqueta));
        envoltura.appendChild(entrada);
        adjuntarSugerencias(entrada, etiqueta, envoltura);
        return envoltura;
      }

      function pintar() {
        filas.innerHTML = '';
        const items = nivel.servicios[bloque.id];
        items.forEach((fila, indice) => {
          const linea = el('div', 'fila-servicio');

          const eEmpleo = el('input', 'entrada');
          eEmpleo.value = fila.empleo || '';
          eEmpleo.addEventListener('input', () => { fila.empleo = eEmpleo.value; });
          linea.appendChild(campo('EMPLEO/OFICIO', eEmpleo));

          const cajaInicio = el('div', 'fecha-historica');
          const eInicio = el('input', 'entrada');
          eInicio.value = fila.inicio || '';
          eInicio.placeholder = 'Fecha';
          eInicio.addEventListener('input', () => {
            fila.inicio = eInicio.value;
            fila.inicio_meta = '';
          });
          cajaInicio.appendChild(eInicio);
          linea.appendChild(campo('INICIO', cajaInicio));
          let metaInicio = {};
          try { metaInicio = fila.inicio_meta ? JSON.parse(fila.inicio_meta) : {}; } catch { metaInicio = {}; }
          FechaHistorica.adjuntar(eInicio, metaInicio, (nueva) => {
            fila.inicio_meta = JSON.stringify(nueva);
          });

          const eAnios = el('input', 'entrada');
          eAnios.readOnly = true;
          eAnios.title = 'Duración hasta el siguiente INICIO o, en la última línea, hasta la FECHA EXACTA de REGISTRO';
          eAnios.value = fila.anios || '';
          linea.appendChild(campo('AÑOS', eAnios));

          const eMeses = el('input', 'entrada');
          eMeses.readOnly = true;
          eMeses.title = 'Duración hasta el siguiente INICIO o, en la última línea, hasta la FECHA EXACTA de REGISTRO';
          eMeses.value = fila.meses || '';
          linea.appendChild(campo('MESES', eMeses));

          const eDias = el('input', 'entrada');
          eDias.readOnly = true;
          eDias.title = 'Duración hasta el siguiente INICIO o, en la última línea, hasta la FECHA EXACTA de REGISTRO';
          eDias.value = fila.dias || '';
          linea.appendChild(campo('DÍAS', eDias));

          const grupo = el('div', 'persona-linea-botones');
          const mas = el('button', 'btn btn-mini', '+');
          mas.title = 'Añadir servicio';
          mas.setAttribute('aria-label', 'Añadir servicio');
          mas.addEventListener('click', () => {
            items.splice(indice + 1, 0, filaServicio());
            marcarCambio();
            pintar();
          });
          const menos = el('button', 'btn btn-mini btn-peligroso', '✕');
          menos.title = 'Quitar servicio';
          menos.setAttribute('aria-label', 'Quitar servicio');
          menos.addEventListener('click', () => {
            if (items.length <= 1) { aviso('Debe quedar al menos un servicio.', 'error'); return; }
            items.splice(indice, 1);
            marcarCambio();
            pintar();
          });
          grupo.append(mas, menos);
          linea.appendChild(grupo);
          filas.appendChild(linea);
        });

        const totales = el('div', 'fila-servicio fila-servicio-totales');
        totales.appendChild(el('div', 'servicio-espaciador'));
        totales.appendChild(el('div', 'servicio-espaciador'));
        for (const [sufijo, etiqueta] of [['anios', 'TOTAL AÑOS'], ['meses', 'TOTAL MESES'], ['dias', 'TOTAL DÍAS']]) {
          const entrada = el('input', 'entrada');
          entrada.readOnly = true;
          entrada.title = 'Suma de la columna, con acarreo: 30 días = 1 mes y 12 meses = 1 año';
          entrada.value = nivel.valores[claveTotal(sufijo)] || '0';
          entradasTotales[sufijo] = entrada;
          totales.appendChild(campo(etiqueta, entrada));
        }
        totales.appendChild(el('div', 'servicio-espaciador'));
        filas.appendChild(totales);
        recalcularServicios();
      }

      function programarRecalculo() {
        if (recalculoPendiente) return;
        recalculoPendiente = true;
        requestAnimationFrame(() => {
          recalculoPendiente = false;
          recalcularServicios();
        });
      }

      let recalculoPendiente = false;
      pintar();
      contenedor.appendChild(caja);
      const raizFormulario = contenedor.closest('.form-bloque') || contenedor;
      if (!raizFormulario._recalculosServicios) {
        raizFormulario._recalculosServicios = new Set();
        const ejecutar = () => {
          for (const recalcular of [...raizFormulario._recalculosServicios]) {
            if (!recalcular.caja.isConnected) {
              raizFormulario._recalculosServicios.delete(recalcular);
              continue;
            }
            recalcular.fn();
          }
        };
        raizFormulario.addEventListener('input', ejecutar);
        raizFormulario.addEventListener('change', ejecutar);
      }
      const recalculo = { caja, fn: programarRecalculo };
      raizFormulario._recalculosServicios.add(recalculo);
    }

    function crearInstituciones(bloque, contenedor, nivel) {
      const caja = el('div', 'bloque-instituciones');
      const filas = el('div', 'filas-persona');
      caja.appendChild(filas);
      if (!Array.isArray(nivel.instituciones[bloque.id]) || !nivel.instituciones[bloque.id].length) {
        nivel.instituciones[bloque.id] = [{ texto: '', institucion_id: '' }];
      }

      function pintarFilas() {
        filas.innerHTML = '';
        const items = nivel.instituciones[bloque.id];
        items.forEach((fila, indice) => {
          const linea = el('div', 'persona-linea');
          const envoltura = el('div', 'campo campo-inst-texto');
          envoltura.appendChild(el('label', '', 'INSTITUCIÓN'));
          const entrada = el('input', 'entrada');
          entrada.value = fila.texto || '';
          entrada.addEventListener('input', () => { fila.texto = entrada.value; });
          envoltura.appendChild(entrada);
          adjuntarSugerencias(entrada, 'INSTITUCIÓN', envoltura);
          linea.appendChild(envoltura);

          const envolturaSel = el('div', 'campo');
          envolturaSel.appendChild(el('label', '', 'VINCULAR INSTITUCIÓN'));
          const sel = el('select', 'entrada');
          sel.appendChild(new Option('—', ''));
          for (const opcion of opcionesEntidad(instituciones, 'institucion')) {
            sel.appendChild(new Option(opcion.etiqueta, opcion.valor));
          }
          sel.value = fila.institucion_id ? String(fila.institucion_id) : '';
          sel.addEventListener('change', () => { fila.institucion_id = sel.value; });
          envolturaSel.appendChild(sel);
          linea.appendChild(envolturaSel);

          const grupo = el('div', 'persona-linea-botones');
          const btnCrear = el('button', 'btn btn-mini', '＋ Crear institución');
          let creandoInstitucion = false;
          btnCrear.title = 'Crea una institución con el nombre escrito en esta línea';
          btnCrear.addEventListener('click', async () => {
            if (creandoInstitucion) return;
            const nombre = String(fila.texto || '').trim();
            if (!nombre) { aviso('Escribe el nombre de la institución.', 'error'); return; }
            creandoInstitucion = true;
            btnCrear.disabled = true;
            try {
              const creada = await llamar(api.entidadCrear('institucion', proyectoId, { nombre }));
              instituciones.push(creada);
              fila.institucion_id = String(creada.id);
              invalidarCache(); notificarContadores();
              marcarCambio();
              aviso(`Institución ${creada.identificador} creada y vinculada a esta línea`, 'exito');
              pintarFilas();
            } catch (err) { aviso(err.message, 'error'); }
            finally {
              creandoInstitucion = false;
              if (btnCrear.isConnected) btnCrear.disabled = false;
            }
          });
          grupo.appendChild(btnCrear);
          const mas = el('button', 'btn btn-mini', '+');
          mas.title = 'Añadir institución';
          mas.setAttribute('aria-label', 'Añadir institución');
          mas.addEventListener('click', () => {
            items.splice(indice + 1, 0, { texto: '', institucion_id: '' });
            marcarCambio();
            pintarFilas();
          });
          const menos = el('button', 'btn btn-mini btn-peligroso', '✕');
          menos.title = 'Quitar institución';
          menos.setAttribute('aria-label', 'Quitar institución');
          menos.addEventListener('click', () => {
            if (items.length <= 1) { aviso('Debe quedar al menos una institución.', 'error'); return; }
            items.splice(indice, 1);
            marcarCambio();
            pintarFilas();
          });
          grupo.append(mas, menos);
          linea.appendChild(grupo);
          filas.appendChild(linea);
        });
      }

      pintarFilas();
      contenedor.appendChild(caja);
    }

    function crearPatrimonios(bloque, contenedor, nivel) {
      const caja = el('div', 'bloque-patrimonios');
      const cab = el('div', 'bloque-personas-cab');
      cab.appendChild(el('h6', 'rol-titulo', bloque.titulo));
      const btnAdd = el('button', 'btn btn-mini', '+');
      cab.appendChild(btnAdd);
      caja.appendChild(cab);
      const filas = el('div', 'filas-persona');
      caja.appendChild(filas);
      if (!Array.isArray(nivel.patrimonios[bloque.id]) || !nivel.patrimonios[bloque.id].length) {
        nivel.patrimonios[bloque.id] = [filaPatrimonio()];
      }

      function pintarFilas() {
        filas.innerHTML = '';
        nivel.patrimonios[bloque.id].forEach((fila, indice) => {
          const cont = el('div', 'fila-persona');
          const campos = [['nombre', 'NOMBRE'], ['valor', 'VALOR/TASACIÓN']];
          for (const [clave, etiqueta] of campos) {
            const envoltura = el('div', 'campo');
            envoltura.appendChild(el('label', '', etiqueta));
            const entrada = el('input', 'entrada');
            entrada.value = fila[clave] || '';
            entrada.addEventListener('input', () => { fila[clave] = entrada.value; });
            envoltura.appendChild(entrada);
            adjuntarSugerencias(entrada, etiqueta, envoltura);
            cont.appendChild(envoltura);
          }
          const envolturaTipo = el('div', 'campo');
          envolturaTipo.appendChild(el('label', '', 'TIPO'));
          const entradaTipo = el('input', 'entrada');
          entradaTipo.placeholder = 'Tipo';
          entradaTipo.value = fila.tipo || '';
          entradaTipo.addEventListener('input', () => { fila.tipo = entradaTipo.value; });
          envolturaTipo.appendChild(entradaTipo);
          adjuntarSugerencias(entradaTipo, 'TIPO', envolturaTipo);
          cont.appendChild(envolturaTipo);

          const envolturaVinc = el('div', 'campo');
          envolturaVinc.appendChild(el('label', '', 'VINCULAR PATRIMONIO'));
          const selPat = el('select', 'entrada');
          selPat.appendChild(new Option('—', ''));
          for (const opcion of opcionesEntidad(patrimonios, 'patrimonio')) {
            selPat.appendChild(new Option(opcion.etiqueta, opcion.valor));
          }
          selPat.value = fila.patrimonio_id ? String(fila.patrimonio_id) : '';
          selPat.addEventListener('change', () => { fila.patrimonio_id = selPat.value; });
          envolturaVinc.appendChild(selPat);
          cont.appendChild(envolturaVinc);

          const acciones = el('div', 'fila-acciones');
          const btnCrear = el('button', 'btn btn-mini', '＋ Crear patrimonio');
          let creandoPatrimonio = false;
          btnCrear.addEventListener('click', async () => {
            if (creandoPatrimonio) return;
            if (!String(fila.nombre || '').trim()) { aviso('Escribe al menos el nombre del patrimonio.', 'error'); return; }
            creandoPatrimonio = true;
            btnCrear.disabled = true;
            try {
              const creado = await llamar(api.entidadCrear('patrimonio', proyectoId, {
                nombre: fila.nombre,
                tipo: fila.tipo,
                valor: fila.valor,
              }));
              patrimonios.push(creado);
              fila.patrimonio_id = String(creado.id);
              invalidarCache(); notificarContadores();
              marcarCambio();
              aviso(`Patrimonio ${creado.identificador} creado y vinculado`, 'exito');
              pintarFilas();
            } catch (err) { aviso(err.message, 'error'); }
            finally {
              creandoPatrimonio = false;
              if (btnCrear.isConnected) btnCrear.disabled = false;
            }
          });
          acciones.appendChild(btnCrear);
          if (nivel.patrimonios[bloque.id].length > 1) {
            const btnQuitar = el('button', 'btn btn-mini btn-peligroso', '✕');
            btnQuitar.addEventListener('click', () => {
              nivel.patrimonios[bloque.id].splice(indice, 1);
              marcarCambio();
              pintarFilas();
            });
            acciones.appendChild(btnQuitar);
          }
          cont.appendChild(acciones);
          filas.appendChild(cont);
        });
      }

      btnAdd.addEventListener('click', () => {
        nivel.patrimonios[bloque.id].push(filaPatrimonio());
        marcarCambio();
        pintarFilas();
      });
      pintarFilas();
      contenedor.appendChild(caja);
    }

    function renderBloques(bloques, contenedor, nivel) {
      for (const bloque of bloques) {
        if (bloque.tipo === 'seccion') {
          contenedor.appendChild(el('h4', 'seccion-bloque', bloque.titulo));
        } else if (bloque.tipo === 'subseccion') {
          contenedor.appendChild(el('h5', 'subseccion-bloque', bloque.titulo));
        } else if (bloque.tipo === 'campos') {
          const grid = el('div', 'bloque-campos');
          for (let i = 0; i < bloque.campos.length; i++) {
            const campo = bloque.campos[i];
            let anioCampo = null;
            if (campo.tipo === 'fecha') {
              for (let j = i - 1; j >= 0; j--) {
                if (bloque.campos[j].tipo === 'anio') { anioCampo = bloque.campos[j]; break; }
              }
              if (!anioCampo) anioCampo = bloque.campos.find((c) => c.tipo === 'anio') || null;
            }
            crearCampo(campo, grid, nivel, {
              anio: anioCampo ? () => nivel.valores[anioCampo.id] : null,
            });
          }
          contenedor.appendChild(grid);
        } else if (bloque.tipo === 'personas') {
          crearPersonas(bloque, contenedor, nivel);
        } else if (bloque.tipo === 'patrimonios') {
          crearPatrimonios(bloque, contenedor, nivel);
        } else if (bloque.tipo === 'instituciones') {
          crearInstituciones(bloque, contenedor, nivel);
        } else if (bloque.tipo === 'servicios') {
          crearServicios(bloque, contenedor, nivel);
        } else if (bloque.tipo === 'items-inventario') {
          crearItemsInventario(bloque, contenedor, nivel);
        } else if (bloque.tipo === 'totales-inventario') {
          crearTotalesInventario(bloque, contenedor, nivel);
        } else if (bloque.tipo === 'grupo') {
          const caja = el('div', 'grupo-bloque');
          caja.dataset.grupo = bloque.id;
          const cab = el('div', 'grupo-cab');
          cab.appendChild(el('h5', 'subseccion-bloque', bloque.titulo));
          const btnAdd = el('button', 'btn btn-mini', '+ Añadir');
          cab.appendChild(btnAdd);
          caja.appendChild(cab);
          const instancias = el('div', 'grupo-instancias');
          caja.appendChild(instancias);
          contenedor.appendChild(caja);

          function pintarInstancias() {
            instancias.innerHTML = '';
            nivel.grupos[bloque.id].forEach((instancia, indice) => {
              const card = el('div', 'grupo-instancia');
              const header = el('div', 'grupo-instancia-cab');
              header.appendChild(el('span', 'rol-titulo', `${bloque.titulo} ${indice + 1}`));
              if (nivel.grupos[bloque.id].length > 1) {
                const btnQuitar = el('button', 'btn btn-mini btn-peligroso', '✕');
                btnQuitar.addEventListener('click', () => {
                  nivel.grupos[bloque.id].splice(indice, 1);
                  marcarCambio();
                  pintarInstancias();
                  recalcularInventario();
                });
                header.appendChild(btnQuitar);
              }
              card.appendChild(header);
              const cuerpo = el('div', 'grupo-cuerpo');
              renderBloques(bloque.bloques, cuerpo, instancia);
              card.appendChild(cuerpo);
              instancias.appendChild(card);
            });
          }

          btnAdd.addEventListener('click', () => {
            const instancia = {};
            nivel.grupos[bloque.id].push(instancia);
            const ref = nivel.grupos[bloque.id][nivel.grupos[bloque.id].length - 1];
            ref.valores = {}; ref.personas = {}; ref.patrimonios = {};
            ref.instituciones = {}; ref.servicios = {}; ref.items = {}; ref.grupos = {};
            preparar(bloque.bloques, ref);
            marcarCambio();
            pintarInstancias();
            recalcularInventario();
          });
          pintarInstancias();
        }
      }
    }

    renderBloques(esquema.bloques, raiz, estado);
    recalcularInventario();
    let recalculoInventarioPendiente = false;
    const programarRecalculoInventario = () => {
      if (recalculoInventarioPendiente) return;
      recalculoInventarioPendiente = true;
      const marco = typeof requestAnimationFrame === 'function'
        ? requestAnimationFrame
        : (callback) => setTimeout(callback, 0);
      marco(() => {
        recalculoInventarioPendiente = false;
        recalcularInventario();
      });
    };
    raiz.addEventListener('input', programarRecalculoInventario);
    raiz.addEventListener('change', programarRecalculoInventario);
    return {
      elemento: raiz,
      obtenerDatos: () => JSON.parse(JSON.stringify(estado)),
      marcarCambio,
    };
  }

  return { crearEditor, filaPersona, filaPatrimonio, invalidarCache, tituloRegistro, datosRegistro };
})();

window.BloquesRegistro = BloquesRegistro;
