'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { Worker } = require('worker_threads');

const { construirRed } = require('../lib/analisis-rsh/red');
const {
  calcularGrado,
  calcularComponentes,
  calcularDensidad,
} = require('../lib/analisis-rsh/basicas');
const {
  calcularIntermediacion,
  calcularCercania,
  calcularCentralidadVectorPropio,
} = require('../lib/analisis-rsh/centralidad');
const { calcularComunidades } = require('../lib/analisis-rsh/comunidades');
const { calcularAnalisis, normalizarMetricas } = require('../lib/analisis-rsh/indice');

function nodos(...ids) {
  return ids.map((id) => ({ id, tipo: 'persona', etiqueta: id.toUpperCase() }));
}

function arista(id, origen, destino, extra = {}) {
  return { id, origen, destino, tipo: 'Relación', procedencia: 'MANUAL', ...extra };
}

function redDe(ids, aristas, opciones = {}) {
  return construirRed(nodos(...ids), aristas, opciones);
}

test('Análisis RSH: aristas independientes, grado, densidad y filtros', () => {
  const red = redDe(['a', 'b', 'c', 'd'], [
    arista(1, 'a', 'b'),
    arista(2, 'a', 'b'),
    arista(3, 'b', 'c'),
    arista(4, 'a', 'a'),
    arista(5, 'x', 'b'),
    arista(6, 'b', 'c', { procedencia: 'AUTOMATIZADA' }),
  ], { dirigida: true });
  assert.equal(red.n, 4);
  assert.equal(red.m, 4);
  assert.equal(red.mPares, 2);
  assert.equal(red.bucles, 1);
  assert.equal(red.aristasDescartadas, 1);

  const grado = calcularGrado(red);
  assert.equal(grado.porNodo.a.total, 2);
  assert.equal(grado.porNodo.a.vecinos, 1);
  assert.equal(grado.porNodo.b.total, 4);
  assert.equal(grado.porNodo.b.vecinos, 2);
  assert.equal(grado.porNodo.d.total, 0);

  const densidad = calcularDensidad(red);
  assert.equal(densidad.paresUnicos, 2);
  assert.equal(densidad.posibles, 12);
  assert.ok(Math.abs(densidad.valor - 2 / 12) < 1e-12);
  assert.ok(Math.abs(densidad.multiplicidadMedia - 2) < 1e-12);

  const soloManuales = redDe(['a', 'b', 'c'], [
    arista(1, 'a', 'b', { procedencia: 'MANUAL' }),
    arista(2, 'b', 'c', { procedencia: 'AUTOMATIZADA' }),
  ], { procedencia: 'manuales' });
  assert.equal(soloManuales.m, 1);

  const sinAislados = redDe(['a', 'b', 'c'], [arista(1, 'a', 'b')], { incluirAislados: false });
  assert.equal(sinAislados.n, 2);
  assert.equal(sinAislados.nodosExcluidos, 1);
});

test('Análisis RSH: componentes débiles y fuertes', () => {
  const red = redDe(['a', 'b', 'c', 'd'], [
    arista(1, 'a', 'b'),
    arista(2, 'b', 'c'),
  ], { dirigida: true });
  const componentes = calcularComponentes(red);
  assert.equal(componentes.numeroDebiles, 2);
  assert.equal(componentes.numeroFuertes, 4);
  assert.equal(componentes.mayorDebil.tamano, 3);
  assert.deepEqual(componentes.aislados, ['d']);
});

