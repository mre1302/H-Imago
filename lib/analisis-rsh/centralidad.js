'use strict';

/* H-IMAGO · Análisis RSH: centralidades.
   - Intermediación de Brandes (dirigida o no dirigida).
   - Cercanía armónica, definida también en redes desconectadas.
   - Vector propio en modo no dirigido; PageRank en modo dirigido. */

const {
  UMBRAL_INTERMEDIACION_EXACTA,
  MUESTRAS_INTERMEDIACION,
  UMBRAL_CERCANIA_EXACTA,
  MUESTRAS_CERCANIA,
} = require('./constantes');

function fuentesMuestreadas(n, muestras, semilla = null) {
  const total = Math.min(n, Math.max(1, Math.floor(muestras)));
  if (Number.isInteger(Number(semilla))) {
    /* Muestreo aleatorio reproducible: evita el sesgo de elegir índices
       equiespaciados cuando el orden de nodos correlaciona con la estructura. */
    const indices = Array.from({ length: n }, (_, i) => i);
    let estado = (Number(semilla) >>> 0) || 1;
    for (let i = n - 1; i > 0; i--) {
      estado = (Math.imul(estado, 1664525) + 1013904223) >>> 0;
      const j = estado % (i + 1);
      [indices[i], indices[j]] = [indices[j], indices[i]];
    }
    return indices.slice(0, total).sort((a, b) => a - b);
  }
  const conjunto = new Set();
  const paso = n / total;
  for (let i = 0; i < total; i++) {
    conjunto.add(Math.min(n - 1, Math.floor(i * paso + paso / 2)));
  }
  for (let i = 0; conjunto.size < total && i < n; i++) conjunto.add(i);
  return [...conjunto].sort((a, b) => a - b);
}

function calcularIntermediacion(red, opciones = {}, onProgress = () => {}) {
  const n = red.n;
  const porNodo = {};
  if (n === 0) {
    return { porNodo, maximo: 0, aproximada: false, fuentes: 0, metodo: 'Brandes' };
  }

  const umbral = Number.isFinite(Number(opciones.maxFuentesExactas))
    ? Math.max(1, Number(opciones.maxFuentesExactas))
    : UMBRAL_INTERMEDIACION_EXACTA;
  const exacta = n <= umbral;
  const fuentes = exacta
    ? Array.from({ length: n }, (_, i) => i)
    : fuentesMuestreadas(n, opciones.muestras || MUESTRAS_INTERMEDIACION, opciones.semilla);
  const bruto = new Float64Array(n);
  const totalFuentes = fuentes.length;
  const intervaloProgreso = Math.max(1, Math.floor(totalFuentes / 20));

  for (let indiceFuente = 0; indiceFuente < totalFuentes; indiceFuente++) {
    const s = fuentes[indiceFuente];
    const pila = new Int32Array(n);
    let tope = 0;
    const predecesores = Array.from({ length: n }, () => []);
    const sigma = new Float64Array(n);
    sigma[s] = 1;
    const distancia = new Int32Array(n).fill(-1);
    distancia[s] = 0;
    const cola = new Int32Array(n);
    let frente = 0;
    let final = 1;
    cola[0] = s;

    while (frente < final) {
      const v = cola[frente++];
      pila[tope++] = v;
      const dv = distancia[v];
      for (const w of red.adyacencia[v]) {
        if (distancia[w] < 0) {
          distancia[w] = dv + 1;
          cola[final++] = w;
        }
        if (distancia[w] === dv + 1) {
          sigma[w] += sigma[v];
          if (!Number.isFinite(sigma[w]) || sigma[w] > 1e300) {
            throw new Error(
              'La red tiene demasiados caminos mínimos para calcular la intermediación '
              + 'con precisión numérica. Reduce el ámbito o interpreta el resultado con cautela.'
            );
          }
          predecesores[w].push(v);
        }
      }
    }

    const delta = new Float64Array(n);
    while (tope > 0) {
      const w = pila[--tope];
      for (const v of predecesores[w]) {
        if (sigma[w] > 0) delta[v] += (sigma[v] / sigma[w]) * (1 + delta[w]);
      }
      if (w !== s) bruto[w] += delta[w];
    }

    if ((indiceFuente + 1) % intervaloProgreso === 0 || indiceFuente + 1 === totalFuentes) {
      onProgress({
        metrica: 'intermediacion',
        hechas: indiceFuente + 1,
        total: totalFuentes,
        aproximada: !exacta,
      });
    }
  }

  const escala = exacta ? 1 : n / totalFuentes;
  /* En no dirigidas el acumulador de Brandes ya cuenta cada par no ordenado
     dos veces (una por cada sentido de la fuente). El factor es el mismo que
     en dirigidas; el anterior 2/((n-1)(n-2)) duplicaba y saturaba a 1. */
  const factor = n > 2 ? 1 / ((n - 1) * (n - 2)) : 0;
  let maximo = 0;
  for (let i = 0; i < n; i++) {
    const valor = Math.max(0, Math.min(1, bruto[i] * escala * factor));
    porNodo[red.nodos[i].id] = {
      valor,
      bruto: bruto[i] * escala,
    };
    if (valor > maximo) maximo = valor;
  }

  return {
    porNodo,
    maximo,
    aproximada: !exacta,
    fuentes: totalFuentes,
    metodo: 'Brandes',
    normalizacion: red.dirigida ? 'dirigida' : 'no dirigida',
  };
}

