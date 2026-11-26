'use strict';

/* H-IMAGO · Análisis RSH: constantes compartidas por el proceso principal,
   el worker de cálculo y las pruebas. */

const METRICAS_ANALISIS = [
  'grado',
  'intermediacion',
  'cercania',
  'vectorPropio',
  'comunidades',
  'densidad',
  'componentes',
];

const ETIQUETAS_METRICAS = {
  grado: 'Grado',
  intermediacion: 'Intermediación',
  cercania: 'Cercanía',
  vectorPropio: 'Vector propio / PageRank',
  comunidades: 'Comunidades',
  densidad: 'Densidad',
  componentes: 'Componentes',
};

/* Umbrales provisionales. Se revisan con scripts/benchmark-analisis-rsh.js. */
const UMBRAL_INTERMEDIACION_EXACTA = 1500;
const MUESTRAS_INTERMEDIACION = 400;
const UMBRAL_CERCANIA_EXACTA = 5000;
const MUESTRAS_CERCANIA = 400;
const MAX_NODOS_ANALISIS = 50000;
const MAX_ARISTAS_ANALISIS = 200000;
const MAX_TEXTO_ETIQUETA = 1200;

module.exports = {
  METRICAS_ANALISIS,
  ETIQUETAS_METRICAS,
  UMBRAL_INTERMEDIACION_EXACTA,
  MUESTRAS_INTERMEDIACION,
  UMBRAL_CERCANIA_EXACTA,
  MUESTRAS_CERCANIA,
  MAX_NODOS_ANALISIS,
  MAX_ARISTAS_ANALISIS,
  MAX_TEXTO_ETIQUETA,
};
