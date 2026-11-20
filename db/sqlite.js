'use strict';

/* H-IMAGO · Capa SQLite (modo personal, sin servidor)
   Usa node-sqlite3-wasm: SQLite compilado a WebAssembly, con acceso directo
   al sistema de archivos. No requiere compilación nativa ni instalar un
   servidor, y funciona igual en Linux, Windows y macOS. */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { Worker } = require('worker_threads');
const { AsyncLocalStorage } = require('node:async_hooks');
const { Database } = require('node-sqlite3-wasm');
const { extraerAnios } = require('./fechas-legadas');
const { recolectarReferenciasBloque } = require('./bloques-referencias');
const relacionesAutomaticas = require('./relaciones-automaticas');
const { renombrarTiposRelacion } = require('./migracion-relaciones');

const ESQUEMA_VERSION = 9;

function copiarSiExiste(origen, destino) {
  try {
    if (fs.existsSync(origen)) fs.copyFileSync(origen, destino);
  } catch { /* sin copia */ }
}

function fechaSello() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

function prepararRuta(ruta) {
  if (!ruta || !String(ruta).trim()) throw new Error('Indica el archivo de la base de datos SQLite.');
  const destino = path.resolve(String(ruta).trim());
  fs.mkdirSync(path.dirname(destino), { recursive: true });
  return destino;
}

class PoolSQLite {
  constructor(ruta) {
    this.ruta = prepararRuta(ruta);
    this.cola = Promise.resolve();
    this.pendientes = new Map();
    this.siguienteId = 1;
    this.cerrado = false;
    this.contextoTransaccion = new AsyncLocalStorage();
    this.worker = new Worker(path.join(__dirname, 'sqlite-worker.js'), {
      workerData: { ruta: this.ruta },
    });
    this.ready = new Promise((resolver, rechazar) => {
      this.resolverReady = resolver;
      this.rechazarReady = rechazar;
    });
    this.worker.on('message', (mensaje) => {
      if (mensaje.id === 0 && mensaje.tipo === 'ready') {
        try { fs.chmodSync(this.ruta, 0o600); } catch { /* Windows */ }
        this.resolverReady(true);
        return;
      }
      const pendiente = this.pendientes.get(mensaje.id);
      if (!pendiente) {
        console.warn('[sqlite] Respuesta con id desconocido:', mensaje.id);
        return;
      }
      this.pendientes.delete(mensaje.id);
      if (mensaje.ok) pendiente.resolver(mensaje.datos);
      else {
        const error = new Error(mensaje.error?.message || 'Error de SQLite.');
        if (mensaje.error?.code) error.code = mensaje.error.code;
        pendiente.rechazar(error);
      }
    });
    this.worker.on('error', (err) => {
      if (this.rechazarReady) this.rechazarReady(err);
      for (const pendiente of this.pendientes.values()) pendiente.rechazar(err);
      this.pendientes.clear();
    });
    this.worker.on('exit', (codigo) => {
      if (this.cerrado) return;
      this.cerrado = true;
      const error = new Error(`El proceso SQLite terminó inesperadamente (código ${codigo}).`);
      if (this.rechazarReady) this.rechazarReady(error);
      for (const pendiente of this.pendientes.values()) pendiente.rechazar(error);
      this.pendientes.clear();
    });
  }

  enCola(tarea) {
    const resultado = this.cola.then(tarea, tarea);
    this.cola = resultado.then(() => undefined, () => undefined);
    return resultado;
  }

  async enviar(tipo, datos = {}) {
    await this.ready;
    if (this.cerrado) throw new Error('La base SQLite está cerrada.');
    const id = this.siguienteId++;
    return new Promise((resolver, rechazar) => {
      this.pendientes.set(id, { resolver, rechazar });
      this.worker.postMessage({ id, tipo, ...datos });
    });
  }

  async query(sql, valores = []) {
    if (this.contextoTransaccion.getStore()) {
      throw new Error('No se puede usar pool.query dentro de una transacción SQLite; usa la conexión de la transacción.');
    }
    return this.enCola(() => this.enviar('query', { sql, valores }));
  }

  async transaccion(fn) {
    return this.enCola(async () => {
      await this.enviar('begin');
      const conexion = {
        query: async (sql, valores) => this.enviar('query', { sql, valores }),
        beginTransaction: async () => {},
        commit: async () => {},
        rollback: async () => {},
        release: () => {},
      };
      try {
        const resultado = await this.contextoTransaccion.run({ transaccion: true }, () => fn(conexion));
        await this.enviar('commit');
        return resultado;
      } catch (err) {
        try { await this.enviar('rollback'); } catch { /* transacción ya cerrada */ }
        throw err;
      }
    });
  }