function calcularCercania(red, opciones = {}, onProgress = () => {}) {
  const n = red.n;
  const porNodo = {};
  if (n === 0) {
    return { porNodo, maximo: 0, metodo: 'Cercanía armónica', exacta: true, aproximada: false, fuentes: 0 };
  }

  const umbral = Number.isFinite(Number(opciones.maxFuentesExactasCercania))
    ? Math.max(1, Number(opciones.maxFuentesExactasCercania))
    : UMBRAL_CERCANIA_EXACTA;
  const exacta = n <= umbral;
  const fuentes = exacta
    ? Array.from({ length: n }, (_, i) => i)
    : fuentesMuestreadas(n, Number(opciones.muestrasCercania) || MUESTRAS_CERCANIA, opciones.semilla);
  const intervaloProgreso = Math.max(1, Math.floor(fuentes.length / 20));
  let maximo = 0;

  for (let indiceFuente = 0; indiceFuente < fuentes.length; indiceFuente++) {
    const s = fuentes[indiceFuente];
    const distancia = new Int32Array(n).fill(-1);
    const cola = new Int32Array(n);
    let frente = 0;
    let final = 1;
    cola[0] = s;
    distancia[s] = 0;

    while (frente < final) {
      const v = cola[frente++];
      const dv = distancia[v];
      for (const w of red.adyacencia[v]) {
        if (distancia[w] >= 0) continue;
        distancia[w] = dv + 1;
        cola[final++] = w;
      }
    }

    let sumaArmonica = 0;
    let sumaDistancias = 0;
    let alcanzables = 0;
    for (let i = 0; i < n; i++) {
      if (i === s || distancia[i] <= 0) continue;
      alcanzables++;
      sumaDistancias += distancia[i];
      sumaArmonica += 1 / distancia[i];
    }

    const armonica = n > 1 ? sumaArmonica / (n - 1) : 0;
    porNodo[red.nodos[s].id] = {
      valor: armonica,
      alcanzables,
      clasica: alcanzables === n - 1 && sumaDistancias > 0
        ? (n - 1) / sumaDistancias
        : null,
    };
    if (armonica > maximo) maximo = armonica;

    if ((indiceFuente + 1) % intervaloProgreso === 0 || indiceFuente + 1 === fuentes.length) {
      onProgress({ metrica: 'cercania', hechas: indiceFuente + 1, total: fuentes.length });
    }
  }

  return {
    porNodo,
    maximo,
    metodo: 'Cercanía armónica',
    exacta,
    aproximada: !exacta,
    fuentes: fuentes.length,
  };
}

function pesosSalidaDe(red) {
  return red.pesosSalida.map((mapa) => new Map(mapa));
}

function calcularPageRank(red, opciones = {}, onProgress = () => {}) {
  const n = red.n;
  const porNodo = {};
  if (n === 0) {
    return { porNodo, maximo: 0, metodo: 'PageRank', iteraciones: 0, convergio: true, dirigida: true };
  }
  const amortiguacion = Number.isFinite(Number(opciones.amortiguacion))
    ? Math.max(0, Math.min(1, Number(opciones.amortiguacion)))
    : 0.85;
  const maxIteraciones = Math.max(1, Number(opciones.iteraciones) || 100);
  const tolerancia = Number(opciones.tolerancia) || 1e-10;
  const pesos = pesosSalidaDe(red);
  const salidaPeso = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    for (const peso of pesos[i].values()) salidaPeso[i] += peso;
  }

  let valores = new Float64Array(n).fill(1 / n);
  let convergio = false;
  let iteraciones = 0;
  for (let iter = 0; iter < maxIteraciones; iter++) {
    iteraciones = iter + 1;
    const siguiente = new Float64Array(n).fill((1 - amortiguacion) / n);
    let colgantes = 0;
    for (let i = 0; i < n; i++) if (salidaPeso[i] === 0) colgantes += valores[i];
    if (colgantes > 0) {
      const reparto = (amortiguacion * colgantes) / n;
      for (let i = 0; i < n; i++) siguiente[i] += reparto;
    }
    for (let i = 0; i < n; i++) {
      if (salidaPeso[i] === 0) continue;
      const reparto = (amortiguacion * valores[i]) / salidaPeso[i];
      for (const [destino, peso] of pesos[i]) siguiente[destino] += reparto * peso;
    }
    let diferencia = 0;
    for (let i = 0; i < n; i++) diferencia += Math.abs(siguiente[i] - valores[i]);
    valores = siguiente;
    if ((iter + 1) % 10 === 0) {
      onProgress({ metrica: 'vectorPropio', hechas: iter + 1, total: maxIteraciones, metodo: 'PageRank' });
    }
    if (diferencia < tolerancia) {
      convergio = true;
      break;
    }
  }

  let maximo = 0;
  for (let i = 0; i < n; i++) if (valores[i] > maximo) maximo = valores[i];
  for (let i = 0; i < n; i++) {
    porNodo[red.nodos[i].id] = {
      valor: maximo > 0 ? valores[i] / maximo : 0,
      bruto: valores[i],
    };
  }
  return {
    porNodo,
    maximo: maximo > 0 ? 1 : 0,
    metodo: 'PageRank',
    iteraciones,
    convergio,
    dirigida: true,
  };
}

