'use strict';

/* H-IMAGO · 2.2 Georreferenciador: mapa OpenStreetMap (Leaflet) para asignar
   coordenadas a los lugares del proyecto. La biblioteca se carga primero
   desde la copia local (vendor/) y, si no existe, desde CDN.

   Diseño: barra superior igual que el resto de secciones (título, búsqueda y
   alta), lista lateral con el estado y las acciones de ubicación, y mapa. */

const LEAFLET_CSS_LOCAL = 'vendor/leaflet/leaflet.css';
const LEAFLET_JS_LOCAL = 'vendor/leaflet/leaflet.js';

function cargarHoja(href) {
  return new Promise((resolver) => {
    let terminado = false;
    const finalizar = (ok) => {
      if (terminado) return;
      terminado = true;
      clearTimeout(temporizador);
      resolver(ok);
    };
    const temporizador = setTimeout(() => finalizar(Boolean(document.querySelector('link[data-himago-leaflet="1"]'))), 8000);
    if (document.querySelector(`link[data-himago-leaflet="1"]`)) {
      finalizar(true);
      return;
    }
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    link.dataset.himagoLeaflet = '1';
    link.onload = () => finalizar(true);
    link.onerror = () => {
      link.remove();
      finalizar(false);
    };
    document.head.appendChild(link);
  });
}

function cargarScript(href) {
  return new Promise((resolver) => {
    let terminado = false;
    const finalizar = (ok) => {
      if (terminado) return;
      terminado = true;
      clearTimeout(temporizador);
      resolver(ok);
    };
    const temporizador = setTimeout(() => finalizar(typeof L !== 'undefined'), 10000);
    if (typeof L !== 'undefined') {
      finalizar(true);
      return;
    }
    const existente = document.querySelector('script[data-himago-leaflet="1"]');
    if (existente) {
      existente.addEventListener('load', () => finalizar(true), { once: true });
      existente.addEventListener('error', () => finalizar(false), { once: true });
      return;
    }
    const s = document.createElement('script');
    s.src = href;
    s.dataset.himagoLeaflet = '1';
    s.onload = () => finalizar(true);
    s.onerror = () => {
      s.remove();
      finalizar(false);
    };
    document.head.appendChild(s);
  });
}

let limpiarGeo = null;
let generacionGeo = 0;

