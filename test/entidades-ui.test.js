'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');

function cargarEntidades(overrides = {}) {
  const dom = new JSDOM(`<!doctype html><html><body>
    <div id="contenido"></div><div id="capa-modales"></div><div id="avisos"></div>
    <div id="zona-impresion"></div>
  </body></html>`, { runScripts: 'dangerously', url: 'http://localhost/', pretendToBeVisual: true });
  const { window } = dom;
  const datos = {
    persona: [{ id: 1, identificador: 'PE00001', nombre: 'Ana', apellidos: 'Pérez', alias: '', genero: 'Femenino', anio_nacimiento: 1500, anio_defuncion: 1560, lugar_nacimiento: 'Sevilla', tratamiento: '', ocupacion: 'Escribana', notas: 'Nota', institucion_id: 1, fecha_exacta_nacimiento: '', fecha_exacta_nacimiento_meta: '', fecha_exacta_defuncion: '', fecha_exacta_defuncion_meta: '', lugar_defuncion: '' },
      { id: 2, identificador: 'PE00002', nombre: 'Bernardo', apellidos: 'Gil', alias: '', genero: 'Masculino', anio_nacimiento: 1490, anio_defuncion: 1550, lugar_nacimiento: 'Sevilla', tratamiento: '', ocupacion: '', notas: '', institucion_id: '', fecha_exacta_nacimiento: '', fecha_exacta_nacimiento_meta: '', fecha_exacta_defuncion: '', fecha_exacta_defuncion_meta: '', lugar_defuncion: '' }],
    institucion: [
      { id: 1, identificador: 'IN00001', nombre: 'Cabildo' },
      { id: 2, identificador: 'IN00002', nombre: 'Consejo' },
    ],
    lugar: [{ id: 1, identificador: 'LU00001', nombre: 'Sevilla' }],
    patrimonio: [{ id: 1, identificador: 'PA00001', nombre: 'Casa' }],
    fuente: [{ id: 1, titulo: 'Fuente' }],
  };
  const ok = (valor) => Promise.resolve({ ok: true, datos: valor });
  window.api = {
    entidadListarResumen: async (tipo) => ok(datos[tipo] || []),
    entidadListar: async (tipo) => ok(datos[tipo] || []),
    entidadObtener: async (tipo, id) => ok((datos[tipo] || []).find((x) => x.id === id)),
    entidadCrear: async (tipo, p, d) => ok({ id: 99, identificador: 'X', ...d }),
    entidadActualizar: async (tipo, id, d) => ok({ ...(datos[tipo] || []).find((x) => x.id === id), ...d, id }),
    entidadEliminar: async () => ok(true),
    entidadFusionar: async () => ok({ id: 1 }),
    relacionListarDeEntidad: async () => ok([]),
    relacionCrear: async () => ok(1),
    relacionActualizar: async () => ok(true),
    relacionEliminar: async () => ok(true),
    coincidenciaListar: async () => ok([]),
    coincidenciaCrear: async () => ok(1),
    coincidenciaEliminar: async () => ok(true),
    cuadernoListar: async () => ok([]),
    cuadernoObtener: async (id) => ok({ id, contenido: '', fojas: [] }),
    cuadernoCrear: async () => ok({ id: 1, fojas: [] }),
    cuadernoActualizar: async () => ok(true),
    cuadernoEliminar: async () => ok(true),
    bloqueListar: async () => ok([]),
    bloqueObtener: async (id) => ok({ id, datos: {} }),
    bloqueCrear: async () => ok({ id: 1 }),
    bloqueActualizar: async () => ok(true),
    bloqueEliminar: async () => ok(true),
    bloqueExportar: async () => ok({}),
    bloqueImportar: async () => ok({}),
  };
  Object.assign(window.api, overrides);
  const raiz = path.join(__dirname, '..', 'src', 'js');
  for (const archivo of ['comun.js', 'modulos/taxonomia-relaciones.js', 'modulos/taxonomia-fuentes.js', 'modulos/taxonomia-bloques.js', 'modulos/fecha-historica.js', 'modulos/entidades.js']) {
    const script = window.document.createElement('script');
    script.textContent = fs.readFileSync(path.join(raiz, archivo), 'utf8');
    window.document.head.appendChild(script);
  }
  return window;
}

