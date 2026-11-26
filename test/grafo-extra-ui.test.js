'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');

const RAIZ = path.join(__dirname, '..', 'src', 'js');

function contextoFalso() {
  const gradiente = { addColorStop() {} };
  return {
    setTransform() {}, clearRect() {}, save() {}, restore() {},
    translate() {}, scale() {}, beginPath() {}, arc() {}, fill() {},
    stroke() {}, moveTo() {}, lineTo() {}, fillText() {}, fillRect() {},
    quadraticCurveTo() {}, rect() {}, closePath() {}, setLineDash() {},
    createRadialGradient() { return gradiente; },
    measureText(texto) { return { width: String(texto || '').length * 6 }; },
    fillStyle: '', strokeStyle: '', lineWidth: 1, lineCap: '', lineJoin: '',
    font: '', textAlign: '', textBaseline: '', globalAlpha: 1,
    shadowColor: '', shadowBlur: 0,
  };
}

function cargarGrafo(datosPersonalizados = null) {
  const dom = new JSDOM(`<!doctype html><html><body>
    <div id="contenido"></div><div id="capa-modales"></div><div id="avisos"></div>
    <div id="zona-impresion"></div>
  </body></html>`, { runScripts: 'dangerously', url: 'http://localhost/', pretendToBeVisual: true });
  const { window } = dom;
  window.HTMLCanvasElement.prototype.getContext = () => contextoFalso();
  window.ResizeObserver = class {
    observe() {}
    disconnect() {}
    unobserve() {}
  };
  const datos = datosPersonalizados || {
    nodos: [
      {
        id: 'persona:1', tipo: 'persona', entidadId: 1, identificador: 'PE00001',
        etiqueta: 'Ana Pérez', nombre: 'Ana', apellidos: 'Pérez', genero: 'Femenino',
        detalle: '1500 – 1560 · Escribana',
        notas: 'Nota biográfica de Ana.', anioDesde: 1500, anioHasta: 1560,
      },
      {
        id: 'persona:2', tipo: 'persona', entidadId: 2, identificador: 'PE00002',
        etiqueta: 'Bernardo Gil', nombre: 'Bernardo', apellidos: 'Gil',
        detalle: '', notas: '', anioDesde: 1490, anioHasta: 1550,
      },
      {
        id: 'institucion:1', tipo: 'institucion', entidadId: 1, identificador: 'IN00001',
        etiqueta: 'Cabildo', nombre: 'Cabildo', tipoEntidad: 'municipal',
        detalle: 'municipal', notas: 'Nota del cabildo.',
      },
      { id: 'lugar:1', tipo: 'lugar', entidadId: 1, identificador: 'LU00001', etiqueta: 'Sevilla', nombre: 'Sevilla', tipoEntidad: 'ciudad', detalle: 'ciudad' },
    ],
    aristas: [
      {
        id: 1, origen: 'persona:1', destino: 'institucion:1', tipo: 'Miembro',
        procedencia: 'MANUAL', notas: 'Relación de prueba.', anioDesde: 1520, anioHasta: null,
        fuentes: [{ id: 1, titulo: 'Protocolo de prueba' }],
      },
      { id: 2, origen: 'persona:1', destino: 'persona:2', tipo: 'Hermanos', procedencia: 'EDITADA', anioDesde: null, anioHasta: null },
    ],
    rango: { minimo: 1500, maximo: 1560 },
  };
  window.api = {
    grafoDatos: async () => ({ ok: true, datos }),
    analisisCalcular: async () => ({ ok: false, error: 'No usado en esta prueba' }),
    analisisCancelar: async () => ({ ok: true, datos: true }),
    analisisExportar: async () => ({ ok: true, datos: { cancelado: true } }),
    grafoExportar: async (exportacion) => {
      window.__exportaciones = window.__exportaciones || [];
      window.__exportaciones.push(exportacion);
      return { ok: true, datos: { cancelado: false, ruta: `C:/tmp/${exportacion.nombre}` } };
    },
    onAnalisisProgreso: () => () => {},
  };
  for (const archivo of [
    'comun.js',
    'modulos/taxonomia-relaciones.js',
    'modulos/grafo.js',
    'modulos/analisis-rsh-ui.js',
  ]) {
    const script = window.document.createElement('script');
    script.textContent = fs.readFileSync(path.join(RAIZ, archivo), 'utf8');
    window.document.head.appendChild(script);
  }
  return window;
}

