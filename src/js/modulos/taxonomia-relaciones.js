'use strict';

/* H-IMAGO · Taxonomía de RELACIONES
   Fuente canónica: la tabla del proyecto. Las restricciones de entidades por
   tipo de relación (origen → destino) proceden de NRELACIONES.

   Convención del autor (etiqueta):
   · « – » separa el lado ORIGEN (INDIVIDUO 1) del lado DESTINO (INDIVIDUO 2).
     «Capataz – Subalterno»: la entidad origen actúa como Capataz, la destino
     como Subalterno. La direccionalidad la establece el usuario al elegir
     qué entidad va primero; la taxonomía solo nombra los dos lados.
   · « / » agrupa tópicos de un mismo lado (variantes o equivalencias):
     «Padrino/Madrina – Ahijado».
   · Etiquetas sin « – » son simétricas: ambos lados reciben la misma
     etiqueta («Hermanos», «Correspondientes personales», «Socios»…).
   · La CATEGORÍA solo ordena el listado; las restricciones de origen y
     destino se aplican en el formulario y en el alta manual. */

const raiz = typeof window !== 'undefined' ? window : {};

const TAXONOMIA_RELACIONES = {
  Clientelar: [
    'Capataz – Subalterno',
    'Caudillo – Seguidor',
    'Desfavorecedor – Desfavorecido',
    'Mecenas/Donante – Beneficiario',
    'Favorecedor – Favorecido',
    'Fiador/Aval – Deudor',
    'Jefe – Ayudante',
    'Jefe – Secretario',
    'Jefe – Subalterno',
    'Maestro – Discípulo',
    'Mentor – Discípulo',
    'Patrón – Empleado',
    'Patrón – Inquilino',
    'Patrón – Mayordomo',
    'Patrón – Peón',
    'Señor – Allegado',
    'Señor – Confidente',
    'Señor – Criado',
    'Señor – Encomendado',
    'Patrón – Esclavo',
    'Señor – Siervo',
    'Señor – Súbdito',
  ],
  Comunicacional: [
    'Correspondientes legales',
    'Correspondientes personales',
    'Correo/Emisario',
    'Remitente – Mensajero',
  ],
  Económica: [
    'Acreedor – Deudor',
    'Arrendatario – Arrendador',
    'Asentista/contratista',
    'Competidores',
    'Comprador – Vendedor',
    'Comitente – Comisionista',
    'Embargador – Embargado',
    'Financista/Inversor',
    'Permutantes',
    'Proveedor – Receptador',
    'Socios',
  ],
  Familiar: [
    'Abuelo – Nieto',
    'Abuelo político – Nieto político',
    'Bisabuelo – Bisnieto',
    'Compadres',
    'Concuñados',
    'Consuegros',
    'Cónyuges',
    'Cuñados',
    'Gemelos',
    'Hermanastros',
    'Hermanos',
    'Mellizos',
    'Padrastro/Madrastra – Hijastro',
    'Padre/Madre legítimo – Hijo legítimo',
    'Padre/Madre natural – Hijo natural',
    'Padrino/Madrina – Ahijado',
    'Padrino/Madrina de bodas – Ahijado de bodas',
    'Primos',
    'Primos 2°',
    'Primos 3°',
    'Primos políticos',
    'Suegro – Yerno/Nuera',
    'Tatarabuelo – Tataranieto',
    'Tío – Sobrino',
    'Tío 2° – Sobrino 2°',
    'Tío 3° – Sobrino 3°',
    'Tío abuelo – Sobrino nieto',
    'Tío abuelo 2° – Sobrino nieto 2°',
    'Tío tatarabuelo – Sobrino tataranieto',
    'Tío/a bisabuelo – Sobrino bisnieto',
    'Tío/a político – Sobrino político',
    'Viudo – Finado',
  ],
  Institucional: [
    'Asesor/Consultor',
    'Asistente/Colaborador',
    'Aspirante/Postulante',
    'Candidato',
    'Destituido',
    'Detractor',
    'Electo',
    'Elector',
    'Emérito',
    'Emisario',
    'Empleado',
    'Exonerado',
    'Firmante',
    'Fundador',
    'Espía/Infiltrado',
    'Infractor',
    'Intendente/Visitador',
    'Interino',
    'Miembro',
    'Nombrado/Designado',
    'Escribano/Notario',
    'Presidente/Director',
    'Removido',
    'Representante',
    'Restituido',
    'Retirado',
    'Sancionado',
    'Síndico/Auditor',
    'Subrogante',
    'Sustituido',
    'Vitalicio',
    'Vocal/Consejero',
    'Voluntario',
  ],
  Legal: [
    'Apoderado – Representado',
    'Defensor – Defendido',
    'Delator – Infractor',
    'Demandante – Acusado',
    'Denunciante – Denunciado',
    'Fiscal – Acusado',
    'Fiscal – Defensor',
    'Fiscal – Demandante',
    'Informante/Testigo',
    'Infractor – Damnificado',
    'Juez – Absuelto',
    'Juez – Acusado',
    'Juez – Condenado',
    'Juez – Defensor',
    'Juez – Demandante',
    'Juez – Sobreseído',
    'Litigantes',
    'Otorgante – Escribano/Notario',
    'Otorgante – Oficiante',
    'Otorgante – Testigo',
    'Testador – Albacea',
    'Testador – Heredero',
    'Tutor – Menor',
  ],
  Sentimental: [
    'Acosador – Acosado',
    'Admirador – Admirado',
    'Amantes',
    'Ambivalentes',
    'Amigos',
    'Animadversión',
    'Asesino – Asesinado',
    'Cómplice – Infractor',
    'Concubinos',
    'Confesor – Penitente',
    'Confidentes',
    'Conocidos',
    'Desprecio',
    'Discordia',
    'Enamorados',
    'Encubridor – Infractor',
    'Enemigos',
    'Espía – Espiado',
    'Homicida – Fallecido',
    'Indiferentes',
    'Infiel – Engañado',
    'No correspondido',
    'Paisanos',
    'Pretendientes',
    'Prometidos',
    'Reconciliados',
    'Rivales',
    'Enemistados',
    'Simpatía',
    'Sobrestimado',
    'Subestimado',
    'Violentador – Violentado',
  ],
  Territorial: [
    'Comunero',
    'Mediero',
    'Mayordomo/Administrador',
    'Morador/Ocupante',
    'Arrendador/Cuidador',
    'Apresado/retenido',
    'Oriundo',
    'Adscripción',
    'Pasajero',
    'Polizón',
    'Prisionero/Cautivo',
    'Recluso',
    'Residente',
    'Tripulante',
    'Vecino',
    'Exiliado',
    'Sede',
    'Jurisdicción',
    'Propietario',
    'Amotinado/Sublevado',
    'Jefe/Gobernador',
    'Capitán/Comandante',
    'Destinado',
    'Postor',
    'Mejor postor',
  ],
};

