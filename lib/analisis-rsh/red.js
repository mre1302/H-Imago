'use strict';

/* H-IMAGO · Análisis RSH: construcción de la red analítica.
   Mantiene las aristas independientes y ofrece varias vistas de la misma red:
   - aristas originales, con su id y procedencia;
   - pares únicos (para densidad);
   - adyacencia dirigida y de entrada (para caminos);
   - pesos por par (para Leiden y PageRank). */

const { MAX_TEXTO_ETIQUETA } = require('./constantes');

const TIPOS_ENTIDAD = new Set(['persona', 'institucion', 'lugar', 'patrimonio']);
const PROCEDENCIAS = new Set(['todas', 'manuales', 'editadas', 'automatizadas']);

function texto(valor, maximo = MAX_TEXTO_ETIQUETA) {
  return String(valor == null ? '' : valor).slice(0, maximo);
}

function numero(valor) {
  if (valor === null || valor === undefined || valor === '') return null;
  const n = Number(valor);
  return Number.isFinite(n) ? n : null;
}

function procedenciaPermitida(procedencia, filtro) {
  const valor = String(procedencia || 'MANUAL').toUpperCase();
  if (filtro === 'manuales') return valor === 'MANUAL';
  if (filtro === 'editadas') return valor === 'MANUAL' || valor === 'EDITADA';
  if (filtro === 'automatizadas') return valor === 'AUTOMATIZADA';
  return true;
}

function clavePar(a, b, dirigida) {
  if (dirigida) return `${a}\u0000${b}`;
  return a < b ? `${a}\u0000${b}` : `${b}\u0000${a}`;
}

function sumarPeso(mapa, clave, peso = 1) {
  mapa.set(clave, (mapa.get(clave) || 0) + peso);
}

/**
 * Construye la red analítica.
 *
 * @param {Array} nodosEntrada
 * @param {Array} aristasEntrada
 * @param {object} opciones
 *   - dirigida: boolean (true por defecto)
 *   - incluirAislados: boolean (true por defecto)
 *   - procedencia: 'todas' | 'manuales' | 'editadas' | 'automatizadas'
 */