function calcularVectorPropio(red, opciones = {}, onProgress = () => {}) {
  const n = red.n;
  const porNodo = {};
  if (n === 0) {
    return { porNodo, maximo: 0, metodo: 'Vector propio', iteraciones: 0, convergio: true, dirigida: false };
  }
  const maxIteraciones = Math.max(1, Number(opciones.iteraciones) || 100);
  const tolerancia = Number(opciones.tolerancia) || 1e-10;
  const pesos = pesosSalidaDe(red);
  const grado = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    for (const peso of pesos[i].values()) grado[i] += peso;
  }
  let valores = new Float64Array(n);
  let normaInicial = 0;
  for (let i = 0; i < n; i++) {
    if (grado[i] > 0) valores[i] = 1;
    normaInicial += valores[i] * valores[i];
  }
  normaInicial = Math.sqrt(normaInicial);
  if (normaInicial === 0) {
    for (let i = 0; i < n; i++) porNodo[red.nodos[i].id] = { valor: 0, bruto: 0 };
    return { porNodo, maximo: 0, metodo: 'Vector propio', iteraciones: 0, convergio: true, dirigida: false };
  }
  for (let i = 0; i < n; i++) valores[i] /= normaInicial;
  let convergio = false;
  let iteraciones = 0;

  for (let iter = 0; iter < maxIteraciones; iter++) {
    iteraciones = iter + 1;
    const siguiente = new Float64Array(n);
    for (let i = 0; i < n; i++) {
      if (valores[i] === 0) continue;
      /* A + I rompe la oscilación de la iteración de potencias en grafos
         bipartitos; los nodos aislados no reciben el desplazamiento. */
      if (grado[i] > 0) siguiente[i] += valores[i];
      for (const [destino, peso] of pesos[i]) siguiente[destino] += valores[i] * peso;
    }
    let norma = 0;
    for (let i = 0; i < n; i++) norma += siguiente[i] * siguiente[i];
    norma = Math.sqrt(norma);
    if (norma === 0) {
      valores = siguiente;
      convergio = true;
      break;
    }
    let diferencia = 0;
    for (let i = 0; i < n; i++) {
      siguiente[i] /= norma;
      diferencia += Math.abs(siguiente[i] - valores[i]);
    }
    valores = siguiente;
    if ((iter + 1) % 10 === 0) {
      onProgress({ metrica: 'vectorPropio', hechas: iter + 1, total: maxIteraciones, metodo: 'Vector propio' });
    }
    if (diferencia < tolerancia) {
      convergio = true;
      break;
    }
  }

  let maximo = 0;
  for (let i = 0; i < n; i++) if (Math.abs(valores[i]) > maximo) maximo = Math.abs(valores[i]);
  for (let i = 0; i < n; i++) {
    porNodo[red.nodos[i].id] = {
      valor: maximo > 0 ? Math.abs(valores[i]) / maximo : 0,
      bruto: valores[i],
    };
  }
  return {
    porNodo,
    maximo: maximo > 0 ? 1 : 0,
    metodo: 'Vector propio',
    iteraciones,
    convergio,
    dirigida: false,
  };
}

function calcularCentralidadVectorPropio(red, opciones = {}, onProgress = () => {}) {
  return red.dirigida
    ? calcularPageRank(red, opciones, onProgress)
    : calcularVectorPropio(red, opciones, onProgress);
}

module.exports = {
  calcularIntermediacion,
  calcularCercania,
  calcularPageRank,
  calcularVectorPropio,
  calcularCentralidadVectorPropio,
  fuentesMuestreadas,
};
