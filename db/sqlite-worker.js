'use strict';

const { parentPort, workerData } = require('worker_threads');
const fs = require('fs');
const { Database } = require('node-sqlite3-wasm');

function normalizarParametros(valores) {
  if (!Array.isArray(valores)) return [];
  return valores.map((v) => {
    if (v === undefined) return null;
    if (typeof v === 'boolean') return v ? 1 : 0;
    if (v instanceof Date) return v.toISOString();
    return v;
  });
}

const db = new Database(workerData.ruta);
db.exec('PRAGMA foreign_keys = ON');
db.exec('PRAGMA busy_timeout = 5000');
try { db.exec('PRAGMA journal_mode = WAL'); } catch { /* sin WAL */ }
try { db.exec('PRAGMA synchronous = NORMAL'); } catch { /* valor por defecto */ }

for (const sufijo of ['', '-wal', '-shm']) {
  try { fs.chmodSync(`${workerData.ruta}${sufijo}`, 0o600); } catch { /* Windows o archivo aún no creado */ }
}

function ejecutar(sql, valores = []) {
  const sentencia = String(sql || '').trim();
  if (!sentencia) return [[], []];
  const parametros = normalizarParametros(valores);
  const esLectura = /^(SELECT|PRAGMA|WITH|EXPLAIN)\b/i.test(sentencia);
  if (esLectura) {
    const filas = parametros.length
      ? db.all(sentencia, parametros)
      : db.all(sentencia);
    return [filas, []];
  }
  const info = parametros.length
    ? db.run(sentencia, parametros)
    : db.run(sentencia);
  return [{
    insertId: Number(info.lastInsertRowid || 0),
    affectedRows: info.changes,
    changes: info.changes,
  }, []];
}

let cola = Promise.resolve();
function procesar(mensaje) {
  const responder = (respuesta) => parentPort.postMessage({ id: mensaje.id, ...respuesta });
  try {
    if (mensaje.tipo === 'query') {
      responder({ ok: true, datos: ejecutar(mensaje.sql, mensaje.valores) });
      return;
    }
    if (mensaje.tipo === 'begin') {
      db.exec('BEGIN IMMEDIATE');
      responder({ ok: true, datos: true });
      return;
    }
    if (mensaje.tipo === 'commit') {
      db.exec('COMMIT');
      responder({ ok: true, datos: true });
      return;
    }
    if (mensaje.tipo === 'rollback') {
      try { if (db.inTransaction) db.exec('ROLLBACK'); } catch { /* transacción ya cerrada */ }
      responder({ ok: true, datos: true });
      return;
    }
    if (mensaje.tipo === 'checkpoint') {
      try { db.exec('PRAGMA wal_checkpoint(FULL)'); } catch { /* sin WAL */ }
      responder({ ok: true, datos: true });
      return;
    }
    if (mensaje.tipo === 'respaldo') {
      const destino = String(mensaje.destino || '');
      if (!destino) throw new Error('Falta el destino del respaldo SQLite.');
      db.run('VACUUM INTO ?', [destino]);
      responder({ ok: true, datos: true });
      return;
    }
    if (mensaje.tipo === 'close') {
      try { db.close(); } catch { /* ya cerrada */ }
      responder({ ok: true, datos: true });
      return;
    }
    responder({ ok: false, error: { message: `Operación SQLite desconocida: ${mensaje.tipo}` } });
  } catch (err) {
    responder({
      ok: false,
      error: {
        message: err && err.message ? err.message : String(err),
        code: err && err.code ? String(err.code) : undefined,
      },
    });
  }
}

parentPort.on('message', (mensaje) => {
  cola = cola.then(() => procesar(mensaje), () => procesar(mensaje));
});

parentPort.postMessage({ id: 0, ok: true, tipo: 'ready' });