function construirRed(nodosEntrada, aristasEntrada, opciones = {}) {
  const dirigida = opciones.dirigida !== false;
  const incluirAislados = opciones.incluirAislados !== false;
  const filtroProcedencia = PROCEDENCIAS.has(opciones.procedencia)
    ? opciones.procedencia
    : 'todas';

  const nodos = [];
  const porId = new Map();
  for (const entrada of Array.isArray(nodosEntrada) ? nodosEntrada : []) {
    if (!entrada || !TIPOS_ENTIDAD.has(entrada.tipo)) continue;
    const id = texto(entrada.id, 200);
    if (!id || porId.has(id)) continue;
    const nodo = {
      id,
      tipo: entrada.tipo,
      entidadId: numero(entrada.entidadId),
      etiqueta: texto(entrada.etiqueta) || `#${id}`,
      identificador: texto(entrada.identificador, 40),
      nombre: texto(entrada.nombre, 200),
      apellidos: texto(entrada.apellidos, 200),
      genero: texto(entrada.genero, 80),
      tipoEntidad: texto(entrada.tipoEntidad, 120),
      notas: texto(entrada.notas, 2000),
    };
    nodos.push(nodo);
    porId.set(id, nodo);
  }

  const aristas = [];
  let bucles = 0;
  let aristasDescartadas = 0;
  for (const entrada of Array.isArray(aristasEntrada) ? aristasEntrada : []) {
    if (!entrada) continue;
    const origen = texto(entrada.origen, 200);
    const destino = texto(entrada.destino, 200);
    if (!porId.has(origen) || !porId.has(destino)) {
      aristasDescartadas++;
      continue;
    }
    if (origen === destino) {
      bucles++;
      continue;
    }
    if (!procedenciaPermitida(entrada.procedencia, filtroProcedencia)) continue;
    aristas.push({
      id: entrada.id,
      origen,
      destino,
      tipo: texto(entrada.tipo, 200),
      categoria: texto(entrada.categoria, 120),
      procedencia: texto(entrada.procedencia, 40).toUpperCase() || 'MANUAL',
      anioDesde: numero(entrada.anioDesde),
      anioHasta: numero(entrada.anioHasta),
      fecha: texto(entrada.fecha, 300),
    });
  }

  const incidentes = new Set();
  for (const arista of aristas) {
    incidentes.add(arista.origen);
    incidentes.add(arista.destino);
  }

  let nodosIncluidos = nodos;
  let nodosExcluidos = 0;
  if (!incluirAislados) {
    nodosIncluidos = nodos.filter((nodo) => incidentes.has(nodo.id));
    nodosExcluidos = nodos.length - nodosIncluidos.length;
  }

  const n = nodosIncluidos.length;
  const indice = new Map(nodosIncluidos.map((nodo, i) => [nodo.id, i]));
  const aristasFinales = [];
  for (const arista of aristas) {
    const o = indice.get(arista.origen);
    const d = indice.get(arista.destino);
    if (o == null || d == null) {
      aristasDescartadas++;
      continue;
    }
    aristasFinales.push({ ...arista, o, d });
  }

  const salida = new Int32Array(n);
  const entrada = new Int32Array(n);
  const incidencia = new Int32Array(n);
  const vecinosSalida = Array.from({ length: n }, () => new Set());
  const vecinosEntrada = Array.from({ length: n }, () => new Set());
  const pesosSalida = Array.from({ length: n }, () => new Map());
  const pesosEntrada = Array.from({ length: n }, () => new Map());
  const pares = new Map();

  for (const arista of aristasFinales) {
    const { o, d } = arista;
    salida[o]++;
    entrada[d]++;
    incidencia[o]++;
    if (o !== d) incidencia[d]++;
    vecinosSalida[o].add(d);
    vecinosEntrada[d].add(o);
    if (!dirigida) {
      vecinosSalida[d].add(o);
      vecinosEntrada[o].add(d);
    }
    sumarPeso(pesosSalida[o], d);
    sumarPeso(pesosEntrada[d], o);
    if (!dirigida) {
      sumarPeso(pesosSalida[d], o);
      sumarPeso(pesosEntrada[o], d);
    }
    const clave = clavePar(o, d, dirigida);
    sumarPeso(pares, clave);
  }

  const adyacencia = pesosSalida.map((mapa) => [...mapa.keys()]);
  const adyacenciaEntrada = pesosEntrada.map((mapa) => [...mapa.keys()]);
  const vecinos = Array.from({ length: n }, (_, i) => {
    const conjunto = new Set(vecinosSalida[i]);
    for (const id of vecinosEntrada[i]) conjunto.add(id);
    return conjunto;
  });

  const m = aristasFinales.length;
  const mPares = pares.size;
  const advertencias = [];
  if (aristasDescartadas) {
    advertencias.push(
      `${aristasDescartadas} relación(es) se ignoraron porque sus extremos no están en la red analítica.`
    );
  }
  if (bucles) {
    advertencias.push(`${bucles} relación(es) conectaban una entidad consigo misma y se excluyeron.`);
  }
  if (nodosExcluidos) {
    advertencias.push(`${nodosExcluidos} entidad(es) aislada(s) se excluyeron por configuración.`);
  }

  return {
    nodos: nodosIncluidos,
    aristas: aristasFinales,
    n,
    m,
    mPares,
    dirigida,
    incluirAislados,
    procedencia: filtroProcedencia,
    bucles,
    aristasDescartadas,
    nodosExcluidos,
    indice,
    ids: nodosIncluidos.map((nodo) => nodo.id),
    salida,
    entrada,
    incidencia,
    adyacencia,
    adyacenciaEntrada,
    vecinos,
    vecinosSalida,
    vecinosEntrada,
    pesosSalida,
    pesosEntrada,
    pares,
    advertencias,
  };
}

module.exports = {
  construirRed,
  clavePar,
  procedenciaPermitida,
  TIPOS_ENTIDAD,
  PROCEDENCIAS,
};
