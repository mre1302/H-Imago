'use strict';

/* H-IMAGO · Benchmark de Análisis RSH.
   Genera redes sintéticas y mide las métricas para revisar los umbrales de
   cálculo exacto/aproximado. Uso:
     node scripts/benchmark-analisis-rsh.js [nodos...]
   Por defecto: 500, 1000, 2000, 5000. */

const { performance } = require('node:perf_hooks');
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

function generadorAleatorio(semilla) {
  let estado = semilla >>> 0;
  return () => {
    estado = (estado * 1664525 + 1013904223) >>> 0;
    return estado / 0x100000000;
  };
}

function redSintetica(n, gradoMedio, semilla = 42) {
  const aleatorio = generadorAleatorio(semilla);
  const nodos = Array.from({ length: n }, (_, i) => ({
    id: `n${i}`,
    tipo: i % 5 === 0 ? 'institucion' : 'persona',
    etiqueta: `Entidad ${i + 1}`,
  }));
  const aristas = [];
  let id = 1;
  const objetivo = Math.floor((n * gradoMedio) / 2);
  const pares = new Set();
  let intentos = 0;
  while (aristas.length < objetivo && intentos < objetivo * 20) {
    intentos++;
    const a = Math.floor(aleatorio() * n);
    const b = Math.floor(aleatorio() * n);
    if (a === b) continue;
    const clave = a < b ? `${a}:${b}` : `${b}:${a}`;
    if (pares.has(clave)) continue;
    pares.add(clave);
    aristas.push({
      id: id++,
      origen: `n${a}`,
      destino: `n${b}`,
      tipo: 'Relación sintética',
      procedencia: 'MANUAL',
    });
  }
  return { nodos, aristas };
}

function medir(fn) {
  const inicio = performance.now();
  const resultado = fn();
  return { resultado, ms: performance.now() - inicio };
}

function ejecutar(n, gradoMedio = 8) {
  const datos = redSintetica(n, gradoMedio);
  const red = construirRed(datos.nodos, datos.aristas, { dirigida: true, incluirAislados: true });
  const fila = {
    n: red.n,
    m: red.m,
    independientes: red.m,
    pares: red.mPares,
    grado: medir(() => calcularGrado(red)).ms,
    componentes: medir(() => calcularComponentes(red)).ms,
    densidad: medir(() => calcularDensidad(red)).ms,
    intermediacion: null,
    intermediacionMs: 0,
    cercania: null,
    pagerank: null,
    leiden: null,
  };
  const inicioInter = performance.now();
  fila.intermediacion = calcularIntermediacion(red);
  fila.intermediacionMs = performance.now() - inicioInter;

  if (n <= 5000) {
    const inicioCerca = performance.now();
    fila.cercania = calcularCercania(red);
    fila.cercaniaMs = performance.now() - inicioCerca;
  }
  const inicioPr = performance.now();
  fila.pagerank = calcularCentralidadVectorPropio(red);
  fila.pagerankMs = performance.now() - inicioPr;
  const inicioLeiden = performance.now();
  fila.leiden = calcularComunidades(red, { repeticiones: 2 });
  fila.leidenMs = performance.now() - inicioLeiden;
  return fila;
}

function main() {
  const argumentos = process.argv.slice(2)
    .map(Number)
    .filter((n) => Number.isInteger(n) && n > 0);
  const tamanos = argumentos.length ? argumentos : [500, 1000, 2000, 5000];
  console.log('Análisis RSH · benchmark sintético (dirigido, grado medio 8)');
  console.log('n\tm\tpares\tgrado ms\tcomp ms\tdens ms\tinterm ms\taprox\tcerca ms\tpagerank ms\tleiden ms');
  for (const n of tamanos) {
    try {
      const fila = ejecutar(n);
      console.log([
        fila.n,
        fila.m,
        fila.pares,
        fila.grado.toFixed(1),
        fila.componentes.toFixed(1),
        fila.densidad.toFixed(1),
        fila.intermediacionMs.toFixed(1),
        fila.intermediacion.aproximada ? 'sí' : 'no',
        fila.cercania ? fila.cercaniaMs.toFixed(1) : 'omitida',
        fila.pagerankMs.toFixed(1),
        fila.leidenMs.toFixed(1),
      ].join('\t'));
    } catch (err) {
      console.error(`n=${n}: ${err.message}`);
      process.exitCode = 1;
    }
  }
}

if (require.main === module) main();

module.exports = { redSintetica, ejecutar };