test('UI de entidades: + Nueva pide confirmación antes de descartar una ficha editada', async () => {
  const window = cargarEntidades();
  const cont = window.document.getElementById('contenido');
  await window.MODULOS.persona.montar(cont, { id: 1, nombre: 'Proyecto' }, {});
  const itemAna = [...cont.querySelectorAll('.ent-item')]
    .find((it) => it.querySelector('.ent-item-titulo')?.textContent === 'Ana Pérez');
  assert.ok(itemAna);
  itemAna.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  await new Promise((r) => setTimeout(r, 80));
  assert.equal(cont.querySelector('.detalle-titulo').textContent, 'Ana Pérez');

  const nombre = cont.querySelector('.campos-grid input');
  nombre.value = 'Editado sin guardar';
  nombre.dispatchEvent(new window.Event('input', { bubbles: true }));
  cont.querySelector('.ent-barra .btn-primario').dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  await new Promise((r) => setTimeout(r, 30));

  const modal = window.document.querySelector('.modal');
  assert.ok(modal, 'debe aparecer el diálogo de confirmación');
  assert.equal(cont.querySelector('.detalle-titulo').textContent, 'Ana Pérez');
  const cancelar = [...modal.querySelectorAll('.modal-acciones .btn')].find((b) => b.textContent === 'Cancelar');
  cancelar.click();
  await new Promise((r) => setTimeout(r, 20));
  assert.equal(window.document.querySelector('.modal'), null);
  assert.equal(cont.querySelector('.detalle-titulo').textContent, 'Ana Pérez');
  window.MODULOS.persona.desmontar();
});

test('UI de entidades: añadir una relación no borra el estado sucio de la ficha', async () => {
  const window = cargarEntidades();
  const cont = window.document.getElementById('contenido');
  await window.MODULOS.persona.montar(cont, { id: 1, nombre: 'Proyecto' }, {});
  const itemAna = [...cont.querySelectorAll('.ent-item')]
    .find((it) => it.querySelector('.ent-item-titulo')?.textContent === 'Ana Pérez');
  assert.ok(itemAna);
  itemAna.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  await new Promise((r) => setTimeout(r, 60));

  const nombre = cont.querySelector('.campos-grid input');
  nombre.value = 'Ana editada';
  nombre.dispatchEvent(new window.Event('input', { bubbles: true }));

  const selects = [...cont.querySelectorAll('.form-relacion select')];
  const selEntidad = selects[1];
  const selVocab = selects[2];
  selEntidad.value = '2';
  selVocab.value = 'Miembro';
  const btnAnadir = [...cont.querySelectorAll('.form-relacion button')]
    .find((b) => b.textContent === 'Añadir relación');
  btnAnadir.click();
  await new Promise((r) => setTimeout(r, 60));

  assert.equal(window.MODULOS.persona.hayCambios(), true, 'los cambios de la ficha siguen pendientes');
  window.MODULOS.persona.desmontar();
});

test('UI de entidades: un cuaderno objetivo se abre al llegar desde la búsqueda', async () => {
  const window = cargarEntidades({
    cuadernoListar: async () => ({
      ok: true,
      datos: [
        { id: 10, fuente_id: 1, posicion: 0, contenido: 'Primer cuaderno', fojas: [] },
        { id: 11, fuente_id: 1, posicion: 1, contenido: 'Segundo cuaderno', fojas: [] },
      ],
    }),
  });
  const cont = window.document.getElementById('contenido');
  await window.MODULOS.fuente.montar(cont, { id: 1, nombre: 'Proyecto' }, {
    seleccionar: { tipo: 'fuente', id: 1 },
    cuadernoId: 11,
  });
  await new Promise((r) => setTimeout(r, 160));

  const cuadernos = [...cont.querySelectorAll('.cuaderno')];
  assert.equal(cuadernos.length, 2);
  assert.equal(cuadernos[0].classList.contains('en-edicion'), false);
  assert.equal(cuadernos[1].classList.contains('en-edicion'), true);
  assert.equal(cuadernos[1].querySelector('textarea').readOnly, false);
  window.MODULOS.fuente.desmontar();
});

