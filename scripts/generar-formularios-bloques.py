#!/usr/bin/env python3
"""Genera src/js/modulos/formularios-bloques.js a partir del ODS de formularios.

Uso: python3 scripts/generar-formularios-bloques.py
El esquema resultante es declarativo: secciones, campos, bloques de personas,
patrimonios y grupos repetibles.

La fuente ODS y el ledger de ids no se distribuyen con el repositorio. Se leen
de HIMAGO_FORMULARIOS_ODS y HIMAGO_FORMULARIOS_IDS, o de
../H-IMAGO-local/docs-interno/ por defecto.

Los ids se toman del libro de campo local (formularios-bloques-ids.json): cada
«formulario::NOMBRE::ocurrencia» conserva su id aunque se reordenen o inserten
campos en el ODS; los nombres nuevos reciben el siguiente id libre del
formulario. La línea REGISTRO se normaliza con TÍTULO (10), SIGNATURA (2) a su
derecha y LUGAR (2).
"""
import json
import os
import re
import sys
import unicodedata
import zipfile
import xml.etree.ElementTree as ET
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
DOCS_SRC = Path(os.environ.get('HIMAGO_FORMULARIOS_DIR', RAIZ.parent / 'H-IMAGO-local' / 'docs-interno'))
ODS = Path(os.environ.get('HIMAGO_FORMULARIOS_ODS', DOCS_SRC / 'formularios-bloques.ods'))
SALIDA = RAIZ / 'src' / 'js' / 'modulos' / 'formularios-bloques.js'
LEDGER = Path(os.environ.get('HIMAGO_FORMULARIOS_IDS', DOCS_SRC / 'formularios-bloques-ids.json'))
NS = '{urn:oasis:names:tc:opendocument:xmlns:table:1.0}'

CATEGORIAS = {
    'Actas, acuerdos y resoluciones': 'Registros institucionales',
    'Comunicaciones': 'Registros institucionales',
    'Leyes, decretos, ordenanzas, reglamentos': 'Registros institucionales',
    'Elecciones': 'Registros institucionales',
    'Hojas de servicio': 'Registros institucionales',
    'Nombramientos y designaciones': 'Registros institucionales',
    'Títulos': 'Registros institucionales',
    'Arriendo': 'Registros notariales',
    'Compra/Venta': 'Registros notariales',
    'Diezmos': 'Registros notariales',
    'Donación': 'Registros notariales',
    'Fianza': 'Registros notariales',
    'Hipoteca': 'Registros notariales',
    'Inventarios de bienes': 'Registros notariales',
    'Legados testamentarios': 'Registros notariales',
    'Obligación': 'Registros notariales',
    'Poder': 'Registros notariales',
    'Procesos judiciales': 'Registros judiciales',
    'Testamentos': 'Registros notariales',
    'Cuenta personal': 'Registros personales y narrativos',
    'Epístolas': 'Registros personales y narrativos',
    'Actas de bautismo': 'Registros vitales',
    'Actas de defunción': 'Registros vitales',
    'Actas de matrimonio': 'Registros vitales',
}

def slug(texto):
    t = unicodedata.normalize('NFD', texto).encode('ascii', 'ignore').decode()
    t = re.sub(r'[^a-zA-Z0-9]+', '_', t).strip('_').lower()
    return t or 'x'

def leer_filas():
    with zipfile.ZipFile(ODS) as z:
        raiz = ET.fromstring(z.read('content.xml'))
    tabla = next(raiz.iter(NS + 'table'))
    filas = []
    for fila in tabla.iter(NS + 'table-row'):
        celdas = []
        for cel in fila:
            if cel.tag.split('}')[-1] not in ('table-cell', 'covered-table-cell'):
                continue
            repeticiones = int(cel.get(NS + 'number-columns-repeated', '1'))
            if repeticiones > 1000:
                continue
            texto = ''.join(t.text or '' for t in cel.iter() if t.tag.split('}')[-1] == 'p')
            celdas.extend([texto] * repeticiones)
        while celdas and celdas[-1] == '':
            celdas.pop()
        if celdas:
            filas.append(celdas)
    return filas