/* Restricciones de entidades por tipo de relación, según NRELACIONES:
   [tipos de origen permitidos, tipos de destino permitidos]. */
const R = (origen, destino) => [origen, destino];
const RESTRICCIONES_RELACION = {
  'Capataz – Subalterno': R(['persona'], ['persona']),
  'Caudillo – Seguidor': R(['persona'], ['persona']),
  'Desfavorecedor – Desfavorecido': R(['persona'], ['persona']),
  'Mecenas/Donante – Beneficiario': R(['persona'], ['persona']),
  'Favorecedor – Favorecido': R(['persona'], ['persona']),
  'Fiador/Aval – Deudor': R(['persona'], ['persona']),
  'Jefe – Ayudante': R(['persona'], ['persona']),
  'Jefe – Secretario': R(['persona'], ['persona']),
  'Jefe – Subalterno': R(['persona'], ['persona']),
  'Maestro – Discípulo': R(['persona'], ['persona']),
  'Mentor – Discípulo': R(['persona'], ['persona']),
  'Patrón – Empleado': R(['persona'], ['persona']),
  'Patrón – Inquilino': R(['persona'], ['persona']),
  'Patrón – Mayordomo': R(['persona'], ['persona']),
  'Patrón – Peón': R(['persona'], ['persona']),
  'Señor – Allegado': R(['persona'], ['persona']),
  'Señor – Confidente': R(['persona'], ['persona']),
  'Señor – Criado': R(['persona'], ['persona']),
  'Señor – Encomendado': R(['persona'], ['persona']),
  'Patrón – Esclavo': R(['persona'], ['persona']),
  'Señor – Siervo': R(['persona'], ['persona']),
  'Señor – Súbdito': R(['persona'], ['persona']),
  'Correspondientes legales': R(['persona', 'institucion'], ['persona', 'institucion']),
  'Correspondientes personales': R(['persona'], ['persona']),
  'Correo/Emisario': R(['persona', 'institucion'], ['persona', 'institucion']),
  'Remitente – Mensajero': R(['persona'], ['persona']),
  'Acreedor – Deudor': R(['persona', 'institucion'], ['persona', 'institucion']),
  'Arrendatario – Arrendador': R(['persona', 'institucion'], ['persona', 'institucion']),
  'Asentista/contratista': R(['persona', 'institucion'], ['persona', 'institucion']),
  'Competidores': R(['persona', 'institucion'], ['persona', 'institucion']),
  'Comprador – Vendedor': R(['persona', 'institucion'], ['persona', 'institucion']),
  'Comitente – Comisionista': R(['persona', 'institucion'], ['persona', 'institucion']),
  'Embargador – Embargado': R(['persona', 'institucion'], ['persona', 'institucion']),
  'Financista/Inversor': R(['persona', 'institucion'], ['persona', 'institucion']),
  'Permutantes': R(['persona', 'institucion'], ['persona', 'institucion']),
  'Proveedor – Receptador': R(['persona', 'institucion'], ['persona', 'institucion']),
  'Socios': R(['persona', 'institucion'], ['persona', 'institucion']),
  'Abuelo – Nieto': R(['persona'], ['persona']),
  'Abuelo político – Nieto político': R(['persona'], ['persona']),
  'Bisabuelo – Bisnieto': R(['persona'], ['persona']),
  'Compadres': R(['persona'], ['persona']),
  'Concuñados': R(['persona'], ['persona']),
  'Consuegros': R(['persona'], ['persona']),
  'Cónyuges': R(['persona'], ['persona']),
  'Cuñados': R(['persona'], ['persona']),
  'Gemelos': R(['persona'], ['persona']),
  'Hermanastros': R(['persona'], ['persona']),
  'Hermanos': R(['persona'], ['persona']),
  'Mellizos': R(['persona'], ['persona']),
  'Padrastro/Madrastra – Hijastro': R(['persona'], ['persona']),
  'Padre/Madre legítimo – Hijo legítimo': R(['persona'], ['persona']),
  'Padre/Madre natural – Hijo natural': R(['persona'], ['persona']),
  'Padrino/Madrina – Ahijado': R(['persona'], ['persona']),
  'Padrino/Madrina de bodas – Ahijado de bodas': R(['persona'], ['persona']),
  'Primos': R(['persona'], ['persona']),
  'Primos 2°': R(['persona'], ['persona']),
  'Primos 3°': R(['persona'], ['persona']),
  'Primos políticos': R(['persona'], ['persona']),
  'Suegro – Yerno/Nuera': R(['persona'], ['persona']),
  'Tatarabuelo – Tataranieto': R(['persona'], ['persona']),
  'Tío – Sobrino': R(['persona'], ['persona']),
  'Tío 2° – Sobrino 2°': R(['persona'], ['persona']),
  'Tío 3° – Sobrino 3°': R(['persona'], ['persona']),
  'Tío abuelo – Sobrino nieto': R(['persona'], ['persona']),
  'Tío abuelo 2° – Sobrino nieto 2°': R(['persona'], ['persona']),
  'Tío tatarabuelo – Sobrino tataranieto': R(['persona'], ['persona']),
  'Tío/a bisabuelo – Sobrino bisnieto': R(['persona'], ['persona']),
  'Tío/a político – Sobrino político': R(['persona'], ['persona']),
  'Viudo – Finado': R(['persona'], ['persona']),
  'Asesor/Consultor': R(['persona'], ['institucion']),
  'Asistente/Colaborador': R(['persona'], ['institucion']),
  'Aspirante/Postulante': R(['persona'], ['institucion', 'patrimonio']),
  'Candidato': R(['persona'], ['institucion', 'patrimonio']),
  'Destituido': R(['persona'], ['institucion', 'patrimonio']),
  'Detractor': R(['persona'], ['institucion', 'patrimonio']),
  'Electo': R(['persona'], ['institucion']),
  'Elector': R(['persona'], ['institucion']),
  'Emérito': R(['persona'], ['institucion']),
  'Emisario': R(['persona'], ['persona', 'institucion', 'patrimonio']),
  'Empleado': R(['persona'], ['institucion', 'patrimonio']),
  'Espía/Infiltrado': R(['persona'], ['institucion', 'patrimonio']),
  'Exonerado': R(['persona'], ['institucion', 'patrimonio']),
  'Firmante': R(['persona'], ['institucion']),
  'Fundador': R(['persona'], ['institucion']),
  'Infractor': R(['persona'], ['institucion', 'patrimonio']),
  'Intendente/Visitador': R(['persona'], ['institucion', 'patrimonio']),
  'Interino': R(['persona'], ['institucion', 'patrimonio']),
  'Miembro': R(['persona'], ['institucion']),
  'Nombrado/Designado': R(['persona'], ['institucion', 'patrimonio']),
  'Escribano/Notario': R(['persona'], ['institucion']),
  'Presidente/Director': R(['persona'], ['institucion']),
  'Removido': R(['persona'], ['institucion', 'patrimonio']),
  'Representante': R(['persona'], ['institucion']),
  'Restituido': R(['persona'], ['institucion']),
  'Retirado': R(['persona'], ['institucion']),
  'Sancionado': R(['persona'], ['institucion', 'patrimonio']),
  'Síndico/Auditor': R(['persona'], ['institucion']),
  'Subrogante': R(['persona'], ['institucion']),
  'Sustituido': R(['persona'], ['institucion']),
  'Vitalicio': R(['persona'], ['institucion']),
  'Vocal/Consejero': R(['persona'], ['institucion']),
  'Voluntario': R(['persona'], ['institucion']),
  'Apoderado – Representado': R(['persona'], ['persona', 'institucion', 'patrimonio']),
  'Defensor – Defendido': R(['persona'], ['persona', 'institucion', 'patrimonio']),
  'Delator – Infractor': R(['persona'], ['persona']),
  'Demandante – Acusado': R(['persona', 'institucion'], ['persona', 'institucion']),
  'Denunciante – Denunciado': R(['persona', 'institucion'], ['persona', 'institucion']),
  'Fiscal – Acusado': R(['persona'], ['persona', 'institucion']),
  'Fiscal – Defensor': R(['persona'], ['persona', 'institucion']),
  'Fiscal – Demandante': R(['persona'], ['persona', 'institucion']),
  'Informante/Testigo': R(['persona'], ['persona', 'institucion']),
  'Infractor – Damnificado': R(['persona', 'institucion'], ['persona', 'institucion', 'patrimonio']),
  'Juez – Absuelto': R(['persona'], ['persona', 'institucion']),
  'Juez – Acusado': R(['persona'], ['persona', 'institucion']),
  'Juez – Condenado': R(['persona'], ['persona', 'institucion']),
  'Juez – Defensor': R(['persona'], ['persona', 'institucion']),
  'Juez – Demandante': R(['persona'], ['persona', 'institucion']),
  'Juez – Sobreseído': R(['persona'], ['persona', 'institucion']),
  'Litigantes': R(['persona', 'institucion'], ['persona', 'institucion']),
  'Otorgante – Escribano/Notario': R(['persona', 'institucion'], ['persona']),
  'Otorgante – Oficiante': R(['persona', 'institucion'], ['persona']),
  'Otorgante – Testigo': R(['persona', 'institucion'], ['persona']),
  'Testador – Albacea': R(['persona'], ['persona']),
  'Testador – Heredero': R(['persona'], ['persona']),
  'Tutor – Menor': R(['persona'], ['persona']),
  'Acosador – Acosado': R(['persona'], ['persona']),
  'Admirador – Admirado': R(['persona'], ['persona']),
  'Amantes': R(['persona'], ['persona']),
  'Ambivalentes': R(['persona'], ['persona']),
  'Amigos': R(['persona'], ['persona']),
  'Animadversión': R(['persona'], ['persona']),
  'Asesino – Asesinado': R(['persona'], ['persona']),
  'Cómplice – Infractor': R(['persona'], ['persona']),
  'Concubinos': R(['persona'], ['persona']),
  'Confesor – Penitente': R(['persona'], ['persona']),
  'Confidentes': R(['persona'], ['persona']),
  'Conocidos': R(['persona'], ['persona']),
  'Desprecio': R(['persona'], ['persona']),
  'Discordia': R(['persona'], ['persona']),
  'Enamorados': R(['persona'], ['persona']),
  'Encubridor – Infractor': R(['persona'], ['persona']),
  'Enemigos': R(['persona'], ['persona']),
  'Espía – Espiado': R(['persona'], ['persona']),
  'Homicida – Fallecido': R(['persona'], ['persona']),
  'Indiferentes': R(['persona'], ['persona']),
  'Infiel – Engañado': R(['persona'], ['persona']),
  'Paisanos': R(['persona'], ['persona']),
  'Pretendientes': R(['persona'], ['persona']),
  'Prometidos': R(['persona'], ['persona']),
  'No correspondido': R(['persona'], ['persona']),
  'Reconciliados': R(['persona'], ['persona']),
  'Rivales': R(['persona'], ['persona']),
  'Enemistados': R(['persona'], ['persona']),
  'Simpatía': R(['persona'], ['persona']),
  'Sobrestimado': R(['persona'], ['persona']),
  'Subestimado': R(['persona'], ['persona']),
  'Violentador – Violentado': R(['persona'], ['persona']),
  'Comunero': R(['persona'], ['patrimonio']),
  'Mediero': R(['persona'], ['patrimonio']),
  'Mayordomo/Administrador': R(['persona'], ['institucion', 'patrimonio']),
  'Morador/Ocupante': R(['persona'], ['patrimonio']),
  'Arrendador/Cuidador': R(['persona'], ['patrimonio']),
  'Apresado/retenido': R(['patrimonio'], ['persona', 'institucion', 'patrimonio']),
  'Oriundo': R(['persona'], ['lugar']),
  'Adscripción': R(['institucion'], ['institucion']),
  'Pasajero': R(['persona'], ['patrimonio']),
  'Polizón': R(['persona'], ['patrimonio']),
  'Prisionero/Cautivo': R(['persona'], ['persona', 'institucion', 'patrimonio']),
  'Recluso': R(['persona'], ['institucion', 'patrimonio']),
  'Residente': R(['persona'], ['lugar']),
  'Tripulante': R(['persona'], ['patrimonio']),
  'Vecino': R(['persona'], ['lugar']),
  'Exiliado': R(['persona'], ['lugar']),
  'Sede': R(['lugar'], ['institucion', 'patrimonio']),
  'Jurisdicción': R(['institucion'], ['lugar', 'patrimonio']),
  'Propietario': R(['persona', 'institucion'], ['patrimonio']),
  'Amotinado/Sublevado': R(['persona'], ['lugar', 'institucion', 'patrimonio']),
  'Jefe/Gobernador': R(['persona'], ['lugar', 'institucion']),
  'Capitán/Comandante': R(['persona'], ['institucion', 'patrimonio']),
  'Destinado': R(['persona'], ['institucion', 'patrimonio']),
  'Postor': R(['persona'], ['patrimonio']),
  'Mejor postor': R(['persona'], ['patrimonio']),
};

