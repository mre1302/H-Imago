'use strict';

/* H-IMAGO · Migraciones de etiquetas de RELACIONES compartidas por SQLite y
   MySQL/MariaDB. La lista de renombrados vive en `definiciones.js`. */

const { TIPOS_RELACION_RENOMBRADOS } = require('./definiciones');

async function renombrarTiposRelacion(ejecutor) {
  for (const [viejo, nuevo] of Object.entries(TIPOS_RELACION_RENOMBRADOS)) {
    await ejecutor.query('UPDATE relaciones SET tipo = ? WHERE tipo = ?', [nuevo, viejo]);
  }
}

module.exports = { renombrarTiposRelacion };
