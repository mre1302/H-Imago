'use strict';

/* H-IMAGO · Relaciones automatizadas desde BLOQUES DE REGISTRO
   Las relaciones nacidas de un bloque se materializan en `relaciones` con
   procedencia AUTOMATIZADA y se reconcilian cada vez que el bloque se guarda.
   Las EDITADAS y las MANUALES no se tocan. */

const crypto = require('crypto');
const { relacionPermitida } = require('../src/js/modulos/taxonomia-relaciones');

const TABLAS_ENTIDAD = {
  persona: 'personas',
  institucion: 'instituciones',
  lugar: 'lugares',
  patrimonio: 'patrimonios',
};

const numero = (v) => {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : null;
};

const texto = (v) => {
  if (v === null || v === undefined) return null;
  const t = String(v).trim();
  return t === '' ? null : t;
};

const jsonTexto = (v) => {
  if (v === null || v === undefined || v === '') return null;
  return typeof v === 'string' ? v : JSON.stringify(v);
};

/* Instituciones vinculadas a una persona: la principal y las de cada línea
   de empleo. Sin duplicados y en orden. */
function institucionesDe(fila) {
  const ids = new Set();
  const registrar = (v) => {
    const n = numero(v);
    if (n) ids.add(n);
  };
  if (!fila) return [];
  registrar(fila.institucion_id);
  for (const empleo of (Array.isArray(fila.empleos) ? fila.empleos : [])) {
    registrar(empleo && empleo.institucion_id);
  }
  return [...ids];
}

/** Repite la fila una vez por cada institución vinculada, para que las
    reglas de pertenencia («Miembro») se apliquen a todas ellas. */
function expandirInstituciones(fila) {
  const ids = institucionesDe(fila);
  if (ids.length <= 1) return [fila];
  return ids.map((id) => ({ ...fila, institucion_id: id }));
}

function filasDePersona(personas, id) {
  const filas = Array.isArray(personas && personas[id]) ? personas[id] : [];
  return filas.flatMap(expandirInstituciones);
}

function firmaDescriptor(d) {
  const cadena = [
    d.origen_tipo, d.origen_id,
    d.destino_tipo, d.destino_id,
    d.tipo,
    d.anio_inicio ?? '',
    d.fecha_exacta_inicio ?? '',
    d.lugar_inicio ?? '',
    d.anio_fin ?? '',
    d.fecha_exacta_fin ?? '',
    d.lugar_fin ?? '',
    d.fuente_id ?? '',
  ].join('|');
  return crypto.createHash('sha256').update(cadena).digest('hex');
}

/* Firma del formato anterior, para no resucitar relaciones excluidas antes
   de la actualización. */
function firmaDescriptorLegacy(d) {
  const cadena = [
    d.origen_tipo, d.origen_id,
    d.destino_tipo, d.destino_id,
    d.tipo,
    d.anio_inicio ?? '',
    d.fecha_exacta_inicio ?? '',
    d.lugar_inicio ?? '',
    d.fuente_id ?? '',
  ].join('|');
  return crypto.createHash('sha256').update(cadena).digest('hex');
}

/* Bloques de REGISTRO que generan LUGAR – SEDE – INSTITUCIÓN.
   Se indica el par [campo AÑO, campo FECHA EXACTA] de cada formulario;
   LUGAR es siempre f2 e INSTITUCIÓN f3. */
const SEDE_POR_BLOQUE = {
  'Actas, acuerdos y resoluciones': ['f4', 'f5'],
  'Comunicaciones': ['f4', 'f5'],
  'Leyes, decretos, ordenanzas, reglamentos': ['f4', 'f5'],
  'Edictos, bandos, panfletos': ['f4', 'f5'],
  'Elecciones': ['f4', 'f5'],
  'Hojas de servicio': ['f4', 'f5'],
  'Nombramientos y designaciones': ['f4', 'f5'],
  'Títulos': ['f4', 'f5'],
  'Procesos judiciales': ['f5', 'f6'],
};

function reglaSede(bloque, datos) {
  const campos = SEDE_POR_BLOQUE[bloque.tipo];
  if (!campos) return [];
  const valores = datos.valores || {};
  const institucionId = numero(valores.f3);
  const lugarId = numero(valores.f2);
  if (!institucionId || !lugarId) return [];
  const [campoAnio, campoFecha] = campos;
  return [{
    regla: 'registro:institucion:sede:lugar',
    origen_tipo: 'lugar',
    origen_id: lugarId,
    destino_tipo: 'institucion',
    destino_id: institucionId,
    tipo: 'Sede',
    anio_inicio: numero(valores[campoAnio]),
    fecha_exacta_inicio: texto(valores[campoFecha]),
    fecha_exacta_inicio_meta: jsonTexto(valores[`${campoFecha}_meta`]),
    lugar_inicio: lugarId,
    fuente_id: numero(bloque.fuente_id),
  }];
}

/* ------------------------------------------------------------------ */
/* Reglas por formulario                                               */
/* ------------------------------------------------------------------ */

function reglasActas(bloque, datos) {
  const valores = datos.valores || {};
  const personas = datos.personas || {};
  const base = {
    anio_inicio: numero(valores.f4),
    fecha_exacta_inicio: texto(valores.f5),
    fecha_exacta_inicio_meta: jsonTexto(valores.f5_meta),
    lugar_inicio: numero(valores.f2),
    fuente_id: numero(bloque.fuente_id),
  };
  const institucionRegistro = numero(valores.f3);
  const reglas = [];
  const agregar = (regla, personaId, institucionId, tipo) => {
    if (!personaId || !institucionId) return;
    reglas.push({
      regla,
      origen_tipo: 'persona',
      origen_id: personaId,
      destino_tipo: 'institucion',
      destino_id: institucionId,
      tipo,
      ...base,
    });
  };
  const filas = (id) => filasDePersona(personas, id);

  for (const fila of filas('p1')) {
    const persona = numero(fila.persona_id);
    agregar('actas:autoridad:registro:presidente', persona, institucionRegistro, 'Presidente/Director');
    agregar('actas:autoridad:propia:miembro', persona, numero(fila.institucion_id), 'Miembro');
  }
  for (const fila of filas('p2')) {
    const persona = numero(fila.persona_id);
    agregar('actas:vocales:registro:vocal', persona, institucionRegistro, 'Vocal/Consejero');
    agregar('actas:vocales:propia:miembro', persona, numero(fila.institucion_id), 'Miembro');
  }
  for (const fila of filas('p3')) {
    const persona = numero(fila.persona_id);
    agregar('actas:escribano:registro:notario', persona, institucionRegistro, 'Escribano/Notario');
    agregar('actas:escribano:propia:miembro', persona, numero(fila.institucion_id), 'Miembro');
  }
  for (const fila of filas('p4')) {
    const persona = numero(fila.persona_id);
    agregar('actas:firmantes:registro:firmante', persona, institucionRegistro, 'Firmante');
    agregar('actas:firmantes:propia:miembro', persona, numero(fila.institucion_id), 'Miembro');
  }

  /* Una misma persona puede ocupar varios cargos: se evita repetir la misma
     relación regla + origen + destino + tipo. */
  const vistas = new Set();
  return reglas.filter((r) => {
    const clave = [r.regla, r.origen_tipo, r.origen_id, r.destino_tipo, r.destino_id, r.tipo].join('|');
    if (vistas.has(clave)) return false;
    vistas.add(clave);
    return true;
  });
}

function reglasLeyes(bloque, datos, prefijo = 'leyes') {
  const valores = datos.valores || {};
  const personas = datos.personas || {};
  const base = {
    anio_inicio: numero(valores.f4),
    fecha_exacta_inicio: texto(valores.f5),
    fecha_exacta_inicio_meta: jsonTexto(valores.f5_meta),
    lugar_inicio: numero(valores.f2),
    fuente_id: numero(bloque.fuente_id),
  };
  const institucionRegistro = numero(valores.f3);
  const reglas = [];
  const agregar = (regla, personaId, institucionId, tipo) => {
    if (!personaId || !institucionId) return;
    reglas.push({
      regla,
      origen_tipo: 'persona',
      origen_id: personaId,
      destino_tipo: 'institucion',
      destino_id: institucionId,
      tipo,
      ...base,
    });
  };
  const filas = (id) => filasDePersona(personas, id);

  for (const fila of filas('p1')) {
    const persona = numero(fila.persona_id);
    agregar(`${prefijo}:autoridad:registro:presidente`, persona, institucionRegistro, 'Presidente/Director');
    agregar(`${prefijo}:autoridad:propia:miembro`, persona, numero(fila.institucion_id), 'Miembro');
  }
  for (const fila of filas('p2')) {
    const persona = numero(fila.persona_id);
    agregar(`${prefijo}:vocales:registro:vocal`, persona, institucionRegistro, 'Vocal/Consejero');
    agregar(`${prefijo}:vocales:propia:miembro`, persona, numero(fila.institucion_id), 'Miembro');
  }
  for (const fila of filas('p3')) {
    const persona = numero(fila.persona_id);
    agregar(`${prefijo}:escribano:registro:notario`, persona, institucionRegistro, 'Escribano/Notario');
    agregar(`${prefijo}:escribano:propia:miembro`, persona, numero(fila.institucion_id), 'Miembro');
  }

  const vistas = new Set();
  return reglas.filter((r) => {
    const clave = [r.regla, r.origen_tipo, r.origen_id, r.destino_tipo, r.destino_id, r.tipo].join('|');
    if (vistas.has(clave)) return false;
    vistas.add(clave);
    return true;
  });
}

function reglasElecciones(bloque, datos) {
  const valores = datos.valores || {};
  const personas = datos.personas || {};
  const base = {
    anio_inicio: numero(valores.f4),
    fecha_exacta_inicio: texto(valores.f5),
    fecha_exacta_inicio_meta: jsonTexto(valores.f5_meta),
    lugar_inicio: numero(valores.f2),
    fuente_id: numero(bloque.fuente_id),
  };
  const institucionRegistro = numero(valores.f3);
  const reglas = [];
  const agregar = (regla, personaId, institucionId, tipo) => {
    if (!personaId || !institucionId) return;
    reglas.push({
      regla,
      origen_tipo: 'persona',
      origen_id: personaId,
      destino_tipo: 'institucion',
      destino_id: institucionId,
      tipo,
      ...base,
    });
  };
  const filas = (id) => filasDePersona(personas, id);
  const roles = [
    ['p1', 'autoridad', 'presidente', 'Presidente/Director'],
    ['p2', 'vocales', 'vocal', 'Vocal/Consejero'],
    ['p3', 'escribano', 'notario', 'Escribano/Notario'],
    ['p4', 'electores', 'elector', 'Elector'],
    ['p5', 'elegibles', 'candidato', 'Candidato'],
    ['p6', 'electos', 'electo', 'Electo'],
  ];

  for (const [id, clave, sufijo, tipoRegistro] of roles) {
    for (const fila of filas(id)) {
      const persona = numero(fila.persona_id);
      agregar(`elecciones:${clave}:registro:${sufijo}`, persona, institucionRegistro, tipoRegistro);
      agregar(`elecciones:${clave}:propia:miembro`, persona, numero(fila.institucion_id), 'Miembro');
    }
  }

  const vistas = new Set();
  return reglas.filter((r) => {
    const clave = [r.regla, r.origen_tipo, r.origen_id, r.destino_tipo, r.destino_id, r.tipo].join('|');
    if (vistas.has(clave)) return false;
    vistas.add(clave);
    return true;
  });
}

