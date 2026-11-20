'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { Database } = require('node-sqlite3-wasm');
const db = require('../db/database');

function rutaTemporal(nombre) {
  return path.join(os.tmpdir(), `himago-mejoras-${process.pid}-${Date.now()}-${nombre}.db`);
}

async function limpiar(ruta) {
  try { await db.pool?.end(); } catch { /* ya cerrada */ }
  const dir = path.dirname(ruta);
  const base = path.basename(ruta);
  for (const archivo of fs.readdirSync(dir)) {
    if (archivo === base || archivo.startsWith(`${base}-`) || archivo.startsWith(`${base}.bak-`)) {
      try { fs.rmSync(path.join(dir, archivo), { force: true }); } catch { /* nada */ }
    }
  }
}

function crearBaseLegada(ruta) {
  const d = new Database(ruta);
  d.exec(`CREATE TABLE proyectos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre TEXT NOT NULL,
    descripcion TEXT,
    creador TEXT,
    fecha_creacion TEXT,
    fecha_modificacion TEXT
  )`);
  d.exec(`CREATE TABLE lugares (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    proyecto_id INTEGER NOT NULL,
    identificador TEXT,
    nombre TEXT NOT NULL,
    tipo TEXT,
    latitud REAL,
    longitud REAL,
    notas TEXT
  )`);
  d.exec(`CREATE TABLE instituciones (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    proyecto_id INTEGER NOT NULL,
    identificador TEXT,
    nombre TEXT NOT NULL,
    tipo TEXT,
    anio_fundacion INTEGER,
    fecha_exacta_fundacion TEXT,
    fecha_exacta_fundacion_meta TEXT,
    anio_disolucion INTEGER,
    fecha_exacta_disolucion TEXT,
    fecha_exacta_disolucion_meta TEXT,
    notas TEXT
  )`);
  d.exec(`CREATE TABLE patrimonios (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    proyecto_id INTEGER NOT NULL,
    identificador TEXT,
    nombre TEXT NOT NULL,
    tipo TEXT,
    propietario TEXT,
    valor TEXT,
    descripcion TEXT,
    notas TEXT
  )`);
  d.exec(`CREATE TABLE personas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    proyecto_id INTEGER NOT NULL,
    identificador TEXT,
    nombre TEXT,
    apellidos TEXT,
    alias TEXT,
    genero TEXT,
    anio_nacimiento INTEGER,
    fecha_exacta_nacimiento TEXT,
    fecha_exacta_nacimiento_meta TEXT,
    anio_defuncion INTEGER,
    fecha_exacta_defuncion TEXT,
    fecha_exacta_defuncion_meta TEXT,
    lugar_nacimiento TEXT,
    lugar_defuncion TEXT,
    tratamiento TEXT,
    ocupacion TEXT,
    notas TEXT
  )`);
  d.exec(`CREATE TABLE fuentes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    proyecto_id INTEGER NOT NULL,
    titulo TEXT NOT NULL,
    categoria TEXT,
    tipo TEXT,
    autor TEXT,
    lugar TEXT,
    repositorio TEXT,
    fondo TEXT,
    signatura TEXT,
    editorial TEXT,
    libro TEXT,
    editor TEXT,
    paginas TEXT,
    revista TEXT,
    anio_publicacion INTEGER,
    volumen TEXT,
    numero TEXT,
    doi TEXT,
    evento TEXT,
    facultad TEXT,
    universidad TEXT,
    anio_inicio INTEGER,
    anio_fin INTEGER,
    fecha_exacta TEXT,
    notas TEXT
  )`);
  d.exec(`CREATE TABLE relaciones (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    proyecto_id INTEGER NOT NULL,
    origen_tipo TEXT NOT NULL,
    origen_id INTEGER NOT NULL,
    destino_tipo TEXT NOT NULL,
    destino_id INTEGER NOT NULL,
    tipo TEXT,
    anio_inicio INTEGER,
    fecha_exacta_inicio TEXT,
    fecha_exacta_inicio_meta TEXT,
    anio_fin INTEGER,
    fecha_exacta_fin TEXT,
    fecha_exacta_fin_meta TEXT,
    notas TEXT,
    procedencia TEXT NOT NULL DEFAULT 'MANUAL',
    bloque_id INTEGER,
    regla TEXT,
    firma TEXT
  )`);
  d.close();
}

