'use strict';

/* H-IMAGO · 2.1 Vista de grafo: red social histórica con simulación de
   fuerzas sobre canvas (arrastrar nodos, paneo, zoom, filtros y exportación) */

const COLORES_GRAFO = {
  persona: '#d9a05b',
  institucion: '#7ea8c9',
  lugar: '#86b28a',
  patrimonio: '#b98cc4',
};

/* Rellenos en escala de grises para la exportación imprimible. */
const GRISES_GRAFO = {
  persona: '#ffffff',
  institucion: '#d9d9d9',
  lugar: '#b3b3b3',
  patrimonio: '#8c8c8c',
};
const GRISES_COMUNIDADES = ['#ffffff', '#d9d9d9', '#b3b3b3', '#8c8c8c', '#666666'];

/** Normaliza para buscar sin tildes ni mayúsculas. */
function normalizarTextoGrafo(valor) {
  return String(valor == null ? '' : valor)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

let limpiarGrafo = null;
let generacionGrafo = 0;
const vistasGrafo = new Map();
const MAX_VISTAS_GRAFO = 5;
const PALETA_COMUNIDADES = typeof COLORES_COMUNIDADES !== 'undefined'
  ? COLORES_COMUNIDADES
  : ['#e3c35a', '#7ea8c9', '#86b28a', '#b98cc4', '#d98b8b', '#6fc3c0', '#d4a373', '#9d9dd6'];
let analisisRSH = null;
const analisisVisual = {
  tamano: 'actual',
  valores: null,
  maximo: 0,
  comunidades: null,
  colorPorComunidad: false,
};

MODULOS.grafo = {
  async montar(cont, proyecto, opciones = {}) {
    const generacion = ++generacionGrafo;
    if (analisisRSH) {
      try { analisisRSH.desmontar(); } catch { /* panel anterior ya retirado */ }
      analisisRSH = null;
    }
    analisisVisual.tamano = 'actual';
    analisisVisual.valores = null;
    analisisVisual.maximo = 0;
    analisisVisual.comunidades = null;
    analisisVisual.colorPorComunidad = false;
    cont.innerHTML = '';
    const raiz = el('div', 'modulo modulo-grafo');

    /* Barra de herramientas */
    const barra = el('div', 'grafo-barra');
    const leyenda = el('div', 'grafo-leyenda');
    const visibles = { persona: true, institucion: true, lugar: true, patrimonio: true };
    let filtroEntidad = '';
    let filtroRelacion = '';
    let filtroProcedencia = 'todas';
    let excluirSinDatos = false;
    let mostrarDireccion = true;
    let seleccionArista = null;
    let resaltadoArista = null;
    let panelAristaActual = false;
    let focoEgo = null;
    let temporizadorReproduccion = null;
    const opcionesExportacion = {
      incluirTitulo: true,
      incluirLeyenda: true,
      incluirFiltros: true,
      incluirImprimible: false,
    };
    const nodosOcultos = new Set();
    const nodosFijados = new Set();
    const paresDesagregados = new Set();

    let datos = await llamar(api.grafoDatos(proyecto.id)).catch((err) => {
      if (generacion === generacionGrafo) {
        const error = el('div', 'vacio error', `No se pudo cargar el grafo: ${err.message}`);
        const boton = el('button', 'btn btn-mini', 'Reintentar');
        boton.type = 'button';
        boton.addEventListener('click', () => {
          cont.innerHTML = '';
          MODULOS.grafo.montar(cont, proyecto, opciones);
        });
        cont.appendChild(error);
        cont.appendChild(boton);
      }
      return null;
    });
    if (!datos) return;
    if (generacion !== generacionGrafo) return;
    const cuentaTipos = {};
    for (const n of datos.nodos) cuentaTipos[n.tipo] = (cuentaTipos[n.tipo] || 0) + 1;

    leyenda.appendChild(el('span', 'grafo-filtro-titulo', 'Entidades'));
    const chipsEntidad = [];
    for (const tipo of Object.keys(COLORES_GRAFO)) {
      const chip = el('button', 'chip activo');
      chip.dataset.tipo = tipo;
      chip.style.setProperty('--color', COLORES_GRAFO[tipo]);
      chip.innerHTML = `<span class="chip-punto"></span>${NOMBRE_TIPO[tipo]} <span class="chip-cuenta">${cuentaTipos[tipo] || 0}</span>`;
      chip.addEventListener('click', () => {
        visibles[tipo] = !visibles[tipo];
        chip.classList.toggle('activo', visibles[tipo]);
        reiniciarFiltro();
        recalentar();
      });
      chipsEntidad.push(chip);
      leyenda.appendChild(chip);
    }
    const cajaBuscarEntidad = el('div', 'grafo-buscar');
    const iconoEntidad = el('span', 'grafo-buscar-icono');
    iconoEntidad.innerHTML = '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>';
    const inputEntidad = el('input', 'grafo-buscar-entrada');
    inputEntidad.type = 'search';
    inputEntidad.placeholder = 'Buscar entidad…';
    inputEntidad.setAttribute('aria-label', 'Buscar entidad en el grafo');
    cajaBuscarEntidad.append(iconoEntidad, inputEntidad);
    leyenda.appendChild(cajaBuscarEntidad);
    iconoEntidad.addEventListener('click', () => inputEntidad.focus());
    let temporizadorEntidad = null;
    const aplicarBusquedaEntidad = () => {
      filtroEntidad = normalizarTextoGrafo(inputEntidad.value);
      reiniciarFiltro();
      despertar();
    };
    inputEntidad.addEventListener('input', () => {
      if (temporizadorEntidad) clearTimeout(temporizadorEntidad);
      temporizadorEntidad = setTimeout(() => {
        temporizadorEntidad = null;
        aplicarBusquedaEntidad();
      }, 150);
    });
    inputEntidad.addEventListener('change', () => {
      if (temporizadorEntidad) {
        clearTimeout(temporizadorEntidad);
        temporizadorEntidad = null;
      }
      aplicarBusquedaEntidad();
    });
    inputEntidad.addEventListener('keydown', (ev) => {
      if (ev.key !== 'Enter') return;
      ev.preventDefault();
      if (temporizadorEntidad) {
        clearTimeout(temporizadorEntidad);
        temporizadorEntidad = null;
      }
      filtroEntidad = normalizarTextoGrafo(inputEntidad.value);
      reiniciarFiltro();
      const primera = nodosVisibles.find((n) => coincideEntidad(n));
      if (primera) enfocarNodo(primera);
    });
    const panelEntidades = el('div', 'grafo-barra grafo-barra-entidades');
    panelEntidades.id = 'grafo-panel-entidades';
    panelEntidades.hidden = true;
    panelEntidades.appendChild(leyenda);

    const acciones = el('div', 'grafo-acciones');
    const btnEntidades = el('button', 'btn btn-mini', 'Entidades');
    btnEntidades.type = 'button';
    btnEntidades.title = 'Mostrar u ocultar los filtros de entidades';
    btnEntidades.setAttribute('aria-expanded', 'false');
    btnEntidades.setAttribute('aria-controls', 'grafo-panel-entidades');
    const btnRelaciones = el('button', 'btn btn-mini', 'Relaciones');
    btnRelaciones.type = 'button';
    btnRelaciones.title = 'Mostrar u ocultar los filtros de relaciones';
    btnRelaciones.setAttribute('aria-expanded', 'false');
    btnRelaciones.setAttribute('aria-controls', 'grafo-panel-relaciones');
    const btnTemporalidad = el('button', 'btn btn-mini', 'Temporalidad');
    btnTemporalidad.type = 'button';
    btnTemporalidad.title = 'Mostrar u ocultar los filtros temporales';
    btnTemporalidad.setAttribute('aria-expanded', 'false');
    btnTemporalidad.setAttribute('aria-controls', 'grafo-panel-temporal');
    const btnReorganizar = el('button', 'btn btn-mini', 'Reorganizar');
    const btnCentrar = el('button', 'btn btn-mini', 'Centrar');
    const btnExportar = el('button', 'btn btn-mini', 'Exportar PNG');
    const btnExportarSeleccion = el('button', 'btn btn-mini', 'Exportar selección');
    btnExportarSeleccion.disabled = true;
    btnExportarSeleccion.title = 'Selecciona un nodo para exportar su nodo y conexiones';
    const btnExportarOpciones = el('button', 'btn btn-mini', 'Opciones PNG');
    btnExportarOpciones.type = 'button';
    btnExportarOpciones.title = 'Configurar título, leyenda y resumen de filtros en el PNG';
    const btnDireccion = el('button', 'btn btn-mini modo-activo', 'Dirección');
    btnDireccion.type = 'button';
    btnDireccion.title = 'Mostrar u ocultar las flechas de dirección de las relaciones';
    btnDireccion.setAttribute('aria-pressed', 'true');
    const btnTabla = el('button', 'btn btn-mini', 'Ver como tabla');
    btnTabla.type = 'button';
    btnTabla.title = 'Abrir una tabla accesible con las entidades y relaciones visibles';
    const btnVistas = el('button', 'btn btn-mini', 'Vistas');
    btnVistas.type = 'button';
    btnVistas.title = 'Guardar o aplicar vistas del grafo';
    acciones.append(
      btnEntidades, btnRelaciones, btnTemporalidad, btnReorganizar, btnCentrar, btnExportar,
      btnExportarSeleccion, btnExportarOpciones, btnDireccion, btnTabla, btnVistas
    );
    barra.appendChild(acciones);
    raiz.appendChild(barra);
    raiz.appendChild(panelEntidades);

    /* Filtro por categorías de RELACIONES */
    const cuentaCategorias = {};
    for (const a of datos.aristas) {
      const categoria = categoriaRelacion(a.tipo) || 'Otras';
      cuentaCategorias[categoria] = (cuentaCategorias[categoria] || 0) + 1;
    }
    const categoriasVisibles = {};
    for (const categoria of Object.keys(RELACIONES_CATEGORIAS_PLURAL)) {
      categoriasVisibles[categoria] = true;
    }
    if (cuentaCategorias.Otras) categoriasVisibles.Otras = true;

    const barraRelaciones = el('div', 'grafo-barra grafo-barra-relaciones');
    barraRelaciones.id = 'grafo-panel-relaciones';
    barraRelaciones.hidden = true;
    barraRelaciones.appendChild(el('span', 'grafo-filtro-titulo', 'Relaciones'));
    const leyendaRelaciones = el('div', 'grafo-leyenda');
    const chipsCategoria = [];
    for (const categoria of Object.keys(categoriasVisibles)) {
      const etiqueta = categoria === 'Otras'
        ? 'Otras'
        : (RELACIONES_CATEGORIAS_PLURAL[categoria] || categoria);
      const chip = el('button', 'chip activo', '');
      chip.dataset.categoria = categoria;
      chip.innerHTML = `${etiqueta} <span class="chip-cuenta">${cuentaCategorias[categoria] || 0}</span>`;
      chip.addEventListener('click', () => {
        categoriasVisibles[categoria] = !categoriasVisibles[categoria];
        chip.classList.toggle('activo', categoriasVisibles[categoria]);
        reiniciarFiltro();
        recalentar();
      });
      chipsCategoria.push(chip);
      leyendaRelaciones.appendChild(chip);
    }
    const cajaBuscarRelacion = el('div', 'grafo-buscar grafo-buscar-relacion');
    const iconoRelacion = el('span', 'grafo-buscar-icono');
    iconoRelacion.innerHTML = '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>';
    const inputRelacion = el('input', 'grafo-buscar-entrada');
    inputRelacion.type = 'text';
    inputRelacion.placeholder = 'Buscar tipo de relación…';
    inputRelacion.autocomplete = 'off';
    inputRelacion.setAttribute('role', 'combobox');
    inputRelacion.setAttribute('aria-expanded', 'false');
    inputRelacion.setAttribute('aria-controls', 'grafo-lista-relaciones');
    inputRelacion.setAttribute('aria-label', 'Buscar tipo de relación en el grafo');
    const btnDesplegarRelacion = el('button', 'grafo-buscar-desplegar', '▾');
    btnDesplegarRelacion.type = 'button';
    btnDesplegarRelacion.title = 'Mostrar todos los tipos de relación';
    btnDesplegarRelacion.setAttribute('aria-label', 'Mostrar todos los tipos de relación');
    const panelTiposRelacion = el('div', 'grafo-lista-relaciones');
    panelTiposRelacion.id = 'grafo-lista-relaciones';
    panelTiposRelacion.hidden = true;
    panelTiposRelacion.setAttribute('role', 'listbox');
    panelTiposRelacion.setAttribute('aria-label', 'Tipos de relación');
    const opcionesRelacion = [];
    for (const entrada of RELACIONES_TIPOS) {
      const boton = el('button', 'grafo-opcion-relacion');
      boton.type = 'button';
      boton.setAttribute('role', 'option');
      boton.setAttribute('aria-selected', 'false');
      boton.appendChild(el('span', 'grafo-opcion-nombre', entrada.etiqueta));
      boton.appendChild(el('span', 'grafo-opcion-categoria',
        RELACIONES_CATEGORIAS_PLURAL[entrada.categoria] || entrada.categoria));
      panelTiposRelacion.appendChild(boton);
      const opcion = {
        entrada,
        boton,
        texto: normalizarTextoGrafo(
          `${entrada.etiqueta} ${RELACIONES_CATEGORIAS_PLURAL[entrada.categoria] || entrada.categoria}`
        ),
      };
      boton.addEventListener('click', () => seleccionarOpcionRelacion(opcion));
      opcionesRelacion.push(opcion);
    }
    const mensajeListaVacia = el('div', 'grafo-lista-vacia', 'Sin tipos coincidentes.');
    mensajeListaVacia.hidden = true;
    panelTiposRelacion.appendChild(mensajeListaVacia);
    cajaBuscarRelacion.append(iconoRelacion, inputRelacion, btnDesplegarRelacion, panelTiposRelacion);
    leyendaRelaciones.appendChild(cajaBuscarRelacion);
    let temporizadorRelacion = null;
    let indiceActivoRelacion = -1;
    let cerrarListaTrasSeleccion = false;

    const aplicarBusquedaRelacion = () => {
      filtroRelacion = normalizarTextoGrafo(inputRelacion.value);
      reiniciarFiltro();
      despertar();
    };

    const marcarOpcionActiva = (indice) => {
      indiceActivoRelacion = indice;
      for (const opcion of opcionesRelacion) {
        opcion.boton.classList.remove('activa');
        opcion.boton.setAttribute('aria-selected', 'false');
      }
      const activa = opcionesRelacion[indice];
      if (!activa) return;
      activa.boton.classList.add('activa');
      activa.boton.setAttribute('aria-selected', 'true');
      activa.boton.scrollIntoView?.({ block: 'nearest' });
    };

    const filtrarListaRelaciones = () => {
      const texto = normalizarTextoGrafo(inputRelacion.value);
      let primero = -1;
      opcionesRelacion.forEach((opcion, i) => {
        const coincide = !texto || opcion.texto.includes(texto);
        opcion.boton.hidden = !coincide;
        opcion.boton.classList.remove('activa');
        opcion.boton.setAttribute('aria-selected', 'false');
        if (coincide && primero < 0) primero = i;
      });
      mensajeListaVacia.hidden = primero >= 0;
      indiceActivoRelacion = primero;
      if (!panelTiposRelacion.hidden && primero >= 0) {
        opcionesRelacion[primero].boton.classList.add('activa');
        opcionesRelacion[primero].boton.setAttribute('aria-selected', 'true');
      }
    };

    const mostrarListaRelaciones = () => {
      if (cerrarListaTrasSeleccion) return;
      panelTiposRelacion.hidden = false;
      inputRelacion.setAttribute('aria-expanded', 'true');
      filtrarListaRelaciones();
    };

    const ocultarListaRelaciones = () => {
      panelTiposRelacion.hidden = true;
      inputRelacion.setAttribute('aria-expanded', 'false');
    };

    function seleccionarOpcionRelacion(opcion) {
      inputRelacion.value = opcion.entrada.etiqueta;
      filtroRelacion = normalizarTextoGrafo(opcion.entrada.etiqueta);
      cerrarListaTrasSeleccion = true;
      ocultarListaRelaciones();
      reiniciarFiltro();
      despertar();
      inputRelacion.focus();
      setTimeout(() => { cerrarListaTrasSeleccion = false; }, 0);
    }

    iconoRelacion.addEventListener('click', () => {
      inputRelacion.focus();
      mostrarListaRelaciones();
    });
    btnDesplegarRelacion.addEventListener('click', () => {
      if (panelTiposRelacion.hidden) {
        inputRelacion.focus();
        mostrarListaRelaciones();
      } else {
        ocultarListaRelaciones();
      }
    });
    inputRelacion.addEventListener('focus', mostrarListaRelaciones);
    inputRelacion.addEventListener('click', mostrarListaRelaciones);
    inputRelacion.addEventListener('input', () => {
      mostrarListaRelaciones();
      if (temporizadorRelacion) clearTimeout(temporizadorRelacion);
      temporizadorRelacion = setTimeout(() => {
        temporizadorRelacion = null;
        aplicarBusquedaRelacion();
      }, 150);
    });
    inputRelacion.addEventListener('change', () => {
      if (temporizadorRelacion) {
        clearTimeout(temporizadorRelacion);
        temporizadorRelacion = null;
      }
      aplicarBusquedaRelacion();
    });
    inputRelacion.addEventListener('keydown', (ev) => {
      if (ev.key === 'Escape') {
        ocultarListaRelaciones();
        return;
      }
      if (ev.key === 'ArrowDown' || ev.key === 'ArrowUp') {
        ev.preventDefault();
        if (panelTiposRelacion.hidden) mostrarListaRelaciones();
        const visibles = opcionesRelacion
          .map((opcion, i) => ({ opcion, i }))
          .filter(({ opcion }) => !opcion.boton.hidden);
        if (!visibles.length) return;
        const actual = visibles.findIndex(({ i }) => i === indiceActivoRelacion);
        const siguiente = ev.key === 'ArrowDown'
          ? (actual < 0 ? 0 : (actual + 1) % visibles.length)
          : (actual <= 0 ? visibles.length - 1 : actual - 1);
        marcarOpcionActiva(visibles[siguiente].i);
        return;
      }
      if (ev.key !== 'Enter') return;
      ev.preventDefault();
      if (!panelTiposRelacion.hidden && indiceActivoRelacion >= 0) {
        seleccionarOpcionRelacion(opcionesRelacion[indiceActivoRelacion]);
        return;
      }
      if (temporizadorRelacion) {
        clearTimeout(temporizadorRelacion);
        temporizadorRelacion = null;
      }
      aplicarBusquedaRelacion();
    });
    const cerrarListaRelacionesFuera = (ev) => {
      if (!cajaBuscarRelacion.contains(ev.target)) ocultarListaRelaciones();
    };
    document.addEventListener('mousedown', cerrarListaRelacionesFuera);
    barraRelaciones.appendChild(leyendaRelaciones);
    raiz.appendChild(barraRelaciones);

    /* ---------------- Filtro temporal ---------------- */
    const rangoGlobal = {
      min: datos.rango?.minimo ?? null,
      max: datos.rango?.maximo ?? null,
    };
    let rangoActivo = { min: rangoGlobal.min, max: rangoGlobal.max };
    let refsTiempo = null;

    /** ¿El intervalo [desde, hasta] de una relación solapa con el rango
        activo? Las relaciones sin datación se consideran siempre presentes.
        La temporalidad del grafo procede exclusivamente de RELACIONES. */
    function enRango(desde, hasta) {
      if (rangoGlobal.min == null || rangoGlobal.max == null) return true;
      if (desde == null && hasta == null) return true;
      const d = desde ?? -Infinity;
      const h = hasta ?? Infinity;
      return h >= rangoActivo.min && d <= rangoActivo.max;
    }

    function construirHistogramaTemporal() {
      if (rangoGlobal.min == null || rangoGlobal.max == null) return null;
      const minimo = rangoGlobal.min;
      const maximo = rangoGlobal.max;
      const cantidad = maximo - minimo + 1;
      const delta = new Int32Array(cantidad + 1);
      let sinFecha = 0;
      for (const a of datos.aristas) {
        if (a.anioDesde == null && a.anioHasta == null) {
          sinFecha++;
          continue;
        }
        const desde = a.anioDesde ?? minimo;
        const hasta = a.anioHasta ?? maximo;
        if (hasta < minimo || desde > maximo) continue;
        const d = Math.max(minimo, Math.min(desde, maximo)) - minimo;
        const h = Math.max(minimo, Math.min(hasta, maximo)) - minimo;
        delta[d]++;
        if (h + 1 < cantidad) delta[h + 1]--;
      }
      const conteo = new Int32Array(cantidad);
      let acumulado = 0;
      let mayor = 0;
      for (let i = 0; i < cantidad; i++) {
        acumulado += delta[i];
        conteo[i] = acumulado;
        if (acumulado > mayor) mayor = acumulado;
      }
      return { conteo, mayor, minimo, maximo, sinFecha };
    }

    function categoriaDeArista(a) {
      return categoriaRelacion(a.tipo) || 'Otras';
    }

    function coincideProcedencia(a) {
      if (filtroProcedencia === 'todas') return true;
      const procedencia = String(a.procedencia || 'MANUAL').toUpperCase();
      if (filtroProcedencia === 'manuales') return procedencia === 'MANUAL';
      if (filtroProcedencia === 'editadas') return procedencia === 'MANUAL' || procedencia === 'EDITADA';
      if (filtroProcedencia === 'automatizadas') return procedencia === 'AUTOMATIZADA';
      return true;
    }

    function coincideEntidad(n) {
      if (!filtroEntidad) return true;
      return (n.busqueda || '').includes(filtroEntidad);
    }

    function coincideTipoRelacion(a) {
      if (!filtroRelacion) return true;
      return (a.tipoBusqueda || '').includes(filtroRelacion);
    }

    /** Una arista se dibuja, se cuenta y ejerce fuerzas si su categoría y su
        periodo están activos. La visibilidad de los extremos se resuelve
        después, para poder ocultar también las entidades sin relaciones
        visibles cuando el usuario filtra categorías. */
    function aristaBaseVisible(a) {
      if (!categoriasVisibles[categoriaDeArista(a)]) return false;
      if (!coincideTipoRelacion(a)) return false;
      return enRango(a.anioDesde, a.anioHasta);
    }

    const barraTiempo = el('div', 'grafo-tiempo');
    barraTiempo.id = 'grafo-panel-temporal';
    barraTiempo.hidden = true;
    const btnExcluirSinDatos = el('button', 'btn btn-mini', 'Excluir entidades aisladas');
    btnExcluirSinDatos.type = 'button';
    btnExcluirSinDatos.title = 'Oculta las entidades que no tienen ninguna relación';
    btnExcluirSinDatos.setAttribute('aria-pressed', 'false');
    btnExcluirSinDatos.addEventListener('click', () => {
      excluirSinDatos = !excluirSinDatos;
      btnExcluirSinDatos.classList.toggle('modo-activo', excluirSinDatos);
      btnExcluirSinDatos.setAttribute('aria-pressed', String(excluirSinDatos));
      reiniciarFiltro();
      recalentar();
    });

    if (rangoGlobal.min == null || rangoGlobal.max == null) {
      barraTiempo.appendChild(el('p', 'pista',
        'El proyecto aún no tiene relaciones datadas; el filtro temporal aparecerá cuando existan años en RELACIONES.'));
      const fila = el('div', 'grafo-tiempo-fila');
      const controles = el('div', 'grafo-tiempo-controles');
      controles.appendChild(btnExcluirSinDatos);
      fila.appendChild(controles);
      const contador = el('div', 'contador-grafo', '');
      fila.appendChild(contador);
      barraTiempo.appendChild(fila);
      refsTiempo = { contador };
    } else {
      refsTiempo = construirBarraTiempo(btnExcluirSinDatos);
      barraTiempo.appendChild(refsTiempo.raiz);
      barraTiempo.appendChild(el('p', 'pista',
        'El filtro temporal afecta a las relaciones. Al filtrar categorías o tipos de relación se ocultan también las entidades que quedan sin relaciones visibles.'));
    }
    raiz.appendChild(barraTiempo);

    let panelAbierto = null;
    const panelesFiltros = [
      ['entidades', btnEntidades, panelEntidades],
      ['relaciones', btnRelaciones, barraRelaciones],
      ['temporalidad', btnTemporalidad, barraTiempo],
    ];

    function actualizarPanelesFiltros() {
      for (const [nombre, boton, panel] of panelesFiltros) {
        const abierto = panelAbierto === nombre;
        panel.hidden = !abierto;
        boton.classList.toggle('modo-activo', abierto);
        boton.setAttribute('aria-expanded', String(abierto));
      }
    }

    function alternarPanelFiltros(nombre) {
      const anterior = panelAbierto;
      panelAbierto = anterior === nombre ? null : nombre;
      if (anterior === 'temporalidad' && panelAbierto !== 'temporalidad'
        && refsTiempo && typeof refsTiempo.detener === 'function') {
        refsTiempo.detener();
      }
      if (panelAbierto !== 'relaciones') ocultarListaRelaciones();
      actualizarPanelesFiltros();
    }

    btnEntidades.addEventListener('click', () => alternarPanelFiltros('entidades'));
    btnRelaciones.addEventListener('click', () => alternarPanelFiltros('relaciones'));
    btnTemporalidad.addEventListener('click', () => alternarPanelFiltros('temporalidad'));
    actualizarPanelesFiltros();

    /* Estado permanente: contador, filtros activos y acciones de limpieza. */
    const barraEstado = el('div', 'grafo-estado');
    const contadorGlobal = el('div', 'contador-grafo', '');
    contadorGlobal.setAttribute('aria-live', 'polite');
    const resumenFiltros = el('div', 'grafo-resumen-filtros', 'Sin filtros activos');
    const accionesEstado = el('div', 'grafo-estado-acciones');
    const btnLimpiarFiltros = el('button', 'btn btn-mini', 'Limpiar filtros');
    btnLimpiarFiltros.type = 'button';
    const btnMostrarOcultos = el('button', 'btn btn-mini', 'Mostrar ocultos');
    btnMostrarOcultos.type = 'button';
    btnMostrarOcultos.hidden = true;
    const selProcedenciaGrafo = document.createElement('select');
    selProcedenciaGrafo.className = 'entrada grafo-procedencia-select';
    selProcedenciaGrafo.setAttribute('aria-label', 'Filtrar relaciones por procedencia');
    for (const [valor, etiqueta] of [
      ['todas', 'Toda procedencia'],
      ['manuales', 'Solo manuales'],
      ['editadas', 'Manuales y editadas'],
      ['automatizadas', 'Solo automatizadas'],
    ]) {
      selProcedenciaGrafo.appendChild(new Option(etiqueta, valor));
    }
    selProcedenciaGrafo.value = filtroProcedencia;
    selProcedenciaGrafo.addEventListener('change', () => {
      filtroProcedencia = selProcedenciaGrafo.value;
      reiniciarFiltro();
      recalentar();
    });
    const egoInfo = el('div', 'grafo-ego-info');
    egoInfo.hidden = true;
    const egoTexto = el('span', '', '');
    const btnSalirEgo = el('button', 'btn btn-mini', 'Volver a la red completa');
    btnSalirEgo.type = 'button';
    egoInfo.append(egoTexto, btnSalirEgo);
    accionesEstado.append(selProcedenciaGrafo, btnLimpiarFiltros, btnMostrarOcultos);
    barraEstado.append(contadorGlobal, resumenFiltros, egoInfo, accionesEstado);
    raiz.appendChild(barraEstado);

    function construirBarraTiempo(btnExcluir) {
      const fila = el('div', 'grafo-tiempo-fila');

      const histogramaTemporal = construirHistogramaTemporal();
      const histograma = el('div', 'grafo-histograma');
      const barrasHistograma = [];
      if (histogramaTemporal) {
        histograma.setAttribute('role', 'group');
        histograma.setAttribute('aria-label', 'Relaciones activas por año');
        const maximoHistograma = Math.max(1, histogramaTemporal.mayor);
        /* Un proyecto con un rango histórico amplio (siglos o milenios) no
           debe crear miles de botones: se agrupan los años en como máximo
           240 barras, conservando la información al pasar el cursor. */
        const totalAnios = histogramaTemporal.conteo.length;
        const pasoAnios = Math.max(1, Math.ceil(totalAnios / 240));
        for (let inicioIndice = 0; inicioIndice < totalAnios; inicioIndice += pasoAnios) {
          const finIndice = Math.min(totalAnios - 1, inicioIndice + pasoAnios - 1);
          const inicioAnio = histogramaTemporal.minimo + inicioIndice;
          const finAnio = histogramaTemporal.minimo + finIndice;
          let valor = 0;
          let mayorDelGrupo = 0;
          for (let i = inicioIndice; i <= finIndice; i++) {
            valor += histogramaTemporal.conteo[i];
            if (histogramaTemporal.conteo[i] > mayorDelGrupo) {
              mayorDelGrupo = histogramaTemporal.conteo[i];
            }
          }
          const etiquetaAnios = inicioAnio === finAnio
            ? String(inicioAnio)
            : `${inicioAnio}–${finAnio}`;
          const barra = el('button', 'grafo-histograma-barra');
          barra.type = 'button';
          barra.style.height = `${Math.max(3, (mayorDelGrupo / maximoHistograma) * 100)}%`;
          barra.title = inicioAnio === finAnio
            ? `${etiquetaAnios}: ${valor} relación(es) activa(s)`
            : `${etiquetaAnios}: ${valor} relación(es) activa(s) en total`;
          barra.setAttribute('aria-label', inicioAnio === finAnio
            ? `${etiquetaAnios}: ${valor} relaciones activas`
            : `${etiquetaAnios}: ${valor} relaciones activas en total`);
          barra.addEventListener('click', () => {
            detenerReproduccion();
            const ancho = Math.max(1, Number(selVentana?.value) || 1);
            aplicar(
              inicioAnio,
              Math.min(rangoGlobal.max, Math.max(finAnio, inicioAnio + ancho - 1))
            );
          });
          barrasHistograma.push({ elemento: barra, inicio: inicioAnio, fin: finAnio });
          histograma.appendChild(barra);
        }
        if (histogramaTemporal.sinFecha) {
          histograma.appendChild(el('span', 'grafo-histograma-sin-fecha',
            `${histogramaTemporal.sinFecha} sin fecha`));
        }
      }

      const bloque = el('div', 'rango-bloque');
      const etiquetaDesde = el('span', 'anio-etiqueta izq', String(rangoActivo.min));
      const etiquetaHasta = el('span', 'anio-etiqueta der', String(rangoActivo.max));
      const rango = el('div', 'grafo-rango');
      const pista = el('div', 'grafo-rango-pista');
      const relleno = el('div', 'grafo-rango-relleno');

      const inputMin = document.createElement('input');
      inputMin.type = 'range';
      inputMin.min = String(rangoGlobal.min);
      inputMin.max = String(rangoGlobal.max);
      inputMin.step = '1';
      inputMin.value = String(rangoActivo.min);
      inputMin.className = 'rango-min';
      inputMin.setAttribute('aria-label', 'Año inicial del intervalo');

      const inputMax = document.createElement('input');
      inputMax.type = 'range';
      inputMax.min = String(rangoGlobal.min);
      inputMax.max = String(rangoGlobal.max);
      inputMax.step = '1';
      inputMax.value = String(rangoActivo.max);
      inputMax.className = 'rango-max';
      inputMax.setAttribute('aria-label', 'Año final del intervalo');

      rango.append(pista, relleno, inputMin, inputMax);
      const marcas = el('div', 'grafo-rango-marcas');
      const medio = Math.round((rangoGlobal.min + rangoGlobal.max) / 2);
      for (const valor of [rangoGlobal.min, medio, rangoGlobal.max]) {
        marcas.appendChild(el('span', '', String(valor)));
      }
      bloque.append(histograma, etiquetaDesde, etiquetaHasta, rango, marcas);
      fila.appendChild(bloque);

      const controles = el('div', 'grafo-tiempo-controles');
      controles.appendChild(el('span', '', 'De'));
      const inDe = el('input', 'entrada');
      inDe.type = 'number';
      inDe.min = String(rangoGlobal.min);
      inDe.max = String(rangoGlobal.max);
      inDe.value = String(rangoActivo.min);
      inDe.dataset.campo = 'de';
      inDe.setAttribute('aria-label', 'Año desde');
      controles.appendChild(inDe);
      controles.appendChild(el('span', '', 'a'));
      const inA = el('input', 'entrada');
      inA.type = 'number';
      inA.min = String(rangoGlobal.min);
      inA.max = String(rangoGlobal.max);
      inA.value = String(rangoActivo.max);
      inA.dataset.campo = 'a';
      inA.setAttribute('aria-label', 'Año hasta');
      controles.appendChild(inA);
      const btnAfinar = el('button', 'btn btn-primario btn-mini', 'Afinar intervalo');
      controles.appendChild(btnAfinar);
      const btnReproducir = el('button', 'btn btn-mini', 'Reproducir');
      btnReproducir.type = 'button';
      btnReproducir.title = 'Reproducir el periodo con una ventana móvil';
      controles.appendChild(btnReproducir);
      const selVentana = document.createElement('select');
      selVentana.className = 'entrada grafo-ventana-select';
      selVentana.setAttribute('aria-label', 'Años por paso de reproducción');
      for (const valor of [1, 5, 10, 25, 50]) {
        selVentana.appendChild(new Option(`${valor} año${valor === 1 ? '' : 's'}`, String(valor)));
      }
      selVentana.value = '10';
      controles.appendChild(selVentana);
      const selVelocidad = document.createElement('select');
      selVelocidad.className = 'entrada grafo-velocidad-select';
      selVelocidad.setAttribute('aria-label', 'Velocidad de reproducción');
      selVelocidad.appendChild(new Option('Lenta', '220'));
      selVelocidad.appendChild(new Option('Normal', '120'));
      selVelocidad.appendChild(new Option('Rápida', '60'));
      selVelocidad.value = '120';
      controles.appendChild(selVelocidad);
      controles.appendChild(btnExcluir);
      fila.appendChild(controles);

      const contador = el('div', 'contador-grafo', '');
      fila.appendChild(contador);

      let reproduciendo = false;
      function pintarHistograma() {
        for (const barra of barrasHistograma) {
          const activa = barra.fin >= rangoActivo.min && barra.inicio <= rangoActivo.max;
          barra.elemento.classList.toggle('activo', activa);
        }
      }

      function detenerReproduccion() {
        if (!reproduciendo) return;
        reproduciendo = false;
        if (temporizadorReproduccion) {
          clearInterval(temporizadorReproduccion);
          temporizadorReproduccion = null;
        }
        btnReproducir.textContent = 'Reproducir';
        btnReproducir.classList.remove('modo-activo');
      }

      function pasoReproduccion() {
        if (!reproduciendo || rangoGlobal.min == null || rangoGlobal.max == null) return;
        const ancho = Math.max(1, Number(selVentana.value) || 1);
        const inicio = rangoActivo.min;
        const fin = Math.min(rangoGlobal.max, inicio + ancho - 1);
        aplicar(inicio, fin);
        if (fin >= rangoGlobal.max) {
          detenerReproduccion();
          return;
        }
        rangoActivo = {
          min: inicio + 1,
          max: Math.min(rangoGlobal.max, inicio + ancho),
        };
        pintarPista();
      }

      function iniciarReproduccion() {
        if (rangoGlobal.min == null || rangoGlobal.max == null) return;
        if (reproduciendo) {
          detenerReproduccion();
          return;
        }
        if (rangoActivo.min >= rangoGlobal.max) {
          rangoActivo = { min: rangoGlobal.min, max: rangoGlobal.min };
          pintarPista();
        }
        reproduciendo = true;
        btnReproducir.textContent = 'Pausar';
        btnReproducir.classList.add('modo-activo');
        pasoReproduccion();
        if (!reproduciendo) return;
        temporizadorReproduccion = setInterval(
          pasoReproduccion,
          Math.max(40, Number(selVelocidad.value) || 120)
        );
      }

      const pintarPista = () => {
        const amplitud = Math.max(1, rangoGlobal.max - rangoGlobal.min);
        const izq = ((rangoActivo.min - rangoGlobal.min) / amplitud) * 100;
        const der = ((rangoActivo.max - rangoGlobal.min) / amplitud) * 100;
        relleno.style.left = `${izq}%`;
        relleno.style.width = `${Math.max(0, der - izq)}%`;
        etiquetaDesde.textContent = String(rangoActivo.min);
        etiquetaHasta.textContent = String(rangoActivo.max);
        inputMin.value = String(rangoActivo.min);
        inputMax.value = String(rangoActivo.max);
        inDe.value = String(rangoActivo.min);
        inA.value = String(rangoActivo.max);
        pintarHistograma();
      };

      const aplicar = (desde, hasta) => {
        let d = Math.round(Number(desde));
        let h = Math.round(Number(hasta));
        if (!Number.isFinite(d)) d = rangoGlobal.min;
        if (!Number.isFinite(h)) h = rangoGlobal.max;
        d = Math.max(rangoGlobal.min, Math.min(d, rangoGlobal.max));
        h = Math.max(rangoGlobal.min, Math.min(h, rangoGlobal.max));
        if (d > h) [d, h] = [h, d];
        rangoActivo = { min: d, max: h };
        pintarPista();
        reiniciarFiltro();
      };

      let aplicarPendiente = false;
      let argumentosPendientes = null;
      const programarAplicar = (desde, hasta) => {
        argumentosPendientes = [desde, hasta];
        if (aplicarPendiente) return;
        aplicarPendiente = true;
        requestAnimationFrame(() => {
          aplicarPendiente = false;
          const [d, h] = argumentosPendientes;
          aplicar(d, h);
        });
      };
      inputMin.addEventListener('input', () => {
        detenerReproduccion();
        programarAplicar(inputMin.value, rangoActivo.max);
      });
      inputMax.addEventListener('input', () => {
        detenerReproduccion();
        programarAplicar(rangoActivo.min, inputMax.value);
      });
      btnAfinar.addEventListener('click', () => {
        detenerReproduccion();
        aplicar(inDe.value, inA.value);
      });
      for (const campo of [inDe, inA]) {
        campo.addEventListener('keydown', (ev) => {
          if (ev.key === 'Enter') {
            detenerReproduccion();
            aplicar(inDe.value, inA.value);
          }
        });
      }
      btnReproducir.addEventListener('click', iniciarReproduccion);
      selVentana.addEventListener('change', () => {
        if (reproduciendo) {
          detenerReproduccion();
          iniciarReproduccion();
        }
      });
      selVelocidad.addEventListener('change', () => {
        if (reproduciendo) {
          detenerReproduccion();
          iniciarReproduccion();
        }
      });

      pintarPista();
      return {
        raiz: fila,
        contador,
        aplicar: (desde, hasta) => aplicar(desde, hasta),
        detener: detenerReproduccion,
        reiniciar: () => {
          detenerReproduccion();
          rangoActivo = { min: rangoGlobal.min, max: rangoGlobal.max };
          pintarPista();
        },
      };
    }

    /* Lienzo + panel de información */
    const escena = el('div', 'grafo-escena');
    const canvas = el('canvas', 'grafo-canvas');
    canvas.style.touchAction = 'none';
    canvas.tabIndex = 0;
    canvas.setAttribute('role', 'img');
    canvas.setAttribute('aria-label', 'Grafo de relaciones históricas del proyecto');
    const tooltipArista = el('div', 'grafo-tooltip-arista');
    tooltipArista.hidden = true;
    const panel = el('div', 'grafo-info oculto');
    escena.append(canvas, tooltipArista, panel);
    raiz.appendChild(escena);
    cont.appendChild(raiz);

    const ctx = canvas.getContext('2d');
    const cacheAnchurasEtiqueta = new Map();

    /* Colores derivados del tema activo (claro/oscuro) */
    let coloresTema = {};
    function leerColoresTema() {
      const estilos = getComputedStyle(document.documentElement);
      const leer = (nombre, respaldo) => estilos.getPropertyValue(nombre).trim() || respaldo;
      coloresTema = {
        etiqueta: leer('--grafo-etiqueta', 'rgba(226,222,208,0.92)'),
        arista: leer('--grafo-arista', 'rgba(140,146,166,0.28)'),
        aristaActiva: leer('--grafo-arista-activa', 'rgba(227,195,90,0.8)'),
        contorno: leer('--grafo-contorno', 'rgba(16,18,22,0.9)'),
      };
    }
    leerColoresTema();
    const alCambiarTema = () => { leerColoresTema(); despertar(); };
    const reducirMovimiento = typeof window.matchMedia === 'function'
      && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    /* ---------------- Estado ---------------- */
    const mundo = new Map(); // id -> nodo físico
    let aristas = [];
    let aristasVisibles = [];
    let aristasVisuales = [];
    let escala = 1;
    let panX = 0, panY = 0;
    let arrastre = null; // {tipo:'nodo'|'pano', ...}
    let suprimirClick = false;
    let seleccion = null;
    let seleccionFijada = null;
    let resaltado = null;

    function actualizarBotonExportarSeleccion() {
      btnExportarSeleccion.disabled = !seleccion;
      btnExportarSeleccion.title = seleccion
        ? `Exportar PNG de «${seleccion.etiqueta}» y sus conexiones`
        : 'Selecciona un nodo para exportar su nodo y conexiones';
    }
    let ancho = 0, alto = 0;
    let rafId = null;
    let cancelado = false;
    let observador = null;
    let vecinosSeleccion = new Set();
    let vecinosDe = null;
    let nodosVisibles = [];
    let indiceEspacial = new Map();
    let indiceEspacialValido = false;
    let alpha = 1;
    let alphaTarget = 0;
    let necesitaAjuste = true;
    let vistaManual = false;
    let animacionVista = null;
    const CELDA_ESPACIAL = 64;
    const THETA_BARNES_HUT = 0.85;
    const ALPHA_MIN = 0.004;
    const ALPHA_DECAY = 0.0228;
    const VELOCIDAD_MAX = 11;

    function claveVinculo(a) {
      const origen = String(a.origen);
      const destino = String(a.destino);
      return origen < destino ? `${origen}|${destino}` : `${destino}|${origen}`;
    }

    function esGrupoArista(a) {
      return Boolean(a && Array.isArray(a.aristas) && Number.isFinite(a.cantidad));
    }

    function relacionBidireccional(tipo) {
      return typeof window.esRelacionBidireccional === 'function'
        ? window.esRelacionBidireccional(tipo)
        : false;
    }

    /* Convierte las relaciones individuales en vínculos visuales. Cada par de
       entidades se dibuja una sola vez; el detalle queda en el panel. */
    function agruparAristas(lista) {
      const grupos = new Map();
      for (const a of lista || []) {
        const clave = claveVinculo(a);
        let grupo = grupos.get(clave);
        if (!grupo) {
          const origen = String(a.origen);
          const destino = String(a.destino);
          grupo = {
            id: `vinculo:${clave}`,
            clave,
            esGrupo: true,
            origen: origen < destino ? origen : destino,
            destino: origen < destino ? destino : origen,
            aristas: [],
            cantidad: 0,
            ida: 0,
            vuelta: 0,
            bidireccional: false,
            tipos: new Map(),
            procedencias: new Map(),
            fuentes: new Map(),
            fechas: new Set(),
            anioDesde: null,
            anioHasta: null,
            curvaOffset: 0,
          };
          grupos.set(clave, grupo);
        }
        grupo.aristas.push(a);
        grupo.cantidad++;
        if (relacionBidireccional(a.tipo)) grupo.bidireccional = true;
        if (String(a.origen) === grupo.origen && String(a.destino) === grupo.destino) grupo.ida++;
        else grupo.vuelta++;
        const tipo = a.tipo || 'Relación';
        grupo.tipos.set(tipo, (grupo.tipos.get(tipo) || 0) + 1);
        const procedencia = String(a.procedencia || 'MANUAL').toUpperCase();
        grupo.procedencias.set(procedencia, (grupo.procedencias.get(procedencia) || 0) + 1);
        if (a.fecha) grupo.fechas.add(String(a.fecha));
        for (const valor of [a.anioDesde, a.anioHasta]) {
          if (valor == null || !Number.isFinite(Number(valor))) continue;
          const anio = Number(valor);
          if (grupo.anioDesde == null || anio < grupo.anioDesde) grupo.anioDesde = anio;
          if (grupo.anioHasta == null || anio > grupo.anioHasta) grupo.anioHasta = anio;
        }
        for (const fuente of a.fuentes || []) {
          if (!fuente) continue;
          const claveFuente = fuente.id != null ? `id:${fuente.id}` : `titulo:${fuente.titulo || ''}`;
          if (claveFuente === 'titulo:') continue;
          if (!grupo.fuentes.has(claveFuente)) {
            grupo.fuentes.set(claveFuente, { id: fuente.id, titulo: fuente.titulo || '' });
          }
        }
      }
      for (const grupo of grupos.values()) {
        let tipoDominante = '';
        let maximo = -1;
        for (const [tipo, cuenta] of grupo.tipos) {
          if (cuenta > maximo) {
            tipoDominante = tipo;
            maximo = cuenta;
          }
        }
        grupo.tipo = tipoDominante || 'Relación';
        const procedencias = [...grupo.procedencias.keys()];
        grupo.procedencia = procedencias.length === 1 ? procedencias[0] : 'MIXTA';
        grupo.soloAutomatizadas = procedencias.length === 1 && procedencias[0] === 'AUTOMATIZADA';
        grupo.soloBidireccional = grupo.aristas.every((arista) => relacionBidireccional(arista.tipo));
        grupo.fuentes = [...grupo.fuentes.values()];
        grupo.fechas = [...grupo.fechas];
      }
      return [...grupos.values()];
    }

    function contarVinculos(lista) {
      return new Set((lista || []).map(claveVinculo)).size;
    }

    function recalcularAristas() {
      const base = aristas.filter((a) => {
        const o = mundo.get(a.origen), d = mundo.get(a.destino);
        return o && d && visibles[o.tipo] && visibles[d.tipo] && aristaBaseVisible(a) && coincideProcedencia(a);
      });
      const hayFiltroRelaciones = Object.values(categoriasVisibles).some((visible) => !visible)
        || Boolean(filtroRelacion);
      const conRelacion = new Set();
      for (const a of base) {
        conRelacion.add(a.origen);
        conRelacion.add(a.destino);
      }
      let egoPermitidos = null;
      if (focoEgo && mundo.has(focoEgo.id)) {
        const adyacenciaEgo = new Map();
        for (const a of base) {
          if (!adyacenciaEgo.has(a.origen)) adyacenciaEgo.set(a.origen, []);
          if (!adyacenciaEgo.has(a.destino)) adyacenciaEgo.set(a.destino, []);
          adyacenciaEgo.get(a.origen).push(a.destino);
          adyacenciaEgo.get(a.destino).push(a.origen);
        }
        egoPermitidos = new Set([focoEgo.id]);
        let frontera = [focoEgo.id];
        for (let salto = 0; salto < focoEgo.saltos && frontera.length; salto++) {
          const siguiente = [];
          for (const id of frontera) {
            for (const vecino of adyacenciaEgo.get(id) || []) {
              if (egoPermitidos.has(vecino)) continue;
              egoPermitidos.add(vecino);
              siguiente.push(vecino);
            }
          }
          frontera = siguiente;
        }
      }
      for (const n of mundo.values()) {
        n.oculto = !visibles[n.tipo]
          || (hayFiltroRelaciones && !conRelacion.has(n.id))
          || (excluirSinDatos && !n.gradoTotal)
          || (Boolean(filtroEntidad) && !coincideEntidad(n))
          || nodosOcultos.has(n.id)
          || (egoPermitidos != null && !egoPermitidos.has(n.id));
        n.grado = 0;
      }
      aristasVisibles = base.filter((a) => {
        const o = mundo.get(a.origen), d = mundo.get(a.destino);
        return o && d && !o.oculto && !d.oculto;
      });
      if (seleccionArista && !esGrupoArista(seleccionArista) && !aristasVisibles.includes(seleccionArista)) {
        seleccionArista = null;
        if (panelAristaActual) ocultarInfo();
      }
      for (const a of aristasVisibles) {
        const o = mundo.get(a.origen), d = mundo.get(a.destino);
        o.grado++; d.grado++;
      }
      aristasVisuales = [];
      for (const grupo of agruparAristas(aristasVisibles)) {
        if (grupo.cantidad > 1 && paresDesagregados.has(grupo.clave)) {
          aristasVisuales.push(...grupo.aristas);
        } else {
          aristasVisuales.push(grupo);
        }
      }
      if (seleccionArista && esGrupoArista(seleccionArista)) {
        const vigente = aristasVisuales.find(
          (a) => esGrupoArista(a) && a.clave === seleccionArista.clave
        );
        if (vigente) {
          seleccionArista = vigente;
        } else {
          seleccionArista = null;
          if (panelAristaActual) ocultarInfo();
        }
      }
      nodosVisibles = [...mundo.values()].filter((n) => !n.oculto);
      indiceEspacialValido = false;
      vecinosSeleccion = new Set();
      vecinosDe = seleccion ? seleccion.id : null;
      if (seleccion) {
        for (const a of aristasVisibles) {
          if (a.origen === seleccion.id) vecinosSeleccion.add(a.destino);
          else if (a.destino === seleccion.id) vecinosSeleccion.add(a.origen);
        }
      }
    }

    function preparar(reiniciar = false) {
      const idSeleccion = seleccion ? seleccion.id : null;
      const idsActuales = datos.nodos.map((n) => n.id).sort().join('|');
      const guardada = reiniciar ? null : vistasGrafo.get(proyecto.id);
      const posiciones = guardada ? guardada.posiciones : null;
      const reutilizar = Boolean(guardada && guardada.ids === idsActuales);
      mundo.clear();
      datos.nodos.forEach((nd, i) => {
        const posicion = posiciones?.get(nd.id);
        const angulo = i * 2.399963229728653;
        const radio = 34 + 19 * Math.sqrt(i + 1);
        mundo.set(nd.id, {
          ...nd,
          x: posicion ? posicion.x : Math.cos(angulo) * radio,
          y: posicion ? posicion.y : Math.sin(angulo) * radio,
          vx: 0, vy: 0,
          grado: 0,
          gradoTotal: 0,
          busqueda: normalizarTextoGrafo(
            `${nd.tipo} ${NOMBRE_TIPO[nd.tipo] || ''} ${nd.etiqueta || ''} ${nd.nombre || ''} ${nd.apellidos || ''} ${nd.identificador || ''} ${nd.genero || ''} ${nd.tipoEntidad || ''} ${nd.notas || ''}`
          ),
        });
      });
      animacionVista = null;
      alpha = reutilizar ? 0 : (posiciones ? 0.4 : 1);
      alphaTarget = 0;
      necesitaAjuste = !reutilizar;
      vistaManual = false;
      aristas = datos.aristas
        .filter((a) => mundo.has(a.origen) && mundo.has(a.destino))
        .map((a) => ({ ...a, tipoBusqueda: normalizarTextoGrafo(a.tipo), curvaOffset: 0 }));
      const gruposAristas = new Map();
      for (const a of aristas) {
        const clave = a.origen < a.destino ? `${a.origen}|${a.destino}` : `${a.destino}|${a.origen}`;
        if (!gruposAristas.has(clave)) gruposAristas.set(clave, []);
        gruposAristas.get(clave).push(a);
      }
      for (const grupo of gruposAristas.values()) {
        grupo.sort((a, b) => Number(a.id) - Number(b.id));
        const centro = (grupo.length - 1) / 2;
        /* Muchas relaciones entre la misma pareja (los datos importados pueden
           tener decenas) no deben generar un abanico de curvas gigante: se
           reparte un ancho máximo y se evita que las curvas se salgan del
           encuadre de la vista o de la exportación. */
        const separacion = Math.min(18, 240 / Math.max(1, grupo.length - 1));
        for (let i = 0; i < grupo.length; i++) {
          grupo[i].curvaOffset = (i - centro) * separacion;
        }
      }
      for (const a of aristas) {
        const o = mundo.get(a.origen), d = mundo.get(a.destino);
        o.gradoTotal++; d.gradoTotal++;
        o.grado++; d.grado++;
      }
      recalcularAristas();
      seleccionArista = null;
      panelAristaActual = false;
      seleccion = idSeleccion ? mundo.get(idSeleccion) || null : null;
      if (seleccion) mostrarInfo(seleccion);
      else ocultarInfo();
      actualizarBotonExportarSeleccion();
      if (reutilizar && guardada?.vista) {
        escala = guardada.vista.escala;
        panX = guardada.vista.panX;
        panY = guardada.vista.panY;
      } else {
        centrarVista();
      }
    }

    function centrarVista() {
      escala = 1;
      panX = ancho / 2;
      panY = alto / 2;
    }

    function enfocarNodo(n) {
      if (!n) return;
      seleccion = n;
      seleccionArista = null;
      panelAristaActual = false;
      recalcularAristas();
      mostrarInfo(n);
      actualizarBotonExportarSeleccion();
      vistaManual = true;
      necesitaAjuste = false;
      escala = 1;
      if (ancho && alto) {
        panX = ancho / 2 - n.x * escala;
        panY = alto / 2 - n.y * escala;
      }
      seleccionFijada = n;
      recalentar();
      despertar();
    }

    function ajustarVista({ animar = true } = {}) {
      if (!nodosVisibles.length || !ancho || !alto) return;
      let minX = Infinity;
      let minY = Infinity;
      let maxX = -Infinity;
      let maxY = -Infinity;
      for (const n of nodosVisibles) {
        if (n.x < minX) minX = n.x;
        if (n.y < minY) minY = n.y;
        if (n.x > maxX) maxX = n.x;
        if (n.y > maxY) maxY = n.y;
      }
      const margen = 90;
      const anchoMundo = Math.max(maxX - minX, 1);
      const altoMundo = Math.max(maxY - minY, 1);
      const escalaX = Math.max(80, ancho - margen * 2) / anchoMundo;
      const escalaY = Math.max(80, alto - margen * 2) / altoMundo;
      const destino = {
        escala: Math.min(2.4, Math.max(0.2, Math.min(escalaX, escalaY))),
      };
      destino.panX = ancho / 2 - ((minX + maxX) / 2) * destino.escala;
      destino.panY = alto / 2 - ((minY + maxY) / 2) * destino.escala;
      const cambio = Math.abs(destino.escala - escala) > 0.001
        || Math.abs(destino.panX - panX) > 0.5
        || Math.abs(destino.panY - panY) > 0.5;
      if (animar && !reducirMovimiento && cambio) {
        animacionVista = {
          inicio: performance.now(),
          duracion: 620,
          desde: { escala, panX, panY },
          hasta: destino,
        };
        despertar();
        return;
      }
      escala = destino.escala;
      panX = destino.panX;
      panY = destino.panY;
    }

    function actualizarAnimacionVista(ahora) {
      if (!animacionVista) return;
      const progreso = Math.min(1, (ahora - animacionVista.inicio) / animacionVista.duracion);
      const suave = 1 - Math.pow(1 - progreso, 3);
      escala = animacionVista.desde.escala
        + (animacionVista.hasta.escala - animacionVista.desde.escala) * suave;
      panX = animacionVista.desde.panX
        + (animacionVista.hasta.panX - animacionVista.desde.panX) * suave;
      panY = animacionVista.desde.panY
        + (animacionVista.hasta.panY - animacionVista.desde.panY) * suave;
      if (progreso >= 1) animacionVista = null;
    }

    /** Despierta el bucle de dibujo tras una interacción o un cambio. */
    function despertar() {
      if (!cancelado && rafId == null) rafId = requestAnimationFrame(bucle);
    }

    /** Reinicia suavemente la simulación sin sacudir los nodos. */
    function recalentar() {
      alpha = Math.max(alpha, 0.55);
      alphaTarget = 0;
    }

    function reiniciarFiltro() {
      recalcularAristas();
      if (seleccion && seleccion.oculto) {
        seleccion = null;
        seleccionFijada = null;
        ocultarInfo();
      } else if (seleccion) {
        mostrarInfo(seleccion);
      } else if (seleccionArista && panelAristaActual) {
        if (esGrupoArista(seleccionArista) && seleccionArista.cantidad > 1) {
          mostrarInfoAristaGrupo(seleccionArista);
        } else {
          mostrarInfoArista(esGrupoArista(seleccionArista)
            ? seleccionArista.aristas[0]
            : seleccionArista);
        }
      }
      actualizarBotonExportarSeleccion();
      actualizarContador();
      if (analisisRSH && typeof analisisRSH.alCambiarFiltros === 'function') {
        analisisRSH.alCambiarFiltros();
      }
      despertar();
    }

    function actualizarContador() {
      const totalNodos = mundo.size;
      const totalAristas = aristas.length;
      const visiblesAristas = aristasVisibles.length;
      const vinculos = contarVinculos(aristasVisibles);
      const texto =
        `Mostrando ${nodosVisibles.length} de ${totalNodos} entidades · ` +
        `${visiblesAristas} de ${totalAristas} relaciones visibles · ` +
        `${vinculos} vínculo${vinculos === 1 ? '' : 's'} dibujado${vinculos === 1 ? '' : 's'}`;
      contadorGlobal.textContent = texto;
      if (refsTiempo && refsTiempo.contador) refsTiempo.contador.textContent = texto;
      actualizarResumenFiltros();
    }

    function actualizarResumenFiltros() {
      if (!resumenFiltros) return;
      const partes = [];
      const tiposOcultos = Object.keys(visibles)
        .filter((tipo) => !visibles[tipo])
        .map((tipo) => NOMBRE_TIPO[tipo] || tipo);
      if (tiposOcultos.length) partes.push(`Tipos ocultos: ${tiposOcultos.join(', ')}`);
      if (filtroEntidad) partes.push(`Entidad: «${inputEntidad.value.trim()}»`);
      const categoriasOcultas = Object.keys(categoriasVisibles).filter((categoria) => !categoriasVisibles[categoria]);
      if (categoriasOcultas.length) {
        partes.push(`Categorías ocultas: ${categoriasOcultas.map((c) => RELACIONES_CATEGORIAS_PLURAL[c] || c).join(', ')}`);
      }
      if (filtroRelacion) partes.push(`Relación: «${inputRelacion.value.trim()}»`);
      if (filtroProcedencia !== 'todas') {
        const etiquetas = {
          manuales: 'solo manuales',
          editadas: 'manuales y editadas',
          automatizadas: 'solo automatizadas',
        };
        partes.push(`Procedencia: ${etiquetas[filtroProcedencia] || filtroProcedencia}`);
      }
      if (rangoGlobal.min != null && rangoGlobal.max != null
        && (rangoActivo.min !== rangoGlobal.min || rangoActivo.max !== rangoGlobal.max)) {
        partes.push(`Periodo: ${rangoActivo.min}–${rangoActivo.max}`);
      }
      if (excluirSinDatos) partes.push('Entidades aisladas excluidas');
      if (focoEgo) partes.push(`Vecindad de ${focoEgo.etiqueta} (${focoEgo.saltos} salto${focoEgo.saltos === 1 ? '' : 's'})`);
      if (nodosOcultos.size) partes.push(`${nodosOcultos.size} nodo(s) oculto(s)`);
      resumenFiltros.textContent = partes.length ? partes.join(' · ') : 'Sin filtros activos';
      resumenFiltros.title = resumenFiltros.textContent;
      btnMostrarOcultos.hidden = nodosOcultos.size === 0;
      btnMostrarOcultos.textContent = `Mostrar ocultos (${nodosOcultos.size})`;
      egoInfo.hidden = !focoEgo;
      if (focoEgo) {
        egoTexto.textContent = `Viendo la vecindad de ${focoEgo.etiqueta} (${focoEgo.saltos} salto${focoEgo.saltos === 1 ? '' : 's'}).`;
      }
    }

    function restablecerFiltrosVisuales() {
      for (const tipo of Object.keys(visibles)) {
        visibles[tipo] = true;
        const chip = chipsEntidad.find((c) => c.dataset.tipo === tipo);
        if (chip) chip.classList.add('activo');
      }
      for (const categoria of Object.keys(categoriasVisibles)) {
        categoriasVisibles[categoria] = true;
        const chip = chipsCategoria.find((c) => c.dataset.categoria === categoria);
        if (chip) chip.classList.add('activo');
      }
      filtroEntidad = '';
      inputEntidad.value = '';
      filtroRelacion = '';
      inputRelacion.value = '';
      if (temporizadorEntidad) { clearTimeout(temporizadorEntidad); temporizadorEntidad = null; }
      if (temporizadorRelacion) { clearTimeout(temporizadorRelacion); temporizadorRelacion = null; }
      excluirSinDatos = false;
      btnExcluirSinDatos.classList.remove('modo-activo');
      btnExcluirSinDatos.setAttribute('aria-pressed', 'false');
      filtroProcedencia = 'todas';
      selProcedenciaGrafo.value = 'todas';
      nodosOcultos.clear();
      focoEgo = null;
      if (refsTiempo && typeof refsTiempo.reiniciar === 'function') refsTiempo.reiniciar();
      reiniciarFiltro();
      recalentar();
    }

    function redVisibleParaAnalisis() {
      return {
        nodos: nodosVisibles.map((nodo) => ({
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
        aristas: aristasVisibles.map((arista) => ({
          id: arista.id,
          origen: arista.origen,
          destino: arista.destino,
          tipo: arista.tipo,
          categoria: categoriaDeArista(arista),
          procedencia: arista.procedencia || 'MANUAL',
          anioDesde: arista.anioDesde,
          anioHasta: arista.anioHasta,
          fecha: arista.fecha || '',
        })),
      };
    }

    function mostrarNodoDesdeAnalisis(id) {
      const nodo = mundo.get(id);
      if (!nodo) return;
      if (nodo.oculto) {
        restablecerFiltrosVisuales();
        const actualizado = mundo.get(id);
        if (actualizado) enfocarNodo(actualizado);
        aviso('Se restablecieron los filtros visuales para mostrar la entidad.', 'info');
        return;
      }
      enfocarNodo(nodo);
    }

    let dimensionesIniciales = false;
    let redimensionPendiente = false;
    function aplicarDimensiones() {
      const rect = escena.getBoundingClientRect();
      ancho = rect.width; alto = rect.height;
      const dpr = window.devicePixelRatio || 1;
      canvas.width = ancho * dpr;
      canvas.height = alto * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (!vistaManual) necesitaAjuste = true;
      despertar();
    }
    function redimensionar() {
      if (!dimensionesIniciales) {
        dimensionesIniciales = true;
        aplicarDimensiones();
        return;
      }
      if (redimensionPendiente) return;
      redimensionPendiente = true;
      requestAnimationFrame(() => {
        redimensionPendiente = false;
        aplicarDimensiones();
      });
    }

    /* ---------------- Física ---------------- */

    function crearQuad(nodos, x0, y0, size, profundidad) {
      let sumaX = 0;
      let sumaY = 0;
      for (const n of nodos) { sumaX += n.x; sumaY += n.y; }
      const quad = {
        x0, y0, size,
        mass: nodos.length,
        sumX: sumaX,
        sumY: sumaY,
        hijos: null,
        nodos: null,
      };
      if (nodos.length <= 1 || profundidad >= 18) {
        quad.nodos = nodos;
        return quad;
      }
      const mitad = size / 2;
      const cubos = [[], [], [], []];
      for (const n of nodos) {
        const ix = n.x < x0 + mitad ? 0 : 1;
        const iy = n.y < y0 + mitad ? 0 : 1;
        cubos[ix + iy * 2].push(n);
      }
      quad.hijos = cubos.map((lista, i) => (
        lista.length
          ? crearQuad(
            lista,
            x0 + (i % 2) * mitad,
            y0 + Math.floor(i / 2) * mitad,
            mitad,
            profundidad + 1
          )
          : null
      ));
      return quad;
    }

    function construirQuadTree(nodos) {
      if (!nodos.length) return null;
      let minX = Infinity;
      let minY = Infinity;
      let maxX = -Infinity;
      let maxY = -Infinity;
      for (const n of nodos) {
        if (n.x < minX) minX = n.x;
        if (n.y < minY) minY = n.y;
        if (n.x > maxX) maxX = n.x;
        if (n.y > maxY) maxY = n.y;
      }
      return crearQuad(nodos, minX, minY, Math.max(maxX - minX, maxY - minY, 1) + 1, 0);
    }

    function aplicarRepulsion(nodo, quad, kRep) {
      if (!quad || quad.mass === 0) return;
      if (quad.hijos === null) {
        for (const otro of quad.nodos) {
          if (otro === nodo) continue;
          let dx = otro.x - nodo.x;
          let dy = otro.y - nodo.y;
          let d2 = dx * dx + dy * dy;
          if (d2 < 1) { dx = Math.random() - 0.5; dy = Math.random() - 0.5; d2 = 1; }
          const d = Math.sqrt(d2);
          const f = kRep / d2;
          nodo.vx -= (dx / d) * f;
          nodo.vy -= (dy / d) * f;
        }
        return;
      }
      const dentro = nodo.x >= quad.x0 && nodo.x < quad.x0 + quad.size
        && nodo.y >= quad.y0 && nodo.y < quad.y0 + quad.size;
      const masa = quad.mass - (dentro ? 1 : 0);
      if (masa <= 0) return;
      const centroX = (quad.sumX - (dentro ? nodo.x : 0)) / masa;
      const centroY = (quad.sumY - (dentro ? nodo.y : 0)) / masa;
      let dx = centroX - nodo.x;
      let dy = centroY - nodo.y;
      let d2 = dx * dx + dy * dy;
      if (d2 < 1) { dx = Math.random() - 0.5; dy = Math.random() - 0.5; d2 = 1; }
      const d = Math.sqrt(d2);
      if ((quad.size / d) < THETA_BARNES_HUT) {
        const f = (kRep * masa) / d2;
        nodo.vx -= (dx / d) * f;
        nodo.vy -= (dy / d) * f;
        return;
      }
      for (const hijo of quad.hijos) {
        if (hijo) aplicarRepulsion(nodo, hijo, kRep);
      }
    }

    function tick() {
      const nodos = nodosVisibles;
      const K_REP = 2600, K_MUELLE = 0.03, LONGITUD = 120, K_GRAV = 0.015;
      const fuerza = alpha;

      if (nodos.length <= 120) {
        for (let i = 0; i < nodos.length; i++) {
          const a = nodos[i];
          for (let j = i + 1; j < nodos.length; j++) {
            const b = nodos[j];
            let dx = b.x - a.x, dy = b.y - a.y;
            let d2 = dx * dx + dy * dy;
            if (d2 < 1) { dx = Math.random() - 0.5; dy = Math.random() - 0.5; d2 = 1; }
            const f = (K_REP * fuerza) / d2;
            const d = Math.sqrt(d2);
            const fx = (dx / d) * f, fy = (dy / d) * f;
            a.vx -= fx; a.vy -= fy;
            b.vx += fx; b.vy += fy;
          }
        }
      } else {
        const raiz = construirQuadTree(nodos);
        for (const n of nodos) aplicarRepulsion(n, raiz, K_REP * fuerza);
      }

      let energia = 0;
      for (const a of aristasVisibles) {
        const o = mundo.get(a.origen), d = mundo.get(a.destino);
        const dx = d.x - o.x, dy = d.y - o.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const f = (dist - LONGITUD) * K_MUELLE * fuerza;
        const fx = (dx / dist) * f, fy = (dy / dist) * f;
        o.vx += fx; o.vy += fy;
        d.vx -= fx; d.vy -= fy;
      }

      for (const n of nodos) {
        n.vx += -n.x * K_GRAV * fuerza;
        n.vy += -n.y * K_GRAV * fuerza;
        if ((arrastre && arrastre.tipo === 'nodo' && arrastre.nodo === n) || seleccionFijada === n || nodosFijados.has(n.id)) {
          n.vx = 0;
          n.vy = 0;
          continue;
        }
        n.vx *= 0.87;
        n.vy *= 0.87;
        n.x += Math.max(-VELOCIDAD_MAX, Math.min(VELOCIDAD_MAX, n.vx));
        n.y += Math.max(-VELOCIDAD_MAX, Math.min(VELOCIDAD_MAX, n.vy));
        energia = Math.max(energia, Math.abs(n.vx), Math.abs(n.vy));
      }

      alpha += (alphaTarget - alpha) * ALPHA_DECAY;
      if (alphaTarget === 0 && alpha < ALPHA_MIN) alpha = 0;
      indiceEspacialValido = false;
      return energia;
    }

    /* ---------------- Dibujo ---------------- */

    function radioNodo(n) {
      if (analisisVisual.tamano === 'uniforme') return 9;
      if (analisisVisual.tamano !== 'actual' && analisisVisual.valores) {
        const valor = Number(analisisVisual.valores[n.id]);
        if (Number.isFinite(valor)) {
          let maximo = analisisVisual.maximo;
          if (!(maximo > 0)) {
            maximo = 1;
            for (const candidato of Object.values(analisisVisual.valores)) {
              const numero = Number(candidato);
              if (Number.isFinite(numero) && numero > maximo) maximo = numero;
            }
          }
          return 7 + 6 * Math.max(0, Math.min(1, valor / maximo));
        }
      }
      return 7 + Math.min(6, n.grado * 0.9);
    }

    function colorDeNodo(n, imprimible = false) {
      if (imprimible) {
        if (analisisVisual.colorPorComunidad && analisisVisual.comunidades) {
          const comunidad = Number(analisisVisual.comunidades[n.id]);
          if (Number.isFinite(comunidad) && comunidad > 0) {
            return GRISES_COMUNIDADES[(comunidad - 1) % GRISES_COMUNIDADES.length];
          }
        }
        return GRISES_GRAFO[n.tipo] || '#eeeeee';
      }
      if (analisisVisual.colorPorComunidad && analisisVisual.comunidades) {
        const comunidad = Number(analisisVisual.comunidades[n.id]);
        if (Number.isFinite(comunidad) && comunidad > 0) {
          return PALETA_COMUNIDADES[(comunidad - 1) % PALETA_COMUNIDADES.length];
        }
      }
      return COLORES_GRAFO[n.tipo] || '#999';
    }

    function aplicarVisualAnalisis(config = {}) {
      analisisVisual.tamano = config.tamano || 'actual';
      analisisVisual.valores = config.valores || null;
      analisisVisual.maximo = Number(config.maximo) || 0;
      analisisVisual.comunidades = config.comunidades || null;
      analisisVisual.colorPorComunidad = Boolean(config.colorPorComunidad);
      indiceEspacialValido = false;
      despertar();
    }

    function restaurarVisualAnalisis() {
      analisisVisual.tamano = 'actual';
      analisisVisual.valores = null;
      analisisVisual.maximo = 0;
      analisisVisual.comunidades = null;
      analisisVisual.colorPorComunidad = false;
      indiceEspacialValido = false;
      despertar();
    }

    function cajasSolapan(a, b) {
      return a.x < b.x + b.ancho
        && a.x + a.ancho > b.x
        && a.y < b.y + b.alto
        && a.y + a.alto > b.y;
    }

    function geometriaArista(a) {
      const o = mundo.get(a.origen);
      const d = mundo.get(a.destino);
      if (!o || !d) return null;
      const dx = d.x - o.x;
      const dy = d.y - o.y;
      const longitud = Math.hypot(dx, dy) || 1;
      const offset = Number(a.curvaOffset) || 0;
      return {
        o,
        d,
        cx: (o.x + d.x) / 2 + (-dy / longitud) * offset,
        cy: (o.y + d.y) / 2 + (dx / longitud) * offset,
      };
    }

    function puntoCuadratica(geometria, t) {
      const u = 1 - t;
      return {
        x: u * u * geometria.o.x + 2 * u * t * geometria.cx + t * t * geometria.d.x,
        y: u * u * geometria.o.y + 2 * u * t * geometria.cy + t * t * geometria.d.y,
        dx: 2 * u * (geometria.cx - geometria.o.x) + 2 * t * (geometria.d.x - geometria.cx),
        dy: 2 * u * (geometria.cy - geometria.o.y) + 2 * t * (geometria.d.y - geometria.cy),
      };
    }

    function distanciaSegmento(px, py, x1, y1, x2, y2) {
      const dx = x2 - x1;
      const dy = y2 - y1;
      const longitud2 = dx * dx + dy * dy;
      if (longitud2 === 0) return Math.hypot(px - x1, py - y1);
      let t = ((px - x1) * dx + (py - y1) * dy) / longitud2;
      t = Math.max(0, Math.min(1, t));
      return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
    }

    function dibujarFlecha(contexto, geometria, color, escalaDibujo, alfa = 1, t = 0.62, invertida = false) {
      const punto = puntoCuadratica(geometria, t);
      const longitud = Math.hypot(punto.dx, punto.dy) || 1;
      const signo = invertida ? -1 : 1;
      const ux = (punto.dx / longitud) * signo;
      const uy = (punto.dy / longitud) * signo;
      const tamano = 6 / Math.max(escalaDibujo, 0.2);
      const ancho = tamano * 0.48;
      contexto.save();
      contexto.globalAlpha = alfa;
      contexto.fillStyle = color;
      contexto.beginPath();
      contexto.moveTo(punto.x + ux * tamano, punto.y + uy * tamano);
      contexto.lineTo(
        punto.x - ux * tamano * 0.25 - uy * ancho,
        punto.y - uy * tamano * 0.25 + ux * ancho
      );
      contexto.lineTo(
        punto.x - ux * tamano * 0.25 + uy * ancho,
        punto.y - uy * tamano * 0.25 - ux * ancho
      );
      contexto.closePath();
      contexto.fill();
      contexto.restore();
    }

    function trazarFormaNodo(contexto, n, x, y, r) {
      contexto.beginPath();
      if (n.tipo === 'institucion') {
        contexto.rect(x - r, y - r, r * 2, r * 2);
      } else if (n.tipo === 'lugar') {
        contexto.moveTo(x, y - r);
        contexto.lineTo(x + r, y + r * 0.8);
        contexto.lineTo(x - r, y + r * 0.8);
        contexto.closePath();
      } else if (n.tipo === 'patrimonio') {
        contexto.moveTo(x, y - r);
        contexto.lineTo(x + r, y);
        contexto.lineTo(x, y + r);
        contexto.lineTo(x - r, y);
        contexto.closePath();
      } else {
        contexto.arc(x, y, r, 0, Math.PI * 2);
      }
    }

    function dibujarEn(contexto, conFondo = false, opciones = {}) {
      const nodosDibujo = opciones.nodos || nodosVisibles;
      const aristasDibujo = opciones.aristas || aristasVisuales;
      const seleccionDibujo = opciones.seleccion !== undefined ? opciones.seleccion : seleccion;
      const seleccionAristaDibujo = opciones.seleccionArista !== undefined ? opciones.seleccionArista : seleccionArista;
      const vecinosDibujo = opciones.vecinos !== undefined
        ? opciones.vecinos
        : (seleccionDibujo ? vecinosSeleccion : null);
      const resaltadoDibujo = opciones.resaltado !== undefined ? opciones.resaltado : resaltado;
      const escalaDibujo = opciones.escala ?? escala;
      const panXDibujo = opciones.panX ?? panX;
      const panYDibujo = opciones.panY ?? panY;
      const anchoDibujo = opciones.ancho ?? ancho;
      const altoDibujo = opciones.alto ?? alto;
      const forzarEtiquetasNodo = Boolean(opciones.forzarEtiquetasNodo);
      const atenuarResto = opciones.atenuarResto !== false;
      const imprimible = Boolean(opciones.imprimible);
      const paleta = imprimible
        ? {
          arista: '#3a3a3a',
          aristaActiva: '#000000',
          contorno: '#000000',
          etiqueta: '#111111',
          seleccion: '#000000',
        }
        : {
          arista: coloresTema.arista,
          aristaActiva: coloresTema.aristaActiva,
          contorno: coloresTema.contorno,
          etiqueta: coloresTema.etiqueta,
          seleccion: '#e3c35a',
        };
      const mostrarDireccionDibujo = opciones.mostrarDireccion !== undefined
        ? Boolean(opciones.mostrarDireccion)
        : mostrarDireccion;
      const limitarVista = !opciones.nodos && !conFondo;
      const x0 = (-panXDibujo) / escalaDibujo - 120;
      const y0 = (-panYDibujo) / escalaDibujo - 120;
      const x1 = (anchoDibujo - panXDibujo) / escalaDibujo + 120;
      const y1 = (altoDibujo - panYDibujo) / escalaDibujo + 120;
      const nodosPintar = limitarVista
        ? nodosDibujo.filter((n) => n.x >= x0 && n.x <= x1 && n.y >= y0 && n.y <= y1)
        : nodosDibujo;
      const idsPintar = new Set(nodosPintar.map((n) => n.id));
      const aristasPintar = limitarVista
        ? aristasDibujo.filter((a) => idsPintar.has(a.origen) || idsPintar.has(a.destino))
        : aristasDibujo;

      contexto.clearRect(0, 0, anchoDibujo, altoDibujo);
      if (conFondo) {
        if (imprimible) {
          contexto.fillStyle = '#ffffff';
          contexto.fillRect(0, 0, anchoDibujo, altoDibujo);
        } else {
          const estilos = getComputedStyle(document.documentElement);
          const fondo1 = estilos.getPropertyValue('--grafo-fondo1').trim() || '#151820';
          const fondo2 = estilos.getPropertyValue('--grafo-fondo2').trim() || '#101216';
          const gradiente = contexto.createRadialGradient(
            anchoDibujo * 0.5, altoDibujo * 0.4, 0,
            anchoDibujo * 0.5, altoDibujo * 0.4, Math.max(anchoDibujo, altoDibujo) * 0.7
          );
          gradiente.addColorStop(0, fondo1);
          gradiente.addColorStop(0.7, fondo2);
          contexto.fillStyle = gradiente;
          contexto.fillRect(0, 0, anchoDibujo, altoDibujo);
        }
      }
      contexto.save();
      contexto.translate(panXDibujo, panYDibujo);
      contexto.scale(escalaDibujo, escalaDibujo);
      contexto.lineCap = 'round';
      contexto.lineJoin = 'round';

      /* Aristas agregadas por vínculo, con grosor por número de relaciones. */
      const dibujarArista = (a, activa) => {
        const geometria = geometriaArista(a);
        if (!geometria) return;
        const esGrupo = esGrupoArista(a);
        const seleccionada = a === seleccionAristaDibujo
          || (esGrupo && esGrupoArista(seleccionAristaDibujo) && a.clave === seleccionAristaDibujo.clave)
          || (esGrupo && seleccionAristaDibujo && !esGrupoArista(seleccionAristaDibujo)
            && a.aristas.includes(seleccionAristaDibujo));
        const destacada = activa || a === resaltadoArista || seleccionada;
        const haySeleccion = Boolean(seleccionDibujo || seleccionAristaDibujo);
        const peso = esGrupo ? Math.log2(a.cantidad + 1) : 1;
        const grosorBase = 1 + Math.min(2.6, peso * 0.55);
        let color;
        let alfa;
        let grosor;
        if (haySeleccion) {
          if (destacada) {
            color = paleta.aristaActiva;
            alfa = 1;
            grosor = (Math.max(1.8, grosorBase + 0.4)) / escalaDibujo;
          } else {
            color = paleta.arista;
            alfa = imprimible ? 0.16 : 0.055;
            grosor = 0.8 / escalaDibujo;
          }
        } else if (destacada) {
          color = paleta.aristaActiva;
          alfa = 1;
          grosor = (Math.max(1.8, grosorBase + 0.4)) / escalaDibujo;
        } else {
          color = paleta.arista;
          alfa = 1;
          grosor = grosorBase / escalaDibujo;
        }
        contexto.globalAlpha = alfa;
        contexto.strokeStyle = color;
        contexto.lineWidth = grosor;
        const automatica = esGrupo
          ? Boolean(a.soloAutomatizadas)
          : String(a.procedencia || '').toUpperCase() === 'AUTOMATIZADA';
        contexto.setLineDash(
          automatica ? [4 / escalaDibujo, 3 / escalaDibujo] : []
        );
        contexto.beginPath();
        contexto.moveTo(geometria.o.x, geometria.o.y);
        contexto.quadraticCurveTo(geometria.cx, geometria.cy, geometria.d.x, geometria.d.y);
        contexto.stroke();
        if (mostrarDireccionDibujo && (escalaDibujo >= 0.45 || activa || destacada)) {
          const simetrica = esGrupo ? Boolean(a.bidireccional) : relacionBidireccional(a.tipo);
          const ida = simetrica || !esGrupo || a.ida > 0 || (!a.ida && !a.vuelta);
          const vuelta = simetrica || (esGrupo && a.vuelta > 0);
          if (ida) dibujarFlecha(contexto, geometria, color, escalaDibujo, alfa, 0.62, false);
          if (vuelta) dibujarFlecha(contexto, geometria, color, escalaDibujo, alfa, 0.38, true);
        }
      };
      const esAristaActiva = (a) => {
        if (seleccionAristaDibujo) {
          if (a === seleccionAristaDibujo) return true;
          if (esGrupoArista(a) && esGrupoArista(seleccionAristaDibujo)) {
            return a.clave === seleccionAristaDibujo.clave;
          }
          if (esGrupoArista(a) && !esGrupoArista(seleccionAristaDibujo)) {
            return a.aristas.includes(seleccionAristaDibujo);
          }
          if (!esGrupoArista(a) && esGrupoArista(seleccionAristaDibujo)) {
            return seleccionAristaDibujo.aristas.includes(a);
          }
          return false;
        }
        if (!seleccionDibujo) return false;
        if (a.origen === seleccionDibujo.id || a.destino === seleccionDibujo.id) return true;
        if (esGrupoArista(a)) {
          return a.aristas.some(
            (arista) => arista.origen === seleccionDibujo.id || arista.destino === seleccionDibujo.id
          );
        }
        return false;
      };
      for (const a of aristasPintar) {
        if (!esAristaActiva(a)) dibujarArista(a, false);
      }
      for (const a of aristasPintar) {
        if (esAristaActiva(a)) dibujarArista(a, true);
      }
      contexto.setLineDash([]);
      contexto.globalAlpha = 1;

      /* nodos: primero los círculos y después las etiquetas, para que
         ningún nodo tape el nombre de una entidad conectada. */
      if (seleccionDibujo && vecinosDe !== seleccionDibujo.id && !opciones.nodos) recalcularAristas();
      const vecinos = seleccionDibujo ? vecinosDibujo : null;
      const nodosEtiqueta = [];
      for (const n of nodosPintar) {
        const r = radioNodo(n);
        const esSel = seleccionDibujo === n;
        const esRes = resaltadoDibujo === n;
        const vecino = !!seleccionDibujo && vecinos.has(n.id);
        const atenuar = atenuarResto && seleccionDibujo && !esSel && !vecino;

        if (esSel || esRes) {
          trazarFormaNodo(contexto, n, n.x, n.y, r + 5);
          contexto.strokeStyle = esSel ? paleta.seleccion : (imprimible ? '#555555' : 'rgba(227,195,90,0.5)');
          contexto.lineWidth = (imprimible ? 2 : 1.5) / escalaDibujo;
          contexto.stroke();
        }
        contexto.globalAlpha = atenuar ? (imprimible ? 0.4 : 0.28) : 1;
        if (esSel && !imprimible) {
          contexto.shadowColor = 'rgba(227,195,90,0.55)';
          contexto.shadowBlur = 16;
        }
        trazarFormaNodo(contexto, n, n.x, n.y, r);
        contexto.fillStyle = colorDeNodo(n, imprimible);
        contexto.fill();
        contexto.shadowBlur = 0;
        contexto.shadowColor = 'transparent';
        contexto.strokeStyle = paleta.contorno;
        contexto.lineWidth = (imprimible ? 1.2 : 1.5) / escalaDibujo;
        contexto.stroke();
        nodosEtiqueta.push({ n, r, esSel, esRes, vecino, atenuar });
      }
      contexto.globalAlpha = 1;

      const prioridadEtiqueta = (item) => (
        (item.esSel ? 3 : 0) + (item.esRes ? 2 : 0) + (item.vecino ? 1 : 0)
      );
      nodosEtiqueta.sort((a, b) => prioridadEtiqueta(b) - prioridadEtiqueta(a));
      const cajasOcupadas = new Map();
      const CELDA_ETIQUETA = 180;
      const celdasDeCaja = (caja) => {
        const x0 = Math.floor(caja.x / CELDA_ETIQUETA);
        const y0 = Math.floor(caja.y / CELDA_ETIQUETA);
        const x1 = Math.floor((caja.x + caja.ancho) / CELDA_ETIQUETA);
        const y1 = Math.floor((caja.y + caja.alto) / CELDA_ETIQUETA);
        return { x0, y0, x1, y1 };
      };
      const insertarCaja = (caja) => {
        const { x0, y0, x1, y1 } = celdasDeCaja(caja);
        for (let x = x0; x <= x1; x++) {
          for (let y = y0; y <= y1; y++) {
            const clave = `${x}:${y}`;
            if (!cajasOcupadas.has(clave)) cajasOcupadas.set(clave, []);
            cajasOcupadas.get(clave).push(caja);
          }
        }
      };
      const contarSolapes = (caja) => {
        const { x0, y0, x1, y1 } = celdasDeCaja(caja);
        const vistas = new Set();
        let solapes = 0;
        for (let x = x0; x <= x1; x++) {
          for (let y = y0; y <= y1; y++) {
            for (const otra of cajasOcupadas.get(`${x}:${y}`) || []) {
              if (vistas.has(otra)) continue;
              vistas.add(otra);
              if (cajasSolapan(caja, otra)) solapes++;
            }
          }
        }
        return solapes;
      };
      for (const n of nodosPintar) {
        const r = radioNodo(n);
        insertarCaja({
          x: n.x - r - 1,
          y: n.y - r - 1,
          ancho: r * 2 + 2,
          alto: r * 2 + 2,
        });
      }
      for (const { n, r, esSel, esRes, vecino, atenuar } of nodosEtiqueta) {
        if (!(escalaDibujo > 0.45 || esSel || esRes || vecino || forzarEtiquetasNodo)) continue;
        const tamanoFuente = 11 / Math.max(escalaDibujo, 0.2);
        contexto.font = `${tamanoFuente}px system-ui, sans-serif`;
        contexto.textBaseline = 'middle';
        const completa = esSel || vecino || forzarEtiquetasNodo;
        const etiqueta = (completa || n.etiqueta.length <= 26)
          ? n.etiqueta
          : `${n.etiqueta.slice(0, 24)}…`;
        const anchoTexto = (() => {
          const claveAnchura = `${tamanoFuente}|${etiqueta}`;
          if (!cacheAnchurasEtiqueta.has(claveAnchura)) {
            if (cacheAnchurasEtiqueta.size > 5000) cacheAnchurasEtiqueta.clear();
            cacheAnchurasEtiqueta.set(claveAnchura, contexto.measureText(etiqueta).width);
          }
          return cacheAnchurasEtiqueta.get(claveAnchura);
        })();
        const anchoCaja = anchoTexto + 6;
        const altoCaja = tamanoFuente * 1.3;
        const candidatos = [
          { x: n.x - anchoCaja / 2, y: n.y + r + 2 },
          { x: n.x - anchoCaja / 2, y: n.y - r - 2 - altoCaja },
          { x: n.x + r + 3, y: n.y - altoCaja / 2 },
          { x: n.x - r - 3 - anchoCaja, y: n.y - altoCaja / 2 },
        ].map((candidata) => ({
          ...candidata,
          ancho: anchoCaja,
          alto: altoCaja,
        }));
        let caja = null;
        let mejor = null;
        let mejorSolapes = Infinity;
        for (const candidata of candidatos) {
          const solapes = contarSolapes(candidata);
          if (solapes === 0) { caja = candidata; break; }
          if (solapes < mejorSolapes) {
            mejorSolapes = solapes;
            mejor = candidata;
          }
        }
        if (!caja && completa) caja = mejor || candidatos[0];
        if (!caja) continue;
        insertarCaja(caja);
        contexto.globalAlpha = atenuar ? (imprimible ? 0.4 : 0.28) : 1;
        contexto.fillStyle = paleta.etiqueta;
        contexto.textAlign = 'center';
        if (!imprimible) {
          contexto.shadowColor = 'rgba(0,0,0,0.65)';
          contexto.shadowBlur = 3;
        }
        contexto.fillText(etiqueta, caja.x + caja.ancho / 2, caja.y + caja.alto / 2);
        contexto.shadowBlur = 0;
        contexto.shadowColor = 'transparent';
      }
      contexto.globalAlpha = 1;
      contexto.restore();
    }

    function bucle() {
      rafId = null;
      if (cancelado || !canvas.isConnected) return; // el módulo se desmontó
      const energia = tick();
      if (!arrastre && necesitaAjuste && alpha === 0) {
        necesitaAjuste = false;
        ajustarVista();
      }
      actualizarAnimacionVista(performance.now());
      dibujarEn(ctx);
      /* La simulación se enfría suavemente; las interacciones la despiertan. */
      if (arrastre || alpha > 0 || animacionVista || energia > 0.08) {
        rafId = requestAnimationFrame(bucle);
      }
    }

    /* ---------------- Interacción ---------------- */

    function aMundo(ev) {
      const rect = canvas.getBoundingClientRect();
      return {
        x: (ev.clientX - rect.left - panX) / escala,
        y: (ev.clientY - rect.top - panY) / escala,
      };
    }

    function reconstruirIndiceEspacial() {
      indiceEspacial.clear();
      for (const n of nodosVisibles) {
        const cx = Math.floor(n.x / CELDA_ESPACIAL);
        const cy = Math.floor(n.y / CELDA_ESPACIAL);
        const clave = `${cx}:${cy}`;
        if (!indiceEspacial.has(clave)) indiceEspacial.set(clave, []);
        indiceEspacial.get(clave).push(n);
      }
      indiceEspacialValido = true;
    }

    function nodoEn(pos) {
      if (!indiceEspacialValido) reconstruirIndiceEspacial();
      const cx = Math.floor(pos.x / CELDA_ESPACIAL);
      const cy = Math.floor(pos.y / CELDA_ESPACIAL);
      let encontrado = null;
      for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
          const lista = indiceEspacial.get(`${cx + dx}:${cy + dy}`);
          if (!lista) continue;
          for (let i = lista.length - 1; i >= 0; i--) {
            const n = lista[i];
            const ddx = pos.x - n.x, ddy = pos.y - n.y;
            if (ddx * ddx + ddy * ddy <= Math.pow(radioNodo(n) + 4, 2)) encontrado = n;
          }
        }
      }
      return encontrado;
    }

    function aristaEn(pos) {
      const umbral = 7 / Math.max(escala, 0.2);
      let encontrada = null;
      let mejor = Infinity;
      for (const a of aristasVisuales) {
        const extremoO = mundo.get(a.origen);
        const extremoD = mundo.get(a.destino);
        if (!extremoO || !extremoD) continue;
        /* Descarte rápido por caja envolvente (extremos + control de la
           curva): evita calcular 8 segmentos por cada arista lejana. */
        const curva = Math.abs(Number(a.curvaOffset) || 0);
        const margen = umbral + curva;
        if (pos.x < Math.min(extremoO.x, extremoD.x) - margen
          || pos.x > Math.max(extremoO.x, extremoD.x) + margen
          || pos.y < Math.min(extremoO.y, extremoD.y) - margen
          || pos.y > Math.max(extremoO.y, extremoD.y) + margen) {
          continue;
        }
        const geometria = geometriaArista(a);
        if (!geometria) continue;
        let anterior = geometria.o;
        for (let paso = 1; paso <= 8; paso++) {
          const punto = puntoCuadratica(geometria, paso / 8);
          const distancia = distanciaSegmento(
            pos.x, pos.y,
            anterior.x, anterior.y,
            punto.x, punto.y
          );
          if (distancia < umbral && distancia < mejor) {
            mejor = distancia;
            encontrada = a;
          }
          anterior = punto;
        }
      }
      return encontrada;
    }

    function descripcionArista(a) {
      if (!a) return '';
      const origen = mundo.get(a.origen);
      const destino = mundo.get(a.destino);
      const nombreOrigen = origen ? origen.etiqueta : '?';
      const nombreDestino = destino ? destino.etiqueta : '?';
      const simetrica = esGrupoArista(a)
        ? Boolean(a.bidireccional)
        : relacionBidireccional(a.tipo);
      if (esGrupoArista(a) && a.cantidad > 1) {
        const tipos = [...a.tipos.entries()]
          .sort((x, y) => y[1] - x[1])
          .slice(0, 2)
          .map(([tipo, cuenta]) => `${tipo} (${cuenta})`)
          .join(' · ');
        const sentido = simetrica || (a.ida && a.vuelta)
          ? `${nombreOrigen} ↔ ${nombreDestino}`
          : (a.vuelta
            ? `${nombreDestino} → ${nombreOrigen}`
            : `${nombreOrigen} → ${nombreDestino}`);
        const notaSimetria = simetrica
          ? (a.soloBidireccional ? ' · relación simétrica' : ' · incluye relación simétrica')
          : '';
        return `${a.cantidad} relaciones · ${sentido}${notaSimetria}${tipos ? ` · ${tipos}` : ''}`;
      }
      const unica = esGrupoArista(a) ? a.aristas[0] : a;
      if (!unica) return '';
      const flecha = simetrica ? '↔' : '→';
      return `${unica.tipo || 'Relación'} · ${nombreOrigen} ${flecha} ${nombreDestino}${simetrica ? ' · relación simétrica' : ''}${unica.fecha ? ` · ${unica.fecha}` : ''}`;
    }

    function ocultarTooltipArista() {
      tooltipArista.hidden = true;
      tooltipArista.textContent = '';
    }

    function mostrarTooltipArista(a, ev) {
      if (!a) {
        ocultarTooltipArista();
        return;
      }
      tooltipArista.textContent = descripcionArista(a);
      tooltipArista.hidden = false;
      const rect = escena.getBoundingClientRect();
      const x = Math.min(rect.width - 20, Math.max(8, ev.clientX - rect.left + 12));
      const y = Math.min(rect.height - 20, Math.max(8, ev.clientY - rect.top + 12));
      tooltipArista.style.left = `${x}px`;
      tooltipArista.style.top = `${y}px`;
    }

    canvas.addEventListener('pointerdown', (ev) => {
      if (ev.button !== undefined && ev.button !== 0) return;
      ocultarTooltipArista();
      if (typeof canvas.setPointerCapture === 'function') {
        try { canvas.setPointerCapture(ev.pointerId); } catch { /* puntero no capturable */ }
      }
      const pos = aMundo(ev);
      const n = nodoEn(pos);
      suprimirClick = false;
      if (n) {
        animacionVista = null;
        seleccionFijada = null;
        arrastre = { tipo: 'nodo', nodo: n, movido: false };
        vistaManual = true;
        necesitaAjuste = false;
        alphaTarget = 0.18;
        alpha = Math.max(alpha, 0.18);
      } else {
        animacionVista = null;
        arrastre = { tipo: 'pano', x: ev.clientX, y: ev.clientY, pan0x: panX, pan0y: panY, movido: false };
        vistaManual = true;
        necesitaAjuste = false;
      }
      despertar();
    });

    canvas.addEventListener('pointermove', (ev) => {
      if (!arrastre) {
        const pos = aMundo(ev);
        const nuevo = nodoEn(pos);
        const nuevaArista = nuevo ? null : aristaEn(pos);
        if (nuevo !== resaltado || nuevaArista !== resaltadoArista) {
          resaltado = nuevo;
          resaltadoArista = nuevaArista;
          despertar();
        }
        if (nuevaArista) mostrarTooltipArista(nuevaArista, ev);
        else ocultarTooltipArista();
        canvas.style.cursor = (resaltado || resaltadoArista) ? 'pointer' : 'grab';
        return;
      }
      ocultarTooltipArista();
      if (arrastre.tipo === 'nodo') {
        const pos = aMundo(ev);
        arrastre.nodo.x = pos.x;
        arrastre.nodo.y = pos.y;
        arrastre.movido = true;
        indiceEspacialValido = false;
      } else {
        panX = arrastre.pan0x + (ev.clientX - arrastre.x);
        panY = arrastre.pan0y + (ev.clientY - arrastre.y);
        arrastre.movido = true;
        suprimirClick = true;
      }
      despertar();
    });

    const alSoltar = () => {
      const eraNodo = arrastre && arrastre.tipo === 'nodo';
      arrastre = null;
      if (eraNodo) {
        alphaTarget = 0;
        alpha = Math.max(alpha, 0.12);
      }
      despertar();
    };

    canvas.addEventListener('pointerleave', () => {
      resaltado = null;
      resaltadoArista = null;
      ocultarTooltipArista();
      despertar();
    });

    canvas.addEventListener('click', (ev) => {
      if (suprimirClick) {
        suprimirClick = false;
        return;
      }
      const pos = aMundo(ev);
      const n = nodoEn(pos);
      const a = n ? null : aristaEn(pos);
      seleccionFijada = null;
      if (n) {
        seleccion = n;
        seleccionArista = null;
        recalcularAristas();
        mostrarInfo(n);
      } else if (a) {
        seleccion = null;
        if (esGrupoArista(a) && a.cantidad === 1) {
          seleccionArista = a.aristas[0];
          recalcularAristas();
          mostrarInfoArista(seleccionArista);
        } else {
          seleccionArista = a;
          recalcularAristas();
          mostrarInfoAristaGrupo(a);
        }
      } else {
        seleccion = null;
        seleccionArista = null;
        recalcularAristas();
        ocultarInfo();
      }
      ocultarTooltipArista();
      actualizarBotonExportarSeleccion();
      despertar();
    });
    canvas.addEventListener('pointercancel', () => {
      arrastre = null;
      alphaTarget = 0;
      despertar();
    });

    canvas.addEventListener('keydown', (ev) => {
      if (ev.key === 'Escape') {
        ev.preventDefault();
        seleccion = null;
        seleccionArista = null;
        seleccionFijada = null;
        recalcularAristas();
        ocultarInfo();
        actualizarBotonExportarSeleccion();
        despertar();
        return;
      }
      if (ev.key === 'Enter') {
        if (seleccion) {
          ev.preventDefault();
          navegarARegistro(seleccion.tipo, seleccion.entidadId);
        }
        return;
      }
      const direcciones = {
        ArrowRight: [1, 0],
        ArrowLeft: [-1, 0],
        ArrowDown: [0, 1],
        ArrowUp: [0, -1],
      };
      const direccion = direcciones[ev.key];
      if (!direccion) return;
      ev.preventDefault();
      if (!nodosVisibles.length) return;
      let actual = seleccion;
      if (!actual || actual.oculto) {
        const centroX = (ancho / 2 - panX) / escala;
        const centroY = (alto / 2 - panY) / escala;
        actual = nodosVisibles.reduce((mejor, n) => {
          if (!mejor) return n;
          const d = (n.x - centroX) ** 2 + (n.y - centroY) ** 2;
          const dm = (mejor.x - centroX) ** 2 + (mejor.y - centroY) ** 2;
          return d < dm ? n : mejor;
        }, null);
      }
      let siguiente = null;
      let mejorPuntuacion = Infinity;
      for (const n of nodosVisibles) {
        if (n === actual) continue;
        const dx = n.x - actual.x;
        const dy = n.y - actual.y;
        const distancia = Math.hypot(dx, dy);
        if (distancia < 1) continue;
        const proyeccion = (dx * direccion[0] + dy * direccion[1]) / distancia;
        if (proyeccion < 0.25) continue;
        const puntuacion = distancia + (1 - proyeccion) * 80;
        if (puntuacion < mejorPuntuacion) {
          mejorPuntuacion = puntuacion;
          siguiente = n;
        }
      }
      if (!siguiente) return;
      seleccionArista = null;
      seleccion = siguiente;
      seleccionFijada = siguiente;
      recalcularAristas();
      mostrarInfo(siguiente);
      actualizarBotonExportarSeleccion();
      despertar();
    });

    canvas.addEventListener('wheel', (ev) => {
      ev.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const mx = ev.clientX - rect.left, my = ev.clientY - rect.top;
      const factor = Math.exp(-ev.deltaY * 0.0012);
      const nueva = Math.min(3, Math.max(0.2, escala * factor));
      panX = mx - ((mx - panX) / escala) * nueva;
      panY = my - ((my - panY) / escala) * nueva;
      escala = nueva;
      despertar();
    }, { passive: false });

    btnReorganizar.addEventListener('click', () => {
      preparar(true);
      reiniciarFiltro();
      aviso('Disposición reiniciada');
    });
    btnCentrar.addEventListener('click', () => {
      vistaManual = false;
      necesitaAjuste = false;
      ajustarVista();
      despertar();
    });
    function dibujarCabeceraExportacion(contexto, anchoBase, altoBase, imprimible = false) {
      if (!opcionesExportacion.incluirTitulo
        && !opcionesExportacion.incluirLeyenda
        && !opcionesExportacion.incluirFiltros) return;
      contexto.save();
      contexto.textBaseline = 'top';
      const paleta = imprimible
        ? {
          caja: '#ffffff',
          borde: '#000000',
          titulo: '#000000',
          texto: '#222222',
          tenue: '#444444',
        }
        : {
          caja: 'rgba(8, 10, 14, 0.72)',
          borde: null,
          titulo: '#f0e8d8',
          texto: 'rgba(226, 222, 208, 0.85)',
          tenue: 'rgba(226, 222, 208, 0.72)',
        };
      const pintarCaja = (x, y, anchoCaja, altoCaja) => {
        contexto.fillStyle = paleta.caja;
        contexto.fillRect(x, y, anchoCaja, altoCaja);
        if (paleta.borde) {
          contexto.strokeStyle = paleta.borde;
          contexto.lineWidth = 1;
          contexto.beginPath();
          contexto.rect(x, y, anchoCaja, altoCaja);
          contexto.stroke();
        }
      };
      const recortarTexto = (texto, anchoMax) => {
        if (contexto.measureText(texto).width <= anchoMax) return texto;
        let bajo = 0;
        let alto = texto.length;
        while (bajo < alto) {
          const medio = Math.ceil((bajo + alto) / 2);
          const prueba = `${texto.slice(0, medio)}…`;
          if (contexto.measureText(prueba).width <= anchoMax) bajo = medio;
          else alto = medio - 1;
        }
        return `${texto.slice(0, bajo)}…`;
      };
      if (opcionesExportacion.incluirTitulo || opcionesExportacion.incluirFiltros) {
        const altoCaja = opcionesExportacion.incluirFiltros ? 66 : 48;
        const meta = `H-IMAGO · Vista de grafo · ${new Date().toLocaleString('es-ES')}${imprimible ? ' · versión imprimible' : ''}`;
        const filtros = (resumenFiltros.textContent || 'Sin filtros activos').slice(0, 130);
        let anchoTexto = 0;
        if (opcionesExportacion.incluirTitulo) {
          contexto.font = '600 17px system-ui, sans-serif';
          anchoTexto = Math.max(anchoTexto, contexto.measureText(proyecto.nombre || 'H-IMAGO').width);
        }
        contexto.font = '11px system-ui, sans-serif';
        anchoTexto = Math.max(anchoTexto, contexto.measureText(meta).width);
        if (opcionesExportacion.incluirFiltros) {
          anchoTexto = Math.max(anchoTexto, contexto.measureText(filtros).width);
        }
        const anchoCaja = Math.min(anchoBase - 32, Math.max(320, Math.ceil(anchoTexto + 28)));
        pintarCaja(16, 16, anchoCaja, altoCaja);
        const anchoDisponible = anchoCaja - 28;
        if (opcionesExportacion.incluirTitulo) {
          contexto.fillStyle = paleta.titulo;
          contexto.font = '600 17px system-ui, sans-serif';
          contexto.fillText(recortarTexto(proyecto.nombre || 'H-IMAGO', anchoDisponible), 28, 27);
        }
        contexto.fillStyle = imprimible ? paleta.tenue : paleta.texto;
        contexto.font = '11px system-ui, sans-serif';
        contexto.fillText(
          recortarTexto(meta, anchoDisponible),
          28,
          opcionesExportacion.incluirTitulo ? 48 : 28
        );
        if (opcionesExportacion.incluirFiltros) {
          contexto.fillText(recortarTexto(filtros, anchoDisponible), 28, 65);
        }
      }
      if (opcionesExportacion.incluirLeyenda) {
        const entradas = Object.keys(COLORES_GRAFO);
        const hayAgrupadas = aristasVisuales.some(
          (a) => esGrupoArista(a) && a.cantidad > 1
        );
        const anchoCaja = 270;
        const altoCaja = 30 + entradas.length * 20
          + (analisisVisual.tamano !== 'actual' ? 20 : 0)
          + (analisisVisual.colorPorComunidad ? 20 : 0)
          + (hayAgrupadas ? 20 : 0)
          + 20
          + (mostrarDireccion ? 40 : 0);
        const x = 16;
        const y = Math.max(16, altoBase - altoCaja - 16);
        pintarCaja(x, y, anchoCaja, altoCaja);
        contexto.fillStyle = paleta.titulo;
        contexto.font = '600 11px system-ui, sans-serif';
        contexto.fillText('Entidades', x + 12, y + 8);
        let filaY = y + 27;
        for (const tipo of entradas) {
          trazarFormaNodo(contexto, { tipo }, x + 18, filaY + 5, 5);
          contexto.fillStyle = colorDeNodo({ tipo }, imprimible);
          contexto.fill();
          contexto.strokeStyle = imprimible ? '#000000' : 'rgba(16,18,22,0.9)';
          contexto.lineWidth = 1;
          contexto.stroke();
          contexto.fillStyle = paleta.texto;
          contexto.font = '11px system-ui, sans-serif';
          contexto.fillText(NOMBRE_TIPO[tipo] || tipo, x + 32, filaY);
          filaY += 20;
        }
        contexto.font = '10px system-ui, sans-serif';
        contexto.fillStyle = paleta.tenue;
        if (analisisVisual.tamano !== 'actual') {
          contexto.fillText(`Tamaño: ${analisisVisual.tamano}`, x + 12, filaY);
          filaY += 20;
        }
        if (analisisVisual.colorPorComunidad) {
          contexto.fillText(imprimible ? 'Tono: comunidad' : 'Color: comunidad', x + 12, filaY);
          filaY += 20;
        }
        if (hayAgrupadas) {
          contexto.fillText('Grosor: relaciones agrupadas', x + 12, filaY);
          filaY += 20;
        }
        contexto.fillText('Línea discontinua: relación automatizada', x + 12, filaY);
        filaY += 20;
        if (mostrarDireccion) {
          contexto.fillText('Flecha: origen → destino', x + 12, filaY);
          filaY += 20;
          contexto.fillText('Doble flecha: relación bidireccional', x + 12, filaY);
        }
      }
      contexto.restore();
    }

    function abrirOpcionesExportacion() {
      const contenido = el('div', 'modal-contenido');
      contenido.appendChild(el('h3', 'modal-titulo', 'Opciones de exportación PNG'));
      contenido.appendChild(el('p', 'pista',
        'La red se exporta encuadrada. Puedes añadir una cabecera y una leyenda sin alterar la vista actual.'));
      const checks = [
        ['incluirTitulo', 'Incluir título y fecha'],
        ['incluirLeyenda', 'Incluir leyenda de entidades y codificación'],
        ['incluirFiltros', 'Incluir resumen de filtros activos'],
        ['incluirImprimible', 'Incluir versión imprimible (blanco y negro)'],
      ];
      for (const [clave, etiqueta] of checks) {
        const label = el('label', 'grafo-analisis-opcion compacta');
        const check = document.createElement('input');
        check.type = 'checkbox';
        check.checked = Boolean(opcionesExportacion[clave]);
        check.addEventListener('change', () => {
          opcionesExportacion[clave] = check.checked;
        });
        label.append(check, document.createTextNode(` ${etiqueta}`));
        contenido.appendChild(label);
      }
      contenido.appendChild(el('p', 'pista',
        'La versión imprimible se descarga además del PNG en color, con fondo blanco, nodos en grises y textos en negro.'));
      const accionesModal = el('div', 'modal-acciones');
      const btnCerrar = el('button', 'btn btn-primario btn-mini', 'Guardar opciones');
      btnCerrar.type = 'button';
      accionesModal.appendChild(btnCerrar);
      contenido.appendChild(accionesModal);
      const modal = mostrarModal(contenido);
      btnCerrar.addEventListener('click', modal.cerrar);
    }

    function encuadreParaNodos(nodos, anchoBase, altoBase, margen = 70, aristasDibujo = null) {
      if (!nodos.length) {
        return { escala: 1, panX: anchoBase / 2, panY: altoBase / 2 };
      }
      let minX = Infinity;
      let minY = Infinity;
      let maxX = -Infinity;
      let maxY = -Infinity;
      const ids = new Set(nodos.map((n) => n.id));
      for (const n of nodos) {
        const r = radioNodo(n) + 6;
        minX = Math.min(minX, n.x - r);
        minY = Math.min(minY, n.y - r);
        maxX = Math.max(maxX, n.x + r);
        maxY = Math.max(maxY, n.y + r);
      }
      /* Las curvas de relaciones paralelas también forman parte de lo que se
         exporta. Incluir sus extremos evita que el PNG corte los arcos por
         abajo o por los lados, aunque los nodos queden dentro del lienzo. */
      if (aristasDibujo) {
        for (const a of aristasDibujo) {
          if (!ids.has(a.origen) || !ids.has(a.destino)) continue;
          const geometria = geometriaArista(a);
          if (!geometria) continue;
          const candidatosT = [0.5];
          for (const eje of ['x', 'y']) {
            const p0 = eje === 'x' ? geometria.o.x : geometria.o.y;
            const p1 = eje === 'x' ? geometria.d.x : geometria.d.y;
            const control = eje === 'x' ? geometria.cx : geometria.cy;
            const denominador = p0 - 2 * control + p1;
            if (Math.abs(denominador) > 1e-6) {
              const t = (p0 - control) / denominador;
              if (t > 0 && t < 1) candidatosT.push(t);
            }
          }
          for (const t of candidatosT) {
            const punto = puntoCuadratica(geometria, t);
            minX = Math.min(minX, punto.x);
            minY = Math.min(minY, punto.y);
            maxX = Math.max(maxX, punto.x);
            maxY = Math.max(maxY, punto.y);
          }
        }
      }
      const anchoMundo = Math.max(maxX - minX, 1);
      const altoMundo = Math.max(maxY - minY, 1);
      const escala = Math.min(3, Math.max(0.2, Math.min(
        (anchoBase - margen * 2) / anchoMundo,
        (altoBase - margen * 2) / altoMundo
      )));
      return {
        escala,
        panX: anchoBase / 2 - ((minX + maxX) / 2) * escala,
        panY: altoBase / 2 - ((minY + maxY) / 2) * escala,
      };
    }

    function construirLienzoExportacion(soloSeleccion, imprimible) {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const anchoBase = ancho || 1200;
      const altoBase = alto || 800;
      const maxPixeles = 24_000_000;
      let factor = 2;
      const base = Math.max(1, anchoBase * altoBase * dpr * dpr);
      if (base * factor * factor > maxPixeles) factor = Math.max(1, Math.sqrt(maxPixeles / base));
      const lienzo = document.createElement('canvas');
      lienzo.width = Math.round(anchoBase * dpr * factor);
      lienzo.height = Math.round(altoBase * dpr * factor);
      const contexto = lienzo.getContext('2d');
      contexto.setTransform(dpr * factor, 0, 0, dpr * factor, 0, 0);

      if (soloSeleccion) {
        const nodosSub = [
          seleccion,
          ...[...vecinosSeleccion].map((id) => mundo.get(id)).filter(Boolean),
        ];
        const idsSub = new Set(nodosSub.map((n) => n.id));
        const aristasSub = aristasVisibles.filter((a) => (
          (a.origen === seleccion.id && idsSub.has(a.destino))
          || (a.destino === seleccion.id && idsSub.has(a.origen))
        ));
        const aristasDibujo = agruparAristas(aristasSub);
        const encuadre = encuadreParaNodos(nodosSub, anchoBase, altoBase, 70, aristasDibujo);
        dibujarEn(contexto, true, {
          nodos: nodosSub,
          aristas: aristasDibujo,
          seleccion,
          vecinos: vecinosSeleccion,
          seleccionArista: null,
          escala: encuadre.escala,
          panX: encuadre.panX,
          panY: encuadre.panY,
          ancho: anchoBase,
          alto: altoBase,
          forzarEtiquetasNodo: true,
          imprimible,
        });
      } else {
        const encuadre = encuadreParaNodos(nodosVisibles, anchoBase, altoBase, 70, aristasVisuales);
        dibujarEn(contexto, true, {
          nodos: nodosVisibles,
          aristas: aristasVisuales,
          seleccion: null,
          seleccionArista: null,
          escala: encuadre.escala,
          panX: encuadre.panX,
          panY: encuadre.panY,
          ancho: anchoBase,
          alto: altoBase,
          imprimible,
        });
      }
      dibujarCabeceraExportacion(contexto, anchoBase, altoBase, imprimible);
      return lienzo;
    }

    function descargarBlob(blob, nombre) {
      const url = URL.createObjectURL(blob);
      const enlace = document.createElement('a');
      enlace.download = nombre;
      enlace.href = url;
      enlace.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }

    function exportarPNG(soloSeleccion = false) {
      if (soloSeleccion && !seleccion) return;
      if (btnExportar.disabled) return;
      btnExportar.disabled = true;
      btnExportarSeleccion.disabled = true;
      const versiones = [false];
      if (opcionesExportacion.incluirImprimible) versiones.push(true);
      const prefijo = soloSeleccion ? 'grafo-himago-seleccion' : 'grafo-himago';
      let pendientes = versiones.length;
      for (const imprimible of versiones) {
        const lienzo = construirLienzoExportacion(soloSeleccion, imprimible);
        const nombre = `${prefijo}${imprimible ? '-imprimible' : ''}.png`;
        lienzo.toBlob((blob) => {
          if (blob) descargarBlob(blob, nombre);
          else aviso('No se pudo generar la imagen del grafo.', 'error');
          pendientes--;
          if (pendientes === 0) {
            btnExportar.disabled = false;
            actualizarBotonExportarSeleccion();
          }
        }, 'image/png');
      }
    }

    btnExportar.addEventListener('click', () => exportarPNG(false));
    btnExportarSeleccion.addEventListener('click', () => exportarPNG(true));
    btnExportarOpciones.addEventListener('click', () => abrirOpcionesExportacion());
    btnDireccion.addEventListener('click', () => {
      mostrarDireccion = !mostrarDireccion;
      btnDireccion.classList.toggle('modo-activo', mostrarDireccion);
      btnDireccion.setAttribute('aria-pressed', String(mostrarDireccion));
      despertar();
    });
    btnTabla.addEventListener('click', () => mostrarTablaRed());
    btnVistas.addEventListener('click', () => abrirVistasGrafo());
    btnLimpiarFiltros.addEventListener('click', () => {
      restablecerFiltrosVisuales();
      aviso('Filtros visuales restablecidos', 'exito');
    });
    btnMostrarOcultos.addEventListener('click', () => {
      nodosOcultos.clear();
      reiniciarFiltro();
      despertar();
    });
    btnSalirEgo.addEventListener('click', salirEgo);

    /* ---------------- Panel de información ---------------- */

    function ocultarInfo() {
      panel.classList.add('oculto');
      panelAristaActual = false;
    }

    function botonPanel(etiqueta, clase, accion) {
      const boton = el('button', clase || 'btn btn-mini', etiqueta);
      boton.type = 'button';
      boton.addEventListener('click', accion);
      return boton;
    }

    function fuentesDeArista(a, contenedor) {
      if (!Array.isArray(a.fuentes) || !a.fuentes.length) return;
      const bloque = el('div', 'grafo-info-fuentes');
      bloque.appendChild(el('span', 'grafo-info-etiqueta', 'Fuentes'));
      for (const fuente of a.fuentes) {
        bloque.appendChild(botonPanel(
          fuente.titulo || `Fuente ${fuente.id}`,
          'btn btn-mini grafo-info-fuente',
          () => navegarARegistro('fuente', fuente.id)
        ));
      }
      contenedor.appendChild(bloque);
    }

    function seleccionarArista(a) {
      if (!a) return;
      let objetivo = a;
      if (esGrupoArista(objetivo)) {
        if (objetivo.cantidad === 1) objetivo = objetivo.aristas[0];
        else if (paresDesagregados.has(objetivo.clave)) objetivo = objetivo.aristas[0];
      }
      seleccion = null;
      seleccionFijada = null;
      seleccionArista = objetivo;
      recalcularAristas();
      const actual = seleccionArista || objetivo;
      if (esGrupoArista(actual) && actual.cantidad > 1) {
        mostrarInfoAristaGrupo(actual);
      } else {
        mostrarInfoArista(esGrupoArista(actual) ? actual.aristas[0] : actual);
      }
      actualizarBotonExportarSeleccion();
      despertar();
    }

    const NOMBRE_PROCEDENCIA = {
      MANUAL: ['manual', 'manuales'],
      EDITADA: ['editada', 'editadas'],
      AUTOMATIZADA: ['automatizada', 'automatizadas'],
    };

    function periodoVinculo(grupo) {
      if (grupo.anioDesde != null && grupo.anioHasta != null) {
        return grupo.anioDesde === grupo.anioHasta
          ? String(grupo.anioDesde)
          : `${grupo.anioDesde}–${grupo.anioHasta}`;
      }
      if (grupo.anioDesde != null) return String(grupo.anioDesde);
      if (grupo.anioHasta != null) return String(grupo.anioHasta);
      if (grupo.fechas && grupo.fechas.length === 1) return grupo.fechas[0];
      if (grupo.fechas && grupo.fechas.length > 1) return `${grupo.fechas.length} fechas`;
      return '';
    }

    function resumenProcedenciaVinculo(grupo) {
      const partes = [...grupo.procedencias.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([procedencia, cuenta]) => {
          const nombres = NOMBRE_PROCEDENCIA[procedencia];
          const nombre = nombres
            ? (cuenta === 1 ? nombres[0] : nombres[1])
            : procedencia.toLowerCase();
          return `${nombre} (${cuenta})`;
        });
      return partes.join(' · ');
    }

    function abrirRelacionesVinculo(grupo) {
      if (!grupo) return;
      const origen = mundo.get(grupo.origen);
      const destino = mundo.get(grupo.destino);
      const nombreOrigen = origen ? origen.etiqueta : grupo.origen;
      const nombreDestino = destino ? destino.etiqueta : grupo.destino;
      const contenido = el('div', 'modal-contenido grafo-vinculo-modal');
      contenido.appendChild(el('h3', 'modal-titulo',
        `Relaciones entre ${nombreOrigen} y ${nombreDestino}`));
      contenido.appendChild(el('p', 'pista',
        `${grupo.cantidad} relaciones · ${periodoVinculo(grupo) || 'sin periodo'} · ${resumenProcedenciaVinculo(grupo)}`));

      const tabla = document.createElement('table');
      tabla.className = 'tabla-grafo-accesible grafo-tabla-vinculo';
      const thead = document.createElement('thead');
      const cab = document.createElement('tr');
      for (const titulo of ['Fecha', 'Tipo', 'Sentido', 'Procedencia', 'Notas', 'Fuentes']) {
        const th = document.createElement('th');
        th.scope = 'col';
        th.textContent = titulo;
        cab.appendChild(th);
      }
      thead.appendChild(cab);
      tabla.appendChild(thead);

      const tbody = document.createElement('tbody');
      const relaciones = [...grupo.aristas].sort((a, b) => {
        const anioA = a.anioDesde == null ? Infinity : a.anioDesde;
        const anioB = b.anioDesde == null ? Infinity : b.anioDesde;
        if (anioA !== anioB) return anioA - anioB;
        return String(a.fecha || '').localeCompare(String(b.fecha || ''), 'es');
      });
      for (const arista of relaciones) {
        const fila = document.createElement('tr');
        fila.tabIndex = 0;
        fila.setAttribute('role', 'button');
        fila.title = 'Seleccionar esta relación en el grafo';
        const o = mundo.get(arista.origen);
        const d = mundo.get(arista.destino);
        for (const valor of [
          arista.fecha || '',
          arista.tipo || '',
          `${o ? o.etiqueta : arista.origen} ${
            relacionBidireccional(arista.tipo) ? '↔' : '→'
          } ${d ? d.etiqueta : arista.destino}`,
          arista.procedencia || 'MANUAL',
          arista.notas || '',
          (arista.fuentes || []).map((f) => f.titulo).filter(Boolean).join(', '),
        ]) {
          fila.appendChild(Object.assign(document.createElement('td'), { textContent: valor }));
        }
        const elegir = () => {
          modal.cerrar();
          seleccionarArista(arista);
        };
        fila.addEventListener('click', elegir);
        fila.addEventListener('keydown', (ev) => {
          if (ev.key === 'Enter' || ev.key === ' ') {
            ev.preventDefault();
            elegir();
          }
        });
        tbody.appendChild(fila);
      }
      tabla.appendChild(tbody);
      contenido.appendChild(tabla);

      const acciones = el('div', 'modal-acciones');
      const btnDesagregar = el('button', 'btn btn-mini',
        paresDesagregados.has(grupo.clave) ? 'Agrupar en el grafo' : 'Desagregar en el grafo');
      btnDesagregar.type = 'button';
      btnDesagregar.addEventListener('click', () => {
        modal.cerrar();
        alternarDesagregadoVinculo(grupo);
      });
      const btnCerrar = el('button', 'btn btn-primario btn-mini', 'Cerrar');
      btnCerrar.type = 'button';
      acciones.append(btnDesagregar, btnCerrar);
      contenido.appendChild(acciones);
      const modal = mostrarModal(contenido);
      btnCerrar.addEventListener('click', modal.cerrar);
    }

    function alternarDesagregadoVinculo(grupo) {
      if (!grupo) return;
      const estabaDesagregado = paresDesagregados.has(grupo.clave);
      if (estabaDesagregado) paresDesagregados.delete(grupo.clave);
      else paresDesagregados.add(grupo.clave);
      seleccionArista = null;
      recalcularAristas();
      if (estabaDesagregado) {
        const vigente = aristasVisuales.find(
          (a) => esGrupoArista(a) && a.clave === grupo.clave
        );
        if (vigente) {
          seleccionArista = vigente;
          mostrarInfoAristaGrupo(vigente);
        } else {
          ocultarInfo();
        }
      } else {
        const primera = aristasVisuales.find(
          (a) => !esGrupoArista(a) && claveVinculo(a) === grupo.clave
        );
        if (primera) {
          seleccionArista = primera;
          mostrarInfoArista(primera);
        } else {
          ocultarInfo();
        }
      }
      actualizarContador();
      despertar();
    }

    function mostrarInfoAristaGrupo(grupo) {
      if (!grupo) return;
      panel.classList.remove('oculto');
      panelAristaActual = true;
      panel.innerHTML = '';
      const origen = mundo.get(grupo.origen);
      const destino = mundo.get(grupo.destino);
      panel.appendChild(el('div', 'grafo-info-tipo',
        `Vínculo · ${grupo.cantidad} ${grupo.cantidad === 1 ? 'relación' : 'relaciones'}`));
      panel.appendChild(el('h3', '',
        `${origen ? origen.etiqueta : '?'} ↔ ${destino ? destino.etiqueta : '?'}`));

      const tipos = [...grupo.tipos.entries()].sort((a, b) => b[1] - a[1]);
      const bloqueTipos = el('div', 'grafo-info-tipos');
      bloqueTipos.appendChild(el('span', 'grafo-info-etiqueta', 'Tipos de relación'));
      for (const [tipo, cuenta] of tipos.slice(0, 6)) {
        bloqueTipos.appendChild(el('div', 'grafo-info-tipo-linea', `${tipo} · ${cuenta}`));
      }
      if (tipos.length > 6) {
        bloqueTipos.appendChild(el('div', 'grafo-info-tipo-linea',
          `y ${tipos.length - 6} tipos más`));
      }
      panel.appendChild(bloqueTipos);

      const periodo = periodoVinculo(grupo);
      if (periodo) panel.appendChild(el('p', 'grafo-info-detalle', `Periodo: ${periodo}`));
      panel.appendChild(el('p', 'grafo-info-detalle',
        `Procedencia: ${resumenProcedenciaVinculo(grupo)}`));

      const simetrica = Boolean(grupo.bidireccional);
      const direcciones = [];
      if (simetrica) {
        direcciones.push(`${origen ? origen.etiqueta : '?'} ↔ ${destino ? destino.etiqueta : '?'} · ${grupo.soloBidireccional ? 'relación bidireccional' : 'incluye relaciones bidireccionales'}`);
        const registros = [];
        if (grupo.ida) registros.push(`${origen ? origen.etiqueta : '?'} → ${destino ? destino.etiqueta : '?'}: ${grupo.ida}`);
        if (grupo.vuelta) registros.push(`${destino ? destino.etiqueta : '?'} → ${origen ? origen.etiqueta : '?'}: ${grupo.vuelta}`);
        if (registros.length) direcciones.push(`Registros capturados: ${registros.join(' · ')}`);
      } else {
        if (grupo.ida) {
          direcciones.push(`${origen ? origen.etiqueta : '?'} → ${destino ? destino.etiqueta : '?'}: ${grupo.ida}`);
        }
        if (grupo.vuelta) {
          direcciones.push(`${destino ? destino.etiqueta : '?'} → ${origen ? origen.etiqueta : '?'}: ${grupo.vuelta}`);
        }
      }
      if (direcciones.length) {
        const bloqueDireccion = el('div', 'grafo-info-direcciones');
        bloqueDireccion.appendChild(el('span', 'grafo-info-etiqueta', 'Dirección'));
        for (const linea of direcciones) {
          bloqueDireccion.appendChild(el('div', 'grafo-info-direccion', linea));
        }
        panel.appendChild(bloqueDireccion);
      }

      if (grupo.fuentes.length) {
        const bloqueFuentes = el('div', 'grafo-info-fuentes');
        bloqueFuentes.appendChild(el('span', 'grafo-info-etiqueta',
          `Fuentes (${grupo.fuentes.length})`));
        for (const fuente of grupo.fuentes.slice(0, 6)) {
          if (fuente.id == null) {
            bloqueFuentes.appendChild(el('span', 'grafo-info-fuente-resumen', fuente.titulo));
          } else {
            bloqueFuentes.appendChild(botonPanel(
              fuente.titulo || `Fuente ${fuente.id}`,
              'btn btn-mini grafo-info-fuente',
              () => navegarARegistro('fuente', fuente.id)
            ));
          }
        }
        if (grupo.fuentes.length > 6) {
          bloqueFuentes.appendChild(el('span', 'grafo-info-fuente-resumen',
            `y ${grupo.fuentes.length - 6} fuentes más`));
        }
        panel.appendChild(bloqueFuentes);
      }

      const acciones = el('div', 'grafo-info-acciones');
      if (origen) {
        acciones.appendChild(botonPanel(
          `Abrir ficha de ${origen.etiqueta}`,
          'btn btn-mini',
          () => navegarARegistro(origen.tipo, origen.entidadId)
        ));
      }
      if (destino) {
        acciones.appendChild(botonPanel(
          `Abrir ficha de ${destino.etiqueta}`,
          'btn btn-mini',
          () => navegarARegistro(destino.tipo, destino.entidadId)
        ));
      }
      acciones.appendChild(botonPanel(
        `Ver las ${grupo.cantidad} relaciones`,
        'btn btn-mini',
        () => abrirRelacionesVinculo(grupo)
      ));
      acciones.appendChild(botonPanel(
        paresDesagregados.has(grupo.clave) ? 'Agrupar en el grafo' : 'Desagregar en el grafo',
        'btn btn-mini',
        () => alternarDesagregadoVinculo(grupo)
      ));
      panel.appendChild(acciones);
    }

    function mostrarInfoArista(a) {
      if (!a) return;
      panel.classList.remove('oculto');
      panelAristaActual = true;
      panel.innerHTML = '';
      const origen = mundo.get(a.origen);
      const destino = mundo.get(a.destino);
      const simetrica = relacionBidireccional(a.tipo);
      panel.appendChild(el('div', 'grafo-info-tipo', a.procedencia || 'Relación'));
      panel.appendChild(el('h3', '', `${origen ? origen.etiqueta : '?'} ${simetrica ? '↔' : '→'} ${destino ? destino.etiqueta : '?'}`));
      if (a.tipo) panel.appendChild(el('p', 'grafo-info-detalle', a.tipo));
      if (simetrica) {
        panel.appendChild(el('p', 'grafo-info-detalle',
          'Relación bidireccional: se representa con flecha en ambos sentidos.'));
      }
      if (a.fecha) panel.appendChild(el('p', 'grafo-info-detalle', `Fecha: ${a.fecha}`));
      fuentesDeArista(a, panel);
      if (a.notas) {
        const notas = el('div', 'grafo-info-notas');
        notas.appendChild(el('span', 'grafo-info-etiqueta', 'Notas'));
        notas.appendChild(el('p', '', a.notas));
        panel.appendChild(notas);
      }
      const acciones = el('div', 'grafo-info-acciones');
      if (origen) {
        acciones.appendChild(botonPanel(
          `Abrir ficha de ${origen.etiqueta}`,
          'btn btn-mini',
          () => navegarARegistro(origen.tipo, origen.entidadId)
        ));
      }
      if (destino) {
        acciones.appendChild(botonPanel(
          `Abrir ficha de ${destino.etiqueta}`,
          'btn btn-mini',
          () => navegarARegistro(destino.tipo, destino.entidadId)
        ));
      }
      const clave = claveVinculo(a);
      if (paresDesagregados.has(clave)) {
        const grupo = agruparAristas(
          aristasVisibles.filter((arista) => claveVinculo(arista) === clave)
        )[0];
        if (grupo && grupo.cantidad > 1) {
          acciones.appendChild(botonPanel(
            `Agrupar las ${grupo.cantidad} relaciones`,
            'btn btn-mini',
            () => alternarDesagregadoVinculo(grupo)
          ));
        }
      }
      panel.appendChild(acciones);
    }

    function mostrarInfo(n) {
      panel.classList.remove('oculto');
      panelAristaActual = false;
      panel.innerHTML = '';
      panel.appendChild(el('div', `grafo-info-tipo color-${n.tipo}`, NOMBRE_TIPO[n.tipo]));
      panel.appendChild(el('h3', '', n.etiqueta));
      if (n.identificador) panel.appendChild(el('div', 'grafo-info-id', n.identificador));
      if (n.tipo === 'persona') {
        if (n.genero) panel.appendChild(el('p', 'grafo-info-detalle', `Género: ${n.genero}`));
      } else if (n.tipoEntidad) {
        panel.appendChild(el('p', 'grafo-info-detalle', `Tipo: ${n.tipoEntidad}`));
      }
      if (n.notas) {
        const notas = el('div', 'grafo-info-notas');
        notas.appendChild(el('span', 'grafo-info-etiqueta', 'Notas'));
        notas.appendChild(el('p', '', n.notas));
        panel.appendChild(notas);
      }

      const propias = aristasVisibles.filter((a) =>
        a.origen === n.id || a.destino === n.id);
      const gruposPropias = agruparAristas(propias);
      panel.appendChild(el('h4', '',
        `Relaciones (${propias.length} en ${gruposPropias.length} vínculo${gruposPropias.length === 1 ? '' : 's'})`));
      const lista = el('div', 'grafo-info-relaciones');
      if (!propias.length) lista.appendChild(el('div', 'vacio mini', 'Sin relaciones.'));
      /* Un nodo muy conectado no debe congelar el panel: se pintan los
         primeros vínculos y el resto queda accesible desde el botón inferior. */
      const LIMITE_VINCULOS_PANEL = 100;
      for (const grupo of gruposPropias.slice(0, LIMITE_VINCULOS_PANEL)) {
        const esMultiple = grupo.cantidad > 1;
        const representante = esMultiple ? grupo : grupo.aristas[0];
        const linea = el('div', 'grafo-info-relacion');
        linea.tabIndex = 0;
        linea.setAttribute('role', 'button');
        linea.title = esMultiple ? 'Seleccionar este vínculo' : 'Seleccionar esta relación';
        const origen = mundo.get(grupo.origen);
        const destino = mundo.get(grupo.destino);
        const nombreOrigen = origen ? origen.etiqueta : '?';
        const nombreDestino = destino ? destino.etiqueta : '?';
        const simetrica = Boolean(grupo.bidireccional);
        const sentido = simetrica || (grupo.ida && grupo.vuelta)
          ? `${nombreOrigen} ↔ ${nombreDestino}`
          : (grupo.vuelta
            ? `${nombreDestino} → ${nombreOrigen}`
            : `${nombreOrigen} → ${nombreDestino}`);
        const prefijo = esMultiple ? `${grupo.cantidad} × ` : '';
        linea.textContent = `${prefijo}${grupo.tipo} · ${sentido}${!esMultiple && representante.fecha ? ` (${representante.fecha})` : ''}`;
        if (esMultiple) {
          linea.appendChild(el('small', 'grafo-info-procedencia',
            `${resumenProcedenciaVinculo(grupo)}${periodoVinculo(grupo) ? ` · ${periodoVinculo(grupo)}` : ''}`));
        } else if (representante.procedencia) {
          linea.appendChild(el('small', 'grafo-info-procedencia', representante.procedencia));
        }
        if (!esMultiple && Array.isArray(representante.fuentes) && representante.fuentes.length) {
          linea.appendChild(el('small', 'grafo-info-fuente-resumen',
            `Fuentes: ${representante.fuentes.map((f) => f.titulo).join(', ')}`));
        } else if (esMultiple && grupo.fuentes.length) {
          linea.appendChild(el('small', 'grafo-info-fuente-resumen',
            `Fuentes: ${grupo.fuentes.length}`));
        }
        const abrirRelacion = () => seleccionarArista(representante);
        linea.addEventListener('click', abrirRelacion);
        linea.addEventListener('keydown', (ev) => {
          if (ev.key === 'Enter' || ev.key === ' ') {
            ev.preventDefault();
            abrirRelacion();
          }
        });
        lista.appendChild(linea);
      }
      if (gruposPropias.length > LIMITE_VINCULOS_PANEL) {
        lista.appendChild(el('div', 'pista',
          `Se muestran ${LIMITE_VINCULOS_PANEL} de ${gruposPropias.length} vínculos. Usa «Ver las ${gruposPropias.length} relaciones» para el listado completo.`));
      }
      panel.appendChild(lista);

      if (analisisRSH && typeof analisisRSH.agregarMetricasPanel === 'function') {
        analisisRSH.agregarMetricasPanel(panel, n.id);
      }

      const acciones = el('div', 'grafo-info-acciones');
      acciones.appendChild(botonPanel(
        `Abrir ficha de ${NOMBRE_TIPO[n.tipo].toLowerCase()}`,
        'btn btn-mini',
        () => navegarARegistro(n.tipo, n.entidadId)
      ));
      acciones.appendChild(botonPanel(
        nodosFijados.has(n.id) ? 'Desfijar nodo' : 'Fijar nodo',
        'btn btn-mini',
        () => {
          if (nodosFijados.has(n.id)) nodosFijados.delete(n.id);
          else nodosFijados.add(n.id);
          mostrarInfo(n);
          despertar();
        }
      ));
      acciones.appendChild(botonPanel(
        'Ocultar nodo',
        'btn btn-mini',
        () => {
          nodosOcultos.add(n.id);
          recalcularAristas();
          if (analisisRSH && typeof analisisRSH.alCambiarFiltros === 'function') {
            analisisRSH.alCambiarFiltros();
          }
          ocultarInfo();
          actualizarContador();
          despertar();
        }
      ));
      acciones.appendChild(botonPanel('Vecindad 1 salto', 'btn btn-mini', () => activarEgo(n, 1)));
      acciones.appendChild(botonPanel('Vecindad 2 saltos', 'btn btn-mini', () => activarEgo(n, 2)));
      panel.appendChild(acciones);
    }

    function activarEgo(n, saltos) {
      if (!n) return;
      focoEgo = { id: n.id, etiqueta: n.etiqueta, saltos };
      seleccion = n;
      recalcularAristas();
      if (analisisRSH && typeof analisisRSH.alCambiarFiltros === 'function') {
        analisisRSH.alCambiarFiltros();
      }
      mostrarInfo(n);
      actualizarContador();
      recalentar();
    }

    function salirEgo() {
      focoEgo = null;
      recalcularAristas();
      if (analisisRSH && typeof analisisRSH.alCambiarFiltros === 'function') {
        analisisRSH.alCambiarFiltros();
      }
      if (seleccion && !seleccion.oculto) mostrarInfo(seleccion);
      actualizarContador();
      recalentar();
    }

    const CLAVE_VISTAS_GRAFO = 'himago-vistas-grafo';

    function leerVistasGrafo() {
      try {
        const crudo = JSON.parse(localStorage.getItem(CLAVE_VISTAS_GRAFO) || '{}');
        const lista = crudo && crudo[proyecto.id];
        return Array.isArray(lista) ? lista : [];
      } catch {
        return [];
      }
    }

    function escribirVistasGrafo(lista) {
      try {
        const crudo = JSON.parse(localStorage.getItem(CLAVE_VISTAS_GRAFO) || '{}');
        const mapa = crudo && typeof crudo === 'object' && !Array.isArray(crudo) ? crudo : {};
        mapa[proyecto.id] = lista;
        localStorage.setItem(CLAVE_VISTAS_GRAFO, JSON.stringify(mapa));
        return true;
      } catch {
        aviso('No se pudo guardar la vista en este equipo.', 'error');
        return false;
      }
    }

    function capturarVista(nombre) {
      return {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        nombre,
        fecha: new Date().toISOString(),
        visibles: { ...visibles },
        categoriasVisibles: { ...categoriasVisibles },
        filtroEntidad,
        filtroRelacion,
        filtroProcedencia,
        rango: { min: rangoActivo.min, max: rangoActivo.max },
        excluirSinDatos,
        focoEgo: focoEgo ? { ...focoEgo } : null,
        nodosOcultos: [...nodosOcultos],
        nodosFijados: [...nodosFijados],
        vista: { escala, panX, panY },
        analisis: analisisRSH && typeof analisisRSH.capturarConfig === 'function'
          ? analisisRSH.capturarConfig()
          : null,
      };
    }

    function aplicarVista(vista) {
      if (!vista || typeof vista !== 'object') return;
      if (refsTiempo && typeof refsTiempo.detener === 'function') refsTiempo.detener();
      if (vista.visibles) {
        for (const tipo of Object.keys(visibles)) {
          visibles[tipo] = vista.visibles[tipo] !== false;
        }
      }
      if (vista.categoriasVisibles) {
        for (const categoria of Object.keys(categoriasVisibles)) {
          categoriasVisibles[categoria] = vista.categoriasVisibles[categoria] !== false;
        }
      }
      for (const chip of chipsEntidad) chip.classList.toggle('activo', visibles[chip.dataset.tipo] !== false);
      for (const chip of chipsCategoria) {
        chip.classList.toggle('activo', categoriasVisibles[chip.dataset.categoria] !== false);
      }
      filtroEntidad = typeof vista.filtroEntidad === 'string' ? vista.filtroEntidad : '';
      inputEntidad.value = filtroEntidad;
      filtroRelacion = typeof vista.filtroRelacion === 'string' ? vista.filtroRelacion : '';
      inputRelacion.value = vista.filtroRelacion || '';
      filtroProcedencia = ['manuales', 'editadas', 'automatizadas'].includes(vista.filtroProcedencia)
        ? vista.filtroProcedencia
        : 'todas';
      selProcedenciaGrafo.value = filtroProcedencia;
      excluirSinDatos = Boolean(vista.excluirSinDatos);
      btnExcluirSinDatos.classList.toggle('modo-activo', excluirSinDatos);
      btnExcluirSinDatos.setAttribute('aria-pressed', String(excluirSinDatos));
      if (vista.rango && refsTiempo && typeof refsTiempo.aplicar === 'function') {
        refsTiempo.aplicar(vista.rango.min, vista.rango.max);
      }
      focoEgo = vista.focoEgo && mundo.has(vista.focoEgo.id) ? { ...vista.focoEgo } : null;
      nodosOcultos.clear();
      for (const id of Array.isArray(vista.nodosOcultos) ? vista.nodosOcultos : []) {
        if (mundo.has(id)) nodosOcultos.add(id);
      }
      nodosFijados.clear();
      for (const id of Array.isArray(vista.nodosFijados) ? vista.nodosFijados : []) {
        if (mundo.has(id)) nodosFijados.add(id);
      }
      if (vista.vista && Number.isFinite(Number(vista.vista.escala))) {
        escala = Math.max(0.2, Math.min(3, Number(vista.vista.escala)));
        panX = Number(vista.vista.panX) || 0;
        panY = Number(vista.vista.panY) || 0;
        vistaManual = true;
      }
      if (analisisRSH && typeof analisisRSH.aplicarConfig === 'function') {
        analisisRSH.aplicarConfig(vista.analisis);
      }
      reiniciarFiltro();
      recalentar();
      despertar();
    }

    function abrirVistasGrafo() {
      const contenido = el('div', 'modal-contenido grafo-vistas-modal');
      contenido.appendChild(el('h3', 'modal-titulo', 'Vistas del grafo'));
      contenido.appendChild(el('p', 'pista',
        'Guarda la combinación actual de filtros, temporalidad, nodos ocultos/fijados y configuración de Análisis RSH. Las vistas se guardan en este equipo.'));
      const campo = el('div', 'campo');
      campo.appendChild(el('label', '', 'Nombre de la vista'));
      const entrada = el('input', 'entrada');
      entrada.placeholder = 'Ej.: Red de 1520-1560 sin lugares';
      campo.appendChild(entrada);
      contenido.appendChild(campo);
      const acciones = el('div', 'modal-acciones');
      const btnGuardar = el('button', 'btn btn-primario btn-mini', 'Guardar vista actual');
      btnGuardar.type = 'button';
      const btnCerrar = el('button', 'btn btn-mini', 'Cerrar');
      btnCerrar.type = 'button';
      acciones.append(btnGuardar, btnCerrar);
      contenido.appendChild(acciones);
      const lista = el('div', 'grafo-vistas-lista');
      contenido.appendChild(lista);
      const modal = mostrarModal(contenido);

      const renderLista = () => {
        lista.innerHTML = '';
        const vistas = leerVistasGrafo();
        if (!vistas.length) {
          lista.appendChild(el('p', 'pista', 'No hay vistas guardadas en este proyecto.'));
          return;
        }
        for (const vista of vistas) {
          const fila = el('div', 'grafo-vista');
          const info = el('div', 'grafo-vista-info');
          info.appendChild(el('strong', '', vista.nombre || 'Vista sin nombre'));
          info.appendChild(el('small', '', formatearFecha(vista.fecha)));
          const botones = el('div', 'grafo-vista-acciones');
          const aplicar = el('button', 'btn btn-mini', 'Aplicar');
          aplicar.type = 'button';
          aplicar.addEventListener('click', () => {
            aplicarVista(vista);
            modal.cerrar();
            aviso(`Vista «${vista.nombre}» aplicada`, 'exito');
          });
          const eliminar = el('button', 'btn btn-mini btn-peligroso', 'Eliminar');
          eliminar.type = 'button';
          eliminar.addEventListener('click', async () => {
            const ok = await confirmar(`¿Eliminar la vista «${vista.nombre}»?`, 'Eliminar vista');
            if (!ok) return;
            escribirVistasGrafo(leerVistasGrafo().filter((v) => v.id !== vista.id));
            renderLista();
          });
          botones.append(aplicar, eliminar);
          fila.append(info, botones);
          lista.appendChild(fila);
        }
      };

      btnGuardar.addEventListener('click', () => {
        const nombre = entrada.value.trim();
        if (!nombre) {
          aviso('Escribe un nombre para la vista.', 'error');
          return;
        }
        const vista = capturarVista(nombre);
        const vistas = [vista, ...leerVistasGrafo()];
        if (!escribirVistasGrafo(vistas)) return;
        entrada.value = '';
        renderLista();
        aviso(`Vista «${nombre}» guardada`, 'exito');
      });
      btnCerrar.addEventListener('click', modal.cerrar);
      renderLista();
    }

    function filasTablaRed() {
      const vinculosPorNodo = new Map();
      for (const a of aristasVisibles) {
        if (!vinculosPorNodo.has(a.origen)) vinculosPorNodo.set(a.origen, new Set());
        if (!vinculosPorNodo.has(a.destino)) vinculosPorNodo.set(a.destino, new Set());
        vinculosPorNodo.get(a.origen).add(a.destino);
        vinculosPorNodo.get(a.destino).add(a.origen);
      }
      const entidades = nodosVisibles.map((n) => [
        n.etiqueta || '',
        NOMBRE_TIPO[n.tipo] || n.tipo || '',
        n.identificador || '',
        (n.tipo === 'persona' ? n.genero : n.tipoEntidad) || '',
        n.notas || '',
        String(n.grado || 0),
        String(vinculosPorNodo.get(n.id)?.size || 0),
      ]);
      const relaciones = aristasVisibles.map((a) => {
        const origen = mundo.get(a.origen);
        const destino = mundo.get(a.destino);
        const fecha = a.fecha
          || [a.anioDesde, a.anioHasta].filter((v) => v != null).join('–');
        return [
          origen ? origen.etiqueta : a.origen,
          destino ? destino.etiqueta : a.destino,
          a.tipo || '',
          relacionBidireccional(a.tipo) ? 'Bidireccional' : 'Unidireccional',
          fecha,
          a.procedencia || '',
          (a.fuentes || []).map((f) => f.titulo).filter(Boolean).join(', '),
        ];
      });
      return {
        entidades,
        relaciones,
        vinculos: contarVinculos(aristasVisibles),
      };
    }

    function nombreExportacionTabla(extension) {
      const base = String(proyecto.nombre || 'proyecto')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^\w-]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 80) || 'proyecto';
      return `grafo-tabla-${base}.${extension}`;
    }

    function celdaCSV(valor) {
      let texto = String(valor == null ? '' : valor);
      if (/^[=+\-@\t\r]/.test(texto) && !/^-?\d+(?:[.,]\d+)?$/.test(texto)) {
        texto = `'${texto}`;
      }
      return `"${texto.replace(/"/g, '""')}"`;
    }

    function escaparXML(valor) {
      return String(valor == null ? '' : valor)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;')
        .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');
    }

    function hojaSpreadsheet(nombre, columnas, filas, anchos = []) {
      const filasXML = [];
      const celdasCabecera = columnas
        .map((columna) => `<Cell ss:StyleID="sHeader"><Data ss:Type="String">${escaparXML(columna)}</Data></Cell>`)
        .join('');
      filasXML.push(`<Row ss:Height="18">${celdasCabecera}</Row>`);
      for (const fila of filas) {
        const celdas = fila
          .map((valor) => `<Cell ss:StyleID="sText"><Data ss:Type="String">${escaparXML(valor)}</Data></Cell>`)
          .join('');
        filasXML.push(`<Row>${celdas}</Row>`);
      }
      const columnasXML = anchos
        .map((ancho) => `<Column ss:AutoFitWidth="0" ss:Width="${Number(ancho) || 80}"/>`)
        .join('');
      return `<Worksheet ss:Name="${escaparXML(nombre)}"><Table>${columnasXML}${filasXML.join('')}</Table>`
        + '<WorksheetOptions xmlns="urn:schemas-microsoft-com:office:excel"><FreezePanes/><FrozenNoSplit/>'
        + '<SplitHorizontal>1</SplitHorizontal><TopRowBottomPane>1</TopRowBottomPane><ActivePane>2</ActivePane>'
        + '</WorksheetOptions></Worksheet>';
    }

    function contenidoSpreadsheet(datos) {
      const resumen = [
        ['Proyecto', proyecto.nombre || ''],
        ['Generado', new Date().toLocaleString('es-ES')],
        ['Entidades visibles', datos.entidades.length],
        ['Relaciones visibles', datos.relaciones.length],
        ['Vínculos dibujados', datos.vinculos],
        ['Filtros', resumenFiltros.textContent || 'Sin filtros activos'],
      ];
      return '<?xml version="1.0" encoding="UTF-8"?>\n'
        + '<?mso-application progid="Excel.Sheet"?>\n'
        + '<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"'
        + ' xmlns:o="urn:schemas-microsoft-com:office:office"'
        + ' xmlns:x="urn:schemas-microsoft-com:office:excel"'
        + ' xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"'
        + ' xmlns:html="http://www.w3.org/TR/REC-html40">'
        + '<Styles>'
        + '<Style ss:ID="sHeader"><Font ss:Bold="1" ss:Color="#FFFFFF"/>'
        + '<Interior ss:Color="#333333" ss:Pattern="Solid"/>'
        + '<Alignment ss:Vertical="Center" ss:WrapText="1"/></Style>'
        + '<Style ss:ID="sText"><Alignment ss:Vertical="Top" ss:WrapText="1"/></Style>'
        + '</Styles>'
        + hojaSpreadsheet('Resumen', ['Campo', 'Valor'], resumen, [170, 520])
        + hojaSpreadsheet('Entidades', ['Entidad', 'Tipo', 'ID', 'Género / tipo', 'Notas', 'Relaciones visibles', 'Vínculos'],
          datos.entidades, [240, 110, 110, 120, 260, 100, 90])
        + hojaSpreadsheet('Relaciones', ['Origen', 'Destino', 'Tipo', 'Dirección', 'Fechas', 'Procedencia', 'Fuentes'],
          datos.relaciones, [200, 200, 150, 110, 130, 110, 260])
        + '</Workbook>';
    }

    function crearTablaImpresion(columnas, filas) {
      const tabla = el('table', 'impresion-tabla impresion-grafo-tabla');
      const thead = el('thead');
      const cab = el('tr');
      for (const columna of columnas) {
        const th = el('th', '', columna);
        th.scope = 'col';
        cab.appendChild(th);
      }
      thead.appendChild(cab);
      tabla.appendChild(thead);
      const tbody = el('tbody');
      for (const fila of filas) {
        const tr = el('tr');
        for (const valor of fila) tr.appendChild(el('td', '', valor == null ? '' : String(valor)));
        tbody.appendChild(tr);
      }
      tabla.appendChild(tbody);
      return tabla;
    }

    function imprimirTablaRed() {
      const zona = document.querySelector('#zona-impresion');
      if (!zona || typeof window.print !== 'function') {
        aviso('La impresión no está disponible en esta versión.', 'error');
        return;
      }
      const datos = filasTablaRed();
      zona.innerHTML = '';
      const doc = el('div', 'impresion-ficha impresion-grafo');
      doc.appendChild(el('div', 'impresion-marca', 'H-IMAGO'));
      doc.appendChild(el('h1', 'impresion-titulo', 'Vista de grafo como tabla'));
      doc.appendChild(el('p', 'impresion-meta',
        `${proyecto.nombre || 'Proyecto'} · ${new Date().toLocaleString('es-ES')}`));
      doc.appendChild(el('p', 'impresion-meta',
        `${datos.entidades.length} entidades visibles · ${datos.relaciones.length} relaciones · ${datos.vinculos} vínculos`));
      doc.appendChild(el('p', 'impresion-meta',
        `Filtros: ${resumenFiltros.textContent || 'Sin filtros activos'}`));

      doc.appendChild(el('h2', '', 'Entidades'));
      if (datos.entidades.length) {
        doc.appendChild(crearTablaImpresion(['Entidad', 'Tipo', 'ID', 'Género / tipo', 'Notas', 'Relaciones visibles', 'Vínculos'], datos.entidades));
      } else {
        doc.appendChild(el('p', 'impresion-vacio', 'Sin entidades visibles.'));
      }
      doc.appendChild(el('h2', '', 'Relaciones'));
      if (datos.relaciones.length) {
        doc.appendChild(crearTablaImpresion(
          ['Origen', 'Destino', 'Tipo', 'Dirección', 'Fechas', 'Procedencia', 'Fuentes'],
          datos.relaciones
        ));
      } else {
        doc.appendChild(el('p', 'impresion-vacio', 'Sin relaciones visibles.'));
      }
      doc.appendChild(el('p', 'impresion-pie',
        `Impreso el ${new Date().toLocaleString('es-ES')} · H-IMAGO`));
      zona.appendChild(doc);

      let limpiarTimer = null;
      const limpiar = () => {
        if (limpiarTimer) { clearTimeout(limpiarTimer); limpiarTimer = null; }
        zona.innerHTML = '';
      };
      window.addEventListener('afterprint', limpiar, { once: true });
      limpiarTimer = setTimeout(limpiar, 30000);
      window.print();
    }

    function exportarTablaCSV() {
      if (!window.api || typeof window.api.grafoExportar !== 'function') {
        aviso('La exportación de la tabla no está disponible en esta versión.', 'error');
        return;
      }
      const datos = filasTablaRed();
      const lineas = [];
      const agregar = (fila) => lineas.push(fila.map(celdaCSV).join(','));
      agregar(['Vista de grafo como tabla']);
      agregar(['Proyecto', proyecto.nombre || '']);
      agregar(['Generado', new Date().toLocaleString('es-ES')]);
      agregar(['Entidades visibles', datos.entidades.length]);
      agregar(['Relaciones visibles', datos.relaciones.length]);
      agregar(['Vínculos dibujados', datos.vinculos]);
      agregar(['Filtros', resumenFiltros.textContent || 'Sin filtros activos']);
      lineas.push('');
      agregar(['ENTIDADES']);
      agregar(['Entidad', 'Tipo', 'ID', 'Género / tipo', 'Notas', 'Relaciones visibles', 'Vínculos']);
      for (const fila of datos.entidades) agregar(fila);
      lineas.push('');
      agregar(['RELACIONES']);
      agregar(['Origen', 'Destino', 'Tipo', 'Dirección', 'Fechas', 'Procedencia', 'Fuentes']);
      for (const fila of datos.relaciones) agregar(fila);
      const contenido = `\uFEFF${lineas.join('\r\n')}`;
      const nombre = nombreExportacionTabla('csv');
      llamar(window.api.grafoExportar({ tipo: 'csv', nombre, contenido }))
        .then((res) => {
          if (res && res.cancelado) return;
          aviso(`Tabla exportada a ${res.ruta}`, 'exito');
        })
        .catch((err) => aviso(`No se pudo exportar la tabla: ${err.message}`, 'error'));
    }

    function exportarTablaHojaCalculo() {
      if (!window.api || typeof window.api.grafoExportar !== 'function') {
        aviso('La exportación de la tabla no está disponible en esta versión.', 'error');
        return;
      }
      const datos = filasTablaRed();
      const contenido = contenidoSpreadsheet(datos);
      const nombre = nombreExportacionTabla('xls');
      llamar(window.api.grafoExportar({ tipo: 'xls', nombre, contenido }))
        .then((res) => {
          if (res && res.cancelado) return;
          aviso(`Hoja de cálculo exportada a ${res.ruta}`, 'exito');
        })
        .catch((err) => aviso(`No se pudo exportar la hoja de cálculo: ${err.message}`, 'error'));
    }

    function mostrarTablaRed() {
      const datos = filasTablaRed();
      const contenido = el('div', 'modal-contenido grafo-tabla-modal');
      contenido.appendChild(el('h3', 'modal-titulo', 'Vista de grafo como tabla'));
      contenido.appendChild(el('p', 'pista',
        `Entidades visibles: ${datos.entidades.length} · relaciones visibles: ${datos.relaciones.length} · vínculos dibujados: ${datos.vinculos}.`));
      const crearTabla = (columnas, filas) => {
        const tabla = document.createElement('table');
        tabla.className = 'tabla-grafo-accesible';
        const thead = document.createElement('thead');
        const cab = document.createElement('tr');
        for (const titulo of columnas) {
          const th = document.createElement('th');
          th.scope = 'col';
          th.textContent = titulo;
          cab.appendChild(th);
        }
        thead.appendChild(cab);
        tabla.appendChild(thead);
        const tbody = document.createElement('tbody');
        for (const fila of filas) {
          const tr = document.createElement('tr');
          for (const valor of fila) {
            tr.appendChild(Object.assign(document.createElement('td'), {
              textContent: valor == null ? '' : String(valor),
            }));
          }
          tbody.appendChild(tr);
        }
        tabla.appendChild(tbody);
        return tabla;
      };
      if (!datos.entidades.length) {
        contenido.appendChild(el('div', 'vacio mini', 'No hay entidades visibles con los filtros actuales.'));
      } else {
        contenido.appendChild(el('h4', '', 'Entidades'));
        contenido.appendChild(crearTabla(
          ['Entidad', 'Tipo', 'ID', 'Género / tipo', 'Notas', 'Relaciones visibles', 'Vínculos'],
          datos.entidades.slice(0, 500)
        ));
        if (datos.entidades.length > 500) {
          contenido.appendChild(el('p', 'pista', 'Se muestran las primeras 500 entidades en el modal; la impresión y las exportaciones incluyen todas.'));
        }

        contenido.appendChild(el('h4', '', 'Relaciones'));
        contenido.appendChild(crearTabla(
          ['Origen', 'Destino', 'Tipo', 'Dirección', 'Fechas', 'Procedencia', 'Fuentes'],
          datos.relaciones.slice(0, 500)
        ));
        if (datos.relaciones.length > 500) {
          contenido.appendChild(el('p', 'pista', 'Se muestran las primeras 500 relaciones en el modal; la impresión y las exportaciones incluyen todas.'));
        }
      }
      const fila = el('div', 'modal-acciones grafo-tabla-acciones');
      const imprimir = el('button', 'btn btn-mini', 'Imprimir');
      imprimir.type = 'button';
      imprimir.title = 'Imprimir la tabla de entidades y relaciones visibles';
      const csv = el('button', 'btn btn-mini', 'Exportar CSV');
      csv.type = 'button';
      csv.title = 'Exportar entidades y relaciones visibles a CSV';
      const hoja = el('button', 'btn btn-mini', 'Exportar hoja de cálculo');
      hoja.type = 'button';
      hoja.title = 'Exportar entidades y relaciones visibles a una hoja de cálculo (.xls)';
      const cerrar = el('button', 'btn btn-primario', 'Cerrar');
      cerrar.type = 'button';
      fila.append(imprimir, csv, hoja, cerrar);
      contenido.appendChild(fila);
      const modal = mostrarModal(contenido);
      imprimir.addEventListener('click', imprimirTablaRed);
      csv.addEventListener('click', exportarTablaCSV);
      hoja.addEventListener('click', exportarTablaHojaCalculo);
      cerrar.addEventListener('click', modal.cerrar);
    }

    /* ---------------- Arranque ---------------- */

    if (window.AnalisisRSHUI && typeof window.AnalisisRSHUI.crear === 'function') {
      try {
        analisisRSH = window.AnalisisRSHUI.crear({
          proyecto,
          datos,
          obtenerRedVisible: redVisibleParaAnalisis,
          alSeleccionarNodo: mostrarNodoDesdeAnalisis,
          alAplicarVisual: aplicarVisualAnalisis,
          alRestaurarVisual: restaurarVisualAnalisis,
        });
        acciones.appendChild(analisisRSH.boton);
        escena.appendChild(analisisRSH.panel);
      } catch (err) {
        analisisRSH = null;
        console.warn('[grafo] No se pudo montar Análisis RSH:', err.message);
      }
    }

    limpiarGrafo = () => {
      if (analisisRSH) {
        try { analisisRSH.desmontar(); } catch { /* panel ya retirado */ }
        analisisRSH = null;
      }
      if (temporizadorEntidad) { clearTimeout(temporizadorEntidad); temporizadorEntidad = null; }
      if (temporizadorRelacion) { clearTimeout(temporizadorRelacion); temporizadorRelacion = null; }
      if (refsTiempo && typeof refsTiempo.detener === 'function') refsTiempo.detener();
      if (temporizadorReproduccion) { clearInterval(temporizadorReproduccion); temporizadorReproduccion = null; }
      if (datos?.nodos?.length) {
        const posiciones = new Map();
        for (const [id, nodo] of mundo.entries()) {
          posiciones.set(id, { x: nodo.x, y: nodo.y });
        }
        vistasGrafo.set(proyecto.id, {
          ids: datos.nodos.map((n) => n.id).sort().join('|'),
          posiciones,
          vista: { escala, panX, panY },
        });
        while (vistasGrafo.size > MAX_VISTAS_GRAFO) {
          vistasGrafo.delete(vistasGrafo.keys().next().value);
        }
      }
      cancelado = true;
      if (rafId != null) cancelAnimationFrame(rafId);
      rafId = null;
      if (observador) observador.disconnect();
      observador = null;
      document.removeEventListener('tema:changed', alCambiarTema);
      document.removeEventListener('mousedown', cerrarListaRelacionesFuera);
      window.removeEventListener('pointerup', alSoltar);
    };

    try {
      document.addEventListener('tema:changed', alCambiarTema);
      window.addEventListener('pointerup', alSoltar);
      redimensionar();
      observador = new ResizeObserver(redimensionar);
      observador.observe(escena);
      preparar();
      reiniciarFiltro();
      despertar();

      if (datos.nodos.length === 0) {
        const vacio = el('div', 'grafo-vacio',
          'Aún no hay entidades en el proyecto. Crea personas, instituciones, lugares o patrimonios y añade relaciones para construir la red.');
        escena.appendChild(vacio);
      }

      if (opciones.seleccionar) {
        const objetivo = mundo.get(`${opciones.seleccionar.tipo}:${opciones.seleccionar.id}`);
        if (objetivo) {
          seleccion = objetivo;
          recalcularAristas();
          mostrarInfo(objetivo);
          actualizarBotonExportarSeleccion();
          /* Centrar la vista en el nodo y fijarlo en el centro (hasta que el
             usuario lo arrastre o seleccione otro) para que organice a su
             alrededor todas sus conexiones. */
          vistaManual = true;
          necesitaAjuste = false;
          escala = 1;
          if (ancho && alto) {
            panX = ancho / 2 - objetivo.x * escala;
            panY = alto / 2 - objetivo.y * escala;
          }
          seleccionFijada = objetivo;
          recalentar();
        }
      }
    } catch (err) {
      limpiarGrafo();
      limpiarGrafo = null;
      throw err;
    }
  },

  desmontar() {
    generacionGrafo++;
    if (limpiarGrafo) {
      limpiarGrafo();
      limpiarGrafo = null;
    }
  },
};