test('UI de relaciones: el origen persona limita los tipos y ajusta el destino', async () => {
  const window = cargarEntidades();
  const cont = window.document.getElementById('contenido');
  await window.MODULOS.persona.montar(cont, { id: 1, nombre: 'Proyecto' }, {});
  const itemAna = [...cont.querySelectorAll('.ent-item')]
    .find((it) => it.querySelector('.ent-item-titulo')?.textContent === 'Ana Pérez');
  itemAna.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  await new Promise((r) => setTimeout(r, 80));

  const [selTipo, , selVocab] = [...cont.querySelectorAll('.form-relacion select')];
  const tipos = [...selVocab.options].map((o) => o.value);
  assert.ok(tipos.includes('Señor – Súbdito'));
  assert.ok(tipos.includes('Hermanos'));
  assert.ok(tipos.includes('Propietario'));
  assert.ok(!tipos.includes('Sede'));
  assert.ok(!tipos.includes('Adscripción'));
  assert.ok(!tipos.includes('Jurisdicción'));

  selVocab.value = 'Vecino';
  selVocab.dispatchEvent(new window.Event('change', { bubbles: true }));
  assert.deepEqual([...selTipo.options].map((o) => o.value), ['lugar']);

  selVocab.value = 'Propietario';
  selVocab.dispatchEvent(new window.Event('change', { bubbles: true }));
  assert.deepEqual([...selTipo.options].map((o) => o.value), ['patrimonio']);
  window.MODULOS.persona.desmontar();
});

test('UI de relaciones: elegir el tipo de relación conserva la entidad destino', async () => {
  let creada = null;
  const window = cargarEntidades({
    relacionCrear: async (datos) => { creada = datos; return { ok: true, datos: 1 }; },
  });
  const cont = window.document.getElementById('contenido');
  await window.MODULOS.persona.montar(cont, { id: 1, nombre: 'Proyecto' }, {});
  const itemAna = [...cont.querySelectorAll('.ent-item')]
    .find((it) => it.querySelector('.ent-item-titulo')?.textContent === 'Ana Pérez');
  itemAna.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  await new Promise((r) => setTimeout(r, 80));

  const [selTipo, selEntidad, selVocab] = [...cont.querySelectorAll('.form-relacion select')];
  selTipo.value = 'institucion';
  selTipo.dispatchEvent(new window.Event('change', { bubbles: true }));
  assert.deepEqual([...selEntidad.options].map((o) => o.value), ['1', '2']);
  selEntidad.value = '2';

  selVocab.value = 'Miembro';
  selVocab.dispatchEvent(new window.Event('change', { bubbles: true }));
  assert.equal(selTipo.value, 'institucion');
  assert.equal(selEntidad.value, '2');

  const btnAnadir = [...cont.querySelectorAll('.form-relacion-botones button')]
    .find((b) => b.textContent === 'Añadir relación');
  btnAnadir.click();
  await new Promise((r) => setTimeout(r, 40));
  assert.ok(creada);
  assert.equal(creada.destino_tipo, 'institucion');
  assert.equal(creada.destino_id, 2);
  window.MODULOS.persona.desmontar();
});

