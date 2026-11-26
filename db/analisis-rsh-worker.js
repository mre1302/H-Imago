'use strict';

/* H-IMAGO · Worker de cálculo de Análisis RSH.
   Recibe una única solicitud y devuelve progreso/resultado al proceso principal. */

const { parentPort } = require('worker_threads');
const { calcularAnalisis } = require('../lib/analisis-rsh/indice');

parentPort.on('message', (mensaje) => {
  try {
    const resultado = calcularAnalisis(mensaje, (progreso) => {
      parentPort.postMessage({
        tipo: 'progreso',
        solicitudId: mensaje.solicitudId,
        ...progreso,
      });
    });
    parentPort.postMessage({
      tipo: 'resultado',
      solicitudId: mensaje.solicitudId,
      resultado,
    });
  } catch (err) {
    parentPort.postMessage({
      tipo: 'error',
      solicitudId: mensaje && mensaje.solicitudId,
      error: err && err.message ? err.message : String(err),
      stack: err && err.stack ? err.stack : '',
    });
  }
});
