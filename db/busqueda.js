'use strict';

/* H-IMAGO · Utilidades del motor de búsqueda general.
   Funciones puras de normalización, puntuación y extracción de fragmentos.
   Se mantienen separadas de la fachada de datos para poder probarlas. */

const DIACRITICOS = /[\u0300-\u036f]/g;

/** Normaliza una consulta: sin tildes, en minúsculas y con espacios simples.
    La puntuación de la consulta se separa para que «Pérez, Ana» encuentre
    «Ana Pérez» y para que los rangos funcionen con guion o raya. */
function normalizarConsulta(valor) {
  return String(valor ?? '')
    .replace(/\u00a0/g, ' ')
    .replace(/[.,;:!?¿¡"“”()[\]{}]/g, ' ')
    .replace(/[’‘]/g, "'")
    .normalize('NFD')
    .replace(DIACRITICOS, '')
    .toLowerCase()
    .replace(/[-–—_/]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Normaliza un texto conservando su longitud lógica (sin colapsar espacios),
    para poder localizar el fragmento original de una coincidencia. */
function normalizarTexto(valor) {
  return String(valor ?? '')
    .replace(/[’‘]/g, "'")
    .replace(/[-–—_]/g, ' ')
    .normalize('NFD')
    .replace(DIACRITICOS, '')
    .toLowerCase();
}

/** Palabras de la consulta. Se limita el número para evitar consultas
    patológicas y se ordenan de mayor a menor longitud. */
function tokensDeConsulta(consulta) {
  const tokens = normalizarConsulta(consulta).split(' ').filter(Boolean);
  return [...new Set(tokens)].sort((a, b) => b.length - a.length).slice(0, 8);
}

/** Posición del texto original correspondiente a una posición del texto
    normalizado. Normalizar puede alargar un carácter (p. ej. «æ» → «ae»). */
const cacheNormalizacion = new Map();
function largoNormalizado(caracter) {
  const codigo = caracter.charCodeAt(0);
  if (codigo < 128 && caracter.length === 1) return 1;
  let largo = cacheNormalizacion.get(caracter);
  if (largo === undefined) {
    largo = normalizarTexto(caracter).length;
    cacheNormalizacion.set(caracter, largo);
  }
  return largo;
}

function posicionOriginal(texto, posicionNormalizada) {
  let acumulado = 0;
  for (let i = 0; i < texto.length; i++) {
    const largo = largoNormalizado(texto[i]);
    if (acumulado + largo > posicionNormalizada) return i;
    acumulado += largo;
  }
  return Math.max(0, texto.length - 1);
}

function fusionarRangos(rangos) {
  const ordenados = rangos
    .filter(([inicio, fin]) => Number.isFinite(inicio) && Number.isFinite(fin) && fin > inicio)
    .sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const fusionados = [];
  for (const [inicio, fin] of ordenados) {
    const ultimo = fusionados[fusionados.length - 1];
    if (ultimo && inicio <= ultimo[1]) ultimo[1] = Math.max(ultimo[1], fin);
    else fusionados.push([inicio, fin]);
  }
  return fusionados;
}

/** Posiciones de las palabras de la consulta dentro de un texto corto
    (título, subtítulo o fragmento). Devuelve rangos [inicio, fin). */
function rangosDeTokens(texto, tokens) {
  const original = String(texto ?? '');
  if (!original || !tokens.length) return [];
  const normalizado = normalizarTexto(original);
  const rangos = [];
  for (const token of tokens) {
    let posicion = normalizado.indexOf(token);
    while (posicion !== -1) {
      const inicio = posicionOriginal(original, posicion);
      const fin = posicionOriginal(original, posicion + token.length - 1) + 1;
      rangos.push([inicio, fin]);
      posicion = normalizado.indexOf(token, posicion + token.length);
    }
  }
  return fusionarRangos(rangos).slice(0, 24);
}

function contarOcurrencias(haystack, aguja, maximo = 8) {
  if (!aguja) return 0;
  let cuenta = 0;
  let posicion = 0;
  while (cuenta < maximo && (posicion = haystack.indexOf(aguja, posicion)) !== -1) {
    cuenta++;
    posicion += aguja.length;
  }
  return cuenta;
}

/** Filtro Bloom de trigramas: descarta elementos que no pueden contener un
    token sin recorrer todo el texto. No produce falsos negativos. */
function hashTrigram(codigo1, codigo2, codigo3) {
  let hash = 2166136261;
  hash = Math.imul(hash ^ codigo1, 16777619);
  hash = Math.imul(hash ^ codigo2, 16777619);
  hash = Math.imul(hash ^ codigo3, 16777619);
  return hash >>> 0;
}

function crearFiltroBloom(texto) {
  let a = 0;
  let b = 0;
  for (let i = 0; i + 2 < texto.length; i++) {
    const hash = hashTrigram(texto.charCodeAt(i), texto.charCodeAt(i + 1), texto.charCodeAt(i + 2));
    a |= 1 << (hash & 31);
    b |= 1 << ((hash >>> 5) & 31);
  }
  return [a >>> 0, b >>> 0];
}

function bloomPuedeContener(filtro, tokens) {
  if (!filtro || !Array.isArray(tokens) || !tokens.length) return true;
  const [a, b] = filtro;
  for (const token of tokens) {
    if (token.length < 3) continue;
    for (let i = 0; i + 2 < token.length; i++) {
      const hash = hashTrigram(token.charCodeAt(i), token.charCodeAt(i + 1), token.charCodeAt(i + 2));
      if ((a & (1 << (hash & 31))) === 0) return false;
      if ((b & (1 << ((hash >>> 5) & 31))) === 0) return false;
    }
  }
  return true;
}

/** Puntúa una coincidencia. Devuelve null si falta alguna palabra.
    El título pesa mucho más que el cuerpo. */
function puntuar(tituloNormalizado, textoNormalizado, tokens, consultaNormalizada) {
  let puntos = 0;
  for (const token of tokens) {
    const enTitulo = contarOcurrencias(tituloNormalizado, token);
    const enTexto = contarOcurrencias(textoNormalizado, token);
    if (!enTitulo && !enTexto) return null;
    puntos += enTitulo * 14 + enTexto;
  }
  if (consultaNormalizada && tokens.length > 1) {
    if (tituloNormalizado.includes(consultaNormalizada)) puntos += 40;
    else if (textoNormalizado.includes(consultaNormalizada)) puntos += 12;
  }
  return puntos;
}

/** Recorta un fragmento alrededor de la primera coincidencia y calcula los
    rangos que el renderer debe resaltar. */
function crearSnippet(texto, tokens, maximo = 220, normalizadoPrevio = null) {
  const original = String(texto ?? '').replace(/\u00a0/g, ' ');
  if (!original.trim()) return { snippet: '', resaltados: [] };
  const normalizado = normalizadoPrevio || normalizarTexto(original);
  let posicion = -1;
  let tokenElegido = '';
  for (const token of tokens) {
    const encontrada = normalizado.indexOf(token);
    if (encontrada !== -1 && (posicion === -1 || encontrada < posicion)) {
      posicion = encontrada;
      tokenElegido = token;
    }
  }
  if (posicion === -1) {
    const recorte = original.replace(/\s+/g, ' ').trim();
    return {
      snippet: recorte.length > maximo ? `${recorte.slice(0, maximo)}…` : recorte,
      resaltados: [],
    };
  }
  const inicio = posicionOriginal(original, posicion);
  const finToken = posicionOriginal(original, posicion + tokenElegido.length - 1);
  const margen = Math.max(40, Math.floor((maximo - (finToken - inicio + 1)) / 2));
  let desde = Math.max(0, inicio - margen);
  let hasta = Math.min(original.length, finToken + 1 + margen);
  while (desde > 0 && !/[\s.,;:!?¿¡"'()[\]{}]/.test(original[desde - 1])) desde--;
  while (hasta < original.length && !/[\s.,;:!?¿¡"'()[\]{}]/.test(original[hasta])) hasta++;
  if (hasta - desde > maximo * 2) {
    hasta = Math.min(hasta, desde + maximo * 2);
  }
  const recorte = original.slice(desde, hasta).replace(/\s+/g, ' ').trim();
  const prefijo = desde > 0 ? '…' : '';
  const sufijo = hasta < original.length ? '…' : '';
  const conTexto = `${prefijo}${recorte}${sufijo}`;
  const resaltados = rangosDeTokens(conTexto, tokens);
  return { snippet: conTexto, resaltados };
}

module.exports = {
  normalizarConsulta,
  normalizarTexto,
  tokensDeConsulta,
  posicionOriginal,
  rangosDeTokens,
  contarOcurrencias,
  puntuar,
  crearSnippet,
  fusionarRangos,
  crearFiltroBloom,
  bloomPuedeContener,
};
