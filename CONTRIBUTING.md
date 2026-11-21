# Cómo contribuir a H-IMAGO

Gracias por interesarte por H-IMAGO. El proyecto combina investigación histórica, prosopografía y análisis de redes sociales, así que las contribuciones no son solo de código: también son valiosas las correcciones de documentación, las pruebas de uso, la revisión de formularios y taxonomías, los datos de ejemplo y las traducciones.

## Formas de contribuir

- **Reportar un error** con pasos claros y reproducibles.
- **Proponer una mejora** o un caso de uso.
- **Revisar la documentación** y avisar de errores, enlaces rotos o explicaciones confusas.
- **Probar formularios, taxonomías y flujos de trabajo** con datos ficticios.
- **Aportar datos de ejemplo** sin información personal ni documentos privados.
- **Traducir** textos de la interfaz o de la documentación.
- **Programar** una corrección, una prueba o una mejora.
- **Difundir** el proyecto entre personas e instituciones que puedan usarlo.

## Antes de abrir un issue

1. Busca si el problema ya está reportado.
2. Usa la plantilla que corresponda.
3. No publiques datos personales, documentos históricos privados, credenciales ni bases de datos reales.
4. Si el problema depende de un archivo, prepara un ejemplo mínimo con datos ficticios.

Las preguntas abiertas, las ideas y los casos de uso pueden ir a **Discussions**.

## Entorno de desarrollo

Requisitos:

- Node.js 22.12 o superior.
- npm.
- SQLite no necesita instalación: va integrado.
- MySQL/MariaDB es opcional, solo para el modo equipo.

```bash
npm install
npm start
```

Si el entorno Linux no permite el sandbox:

```bash
npm run start:sin-sandbox
```

Comprobaciones antes de enviar cambios:

```bash
npm run lint
npm run check
npm test
npm run verificar
```

`npm run verificar` ejecuta lint, comprobación de sintaxis y todas las pruebas. La prueba de MySQL se omite si no se activa `HIMAGO_TEST_MYSQL=1`.

## Flujo de trabajo

1. Haz un fork del repositorio o crea una rama si tienes permisos de escritura.
2. Crea una rama corta y descriptiva:
   - `fix/...` para correcciones.
   - `feat/...` para mejoras.
   - `docs/...` para documentación.
   - `test/...` para pruebas.
3. Haz commits pequeños y con mensajes claros, preferiblemente en español y en modo imperativo.
4. Ejecuta `npm run verificar`.
5. Abre un Pull Request contra `main` explicando qué cambia, por qué y cómo lo probaste.
6. Si el PR resuelve un issue, escribe `Closes #NÚMERO` en la descripción.

No hace falta que un PR sea perfecto para abrirlo. Si es un trabajo en curso, márcalo como borrador y pide orientación.

## Reglas para cambios de código

- Mantén el estilo y la estructura existentes.
- Añade o actualiza pruebas cuando cambie el comportamiento.
- Si tocas la base de datos, revisa la compatibilidad entre SQLite y MySQL/MariaDB.
- Las migraciones deben ser seguras y conservar los datos existentes.
- No incluyas credenciales, rutas personales ni datos de investigación.
- Respeta las validaciones de IPC, rutas y permisos.
- Actualiza la documentación si cambias la instalación, la configuración o el uso.

## Datos de investigación

El repositorio no debe contener:

- Bases de datos reales (`*.db`, `*.sqlite`, `*.sqlite3`).
- Copias de seguridad o archivos WAL/SHM.
- Exportaciones de proyectos o bloques con datos reales.
- Credenciales, archivos `.env` o configuraciones locales.
- Documentos de archivo que no sean de dominio público o no tengas permiso para publicar.

Usa datos ficticios o anonimizados en issues, pruebas y ejemplos. El `.gitignore` ya excluye las bases de datos, las exportaciones y los archivos JSON de trabajo, pero conviene revisar `git status` antes de hacer commit.

## Revisión y fusión

- El CI debe estar en verde.
- Se revisará que el cambio esté probado y documentado.
- Los PR pequeños son más fáciles de revisar.
- Normalmente se fusionan con **Squash and merge** para mantener `main` limpio.
- Las discusiones de diseño pueden continuar en el issue o en Discussions.

## Licencia

H-IMAGO se distribuye bajo licencia MIT. Al enviar una contribución aceptas que se publique bajo esa misma licencia.

## Patrocinio

Si H-IMAGO te resulta útil, puedes apoyar su mantenimiento en
[GitHub Sponsors](https://github.com/sponsors/mre1302).
