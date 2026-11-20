'use strict';

/* Comprueba la sintaxis de todos los módulos JS del proyecto sin ejecutarlos.
   Se usa en `npm run check` para no depender de una lista manual de archivos. */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const RAIZ = path.resolve(__dirname, '..');
const EXCLUIDOS = new Set(['node_modules', 'dist', '.git', 'build']);
const archivos = [];

function recorrer(directorio) {
  for (const entrada of fs.readdirSync(directorio, { withFileTypes: true })) {
    if (EXCLUIDOS.has(entrada.name)) continue;
    const ruta = path.join(directorio, entrada.name);
    if (entrada.isDirectory()) {
      recorrer(ruta);
    } else if (entrada.isFile() && entrada.name.endsWith('.js')) {
      archivos.push(ruta);
    }
  }
}

recorrer(RAIZ);
let fallos = 0;
for (const archivo of archivos.sort()) {
  try {
    new vm.Script(fs.readFileSync(archivo, 'utf8'), { filename: archivo });
  } catch (err) {
    fallos++;
    console.error(`\n${path.relative(RAIZ, archivo)}: ${err.message}`);
  }
}
if (fallos) {
  console.error(`\n${fallos} archivo(s) con errores de sintaxis.`);
  process.exit(1);
}
console.log(`Sintaxis correcta en ${archivos.length} archivos.`);
