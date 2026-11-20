'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { dentroDe, rutaPermitida } = require('../lib/rutas');

test('rutaPermitida acepta rutas dentro de las bases y rechaza symlinks fuera', () => {
  const raiz = fs.mkdtempSync(path.join(os.tmpdir(), 'himago-rutas-'));
  const base = path.join(raiz, 'Documentos');
  const fuera = path.join(raiz, 'Fuera');
  fs.mkdirSync(base);
  fs.mkdirSync(fuera);
  const dentro = path.join(base, 'proyecto.json');
  const externo = path.join(fuera, 'proyecto.json');
  fs.writeFileSync(dentro, '{}');
  fs.writeFileSync(externo, '{}');
  try {
    assert.equal(dentroDe(base, base), true);
    assert.equal(rutaPermitida(dentro, [base]), true);
    assert.equal(rutaPermitida(externo, [base]), false);
    assert.equal(rutaPermitida(path.join(base, 'nuevo.json'), [base]), true);
    if (process.platform !== 'win32') {
      const enlace = path.join(base, 'enlace.json');
      fs.symlinkSync(externo, enlace);
      assert.equal(rutaPermitida(enlace, [base]), false);
    }
  } finally {
    fs.rmSync(raiz, { recursive: true, force: true });
  }
});
