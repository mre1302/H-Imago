#!/usr/bin/env bash
# H-IMAGO · Lanzador de escritorio
# Ejecuta la aplicación con --disable-dev-shm-usage, sin depender de que npm
# esté en el PATH del entorno gráfico. El sandbox y la GPU se mantienen según
# la configuración de Electron (HIMAGO_SIN_GPU=1 desactiva la GPU).

set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

ELECTRON="$DIR/node_modules/electron/dist/electron"

if [ ! -x "$ELECTRON" ]; then
  echo "No se encuentra Electron. Entra en $DIR y ejecuta:  npm install" >&2
  exit 1
fi

exec "$ELECTRON" "$DIR" --disable-dev-shm-usage
