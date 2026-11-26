'use strict';

/* H-IMAGO · Análisis RSH: orquestador puro.
   Recibe una foto de nodos/aristas y devuelve solo las métricas solicitadas. */

const {
  METRICAS_ANALISIS,
} = require('./constantes');
const { construirRed } = require('./red');
const {
  calcularGrado,
  calcularComponentes,
  calcularDensidad,
} = require('./basicas');
const {
  calcularIntermediacion,
  calcularCercania,
  calcularCentralidadVectorPropio,
} = require('./centralidad');
const { calcularComunidades } = require('./comunidades');

function normalizarMetricas(metricas) {
  if (!Array.isArray(metricas)) return [];
  return [...new Set(metricas.filter((metrica) => METRICAS_ANALISIS.includes(metrica)))];
}

function resumenRed(red) {
  return {
    n: red.n,
    m: red.m,
    paresUnicos: red.mPares,
    dirigida: red.dirigida,
    incluirAislados: red.incluirAislados,
    procedencia: red.procedencia,
    bucles: red.bucles,
    aristasDescartadas: red.aristasDescartadas,
    nodosExcluidos: red.nodosExcluidos,
    multiplicidadMedia: red.mPares > 0 ? red.m / red.mPares : 0,
  };
}

function calcularAnalisis(payload, onProgress = () => {}) {
  const datos = payload && typeof payload === 'object' ? payload : {};
  const opciones = datos.opciones && typeof datos.opciones === 'object' ? datos.opciones : {};
  const metricas = normalizarMetricas(datos.metricas);
  const red = construirRed(datos.nodos, datos.aristas, opciones);
  const resultado = {
    version: 1,
    calculadoEn: new Date().toISOString(),
    red: resumenRed(red),
    nodos: red.nodos.map((nodo) => ({
      id: nodo.id,
      tipo: nodo.tipo,
      entidadId: nodo.entidadId,
      etiqueta: nodo.etiqueta,
      identificador: nodo.identificador,
      nombre: nodo.nombre,
      apellidos: nodo.apellidos,
      genero: nodo.genero,
      tipoEntidad: nodo.tipoEntidad,
      notas: nodo.notas,
    })),
    metricas: {},
    errores: {},
    advertencias: [...red.advertencias],
  };

  for (const metrica of metricas) {
    onProgress({ metrica, hechas: 0, total: 1 });
    try {
    if (metrica === 'grado') {
      resultado.metricas.grado = calcularGrado(red);
    } else if (metrica === 'componentes') {
      resultado.metricas.componentes = calcularComponentes(red);
    } else if (metrica === 'densidad') {
      resultado.metricas.densidad = calcularDensidad(red);
    } else if (metrica === 'intermediacion') {
      resultado.metricas.intermediacion = calcularIntermediacion(
        red,
        opciones,
        (progreso) => onProgress(progreso)
      );
      if (resultado.metricas.intermediacion.aproximada) {
        resultado.advertencias.push(
          `La intermediación es aproximada: se calcularon ${resultado.metricas.intermediacion.fuentes} fuentes.`
        );
      }
    } else if (metrica === 'cercania') {
      resultado.metricas.cercania = calcularCercania(
        red,
        opciones,
        (progreso) => onProgress(progreso)
      );
      resultado.advertencias.push('La cercanía se calcula con la fórmula armónica.');
      if (resultado.metricas.cercania.aproximada) {
        resultado.advertencias.push(
          `La cercanía es aproximada: se calcularon ${resultado.metricas.cercania.fuentes} fuentes.`
        );
      }
    } else if (metrica === 'vectorPropio') {
      resultado.metricas.vectorPropio = calcularCentralidadVectorPropio(
        red,
        opciones,
        (progreso) => onProgress(progreso)
      );
      if (red.dirigida) {
        resultado.advertencias.push('En redes dirigidas se usa PageRank como centralidad de vector propio.');
      }
    } else if (metrica === 'comunidades') {
      resultado.metricas.comunidades = calcularComunidades(
        red,
        opciones,
        (progreso) => onProgress(progreso)
      );
      resultado.advertencias.push(...resultado.metricas.comunidades.advertencias);
    }
    } catch (err) {
      const mensaje = err && err.message ? err.message : String(err);
      resultado.errores[metrica] = mensaje;
      resultado.advertencias.push(`No se pudo calcular «${metrica}»: ${mensaje}`);
    }
    onProgress({ metrica, hechas: 1, total: 1 });
  }

  if (red.n > 0 && red.n < 5) {
    resultado.advertencias.push('Red muy pequeña: las centralidades y comunidades deben interpretarse con cautela.');
  }
  if (red.n > 0 && red.mPares === 0) {
    resultado.advertencias.push('No hay relaciones en la red analítica: los indicadores estructurales no son informativos.');
  }
  if (red.n > 1) {
    const componentes = resultado.metricas.componentes
      ? resultado.metricas.componentes.numeroDebiles
      : null;
    if (componentes != null && componentes > 1) {
      resultado.advertencias.push(
        `La red tiene ${componentes} componentes débiles; la cercanía es armónica y las comunidades pueden quedar fragmentadas.`
      );
    }
  }

  resultado.metricasSolicitadas = metricas;
  return resultado;
}

module.exports = {
  calcularAnalisis,
  normalizarMetricas,
  resumenRed,
};