test('Análisis RSH: intermediación y cercanía', () => {
  const red = redDe(['a', 'b', 'c'], [
    arista(1, 'a', 'b'),
    arista(2, 'b', 'c'),
  ], { dirigida: true, incluirAislados: true });
  const intermediacion = calcularIntermediacion(red, { maxFuentesExactas: 100 });
  assert.equal(intermediacion.aproximada, false);
  assert.ok(Math.abs(intermediacion.porNodo.b.valor - 0.5) < 1e-12);

  const cercania = calcularCercania(red);
  assert.ok(Math.abs(cercania.porNodo.a.valor - 0.75) < 1e-12);
  assert.ok(Math.abs(cercania.porNodo.b.valor - 0.5) < 1e-12);
  assert.equal(cercania.porNodo.c.valor, 0);

  const desconectada = redDe(['a', 'b', 'c'], [arista(1, 'a', 'b')], { dirigida: true });
  const armónica = calcularCercania(desconectada);
  assert.equal(armónica.porNodo.a.valor, 0.5);
  assert.equal(armónica.porNodo.c.valor, 0);
});

test('Análisis RSH: la intermediación no dirigida no satura por doble conteo', () => {
  const camino = redDe(['a', 'b', 'c', 'd'], [
    arista(1, 'a', 'b'),
    arista(2, 'b', 'c'),
    arista(3, 'c', 'd'),
  ], { dirigida: false });
  const intermediacion = calcularIntermediacion(camino);
  assert.equal(intermediacion.normalizacion, 'no dirigida');
  assert.ok(Math.abs(intermediacion.porNodo.b.valor - 2 / 3) < 1e-12);
  assert.ok(Math.abs(intermediacion.porNodo.c.valor - 2 / 3) < 1e-12);

  const estrella = redDe(['centro', 'a', 'b', 'c', 'd'], [
    arista(1, 'centro', 'a'),
    arista(2, 'centro', 'b'),
    arista(3, 'centro', 'c'),
    arista(4, 'centro', 'd'),
  ], { dirigida: false });
  const centro = calcularIntermediacion(estrella).porNodo.centro.valor;
  assert.ok(Math.abs(centro - 1) < 1e-12, `el centro de la estrella debe valer 1, vale ${centro}`);
});

test('Análisis RSH: el grado dirigido se normaliza con el máximo 2(n-1)', () => {
  const red = redDe(['a', 'b', 'c'], [
    arista(1, 'a', 'b'),
    arista(2, 'b', 'c'),
  ], { dirigida: true });
  const grado = calcularGrado(red);
  assert.equal(grado.porNodo.b.total, 2);
  assert.ok(Math.abs(grado.porNodo.b.normalizado - 0.5) < 1e-12);
  assert.equal(grado.porNodo.a.normalizado, 0.25);
});

test('Análisis RSH: la intermediación puede marcarse como aproximada', () => {
  const red = redDe(['a', 'b', 'c', 'd'], [
    arista(1, 'a', 'b'),
    arista(2, 'b', 'c'),
    arista(3, 'c', 'd'),
  ], { dirigida: true });
  const resultado = calcularIntermediacion(red, { maxFuentesExactas: 2, muestras: 2 });
  assert.equal(resultado.aproximada, true);
  assert.equal(resultado.fuentes, 2);
  assert.ok(resultado.porNodo.b.valor >= 0);

  const cercania = calcularCercania(red, {
    maxFuentesExactasCercania: 2,
    muestrasCercania: 2,
  });
  assert.equal(cercania.aproximada, true);
  assert.equal(cercania.fuentes, 2);
  assert.equal(cercania.exacta, false);
});

test('Análisis RSH: PageRank dirigido y vector propio no dirigido', () => {
  const dirigida = redDe(['a', 'b', 'c'], [
    arista(1, 'a', 'b'),
    arista(2, 'b', 'c'),
    arista(3, 'c', 'a'),
  ], { dirigida: true });
  const pagerank = calcularCentralidadVectorPropio(dirigida);
  assert.equal(pagerank.metodo, 'PageRank');
  assert.equal(pagerank.convergio, true);
  for (const info of Object.values(pagerank.porNodo)) {
    assert.ok(Math.abs(info.valor - 1) < 1e-9);
  }

  const noDirigida = redDe(['a', 'b', 'c'], [
    arista(1, 'a', 'b'),
    arista(2, 'b', 'c'),
  ], { dirigida: false });
  const vector = calcularCentralidadVectorPropio(noDirigida);
  assert.equal(vector.metodo, 'Vector propio');
  assert.ok(vector.porNodo.b.valor >= vector.porNodo.a.valor);
  assert.ok(vector.porNodo.b.valor >= vector.porNodo.c.valor);
});