const esperar = (ms) => new Promise((resolver) => setTimeout(resolver, ms));

test('UI de grafo: estado permanente, tabla, vistas, histograma y panel enriquecido', async () => {
  const window = cargarGrafo();
  const cont = window.document.getElementById('contenido');
  await window.MODULOS.grafo.montar(cont, { id: 1, nombre: 'Proyecto' }, {});
  await esperar(80);

  assert.ok(cont.querySelector('.grafo-estado .contador-grafo'));
  assert.match(cont.querySelector('.grafo-resumen-filtros').textContent, /Sin filtros activos/);
  const chipPersona = cont.querySelector('.grafo-barra .chip[data-tipo="persona"]');
  chipPersona.click();
  await esperar(20);
  assert.match(cont.querySelector('.grafo-resumen-filtros').textContent, /Tipos ocultos/);
  [...cont.querySelectorAll('.grafo-estado-acciones .btn')]
    .find((b) => b.textContent === 'Limpiar filtros').click();
  await esperar(20);
  assert.match(cont.querySelector('.grafo-resumen-filtros').textContent, /Sin filtros activos/);
  assert.ok(cont.querySelector('.grafo-histograma-barra'));
  const canvas = cont.querySelector('.grafo-canvas');
  assert.equal(canvas.tabIndex, 0);
  const panelGrafo = cont.querySelector('.grafo-info');
  for (const tecla of ['ArrowRight', 'ArrowLeft', 'ArrowDown', 'ArrowUp']) {
    if (!panelGrafo.classList.contains('oculto')) break;
    canvas.dispatchEvent(new window.KeyboardEvent('keydown', { key: tecla, bubbles: true }));
    await esperar(20);
  }
  assert.equal(panelGrafo.classList.contains('oculto'), false);
  assert.equal(cont.querySelectorAll('.grafo-histograma-barra').length, 61);

  const btnDireccion = [...cont.querySelectorAll('.grafo-acciones .btn')]
    .find((b) => b.textContent === 'Dirección');
  assert.equal(btnDireccion.getAttribute('aria-pressed'), 'true');
  btnDireccion.click();
  assert.equal(btnDireccion.getAttribute('aria-pressed'), 'false');
  btnDireccion.click();

  const selProcedencia = cont.querySelector('.grafo-procedencia-select');
  assert.ok(selProcedencia);
  selProcedencia.value = 'automatizadas';
  selProcedencia.dispatchEvent(new window.Event('change', { bubbles: true }));
  await esperar(20);
  assert.match(cont.querySelector('.grafo-resumen-filtros').textContent, /solo automatizadas/);
  selProcedencia.value = 'todas';
  selProcedencia.dispatchEvent(new window.Event('change', { bubbles: true }));
  await esperar(20);

  const btnTabla = [...cont.querySelectorAll('.grafo-acciones .btn')]
    .find((b) => b.textContent === 'Ver como tabla');
  btnTabla.click();
  await esperar(20);
  assert.ok(window.document.querySelector('.tabla-grafo-accesible'));
  const cerrarTabla = [...window.document.querySelectorAll('.modal-acciones .btn')]
    .find((b) => b.textContent === 'Cerrar');
  cerrarTabla.click();

  const btnOpciones = [...cont.querySelectorAll('.grafo-acciones .btn')]
    .find((b) => b.textContent === 'Opciones PNG');
  assert.ok(btnOpciones);
  btnOpciones.click();
  await esperar(20);
  const modalOpciones = window.document.querySelector('.modal');
  assert.match(modalOpciones.textContent, /Opciones de exportación PNG/);
  [...modalOpciones.querySelectorAll('.modal-acciones .btn')]
    .find((b) => b.textContent === 'Guardar opciones').click();

  const btnVistas = [...cont.querySelectorAll('.grafo-acciones .btn')]
    .find((b) => b.textContent === 'Vistas');
  btnVistas.click();
  await esperar(20);
  const modalVistas = window.document.querySelector('.grafo-vistas-modal');
  assert.ok(modalVistas);
  const entradaVista = modalVistas.querySelector('input');
  entradaVista.value = 'Vista de prueba';
  const btnGuardarVista = [...modalVistas.querySelectorAll('.modal-acciones .btn')]
    .find((b) => b.textContent === 'Guardar vista actual');
  btnGuardarVista.click();
  await esperar(20);
  assert.match(modalVistas.querySelector('.grafo-vista').textContent, /Vista de prueba/);
  [...modalVistas.querySelectorAll('.modal-acciones .btn')]
    .find((b) => b.textContent === 'Cerrar').click();
  await esperar(20);
  btnVistas.click();
  await esperar(20);
  const modalReabierto = window.document.querySelector('.grafo-vistas-modal');
  [...modalReabierto.querySelectorAll('.grafo-vista-acciones .btn')]
    .find((b) => b.textContent === 'Aplicar').click();
  await esperar(30);
  assert.equal(window.document.querySelector('.grafo-vistas-modal'), null);

  const buscador = cont.querySelector('.grafo-buscar-entrada');
  buscador.value = 'Ana';
  buscador.dispatchEvent(new window.Event('input', { bubbles: true }));
  await esperar(220);
  buscador.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  await esperar(40);
  assert.equal(cont.querySelector('.grafo-info-id').textContent, 'PE00001');
  assert.match(cont.querySelector('.grafo-info-notas').textContent, /Nota biográfica/);
  assert.match(cont.querySelector('.grafo-info').textContent, /Género: Femenino/);
  assert.doesNotMatch(cont.querySelector('.grafo-info').textContent, /Escribana/);

  buscador.value = '';
  buscador.dispatchEvent(new window.Event('input', { bubbles: true }));
  await esperar(220);
  const relacion = [...cont.querySelectorAll('.grafo-info-relacion')]
    .find((linea) => linea.textContent.includes('Miembro'));
  assert.ok(relacion);
  relacion.click();
  await esperar(20);
  assert.match(cont.querySelector('.grafo-info-fuentes').textContent, /Protocolo de prueba/);
  assert.match(cont.querySelector('.grafo-info-notas').textContent, /Relación de prueba/);

  // Volver al nodo antes de probar la vecindad.
  buscador.value = 'Ana';
  buscador.dispatchEvent(new window.Event('input', { bubbles: true }));
  await esperar(220);
  buscador.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  await esperar(30);
  const btnVecindad = [...cont.querySelectorAll('.grafo-info-acciones .btn')]
    .find((b) => b.textContent === 'Vecindad 1 salto');
  assert.ok(btnVecindad);
  btnVecindad.click();  await esperar(30);
  assert.match(cont.querySelector('.grafo-ego-info').textContent, /Vecindad|vecindad/);
  [...cont.querySelectorAll('.grafo-ego-info .btn')]
    .find((b) => b.textContent === 'Volver a la red completa').click();

  const btnTemporalidad = [...cont.querySelectorAll('.grafo-acciones .btn')]
    .find((b) => b.textContent === 'Temporalidad');
  btnTemporalidad.click();
  const btnReproducir = [...cont.querySelectorAll('.grafo-tiempo-controles .btn')]
    .find((b) => b.textContent === 'Reproducir');
  assert.ok(btnReproducir);
  btnReproducir.click();
  await esperar(150);
  assert.equal(btnReproducir.textContent, 'Pausar');
  btnReproducir.click();
  assert.equal(btnReproducir.textContent, 'Reproducir');

  window.MODULOS.grafo.desmontar();
});

