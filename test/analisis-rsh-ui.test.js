'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');
const { calcularAnalisis } = require('../lib/analisis-rsh/indice');

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
  const datos = {
    nodos: [
      { id: 'persona:1', tipo: 'persona', entidadId: 1, identificador: 'PE00001', etiqueta: 'Ana Pérez', nombre: 'Ana', apellidos: 'Pérez', genero: 'Femenino', notas: 'Nota de Ana' },
      { id: 'persona:2', tipo: 'persona', entidadId: 2, identificador: 'PE00002', etiqueta: 'Bernardo Gil', nombre: 'Bernardo', apellidos: 'Gil', genero: 'Masculino', notas: '' },
      { id: 'institucion:1', tipo: 'institucion', entidadId: 1, identificador: 'IN00001', etiqueta: 'Cabildo', nombre: 'Cabildo', tipoEntidad: 'municipal', notas: 'Nota del cabildo' },
      { id: 'lugar:1', tipo: 'lugar', entidadId: 1, identificador: 'LU00001', etiqueta: 'Sevilla', nombre: 'Sevilla', tipoEntidad: 'ciudad', notas: '' },
    ],
    aristas: [
      { id: 1, origen: 'persona:1', destino: 'institucion:1', tipo: 'Miembro', procedencia: 'MANUAL', anioDesde: 1520, anioHasta: null },
      { id: 2, origen: 'persona:1', destino: 'persona:2', tipo: 'Hermanos', procedencia: 'EDITADA', anioDesde: null, anioHasta: null },
      { id: 3, origen: 'persona:1', destino: 'persona:2', tipo: 'Hermanos', procedencia: 'AUTOMATIZADA', anioDesde: null, anioHasta: null },
    ],
    rango: { minimo: 1500, maximo: 1560 },
  };
  window.__calculos = 0;
  window.__exportaciones = [];
  window.api = {
    grafoDatos: async () => ({ ok: true, datos }),
    analisisCalcular: async (payload) => {
      window.__calculos++;
      return { ok: true, datos: calcularAnalisis(payload, () => {}) };
    },
    analisisCancelar: async () => ({ ok: true, datos: true }),
    analisisExportar: async (datos) => {
      window.__exportaciones.push(datos);
      return { ok: true, datos: { cancelado: false, ruta: 'C:/tmp/analisis.csv' } };
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

test('Análisis RSH: no calcula al montar, es opcional y muestra resultados', async () => {
  const window = cargarGrafo();
  const cont = window.document.getElementById('contenido');
  await window.MODULOS.grafo.montar(cont, { id: 1, nombre: 'Proyecto' }, {});
  await esperar(60);

  const boton = [...cont.querySelectorAll('.grafo-acciones .btn')]
    .find((b) => b.textContent === 'Análisis RSH');
  assert.ok(boton, 'debe existir el botón Análisis RSH');
  assert.equal(window.__calculos, 0, 'no debe calcularse nada al montar');

  const panel = cont.querySelector('#grafo-analisis-rsh');
  assert.ok(panel);
  assert.equal(panel.hidden, true);
  boton.click();
  assert.equal(panel.hidden, false);

  const btnCalcular = [...panel.querySelectorAll('button')]
    .find((b) => b.textContent === 'Calcular Análisis RSH');
  assert.ok(btnCalcular.disabled, 'sin métricas seleccionadas no se puede calcular');

  const checkGrado = panel.querySelector('input[data-metrica="grado"]');
  checkGrado.checked = true;
  checkGrado.dispatchEvent(new window.Event('change', { bubbles: true }));
  assert.equal(btnCalcular.disabled, false);
  btnCalcular.click();
  await esperar(100);

  assert.equal(window.__calculos, 1);
  const tabla = cont.querySelector('.tabla-analisis-rsh');
  assert.ok(tabla, 'debe aparecer la tabla de resultados');
  assert.match(tabla.textContent, /Ana Pérez/);
  assert.match(cont.querySelector('.grafo-analisis-estado').textContent, /calculado/i);
  assert.equal(cont.querySelector('.grafo-analisis-configuracion').hidden, true);

  const filaAna = [...tabla.querySelectorAll('tbody tr')]
    .find((tr) => tr.textContent.includes('Ana Pérez'));
  assert.ok(filaAna);
  assert.match(filaAna.textContent, /Femenino/);
  assert.match(filaAna.textContent, /Nota de Ana/);
  filaAna.click();
  await esperar(30);
  assert.ok(cont.querySelector('.grafo-info-metricas'), 'la ficha del nodo muestra métricas RSH');

  const selectTamano = cont.querySelector('.grafo-analisis-visual select');
  assert.ok(selectTamano, 'debe existir el control de tamaño de nodo');

  const btnExportar = [...cont.querySelectorAll('button')]
    .find((b) => b.textContent === 'Exportar Análisis RSH (CSV)');
  assert.ok(btnExportar);
  btnExportar.click();
  await esperar(50);
  assert.equal(window.__exportaciones.length, 1);
  assert.match(window.__exportaciones[0].contenido, /Análisis RSH/);
  assert.match(window.__exportaciones[0].contenido, /PE00001/);

  const btnDesactivar = [...cont.querySelectorAll('button')]
    .find((b) => b.textContent === 'Desactivar');
  assert.ok(btnDesactivar);
  btnDesactivar.click();
  await esperar(20);
  assert.equal(cont.querySelector('.grafo-analisis-configuracion').hidden, false);
  assert.equal(cont.querySelector('.tabla-analisis-rsh'), null);

  window.MODULOS.grafo.desmontar();
});

test('Análisis RSH: comunidades Leiden y control de color opcional', async () => {
  const window = cargarGrafo();
  const cont = window.document.getElementById('contenido');
  await window.MODULOS.grafo.montar(cont, { id: 1, nombre: 'Proyecto' }, {});
  await esperar(60);
  const panel = cont.querySelector('#grafo-analisis-rsh');
  const boton = [...cont.querySelectorAll('.grafo-acciones .btn')]
    .find((b) => b.textContent === 'Análisis RSH');
  boton.click();

  const checkComunidades = panel.querySelector('input[data-metrica="comunidades"]');
  checkComunidades.checked = true;
  checkComunidades.dispatchEvent(new window.Event('change', { bubbles: true }));
  const btnCalcular = [...panel.querySelectorAll('button')]
    .find((b) => b.textContent === 'Calcular Análisis RSH');
  btnCalcular.click();
  await esperar(120);

  const btnTabComunidades = [...panel.querySelectorAll('.grafo-analisis-tabs .btn')]
    .find((b) => b.textContent === 'Comunidades');
  assert.ok(btnTabComunidades);
  assert.equal(btnTabComunidades.hidden, false);
  btnTabComunidades.click();
  await esperar(20);
  assert.ok(panel.querySelectorAll('.grafo-analisis-comunidad').length > 0);

  const checkColor = [...panel.querySelectorAll('.grafo-analisis-visual input[type="checkbox"]')][0];
  assert.ok(checkColor);
  checkColor.checked = true;
  checkColor.dispatchEvent(new window.Event('change', { bubbles: true }));
  await esperar(20);
  assert.equal(cont.querySelector('.grafo-analisis-visual select').value, 'actual');

  window.MODULOS.grafo.desmontar();
});

test('Análisis RSH: la red completa no se invalida con filtros visuales; la visible sí', async () => {
  const window = cargarGrafo();
  const cont = window.document.getElementById('contenido');
  await window.MODULOS.grafo.montar(cont, { id: 1, nombre: 'Proyecto' }, {});
  await esperar(60);
  const panel = cont.querySelector('#grafo-analisis-rsh');
  const boton = [...cont.querySelectorAll('.grafo-acciones .btn')]
    .find((b) => b.textContent === 'Análisis RSH');
  boton.click();

  const checkGrado = panel.querySelector('input[data-metrica="grado"]');
  checkGrado.checked = true;
  checkGrado.dispatchEvent(new window.Event('change', { bubbles: true }));
  const btnCalcular = [...panel.querySelectorAll('button')]
    .find((b) => b.textContent === 'Calcular Análisis RSH');
  btnCalcular.click();
  await esperar(80);
  assert.equal(window.__calculos, 1);

  const chipPersona = cont.querySelector('.grafo-barra .chip[data-tipo="persona"]');
  chipPersona.click();
  await esperar(30);
  assert.equal(panel.querySelector('.grafo-analisis-obsoleto').hidden, true, 'la red completa no se invalida');

  const radioVisible = panel.querySelector('input[name="grafo-analisis-ambito"][value="visible"]');
  radioVisible.checked = true;
  radioVisible.dispatchEvent(new window.Event('change', { bubbles: true }));
  btnCalcular.click();
  await esperar(80);
  assert.equal(window.__calculos, 2);

  chipPersona.click();
  await esperar(30);
  assert.equal(panel.querySelector('.grafo-analisis-obsoleto').hidden, false, 'la red visible sí se invalida');

  window.MODULOS.grafo.desmontar();
});
