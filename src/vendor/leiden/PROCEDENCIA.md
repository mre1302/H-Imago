# Leiden vendorizado

- Proyecto: `leiden-ts`
- Versión: `0.1.0`
- Autor: crodesrepos
- Licencia: MIT (ver `LICENSE`)
- Origen: https://www.npmjs.com/package/leiden-ts
- Repositorio: https://github.com/crodesrepos/leiden-ts
- Fecha de incorporación: 2026-11-25

## Archivos incorporados

- `leiden.cjs`: build CommonJS de `dist/index.cjs`.
- `LICENSE`: licencia original.
- `README.md`: documentación original.
- `package.json`: metadatos originales del paquete.

## Huellas

- SHA-256 de `leiden.cjs`: `51F2909C5B0775371C6ADD2B6B29B83F54816B78BA9AAF4329EB9EBBDFD82407`
- SHA-256 del tarball original `leiden-ts-0.1.0.tgz`: `878513486B754F9C10373126739A9B11DDA2C90FD885797120FC14249E4FF8A1`

## Notas de integración

- Se usa exclusivamente la implementación Leiden incluida; no hay descarga en tiempo de ejecución ni CDN.
- El paquete es JavaScript puro, sin dependencias de ejecución, WASM ni módulos nativos.
- La integración de H-IMAGO envuelve el grafo dirigido en una proyección no dirigida ponderada, porque Leiden estándar opera sobre grafos no dirigidos.
- Si se actualiza el paquete, hay que repetir la verificación de licencia, las huellas y las pruebas de `test/analisis-rsh.test.js`.