/* Índice plano conservando el orden de la tabla:
   {etiqueta, categoria, p1, p2, direccional, origen, destino} */
const RELACIONES_TIPOS = [];
const RELACIONES_POR_ETIQUETA = new Map();
for (const [categoria, etiquetas] of Object.entries(TAXONOMIA_RELACIONES)) {
  for (const bruto of etiquetas) {
    const etiqueta = bruto.trim();
    if (RELACIONES_POR_ETIQUETA.has(etiqueta)) continue; // sin duplicados
    const lados = etiqueta.split(' – ');
    const p1 = lados[0].trim();
    const p2 = lados.length > 1 ? lados[1].trim() : null; // null ⇒ simétrico
    const restriccion = RESTRICCIONES_RELACION[etiqueta] || null;
    const entrada = {
      etiqueta,
      categoria,
      p1,
      p2,
      direccional: p2 !== null,
      origen: restriccion ? restriccion[0] : null,
      destino: restriccion ? restriccion[1] : null,
    };
    RELACIONES_TIPOS.push(entrada);
    RELACIONES_POR_ETIQUETA.set(etiqueta, entrada);
  }
}

raiz.TAXONOMIA_RELACIONES = TAXONOMIA_RELACIONES;
raiz.RELACIONES_TIPOS = RELACIONES_TIPOS;
raiz.RESTRICCIONES_RELACION = RESTRICCIONES_RELACION;

