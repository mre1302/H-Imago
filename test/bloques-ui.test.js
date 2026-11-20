'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');
const { recolectarReferenciasBloque } = require('../db/bloques-referencias');

function cargarRenderer() {
  const dom = new JSDOM('<!doctype html><html><head></head><body></body></html>', {
    runScripts: 'dangerously',
    url: 'http://localhost/',
  });
  const { window } = dom;
  const datos = {
    persona: [{ id: 1, identificador: 'PE00001', nombre: 'Ana', apellidos: 'Pérez' }],
    institucion: [{ id: 1, identificador: 'IN00001', nombre: 'Cabildo' }],
    lugar: [{ id: 1, identificador: 'LU00001', nombre: 'Sevilla' }],
    patrimonio: [],
  };
  window.api = {
    entidadListarResumen: async (tipo) => ({ ok: true, datos: datos[tipo] || [] }),
  };
  const raiz = path.join(__dirname, '..', 'src', 'js');
  for (const archivo of [
    'comun.js',
    'modulos/taxonomia-relaciones.js',
    'modulos/taxonomia-fuentes.js',
    'modulos/taxonomia-bloques.js',
    'modulos/fecha-historica.js',
    'modulos/formularios-bloques.js',
    'modulos/ajustes-bloques.js',
    'modulos/bloques-registro.js',
  ]) {
    const script = window.document.createElement('script');
    script.textContent = fs.readFileSync(path.join(raiz, archivo), 'utf8');
    window.document.head.appendChild(script);
  }
  return window;
}

test('UI de bloques: PATRIA se muestra, se guarda y se recolecta como lugar', async () => {
  const window = cargarRenderer();
  const esquema = window.FORMULARIOS_BLOQUES['Hojas de servicio'];
  assert.ok(esquema, 'Debe existir el formulario Hojas de servicio');

  const editor = await window.BloquesRegistro.crearEditor(esquema, {}, { proyectoId: 1 });
  const campoPatria = [...editor.elemento.querySelectorAll('.campo')]
    .find((campo) => campo.querySelector('label')?.textContent.trim() === 'PATRIA');
  assert.ok(campoPatria, 'El editor debe renderizar el campo PATRIA');
  const select = campoPatria.querySelector('select');
  select.value = '1';
  select.dispatchEvent(new window.Event('change', { bubbles: true }));
  assert.match(select.selectedOptions[0].textContent, /Sevilla/);

  const datos = editor.obtenerDatos();
  const soldado = datos.personas['p-soldado'][0];
  assert.equal(soldado.patria, '1');
  const ids = { persona: new Set(), institucion: new Set(), lugar: new Set(), patrimonio: new Set() };
  recolectarReferenciasBloque(datos, 'Hojas de servicio', ids);
  assert.ok(ids.lugar.has('1'), 'PATRIA debe incluir el lugar en las referencias del bloque');

  const reabierto = await window.BloquesRegistro.crearEditor(esquema, datos, { proyectoId: 1 });
  const campoReabierto = [...reabierto.elemento.querySelectorAll('.campo')]
    .find((campo) => campo.querySelector('label')?.textContent.trim() === 'PATRIA');
  assert.ok(campoReabierto, 'El campo PATRIA debe seguir presente al reabrir');
  assert.equal(campoReabierto.querySelector('select').value, '1');
});

test('UI de bloques: añadir un grupo repetible marca el editor como cambiado', async () => {
  const window = cargarRenderer();
  const esquema = window.FORMULARIOS_BLOQUES['Inventarios de bienes'];
  let marcados = 0;
  const editor = await window.BloquesRegistro.crearEditor(esquema, {}, {
    proyectoId: 1,
    marcarCambio: () => { marcados++; },
  });
  const boton = [...editor.elemento.querySelectorAll('.grupo-cab .btn-mini')]
    .find((b) => b.textContent.includes('Añadir'));
  assert.ok(boton, 'debe existir el botón de añadir grupo');
  boton.click();
  assert.ok(marcados >= 1, 'la mutación estructural debe avisar al formulario');
});

