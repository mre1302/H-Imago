'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { Database } = require('node-sqlite3-wasm');
const db = require('../db/database');
const { extraerAnios } = require('../db/fechas-legadas');

function rutaTemporal(nombre) {
  return path.join(os.tmpdir(), `himago-regresion-${process.pid}-${Date.now()}-${nombre}.db`);
}

async function limpiar(ruta) {
  try { await db.pool?.end(); } catch { /* ya cerrada */ }
  const directorio = path.dirname(ruta);
  const base = path.basename(ruta);
  for (const archivo of fs.readdirSync(directorio)) {
    if (archivo === base || archivo.startsWith(`${base}-`) || archivo.startsWith(`${base}.bak-`)) {
      try { fs.rmSync(path.join(directorio, archivo), { force: true }); } catch { /* nada */ }
    }
  }
}

test('Fechas legadas: los rangos no se convierten en años negativos', () => {
  assert.deepEqual(extraerAnios('1520-1560'), [1520, 1560]);
  assert.deepEqual(extraerAnios('fl. 1489–1512'), [1489, 1512]);
  assert.deepEqual(extraerAnios('19-X-1469'), [1469]);
  assert.deepEqual(extraerAnios('c. 1520'), [1520]);
  assert.deepEqual(extraerAnios('50 a. C.'), [-49]);
});

test('Migración SQLite: los rangos de relaciones quedan en años positivos', async () => {
  const ruta = rutaTemporal('rango');
  try {
    const antigua = new Database(ruta);
    antigua.exec('CREATE TABLE proyectos (id INTEGER PRIMARY KEY AUTOINCREMENT, nombre TEXT NOT NULL)');
    antigua.exec('CREATE TABLE personas (id INTEGER PRIMARY KEY AUTOINCREMENT, proyecto_id INTEGER NOT NULL, nombre TEXT)');
    antigua.exec('CREATE TABLE relaciones (id INTEGER PRIMARY KEY AUTOINCREMENT, proyecto_id INTEGER NOT NULL, origen_tipo TEXT, origen_id INTEGER, destino_tipo TEXT, destino_id INTEGER, tipo TEXT, anio_inicio INTEGER, anio_fin INTEGER, fecha_inicio TEXT, fecha_fin TEXT)');
    antigua.exec("INSERT INTO proyectos (nombre) VALUES ('Rango')");
    antigua.exec("INSERT INTO personas (proyecto_id, nombre) VALUES (1, 'A')");
    antigua.exec("INSERT INTO personas (proyecto_id, nombre) VALUES (1, 'B')");
    antigua.exec("INSERT INTO relaciones (proyecto_id, origen_tipo, origen_id, destino_tipo, destino_id, tipo, fecha_inicio, fecha_fin) VALUES (1, 'persona', 1, 'persona', 2, 'X', '1520-1560', '1520-1560')");
    antigua.close();
    await db.conectar({ motor: 'sqlite', ruta });
    const [filas] = await db.pool.query('SELECT anio_inicio, anio_fin FROM relaciones');
    assert.equal(filas[0].anio_inicio, 1520);
    assert.equal(filas[0].anio_fin, 1560);
  } finally {
    await limpiar(ruta);
  }
});

test('Bloques: el UUID evita confundir proyectos con el mismo id numérico', async () => {
  const ruta = rutaTemporal('uuid-bloque');
  try {
    await db.conectar({ motor: 'sqlite', ruta });
    const origen = await db.crearProyecto({ nombre: 'Origen' });
    const lugarOrigen = await db.crearEntidad('lugar', origen.id, { nombre: 'Sevilla' });
    const fuenteOrigen = await db.crearEntidad('fuente', origen.id, { titulo: 'Fuente origen' });
    const bloqueOrigen = await db.crearBloqueRegistro(fuenteOrigen.id, {
      tipo: 'Actas, acuerdos y resoluciones',
    });
    await db.actualizarBloqueRegistro(bloqueOrigen.id, { valores: { f2: String(lugarOrigen.id) } });
    const exportado = await db.exportarBloqueRegistro(bloqueOrigen.id);
    assert.ok(exportado.proyecto.uuid);

    const destino = await db.crearProyecto({ nombre: 'Destino' });
    const fuenteDestino = await db.crearEntidad('fuente', destino.id, { titulo: 'Fuente destino' });
    const bloqueDestino = await db.crearBloqueRegistro(fuenteDestino.id, {
      tipo: 'Actas, acuerdos y resoluciones',
    });
    /* Simula dos bases distintas cuyos proyectos comparten el id 1. */
    exportado.proyecto.id = destino.id;
    exportado.proyecto.uuid = 'uuid-de-otra-base';
    await db.importarBloqueRegistro(bloqueDestino.id, exportado);
    const [importado] = await db.listarBloquesRegistro(fuenteDestino.id);
    const lugaresDestino = await db.listarEntidades('lugar', destino.id);
    assert.equal(lugaresDestino.length, 1);
    assert.equal(String(importado.datos.valores.f2), String(lugaresDestino[0].id));
  } finally {
    await limpiar(ruta);
  }
});

