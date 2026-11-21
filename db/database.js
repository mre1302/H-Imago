'use strict';

/**
 * H-IMAGO · Capa de acceso a datos (SQLite o MySQL/MariaDB)
 * El esquema se crea automáticamente la primera vez que se conecta.
 * Las fechas históricas se guardan como texto (VARCHAR/TEXT) porque la
 * documentación suele presentar dataciones imprecisas ("c. 1520",
 * "antes de 1603", "fl. 1489-1512"...).
 */

const path = require('path');
const crypto = require('crypto');
const mysql = require('mysql2/promise');
const relacionesAutomaticas = require('./relaciones-automaticas');
const { crearEsquemaMySQL } = require('./mysql-esquema');
const { PoolSQLite, probarSQLite, crearEsquemaSQLite } = require('./sqlite');

const {
  normalizarTipoRelacion,
  DEFINICIONES,
  TIPOS_GRAFO,
  TIPOS_ENTIDAD,
  PREFIJOS_ID,
  CAMPOS_RESUMEN,
  LIMITES_CAMPOS,
} = require('./definiciones');

function esHostLocal(host) {
  const valor = String(host || '').trim().toLowerCase();
  return valor === 'localhost' || valor === '127.0.0.1' || valor === '::1' || valor === '[::1]';
}

function opcionesMySQL(cfg) {
  const opciones = {
    host: cfg.host,
    port: Number(cfg.port) || 3306,
    user: cfg.user,
    password: cfg.password || undefined,
    connectTimeout: 8000,
    enableKeepAlive: true,
  };
  const local = esHostLocal(cfg.host);
  const sslActivo = cfg.ssl === undefined ? !local : Boolean(cfg.ssl);
  if (sslActivo || cfg.ssl) {
    opciones.ssl = {
      rejectUnauthorized: cfg.sslVerificar !== false,
      ...(cfg.sslCa ? { ca: cfg.sslCa } : {}),
    };
  }
  return opciones;
}

function validarProyecto({ nombre, creador, descripcion }) {
  if (!nombre || !String(nombre).trim()) throw new Error('El nombre del proyecto es obligatorio.');
  if (String(nombre).trim().length > 255) throw new Error('El nombre del proyecto es demasiado largo (máximo 255 caracteres).');
  if (creador && String(creador).trim().length > 255) throw new Error('El creador es demasiado largo (máximo 255 caracteres).');
  if (descripcion != null && typeof descripcion !== 'string') {
    throw new Error('La descripción del proyecto no es válida.');
  }
  if (descripcion && String(descripcion).length > 65535) throw new Error('La descripción es demasiado larga (máximo 65535 caracteres).');
}


const {
  remapearDatosBloque,
  recolectarReferenciasBloque,
  remapearReferenciaEnBloque,
  limpiarReferenciaEnBloque,
  CAMPOS_ENTIDAD_BLOQUE,
} = require('./bloques-referencias');
const {
  normalizarConsulta,
  normalizarTexto,
  tokensDeConsulta,
  puntuar,
  crearSnippet,
  rangosDeTokens,
  crearFiltroBloom,
  bloomPuedeContener,
} = require('./busqueda');

const CACHE_BUSQUEDA_MS = 60000;
const LIMITE_RESULTADOS_BUSQUEDA = 60;
const LIMITE_CONTENIDO_CUADERNO = 20 * 1024 * 1024;
const LIMITE_DATOS_BLOQUE = 10 * 1024 * 1024;

function valorTextoBusqueda(valor) {
  if (valor === null || valor === undefined) return '';
  if (typeof valor === 'string') return valor.trim();
  if (typeof valor === 'number') return String(valor);
  if (typeof valor === 'boolean') return valor ? 'sí' : 'no';
  return '';
}

function juntarPartesBusqueda(partes) {
  return partes.map(valorTextoBusqueda).filter(Boolean).join(' · ');
}

function rangoAniosBusqueda(inicio, fin) {
  if (inicio == null && fin == null) return '';
  return `${inicio ?? '¿?'} – ${fin ?? '¿?'}`;
}

/** Año orientativo a partir de una fecha exacta o de su modelo estructurado. */
function anioDeFechaExacta(texto, metaCrudo, ultimo = false) {
  if (metaCrudo) {
    try {
      const meta = typeof metaCrudo === 'string' ? JSON.parse(metaCrudo) : metaCrudo;
      const anio = Number(meta && meta.anio);
      if (Number.isInteger(anio)) return anio;
    } catch { /* sin modelo utilizable */ }
  }
  const coincidencias = [...String(texto || '').matchAll(/(?:^|\D)(\d{3,4})(?=\D|$)/g)];
  if (!coincidencias.length) return null;
  const elegida = ultimo ? coincidencias[coincidencias.length - 1] : coincidencias[0];
  const anio = Number(elegida[1]);
  return Number.isFinite(anio) ? anio : null;
}

function crearItemBusqueda({ tipo, id, titulo, subtitulo, texto, publico }) {
  const tituloNormalizado = normalizarTexto(titulo);
  const textoNormalizado = normalizarTexto(texto);
  return {
    tipo,
    id,
    titulo,
    subtitulo,
    texto,
    publico,
    tituloNormalizado,
    textoNormalizado,
    bloom: crearFiltroBloom(`${tituloNormalizado} ${textoNormalizado}`),
  };
}

class BaseDatos {
  constructor() {
    this.pool = null;
    this.config = null;
    this.motor = null;
    this.generacionConexion = 0;
    this.cacheBusqueda = new Map();
    this.corpusBusquedaPendiente = new Map();
  }

  estaConectado() {
    return Boolean(this.pool);
  }

  esMySQL(cfg) {
    return Boolean(cfg && (cfg.motor === 'mysql' || (!cfg.motor && cfg.host)));
  }

  listo() {
    if (!this.pool) {
      throw new Error('No hay conexión con la base de datos. Abre «Configuración» y verifica el modo de trabajo.');
    }
  }

  /** Ejecuta un bloque de operaciones en una única transacción. */
  async transaccion(fn) {
    await this.listo();
    if (this.motor === 'sqlite' && typeof this.pool.transaccion === 'function') {
      return this.pool.transaccion(fn);
    }
    const conexion = await this.pool.getConnection();
    try {
      await conexion.beginTransaction();
      const resultado = await fn(conexion);
      await conexion.commit();
      return resultado;
    } catch (err) {
      try { await conexion.rollback(); } catch { /* la transacción ya no existe */ }
      throw err;
    } finally {
      try { conexion.release(); } catch { /* conexión SQLite sin release real */ }
    }
  }

  validarTipo(tipo, permitirFuente = false) {
    const validos = permitirFuente ? TIPOS_ENTIDAD : TIPOS_GRAFO;
    if (!validos.includes(tipo)) {
      throw new Error(`Tipo de entidad no válido: ${tipo}`);
    }
    return tipo;
  }

  async validarIdProyecto(id) {
    const n = Number(id);
    if (!Number.isInteger(n) || n <= 0) throw new Error('Identificador de proyecto no válido.');
    return n;
  }

  /* ---------------------------------------------------------------- */
  /* Conexión y esquema                                               */
  /* ---------------------------------------------------------------- */