test('UI de bloques: el título de REGISTRO se extrae para la descripción', () => {
  const window = cargarRenderer();
  const esquema = window.FORMULARIOS_BLOQUES['Actas, acuerdos y resoluciones'];
  assert.equal(
    window.BloquesRegistro.tituloRegistro(esquema, { valores: { f1: 'Acta de prueba' } }),
    'Acta de prueba'
  );
  assert.equal(window.BloquesRegistro.tituloRegistro(esquema, { valores: {} }), '');
  assert.equal(window.BloquesRegistro.tituloRegistro(esquema, {}), '');
});

test('Esquema: SIGNATURA va a la derecha de TÍTULO en REGISTRO de los 25 formularios', () => {
  const window = cargarRenderer();
  const formas = window.FORMULARIOS_BLOQUES;
  assert.ok(Object.keys(formas).length >= 24);
  for (const [nombre, forma] of Object.entries(formas)) {
    let enRegistro = false;
    let primero = null;
    for (const bloque of forma.bloques) {
      if (bloque.tipo === 'seccion') {
        const titulo = String(bloque.titulo || '').trim().toUpperCase();
        if (titulo === 'REGISTRO') enRegistro = true;
        else if (enRegistro) break;
        continue;
      }
      if (enRegistro && bloque.tipo === 'campos' && !primero) primero = bloque;
    }
    assert.ok(primero, `${nombre}: sin campos en REGISTRO`);
    const campos = primero.campos || [];
    const iTitulo = campos.findIndex((c) => c.nombre === 'TÍTULO');
    const iSignatura = campos.findIndex((c) => c.nombre === 'SIGNATURA');
    assert.ok(iTitulo >= 0, `${nombre}: falta TÍTULO`);
    assert.equal(iSignatura, iTitulo + 1, `${nombre}: SIGNATURA debe ir a la derecha de TÍTULO`);
    assert.equal(campos[iTitulo].ancho, 10, `${nombre}: TÍTULO debe ocupar 10 columnas`);
    assert.equal(campos[iSignatura].ancho, 2, `${nombre}: SIGNATURA debe ocupar el ancho de LUGAR (2)`);
  }
});

test('UI de bloques: la descripción incluye TÍTULO y SIGNATURA', () => {
  const window = cargarRenderer();
  const esquema = window.FORMULARIOS_BLOQUES['Actas, acuerdos y resoluciones'];
  const campos = [];
  const recorrer = (bloques) => {
    for (const bloque of bloques || []) {
      if (bloque.tipo === 'campos') campos.push(...(bloque.campos || []));
      if (bloque.bloques) recorrer(bloque.bloques);
    }
  };
  recorrer(esquema.bloques);
  const idTitulo = campos.find((c) => c.nombre === 'TÍTULO').id;
  const idSignatura = campos.find((c) => c.nombre === 'SIGNATURA').id;
  const datos = { valores: { [idTitulo]: 'Acta de fundación', [idSignatura]: 'AHC/leg. 12, cuad. 3' } };
  const salida = window.BloquesRegistro.datosRegistro(esquema, datos);
  assert.equal(salida.titulo, 'Acta de fundación');
  assert.equal(salida.signatura, 'AHC/leg. 12, cuad. 3');
  assert.equal(window.BloquesRegistro.tituloRegistro(esquema, datos), 'Acta de fundación');
  const vacia = window.BloquesRegistro.datosRegistro(esquema, {});
  assert.equal(vacia.titulo, '');
  assert.equal(vacia.signatura, '');
});

test('UI de bloques: rechaza datos que no son un objeto', async () => {
  const window = cargarRenderer();
  const esquema = window.FORMULARIOS_BLOQUES['Actas, acuerdos y resoluciones'];
  await assert.rejects(
    () => window.BloquesRegistro.crearEditor(esquema, [], { proyectoId: 1 }),
    /datos válidos/i
  );
});
