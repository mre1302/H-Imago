# Análisis RSH

**Análisis RSH** es una capa opcional de la vista de grafo para calcular indicadores de redes sociales históricas. No se activa ni se calcula al abrir la sección: el usuario debe elegir las métricas y la red analítica, y pulsar **Calcular Análisis RSH**.

## Red analítica

La configuración por defecto es:

- **Red completa del proyecto**: incluye todas las entidades y relaciones, aunque los filtros visuales oculten parte del grafo.
- **Relaciones dirigidas**: el grado distingue entrada y salida; la intermediación, la cercanía y PageRank usan caminos dirigidos.
- **Aristas independientes**: varias relaciones entre la misma pareja no se colapsan para el grado; la densidad se calcula sobre pares únicos y la multiplicidad se informa aparte.
- **Entidades aisladas incluidas** en `n`, densidad y componentes.
- **Procedencia**: todas las relaciones (`MANUAL`, `EDITADA`, `AUTOMATIZADA`), configurable.
- **Leiden** sobre una proyección no dirigida ponderada por el número de relaciones de cada par.

La red visible actual puede seleccionarse como ámbito alternativo. En ese caso, los cambios en los filtros visuales marcan los resultados como desactualizados.

## Indicadores

### Grado

Número de relaciones independientes de cada entidad.

- En redes dirigidas: grado de entrada, salida y total.
- `vecinos` cuenta entidades distintas, no vínculos.
- Normalizado por el máximo posible: `n − 1` en redes no dirigidas y `2(n − 1)` en dirigidas (entrada + salida).

### Densidad

- Dirigida: `pares únicos / [n(n−1)]`.
- No dirigida: `pares únicos / [n(n−1)/2]`.
- Sin bucles.
- Se informa de `n`, `m`, pares únicos y multiplicidad media. La densidad no se calcula con aristas paralelas para que permanezca en el intervalo `[0, 1]`.

### Componentes

- Componentes **débiles** por defecto.
- Componentes **fuertes** como dato adicional en redes dirigidas.
- Tamaño de la mayor componente y listado de entidades aisladas.

### Intermediación

Algoritmo de Brandes, dirigido o no dirigido según la configuración. Normalizada por el número de pares; en redes no dirigidas cada par se cuenta dos veces (una por sentido de la fuente) y el factor de escala ya lo compensa, sin saturar los valores a `1`.

En redes grandes se usa una muestra de fuentes y el resultado se marca como **aproximado**. Si se indica una semilla, el muestreo es reproducible; sin semilla se usa un muestreo equiespaciado. El umbral exacto es una constante revisable en `lib/analisis-rsh/constantes.js`.

La intermediación no debe confundirse con los **puntos de articulación**; una entidad puede tener intermediación alta sin ser un punto de corte.

### Cercanía

Se usa la **cercanía armónica**:

```text
C(v) = [Σ 1/d(v, u)] / (n − 1)
```

Así queda definida en redes con componentes desconectadas. También se calcula la cercanía clásica cuando todos los nodos son alcanzables.

Por encima de `n = 5.000` se muestrean 400 fuentes y el resultado se marca como **aproximado**; el umbral y el tamaño de muestra se ajustan en `lib/analisis-rsh/constantes.js`.

### Vector propio / PageRank

- Red no dirigida: **vector propio** por iteración de potencias sobre la adyacencia ponderada, con desplazamiento `A + I` para que converja también en grafos bipartitos.
- Red dirigida: **PageRank** con amortiguación `0.85`.

La UI indica cuál se ha utilizado y avisa si la iteración no converge. En redes desconectadas, el vector propio puede concentrarse en una componente; PageRank distribuye mejor el efecto de los nodos colgantes.

### Comunidades

Implementación **Leiden** vendorizada (`leiden-ts 0.1.0`, MIT; ver `src/vendor/leiden/PROCEDENCIA.md`).

- Semilla fija por defecto (`42`) y resolución `1.0`.
- Varias repeticiones para estimar estabilidad.
- Se informa de modularidad, número y tamaño de comunidades.
- Las comunidades son una hipótesis algorítmica, no una prueba de grupo histórico consciente.

## Interfaz

- Botón **Análisis RSH** en la barra del grafo.
- Panel lateral con configuración y resultados.
- Tabla de nodos ordenable y filtrable, con paginación progresiva (hasta 5.000 filas visibles) y filtro con retardo para no repintar en cada tecla.
- Pestaña de comunidades.
- Tamaño de nodo opcional por métrica; por defecto se mantiene el tamaño por grado visible.
- Color por comunidad opcional; por defecto se mantiene el color por tipo de entidad.
- Exportación CSV con la definición de la red, los parámetros (resolución, semilla, repeticiones), el carácter aproximado de las centralidades y la convergencia del vector propio.

Cada métrica se calcula de forma aislada: si una falla, las demás siguen disponibles y el error se muestra como advertencia. El cálculo se cancela si se cierra el panel o se cambia de configuración, y un doble clic no aborta el cálculo recién lanzado.

Nada de esto se calcula ni se muestra al abrir la vista de grafo.

## Advertencias interpretativas

- Los indicadores describen la **red documentada**, no la red histórica completa.
- Un grado alto puede reflejar importancia social o una mayor conservación documental.
- La intermediación mide posición en caminos; no equivale a poder.
- La densidad depende del tamaño de la red y no es directamente comparable entre redes de distinto `n`.
- Las comunidades son sensibles a la resolución y a la semilla; se muestra una medida de estabilidad.
- En proyectos pequeños (`n < 5`) las centralidades son inestables.

## Rendimiento

`npm run bench:analisis` genera redes sintéticas y mide los algoritmos. Resultados orientativos en esta máquina (Windows, Node 24, red dirigida con grado medio 8):

| n | m | Intermediación | Cercanía | PageRank | Leiden |
|---|---|---|---|---|---|
| 500 | 2.000 | 46 ms (exacta) | 21 ms | 9 ms | 36 ms |
| 1.000 | 4.000 | 137 ms (exacta) | 35 ms | 10 ms | 31 ms |
| 2.000 | 8.000 | 121 ms (aprox.) | 138 ms | 19 ms | 40 ms |
| 5.000 | 20.000 | 336 ms (aprox.) | 956 ms | 51 ms | 141 ms |

Los umbrales se revisan con ese script. En esta versión, la intermediación exacta se usa hasta `n = 1.500` y la cercanía exacta hasta `n = 5.000`; por encima se muestrean 400 fuentes y el resultado se marca como aproximado.

El cálculo se ejecuta en un `Worker` con un máximo de 64 MB de payload, un límite de memoria de 1 GB y un tiempo máximo de 5 minutos. La caché de la red analítica se invalida al cambiar los datos del proyecto, pero no al mover o filtrar la vista: solo el ámbito «red visible» se marca como desactualizado cuando cambian los filtros visuales.
