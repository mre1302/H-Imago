'use strict';

/* H-IMAGO · Definición única de las columnas añadidas por las migraciones.
   Cada entrada es [tabla, columna, tipo SQLite, tipo MySQL/MariaDB].
   SQLite y MySQL construyen sus listas desde esta misma fuente para evitar
   que ambos esquemas diverjan. */

const COLUMNAS_NUEVAS = [
  ['proyectos', 'descripcion', 'TEXT', 'TEXT NULL'],
  ['proyectos', 'creador', 'TEXT', 'VARCHAR(255) NULL'],
  ['proyectos', 'fecha_creacion', 'TEXT', 'DATETIME NULL'],
  ['proyectos', 'fecha_modificacion', 'TEXT', 'DATETIME NULL'],
  ['proyectos', 'uuid', 'TEXT', 'CHAR(36) NULL'],

  ['personas', 'nombre', 'TEXT', 'VARCHAR(255) NULL'],
  ['personas', 'apellidos', 'TEXT', 'VARCHAR(255) NULL'],
  ['personas', 'alias', 'TEXT', 'VARCHAR(255) NULL'],
  ['personas', 'genero', 'TEXT', 'VARCHAR(60) NULL'],
  ['personas', 'lugar_nacimiento', 'TEXT', 'VARCHAR(255) NULL'],
  ['personas', 'tratamiento', 'TEXT', 'VARCHAR(255) NULL'],
  ['personas', 'ocupacion', 'TEXT', 'VARCHAR(255) NULL'],
  ['personas', 'notas', 'TEXT', 'TEXT NULL'],
  ['personas', 'identificador', 'TEXT', 'VARCHAR(12) NULL'],
  ['personas', 'anio_nacimiento', 'INTEGER', 'INT NULL'],
  ['personas', 'fecha_exacta_nacimiento', 'TEXT', 'VARCHAR(255) NULL'],
  ['personas', 'fecha_exacta_nacimiento_meta', 'TEXT', 'TEXT NULL'],
  ['personas', 'anio_defuncion', 'INTEGER', 'INT NULL'],
  ['personas', 'fecha_exacta_defuncion', 'TEXT', 'VARCHAR(255) NULL'],
  ['personas', 'fecha_exacta_defuncion_meta', 'TEXT', 'TEXT NULL'],
  ['personas', 'lugar_defuncion', 'TEXT', 'VARCHAR(255) NULL'],
  ['personas', 'institucion_id', 'INTEGER', 'INT NULL'],

  ['instituciones', 'nombre', 'TEXT', 'VARCHAR(255) NULL'],
  ['instituciones', 'tipo', 'TEXT', 'VARCHAR(120) NULL'],
  ['instituciones', 'lugar_id', 'INTEGER', 'INT NULL'],
  ['instituciones', 'notas', 'TEXT', 'TEXT NULL'],
  ['instituciones', 'identificador', 'TEXT', 'VARCHAR(12) NULL'],
  ['instituciones', 'anio_fundacion', 'INTEGER', 'INT NULL'],
  ['instituciones', 'fecha_exacta_fundacion', 'TEXT', 'VARCHAR(255) NULL'],
  ['instituciones', 'fecha_exacta_fundacion_meta', 'TEXT', 'TEXT NULL'],
  ['instituciones', 'anio_disolucion', 'INTEGER', 'INT NULL'],
  ['instituciones', 'fecha_exacta_disolucion', 'TEXT', 'VARCHAR(255) NULL'],
  ['instituciones', 'fecha_exacta_disolucion_meta', 'TEXT', 'TEXT NULL'],

  ['lugares', 'nombre', 'TEXT', 'VARCHAR(255) NULL'],
  ['lugares', 'tipo', 'TEXT', 'VARCHAR(120) NULL'],
  ['lugares', 'identificador', 'TEXT', 'VARCHAR(12) NULL'],
  ['lugares', 'latitud', 'REAL', 'DECIMAL(10,7) NULL'],
  ['lugares', 'longitud', 'REAL', 'DECIMAL(10,7) NULL'],
  ['lugares', 'notas', 'TEXT', 'TEXT NULL'],

  ['patrimonios', 'nombre', 'TEXT', 'VARCHAR(255) NULL'],
  ['patrimonios', 'tipo', 'TEXT', 'VARCHAR(120) NULL'],
  ['patrimonios', 'propietario', 'TEXT', 'VARCHAR(255) NULL'],
  ['patrimonios', 'valor', 'TEXT', 'VARCHAR(255) NULL'],
  ['patrimonios', 'identificador', 'TEXT', 'VARCHAR(12) NULL'],
  ['patrimonios', 'lugar_id', 'INTEGER', 'INT NULL'],
  ['patrimonios', 'descripcion', 'TEXT', 'TEXT NULL'],
  ['patrimonios', 'notas', 'TEXT', 'TEXT NULL'],

  ['fuentes', 'titulo', 'TEXT', 'VARCHAR(400) NULL'],
  ['fuentes', 'tipo', 'TEXT', 'VARCHAR(120) NULL'],
  ['fuentes', 'autor', 'TEXT', 'VARCHAR(255) NULL'],
  ['fuentes', 'categoria', 'TEXT', 'VARCHAR(120) NULL'],
  ['fuentes', 'lugar', 'TEXT', 'VARCHAR(255) NULL'],
  ['fuentes', 'repositorio', 'TEXT', 'VARCHAR(255) NULL'],
  ['fuentes', 'fondo', 'TEXT', 'VARCHAR(255) NULL'],
  ['fuentes', 'signatura', 'TEXT', 'VARCHAR(255) NULL'],
  ['fuentes', 'editorial', 'TEXT', 'VARCHAR(255) NULL'],
  ['fuentes', 'libro', 'TEXT', 'VARCHAR(400) NULL'],
  ['fuentes', 'editor', 'TEXT', 'VARCHAR(255) NULL'],
  ['fuentes', 'paginas', 'TEXT', 'VARCHAR(80) NULL'],
  ['fuentes', 'revista', 'TEXT', 'VARCHAR(255) NULL'],
  ['fuentes', 'anio_publicacion', 'INTEGER', 'INT NULL'],
  ['fuentes', 'volumen', 'TEXT', 'VARCHAR(80) NULL'],
  ['fuentes', 'numero', 'TEXT', 'VARCHAR(80) NULL'],
  ['fuentes', 'doi', 'TEXT', 'VARCHAR(255) NULL'],
  ['fuentes', 'evento', 'TEXT', 'VARCHAR(400) NULL'],
  ['fuentes', 'facultad', 'TEXT', 'VARCHAR(255) NULL'],
  ['fuentes', 'universidad', 'TEXT', 'VARCHAR(255) NULL'],
  ['fuentes', 'anio_inicio', 'INTEGER', 'INT NULL'],
  ['fuentes', 'anio_fin', 'INTEGER', 'INT NULL'],
  ['fuentes', 'fecha_exacta', 'TEXT', 'VARCHAR(255) NULL'],
  ['fuentes', 'ubicacion', 'TEXT', 'VARCHAR(400) NULL'],
  ['fuentes', 'referencia', 'TEXT', 'VARCHAR(400) NULL'],
  ['fuentes', 'transcripcion', 'TEXT', 'LONGTEXT NULL'],
  ['fuentes', 'notas', 'TEXT', 'TEXT NULL'],

  ['cuadernos', 'fuente_id', 'INTEGER', 'INT NULL'],
  ['cuadernos', 'posicion', 'INTEGER', 'INT NULL'],
  ['cuadernos', 'contenido', 'TEXT', 'LONGTEXT NULL'],
  ['cuadernos', 'fojas', 'TEXT', 'LONGTEXT NULL'],
  ['cuadernos', 'fecha_creacion', 'TEXT', 'DATETIME NULL'],
  ['cuadernos', 'fecha_modificacion', 'TEXT', 'DATETIME NULL'],

  ['coincidencias', 'proyecto_id', 'INTEGER', 'INT NULL'],
  ['coincidencias', 'tipo', 'TEXT', 'VARCHAR(40) NULL'],
  ['coincidencias', 'entidad_a', 'INTEGER', 'INT NULL'],
  ['coincidencias', 'entidad_b', 'INTEGER', 'INT NULL'],
  ['coincidencias', 'notas', 'TEXT', 'TEXT NULL'],
  ['coincidencias', 'fecha_creacion', 'TEXT', 'DATETIME NULL'],

  ['relaciones_exclusiones', 'proyecto_id', 'INTEGER', 'INT NULL'],
  ['relaciones_exclusiones', 'bloque_id', 'INTEGER', 'INT NULL'],
  ['relaciones_exclusiones', 'regla', 'TEXT', 'VARCHAR(160) NULL'],
  ['relaciones_exclusiones', 'firma', 'TEXT', 'VARCHAR(64) NULL'],
  ['relaciones_exclusiones', 'fecha_creacion', 'TEXT', 'DATETIME NULL'],

  ['bloques_registro', 'fuente_id', 'INTEGER', 'INT NULL'],
  ['bloques_registro', 'tipo', 'TEXT', 'VARCHAR(160) NULL'],
  ['bloques_registro', 'periodo', "TEXT NOT NULL DEFAULT 'siglos-xviii-xix'", "VARCHAR(40) NOT NULL DEFAULT 'siglos-xviii-xix'"],
  ['bloques_registro', 'region', "TEXT NOT NULL DEFAULT 'hispanoamerica'", "VARCHAR(60) NOT NULL DEFAULT 'hispanoamerica'"],
  ['bloques_registro', 'categoria', 'TEXT', 'VARCHAR(120) NULL'],
  ['bloques_registro', 'datos', 'TEXT', 'LONGTEXT NULL'],
  ['bloques_registro', 'fecha_creacion', 'TEXT', 'DATETIME NULL'],
  ['bloques_registro', 'fecha_modificacion', 'TEXT', 'DATETIME NULL'],

  ['relaciones', 'anio_inicio', 'INTEGER', 'INT NULL'],
  ['relaciones', 'fecha_exacta_inicio', 'TEXT', 'VARCHAR(255) NULL'],
  ['relaciones', 'fecha_exacta_inicio_meta', 'TEXT', 'TEXT NULL'],
  ['relaciones', 'lugar_inicio', 'INTEGER', 'INT NULL'],
  ['relaciones', 'anio_fin', 'INTEGER', 'INT NULL'],
  ['relaciones', 'fecha_exacta_fin', 'TEXT', 'VARCHAR(255) NULL'],
  ['relaciones', 'fecha_exacta_fin_meta', 'TEXT', 'TEXT NULL'],
  ['relaciones', 'lugar_fin', 'INTEGER', 'INT NULL'],
  ['relaciones', 'notas', 'TEXT', 'TEXT NULL'],
  ['relaciones', 'procedencia', "TEXT NOT NULL DEFAULT 'MANUAL'", "VARCHAR(20) NOT NULL DEFAULT 'MANUAL'"],
  ['relaciones', 'bloque_id', 'INTEGER', 'INT NULL'],
  ['relaciones', 'regla', 'TEXT', 'VARCHAR(160) NULL'],
  ['relaciones', 'firma', 'TEXT', 'VARCHAR(64) NULL'],
];

function columnasSQLite() {
  const salida = {};
  for (const [tabla, nombre, tipoSQLite] of COLUMNAS_NUEVAS) {
    if (!salida[tabla]) salida[tabla] = [];
    salida[tabla].push([nombre, tipoSQLite]);
  }
  return salida;
}

function columnasMySQL() {
  return COLUMNAS_NUEVAS.map(([tabla, nombre, , tipoMySQL]) => [tabla, nombre, tipoMySQL]);
}

module.exports = { COLUMNAS_NUEVAS, columnasSQLite, columnasMySQL };