test('Bloques: borrar una persona limpia sus referencias en el JSON', async () => {
  const ruta = rutaTemporal('borrado-bloque');
  try {
    await db.conectar({ motor: 'sqlite', ruta });
    const proyecto = await db.crearProyecto({ nombre: 'Referencias' });
    const persona = await db.crearEntidad('persona', proyecto.id, { nombre: 'Ana' });
    const fuente = await db.crearEntidad('fuente', proyecto.id, { titulo: 'Fuente' });
    const bloque = await db.crearBloqueRegistro(fuente.id, { tipo: 'Actas, acuerdos y resoluciones' });
    await db.actualizarBloqueRegistro(bloque.id, {
      personas: { p1: [{ persona_id: persona.id, nombres: 'Ana' }] },
    });
    await db.eliminarEntidad('persona', persona.id);
    const [guardado] = await db.listarBloquesRegistro(fuente.id);
    assert.equal(guardado.datos.personas.p1[0].persona_id, null);
  } finally {
    await limpiar(ruta);
  }
});

test('Lugares: rechaza coordenadas fuera de rango', async () => {
  const ruta = rutaTemporal('coordenadas');
  try {
    await db.conectar({ motor: 'sqlite', ruta });
    const proyecto = await db.crearProyecto({ nombre: 'Coordenadas' });
    await assert.rejects(
      () => db.crearEntidad('lugar', proyecto.id, { nombre: 'Fuera', latitud: 95, longitud: 0 }),
      /latitud/i
    );
    await assert.rejects(
      () => db.crearEntidad('lugar', proyecto.id, { nombre: 'Fuera', longitud: 0 }),
      /latitud y longitud/i
    );
  } finally {
    await limpiar(ruta);
  }
});

test('Bloques: los homónimos no se fusionan silenciosamente al importar', async () => {
  const ruta = rutaTemporal('homonimos');
  try {
    await db.conectar({ motor: 'sqlite', ruta });
    const proyecto = await db.crearProyecto({ nombre: 'Homónimos' });
    const existente = await db.crearEntidad('persona', proyecto.id, { nombre: 'Ana', apellidos: 'Pérez' });
    const fuente = await db.crearEntidad('fuente', proyecto.id, { titulo: 'Fuente' });
    const bloque = await db.crearBloqueRegistro(fuente.id, { tipo: 'Actas, acuerdos y resoluciones' });
    const obj = {
      formato: 'h-imago-bloque-registro',
      version: 1,
      tipo: bloque.tipo,
      proyecto: { id: 999, nombre: 'Otro', uuid: 'otro-uuid' },
      datos: {},
      entidades: {
        personas: [
          { id: 10, nombre: 'Ana', apellidos: 'Pérez', alias: '' },
          { id: 11, nombre: 'Ana', apellidos: 'Pérez', alias: '' },
        ],
        instituciones: [],
        lugares: [],
        patrimonios: [],
      },
    };
    const resultado = await db.importarBloqueRegistro(bloque.id, obj);
    const personas = await db.listarEntidades('persona', proyecto.id);
    assert.equal(personas.length, 2, 'debe reutilizar una y crear otra, sin fusionar');
    assert.ok(resultado.homonimosPreservados >= 1);
    assert.ok(personas.some((p) => p.id === existente.id));
  } finally {
    await limpiar(ruta);
  }
});

test('Relaciones: obtenerRelacion devuelve la fila solicitada', async () => {
  const ruta = rutaTemporal('obtener-relacion');
  try {
    await db.conectar({ motor: 'sqlite', ruta });
    const proyecto = await db.crearProyecto({ nombre: 'Relación' });
    const persona = await db.crearEntidad('persona', proyecto.id, { nombre: 'Ana' });
    const institucion = await db.crearEntidad('institucion', proyecto.id, { nombre: 'Cabildo' });
    const id = await db.crearRelacion({
      proyecto_id: proyecto.id,
      origen_tipo: 'persona',
      origen_id: persona.id,
      destino_tipo: 'institucion',
      destino_id: institucion.id,
      tipo: 'Miembro',
    });
    const relacion = await db.obtenerRelacion(id);
    assert.equal(relacion.tipo, 'Miembro');
    assert.equal(relacion.origen_tipo, 'persona');
    assert.equal(relacion.destino_id, institucion.id);
    assert.equal(await db.obtenerRelacion(999999), null);
  } finally {
    await limpiar(ruta);
  }
});
