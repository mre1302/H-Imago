'use strict';

/* H-IMAGO · Análisis RSH: panel opcional de la vista de grafo.
   No calcula nada al montarse. El usuario elige métricas y red analítica,
   y solo entonces se envía la foto al proceso principal. */

(function () {
  const NOMBRES_TIPO = typeof NOMBRE_TIPO !== 'undefined'
    ? NOMBRE_TIPO
    : { persona: 'Persona', institucion: 'Institución', lugar: 'Lugar', patrimonio: 'Patrimonio', fuente: 'Fuente' };

  const METRICAS = [
    { id: 'grado', etiqueta: 'Grado', ayuda: 'Relaciones de cada entidad; entrada, salida y vecinos distintos.' },
    { id: 'intermediacion', etiqueta: 'Intermediación', ayuda: 'Posición en los caminos mínimos; identifica mediadores.' },
    { id: 'cercania', etiqueta: 'Cercanía', ayuda: 'Proximidad estructural; usa la fórmula armónica si hay componentes.' },
    { id: 'vectorPropio', etiqueta: 'Vector propio / PageRank', ayuda: 'Conexión con posiciones relevantes; PageRank en redes dirigidas.' },
    { id: 'comunidades', etiqueta: 'Comunidades', ayuda: 'Agrupaciones relacionales mediante Leiden.' },
    { id: 'densidad', etiqueta: 'Densidad', ayuda: 'Cohesión de la red sobre pares únicos de entidades.' },
    { id: 'componentes', etiqueta: 'Componentes', ayuda: 'Redes aisladas y tamaño de la mayor componente.' },
  ];

  const ETIQUETAS_METRICAS = Object.fromEntries(METRICAS.map((m) => [m.id, m.etiqueta]));
  const LIMITE_FILAS = 400;
  const LIMITE_MAXIMO_FILAS = 5000;
  const PALETA_COMUNIDADES = typeof COLORES_COMUNIDADES !== 'undefined'
    ? COLORES_COMUNIDADES
    : ['#e3c35a', '#7ea8c9', '#86b28a', '#b98cc4', '#d98b8b', '#6fc3c0', '#d4a373', '#9d9dd6'];

  function formatoNumero(valor, decimales = 4) {
    if (valor == null || Number.isNaN(Number(valor))) return '—';
    return Number(valor).toLocaleString('es-ES', {
      minimumFractionDigits: 0,
      maximumFractionDigits: decimales,
    });
  }

  function formatoCSV(valor) {
    let texto = String(valor == null ? '' : valor)
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');
    /* Entrecomillar no impide que Excel/LibreOffice ejecute una fórmula:
       hay que neutralizar los prefijos peligrosos. */
    if (/^[=+\-@\t\r]/.test(texto) && !/^-?\d+(?:[.,]\d+)?$/.test(texto)) {
      texto = `'${texto}`;
    }
    return `"${texto.replace(/"/g, '""')}"`;
  }

  function valorPlano(valor) {
    if (valor == null) return '';
    if (typeof valor === 'number') return Number.isInteger(valor) ? String(valor) : valor.toFixed(6);
    return String(valor);
  }

  function crearPanel(contexto) {
    const {
      proyecto,
      datos,
      obtenerRedVisible,
      alSeleccionarNodo,
      alAplicarVisual,
      alRestaurarVisual,
      alDesmontar,
    } = contexto;

    let abierto = false;
    let estado = 'inactivo';
    let calculoIniciadoEn = 0;
    let resultados = null;
    let obsoleto = false;
    let mensajeError = '';
    let solicitudId = null;
    let progreso = null;
    let quitarProgreso = null;
    let seleccionMetricas = new Set();
    let opcionesAnalisis = {
      ambito: 'completa',
      dirigida: true,
      incluirAislados: true,
      procedencia: 'todas',
      resolucion: 1,
      semilla: 42,
      repeticiones: 3,
    };
    let configuracionVisual = { tamano: 'actual', colorPorComunidad: false };
    let filtroTabla = '';
    let temporizadorFiltroTabla = null;
    let orden = { columna: null, direccion: 1 };
    let limiteFilas = LIMITE_FILAS;
    let tabActiva = 'nodos';

    const boton = el('button', 'btn btn-mini grafo-analisis-boton', 'Análisis RSH');
    boton.type = 'button';
    boton.title = 'Calcular indicadores de redes sociales históricas';
    boton.setAttribute('aria-expanded', 'false');
    boton.setAttribute('aria-controls', 'grafo-analisis-rsh');

    const panel = el('div', 'grafo-analisis');
    panel.id = 'grafo-analisis-rsh';
    panel.hidden = true;
    panel.setAttribute('role', 'region');
    panel.setAttribute('aria-label', 'Análisis RSH');

    const cabecera = el('div', 'grafo-analisis-cabecera');
    const bloqueTitulo = el('div');
    bloqueTitulo.appendChild(el('h3', 'grafo-analisis-titulo', 'Análisis RSH'));
    bloqueTitulo.appendChild(el('p', 'pista', 'Indicadores de redes sociales históricas. Nada se calcula hasta que lo pidas.'));
    cabecera.appendChild(bloqueTitulo);
    const btnCerrar = el('button', 'btn btn-mini grafo-analisis-cerrar', '×');
    btnCerrar.type = 'button';
    btnCerrar.title = 'Cerrar Análisis RSH';
    btnCerrar.setAttribute('aria-label', 'Cerrar Análisis RSH');
    cabecera.appendChild(btnCerrar);
    panel.appendChild(cabecera);

    const configuracion = el('div', 'grafo-analisis-configuracion');
    const fieldsetRed = document.createElement('fieldset');
    fieldsetRed.className = 'grafo-analisis-fieldset';
    fieldsetRed.appendChild(el('legend', '', 'Red analítica'));
    const opcionesRed = [
      ['completa', 'Red completa del proyecto', 'Incluye todas las entidades y relaciones, aunque los filtros visuales oculten parte del grafo.'],
      ['visible', 'Red visible actual', 'Usa exactamente las entidades y relaciones que se ven ahora, con los filtros activos.'],
    ];
    for (const [valor, etiqueta, ayuda] of opcionesRed) {
      const label = el('label', 'grafo-analisis-opcion');
      const radio = document.createElement('input');
      radio.type = 'radio';
      radio.name = 'grafo-analisis-ambito';
      radio.value = valor;
      radio.checked = valor === opcionesAnalisis.ambito;
      radio.addEventListener('change', () => {
        if (!radio.checked) return;
        opcionesAnalisis.ambito = valor;
        marcarObsoleto();
        actualizarEstado();
      });
      const texto = el('span');
      texto.appendChild(el('strong', '', etiqueta));
      texto.appendChild(el('small', '', ayuda));
      label.append(radio, texto);
      fieldsetRed.appendChild(label);
    }
    configuracion.appendChild(fieldsetRed);

    const fieldsetMetricas = document.createElement('fieldset');
    fieldsetMetricas.className = 'grafo-analisis-fieldset';
    fieldsetMetricas.appendChild(el('legend', '', 'Métricas'));
    for (const metrica of METRICAS) {
      const label = el('label', 'grafo-analisis-opcion');
      const check = document.createElement('input');
      check.type = 'checkbox';
      check.value = metrica.id;
      check.dataset.metrica = metrica.id;
      check.addEventListener('change', () => {
        if (check.checked) seleccionMetricas.add(metrica.id);
        else seleccionMetricas.delete(metrica.id);
        marcarObsoleto();
        actualizarEstado();
      });
      const texto = el('span');
      texto.appendChild(el('strong', '', metrica.etiqueta));
      texto.appendChild(el('small', '', metrica.ayuda));
      label.append(check, texto);
      fieldsetMetricas.appendChild(label);
    }
    configuracion.appendChild(fieldsetMetricas);

    const opcionesExtra = el('div', 'grafo-analisis-opciones');
    const labelDirigida = el('label', 'grafo-analisis-opcion compacta');
    const checkDirigida = document.createElement('input');
    checkDirigida.type = 'checkbox';
    checkDirigida.checked = opcionesAnalisis.dirigida;
    checkDirigida.addEventListener('change', () => {
      opcionesAnalisis.dirigida = checkDirigida.checked;
      marcarObsoleto();
    });
    labelDirigida.append(checkDirigida, document.createTextNode(' Tratar las relaciones como dirigidas'));
    opcionesExtra.appendChild(labelDirigida);

    const labelAislados = el('label', 'grafo-analisis-opcion compacta');
    const checkAislados = document.createElement('input');
    checkAislados.type = 'checkbox';
    checkAislados.checked = opcionesAnalisis.incluirAislados;
    checkAislados.addEventListener('change', () => {
      opcionesAnalisis.incluirAislados = checkAislados.checked;
      marcarObsoleto();
    });
    labelAislados.append(checkAislados, document.createTextNode(' Incluir entidades aisladas'));
    opcionesExtra.appendChild(labelAislados);

    const labelProcedencia = el('label', 'grafo-analisis-campo');
    labelProcedencia.appendChild(el('span', '', 'Procedencia de las relaciones'));
    const selProcedencia = document.createElement('select');
    selProcedencia.className = 'entrada';
    for (const [valor, etiqueta] of [
      ['todas', 'Todas'],
      ['manuales', 'Solo manuales'],
      ['editadas', 'Manuales y editadas'],
      ['automatizadas', 'Solo automatizadas'],
    ]) {
      selProcedencia.appendChild(new Option(etiqueta, valor));
    }
    selProcedencia.value = opcionesAnalisis.procedencia;
    selProcedencia.addEventListener('change', () => {
      opcionesAnalisis.procedencia = selProcedencia.value;
      marcarObsoleto();
    });
    labelProcedencia.appendChild(selProcedencia);
    opcionesExtra.appendChild(labelProcedencia);

    const detallesAvanzados = document.createElement('details');
    detallesAvanzados.className = 'grafo-analisis-avanzado';
    detallesAvanzados.appendChild(el('summary', '', 'Opciones de comunidades'));
    const gridAvanzado = el('div', 'grafo-analisis-grid');
    const campoResolucion = el('label', 'grafo-analisis-campo');
    campoResolucion.appendChild(el('span', '', 'Resolución Leiden'));
    const inResolucion = el('input', 'entrada');
    inResolucion.type = 'number';
    inResolucion.min = '0.1';
    inResolucion.step = '0.1';
    inResolucion.value = String(opcionesAnalisis.resolucion);
    inResolucion.addEventListener('change', () => {
      const valor = Number(inResolucion.value);
      if (Number.isFinite(valor) && valor > 0) {
        opcionesAnalisis.resolucion = valor;
        marcarObsoleto();
      }
    });
    campoResolucion.appendChild(inResolucion);
    gridAvanzado.appendChild(campoResolucion);
    const campoSemilla = el('label', 'grafo-analisis-campo');
    campoSemilla.appendChild(el('span', '', 'Semilla'));
    const inSemilla = el('input', 'entrada');
    inSemilla.type = 'number';
    inSemilla.step = '1';
    inSemilla.value = String(opcionesAnalisis.semilla);
    inSemilla.addEventListener('change', () => {
      const valor = Number(inSemilla.value);
      if (Number.isInteger(valor)) {
        opcionesAnalisis.semilla = valor;
        marcarObsoleto();
      }
    });
    campoSemilla.appendChild(inSemilla);
    gridAvanzado.appendChild(campoSemilla);
    const campoRepeticiones = el('label', 'grafo-analisis-campo');
    campoRepeticiones.appendChild(el('span', '', 'Repeticiones'));
    const inRepeticiones = el('input', 'entrada');
    inRepeticiones.type = 'number';
    inRepeticiones.min = '1';
    inRepeticiones.max = '10';
    inRepeticiones.step = '1';
    inRepeticiones.value = String(opcionesAnalisis.repeticiones);
    inRepeticiones.addEventListener('change', () => {
      const valor = Number(inRepeticiones.value);
      if (Number.isInteger(valor) && valor >= 1 && valor <= 10) {
        opcionesAnalisis.repeticiones = valor;
        marcarObsoleto();
      }
    });
    campoRepeticiones.appendChild(inRepeticiones);
    gridAvanzado.appendChild(campoRepeticiones);
    detallesAvanzados.appendChild(gridAvanzado);
    opcionesExtra.appendChild(detallesAvanzados);
    configuracion.appendChild(opcionesExtra);
    panel.appendChild(configuracion);

    const estadoCalculo = el('div', 'grafo-analisis-estado', 'Sin Análisis RSH activo.');
    estadoCalculo.setAttribute('role', 'status');
    estadoCalculo.setAttribute('aria-live', 'polite');
    const barraProgreso = document.createElement('progress');
    barraProgreso.className = 'grafo-analisis-progreso';
    barraProgreso.max = 100;
    barraProgreso.value = 0;
    barraProgreso.hidden = true;
    const filaAcciones = el('div', 'grafo-analisis-acciones');
    const btnCalcular = el('button', 'btn btn-primario btn-mini', 'Calcular Análisis RSH');
    btnCalcular.type = 'button';
    const btnConfigurar = el('button', 'btn btn-mini', 'Cambiar configuración');
    btnConfigurar.type = 'button';
    btnConfigurar.hidden = true;
    const btnDesactivar = el('button', 'btn btn-mini', 'Desactivar');
    btnDesactivar.type = 'button';
    btnDesactivar.hidden = true;
    filaAcciones.append(btnCalcular, btnConfigurar, btnDesactivar);
    panel.append(estadoCalculo, barraProgreso, filaAcciones);

    const contenedorResultados = el('div', 'grafo-analisis-resultados');
    contenedorResultados.hidden = true;
    panel.appendChild(contenedorResultados);

    const bannerObsoleto = el('div', 'grafo-analisis-obsoleto');
    bannerObsoleto.hidden = true;
    const textoObsoleto = el('span', '', 'Los resultados corresponden a la red anterior.');
    const btnRecalcular = el('button', 'btn btn-mini', 'Recalcular');
    btnRecalcular.type = 'button';
    bannerObsoleto.append(textoObsoleto, btnRecalcular);

    const resumen = el('div', 'grafo-analisis-resumen');
    const advertencias = el('div', 'grafo-analisis-advertencias');
    const controlesVisuales = el('div', 'grafo-analisis-visual');
    const tabs = el('div', 'grafo-analisis-tabs');
    const btnTabNodos = el('button', 'btn btn-mini', 'Nodos');
    const btnTabComunidades = el('button', 'btn btn-mini', 'Comunidades');
    btnTabNodos.type = 'button';
    btnTabComunidades.type = 'button';
    tabs.append(btnTabNodos, btnTabComunidades);
    const vistaNodos = el('div', 'grafo-analisis-vista');
    const vistaComunidades = el('div', 'grafo-analisis-vista');
    vistaComunidades.hidden = true;

    const filaTabla = el('div', 'grafo-analisis-tabla-cabecera');
    const entradaTabla = el('input', 'entrada');
    entradaTabla.type = 'search';
    entradaTabla.placeholder = 'Filtrar entidades…';
    entradaTabla.setAttribute('aria-label', 'Filtrar entidades del Análisis RSH');
    filaTabla.appendChild(entradaTabla);
    const tablaNodos = el('div', 'grafo-analisis-tabla');
    const pieTabla = el('div', 'grafo-analisis-pie');
    const btnMas = el('button', 'btn btn-mini', 'Mostrar más');
    btnMas.type = 'button';
    btnMas.hidden = true;
    pieTabla.appendChild(btnMas);
    vistaNodos.append(filaTabla, tablaNodos, pieTabla);
    vistaComunidades.appendChild(el('div', 'grafo-analisis-comunidades'));
    contenedorResultados.append(bannerObsoleto, resumen, advertencias, controlesVisuales, tabs, vistaNodos, vistaComunidades);
    const pieAcciones = el('div', 'grafo-analisis-pie-acciones');
    const btnExportar = el('button', 'btn btn-mini', 'Exportar Análisis RSH (CSV)');
    btnExportar.type = 'button';
    pieAcciones.appendChild(btnExportar);
    const notaMetodo = el('p', 'pista grafo-analisis-metodologia',
      'Los indicadores describen la red documentada, no la red histórica completa. '
      + 'Leiden se aplica sobre una proyección no dirigida ponderada. '
      + 'La intermediación y la cercanía usan caminos dirigidos si así se ha configurado.');
    contenedorResultados.append(pieAcciones, notaMetodo);

    function nuevoIdSolicitud() {
      return `ars-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    }

    function actualizarBotonPanel() {
      boton.setAttribute('aria-expanded', String(abierto));
      boton.classList.toggle('modo-activo', abierto);
      panel.hidden = !abierto;
      if (panel.parentElement) panel.parentElement.classList.toggle('con-analisis', abierto);
    }

    function abrirPanel() {
      abierto = true;
      actualizarBotonPanel();
    }

    function cerrarPanel() {
      abierto = false;
      actualizarBotonPanel();
    }

    function marcarObsoleto() {
      if (!resultados) return;
      if (opcionesAnalisis.ambito === 'visible' || estado === 'listo') {
        obsoleto = true;
        actualizarBanner();
      }
    }

    function actualizarBanner() {
      if (!resultados) {
        bannerObsoleto.hidden = true;
        return;
      }
      bannerObsoleto.hidden = !obsoleto;
    }

    function actualizarEstado() {
      const calculando = estado === 'calculando';
      btnCalcular.disabled = calculando ? false : seleccionMetricas.size === 0;
      btnCalcular.textContent = calculando ? 'Cancelar cálculo' : 'Calcular Análisis RSH';
      btnConfigurar.hidden = !resultados || calculando;
      btnDesactivar.hidden = !resultados;
      if (calculando) {
        const etiqueta = progreso && progreso.metrica
          ? ETIQUETAS_METRICAS[progreso.metrica] || progreso.metrica
          : 'Análisis RSH';
        const hechas = progreso && Number.isFinite(Number(progreso.hechas)) ? Number(progreso.hechas) : 0;
        const total = progreso && Number.isFinite(Number(progreso.total)) ? Number(progreso.total) : 0;
        estadoCalculo.textContent = total > 0
          ? `Calculando ${etiqueta}… ${hechas} de ${total}`
          : `Calculando ${etiqueta}…`;
        barraProgreso.hidden = false;
        barraProgreso.value = total > 0 ? Math.max(0, Math.min(100, (hechas / total) * 100)) : 0;
      } else {
        barraProgreso.hidden = true;
        if (estado === 'error') estadoCalculo.textContent = `Error: ${mensajeError}`;
        else if (resultados) estadoCalculo.textContent = 'Análisis RSH calculado.';
        else estadoCalculo.textContent = 'Sin Análisis RSH activo.';
      }
    }

    function obtenerMetricasSeleccionadas() {
      return METRICAS.map((m) => m.id).filter((id) => seleccionMetricas.has(id));
    }

    function construirPayload() {
      const base = opcionesAnalisis.ambito === 'visible' && typeof obtenerRedVisible === 'function'
        ? obtenerRedVisible()
        : datos;
      const nodos = Array.isArray(base && base.nodos) ? base.nodos : [];
      const aristas = Array.isArray(base && base.aristas) ? base.aristas : [];
      return {
        solicitudId,
        proyectoId: proyecto.id,
        proyectoNombre: proyecto.nombre,
        nodos: nodos.map((nodo) => ({
          id: nodo.id,
          tipo: nodo.tipo,
          entidadId: nodo.entidadId,
          etiqueta: nodo.etiqueta,
          identificador: nodo.identificador || '',
          nombre: nodo.nombre || '',
          apellidos: nodo.apellidos || '',
          genero: nodo.genero || '',
          tipoEntidad: nodo.tipoEntidad || '',
          notas: nodo.notas || '',
        })),
        aristas: aristas.map((arista) => ({
          id: arista.id,
          origen: arista.origen,
          destino: arista.destino,
          tipo: arista.tipo,
          categoria: typeof categoriaRelacion === 'function'
            ? (categoriaRelacion(arista.tipo) || 'Otras')
            : (arista.categoria || ''),
          procedencia: arista.procedencia || 'MANUAL',
          anioDesde: arista.anioDesde,
          anioHasta: arista.anioHasta,
          fecha: arista.fecha || '',
        })),
        metricas: obtenerMetricasSeleccionadas(),
        opciones: { ...opcionesAnalisis },
      };
    }

    function firmaRedActual() {
      const base = opcionesAnalisis.ambito === 'visible' && typeof obtenerRedVisible === 'function'
        ? obtenerRedVisible()
        : datos;
      const nodos = Array.isArray(base && base.nodos) ? base.nodos : [];
      const aristas = Array.isArray(base && base.aristas) ? base.aristas : [];
      return `${nodos.map((n) => n.id).sort().join('|')}##${aristas
        .map((a) => `${a.id}:${a.origen}:${a.destino}:${a.tipo || ''}:${a.procedencia || ''}`)
        .sort()
        .join('|')}`;
    }

    async function cancelarCalculo() {
      if (!solicitudId) return;
      const id = solicitudId;
      try {
        await llamar(window.api.analisisCancelar(id));
      } catch { /* el cálculo pudo terminar antes */ }
      if (solicitudId === id) {
        solicitudId = null;
        estado = resultados ? 'listo' : 'inactivo';
        progreso = null;
        actualizarEstado();
        actualizarBanner();
      }
    }

    async function calcular() {
      if (estado === 'calculando') {
        /* Un doble clic no debe abortar el cálculo recién lanzado. */
        if (Date.now() - calculoIniciadoEn < 500) return;
        return cancelarCalculo();
      }
      const metricas = obtenerMetricasSeleccionadas();
      if (!metricas.length) {
        aviso('Selecciona al menos una métrica para el Análisis RSH.', 'error');
        return;
      }
      if (!window.api || typeof window.api.analisisCalcular !== 'function') {
        aviso('El cálculo de Análisis RSH no está disponible en esta versión.', 'error');
        return;
      }
      const opcionesUsadas = { ...opcionesAnalisis };
      const firmaUsada = firmaRedActual();
      const idSolicitud = nuevoIdSolicitud();
      solicitudId = idSolicitud;
      estado = 'calculando';
      calculoIniciadoEn = Date.now();
      progreso = { metrica: metricas[0], hechas: 0, total: 1 };
      obsoleto = false;
      mensajeError = '';
      actualizarBanner();
      actualizarEstado();
      try {
        const respuesta = await llamar(window.api.analisisCalcular(construirPayload()));
        if (solicitudId !== idSolicitud) return;
        if (!respuesta) throw new Error('El Análisis RSH no devolvió resultados.');
        resultados = respuesta;
        resultados._metricas = metricas;
        resultados._opciones = opcionesUsadas;
        estado = 'listo';
        obsoleto = JSON.stringify(opcionesAnalisis) !== JSON.stringify(opcionesUsadas)
          || JSON.stringify(obtenerMetricasSeleccionadas()) !== JSON.stringify(metricas)
          || (opcionesUsadas.ambito === 'visible' && firmaUsada !== firmaRedActual());
        limiteFilas = LIMITE_FILAS;
        filtroTabla = '';
        entradaTabla.value = '';
        orden = { columna: null, direccion: 1 };
        configuracionVisual = { tamano: 'actual', colorPorComunidad: false };
        aplicarVisualizacion();
        renderResultados();
        abrirPanel();
        aviso('Análisis RSH calculado', 'exito');
      } catch (err) {
        if (solicitudId !== idSolicitud) return;
        if (/cancelado/i.test(err.message)) {
          estado = resultados ? 'listo' : 'inactivo';
          aviso('Cálculo del Análisis RSH cancelado', 'info');
        } else {
          estado = 'error';
          mensajeError = err.message;
          configuracion.hidden = false;
          if (resultados) obsoleto = true;
          actualizarBanner();
          aviso(`No se pudo calcular el Análisis RSH: ${err.message}`, 'error');
        }
      } finally {
        if (solicitudId === idSolicitud) {
          solicitudId = null;
          progreso = null;
          actualizarEstado();
        }
      }
    }

    function desactivar() {
      if (estado === 'calculando') {
        cancelarCalculo();
        return;
      }
      resultados = null;
      estado = 'inactivo';
      obsoleto = false;
      mensajeError = '';
      configuracionVisual = { tamano: 'actual', colorPorComunidad: false };
      configuracion.hidden = false;
      contenedorResultados.hidden = true;
      resumen.innerHTML = '';
      advertencias.innerHTML = '';
      controlesVisuales.innerHTML = '';
      tablaNodos.innerHTML = '';
      const comunidades = vistaComunidades.querySelector('.grafo-analisis-comunidades');
      if (comunidades) comunidades.innerHTML = '';
      if (typeof alRestaurarVisual === 'function') alRestaurarVisual();
      actualizarBanner();
      actualizarEstado();
    }

    function valorMetrica(id, metrica) {
      const grupo = resultados && resultados.metricas && resultados.metricas[metrica];
      if (!grupo || !grupo.porNodo) return null;
      return grupo.porNodo[id] || null;
    }

    function columnasTabla() {
      const metricas = resultados && resultados._metricas ? resultados._metricas : [...seleccionMetricas];
      const tiene = (id) => metricas.includes(id);
      const columnas = [
        { id: 'entidad', etiqueta: 'Entidad', texto: true, valor: (n) => n.etiqueta },
        { id: 'identificador', etiqueta: 'ID', texto: true, valor: (n) => n.identificador || '' },
        { id: 'tipo', etiqueta: 'Tipo', texto: true, valor: (n) => NOMBRES_TIPO[n.tipo] || n.tipo },
        { id: 'detalleEntidad', etiqueta: 'Género / tipo', texto: true, valor: (n) => n.genero || n.tipoEntidad || '' },
        { id: 'notas', etiqueta: 'Notas', texto: true, valor: (n) => n.notas || '' },
      ];
      if (tiene('grado') && resultados.metricas.grado) {
        columnas.push({ id: 'grado', etiqueta: 'Grado total', valor: (n) => (valorMetrica(n.id, 'grado') || {}).total });
        if (resultados.red.dirigida) {
          columnas.push({ id: 'entrada', etiqueta: 'Entrada', valor: (n) => (valorMetrica(n.id, 'grado') || {}).entrada });
          columnas.push({ id: 'salida', etiqueta: 'Salida', valor: (n) => (valorMetrica(n.id, 'grado') || {}).salida });
        }
        columnas.push({ id: 'vecinos', etiqueta: 'Vecinos', valor: (n) => (valorMetrica(n.id, 'grado') || {}).vecinos });
      }
      if (tiene('intermediacion') && resultados.metricas.intermediacion) {
        columnas.push({ id: 'intermediacion', etiqueta: 'Intermediación', valor: (n) => (valorMetrica(n.id, 'intermediacion') || {}).valor });
      }
      if (tiene('cercania') && resultados.metricas.cercania) {
        columnas.push({ id: 'cercania', etiqueta: 'Cercanía', valor: (n) => (valorMetrica(n.id, 'cercania') || {}).valor });
      }
      if (tiene('vectorPropio') && resultados.metricas.vectorPropio) {
        columnas.push({
          id: 'vectorPropio',
          etiqueta: resultados.metricas.vectorPropio.metodo || 'Vector propio',
          valor: (n) => (valorMetrica(n.id, 'vectorPropio') || {}).valor,
        });
      }
      if (tiene('comunidades') && resultados.metricas.comunidades) {
        columnas.push({ id: 'comunidad', etiqueta: 'Comunidad', valor: (n) => (valorMetrica(n.id, 'comunidades') || {}).comunidad });
      }
      if (tiene('componentes') && resultados.metricas.componentes) {
        columnas.push({
          id: 'componente',
          etiqueta: 'Componente',
          valor: (n) => {
            const c = valorMetrica(n.id, 'componentes');
            return c ? c.debil + 1 : null;
          },
        });
        if (resultados.red.dirigida) {
          columnas.push({
            id: 'componenteFuerte',
            etiqueta: 'Comp. fuerte',
            valor: (n) => {
              const c = valorMetrica(n.id, 'componentes');
              return c ? c.fuerte + 1 : null;
            },
          });
        }
      }
      return columnas;
    }

    function nodosFiltrados() {
      if (!resultados) return [];
      const texto = filtroTabla.trim().toLowerCase();
      let nodos = resultados.nodos;
      if (texto) {
        nodos = nodos.filter((nodo) => (
          `${nodo.etiqueta} ${nodo.identificador} ${NOMBRES_TIPO[nodo.tipo] || nodo.tipo} ${nodo.genero || ''} ${nodo.tipoEntidad || ''} ${nodo.notas || ''}`
            .toLowerCase().includes(texto)
        ));
      }
      if (orden.columna) {
        const columna = columnasTabla().find((c) => c.id === orden.columna);
        if (columna) {
          nodos = [...nodos].sort((a, b) => {
            const va = columna.valor(a);
            const vb = columna.valor(b);
            if (columna.texto) {
              return String(va).localeCompare(String(vb), 'es') * orden.direccion;
            }
            const na = Number(va);
            const nb = Number(vb);
            if (Number.isFinite(na) && Number.isFinite(nb)) return (na - nb) * orden.direccion;
            return String(va).localeCompare(String(vb), 'es') * orden.direccion;
          });
        }
      }
      return nodos;
    }

    function pintarTabla() {
      tablaNodos.innerHTML = '';
      if (!resultados) return;
      const columnas = columnasTabla();
      const nodos = nodosFiltrados();
      const visibles = nodos.slice(0, limiteFilas);
      const tabla = el('table', 'tabla-analisis-rsh');
      const thead = el('thead');
      const filaCab = el('tr');
      for (const columna of columnas) {
        const th = el('th');
        const btn = el('button', 'grafo-analisis-orden', columna.etiqueta);
        btn.type = 'button';
        if (orden.columna === columna.id) {
          th.setAttribute('aria-sort', orden.direccion > 0 ? 'ascending' : 'descending');
          btn.textContent += orden.direccion > 0 ? ' ↑' : ' ↓';
        }
        btn.addEventListener('click', () => {
          if (orden.columna === columna.id) orden.direccion *= -1;
          else orden = { columna: columna.id, direccion: 1 };
          pintarTabla();
        });
        th.appendChild(btn);
        filaCab.appendChild(th);
      }
      thead.appendChild(filaCab);
      tabla.appendChild(thead);
      const tbody = el('tbody');
      for (const nodo of visibles) {
        const tr = el('tr');
        tr.tabIndex = 0;
        tr.setAttribute('role', 'button');
        tr.title = `Seleccionar ${nodo.etiqueta} en el grafo`;
        for (const columna of columnas) {
          const valor = columna.valor(nodo);
          const td = el('td', columna.texto ? '' : 'numero', columna.texto
            ? String(valor == null ? '—' : valor)
            : formatoNumero(valor));
          if (columna.id === 'comunidad' && valor != null) {
            td.classList.add('celda-comunidad');
            const punto = el('span', 'punto-comunidad');
            punto.style.background = PALETA_COMUNIDADES[(Number(valor) - 1) % PALETA_COMUNIDADES.length];
            td.prepend(punto);
          }
          tr.appendChild(td);
        }
        const activar = () => {
          if (typeof alSeleccionarNodo === 'function') alSeleccionarNodo(nodo.id);
        };
        tr.addEventListener('click', activar);
        tr.addEventListener('keydown', (ev) => {
          if (ev.key === 'Enter' || ev.key === ' ') {
            ev.preventDefault();
            activar();
          }
        });
        tbody.appendChild(tr);
      }
      tabla.appendChild(tbody);
      tablaNodos.appendChild(tabla);
      if (!visibles.length) {
        tablaNodos.appendChild(el('div', 'vacio mini', 'Sin entidades que coincidan con el filtro.'));
      }
      btnMas.hidden = nodos.length <= limiteFilas || limiteFilas >= LIMITE_MAXIMO_FILAS;
      if (!btnMas.hidden) {
        btnMas.textContent = `Mostrar más (${Math.min(
          nodos.length - limiteFilas,
          LIMITE_MAXIMO_FILAS - limiteFilas
        )} restantes)`;
      }
      pieTabla.hidden = nodos.length === 0;
    }

    function crearTarjeta(etiqueta, valor, pista = '') {
      const tarjeta = el('div', 'grafo-analisis-tarjeta');
      tarjeta.appendChild(el('span', 'grafo-analisis-tarjeta-etiqueta', etiqueta));
      tarjeta.appendChild(el('strong', 'grafo-analisis-tarjeta-valor', valor));
      if (pista) tarjeta.appendChild(el('small', '', pista));
      return tarjeta;
    }

    function pintarResumen() {
      resumen.innerHTML = '';
      if (!resultados) return;
      const red = resultados.red;
      const opcionesResultado = resultados._opciones || opcionesAnalisis;
      resumen.appendChild(crearTarjeta('Entidades', formatoNumero(red.n, 0), red.dirigida ? 'red dirigida' : 'red no dirigida'));
      resumen.appendChild(crearTarjeta('Relaciones', formatoNumero(red.m, 0), `${formatoNumero(red.paresUnicos, 0)} pares únicos`));
      resumen.appendChild(crearTarjeta(
        'Ámbito',
        opcionesResultado.ambito === 'visible' ? 'Red visible' : 'Red completa',
        red.incluirAislados ? 'incluye aislados' : 'sin aislados'
      ));
      const etiquetasProcedencia = {
        todas: 'Todas',
        manuales: 'Solo manuales',
        editadas: 'Manuales y editadas',
        automatizadas: 'Solo automatizadas',
      };
      resumen.appendChild(crearTarjeta('Procedencia', etiquetasProcedencia[red.procedencia] || red.procedencia, 'relaciones incluidas'));      if (resultados.metricas.densidad) {
        resumen.appendChild(crearTarjeta(
          'Densidad',
          `${formatoNumero(resultados.metricas.densidad.valor * 100, 2)} %`,
          `${formatoNumero(resultados.metricas.densidad.paresUnicos, 0)} / ${formatoNumero(resultados.metricas.densidad.posibles, 0)} pares · multiplicidad ${formatoNumero(resultados.metricas.densidad.multiplicidadMedia, 2)}`
        ));
      }
      if (resultados.metricas.componentes) {
        const c = resultados.metricas.componentes;
        resumen.appendChild(crearTarjeta(
          'Componentes',
          `${c.numeroDebiles} débiles · ${c.numeroFuertes} fuertes`,
          `mayor: ${formatoNumero(c.mayorDebil.tamano, 0)} entidades · ${c.aislados.length} aisladas`
        ));
      }
      if (resultados.metricas.comunidades) {
        const c = resultados.metricas.comunidades;
        resumen.appendChild(crearTarjeta(
          'Comunidades',
          formatoNumero(c.numComunidades, 0),
          `modularidad ${formatoNumero(c.modularidad, 3)} · estabilidad ${formatoNumero(c.estabilidad, 2)}`
        ));
      }
      if (resultados.metricas.intermediacion) {
        const m = resultados.metricas.intermediacion;
        const top = Object.entries(m.porNodo).sort((a, b) => b[1].valor - a[1].valor)[0];
        const nodo = top && resultados.nodos.find((n) => n.id === top[0]);
        resumen.appendChild(crearTarjeta(
          'Mayor intermediación',
          nodo ? nodo.etiqueta : '—',
          top ? formatoNumero(top[1].valor, 4) : ''
        ));
      }
      if (resultados.metricas.cercania) {
        const m = resultados.metricas.cercania;
        const top = Object.entries(m.porNodo).sort((a, b) => b[1].valor - a[1].valor)[0];
        const nodo = top && resultados.nodos.find((n) => n.id === top[0]);
        resumen.appendChild(crearTarjeta(
          'Mayor cercanía',
          nodo ? nodo.etiqueta : '—',
          top ? formatoNumero(top[1].valor, 4) : ''
        ));
      }

      advertencias.innerHTML = '';
      const avisos = [...(resultados.advertencias || [])];
      if (resultados.metricas.vectorPropio && resultados.metricas.vectorPropio.convergio === false) {
        avisos.push('La centralidad de vector propio/PageRank no convergió en las iteraciones disponibles.');
      }
      if (avisos.length) {
        const lista = el('ul', 'lista-advertencias');
        for (const advertencia of avisos) lista.appendChild(el('li', '', advertencia));
        advertencias.appendChild(lista);
      }
    }

    function pintarComunidades() {
      const contenedor = vistaComunidades.querySelector('.grafo-analisis-comunidades');
      contenedor.innerHTML = '';
      if (!resultados || !resultados.metricas.comunidades) {
        contenedor.appendChild(el('p', 'pista', 'Activa la métrica Comunidades para ver las agrupaciones.'));
        return;
      }
      const c = resultados.metricas.comunidades;
      const nombres = new Map(resultados.nodos.map((n) => [n.id, n.etiqueta]));
      const miembros = new Map();
      for (const nodo of resultados.nodos) {
        const info = c.porNodo[nodo.id];
        if (!info) continue;
        if (!miembros.has(info.comunidad)) miembros.set(info.comunidad, []);
        miembros.get(info.comunidad).push(nombres.get(nodo.id) || nodo.id);
      }
      const cabecera = el('div', 'grafo-analisis-comunidades-cabecera');
      cabecera.appendChild(el('strong', '', `${c.numComunidades} comunidades`));
      cabecera.appendChild(el('span', '', `modularidad ${formatoNumero(c.modularidad, 3)} · estabilidad ${formatoNumero(c.estabilidad, 2)}`));
      contenedor.appendChild(cabecera);
      const limiteComunidades = 200;
      for (const grupo of c.tamanos.slice(0, limiteComunidades)) {
        const fila = el('div', 'grafo-analisis-comunidad');
        const punto = el('span', 'punto-comunidad');
        punto.style.background = PALETA_COMUNIDADES[(grupo.comunidad - 1) % PALETA_COMUNIDADES.length];
        const nombresGrupo = (miembros.get(grupo.comunidad) || []).slice(0, 6).join(', ');
        const detalle = (miembros.get(grupo.comunidad) || []).length > 6 ? '…' : '';
        fila.append(
          punto,
          el('strong', '', `Comunidad ${grupo.comunidad}`),
          el('span', 'grafo-analisis-comunidad-tamano', `${grupo.tamano} entidades`),
          el('small', '', `${nombresGrupo}${detalle}`)
        );
        contenedor.appendChild(fila);
      }
      if (c.tamanos.length > limiteComunidades) {
        contenedor.appendChild(el('p', 'pista',
          `Se muestran las ${limiteComunidades} comunidades más grandes de ${c.tamanos.length}.`));
      }
      if (!c.tamanos.length) contenedor.appendChild(el('p', 'pista', 'Sin comunidades calculadas.'));
    }

    function valoresParaTamano() {
      if (!resultados || configuracionVisual.tamano === 'actual') return { valores: null, maximo: 0 };
      if (configuracionVisual.tamano === 'uniforme') return { valores: null, maximo: 0 };
      const metrica = configuracionVisual.tamano;
      const grupo = resultados.metricas[metrica];
      if (!grupo) return { valores: null, maximo: 0 };
      const valores = {};
      let maximo = 0;
      for (const [id, info] of Object.entries(grupo.porNodo)) {
        const valor = metrica === 'grado' ? info.total : info.valor;
        if (Number.isFinite(Number(valor))) {
          valores[id] = Number(valor);
          if (Number(valor) > maximo) maximo = Number(valor);
        }
      }
      return { valores, maximo: maximo > 0 ? maximo : 1 };
    }

    function aplicarVisualizacion() {
      if (typeof alAplicarVisual !== 'function') return;
      if (!resultados) return;
      const { valores, maximo } = valoresParaTamano();
      const comunidades = resultados.metricas.comunidades
        ? Object.fromEntries(
          Object.entries(resultados.metricas.comunidades.porNodo).map(([id, info]) => [id, info.comunidad])
        )
        : null;
      alAplicarVisual({
        tamano: configuracionVisual.tamano,
        valores,
        maximo,
        comunidades,
        colorPorComunidad: configuracionVisual.colorPorComunidad && Boolean(comunidades),
      });
    }

    function pintarControlesVisuales() {
      controlesVisuales.innerHTML = '';
      if (!resultados) return;
      const etiquetaTamano = el('label', 'grafo-analisis-campo');
      etiquetaTamano.appendChild(el('span', '', 'Tamaño de nodo'));
      const selTamano = document.createElement('select');
      selTamano.className = 'entrada';
      const opciones = [['actual', 'Actual (grado visible)'], ['uniforme', 'Uniforme']];
      if (resultados.metricas.grado) opciones.push(['grado', 'Grado total']);
      if (resultados.metricas.intermediacion) opciones.push(['intermediacion', 'Intermediación']);
      if (resultados.metricas.cercania) opciones.push(['cercania', 'Cercanía']);
      if (resultados.metricas.vectorPropio) opciones.push(['vectorPropio', 'Vector propio / PageRank']);
      for (const [valor, etiqueta] of opciones) selTamano.appendChild(new Option(etiqueta, valor));
      selTamano.value = configuracionVisual.tamano;
      selTamano.addEventListener('change', () => {
        configuracionVisual.tamano = selTamano.value;
        aplicarVisualizacion();
      });
      etiquetaTamano.appendChild(selTamano);
      controlesVisuales.appendChild(etiquetaTamano);

      const labelComunidad = el('label', 'grafo-analisis-opcion compacta');
      const checkComunidad = document.createElement('input');
      checkComunidad.type = 'checkbox';
      checkComunidad.checked = configuracionVisual.colorPorComunidad;
      checkComunidad.disabled = !resultados.metricas.comunidades;
      checkComunidad.addEventListener('change', () => {
        configuracionVisual.colorPorComunidad = checkComunidad.checked;
        aplicarVisualizacion();
      });
      labelComunidad.append(checkComunidad, document.createTextNode(' Colorear por comunidad'));
      controlesVisuales.appendChild(labelComunidad);
    }

    function renderResultados() {
      if (!resultados) {
        contenedorResultados.hidden = true;
        return;
      }
      contenedorResultados.hidden = false;
      configuracion.hidden = true;
      pintarResumen();
      pintarControlesVisuales();
      pintarTabla();
      pintarComunidades();
      btnTabComunidades.hidden = !resultados.metricas.comunidades;
      if (tabActiva === 'comunidades' && !resultados.metricas.comunidades) tabActiva = 'nodos';
      actualizarTabs();
      actualizarBanner();
      btnDesactivar.hidden = false;
    }

    function actualizarTabs() {
      vistaNodos.hidden = tabActiva !== 'nodos';
      vistaComunidades.hidden = tabActiva !== 'comunidades';
      btnTabNodos.classList.toggle('modo-activo', tabActiva === 'nodos');
      btnTabComunidades.classList.toggle('modo-activo', tabActiva === 'comunidades');
    }

    function exportarCSV() {
      if (!resultados) return;
      if (!window.api || typeof window.api.analisisExportar !== 'function') {
        aviso('La exportación del Análisis RSH no está disponible en esta versión.', 'error');
        return;
      }
      const columnas = columnasTabla();
      const opcionesResultado = resultados._opciones || opcionesAnalisis;
      const metricasResultado = resultados._metricas || obtenerMetricasSeleccionadas();
      const lineas = [];
      lineas.push(['Análisis RSH', proyecto.nombre].map(formatoCSV).join(','));
      lineas.push(['Generado', resultados.calculadoEn].map(formatoCSV).join(','));
      lineas.push(['Ámbito', opcionesResultado.ambito === 'visible' ? 'Red visible' : 'Red completa'].map(formatoCSV).join(','));
      lineas.push(['Dirigida', resultados.red.dirigida ? 'sí' : 'no'].map(formatoCSV).join(','));
      lineas.push(['Aislados', resultados.red.incluirAislados ? 'incluidos' : 'excluidos'].map(formatoCSV).join(','));
      lineas.push(['Procedencia', resultados.red.procedencia].map(formatoCSV).join(','));
      lineas.push(['Resolución Leiden', opcionesResultado.resolucion ?? ''].map(formatoCSV).join(','));
      lineas.push(['Semilla', opcionesResultado.semilla ?? ''].map(formatoCSV).join(','));
      lineas.push(['Repeticiones Leiden', opcionesResultado.repeticiones ?? ''].map(formatoCSV).join(','));
      if (resultados.metricas.intermediacion) {
        const inter = resultados.metricas.intermediacion;
        lineas.push(['Intermediación aproximada', inter.aproximada ? `sí (${inter.fuentes} fuentes)` : 'no'].map(formatoCSV).join(','));
      }
      if (resultados.metricas.cercania) {
        const cercania = resultados.metricas.cercania;
        lineas.push(['Cercanía aproximada', cercania.aproximada ? `sí (${cercania.fuentes} fuentes)` : 'no'].map(formatoCSV).join(','));
      }
      if (resultados.metricas.vectorPropio) {
        lineas.push(['Vector propio/PageRank convergió', resultados.metricas.vectorPropio.convergio ? 'sí' : 'no'].map(formatoCSV).join(','));
      }
      if (resultados.metricas.comunidades) {
        const comunidades = resultados.metricas.comunidades;
        lineas.push(['Estabilidad Leiden', comunidades.estabilidad == null ? 'no estimable' : String(comunidades.estabilidad)].map(formatoCSV).join(','));
      }
      lineas.push(['Entidades', resultados.red.n].map(formatoCSV).join(','));
      lineas.push(['Relaciones', resultados.red.m].map(formatoCSV).join(','));
      lineas.push(['Pares únicos', resultados.red.paresUnicos].map(formatoCSV).join(','));
      lineas.push(['Métricas', metricasResultado.join('; ')].map(formatoCSV).join(','));
      lineas.push([]);
      lineas.push(columnas.map((c) => formatoCSV(c.etiqueta)).join(','));
      const nodos = [...resultados.nodos].sort((a, b) => String(a.etiqueta).localeCompare(String(b.etiqueta), 'es'));
      for (const nodo of nodos) {
        lineas.push(columnas.map((columna) => {
          const valor = columna.valor(nodo);
          return formatoCSV(valor == null ? '' : (columna.texto ? valor : valorPlano(valor)));
        }).join(','));
      }
      const contenido = `\uFEFF${lineas.join('\r\n')}`;
      const nombre = `analisis-rsh-${String(proyecto.nombre || 'proyecto').replace(/[^\w-]+/g, '-').slice(0, 80)}.csv`;
      llamar(window.api.analisisExportar({ nombre, contenido }))
        .then((res) => {
          if (res && res.cancelado) return;
          aviso(`Análisis RSH exportado a ${res.ruta}`, 'exito');
        })
        .catch((err) => aviso(`No se pudo exportar el Análisis RSH: ${err.message}`, 'error'));
    }

    function agregarMetricasPanel(panelNodo, id) {
      if (!resultados) return;
      const filas = [];
      if (resultados.metricas.grado && resultados.metricas.grado.porNodo[id]) {
        const g = resultados.metricas.grado.porNodo[id];
        filas.push(['Grado', resultados.red.dirigida
          ? `${g.total} (${g.entrada} entrada · ${g.salida} salida)`
          : String(g.total)]);
        filas.push(['Vecinos distintos', String(g.vecinos)]);
      }
      if (resultados.metricas.intermediacion && resultados.metricas.intermediacion.porNodo[id]) {
        filas.push(['Intermediación', formatoNumero(resultados.metricas.intermediacion.porNodo[id].valor, 4)]);
      }
      if (resultados.metricas.cercania && resultados.metricas.cercania.porNodo[id]) {
        filas.push(['Cercanía', formatoNumero(resultados.metricas.cercania.porNodo[id].valor, 4)]);
      }
      if (resultados.metricas.vectorPropio && resultados.metricas.vectorPropio.porNodo[id]) {
        filas.push([
          resultados.metricas.vectorPropio.metodo || 'Vector propio',
          formatoNumero(resultados.metricas.vectorPropio.porNodo[id].valor, 4),
        ]);
      }
      if (resultados.metricas.comunidades && resultados.metricas.comunidades.porNodo[id]) {
        filas.push(['Comunidad', `Comunidad ${resultados.metricas.comunidades.porNodo[id].comunidad}`]);
      }
      if (resultados.metricas.componentes && resultados.metricas.componentes.porNodo[id]) {
        const c = resultados.metricas.componentes.porNodo[id];
        filas.push(['Componente', `débil ${c.debil + 1}${resultados.red.dirigida ? ` · fuerte ${c.fuerte + 1}` : ''}`]);
      }
      if (!filas.length) return;
      const bloque = el('div', 'grafo-info-metricas');
      bloque.appendChild(el('h4', '', 'Métricas RSH'));
      for (const [etiqueta, valor] of filas) {
        bloque.appendChild(el('div', 'grafo-info-metrica', `${etiqueta}: ${valor}`));
      }
      panelNodo.appendChild(bloque);
    }

    function alCambiarFiltros() {
      if (!resultados) return;
      if (opcionesAnalisis.ambito === 'visible') {
        obsoleto = true;
        actualizarBanner();
      }
    }

    /* ---------------- Eventos ---------------- */
    boton.addEventListener('click', () => {
      abierto = !abierto;
      actualizarBotonPanel();
      if (abierto && !resultados && estado === 'inactivo') {
        configuracion.hidden = false;
        contenedorResultados.hidden = true;
      }
    });
    btnCerrar.addEventListener('click', cerrarPanel);
    btnCalcular.addEventListener('click', calcular);
    btnConfigurar.addEventListener('click', () => {
      configuracion.hidden = false;
      actualizarEstado();
    });
    btnDesactivar.addEventListener('click', desactivar);
    btnRecalcular.addEventListener('click', calcular);
    btnExportar.addEventListener('click', exportarCSV);
    btnTabNodos.addEventListener('click', () => {
      tabActiva = 'nodos';
      actualizarTabs();
    });
    btnTabComunidades.addEventListener('click', () => {
      tabActiva = 'comunidades';
      actualizarTabs();
    });
    entradaTabla.addEventListener('input', () => {
      if (temporizadorFiltroTabla) clearTimeout(temporizadorFiltroTabla);
      temporizadorFiltroTabla = setTimeout(() => {
        temporizadorFiltroTabla = null;
        filtroTabla = entradaTabla.value;
        limiteFilas = LIMITE_FILAS;
        pintarTabla();
      }, 180);
    });
    btnMas.addEventListener('click', () => {
      limiteFilas = Math.min(LIMITE_MAXIMO_FILAS, limiteFilas + LIMITE_FILAS);
      pintarTabla();
    });
    actualizarEstado();
    actualizarTabs();

    if (window.api && typeof window.api.onAnalisisProgreso === 'function') {
      try {
        quitarProgreso = window.api.onAnalisisProgreso((datos) => {
          if (!datos || datos.solicitudId !== solicitudId || estado !== 'calculando') return;
          progreso = datos;
          actualizarEstado();
        });
      } catch {
        quitarProgreso = null;
      }
    }

    function capturarConfig() {
      return {
        metricas: [...seleccionMetricas],
        opciones: { ...opcionesAnalisis },
        visual: { ...configuracionVisual },
      };
    }

    function aplicarConfig(config) {
      if (!config || typeof config !== 'object') return;
      if (estado === 'calculando' && solicitudId) {
        const id = solicitudId;
        solicitudId = null;
        estado = 'inactivo';
        if (window.api && typeof window.api.analisisCancelar === 'function') {
          llamar(window.api.analisisCancelar(id)).catch(() => {});
        }
      }
      if (config.opciones && typeof config.opciones === 'object') {
        opcionesAnalisis = { ...opcionesAnalisis, ...config.opciones };
      }
      seleccionMetricas = new Set(
        Array.isArray(config.metricas) ? config.metricas.filter((id) => ETIQUETAS_METRICAS[id]) : []
      );
      panel.querySelectorAll('input[data-metrica]').forEach((check) => {
        check.checked = seleccionMetricas.has(check.value);
      });
      panel.querySelectorAll('input[name="grafo-analisis-ambito"]').forEach((radio) => {
        radio.checked = radio.value === opcionesAnalisis.ambito;
      });
      checkDirigida.checked = opcionesAnalisis.dirigida !== false;
      checkAislados.checked = opcionesAnalisis.incluirAislados !== false;
      selProcedencia.value = opcionesAnalisis.procedencia || 'todas';
      inResolucion.value = String(opcionesAnalisis.resolucion || 1);
      inSemilla.value = String(opcionesAnalisis.semilla ?? 42);
      inRepeticiones.value = String(opcionesAnalisis.repeticiones || 3);
      configuracionVisual = {
        tamano: 'actual',
        colorPorComunidad: false,
        ...(config.visual || {}),
      };
      resultados = null;
      estado = 'inactivo';
      obsoleto = false;
      mensajeError = '';
      configuracion.hidden = false;
      contenedorResultados.hidden = true;
      if (typeof alRestaurarVisual === 'function') alRestaurarVisual();
      actualizarEstado();
    }

    return {
      boton,
      panel,
      alCambiarFiltros,
      agregarMetricasPanel,
      capturarConfig,
      aplicarConfig,
      desmontar() {
        if (temporizadorFiltroTabla) {
          clearTimeout(temporizadorFiltroTabla);
          temporizadorFiltroTabla = null;
        }
        if (quitarProgreso) {
          try { quitarProgreso(); } catch { /* listener ya retirado */ }
          quitarProgreso = null;
        }
        if (estado === 'calculando' && solicitudId && window.api && typeof window.api.analisisCancelar === 'function') {
          const id = solicitudId;
          solicitudId = null;
          estado = 'inactivo';
          llamar(window.api.analisisCancelar(id)).catch(() => {});
        }
        if (typeof alRestaurarVisual === 'function') alRestaurarVisual();
        if (typeof alDesmontar === 'function') alDesmontar();
        panel.remove();
      },
    };
  }

  window.AnalisisRSHUI = { crear: crearPanel };
})();