/** Restricción [origen, destino] de una etiqueta, o null si es externa. */
const restriccionRelacion = (etiqueta) => (
  RESTRICCIONES_RELACION[String(etiqueta || '').trim()] || null
);

/** ¿El tipo permite esa pareja de entidades? Los tipos externos a la
    taxonomía (personalizados) no tienen restricciones. */
const relacionPermitida = (etiqueta, origenTipo, destinoTipo) => {
  const restriccion = restriccionRelacion(etiqueta);
  if (!restriccion) return true;
  return restriccion[0].includes(origenTipo) && restriccion[1].includes(destinoTipo);
};

/** Etiquetas de la taxonomía que pueden nacer desde un tipo de entidad. */
const relacionesPorOrigen = (origenTipo) => RELACIONES_TIPOS
  .filter((entrada) => Array.isArray(entrada.origen) && entrada.origen.includes(origenTipo))
  .map((entrada) => entrada.etiqueta);

/** Tipos de destino permitidos para una etiqueta desde un origen concreto.
    Devuelve null para los tipos externos (sin restricción). */
const tiposDestinoRelacion = (etiqueta, origenTipo) => {
  const restriccion = restriccionRelacion(etiqueta);
  if (!restriccion) return null;
  return restriccion[0].includes(origenTipo) ? restriccion[1].slice() : [];
};

