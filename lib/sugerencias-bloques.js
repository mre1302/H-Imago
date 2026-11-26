'use strict';

/* Extrae valores repetibles de los bloques de registro para alimentar los
   autocompletados del formulario. Se ejecuta en el proceso principal para no
   enviar al renderer el JSON completo de todos los bloques. */

function recolectarSugerenciasBloques(bloques) {
  const mapa = { '*': new Set() };
  const agregar = (clave, valor) => {
    const texto = String(valor == null ? '' : valor).replace(/\s+/g, ' ').trim();
    if (!texto || texto.length > 160) return;
    const normalizada = String(clave || '').trim().toUpperCase();
    (mapa[normalizada] ||= new Set()).add(texto);
    mapa['*'].add(texto);
    if (/^-?\d{3,4}$/.test(texto)) (mapa.ANIO ||= new Set()).add(texto);
  };
  const equivalencias = {
    nombres: 'NOMBRES', nombre: 'NOMBRE', apellidos: 'APELLIDOS',
    empleo: 'EMPLEO/OFICIO', institucion_texto: 'INSTITUCIÓN',
    institucion: 'INSTITUCIÓN', lugar: 'LUGAR', tipo: 'TIPO',
    titulo: 'TÍTULO', materia: 'MATERIA', valor: 'VALOR/TASACIÓN', item: 'ÍTEM',
  };
  const recorrer = (nodo) => {
    if (Array.isArray(nodo)) {
      nodo.forEach(recorrer);
      return;
    }
    if (!nodo || typeof nodo !== 'object') return;
    for (const [clave, valor] of Object.entries(nodo)) {
      if (/_meta$/i.test(clave) || clave === 'meta') continue;
      if (typeof valor === 'string' || typeof valor === 'number') {
        agregar(equivalencias[clave] || '*', valor);
      } else {
        recorrer(valor);
      }
    }
  };
  for (const bloque of bloques) {
    let datos = bloque;
    if (typeof datos === 'string') {
      try { datos = JSON.parse(datos); } catch { datos = {}; }
    }
    recorrer(datos || {});
  }
  return Object.fromEntries(
    Object.entries(mapa).map(([clave, valores]) => [
      clave,
      [...valores]
        .filter((valor) => clave !== '*' || /\p{L}/u.test(valor))
        .slice(0, 500),
    ])
  );
}

module.exports = { recolectarSugerenciasBloques };
