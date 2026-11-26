'use strict';

/* H-IMAGO · Esquema y migraciones de MySQL/MariaDB.
   Se mantiene separado de la fachada para que la lógica SQLite y la MySQL
   tengan puntos de entrada independientes. */

const { respaldarMySQL } = require('./respaldo');
const crypto = require('crypto');
const { columnasMySQL } = require('./columnas-nuevas');
const { PREFIJOS_ID } = require('./definiciones');
const { extraerAnios } = require('./fechas-legadas');
const { recolectarReferenciasBloque } = require('./bloques-referencias');
const { corregirSedesAutomaticasInvertidas } = require('./relaciones-automaticas');
const { renombrarTiposRelacion } = require('./migracion-relaciones');

const ESQUEMA_VERSION_MYSQL = 10;

async function crearEsquemaMySQL(pool, config) {
    /* Si el esquema ya está al día no se ejecuta DDL: permite usar cuentas
       de equipo con permisos de lectura/escritura pero sin ALTER/CREATE. */
    try {
      const [tablaMigraciones] = await pool.query(
        `SELECT 1 AS hay FROM information_schema.TABLES
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'schema_migrations' LIMIT 1`
      );
      if (tablaMigraciones.length) {
        const [versionActual] = await pool.query('SELECT MAX(version) AS version FROM schema_migrations');
        if (Number(versionActual[0]?.version || 0) >= ESQUEMA_VERSION_MYSQL) return;
      }
    } catch (err) {
      if (err && err.code !== 'ER_NO_SUCH_TABLE') throw err;
    }

    const sql = [
      `CREATE TABLE IF NOT EXISTS proyectos (
        id INT AUTO_INCREMENT PRIMARY KEY,
        nombre VARCHAR(255) NOT NULL,
        descripcion TEXT NULL,
        creador VARCHAR(255) NULL,
        uuid CHAR(36) NULL,
        fecha_creacion DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        fecha_modificacion DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

      `CREATE TABLE IF NOT EXISTS lugares (
        id INT AUTO_INCREMENT PRIMARY KEY,
        proyecto_id INT NOT NULL,
        identificador VARCHAR(12) NULL,
        nombre VARCHAR(255) NOT NULL,
        tipo VARCHAR(120) NULL,
        latitud DECIMAL(10,7) NULL,
        longitud DECIMAL(10,7) NULL,
        notas TEXT NULL,
        INDEX idx_lugar_proyecto (proyecto_id),
        CONSTRAINT fk_lugar_proyecto FOREIGN KEY (proyecto_id) REFERENCES proyectos(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

      `CREATE TABLE IF NOT EXISTS personas (
        id INT AUTO_INCREMENT PRIMARY KEY,
        proyecto_id INT NOT NULL,
        identificador VARCHAR(12) NULL,
        nombre VARCHAR(255) NULL,
        apellidos VARCHAR(255) NULL,
        alias VARCHAR(255) NULL,
        genero VARCHAR(60) NULL,
        anio_nacimiento INT NULL,
        fecha_exacta_nacimiento VARCHAR(255) NULL,
        fecha_exacta_nacimiento_meta TEXT NULL,
        anio_defuncion INT NULL,
        fecha_exacta_defuncion VARCHAR(255) NULL,
        fecha_exacta_defuncion_meta TEXT NULL,
        lugar_nacimiento VARCHAR(255) NULL,
        lugar_defuncion VARCHAR(255) NULL,
        institucion_id INT NULL,
        tratamiento VARCHAR(255) NULL,
        ocupacion VARCHAR(255) NULL,
        notas TEXT NULL,
        INDEX idx_persona_proyecto (proyecto_id),
        CONSTRAINT fk_persona_proyecto FOREIGN KEY (proyecto_id) REFERENCES proyectos(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

      `CREATE TABLE IF NOT EXISTS instituciones (
        id INT AUTO_INCREMENT PRIMARY KEY,
        proyecto_id INT NOT NULL,
        identificador VARCHAR(12) NULL,
        nombre VARCHAR(255) NOT NULL,
        tipo VARCHAR(120) NULL,
        anio_fundacion INT NULL,
        fecha_exacta_fundacion VARCHAR(255) NULL,
        fecha_exacta_fundacion_meta TEXT NULL,
        anio_disolucion INT NULL,
        fecha_exacta_disolucion VARCHAR(255) NULL,
        fecha_exacta_disolucion_meta TEXT NULL,
        lugar_id INT NULL,
        notas TEXT NULL,
        INDEX idx_institucion_proyecto (proyecto_id),
        CONSTRAINT fk_institucion_proyecto FOREIGN KEY (proyecto_id) REFERENCES proyectos(id) ON DELETE CASCADE,
        CONSTRAINT fk_institucion_lugar FOREIGN KEY (lugar_id) REFERENCES lugares(id) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

      `CREATE TABLE IF NOT EXISTS patrimonios (
        id INT AUTO_INCREMENT PRIMARY KEY,
        proyecto_id INT NOT NULL,
        identificador VARCHAR(12) NULL,
        nombre VARCHAR(255) NOT NULL,
        tipo VARCHAR(120) NULL,
        propietario VARCHAR(255) NULL,
        lugar_id INT NULL,
        valor VARCHAR(255) NULL,
        descripcion TEXT NULL,
        notas TEXT NULL,
        INDEX idx_patrimonio_proyecto (proyecto_id),
        CONSTRAINT fk_patrimonio_proyecto FOREIGN KEY (proyecto_id) REFERENCES proyectos(id) ON DELETE CASCADE,
        CONSTRAINT fk_patrimonio_lugar FOREIGN KEY (lugar_id) REFERENCES lugares(id) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

      `CREATE TABLE IF NOT EXISTS fuentes (
        id INT AUTO_INCREMENT PRIMARY KEY,
        proyecto_id INT NOT NULL,
        titulo VARCHAR(400) NOT NULL,
        categoria VARCHAR(120) NULL,
        tipo VARCHAR(120) NULL,
        autor VARCHAR(255) NULL,
        lugar VARCHAR(255) NULL,
        repositorio VARCHAR(255) NULL,
        fondo VARCHAR(255) NULL,
        signatura VARCHAR(255) NULL,
        editorial VARCHAR(255) NULL,
        libro VARCHAR(400) NULL,
        editor VARCHAR(255) NULL,
        paginas VARCHAR(80) NULL,
        revista VARCHAR(255) NULL,
        anio_publicacion INT NULL,
        volumen VARCHAR(80) NULL,
        numero VARCHAR(80) NULL,
        doi VARCHAR(255) NULL,
        evento VARCHAR(400) NULL,
        facultad VARCHAR(255) NULL,
        universidad VARCHAR(255) NULL,
        anio_inicio INT NULL,
        anio_fin INT NULL,
        fecha_exacta VARCHAR(255) NULL,
        ubicacion VARCHAR(400) NULL,
        referencia VARCHAR(400) NULL,
        transcripcion LONGTEXT NULL,
        notas TEXT NULL,
        INDEX idx_fuente_proyecto (proyecto_id),
        CONSTRAINT fk_fuente_proyecto FOREIGN KEY (proyecto_id) REFERENCES proyectos(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

      `CREATE TABLE IF NOT EXISTS cuadernos (
        id INT AUTO_INCREMENT PRIMARY KEY,
        fuente_id INT NOT NULL,
        posicion INT NOT NULL DEFAULT 0,
        contenido LONGTEXT NULL,
        fojas LONGTEXT NULL,
        fecha_creacion DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        fecha_modificacion DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_cuaderno_fuente (fuente_id),
        CONSTRAINT fk_cuaderno_fuente FOREIGN KEY (fuente_id) REFERENCES fuentes(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

      `CREATE TABLE IF NOT EXISTS coincidencias (
        id INT AUTO_INCREMENT PRIMARY KEY,
        proyecto_id INT NOT NULL,
        tipo ENUM('persona','institucion','lugar','patrimonio') NOT NULL,
        entidad_a INT NOT NULL,
        entidad_b INT NOT NULL,
        notas TEXT NULL,
        fecha_creacion DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_coincidencia_proyecto (proyecto_id),
        INDEX idx_coincidencia_a (tipo, entidad_a),
        INDEX idx_coincidencia_b (tipo, entidad_b),
        CONSTRAINT fk_coincidencia_proyecto FOREIGN KEY (proyecto_id) REFERENCES proyectos(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

      `CREATE TABLE IF NOT EXISTS bloques_registro (
        id INT AUTO_INCREMENT PRIMARY KEY,
        fuente_id INT NOT NULL,
        periodo VARCHAR(40) NOT NULL DEFAULT 'siglos-xviii-xix',
        region VARCHAR(60) NOT NULL DEFAULT 'hispanoamerica',
        tipo VARCHAR(160) NOT NULL,
        categoria VARCHAR(120) NULL,
        datos LONGTEXT NULL,
        fecha_creacion DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        fecha_modificacion DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_bloque_fuente (fuente_id),
        CONSTRAINT fk_bloque_fuente FOREIGN KEY (fuente_id) REFERENCES fuentes(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

      `CREATE TABLE IF NOT EXISTS bloque_referencias (
        bloque_id INT NOT NULL,
        entidad_tipo ENUM('persona','institucion','lugar','patrimonio') NOT NULL,
        entidad_id INT NOT NULL,
        PRIMARY KEY (bloque_id, entidad_tipo, entidad_id),
        INDEX idx_bloque_ref_entidad (entidad_tipo, entidad_id),
        CONSTRAINT fk_bloque_ref_bloque FOREIGN KEY (bloque_id) REFERENCES bloques_registro(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

      `CREATE TABLE IF NOT EXISTS relaciones (
        id INT AUTO_INCREMENT PRIMARY KEY,
        proyecto_id INT NOT NULL,
        origen_tipo ENUM('persona','institucion','lugar','patrimonio') NOT NULL,
        origen_id INT NOT NULL,
        destino_tipo ENUM('persona','institucion','lugar','patrimonio') NOT NULL,
        destino_id INT NOT NULL,
        tipo VARCHAR(160) NULL,
        anio_inicio INT NULL,
        fecha_exacta_inicio VARCHAR(255) NULL,
        fecha_exacta_inicio_meta TEXT NULL,
        lugar_inicio INT NULL,
        anio_fin INT NULL,
        fecha_exacta_fin VARCHAR(255) NULL,
        fecha_exacta_fin_meta TEXT NULL,
        lugar_fin INT NULL,
        notas TEXT NULL,
        procedencia VARCHAR(20) NOT NULL DEFAULT 'MANUAL',
        bloque_id INT NULL,
        regla VARCHAR(160) NULL,
        firma VARCHAR(64) NULL,
        INDEX idx_relacion_proyecto (proyecto_id),
        INDEX idx_relacion_origen (origen_tipo, origen_id),
        INDEX idx_relacion_destino (destino_tipo, destino_id),
        INDEX idx_relacion_bloque (bloque_id),
        INDEX idx_relacion_proyecto_origen (proyecto_id, origen_tipo, origen_id),
        INDEX idx_relacion_bloque_regla (bloque_id, regla, procedencia),
        CONSTRAINT fk_relacion_proyecto FOREIGN KEY (proyecto_id) REFERENCES proyectos(id) ON DELETE CASCADE,
        CONSTRAINT fk_relacion_lugar_inicio FOREIGN KEY (lugar_inicio) REFERENCES lugares(id) ON DELETE SET NULL,
        CONSTRAINT fk_relacion_lugar_fin FOREIGN KEY (lugar_fin) REFERENCES lugares(id) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

      `CREATE TABLE IF NOT EXISTS relaciones_exclusiones (
        id INT AUTO_INCREMENT PRIMARY KEY,
        proyecto_id INT NOT NULL,
        bloque_id INT NOT NULL,
        regla VARCHAR(160) NOT NULL,
        firma VARCHAR(64) NOT NULL DEFAULT '',
        fecha_creacion DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uq_exclusion (bloque_id, regla, firma),
        INDEX idx_exclusion_proyecto (proyecto_id),
        CONSTRAINT fk_exclusion_proyecto FOREIGN KEY (proyecto_id) REFERENCES proyectos(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

      `CREATE TABLE IF NOT EXISTS relaciones_fuentes (
        relacion_id INT NOT NULL,
        fuente_id INT NOT NULL,
        PRIMARY KEY (relacion_id, fuente_id),
        INDEX idx_rf_fuente (fuente_id),
        CONSTRAINT fk_rf_relacion FOREIGN KEY (relacion_id) REFERENCES relaciones(id) ON DELETE CASCADE,
        CONSTRAINT fk_rf_fuente FOREIGN KEY (fuente_id) REFERENCES fuentes(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
    ];
    for (const sentencia of sql) {
      await pool.query(sentencia);
    }
    await pool.query(
      `CREATE TABLE IF NOT EXISTS schema_migrations (
        version INT PRIMARY KEY,
        aplicada_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
    );
    const [versionFila] = await pool.query(
      'SELECT MAX(version) AS version FROM schema_migrations'
    );
    const version = Number(versionFila[0]?.version || 0);

    if (version < ESQUEMA_VERSION_MYSQL) {
    const [previos] = await pool.query('SELECT COUNT(*) AS n FROM proyectos');
    const hayProyectos = Number(previos[0]?.n || 0) > 0;
    if (hayProyectos) {
      const copiaPrevia = await respaldarMySQL(config);
      if (!copiaPrevia) {
        throw new Error('No se pudo crear la copia de seguridad de MySQL antes de migrar. '
          + 'Instala mysqldump o indica HIMAGO_MYSQLDUMP; la migración se ha detenido para no perder datos.');
      }
      console.log(`[mysql] Copia previa a la migración: ${copiaPrevia}`);
    }
    /* Reconstruir referencias solo después de tener una copia válida. */
    await migrarReferenciasBloquesMySQL(pool);
    /* Migraciones: proyectos anteriores (esquema de texto libre) */
    try {
      await pool.query('ALTER TABLE proyectos ADD COLUMN creador VARCHAR(255) NULL');
    } catch (err) {
      if (!err || err.code !== 'ER_DUP_FIELDNAME') throw err;
    }

    const COLUMNAS_NUEVAS = columnasMySQL();
    for (const [tabla, nombre, tipo] of COLUMNAS_NUEVAS) {
      try {
        await pool.query(`ALTER TABLE ${tabla} ADD COLUMN ${nombre} ${tipo}`);
      } catch (err) {
        if (!err || err.code !== 'ER_DUP_FIELDNAME') throw err;
      }
    }

    await pool.query(
      "UPDATE proyectos SET uuid = UUID() WHERE uuid IS NULL OR TRIM(uuid) = ''"
    );
    await deduplicarUuidsMySQL(pool);
    try {
      await pool.query('ALTER TABLE proyectos ADD UNIQUE INDEX uq_proyectos_uuid (uuid)');
    } catch (err) {
      if (!err || !['ER_DUP_KEYNAME', 'ER_DUP_KEY'].includes(err.code)) {
        console.warn(`[mysql] No se pudo crear uq_proyectos_uuid: ${err.message}`);
        await asegurarIndiceMySQL(pool, 'proyectos', 'idx_proyectos_uuid', '(uuid)');
      }
    }

    await deduplicarExclusionesMySQL(pool);
    try {
      await pool.query(
        'ALTER TABLE relaciones_exclusiones ADD UNIQUE INDEX uq_exclusion (bloque_id, regla, firma)'
      );
    } catch (err) {
      if (!err || !['ER_DUP_KEYNAME', 'ER_DUP_KEY'].includes(err.code)) {
        console.warn(`[mysql] No se pudo crear uq_exclusion: ${err.message}`);
        await asegurarIndiceMySQL(
          pool,
          'relaciones_exclusiones',
          'idx_exclusion_bloque_regla_firma',
          '(bloque_id, regla, firma)'
        );
      }
    }

    for (const sentencia of [
      'ALTER TABLE relaciones ADD INDEX idx_relacion_proyecto_origen (proyecto_id, origen_tipo, origen_id)',
      'ALTER TABLE relaciones ADD INDEX idx_relacion_proyecto_destino (proyecto_id, destino_tipo, destino_id)',
      'ALTER TABLE relaciones ADD INDEX idx_relacion_bloque_regla (bloque_id, regla, procedencia)',
      'ALTER TABLE personas ADD INDEX idx_persona_institucion (institucion_id)',
      'ALTER TABLE relaciones ADD INDEX idx_relacion_lugar_inicio (lugar_inicio)',
      'ALTER TABLE relaciones ADD INDEX idx_relacion_lugar_fin (lugar_fin)',
      'ALTER TABLE cuadernos ADD INDEX idx_cuaderno_fuente_posicion (fuente_id, posicion, id)',
      'ALTER TABLE proyectos ADD INDEX idx_proyecto_fecha (fecha_modificacion)',
    ]) {
      try {
        await pool.query(sentencia);
      } catch (err) {
        if (!err || !['ER_DUP_KEYNAME', 'ER_DUP_KEY'].includes(err.code)) throw err;
      }
    }

    /* Referencias heredadas: ninguna ficha debe apuntar a una entidad inexistente. */
    const limpieza = await pool.getConnection();
    try {
      await limpieza.beginTransaction();
      await limpieza.query(
        `UPDATE personas SET institucion_id = NULL
         WHERE institucion_id IS NOT NULL
           AND NOT EXISTS (SELECT 1 FROM instituciones i WHERE i.id = personas.institucion_id)`
      );
      await limpieza.query(
        `UPDATE instituciones SET lugar_id = NULL
         WHERE lugar_id IS NOT NULL
           AND NOT EXISTS (SELECT 1 FROM lugares l WHERE l.id = instituciones.lugar_id)`
      );
      await limpieza.query(
        `UPDATE patrimonios SET lugar_id = NULL
         WHERE lugar_id IS NOT NULL
           AND NOT EXISTS (SELECT 1 FROM lugares l WHERE l.id = patrimonios.lugar_id)`
      );
      await limpieza.query(
        `UPDATE relaciones SET lugar_inicio = NULL
         WHERE lugar_inicio IS NOT NULL
           AND NOT EXISTS (SELECT 1 FROM lugares l WHERE l.id = relaciones.lugar_inicio)`
      );
      await limpieza.query(
        `UPDATE relaciones SET lugar_fin = NULL
         WHERE lugar_fin IS NOT NULL
           AND NOT EXISTS (SELECT 1 FROM lugares l WHERE l.id = relaciones.lugar_fin)`
      );
      await limpieza.query(
        `UPDATE relaciones SET bloque_id = NULL
         WHERE bloque_id IS NOT NULL
           AND NOT EXISTS (SELECT 1 FROM bloques_registro b WHERE b.id = relaciones.bloque_id)`
      );
      await limpieza.query(
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
      await limpieza.query(
        `DELETE e FROM relaciones_exclusiones e
         LEFT JOIN bloques_registro b ON b.id = e.bloque_id
         WHERE b.id IS NULL`
      );
      await limpieza.query(
        `DELETE rf FROM relaciones_fuentes rf
         LEFT JOIN relaciones r ON r.id = rf.relacion_id
         WHERE r.id IS NULL`
      );
      await limpieza.query(
        `DELETE rf FROM relaciones_fuentes rf
         LEFT JOIN fuentes f ON f.id = rf.fuente_id
         WHERE f.id IS NULL`
      );
      await limpieza.commit();
    } catch (err) {
      try { await limpieza.rollback(); } catch { /* transacción perdida */ }
      throw err;
    } finally {
      limpieza.release();
    }

    /* Integridad de personas.institucion_id en MySQL (SQLite ya la declara). */
    const [fkInstitucion] = await pool.query(
      `SELECT CONSTRAINT_NAME FROM information_schema.KEY_COLUMN_USAGE
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME = 'personas'
         AND COLUMN_NAME = 'institucion_id'
         AND REFERENCED_TABLE_NAME = 'instituciones'
       LIMIT 1`
    );
    if (!fkInstitucion.length) {
      try {
        await pool.query(
          `ALTER TABLE personas
           ADD CONSTRAINT fk_persona_institucion
           FOREIGN KEY (institucion_id) REFERENCES instituciones(id) ON DELETE SET NULL`
        );
      } catch (err) {
        if (!err || !['ER_DUP_KEYNAME', 'ER_FK_DUP_NAME'].includes(err.code)) throw err;
      }
    }

    /* PERSONAS: el nombre y los apellidos son alternativos. Basta con uno de
       los dos, por lo que la columna nombre deja de ser obligatoria. */
    const [columnaNombre] = await pool.query(
      `SELECT IS_NULLABLE FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'personas' AND COLUMN_NAME = 'nombre'`
    );
    if (columnaNombre.length && columnaNombre[0].IS_NULLABLE === 'NO') {
      await pool.query('ALTER TABLE personas MODIFY COLUMN nombre VARCHAR(255) NULL');
    }

    /* Unificación de etiquetas antiguas de RELACIONES (lista compartida). */
    await renombrarTiposRelacion(pool);

    /* CORRESPONSALES se sustituye por dos tipos según el formulario que las
       generó: COMUNICACIONES → legales; EPÍSTOLAS → personales. Las manuales
       se asignan por el tipo de sus extremos y, si no, a personales. */
    await pool.query(
      "UPDATE relaciones SET tipo = 'Correspondientes legales', firma = '' WHERE tipo = 'Corresponsales' AND regla LIKE 'comunicaciones:%'"
    );
    await pool.query(
      "UPDATE relaciones SET tipo = 'Correspondientes personales', firma = '' WHERE tipo = 'Corresponsales' AND regla LIKE 'epistolas:%'"
    );
    await pool.query(
      "UPDATE relaciones SET tipo = 'Correspondientes legales', firma = '' WHERE tipo = 'Corresponsales' AND (origen_tipo = 'institucion' OR destino_tipo = 'institucion')"
    );
    await pool.query(
      "UPDATE relaciones SET tipo = 'Correspondientes personales', firma = '' WHERE tipo = 'Corresponsales'"
    );

    /* Las versiones anteriores generaban las relaciones «Sede» de los bloques
       en sentido INSTITUCIÓN → LUGAR. Se corrigen las automáticas heredadas;
       las manuales/editadas se conservan. */
    await corregirSedesAutomaticasInvertidas(pool);

    /* Integridad: una relación AUTOMATIZADA no puede sobrevivir al bloque
       que la generó. Las EDITADAS sí se conservan al borrar el bloque. */
    await pool.query(
      `DELETE r FROM relaciones r
       LEFT JOIN bloques_registro b ON b.id = r.bloque_id
       WHERE r.bloque_id IS NOT NULL
         AND r.procedencia = 'AUTOMATIZADA'
         AND b.id IS NULL`
    );
    await pool.query(
      `DELETE e FROM relaciones_exclusiones e
       LEFT JOIN bloques_registro b ON b.id = e.bloque_id
       WHERE b.id IS NULL`
    );

    /* Las columnas de texto antiguo (fecha_nacimiento, fecha_fundacion,
       anio…) conservan el texto histórico tal cual se escribió y sirven de
       cantera: extraemos de ellas el año (o los dos si son rango) hacia los
       campos estructurados. IFNULL evita alterar valores ya extraídos.
       En instalaciones nuevas esas columnas no existen: se omiten. */
    const existeColumna = async (tabla, columna) => {
      const [filas] = await pool.query(
        `SELECT 1 FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?
         LIMIT 1`,
        [tabla, columna]
      );
      return filas.length > 0;
    };
    const cruzar = async (tabla, fuenteTexto, destinoIni, destinoFin) => {
      if (!await existeColumna(tabla, fuenteTexto)) return;
      const [filas] = await pool.query(
        `SELECT id, ${fuenteTexto} t FROM ${tabla} WHERE ${fuenteTexto} IS NOT NULL`
      );
      for (const f of filas) {
        const anios = extraerAnios(f.t);
        if (!anios.length) continue;
        const ini = anios[0];
        const fin = anios.length >= 2 ? anios[anios.length - 1] : null;
        if (destinoIni === destinoFin) {
          const valor = (tabla === 'relaciones' && fuenteTexto === 'fecha_fin') ? (fin ?? ini) : ini;
          await pool.query(
            `UPDATE ${tabla} SET ${destinoIni} = IFNULL(${destinoIni}, ?) WHERE id = ?`,
            [valor, f.id]
          );
          continue;
        }
        await pool.query(
          `UPDATE ${tabla} SET ${destinoIni} = IFNULL(${destinoIni}, ?), ${destinoFin} = IFNULL(${destinoFin}, ?) WHERE id = ?`,
          [ini, fin, f.id]
        );
      }
    };
    await cruzar('personas', 'fecha_nacimiento', 'anio_nacimiento', 'anio_nacimiento');
    await cruzar('personas', 'fecha_defuncion', 'anio_defuncion', 'anio_defuncion');
    await cruzar('instituciones', 'fecha_fundacion', 'anio_fundacion', 'anio_fundacion');
    await cruzar('instituciones', 'fecha_disolucion', 'anio_disolucion', 'anio_disolucion');
    await cruzar('relaciones', 'fecha_inicio', 'anio_inicio', 'anio_fin');
    await cruzar('relaciones', 'fecha_fin', 'anio_fin', 'anio_fin');
    await cruzar('fuentes', 'anio', 'anio_inicio', 'anio_fin');

    /* Identificadores alfanuméricos: rellenar registros anteriores por proyecto. */
    for (const [tipo, tabla] of Object.entries({ persona: 'personas', institucion: 'instituciones', lugar: 'lugares', patrimonio: 'patrimonios' })) {
      const prefijo = PREFIJOS_ID[tipo];
      const [pendientes] = await pool.query(
        `SELECT id, proyecto_id FROM ${tabla}
         WHERE identificador IS NULL OR TRIM(identificador) = ''
         ORDER BY proyecto_id, id`
      );
      const siguientes = new Map();
      for (const fila of pendientes) {
        if (!siguientes.has(fila.proyecto_id)) {
          const [maximos] = await pool.query(
            `SELECT MAX(CAST(SUBSTRING(identificador, ${prefijo.length + 1}) AS UNSIGNED)) AS ultimo
             FROM ${tabla} WHERE proyecto_id = ? AND identificador LIKE ?`,
            [fila.proyecto_id, `${prefijo}%`]
          );
          siguientes.set(fila.proyecto_id, (Number(maximos[0].ultimo) || 0) + 1);
        }
        const siguiente = siguientes.get(fila.proyecto_id);
        const identificador = `${prefijo}${String(siguiente).padStart(5, '0')}`;
        siguientes.set(fila.proyecto_id, siguiente + 1);
        await pool.query(`UPDATE ${tabla} SET identificador = ? WHERE id = ?`, [identificador, fila.id]);
      }
      const [filas] = await pool.query(
        `SELECT id, proyecto_id, identificador FROM ${tabla}
         WHERE identificador IS NOT NULL AND TRIM(identificador) <> ''
         ORDER BY proyecto_id, identificador, id`
      );
      const vistos = new Set();
      for (const fila of filas) {
        const clave = `${fila.proyecto_id}\u0000${fila.identificador}`;
        if (!vistos.has(clave)) {
          vistos.add(clave);
          continue;
        }
        const [maximos] = await pool.query(
          `SELECT MAX(CAST(SUBSTRING(identificador, ${prefijo.length + 1}) AS UNSIGNED)) AS ultimo
           FROM ${tabla} WHERE proyecto_id = ? AND identificador LIKE ?`,
          [fila.proyecto_id, `${prefijo}%`]
        );
        let siguiente = (Number(maximos[0].ultimo) || 0) + 1;
        let identificador = `${prefijo}${String(siguiente).padStart(5, '0')}`;
        while (vistos.has(`${fila.proyecto_id}\u0000${identificador}`)) {
          siguiente += 1;
          identificador = `${prefijo}${String(siguiente).padStart(5, '0')}`;
        }
        await pool.query(`UPDATE ${tabla} SET identificador = ? WHERE id = ?`, [identificador, fila.id]);
        vistos.add(`${fila.proyecto_id}\u0000${identificador}`);
      }
      try {
        await pool.query(`ALTER TABLE ${tabla} ADD UNIQUE INDEX uq_${tabla}_identificador (proyecto_id, identificador)`);
      } catch (err) {
        if (!err || !['ER_DUP_KEYNAME', 'ER_DUP_ENTRY'].includes(err.code)) throw err;
        if (err.code === 'ER_DUP_ENTRY') {
          console.warn(`[mysql] No se pudo crear el índice único de ${tabla}: ${err.message}`);
          await asegurarIndiceMySQL(
            pool,
            tabla,
            `idx_${tabla}_identificador`,
            '(proyecto_id, identificador)'
          );
        }
      }
    }

    await migrarV10MySQL(pool);
    await pool.query(
      'INSERT IGNORE INTO schema_migrations (version) VALUES (?)',
      [ESQUEMA_VERSION_MYSQL]
    );
    }
}

async function migrarV10MySQL(pool) {
  await pool.query(
    `DELETE FROM relaciones
     WHERE origen_tipo = destino_tipo AND origen_id = destino_id
       AND (procedencia = 'AUTOMATIZADA' OR bloque_id IS NOT NULL)`
  );
  await pool.query(
    `UPDATE relaciones r
     LEFT JOIN bloques_registro b ON b.id = r.bloque_id
     SET r.bloque_id = NULL
     WHERE r.procedencia = 'EDITADA' AND r.bloque_id IS NOT NULL AND b.id IS NULL`
  );

  /* MySQL evalúa las asignaciones de izquierda a derecha; hay que leer los
     dos valores originales desde una tabla derivada para no perder uno. */
  await pool.query(
    `UPDATE coincidencias c
     JOIN (
       SELECT id, LEAST(entidad_a, entidad_b) AS a, GREATEST(entidad_a, entidad_b) AS b
       FROM coincidencias WHERE entidad_a > entidad_b
     ) x ON x.id = c.id
     SET c.entidad_a = x.a, c.entidad_b = x.b`
  );
  await pool.query(
    `DELETE c1 FROM coincidencias c1
     JOIN coincidencias c2
       ON c1.proyecto_id = c2.proyecto_id
      AND c1.tipo = c2.tipo
      AND c1.entidad_a = c2.entidad_a
      AND c1.entidad_b = c2.entidad_b
      AND c1.id > c2.id`
  );
  try {
    await pool.query(
      'ALTER TABLE coincidencias ADD UNIQUE INDEX uq_coincidencia_par (proyecto_id, tipo, entidad_a, entidad_b)'
    );
  } catch (err) {
    if (!err || !['ER_DUP_KEYNAME', 'ER_DUP_KEY'].includes(err.code)) {
      console.warn(`[mysql] No se pudo crear uq_coincidencia_par: ${err.message}`);
      await asegurarIndiceMySQL(
        pool,
        'coincidencias',
        'idx_coincidencia_par',
        '(proyecto_id, tipo, entidad_a, entidad_b)'
      );
    }
  }

  const [cuadernos] = await pool.query(
    'SELECT id, fuente_id FROM cuadernos ORDER BY fuente_id, posicion, id'
  );
  let fuente = null;
  let posicion = 0;
  for (const cuaderno of cuadernos) {
    if (String(cuaderno.fuente_id) !== String(fuente)) {
      fuente = cuaderno.fuente_id;
      posicion = 0;
    }
    posicion++;
    await pool.query('UPDATE cuadernos SET posicion = ? WHERE id = ?', [posicion, cuaderno.id]);
  }
  try {
    await pool.query(
      'ALTER TABLE cuadernos ADD UNIQUE INDEX uq_cuaderno_posicion (fuente_id, posicion)'
    );
  } catch (err) {
    if (!err || !['ER_DUP_KEYNAME', 'ER_DUP_KEY'].includes(err.code)) {
      console.warn(`[mysql] No se pudo crear uq_cuaderno_posicion: ${err.message}`);
      await asegurarIndiceMySQL(
        pool,
        'cuadernos',
        'idx_cuaderno_posicion',
        '(fuente_id, posicion)'
      );
    }
  }
}

async function migrarReferenciasBloquesMySQL(pool) {
  const [bloques] = await pool.query('SELECT id, tipo, datos FROM bloques_registro');
  for (const bloque of bloques) {
    let datos;
    try {
      datos = bloque.datos ? JSON.parse(bloque.datos) : {};
    } catch {
      /* Si el bloque está corrupto, conservar sus referencias anteriores:
         reconstruirlas desde cero las perdería. */
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
    await pool.query('DELETE FROM bloque_referencias WHERE bloque_id = ?', [bloque.id]);
    for (const [tipo, conjunto] of Object.entries(ids)) {
      for (const valor of conjunto) {
        const entidadId = Number(valor);
        if (!Number.isInteger(entidadId) || entidadId <= 0) continue;
        await pool.query(
          'INSERT IGNORE INTO bloque_referencias (bloque_id, entidad_tipo, entidad_id) VALUES (?, ?, ?)',
          [bloque.id, tipo, entidadId]
        );
      }
    }
  }
}

async function asegurarIndiceMySQL(pool, tabla, nombre, columnas) {  try {
    await pool.query(`ALTER TABLE ${tabla} ADD INDEX ${nombre} ${columnas}`);
  } catch (err) {
    if (!err || !['ER_DUP_KEYNAME', 'ER_DUP_KEY'].includes(err.code)) throw err;
  }
}

async function deduplicarUuidsMySQL(pool) {
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

async function deduplicarExclusionesMySQL(pool) {
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

module.exports = { crearEsquemaMySQL, ESQUEMA_VERSION_MYSQL };
