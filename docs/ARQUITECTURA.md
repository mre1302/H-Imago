# Arquitectura de H-IMAGO

## Capas

| Capa | Archivos | Responsabilidad |
|---|---|---|
| Proceso principal | `main.js`, `preload.js` | Ventana, IPC seguro, configuración persistente y diálogos nativos |
| Definiciones de datos | `db/definiciones.js` | Tipos de entidad, campos, prefijos de identificador y normalización de relaciones |
| Esquema compartido | `db/columnas-nuevas.js` | Definición única de columnas de migración para SQLite y MySQL |
| Fachada de datos | `db/database.js` | CRUD, proyectos, relaciones, importación/exportación y transacciones |
| Motor SQLite | `db/sqlite.js`, `db/sqlite-worker.js` | Pool serializado con `node-sqlite3-wasm`, ejecutado en un hilo de trabajo; esquema y migraciones locales |
| Fechas legadas | `db/fechas-legadas.js` | Extracción segura de años y rangos de los campos de texto antiguos |
| Esquema MySQL | `db/mysql-esquema.js` | Esquema y migraciones de MySQL/MariaDB |
| Referencias de bloques | `db/bloques-referencias.js` | Remapeo de entidades dentro del JSON de los bloques |
| Copias de seguridad | `db/respaldo.js` | Copia previa a migraciones MySQL con `mysqldump` |
| Reglas de automatización | `db/relaciones-automaticas.js` | Generación y reconciliación de relaciones `AUTOMATIZADA`/`EDITADA` |
| Búsqueda general | `db/busqueda.js`, `src/js/modulos/busqueda.js` | Normalización, puntuación, fragmentos, índice del proyecto y filtros por tipo |
| Renderer | `src/js/` y `src/js/modulos/` | Índice, fichas, relaciones, grafo, mapa, búsqueda, fechas y bloques |
| Autoprueba | `scripts/autoprueba.js` | Recorrido automatizado de la interfaz; no se empaqueta en producción |

## Flujo de los formularios de bloques

1. La fuente funcional es `docs/formularios-bloques.ods`: en los 25
   formularios, la sección REGISTRO empieza con **TÍTULO** y **SIGNATURA**
   inmediatamente a su derecha.
2. `scripts/generar-formularios-bloques.py` lee el ODS y genera
   `src/js/modulos/formularios-bloques.js`.
3. Los identificadores de campo se toman del libro de campo
   `docs/formularios-bloques-ids.json`: cada clave
   `formulario::NOMBRE::ocurrencia` conserva su id aunque se reordenen o
   inserten campos en el ODS; los nombres nuevos reciben el siguiente id libre
   del formulario, de modo que los datos guardados y las reglas de
   automatización nunca pierden su referencia.
4. El generador normaliza y valida los anchos de la línea REGISTRO
   (TÍTULO 10 · SIGNATURA 2 · LUGAR 2 · INSTITUCIÓN o PARROQUIA 4).
5. El módulo generado es declarativo: secciones, campos, personas,
   patrimonios y grupos repetibles.
6. `src/js/modulos/bloques-registro.js` interpreta ese esquema y construye el
   editor; `db/relaciones-automaticas.js` aplica las reglas del bloque.

**No se debe editar `formularios-bloques.js` a mano**: cualquier cambio se hace
en el ODS y se regenera con:

```bash
python3 scripts/generar-formularios-bloques.py
```

## Migraciones

`db/columnas-nuevas.js` es la fuente única de las columnas añadidas por las
migraciones. Cada entrada declara el tipo para SQLite y para MySQL/MariaDB.
Ambos motores construyen sus listas desde ahí; la prueba
`Esquema: SQLite contiene todas las columnas de la definición compartida`
verifica que la base local recibe todas las columnas declaradas.

