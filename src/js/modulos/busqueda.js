'use strict';

/* H-IMAGO · Búsqueda general
   Motor de búsqueda del proyecto: entidades, relaciones, bloques de registro,
   transcripciones y posibles coincidencias. El índice se construye en el
   proceso principal y se consulta desde aquí; el renderer solo pinta. */

MODULOS.busqueda = (() => {
  const TIPOS = [
    { clave: 'persona', etiqueta: 'Personas', singular: 'Persona', color: '#d9a05b' },
    { clave: 'institucion', etiqueta: 'Instituciones', singular: 'Institución', color: '#7ea8c9' },
    { clave: 'lugar', etiqueta: 'Lugares', singular: 'Lugar', color: '#86b28a' },
    { clave: 'patrimonio', etiqueta: 'Patrimonios', singular: 'Patrimonio', color: '#b98cc4' },
    { clave: 'fuente', etiqueta: 'Fuentes', singular: 'Fuente', color: '#c9a227' },
  ];
  const NOMBRE_TIPO = Object.fromEntries(TIPOS.map((t) => [t.clave, t.singular]));
  const COLOR_TIPO = Object.fromEntries(TIPOS.map((t) => [t.clave, t.color]));
  const SECCIONES = [
    { clave: 'entidades', titulo: 'Entidades', limite: 10, render: tarjetaEntidad },
    { clave: 'relaciones', titulo: 'Relaciones', limite: 8, render: tarjetaRelacion },
    { clave: 'bloques', titulo: 'Bloques de registro', limite: 6, render: tarjetaBloque },
    { clave: 'cuadernos', titulo: 'Transcripciones', limite: 6, render: tarjetaCuaderno },
    { clave: 'coincidencias', titulo: 'Posibles coincidencias', limite: 4, render: tarjetaCoincidencia },
  ];

  let cont = null;
  let proyecto = null;
  let generacion = 0;
  let peticion = 0;
  let temporizador = null;
  let consulta = '';
  let tiposActivos = new Set();
  let tipoRelacion = '';
  let datos = null;
  let estado = 'inicial';
  let mensajeError = '';
  let expandido = {};
  let refs = {};
  let alPulsarTecla = null;

  /* ---------------- Arranque ---------------- */

  async function montar(contenedor, proy, opciones = {}) {
    const miGeneracion = ++generacion;
    peticion++;
    if (temporizador) {
      clearTimeout(temporizador);
      temporizador = null;
    }
    if (alPulsarTecla) document.removeEventListener('keydown', alPulsarTecla);
    cont = contenedor;
    proyecto = proy;
    consulta = String(opciones.consulta || '').trim();
    tiposActivos = new Set(
      Array.isArray(opciones.tiposEntidad) ? opciones.tiposEntidad : []
    );
    if (opciones.tipoEntidad) tiposActivos = new Set([opciones.tipoEntidad]);
    tipoRelacion = String(opciones.tipoRelacion || '');
    datos = null;
    estado = 'inicial';
    mensajeError = '';
    expandido = {};
    cont.innerHTML = '';

    const pagina = el('div', 'busqueda-pagina');
    const cabecera = el('header', 'busqueda-cabecera');
    const titulos = el('div', 'busqueda-titulos');
    titulos.appendChild(el('h2', 'busqueda-titulo', 'Búsqueda general'));
    titulos.appendChild(el('p', 'busqueda-subtitulo',
      'Personas, instituciones, lugares, patrimonios, fuentes, relaciones, bloques de registro, transcripciones y posibles coincidencias.'));
    cabecera.appendChild(titulos);
    const btnActualizar = el('button', 'btn btn-mini busqueda-actualizar', '↻ Actualizar índice');
    btnActualizar.type = 'button';
    btnActualizar.title = 'Reconstruir el índice de búsqueda con los datos actuales';
    cabecera.appendChild(btnActualizar);
    pagina.appendChild(cabecera);

    const caja = el('div', 'busqueda-caja');
    caja.setAttribute('role', 'search');
    const icono = el('span', 'busqueda-icono');
    icono.innerHTML = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>';
    caja.appendChild(icono);

    const entrada = el('input', 'busqueda-entrada');
    entrada.type = 'search';
    entrada.placeholder = 'Buscar en todo el proyecto…';
    entrada.value = consulta;
    entrada.autocomplete = 'off';
    entrada.spellcheck = false;
    entrada.setAttribute('aria-label', 'Buscar en todo el proyecto');
    caja.appendChild(entrada);
    caja.appendChild(el('kbd', 'busqueda-atajo', 'Ctrl K'));

    const btnLimpiar = el('button', 'busqueda-limpiar', '✕');
    btnLimpiar.type = 'button';
    btnLimpiar.title = 'Limpiar la búsqueda';
    btnLimpiar.setAttribute('aria-label', 'Limpiar la búsqueda');
    btnLimpiar.hidden = !consulta;
    caja.appendChild(btnLimpiar);
    pagina.appendChild(caja);

    const filtros = el('div', 'busqueda-filtros');
    const grupoEntidades = el('div', 'busqueda-grupo busqueda-grupo-entidades');
    grupoEntidades.appendChild(el('span', 'busqueda-grupo-titulo', 'Tipo de entidad'));
    const chips = el('div', 'busqueda-chips');
    const refsChips = new Map();
    const crearChip = (clave, etiqueta) => {
      const boton = el('button', 'chip busqueda-chip');
      boton.type = 'button';
      boton.dataset.tipo = clave;
      boton.setAttribute('aria-pressed', 'false');
      boton.appendChild(document.createTextNode(etiqueta));
      const cuenta = el('span', 'chip-cuenta');
      boton.appendChild(cuenta);
      boton.addEventListener('click', () => {
        if (!clave) {
          tiposActivos.clear();
        } else if (tiposActivos.has(clave)) {
          tiposActivos.delete(clave);
        } else {
          tiposActivos.add(clave);
        }
        actualizarChips();
        expandido = {};
        programarCarga(0);
      });
      chips.appendChild(boton);
      refsChips.set(clave, { boton, cuenta });
    };
    crearChip('', 'Todas');
    for (const tipo of TIPOS) crearChip(tipo.clave, tipo.etiqueta);
    grupoEntidades.appendChild(chips);
    filtros.appendChild(grupoEntidades);

    const grupoRelacion = el('div', 'busqueda-grupo busqueda-grupo-relacion');
    const labelRelacion = el('label', 'busqueda-grupo-titulo', 'Tipo de relación');
    labelRelacion.htmlFor = 'busqueda-tipo-relacion';
    grupoRelacion.appendChild(labelRelacion);
    const selRelacion = el('select', 'entrada busqueda-select');
    selRelacion.id = 'busqueda-tipo-relacion';
    selRelacion.disabled = true;
    selRelacion.appendChild(new Option('Cargando tipos…', ''));
    grupoRelacion.appendChild(selRelacion);
    filtros.appendChild(grupoRelacion);

    const btnLimpiarFiltros = el('button', 'btn btn-mini busqueda-limpiar-filtros', 'Limpiar filtros');
    btnLimpiarFiltros.type = 'button';
    filtros.appendChild(btnLimpiarFiltros);
    pagina.appendChild(filtros);

    const estadoEl = el('div', 'busqueda-estado');
    estadoEl.setAttribute('aria-live', 'polite');
    pagina.appendChild(estadoEl);

    const resultados = el('div', 'busqueda-resultados');
    pagina.appendChild(resultados);
    const raiz = el('div', 'busqueda-raiz');
    raiz.appendChild(pagina);
    cont.appendChild(raiz);

    refs = {
      pagina,
      caja,
      entrada,
      btnLimpiar,
      btnLimpiarFiltros,
      btnActualizar,
      chips: refsChips,
      selRelacion,
      estado: estadoEl,
      resultados,
      firmaTiposRelacion: null,
    };

    entrada.addEventListener('input', () => {
      consulta = entrada.value.trim();
      btnLimpiar.hidden = !entrada.value;
      expandido = {};
      actualizarChips();
      programarCarga();
    });
    entrada.addEventListener('keydown', (ev) => {
      if (ev.key === 'Enter') {
        const primero = resultados.querySelector('.busqueda-resultado');
        if (primero) {
          ev.preventDefault();
          primero.click();
        }
      }
    });
    btnLimpiar.addEventListener('click', () => {
      entrada.value = '';
      consulta = '';
      btnLimpiar.hidden = true;
      expandido = {};
      entrada.focus();
      programarCarga(0);
    });
    btnLimpiarFiltros.addEventListener('click', limpiarFiltros);
    btnActualizar.addEventListener('click', () => {
      const token = ++peticion;
      marcarBuscando();
      cargar(true, token);
    });
    selRelacion.addEventListener('change', () => {
      tipoRelacion = selRelacion.value;
      actualizarChips();
      expandido = {};
      programarCarga(0);
    });

    alPulsarTecla = (ev) => {
      if ((ev.ctrlKey || ev.metaKey) && String(ev.key).toLowerCase() === 'k') {
        ev.preventDefault();
        entrada.focus();
        entrada.select();
        return;
      }
      if (ev.key === 'Escape' && document.activeElement === entrada) {
        if (entrada.value) {
          entrada.value = '';
          consulta = '';
          btnLimpiar.hidden = true;
          expandido = {};
          programarCarga(0);
        } else if (tiposActivos.size || tipoRelacion) {
          limpiarFiltros();
        }
      }
    };
    document.addEventListener('keydown', alPulsarTecla);

    actualizarChips();
    await cargar(true, peticion);
    if (miGeneracion !== generacion) return;
    if (!consulta && !tiposActivos.size && !tipoRelacion) entrada.focus();
  }

  /* ---------------- Carga de datos ---------------- */

  function marcarBuscando() {
    if (refs.estado) refs.estado.textContent = 'Buscando…';
  }

  function programarCarga(retraso = 250) {
    const token = ++peticion;
    if (temporizador) clearTimeout(temporizador);
    if (!datos) {
      estado = 'cargando';
      render();
    } else {
      marcarBuscando();
    }
    temporizador = setTimeout(() => {
      temporizador = null;
      cargar(false, token);
    }, retraso);
  }

  async function cargar(forzar = false, token = peticion) {
    if (!cont || !proyecto || token !== peticion) return;
    const miPeticion = token;
    if (!datos) {
      estado = 'cargando';
      render();
    }
    try {
      const respuesta = await llamar(api.busquedaGlobal(proyecto.id, {
        texto: consulta,
        tiposEntidad: [...tiposActivos],
        tipoRelacion,
        forzar,
        limite: 60,
      }));
      if (miPeticion !== peticion || !cont) return;
      datos = respuesta;
      estado = 'listo';
      mensajeError = '';
      const firma = respuesta.tiposRelacion
        .map((t) => `${t.tipo}:${t.total}`)
        .join('|');
      if (firma !== refs.firmaTiposRelacion) {
        refs.firmaTiposRelacion = firma;
        poblarTiposRelacion(respuesta.tiposRelacion);
      }
      actualizarChips();
      if (!refs.selRelacion.disabled && tipoRelacion) refs.selRelacion.value = tipoRelacion;
      actualizarContadorMenu(respuesta);
      render();
    } catch (err) {
      if (miPeticion !== peticion || !cont) return;
      estado = 'error';
      mensajeError = err.message;
      render();
    }
  }

  function actualizarContadorMenu(respuesta) {
    const cuenta = document.querySelector('[data-cuenta="busqueda"]');
    if (!cuenta || !respuesta) return;
    const total = (respuesta.totales?.entidades || 0)
      + (respuesta.totales?.relaciones || 0)
      + (respuesta.totales?.bloques || 0)
      + (respuesta.totales?.cuadernos || 0);
    cuenta.textContent = String(total);
    cuenta.title = 'Elementos indexados en la búsqueda';
  }

  /* ---------------- Filtros ---------------- */

  function actualizarChips() {
    const totales = datos?.porTipoEntidad || {};
    for (const [clave, ref] of refs.chips) {
      const activo = clave === '' ? tiposActivos.size === 0 : tiposActivos.has(clave);
      ref.boton.classList.toggle('activo', activo);
      ref.boton.setAttribute('aria-pressed', String(activo));
      if (!clave) {
        const total = Object.values(totales).reduce((a, b) => a + b, 0);
        ref.cuenta.textContent = datos ? String(total) : '';
      } else {
        ref.cuenta.textContent = datos ? String(totales[clave] || 0) : '';
      }
    }
    const hayFiltros = tiposActivos.size > 0 || Boolean(tipoRelacion) || Boolean(consulta);
    if (refs.btnLimpiarFiltros) refs.btnLimpiarFiltros.hidden = !hayFiltros;
  }

  function limpiarFiltros() {
    tiposActivos.clear();
    tipoRelacion = '';
    consulta = '';
    if (refs.entrada) refs.entrada.value = '';
    if (refs.btnLimpiar) refs.btnLimpiar.hidden = true;
    if (refs.selRelacion) refs.selRelacion.value = '';
    expandido = {};
    actualizarChips();
    programarCarga(0);
  }

  function poblarTiposRelacion(tipos) {
    const sel = refs.selRelacion;
    if (!sel) return;
    const totales = new Map((tipos || []).map((t) => [t.tipo, t.total]));
    if (!totales.size) {
      sel.innerHTML = '';
      sel.appendChild(new Option('Sin relaciones registradas', ''));
      sel.disabled = true;
      if (tipoRelacion) tipoRelacion = '';
      return;
    }
    const grupos = new Map();
    const conocidos = new Set();
    for (const entrada of RELACIONES_TIPOS) {
      const categoria = entrada.categoria || 'Otras';
      if (!grupos.has(categoria)) grupos.set(categoria, []);
      grupos.get(categoria).push(entrada.etiqueta);
      conocidos.add(entrada.etiqueta);
    }
    for (const { tipo } of tipos) {
      if (conocidos.has(tipo)) continue;
      if (!grupos.has('Otras')) grupos.set('Otras', []);
      grupos.get('Otras').push(tipo);
    }
    const anterior = sel.value || tipoRelacion;
    sel.innerHTML = '';
    sel.appendChild(new Option('Todos los tipos', ''));
    const orden = Object.keys(TAXONOMIA_RELACIONES).concat('Otras');
    for (const categoria of orden) {
      const lista = grupos.get(categoria);
      if (!lista || !lista.length) continue;
      const grupo = document.createElement('optgroup');
      grupo.label = RELACIONES_CATEGORIAS_PLURAL[categoria] || categoria;
      for (const tipo of lista) {
        const total = totales.get(tipo);
        if (!total) continue;
        grupo.appendChild(new Option(`${tipo} · ${total}`, tipo));
      }
      if (grupo.children.length) sel.appendChild(grupo);
    }
    sel.disabled = sel.options.length <= 1;
    if (anterior && totales.has(anterior)) {
      sel.value = anterior;
      tipoRelacion = anterior;
    } else if (anterior) {
      tipoRelacion = '';
      sel.value = '';
    }
  }

  /* ---------------- Pintado ---------------- */

  function render() {
    if (!refs.resultados) return;
    refs.resultados.innerHTML = '';
    actualizarChips();
    if (estado === 'cargando' && !datos) {
      refs.estado.textContent = 'Preparando el índice de búsqueda…';
      refs.resultados.appendChild(crearCargando());
      return;
    }
    if (estado === 'error') {
      refs.estado.textContent = 'No se pudo completar la búsqueda.';
      const caja = el('div', 'busqueda-vacio');
      caja.appendChild(el('h3', '', 'Error de búsqueda'));
      caja.appendChild(el('p', 'pista', mensajeError || 'Inténtalo de nuevo.'));
      const btn = el('button', 'btn btn-mini', 'Reintentar');
      btn.type = 'button';
      btn.addEventListener('click', () => cargar(true));
      caja.appendChild(btn);
      refs.resultados.appendChild(caja);
      return;
    }
    if (!datos) return;
    const hayConsulta = Boolean(consulta.trim());
    const hayFiltros = tiposActivos.size > 0 || Boolean(tipoRelacion);
    if (!hayConsulta && !hayFiltros) {
      refs.estado.textContent = indiceResumen(datos);
      renderExplorar();
      return;
    }
    const total = datos.totalesBusqueda.total;
    refs.estado.textContent = `${total} ${total === 1 ? 'resultado' : 'resultados'}`
      + (hayConsulta ? ` para «${consulta.trim()}»` : '')
      + (hayFiltros ? ` · ${resumenFiltros()}` : '');
    if (!total) {
      renderVacio();
      return;
    }
    for (const seccion of SECCIONES) {
      const items = datos.resultados[seccion.clave] || [];
      if (!items.length) continue;
      refs.resultados.appendChild(crearSeccion(seccion, items));
    }
    if (datos.truncado) {
      refs.resultados.appendChild(el('p', 'busqueda-nota',
        'Se muestran los primeros resultados de cada categoría. Escribe más palabras o acota por tipo para afinar.'));
    }
    const pie = el('div', 'busqueda-pie');
    pie.appendChild(el('span', '', `Índice actualizado a las ${horaDe(datos.generadoEn)}`));
    refs.resultados.appendChild(pie);
  }

  function indiceResumen(respuesta) {
    return `Índice listo: ${respuesta.totales.entidades} entidades · `
      + `${respuesta.totales.relaciones} relaciones · ${respuesta.totales.bloques} bloques · `
      + `${respuesta.totales.cuadernos} transcripciones. Escribe una palabra o elige un tipo.`;
  }

  function resumenFiltros() {
    const partes = [];
    if (tiposActivos.size) {
      partes.push([...tiposActivos].map((t) => NOMBRE_TIPO[t] || t).join(', '));
    }
    if (tipoRelacion) partes.push(`relación «${tipoRelacion}»`);
    return partes.join(' · ');
  }

  function crearSeccion(seccion, items) {
    const total = datos.totalesBusqueda[seccion.clave] || items.length;
    const nodo = el('section', 'busqueda-seccion');
    const cabecera = el('div', 'busqueda-seccion-cab');
    const titulo = el('h3', 'busqueda-seccion-titulo', seccion.titulo);
    titulo.appendChild(el('span', 'busqueda-seccion-cuenta', String(total)));
    cabecera.appendChild(titulo);
    const limite = expandido[seccion.clave] ? items.length : Math.min(items.length, seccion.limite);
    if (items.length > limite) {
      const btn = el('button', 'btn btn-mini', `Ver los ${items.length}`);
      btn.type = 'button';
      btn.addEventListener('click', () => {
        expandido[seccion.clave] = true;
        render();
      });
      cabecera.appendChild(btn);
    }
    nodo.appendChild(cabecera);
    const lista = el('div', 'busqueda-lista');
    for (const item of items.slice(0, limite)) lista.appendChild(seccion.render(item));
    nodo.appendChild(lista);
    if (total > items.length) {
      nodo.appendChild(el('p', 'busqueda-nota',
        `Mostrando los primeros ${items.length} de ${total}. Afina la búsqueda para ver el resto.`));
    }
    return nodo;
  }

  function crearTarjeta({ clase = '', color = '', badge, titulo, subtitulo, snippet, resaltados, resaltadosTitulo, alAbrir, acciones = [] }) {
    const tarjeta = el('article', `busqueda-resultado ${clase}`.trim());
    tarjeta.tabIndex = 0;
    tarjeta.setAttribute('role', 'button');
    const cabecera = el('div', 'busqueda-resultado-cab');
    const etiqueta = el('span', 'busqueda-badge', badge);
    if (color) etiqueta.style.setProperty('--color', color);
    cabecera.appendChild(etiqueta);
    tarjeta.appendChild(cabecera);
    const h4 = el('h4', 'busqueda-resultado-titulo');
    h4.appendChild(textoResaltado(titulo, resaltadosTitulo));
    tarjeta.appendChild(h4);
    if (subtitulo) tarjeta.appendChild(el('p', 'busqueda-resultado-sub', subtitulo));
    if (snippet) {
      const parrafo = el('p', 'busqueda-resultado-snippet');
      parrafo.appendChild(textoResaltado(snippet, resaltados));
      tarjeta.appendChild(parrafo);
    }
    if (acciones.length) {
      const fila = el('div', 'busqueda-resultado-acciones');
      for (const accion of acciones) {
        const btn = el('button', 'btn btn-mini', accion.etiqueta);
        btn.type = 'button';
        btn.addEventListener('click', (ev) => {
          ev.stopPropagation();
          accion.alPulsar();
        });
        fila.appendChild(btn);
      }
      tarjeta.appendChild(fila);
    }
    tarjeta.appendChild(el('span', 'busqueda-resultado-flecha', '→'));
    const abrir = () => { if (alAbrir) alAbrir(); };
    tarjeta.addEventListener('click', abrir);
    tarjeta.addEventListener('keydown', (ev) => {
      if (ev.target !== tarjeta) return;
      if (ev.key === 'Enter' || ev.key === ' ') {
        ev.preventDefault();
        abrir();
      }
    });
    return tarjeta;
  }

  function snippetDe(item) {
    return consulta.trim() ? item.snippet : '';
  }

  function tarjetaEntidad(item) {
    return crearTarjeta({
      clase: `busqueda-entidad-${item.tipo}`,
      color: COLOR_TIPO[item.tipo] || '',
      badge: `${NOMBRE_TIPO[item.tipo] || item.tipo}${item.identificador ? ` · ${item.identificador}` : ''}`,
      titulo: item.titulo,
      subtitulo: item.subtitulo,
      snippet: snippetDe(item),
      resaltados: item.resaltados,
      resaltadosTitulo: item.resaltadosTitulo,
      alAbrir: () => navegarA(item.tipo, item.id),
    });
  }

  function tarjetaRelacion(item) {
    const categoria = (typeof categoriaRelacion === 'function' && categoriaRelacion(item.tipoRelacion)) || 'Relación';
    const fechas = [
      item.anioInicio != null || item.anioFin != null
        ? `${item.anioInicio ?? '¿?'} – ${item.anioFin ?? '¿?'}`
        : '',
      item.fechaInicio,
      item.fechaFin,
    ].filter(Boolean).join(' · ');
    const lugares = [item.lugarInicio, item.lugarFin].filter(Boolean).join(' → ');
    const fuentes = (item.fuentes || []).map((f) => f.titulo).filter(Boolean).join(' · ');
    const procedencia = item.procedencia === 'AUTOMATIZADA'
      ? 'Automática'
      : (item.procedencia === 'EDITADA' ? 'Editada' : '');
    return crearTarjeta({
      clase: 'busqueda-relacion',
      badge: `${categoria} · ${item.tipoRelacion}`,
      titulo: `${item.origen.nombre} → ${item.destino.nombre}`,
      subtitulo: [fechas, lugares, fuentes, procedencia].filter(Boolean).join(' · '),
      snippet: snippetDe(item),
      resaltados: item.resaltados,
      resaltadosTitulo: item.resaltadosTitulo,
      alAbrir: () => navegarA(item.origen.tipo, item.origen.id),
      acciones: [{
        etiqueta: 'Ver origen',
        alPulsar: () => navegarA(item.origen.tipo, item.origen.id),
      }, {
        etiqueta: 'Ver destino',
        alPulsar: () => navegarA(item.destino.tipo, item.destino.id),
      }],
    });
  }

  function tarjetaBloque(item) {
    return crearTarjeta({
      clase: item.datosInvalidos ? 'busqueda-bloque busqueda-invalido' : 'busqueda-bloque',
      badge: item.datosInvalidos ? 'Bloque dañado' : 'Bloque de registro',
      titulo: item.titulo,
      subtitulo: [item.tipoBloque, item.fuenteTitulo, item.categoria].filter(Boolean).join(' · '),
      snippet: snippetDe(item),
      resaltados: item.resaltados,
      resaltadosTitulo: item.resaltadosTitulo,
      alAbrir: () => abrirBloque(item.fuenteId, item.bloqueId),
    });
  }

  function tarjetaCuaderno(item) {
    return crearTarjeta({
      clase: 'busqueda-cuaderno',
      badge: `Transcripción · Cuaderno ${item.numero}`,
      titulo: item.titulo,
      subtitulo: 'Texto transcrito de la fuente',
      snippet: snippetDe(item),
      resaltados: item.resaltados,
      resaltadosTitulo: item.resaltadosTitulo,
      alAbrir: () => abrirCuaderno(item.fuenteId, item.cuadernoId),
    });
  }

  function tarjetaCoincidencia(item) {
    return crearTarjeta({
      clase: 'busqueda-coincidencia',
      badge: `Posible coincidencia · ${NOMBRE_TIPO[item.tipo] || item.tipo}`,
      titulo: `${item.nombreA} ↔ ${item.nombreB}`,
      subtitulo: item.notas,
      snippet: snippetDe(item),
      resaltados: item.resaltados,
      resaltadosTitulo: item.resaltadosTitulo,
      alAbrir: () => navegarA(item.tipo, item.entidadA),
      acciones: [{
        etiqueta: 'Abrir la otra ficha',
        alPulsar: () => navegarA(item.tipo, item.entidadB),
      }],
    });
  }

  function renderExplorar() {
    const panel = el('div', 'busqueda-explorar');
    panel.appendChild(el('h3', 'busqueda-explorar-titulo', 'Explora el proyecto'));
    panel.appendChild(el('p', 'pista',
      'Especializa la búsqueda por tipo de entidad o por tipo de relación, o escribe varias palabras para buscar en todo el contenido.'));
    const grid = el('div', 'busqueda-explorar-grid');
    for (const tipo of TIPOS) {
      const total = datos.porTipoEntidad[tipo.clave] || 0;
      const boton = el('button', 'busqueda-explorar-card');
      boton.type = 'button';
      boton.disabled = total === 0;
      boton.style.setProperty('--color', tipo.color);
      boton.appendChild(el('span', 'busqueda-explorar-numero', String(total)));
      boton.appendChild(el('span', 'busqueda-explorar-nombre', tipo.etiqueta));
      boton.appendChild(el('span', 'busqueda-explorar-pista', 'Ver todos'));
      boton.addEventListener('click', () => {
        tiposActivos = new Set([tipo.clave]);
        expandido = {};
        programarCarga(0);
      });
      grid.appendChild(boton);
    }
    panel.appendChild(grid);
    const bloqueRel = el('div', 'busqueda-explorar-relaciones');
    bloqueRel.appendChild(el('h4', '', 'Relaciones'));
    bloqueRel.appendChild(el('p', 'pista',
      `${datos.totales.relaciones} relaciones registradas. Elige un tipo concreto en «Tipo de relación» para acotar por vínculo.`));
    if (datos.totales.relaciones) {
      const tipos = [...datos.tiposRelacion]
        .sort((a, b) => b.total - a.total)
        .slice(0, 6);
      const nube = el('div', 'busqueda-relaciones-nube');
      for (const t of tipos) {
        const chip = el('button', 'chip busqueda-chip-relacion', `${t.tipo} · ${t.total}`);
        chip.type = 'button';
        chip.addEventListener('click', () => {
          tipoRelacion = t.tipo;
          if (refs.selRelacion) refs.selRelacion.value = t.tipo;
          expandido = {};
          programarCarga(0);
        });
        nube.appendChild(chip);
      }
      bloqueRel.appendChild(nube);
    }
    panel.appendChild(bloqueRel);
    refs.resultados.appendChild(panel);
  }

  function renderVacio() {
    const caja = el('div', 'busqueda-vacio');
    caja.appendChild(el('div', 'busqueda-vacio-icono', '⌕'));
    caja.appendChild(el('h3', '', 'Sin resultados'));
    caja.appendChild(el('p', 'pista',
      'Prueba con menos palabras, sin tildes o cambia los filtros de tipo de entidad y de relación.'));
    const btn = el('button', 'btn btn-mini', 'Limpiar búsqueda y filtros');
    btn.type = 'button';
    btn.addEventListener('click', limpiarFiltros);
    caja.appendChild(btn);
    refs.resultados.appendChild(caja);
  }

  function crearCargando() {
    const caja = el('div', 'busqueda-cargando');
    const puntos = el('div', 'busqueda-puntos');
    puntos.append(el('span'), el('span'), el('span'));
    caja.appendChild(puntos);
    caja.appendChild(el('p', 'pista', 'Preparando el índice de búsqueda…'));
    return caja;
  }

  /* ---------------- Utilidades de pintado ---------------- */

  function textoResaltado(texto, rangos) {
    const fragmento = document.createDocumentFragment();
    const original = String(texto ?? '');
    if (!rangos || !rangos.length) {
      fragmento.appendChild(document.createTextNode(original));
      return fragmento;
    }
    let posicion = 0;
    for (const [inicio, fin] of rangos) {
      const a = Math.max(posicion, Math.min(Number(inicio) || 0, original.length));
      const b = Math.max(a, Math.min(Number(fin) || 0, original.length));
      if (a > posicion) fragmento.appendChild(document.createTextNode(original.slice(posicion, a)));
      if (b > a) {
        const marca = document.createElement('mark');
        marca.textContent = original.slice(a, b);
        fragmento.appendChild(marca);
      }
      posicion = b;
    }
    if (posicion < original.length) {
      fragmento.appendChild(document.createTextNode(original.slice(posicion)));
    }
    return fragmento;
  }

  function horaDe(iso) {
    try {
      return new Date(iso).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '—';
    }
  }

  function navegarA(tipo, id) {
    document.dispatchEvent(new CustomEvent('himago:navegar', {
      detail: {
        seccion: tipo,
        opciones: { seleccionar: { tipo, id: Number(id) } },
      },
    }));
  }

  function abrirBloque(fuenteId, bloqueId) {
    document.dispatchEvent(new CustomEvent('himago:navegar', {
      detail: {
        seccion: 'fuente',
        opciones: {
          seleccionar: { tipo: 'fuente', id: Number(fuenteId) },
          bloqueId: Number(bloqueId),
        },
      },
    }));
  }

  function abrirCuaderno(fuenteId, cuadernoId) {
    document.dispatchEvent(new CustomEvent('himago:navegar', {
      detail: {
        seccion: 'fuente',
        opciones: {
          seleccionar: { tipo: 'fuente', id: Number(fuenteId) },
          cuadernoId: Number(cuadernoId),
        },
      },
    }));
  }

  /* ---------------- Desmontaje ---------------- */

  function desmontar() {
    generacion++;
    peticion++;
    if (temporizador) {
      clearTimeout(temporizador);
      temporizador = null;
    }
    if (alPulsarTecla) document.removeEventListener('keydown', alPulsarTecla);
    alPulsarTecla = null;
    cont = null;
    proyecto = null;
    datos = null;
    estado = 'inicial';
    consulta = '';
    tiposActivos = new Set();
    tipoRelacion = '';
    expandido = {};
    refs = {};
  }

  return {
    montar,
    desmontar,
    hayCambios: () => false,
  };
})();