function reglasConSecretario(bloque, datos, prefijo) {
  const valores = datos.valores || {};
  const personas = datos.personas || {};
  const base = {
    anio_inicio: numero(valores.f4),
    fecha_exacta_inicio: texto(valores.f5),
    fecha_exacta_inicio_meta: jsonTexto(valores.f5_meta),
    lugar_inicio: numero(valores.f2),
    fuente_id: numero(bloque.fuente_id),
  };
  const institucionRegistro = numero(valores.f3);
  const reglas = [];
  const agregar = (regla, personaId, institucionId, tipo) => {
    if (!personaId || !institucionId) return;
    reglas.push({
      regla,
      origen_tipo: 'persona',
      origen_id: personaId,
      destino_tipo: 'institucion',
      destino_id: institucionId,
      tipo,
      ...base,
    });
  };
  const filas = (id) => filasDePersona(personas, id);
  const personasDe = (id) => filas(id)
    .map((fila) => numero(fila.persona_id))
    .filter(Boolean);

  for (const fila of filas('p1')) {
    const persona = numero(fila.persona_id);
    agregar(`${prefijo}:autoridad:registro:presidente`, persona,
      institucionRegistro, 'Presidente/Director');
    agregar(`${prefijo}:autoridad:propia:miembro`, persona,
      numero(fila.institucion_id), 'Miembro');
  }
  for (const fila of filas('p2')) {
    const persona = numero(fila.persona_id);
    agregar(`${prefijo}:secretario:registro:asistente`, persona,
      institucionRegistro, 'Asistente/Colaborador');
    agregar(`${prefijo}:secretario:propia:miembro`, persona,
      numero(fila.institucion_id), 'Miembro');
  }
  for (const fila of filas('p3')) {
    const persona = numero(fila.persona_id);
    agregar(`${prefijo}:escribano:registro:notario`, persona,
      institucionRegistro, 'Escribano/Notario');
    agregar(`${prefijo}:escribano:propia:miembro`, persona,
      numero(fila.institucion_id), 'Miembro');
  }
  for (const fila of filas('p4')) {
    const persona = numero(fila.persona_id);
    agregar(`${prefijo}:destinatario:registro:nombrado`, persona,
      institucionRegistro, 'Nombrado/Designado');
    agregar(`${prefijo}:destinatario:propia:miembro`, persona,
      numero(fila.institucion_id), 'Miembro');
  }

  /* AUTORIDAD EMISORA → SECRETARIO: el sentido lo fija la sección. */
  for (const origenId of personasDe('p1')) {
    for (const destinoId of personasDe('p2')) {
      reglas.push({
        regla: `${prefijo}:autoridad:secretario:jefe-secretario`,
        origen_tipo: 'persona',
        origen_id: origenId,
        destino_tipo: 'persona',
        destino_id: destinoId,
        tipo: 'Jefe – Secretario',
        ...base,
      });
    }
  }

  const vistas = new Set();
  return reglas.filter((r) => {
    const clave = [r.regla, r.origen_tipo, r.origen_id, r.destino_tipo, r.destino_id, r.tipo].join('|');
    if (vistas.has(clave)) return false;
    vistas.add(clave);
    return true;
  });
}

function reglasNombramientos(bloque, datos) {
  return reglasConSecretario(bloque, datos, 'nombramientos');
}

function reglasTitulos(bloque, datos) {
  return reglasConSecretario(bloque, datos, 'titulos');
}

function reglasHojasServicio(bloque, datos) {
  const valores = datos.valores || {};
  const personas = datos.personas || {};
  const instituciones = datos.instituciones || {};
  const base = {
    anio_inicio: numero(valores.f4),
    fecha_exacta_inicio: texto(valores.f5),
    fecha_exacta_inicio_meta: jsonTexto(valores.f5_meta),
    lugar_inicio: numero(valores.f2),
    fuente_id: numero(bloque.fuente_id),
  };
  const institucionRegistro = numero(valores.f3);
  const reglas = [];
  const agregar = (regla, origenId, destinoTipo, destinoId, tipo) => {
    if (!origenId || !destinoId) return;
    reglas.push({
      regla,
      origen_tipo: 'persona',
      origen_id: origenId,
      destino_tipo: destinoTipo,
      destino_id: destinoId,
      tipo,
      ...base,
    });
  };
  const filas = (id) => filasDePersona(personas, id);

  for (const fila of filas('p1')) {
    const persona = numero(fila.persona_id);
    agregar('hojas:autoridad:registro:asistente', persona, 'institucion',
      institucionRegistro, 'Asistente/Colaborador');
    agregar('hojas:autoridad:propia:miembro', persona, 'institucion',
      numero(fila.institucion_id), 'Miembro');
  }

  /* CUERPOS Y CAMPAÑAS es una lista de instituciones vinculadas: cada una
     produce una relación de pertenencia del soldado. */
  const cuerpos = Array.isArray(instituciones['inst-hojas-servicio'])
    ? instituciones['inst-hojas-servicio'] : [];
  for (const fila of filas('p-soldado')) {
    const persona = numero(fila.persona_id);
    for (const cuerpo of cuerpos) {
      agregar('hojas:soldado:cuerpos:miembro', persona, 'institucion',
        numero(cuerpo.institucion_id), 'Miembro');
    }
    agregar('hojas:soldado:patria:oriundo', persona, 'lugar',
      numero(fila.patria), 'Oriundo');
  }

  const vistas = new Set();
  return reglas.filter((r) => {
    const clave = [r.regla, r.origen_tipo, r.origen_id, r.destino_tipo, r.destino_id, r.tipo].join('|');
    if (vistas.has(clave)) return false;
    vistas.add(clave);
    return true;
  });
}

function reglasArriendo(bloque, datos) {
  const valores = datos.valores || {};
  const personas = datos.personas || {};
  const patrimonios = datos.patrimonios || {};
  const base = {
    anio_inicio: numero(valores.f3),
    fecha_exacta_inicio: texto(valores.f4),
    fecha_exacta_inicio_meta: jsonTexto(valores.f4_meta),
    lugar_inicio: numero(valores.f2),
    fuente_id: numero(bloque.fuente_id),
  };
  const reglas = [];
  const agregar = (regla, origenTipo, origenId, destinoTipo, destinoId, tipo) => {
    if (!origenId || !destinoId) return;
    reglas.push({
      regla,
      origen_tipo: origenTipo,
      origen_id: origenId,
      destino_tipo: destinoTipo,
      destino_id: destinoId,
      tipo,
      ...base,
    });
  };
  const filas = (id) => filasDePersona(personas, id);
  const personasDe = (id) => filas(id)
    .map((fila) => numero(fila.persona_id))
    .filter(Boolean);
  const agregarMiembros = (id, clave) => {
    for (const fila of filas(id)) {
      agregar(`arriendo:${clave}:propia:miembro`, 'persona', numero(fila.persona_id),
        'institucion', numero(fila.institucion_id), 'Miembro');
    }
  };

  agregarMiembros('p1', 'escribano');
  agregarMiembros('p2', 'testigos');
  agregarMiembros('p3', 'arrendador');
  agregarMiembros('p4', 'arrendatario');
  agregarMiembros('p6', 'fiador');

  const cruzar = (regla, origenIds, destinoIds, tipo) => {
    for (const origenId of origenIds) {
      for (const destinoId of destinoIds) {
        agregar(regla, 'persona', origenId, 'persona', destinoId, tipo);
      }
    }
  };
  cruzar('arriendo:arrendador:escribano:otorgante-escribano',
    personasDe('p3'), personasDe('p1'), 'Otorgante – Escribano/Notario');
  cruzar('arriendo:arrendador:testigos:otorgante-testigo',
    personasDe('p3'), personasDe('p2'), 'Otorgante – Testigo');
  cruzar('arriendo:arrendador:arrendatario:arrendatario-arrendador',
    personasDe('p3'), personasDe('p4'), 'Arrendatario – Arrendador');
  cruzar('arriendo:fiador:arrendatario:fiador-deudor',
    personasDe('p6'), personasDe('p4'), 'Fiador/Aval – Deudor');

  const agregarPropietarios = (regla, origenIds, filasPatrimonio) => {
    for (const origenId of origenIds) {
      for (const fila of filasPatrimonio) {
        agregar(regla, 'persona', origenId, 'patrimonio',
          numero(fila.patrimonio_id), 'Propietario');
      }
    }
  };
  agregarPropietarios('arriendo:arrendador:contrato:propietario',
    personasDe('p3'), Array.isArray(patrimonios.p8) ? patrimonios.p8 : []);

  /* Las HIPOTECAS viven dentro de cada fila de persona: sólo se vinculan
     con la persona que las contiene. */
  const propietariosDeHipoteca = (idPersona, idBloque, regla) => {
    for (const fila of filas(idPersona)) {
      const persona = numero(fila.persona_id);
      const hipotecas = Array.isArray(fila.patrimonios?.[idBloque])
        ? fila.patrimonios[idBloque] : [];
      for (const hipoteca of hipotecas) {
        agregar(regla, 'persona', persona, 'patrimonio',
          numero(hipoteca.patrimonio_id), 'Propietario');
      }
    }
  };
  propietariosDeHipoteca('p4', 'p5', 'arriendo:arrendatario:hipoteca:propietario');
  propietariosDeHipoteca('p6', 'p7', 'arriendo:fiador:hipoteca:propietario');

  const vistas = new Set();
  return reglas.filter((r) => {
    const clave = [r.regla, r.origen_tipo, r.origen_id, r.destino_tipo, r.destino_id, r.tipo].join('|');
    if (vistas.has(clave)) return false;
    vistas.add(clave);
    return true;
  });
}

function reglasCompraVenta(bloque, datos) {
  const valores = datos.valores || {};
  const personas = datos.personas || {};
  const patrimonios = datos.patrimonios || {};
  const base = {
    anio_inicio: numero(valores.f3),
    fecha_exacta_inicio: texto(valores.f4),
    fecha_exacta_inicio_meta: jsonTexto(valores.f4_meta),
    lugar_inicio: numero(valores.f2),
    fuente_id: numero(bloque.fuente_id),
  };
  const baseFin = {
    anio_fin: numero(valores.f3),
    fecha_exacta_fin: texto(valores.f4),
    fecha_exacta_fin_meta: jsonTexto(valores.f4_meta),
    lugar_fin: numero(valores.f2),
    fuente_id: numero(bloque.fuente_id),
  };
  const reglas = [];
  const agregar = (regla, origenTipo, origenId, destinoTipo, destinoId, tipo, campos = base) => {
    if (!origenId || !destinoId) return;
    reglas.push({
      regla,
      origen_tipo: origenTipo,
      origen_id: origenId,
      destino_tipo: destinoTipo,
      destino_id: destinoId,
      tipo,
      ...campos,
    });
  };
  const filas = (id) => filasDePersona(personas, id);
  const personasDe = (id) => filas(id)
    .map((fila) => numero(fila.persona_id))
    .filter(Boolean);
  const agregarMiembros = (id, clave) => {
    for (const fila of filas(id)) {
      agregar(`compraventa:${clave}:propia:miembro`, 'persona', numero(fila.persona_id),
        'institucion', numero(fila.institucion_id), 'Miembro');
    }
  };

  agregarMiembros('p1', 'escribano');
  agregarMiembros('p2', 'testigos');
  agregarMiembros('p3', 'vendedor');
  agregarMiembros('p4', 'comprador');
  agregarMiembros('p6', 'fiador');

  const cruzar = (regla, origenIds, destinoIds, tipo) => {
    for (const origenId of origenIds) {
      for (const destinoId of destinoIds) {
        agregar(regla, 'persona', origenId, 'persona', destinoId, tipo);
      }
    }
  };
  cruzar('compraventa:vendedor:escribano:otorgante-escribano',
    personasDe('p3'), personasDe('p1'), 'Otorgante – Escribano/Notario');
  cruzar('compraventa:vendedor:testigos:otorgante-testigo',
    personasDe('p3'), personasDe('p2'), 'Otorgante – Testigo');
  cruzar('compraventa:comprador:vendedor:comprador-vendedor',
    personasDe('p4'), personasDe('p3'), 'Comprador – Vendedor');
  cruzar('compraventa:fiador:comprador:fiador-deudor',
    personasDe('p6'), personasDe('p4'), 'Fiador/Aval – Deudor');

  /* El contrato de compraventa se fecha con la fecha del documento: sus
     campos van al lado HASTA de la relación. */
  for (const origenId of personasDe('p3')) {
    for (const fila of (Array.isArray(patrimonios.p8) ? patrimonios.p8 : [])) {
      agregar('compraventa:vendedor:contrato:propietario', 'persona', origenId,
        'patrimonio', numero(fila.patrimonio_id), 'Propietario', baseFin);
    }
  }
  for (const origenId of personasDe('p4')) {
    for (const fila of (Array.isArray(patrimonios.p8) ? patrimonios.p8 : [])) {
      agregar('compraventa:comprador:contrato:propietario', 'persona', origenId,
        'patrimonio', numero(fila.patrimonio_id), 'Propietario', base);
    }
  }

  const propietariosDeHipoteca = (idPersona, idBloque, regla) => {
    for (const fila of filas(idPersona)) {
      const persona = numero(fila.persona_id);
      const hipotecas = Array.isArray(fila.patrimonios?.[idBloque])
        ? fila.patrimonios[idBloque] : [];
      for (const hipoteca of hipotecas) {
        agregar(regla, 'persona', persona, 'patrimonio',
          numero(hipoteca.patrimonio_id), 'Propietario');
      }
    }
  };
  propietariosDeHipoteca('p4', 'p5', 'compraventa:comprador:hipoteca:propietario');
  propietariosDeHipoteca('p6', 'p7', 'compraventa:fiador:hipoteca:propietario');

  const vistas = new Set();
  return reglas.filter((r) => {
    const clave = [r.regla, r.origen_tipo, r.origen_id, r.destino_tipo, r.destino_id, r.tipo].join('|');
    if (vistas.has(clave)) return false;
    vistas.add(clave);
    return true;
  });
}

