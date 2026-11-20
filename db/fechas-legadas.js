'use strict';

/**
 * Extrae los años de una datación histórica legada.
 *
 * Los campos antiguos mezclaban años sueltos, rangos («1520-1560»,
 * «1489–1512») y fechas exactas («19-X-1469»). El guion de un rango no debe
 * interpretarse como signo negativo; por eso se resuelven primero los rangos
 * y después los años sueltos. Se admite «a. C.» y un año negativo aislado.
 */
function extraerAnios(texto) {
  const valor = String(texto ?? '').replace(/\u00a0/g, ' ').trim();
  if (!valor) return [];

  const rango = /(\d{3,4})\s*[-–]\s*(\d{3,4})/.exec(valor);
  if (rango) return [Number(rango[1]), Number(rango[2])];

  const negativo = /^\s*-\s*(\d{3,4})\s*$/.exec(valor);
  if (negativo) return [-Number(negativo[1])];

  const antesDeCristo = /(?:^|[^\d])(\d{1,4})\s*a\.\s*c\./i.exec(valor);
  if (antesDeCristo) return [1 - Number(antesDeCristo[1])];

  return [...valor.matchAll(/\d{3,4}/g)].map((coincidencia) => Number(coincidencia[0]));
}

module.exports = { extraerAnios };