test('UI de relaciones: se puede cambiar el otro extremo al editar', async () => {
  let actualizada = null;
  const relacion = {
    id: 50,
    origen_tipo: 'persona',
    origen_id: 1,
    destino_tipo: 'institucion',
    destino_id: 1,
    tipo: 'Miembro',
    procedencia: 'MANUAL',
    origen_nombre: 'Ana Pérez',
    destino_nombre: 'Cabildo',
    anio_inicio: 1500,
    fecha_exacta_inicio: '',
    anio_fin: null,
    fecha_exacta_fin: '',
    lugar_inicio: null,
    lugar_fin: null,
    notas: '',
    fuentes: [],
  };
  const window = cargarEntidades({
    relacionListarDeEntidad: async () => ({ ok: true, datos: [relacion] }),
    relacionActualizar: async (id, datos) => {
      actualizada = { id, datos };
      return { ok: true, datos: true };
    },
  });
  const cont = window.document.getElementById('contenido');
  await window.MODULOS.persona.montar(cont, { id: 1, nombre: 'Proyecto' }, {});
  const itemAna = [...cont.querySelectorAll('.ent-item')]
    .find((it) => it.querySelector('.ent-item-titulo')?.textContent === 'Ana Pérez');
  itemAna.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  await new Promise((r) => setTimeout(r, 80));

  const itemRelacion = cont.querySelector('.relacion-item');
  assert.ok(itemRelacion);
  itemRelacion.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  await new Promise((r) => setTimeout(r, 40));

  const [selTipo, selEntidad, selVocab] = [...cont.querySelectorAll('.form-relacion select')];
  assert.equal(selTipo.disabled, false);
  assert.equal(selEntidad.disabled, false);
  assert.equal(selTipo.value, 'institucion');
  assert.equal(selEntidad.value, '1');

  selTipo.value = 'lugar';
  selTipo.dispatchEvent(new window.Event('change', { bubbles: true }));
  selEntidad.value = '1';
  selVocab.value = 'Vecino';
  selVocab.dispatchEvent(new window.Event('change', { bubbles: true }));

  const btnGuardar = [...cont.querySelectorAll('.form-relacion-botones button')]
    .find((b) => b.textContent === 'Guardar relación');
  btnGuardar.click();
  await new Promise((r) => setTimeout(r, 40));

  assert.ok(actualizada);
  assert.equal(actualizada.datos.origen_tipo, 'persona');
  assert.equal(actualizada.datos.origen_id, 1);
  assert.equal(actualizada.datos.destino_tipo, 'lugar');
  assert.equal(actualizada.datos.destino_id, 1);
  assert.equal(actualizada.datos.tipo, 'Vecino');
  window.MODULOS.persona.desmontar();
});

test('UI de relaciones: el origen lugar solo ofrece Sede y destinos institucionales', async () => {
  const window = cargarEntidades();
  const cont = window.document.getElementById('contenido');
  await window.MODULOS.lugar.montar(cont, { id: 1, nombre: 'Proyecto' }, {});
  const item = cont.querySelector('.ent-item');
  item.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  await new Promise((r) => setTimeout(r, 80));

  const [selTipo, , selVocab] = [...cont.querySelectorAll('.form-relacion select')];
  const tipos = [...selVocab.options].map((o) => o.value);
  assert.ok(tipos.includes('Sede'));
  assert.ok(!tipos.includes('Hermanos'));
  assert.ok(!tipos.includes('Miembro'));

  selVocab.value = 'Sede';
  selVocab.dispatchEvent(new window.Event('change', { bubbles: true }));
  assert.deepEqual([...selTipo.options].map((o) => o.value), ['institucion', 'patrimonio']);
  assert.match(cont.querySelector('.form-relacion-pista').textContent, /origen Lugar → destino Institución o Patrimonio/);
  window.MODULOS.lugar.desmontar();
});

test('UI de relaciones: Patrimonio puede originar compras, proveeduría y retención', async () => {
  const window = cargarEntidades();
  const cont = window.document.getElementById('contenido');
  await window.MODULOS.patrimonio.montar(cont, { id: 1, nombre: 'Proyecto' }, {});
  const item = cont.querySelector('.ent-item');
  item.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  await new Promise((r) => setTimeout(r, 80));

  const [selTipo, , selVocab] = [...cont.querySelectorAll('.form-relacion select')];
  const tipos = [...selVocab.options].map((o) => o.value).filter(Boolean);
  assert.ok(tipos.includes('Apresado/retenido'));
  assert.ok(tipos.includes('Comprador – Vendedor'));
  assert.ok(tipos.includes('Proveedor – Receptador'));
  assert.ok(!tipos.includes('Financista/Inversor'));
  assert.ok(tipos.includes('__otro__'));
  assert.match(cont.querySelector('.form-relacion-pista').textContent, /Elige un tipo de relación/);

  selVocab.value = 'Apresado/retenido';
  selVocab.dispatchEvent(new window.Event('change', { bubbles: true }));
  assert.deepEqual([...selTipo.options].map((o) => o.value), ['persona', 'institucion', 'patrimonio']);
  assert.match(
    cont.querySelector('.form-relacion-pista').textContent,
    /origen Patrimonio → destino Persona o Institución o Patrimonio/
  );
  window.MODULOS.patrimonio.desmontar();
});