function reglasDiezmos(bloque, datos) {
  const valores = datos.valores || {};
  const personas = datos.personas || {};
  const base = {
    anio_inicio: numero(valores.f3),
    fecha_exacta_inicio: texto(valores.f4),
    fecha_exacta_inicio_meta: jsonTexto(valores.f4_meta),
    lugar_inicio: numero(valores.f2),
    fuente_id: numero(bloque.fuente_id),
  };
  const reglas = [];
  const agregar = (regla, origenTipo, origenId, destinoTipo, destinoId, tipo) => {
    if (!origenId || !destinoId) return;
    reglas.push({
      regla,
      origen_tipo: origenTipo,
      origen_id: origenId,
      destino_tipo: destinoTipo,
      destino_id: destinoId,
      tipo,
      ...base,
    });
  };
  const filas = (id) => filasDePersona(personas, id);
  const personasDe = (id) => filas(id)
    .map((fila) => numero(fila.persona_id))
    .filter(Boolean);
  const agregarMiembros = (id, clave) => {
    for (const fila of filas(id)) {
      agregar(`diezmos:${clave}:propia:miembro`, 'persona', numero(fila.persona_id),
        'institucion', numero(fila.institucion_id), 'Miembro');
    }
  };

  agregarMiembros('p1', 'escribano');
  agregarMiembros('p2', 'testigos');
  agregarMiembros('p3', 'diezmero');
  agregarMiembros('p5', 'fiador');
  agregarMiembros('p7', 'beneficiario');

  const cruzar = (regla, origenIds, destinoIds, tipo) => {
    for (const origenId of origenIds) {
      for (const destinoId of destinoIds) {
        agregar(regla, 'persona', origenId, 'persona', destinoId, tipo);
      }
    }
  };
  cruzar('diezmos:diezmero:escribano:otorgante-escribano',
    personasDe('p3'), personasDe('p1'), 'Otorgante – Escribano/Notario');
  cruzar('diezmos:diezmero:testigos:otorgante-testigo',
    personasDe('p3'), personasDe('p2'), 'Otorgante – Testigo');
  cruzar('diezmos:beneficiario:diezmero:acreedor-deudor',
    personasDe('p7'), personasDe('p3'), 'Acreedor – Deudor');
  cruzar('diezmos:fiador:diezmero:fiador-deudor',
    personasDe('p5'), personasDe('p3'), 'Fiador/Aval – Deudor');

  const propietariosDeHipoteca = (idPersona, idBloque, regla) => {
    for (const fila of filas(idPersona)) {
      const persona = numero(fila.persona_id);
      const hipotecas = Array.isArray(fila.patrimonios?.[idBloque])
        ? fila.patrimonios[idBloque] : [];
      for (const hipoteca of hipotecas) {
        agregar(regla, 'persona', persona, 'patrimonio',
          numero(hipoteca.patrimonio_id), 'Propietario');
      }
    }
  };
  propietariosDeHipoteca('p3', 'p4', 'diezmos:diezmero:hipoteca:propietario');
  propietariosDeHipoteca('p5', 'p6', 'diezmos:fiador:hipoteca:propietario');

  const vistas = new Set();
  return reglas.filter((r) => {
    const clave = [r.regla, r.origen_tipo, r.origen_id, r.destino_tipo, r.destino_id, r.tipo].join('|');
    if (vistas.has(clave)) return false;
    vistas.add(clave);
    return true;
  });
}

function reglasDonacion(bloque, datos) {
  const valores = datos.valores || {};
  const personas = datos.personas || {};
  const patrimonios = datos.patrimonios || {};
  const base = {
    anio_inicio: numero(valores.f3),
    fecha_exacta_inicio: texto(valores.f4),
    fecha_exacta_inicio_meta: jsonTexto(valores.f4_meta),
    lugar_inicio: numero(valores.f2),
    fuente_id: numero(bloque.fuente_id),
  };
  const baseFin = {
    anio_fin: numero(valores.f3),
    fecha_exacta_fin: texto(valores.f4),
    fecha_exacta_fin_meta: jsonTexto(valores.f4_meta),
    lugar_fin: numero(valores.f2),
    fuente_id: numero(bloque.fuente_id),
  };
  const reglas = [];
  const agregar = (regla, origenTipo, origenId, destinoTipo, destinoId, tipo, campos = base) => {
    if (!origenId || !destinoId) return;
    reglas.push({
      regla,
      origen_tipo: origenTipo,
      origen_id: origenId,
      destino_tipo: destinoTipo,
      destino_id: destinoId,
      tipo,
      ...campos,
    });
  };
  const filas = (id) => filasDePersona(personas, id);
  const personasDe = (id) => filas(id)
    .map((fila) => numero(fila.persona_id))
    .filter(Boolean);
  const agregarMiembros = (id, clave) => {
    for (const fila of filas(id)) {
      agregar(`donacion:${clave}:propia:miembro`, 'persona', numero(fila.persona_id),
        'institucion', numero(fila.institucion_id), 'Miembro');
    }
  };

  agregarMiembros('p1', 'escribano');
  agregarMiembros('p2', 'testigos');
  agregarMiembros('p3', 'donador');
  agregarMiembros('p4', 'donatario');

  const cruzar = (regla, origenIds, destinoIds, tipo) => {
    for (const origenId of origenIds) {
      for (const destinoId of destinoIds) {
        agregar(regla, 'persona', origenId, 'persona', destinoId, tipo);
      }
    }
  };
  cruzar('donacion:donador:escribano:otorgante-escribano',
    personasDe('p3'), personasDe('p1'), 'Otorgante – Escribano/Notario');
  cruzar('donacion:donador:testigos:otorgante-testigo',
    personasDe('p3'), personasDe('p2'), 'Otorgante – Testigo');
  cruzar('donacion:donador:donatario:donante-beneficiario',
    personasDe('p3'), personasDe('p4'), 'Mecenas/Donante – Beneficiario');

  /* El donador deja de ser propietario en la fecha del contrato; el
     donatario empieza a serlo en esa misma fecha. */
  for (const origenId of personasDe('p3')) {
    for (const fila of (Array.isArray(patrimonios.p5) ? patrimonios.p5 : [])) {
      agregar('donacion:donador:contrato:propietario', 'persona', origenId,
        'patrimonio', numero(fila.patrimonio_id), 'Propietario', baseFin);
    }
  }
  for (const origenId of personasDe('p4')) {
    for (const fila of (Array.isArray(patrimonios.p5) ? patrimonios.p5 : [])) {
      agregar('donacion:donatario:contrato:propietario', 'persona', origenId,
        'patrimonio', numero(fila.patrimonio_id), 'Propietario', base);
    }
  }

  const vistas = new Set();
  return reglas.filter((r) => {
    const clave = [r.regla, r.origen_tipo, r.origen_id, r.destino_tipo, r.destino_id, r.tipo].join('|');
    if (vistas.has(clave)) return false;
    vistas.add(clave);
    return true;
  });
}

function reglasConFianza(bloque, datos, prefijo, opciones = {}) {
  const valores = datos.valores || {};
  const personas = datos.personas || {};
  const base = {
    anio_inicio: numero(valores.f3),
    fecha_exacta_inicio: texto(valores.f4),
    fecha_exacta_inicio_meta: jsonTexto(valores.f4_meta),
    lugar_inicio: numero(valores.f2),
    fuente_id: numero(bloque.fuente_id),
  };
  const baseFin = {
    anio_fin: numero(valores.f3),
    fecha_exacta_fin: texto(valores.f4),
    fecha_exacta_fin_meta: jsonTexto(valores.f4_meta),
    lugar_fin: numero(valores.f2),
    fuente_id: numero(bloque.fuente_id),
  };
  const reglas = [];
  const agregar = (regla, origenTipo, origenId, destinoTipo, destinoId, tipo, campos = base) => {
    if (!origenId || !destinoId) return;
    reglas.push({
      regla,
      origen_tipo: origenTipo,
      origen_id: origenId,
      destino_tipo: destinoTipo,
      destino_id: destinoId,
      tipo,
      ...campos,
    });
  };
  const filas = (id) => filasDePersona(personas, id);
  const personasDe = (id) => filas(id)
    .map((fila) => numero(fila.persona_id))
    .filter(Boolean);
  const agregarMiembros = (id, clave) => {
    for (const fila of filas(id)) {
      agregar(`${prefijo}:${clave}:propia:miembro`, 'persona', numero(fila.persona_id),
        'institucion', numero(fila.institucion_id), 'Miembro');
    }
  };

  agregarMiembros('p1', 'escribano');
  agregarMiembros('p2', 'testigos');
  agregarMiembros('p3', 'fiador');
  agregarMiembros('p5', 'deudor');
  if (opciones.acreedorPropio) agregarMiembros('p7', 'acreedor');

  const cruzar = (regla, origenIds, destinoIds, tipo) => {
    for (const origenId of origenIds) {
      for (const destinoId of destinoIds) {
        agregar(regla, 'persona', origenId, 'persona', destinoId, tipo);
      }
    }
  };
  cruzar(`${prefijo}:deudor:escribano:otorgante-escribano`,
    personasDe('p5'), personasDe('p1'), 'Otorgante – Escribano/Notario');
  cruzar(`${prefijo}:deudor:testigos:otorgante-testigo`,
    personasDe('p5'), personasDe('p2'), 'Otorgante – Testigo');
  cruzar(`${prefijo}:fiador:deudor:fiador-deudor`,
    personasDe('p3'), personasDe('p5'), 'Fiador/Aval – Deudor');
  cruzar(`${prefijo}:acreedor:deudor:acreedor-deudor`,
    personasDe('p7'), personasDe('p5'), 'Acreedor – Deudor');

  const propietariosDeHipoteca = (idPersona, idBloque, regla) => {
    for (const fila of filas(idPersona)) {
      const persona = numero(fila.persona_id);
      const hipotecas = Array.isArray(fila.patrimonios?.[idBloque])
        ? fila.patrimonios[idBloque] : [];
      for (const hipoteca of hipotecas) {
        agregar(regla, 'persona', persona, 'patrimonio',
          numero(hipoteca.patrimonio_id), 'Propietario', baseFin);
      }
    }
  };
  propietariosDeHipoteca('p5', 'p6', `${prefijo}:deudor:hipoteca:propietario`);
  propietariosDeHipoteca('p3', 'p4', `${prefijo}:fiador:hipoteca:propietario`);

  const vistas = new Set();
  return reglas.filter((r) => {
    const clave = [r.regla, r.origen_tipo, r.origen_id, r.destino_tipo, r.destino_id, r.tipo].join('|');
    if (vistas.has(clave)) return false;
    vistas.add(clave);
    return true;
  });
}

function reglasFianza(bloque, datos) {
  return reglasConFianza(bloque, datos, 'fianza');
}

function reglasHipoteca(bloque, datos) {
  return reglasConFianza(bloque, datos, 'hipoteca');
}

function reglasObligacion(bloque, datos) {
  return reglasConFianza(bloque, datos, 'obligacion', { acreedorPropio: true });
}

