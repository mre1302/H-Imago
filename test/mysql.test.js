'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const mysql = require('mysql2/promise');
const db = require('../db/database');

const activo = process.env.HIMAGO_TEST_MYSQL === '1';
const host = process.env.HIMAGO_MYSQL_HOST || '127.0.0.1';
const port = Number(process.env.HIMAGO_MYSQL_PORT || 3306);
const user = process.env.HIMAGO_MYSQL_USER || 'root';
const password = process.env.HIMAGO_MYSQL_PASSWORD || '';
const database = (process.env.HIMAGO_MYSQL_DATABASE || `himago_test_${process.pid}_${Date.now()}`)
  .replace(/[^A-Za-z0-9_]/g, '_');

test('MySQL: esquema, CRUD y actualización sin cambios', { skip: !activo }, async () => {
  try {
    await db.conectar({ motor: 'mysql', host, port, user, password, database });
    const proyecto = await db.crearProyecto({ nombre: 'Pruebas MySQL', creador: 'CI' });
    const institucion = await db.crearEntidad('institucion', proyecto.id, { nombre: 'Cabildo' });
    const persona = await db.crearEntidad('persona', proyecto.id, {
      nombre: 'Ana',
      apellidos: 'Pérez',
    });

    const sinCambios = await db.actualizarEntidad('persona', persona.id, {
      nombre: 'Ana',
      apellidos: 'Pérez',
    });
    assert.equal(sinCambios.id, persona.id);

    await db.crearRelacion({
      proyecto_id: proyecto.id,
      origen_tipo: 'persona',
      origen_id: persona.id,
      destino_tipo: 'institucion',
      destino_id: institucion.id,
      tipo: 'Miembro',
    });
    const relaciones = await db.listarRelaciones(proyecto.id);
    assert.equal(relaciones.length, 1);
    assert.equal(relaciones[0].origen_nombre, 'Ana Pérez');

    const exportado = await db.exportarProyecto(proyecto.id);
    const importado = await db.importarProyecto(JSON.parse(JSON.stringify(exportado)));
    assert.equal((await db.listarEntidades('persona', importado.id)).length, 1);
    assert.equal((await db.listarRelaciones(importado.id)).length, 1);
  } finally {
    try { await db.pool?.end(); } catch { /* ya cerrada */ }
    db.pool = null;
    const conexion = await mysql.createConnection({ host, port, user, password });
    try {
      await conexion.query(`DROP DATABASE IF EXISTS \`${database}\``);
    } finally {
      await conexion.end();
    }
  }
});