test('UI de relaciones: el origen institución permite Adscripción y Propietario', async () => {
  const window = cargarEntidades();
  const cont = window.document.getElementById('contenido');
  await window.MODULOS.institucion.montar(cont, { id: 1, nombre: 'Proyecto' }, {});
  const item = cont.querySelector('.ent-item');
  item.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  await new Promise((r) => setTimeout(r, 80));

  const [selTipo, , selVocab] = [...cont.querySelectorAll('.form-relacion select')];
  const tipos = [...selVocab.options].map((o) => o.value);
  assert.ok(tipos.includes('Adscripción'));
  assert.ok(tipos.includes('Jurisdicción'));
  assert.ok(tipos.includes('Propietario'));
  assert.ok(!tipos.includes('Miembro'));
  assert.ok(!tipos.includes('Hermanos'));

  selVocab.value = 'Adscripción';
  selVocab.dispatchEvent(new window.Event('change', { bubbles: true }));
  assert.deepEqual([...selTipo.options].map((o) => o.value), ['institucion']);

  selVocab.value = 'Jurisdicción';
  selVocab.dispatchEvent(new window.Event('change', { bubbles: true }));
  assert.deepEqual([...selTipo.options].map((o) => o.value), ['lugar', 'patrimonio']);

  selVocab.value = 'Propietario';
  selVocab.dispatchEvent(new window.Event('change', { bubbles: true }));
  assert.deepEqual([...selTipo.options].map((o) => o.value), ['patrimonio']);
  window.MODULOS.institucion.desmontar();
});

test('UI de relaciones: una relación heredada fuera de la taxonomía se marca con aviso', async () => {
  const window = cargarEntidades({
    relacionListarDeEntidad: async () => ({
      ok: true,
      datos: [{
        id: 99,
        origen_tipo: 'persona',
        origen_id: 1,
        destino_tipo: 'institucion',
        destino_id: 1,
        tipo: 'Hermanos',
        origen_nombre: 'Ana Pérez',
        destino_nombre: 'Cabildo',
        procedencia: 'MANUAL',
        fuentes: [],
      }],
    }),
  });
  const cont = window.document.getElementById('contenido');
  await window.MODULOS.persona.montar(cont, { id: 1, nombre: 'Proyecto' }, {});
  const item = [...cont.querySelectorAll('.ent-item')]
    .find((it) => it.querySelector('.ent-item-titulo')?.textContent === 'Ana Pérez');
  item.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  await new Promise((r) => setTimeout(r, 80));

  const relacion = cont.querySelector('.relacion-item');
  assert.ok(relacion.classList.contains('relacion-fuera-taxonomia'));
  assert.ok(relacion.querySelector('.rel-aviso'));
  assert.match(relacion.querySelector('.relacion-tipo-texto').textContent, /↔/);

  relacion.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  await new Promise((r) => setTimeout(r, 20));
  const selVocab = cont.querySelectorAll('.form-relacion select')[2];
  assert.equal(selVocab.value, 'Hermanos');
  assert.ok([...selVocab.options].some((o) => o.value === 'Hermanos' && o.textContent.startsWith('⚠')));
  assert.match(cont.querySelector('.form-relacion-pista').textContent, /no cumple esta restricción/);
  window.MODULOS.persona.desmontar();
});

test('Fecha histórica: la precisión aproximada sobrevive al formateo', () => {
  const window = cargarEntidades();
  const meta = { sistema: '', precision: 'aproximada', anio: 1520, mes: null, dia: null };
  const texto = window.FechaHistorica.formatear(meta);
  assert.equal(texto, 'c. 1520');
  assert.equal(window.FechaHistorica.parsear(texto).precision, 'aproximada');
});

