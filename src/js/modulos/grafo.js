'use strict';

/* H-IMAGO · 2.1 Vista de grafo: red social histórica con simulación de
   fuerzas sobre canvas (arrastrar nodos, paneo, zoom, filtros y exportación) */

const COLORES_GRAFO = {
  persona: '#d9a05b',
  institucion: '#7ea8c9',
  lugar: '#86b28a',
  patrimonio: '#b98cc4',
};

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

MODULOS.grafo = {
  async montar(cont, proyecto, opciones = {}) {
    const generacion = ++generacionGrafo;
    cont.innerHTML = '';
    const raiz = el('div', 'modulo modulo-grafo');

    /* Barra de herramientas */
    const barra = el('div', 'grafo-barra');
    const leyenda = el('div', 'grafo-leyenda');
    const visibles = { persona: true, institucion: true, lugar: true, patrimonio: true };
    let filtroEntidad = '';
    let filtroRelacion = '';
    let excluirSinDatos = false;

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
    for (const tipo of Object.keys(COLORES_GRAFO)) {
      const chip = el('button', 'chip activo');
      chip.style.setProperty('--color', COLORES_GRAFO[tipo]);
      chip.innerHTML = `<span class="chip-punto"></span>${NOMBRE_TIPO[tipo]} <span class="chip-cuenta">${cuentaTipos[tipo] || 0}</span>`;
      chip.addEventListener('click', () => {
        visibles[tipo] = !visibles[tipo];
        chip.classList.toggle('activo', visibles[tipo]);
        reiniciarFiltro();
        recalentar();
      });
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
    barra.appendChild(leyenda);

    const acciones = el('div', 'grafo-acciones');
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
    acciones.append(btnTemporalidad, btnReorganizar, btnCentrar, btnExportar, btnExportarSeleccion);
    barra.appendChild(acciones);
    raiz.appendChild(barra);

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
    barraRelaciones.appendChild(el('span', 'grafo-filtro-titulo', 'Relaciones'));
    const leyendaRelaciones = el('div', 'grafo-leyenda');
    for (const categoria of Object.keys(categoriasVisibles)) {
      const etiqueta = categoria === 'Otras'
        ? 'Otras'
        : (RELACIONES_CATEGORIAS_PLURAL[categoria] || categoria);
      const chip = el('button', 'chip activo', '');
      chip.innerHTML = `${etiqueta} <span class="chip-cuenta">${cuentaCategorias[categoria] || 0}</span>`;
      chip.addEventListener('click', () => {
        categoriasVisibles[categoria] = !categoriasVisibles[categoria];
        chip.classList.toggle('activo', categoriasVisibles[categoria]);
        reiniciarFiltro();
        recalentar();
      });
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

    function categoriaDeArista(a) {
      return categoriaRelacion(a.tipo) || 'Otras';
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
    btnExcluirSinDatos.title = 'Oculta las entidades que no tienen ningún año y ninguna relación';
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
    btnTemporalidad.addEventListener('click', () => {
      const abrir = barraTiempo.hidden;
      barraTiempo.hidden = !abrir;
      btnTemporalidad.classList.toggle('modo-activo', abrir);
      btnTemporalidad.setAttribute('aria-expanded', String(abrir));
    });

    function construirBarraTiempo(btnExcluir) {
      const fila = el('div', 'grafo-tiempo-fila');

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
      bloque.append(etiquetaDesde, etiquetaHasta, rango, marcas);
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
      controles.appendChild(btnExcluir);
      fila.appendChild(controles);

      const contador = el('div', 'contador-grafo', '');
      fila.appendChild(contador);

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
      inputMin.addEventListener('input', () => programarAplicar(inputMin.value, rangoActivo.max));
      inputMax.addEventListener('input', () => programarAplicar(rangoActivo.min, inputMax.value));
      btnAfinar.addEventListener('click', () => aplicar(inDe.value, inA.value));
      for (const campo of [inDe, inA]) {
        campo.addEventListener('keydown', (ev) => {
          if (ev.key === 'Enter') aplicar(inDe.value, inA.value);
        });
      }

      pintarPista();
      return { raiz: fila, contador };
    }

    /* Lienzo + panel de información */
    const escena = el('div', 'grafo-escena');
    const canvas = el('canvas', 'grafo-canvas');
    canvas.style.touchAction = 'none';
    canvas.setAttribute('role', 'img');
    canvas.setAttribute('aria-label', 'Grafo de relaciones históricas del proyecto');
    const panel = el('div', 'grafo-info oculto');
    escena.append(canvas, panel);
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

    function recalcularAristas() {
      const base = aristas.filter((a) => {
        const o = mundo.get(a.origen), d = mundo.get(a.destino);
        return o && d && visibles[o.tipo] && visibles[d.tipo] && aristaBaseVisible(a);
      });
      const hayFiltroRelaciones = Object.values(categoriasVisibles).some((visible) => !visible)
        || Boolean(filtroRelacion);
      const conRelacion = new Set();
      for (const a of base) {
        conRelacion.add(a.origen);
        conRelacion.add(a.destino);
      }
      for (const n of mundo.values()) {
        n.oculto = !visibles[n.tipo]
          || (hayFiltroRelaciones && !conRelacion.has(n.id))
          || (excluirSinDatos && !n.tieneAnios && !n.gradoTotal)
          || (Boolean(filtroEntidad) && !coincideEntidad(n));
        n.grado = 0;
      }
      aristasVisibles = base.filter((a) => {
        const o = mundo.get(a.origen), d = mundo.get(a.destino);
        return o && d && !o.oculto && !d.oculto;
      });
      for (const a of aristasVisibles) {
        const o = mundo.get(a.origen), d = mundo.get(a.destino);
        o.grado++; d.grado++;
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
          tieneAnios: nd.anioDesde != null || nd.anioHasta != null,
          busqueda: normalizarTextoGrafo(
            `${nd.tipo} ${NOMBRE_TIPO[nd.tipo] || ''} ${nd.etiqueta || ''} ${nd.detalle || ''}`
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
        .map((a) => ({ ...a, tipoBusqueda: normalizarTextoGrafo(a.tipo) }));
      for (const a of aristas) {
        const o = mundo.get(a.origen), d = mundo.get(a.destino);
        o.gradoTotal++; d.gradoTotal++;
        o.grado++; d.grado++;
      }
      recalcularAristas();
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
      }
      actualizarBotonExportarSeleccion();
      actualizarContador();
      despertar();
    }

    function actualizarContador() {
      if (!refsTiempo || !mundo.size) return;
      const totalNodos = mundo.size;
      const totalAristas = aristas.length;
      const visiblesAristas = aristasVisibles.length;
      refsTiempo.contador.textContent =
        `Mostrando ${nodosVisibles.length} de ${totalNodos} entidades · ` +
        `${visiblesAristas} de ${totalAristas} relaciones visibles`;
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
        if ((arrastre && arrastre.tipo === 'nodo' && arrastre.nodo === n) || seleccionFijada === n) {
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
      return 7 + Math.min(6, n.grado * 0.9);
    }

    function cajasSolapan(a, b) {
      return a.x < b.x + b.ancho
        && a.x + a.ancho > b.x
        && a.y < b.y + b.alto
        && a.y + a.alto > b.y;
    }

    function dibujarEn(contexto, conFondo = false, opciones = {}) {
      const nodosDibujo = opciones.nodos || nodosVisibles;
      const aristasDibujo = opciones.aristas || aristasVisibles;
      const seleccionDibujo = opciones.seleccion !== undefined ? opciones.seleccion : seleccion;
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
      contexto.save();
      contexto.translate(panXDibujo, panYDibujo);
      contexto.scale(escalaDibujo, escalaDibujo);
      contexto.lineCap = 'round';
      contexto.lineJoin = 'round';

      /* aristas: primero las atenuadas y encima las activas, para que
         la acumulación de líneas tenues solapadas no parezca una
         conexión opaca ni tape las conexiones del nodo seleccionado. */
      const dibujarArista = (a, activa) => {
        const o = mundo.get(a.origen), d = mundo.get(a.destino);
        if (!o || !d) return;
        if (seleccionDibujo) {
          if (activa) {
            contexto.globalAlpha = 1;
            contexto.strokeStyle = coloresTema.aristaActiva;
            contexto.lineWidth = 1.7 / escalaDibujo;
          } else {
            contexto.globalAlpha = 0.05;
            contexto.strokeStyle = coloresTema.arista;
            contexto.lineWidth = 0.8 / escalaDibujo;
          }
        } else {
          contexto.globalAlpha = 1;
          contexto.strokeStyle = coloresTema.arista;
          contexto.lineWidth = 1 / escalaDibujo;
        }
        contexto.beginPath();
        contexto.moveTo(o.x, o.y);
        contexto.lineTo(d.x, d.y);
        contexto.stroke();
      };
      if (seleccionDibujo) {
        /* En modo atenuado cada par de nodos se dibuja una sola vez: las
           relaciones paralelas (multigrafo) comparten la misma geometría y
           su acumulación volvería opaca la línea tenue. */
        const pares = new Set();
        const clavePar = (a) => (a.origen < a.destino
          ? `${a.origen}|${a.destino}`
          : `${a.destino}|${a.origen}`);
        for (const a of aristasPintar) {
          if (seleccionDibujo.id !== a.origen && seleccionDibujo.id !== a.destino) {
            const clave = clavePar(a);
            if (pares.has(clave)) continue;
            pares.add(clave);
            dibujarArista(a, false);
          }
        }
        for (const a of aristasPintar) {
          if (seleccionDibujo.id === a.origen || seleccionDibujo.id === a.destino) {
            const clave = clavePar(a);
            if (pares.has(clave)) continue;
            pares.add(clave);
            dibujarArista(a, true);
          }
        }
      } else {
        for (const a of aristasPintar) dibujarArista(a, false);
      }
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
          contexto.beginPath();
          contexto.arc(n.x, n.y, r + 5, 0, Math.PI * 2);
          contexto.strokeStyle = esSel ? '#e3c35a' : 'rgba(227,195,90,0.5)';
          contexto.lineWidth = 1.5 / escalaDibujo;
          contexto.stroke();
        }
        contexto.globalAlpha = atenuar ? 0.28 : 1;
        if (esSel) {
          contexto.shadowColor = 'rgba(227,195,90,0.55)';
          contexto.shadowBlur = 16;
        }
        contexto.beginPath();
        contexto.arc(n.x, n.y, r, 0, Math.PI * 2);
        contexto.fillStyle = COLORES_GRAFO[n.tipo] || '#999';
        contexto.fill();
        contexto.shadowBlur = 0;
        contexto.shadowColor = 'transparent';
        contexto.strokeStyle = coloresTema.contorno;
        contexto.lineWidth = 1.5 / escalaDibujo;
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
        contexto.globalAlpha = atenuar ? 0.28 : 1;
        contexto.fillStyle = coloresTema.etiqueta;
        contexto.textAlign = 'center';
        contexto.shadowColor = 'rgba(0,0,0,0.65)';
        contexto.shadowBlur = 3;
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

    canvas.addEventListener('pointerdown', (ev) => {
      if (ev.button !== undefined && ev.button !== 0) return;
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
        const nuevo = nodoEn(aMundo(ev));
        if (nuevo !== resaltado) {
          resaltado = nuevo;
          despertar();
        }
        canvas.style.cursor = resaltado ? 'pointer' : 'grab';
        return;
      }
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

    canvas.addEventListener('click', (ev) => {
      if (suprimirClick) {
        suprimirClick = false;
        return;
      }
      const pos = aMundo(ev);
      const n = nodoEn(pos);
      seleccion = n || null;
      seleccionFijada = null;
      recalcularAristas();
      if (seleccion) mostrarInfo(seleccion); else ocultarInfo();
      actualizarBotonExportarSeleccion();
      despertar();
    });
    canvas.addEventListener('pointercancel', () => {
      arrastre = null;
      alphaTarget = 0;
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
    function exportarPNG(soloSeleccion = false) {
      if (soloSeleccion && !seleccion) return;
      if (btnExportar.disabled) return;
      btnExportar.disabled = true;
      btnExportarSeleccion.disabled = true;
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
        let minX = Infinity;
        let minY = Infinity;
        let maxX = -Infinity;
        let maxY = -Infinity;
        for (const n of nodosSub) {
          const r = radioNodo(n);
          minX = Math.min(minX, n.x - r);
          minY = Math.min(minY, n.y - r);
          maxX = Math.max(maxX, n.x + r);
          maxY = Math.max(maxY, n.y + r);
        }
        const margen = 70;
        const anchoMundo = Math.max(maxX - minX, 1);
        const altoMundo = Math.max(maxY - minY, 1);
        const escalaSub = Math.min(3, Math.max(0.2, Math.min(
          (anchoBase - margen * 2) / anchoMundo,
          (altoBase - margen * 2) / altoMundo
        )));
        dibujarEn(contexto, true, {
          nodos: nodosSub,
          aristas: aristasSub,
          seleccion,
          vecinos: vecinosSeleccion,
          escala: escalaSub,
          panX: anchoBase / 2 - ((minX + maxX) / 2) * escalaSub,
          panY: altoBase / 2 - ((minY + maxY) / 2) * escalaSub,
          ancho: anchoBase,
          alto: altoBase,
          forzarEtiquetasNodo: true,
        });
      } else {
        dibujarEn(contexto, true, {
          ancho: anchoBase,
          alto: altoBase,
          seleccion: null,
        });
      }

      lienzo.toBlob((blob) => {
        btnExportar.disabled = false;
        actualizarBotonExportarSeleccion();
        if (!blob) {
          aviso('No se pudo generar la imagen del grafo.', 'error');
          return;
        }
        const url = URL.createObjectURL(blob);
        const enlace = document.createElement('a');
        enlace.download = soloSeleccion ? 'grafo-himago-seleccion.png' : 'grafo-himago.png';
        enlace.href = url;
        enlace.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      }, 'image/png');
    }

    btnExportar.addEventListener('click', () => exportarPNG(false));
    btnExportarSeleccion.addEventListener('click', () => exportarPNG(true));

    /* ---------------- Panel de información ---------------- */

    function ocultarInfo() { panel.classList.add('oculto'); }

    function mostrarInfo(n) {
      panel.classList.remove('oculto');
      panel.innerHTML = '';
      panel.appendChild(el('div', `grafo-info-tipo color-${n.tipo}`, NOMBRE_TIPO[n.tipo]));
      panel.appendChild(el('h3', '', n.etiqueta));
      if (n.detalle) panel.appendChild(el('p', 'grafo-info-detalle', n.detalle));

      const propias = aristasVisibles.filter((a) =>
        a.origen === n.id || a.destino === n.id);
      panel.appendChild(el('h4', '', `Relaciones (${propias.length})`));
      const lista = el('div', 'grafo-info-relaciones');
      if (!propias.length) lista.appendChild(el('div', 'vacio mini', 'Sin relaciones.'));
      for (const a of propias) {
        const linea = el('div', 'grafo-info-relacion');
        const origen = mundo.get(a.origen);
        const destino = mundo.get(a.destino);
        const sentido = `${origen ? origen.etiqueta : '?'} → ${destino ? destino.etiqueta : '?'}`;
        linea.textContent = `${a.tipo} · ${sentido}${a.fecha ? ` (${a.fecha})` : ''}`;
        lista.appendChild(linea);
      }
      panel.appendChild(lista);

      const btnAbrir = el('button', 'btn btn-mini', `Abrir ficha de ${NOMBRE_TIPO[n.tipo].toLowerCase()}`);
      btnAbrir.addEventListener('click', () => navegarARegistro(n.tipo, n.entidadId));
      panel.appendChild(btnAbrir);
    }

    /* ---------------- Arranque ---------------- */

    limpiarGrafo = () => {
      if (temporizadorEntidad) { clearTimeout(temporizadorEntidad); temporizadorEntidad = null; }
      if (temporizadorRelacion) { clearTimeout(temporizadorRelacion); temporizadorRelacion = null; }
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
