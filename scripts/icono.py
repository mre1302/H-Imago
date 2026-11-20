#!/usr/bin/env python3
"""Genera build/icon.png (512x512) y build/icon.ico — icono de escritorio de H-IMAGO.

Uso: python3 scripts/icono.py
Depende solo de Pillow (pip install pillow). Idempotente.

Fuente: src/assets/marca-himago-oscuro.webp (red H-I sobre fondo oscuro).
"""

from pathlib import Path

from PIL import Image

RAIZ = Path(__file__).resolve().parent.parent
FUENTE = RAIZ / "src" / "assets" / "marca-himago-oscuro.webp"
SALIDA_PNG = RAIZ / "build" / "icon.png"
SALIDA_ICO = RAIZ / "build" / "icon.ico"

TAM = 512
TAMANOS_ICO = [(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)]


def principal():
    if not FUENTE.exists():
        raise SystemExit(f"No se encuentra el icono fuente: {FUENTE}")

    img = Image.open(FUENTE).convert("RGB")
    if img.size != (TAM, TAM):
        img = img.resize((TAM, TAM), Image.LANCZOS)

    SALIDA_PNG.parent.mkdir(parents=True, exist_ok=True)
    img.save(SALIDA_PNG, "PNG")
    print(f"Icono generado: {SALIDA_PNG}")
    img.save(SALIDA_ICO, "ICO", sizes=TAMANOS_ICO)
    print(f"Icono generado: {SALIDA_ICO}")


if __name__ == "__main__":
    principal()