test('UI de entidades: un cuaderno guardado se puede editar', async () => {
  const window = cargarEntidades({
    cuadernoListar: async () => ({
      ok: true,
      datos: [{ id: 10, fuente_id: 1, posicion: 0, contenido: 'Texto guardado', fojas: [] }],
    }),
  });
  const cont = window.document.getElementById('contenido');
  await window.MODULOS.fuente.montar(cont, { id: 1, nombre: 'Proyecto' }, {
    seleccionar: { tipo: 'fuente', id: 1 },
  });
  await new Promise((r) => setTimeout(r, 80));
  const tarjeta = cont.querySelector('.cuaderno');
  assert.ok(tarjeta);
  assert.equal(tarjeta.querySelector('textarea').readOnly, true);
  const btnEditar = [...tarjeta.querySelectorAll('.cuaderno-acciones .btn')]
    .find((b) => b.textContent === 'EDITAR');
  btnEditar.click();
  assert.equal(tarjeta.querySelector('textarea').readOnly, false, 'EDITAR debe permitir escribir');
  window.MODULOS.fuente.desmontar();
});

test('UI de entidades: un cuaderno resumen carga la transcripción bajo demanda', async () => {
  let obtenidos = 0;
  const window = cargarEntidades({
    cuadernoListar: async () => ({
      ok: true,
      datos: [{ id: 10, fuente_id: 1, posicion: 0, fojas: [], _resumen: true }],
    }),
    cuadernoObtener: async (id) => {
      obtenidos++;
      return { ok: true, datos: { id, contenido: 'Texto completo', fojas: [] } };
    },
  });
  const cont = window.document.getElementById('contenido');
  await window.MODULOS.fuente.montar(cont, { id: 1, nombre: 'Proyecto' }, {
    seleccionar: { tipo: 'fuente', id: 1 },
  });
  await new Promise((r) => setTimeout(r, 80));
  const tarjeta = cont.querySelector('.cuaderno');
  const area = tarjeta.querySelector('textarea');
  assert.equal(obtenidos, 0, 'el listado no debe traer la transcripción completa');
  assert.equal(area.value, '');
  assert.equal(area.readOnly, true);
  const btnEditar = [...tarjeta.querySelectorAll('.cuaderno-acciones .btn')]
    .find((b) => b.textContent === 'EDITAR');
  btnEditar.click();
  await new Promise((r) => setTimeout(r, 20));
  assert.equal(obtenidos, 1);
  assert.equal(area.value, 'Texto completo');
  assert.equal(area.readOnly, false);
  window.MODULOS.fuente.desmontar();
});

test('Sugerencias de bloques: se extraen sin enviar el JSON completo', () => {
  const { recolectarSugerenciasBloques } = require('../lib/sugerencias-bloques');
  const mapa = recolectarSugerenciasBloques([
    { nombres: 'Ana', institucion_texto: 'Cabildo', anio: 1520 },
    '{"lugar":"Sevilla","titulo":"Acta"}',
    '{json roto',
  ]);
  assert.ok(mapa.NOMBRES.includes('Ana'));
  assert.ok(mapa['INSTITUCIÓN'].includes('Cabildo'));
  assert.ok(mapa.LUGAR.includes('Sevilla'));
  assert.ok(mapa['*'].includes('Acta'));
  assert.ok(mapa.ANIO.includes('1520'));
});

test('UI de relaciones: un doble clic no duplica la relación', async () => {
  let llamadas = 0;
  const window = cargarEntidades({
    relacionCrear: async () => {
      llamadas++;
      await new Promise((r) => setTimeout(r, 40));
      return { ok: true, datos: 1 };
    },
  });
  const cont = window.document.getElementById('contenido');
  await window.MODULOS.persona.montar(cont, { id: 1, nombre: 'Proyecto' }, {});
  const item = [...cont.querySelectorAll('.ent-item')]
    .find((it) => it.querySelector('.ent-item-titulo')?.textContent === 'Ana Pérez');
  item.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  await new Promise((r) => setTimeout(r, 60));
  const [selTipo, selEntidad, selVocab] = [...cont.querySelectorAll('.form-relacion select')];
  selTipo.value = 'institucion';
  selTipo.dispatchEvent(new window.Event('change', { bubbles: true }));
  selEntidad.value = '1';
  selVocab.value = 'Miembro';
  selVocab.dispatchEvent(new window.Event('change', { bubbles: true }));
  const btn = [...cont.querySelectorAll('.form-relacion-botones button')]
    .find((b) => b.textContent === 'Añadir relación');
  btn.click();
  btn.click();
  await new Promise((r) => setTimeout(r, 160));
  assert.equal(llamadas, 1);
  window.MODULOS.persona.desmontar();
});