test('UI de grafo: vínculos agregados, detalle y exportación de la tabla', async () => {
  const datos = {
    nodos: [
      {
        id: 'persona:1', tipo: 'persona', entidadId: 1, identificador: 'PE00001',
        etiqueta: 'Ana Pérez', detalle: '1500 – 1560', notas: 'Nota de Ana.',
        anioDesde: 1500, anioHasta: 1560,
      },
      {
        id: 'persona:2', tipo: 'persona', entidadId: 2, identificador: 'PE00002',
        etiqueta: 'Bernardo Gil', detalle: '', notas: '', anioDesde: 1490, anioHasta: 1550,
      },
    ],
    aristas: [
      {
        id: 1, origen: 'persona:1', destino: 'persona:2', tipo: 'Correspondencia',
        procedencia: 'AUTOMATIZADA', anioDesde: 1510, anioHasta: null,
        notas: 'Primera carta.', fuentes: [{ id: 1, titulo: 'Carta 1' }],
      },
      {
        id: 2, origen: 'persona:1', destino: 'persona:2', tipo: 'Correspondencia',
        procedencia: 'AUTOMATIZADA', anioDesde: 1512, anioHasta: null,
        notas: 'Segunda carta.', fuentes: [{ id: 2, titulo: 'Carta 2' }],
      },
      {
        id: 3, origen: 'persona:2', destino: 'persona:1', tipo: 'Poder',
        procedencia: 'MANUAL', anioDesde: 1515, anioHasta: null,
        notas: 'Poder notarial.', fuentes: [{ id: 3, titulo: 'Protocolo 3' }],
      },
    ],
    rango: { minimo: 1490, maximo: 1560 },
  };
  const window = cargarGrafo(datos);
  const cont = window.document.getElementById('contenido');
  await window.MODULOS.grafo.montar(cont, { id: 2, nombre: 'Proyecto agregado' }, {});
  await esperar(80);

  const buscador = cont.querySelector('.grafo-buscar-entrada');
  buscador.value = 'Ana';
  buscador.dispatchEvent(new window.Event('input', { bubbles: true }));
  await esperar(220);
  buscador.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  await esperar(40);
  buscador.value = '';
  buscador.dispatchEvent(new window.Event('input', { bubbles: true }));
  await esperar(220);

  const filaVinculo = [...cont.querySelectorAll('.grafo-info-relacion')]
    .find((linea) => linea.textContent.includes('3 ×'));
  assert.ok(filaVinculo, 'el panel del nodo debe agrupar las relaciones paralelas');
  filaVinculo.click();
  await esperar(20);
  assert.match(cont.querySelector('.grafo-info-tipo').textContent, /Vínculo · 3 relaciones/);
  assert.match(cont.querySelector('.grafo-info-tipos').textContent, /Correspondencia · 2/);
  assert.match(cont.querySelector('.grafo-info-direcciones').textContent, /2/);
  assert.match(cont.querySelector('.grafo-info-direcciones').textContent, /1/);

  const btnVer = [...cont.querySelectorAll('.grafo-info-acciones .btn')]
    .find((b) => b.textContent === 'Ver las 3 relaciones');
  assert.ok(btnVer);
  btnVer.click();
  await esperar(20);
  const modalVinculo = window.document.querySelector('.grafo-vinculo-modal');
  assert.ok(modalVinculo);
  assert.equal(modalVinculo.querySelectorAll('tbody tr').length, 3);
  assert.match(modalVinculo.textContent, /Carta 1/);
  assert.match(modalVinculo.textContent, /Protocolo 3/);

  modalVinculo.querySelector('tbody tr').click();
  await esperar(20);
  assert.equal(window.document.querySelector('.grafo-vinculo-modal'), null);
  assert.match(cont.querySelector('.grafo-info-fuentes').textContent, /Carta 1/);
  assert.match(cont.querySelector('.grafo-info-notas').textContent, /Primera carta/);

  buscador.value = 'Ana';
  buscador.dispatchEvent(new window.Event('input', { bubbles: true }));
  await esperar(220);
  buscador.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  await esperar(30);
  buscador.value = '';
  buscador.dispatchEvent(new window.Event('input', { bubbles: true }));
  await esperar(220);
  [...cont.querySelectorAll('.grafo-info-relacion')]
    .find((linea) => linea.textContent.includes('3 ×')).click();
  await esperar(20);
  const btnDesagregar = [...cont.querySelectorAll('.grafo-info-acciones .btn')]
    .find((b) => b.textContent === 'Desagregar en el grafo');
  assert.ok(btnDesagregar);
  btnDesagregar.click();
  await esperar(30);
  const btnAgrupar = [...cont.querySelectorAll('.grafo-info-acciones .btn')]
    .find((b) => b.textContent === 'Agrupar las 3 relaciones');
  assert.ok(btnAgrupar, 'las relaciones desagregadas deben poder agruparse de nuevo');
  btnAgrupar.click();
  await esperar(30);
  assert.match(cont.querySelector('.grafo-info-tipo').textContent, /Vínculo · 3 relaciones/);

  const btnTabla = [...cont.querySelectorAll('.grafo-acciones .btn')]
    .find((b) => b.textContent === 'Ver como tabla');
  btnTabla.click();
  await esperar(20);
  const modalTabla = window.document.querySelector('.grafo-tabla-modal');
  assert.ok(modalTabla);
  const btnImprimir = [...modalTabla.querySelectorAll('.modal-acciones .btn')]
    .find((b) => b.textContent === 'Imprimir');
  const btnCSV = [...modalTabla.querySelectorAll('.modal-acciones .btn')]
    .find((b) => b.textContent === 'Exportar CSV');
  const btnHoja = [...modalTabla.querySelectorAll('.modal-acciones .btn')]
    .find((b) => b.textContent === 'Exportar hoja de cálculo');
  assert.ok(btnImprimir && btnCSV && btnHoja);

  window.__impreso = 0;
  window.print = () => { window.__impreso++; };
  btnImprimir.click();
  await esperar(20);
  assert.equal(window.__impreso, 1);
  const zona = window.document.getElementById('zona-impresion');
  assert.match(zona.textContent, /Vista de grafo como tabla/);
  assert.match(zona.textContent, /Ana Pérez/);
  assert.match(zona.textContent, /Correspondencia/);
  window.dispatchEvent(new window.Event('afterprint'));
  assert.equal(zona.textContent, '');

  btnCSV.click();
  await esperar(20);
  const exportacionCSV = (window.__exportaciones || []).slice(-1)[0];
  assert.equal(exportacionCSV.tipo, 'csv');
  assert.match(exportacionCSV.contenido, /ENTIDADES/);
  assert.match(exportacionCSV.contenido, /RELACIONES/);
  assert.match(exportacionCSV.contenido, /Ana Pérez/);
  assert.match(exportacionCSV.contenido, /Correspondencia/);

  btnHoja.click();
  await esperar(20);
  const exportacionXLS = (window.__exportaciones || []).slice(-1)[0];
  assert.equal(exportacionXLS.tipo, 'xls');
  assert.match(exportacionXLS.contenido, /<Workbook/);
  assert.match(exportacionXLS.contenido, /ss:Name="Entidades"/);
  assert.match(exportacionXLS.contenido, /ss:Name="Relaciones"/);
  const xml = new window.DOMParser().parseFromString(exportacionXLS.contenido, 'application/xml');
  assert.equal(xml.querySelector('parsererror'), null);

  window.MODULOS.grafo.desmontar();
});