function reglasInventarios(bloque, datos) {
  const valores = datos.valores || {};
  const personas = datos.personas || {};
  const base = {
    anio_inicio: numero(valores.f3),
    fecha_exacta_inicio: texto(valores.f4),
    fecha_exacta_inicio_meta: jsonTexto(valores.f4_meta),
    lugar_inicio: numero(valores.f2),
    fuente_id: numero(bloque.fuente_id),
  };
  const reglas = [];
  const agregar = (regla, origenTipo, origenId, destinoTipo, destinoId, tipo) => {
    if (!origenId || !destinoId) return;
    reglas.push({
      regla,
      origen_tipo: origenTipo,
      origen_id: origenId,
      destino_tipo: destinoTipo,
      destino_id: destinoId,
      tipo,
      ...base,
    });
  };
  const filas = (id) => filasDePersona(personas, id);
  const personasDe = (id) => filas(id)
    .map((fila) => numero(fila.persona_id))
    .filter(Boolean);
  const agregarMiembros = (id, clave) => {
    for (const fila of filas(id)) {
      agregar(`inventarios:${clave}:propia:miembro`, 'persona', numero(fila.persona_id),
        'institucion', numero(fila.institucion_id), 'Miembro');
    }
  };

  agregarMiembros('p1', 'escribano');
  agregarMiembros('p2', 'propietario');
  agregarMiembros('p3', 'administrador');

  const cruzar = (regla, origenIds, destinoIds, tipo) => {
    for (const origenId of origenIds) {
      for (const destinoId of destinoIds) {
        agregar(regla, 'persona', origenId, 'persona', destinoId, tipo);
      }
    }
  };
  cruzar('inventarios:propietario:escribano:otorgante-escribano',
    personasDe('p2'), personasDe('p1'), 'Otorgante – Escribano/Notario');
  cruzar('inventarios:propietario:administrador:patron-mayordomo',
    personasDe('p2'), personasDe('p3'), 'Patrón – Mayordomo');

  const vistas = new Set();
  return reglas.filter((r) => {
    const clave = [r.regla, r.origen_tipo, r.origen_id, r.destino_tipo, r.destino_id, r.tipo].join('|');
    if (vistas.has(clave)) return false;
    vistas.add(clave);
    return true;
  });
}

function reglasLegados(bloque, datos) {
  const valores = datos.valores || {};
  const personas = datos.personas || {};
  const patrimonios = datos.patrimonios || {};
  const base = {
    anio_inicio: numero(valores.f3),
    fecha_exacta_inicio: texto(valores.f4),
    fecha_exacta_inicio_meta: jsonTexto(valores.f4_meta),
    lugar_inicio: numero(valores.f2),
    fuente_id: numero(bloque.fuente_id),
  };
  const baseFin = {
    anio_fin: numero(valores.f3),
    fecha_exacta_fin: texto(valores.f4),
    fecha_exacta_fin_meta: jsonTexto(valores.f4_meta),
    lugar_fin: numero(valores.f2),
    fuente_id: numero(bloque.fuente_id),
  };
  const reglas = [];
  const agregar = (regla, origenTipo, origenId, destinoTipo, destinoId, tipo, campos = base) => {
    if (!origenId || !destinoId) return;
    reglas.push({
      regla,
      origen_tipo: origenTipo,
      origen_id: origenId,
      destino_tipo: destinoTipo,
      destino_id: destinoId,
      tipo,
      ...campos,
    });
  };
  const filas = (id) => filasDePersona(personas, id);
  const personasDe = (id) => filas(id)
    .map((fila) => numero(fila.persona_id))
    .filter(Boolean);
  const agregarMiembros = (id, clave) => {
    for (const fila of filas(id)) {
      agregar(`legados:${clave}:propia:miembro`, 'persona', numero(fila.persona_id),
        'institucion', numero(fila.institucion_id), 'Miembro');
    }
  };

  const roles = [
    ['p1', 'escribano'],
    ['p2', 'testigos'],
    ['p3', 'testador'],
    ['p4', 'padre'],
    ['p5', 'madre'],
    ['p6', 'conyuge'],
    ['p7', 'viudo'],
    ['p8', 'hijos-legitimos'],
    ['p9', 'hijos-naturales'],
    ['p10', 'deudores'],
    ['p11', 'acreedores'],
    ['p12', 'legatario'],
    ['p13', 'herederos'],
    ['p14', 'albaceas'],
  ];
  for (const [id, clave] of roles) agregarMiembros(id, clave);

  const cruzar = (regla, origenIds, destinoIds, tipo) => {
    for (const origenId of origenIds) {
      for (const destinoId of destinoIds) {
        agregar(regla, 'persona', origenId, 'persona', destinoId, tipo);
      }
    }
  };
  cruzar('legados:testador:escribano:otorgante-escribano',
    personasDe('p3'), personasDe('p1'), 'Otorgante – Escribano/Notario');
  cruzar('legados:testador:testigos:otorgante-testigo',
    personasDe('p3'), personasDe('p2'), 'Otorgante – Testigo');
  cruzar('legados:padre:testador:padre-legitimo',
    personasDe('p4'), personasDe('p3'), 'Padre/Madre legítimo – Hijo legítimo');
  cruzar('legados:madre:testador:madre-legitima',
    personasDe('p5'), personasDe('p3'), 'Padre/Madre legítimo – Hijo legítimo');
  cruzar('legados:conyuge:testador:conyuges',
    personasDe('p6'), personasDe('p3'), 'Cónyuges');
  cruzar('legados:testador:viudo:viudo-finado',
    personasDe('p3'), personasDe('p7'), 'Viudo – Finado');
  cruzar('legados:testador:hijos-legitimos:padre-legitimo',
    personasDe('p3'), personasDe('p8'), 'Padre/Madre legítimo – Hijo legítimo');
  cruzar('legados:testador:hijos-naturales:padre-natural',
    personasDe('p3'), personasDe('p9'), 'Padre/Madre natural – Hijo natural');
  cruzar('legados:testador:deudores:acreedor-deudor',
    personasDe('p3'), personasDe('p10'), 'Acreedor – Deudor');
  cruzar('legados:acreedores:testador:acreedor-deudor',
    personasDe('p11'), personasDe('p3'), 'Acreedor – Deudor');
  cruzar('legados:legatario:testador:apoderado-representado',
    personasDe('p12'), personasDe('p3'), 'Apoderado – Representado');
  cruzar('legados:testador:albaceas:testador-albacea',
    personasDe('p3'), personasDe('p14'), 'Testador – Albacea');
  cruzar('legados:testador:herederos:testador-heredero',
    personasDe('p3'), personasDe('p13'), 'Testador – Heredero');

  for (const origenId of personasDe('p3')) {
    for (const fila of (Array.isArray(patrimonios.p15) ? patrimonios.p15 : [])) {
      agregar('legados:testador:patrimonios:propietario', 'persona', origenId,
        'patrimonio', numero(fila.patrimonio_id), 'Propietario', baseFin);
    }
  }

  const vistas = new Set();
  return reglas.filter((r) => {
    const clave = [r.regla, r.origen_tipo, r.origen_id, r.destino_tipo, r.destino_id, r.tipo].join('|');
    if (vistas.has(clave)) return false;
    vistas.add(clave);
    return true;
  });
}

function reglasTestamentos(bloque, datos) {
  const valores = datos.valores || {};
  const personas = datos.personas || {};
  const patrimonios = datos.patrimonios || {};
  const base = {
    anio_inicio: numero(valores.f3),
    fecha_exacta_inicio: texto(valores.f4),
    fecha_exacta_inicio_meta: jsonTexto(valores.f4_meta),
    lugar_inicio: numero(valores.f2),
    fuente_id: numero(bloque.fuente_id),
  };
  const baseFin = {
    anio_fin: numero(valores.f3),
    fecha_exacta_fin: texto(valores.f4),
    fecha_exacta_fin_meta: jsonTexto(valores.f4_meta),
    lugar_fin: numero(valores.f2),
    fuente_id: numero(bloque.fuente_id),
  };
  const reglas = [];
  const agregar = (regla, origenTipo, origenId, destinoTipo, destinoId, tipo, campos = base) => {
    if (!origenId || !destinoId) return;
    reglas.push({
      regla,
      origen_tipo: origenTipo,
      origen_id: origenId,
      destino_tipo: destinoTipo,
      destino_id: destinoId,
      tipo,
      ...campos,
    });
  };
  const filas = (id) => filasDePersona(personas, id);
  const personasDe = (id) => filas(id)
    .map((fila) => numero(fila.persona_id))
    .filter(Boolean);
  const agregarMiembros = (id, clave) => {
    for (const fila of filas(id)) {
      agregar(`testamentos:${clave}:propia:miembro`, 'persona', numero(fila.persona_id),
        'institucion', numero(fila.institucion_id), 'Miembro');
    }
  };

  const roles = [
    ['p1', 'escribano'],
    ['p2', 'testigos'],
    ['p3', 'testador'],
    ['p4', 'padre'],
    ['p5', 'madre'],
    ['p6', 'conyuge'],
    ['p7', 'viudo'],
    ['p8', 'hijos-legitimos'],
    ['p9', 'hijos-naturales'],
    ['p10', 'deudores'],
    ['p11', 'acreedores'],
    ['p12', 'albaceas'],
    ['p13', 'herederos'],
  ];
  for (const [id, clave] of roles) agregarMiembros(id, clave);

  const cruzar = (regla, origenIds, destinoIds, tipo) => {
    for (const origenId of origenIds) {
      for (const destinoId of destinoIds) {
        agregar(regla, 'persona', origenId, 'persona', destinoId, tipo);
      }
    }
  };
  cruzar('testamentos:testador:escribano:otorgante-escribano',
    personasDe('p3'), personasDe('p1'), 'Otorgante – Escribano/Notario');
  cruzar('testamentos:testador:testigos:otorgante-testigo',
    personasDe('p3'), personasDe('p2'), 'Otorgante – Testigo');
  cruzar('testamentos:padre:testador:padre-legitimo',
    personasDe('p4'), personasDe('p3'), 'Padre/Madre legítimo – Hijo legítimo');
  cruzar('testamentos:madre:testador:madre-legitima',
    personasDe('p5'), personasDe('p3'), 'Padre/Madre legítimo – Hijo legítimo');
  cruzar('testamentos:conyuge:testador:conyuges',
    personasDe('p6'), personasDe('p3'), 'Cónyuges');
  cruzar('testamentos:testador:viudo:viudo-finado',
    personasDe('p3'), personasDe('p7'), 'Viudo – Finado');
  cruzar('testamentos:testador:hijos-legitimos:padre-legitimo',
    personasDe('p3'), personasDe('p8'), 'Padre/Madre legítimo – Hijo legítimo');
  cruzar('testamentos:testador:hijos-naturales:padre-natural',
    personasDe('p3'), personasDe('p9'), 'Padre/Madre natural – Hijo natural');
  cruzar('testamentos:testador:deudores:acreedor-deudor',
    personasDe('p3'), personasDe('p10'), 'Acreedor – Deudor');
  cruzar('testamentos:acreedores:testador:acreedor-deudor',
    personasDe('p11'), personasDe('p3'), 'Acreedor – Deudor');
  cruzar('testamentos:testador:albaceas:testador-albacea',
    personasDe('p3'), personasDe('p12'), 'Testador – Albacea');
  cruzar('testamentos:testador:herederos:testador-heredero',
    personasDe('p3'), personasDe('p13'), 'Testador – Heredero');

  for (const origenId of personasDe('p3')) {
    for (const fila of (Array.isArray(patrimonios.p14) ? patrimonios.p14 : [])) {
      agregar('testamentos:testador:patrimonios:propietario', 'persona', origenId,
        'patrimonio', numero(fila.patrimonio_id), 'Propietario', baseFin);
    }
  }

  const vistas = new Set();
  return reglas.filter((r) => {
    const clave = [r.regla, r.origen_tipo, r.origen_id, r.destino_tipo, r.destino_id, r.tipo].join('|');
    if (vistas.has(clave)) return false;
    vistas.add(clave);
    return true;
  });
}

