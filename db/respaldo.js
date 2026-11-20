'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const { execFileSync } = require('child_process');

/** Directorio propio del usuario, no una ruta predecible en /tmp. */
function directorioCopias() {
  const base = process.env.HIMAGO_BACKUP_DIR
    || path.join(os.homedir(), '.himago', 'backups');
  fs.mkdirSync(base, { recursive: true, mode: 0o700 });
  const real = fs.realpathSync.native(base);
  const info = fs.statSync(real);
  if (!info.isDirectory()) throw new Error('La ruta de copias de seguridad no es un directorio.');
  if (process.platform !== 'win32' && typeof process.getuid === 'function'
    && info.uid !== process.getuid()) {
    throw new Error('La carpeta de copias de seguridad no pertenece al usuario actual.');
  }
  try { fs.chmodSync(real, 0o700); } catch { /* Windows u otros sistemas sin POSIX */ }
  return real;
}

function limpiarCopias(directorio, maximo = 10) {
  try {
    const copias = fs.readdirSync(directorio)
      .filter((nombre) => nombre.startsWith('himago-') && nombre.endsWith('.sql'))
      .sort()
      .reverse();
    for (const nombre of copias.slice(maximo)) {
      try { fs.rmSync(path.join(directorio, nombre), { force: true }); } catch { /* nada */ }
    }
  } catch { /* sin permisos */ }
}

function escaparOpcion(valor) {
  return String(valor || '')
    .replace(/[\r\n]/g, '')
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"');
}

function crearArchivoCredenciales(directorio, cfg) {
  const archivo = path.join(
    directorio,
    `.mysqldump-${process.pid}-${crypto.randomBytes(8).toString('hex')}.cnf`
  );
  const contenido = [
    '[client]',
    `user="${escaparOpcion(cfg.user || '')}"`,
    `password="${escaparOpcion(cfg.password || '')}"`,
    '',
  ].join('\n');
  fs.writeFileSync(archivo, contenido, { encoding: 'utf8', mode: 0o600 });
  try { fs.chmodSync(archivo, 0o600); } catch { /* Windows */ }
  return archivo;
}

/** Copia la base MySQL/MariaDB antes de una migración mediante mysqldump.
    Devuelve la ruta del archivo o null si no se pudo crear. */
function respaldarMySQL(cfg) {
  if (!cfg || !cfg.database) return null;
  const directorio = directorioCopias();
  const base = String(cfg.database).replace(/[^A-Za-z0-9_-]/g, '_');
  const marca = new Date().toISOString().replace(/[:.]/g, '-');
  const destino = path.join(
    directorio,
    `himago-${base}-${marca}-${crypto.randomBytes(6).toString('hex')}.sql`
  );
  const credenciales = crearArchivoCredenciales(directorio, cfg);
  try {
    execFileSync(process.env.HIMAGO_MYSQLDUMP || 'mysqldump', [
      `--defaults-extra-file=${credenciales}`,
      `--host=${cfg.host || '127.0.0.1'}`,
      `--port=${Number(cfg.port) || 3306}`,
      '--single-transaction',
      '--routines',
      '--events',
      `--result-file=${destino}`,
      cfg.database,
    ], {
      stdio: ['ignore', 'ignore', 'pipe'],
      timeout: 120000,
    });
    try { fs.chmodSync(destino, 0o600); } catch { /* Windows */ }
    limpiarCopias(directorio);
    return destino;
  } catch (err) {
    try { fs.rmSync(destino, { force: true }); } catch { /* archivo parcial */ }
    const detalle = err && err.stderr ? String(err.stderr).trim() : (err && err.message) || String(err);
    console.warn(`[mysql] No se pudo crear la copia previa a la migración: ${detalle}`);
    return null;
  } finally {
    try { fs.rmSync(credenciales, { force: true }); } catch { /* ya eliminado */ }
  }
}

module.exports = { respaldarMySQL };