raiz.restriccionRelacion = restriccionRelacion;
raiz.relacionPermitida = relacionPermitida;
raiz.relacionesPorOrigen = relacionesPorOrigen;
raiz.tiposDestinoRelacion = tiposDestinoRelacion;

/* Etiquetas en plural para la barra de filtros del bloque de relaciones */
const RELACIONES_CATEGORIAS_PLURAL = {
  Clientelar: 'Clientelares',
  Comunicacional: 'Comunicacionales',
  'Económica': 'Económicas',
  Familiar: 'Familiares',
  Institucional: 'Institucionales',
  Legal: 'Legales',
  Sentimental: 'Sentimentales',
  Territorial: 'Territoriales',
};
raiz.RELACIONES_CATEGORIAS_PLURAL = RELACIONES_CATEGORIAS_PLURAL;

/** Lados de una relación según su etiqueta: {origen, destino, simetrica}. */
const ladosRelacion = (etiqueta) => {
  const entrada = RELACIONES_POR_ETIQUETA.get(String(etiqueta || '').trim());
  if (entrada && entrada.direccional) {
    return { origen: entrada.p1, destino: entrada.p2, simetrica: false };
  }
  const nombre = entrada ? entrada.etiqueta : String(etiqueta || '');
  return { origen: nombre, destino: nombre, simetrica: true };
};
raiz.ladosRelacion = ladosRelacion;