function reglasPoder(bloque, datos) {
  const valores = datos.valores || {};
  const personas = datos.personas || {};
  const base = {
    anio_inicio: numero(valores.f3),
    fecha_exacta_inicio: texto(valores.f4),
    fecha_exacta_inicio_meta: jsonTexto(valores.f4_meta),
    lugar_inicio: numero(valores.f2),
    fuente_id: numero(bloque.fuente_id),
  };
  const reglas = [];
  const agregar = (regla, origenTipo, origenId, destinoTipo, destinoId, tipo) => {
    if (!origenId || !destinoId) return;
    reglas.push({
      regla,
      origen_tipo: origenTipo,
      origen_id: origenId,
      destino_tipo: destinoTipo,
      destino_id: destinoId,
      tipo,
      ...base,
    });
  };
  const filas = (id) => filasDePersona(personas, id);
  const personasDe = (id) => filas(id)
    .map((fila) => numero(fila.persona_id))
    .filter(Boolean);
  const agregarMiembros = (id, clave) => {
    for (const fila of filas(id)) {
      agregar(`poder:${clave}:propia:miembro`, 'persona', numero(fila.persona_id),
        'institucion', numero(fila.institucion_id), 'Miembro');
    }
  };

  agregarMiembros('p1', 'escribano');
  agregarMiembros('p2', 'testigos');
  agregarMiembros('p3', 'otorgante');
  agregarMiembros('p4', 'apoderado');

  const cruzar = (regla, origenIds, destinoIds, tipo) => {
    for (const origenId of origenIds) {
      for (const destinoId of destinoIds) {
        agregar(regla, 'persona', origenId, 'persona', destinoId, tipo);
      }
    }
  };
  cruzar('poder:otorgante:escribano:otorgante-escribano',
    personasDe('p3'), personasDe('p1'), 'Otorgante – Escribano/Notario');
  cruzar('poder:otorgante:testigos:otorgante-testigo',
    personasDe('p3'), personasDe('p2'), 'Otorgante – Testigo');
  /* Con la corrección de NRELACIONES, «Apoderado – Representado» admite
     PERSONA, INSTITUCIÓN o PATRIMONIO como representado. */
  cruzar('poder:apoderado:otorgante:apoderado-representado',
    personasDe('p4'), personasDe('p3'), 'Apoderado – Representado');

  const vistas = new Set();
  return reglas.filter((r) => {
    const clave = [r.regla, r.origen_tipo, r.origen_id, r.destino_tipo, r.destino_id, r.tipo].join('|');
    if (vistas.has(clave)) return false;
    vistas.add(clave);
    return true;
  });
}

function reglasEpistolas(bloque, datos) {
  const valores = datos.valores || {};
  const personas = datos.personas || {};
  const base = {
    anio_inicio: numero(valores.f3),
    fecha_exacta_inicio: texto(valores.f4),
    fecha_exacta_inicio_meta: jsonTexto(valores.f4_meta),
    lugar_inicio: numero(valores.f2),
    fuente_id: numero(bloque.fuente_id),
  };
  const reglas = [];
  const agregar = (regla, origenTipo, origenId, destinoTipo, destinoId, tipo) => {
    if (!origenId || !destinoId) return;
    reglas.push({
      regla,
      origen_tipo: origenTipo,
      origen_id: origenId,
      destino_tipo: destinoTipo,
      destino_id: destinoId,
      tipo,
      ...base,
    });
  };
  const filas = (id) => filasDePersona(personas, id);
  const personasDe = (id) => filas(id)
    .map((fila) => numero(fila.persona_id))
    .filter(Boolean);
  const agregarMiembros = (id, clave) => {
    for (const fila of filas(id)) {
      agregar(`epistolas:${clave}:propia:miembro`, 'persona', numero(fila.persona_id),
        'institucion', numero(fila.institucion_id), 'Miembro');
    }
  };

  agregarMiembros('p1', 'remitente');
  agregarMiembros('p2', 'destinatario');

  /* El identificador interno conserva el nombre histórico «corresponsales»;
     el tipo visible es Correspondientes personales. */
  for (const origenId of personasDe('p1')) {
    for (const destinoId of personasDe('p2')) {
      agregar('epistolas:remitente:destinatario:corresponsales', 'persona', origenId,
        'persona', destinoId, 'Correspondientes personales');
    }
  }

  const vistas = new Set();
  return reglas.filter((r) => {
    const clave = [r.regla, r.origen_tipo, r.origen_id, r.destino_tipo, r.destino_id, r.tipo].join('|');
    if (vistas.has(clave)) return false;
    vistas.add(clave);
    return true;
  });
}

function reglasProcesos(bloque, datos) {
  const valores = datos.valores || {};
  const personas = datos.personas || {};
  const grupos = datos.grupos || {};
  const base = {
    anio_inicio: numero(valores.f5),
    fecha_exacta_inicio: texto(valores.f6),
    fecha_exacta_inicio_meta: jsonTexto(valores.f6_meta),
    lugar_inicio: numero(valores.f2),
    fuente_id: numero(bloque.fuente_id),
  };
  const reglas = [];
  const agregar = (regla, origenTipo, origenId, destinoTipo, destinoId, tipo) => {
    if (!origenId || !destinoId) return;
    reglas.push({
      regla,
      origen_tipo: origenTipo,
      origen_id: origenId,
      destino_tipo: destinoTipo,
      destino_id: destinoId,
      tipo,
      ...base,
    });
  };
  const filas = (id) => filasDePersona(personas, id);
  const personasDe = (id) => filas(id)
    .map((fila) => numero(fila.persona_id))
    .filter(Boolean);
  const agregarMiembros = (id, clave) => {
    for (const fila of filas(id)) {
      agregar(`procesos:${clave}:propia:miembro`, 'persona', numero(fila.persona_id),
        'institucion', numero(fila.institucion_id), 'Miembro');
    }
  };

  agregarMiembros('p1', 'jueces');
  agregarMiembros('p2', 'demandantes');
  agregarMiembros('p3', 'demandados');
  agregarMiembros('p4', 'terceros');

  const gruposConfig = [
    ['g1', 'escritos', 'p-escritos-productor', 'p-escritos-destinatario'],
    ['g2', 'resoluciones', 'p-resoluciones-productor', 'p-resoluciones-destinatario'],
    ['g3', 'actas', 'p-actas-productor', 'p-actas-destinatario'],
  ];
  for (const [grupoId, clave, productorId, destinatarioId] of gruposConfig) {
    const instancias = Array.isArray(grupos[grupoId]) ? grupos[grupoId] : [];
    for (const instancia of instancias) {
      const personasGrupo = instancia.personas || {};
      for (const fila of filasDePersona(personasGrupo, productorId)) {
        agregar(`procesos:${clave}:productor:propia:miembro`, 'persona',
          numero(fila.persona_id), 'institucion', numero(fila.institucion_id), 'Miembro');
      }
      for (const fila of filasDePersona(personasGrupo, destinatarioId)) {
        agregar(`procesos:${clave}:destinatario:propia:miembro`, 'persona',
          numero(fila.persona_id), 'institucion', numero(fila.institucion_id), 'Miembro');
      }
    }
  }

  const demandantes = personasDe('p2');
  const demandados = personasDe('p3');
  for (const origenId of demandantes) {
    for (const destinoId of demandados) {
      agregar('procesos:demandantes:demandados:litigantes', 'persona', origenId,
        'persona', destinoId, 'Litigantes');
      agregar('procesos:demandantes:demandados:demandante-acusado', 'persona', origenId,
        'persona', destinoId, 'Demandante – Acusado');
    }
  }

  const vistas = new Set();
  return reglas.filter((r) => {
    const clave = [r.regla, r.origen_tipo, r.origen_id, r.destino_tipo, r.destino_id, r.tipo].join('|');
    if (vistas.has(clave)) return false;
    vistas.add(clave);
    return true;
  });
}

function reglasCuentaPersonal(bloque, datos) {
  const valores = datos.valores || {};
  const personas = datos.personas || {};
  const base = {
    anio_inicio: numero(valores.f3),
    fecha_exacta_inicio: texto(valores.f4),
    fecha_exacta_inicio_meta: jsonTexto(valores.f4_meta),
    lugar_inicio: numero(valores.f2),
    fuente_id: numero(bloque.fuente_id),
  };
  const reglas = [];
  const agregar = (regla, origenTipo, origenId, destinoTipo, destinoId, tipo) => {
    if (!origenId || !destinoId) return;
    reglas.push({
      regla,
      origen_tipo: origenTipo,
      origen_id: origenId,
      destino_tipo: destinoTipo,
      destino_id: destinoId,
      tipo,
      ...base,
    });
  };
  const filas = (id) => filasDePersona(personas, id);
  const personasDe = (id) => filas(id)
    .map((fila) => numero(fila.persona_id))
    .filter(Boolean);
  const agregarMiembros = (id, clave) => {
    for (const fila of filas(id)) {
      agregar(`cuenta:${clave}:propia:miembro`, 'persona', numero(fila.persona_id),
        'institucion', numero(fila.institucion_id), 'Miembro');
    }
  };

  agregarMiembros('p1', 'escribano');
  agregarMiembros('p2', 'acreedor');
  agregarMiembros('p3', 'deudor');

  const cruzar = (regla, origenIds, destinoIds, tipo) => {
    for (const origenId of origenIds) {
      for (const destinoId of destinoIds) {
        agregar(regla, 'persona', origenId, 'persona', destinoId, tipo);
      }
    }
  };
  cruzar('cuenta:acreedor:escribano:otorgante-escribano',
    personasDe('p2'), personasDe('p1'), 'Otorgante – Escribano/Notario');
  cruzar('cuenta:acreedor:deudor:acreedor-deudor',
    personasDe('p2'), personasDe('p3'), 'Acreedor – Deudor');

  const vistas = new Set();
  return reglas.filter((r) => {
    const clave = [r.regla, r.origen_tipo, r.origen_id, r.destino_tipo, r.destino_id, r.tipo].join('|');
    if (vistas.has(clave)) return false;
    vistas.add(clave);
    return true;
  });
}

function reglasBautismo(bloque, datos) {
  const valores = datos.valores || {};
  const personas = datos.personas || {};
  const base = {
    anio_inicio: numero(valores.f4),
    fecha_exacta_inicio: texto(valores.f5),
    fecha_exacta_inicio_meta: jsonTexto(valores.f5_meta),
    lugar_inicio: numero(valores.f2),
    fuente_id: numero(bloque.fuente_id),
  };
  const reglas = [];
  const agregar = (regla, origenTipo, origenId, destinoTipo, destinoId, tipo) => {
    if (!origenId || !destinoId) return;
    reglas.push({
      regla,
      origen_tipo: origenTipo,
      origen_id: origenId,
      destino_tipo: destinoTipo,
      destino_id: destinoId,
      tipo,
      ...base,
    });
  };
  const filas = (id) => filasDePersona(personas, id);
  const personasDe = (id) => filas(id)
    .map((fila) => numero(fila.persona_id))
    .filter(Boolean);
  const agregarMiembros = (id, clave) => {
    for (const fila of filas(id)) {
      agregar(`bautismo:${clave}:propia:miembro`, 'persona', numero(fila.persona_id),
        'institucion', numero(fila.institucion_id), 'Miembro');
    }
  };

  agregarMiembros('p1', 'oficiante');
  agregarMiembros('p2', 'bautizado');
  agregarMiembros('p3', 'padre');
  agregarMiembros('p4', 'madre');
  agregarMiembros('p5', 'padrinos');
  agregarMiembros('p6', 'testigos');

  const cruzar = (regla, origenIds, destinoIds, tipo) => {
    for (const origenId of origenIds) {
      for (const destinoId of destinoIds) {
        agregar(regla, 'persona', origenId, 'persona', destinoId, tipo);
      }
    }
  };
  cruzar('bautismo:bautizado:oficiante:otorgante-oficiante',
    personasDe('p2'), personasDe('p1'), 'Otorgante – Oficiante');
  cruzar('bautismo:bautizado:testigos:otorgante-testigo',
    personasDe('p2'), personasDe('p6'), 'Otorgante – Testigo');
  cruzar('bautismo:padre:padrinos:compadres',
    personasDe('p3'), personasDe('p5'), 'Compadres');
  cruzar('bautismo:madre:padrinos:compadres',
    personasDe('p4'), personasDe('p5'), 'Compadres');
  cruzar('bautismo:padrinos:bautizado:padrino-ahijado',
    personasDe('p5'), personasDe('p2'), 'Padrino/Madrina – Ahijado');

  const condicion = String(valores.f11 || '').trim();
  const tipoHijo = condicion === 'Legítimo'
    ? 'Padre/Madre legítimo – Hijo legítimo'
    : ['Natural', 'Padres no conocidos', 'Madre no conocida', 'Padre no conocido'].includes(condicion)
      ? 'Padre/Madre natural – Hijo natural'
      : null;
  if (tipoHijo) {
    cruzar('bautismo:padre:bautizado:padre-hijo',
      personasDe('p3'), personasDe('p2'), tipoHijo);
    cruzar('bautismo:madre:bautizado:madre-hijo',
      personasDe('p4'), personasDe('p2'), tipoHijo);
  }
  if (condicion === 'Legítimo') {
    cruzar('bautismo:padre:madre:conyuges',
      personasDe('p3'), personasDe('p4'), 'Cónyuges');
  }

  const vistas = new Set();
  return reglas.filter((r) => {
    const clave = [r.regla, r.origen_tipo, r.origen_id, r.destino_tipo, r.destino_id, r.tipo].join('|');
    if (vistas.has(clave)) return false;
    vistas.add(clave);
    return true;
  });
}

