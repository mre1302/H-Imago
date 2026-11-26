'use strict';

/* H-IMAGO · Taxonomía de FUENTES
   Fuente canónica: la tabla interna del proyecto, no distribuida.
   Dos niveles: CATEGORÍA → TIPO DE FUENTE. El formulario de fuentes ofrece la
   categoría y un selector de tipos dependiente de ella. */

const FUENTES_TAXONOMIA = {
  'Registros institucionales': [
    'Actas, acuerdos, resoluciones',
    'Leyes, decretos, ordenanzas, reglamentos',
    'Expedientes administrativos',
    'Matrículas',
    'Hojas de servicio',
    'Títulos, certificados',
    'Comunicaciones',
  ],
  'Registros vitales': [
    'Nacimientos',
    'Matrimonios',
    'Defunciones',
  ],
  'Registros notariales': [
    'Testamentos',
    'Donaciones',
    'Poderes',
    'Legados testamentarios',
    'Compra/ventas',
    'Arriendos',
    'Obligaciones',
    'Hipotecas',
    'Fianzas',
    'Exacciones',
  ],
  'Registros judiciales': [
    'Causas civiles',
    'Causas criminales',
    'Autos',
    'Probanzas',
    'Informaciones',
    'Residencias',
    'Visitas',
  ],
  'Registros personales y narrativos': [
    'Memorias',
    'Crónicas',
    'Registros personales',
  ],
  'Registros literarios y artísticos': [
    'Poesía',
    'Letras de canciones/coplas',
    'Teatro',
  ],
  'Cartográficas': [
    'Mapas, planos',
  ],
  'Prensa periódica': [
    'Periódicos',
    'Revistas',
  ],
  'Impresos efímeros': [
    'Publicidad de prensa',
    'Panfletos, volantes',
    'Bandos, pregones impresos',
  ],
  'Registros fiscales y contables': [
    'Registros contables',
    'Memorias de hacienda',
    'Libros mayores',
    'Libros manuales',
    'Libros de cargo y data',
    'Catastros',
    'Censos y padrones',
    'Vales',
    'Pagarés',
  ],
  'Visuales': [
    'Códices',
    'Fotografías',
    'Pinturas',
    'Grabados',
    'Afiches',
  ],
  'Audiovisuales': [
    'Audios',
    'Videos',
  ],
  'Tridimensionales': [
    'Esculturas',
    'Artefactos',
    'Textiles',
    'Cerámicas',
  ],
  'Bibliografía': [
    'Libros',
    'Capítulos de libro',
    'Artículos académicos',
    'Actas, presentaciones y conferencias',
    'Tesis',
  ],
};

const FUENTES_CATEGORIAS = Object.keys(FUENTES_TAXONOMIA);
const FUENTES_TIPOS_TOTAL = Object.values(FUENTES_TAXONOMIA).reduce((total, tipos) => total + tipos.length, 0);

/** Tipos de una categoría (todos si la categoría es vacía o desconocida). */
window.tiposFuenteDeCategoria = (categoria) => {
  if (categoria && FUENTES_TAXONOMIA[categoria]) return FUENTES_TAXONOMIA[categoria].slice();
  return Object.values(FUENTES_TAXONOMIA).flat();
};

/** Categoría a la que pertenece un tipo de fuente ('' si no consta). */
window.categoriaDeTipoFuente = (tipo) => {
  const buscado = String(tipo || '').trim();
  for (const [categoria, tipos] of Object.entries(FUENTES_TAXONOMIA)) {
    if (tipos.includes(buscado)) return categoria;
  }
  return '';
};

window.FUENTES_TAXONOMIA = FUENTES_TAXONOMIA;
window.FUENTES_CATEGORIAS = FUENTES_CATEGORIAS;
window.FUENTES_TIPOS_TOTAL = FUENTES_TIPOS_TOTAL;