  async probar(cfg) {
    if (!this.esMySQL(cfg)) {
      return probarSQLite(cfg && cfg.ruta);
    }
    const base = String(cfg.database || '').trim();
    if (!/^[A-Za-z0-9_]{1,64}$/.test(base)) {
      throw new Error('El nombre de la base de datos solo puede contener letras, números y guiones bajos.');
    }
    const conexion = await mysql.createConnection(opcionesMySQL(cfg));
    try {
      await conexion.query("SET time_zone = '+00:00'");
      try {
        await conexion.query(`USE ${mysql.escapeId(base)}`);
      } catch (err) {
        if (!err || err.code !== 'ER_BAD_DB_ERROR') throw err;
        await conexion.query(
          `CREATE DATABASE IF NOT EXISTS ${mysql.escapeId(base)} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
        );
        await conexion.query(`USE ${mysql.escapeId(base)}`);
      }
      const [filas] = await conexion.query('SELECT VERSION() AS version');
      return { version: filas[0].version, database: base };
    } finally {
      await conexion.end();
    }
  }

  async conectar(cfg) {
    if (this.pool) {
      try { await this.pool.end(); } catch { /* ya cerrada */ }
    }
    this.pool = null;
    this.generacionConexion++;
    this.cacheBusqueda.clear();
    this.corpusBusquedaPendiente.clear();

    if (!this.esMySQL(cfg)) {
      this.motor = 'sqlite';
      this.pool = new PoolSQLite(cfg && cfg.ruta);
      this.config = {
        motor: 'sqlite',
        ruta: this.pool.ruta,
        database: path.basename(this.pool.ruta),
      };
      try {
        await this.crearEsquema();
      } catch (err) {
        try { await this.pool.end(); } catch { /* ya cerrada */ }
        this.pool = null;
        throw err;
      }
      return true;
    }

    await this.probar(cfg);
    this.motor = 'mysql';
    this.pool = mysql.createPool({
      ...opcionesMySQL(cfg),
      database: cfg.database,
      charset: 'utf8mb4',
      decimalNumbers: true,
      timezone: 'Z',
      connectionLimit: 10,
      /* FOUND_ROWS hace que affectedRows cuente filas encontradas y no solo
         modificadas; así guardar una ficha sin cambios no parece un error. */
      flags: ['FOUND_ROWS'],
    });
    this.pool.on('connection', (conexion) => {
      conexion.promise().query("SET time_zone = '+00:00'").catch(() => { /* sin permiso */ });
    });
    this.config = cfg;
    try {
      await this.crearEsquema();
    } catch (err) {
      try { await this.pool.end(); } catch { /* ya cerrada */ }
      this.pool = null;
      throw err;
    }
    return true;
  }

  async crearEsquema() {
    if (this.motor === 'sqlite') return crearEsquemaSQLite(this.pool);
    return crearEsquemaMySQL(this.pool, this.config);
  }

  /* ---------------------------------------------------------------- */
  /* Utilidades                                                       */
  /* ---------------------------------------------------------------- */

  def(tipo) {
    const d = DEFINICIONES[tipo];
    if (!d) throw new Error(`Tipo de entidad desconocido: ${tipo}`);
    return d;
  }

  sanea(def, datos) {
    const salida = {};
    for (const campo of def.campos) {
      if (!(campo in datos)) continue;
      let v = datos[campo];
      if (typeof v === 'string') v = v.trim();
      if (v === '' || v === undefined) v = null;
      if (v !== null && !def.numericos.includes(campo) && typeof v !== 'string') {
        if (typeof v === 'number' || typeof v === 'boolean') {
          v = String(v);
        } else {
          throw new Error(`El campo «${campo}» no es válido.`);
        }
      }
      if (typeof v === 'string') {
        const limite = LIMITES_CAMPOS[def.tabla]?.[campo];
        if (limite && v.length > limite) {
          throw new Error(`El campo «${campo}» es demasiado largo (máximo ${limite} caracteres).`);
        }
      }
      if (v !== null && def.numericos.includes(campo)) {
        const n = Number(v);
        v = Number.isFinite(n) ? n : null;
        if (v !== null && def.tabla === 'lugares' && campo === 'latitud' && (v < -90 || v > 90)) {
          throw new Error('La latitud debe estar entre -90 y 90.');
        }
        if (v !== null && def.tabla === 'lugares' && campo === 'longitud' && (v < -180 || v > 180)) {
          throw new Error('La longitud debe estar entre -180 y 180.');
        }
      }
      salida[campo] = v;
    }
    return salida;
  }

  /** Comprueba la existencia real de una fila. Evita que una actualización
      sin cambios (affectedRows = 0 en algunos servidores) se confunda con
      un registro inexistente. */
  async existeRegistro(tabla, id, ejecutor = this.pool) {
    const [filas] = await ejecutor.query(`SELECT 1 FROM ${tabla} WHERE id = ? LIMIT 1`, [id]);
    return filas.length > 0;
  }

  /** Marca el proyecto como modificado. Se usa en cada escritura de datos
      para que la lista del índice refleje la última edición real. */
  async tocarProyecto(proyectoId, ejecutor = this.pool) {
    if (!proyectoId) return;
    await ejecutor.query(
      'UPDATE proyectos SET fecha_modificacion = CURRENT_TIMESTAMP WHERE id = ?',
      [proyectoId]
    );
  }

  async proyectoDeFuente(fuenteId, ejecutor = this.pool) {
    const [filas] = await ejecutor.query(
      'SELECT proyecto_id FROM fuentes WHERE id = ? LIMIT 1',
      [fuenteId]
    );
    return filas.length ? filas[0].proyecto_id : null;
  }

  /* Las operaciones de actualización/borrado por id deben confirmar que el
     registro pertenece al proyecto activo. Sin esta comprobación, un error
     o un renderer comprometido podría tocar datos de otro proyecto. */
  async verificarProyectoEntidad(tipo, id, proyectoId) {
    await this.listo();
    const def = this.def(tipo);
    const [filas] = await this.pool.query(
      `SELECT proyecto_id FROM ${def.tabla} WHERE id = ? LIMIT 1`,
      [id]
    );
    if (!filas.length) throw new Error('El registro no existe.');
    if (Number(filas[0].proyecto_id) !== Number(proyectoId)) {
      throw new Error('El registro no pertenece al proyecto activo.');
    }
    return true;
  }

  async verificarFuenteProyecto(fuenteId, proyectoId) {
    await this.listo();
    const [filas] = await this.pool.query(
      'SELECT proyecto_id FROM fuentes WHERE id = ? LIMIT 1',
      [fuenteId]
    );
    if (!filas.length || Number(filas[0].proyecto_id) !== Number(proyectoId)) {
      throw new Error('La fuente no pertenece al proyecto activo.');
    }
    return true;
  }

  async verificarBloqueProyecto(bloqueId, proyectoId) {
    await this.listo();
    const [filas] = await this.pool.query(
      `SELECT f.proyecto_id
       FROM bloques_registro b JOIN fuentes f ON f.id = b.fuente_id
       WHERE b.id = ? LIMIT 1`,
      [bloqueId]
    );
    if (!filas.length || Number(filas[0].proyecto_id) !== Number(proyectoId)) {
      throw new Error('El bloque no pertenece al proyecto activo.');
    }
    return true;
  }

  async verificarCuadernoProyecto(cuadernoId, proyectoId) {
    await this.listo();
    const [filas] = await this.pool.query(
      `SELECT f.proyecto_id
       FROM cuadernos c JOIN fuentes f ON f.id = c.fuente_id
       WHERE c.id = ? LIMIT 1`,
      [cuadernoId]
    );
    if (!filas.length || Number(filas[0].proyecto_id) !== Number(proyectoId)) {
      throw new Error('El cuaderno no pertenece al proyecto activo.');
    }
    return true;
  }

  async verificarRelacionProyecto(id, proyectoId) {
    await this.listo();
    const [filas] = await this.pool.query(
      'SELECT proyecto_id FROM relaciones WHERE id = ? LIMIT 1',
      [id]
    );
    if (!filas.length || Number(filas[0].proyecto_id) !== Number(proyectoId)) {
      throw new Error('La relación no pertenece al proyecto activo.');
    }
    return true;
  }

  async verificarCoincidenciaProyecto(id, proyectoId) {
    await this.listo();
    const [filas] = await this.pool.query(
      'SELECT proyecto_id FROM coincidencias WHERE id = ? LIMIT 1',
      [id]
    );
    if (!filas.length || Number(filas[0].proyecto_id) !== Number(proyectoId)) {
      throw new Error('La coincidencia no pertenece al proyecto activo.');
    }
    return true;
  }

  /** Limpia referencias a una entidad dentro del JSON de los bloques. */
  async actualizarReferenciasBloque(bloqueId, tipo, datos, ejecutor = this.pool) {
    await ejecutor.query('DELETE FROM bloque_referencias WHERE bloque_id = ?', [bloqueId]);
    if (!datos || typeof datos !== 'object' || Array.isArray(datos)) return;
    const ids = {
      persona: new Set(), institucion: new Set(), lugar: new Set(), patrimonio: new Set(),
    };
    try {
      recolectarReferenciasBloque(datos, tipo, ids);
    } catch {
      return;
    }
    const insertar = this.motor === 'sqlite' ? 'INSERT OR IGNORE' : 'INSERT IGNORE';
    for (const [entidadTipo, conjunto] of Object.entries(ids)) {
      for (const valor of conjunto) {
        const entidadId = Number(valor);
        if (!Number.isInteger(entidadId) || entidadId <= 0) continue;
        await ejecutor.query(
          `${insertar} INTO bloque_referencias (bloque_id, entidad_tipo, entidad_id)
           VALUES (?, ?, ?)`,
          [bloqueId, entidadTipo, entidadId]
        );
      }
    }
  }

  async limpiarReferenciasBloquesEntidad(tipo, id, proyectoId, ejecutor = this.pool) {
    const [bloques] = await ejecutor.query(
      `SELECT b.id, b.tipo, b.datos
       FROM bloque_referencias br
       JOIN bloques_registro b ON b.id = br.bloque_id
       JOIN fuentes f ON f.id = b.fuente_id
       WHERE f.proyecto_id = ? AND br.entidad_tipo = ? AND br.entidad_id = ?`,
      [proyectoId, tipo, Number(id)]
    );
    for (const bloque of bloques) {
      let datos;
      try {
        datos = bloque.datos ? JSON.parse(bloque.datos) : {};
      } catch {
        continue;
      }
      if (!datos || typeof datos !== 'object' || Array.isArray(datos)) continue;
      if (!limpiarReferenciaEnBloque(datos, tipo, id, bloque.tipo)) continue;
      await ejecutor.query(
        'UPDATE bloques_registro SET datos = ?, fecha_modificacion = CURRENT_TIMESTAMP WHERE id = ?',
        [JSON.stringify(datos), bloque.id]
      );
      await this.actualizarReferenciasBloque(bloque.id, bloque.tipo, datos, ejecutor);
    }
  }

  /* ---------------------------------------------------------------- */
  /* Proyectos                                                        */
  /* ---------------------------------------------------------------- */

  async listarProyectos() {
    await this.listo();
    const [filas] = await this.pool.query(
      `SELECT p.*,
        COALESCE(per.n, 0) AS n_personas,
        COALESCE(ins.n, 0) AS n_instituciones,
        COALESCE(lug.n, 0) AS n_lugares,
        COALESCE(pat.n, 0) AS n_patrimonios,
        COALESCE(fue.n, 0) AS n_fuentes,
        COALESCE(rel.n, 0) AS n_relaciones
       FROM proyectos p
       LEFT JOIN (SELECT proyecto_id, COUNT(*) AS n FROM personas GROUP BY proyecto_id) per ON per.proyecto_id = p.id
       LEFT JOIN (SELECT proyecto_id, COUNT(*) AS n FROM instituciones GROUP BY proyecto_id) ins ON ins.proyecto_id = p.id
       LEFT JOIN (SELECT proyecto_id, COUNT(*) AS n FROM lugares GROUP BY proyecto_id) lug ON lug.proyecto_id = p.id
       LEFT JOIN (SELECT proyecto_id, COUNT(*) AS n FROM patrimonios GROUP BY proyecto_id) pat ON pat.proyecto_id = p.id
       LEFT JOIN (SELECT proyecto_id, COUNT(*) AS n FROM fuentes GROUP BY proyecto_id) fue ON fue.proyecto_id = p.id
       LEFT JOIN (SELECT proyecto_id, COUNT(*) AS n FROM relaciones GROUP BY proyecto_id) rel ON rel.proyecto_id = p.id
       ORDER BY p.fecha_modificacion DESC`
    );
    return filas;
  }

  async crearProyecto({ nombre, descripcion, creador }, ejecutor = this.pool) {
    await this.listo();
    validarProyecto({ nombre, creador, descripcion });
    const [res] = await ejecutor.query(
      'INSERT INTO proyectos (nombre, descripcion, creador, uuid, fecha_creacion, fecha_modificacion) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)',
      [
        String(nombre).trim(),
        descripcion == null || descripcion === '' ? null : String(descripcion),
        creador && String(creador).trim() ? String(creador).trim() : null,
        crypto.randomUUID(),
      ]
    );
    return this.obtenerProyecto(res.insertId, ejecutor);
  }

  async obtenerProyecto(id, ejecutor = this.pool) {
    await this.listo();
    const [filas] = await ejecutor.query('SELECT * FROM proyectos WHERE id = ?', [id]);
    if (!filas.length) throw new Error('El proyecto no existe.');
    const proyecto = filas[0];
    const [stats] = await ejecutor.query(
      `SELECT
        (SELECT COUNT(*) FROM personas WHERE proyecto_id = ?) AS personas,
        (SELECT COUNT(*) FROM instituciones WHERE proyecto_id = ?) AS instituciones,
        (SELECT COUNT(*) FROM lugares WHERE proyecto_id = ?) AS lugares,
        (SELECT COUNT(*) FROM patrimonios WHERE proyecto_id = ?) AS patrimonios,
        (SELECT COUNT(*) FROM fuentes WHERE proyecto_id = ?) AS fuentes,
        (SELECT COUNT(*) FROM relaciones WHERE proyecto_id = ?) AS relaciones`,
      [id, id, id, id, id, id]
    );
    return { ...proyecto, estadisticas: stats[0] };
  }

  async eliminarProyecto(id) {
    await this.listo();
    return this.transaccion(async (conexion) => {
      const [proyectos] = await conexion.query('SELECT id FROM proyectos WHERE id = ?', [id]);
      if (!proyectos.length) throw new Error('El proyecto no existe o ya fue eliminado.');
      const [fuentes] = await conexion.query('SELECT id FROM fuentes WHERE proyecto_id = ?', [id]);
      const idsFuente = fuentes.map((f) => f.id);
      if (idsFuente.length) {
        for (let i = 0; i < idsFuente.length; i += 500) {
          const trozo = idsFuente.slice(i, i + 500);
          const marcas = trozo.map(() => '?').join(', ');
          await conexion.query(`DELETE FROM cuadernos WHERE fuente_id IN (${marcas})`, trozo);
          await conexion.query(`DELETE FROM bloques_registro WHERE fuente_id IN (${marcas})`, trozo);
          await conexion.query(`DELETE FROM relaciones_fuentes WHERE fuente_id IN (${marcas})`, trozo);
        }
      }
      await conexion.query(
        'DELETE FROM relaciones_fuentes WHERE relacion_id IN (SELECT id FROM relaciones WHERE proyecto_id = ?)',
        [id]
      );
      await conexion.query(
        `DELETE FROM bloque_referencias
         WHERE bloque_id IN (
           SELECT b.id FROM bloques_registro b
           JOIN fuentes f ON f.id = b.fuente_id
           WHERE f.proyecto_id = ?
         )`,
        [id]
      );
      await conexion.query('DELETE FROM relaciones WHERE proyecto_id = ?', [id]);
      await conexion.query('DELETE FROM relaciones_exclusiones WHERE proyecto_id = ?', [id]);
      await conexion.query('DELETE FROM coincidencias WHERE proyecto_id = ?', [id]);
      for (const tabla of ['patrimonios', 'personas', 'instituciones', 'fuentes', 'lugares']) {
        await conexion.query(`DELETE FROM ${tabla} WHERE proyecto_id = ?`, [id]);
      }
      await conexion.query('DELETE FROM proyectos WHERE id = ?', [id]);
      return true;
    });
  }

  async guardarProyecto(id) {
    await this.listo();
    await this.pool.query('UPDATE proyectos SET fecha_modificacion = CURRENT_TIMESTAMP WHERE id = ?', [id]);
    return this.obtenerProyecto(id);
  }

  async actualizarProyecto(id, { nombre, descripcion, creador }) {
    await this.listo();
    validarProyecto({ nombre, creador, descripcion });
    const [res] = await this.pool.query(
      'UPDATE proyectos SET nombre = ?, descripcion = ?, creador = ?, fecha_modificacion = CURRENT_TIMESTAMP WHERE id = ?',
      [
        String(nombre).trim(),
        descripcion ? String(descripcion).trim() || null : null,
        creador && String(creador).trim() ? String(creador).trim() : null,
        id,
      ]
    );
    if (!res.affectedRows && !(await this.existeRegistro('proyectos', id))) {
      throw new Error('El proyecto no existe o no se pudo actualizar.');
    }
    return this.obtenerProyecto(id);
  }

  /* ---------------------------------------------------------------- */
  /* Entidades (CRUD genérico)                                        */
  /* ---------------------------------------------------------------- */

  async listarEntidades(tipo, proyectoId, ejecutor = this.pool) {
    await this.listo();
    const def = this.def(tipo);
    const [filas] = await ejecutor.query(
      `SELECT * FROM ${def.tabla} WHERE proyecto_id = ? ORDER BY ${def.orden} ASC`,
      [proyectoId]
    );
    return filas;
  }

  /** Listado ligero para listas y desplegables (sin notas ni transcripciones). */
  async listarEntidadesResumen(tipo, proyectoId, ejecutor = this.pool) {
    await this.listo();
    const def = this.def(tipo);
    const campos = CAMPOS_RESUMEN[tipo];
    if (!campos) return this.listarEntidades(tipo, proyectoId, ejecutor);
    const [filas] = await ejecutor.query(
      `SELECT ${campos} FROM ${def.tabla} WHERE proyecto_id = ? ORDER BY ${def.orden} ASC`,
      [proyectoId]
    );
    return filas;
  }

  async obtenerEntidad(tipo, id, ejecutor = this.pool) {
    await this.listo();
    const def = this.def(tipo);
    const [filas] = await ejecutor.query(`SELECT * FROM ${def.tabla} WHERE id = ?`, [id]);
    if (!filas.length) throw new Error('El registro no existe.');
    return filas[0];
  }

  /** Comprueba que una entidad referenciada pertenece al mismo proyecto. */
  async validarReferenciaEntidad(tipo, id, proyectoId, ejecutor = this.pool) {
    const numero = Number(id);
    if (!Number.isInteger(numero) || numero <= 0) {
      throw new Error('La referencia a una entidad no es válida.');
    }
    const def = this.def(tipo);
    const [filas] = await ejecutor.query(
      `SELECT 1 FROM ${def.tabla} WHERE id = ? AND proyecto_id = ? LIMIT 1`,
      [numero, proyectoId]
    );
    if (!filas.length) {
      throw new Error('La entidad referenciada no pertenece al proyecto activo.');
    }
    return true;
  }

  async crearEntidad(tipo, proyectoId, datos, ejecutor = this.pool, opciones = {}) {
    await this.listo();
    if (ejecutor === this.pool) {
      let ultimoError = null;
      for (let intento = 0; intento < 2; intento++) {
        try {
          return await this.transaccion((conexion) => this.crearEntidad(tipo, proyectoId, datos, conexion, opciones));
        } catch (err) {
          const duplicado = err && (err.code === 'ER_DUP_ENTRY'
            || /UNIQUE constraint failed/i.test(String(err.message || '')));
          const generado = PREFIJOS_ID[tipo] && !datos.identificador;
          ultimoError = err;
          if (intento === 0 && duplicado && generado) continue;
          throw err;
        }
      }
      throw ultimoError;
    }
    const def = this.def(tipo);
    const valores = this.sanea(def, datos);
    if (tipo === 'lugar'
      && (('latitud' in valores) || ('longitud' in valores))
      && ((valores.latitud == null) !== (valores.longitud == null))) {
      throw new Error('Indica latitud y longitud juntas, o deja ambas vacías.');
    }
    if (tipo === 'persona') {
      if (!valores.nombre && !valores.apellidos) {
        throw new Error('Indica al menos el nombre o los apellidos.');
      }
    } else if (!valores.nombre && !valores.titulo) {
      throw new Error(tipo === 'fuente' ? 'El título es obligatorio.' : 'El nombre es obligatorio.');
    }
    valores.proyecto_id = proyectoId;
    if (valores.institucion_id != null) {
      await this.validarReferenciaEntidad('institucion', valores.institucion_id, proyectoId, ejecutor);
    }
    if (valores.lugar_id != null) {
      await this.validarReferenciaEntidad('lugar', valores.lugar_id, proyectoId, ejecutor);
    }
    const prefijo = PREFIJOS_ID[tipo];
    if (prefijo && !valores.identificador) {
      if (opciones.contador && Number.isFinite(Number(opciones.contador[tipo]))) {
        const siguiente = Number(opciones.contador[tipo]);
        opciones.contador[tipo] = siguiente + 1;
        valores.identificador = `${prefijo}${String(siguiente).padStart(5, '0')}`;
      } else {
        const [maximos] = await ejecutor.query(
          `SELECT MAX(CAST(SUBSTRING(identificador, ${prefijo.length + 1}) AS UNSIGNED)) AS ultimo
           FROM ${def.tabla} WHERE proyecto_id = ? AND identificador LIKE ?`,
          [proyectoId, `${prefijo}%`]
        );
        const siguiente = (Number(maximos[0].ultimo) || 0) + 1;
        valores.identificador = `${prefijo}${String(siguiente).padStart(5, '0')}`;
      }
    } else if (!prefijo) {
      delete valores.identificador;
    }
    if (valores.identificador) {
      const sufijo = String(valores.identificador).slice(prefijo.length);
      const numero = Number(sufijo);
      if (opciones.contador && Number.isFinite(numero) && numero >= Number(opciones.contador[tipo] || 0)) {
        opciones.contador[tipo] = numero + 1;
      }
    }
    const claves = Object.keys(valores);
    const [res] = await ejecutor.query(
      `INSERT INTO ${def.tabla} (${claves.map((c) => `\`${c}\``).join(', ')})
       VALUES (${claves.map(() => '?').join(', ')})`,
      claves.map((c) => valores[c])
    );
    if (!opciones.sinTocarProyecto) await this.tocarProyecto(proyectoId, ejecutor);
    if (opciones.sinReleer) return { ...valores, id: Number(res.insertId) };
    return this.obtenerEntidad(tipo, res.insertId, ejecutor);
  }

  async actualizarEntidad(tipo, id, datos, ejecutor = this.pool) {
    await this.listo();
    const def = this.def(tipo);
    const valores = this.sanea(def, datos);
    const [actuales] = await ejecutor.query(`SELECT * FROM ${def.tabla} WHERE id = ?`, [id]);
    if (!actuales.length) throw new Error('El registro no existe.');
    const actual = actuales[0];
    const proyectoId = actual.proyecto_id;
    if (tipo === 'lugar' && (('latitud' in valores) || ('longitud' in valores))) {
      const latitud = 'latitud' in valores ? valores.latitud : actual.latitud;
      const longitud = 'longitud' in valores ? valores.longitud : actual.longitud;
      if ((latitud == null) !== (longitud == null)) {
        throw new Error('Indica latitud y longitud juntas, o deja ambas vacías.');
      }
    }
    if (valores.institucion_id != null) {
      await this.validarReferenciaEntidad('institucion', valores.institucion_id, proyectoId, ejecutor);
    }
    if (valores.lugar_id != null) {
      await this.validarReferenciaEntidad('lugar', valores.lugar_id, proyectoId, ejecutor);
    }
    if (tipo === 'persona' && ('nombre' in valores || 'apellidos' in valores)) {
      const nombre = 'nombre' in valores ? valores.nombre : actual.nombre;
      const apellidos = 'apellidos' in valores ? valores.apellidos : actual.apellidos;
      if (!String(nombre || '').trim() && !String(apellidos || '').trim()) {
        throw new Error('Indica al menos el nombre o los apellidos.');
      }
    }
    if (tipo !== 'persona') {
      if ('nombre' in valores && !String(valores.nombre || '').trim()) {
        throw new Error('El nombre es obligatorio.');
      }
      if ('titulo' in valores && !String(valores.titulo || '').trim()) {
        throw new Error('El título es obligatorio.');
      }
    }
    const claves = Object.keys(valores);
    if (!claves.length) return this.obtenerEntidad(tipo, id, ejecutor);
    const [res] = await ejecutor.query(
      `UPDATE ${def.tabla} SET ${claves.map((c) => `\`${c}\` = ?`).join(', ')} WHERE id = ?`,
      [...claves.map((c) => valores[c]), id]
    );
    if (!res.affectedRows && !(await this.existeRegistro(def.tabla, id, ejecutor))) {
      throw new Error('El registro no existe o no se pudo actualizar.');
    }
    await this.tocarProyecto(proyectoId, ejecutor);
    return this.obtenerEntidad(tipo, id, ejecutor);
  }

  async eliminarEntidad(tipo, id, ejecutor = this.pool) {
    await this.listo();
    if (ejecutor === this.pool) {
      return this.transaccion((conexion) => this.eliminarEntidad(tipo, id, conexion));
    }
    const def = this.def(tipo);
    const [entidadFilas] = await ejecutor.query(`SELECT * FROM ${def.tabla} WHERE id = ?`, [id]);
    if (!entidadFilas.length) throw new Error('El registro no existe o ya fue eliminado.');
    const entidad = entidadFilas[0];
    const proyectoId = entidad.proyecto_id;
    if (tipo !== 'fuente') {
      await this.limpiarReferenciasBloquesEntidad(tipo, id, proyectoId, ejecutor);
    }
    const nombreCompleto = [entidad.nombre, entidad.apellidos].filter(Boolean).join(' ')
      || entidad.alias || entidad.titulo || '';
    if (tipo === 'lugar') {
      await ejecutor.query(
        'UPDATE personas SET lugar_nacimiento = NULL WHERE proyecto_id = ? AND lugar_nacimiento IN (?, ?)',
        [proyectoId, entidad.nombre, `(actual) ${entidad.nombre}`]
      );
      await ejecutor.query(
        'UPDATE personas SET lugar_defuncion = NULL WHERE proyecto_id = ? AND lugar_defuncion IN (?, ?)',
        [proyectoId, entidad.nombre, `(actual) ${entidad.nombre}`]
      );
      await ejecutor.query(
        'UPDATE fuentes SET lugar = NULL WHERE proyecto_id = ? AND lugar = ?',
        [proyectoId, entidad.nombre]
      );
    }
    if (tipo === 'persona' && nombreCompleto) {
      await ejecutor.query(
        'UPDATE patrimonios SET propietario = NULL WHERE proyecto_id = ? AND propietario = ?',
        [proyectoId, nombreCompleto]
      );
    }
    if (tipo === 'institucion') {
      await ejecutor.query('UPDATE personas SET institucion_id = NULL WHERE institucion_id = ?', [id]);
    }
    if (tipo === 'lugar') {
      await ejecutor.query('UPDATE instituciones SET lugar_id = NULL WHERE lugar_id = ?', [id]);
      await ejecutor.query('UPDATE patrimonios SET lugar_id = NULL WHERE lugar_id = ?', [id]);
      await ejecutor.query('UPDATE relaciones SET lugar_inicio = NULL WHERE lugar_inicio = ?', [id]);
      await ejecutor.query('UPDATE relaciones SET lugar_fin = NULL WHERE lugar_fin = ?', [id]);
    }
    if (tipo === 'fuente') {
      await relacionesAutomaticas.limpiarBloquesDeFuente(this, id, ejecutor);
      await ejecutor.query('DELETE FROM relaciones_fuentes WHERE fuente_id = ?', [id]);
      await ejecutor.query('DELETE FROM cuadernos WHERE fuente_id = ?', [id]);
      await ejecutor.query('DELETE FROM bloques_registro WHERE fuente_id = ?', [id]);
    }
    await ejecutor.query(
      `DELETE FROM relaciones_fuentes WHERE relacion_id IN (
         SELECT id FROM relaciones
         WHERE (origen_tipo = ? AND origen_id = ?) OR (destino_tipo = ? AND destino_id = ?)
       )`,
      [tipo, id, tipo, id]
    );
    await ejecutor.query('DELETE FROM relaciones WHERE (origen_tipo = ? AND origen_id = ?) OR (destino_tipo = ? AND destino_id = ?)', [tipo, id, tipo, id]);
    if (PREFIJOS_ID[tipo]) {
      await ejecutor.query('DELETE FROM coincidencias WHERE (tipo = ? AND entidad_a = ?) OR (tipo = ? AND entidad_b = ?)', [tipo, id, tipo, id]);
    }
    const [res] = await ejecutor.query(`DELETE FROM ${def.tabla} WHERE id = ?`, [id]);
    if (!res.affectedRows) throw new Error('El registro no existe o ya fue eliminado.');
    await this.tocarProyecto(proyectoId, ejecutor);
    return true;
  }

  /* ---------------------------------------------------------------- */
  /* Fusión manual de entidades                                       */
  /* ---------------------------------------------------------------- */

  /** Elimina relaciones exactamente duplicadas tras una fusión, uniendo sus
      fuentes documentales. No toca relaciones con distinta procedencia,
      bloque, regla o firma. */
  async deduplicarRelaciones(ejecutor, proyectoId) {
    const [filas] = await ejecutor.query(
      'SELECT * FROM relaciones WHERE proyecto_id = ? ORDER BY id ASC',
      [proyectoId]
    );
    const vistos = new Map();
    const insertar = this.motor === 'sqlite' ? 'INSERT OR IGNORE' : 'INSERT IGNORE';
    for (const fila of filas) {
      const clave = [
        fila.origen_tipo, fila.origen_id, fila.destino_tipo, fila.destino_id,
        fila.tipo || '', fila.anio_inicio ?? '', fila.fecha_exacta_inicio || '',
        fila.fecha_exacta_inicio_meta || '', fila.lugar_inicio ?? '',
        fila.anio_fin ?? '', fila.fecha_exacta_fin || '', fila.fecha_exacta_fin_meta || '',
        fila.lugar_fin ?? '', fila.notas || '', fila.procedencia || '',
        fila.bloque_id ?? '', fila.regla || '', fila.firma || '',
      ].join('\u0000');
      const anterior = vistos.get(clave);
      if (!anterior) {
        vistos.set(clave, fila);
        continue;
      }
      await ejecutor.query(
        `${insertar} INTO relaciones_fuentes (relacion_id, fuente_id)
         SELECT ?, fuente_id FROM relaciones_fuentes WHERE relacion_id = ?`,
        [anterior.id, fila.id]
      );
      await ejecutor.query('DELETE FROM relaciones WHERE id = ?', [fila.id]);
    }
  }

  /** Actualiza las firmas de exclusión de un bloque tras remapear los ids
      de sus entidades (fusión de fichas). Si la firma nueva ya existiera,
      se elimina la fila antigua para respetar la unicidad. */
  async actualizarFirmasExclusion(conexion, bloqueId, mapaFirmas) {
    if (!mapaFirmas || !mapaFirmas.size) return;
    const [filas] = await conexion.query(
      'SELECT id, regla, firma FROM relaciones_exclusiones WHERE bloque_id = ?',
      [bloqueId]
    );
    for (const fila of filas) {
      const nueva = mapaFirmas.get(fila.firma);
      if (!nueva || nueva === fila.firma) continue;
      const [duplicadas] = await conexion.query(
        `SELECT id FROM relaciones_exclusiones
         WHERE bloque_id = ? AND regla = ? AND firma = ? AND id <> ?
         LIMIT 1`,
        [bloqueId, fila.regla, nueva, fila.id]
      );
      if (duplicadas.length) {
        await conexion.query('DELETE FROM relaciones_exclusiones WHERE id = ?', [fila.id]);
      } else {
        await conexion.query(
          'UPDATE relaciones_exclusiones SET firma = ? WHERE id = ?',
          [nueva, fila.id]
        );
      }
    }
  }

  async fusionarEntidades(tipo, supervivienteId, absorbidaId) {
    await this.listo();
    const generacion = this.generacionConexion;
    const def = this.def(tipo);
    if (!PREFIJOS_ID[tipo]) throw new Error('Este tipo de entidad no admite fusión.');
    const supId = Number(supervivienteId);
    const absId = Number(absorbidaId);
    if (!supId || !absId || supId === absId) {
      throw new Error('Selecciona dos fichas distintas para fusionar.');
    }

    await this.transaccion(async (conexion) => {
      const bloqueo = this.motor === 'sqlite' ? '' : ' FOR UPDATE';
      const [supervivientes] = await conexion.query(`SELECT * FROM ${def.tabla} WHERE id = ?${bloqueo}`, [supId]);
      const [absorbidas] = await conexion.query(`SELECT * FROM ${def.tabla} WHERE id = ?${bloqueo}`, [absId]);
      if (!supervivientes.length || !absorbidas.length) throw new Error('Alguna de las fichas ya no existe.');
      const superviviente = supervivientes[0];
      const absorbida = absorbidas[0];
      if (superviviente.proyecto_id !== absorbida.proyecto_id) {
        throw new Error('Las fichas pertenecen a proyectos distintos.');
      }

      const nombreAbsorbida = [absorbida.nombre, absorbida.apellidos].filter(Boolean).join(' ')
        || absorbida.alias || absorbida.titulo || '';
      const nombreSuperviviente = [superviviente.nombre, superviviente.apellidos].filter(Boolean).join(' ')
        || superviviente.alias || superviviente.titulo || '';
      if (tipo === 'lugar') {
        for (const [campo, valor] of [
          ['lugar_nacimiento', absorbida.nombre],
          ['lugar_nacimiento', `(actual) ${absorbida.nombre}`],
          ['lugar_defuncion', absorbida.nombre],
          ['lugar_defuncion', `(actual) ${absorbida.nombre}`],
        ]) {
          await conexion.query(
            `UPDATE personas SET ${campo} = ? WHERE proyecto_id = ? AND ${campo} = ?`,
            [superviviente.nombre, superviviente.proyecto_id, valor]
          );
        }
        await conexion.query(
          'UPDATE fuentes SET lugar = ? WHERE proyecto_id = ? AND lugar IN (?, ?)',
          [superviviente.nombre, superviviente.proyecto_id, absorbida.nombre, `(actual) ${absorbida.nombre}`]
        );
      }
      if (tipo === 'persona' && nombreAbsorbida) {
        await conexion.query(
          'UPDATE patrimonios SET propietario = ? WHERE proyecto_id = ? AND propietario = ?',
          [nombreSuperviviente, superviviente.proyecto_id, nombreAbsorbida]
        );
      }

      /* Los bloques de registro guardan referencias a entidades dentro de su
         JSON. Si no se actualizan, la siguiente reconciliación volvería a
         generar relaciones hacia la ficha absorbida y estas se perderían. */
      const [bloques] = await conexion.query(
        `SELECT b.id, b.tipo, b.fuente_id, b.datos
         FROM bloque_referencias br
         JOIN bloques_registro b ON b.id = br.bloque_id
         JOIN fuentes f ON f.id = b.fuente_id
         WHERE f.proyecto_id = ? AND br.entidad_tipo = ? AND br.entidad_id = ?`,
        [superviviente.proyecto_id, tipo, absId]
      );
      const bloquesAfectados = [];
      const firmasExclusionPorBloque = new Map();
      for (const bloque of bloques) {
        let datosOriginales;
        try {
          datosOriginales = bloque.datos ? JSON.parse(bloque.datos) : {};
        } catch {
          throw new Error(`El bloque de registro ${bloque.id} tiene datos corruptos; no se puede fusionar.`);
        }
        const datos = JSON.parse(JSON.stringify(datosOriginales));
        if (!remapearReferenciaEnBloque(datos, tipo, absId, supId, bloque.tipo)) continue;
        await conexion.query(
          'UPDATE bloques_registro SET datos = ?, fecha_modificacion = CURRENT_TIMESTAMP WHERE id = ?',
          [JSON.stringify(datos), bloque.id]
        );
        await this.actualizarReferenciasBloque(bloque.id, bloque.tipo, datos, conexion);
        bloquesAfectados.push(bloque.id);
        /* Las firmas de exclusión incluyen los ids de las entidades. Hay que
           traducirlas antes de reconciliar o la relación borrada reaparece. */
        firmasExclusionPorBloque.set(bloque.id, relacionesAutomaticas.mapaFirmasExclusion(
          { id: bloque.id, tipo: bloque.tipo, fuente_id: bloque.fuente_id },
          datosOriginales,
          { id: bloque.id, tipo: bloque.tipo, fuente_id: bloque.fuente_id },
          datos
        ));
      }

      await conexion.query('UPDATE relaciones SET origen_id = ? WHERE origen_tipo = ? AND origen_id = ?', [supId, tipo, absId]);
      await conexion.query('UPDATE relaciones SET destino_id = ? WHERE destino_tipo = ? AND destino_id = ?', [supId, tipo, absId]);

      if (tipo === 'lugar') {
        await conexion.query('UPDATE instituciones SET lugar_id = ? WHERE lugar_id = ?', [supId, absId]);
        await conexion.query('UPDATE patrimonios SET lugar_id = ? WHERE lugar_id = ?', [supId, absId]);
        await conexion.query('UPDATE relaciones SET lugar_inicio = ? WHERE lugar_inicio = ?', [supId, absId]);
        await conexion.query('UPDATE relaciones SET lugar_fin = ? WHERE lugar_fin = ?', [supId, absId]);
      }
      if (tipo === 'institucion') {
        await conexion.query('UPDATE personas SET institucion_id = ? WHERE institucion_id = ?', [supId, absId]);
      }

      /* Unión de datos: se conservan los del superviviente y se rellenan
         únicamente sus campos vacíos con los de la ficha absorbida. */
      const camposCopia = def.campos.filter((c) => !['id', 'proyecto_id', 'identificador'].includes(c));
      const asignaciones = [];
      const valores = [];
      for (const campo of camposCopia) {
        const valorSup = superviviente[campo];
        const valorAbs = absorbida[campo];
        const vacioSup = valorSup === null || valorSup === undefined || valorSup === '';
        if (vacioSup && valorAbs !== null && valorAbs !== undefined && valorAbs !== '') {
          asignaciones.push(`\`${campo}\` = ?`);
          valores.push(valorAbs);
        }
      }
      if (asignaciones.length) {
        valores.push(supId);
        await conexion.query(`UPDATE ${def.tabla} SET ${asignaciones.join(', ')} WHERE id = ?`, valores);
      }

      await conexion.query('UPDATE coincidencias SET entidad_a = ? WHERE tipo = ? AND entidad_a = ?', [supId, tipo, absId]);
      await conexion.query('UPDATE coincidencias SET entidad_b = ? WHERE tipo = ? AND entidad_b = ?', [supId, tipo, absId]);
      await conexion.query(
        'DELETE FROM coincidencias WHERE tipo = ? AND ((entidad_a = ? AND entidad_b = ?) OR (entidad_a = ? AND entidad_b = ?))',
        [tipo, supId, supId, supId, supId]
      );

      /* Reconciliar los bloques ya migrados antes de eliminar la ficha
         absorbida. Así las relaciones automáticas quedan apuntando a la
         superviviente y no se pierden en el siguiente guardado. */
      for (const bloqueId of bloquesAfectados) {
        await this.actualizarFirmasExclusion(
          conexion, bloqueId, firmasExclusionPorBloque.get(bloqueId)
        );
        await relacionesAutomaticas.reconciliarBloque(this, bloqueId, conexion);
      }
      await this.deduplicarRelaciones(conexion, superviviente.proyecto_id);

      await conexion.query(`DELETE FROM ${def.tabla} WHERE id = ?`, [absId]);
      await this.tocarProyecto(superviviente.proyecto_id, conexion);
      return superviviente.proyecto_id;
    });
    if (generacion !== this.generacionConexion) {
      throw new Error('La conexión cambió durante la fusión. Vuelve a intentarlo.');
    }
    return this.obtenerEntidad(tipo, supId);
  }

  /* ---------------------------------------------------------------- */
  /* Posibles coincidencias (datos auxiliares, sin incidencia analítica) */
  /* ---------------------------------------------------------------- */

  async listarCoincidencias(proyectoId) {
    await this.listo();
    const [filas] = await this.pool.query(
      'SELECT * FROM coincidencias WHERE proyecto_id = ? ORDER BY id DESC',
      [proyectoId]
    );
    return filas;
  }

  async crearCoincidencia(datos) {
    await this.listo();
    if (!PREFIJOS_ID[datos.tipo]) throw new Error('Tipo de entidad no válido para coincidencias.');
    if (datos.notas != null && typeof datos.notas !== 'string') {
      throw new Error('Las notas de la coincidencia no son válidas.');
    }
    if (datos.notas && String(datos.notas).length > 65535) {
      throw new Error('Las notas de la coincidencia son demasiado largas (máximo 65535 caracteres).');
    }
    const a = Number(datos.entidad_a);
    const b = Number(datos.entidad_b);
    if (!a || !b || a === b) throw new Error('Selecciona dos fichas distintas.');
    const def = this.def(datos.tipo);
    const [entidades] = await this.pool.query(
      `SELECT id FROM ${def.tabla} WHERE proyecto_id = ? AND id IN (?, ?)`,
      [datos.proyecto_id, a, b]
    );
    if (entidades.length !== 2) throw new Error('Las fichas no pertenecen a este proyecto.');
    const [existente] = await this.pool.query(
      `SELECT id FROM coincidencias
       WHERE proyecto_id = ? AND tipo = ?
         AND ((entidad_a = ? AND entidad_b = ?) OR (entidad_a = ? AND entidad_b = ?))`,
      [datos.proyecto_id, datos.tipo, a, b, b, a]
    );
    if (existente.length) throw new Error('Ya existe una coincidencia registrada entre estas dos fichas.');
    const [res] = await this.pool.query(
      'INSERT INTO coincidencias (proyecto_id, tipo, entidad_a, entidad_b, notas) VALUES (?, ?, ?, ?, ?)',
      [datos.proyecto_id, datos.tipo, a, b, datos.notas || null]
    );
    await this.tocarProyecto(datos.proyecto_id);
    return res.insertId;
  }

  async eliminarCoincidencia(id) {
    await this.listo();
    const [filas] = await this.pool.query('SELECT proyecto_id FROM coincidencias WHERE id = ?', [id]);
    const [res] = await this.pool.query('DELETE FROM coincidencias WHERE id = ?', [id]);
    if (!res.affectedRows) throw new Error('La coincidencia no existe o ya fue eliminada.');
    if (filas.length) await this.tocarProyecto(filas[0].proyecto_id);
    return true;
  }

  /* ---------------------------------------------------------------- */
  /* Relaciones                                                       */
  /* ---------------------------------------------------------------- */

  async listarRelaciones(proyectoId, filtro = null) {
    await this.listo();
    let sql = 'SELECT * FROM relaciones WHERE proyecto_id = ?';
    const parametros = [proyectoId];
    if (filtro) {
      this.validarTipo(filtro.tipo);
      sql += ' AND ((origen_tipo = ? AND origen_id = ?) OR (destino_tipo = ? AND destino_id = ?))';
      parametros.push(filtro.tipo, Number(filtro.id), filtro.tipo, Number(filtro.id));
    }
    sql += ' ORDER BY id DESC';
    const [relaciones] = await this.pool.query(sql, parametros);

    const idsPorTipo = {};
    for (const tipo of TIPOS_GRAFO) idsPorTipo[tipo] = new Set();
    for (const r of relaciones) {
      if (idsPorTipo[r.origen_tipo]) idsPorTipo[r.origen_tipo].add(r.origen_id);
      if (idsPorTipo[r.destino_tipo]) idsPorTipo[r.destino_tipo].add(r.destino_id);
      if (r.lugar_inicio != null) idsPorTipo.lugar.add(r.lugar_inicio);
      if (r.lugar_fin != null) idsPorTipo.lugar.add(r.lugar_fin);
    }

    const nombres = {};
    for (const tipo of TIPOS_GRAFO) {
      const def = this.def(tipo);
      const campoNombre = this.motor === 'sqlite'
        ? (def.campoNombreSQLite || def.campoNombre)
        : def.campoNombre;
      const ids = [...idsPorTipo[tipo]].filter((id) => id != null);
      nombres[tipo] = {};
      for (let i = 0; i < ids.length; i += 500) {
        const trozo = ids.slice(i, i + 500);
        const [filas] = await this.pool.query(
          `SELECT id, ${campoNombre} AS nombre FROM ${def.tabla}
           WHERE proyecto_id = ? AND id IN (${trozo.map(() => '?').join(', ')})`,
          [proyectoId, ...trozo]
        );
        for (const f of filas) nombres[tipo][f.id] = f.nombre;
      }
    }

    let vinculos = [];
    if (relaciones.length) {
      if (filtro) {
        const idsRelacion = relaciones.map((r) => r.id);
        for (let i = 0; i < idsRelacion.length; i += 500) {
          const trozo = idsRelacion.slice(i, i + 500);
          const [filas] = await this.pool.query(
            `SELECT rf.relacion_id, f.id, f.titulo
             FROM relaciones_fuentes rf
             JOIN fuentes f ON f.id = rf.fuente_id
             WHERE rf.relacion_id IN (${trozo.map(() => '?').join(', ')})
             ORDER BY rf.relacion_id, f.titulo`,
            trozo
          );
          vinculos.push(...filas);
        }
      } else {
        [vinculos] = await this.pool.query(
          `SELECT rf.relacion_id, f.id, f.titulo
           FROM relaciones_fuentes rf
           JOIN relaciones r ON r.id = rf.relacion_id
           JOIN fuentes f ON f.id = rf.fuente_id
           WHERE r.proyecto_id = ?
           ORDER BY rf.relacion_id, f.titulo`,
          [proyectoId]
        );
      }
    }
    const fuentesPorRelacion = {};
    for (const v of vinculos) {
      (fuentesPorRelacion[v.relacion_id] ||= []).push({ id: v.id, titulo: v.titulo });
    }
    return relaciones.map((r) => ({
      ...r,
      fuentes: fuentesPorRelacion[r.id] || [],
      origen_nombre: (nombres[r.origen_tipo] || {})[r.origen_id] || `#${r.origen_id}`,
      destino_nombre: (nombres[r.destino_tipo] || {})[r.destino_id] || `#${r.destino_id}`,
      lugar_inicio_nombre: (nombres.lugar || {})[r.lugar_inicio] || null,
      lugar_fin_nombre: (nombres.lugar || {})[r.lugar_fin] || null,
    }));
  }

  async listarRelacionesDeEntidad(proyectoId, tipo, id) {
    return this.listarRelaciones(proyectoId, { tipo, id });
  }

  async obtenerRelacion(id, ejecutor = this.pool) {
    await this.listo();
    const [filas] = await ejecutor.query(
      'SELECT * FROM relaciones WHERE id = ? LIMIT 1',
      [id]
    );
    return filas[0] || null;
  }

  async crearRelacion(datos, ejecutor = this.pool, opciones = {}) {
    await this.listo();
    if (ejecutor === this.pool) {
      return this.transaccion((conexion) => this.crearRelacion(datos, conexion, opciones));
    }
    const obligatorios = ['proyecto_id', 'origen_tipo', 'origen_id', 'destino_tipo', 'destino_id'];
    for (const c of obligatorios) {
      if (datos[c] === undefined || datos[c] === null || datos[c] === '') {
        throw new Error('Faltan datos obligatorios para la relación.');
      }
    }
    this.validarTipo(datos.origen_tipo);
    this.validarTipo(datos.destino_tipo);
    if (datos.origen_tipo === datos.destino_tipo && Number(datos.origen_id) === Number(datos.destino_id)) {
      throw new Error('El origen y el destino no pueden ser la misma entidad.');
    }
    await this.validarExtremos(datos, ejecutor);
    const fuentes = this.normalizarFuentes(datos.fuentes);
    await this.validarFuentes(fuentes, datos.proyecto_id, ejecutor);
    const anioDe = (v) => {
      if (v === null || v === undefined || v === '') return null;
      const n = Number(v);
      return Number.isFinite(n) ? Math.trunc(n) : null;
    };
    const lugarDe = (v) => {
      const n = Number(v);
      return v !== null && v !== undefined && v !== '' && Number.isFinite(n) && n > 0 ? n : null;
    };
    const lugarInicio = lugarDe(datos.lugar_inicio);
    const lugarFin = lugarDe(datos.lugar_fin);
    if (lugarInicio != null) {
      await this.validarReferenciaEntidad('lugar', lugarInicio, datos.proyecto_id, ejecutor);
    }
    if (lugarFin != null) {
      await this.validarReferenciaEntidad('lugar', lugarFin, datos.proyecto_id, ejecutor);
    }
    const tipoRelacion = normalizarTipoRelacion(datos.tipo);
    if (tipoRelacion && String(tipoRelacion).length > 160) {
      throw new Error('El tipo de relación es demasiado largo (máximo 160 caracteres).');
    }
    for (const [campo, valor] of [
      ['fecha_exacta_inicio', datos.fecha_exacta_inicio],
      ['fecha_exacta_fin', datos.fecha_exacta_fin],
    ]) {
      if (valor != null && typeof valor !== 'string') {
        throw new Error(`El campo «${campo}» no es válido.`);
      }
      if (valor && String(valor).length > 255) {
        throw new Error(`El campo «${campo}» es demasiado largo (máximo 255 caracteres).`);
      }
    }
    if (datos.notas && String(datos.notas).length > 65535) {
      throw new Error('Las notas de la relación son demasiado largas (máximo 65535 caracteres).');
    }
    if (datos.notas != null && typeof datos.notas !== 'string') {
      throw new Error('Las notas de la relación no son válidas.');
    }
    const [res] = await ejecutor.query(
      `INSERT INTO relaciones
        (proyecto_id, origen_tipo, origen_id, destino_tipo, destino_id, tipo,
         anio_inicio, fecha_exacta_inicio, fecha_exacta_inicio_meta, lugar_inicio,
         anio_fin, fecha_exacta_fin, fecha_exacta_fin_meta, lugar_fin, notas)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        datos.proyecto_id,
        datos.origen_tipo, Number(datos.origen_id),
        datos.destino_tipo, Number(datos.destino_id),
        tipoRelacion,
        anioDe(datos.anio_inicio),
        datos.fecha_exacta_inicio || null,
        datos.fecha_exacta_inicio_meta || null,
        lugarInicio,
        anioDe(datos.anio_fin),
        datos.fecha_exacta_fin || null,
        datos.fecha_exacta_fin_meta || null,
        lugarFin,
        datos.notas || null,
      ]
    );
    if (fuentes.length) {
      const valores = fuentes.map(() => '(?, ?)').join(', ');
      const parametros = fuentes.flatMap((id) => [res.insertId, id]);
      await ejecutor.query(
        `INSERT INTO relaciones_fuentes (relacion_id, fuente_id) VALUES ${valores}`,
        parametros
      );
    }
    if (!opciones.sinTocarProyecto) {
      await this.tocarProyecto(datos.proyecto_id, ejecutor);
    }
    return res.insertId;
  }

  async validarExtremos(datos, ejecutor) {
    for (const lado of ['origen', 'destino']) {
      const tipo = datos[`${lado}_tipo`];
      const id = Number(datos[`${lado}_id`]);
      const def = this.def(tipo);
      const [filas] = await ejecutor.query(
        `SELECT proyecto_id FROM ${def.tabla} WHERE id = ? LIMIT 1`,
        [id]
      );
      if (!filas.length || Number(filas[0].proyecto_id) !== Number(datos.proyecto_id)) {
        throw new Error(`La entidad ${lado} de la relación no existe en este proyecto.`);
      }
    }
  }

  async validarFuentes(fuentes, proyectoId, ejecutor) {
    if (!fuentes.length) return;
    let encontradas = 0;
    for (let i = 0; i < fuentes.length; i += 500) {
      const trozo = fuentes.slice(i, i + 500);
      const [filas] = await ejecutor.query(
        `SELECT id FROM fuentes WHERE proyecto_id = ? AND id IN (${trozo.map(() => '?').join(', ')})`,
        [proyectoId, ...trozo]
      );
      encontradas += filas.length;
    }
    if (encontradas !== fuentes.length) {
      throw new Error('Alguna de las fuentes seleccionadas no pertenece a este proyecto.');
    }
  }

  normalizarFuentes(fuentes) {
    if (!Array.isArray(fuentes)) return [];
    return [...new Set(
      fuentes
        .map((id) => Number(id))
        .filter((id) => Number.isFinite(id) && id > 0)
    )];
  }

  async eliminarRelacion(id, ejecutor = this.pool) {
    await this.listo();
    if (ejecutor === this.pool) {
      return this.transaccion((conexion) => this.eliminarRelacion(id, conexion));
    }
    const [filas] = await ejecutor.query('SELECT * FROM relaciones WHERE id = ?', [id]);
    if (!filas.length) throw new Error('La relación no existe o ya fue eliminada.');
    await relacionesAutomaticas.registrarExclusionPorBorrado(this, filas[0], ejecutor);
    const [res] = await ejecutor.query('DELETE FROM relaciones WHERE id = ?', [id]);
    if (!res.affectedRows) throw new Error('La relación no existe o ya fue eliminada.');
    await this.tocarProyecto(filas[0].proyecto_id, ejecutor);
    return true;
  }

  async actualizarRelacion(id, datos, ejecutor = this.pool) {
    await this.listo();
    if (ejecutor === this.pool) {
      return this.transaccion((conexion) => this.actualizarRelacion(id, datos, conexion));
    }
    const [existente] = await ejecutor.query('SELECT * FROM relaciones WHERE id = ?', [id]);
    if (!existente.length) throw new Error('La relación no existe.');
    const actual = existente[0];
    const proyectoId = actual.proyecto_id;
    const origenTipo = datos.origen_tipo ?? actual.origen_tipo;
    const destinoTipo = datos.destino_tipo ?? actual.destino_tipo;
    const origenId = datos.origen_id != null ? Number(datos.origen_id) : Number(actual.origen_id);
    const destinoId = datos.destino_id != null ? Number(datos.destino_id) : Number(actual.destino_id);
    const cambioExtremos = datos.origen_tipo != null || datos.origen_id != null
      || datos.destino_tipo != null || datos.destino_id != null;
    if (cambioExtremos) {
      this.validarTipo(origenTipo);
      this.validarTipo(destinoTipo);
      if (!Number.isInteger(origenId) || origenId <= 0
        || !Number.isInteger(destinoId) || destinoId <= 0) {
        throw new Error('Los extremos de la relación no son válidos.');
      }
      if (origenTipo === destinoTipo && origenId === destinoId) {
        throw new Error('El origen y el destino no pueden ser la misma entidad.');
      }
      await this.validarExtremos({
        proyecto_id: proyectoId,
        origen_tipo: origenTipo,
        origen_id: origenId,
        destino_tipo: destinoTipo,
        destino_id: destinoId,
      }, ejecutor);
    }
    const anioDe = (v) => {
      if (v === null || v === undefined || v === '') return null;
      const n = Number(v);
      return Number.isFinite(n) ? Math.trunc(n) : null;
    };
    const lugarDe = (v) => {
      const n = Number(v);
      return v !== null && v !== undefined && v !== '' && Number.isFinite(n) && n > 0 ? n : null;
    };
    const lugarInicio = 'lugar_inicio' in datos ? lugarDe(datos.lugar_inicio) : actual.lugar_inicio;
    const lugarFin = 'lugar_fin' in datos ? lugarDe(datos.lugar_fin) : actual.lugar_fin;
    if (lugarInicio != null) {
      await this.validarReferenciaEntidad('lugar', lugarInicio, proyectoId, ejecutor);
    }
    if (lugarFin != null) {
      await this.validarReferenciaEntidad('lugar', lugarFin, proyectoId, ejecutor);
    }
    const tipo = normalizarTipoRelacion(datos.tipo);
    if (!tipo) throw new Error('El tipo de relación es obligatorio.');
    if (String(tipo).length > 160) throw new Error('El tipo de relación es demasiado largo (máximo 160 caracteres).');
    for (const [campo, valor] of [
      ['fecha_exacta_inicio', datos.fecha_exacta_inicio],
      ['fecha_exacta_fin', datos.fecha_exacta_fin],
    ]) {
      if (valor != null && typeof valor !== 'string') {
        throw new Error(`El campo «${campo}» no es válido.`);
      }
      if (valor && String(valor).length > 255) {
        throw new Error(`El campo «${campo}» es demasiado largo (máximo 255 caracteres).`);
      }
    }
    if (datos.notas && String(datos.notas).length > 65535) {
      throw new Error('Las notas de la relación son demasiado largas (máximo 65535 caracteres).');
    }
    if (datos.notas != null && typeof datos.notas !== 'string') {
      throw new Error('Las notas de la relación no son válidas.');
    }
    const fuentes = Array.isArray(datos.fuentes) ? this.normalizarFuentes(datos.fuentes) : null;
    if (fuentes) await this.validarFuentes(fuentes, proyectoId, ejecutor);
    await ejecutor.query(
      `UPDATE relaciones SET
         origen_tipo = ?, origen_id = ?, destino_tipo = ?, destino_id = ?,
         tipo = ?, anio_inicio = ?, fecha_exacta_inicio = ?, fecha_exacta_inicio_meta = ?, lugar_inicio = ?,
         anio_fin = ?, fecha_exacta_fin = ?, fecha_exacta_fin_meta = ?, lugar_fin = ?, notas = ?
       WHERE id = ?`,
      [
        origenTipo,
        origenId,
        destinoTipo,
        destinoId,
        tipo,
        anioDe(datos.anio_inicio),
        datos.fecha_exacta_inicio || null,
        datos.fecha_exacta_inicio_meta || null,
        lugarInicio,
        anioDe(datos.anio_fin),
        datos.fecha_exacta_fin || null,
        datos.fecha_exacta_fin_meta || null,
        lugarFin,
        datos.notas || null,
        id,
      ]
    );
    if (fuentes) {
      await ejecutor.query('DELETE FROM relaciones_fuentes WHERE relacion_id = ?', [id]);
      if (fuentes.length) {
        const valores = fuentes.map(() => '(?, ?)').join(', ');
        const parametros = fuentes.flatMap((fuenteId) => [id, fuenteId]);
        await ejecutor.query(
          `INSERT INTO relaciones_fuentes (relacion_id, fuente_id) VALUES ${valores}`,
          parametros
        );
      }
    }
    await ejecutor.query(
      "UPDATE relaciones SET procedencia = CASE WHEN procedencia = 'AUTOMATIZADA' THEN 'EDITADA' ELSE procedencia END WHERE id = ?",
      [id]
    );
    await this.tocarProyecto(proyectoId, ejecutor);
    return true;
  }

  /* ---------------------------------------------------------------- */
  /* Exportación e importación (.json portátil)                       */
  /* ---------------------------------------------------------------- */

  async exportarProyecto(id) {
    await this.listo();
    const proyecto = await this.obtenerProyecto(id);
    const registros = {};
    for (const tipo of ['lugar', 'persona', 'institucion', 'patrimonio', 'fuente']) {
      registros[tipo] = await this.listarEntidades(tipo, id);
    }
    const relaciones = await this.listarRelaciones(id);
    const [coincidencias] = await this.pool.query(
      'SELECT * FROM coincidencias WHERE proyecto_id = ? ORDER BY id ASC',
      [id]
    );
    const [cuadernos] = await this.pool.query(
      `SELECT c.* FROM cuadernos c
       JOIN fuentes f ON f.id = c.fuente_id
       WHERE f.proyecto_id = ?
       ORDER BY c.id ASC`,
      [id]
    );
    const [bloques] = await this.pool.query(
      `SELECT b.* FROM bloques_registro b
       JOIN fuentes f ON f.id = b.fuente_id
       WHERE f.proyecto_id = ?
       ORDER BY b.id ASC`,
      [id]
    );
    const [exclusiones] = await this.pool.query(
      'SELECT * FROM relaciones_exclusiones WHERE proyecto_id = ? ORDER BY id ASC',
      [id]
    );
    const bloquesRegistro = bloques.map((b) => {
      let datos = {};
      let datosInvalidos = false;
      try {
        datos = b.datos ? JSON.parse(b.datos) : {};
      } catch {
        datos = {};
        datosInvalidos = true;
      }
      if (!datosInvalidos && (!datos || typeof datos !== 'object' || Array.isArray(datos))) {
        datosInvalidos = true;
      }
      return {
        ...b,
        datos,
        datosInvalidos,
        datosCrudo: datosInvalidos ? b.datos : undefined,
      };
    });
    return {
      formato: 'h-imago-proyecto',
      version: 2,
      exportado: new Date().toISOString(),
      proyecto: {
        nombre: proyecto.nombre,
        descripcion: proyecto.descripcion,
        creador: proyecto.creador,
        uuid: proyecto.uuid || null,
      },
      registros,
      relaciones: relaciones.map((relacion) => {
        const copia = { ...relacion };
        for (const campo of ['origen_nombre', 'destino_nombre', 'lugar_inicio_nombre', 'lugar_fin_nombre']) {
          delete copia[campo];
        }
        return copia;
      }),
      coincidencias,
      cuadernos,
      bloques_registro: bloquesRegistro,
      exclusiones,
    };
  }

  async importarProyecto(obj) {
    await this.listo();
    const generacion = this.generacionConexion;
    if (!obj || obj.formato !== 'h-imago-proyecto' || !obj.proyecto || !obj.registros) {
      throw new Error('El archivo no es un proyecto H-IMAGO válido.');
    }
    if (obj.version != null && ![1, 2].includes(Number(obj.version))) {
      throw new Error(`Versión de proyecto no soportada: ${obj.version}.`);
    }
    if (typeof obj.registros !== 'object' || Array.isArray(obj.registros)) {
      throw new Error('El archivo no contiene un bloque de registros válido.');
    }
    for (const tipo of TIPOS_ENTIDAD) {
      if (obj.registros[tipo] != null && !Array.isArray(obj.registros[tipo])) {
        throw new Error(`El archivo contiene registros inválidos de tipo ${tipo}.`);
      }
    }

    const nombreBase = String(obj.proyecto.nombre || 'Proyecto importado').trim();
    const existentes = await this.listarProyectos();
    const nombre = existentes.some((p) => p.nombre === nombreBase) ? `${nombreBase} (importado)` : nombreBase;

    const pid = await this.transaccion(async (ejecutor) => {
    const proyecto = await this.crearProyecto({
      nombre,
      descripcion: obj.proyecto.descripcion || '',
      creador: obj.proyecto.creador || '',
    }, ejecutor);
    const pid = proyecto.id;

    const mapa = {};
    const orden = ['lugar', 'institucion', 'persona', 'patrimonio', 'fuente'];
    const contadores = {};
    for (const tipo of orden) {
      const prefijo = PREFIJOS_ID[tipo];
      if (!prefijo) continue;
      let ultimo = 0;
      for (const fila of obj.registros[tipo] || []) {
        const identificador = String(fila.identificador || '');
        if (!identificador.startsWith(prefijo)) continue;
        const numero = Number(identificador.slice(prefijo.length));
        if (Number.isInteger(numero) && numero > ultimo) ultimo = numero;
      }
      contadores[tipo] = ultimo + 1;
    }
    for (const tipo of orden) {
      mapa[tipo] = {};
      for (const fila of obj.registros[tipo] || []) {
        const datos = { ...fila };
        delete datos.id;
        delete datos.proyecto_id;
        if ('lugar_id' in datos) {
          datos.lugar_id = datos.lugar_id != null ? (mapa.lugar[datos.lugar_id] ?? null) : null;
        }
        if (tipo === 'persona' && 'institucion_id' in datos) {
          datos.institucion_id = datos.institucion_id != null
            ? (mapa.institucion[datos.institucion_id] ?? null) : null;
        }
        const nueva = await this.crearEntidad(tipo, pid, datos, ejecutor, {
          contador: contadores,
          sinReleer: true,
          sinTocarProyecto: true,
        });
        mapa[tipo][fila.id] = nueva.id;
      }
    }

    const mapaBloque = {};
    const firmasExclusion = {};
    for (const c of obj.cuadernos || []) {
      const fuenteNueva = mapa.fuente[c.fuente_id];
      if (!fuenteNueva) continue;
      const nuevo = await this.crearCuaderno(fuenteNueva, ejecutor);
      await this.actualizarCuaderno(nuevo.id, {
        contenido: c.contenido || '',
        fojas: this.leerFojas(c.fojas),
      }, ejecutor);
      if (c.posicion != null) {
        await ejecutor.query('UPDATE cuadernos SET posicion = ? WHERE id = ?', [Number(c.posicion) || 0, nuevo.id]);
      }
    }

    for (const b of obj.bloques_registro || []) {
      const fuenteNueva = mapa.fuente[b.fuente_id];
      if (!fuenteNueva) continue;
      const nuevo = await this.crearBloqueRegistro(fuenteNueva, {
        periodo: b.periodo,
        region: b.region,
        tipo: b.tipo,
        categoria: b.categoria,
      }, ejecutor);
      if (b.datosInvalidos) {
        await ejecutor.query(
          'UPDATE bloques_registro SET datos = ? WHERE id = ?',
          [String(b.datosCrudo || '{}'), nuevo.id]
        );
        mapaBloque[b.id] = nuevo.id;
        continue;
      }
      const datos = remapearDatosBloque(b.datos || {}, b.tipo, mapa);
      if (!datos || typeof datos !== 'object' || Array.isArray(datos)) {
        await ejecutor.query(
          'UPDATE bloques_registro SET datos = ? WHERE id = ?',
          [typeof b.datos === 'string' ? b.datos : JSON.stringify(b.datos || {}), nuevo.id]
        );
        mapaBloque[b.id] = nuevo.id;
        continue;
      }
      const serializadoDatos = JSON.stringify(datos);
      if (serializadoDatos.length > LIMITE_DATOS_BLOQUE) {
        throw new Error(`El bloque ${b.id} es demasiado grande para importarlo.`);
      }
      await ejecutor.query(
        'UPDATE bloques_registro SET datos = ? WHERE id = ?',
        [serializadoDatos, nuevo.id]
      );
      await this.actualizarReferenciasBloque(nuevo.id, b.tipo, datos, ejecutor);
      mapaBloque[b.id] = nuevo.id;

      /* Las firmas de exclusión incluyen los identificadores de las
         entidades. Al importar cambian, así que traducimos cada firma
         antigua a la que tendrá la relación equivalente en el proyecto
         nuevo. */
      try {
        const datosViejos = typeof b.datos === 'string'
          ? JSON.parse(b.datos || '{}') : (b.datos || {});
        const mapa = relacionesAutomaticas.mapaFirmasExclusion(
          { ...b, fuente_id: b.fuente_id },
          datosViejos,
          { ...nuevo, fuente_id: fuenteNueva },
          datos
        );
        for (const [firmaVieja, firmaNueva] of mapa) {
          firmasExclusion[`${b.id}|${firmaVieja}`] = firmaNueva;
        }
      } catch (err) {
        console.warn(`[importar] No se pudieron traducir las firmas de exclusión del bloque ${b.id}:`, err.message);
      }
    }

    for (const r of obj.relaciones || []) {
      const origenId = (mapa[r.origen_tipo] || {})[r.origen_id];
      const destinoId = (mapa[r.destino_tipo] || {})[r.destino_id];
      if (!origenId || !destinoId) continue;
      const nuevoId = await this.crearRelacion({
        proyecto_id: pid,
        origen_tipo: r.origen_tipo,
        origen_id: origenId,
        destino_tipo: r.destino_tipo,
        destino_id: destinoId,
        tipo: normalizarTipoRelacion(r.tipo),
        anio_inicio: r.anio_inicio,
        fecha_exacta_inicio: r.fecha_exacta_inicio,
        fecha_exacta_inicio_meta: r.fecha_exacta_inicio_meta,
        lugar_inicio: r.lugar_inicio != null ? (mapa.lugar[r.lugar_inicio] ?? null) : null,
        anio_fin: r.anio_fin,
        fecha_exacta_fin: r.fecha_exacta_fin,
        fecha_exacta_fin_meta: r.fecha_exacta_fin_meta,
        lugar_fin: r.lugar_fin != null ? (mapa.lugar[r.lugar_fin] ?? null) : null,
        notas: r.notas,
        fuentes: (r.fuentes || [])
          .map((f) => mapa.fuente[typeof f === 'object' ? f.id : f])
          .filter(Boolean),
      }, ejecutor, { sinTocarProyecto: true });
      const procedencia = ['AUTOMATIZADA', 'EDITADA'].includes(r.procedencia)
        ? r.procedencia : 'MANUAL';
      const bloqueNuevo = r.bloque_id != null && mapaBloque[r.bloque_id] != null
        ? mapaBloque[r.bloque_id] : null;
      if (procedencia !== 'MANUAL' || bloqueNuevo != null || r.regla || r.firma) {
        await ejecutor.query(
          `UPDATE relaciones
           SET procedencia = ?, bloque_id = ?, regla = ?, firma = ?
           WHERE id = ?`,
          [procedencia, bloqueNuevo, r.regla || null, r.firma || null, nuevoId]
        );
      }
    }

    for (const e of obj.exclusiones || []) {
      const bloqueNuevo = e.bloque_id != null ? mapaBloque[e.bloque_id] : null;
      if (!bloqueNuevo) continue;
      const firmaNueva = e.firma
        ? (firmasExclusion[`${e.bloque_id}|${e.firma}`] ?? '')
        : '';
      const insertar = this.motor === 'sqlite' ? 'INSERT OR IGNORE' : 'INSERT IGNORE';
      await ejecutor.query(
        `${insertar} INTO relaciones_exclusiones
          (proyecto_id, bloque_id, regla, firma)
         VALUES (?, ?, ?, ?)`,
        [pid, bloqueNuevo, e.regla, firmaNueva]
      );
    }

    /* Los bloques se reconcilian al final: así las relaciones manuales,
       editadas y las exclusiones ya están en su sitio y no se duplican. */
    for (const bloqueNuevo of Object.values(mapaBloque)) {
      await relacionesAutomaticas.reconciliarBloque(this, bloqueNuevo, ejecutor);
    }

    for (const c of obj.coincidencias || []) {
      const a = (mapa[c.tipo] || {})[c.entidad_a];
      const b = (mapa[c.tipo] || {})[c.entidad_b];
      if (!a || !b) continue;
      await ejecutor.query(
        'INSERT INTO coincidencias (proyecto_id, tipo, entidad_a, entidad_b, notas) VALUES (?, ?, ?, ?, ?)',
        [pid, c.tipo, a, b, c.notas || null]
      );
    }

    await this.tocarProyecto(pid, ejecutor);
    return pid;
    });
    if (generacion !== this.generacionConexion) {
      throw new Error('La conexión cambió durante la importación. Vuelve a intentarlo.');
    }
    return this.obtenerProyecto(pid);
  }

  /* ---------------------------------------------------------------- */
  /* Cuadernos de transcripción (pertenecen a una fuente)             */
  /* ---------------------------------------------------------------- */

  leerFojas(valor) {
    try {
      const lista = JSON.parse(valor || '[]');
      if (!Array.isArray(lista)) return [];
      return [...new Set(lista.map(Number).filter((n) => Number.isInteger(n) && n > 1))].sort((a, b) => a - b);
    } catch {
      return [];
    }
  }

  async listarCuadernos(fuenteId) {
    await this.listo();
    const [filas] = await this.pool.query(
      'SELECT * FROM cuadernos WHERE fuente_id = ? ORDER BY posicion ASC, id ASC',
      [fuenteId]
    );
    return filas.map((fila) => ({ ...fila, fojas: this.leerFojas(fila.fojas) }));
  }

  async crearCuaderno(fuenteId, ejecutor = this.pool) {
    await this.listo();
    if (ejecutor === this.pool) {
      return this.transaccion((conexion) => this.crearCuaderno(fuenteId, conexion));
    }
    const [maximos] = await ejecutor.query(
      'SELECT COALESCE(MAX(posicion), 0) AS ultima FROM cuadernos WHERE fuente_id = ?',
      [fuenteId]
    );
    const [res] = await ejecutor.query(
      'INSERT INTO cuadernos (fuente_id, posicion, contenido, fojas) VALUES (?, ?, ?, ?)',
      [fuenteId, Number(maximos[0].ultima) + 1, '', '[]']
    );
    const [filas] = await ejecutor.query('SELECT * FROM cuadernos WHERE id = ?', [res.insertId]);
    const proyectoId = await this.proyectoDeFuente(fuenteId, ejecutor);
    await this.tocarProyecto(proyectoId, ejecutor);
    return { ...filas[0], fojas: this.leerFojas(filas[0].fojas) };
  }

  async actualizarCuaderno(id, { contenido, fojas }, ejecutor = this.pool) {
    await this.listo();
    if (contenido != null && typeof contenido !== 'string') {
      throw new Error('El contenido del cuaderno no es válido.');
    }
    const texto = String(contenido ?? '');
    if (texto.length > LIMITE_CONTENIDO_CUADERNO) {
      throw new Error(
        `La transcripción es demasiado grande (máximo ${Math.round(LIMITE_CONTENIDO_CUADERNO / 1024 / 1024)} MB).`
      );
    }
    const normalizadas = this.leerFojas(JSON.stringify(Array.isArray(fojas) ? fojas : []));
    const [res] = await ejecutor.query(
      'UPDATE cuadernos SET contenido = ?, fojas = ?, fecha_modificacion = CURRENT_TIMESTAMP WHERE id = ?',
      [texto, JSON.stringify(normalizadas), id]
    );
    if (!res.affectedRows && !(await this.existeRegistro('cuadernos', id, ejecutor))) {
      throw new Error('El cuaderno no existe o no se pudo actualizar.');
    }
    const [fuente] = await ejecutor.query('SELECT fuente_id FROM cuadernos WHERE id = ?', [id]);
    if (fuente.length) {
      await this.tocarProyecto(await this.proyectoDeFuente(fuente[0].fuente_id, ejecutor), ejecutor);
    }
    return true;
  }

  async eliminarCuaderno(id, ejecutor = this.pool) {
    await this.listo();
    const [filas] = await ejecutor.query(
      `SELECT f.proyecto_id
       FROM cuadernos c JOIN fuentes f ON f.id = c.fuente_id
       WHERE c.id = ?`,
      [id]
    );
    const [res] = await ejecutor.query('DELETE FROM cuadernos WHERE id = ?', [id]);
    if (!res.affectedRows) throw new Error('El cuaderno no existe o ya fue eliminado.');
    if (filas.length) await this.tocarProyecto(filas[0].proyecto_id, ejecutor);
    return true;
  }

  /* ---------------------------------------------------------------- */
  /* Bloques de registro (pertenecen a una fuente)                    */
  /* ---------------------------------------------------------------- */

  async listarBloquesRegistro(fuenteId) {
    await this.listo();
    const [filas] = await this.pool.query(
      'SELECT * FROM bloques_registro WHERE fuente_id = ? ORDER BY id ASC',
      [fuenteId]
    );
    return filas.map((fila) => {
      let datos = {};
      let datosInvalidos = false;
      try {
        datos = fila.datos ? JSON.parse(fila.datos) : {};
      } catch {
        datos = {};
        datosInvalidos = true;
      }
      if (!datosInvalidos && (!datos || typeof datos !== 'object' || Array.isArray(datos))) {
        datosInvalidos = true;
      }
      return { ...fila, datos, datosInvalidos };
    });
  }

  async crearBloqueRegistro(fuenteId, { periodo, region, tipo, categoria }, ejecutor = this.pool) {
    await this.listo();
    if (!tipo) throw new Error('El tipo de bloque es obligatorio.');
    if (String(tipo).length > 160) throw new Error('El tipo de bloque es demasiado largo (máximo 160 caracteres).');
    if (categoria && String(categoria).length > 120) throw new Error('La categoría del bloque es demasiado larga (máximo 120 caracteres).');
    if (periodo && String(periodo).length > 40) throw new Error('El periodo del bloque es demasiado largo.');
    if (region && String(region).length > 60) throw new Error('La región del bloque es demasiado larga.');
    const [res] = await ejecutor.query(
      'INSERT INTO bloques_registro (fuente_id, periodo, region, tipo, categoria, datos) VALUES (?, ?, ?, ?, ?, ?)',
      [fuenteId, periodo || 'siglos-xviii-xix', region || 'hispanoamerica', tipo, categoria || null, '{}']
    );
    const [filas] = await ejecutor.query('SELECT * FROM bloques_registro WHERE id = ?', [res.insertId]);
    await this.tocarProyecto(await this.proyectoDeFuente(fuenteId, ejecutor), ejecutor);
    return { ...filas[0], datos: {} };
  }

  async actualizarBloqueRegistro(id, datos, ejecutor = this.pool) {
    await this.listo();
    if (ejecutor === this.pool) {
      return this.transaccion((conexion) => this.actualizarBloqueRegistro(id, datos, conexion));
    }
    if (!datos || typeof datos !== 'object' || Array.isArray(datos)) {
      throw new Error('El bloque de registro no contiene datos válidos.');
    }
    const serializado = JSON.stringify(datos);
    if (serializado.length > LIMITE_DATOS_BLOQUE) {
      throw new Error(
        `El bloque de registro es demasiado grande (máximo ${Math.round(LIMITE_DATOS_BLOQUE / 1024 / 1024)} MB).`
      );
    }
    const [res] = await ejecutor.query(
      'UPDATE bloques_registro SET datos = ?, fecha_modificacion = CURRENT_TIMESTAMP WHERE id = ?',
      [serializado, id]
    );
    if (!res.affectedRows && !(await this.existeRegistro('bloques_registro', id, ejecutor))) {
      throw new Error('El bloque de registro no existe.');
    }
    const [metaBloque] = await ejecutor.query('SELECT tipo FROM bloques_registro WHERE id = ?', [id]);
    await this.actualizarReferenciasBloque(id, metaBloque[0]?.tipo, datos, ejecutor);
    await relacionesAutomaticas.reconciliarBloque(this, id, ejecutor);
    const [proyecto] = await ejecutor.query(
      `SELECT f.proyecto_id
       FROM bloques_registro b JOIN fuentes f ON f.id = b.fuente_id
       WHERE b.id = ?`,
      [id]
    );
    if (proyecto.length) await this.tocarProyecto(proyecto[0].proyecto_id, ejecutor);
    return true;
  }

  async eliminarBloqueRegistro(id, ejecutor = this.pool) {
    await this.listo();
    if (ejecutor === this.pool) {
      return this.transaccion((conexion) => this.eliminarBloqueRegistro(id, conexion));
    }
    const [proyecto] = await ejecutor.query(
      `SELECT f.proyecto_id
       FROM bloques_registro b JOIN fuentes f ON f.id = b.fuente_id
       WHERE b.id = ?`,
      [id]
    );
    await relacionesAutomaticas.limpiarBloque(this, id, ejecutor);
    await ejecutor.query(
      "UPDATE relaciones SET bloque_id = NULL WHERE bloque_id = ? AND procedencia = 'EDITADA'",
      [id]
    );
    await ejecutor.query('DELETE FROM bloque_referencias WHERE bloque_id = ?', [id]);
    const [res] = await ejecutor.query('DELETE FROM bloques_registro WHERE id = ?', [id]);
    if (!res.affectedRows) throw new Error('El bloque de registro no existe o ya fue eliminado.');
    if (proyecto.length) await this.tocarProyecto(proyecto[0].proyecto_id, ejecutor);
    return true;
  }

  /* ---------------------------------------------------------------- */
  /* Descarga e importación de un bloque concreto                     */
  /* ---------------------------------------------------------------- */

  async exportarBloqueRegistro(id) {
    await this.listo();
    const [filas] = await this.pool.query(
      `SELECT b.*, f.proyecto_id, p.nombre AS proyecto_nombre, p.uuid AS proyecto_uuid
       FROM bloques_registro b
       JOIN fuentes f ON f.id = b.fuente_id
       JOIN proyectos p ON p.id = f.proyecto_id
       WHERE b.id = ?`,
      [id]
    );
    if (!filas.length) throw new Error('El bloque de registro no existe.');
    const bloque = filas[0];
    let datos = {};
    let datosInvalidos = false;
    try {
      datos = bloque.datos ? JSON.parse(bloque.datos) : {};
    } catch {
      datos = {};
      datosInvalidos = true;
    }
    if (!datosInvalidos && (!datos || typeof datos !== 'object' || Array.isArray(datos))) {
      datosInvalidos = true;
    }
    const [exclusiones] = await this.pool.query(
      'SELECT regla, firma FROM relaciones_exclusiones WHERE bloque_id = ? ORDER BY id ASC',
      [id]
    );

    const ids = {
      persona: new Set(), institucion: new Set(), lugar: new Set(), patrimonio: new Set(),
    };
    recolectarReferenciasBloque(datos, bloque.tipo, ids);
    const tablas = {
      persona: 'personas', institucion: 'instituciones', lugar: 'lugares', patrimonio: 'patrimonios',
    };
    const claves = {
      persona: 'personas', institucion: 'instituciones', lugar: 'lugares', patrimonio: 'patrimonios',
    };
    const entidades = { personas: [], instituciones: [], lugares: [], patrimonios: [] };
    const incluidos = {
      persona: new Set(), institucion: new Set(), lugar: new Set(), patrimonio: new Set(),
    };

    let cambio = true;
    while (cambio) {
      cambio = false;
      for (const tipo of ['lugar', 'institucion', 'persona', 'patrimonio']) {
        const faltan = [...ids[tipo]].filter((x) => !incluidos[tipo].has(x));
        if (!faltan.length) continue;
        for (let inicio = 0; inicio < faltan.length; inicio += 500) {
          const trozo = faltan.slice(inicio, inicio + 500);
          const marcadores = trozo.map(() => '?').join(', ');
          const [encontradas] = await this.pool.query(
            `SELECT * FROM ${tablas[tipo]} WHERE proyecto_id = ? AND id IN (${marcadores})`,
            [bloque.proyecto_id, ...trozo]
          );
          for (const fila of encontradas) {
            incluidos[tipo].add(String(fila.id));
            entidades[claves[tipo]].push(fila);
            cambio = true;
            if (tipo === 'persona' && fila.institucion_id) {
              ids.institucion.add(String(fila.institucion_id));
            }
            if ((tipo === 'institucion' || tipo === 'patrimonio') && fila.lugar_id) {
              ids.lugar.add(String(fila.lugar_id));
            }
          }
        }
      }
    }

    return {
      formato: 'h-imago-bloque-registro',
      version: 1,
      exportado: new Date().toISOString(),
      tipo: bloque.tipo,
      fuente_id: bloque.fuente_id,
      periodo: bloque.periodo,
      region: bloque.region,
      categoria: bloque.categoria,
      proyecto: {
        id: bloque.proyecto_id,
        nombre: bloque.proyecto_nombre,
        uuid: bloque.proyecto_uuid || null,
      },
      datos,
      datosInvalidos,
      datosCrudo: datosInvalidos ? bloque.datos : undefined,
      entidades,
      exclusiones,
    };
  }

  async importarBloqueRegistro(id, obj, ejecutor = this.pool) {
    await this.listo();
    if (ejecutor === this.pool) {
      return this.transaccion((conexion) => this.importarBloqueRegistro(id, obj, conexion));
    }
    if (!obj || obj.formato !== 'h-imago-bloque-registro') {
      throw new Error('El archivo no es un bloque de registro de H-IMAGO.');
    }
    if (!obj.tipo || typeof obj.tipo !== 'string') {
      throw new Error('El archivo no indica el tipo de bloque.');
    }
    if (obj.datosInvalidos) {
      throw new Error('El bloque de origen tiene datos dañados; no se puede importar hasta repararlo.');
    }
    if (!obj.datos || typeof obj.datos !== 'object' || Array.isArray(obj.datos)) {
      throw new Error('El archivo no contiene datos de bloque válidos.');
    }
    if (JSON.stringify(obj.datos).length > LIMITE_DATOS_BLOQUE) {
      throw new Error('El bloque del archivo es demasiado grande.');
    }
    const [filas] = await ejecutor.query(
      `SELECT b.*, f.proyecto_id, p.nombre AS proyecto_nombre, p.uuid AS proyecto_uuid
       FROM bloques_registro b
       JOIN fuentes f ON f.id = b.fuente_id
       JOIN proyectos p ON p.id = f.proyecto_id
       WHERE b.id = ?`,
      [id]
    );
    if (!filas.length) throw new Error('El bloque de destino no existe.');
    const destino = filas[0];
    if (obj.tipo !== destino.tipo) {
      throw new Error(`El archivo es un bloque «${obj.tipo}» y la tarjeta de destino es «${destino.tipo}».`);
    }

    const pid = destino.proyecto_id;
    const uuidOrigen = obj.proyecto && obj.proyecto.uuid ? String(obj.proyecto.uuid) : '';
    const uuidDestino = destino.proyecto_uuid ? String(destino.proyecto_uuid) : '';
    const mismoProyecto = uuidOrigen && uuidDestino
      ? uuidOrigen === uuidDestino
      : Boolean(
        obj.proyecto
        && Number(obj.proyecto.id) === Number(pid)
        && (!obj.proyecto.nombre
          || String(obj.proyecto.nombre).trim() === String(destino.proyecto_nombre || '').trim())
      );
    let datos = obj.datos;
    const creadas = { persona: 0, institucion: 0, lugar: 0, patrimonio: 0 };
    const reutilizadas = { persona: 0, institucion: 0, lugar: 0, patrimonio: 0 };
    let homonimosPreservados = 0;

    if (!mismoProyecto) {
      const snapshots = obj.entidades;
      if (!snapshots) {
        throw new Error('El archivo no incluye las entidades necesarias para importarlo en otro proyecto.');
      }
      const listas = {
        lugar: snapshots.lugares || [],
        institucion: snapshots.instituciones || [],
        persona: snapshots.personas || [],
        patrimonio: snapshots.patrimonios || [],
      };
      const mapas = { persona: {}, institucion: {}, lugar: {}, patrimonio: {} };
      const norm = (v) => String(v || '').trim().toLocaleLowerCase('es');
      const clavePersona = (p) => [norm(p.nombre), norm(p.apellidos), norm(p.alias)].join('|');
      const claveNombreCompleto = (p) => [norm(p.nombre), norm(p.apellidos)].join('|');
      const indices = {
        persona: { alias: new Map(), nombre: new Map() },
        institucion: { nombre: new Map() },
        lugar: { nombre: new Map() },
        patrimonio: { nombre: new Map() },
      };
      const ambiguos = {
        persona: { alias: new Set(), nombre: new Set() },
        institucion: { nombre: new Set() },
        lugar: { nombre: new Set() },
        patrimonio: { nombre: new Set() },
      };
      const usadas = { persona: new Set(), institucion: new Set(), lugar: new Set(), patrimonio: new Set() };
      const registrar = (tipo, fila, clase = 'nombre') => {
        const mapa = indices[tipo][clase];
        const clave = tipo === 'persona'
          ? (clase === 'alias' ? clavePersona(fila) : claveNombreCompleto(fila))
          : norm(fila.nombre);
        const anterior = mapa.get(clave);
        if (anterior && String(anterior.id) !== String(fila.id)) {
          ambiguos[tipo][clase].add(clave);
          return;
        }
        if (!anterior) mapa.set(clave, fila);
      };
      for (const tipo of ['lugar', 'institucion', 'persona', 'patrimonio']) {
        const filas = await this.listarEntidadesResumen(tipo, pid, ejecutor);
        for (const fila of filas) {
          if (tipo === 'persona') {
            registrar(tipo, fila, 'alias');
            registrar(tipo, fila, 'nombre');
          } else {
            registrar(tipo, fila);
          }
        }
      }
      const buscar = (tipo, fila) => {
        let candidato = null;
        if (tipo === 'persona') {
          const claveAlias = clavePersona(fila);
          const claveBase = claveNombreCompleto(fila);
          if (!ambiguos.persona.alias.has(claveAlias)) candidato = indices.persona.alias.get(claveAlias) || null;
          if (!candidato && !ambiguos.persona.nombre.has(claveBase)) {
            candidato = indices.persona.nombre.get(claveBase) || null;
          }
        } else {
          const clave = norm(fila.nombre);
          if (!ambiguos[tipo].nombre.has(clave)) candidato = indices[tipo].nombre.get(clave) || null;
        }
        if (!candidato) return null;
        if (usadas[tipo].has(String(candidato.id))) {
          homonimosPreservados++;
          return null;
        }
        return candidato;
      };
      const crear = async (tipo, fila) => {
        const datosEntidad = { ...fila };
        delete datosEntidad.id;
        delete datosEntidad.proyecto_id;
        delete datosEntidad.identificador;
        if (tipo === 'institucion' || tipo === 'patrimonio') {
          datosEntidad.lugar_id = datosEntidad.lugar_id != null
            ? (mapas.lugar[String(datosEntidad.lugar_id)] ?? null) : null;
        }
        if (tipo === 'persona') {
          datosEntidad.institucion_id = datosEntidad.institucion_id != null
            ? (mapas.institucion[String(datosEntidad.institucion_id)] ?? null) : null;
        }
        return this.crearEntidad(tipo, pid, datosEntidad, ejecutor, {
          contador: contadores,
          sinReleer: true,
          sinTocarProyecto: true,
        });
      };
      const contadores = {};
      for (const tipo of ['lugar', 'institucion', 'persona', 'patrimonio']) {
        const prefijo = PREFIJOS_ID[tipo];
        if (!prefijo) continue;
        const [maximos] = await ejecutor.query(
          `SELECT MAX(CAST(SUBSTR(identificador, ?) AS UNSIGNED)) AS ultimo
           FROM ${this.def(tipo).tabla} WHERE proyecto_id = ? AND identificador LIKE ?`,
          [prefijo.length + 1, pid, `${prefijo}%`]
        );
        contadores[tipo] = (Number(maximos[0]?.ultimo) || 0) + 1;
      }
      for (const tipo of ['lugar', 'institucion', 'persona', 'patrimonio']) {
        for (const entidad of listas[tipo]) {
          const encontrada = buscar(tipo, entidad);
          if (encontrada) {
            mapas[tipo][String(entidad.id)] = encontrada.id;
            usadas[tipo].add(String(encontrada.id));
            reutilizadas[tipo]++;
          } else {
            const nueva = await crear(tipo, entidad);
            mapas[tipo][String(entidad.id)] = nueva.id;
            usadas[tipo].add(String(nueva.id));
            if (tipo === 'persona') {
              registrar(tipo, nueva, 'alias');
              registrar(tipo, nueva, 'nombre');
            } else {
              registrar(tipo, nueva);
            }
            creadas[tipo]++;
          }
        }
      }
      datos = remapearDatosBloque(obj.datos, destino.tipo, mapas);
    }

    /* Las exclusiones son trabajo del usuario: no se borran al importar.
       Las del archivo se traducen si cambian los IDs de entidad y se añaden
       a las que ya existan en el destino. */
    const mapaFirmas = relacionesAutomaticas.mapaFirmasExclusion(
      {
        id: Number(obj.bloque_id) || id,
        tipo: obj.tipo,
        fuente_id: Number(obj.fuente_id) || destino.fuente_id,
      },
      obj.datos,
      { id, tipo: destino.tipo, fuente_id: destino.fuente_id },
      datos
    );
    const insertarExclusion = this.motor === 'sqlite' ? 'INSERT OR IGNORE' : 'INSERT IGNORE';
    let exclusionesImportadas = 0;
    for (const exclusion of Array.isArray(obj.exclusiones) ? obj.exclusiones : []) {
      if (!exclusion || typeof exclusion !== 'object') continue;
      const regla = String(exclusion.regla || '').trim();
      if (!regla) continue;
      const firmaImportada = String(exclusion.firma || '');
      let firmaNueva = firmaImportada;
      if (firmaImportada) {
        firmaNueva = mapaFirmas.get(firmaImportada)
          ?? (mismoProyecto ? firmaImportada : '');
      }
      if (!firmaNueva) {
        console.warn(
          `[bloques] No se pudo traducir la firma de exclusión de la regla ${regla}; `
          + 'se conserva la del destino.'
        );
        continue;
      }
      await ejecutor.query(
        `${insertarExclusion} INTO relaciones_exclusiones
          (proyecto_id, bloque_id, regla, firma)
         VALUES (?, ?, ?, ?)`,
        [pid, id, regla, firmaNueva]
      );
      exclusionesImportadas++;
    }
    await ejecutor.query(
      'UPDATE bloques_registro SET datos = ?, fecha_modificacion = CURRENT_TIMESTAMP WHERE id = ?',
      [JSON.stringify(datos), id]
    );
    await this.actualizarReferenciasBloque(id, destino.tipo, datos, ejecutor);
    await relacionesAutomaticas.reconciliarBloque(this, id, ejecutor);
    await this.tocarProyecto(pid, ejecutor);

    const [actualizado] = await ejecutor.query('SELECT * FROM bloques_registro WHERE id = ?', [id]);
    let datosFinal = {};
    try { datosFinal = actualizado[0].datos ? JSON.parse(actualizado[0].datos) : {}; } catch { datosFinal = {}; }
    return {
      bloque: { ...actualizado[0], datos: datosFinal },
      creadas,
      reutilizadas,
      homonimosPreservados,
      exclusionesImportadas,
    };
  }

  /* ---------------------------------------------------------------- */
  /* Búsqueda general                                                 */
  /* ---------------------------------------------------------------- */

  /** Construye y cachea el corpus normalizado del proyecto. El índice se
      reutiliza mientras el usuario escribe; se fuerza su reconstrucción al
      entrar en la sección o al pulsar «Actualizar». */
  async corpusBusqueda(proyectoId, forzar = false) {
    const guardado = this.cacheBusqueda.get(proyectoId);
    if (!forzar && guardado && Date.now() - guardado.instante < CACHE_BUSQUEDA_MS) {
      return guardado.corpus;
    }
    const pendiente = this.corpusBusquedaPendiente.get(proyectoId);
    if (pendiente) return pendiente;
    const generacionConexion = this.generacionConexion;
    const promesa = this.construirCorpusBusqueda(proyectoId)
      .then((corpus) => {
        if (generacionConexion !== this.generacionConexion) return corpus;
        this.cacheBusqueda.set(proyectoId, { instante: Date.now(), corpus });
        for (const clave of [...this.cacheBusqueda.keys()]) {
          if (this.cacheBusqueda.size <= 2) break;
          if (clave !== proyectoId) this.cacheBusqueda.delete(clave);
        }
        return corpus;
      })
      .finally(() => {
        if (this.corpusBusquedaPendiente.get(proyectoId) === promesa) {
          this.corpusBusquedaPendiente.delete(proyectoId);
        }
      });
    this.corpusBusquedaPendiente.set(proyectoId, promesa);
    return promesa;
  }

  async construirCorpusBusqueda(proyectoId) {
    const entidades = [];
    const porTipoEntidad = { persona: 0, institucion: 0, lugar: 0, patrimonio: 0, fuente: 0 };
    const mapaEntidades = new Map();

    const [personas] = await this.pool.query(
      `SELECT p.*, i.nombre AS institucion_nombre
       FROM personas p
       LEFT JOIN instituciones i ON i.id = p.institucion_id AND i.proyecto_id = p.proyecto_id
       WHERE p.proyecto_id = ?`,
      [proyectoId]
    );
    for (const p of personas) {
      const titulo = [p.nombre, p.apellidos].filter(Boolean).join(' ') || p.alias || `#${p.id}`;
      const anios = rangoAniosBusqueda(p.anio_nacimiento, p.anio_defuncion);
      const subtitulo = juntarPartesBusqueda([
        p.identificador, anios, p.ocupacion, p.institucion_nombre,
      ]);
      const texto = juntarPartesBusqueda([
        p.identificador, p.nombre, p.apellidos, p.alias, p.genero, p.tratamiento,
        p.ocupacion, p.lugar_nacimiento, p.lugar_defuncion, p.institucion_nombre,
        p.notas, p.anio_nacimiento, p.anio_defuncion,
        p.fecha_exacta_nacimiento, p.fecha_exacta_defuncion,
      ]);
      const item = crearItemBusqueda({
        tipo: 'persona',
        id: p.id,
        titulo,
        subtitulo,
        texto,
        publico: { tipo: 'persona', id: p.id, identificador: p.identificador || '' },
      });
      entidades.push(item);
      mapaEntidades.set(`persona:${p.id}`, titulo);
      porTipoEntidad.persona++;
    }

    const [instituciones] = await this.pool.query(
      `SELECT i.*, l.nombre AS lugar_nombre
       FROM instituciones i
       LEFT JOIN lugares l ON l.id = i.lugar_id AND l.proyecto_id = i.proyecto_id
       WHERE i.proyecto_id = ?`,
      [proyectoId]
    );
    for (const i of instituciones) {
      const anios = rangoAniosBusqueda(i.anio_fundacion, i.anio_disolucion);
      const subtitulo = juntarPartesBusqueda([i.identificador, i.tipo, anios, i.lugar_nombre]);
      const texto = juntarPartesBusqueda([
        i.identificador, i.nombre, i.tipo, i.lugar_nombre, i.notas,
        i.anio_fundacion, i.anio_disolucion,
        i.fecha_exacta_fundacion, i.fecha_exacta_disolucion,
      ]);
      const item = crearItemBusqueda({
        tipo: 'institucion',
        id: i.id,
        titulo: i.nombre || `#${i.id}`,
        subtitulo,
        texto,
        publico: { tipo: 'institucion', id: i.id, identificador: i.identificador || '' },
      });
      entidades.push(item);
      mapaEntidades.set(`institucion:${i.id}`, item.titulo);
      porTipoEntidad.institucion++;
    }

    const [lugares] = await this.pool.query(
      'SELECT * FROM lugares WHERE proyecto_id = ?',
      [proyectoId]
    );
    for (const l of lugares) {
      const coordenadas = l.latitud != null && l.longitud != null
        ? `(${Number(l.latitud).toFixed(4)}, ${Number(l.longitud).toFixed(4)})`
        : 'sin georreferenciar';
      const subtitulo = juntarPartesBusqueda([l.identificador, l.tipo, coordenadas]);
      const texto = juntarPartesBusqueda([
        l.identificador, l.nombre, l.tipo, l.notas, l.latitud, l.longitud,
      ]);
      const item = crearItemBusqueda({
        tipo: 'lugar',
        id: l.id,
        titulo: l.nombre || `#${l.id}`,
        subtitulo,
        texto,
        publico: { tipo: 'lugar', id: l.id, identificador: l.identificador || '' },
      });
      entidades.push(item);
      mapaEntidades.set(`lugar:${l.id}`, item.titulo);
      porTipoEntidad.lugar++;
    }

    const [patrimonios] = await this.pool.query(
      `SELECT p.*, l.nombre AS lugar_nombre
       FROM patrimonios p
       LEFT JOIN lugares l ON l.id = p.lugar_id AND l.proyecto_id = p.proyecto_id
       WHERE p.proyecto_id = ?`,
      [proyectoId]
    );
    for (const p of patrimonios) {
      const subtitulo = juntarPartesBusqueda([
        p.identificador, p.tipo, p.propietario, p.valor, p.lugar_nombre,
      ]);
      const texto = juntarPartesBusqueda([
        p.identificador, p.nombre, p.tipo, p.propietario, p.valor,
        p.descripcion, p.lugar_nombre, p.notas,
      ]);
      const item = crearItemBusqueda({
        tipo: 'patrimonio',
        id: p.id,
        titulo: p.nombre || `#${p.id}`,
        subtitulo,
        texto,
        publico: { tipo: 'patrimonio', id: p.id, identificador: p.identificador || '' },
      });
      entidades.push(item);
      mapaEntidades.set(`patrimonio:${p.id}`, item.titulo);
      porTipoEntidad.patrimonio++;
    }

    /* `fuentes.transcripcion` es una columna heredada que el formulario ya no
       usa: las transcripciones vivas están en `cuadernos`. Se excluye para no
       duplicar textos largos ni multiplicar la memoria del índice. */
    const [fuentes] = await this.pool.query(
      `SELECT id, titulo, categoria, tipo, autor, lugar, repositorio, fondo,
              signatura, editorial, libro, editor, paginas, revista,
              anio_publicacion, volumen, numero, doi, evento, facultad,
              universidad, anio_inicio, anio_fin, fecha_exacta, ubicacion,
              referencia, notas
       FROM fuentes WHERE proyecto_id = ?`,
      [proyectoId]
    );
    for (const f of fuentes) {
      const anios = rangoAniosBusqueda(f.anio_inicio, f.anio_fin);
      const subtitulo = juntarPartesBusqueda([
        f.categoria, f.tipo, f.autor, anios, f.repositorio, f.signatura,
      ]);
      const texto = juntarPartesBusqueda([
        f.titulo, f.categoria, f.tipo, f.autor, f.lugar, f.repositorio,
        f.fondo, f.signatura, f.editorial, f.libro, f.editor, f.paginas,
        f.revista, f.anio_publicacion, f.volumen, f.numero, f.doi, f.evento,
        f.facultad, f.universidad, f.anio_inicio, f.anio_fin, f.fecha_exacta,
        f.ubicacion, f.referencia, f.notas,
      ]);
      const item = crearItemBusqueda({
        tipo: 'fuente',
        id: f.id,
        titulo: f.titulo || `#${f.id}`,
        subtitulo,
        texto,
        publico: { tipo: 'fuente', id: f.id, identificador: '' },
      });
      entidades.push(item);
      mapaEntidades.set(`fuente:${f.id}`, item.titulo);
      porTipoEntidad.fuente++;
    }

    const relaciones = [];
    const relacionesProyecto = await this.listarRelaciones(proyectoId);
    const tiposRelacion = new Map();
    for (const r of relacionesProyecto) {
      const tipo = r.tipo || '(sin tipo)';
      const origen = {
        tipo: r.origen_tipo,
        id: r.origen_id,
        nombre: r.origen_nombre || `#${r.origen_id}`,
      };
      const destino = {
        tipo: r.destino_tipo,
        id: r.destino_id,
        nombre: r.destino_nombre || `#${r.destino_id}`,
      };
      const fechas = juntarPartesBusqueda([
        r.anio_inicio != null || r.anio_fin != null
          ? rangoAniosBusqueda(r.anio_inicio, r.anio_fin)
          : '',
        r.fecha_exacta_inicio,
        r.fecha_exacta_fin,
      ]);
      const lugares = juntarPartesBusqueda([r.lugar_inicio_nombre, r.lugar_fin_nombre]);
      const fuentesVinculadas = (r.fuentes || []).map((f) => f.titulo).filter(Boolean);
      const texto = juntarPartesBusqueda([
        tipo, origen.nombre, destino.nombre, fechas, lugares,
        fuentesVinculadas.join(' · '), r.notas, r.procedencia,
      ]);
      relaciones.push(crearItemBusqueda({
        tipo: 'relacion',
        id: r.id,
        titulo: `${origen.nombre} → ${destino.nombre}`,
        subtitulo: juntarPartesBusqueda([tipo, fechas, lugares]),
        texto,
        publico: {
          relacionId: r.id,
          tipoRelacion: tipo,
          origen,
          destino,
          procedencia: r.procedencia || '',
          anioInicio: r.anio_inicio,
          anioFin: r.anio_fin,
          fechaInicio: r.fecha_exacta_inicio || '',
          fechaFin: r.fecha_exacta_fin || '',
          lugarInicio: r.lugar_inicio_nombre || '',
          lugarFin: r.lugar_fin_nombre || '',
          fuentes: (r.fuentes || []).map((f) => ({ id: f.id, titulo: f.titulo })),
        },
      }));
      tiposRelacion.set(tipo, (tiposRelacion.get(tipo) || 0) + 1);
    }

    const bloques = [];
    const [bloquesRegistro] = await this.pool.query(
      `SELECT b.id, b.fuente_id, b.tipo, b.categoria, b.periodo, b.region,
              b.datos, f.titulo AS fuente_titulo
       FROM bloques_registro b
       JOIN fuentes f ON f.id = b.fuente_id
       WHERE f.proyecto_id = ?
       ORDER BY b.id DESC`,
      [proyectoId]
    );
    for (const b of bloquesRegistro) {
      let datos = {};
      let datosInvalidos = false;
      try {
        datos = b.datos ? JSON.parse(b.datos) : {};
      } catch {
        datos = {};
        datosInvalidos = true;
      }
      const valores = [];
      const camposEntidad = CAMPOS_ENTIDAD_BLOQUE[b.tipo] || {};
      const recorrer = (nodo) => {
        if (Array.isArray(nodo)) {
          for (const item of nodo) recorrer(item);
          return;
        }
        if (!nodo || typeof nodo !== 'object') return;
        for (const [clave, valor] of Object.entries(nodo)) {
          if (clave === 'meta' || /_meta$/i.test(clave)) continue;
          if (clave === 'id' || /_id$/i.test(clave)) continue;
          if (clave === 'patria' || camposEntidad[clave]) continue;
          if (valor && typeof valor === 'object') {
            recorrer(valor);
            continue;
          }
          const texto = valorTextoBusqueda(valor);
          if (texto) valores.push(texto);
        }
      };
      if (!datosInvalidos) recorrer(datos);
      const tituloRegistro = valorTextoBusqueda(datos?.valores?.f1);
      const titulo = datosInvalidos
        ? `Bloque dañado · ${b.tipo}`
        : (tituloRegistro || `Bloque · ${b.tipo}`);
      const subtitulo = juntarPartesBusqueda([
        b.tipo, b.categoria, b.fuente_titulo, b.periodo, b.region,
      ]);
      const texto = datosInvalidos
        ? juntarPartesBusqueda([b.tipo, b.categoria, b.fuente_titulo, b.datos])
        : juntarPartesBusqueda([b.tipo, b.categoria, b.fuente_titulo, ...valores]);
      bloques.push(crearItemBusqueda({
        tipo: 'bloque',
        id: b.id,
        titulo,
        subtitulo,
        texto,
        publico: {
          bloqueId: b.id,
          fuenteId: b.fuente_id,
          fuenteTitulo: b.fuente_titulo || '',
          tipoBloque: b.tipo,
          categoria: b.categoria || '',
          datosInvalidos,
        },
      }));
    }

    const cuadernos = [];
    const [cuadernosRegistro] = await this.pool.query(
      `SELECT c.id, c.fuente_id, c.contenido, c.posicion, f.titulo AS fuente_titulo
       FROM cuadernos c
       JOIN fuentes f ON f.id = c.fuente_id
       WHERE f.proyecto_id = ?
       ORDER BY c.fuente_id, c.posicion, c.id`,
      [proyectoId]
    );
    const numeroCuaderno = new Map();
    for (const c of cuadernosRegistro) {
      const numero = (numeroCuaderno.get(c.fuente_id) || 0) + 1;
      numeroCuaderno.set(c.fuente_id, numero);
      const contenido = c.contenido || '';
      cuadernos.push(crearItemBusqueda({
        tipo: 'cuaderno',
        id: c.id,
        titulo: `Transcripción · ${c.fuente_titulo || `#${c.fuente_id}`}`,
        subtitulo: juntarPartesBusqueda([`Cuaderno ${numero}`, c.fuente_titulo]),
        texto: contenido,
        publico: {
          cuadernoId: c.id,
          fuenteId: c.fuente_id,
          fuenteTitulo: c.fuente_titulo || '',
          numero,
        },
      }));
    }

    const coincidencias = [];
    const [coincidenciasRegistro] = await this.pool.query(
      'SELECT * FROM coincidencias WHERE proyecto_id = ? ORDER BY id DESC',
      [proyectoId]
    );
    for (const c of coincidenciasRegistro) {
      const nombreA = mapaEntidades.get(`${c.tipo}:${c.entidad_a}`) || `#${c.entidad_a}`;
      const nombreB = mapaEntidades.get(`${c.tipo}:${c.entidad_b}`) || `#${c.entidad_b}`;
      coincidencias.push(crearItemBusqueda({
        tipo: 'coincidencia',
        id: c.id,
        titulo: `${nombreA} ↔ ${nombreB}`,
        subtitulo: `Posible coincidencia · ${c.tipo}`,
        texto: juntarPartesBusqueda([c.notas, nombreA, nombreB, c.tipo]),
        publico: {
          coincidenciaId: c.id,
          tipo: c.tipo,
          entidadA: c.entidad_a,
          entidadB: c.entidad_b,
          nombreA,
          nombreB,
          notas: c.notas || '',
        },
      }));
    }

    return {
      generadoEn: new Date().toISOString(),
      entidades,
      relaciones,
      bloques,
      cuadernos,
      coincidencias,
      porTipoEntidad,
      tiposRelacion: [...tiposRelacion.entries()]
        .map(([tipo, total]) => ({ tipo, total }))
        .sort((a, b) => a.tipo.localeCompare(b.tipo, 'es', { sensitivity: 'base' })),
      totales: {
        entidades: entidades.length,
        relaciones: relaciones.length,
        bloques: bloques.length,
        cuadernos: cuadernos.length,
        coincidencias: coincidencias.length,
      },
    };
  }

  async buscarGlobal(proyectoId, opciones = {}) {
    await this.listo();
    const texto = String(opciones.texto ?? '').slice(0, 200);
    const tiposEntidad = [...new Set(
      (Array.isArray(opciones.tiposEntidad) ? opciones.tiposEntidad : [])
        .filter((tipo) => TIPOS_ENTIDAD.includes(tipo))
    )];
    const tipoRelacion = String(opciones.tipoRelacion || '').trim().slice(0, 160);
    const limite = Math.min(
      Math.max(Number(opciones.limite) || LIMITE_RESULTADOS_BUSQUEDA, 1),
      100
    );
    const corpus = await this.corpusBusqueda(proyectoId, Boolean(opciones.forzar));
    const tokens = tokensDeConsulta(texto);
    const consultaNormalizada = normalizarConsulta(texto);
    const filtrandoEntidades = tiposEntidad.length > 0;
    const filtrandoRelaciones = Boolean(tipoRelacion);
    const explorar = !tokens.length && !filtrandoEntidades && !filtrandoRelaciones;

    const incluirEntidades = !explorar
      && (filtrandoEntidades || (!filtrandoEntidades && !filtrandoRelaciones));
    const incluirRelaciones = !explorar
      && (filtrandoRelaciones || (!filtrandoEntidades && !filtrandoRelaciones));
    const incluirOtros = !explorar && !filtrandoEntidades && !filtrandoRelaciones;

    const evaluar = (items) => {
      const top = [];
      let total = 0;
      const comparar = (a, b) => {
        if (b.puntuacion !== a.puntuacion) return b.puntuacion - a.puntuacion;
        const ta = a.item.tituloNormalizado;
        const tb = b.item.tituloNormalizado;
        return ta < tb ? -1 : (ta > tb ? 1 : 0);
      };
      const insertar = (candidato) => {
        let bajo = 0;
        let alto = top.length;
        while (bajo < alto) {
          const medio = (bajo + alto) >> 1;
          if (comparar(candidato, top[medio]) < 0) alto = medio;
          else bajo = medio + 1;
        }
        top.splice(bajo, 0, candidato);
        if (top.length > limite) top.pop();
      };
      for (const item of items) {
        if (!tokens.length) {
          total++;
          if (top.length < limite) top.push({ item, puntuacion: 0 });
          continue;
        }
        if (!bloomPuedeContener(item.bloom, tokens)) continue;
        const puntos = puntuar(
          item.tituloNormalizado,
          item.textoNormalizado,
          tokens,
          consultaNormalizada
        );
        if (puntos === null) continue;
        total++;
        if (top.length < limite || comparar({ item, puntuacion: puntos }, top[top.length - 1]) < 0) {
          insertar({ item, puntuacion: puntos });
        }
      }
      top.sort(comparar);
      const resultados = top.map(({ item, puntuacion }) => {
        const { snippet, resaltados } = crearSnippet(item.texto, tokens, 220, item.textoNormalizado);
        return {
          ...item.publico,
          titulo: item.titulo,
          subtitulo: item.subtitulo,
          snippet,
          resaltados,
          resaltadosTitulo: rangosDeTokens(item.titulo, tokens),
          puntuacion,
        };
      });
      return { total, resultados };
    };

    const entidadesFuente = filtrandoEntidades
      ? corpus.entidades.filter((item) => tiposEntidad.includes(item.tipo))
      : corpus.entidades;
    const relacionesFuente = filtrandoRelaciones
      ? corpus.relaciones.filter((item) => item.publico.tipoRelacion === tipoRelacion)
      : corpus.relaciones;

    const entidades = incluirEntidades
      ? evaluar(entidadesFuente)
      : { total: 0, resultados: [] };
    const relaciones = incluirRelaciones
      ? evaluar(relacionesFuente)
      : { total: 0, resultados: [] };
    const bloques = incluirOtros ? evaluar(corpus.bloques) : { total: 0, resultados: [] };
    const cuadernos = incluirOtros ? evaluar(corpus.cuadernos) : { total: 0, resultados: [] };
    const coincidencias = incluirOtros
      ? evaluar(corpus.coincidencias)
      : { total: 0, resultados: [] };

    const totalesBusqueda = {
      entidades: entidades.total,
      relaciones: relaciones.total,
      bloques: bloques.total,
      cuadernos: cuadernos.total,
      coincidencias: coincidencias.total,
    };
    totalesBusqueda.total = Object.values(totalesBusqueda).reduce((a, b) => a + b, 0);

    return {
      generadoEn: corpus.generadoEn,
      totales: corpus.totales,
      porTipoEntidad: corpus.porTipoEntidad,
      tiposRelacion: corpus.tiposRelacion,
      resultados: {
        entidades: entidades.resultados,
        relaciones: relaciones.resultados,
        bloques: bloques.resultados,
        cuadernos: cuadernos.resultados,
        coincidencias: coincidencias.resultados,
      },
      totalesBusqueda,
      truncado: totalesBusqueda.entidades > entidades.resultados.length
        || totalesBusqueda.relaciones > relaciones.resultados.length
        || totalesBusqueda.bloques > bloques.resultados.length
        || totalesBusqueda.cuadernos > cuadernos.resultados.length
        || totalesBusqueda.coincidencias > coincidencias.resultados.length,
    };
  }

  /* ---------------------------------------------------------------- */
  /* Grafo                                                            */
  /* ---------------------------------------------------------------- */

  async datosGrafo(proyectoId) {
    await this.listo();
    const nodos = [];

    const [personas] = await this.pool.query(
      'SELECT id, nombre, apellidos, alias, anio_nacimiento, anio_defuncion, ocupacion FROM personas WHERE proyecto_id = ?',
      [proyectoId]
    );
    for (const p of personas) {
      nodos.push({
        id: `persona:${p.id}`,
        tipo: 'persona',
        entidadId: p.id,
        etiqueta: [p.nombre, p.apellidos].filter(Boolean).join(' ') || p.alias || `#${p.id}`,
        detalle: [
          p.ocupacion,
          [p.anio_nacimiento ?? null, p.anio_defuncion ?? null].filter((v) => v != null).join(' – '),
        ].filter(Boolean).join(' · '),
        anioDesde: p.anio_nacimiento ?? null,
        anioHasta: p.anio_defuncion ?? null,
      });
    }

    const [instituciones] = await this.pool.query(
      'SELECT id, nombre, tipo, anio_fundacion, anio_disolucion FROM instituciones WHERE proyecto_id = ?',
      [proyectoId]
    );
    for (const i of instituciones) {
      nodos.push({
        id: `institucion:${i.id}`,
        tipo: 'institucion',
        entidadId: i.id,
        etiqueta: i.nombre,
        detalle: [i.tipo, [i.anio_fundacion ?? null, i.anio_disolucion ?? null].filter((v) => v != null).join(' – ')].filter(Boolean).join(' · '),
        anioDesde: i.anio_fundacion ?? null,
        anioHasta: i.anio_disolucion ?? null,
      });
    }

    const [lugares] = await this.pool.query(
      'SELECT id, nombre, tipo, latitud, longitud FROM lugares WHERE proyecto_id = ?',
      [proyectoId]
    );
    for (const l of lugares) {
      nodos.push({
        id: `lugar:${l.id}`,
        tipo: 'lugar',
        entidadId: l.id,
        etiqueta: l.nombre,
        detalle: l.tipo || '',
        latitud: l.latitud,
        longitud: l.longitud,
      });
    }

    const [patrimonios] = await this.pool.query(
      'SELECT id, nombre, tipo, propietario FROM patrimonios WHERE proyecto_id = ?',
      [proyectoId]
    );
    for (const p of patrimonios) {
      nodos.push({
        id: `patrimonio:${p.id}`,
        tipo: 'patrimonio',
        entidadId: p.id,
        etiqueta: p.nombre,
        detalle: [p.tipo, p.propietario].filter(Boolean).join(' · '),
      });
    }

    const [aristas] = await this.pool.query(
      `SELECT id, origen_tipo, origen_id, destino_tipo, destino_id, tipo,
              anio_inicio, fecha_exacta_inicio, fecha_exacta_inicio_meta,
              anio_fin, fecha_exacta_fin, fecha_exacta_fin_meta
       FROM relaciones WHERE proyecto_id = ?`,
      [proyectoId]
    );

    const ids = new Set(nodos.map((n) => n.id));
    const aristasValidas = aristas
      .map((r) => ({
        id: r.id,
        origen: `${r.origen_tipo}:${r.origen_id}`,
        destino: `${r.destino_tipo}:${r.destino_id}`,
        tipo: r.tipo || 'relación',
        fecha: [r.fecha_exacta_inicio, r.fecha_exacta_fin].filter(Boolean).join(' – ')
          || [r.anio_inicio ?? null, r.anio_fin ?? null].filter((v) => v != null).join(' – '),
        anioDesde: r.anio_inicio ?? anioDeFechaExacta(r.fecha_exacta_inicio, r.fecha_exacta_inicio_meta),
        anioHasta: r.anio_fin ?? anioDeFechaExacta(r.fecha_exacta_fin, r.fecha_exacta_fin_meta, true),
      }))
      .filter((r) => ids.has(r.origen) && ids.has(r.destino));

    /* Rango temporal global de la red: años de RELACIONES, incluyendo los
       que solo constan en una fecha exacta. */
    let minimo = null;
    let maximo = null;
    for (const arista of aristasValidas) {
      for (const anio of [arista.anioDesde, arista.anioHasta]) {
        if (!Number.isFinite(anio)) continue;
        if (minimo == null || anio < minimo) minimo = anio;
        if (maximo == null || anio > maximo) maximo = anio;
      }
    }
    const rango = { minimo, maximo };

    return { nodos, aristas: aristasValidas, rango };
  }
}

module.exports = new BaseDatos();
