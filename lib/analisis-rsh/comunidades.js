'use strict';

/* H-IMAGO · Análisis RSH: comunidades mediante Leiden.
   Leiden opera sobre grafos no dirigidos. La red dirigida se proyecta a una
   red no dirigida ponderada por el número de relaciones de cada par. */

const { Graph, leiden } = require('../../src/vendor/leiden/leiden.cjs');

function construirParesPonderados(red) {
  const pares = new Map();
  for (const arista of red.aristas) {
    const o = red.indice.get(arista.origen);
    const d = red.indice.get(arista.destino);
    if (o == null || d == null || o === d) continue;
    const a = Math.min(o, d);
    const b = Math.max(o, d);
    const clave = `${a}:${b}`;
    pares.set(clave, (pares.get(clave) || 0) + 1);
  }
  return [...pares.entries()].map(([clave, peso]) => {
    const [a, b] = clave.split(':').map(Number);
    return [a, b, peso];
  });
}

function combinaciones2(n) {
  return (n * (n - 1)) / 2;
}

/** Índice Rand ajustado entre dos asignaciones de la misma longitud. */
function indiceRandAjustado(a, b) {
  const n = Math.min(a.length, b.length);
  if (n < 2) return 1;
  const contingencia = new Map();
  const filas = new Map();
  const columnas = new Map();
  for (let i = 0; i < n; i++) {
    const clave = `${a[i]}\u0000${b[i]}`;
    contingencia.set(clave, (contingencia.get(clave) || 0) + 1);
    filas.set(a[i], (filas.get(a[i]) || 0) + 1);
    columnas.set(b[i], (columnas.get(b[i]) || 0) + 1);
  }
  let sumaCeldas = 0;
  for (const valor of contingencia.values()) sumaCeldas += combinaciones2(valor);
  let sumaFilas = 0;
  for (const valor of filas.values()) sumaFilas += combinaciones2(valor);
  let sumaColumnas = 0;
  for (const valor of columnas.values()) sumaColumnas += combinaciones2(valor);
  const total = combinaciones2(n);
  if (total === 0) return 1;
  const esperado = (sumaFilas * sumaColumnas) / total;
  const maximo = (sumaFilas + sumaColumnas) / 2;
  if (maximo === esperado) return 1;
  return (sumaCeldas - esperado) / (maximo - esperado);
}

function asignacionSingleton(n) {
  return Int32Array.from({ length: n }, (_, i) => i);
}

function calcularComunidades(red, opciones = {}, onProgress = () => {}) {
  const n = red.n;
  const porNodo = {};
  if (n === 0) {
    return {
      porNodo,
      asignacion: [],
      numComunidades: 0,
      modularidad: 0,
      tamanos: [],
      metodo: 'Leiden',
      proyeccion: 'no dirigida',
      repeticiones: 0,
      estabilidad: null,
      advertencias: [],
    };
  }

  const aristas = construirParesPonderados(red);
  const resolucion = Number.isFinite(Number(opciones.resolucion))
    ? Math.max(0.01, Number(opciones.resolucion))
    : 1;
  const semilla = Number.isFinite(Number(opciones.semilla))
    ? Math.trunc(Number(opciones.semilla))
    : 42;
  const repeticiones = Math.max(1, Math.min(10, Number(opciones.repeticiones) || 3));
  const advertencias = [];

  let mejorModularidad = -Infinity;
  let asignacionMejor = null;
  let indiceMejor = -1;
  const ejecuciones = [];

  if (!aristas.length) {
    asignacionMejor = asignacionSingleton(n);
    mejorModularidad = 0;
    advertencias.push('La red no tiene relaciones: cada entidad queda en su propia comunidad.');
  } else {
    const graph = Graph.fromEdgeList(n, aristas, { selfLoops: 'collapse' });
    for (let repeticion = 0; repeticion < repeticiones; repeticion++) {
      const resultado = leiden(graph, {
        seed: semilla + repeticion,
        resolution: resolucion,
      });
      const asignacion = Int32Array.from(resultado.partition.assignments);
      ejecuciones.push(asignacion);
      if (resultado.modularity > mejorModularidad) {
        mejorModularidad = resultado.modularity;
        asignacionMejor = asignacion;
        indiceMejor = repeticion;
      }
      onProgress({
        metrica: 'comunidades',
        hechas: repeticion + 1,
        total: repeticiones,
      });
    }
  }

  if (!asignacionMejor) {
    asignacionMejor = asignacionSingleton(n);
    mejorModularidad = 0;
  }

  let estabilidad = ejecuciones.length > 1 ? 1 : null;
  if (ejecuciones.length > 1) {
    let suma = 0;
    let comparaciones = 0;
    for (let i = 0; i < ejecuciones.length; i++) {
      if (i === indiceMejor) continue;
      suma += indiceRandAjustado(Array.from(asignacionMejor), Array.from(ejecuciones[i]));
      comparaciones++;
    }
    estabilidad = comparaciones ? suma / comparaciones : 1;
  }

  let numComunidades = 0;
  for (let i = 0; i < asignacionMejor.length; i++) {
    const valor = Number(asignacionMejor[i]) + 1;
    if (valor > numComunidades) numComunidades = valor;
  }
  const conteos = new Map();
  for (let i = 0; i < n; i++) {
    const comunidad = Number(asignacionMejor[i]);
    conteos.set(comunidad, (conteos.get(comunidad) || 0) + 1);
  }

  const tamanos = [...conteos.entries()]
    .map(([comunidad, tamano]) => ({ comunidad: comunidad + 1, tamano }))
    .sort((a, b) => b.tamano - a.tamano || a.comunidad - b.comunidad);

  for (let i = 0; i < n; i++) {
    const comunidadInterna = Number(asignacionMejor[i]);
    const tamano = conteos.get(comunidadInterna) || 0;
    porNodo[red.nodos[i].id] = {
      comunidad: comunidadInterna + 1,
      comunidadInterna,
      tamano,
    };
  }

  if (red.dirigida) {
    advertencias.push(
      'Leiden se aplica sobre una proyección no dirigida ponderada por el número de relaciones.'
    );
  }
  if (numComunidades === n && n > 1) {
    advertencias.push('No se han encontrado agrupaciones: cada entidad forma su propia comunidad.');
  }
  if (estabilidad != null && estabilidad < 0.7 && numComunidades > 1) {
    advertencias.push('La partición es poco estable entre semillas; interpreta las comunidades con cautela.');
  }

  return {
    porNodo,
    asignacion: Array.from(asignacionMejor),
    numComunidades,
    modularidad: Number.isFinite(mejorModularidad) ? mejorModularidad : 0,
    tamanos,
    metodo: 'Leiden',
    proyeccion: 'no dirigida',
    resolucion,
    semilla,
    repeticiones,
    estabilidad,
    advertencias,
  };
}

module.exports = {
  calcularComunidades,
  construirParesPonderados,
  indiceRandAjustado,
};
