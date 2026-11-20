'use strict';

/* H-IMAGO · Referencias a entidades dentro del JSON de los bloques de registro.
   Se usa al exportar/importar bloques y al fusionar entidades. */

/* Campos de los bloques que contienen referencias a entidades. Se usa al
   importar un proyecto para traducir los identificadores antiguos a los
   nuevos. Los campos de persona/institución/patrimonio de las filas se
   detectan por su nombre (persona_id, institucion_id, patrimonio_id). */
const CAMPOS_ENTIDAD_BLOQUE = {
  'Actas, acuerdos y resoluciones': { f2: 'lugar', f3: 'institucion' },
  'Comunicaciones': { f2: 'lugar', f3: 'institucion' },
  'Leyes, decretos, ordenanzas, reglamentos': { f2: 'lugar', f3: 'institucion' },
  'Edictos, bandos, panfletos': { f2: 'lugar', f3: 'institucion' },
  'Elecciones': { f2: 'lugar', f3: 'institucion' },
  'Hojas de servicio': { f2: 'lugar', f3: 'institucion', f9: 'lugar' },
  'Nombramientos y designaciones': { f2: 'lugar', f3: 'institucion' },
  'Títulos': { f2: 'lugar', f3: 'institucion' },
  'Arriendo': { f2: 'lugar' },
  'Compra/Venta': { f2: 'lugar' },
  'Diezmos': { f2: 'lugar', f5: 'lugar' },
  'Donación': { f2: 'lugar' },
  'Fianza': { f2: 'lugar' },
  'Hipoteca': { f2: 'lugar' },
  'Inventarios de bienes': { f2: 'lugar' },
  'Obligación': { f2: 'lugar' },
  'Poder': { f2: 'lugar' },
  'Cuenta personal': { f2: 'lugar' },
  'Epístolas': { f2: 'lugar' },
  'Actas de bautismo': { f2: 'lugar', f13: 'lugar' },
  'Actas de defunción': { f2: 'lugar' },
  'Actas de matrimonio': { f2: 'lugar', f6: 'lugar', f9: 'lugar' },
  'Testamentos': { f2: 'lugar' },
  'Legados testamentarios': { f2: 'lugar' },
  'Procesos judiciales': { f2: 'lugar', f3: 'institucion', f12: 'lugar', f28: 'lugar', f44: 'lugar' },
};

/** Traduce las referencias a entidades dentro de los datos de un bloque
    (personas, instituciones, patrimonios, lugares y fuentes) a los nuevos
    identificadores creados al importar el proyecto. */
function remapearDatosBloque(datos, tipo, mapas) {
  const mapa = (clave, valor) => {
    if (valor === null || valor === undefined || valor === '') return valor;
    const destino = mapas[clave] && mapas[clave][String(valor)];
    return destino === undefined ? null : String(destino);
  };
  const campos = CAMPOS_ENTIDAD_BLOQUE[tipo] || {};
  const recorrer = (nodo) => {
    if (Array.isArray(nodo)) return nodo.map(recorrer);
    if (!nodo || typeof nodo !== 'object') return nodo;
    const salida = {};
    for (const [clave, valor] of Object.entries(nodo)) {
      if (clave === 'persona_id') salida[clave] = mapa('persona', valor);
      else if (clave === 'institucion_id') salida[clave] = mapa('institucion', valor);
      else if (clave === 'patrimonio_id') salida[clave] = mapa('patrimonio', valor);
      else if (clave === 'lugar_id') salida[clave] = mapa('lugar', valor);
      else if (clave === 'fuente_id') salida[clave] = mapa('fuente', valor);
      else if (clave === 'patria') salida[clave] = mapa('lugar', valor);
      else if (clave === 'valores' && valor && typeof valor === 'object' && !Array.isArray(valor)) {
        salida[clave] = { ...valor };
        for (const [campo, contenido] of Object.entries(valor)) {
          const entidad = campos[campo];
          if (entidad) salida[clave][campo] = mapa(entidad, contenido);
        }
      } else {
        salida[clave] = recorrer(valor);
      }
    }
    return salida;
  };
  return recorrer(datos || {});
}