function reglasDefuncion(bloque, datos) {
  const valores = datos.valores || {};
  const personas = datos.personas || {};
  const base = {
    anio_inicio: numero(valores.f4),
    fecha_exacta_inicio: texto(valores.f5),
    fecha_exacta_inicio_meta: jsonTexto(valores.f5_meta),
    lugar_inicio: numero(valores.f2),
    fuente_id: numero(bloque.fuente_id),
  };
  const reglas = [];
  const agregar = (regla, origenTipo, origenId, destinoTipo, destinoId, tipo) => {
    if (!origenId || !destinoId) return;
    reglas.push({
      regla,
      origen_tipo: origenTipo,
      origen_id: origenId,
      destino_tipo: destinoTipo,
      destino_id: destinoId,
      tipo,
      ...base,
    });
  };
  const filas = (id) => filasDePersona(personas, id);
  const personasDe = (id) => filas(id)
    .map((fila) => numero(fila.persona_id))
    .filter(Boolean);
  const agregarMiembros = (id, clave) => {
    for (const fila of filas(id)) {
      agregar(`defuncion:${clave}:propia:miembro`, 'persona', numero(fila.persona_id),
        'institucion', numero(fila.institucion_id), 'Miembro');
    }
  };

  agregarMiembros('p1', 'oficiante');
  agregarMiembros('p2', 'finado');
  agregarMiembros('p3', 'conyuge');
  agregarMiembros('p4', 'padre');
  agregarMiembros('p5', 'madre');

  const cruzar = (regla, origenIds, destinoIds, tipo) => {
    for (const origenId of origenIds) {
      for (const destinoId of destinoIds) {
        agregar(regla, 'persona', origenId, 'persona', destinoId, tipo);
      }
    }
  };
  cruzar('defuncion:finado:oficiante:otorgante-oficiante',
    personasDe('p2'), personasDe('p1'), 'Otorgante – Oficiante');
  cruzar('defuncion:finado:conyuge:conyuges',
    personasDe('p2'), personasDe('p3'), 'Cónyuges');

  const vistas = new Set();
  return reglas.filter((r) => {
    const clave = [r.regla, r.origen_tipo, r.origen_id, r.destino_tipo, r.destino_id, r.tipo].join('|');
    if (vistas.has(clave)) return false;
    vistas.add(clave);
    return true;
  });
}

function reglasMatrimonio(bloque, datos) {
  const valores = datos.valores || {};
  const personas = datos.personas || {};
  const base = {
    anio_inicio: numero(valores.f4),
    fecha_exacta_inicio: texto(valores.f5),
    fecha_exacta_inicio_meta: jsonTexto(valores.f5_meta),
    lugar_inicio: numero(valores.f2),
    fuente_id: numero(bloque.fuente_id),
  };
  const reglas = [];
  const agregar = (regla, origenTipo, origenId, destinoTipo, destinoId, tipo) => {
    if (!origenId || !destinoId) return;
    reglas.push({
      regla,
      origen_tipo: origenTipo,
      origen_id: origenId,
      destino_tipo: destinoTipo,
      destino_id: destinoId,
      tipo,
      ...base,
    });
  };
  const filas = (id) => filasDePersona(personas, id);
  const personasDe = (id) => filas(id)
    .map((fila) => numero(fila.persona_id))
    .filter(Boolean);
  const agregarMiembros = (id, clave) => {
    for (const fila of filas(id)) {
      agregar(`matrimonio:${clave}:propia:miembro`, 'persona', numero(fila.persona_id),
        'institucion', numero(fila.institucion_id), 'Miembro');
    }
  };

  const roles = [
    ['p1', 'oficiante'],
    ['p2', 'novio'],
    ['p3', 'viudo'],
    ['p4', 'padre-novio'],
    ['p5', 'madre-novio'],
    ['p6', 'novia'],
    ['p7', 'viuda'],
    ['p8', 'padre-novia'],
    ['p9', 'madre-novia'],
    ['p10', 'padrinos'],
    ['p11', 'testigos'],
  ];
  for (const [id, clave] of roles) agregarMiembros(id, clave);

  const cruzar = (regla, origenIds, destinoIds, tipo) => {
    for (const origenId of origenIds) {
      for (const destinoId of destinoIds) {
        agregar(regla, 'persona', origenId, 'persona', destinoId, tipo);
      }
    }
  };
  cruzar('matrimonio:novio:oficiante:otorgante-oficiante',
    personasDe('p2'), personasDe('p1'), 'Otorgante – Oficiante');
  cruzar('matrimonio:novia:oficiante:otorgante-oficiante',
    personasDe('p6'), personasDe('p1'), 'Otorgante – Oficiante');
  cruzar('matrimonio:novio:testigos:otorgante-testigo',
    personasDe('p2'), personasDe('p11'), 'Otorgante – Testigo');
  cruzar('matrimonio:novia:testigos:otorgante-testigo',
    personasDe('p6'), personasDe('p11'), 'Otorgante – Testigo');
  cruzar('matrimonio:padrinos:novio:padrino-bodas',
    personasDe('p10'), personasDe('p2'), 'Padrino/Madrina de bodas – Ahijado de bodas');
  cruzar('matrimonio:padrinos:novia:padrino-bodas',
    personasDe('p10'), personasDe('p6'), 'Padrino/Madrina de bodas – Ahijado de bodas');
  cruzar('matrimonio:novio:novia:conyuges',
    personasDe('p2'), personasDe('p6'), 'Cónyuges');
  cruzar('matrimonio:novio:viudo:viudo-finado',
    personasDe('p2'), personasDe('p3'), 'Viudo – Finado');
  cruzar('matrimonio:novia:viuda:viudo-finado',
    personasDe('p6'), personasDe('p7'), 'Viudo – Finado');
  cruzar('matrimonio:padre-novia:novio:suegro-yerno',
    personasDe('p8'), personasDe('p2'), 'Suegro – Yerno/Nuera');
  cruzar('matrimonio:madre-novia:novio:suegro-yerno',
    personasDe('p9'), personasDe('p2'), 'Suegro – Yerno/Nuera');
  cruzar('matrimonio:padre-novio:novia:suegro-yerno',
    personasDe('p4'), personasDe('p6'), 'Suegro – Yerno/Nuera');
  cruzar('matrimonio:madre-novio:novia:suegro-yerno',
    personasDe('p5'), personasDe('p6'), 'Suegro – Yerno/Nuera');

  cruzar('matrimonio:padre-novio:padre-novia:consuegros',
    personasDe('p4'), personasDe('p8'), 'Consuegros');
  cruzar('matrimonio:padre-novio:madre-novia:consuegros',
    personasDe('p4'), personasDe('p9'), 'Consuegros');
  cruzar('matrimonio:padre-novia:madre-novio:consuegros',
    personasDe('p8'), personasDe('p5'), 'Consuegros');
  cruzar('matrimonio:madre-novio:madre-novia:consuegros',
    personasDe('p5'), personasDe('p9'), 'Consuegros');

  const condicionNovio = String(valores.f7 || '').trim();
  const condicionNovia = String(valores.f10 || '').trim();
  const tipoHijo = (condicion) => {
    if (condicion === 'Legítimo') return 'Padre/Madre legítimo – Hijo legítimo';
    if (['Natural', 'Padres no conocidos', 'Madre no conocida', 'Padre no conocido'].includes(condicion)) {
      return 'Padre/Madre natural – Hijo natural';
    }
    return null;
  };
  const tipoHijoNovio = tipoHijo(condicionNovio);
  if (tipoHijoNovio) {
    cruzar('matrimonio:padre-novio:novio:padre-hijo',
      personasDe('p4'), personasDe('p2'), tipoHijoNovio);
    cruzar('matrimonio:madre-novio:novio:madre-hijo',
      personasDe('p5'), personasDe('p2'), tipoHijoNovio);
  }
  const tipoHijoNovia = tipoHijo(condicionNovia);
  if (tipoHijoNovia) {
    cruzar('matrimonio:padre-novia:novia:padre-hijo',
      personasDe('p8'), personasDe('p6'), tipoHijoNovia);
    cruzar('matrimonio:madre-novia:novia:madre-hijo',
      personasDe('p9'), personasDe('p6'), tipoHijoNovia);
  }

  if (condicionNovio === 'Legítimo') {
    cruzar('matrimonio:padre-novio:madre-novio:conyuges',
      personasDe('p4'), personasDe('p5'), 'Cónyuges');
  }
  if (condicionNovia === 'Legítimo') {
    cruzar('matrimonio:padre-novia:madre-novia:conyuges',
      personasDe('p8'), personasDe('p9'), 'Cónyuges');
  }

  for (const origenId of personasDe('p2')) {
    agregar('matrimonio:novio:patria:oriundo', 'persona', origenId,
      'lugar', numero(valores.f6), 'Oriundo');
  }
  for (const origenId of personasDe('p6')) {
    agregar('matrimonio:novia:patria:oriundo', 'persona', origenId,
      'lugar', numero(valores.f9), 'Oriundo');
  }

  const vistas = new Set();
  return reglas.filter((r) => {
    const clave = [r.regla, r.origen_tipo, r.origen_id, r.destino_tipo, r.destino_id, r.tipo].join('|');
    if (vistas.has(clave)) return false;
    vistas.add(clave);
    return true;
  });
}

function reglasComunicaciones(bloque, datos) {
  const valores = datos.valores || {};
  const personas = datos.personas || {};
  const base = {
    anio_inicio: numero(valores.f4),
    fecha_exacta_inicio: texto(valores.f5),
    fecha_exacta_inicio_meta: jsonTexto(valores.f5_meta),
    lugar_inicio: numero(valores.f2),
    fuente_id: numero(bloque.fuente_id),
  };
  const institucionRegistro = numero(valores.f3);
  const reglas = [];
  const agregar = (regla, personaId, institucionId, tipo) => {
    if (!personaId || !institucionId) return;
    reglas.push({
      regla,
      origen_tipo: 'persona',
      origen_id: personaId,
      destino_tipo: 'institucion',
      destino_id: institucionId,
      tipo,
      ...base,
    });
  };
  const filas = (id) => filasDePersona(personas, id);
  const entidadesDe = (id) => filas(id).flatMap((fila) => {
    const persona = numero(fila.persona_id);
    if (persona) return [{ tipo: 'persona', id: persona }];
    const institucion = numero(fila.institucion_id);
    return institucion ? [{ tipo: 'institucion', id: institucion }] : [];
  });

  for (const fila of filas('p1')) {
    agregar('comunicaciones:remitente:propia:miembro', numero(fila.persona_id),
      numero(fila.institucion_id), 'Miembro');
  }
  for (const fila of filas('p2')) {
    agregar('comunicaciones:destinatario:propia:miembro', numero(fila.persona_id),
      numero(fila.institucion_id), 'Miembro');
  }
  for (const fila of filas('p3')) {
    const persona = numero(fila.persona_id);
    agregar('comunicaciones:escribano:propia:miembro', persona,
      numero(fila.institucion_id), 'Miembro');
    agregar('comunicaciones:escribano:registro:notario', persona,
      institucionRegistro, 'Escribano/Notario');
  }

  /* Remitente → destinatario: una relación por cada pareja de entidades
     vinculadas. Si un lado tiene persona se usa la persona; si no la tiene
     pero sí institución, se usa la institución. El sentido lo fija la
     sección: REMITENTE es el origen. */
  for (const origen of entidadesDe('p1')) {
    for (const destino of entidadesDe('p2')) {
      reglas.push({
        regla: 'comunicaciones:remitente:destinatario:corresponsales',
        origen_tipo: origen.tipo,
        origen_id: origen.id,
        destino_tipo: destino.tipo,
        destino_id: destino.id,
        tipo: 'Correspondientes legales',
        ...base,
      });
    }
  }

  const vistas = new Set();
  return reglas.filter((r) => {
    const clave = [r.regla, r.origen_tipo, r.origen_id, r.destino_tipo, r.destino_id, r.tipo].join('|');
    if (vistas.has(clave)) return false;
    vistas.add(clave);
    return true;
  });
}