test('Análisis RSH: el vector propio converge en una red bipartita', () => {
  const estrella = redDe(['centro', 'a', 'b', 'c', 'd'], [
    arista(1, 'centro', 'a'),
    arista(2, 'centro', 'b'),
    arista(3, 'centro', 'c'),
    arista(4, 'centro', 'd'),
  ], { dirigida: false });
  const vector = calcularCentralidadVectorPropio(estrella);
  assert.equal(vector.convergio, true, 'la iteración A+I debe romper la oscilación bipartita');
  assert.equal(vector.porNodo.centro.valor, 1);
  assert.ok(vector.porNodo.a.valor < vector.porNodo.centro.valor);
});

test('Análisis RSH: comunidades Leiden en dos grupos separados', () => {
  const red = redDe(['a', 'b', 'c', 'd', 'e', 'f'], [
    arista(1, 'a', 'b'),
    arista(2, 'a', 'c'),
    arista(3, 'b', 'c'),
    arista(4, 'd', 'e'),
    arista(5, 'd', 'f'),
    arista(6, 'e', 'f'),
  ], { dirigida: false });
  const comunidades = calcularComunidades(red, { repeticiones: 3, semilla: 42 });
  assert.equal(comunidades.numComunidades, 2);
  assert.equal(comunidades.tamanos[0].tamano, 3);
  assert.equal(comunidades.tamanos[1].tamano, 3);
  assert.ok(comunidades.modularidad > 0.4);
  assert.equal(comunidades.metodo, 'Leiden');
  assert.equal(comunidades.estabilidad, 1);

  const unaSola = calcularComunidades(red, { repeticiones: 1, semilla: 42 });
  assert.equal(unaSola.estabilidad, null);
  assert.ok(!unaSola.advertencias.some((texto) => /poco estable/i.test(texto)));
});

test('Análisis RSH: solo se calculan las métricas solicitadas', () => {
  const resultado = calcularAnalisis({
    nodos: nodos('a', 'b'),
    aristas: [arista(1, 'a', 'b')],
    metricas: ['grado', 'componentes', 'densidad'],
    opciones: { dirigida: true, incluirAislados: true },
  });
  assert.deepEqual(Object.keys(resultado.metricas).sort(), ['componentes', 'densidad', 'grado']);
  assert.equal(resultado.metricas.grado.porNodo.a.total, 1);
  assert.equal(resultado.metricas.densidad.valor, 0.5);
  assert.equal(resultado.metricas.componentes.numeroDebiles, 1);
  assert.deepEqual(normalizarMetricas(['grado', 'inventada', 'grado']), ['grado']);
});

test('Análisis RSH: worker de cálculo devuelve progreso y resultado', async () => {
  const worker = new Worker(path.join(__dirname, '..', 'db', 'analisis-rsh-worker.js'));
  const mensajes = [];
  try {
    const resultado = await new Promise((resolver, rechazar) => {
      worker.on('message', (mensaje) => {
        mensajes.push(mensaje);
        if (mensaje.tipo === 'resultado') resolver(mensaje.resultado);
        if (mensaje.tipo === 'error') rechazar(new Error(mensaje.error));
      });
      worker.on('error', rechazar);
      worker.postMessage({
        solicitudId: 'test-worker',
        nodos: nodos('a', 'b', 'c'),
        aristas: [arista(1, 'a', 'b'), arista(2, 'b', 'c')],
        metricas: ['grado', 'densidad'],
        opciones: { dirigida: true, incluirAislados: true },
      });
    });
    assert.equal(resultado.red.n, 3);
    assert.equal(resultado.metricas.grado.porNodo.b.total, 2);
    assert.ok(mensajes.some((m) => m.tipo === 'progreso'));
  } finally {
    await worker.terminate();
  }
});
