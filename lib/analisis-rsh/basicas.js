'use strict';

/* H-IMAGO · Análisis RSH: métricas básicas.
   Grado, componentes y densidad. No dependen de Leiden ni de las centralidades. */

function calcularGrado(red) {
  const porNodo = {};
  let maximo = 0;
  let suma = 0;
  for (let i = 0; i < red.n; i++) {
    const nodo = red.nodos[i];
    const total = red.dirigida ? red.salida[i] + red.entrada[i] : red.incidencia[i];
    const salida = red.dirigida ? red.salida[i] : null;
    const entrada = red.dirigida ? red.entrada[i] : null;
    const valor = {
      total,
      salida,
      entrada,
      vecinos: red.vecinos[i].size,
      /* El grado total dirigido tiene máximo 2(n-1); el no dirigido n-1. */
      normalizado: red.n > 1
        ? total / ((red.n - 1) * (red.dirigida ? 2 : 1))
        : 0,
    };
    porNodo[nodo.id] = valor;
    if (total > maximo) maximo = total;
    suma += total;
  }
  return {
    porNodo,
    maximo,
    media: red.n ? suma / red.n : 0,
    dirigida: red.dirigida,
  };
}

function etiquetarComponentes(adyacencia) {
  const n = adyacencia.length;
  const etiquetas = new Int32Array(n).fill(-1);
  const tamanos = [];
  for (let inicio = 0; inicio < n; inicio++) {
    if (etiquetas[inicio] >= 0) continue;
    const componente = tamanos.length;
    let tamano = 0;
    const pila = [inicio];
    etiquetas[inicio] = componente;
    while (pila.length) {
      const v = pila.pop();
      tamano++;
      for (const w of adyacencia[v]) {
        if (etiquetas[w] >= 0) continue;
        etiquetas[w] = componente;
        pila.push(w);
      }
    }
    tamanos.push(tamano);
  }
  return { etiquetas, tamanos };
}

function ordenSalidaProfundidad(adyacencia) {
  const n = adyacencia.length;
  const visitado = new Uint8Array(n);
  const orden = [];
  for (let inicio = 0; inicio < n; inicio++) {
    if (visitado[inicio]) continue;
    const pila = [[inicio, 0]];
    visitado[inicio] = 1;
    while (pila.length) {
      const actual = pila[pila.length - 1];
      const [v, i] = actual;
      if (i < adyacencia[v].length) {
        const w = adyacencia[v][i];
        actual[1]++;
        if (!visitado[w]) {
          visitado[w] = 1;
          pila.push([w, 0]);
        }
      } else {
        orden.push(v);
        pila.pop();
      }
    }
  }
  return orden;
}

function etiquetarComponentesFuertes(red) {
  if (!red.dirigida) return null;
  const n = red.n;
  const orden = ordenSalidaProfundidad(red.adyacencia);
  const etiquetas = new Int32Array(n).fill(-1);
  const tamanos = [];
  for (let k = orden.length - 1; k >= 0; k--) {
    const inicio = orden[k];
    if (etiquetas[inicio] >= 0) continue;
    const componente = tamanos.length;
    let tamano = 0;
    const pila = [inicio];
    etiquetas[inicio] = componente;
    while (pila.length) {
      const v = pila.pop();
      tamano++;
      for (const w of red.adyacenciaEntrada[v]) {
        if (etiquetas[w] >= 0) continue;
        etiquetas[w] = componente;
        pila.push(w);
      }
    }
    tamanos.push(tamano);
  }
  return { etiquetas, tamanos };
}

function mayorComponente(tamanos) {
  let indice = -1;
  let tamano = 0;
  for (let i = 0; i < tamanos.length; i++) {
    if (tamanos[i] > tamano) {
      tamano = tamanos[i];
      indice = i;
    }
  }
  return { componente: indice, tamano };
}

function calcularComponentes(red) {
  const adyacenciaDebil = Array.from({ length: red.n }, (_, i) => {
    const conjunto = new Set(red.adyacencia[i]);
    for (const w of red.adyacenciaEntrada[i]) conjunto.add(w);
    return [...conjunto];
  });
  const debiles = etiquetarComponentes(adyacenciaDebil);
  const fuertes = etiquetarComponentesFuertes(red) || {
    etiquetas: debiles.etiquetas,
    tamanos: debiles.tamanos,
  };
  const porNodo = {};
  const aislados = [];
  for (let i = 0; i < red.n; i++) {
    const nodo = red.nodos[i];
    porNodo[nodo.id] = {
      debil: debiles.etiquetas[i],
      fuerte: fuertes.etiquetas[i],
      tamanoDebil: debiles.tamanos[debiles.etiquetas[i]] || 0,
      tamanoFuerte: fuertes.tamanos[fuertes.etiquetas[i]] || 0,
    };
    if (red.vecinos[i].size === 0) aislados.push(nodo.id);
  }
  return {
    porNodo,
    numeroDebiles: debiles.tamanos.length,
    numeroFuertes: fuertes.tamanos.length,
    mayorDebil: mayorComponente(debiles.tamanos),
    mayorFuerte: mayorComponente(fuertes.tamanos),
    tamanosDebiles: debiles.tamanos,
    tamanosFuertes: fuertes.tamanos,
    aislados,
  };
}

function calcularDensidad(red) {
  const n = red.n;
  const posibles = n > 1
    ? (red.dirigida ? n * (n - 1) : (n * (n - 1)) / 2)
    : 0;
  const valor = posibles > 0 ? Math.min(1, red.mPares / posibles) : 0;
  return {
    valor,
    paresUnicos: red.mPares,
    posibles,
    vinculos: red.m,
    multiplicidadMedia: red.mPares > 0 ? red.m / red.mPares : 0,
    n,
    dirigida: red.dirigida,
  };
}

module.exports = {
  calcularGrado,
  calcularComponentes,
  calcularDensidad,
  etiquetarComponentes,
  etiquetarComponentesFuertes,
};
