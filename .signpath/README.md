# SignPath

Configuración de referencia para la firma gratuita de H-IMAGO con
[SignPath Foundation](https://signpath.org/).

## Artefactos

- `artifact-configurations/app-exe.xml`: firma `H-IMAGO.exe`. Se usa en la
  primera solicitud, antes de construir el instalador.
- `artifact-configurations/installer.xml`: firma
  `H-IMAGO-<versión>-Setup.exe`. Se usa en la segunda solicitud.

Los dos XML se pegan en la configuración de artefactos del proyecto en
SignPath.io. No los lee el workflow directamente.

## Workflow

`.github/workflows/windows-release.yml` hace dos pasadas:

1. Construye `dist/win-unpacked`, sube `H-IMAGO.exe` y lo firma.
2. Sustituye el ejecutable por el firmado, construye el instalador y lo firma.

## Variables y secretos de GitHub

Variables del repositorio:

- `SIGNPATH_ORGANIZATION_ID`
- `SIGNPATH_PROJECT_SLUG`
- `SIGNPATH_SIGNING_POLICY_SLUG`

Secreto:

- `SIGNPATH_API_TOKEN`

Mientras no estén configurados, el workflow solo genera builds sin firmar y no
permite publicar un tag de release sin firma.

## Orden de alta

1. Aprobar la solicitud en SignPath Foundation.
2. Crear el proyecto y las dos configuraciones de artefactos.
3. Crear la política de firma con aprobación manual.
4. Generar el token de API y guardarlo como secreto.
5. Guardar los identificadores como variables.
6. Ejecutar el workflow manualmente para probar la firma.
7. Preparar la versión 0.0.29, crear el tag y aprobar las dos solicitudes.
