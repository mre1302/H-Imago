'use strict';

const fs = require('fs');
const path = require('path');

function resolverRutaReal(ruta) {
  const resuelta = path.resolve(String(ruta));
  try {
    return fs.realpathSync.native(resuelta);
  } catch {
    try {
      return path.join(fs.realpathSync.native(path.dirname(resuelta)), path.basename(resuelta));
    } catch {
      return resuelta;
    }
  }
}

function mismaRuta(a, b) {
  if (process.platform === 'win32') return a.toLowerCase() === b.toLowerCase();
  return a === b;
}

function dentroDe(ruta, base) {
  if (mismaRuta(ruta, base)) return true;
  const compararRuta = process.platform === 'win32' ? ruta.toLowerCase() : ruta;
  const compararBase = process.platform === 'win32' ? base.toLowerCase() : base;
  return compararRuta.startsWith(`${compararBase}${path.sep}`);
}

function rutaPermitida(ruta, bases) {
  if (!ruta || !Array.isArray(bases) || !bases.length) return false;
  const resuelta = resolverRutaReal(ruta);
  return bases
    .map((base) => resolverRutaReal(base))
    .some((base) => dentroDe(resuelta, base));
}

module.exports = { resolverRutaReal, mismaRuta, dentroDe, rutaPermitida };