  async getConnection() {
    await this.ready;
    return {
      query: (sql, valores) => this.enviar('query', { sql, valores }),
      beginTransaction: async () => { await this.enviar('begin'); },
      commit: async () => { await this.enviar('commit'); },
      rollback: async () => { await this.enviar('rollback'); },
      release: () => {},
    };
  }

  async checkpoint() {
    return this.enCola(() => this.enviar('checkpoint'));
  }

  async end() {
    if (this.cerrado) return;
    await this.cola.catch(() => undefined);
    try { await this.enviar('close'); } catch { /* proceso ya terminado */ }
    this.cerrado = true;
    try { await this.worker.terminate(); } catch { /* ya terminado */ }
  }
}

async function probarSQLite(ruta) {
  const destino = prepararRuta(ruta);
  const db = new Database(destino);
  try { fs.chmodSync(destino, 0o600); } catch { /* Windows */ }
  try {
    const fila = db.get('SELECT sqlite_version() AS version');
    return { version: `SQLite ${fila.version}`, database: 'SQLite', ruta: destino };
  } finally {
    try { db.close(); } catch { /* ya cerrada */ }
  }
}

/* Esquema base. Las migraciones añaden las columnas que falten en bases
   creadas por versiones anteriores. */
const ESQUEMA_SQLITE = [
  `CREATE TABLE IF NOT EXISTS proyectos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre TEXT NOT NULL,
    descripcion TEXT,
    creador TEXT,
    uuid TEXT,
    fecha_creacion TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    fecha_modificacion TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,

  `CREATE TABLE IF NOT EXISTS lugares (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    proyecto_id INTEGER NOT NULL REFERENCES proyectos(id) ON DELETE CASCADE,
    identificador TEXT,
    nombre TEXT NOT NULL,
    tipo TEXT,
    latitud REAL,
    longitud REAL,
    notas TEXT
  )`,

  `CREATE TABLE IF NOT EXISTS personas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    proyecto_id INTEGER NOT NULL REFERENCES proyectos(id) ON DELETE CASCADE,
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
    institucion_id INTEGER REFERENCES instituciones(id) ON DELETE SET NULL,
    tratamiento TEXT,
    ocupacion TEXT,
    notas TEXT
  )`,

  `CREATE TABLE IF NOT EXISTS instituciones (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    proyecto_id INTEGER NOT NULL REFERENCES proyectos(id) ON DELETE CASCADE,
    identificador TEXT,
    nombre TEXT NOT NULL,
    tipo TEXT,
    anio_fundacion INTEGER,
    fecha_exacta_fundacion TEXT,
    fecha_exacta_fundacion_meta TEXT,
    anio_disolucion INTEGER,
    fecha_exacta_disolucion TEXT,
    fecha_exacta_disolucion_meta TEXT,
    lugar_id INTEGER REFERENCES lugares(id) ON DELETE SET NULL,
    notas TEXT
  )`,

  `CREATE TABLE IF NOT EXISTS patrimonios (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    proyecto_id INTEGER NOT NULL REFERENCES proyectos(id) ON DELETE CASCADE,
    identificador TEXT,
    nombre TEXT NOT NULL,
    tipo TEXT,
    propietario TEXT,
    lugar_id INTEGER REFERENCES lugares(id) ON DELETE SET NULL,
    valor TEXT,
    descripcion TEXT,
    notas TEXT
  )`,

  `CREATE TABLE IF NOT EXISTS fuentes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    proyecto_id INTEGER NOT NULL REFERENCES proyectos(id) ON DELETE CASCADE,
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
    ubicacion TEXT,
    referencia TEXT,
    transcripcion TEXT,
    notas TEXT
  )`,

  `CREATE TABLE IF NOT EXISTS cuadernos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    fuente_id INTEGER NOT NULL REFERENCES fuentes(id) ON DELETE CASCADE,
    posicion INTEGER NOT NULL DEFAULT 0,
    contenido TEXT,
    fojas TEXT,
    fecha_creacion TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    fecha_modificacion TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,

  `CREATE TABLE IF NOT EXISTS coincidencias (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    proyecto_id INTEGER NOT NULL REFERENCES proyectos(id) ON DELETE CASCADE,
    tipo TEXT NOT NULL CHECK (tipo IN ('persona','institucion','lugar','patrimonio')),
    entidad_a INTEGER NOT NULL,
    entidad_b INTEGER NOT NULL,
    notas TEXT,
    fecha_creacion TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,

  `CREATE TABLE IF NOT EXISTS bloques_registro (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    fuente_id INTEGER NOT NULL REFERENCES fuentes(id) ON DELETE CASCADE,
    periodo TEXT NOT NULL DEFAULT 'siglos-xviii-xix',
    region TEXT NOT NULL DEFAULT 'hispanoamerica',
    tipo TEXT NOT NULL,
    categoria TEXT,
    datos TEXT,
    fecha_creacion TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    fecha_modificacion TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,

  `CREATE TABLE IF NOT EXISTS bloque_referencias (
    bloque_id INTEGER NOT NULL REFERENCES bloques_registro(id) ON DELETE CASCADE,
    entidad_tipo TEXT NOT NULL CHECK (entidad_tipo IN ('persona','institucion','lugar','patrimonio')),
    entidad_id INTEGER NOT NULL,
    PRIMARY KEY (bloque_id, entidad_tipo, entidad_id)
  )`,

  `CREATE TABLE IF NOT EXISTS relaciones (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    proyecto_id INTEGER NOT NULL REFERENCES proyectos(id) ON DELETE CASCADE,
    origen_tipo TEXT NOT NULL CHECK (origen_tipo IN ('persona','institucion','lugar','patrimonio')),
    origen_id INTEGER NOT NULL,
    destino_tipo TEXT NOT NULL CHECK (destino_tipo IN ('persona','institucion','lugar','patrimonio')),
    destino_id INTEGER NOT NULL,
    tipo TEXT,
    anio_inicio INTEGER,
    fecha_exacta_inicio TEXT,
    fecha_exacta_inicio_meta TEXT,
    lugar_inicio INTEGER REFERENCES lugares(id) ON DELETE SET NULL,
    anio_fin INTEGER,
    fecha_exacta_fin TEXT,
    fecha_exacta_fin_meta TEXT,
    lugar_fin INTEGER REFERENCES lugares(id) ON DELETE SET NULL,
    notas TEXT,
    procedencia TEXT NOT NULL DEFAULT 'MANUAL',
    bloque_id INTEGER,
    regla TEXT,
    firma TEXT
  )`,

  `CREATE TABLE IF NOT EXISTS relaciones_exclusiones (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    proyecto_id INTEGER NOT NULL REFERENCES proyectos(id) ON DELETE CASCADE,
    bloque_id INTEGER NOT NULL,
    regla TEXT NOT NULL,
    firma TEXT NOT NULL DEFAULT '',
    fecha_creacion TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,

  `CREATE TABLE IF NOT EXISTS relaciones_fuentes (
    relacion_id INTEGER NOT NULL REFERENCES relaciones(id) ON DELETE CASCADE,
    fuente_id INTEGER NOT NULL REFERENCES fuentes(id) ON DELETE CASCADE,
    PRIMARY KEY (relacion_id, fuente_id)
  )`,
];

const INDICES_SQLITE = [
  `CREATE INDEX IF NOT EXISTS idx_lugar_proyecto ON lugares(proyecto_id)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS uq_proyectos_uuid ON proyectos(uuid)`,
  `CREATE INDEX IF NOT EXISTS idx_persona_proyecto ON personas(proyecto_id)`,
  `CREATE INDEX IF NOT EXISTS idx_institucion_proyecto ON instituciones(proyecto_id)`,
  `CREATE INDEX IF NOT EXISTS idx_patrimonio_proyecto ON patrimonios(proyecto_id)`,
  `CREATE INDEX IF NOT EXISTS idx_fuente_proyecto ON fuentes(proyecto_id)`,
  `CREATE INDEX IF NOT EXISTS idx_cuaderno_fuente ON cuadernos(fuente_id)`,
  `CREATE INDEX IF NOT EXISTS idx_cuaderno_fuente_posicion ON cuadernos(fuente_id, posicion, id)`,
  `CREATE INDEX IF NOT EXISTS idx_proyecto_fecha ON proyectos(fecha_modificacion)`,
  `CREATE INDEX IF NOT EXISTS idx_coincidencia_proyecto ON coincidencias(proyecto_id)`,
  `CREATE INDEX IF NOT EXISTS idx_coincidencia_a ON coincidencias(tipo, entidad_a)`,
  `CREATE INDEX IF NOT EXISTS idx_coincidencia_b ON coincidencias(tipo, entidad_b)`,
  `CREATE INDEX IF NOT EXISTS idx_bloque_fuente ON bloques_registro(fuente_id)`,
  `CREATE INDEX IF NOT EXISTS idx_bloque_ref_entidad ON bloque_referencias(entidad_tipo, entidad_id)`,
  `CREATE INDEX IF NOT EXISTS idx_bloque_ref_bloque ON bloque_referencias(bloque_id)`,
  `CREATE INDEX IF NOT EXISTS idx_relacion_proyecto ON relaciones(proyecto_id)`,
  `CREATE INDEX IF NOT EXISTS idx_relacion_origen ON relaciones(origen_tipo, origen_id)`,
  `CREATE INDEX IF NOT EXISTS idx_relacion_destino ON relaciones(destino_tipo, destino_id)`,
  `CREATE INDEX IF NOT EXISTS idx_relacion_bloque ON relaciones(bloque_id)`,
  `CREATE INDEX IF NOT EXISTS idx_relacion_proyecto_origen ON relaciones(proyecto_id, origen_tipo, origen_id)`,
  `CREATE INDEX IF NOT EXISTS idx_relacion_proyecto_destino ON relaciones(proyecto_id, destino_tipo, destino_id)`,
  `CREATE INDEX IF NOT EXISTS idx_relacion_bloque_regla ON relaciones(bloque_id, regla, procedencia)`,
  `CREATE INDEX IF NOT EXISTS idx_relacion_lugar_inicio ON relaciones(lugar_inicio)`,
  `CREATE INDEX IF NOT EXISTS idx_relacion_lugar_fin ON relaciones(lugar_fin)`,
  `CREATE INDEX IF NOT EXISTS idx_persona_institucion ON personas(institucion_id)`,
  `CREATE INDEX IF NOT EXISTS idx_institucion_lugar ON instituciones(lugar_id)`,
  `CREATE INDEX IF NOT EXISTS idx_patrimonio_lugar ON patrimonios(lugar_id)`,
  `CREATE INDEX IF NOT EXISTS idx_exclusion_proyecto ON relaciones_exclusiones(proyecto_id)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS uq_exclusion ON relaciones_exclusiones(bloque_id, regla, firma)`,
  `CREATE INDEX IF NOT EXISTS idx_rf_fuente ON relaciones_fuentes(fuente_id)`,
];

const INDICES_UNICOS_SQLITE = [
  ['personas', 'uq_personas_identificador'],
  ['instituciones', 'uq_instituciones_identificador'],
  ['lugares', 'uq_lugares_identificador'],
  ['patrimonios', 'uq_patrimonios_identificador'],
];

const PREFIJOS_ID = { personas: 'PE', instituciones: 'IN', lugares: 'LU', patrimonios: 'PA' };

const { columnasSQLite } = require('./columnas-nuevas');

const COLUMNAS_NUEVAS = columnasSQLite();

async function columnasDe(pool, tabla) {
  const [filas] = await pool.query(`PRAGMA table_info(${tabla})`);
  return new Set(filas.map((f) => f.name));
}

async function agregarColumnas(pool, tabla, columnas) {
  const existentes = await columnasDe(pool, tabla);
  for (const [nombre, tipo] of columnas) {
    if (existentes.has(nombre)) continue;
    await pool.query(`ALTER TABLE ${tabla} ADD COLUMN ${nombre} ${tipo}`);
    existentes.add(nombre);
  }
}

async function existeColumna(pool, tabla, columna) {
  return (await columnasDe(pool, tabla)).has(columna);
}

async function migrarFechasLegadas(pool) {
  const migraciones = [
    ['personas', 'fecha_nacimiento', 'anio_nacimiento', 'anio_nacimiento'],
    ['personas', 'fecha_defuncion', 'anio_defuncion', 'anio_defuncion'],
    ['instituciones', 'fecha_fundacion', 'anio_fundacion', 'anio_fundacion'],
    ['instituciones', 'fecha_disolucion', 'anio_disolucion', 'anio_disolucion'],
    ['relaciones', 'fecha_inicio', 'anio_inicio', 'anio_fin'],
    ['relaciones', 'fecha_fin', 'anio_fin', 'anio_fin'],
    ['fuentes', 'anio', 'anio_inicio', 'anio_fin'],
  ];
  for (const [tabla, origen, destinoIni, destinoFin] of migraciones) {
    if (!await existeColumna(pool, tabla, origen)) continue;
    const [filas] = await pool.query(`SELECT id, ${origen} AS texto FROM ${tabla} WHERE ${origen} IS NOT NULL`);
    for (const fila of filas) {
      const anios = extraerAnios(fila.texto);
      if (!anios.length) continue;
      const ini = anios[0];
      const fin = anios.length >= 2 ? anios[anios.length - 1] : null;
      const usarUltimo = tabla === 'relaciones' && origen === 'fecha_fin';
      const valorFin = destinoIni === destinoFin
        ? (usarUltimo ? (fin ?? ini) : ini)
        : fin;
      await pool.query(
        `UPDATE ${tabla} SET ${destinoIni} = COALESCE(${destinoIni}, ?), ${destinoFin} = COALESCE(${destinoFin}, ?) WHERE id = ?`,
        [ini, valorFin, fila.id]
      );
    }
  }
}

async function siguienteIdentificador(pool, tabla, prefijo, proyectoId) {
  const [filas] = await pool.query(
    `SELECT MAX(CAST(SUBSTR(identificador, ${prefijo.length + 1}) AS INTEGER)) AS ultimo
     FROM ${tabla} WHERE proyecto_id = ? AND identificador LIKE ?`,
    [proyectoId, `${prefijo}%`]
  );
  return `${prefijo}${String((Number(filas[0].ultimo) || 0) + 1).padStart(5, '0')}`;
}

async function rellenarIdentificadores(pool) {
  for (const [tabla, prefijo] of Object.entries(PREFIJOS_ID)) {
    const [maximos] = await pool.query(
      `SELECT proyecto_id,
              MAX(CAST(SUBSTR(identificador, ?) AS INTEGER)) AS ultimo
       FROM ${tabla}
       WHERE identificador LIKE ?
       GROUP BY proyecto_id`,
      [prefijo.length + 1, `${prefijo}%`]
    );
    const contadores = new Map(
      maximos.map((fila) => [fila.proyecto_id, (Number(fila.ultimo) || 0) + 1])
    );
    const [pendientes] = await pool.query(
      `SELECT id, proyecto_id FROM ${tabla}
       WHERE identificador IS NULL OR TRIM(identificador) = ''
       ORDER BY proyecto_id, id`
    );
    for (const fila of pendientes) {
      const siguiente = contadores.get(fila.proyecto_id) || 1;
      const identificador = `${prefijo}${String(siguiente).padStart(5, '0')}`;
      contadores.set(fila.proyecto_id, siguiente + 1);
      await pool.query(`UPDATE ${tabla} SET identificador = ? WHERE id = ?`, [identificador, fila.id]);
    }
  }
}

async function resolverIdentificadoresDuplicados(pool) {
  for (const [tabla, prefijo] of Object.entries(PREFIJOS_ID)) {
    const [filas] = await pool.query(
      `SELECT id, proyecto_id, identificador FROM ${tabla}
       WHERE identificador IS NOT NULL AND TRIM(identificador) <> ''
       ORDER BY proyecto_id, identificador, id`
    );
    const vistos = new Map();
    for (const fila of filas) {
      const clave = `${fila.proyecto_id}\u0000${fila.identificador}`;
      if (!vistos.has(clave)) {
        vistos.set(clave, true);
        continue;
      }
      const nuevo = await siguienteIdentificador(pool, tabla, prefijo, fila.proyecto_id);
      await pool.query(`UPDATE ${tabla} SET identificador = ? WHERE id = ?`, [nuevo, fila.id]);
      vistos.set(`${fila.proyecto_id}\u0000${nuevo}`, true);
    }
  }
}

async function migrarV2(pool) {
  for (const [tabla, columnas] of Object.entries(COLUMNAS_NUEVAS)) {
    await agregarColumnas(pool, tabla, columnas);
  }

  await pool.query("UPDATE relaciones SET tipo = 'Escribano/Notario' WHERE tipo = 'Notario/Escribano'");
  await pool.query("UPDATE relaciones SET tipo = 'Otorgante – Escribano/Notario' WHERE tipo = 'Otorgante – Notario/Escribano'");
  await pool.query(
    "UPDATE relaciones SET tipo = 'Correspondientes legales', firma = '' WHERE tipo = 'Corresponsales' AND regla LIKE 'comunicaciones:%'"
  );
  await pool.query(
    "UPDATE relaciones SET tipo = 'Correspondientes personales', firma = '' WHERE tipo = 'Corresponsales' AND regla LIKE 'epistolas:%'"
  );
  await pool.query(
    "UPDATE relaciones SET tipo = 'Correspondientes legales', firma = '' WHERE tipo = 'Corresponsales' AND (origen_tipo = 'institucion' OR destino_tipo = 'institucion')"
  );
  await pool.query("UPDATE relaciones SET tipo = 'Correspondientes personales', firma = '' WHERE tipo = 'Corresponsales'");

  /* Limpieza de referencias que versiones anteriores podían dejar huérfanas. */
  if (await existeColumna(pool, 'personas', 'institucion_id')) {
    await pool.query(
      `UPDATE personas SET institucion_id = NULL
       WHERE institucion_id IS NOT NULL
         AND NOT EXISTS (SELECT 1 FROM instituciones i WHERE i.id = personas.institucion_id)`
    );
  }

  await migrarFechasLegadas(pool);
  await rellenarIdentificadores(pool);
  await resolverIdentificadoresDuplicados(pool);
  await pool.query(
    `UPDATE proyectos
     SET fecha_creacion = COALESCE(fecha_creacion, CURRENT_TIMESTAMP),
         fecha_modificacion = COALESCE(fecha_modificacion, CURRENT_TIMESTAMP)`
  );
}

async function limpiarReferenciasHuerfanas(pool) {
  await pool.query(
    `UPDATE instituciones SET lugar_id = NULL
     WHERE lugar_id IS NOT NULL
       AND NOT EXISTS (SELECT 1 FROM lugares l WHERE l.id = instituciones.lugar_id)`
  );
  await pool.query(
    `UPDATE patrimonios SET lugar_id = NULL
     WHERE lugar_id IS NOT NULL
       AND NOT EXISTS (SELECT 1 FROM lugares l WHERE l.id = patrimonios.lugar_id)`
  );
  await pool.query(
    `UPDATE personas SET institucion_id = NULL
     WHERE institucion_id IS NOT NULL
       AND NOT EXISTS (SELECT 1 FROM instituciones i WHERE i.id = personas.institucion_id)`
  );
  await pool.query(
    `UPDATE relaciones SET lugar_inicio = NULL
     WHERE lugar_inicio IS NOT NULL
       AND NOT EXISTS (SELECT 1 FROM lugares l WHERE l.id = relaciones.lugar_inicio)`
  );
  await pool.query(
    `UPDATE relaciones SET lugar_fin = NULL
     WHERE lugar_fin IS NOT NULL
       AND NOT EXISTS (SELECT 1 FROM lugares l WHERE l.id = relaciones.lugar_fin)`
  );
  await pool.query(
    `DELETE FROM relaciones
     WHERE bloque_id IS NOT NULL
       AND procedencia = 'AUTOMATIZADA'
       AND NOT EXISTS (SELECT 1 FROM bloques_registro b WHERE b.id = relaciones.bloque_id)`
  );
  await pool.query(
    `UPDATE relaciones SET bloque_id = NULL
     WHERE bloque_id IS NOT NULL
       AND NOT EXISTS (SELECT 1 FROM bloques_registro b WHERE b.id = relaciones.bloque_id)`
  );
  await pool.query(
    `DELETE FROM relaciones WHERE
       (origen_tipo = 'persona' AND NOT EXISTS (SELECT 1 FROM personas e WHERE e.id = relaciones.origen_id))
       OR (origen_tipo = 'institucion' AND NOT EXISTS (SELECT 1 FROM instituciones e WHERE e.id = relaciones.origen_id))
       OR (origen_tipo = 'lugar' AND NOT EXISTS (SELECT 1 FROM lugares e WHERE e.id = relaciones.origen_id))
       OR (origen_tipo = 'patrimonio' AND NOT EXISTS (SELECT 1 FROM patrimonios e WHERE e.id = relaciones.origen_id))
       OR (destino_tipo = 'persona' AND NOT EXISTS (SELECT 1 FROM personas e WHERE e.id = relaciones.destino_id))
       OR (destino_tipo = 'institucion' AND NOT EXISTS (SELECT 1 FROM instituciones e WHERE e.id = relaciones.destino_id))
       OR (destino_tipo = 'lugar' AND NOT EXISTS (SELECT 1 FROM lugares e WHERE e.id = relaciones.destino_id))
       OR (destino_tipo = 'patrimonio' AND NOT EXISTS (SELECT 1 FROM patrimonios e WHERE e.id = relaciones.destino_id))`
  );
  await pool.query(
    `DELETE FROM relaciones_exclusiones
     WHERE bloque_id IS NOT NULL
       AND NOT EXISTS (SELECT 1 FROM bloques_registro b WHERE b.id = relaciones_exclusiones.bloque_id)`
  );
  await pool.query(
    `DELETE FROM bloque_referencias
     WHERE NOT EXISTS (SELECT 1 FROM bloques_registro b WHERE b.id = bloque_referencias.bloque_id)`
  );
  await pool.query(
    `DELETE FROM relaciones_fuentes
     WHERE NOT EXISTS (SELECT 1 FROM relaciones r WHERE r.id = relaciones_fuentes.relacion_id)`
  );
  await pool.query(
    `DELETE FROM relaciones_fuentes
     WHERE NOT EXISTS (SELECT 1 FROM fuentes f WHERE f.id = relaciones_fuentes.fuente_id)`
  );
}

async function asegurarUuidsProyectos(pool) {
  const [pendientes] = await pool.query(
    "SELECT id FROM proyectos WHERE uuid IS NULL OR TRIM(uuid) = ''"
  );
  for (const fila of pendientes) {
    await pool.query('UPDATE proyectos SET uuid = ? WHERE id = ?', [crypto.randomUUID(), fila.id]);
  }
}

async function migrarV3(pool) {
  for (const [tabla, columnas] of Object.entries(COLUMNAS_NUEVAS)) {
    await agregarColumnas(pool, tabla, columnas);
  }
  await asegurarUuidsProyectos(pool);
  await limpiarReferenciasHuerfanas(pool);
}

async function migrarV4(pool) {
  for (const [tabla, columnas] of Object.entries(COLUMNAS_NUEVAS)) {
    await agregarColumnas(pool, tabla, columnas);
  }
  await asegurarUuidsProyectos(pool);
}

async function migrarV5(pool) {
  await relacionesAutomaticas.corregirSedesAutomaticasInvertidas(pool);
}

async function migrarV6(pool) {
  await pool.query("UPDATE relaciones SET tipo = 'Infiltrado' WHERE tipo = 'Espía/Infiltrado'");
}

async function migrarV7(pool) {
  await renombrarTiposRelacion(pool);
}

async function migrarV8(pool) {
  await renombrarTiposRelacion(pool);
}

async function migrarV9(pool) {
  await pool.query('DELETE FROM bloque_referencias');
  const [bloques] = await pool.query('SELECT id, tipo, datos FROM bloques_registro');
  for (const bloque of bloques) {
    let datos;
    try {
      datos = bloque.datos ? JSON.parse(bloque.datos) : {};
    } catch {
      continue;
    }
    if (!datos || typeof datos !== 'object' || Array.isArray(datos)) continue;
    const ids = {
      persona: new Set(), institucion: new Set(), lugar: new Set(), patrimonio: new Set(),
    };
    try {
      recolectarReferenciasBloque(datos, bloque.tipo, ids);
    } catch {
      continue;
    }
    for (const [tipo, conjunto] of Object.entries(ids)) {
      for (const id of conjunto) {
        const numero = Number(id);
        if (!Number.isInteger(numero) || numero <= 0) continue;
        await pool.query(
          'INSERT OR IGNORE INTO bloque_referencias (bloque_id, entidad_tipo, entidad_id) VALUES (?, ?, ?)',
          [bloque.id, tipo, numero]
        );
      }
    }
  }
}

async function crearIndices(pool) {
  for (const sentencia of INDICES_SQLITE) {
    try {
      await pool.query(sentencia);
    } catch (err) {
      const unico = /^CREATE UNIQUE INDEX IF NOT EXISTS (\w+)/i.exec(sentencia.trim());
      if (!unico) throw err;
      const nombre = unico[1];
      console.warn(`[sqlite] No se pudo crear el índice único ${nombre}: ${err.message}`);
      try {
        await pool.query(`CREATE INDEX IF NOT EXISTS idx_${nombre} ON ${tablaDeIndice(nombre)}`);
      } catch (errIndice) {
        console.warn(`[sqlite] Tampoco se pudo crear el índice de respaldo ${nombre}: ${errIndice.message}`);
      }
    }
  }
  for (const [tabla, nombre] of INDICES_UNICOS_SQLITE) {
    try {
      await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS ${nombre} ON ${tabla}(proyecto_id, identificador)`);
    } catch (err) {
      /* Si una base antigua aún tiene duplicados, no impedimos el arranque:
         dejamos un índice no único y avisamos. Las nuevas inserciones siguen
         validándose en la capa de datos. */
      console.warn(`[sqlite] No se pudo crear ${nombre}: ${err.message}`);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_${tabla}_identificador ON ${tabla}(proyecto_id, identificador)`);
    }
  }
}

function tablaDeIndice(nombre) {
  if (nombre === 'uq_proyectos_uuid') return 'proyectos(uuid)';
  if (nombre === 'uq_exclusion') return 'relaciones_exclusiones(bloque_id, regla, firma)';
  return 'proyectos(id)';
}

async function deduplicarUuidsProyectos(pool) {
  const [filas] = await pool.query(
    "SELECT id, uuid FROM proyectos WHERE uuid IS NOT NULL AND TRIM(uuid) <> '' ORDER BY id"
  );
  const vistos = new Set();
  for (const fila of filas) {
    const uuid = String(fila.uuid);
    if (!vistos.has(uuid)) {
      vistos.add(uuid);
      continue;
    }
    const nuevo = crypto.randomUUID();
    await pool.query('UPDATE proyectos SET uuid = ? WHERE id = ?', [nuevo, fila.id]);
    vistos.add(nuevo);
  }
}

async function deduplicarExclusiones(pool) {
  const [filas] = await pool.query(
    'SELECT id, bloque_id, regla, firma FROM relaciones_exclusiones ORDER BY id'
  );
  const vistos = new Set();
  for (const fila of filas) {
    const clave = `${fila.bloque_id}\u0000${fila.regla || ''}\u0000${fila.firma || ''}`;
    if (!vistos.has(clave)) {
      vistos.add(clave);
      continue;
    }
    await pool.query('DELETE FROM relaciones_exclusiones WHERE id = ?', [fila.id]);
  }
}

async function copiarBaseParaMigracion(pool) {
  if (!fs.existsSync(pool.ruta)) return null;
  const destino = `${pool.ruta}.bak-${fechaSello()}`;
  try { await pool.checkpoint(); } catch { /* sin WAL */ }
  copiarSiExiste(pool.ruta, destino);
  copiarSiExiste(`${pool.ruta}-wal`, `${destino}-wal`);
  copiarSiExiste(`${pool.ruta}-shm`, `${destino}-shm`);
  for (const sufijo of ['', '-wal', '-shm']) {
    try { fs.chmodSync(`${destino}${sufijo}`, 0o600); } catch { /* Windows */ }
  }
  limpiarCopiasAntiguas(pool.ruta);
  return destino;
}

function limpiarCopiasAntiguas(ruta, maximo = 5) {
  try {
    const directorio = path.dirname(ruta);
    const base = path.basename(ruta);
    const copias = fs.readdirSync(directorio)
      .filter((nombre) => nombre.startsWith(`${base}.bak-`) && !nombre.endsWith('-wal') && !nombre.endsWith('-shm'))
      .sort()
      .reverse();
    for (const nombre of copias.slice(maximo)) {
      for (const sufijo of ['', '-wal', '-shm']) {
        try { fs.rmSync(path.join(directorio, `${nombre}${sufijo}`), { force: true }); } catch { /* nada */ }
      }
    }
  } catch { /* sin permisos o directorio no disponible */ }
}

async function crearEsquemaSQLite(pool) {
  const [versionFila] = await pool.query('PRAGMA user_version');
  const version = Number(versionFila?.[0]?.user_version || 0);
  const [tablas] = await pool.query(
    "SELECT 1 AS hay FROM sqlite_master WHERE type = 'table' AND name = 'proyectos' LIMIT 1"
  );
  const hayEsquema = tablas.length > 0;
  let copia = null;
  if (version < ESQUEMA_VERSION && (version > 0 || hayEsquema)) {
    copia = await copiarBaseParaMigracion(pool);
  }

  await pool.transaccion(async (ejecutor) => {
    for (const sentencia of ESQUEMA_SQLITE) await ejecutor.query(sentencia);
    if (version < 2) await migrarV2(ejecutor);
    if (version < 3) await migrarV3(ejecutor);
    if (version < 4) await migrarV4(ejecutor);
    if (version < 5) await migrarV5(ejecutor);
    if (version < 6) await migrarV6(ejecutor);
    if (version < 7) await migrarV7(ejecutor);
    if (version < 8) await migrarV8(ejecutor);
    if (version < 9) await migrarV9(ejecutor);
    await deduplicarUuidsProyectos(ejecutor);
    await deduplicarExclusiones(ejecutor);
    await crearIndices(ejecutor);
    if (version < ESQUEMA_VERSION) {
      await ejecutor.query(`PRAGMA user_version = ${ESQUEMA_VERSION}`);
    }
  });
  if (copia) console.log(`[sqlite] Copia previa a la migración: ${copia}`);
}

module.exports = { PoolSQLite, probarSQLite, crearEsquemaSQLite, ESQUEMA_VERSION };