function reglasDelTipo(bloque, datos) {
  if (bloque.tipo === 'Actas, acuerdos y resoluciones') return reglasActas(bloque, datos);
  if (bloque.tipo === 'Leyes, decretos, ordenanzas, reglamentos') return reglasLeyes(bloque, datos);
  if (bloque.tipo === 'Edictos, bandos, panfletos') return reglasLeyes(bloque, datos, 'edictos');
  if (bloque.tipo === 'Elecciones') return reglasElecciones(bloque, datos);
  if (bloque.tipo === 'Hojas de servicio') return reglasHojasServicio(bloque, datos);
  if (bloque.tipo === 'Nombramientos y designaciones') return reglasNombramientos(bloque, datos);
  if (bloque.tipo === 'Títulos') return reglasTitulos(bloque, datos);
  if (bloque.tipo === 'Arriendo') return reglasArriendo(bloque, datos);
  if (bloque.tipo === 'Compra/Venta') return reglasCompraVenta(bloque, datos);
  if (bloque.tipo === 'Diezmos') return reglasDiezmos(bloque, datos);
  if (bloque.tipo === 'Donación') return reglasDonacion(bloque, datos);
  if (bloque.tipo === 'Fianza') return reglasFianza(bloque, datos);
  if (bloque.tipo === 'Hipoteca') return reglasHipoteca(bloque, datos);
  if (bloque.tipo === 'Obligación') return reglasObligacion(bloque, datos);
  if (bloque.tipo === 'Poder') return reglasPoder(bloque, datos);
  if (bloque.tipo === 'Epístolas') return reglasEpistolas(bloque, datos);
  if (bloque.tipo === 'Procesos judiciales') return reglasProcesos(bloque, datos);
  if (bloque.tipo === 'Cuenta personal') return reglasCuentaPersonal(bloque, datos);
  if (bloque.tipo === 'Actas de bautismo') return reglasBautismo(bloque, datos);
  if (bloque.tipo === 'Actas de defunción') return reglasDefuncion(bloque, datos);
  if (bloque.tipo === 'Actas de matrimonio') return reglasMatrimonio(bloque, datos);
  if (bloque.tipo === 'Inventarios de bienes') return reglasInventarios(bloque, datos);
  if (bloque.tipo === 'Legados testamentarios') return reglasLegados(bloque, datos);
  if (bloque.tipo === 'Testamentos') return reglasTestamentos(bloque, datos);
  if (bloque.tipo === 'Comunicaciones') return reglasComunicaciones(bloque, datos);
  return [];
}

/* Reglas del formulario + LUGAR – SEDE – INSTITUCIÓN cuando corresponda. */
function reglasDeBloque(bloque, datos) {
  return reglasDelTipo(bloque, datos).concat(reglaSede(bloque, datos));
}

/** Traduce las firmas de exclusión de un bloque cuando cambian los ids de
    sus entidades (importación o fusión de fichas). Devuelve un Map
    firmaVieja → firmaNueva; incluye también el formato de firma anterior. */
function mapaFirmasExclusion(bloqueViejo, datosViejos, bloqueNuevo, datosNuevos) {
  const mapa = new Map();
  try {
    const propuestasViejas = reglasDeBloque(bloqueViejo, datosViejos);
    const propuestasNuevas = reglasDeBloque(bloqueNuevo, datosNuevos);
    const usadas = new Map();
    for (const vieja of propuestasViejas) {
      const indice = usadas.get(vieja.regla) || 0;
      usadas.set(vieja.regla, indice + 1);
      const nueva = propuestasNuevas.filter((x) => x.regla === vieja.regla)[indice];
      if (!nueva) continue;
      const firmaNueva = firmaDescriptor(nueva);
      mapa.set(firmaDescriptor(vieja), firmaNueva);
      mapa.set(firmaDescriptorLegacy(vieja), firmaNueva);
    }
  } catch (err) {
    console.warn('[relaciones] No se pudieron traducir las firmas de exclusión:', err.message);
  }
  return mapa;
}
/* ------------------------------------------------------------------ */
/* Consultas auxiliares                                                */
/* ------------------------------------------------------------------ */

/* ------------------------------------------------------------------ */
/* Escritura de relaciones automatizadas                               */
/* ------------------------------------------------------------------ */

async function asegurarFuente(db, relacionId, fuenteId, ejecutor = db.pool) {
  if (!fuenteId) return;
  const insertar = db.motor === 'sqlite' ? 'INSERT OR IGNORE' : 'INSERT IGNORE';
  await ejecutor.query(
    `${insertar} INTO relaciones_fuentes (relacion_id, fuente_id) VALUES (?, ?)`,
    [relacionId, fuenteId]
  );
}

async function crearAutomatica(db, proyectoId, bloqueId, d, ejecutor = db.pool) {
  const firma = firmaDescriptor(d);
  const [res] = await ejecutor.query(
    `INSERT INTO relaciones
      (proyecto_id, origen_tipo, origen_id, destino_tipo, destino_id, tipo,
       anio_inicio, fecha_exacta_inicio, fecha_exacta_inicio_meta, lugar_inicio,
       anio_fin, fecha_exacta_fin, fecha_exacta_fin_meta, lugar_fin,
       notas, procedencia, bloque_id, regla, firma)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, 'AUTOMATIZADA', ?, ?, ?)`,
    [
      proyectoId,
      d.origen_tipo, d.origen_id,
      d.destino_tipo, d.destino_id,
      d.tipo,
      d.anio_inicio ?? null,
      d.fecha_exacta_inicio ?? null,
      d.fecha_exacta_inicio_meta ?? null,
      d.lugar_inicio ?? null,
      d.anio_fin ?? null,
      d.fecha_exacta_fin ?? null,
      d.fecha_exacta_fin_meta ?? null,
      d.lugar_fin ?? null,
      bloqueId,
      d.regla,
      firma,
    ]
  );
  await asegurarFuente(db, res.insertId, d.fuente_id, ejecutor);
  return res.insertId;
}

async function actualizarAutomatica(db, relacionId, d, ejecutor = db.pool) {
  const firma = firmaDescriptor(d);
  await ejecutor.query(
    `UPDATE relaciones SET
       anio_inicio = ?, fecha_exacta_inicio = ?, fecha_exacta_inicio_meta = ?,
       lugar_inicio = ?, anio_fin = ?, fecha_exacta_fin = ?,
       fecha_exacta_fin_meta = ?, lugar_fin = ?, firma = ?
     WHERE id = ? AND procedencia = 'AUTOMATIZADA'`,
    [
      d.anio_inicio ?? null,
      d.fecha_exacta_inicio ?? null,
      d.fecha_exacta_inicio_meta ?? null,
      d.lugar_inicio ?? null,
      d.anio_fin ?? null,
      d.fecha_exacta_fin ?? null,
      d.fecha_exacta_fin_meta ?? null,
      d.lugar_fin ?? null,
      firma,
      relacionId,
    ]
  );
  await asegurarFuente(db, relacionId, d.fuente_id, ejecutor);
}

async function eliminarAutomatica(db, relacionId, ejecutor = db.pool) {
  await ejecutor.query(
    "DELETE FROM relaciones WHERE id = ? AND procedencia = 'AUTOMATIZADA'",
    [relacionId]
  );
}

/* ------------------------------------------------------------------ */
/* Reconciliación de un bloque                                         */
/* ------------------------------------------------------------------ */

