'use strict';

/* Ejecuta todos los archivos test/*.test.js sin depender de globs del shell. */

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const directorio = path.join(__dirname, '..', 'test');
const archivos = fs.readdirSync(directorio)
  .filter((nombre) => nombre.endsWith('.test.js'))
  .sort()
  .map((nombre) => path.join(directorio, nombre));

if (!archivos.length) {
  console.error('No se encontraron pruebas.');
  process.exit(1);
}

const resultado = spawnSync(process.execPath, ['--test', ...archivos], {
  stdio: 'inherit',
});
process.exit(resultado.status == null ? 1 : resultado.status);