Antes de migrar, SQLite copia el archivo `.db` dentro de una transacción de
migración y MySQL intenta un `mysqldump`; si el volcado falla, la migración se
detiene para no perder datos. Las copias antiguas se podan y ambas migraciones
son idempotentes: las columnas existentes se omiten.

La versión 9 añade `bloque_referencias`, un índice normalizado de las entidades
citadas por el JSON de los bloques. Se mantiene al guardar/importar/fusionar y
se usa para limpiar o remapear referencias sin escanear `LONGTEXT` con `LIKE`.
Los índices únicos se crean después de reparar UUID/exclusiones duplicados; si
no es posible, se deja un índice no único y se avisa para no impedir el arranque.

## Búsqueda general

`db/database.js` construye bajo demanda un corpus por proyecto con entidades,
relaciones (con nombres y fuentes vinculadas), bloques de registro, cuadernos y
coincidencias. El corpus se normaliza sin tildes y se cachea unos segundos; la
sección de búsqueda lo reconstruye al entrar y cuando se pulsa «Actualizar
índice». La consulta se descompone en palabras (todas deben aparecer) y se
puntúa con más peso en el título que en el cuerpo. `db/busqueda.js` concentra
la normalización, la puntuación y la extracción de fragmentos resaltados.

Los filtros son dos: tipos de entidad (chips) y tipo de relación (selector
agrupado por categoría). Si hay un filtro activo, los resultados se limitan a
esa categoría; sin filtros, la búsqueda recorre todo el corpus. Las
transcripciones se buscan en `cuadernos.contenido`; la columna heredada
`fuentes.transcripcion` no se indexa porque el formulario ya no la usa.

## Restricciones de relaciones

Cada tipo de la taxonomía declara qué tipos de entidad pueden actuar como
**origen** y como **destino** (`RESTRICCIONES_RELACION` en
`src/js/modulos/taxonomia-relaciones.js`, según NRELACIONES). El formulario de
relaciones filtra los tipos y los destinos en ambos sentidos; el alta manual se
valida también en el proceso principal. Los tipos personalizados quedan fuera de
la taxonomía y no se restringen. Las relaciones heredadas que no cumplan la
restricción se conservan, se pueden editar en sus fechas/notas/fuentes y se
marcan con ⚠ en la lista. Las reglas automáticas generan `Sede` como
LUGAR → INSTITUCIÓN y `Apoderado – Representado` del apoderado al otorgante.

## Pruebas y CI

- `npm run lint`: ESLint sobre Node, base de datos, pruebas y renderer.
- `npm run check`: comprobación de sintaxis de los módulos principales.
- `npm test`: pruebas de auditoría, mejoras, rutas, búsqueda, UI y MySQL (esta
  última se omite si `HIMAGO_TEST_MYSQL` no vale `1`).
- `npm run verificar`: lint + check + test.

GitHub Actions ejecuta la suite SQLite en cada push y una integración MySQL 8.0
en un servicio aparte. Para probar MySQL en local:

```bash
HIMAGO_TEST_MYSQL=1 \
HIMAGO_MYSQL_HOST=127.0.0.1 \
HIMAGO_MYSQL_USER=root \
HIMAGO_MYSQL_PASSWORD=root \
HIMAGO_MYSQL_DATABASE=himago_test \
node --test test/mysql.test.js
```

## Deuda estructural pendiente

- `src/js/modulos/entidades.js` y `db/relaciones-automaticas.js` siguen siendo
  módulos grandes, pero cada uno responde a una responsabilidad única (fichas
  genéricas y motor de reglas, respectivamente). Se han separado las piezas
  reutilizables y se evitará fragmentarlos sin una prueba de regresión previa.
- `scripts/autoprueba.js` es un recorrido de interfaz de gran tamaño; vive en
  `scripts/` y no se empaqueta. Una futura división por secciones (índice,
  entidades, bloques, grafo) reduciría su complejidad.
- `src/js/modulos/formularios-bloques.js` es generado y no debe dividirse a
  mano: la fuente es el ODS y el generador.