/** Recoge los identificadores de entidades a los que apunta un bloque. */
function recolectarReferenciasBloque(datos, tipo, ids) {
  const campos = CAMPOS_ENTIDAD_BLOQUE[tipo] || {};
  const agregar = (entidad, valor) => {
    if (valor === null || valor === undefined || valor === '') return;
    ids[entidad].add(String(valor));
  };
  const recorrer = (nodo) => {
    if (Array.isArray(nodo)) {
      nodo.forEach(recorrer);
      return;
    }
    if (!nodo || typeof nodo !== 'object') return;
    for (const [clave, valor] of Object.entries(nodo)) {
      if (clave === 'persona_id') agregar('persona', valor);
      else if (clave === 'institucion_id') agregar('institucion', valor);
      else if (clave === 'patrimonio_id') agregar('patrimonio', valor);
      else if (clave === 'lugar_id') agregar('lugar', valor);
      else if (clave === 'patria') agregar('lugar', valor);
      else if (clave === 'valores' && valor && typeof valor === 'object' && !Array.isArray(valor)) {
        for (const [campo, contenido] of Object.entries(valor)) {
          const entidad = campos[campo];
          if (entidad) agregar(entidad, contenido);
        }
      } else {
        recorrer(valor);
      }
    }
  };
  recorrer(datos || {});
  return ids;
}

/** Sustituye una entidad absorbida por la superviviente dentro del JSON de
    un bloque. Devuelve true si el documento ha cambiado. */
function remapearReferenciaEnBloque(datos, tipo, absorbidaId, supervivienteId, tipoBloque) {
  let cambiado = false;
  const camposValores = CAMPOS_ENTIDAD_BLOQUE[tipoBloque] || {};
  const reemplazar = (valor) => {
    if (valor === null || valor === undefined || valor === '') return valor;
    if (String(valor) !== String(absorbidaId)) return valor;
    cambiado = true;
    return typeof valor === 'number' ? Number(supervivienteId) : String(supervivienteId);
  };
  const recorrer = (nodo) => {
    if (Array.isArray(nodo)) {
      for (const item of nodo) recorrer(item);
      return;
    }
    if (!nodo || typeof nodo !== 'object') return;
    for (const [clave, valor] of Object.entries(nodo)) {
      if (clave === `${tipo}_id`) {
        nodo[clave] = reemplazar(valor);
      } else if (tipo === 'lugar' && clave === 'patria') {
        nodo[clave] = reemplazar(valor);
      } else if (clave === 'valores' && valor && typeof valor === 'object' && !Array.isArray(valor)) {
        for (const [campo, contenido] of Object.entries(valor)) {
          if (camposValores[campo] === tipo) valor[campo] = reemplazar(contenido);
        }
      } else {
        recorrer(valor);
      }
    }
  };
  recorrer(datos || {});
  return cambiado;
}

/** Elimina de un bloque las referencias a una entidad borrada. */
function limpiarReferenciaEnBloque(datos, tipo, id, tipoBloque) {
  let cambiado = false;
  const camposValores = CAMPOS_ENTIDAD_BLOQUE[tipoBloque] || {};
  const limpiar = (valor) => {
    if (valor === null || valor === undefined || valor === '') return valor;
    if (String(valor) !== String(id)) return valor;
    cambiado = true;
    return null;
  };
  const recorrer = (nodo) => {
    if (Array.isArray(nodo)) {
      for (const item of nodo) recorrer(item);
      return;
    }
    if (!nodo || typeof nodo !== 'object') return;
    for (const [clave, valor] of Object.entries(nodo)) {
      if (clave === `${tipo}_id`) {
        nodo[clave] = limpiar(valor);
      } else if (tipo === 'lugar' && clave === 'patria') {
        nodo[clave] = limpiar(valor);
      } else if (clave === 'valores' && valor && typeof valor === 'object' && !Array.isArray(valor)) {
        for (const [campo, contenido] of Object.entries(valor)) {
          if (camposValores[campo] === tipo) valor[campo] = limpiar(contenido);
        }
      } else {
        recorrer(valor);
      }
    }
  };
  recorrer(datos || {});
  return cambiado;
}

module.exports = {
  CAMPOS_ENTIDAD_BLOQUE,
  remapearDatosBloque,
  recolectarReferenciasBloque,
  remapearReferenciaEnBloque,
  limpiarReferenciaEnBloque,
};