def clasificar_campo(texto):
    """Devuelve definición de campo desde «[campo] NOMBRE [pista]»."""
    resto = re.sub(r'^\[campo\]\s*', '', texto).strip()
    tipo = 'texto'
    opciones = None
    pista = ''
    m = re.search(r'\[listado:\s*([^\]]+)\]', resto)
    if m:
        tipo = 'select'
        opciones = [o.strip() for o in m.group(1).split(',') if o.strip()]
        resto = resto[:m.start()].strip()
    elif '[listado de LUGARES]' in resto:
        tipo = 'lugar'; resto = resto.replace('[listado de LUGARES]', '').strip()
    elif '[listado de INSTITUCIONES]' in resto:
        tipo = 'institucion'; resto = resto.replace('[listado de INSTITUCIONES]', '').strip()
    elif '[seleccionar tipos de PATRIMONIOS]' in resto:
        tipo = 'tipo_patrimonio'; resto = resto.replace('[seleccionar tipos de PATRIMONIOS]', '').strip()
    elif '[calendario]' in resto:
        tipo = 'fecha'; resto = resto.replace('[calendario]', '').strip()
    elif '[año]' in resto or '[AÑO]' in resto:
        tipo = 'anio'; resto = re.sub(r'\[(año|AÑO)\]', '', resto).strip()
    nombre = re.sub(r'\s+', ' ', resto).strip().upper()
    if nombre in ('NOTAS', 'MATERIA'):
        tipo = 'area'
    return {'nombre': nombre, 'tipo': tipo, 'opciones': opciones, 'pista': pista}

def cargar_ledger():
    if LEDGER.exists():
        try:
            datos = json.loads(LEDGER.read_text(encoding='utf-8'))
            if isinstance(datos, dict):
                return datos
        except Exception as err:
            print(f'aviso: no se pudo leer {LEDGER.name} ({err}); se asignaran ids nuevos', file=sys.stderr)
    return {}


ID_FORMULARIO = re.compile(r'^f(\d+)$')


def _maximo_id(forma, ledger, nuevos):
    maximo = 0
    prefijo = f'{forma}::'
    for origen in (ledger, nuevos):
        for clave, valor in origen.items():
            if not str(clave).startswith(prefijo):
                continue
            m = ID_FORMULARIO.fullmatch(str(valor))
            if m:
                maximo = max(maximo, int(m.group(1)))
    return maximo


def id_campo(forma, nombre, ledger, estado):
    """Id estable por «formulario::NOMBRE::ocurrencia»: reordenar o insertar
    campos en el ODS no desplaza los ids de los datos ya guardados."""
    posicion = estado['pos']
    k = posicion.get(nombre, 0)
    posicion[nombre] = k + 1
    clave = f'{forma}::{nombre}::{k}'
    asignado = estado['nuevos'].get(clave, ledger.get(clave))
    if asignado and isinstance(asignado, str) and ID_FORMULARIO.fullmatch(asignado):
        return str(asignado)
    nuevo = f'f{_maximo_id(forma, ledger, estado["nuevos"]) + 1}'
    estado['nuevos'][clave] = nuevo
    return nuevo


def es_inicio_persona(linea):
    texto = ' '.join(linea)
    return 'TRATAMIENTO/TÍTULO' in texto and 'NOMBRES' in texto and 'APELLIDOS' in texto

def es_linea_empleo(linea):
    texto = ' '.join(linea)
    return 'EMPLEO/OFICIO' in texto and 'INSTITUCIÓN' in texto

def es_linea_vinculo(linea):
    return any('VINCULAR PERSONA' in e for e in linea)

def es_vinculo_patrimonio(linea):
    return any('VINCULAR PATRIMONIO' in e for e in linea)

def buscar_vinculo(lines, desde, limite=5):
    for j in range(desde, min(desde + limite, len(lines))):
        if es_linea_vinculo(lines[j]):
            return j
    return -1

def buscar_vinculo_patrimonio(lines, desde, limite=5):
    for j in range(desde, min(desde + limite, len(lines))):
        if es_vinculo_patrimonio(lines[j]):
            return j
    return -1