async function reconciliarBloque(db, bloqueId, ejecutor = db.pool) {
  const [filas] = await ejecutor.query(
    `SELECT b.*, f.proyecto_id AS proyecto_id
     FROM bloques_registro b
     JOIN fuentes f ON f.id = b.fuente_id
     WHERE b.id = ?`,
    [bloqueId]
  );
  if (!filas.length) return;
  const bloque = filas[0];
  let datos;
  try {
    datos = bloque.datos ? JSON.parse(bloque.datos) : {};
  } catch {
    throw new Error(`El bloque de registro ${bloqueId} tiene datos corruptos.`);
  }

  const propuestas = reglasDeBloque(bloque, datos);
  const idsPorTipo = { persona: new Set(), institucion: new Set(), lugar: new Set(), patrimonio: new Set() };
  for (const d of propuestas) {
    if (idsPorTipo[d.origen_tipo]) idsPorTipo[d.origen_tipo].add(Number(d.origen_id));
    if (idsPorTipo[d.destino_tipo]) idsPorTipo[d.destino_tipo].add(Number(d.destino_id));
  }
  const existentesPorTipo = {};
  for (const [tipo, ids] of Object.entries(idsPorTipo)) {
    existentesPorTipo[tipo] = new Set();
    const lista = [...ids].filter((id) => Number.isFinite(id) && id > 0);
    for (let i = 0; i < lista.length; i += 500) {
      const trozo = lista.slice(i, i + 500);
      const [encontradas] = await ejecutor.query(
        `SELECT id FROM ${TABLAS_ENTIDAD[tipo]}
         WHERE proyecto_id = ? AND id IN (${trozo.map(() => '?').join(', ')})`,
        [bloque.proyecto_id, ...trozo]
      );
      for (const fila of encontradas) existentesPorTipo[tipo].add(Number(fila.id));
    }
  }

  const deseadas = [];
  for (const d of propuestas) {
    if (!existentesPorTipo[d.origen_tipo]?.has(Number(d.origen_id))) continue;
    if (!existentesPorTipo[d.destino_tipo]?.has(Number(d.destino_id))) continue;
    /* Defensa adicional: ninguna regla automática debe crear una pareja que
       la taxonomía actual prohíba (p. ej. una Sede institución → lugar). */
    if (!relacionPermitida(d.tipo, d.origen_tipo, d.destino_tipo)) {
      console.warn(
        `[relaciones] Se omite «${d.tipo}» (${d.origen_tipo} → ${d.destino_tipo}) `
        + `de la regla ${d.regla}: combinación no permitida por la taxonomía.`
      );
      continue;
    }
    deseadas.push(d);
  }

  const [existentes] = await ejecutor.query(
    "SELECT * FROM relaciones WHERE bloque_id = ? AND procedencia = 'AUTOMATIZADA'",
    [bloqueId]
  );
  const [editadas] = await ejecutor.query(
    `SELECT regla, origen_tipo, origen_id, destino_tipo, destino_id, tipo
     FROM relaciones WHERE bloque_id = ? AND procedencia = 'EDITADA'`,
    [bloqueId]
  );
  const claveRelacion = (r) => [
    r.regla || '',
    r.origen_tipo, Number(r.origen_id),
    r.destino_tipo, Number(r.destino_id),
    r.tipo || '',
  ].join('\u0000');
  const editadasSet = new Set(editadas.map(claveRelacion));
  const [exclusiones] = await ejecutor.query(
    'SELECT regla, firma FROM relaciones_exclusiones WHERE bloque_id = ?',
    [bloqueId]
  );
  const exclusionesSet = new Set(
    exclusiones.map((e) => `${e.regla || ''}\u0000${e.firma || ''}`)
  );
  const existeEditadaEnMemoria = (d) => editadasSet.has(claveRelacion(d));
  const existeExclusionEnMemoria = (d, firma, firmaAnterior) => (
    exclusionesSet.has(`${d.regla || ''}\u0000${firma || ''}`)
    || exclusionesSet.has(`${d.regla || ''}\u0000${firmaAnterior || ''}`)
  );

  const pares = new Map();
  const registrarPar = (r) => {
    const clave = [r.origen_tipo, Number(r.origen_id), r.destino_tipo, Number(r.destino_id)].join('\u0000');
    pares.set(clave, [r.origen_tipo, Number(r.origen_id), r.destino_tipo, Number(r.destino_id)]);
  };
  for (const d of deseadas) registrarPar(d);
  for (const r of existentes) registrarPar(r);
  const relacionesProyecto = [];
  const vistosRelacion = new Set();
  const listaPares = [...pares.values()];
  for (let i = 0; i < listaPares.length; i += 40) {
    const trozo = listaPares.slice(i, i + 40);
    const condiciones = trozo.map(() => (
      '(origen_tipo = ? AND origen_id = ? AND destino_tipo = ? AND destino_id = ?)'
    )).join(' OR ');
    const parametros = [bloque.proyecto_id, ...trozo.flat()];
    const [filas] = await ejecutor.query(
      `SELECT id, origen_tipo, origen_id, destino_tipo, destino_id, tipo,
              anio_inicio, fecha_exacta_inicio, lugar_inicio,
              anio_fin, fecha_exacta_fin, lugar_fin
       FROM relaciones WHERE proyecto_id = ? AND (${condiciones})`,
      parametros
    );
    for (const fila of filas) {
      const id = Number(fila.id);
      if (vistosRelacion.has(id)) continue;
      vistosRelacion.add(id);
      relacionesProyecto.push(fila);
    }
  }
  const fuentesPorRelacion = new Map();
  if (relacionesProyecto.length) {
    const ids = relacionesProyecto.map((r) => r.id);
    for (let i = 0; i < ids.length; i += 500) {
      const trozo = ids.slice(i, i + 500);
      const [vinculos] = await ejecutor.query(
        `SELECT relacion_id, fuente_id FROM relaciones_fuentes
         WHERE relacion_id IN (${trozo.map(() => '?').join(', ')})`,
        trozo
      );
      for (const v of vinculos) {
        if (!fuentesPorRelacion.has(v.relacion_id)) fuentesPorRelacion.set(v.relacion_id, new Set());
        fuentesPorRelacion.get(v.relacion_id).add(Number(v.fuente_id));
      }
    }
  }
  const valorClave = (v) => (v === null || v === undefined ? '' : String(v));
  const claveCoincidencia = (r) => [
    r.origen_tipo,
    Number(r.origen_id),
    r.destino_tipo,
    Number(r.destino_id),
    valorClave(r.tipo),
    valorClave(r.anio_inicio),
    valorClave(r.fecha_exacta_inicio),
    valorClave(r.lugar_inicio),
    valorClave(r.anio_fin),
    valorClave(r.fecha_exacta_fin),
    valorClave(r.lugar_fin),
  ].join('\u0000');
  const coincidencias = new Map();
  const registrarCoincidencia = (r) => {
    const clave = claveCoincidencia(r);
    if (!coincidencias.has(clave)) coincidencias.set(clave, []);
    coincidencias.get(clave).push(r);
  };
  for (const r of relacionesProyecto) registrarCoincidencia(r);
  const existeCoincidenciaEnMemoria = (d) => {
    const lista = coincidencias.get(claveCoincidencia(d));
    if (!lista || !lista.length) return false;
    if (!d.fuente_id) return true;
    return lista.some((r) => fuentesPorRelacion.get(r.id)?.has(Number(d.fuente_id)));
  };
  const claveDeseada = (d) => [
    d.regla || '',
    d.origen_tipo,
    Number(d.origen_id),
    d.destino_tipo,
    Number(d.destino_id),
    d.tipo || '',
  ].join('\u0000');
  const indicesDeseadas = new Map();
  deseadas.forEach((d, i) => {
    const clave = claveDeseada(d);
    if (!indicesDeseadas.has(clave)) indicesDeseadas.set(clave, []);
    indicesDeseadas.get(clave).push(i);
  });

  const usados = new Set();
  for (const existente of existentes) {
    const indices = indicesDeseadas.get(claveDeseada(existente)) || [];
    const indice = indices.find((i) => !usados.has(i));
    if (indice === undefined) {
      await eliminarAutomatica(db, existente.id, ejecutor);
      continue;
    }
    const deseada = deseadas[indice];
    usados.add(indice);
    if (existeEditadaEnMemoria(deseada)) {
      await eliminarAutomatica(db, existente.id, ejecutor);
      continue;
    }
    await actualizarAutomatica(db, existente.id, deseada, ejecutor);
    const enMemoria = relacionesProyecto.find((r) => Number(r.id) === Number(existente.id));
    if (enMemoria) {
      enMemoria.anio_inicio = deseada.anio_inicio ?? null;
      enMemoria.fecha_exacta_inicio = deseada.fecha_exacta_inicio ?? null;
      enMemoria.lugar_inicio = deseada.lugar_inicio ?? null;
      enMemoria.anio_fin = deseada.anio_fin ?? null;
      enMemoria.fecha_exacta_fin = deseada.fecha_exacta_fin ?? null;
      enMemoria.lugar_fin = deseada.lugar_fin ?? null;
    }
    if (deseada.fuente_id) {
      if (!fuentesPorRelacion.has(existente.id)) fuentesPorRelacion.set(existente.id, new Set());
      fuentesPorRelacion.get(existente.id).add(Number(deseada.fuente_id));
    }
  }

  /* Reconstruir el índice tras actualizar fechas/lugares de las existentes. */
  coincidencias.clear();
  for (const r of relacionesProyecto) registrarCoincidencia(r);

  for (let i = 0; i < deseadas.length; i++) {
    if (usados.has(i)) continue;
    const d = deseadas[i];
    if (existeEditadaEnMemoria(d)) continue;
    const firma = firmaDescriptor(d);
    const firmaAnterior = firmaDescriptorLegacy(d);
    if (existeExclusionEnMemoria(d, firma, firmaAnterior)) continue;
    if (existeCoincidenciaEnMemoria(d)) continue;
    const nuevaId = await crearAutomatica(db, bloque.proyecto_id, bloqueId, d, ejecutor);
    const nueva = {
      id: nuevaId,
      origen_tipo: d.origen_tipo,
      origen_id: d.origen_id,
      destino_tipo: d.destino_tipo,
      destino_id: d.destino_id,
      tipo: d.tipo,
      anio_inicio: d.anio_inicio ?? null,
      fecha_exacta_inicio: d.fecha_exacta_inicio ?? null,
      lugar_inicio: d.lugar_inicio ?? null,
      anio_fin: d.anio_fin ?? null,
      fecha_exacta_fin: d.fecha_exacta_fin ?? null,
      lugar_fin: d.lugar_fin ?? null,
    };
    relacionesProyecto.push(nueva);
    registrarCoincidencia(nueva);
    if (d.fuente_id) fuentesPorRelacion.set(nuevaId, new Set([Number(d.fuente_id)]));
  }
}

/* ------------------------------------------------------------------ */
/* Eliminación de bloque o de sus relaciones                           */
/* ------------------------------------------------------------------ */

async function limpiarBloque(db, bloqueId, ejecutor = db.pool) {
  await ejecutor.query(
    "DELETE FROM relaciones WHERE bloque_id = ? AND procedencia = 'AUTOMATIZADA'",
    [bloqueId]
  );
  await ejecutor.query('DELETE FROM relaciones_exclusiones WHERE bloque_id = ?', [bloqueId]);
}

async function limpiarBloquesDeFuente(db, fuenteId, ejecutor = db.pool) {
  const [bloques] = await ejecutor.query(
    'SELECT id FROM bloques_registro WHERE fuente_id = ?',
    [fuenteId]
  );
  for (const b of bloques) await limpiarBloque(db, b.id, ejecutor);
}

/* Repara las relaciones «Sede» automáticas creadas por versiones anteriores,
   que las generaban en sentido INSTITUCIÓN → LUGAR. Solo se tocan las
   AUTOMATIZADAS: las MANUALES y EDITADAS se conservan tal cual (la interfaz
   las marca con ⚠ si no cumplen la taxonomía actual). */
async function corregirSedesAutomaticasInvertidas(ejecutor) {
  const [filas] = await ejecutor.query(
    `SELECT r.id, r.origen_id, r.destino_id,
            r.anio_inicio, r.fecha_exacta_inicio, r.anio_fin,
            r.fecha_exacta_fin, r.lugar_inicio, r.lugar_fin,
            b.fuente_id AS fuente_bloque,
            (SELECT MIN(rf.fuente_id) FROM relaciones_fuentes rf
              WHERE rf.relacion_id = r.id) AS fuente_relacion
     FROM relaciones r
     LEFT JOIN bloques_registro b ON b.id = r.bloque_id
     WHERE r.tipo = 'Sede'
       AND r.procedencia = 'AUTOMATIZADA'
       AND r.origen_tipo = 'institucion'
       AND r.destino_tipo = 'lugar'`
  );
  for (const fila of filas) {
    const lugarId = numero(fila.destino_id);
    const institucionId = numero(fila.origen_id);
    if (!lugarId || !institucionId) continue;
    const firma = firmaDescriptor({
      origen_tipo: 'lugar',
      origen_id: lugarId,
      destino_tipo: 'institucion',
      destino_id: institucionId,
      tipo: 'Sede',
      anio_inicio: fila.anio_inicio,
      fecha_exacta_inicio: fila.fecha_exacta_inicio,
      lugar_inicio: fila.lugar_inicio,
      anio_fin: fila.anio_fin,
      fecha_exacta_fin: fila.fecha_exacta_fin,
      lugar_fin: fila.lugar_fin,
      fuente_id: fila.fuente_bloque ?? fila.fuente_relacion,
    });
    await ejecutor.query(
      `UPDATE relaciones SET
         origen_tipo = 'lugar', origen_id = ?,
         destino_tipo = 'institucion', destino_id = ?, firma = ?
       WHERE id = ? AND procedencia = 'AUTOMATIZADA'`,
      [lugarId, institucionId, firma, fila.id]
    );
  }
  if (filas.length) {
    console.log(`[relaciones] Corregidas ${filas.length} relaciones «Sede» automáticas con el sentido invertido.`);
  }
  return filas.length;
}

/** Al borrar una relación desde el formulario/lista, deja constancia para
    que el bloque no la vuelva a crear. */
async function registrarExclusionPorBorrado(db, relacion, ejecutor = db.pool) {
  if (!relacion || !relacion.bloque_id || !relacion.regla) return;
  if (relacion.procedencia !== 'AUTOMATIZADA' && relacion.procedencia !== 'EDITADA') return;

  let fuenteId = null;
  if (relacion.procedencia === 'AUTOMATIZADA' && relacion.firma) {
    /* La firma antigua ya identifica la relación; no hace falta reconstuirla. */
    const insertar = db.motor === 'sqlite' ? 'INSERT OR IGNORE' : 'INSERT IGNORE';
    await ejecutor.query(
      `${insertar} INTO relaciones_exclusiones
        (proyecto_id, bloque_id, regla, firma)
       VALUES (?, ?, ?, ?)`,
      [relacion.proyecto_id, relacion.bloque_id, relacion.regla, relacion.firma]
    );
    return;
  }

  const [fuentesBloque] = await ejecutor.query(
    `SELECT f.id AS fuente_id
     FROM bloques_registro b
     JOIN fuentes f ON f.id = b.fuente_id
     WHERE b.id = ? LIMIT 1`,
    [relacion.bloque_id]
  );
  if (fuentesBloque.length) {
    fuenteId = fuentesBloque[0].fuente_id;
  } else {
    const [fuentes] = await ejecutor.query(
      'SELECT fuente_id FROM relaciones_fuentes WHERE relacion_id = ? ORDER BY fuente_id LIMIT 1',
      [relacion.id]
    );
    fuenteId = fuentes.length ? fuentes[0].fuente_id : null;
  }
  const firma = firmaDescriptor({
    origen_tipo: relacion.origen_tipo,
    origen_id: relacion.origen_id,
    destino_tipo: relacion.destino_tipo,
    destino_id: relacion.destino_id,
    tipo: relacion.tipo,
    anio_inicio: relacion.anio_inicio,
    fecha_exacta_inicio: relacion.fecha_exacta_inicio,
    lugar_inicio: relacion.lugar_inicio,
    anio_fin: relacion.anio_fin,
    fecha_exacta_fin: relacion.fecha_exacta_fin,
    lugar_fin: relacion.lugar_fin,
    fuente_id: fuenteId,
  });

  const insertar = db.motor === 'sqlite' ? 'INSERT OR IGNORE' : 'INSERT IGNORE';
  await ejecutor.query(
    `${insertar} INTO relaciones_exclusiones
      (proyecto_id, bloque_id, regla, firma)
     VALUES (?, ?, ?, ?)`,
    [relacion.proyecto_id, relacion.bloque_id, relacion.regla, firma]
  );
}

module.exports = {
  reconciliarBloque,
  limpiarBloque,
  limpiarBloquesDeFuente,
  corregirSedesAutomaticasInvertidas,
  registrarExclusionPorBorrado,
  reglasDeBloque,
  firmaDescriptor,
  firmaDescriptorLegacy,
  mapaFirmasExclusion,
  reglasActas,
  reglasLeyes,
  reglasElecciones,
  reglasHojasServicio,
  reglasNombramientos,
  reglasTitulos,
  reglasArriendo,
  reglasCompraVenta,
  reglasDiezmos,
  reglasDonacion,
  reglasFianza,
  reglasHipoteca,
  reglasObligacion,
  reglasPoder,
  reglasEpistolas,
  reglasProcesos,
  reglasCuentaPersonal,
  reglasBautismo,
  reglasDefuncion,
  reglasMatrimonio,
  reglasInventarios,
  reglasLegados,
  reglasTestamentos,
  reglasComunicaciones,
};