MODULOS.geo = {
  async montar(cont, proyecto, opciones = {}) {
    const generacion = ++generacionGeo;
    cont.innerHTML = '';
    const raiz = el('div', 'modulo modulo-geo');

    /* Barra superior (misma retícula que las demás secciones) */
    const barra = el('div', 'ent-barra');
    barra.appendChild(el('h2', 'ent-titulo', 'Georreferenciador'));

    const buscar = el('input', 'entrada ent-buscar');
    buscar.type = 'search';
    buscar.placeholder = 'Buscar lugar…';
    barra.appendChild(buscar);

    const btnNueva = el('button', 'btn btn-primario', '+ Lugar');
    barra.appendChild(btnNueva);
    raiz.appendChild(barra);

    /* Cuerpo: lista lateral + mapa */
    const cuerpo = el('div', 'geo-cuerpo');
    const panel = el('div', 'geo-panel');
    panel.appendChild(el('p', 'pista',
      'Los mosaicos cartográficos proceden de OpenStreetMap y requieren conexión a Internet.'));

    const estado = el('div', 'geo-estado', 'Selecciona un lugar de la lista.');
    panel.appendChild(estado);

    /* Acciones de ubicación: compactas y uniformes */
    const acciones = el('div', 'geo-acciones');
    const btnCapturar = el('button', 'btn btn-mini', 'Capturar');
    btnCapturar.title = 'Asignar al lugar seleccionado el punto que pulses en el mapa';
    const btnQuitar = el('button', 'btn btn-mini btn-peligroso', 'Quitar');
    btnQuitar.title = 'Eliminar las coordenadas del lugar seleccionado';
    acciones.append(btnCapturar, btnQuitar);
    panel.appendChild(acciones);

    const lista = el('div', 'geo-lista');
    panel.appendChild(lista);

    const envoltura = el('div', 'geo-mapa-envoltura');
    const contMapa = el('div', 'geo-mapa');
    envoltura.appendChild(contMapa);
    cuerpo.append(panel, envoltura);
    raiz.appendChild(cuerpo);
    cont.appendChild(raiz);

    let lugares = [];
    let seleccionado = null;
    let modo = 'nada';
    let mapa = null;
    const marcadores = new Map();
    let marcadorSel = null;
    let temporizadorBusqueda = null;
    let observadorMapa = null;
    let alRedimensionarMapa = null;

    /* ---------------- Estado de la interfaz ---------------- */

    function actualizarModo() {
      btnCapturar.classList.toggle('modo-activo', modo === 'capturar');
      btnCapturar.disabled = !seleccionado;
      btnQuitar.disabled = !(seleccionado && seleccionado.latitud != null);
      contMapa.style.cursor = modo === 'capturar' ? 'crosshair' : '';
      estado.textContent =
        modo === 'capturar'
          ? `Haz clic en el mapa para ubicar «${seleccionado ? seleccionado.nombre : ''}».`
          : seleccionado
            ? (seleccionado.latitud != null
              ? `«${seleccionado.nombre}»: ${Number(seleccionado.latitud).toFixed(5)}, ${Number(seleccionado.longitud).toFixed(5)}`
              : `«${seleccionado.nombre}» aún sin coordenadas. Pulsa «Capturar» y marca el punto.`)
            : 'Selecciona un lugar de la lista.';
    }

    /* ---------------- Datos y lista ---------------- */

    async function cargarLugares() {
      lugares = await llamar(api.entidadListarResumen('lugar', proyecto.id));
      if (seleccionado) {
        const actualizado = lugares.find((l) => l.id === seleccionado.id);
        seleccionado = actualizado || null;
      }
      dibujarLista();
      dibujarMarcadores();
      actualizarModo();
    }

    function dibujarLista() {
      lista.innerHTML = '';
      const texto = buscar.value.toLowerCase();
      const visibles = lugares.filter((l) => !texto || `${l.nombre} ${l.tipo || ''}`.toLowerCase().includes(texto));
      if (!visibles.length) {
        lista.appendChild(el('div', 'vacio mini', 'Sin lugares. Usa «+ Lugar» para crear uno.'));
        return;
      }
      for (const l of visibles) {
        const item = el('div', 'geo-item');
        if (seleccionado && l.id === seleccionado.id) item.classList.add('seleccionado');
        item.appendChild(el('div', 'ent-item-titulo', l.nombre));
        const tiene = l.latitud != null;
        item.appendChild(el('div', 'ent-item-sub',
          `${l.tipo ? `${l.tipo} · ` : ''}${tiene ? `${Number(l.latitud).toFixed(4)}, ${Number(l.longitud).toFixed(4)}` : 'sin georreferenciar'}`));
        item.addEventListener('click', () => seleccionar(l));
        lista.appendChild(item);
      }
    }

    async function seleccionar(l, { centrar = true } = {}) {
      seleccionado = l;
      modo = 'nada';
      dibujarLista();
      actualizarModo();
      if (centrar && l.latitud != null && mapa) {
        mapa.flyTo([Number(l.latitud), Number(l.longitud)], Math.max(mapa.getZoom(), 9));
      }
      resaltar();
    }

    /* ---------------- Marcadores ---------------- */

    function resaltar() {
      if (!mapa) return;
      if (marcadorSel) { mapa.removeLayer(marcadorSel); marcadorSel = null; }
      if (seleccionado && seleccionado.latitud != null) {
        marcadorSel = L.circleMarker([Number(seleccionado.latitud), Number(seleccionado.longitud)], {
          radius: 16, color: '#e3c35a', weight: 2, fill: false,
        }).addTo(mapa);
      }
    }

    function textoPopupLugar(l) {
      return `<strong>${escaparHTML(l.nombre)}</strong><br>${escaparHTML(l.tipo || '')}<br>${Number(l.latitud).toFixed(5)}, ${Number(l.longitud).toFixed(5)}`;
    }

    function dibujarMarcadores() {
      if (!mapa) return;
      const limites = mapa.getBounds();
      const vistos = new Set();
      for (const l of lugares) {
        if (l.latitud == null) continue;
        const latLng = [Number(l.latitud), Number(l.longitud)];
        if (!limites.contains(latLng)) continue;
        vistos.add(l.id);
        let marcador = marcadores.get(l.id);
        if (marcador) {
          marcador.setLatLng(latLng);
          marcador.setPopupContent(textoPopupLugar(l));
        } else {
          marcador = L.circleMarker(latLng, {
            radius: 7, color: '#86b28a', weight: 2, fillColor: '#2e4a35', fillOpacity: 0.9,
          }).addTo(mapa);
          marcador.bindPopup(textoPopupLugar(l));
          marcador.on('click', (ev) => {
            L.DomEvent.stopPropagation(ev);
            const actual = lugares.find((x) => x.id === l.id);
            if (actual) seleccionar(actual, { centrar: false });
          });
          marcadores.set(l.id, marcador);
        }
      }
      for (const [id, marcador] of [...marcadores.entries()]) {
        if (!vistos.has(id)) {
          mapa.removeLayer(marcador);
          marcadores.delete(id);
        }
      }
      resaltar();
    }

    function actualizarContadorGeo() {
      const cuenta = document.querySelector('[data-cuenta="geolocalizados"]');
      if (cuenta) {
        const geolocalizados = lugares.filter((l) => l.latitud != null).length;
        cuenta.textContent = `${geolocalizados}/${lugares.length}`;
      }
    }

    function refrescar() {
      dibujarLista();
      dibujarMarcadores();
      actualizarModo();
      actualizarContadorGeo();
    }

    function invalidarCacheLugares() {
      if (window.HimagoCache && typeof window.HimagoCache.invalidar === 'function') {
        window.HimagoCache.invalidar(proyecto.id);
      }
    }

    /* ---------------- Acciones ---------------- */

    async function nuevoLugar() {
      const nombre = await pedirTexto({
        titulo: 'Nuevo lugar',
        etiqueta: 'Nombre del lugar',
        placeholder: 'Ej.: Medina del Campo',
      });
      if (!nombre) return;
      try {
        const fila = await llamar(api.entidadCrear('lugar', proyecto.id, { nombre }));
        lugares.push(fila);
        seleccionado = fila;
        modo = 'capturar';
        invalidarCacheLugares();
        aviso(`Lugar «${nombre}» creado. Marca su punto en el mapa.`, 'exito');
        refrescar();
      } catch (err) { aviso(err.message, 'error'); }
    }

    btnNueva.addEventListener('click', nuevoLugar);

    btnCapturar.addEventListener('click', () => {
      if (!seleccionado) return;
      modo = modo === 'capturar' ? 'nada' : 'capturar';
      actualizarModo();
    });

    btnQuitar.addEventListener('click', async () => {
      if (!seleccionado) return;
      const id = seleccionado.id;
      try {
        await llamar(api.entidadActualizar('lugar', id, { latitud: '', longitud: '' }, proyecto.id));
        const fila = lugares.find((l) => l.id === id);
        if (fila) { fila.latitud = null; fila.longitud = null; }
        if (seleccionado && seleccionado.id === id) {
          seleccionado.latitud = null; seleccionado.longitud = null;
        }
        invalidarCacheLugares();
        aviso('Coordenadas eliminadas', 'exito');
        refrescar();
      } catch (err) { aviso(err.message, 'error'); }
    });

    async function alHacerClic(ev) {
      const lat = Number(ev.latlng.lat.toFixed(7));
      const lng = Number(ev.latlng.lng.toFixed(7));
      if (modo !== 'capturar' || !seleccionado) {
        aviso(seleccionado
          ? `Pulsa «Capturar» para asignar un punto a «${seleccionado.nombre}».`
          : 'Selecciona un lugar de la lista (o crea uno con «+ Lugar») y pulsa «Capturar».');
        return;
      }
      const id = seleccionado.id;
      try {
        const fila = await llamar(api.entidadActualizar('lugar', id, { latitud: lat, longitud: lng }, proyecto.id));
        const actual = lugares.find((l) => l.id === id);
        if (actual) Object.assign(actual, fila);
        if (seleccionado && seleccionado.id === id) {
          Object.assign(seleccionado, fila);
          modo = 'nada';
        }
        invalidarCacheLugares();
        aviso(`Coordenadas de «${fila.nombre}» guardadas`, 'exito');
        refrescar();
      } catch (err) { aviso(err.message, 'error'); }
    }

    /* ---------------- Carga de Leaflet y arranque del mapa ---------------- */

    const [cssOk, jsOk] = await Promise.all([
      cargarHoja(LEAFLET_CSS_LOCAL),
      cargarScript(LEAFLET_JS_LOCAL),
    ]);
    if (generacion !== generacionGeo) return;

    if (!jsOk || typeof L === 'undefined') {
      envoltura.innerHTML = '<div class="vacio error">No se pudo cargar Leaflet (revisa la conexión o la carpeta vendor/).</div>';
      return;
    }
    if (!cssOk) {
      aviso('No se pudo cargar el estilo de Leaflet; el mapa puede verse desordenado.', 'error');
    }

    mapa = L.map(contMapa, { zoomControl: true }).setView([40.4, -3.7], 3);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(mapa);
    mapa.on('click', alHacerClic);
    mapa.on('moveend zoomend', dibujarMarcadores);
    const invalidarMapa = () => {
      if (mapa) {
        try { mapa.invalidateSize(); } catch { /* mapa ya retirado */ }
      }
    };
    alRedimensionarMapa = () => requestAnimationFrame(invalidarMapa);
    observadorMapa = new ResizeObserver(alRedimensionarMapa);
    observadorMapa.observe(envoltura);
    window.addEventListener('resize', alRedimensionarMapa);
    requestAnimationFrame(invalidarMapa);
    limpiarGeo = () => {
      if (temporizadorBusqueda) { clearTimeout(temporizadorBusqueda); temporizadorBusqueda = null; }
      if (observadorMapa) observadorMapa.disconnect();
      observadorMapa = null;
      if (alRedimensionarMapa) window.removeEventListener('resize', alRedimensionarMapa);
      alRedimensionarMapa = null;
      if (mapa) {
        try { mapa.remove(); } catch { /* ya retirado */ }
        mapa = null;
      }
      marcadores.clear();
      marcadorSel = null;
    };

    buscar.addEventListener('input', () => {
      if (temporizadorBusqueda) clearTimeout(temporizadorBusqueda);
      temporizadorBusqueda = setTimeout(() => {
        temporizadorBusqueda = null;
        dibujarLista();
      }, 150);
    });
    buscar.addEventListener('keydown', (ev) => {
      if (ev.key === 'Enter') {
        const primero = lista.querySelector('.geo-item');
        if (primero) primero.click();
      }
    });

    await cargarLugares();
    if (generacion !== generacionGeo) return;

    if (opciones.seleccionar && opciones.seleccionar.tipo === 'lugar') {
      const l = lugares.find((x) => x.id === Number(opciones.seleccionar.id));
      if (l) await seleccionar(l);
    }

    actualizarContadorGeo();
  },

  desmontar() {
    generacionGeo++;
    if (limpiarGeo) {
      limpiarGeo();
      limpiarGeo = null;
    }
  },
};