def construir(lines, forma, ledger, estado):
    bloques = []
    contador = {'f': 0, 'p': 0, 'g': 0}
    i = 0
    while i < len(lines):
        linea = lines[i]
        texto0 = linea[0] if linea else ''
        m_sec = re.match(r'\[(sección|subsección|susección)\]\s*(.*)', texto0)
        if m_sec:
            tipo = 'seccion' if m_sec.group(1) == 'sección' else 'subseccion'
            nombre = m_sec.group(2).strip().upper()
            # ¿bloque de personas? (permite una línea extra de empleo antes de VINCULAR)
            if i + 1 < len(lines) and es_inicio_persona(lines[i + 1]):
                j = buscar_vinculo(lines, i + 2)
                if j >= 0:
                    contador['p'] += 1
                    bloques.append({'tipo': 'personas', 'id': f"p{contador['p']}", 'titulo': nombre, 'nivel': tipo})
                    i = j + 1
                    continue
            # ¿bloque de patrimonios (HIPOTECA)?
            if i + 1 < len(lines) and any('[campo]' in e and 'NOMBRE' in e for e in lines[i + 1]) and any('VALOR/TASACIÓN' in e for e in lines[i + 1]):
                j = buscar_vinculo_patrimonio(lines, i + 2)
                if j >= 0:
                    contador['p'] += 1
                    bloques.append({'tipo': 'patrimonios', 'id': f"p{contador['p']}", 'titulo': nombre, 'nivel': tipo})
                    i = j + 1
                    continue
            # ¿grupo repetible?
            if any('agrega nueva subsección' in e for e in (lines[i + 1] if i + 1 < len(lines) else [])):
                contador['g'] += 1
                gid = f"g{contador['g']}"
                hijos, consumidas = construir_grupo(lines, i + 1, gid, contador, forma, ledger, estado)
                bloques.append({'tipo': 'grupo', 'id': gid, 'titulo': nombre, 'repetible': True, 'bloques': hijos})
                i += consumidas
                continue
            bloques.append({'tipo': tipo, 'titulo': nombre})
            i += 1
            continue
        if '[sección y campo NOTAS]' in texto0:
            bloques.append({'tipo': 'campos', 'campos': [
                {'id': id_campo(forma, 'NOTAS', ledger, estado), 'nombre': 'NOTAS', 'tipo': 'area'}]})
            i += 1
            continue
        # línea de campos
        campos = []
        for elt in linea:
            if elt.startswith('[campo]'):
                campos.append(clasificar_campo(elt))
        if campos:
            # renombrar antes de asignar ids, para que las claves del ledger
            # usen el nombre final y coincidan con el esquema ya generado
            anterior = ''
            for campo in campos:
                if campo['nombre'] == 'FECHA EXACTA' and anterior in ('DESDE', 'HASTA', 'AÑO DE NACIMIENTO', 'AÑO DE DEFUNCIÓN', 'AÑO DE PUBLICACIÓN'):
                    campo['nombre'] = f'FECHA EXACTA ({anterior.lower()})'
                anterior = campo['nombre']
            for campo in campos:
                campo['id'] = id_campo(forma, campo['nombre'], ledger, estado)
            bloques.append({'tipo': 'campos', 'campos': campos})
        i += 1
    return bloques

def construir_grupo(lines, desde, gid, contador, forma, ledger, estado):
    """Grupo repetible: consume hasta la siguiente sección de nivel superior."""
    hijos = []
    i = desde
    # Saltar la línea de botones «agrega nueva subsección»
    if i < len(lines) and any('agrega nueva subsección' in e for e in lines[i]):
        i += 1
    while i < len(lines):
        linea = lines[i]
        if any(re.match(r'\[(sección)\]\s*', e or '') for e in linea):
            break
        texto0 = linea[0] if linea else ''
        m_sec = re.match(r'\[(subsección|susección)\]\s*(.*)', texto0)
        if m_sec:
            nombre = m_sec.group(2).strip().upper()
            if i + 3 < len(lines) and es_inicio_persona(lines[i + 1]) and es_linea_empleo(lines[i + 2]) and es_linea_vinculo(lines[i + 3]):
                contador['p'] += 1
                hijos.append({'tipo': 'personas', 'id': f"p{contador['p']}", 'titulo': nombre, 'nivel': 'subseccion'})
                i += 4
                continue
            hijos.append({'tipo': 'subseccion', 'titulo': nombre})
            i += 1
            continue
        campos = []
        for elt in linea:
            if elt.startswith('[campo]'):
                definicion = clasificar_campo(elt)
                definicion['id'] = id_campo(forma, definicion['nombre'], ledger, estado)
                campos.append(definicion)
        if campos:
            hijos.append({'tipo': 'campos', 'campos': campos})
        i += 1
    return hijos, i - desde

def _normalizar(nombre):
    return str(nombre or '').strip().upper()


def primer_campos_registro(bloques):
    en_registro = False
    for bloque in bloques or []:
        if bloque.get('tipo') == 'seccion':
            titulo = _normalizar(bloque.get('titulo', ''))
            if titulo == 'REGISTRO':
                en_registro = True
                continue
            if en_registro:
                break
            continue
        if en_registro and bloque.get('tipo') == 'campos':
            return bloque
    return None