test('UI de grafo: dirección bidireccional según NRELACIONES', async () => {
  const datos = {
    nodos: [
      {
        id: 'persona:1', tipo: 'persona', entidadId: 1, identificador: 'PE00001',
        etiqueta: 'Ana Pérez', detalle: '', notas: '', anioDesde: 1500, anioHasta: 1560,
      },
      {
        id: 'persona:2', tipo: 'persona', entidadId: 2, identificador: 'PE00002',
        etiqueta: 'Bernardo Gil', detalle: '', notas: '', anioDesde: 1490, anioHasta: 1550,
      },
      {
        id: 'institucion:1', tipo: 'institucion', entidadId: 1, identificador: 'IN00001',
        etiqueta: 'Cabildo', detalle: '', notas: '', anioDesde: 1490, anioHasta: 1600,
      },
    ],
    aristas: [
      {
        id: 1, origen: 'persona:1', destino: 'persona:2', tipo: 'Amigos',
        procedencia: 'MANUAL', anioDesde: 1510, anioHasta: null,
        notas: 'Amistad documentada.', fuentes: [{ id: 1, titulo: 'Carta de amistad' }],
      },
      {
        id: 2, origen: 'persona:1', destino: 'institucion:1', tipo: 'Miembro',
        procedencia: 'MANUAL', anioDesde: 1510, anioHasta: null,
        notas: 'Miembro del cabildo.', fuentes: [{ id: 2, titulo: 'Acta capitular' }],
      },
    ],
    rango: { minimo: 1490, maximo: 1600 },
  };
  const window = cargarGrafo(datos);
  assert.equal(window.esRelacionBidireccional('Amigos'), true);
  assert.equal(window.esRelacionBidireccional('Correspondientes legales'), true);
  assert.equal(window.esRelacionBidireccional('Hermanos'), true);
  assert.equal(window.esRelacionBidireccional('Animadversión'), true);
  assert.equal(window.esRelacionBidireccional('Miembro'), false);
  assert.equal(window.esRelacionBidireccional('Traidor – Traicionado'), false);

  const cont = window.document.getElementById('contenido');
  await window.MODULOS.grafo.montar(cont, { id: 4, nombre: 'Proyecto dirección' }, {});
  await esperar(80);

  const buscador = cont.querySelector('.grafo-buscar-entrada');
  buscador.value = 'Ana';
  buscador.dispatchEvent(new window.Event('input', { bubbles: true }));
  await esperar(220);
  buscador.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  await esperar(30);
  buscador.value = '';
  buscador.dispatchEvent(new window.Event('input', { bubbles: true }));
  await esperar(220);

  [...cont.querySelectorAll('.grafo-info-relacion')]
    .find((linea) => linea.textContent.includes('Amigos')).click();
  await esperar(20);
  assert.match(cont.querySelector('.grafo-info h3').textContent, /↔/);
  assert.match(cont.querySelector('.grafo-info').textContent, /Relación bidireccional/);

  buscador.value = 'Ana';
  buscador.dispatchEvent(new window.Event('input', { bubbles: true }));
  await esperar(220);
  buscador.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  await esperar(30);
  buscador.value = '';
  buscador.dispatchEvent(new window.Event('input', { bubbles: true }));
  await esperar(220);
  [...cont.querySelectorAll('.grafo-info-relacion')]
    .find((linea) => linea.textContent.includes('Miembro')).click();
  await esperar(20);
  assert.match(cont.querySelector('.grafo-info h3').textContent, /→/);
  assert.doesNotMatch(cont.querySelector('.grafo-info').textContent, /Relación bidireccional/);

  window.MODULOS.grafo.desmontar();
});