/** Categoría taxonómica de una etiqueta ('' si es externa a la taxonomía). */
const CATEGORIAS_LEGACY = {
  'Guardia – Dependiente': 'Clientelar',
  'Ruptura': 'Sentimental',
  'Administrador': 'Institucional',
  'Fiscal – Litigante': 'Legal',
  'Juez – Litigante': 'Legal',
  'Secuestrador/Apresador': 'Legal',
  'Cargo/Dignidad': 'Institucional',
  'Membresía': 'Institucional',
  'Fundador': 'Institucional',
  'Proclamación': 'Institucional',
  'Patronazgo': 'Clientelar',
  'Confianza/Servicio': 'Clientelar',
  'Clientela': 'Clientelar',
  'Correspondencia': 'Comunicacional',
  'Corresponsales': 'Comunicacional',
  'Conquista': 'Territorial',
  'Vecindad': 'Territorial',
  'Tratado': 'Legal',
  'Conflicto': 'Legal',
  'Jurisdicción': 'Legal',
  'Capitulación': 'Legal',
  'Tutoría/Maestría': 'Legal',
  'Financiero': 'Económica',
  'Propiedad': 'Territorial',
  'Formación': 'Económica',
  'Matrimonio': 'Familiar',
  'Boda': 'Familiar',
  'Parentesco': 'Familiar',
  'Sucesión/Heredero': 'Familiar',
};

const categoriaRelacion = (etiqueta) => {
  const normalizada = String(etiqueta || '').trim();
  const entrada = RELACIONES_POR_ETIQUETA.get(normalizada);
  return (entrada && entrada.categoria) || CATEGORIAS_LEGACY[normalizada] || '';
};
raiz.categoriaRelacion = categoriaRelacion;

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    TAXONOMIA_RELACIONES,
    RESTRICCIONES_RELACION,
    RELACIONES_TIPOS,
    RELACIONES_CATEGORIAS_PLURAL,
    CATEGORIAS_LEGACY,
    restriccionRelacion,
    relacionPermitida,
    relacionesPorOrigen,
    tiposDestinoRelacion,
    ladosRelacion,
    categoriaRelacion,
  };
}
