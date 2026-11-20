'use strict';

/* H-IMAGO · Definiciones de entidades, tipos y campos comunes.
   Separadas de la fachada de datos para que SQLite, MySQL y las pruebas
   compartan exactamente el mismo contrato. */

/* Etiquetas antiguas de la taxonomía que se unificaron con los nombres
   usados por los campos de los bloques de registro. */
const TIPOS_RELACION_RENOMBRADOS = {
  'Notario/Escribano': 'Escribano/Notario',
  'Otorgante – Notario/Escribano': 'Otorgante – Escribano/Notario',
  'Donante – Beneficiario': 'Mecenas/Donante – Beneficiario',
  'Mecenas/Benefactor – Beneficiario': 'Mecenas/Donante – Beneficiario',
  'Comisionista – Dependiente': 'Comitente – Comisionista',
  'Contratista/Comisionista': 'Asentista/contratista',
  'Espía': 'Espía – Espiado',
  'Espiado': 'Espía – Espiado',
  'Infiltrado': 'Espía/Infiltrado',
  'Señor – Esclavo': 'Patrón – Esclavo',
  'Cómplices': 'Cómplice – Infractor',
  'Enamorado': 'Enamorados',
  'Encubridor – Encubierto': 'Encubridor – Infractor',
  'Encubridor': 'Encubridor – Infractor',
  'Rechazo': 'No correspondido',
  'Ambivalencia': 'Ambivalentes',
  'Indiferente': 'Indiferentes',
  'Sobrestima': 'Sobrestimado',
  'Subestima': 'Subestimado',
  'Violencia': 'Violentador – Violentado',
};

const normalizarTipoRelacion = (tipo) => {
  if (tipo === null || tipo === undefined) return null;
  const texto = String(tipo).trim();
  return TIPOS_RELACION_RENOMBRADOS[texto] || texto;
};

const DEFINICIONES = {
  persona: {
    tabla: 'personas',
    orden: 'COALESCE(NULLIF(TRIM(apellidos), \'\'), nombre), nombre',
    campoNombre: "CONCAT_WS(' ', NULLIF(nombre,''), NULLIF(apellidos,''))",
    campoNombreSQLite: "TRIM(COALESCE(nombre,'') || ' ' || COALESCE(apellidos,''))",
    campos: ['identificador', 'nombre', 'apellidos', 'alias', 'genero', 'anio_nacimiento', 'fecha_exacta_nacimiento', 'fecha_exacta_nacimiento_meta', 'anio_defuncion', 'fecha_exacta_defuncion', 'fecha_exacta_defuncion_meta', 'lugar_nacimiento', 'lugar_defuncion', 'institucion_id', 'tratamiento', 'ocupacion', 'notas'],
    numericos: ['anio_nacimiento', 'anio_defuncion', 'institucion_id'],
  },
  institucion: {
    tabla: 'instituciones',
    orden: 'nombre',
    campoNombre: 'nombre',
    campos: ['identificador', 'nombre', 'tipo', 'anio_fundacion', 'fecha_exacta_fundacion', 'fecha_exacta_fundacion_meta', 'anio_disolucion', 'fecha_exacta_disolucion', 'fecha_exacta_disolucion_meta', 'lugar_id', 'notas'],
    numericos: ['lugar_id', 'anio_fundacion', 'anio_disolucion'],
  },
  lugar: {
    tabla: 'lugares',
    orden: 'nombre',
    campoNombre: 'nombre',
    campos: ['identificador', 'nombre', 'tipo', 'latitud', 'longitud', 'notas'],
    numericos: ['latitud', 'longitud'],
  },
  patrimonio: {
    tabla: 'patrimonios',
    orden: 'nombre',
    campoNombre: 'nombre',
    campos: ['identificador', 'nombre', 'tipo', 'propietario', 'lugar_id', 'valor', 'descripcion', 'notas'],
    numericos: ['lugar_id'],
  },
  fuente: {
    tabla: 'fuentes',
    orden: 'titulo',
    campoNombre: 'titulo',
    campos: ['titulo', 'categoria', 'tipo', 'autor', 'lugar', 'repositorio', 'fondo', 'signatura', 'editorial', 'libro', 'editor', 'paginas', 'revista', 'anio_publicacion', 'volumen', 'numero', 'doi', 'evento', 'facultad', 'universidad', 'anio_inicio', 'anio_fin', 'fecha_exacta', 'ubicacion', 'referencia', 'transcripcion', 'notas'],
    numericos: ['anio_inicio', 'anio_fin', 'anio_publicacion'],
  },
};

const TIPOS_GRAFO = ['persona', 'institucion', 'lugar', 'patrimonio'];
const TIPOS_ENTIDAD = [...TIPOS_GRAFO, 'fuente'];

/* Límites de MySQL compartidos con SQLite para que un proyecto pueda
   trasladarse entre ambos motores sin truncamientos silenciosos. */
const LIMITES_CAMPOS = {
  personas: {
    identificador: 12, nombre: 255, apellidos: 255, alias: 255, genero: 60,
    lugar_nacimiento: 255, lugar_defuncion: 255, tratamiento: 255,
    ocupacion: 255, notas: 65535, fecha_exacta_nacimiento: 255,
    fecha_exacta_defuncion: 255,
    fecha_exacta_nacimiento_meta: 65535, fecha_exacta_defuncion_meta: 65535,
  },
  instituciones: {
    identificador: 12, nombre: 255, tipo: 120, notas: 65535,
    fecha_exacta_fundacion: 255, fecha_exacta_disolucion: 255,
    fecha_exacta_fundacion_meta: 65535, fecha_exacta_disolucion_meta: 65535,
  },
  lugares: {
    identificador: 12, nombre: 255, tipo: 120, notas: 65535,
  },
  patrimonios: {
    identificador: 12, nombre: 255, tipo: 120, propietario: 255,
    valor: 255, descripcion: 65535, notas: 65535,
  },
  fuentes: {
    titulo: 400, tipo: 120, autor: 255, categoria: 120, lugar: 255,
    repositorio: 255, fondo: 255, signatura: 255, editorial: 255,
    libro: 400, editor: 255, paginas: 80, revista: 255, volumen: 80,
    numero: 80, doi: 255, evento: 400, facultad: 255, universidad: 255,
    fecha_exacta: 255, ubicacion: 400, referencia: 400, notas: 65535,
  },
};

/* Prefijos de identificación alfanumérica por tipo de entidad */
const PREFIJOS_ID = { persona: 'PE', institucion: 'IN', lugar: 'LU', patrimonio: 'PA' };

/* Campos mínimos para listas y desplegables. Evitan cargar LONGTEXT como
   `fuentes.transcripcion` en cada listado. */
const CAMPOS_RESUMEN = {
  persona: 'id, identificador, nombre, apellidos, alias, genero, anio_nacimiento, anio_defuncion, lugar_nacimiento, tratamiento, ocupacion',
  institucion: 'id, identificador, nombre, tipo, anio_fundacion, anio_disolucion',
  lugar: 'id, identificador, nombre, tipo, latitud, longitud',
  patrimonio: 'id, identificador, nombre, tipo, propietario, valor',
  fuente: 'id, titulo, categoria, tipo, autor, anio_inicio, anio_fin, repositorio, ubicacion',
};

module.exports = {
  TIPOS_RELACION_RENOMBRADOS,
  normalizarTipoRelacion,
  DEFINICIONES,
  TIPOS_GRAFO,
  TIPOS_ENTIDAD,
  PREFIJOS_ID,
  CAMPOS_RESUMEN,
  LIMITES_CAMPOS,
};
