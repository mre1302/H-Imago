'use strict';

/* H-IMAGO · Taxonomía de BLOQUES DE REGISTRO
   Fuente canónica: la tabla interna del proyecto, no distribuida.
   Los bloques reproducen información textual de las fuentes para reconstruir
   después las redes de RELACIONES. Por ahora sólo están definidos los
   formularios de los SIGLOS XVIII-XIX; los demás periodos se irán añadiendo. */

const PERIODOS_BLOQUES = [
  { clave: 'siglos-xvi-xvii', etiqueta: 'SIGLOS XVI-XVII', habilitado: false },
  { clave: 'siglos-xviii-xix', etiqueta: 'SIGLOS XVIII-XIX', habilitado: true },
  { clave: 'siglos-xx-xxi', etiqueta: 'SIGLOS XX-XXI', habilitado: false },
];

const ETIQUETAS_ESPACIALES = [
  { clave: 'hispanoamerica', etiqueta: 'HISPANOAMÉRICA', habilitado: true },
];

const BLOQUES_XVIII_XIX = {
  'Registros institucionales': [
    'Actas, acuerdos y resoluciones',
    'Comunicaciones',
    'Edictos, bandos, panfletos',
    'Leyes, decretos, ordenanzas, reglamentos',
    'Elecciones',
    'Hojas de servicio',
    'Nombramientos y designaciones',
    'Títulos',
  ],
  'Registros notariales': [
    'Arriendo',
    'Compra/Venta',
    'Diezmos',
    'Donación',
    'Fianza',
    'Hipoteca',
    'Inventarios de bienes',
    'Legados testamentarios',
    'Obligación',
    'Poder',
    'Testamentos',
  ],
  'Registros judiciales': [
    'Procesos judiciales',
  ],
  'Registros personales y narrativos': [
    'Cuenta personal',
    'Epístolas',
  ],
  'Registros vitales': [
    'Actas de bautismo',
    'Actas de defunción',
    'Actas de matrimonio',
  ],
};

/** Lista plana conservando la categoría de cada bloque. */
const BLOQUES_XVIII_XIX_LISTA = Object.entries(BLOQUES_XVIII_XIX).flatMap(
  ([categoria, bloques]) => bloques.map((titulo) => ({ titulo, categoria }))
);

/* Combinaciones etiqueta temporal × etiqueta espacial con formularios. */
const BLOQUES_POR_CONTEXTO = {
  'siglos-xviii-xix|hispanoamerica': BLOQUES_XVIII_XIX,
};

function bloquesDeContexto(periodo, region) {
  return BLOQUES_POR_CONTEXTO[`${periodo}|${region}`] || null;
}

window.PERIODOS_BLOQUES = PERIODOS_BLOQUES;
window.ETIQUETAS_ESPACIALES = ETIQUETAS_ESPACIALES;
window.BLOQUES_XVIII_XIX = BLOQUES_XVIII_XIX;
window.BLOQUES_XVIII_XIX_LISTA = BLOQUES_XVIII_XIX_LISTA;
window.BLOQUES_POR_CONTEXTO = BLOQUES_POR_CONTEXTO;
window.bloquesDeContexto = bloquesDeContexto;