test('UI de grafo: exportación PNG imprimible además de la versión en color', async () => {
  const window = cargarGrafo();
  const cont = window.document.getElementById('contenido');
  await window.MODULOS.grafo.montar(cont, { id: 3, nombre: 'Proyecto PNG' }, {});
  await esperar(80);

  window.__descargas = [];
  window.URL.createObjectURL = () => 'blob:prueba';
  window.URL.revokeObjectURL = () => {};
  window.HTMLCanvasElement.prototype.toBlob = function toBlob(callback) {
    callback(new window.Blob(['png'], { type: 'image/png' }));
  };
  window.HTMLAnchorElement.prototype.click = function click() {
    window.__descargas.push(this.download);
  };

  const btnOpciones = [...cont.querySelectorAll('.grafo-acciones .btn')]
    .find((b) => b.textContent === 'Opciones PNG');
  btnOpciones.click();
  await esperar(20);
  const modal = window.document.querySelector('.modal');
  const labelImprimible = [...modal.querySelectorAll('label')]
    .find((label) => /versión imprimible/i.test(label.textContent));
  assert.ok(labelImprimible);
  const check = labelImprimible.querySelector('input');
  check.checked = true;
  check.dispatchEvent(new window.Event('change', { bubbles: true }));
  [...modal.querySelectorAll('.modal-acciones .btn')]
    .find((b) => b.textContent === 'Guardar opciones').click();

  const btnExportar = [...cont.querySelectorAll('.grafo-acciones .btn')]
    .find((b) => b.textContent === 'Exportar PNG');
  btnExportar.click();
  await esperar(40);
  assert.deepEqual(window.__descargas.slice().sort(), [
    'grafo-himago-imprimible.png',
    'grafo-himago.png',
  ]);

  window.MODULOS.grafo.desmontar();
});

test('UI de grafo: el histograma agrupa rangos históricos largos', async () => {
  const window = cargarGrafo({
    nodos: [
      { id: 'persona:1', tipo: 'persona', entidadId: 1, etiqueta: 'Ana', nombre: 'Ana' },
      { id: 'lugar:1', tipo: 'lugar', entidadId: 1, etiqueta: 'Sevilla', nombre: 'Sevilla' },
    ],
    aristas: [{
      id: 1, origen: 'persona:1', destino: 'lugar:1', tipo: 'Vecino',
      procedencia: 'MANUAL', anioDesde: 1400, anioHasta: 1800,
    }],
    rango: { minimo: 1400, maximo: 1800 },
  });
  const cont = window.document.getElementById('contenido');
  await window.MODULOS.grafo.montar(cont, { id: 4, nombre: 'Proyecto largo' }, {});
  await esperar(80);
  const barras = [...cont.querySelectorAll('.grafo-histograma-barra')];
  assert.ok(barras.length > 0);
  assert.ok(barras.length <= 240, `se crearon ${barras.length} barras para 401 años`);
  assert.match(barras[0].title, /1400–1401: 2 relación/);
  window.MODULOS.grafo.desmontar();
});
