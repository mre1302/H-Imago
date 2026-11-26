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

function cargarGrafo() {
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
  window.api = {
    grafoDatos: async () => ({
      ok: true,
      datos: {
        nodos: [
          { id: 'persona:1', tipo: 'persona', entidadId: 1, etiqueta: 'Ana Pérez', detalle: '1500 – 1560 · Escribana', anioDesde: 1500, anioHasta: 1560 },
          { id: 'persona:2', tipo: 'persona', entidadId: 2, etiqueta: 'Bernardo Gil', detalle: '', anioDesde: null, anioHasta: null },
          { id: 'institucion:1', tipo: 'institucion', entidadId: 1, etiqueta: 'Cabildo', detalle: 'municipal', anioDesde: null, anioHasta: null },
          { id: 'lugar:1', tipo: 'lugar', entidadId: 1, etiqueta: 'Sevilla', detalle: 'ciudad' },
        ],
        aristas: [
          { id: 1, origen: 'persona:1', destino: 'institucion:1', tipo: 'Miembro', anioDesde: 1520, anioHasta: null },
          { id: 2, origen: 'persona:1', destino: 'persona:2', tipo: 'Hermanos', anioDesde: null, anioHasta: null },
        ],
        rango: { minimo: 1500, maximo: 1560 },
      },
    }),
  };
  for (const archivo of ['comun.js', 'modulos/taxonomia-relaciones.js', 'modulos/grafo.js']) {
    const script = window.document.createElement('script');
    script.textContent = fs.readFileSync(path.join(RAIZ, archivo), 'utf8');
    window.document.head.appendChild(script);
  }
  return window;
}

const esperar = (ms) => new Promise((resolver) => setTimeout(resolver, ms));

test('UI de grafo: búsqueda de entidades, de relaciones y exclusión de entidades aisladas', async () => {
  const window = cargarGrafo();
  const cont = window.document.getElementById('contenido');
  await window.MODULOS.grafo.montar(cont, { id: 1, nombre: 'Proyecto' }, {});
  await esperar(80);

  const buscadores = [...cont.querySelectorAll('.grafo-buscar-entrada')];
  assert.equal(buscadores.length, 2, 'debe haber búsqueda de entidades y de relaciones');
  const buscadorEntidad = buscadores[0];
  const buscadorRelacion = buscadores[1];
  assert.ok(buscadorEntidad.closest('.grafo-leyenda'));
  assert.ok(buscadorRelacion.closest('.grafo-leyenda'));
  const leyendaEntidades = cont.querySelector('.grafo-barra .grafo-leyenda');
  const leyendaRelaciones = cont.querySelector('.grafo-barra-relaciones .grafo-leyenda');
  assert.equal(leyendaEntidades.firstElementChild.textContent, 'Entidades');
  assert.ok(leyendaEntidades.firstElementChild.classList.contains('grafo-filtro-titulo'));
  assert.ok(leyendaEntidades.lastElementChild.classList.contains('grafo-buscar'));
  assert.ok(leyendaRelaciones.lastElementChild.classList.contains('grafo-buscar'));
  const botonesAcciones = [...cont.querySelectorAll('.grafo-acciones button')];
  assert.deepEqual(botonesAcciones.slice(0, 4).map((b) => b.textContent),
    ['Entidades', 'Relaciones', 'Temporalidad', 'Reorganizar']);
  assert.equal(cont.querySelectorAll('.grafo-opcion-relacion').length, 183);
  assert.equal(cont.querySelector('datalist'), null);

  const panelEntidades = cont.querySelector('#grafo-panel-entidades');
  const barraRelaciones = cont.querySelector('#grafo-panel-relaciones');
  const btnEntidades = botonesAcciones.find((b) => b.textContent === 'Entidades');
  const btnRelaciones = botonesAcciones.find((b) => b.textContent === 'Relaciones');
  assert.equal(panelEntidades.hidden, true);
  assert.equal(barraRelaciones.hidden, true);
  btnEntidades.click();
  assert.equal(panelEntidades.hidden, false);
  assert.equal(barraRelaciones.hidden, true);
  assert.equal(btnEntidades.getAttribute('aria-expanded'), 'true');
  btnRelaciones.click();
  assert.equal(panelEntidades.hidden, true);
  assert.equal(barraRelaciones.hidden, false);
  assert.equal(btnRelaciones.getAttribute('aria-expanded'), 'true');
  btnRelaciones.click();
  assert.equal(barraRelaciones.hidden, true);
  assert.equal(btnRelaciones.getAttribute('aria-expanded'), 'false');

  const panelTemporal = cont.querySelector('.grafo-tiempo');
  const btnTemporalidad = botonesAcciones.find((b) => b.textContent === 'Temporalidad');
  assert.equal(panelTemporal.hidden, true);
  assert.equal(btnTemporalidad.getAttribute('aria-expanded'), 'false');
  btnTemporalidad.click();
  assert.equal(panelTemporal.hidden, false);
  assert.equal(btnTemporalidad.getAttribute('aria-expanded'), 'true');
  assert.ok(btnTemporalidad.classList.contains('modo-activo'));
  btnTemporalidad.click();
  assert.equal(panelTemporal.hidden, true);
  assert.equal(btnTemporalidad.getAttribute('aria-expanded'), 'false');

  btnRelaciones.click();
  const panelRelaciones = cont.querySelector('.grafo-lista-relaciones');
  assert.ok(panelRelaciones.hidden);
  buscadorRelacion.dispatchEvent(new window.FocusEvent('focus'));
  assert.equal(panelRelaciones.hidden, false);

  const contador = () => cont.querySelector('.contador-grafo').textContent;
  assert.match(contador(), /4 de 4 entidades/);
  assert.match(contador(), /2 de 2 relaciones/);

  buscadorEntidad.value = 'ana';
  buscadorEntidad.dispatchEvent(new window.Event('input', { bubbles: true }));
  await esperar(220);
  assert.match(contador(), /1 de 4 entidades/);

  buscadorEntidad.value = '';
  buscadorEntidad.dispatchEvent(new window.Event('input', { bubbles: true }));
  await esperar(220);
  buscadorRelacion.value = '';
  buscadorRelacion.dispatchEvent(new window.Event('input', { bubbles: true }));
  await esperar(220);
  assert.equal(panelRelaciones.hidden, false);
  const opcionHermanos = [...cont.querySelectorAll('.grafo-opcion-relacion')]
    .find((b) => b.querySelector('.grafo-opcion-nombre')?.textContent === 'Hermanos');
  assert.ok(opcionHermanos);
  opcionHermanos.click();
  await esperar(30);
  assert.equal(buscadorRelacion.value, 'Hermanos');
  assert.match(contador(), /1 de 2 relaciones/);
  assert.match(contador(), /2 de 4 entidades/);
  assert.equal(panelRelaciones.hidden, true);

  buscadorRelacion.value = '';
  buscadorRelacion.dispatchEvent(new window.Event('input', { bubbles: true }));
  await esperar(220);
  const btnExcluir = [...cont.querySelectorAll('button')]
    .find((b) => b.textContent === 'Excluir entidades aisladas');
  assert.ok(btnExcluir);
  assert.equal(btnExcluir.getAttribute('aria-pressed'), 'false');
  btnTemporalidad.click();
  assert.equal(panelTemporal.hidden, false);
  btnExcluir.click();
  await esperar(30);
  assert.equal(btnExcluir.getAttribute('aria-pressed'), 'true');
  assert.ok(btnExcluir.classList.contains('modo-activo'));
  assert.match(contador(), /3 de 4 entidades/);

  window.MODULOS.grafo.desmontar();
});