def fijar_anchos_y_validar(formularios, ledger, nuevos):
    """SIGNATURA va a la derecha de TÍTULO, con el ancho de LUGAR (2), y
    TÍTULO ocupa 10 columnas. Se normaliza la posición y se valida."""
    problemas = []
    for forma, datos in formularios.items():
        primero = primer_campos_registro(datos.get('bloques', []))
        if primero is None:
            problemas.append(f'{forma}: REGISTRO sin línea de campos')
            continue
        campos = primero.setdefault('campos', [])
        nombres = [_normalizar(c.get('nombre')) for c in campos]
        i_titulo = next((i for i, n in enumerate(nombres) if n in ('TÍTULO', 'TITULO')), None)
        if i_titulo is None:
            problemas.append(f'{forma}: no aparece TÍTULO en REGISTRO')
            continue

        if 'SIGNATURA' not in nombres:
            maximo = _maximo_id(forma, ledger, nuevos)
            campos.insert(i_titulo + 1, {
                'nombre': 'SIGNATURA', 'tipo': 'texto', 'opciones': None,
                'pista': '', 'id': f'f{maximo + 1}', 'ancho': 2,
            })
            print(f'aviso: {forma}: SIGNATURA no estaba en el ODS; se insertó en el esquema', file=sys.stderr)
            nombres = [_normalizar(c.get('nombre')) for c in campos]

        i_signatura = next(i for i, n in enumerate(nombres) if n == 'SIGNATURA')
        if i_signatura != i_titulo + 1:
            campo = campos.pop(i_signatura)
            i_titulo = next(i for i, n in enumerate(_normalizar(c.get('nombre')) for c in campos)
                            if n in ('TÍTULO', 'TITULO'))
            campos.insert(i_titulo + 1, campo)
            nombres = [_normalizar(c.get('nombre')) for c in campos]

        for campo in campos:
            n = _normalizar(campo.get('nombre'))
            if n in ('TÍTULO', 'TITULO'):
                campo['ancho'] = 10
            elif n == 'SIGNATURA':
                campo['ancho'] = 2
            elif n == 'LUGAR':
                campo['ancho'] = 2
            elif n in ('INSTITUCIÓN', 'INSTITUCION', 'PARROQUIA'):
                campo.setdefault('ancho', 4)

        nombres = [_normalizar(c.get('nombre')) for c in campos]
        i_titulo = next(i for i, n in enumerate(nombres) if n in ('TÍTULO', 'TITULO'))
        i_signatura = next(i for i, n in enumerate(nombres) if n == 'SIGNATURA')
        if i_signatura != i_titulo + 1:
            problemas.append(f'{forma}: SIGNATURA no quedó a la derecha de TÍTULO')

    if problemas:
        for mensaje in problemas:
            print(f'error: {mensaje}', file=sys.stderr)
        raise SystemExit(1)


def main():
    if not ODS.exists():
        sys.exit(f'No se encuentra el ODS de formularios: {ODS}\nIndica la ruta con HIMAGO_FORMULARIOS_ODS o colócalo en {DOCS_SRC}.')
    if not LEDGER.exists():
        sys.exit(f'No se encuentra el ledger de formularios: {LEDGER}\nIndica la ruta con HIMAGO_FORMULARIOS_IDS o colócalo en {DOCS_SRC}.')
    filas = leer_filas()
    ledger = cargar_ledger()
    formularios = {}
    actual = None
    lineas_actual = []
    estado = {'pos': {}, 'nuevos': {}}
    def volcar():
        if actual and lineas_actual:
            estado['pos'] = {}
            formularios[actual] = {
                'titulo': actual,
                'categoria': CATEGORIAS.get(actual, ''),
                'bloques': construir(lineas_actual, actual, ledger, estado),
            }
    for celdas in filas:
        if len(celdas) > 1 and celdas[1].strip().upper() == 'FORMULARIO' and celdas[0].strip():
            volcar()
            actual = celdas[0].strip()
            lineas_actual = []
        elementos = celdas[3:] if len(celdas) > 3 else []
        elementos = [e.strip() for e in elementos if e.strip()]
        if actual and elementos:
            lineas_actual.append(elementos)
    volcar()
    fijar_anchos_y_validar(formularios, ledger, estado['nuevos'])
    if estado['nuevos']:
        ledger.update(estado['nuevos'])
    LEDGER.write_text(json.dumps(ledger, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')

    js = ["'use strict';", '', '/* H-IMAGO · Esquema declarativo de los BLOQUES DE REGISTRO',
          '   Generado desde la fuente local de formularios (no distribuida; no editar a mano).',
          '   Cada formulario declara secciones, campos, bloques de personas,',
          '   patrimonios y grupos repetibles. */', '',
          'const FORMULARIOS_BLOQUES = ' + json.dumps(formularios, ensure_ascii=False, indent=2) + ';', '',
          'window.FORMULARIOS_BLOQUES = FORMULARIOS_BLOQUES;', '']
    SALIDA.write_text('\n'.join(js), encoding='utf-8')
    print(f'Formularios generados: {len(formularios)}')
    for nombre, datos in formularios.items():
        print(f'  {nombre}: {len(datos["bloques"])} bloques · {datos["categoria"]}')

if __name__ == '__main__':
    main()