test('SQLite serializa escrituras concurrentes y genera identificadores únicos', async () => {
  const ruta = rutaTemporal('concurrente');
  try {
    await db.conectar({ motor: 'sqlite', ruta });
    const proyecto = await db.crearProyecto({ nombre: 'Concurrente' });
    const personas = await Promise.all(Array.from({ length: 30 }, (_, i) => (
      db.crearEntidad('persona', proyecto.id, { nombre: `Persona ${i}` })
    )));
    assert.equal(personas.length, 30);
    assert.equal(new Set(personas.map((p) => p.id)).size, 30);
    assert.equal(new Set(personas.map((p) => p.identificador)).size, 30);
    assert.equal((await db.listarEntidades('persona', proyecto.id)).length, 30);
  } finally {
    await limpiar(ruta);
  }
});

test('Borrar un lugar limpia referencias en una base migrada sin claves foráneas', async () => {
  const ruta = rutaTemporal('legado-lugar');
  try {
    crearBaseLegada(ruta);
    await db.conectar({ motor: 'sqlite', ruta });
    const proyecto = await db.crearProyecto({ nombre: 'Legado' });
    const lugar = await db.crearEntidad('lugar', proyecto.id, { nombre: 'Sede' });
    const institucion = await db.crearEntidad('institucion', proyecto.id, { nombre: 'Cabildo', lugar_id: lugar.id });
    const patrimonio = await db.crearEntidad('patrimonio', proyecto.id, { nombre: 'Casa', lugar_id: lugar.id });
    const persona = await db.crearEntidad('persona', proyecto.id, { nombre: 'Ana' });
    await db.crearRelacion({
      proyecto_id: proyecto.id,
      origen_tipo: 'persona',
      origen_id: persona.id,
      destino_tipo: 'institucion',
      destino_id: institucion.id,
      tipo: 'Miembro',
      lugar_inicio: lugar.id,
    });
    await db.eliminarEntidad('lugar', lugar.id);
    assert.equal((await db.obtenerEntidad('institucion', institucion.id)).lugar_id, null);
    assert.equal((await db.obtenerEntidad('patrimonio', patrimonio.id)).lugar_id, null);
    assert.equal((await db.listarRelaciones(proyecto.id))[0].lugar_inicio, null);
  } finally {
    await limpiar(ruta);
  }
});

test('Borrar un proyecto elimina todos sus hijos en una base migrada sin claves foráneas', async () => {
  const ruta = rutaTemporal('legado-proyecto');
  try {
    crearBaseLegada(ruta);
    await db.conectar({ motor: 'sqlite', ruta });
    const proyecto = await db.crearProyecto({ nombre: 'Legado' });
    await db.crearEntidad('persona', proyecto.id, { nombre: 'Ana' });
    await db.crearEntidad('fuente', proyecto.id, { titulo: 'Fuente' });
    await db.eliminarProyecto(proyecto.id);
    const [personas] = await db.pool.query('SELECT COUNT(*) AS n FROM personas');
    const [fuentes] = await db.pool.query('SELECT COUNT(*) AS n FROM fuentes');
    assert.equal(personas[0].n, 0);
    assert.equal(fuentes[0].n, 0);
    assert.deepEqual(await db.listarProyectos(), []);
  } finally {
    await limpiar(ruta);
  }
});

test('La migración crea una copia de seguridad y añade columnas que faltaban', async () => {
  const ruta = rutaTemporal('legado-columnas');
  try {
    crearBaseLegada(ruta);
    const directorio = path.dirname(ruta);
    const base = path.basename(ruta);
    await db.conectar({ motor: 'sqlite', ruta });
    assert.ok(fs.readdirSync(directorio).some((f) => f.startsWith(`${base}.bak-`)));
    const proyecto = await db.crearProyecto({ nombre: 'Migrado' });
    const persona = await db.crearEntidad('persona', proyecto.id, { nombre: 'Ana' });
    const institucion = await db.crearEntidad('institucion', proyecto.id, { nombre: 'Cabildo' });
    await db.crearRelacion({
      proyecto_id: proyecto.id,
      origen_tipo: 'persona',
      origen_id: persona.id,
      destino_tipo: 'institucion',
      destino_id: institucion.id,
      tipo: 'Miembro',
      notas: 'Relación migrada',
    });
    const fuente = await db.crearEntidad('fuente', proyecto.id, {
      titulo: 'Fuente migrada',
      transcripcion: 'Texto completo',
      ubicacion: 'Archivo',
    });
    assert.equal((await db.obtenerEntidad('fuente', fuente.id)).transcripcion, 'Texto completo');
    assert.equal((await db.obtenerEntidad('fuente', fuente.id)).ubicacion, 'Archivo');
    assert.equal((await db.listarRelaciones(proyecto.id))[0].notas, 'Relación migrada');
  } finally {
    await limpiar(ruta);
  }
});
