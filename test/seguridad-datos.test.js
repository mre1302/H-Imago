'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const db = require('../db/database');

function rutaTemporal(nombre) {
  return path.join(os.tmpdir(), `himago-seguridad-${process.pid}-${Date.now()}-${nombre}.db`);
}

async function limpiar(ruta) {
  try { await db.pool?.end(); } catch { /* ya cerrada */ }
  for (const sufijo of ['', '-wal', '-shm']) {
    try { fs.rmSync(`${ruta}${sufijo}`, { force: true }); } catch { /* nada */ }
  }
}

test('Bloques: exportar e importar conserva las exclusiones', async () => {
  const ruta = rutaTemporal('exclusiones');
  try {
    await db.conectar({ motor: 'sqlite', ruta });
    const proyecto = await db.crearProyecto({ nombre: 'Exclusiones' });
    const lugar = await db.crearEntidad('lugar', proyecto.id, { nombre: 'Lugar' });
    const institucion = await db.crearEntidad('institucion', proyecto.id, { nombre: 'Cabildo' });
    const persona = await db.crearEntidad('persona', proyecto.id, { nombre: 'Ana' });
    const fuente = await db.crearEntidad('fuente', proyecto.id, { titulo: 'Fuente' });
    const bloque = await db.crearBloqueRegistro(fuente.id, { tipo: 'Actas, acuerdos y resoluciones' });
    await db.actualizarBloqueRegistro(bloque.id, {
      valores: { f1: 'Acta', f2: lugar.id, f3: institucion.id, f4: 1500, f5: '1 de enero de 1500' },
      personas: { p1: [{ persona_id: persona.id, institucion_id: institucion.id }] },
    });
    const presidente = (await db.listarRelaciones(proyecto.id))
      .find((r) => r.tipo === 'Presidente/Director');
    assert.ok(presidente);
    await db.eliminarRelacion(presidente.id);
    assert.equal(
      (await db.listarRelaciones(proyecto.id)).filter((r) => r.tipo === 'Presidente/Director').length,
      0
    );

    const exportado = await db.exportarBloqueRegistro(bloque.id);
    assert.ok(Array.isArray(exportado.exclusiones));
    assert.ok(exportado.exclusiones.length > 0);
    await db.importarBloqueRegistro(bloque.id, JSON.parse(JSON.stringify(exportado)));
    assert.equal(
      (await db.listarRelaciones(proyecto.id)).filter((r) => r.tipo === 'Presidente/Director').length,
      0,
      'la relación excluida no debe reaparecer'
    );
  } finally {
    await limpiar(ruta);
  }
});

test('Migración: repara UUID y exclusiones duplicados sin impedir el arranque', async () => {
  const ruta = rutaTemporal('duplicados');
  try {
    await db.conectar({ motor: 'sqlite', ruta });
    const proyecto = await db.crearProyecto({ nombre: 'Duplicados' });
    await db.pool.query('DROP INDEX uq_proyectos_uuid');
    const [fila] = await db.pool.query('SELECT uuid FROM proyectos WHERE id = ?', [proyecto.id]);
    await db.pool.query('INSERT INTO proyectos (nombre, uuid) VALUES (?, ?)', ['Copia', fila[0].uuid]);
    const fuente = await db.crearEntidad('fuente', proyecto.id, { titulo: 'Fuente' });
    const bloque = await db.crearBloqueRegistro(fuente.id, { tipo: 'Actas, acuerdos y resoluciones' });
    await db.pool.query('DROP INDEX uq_exclusion');
    await db.pool.query(
      'INSERT INTO relaciones_exclusiones (proyecto_id, bloque_id, regla, firma) VALUES (?, ?, ?, ?)',
      [proyecto.id, bloque.id, 'regla', 'firma']
    );
    await db.pool.query(
      'INSERT INTO relaciones_exclusiones (proyecto_id, bloque_id, regla, firma) VALUES (?, ?, ?, ?)',
      [proyecto.id, bloque.id, 'regla', 'firma']
    );
    await db.pool.end();
    await db.conectar({ motor: 'sqlite', ruta });
    const [uuids] = await db.pool.query('SELECT uuid FROM proyectos ORDER BY id');
    assert.equal(new Set(uuids.map((f) => f.uuid)).size, uuids.length);
    const [exclusiones] = await db.pool.query(
      'SELECT COUNT(*) AS n FROM relaciones_exclusiones WHERE bloque_id = ?',
      [bloque.id]
    );
    assert.equal(Number(exclusiones[0].n), 1);
  } finally {
    await limpiar(ruta);
  }
});

test('Migración V10: normaliza coincidencias, posiciones y relaciones derivadas', async () => {
  const ruta = rutaTemporal('v10');
  try {
    await db.conectar({ motor: 'sqlite', ruta });
    const proyecto = await db.crearProyecto({ nombre: 'V10' });
    const a = await db.crearEntidad('persona', proyecto.id, { nombre: 'Ana' });
    const b = await db.crearEntidad('persona', proyecto.id, { nombre: 'Beatriz' });
    const fuente = await db.crearEntidad('fuente', proyecto.id, { titulo: 'Fuente' });
    await db.crearCuaderno(fuente.id);
    await db.crearCuaderno(fuente.id);

    await db.pool.query('DROP INDEX uq_coincidencia_par');
    await db.pool.query(
      'INSERT INTO coincidencias (proyecto_id, tipo, entidad_a, entidad_b) VALUES (?, ?, ?, ?)',
      [proyecto.id, 'persona', b.id, a.id]
    );
    await db.pool.query(
      'INSERT INTO coincidencias (proyecto_id, tipo, entidad_a, entidad_b) VALUES (?, ?, ?, ?)',
      [proyecto.id, 'persona', a.id, b.id]
    );

    await db.pool.query(
      `INSERT INTO relaciones
        (proyecto_id, origen_tipo, origen_id, destino_tipo, destino_id, procedencia)
       VALUES (?, 'persona', ?, 'persona', ?, 'AUTOMATIZADA')`,
      [proyecto.id, a.id, a.id]
    );
    const editada = await db.crearRelacion({
      proyecto_id: proyecto.id,
      origen_tipo: 'persona',
      origen_id: a.id,
      destino_tipo: 'persona',
      destino_id: b.id,
      tipo: 'Hermanos',
    });
    await db.pool.query(
      "UPDATE relaciones SET procedencia = 'EDITADA', bloque_id = 999999 WHERE id = ?",
      [editada]
    );

    await db.pool.query('DROP INDEX uq_cuaderno_posicion');
    await db.pool.query('UPDATE cuadernos SET posicion = 5 WHERE fuente_id = ?', [fuente.id]);
    await db.pool.query('PRAGMA user_version = 9');
    await db.pool.end();

    await db.conectar({ motor: 'sqlite', ruta });

    const [coincidencias] = await db.pool.query(
      'SELECT entidad_a, entidad_b FROM coincidencias WHERE proyecto_id = ?',
      [proyecto.id]
    );
    assert.equal(coincidencias.length, 1, 'las coincidencias duplicadas deben quedar en una');
    assert.equal(coincidencias[0].entidad_a, a.id);
    assert.equal(coincidencias[0].entidad_b, b.id);
    await assert.rejects(
      () => db.pool.query(
        'INSERT INTO coincidencias (proyecto_id, tipo, entidad_a, entidad_b) VALUES (?, ?, ?, ?)',
        [proyecto.id, 'persona', a.id, b.id]
      ),
      /UNIQUE|constraint/i
    );
    await assert.rejects(
      () => db.crearCoincidencia({
        proyecto_id: proyecto.id,
        tipo: 'persona',
        entidad_a: b.id,
        entidad_b: a.id,
      }),
      /Ya existe una coincidencia/i
    );

    const [reflexivas] = await db.pool.query(
      "SELECT COUNT(*) AS n FROM relaciones WHERE origen_tipo = 'persona' AND origen_id = ? AND destino_tipo = 'persona' AND destino_id = ?",
      [a.id, a.id]
    );
    assert.equal(Number(reflexivas[0].n), 0, 'las relaciones reflexivas automáticas deben eliminarse');
    const [huerfana] = await db.pool.query(
      'SELECT bloque_id FROM relaciones WHERE id = ?',
      [editada]
    );
    assert.equal(huerfana[0].bloque_id, null, 'una relación EDITADA no debe conservar un bloque inexistente');

    const [cuadernos] = await db.pool.query(
      'SELECT posicion FROM cuadernos WHERE fuente_id = ? ORDER BY posicion',
      [fuente.id]
    );
    assert.deepEqual(cuadernos.map((fila) => Number(fila.posicion)), [1, 2]);
    await assert.rejects(
      () => db.pool.query('UPDATE cuadernos SET posicion = 1 WHERE fuente_id = ? AND posicion = 2', [fuente.id]),
      /UNIQUE|constraint/i
    );
  } finally {
    await limpiar(ruta);
  }
});

test('Integridad: rechaza referencias de entidades de otro proyecto', async () => {
  const ruta = rutaTemporal('proyectos');
  try {
    await db.conectar({ motor: 'sqlite', ruta });
    const p1 = await db.crearProyecto({ nombre: 'Uno' });
    const p2 = await db.crearProyecto({ nombre: 'Dos' });
    const lugarAjeno = await db.crearEntidad('lugar', p2.id, { nombre: 'Ajeno' });
    await assert.rejects(
      () => db.crearEntidad('institucion', p1.id, { nombre: 'Institución', lugar_id: lugarAjeno.id }),
      /no pertenece al proyecto activo/i
    );
    const a = await db.crearEntidad('persona', p1.id, { nombre: 'A' });
    const b = await db.crearEntidad('persona', p1.id, { nombre: 'B' });
    const c = await db.crearEntidad('persona', p2.id, { nombre: 'C' });
    const d = await db.crearEntidad('persona', p2.id, { nombre: 'D' });
    const relacion = await db.crearRelacion({
      proyecto_id: p1.id,
      origen_tipo: 'persona',
      origen_id: a.id,
      destino_tipo: 'persona',
      destino_id: b.id,
      tipo: 'Hermanos',
    });
    await assert.rejects(
      () => db.actualizarRelacion(relacion, {
        proyecto_id: p2.id,
        origen_tipo: 'persona',
        origen_id: c.id,
        destino_tipo: 'persona',
        destino_id: d.id,
        tipo: 'Hermanos',
      }),
      /no existe en este proyecto/i
    );
    const guardada = await db.obtenerRelacion(relacion);
    assert.equal(guardada.origen_id, a.id);
    assert.equal(guardada.destino_id, b.id);
  } finally {
    await limpiar(ruta);
  }
});

test('Validación: coordenadas parciales y nombres vacíos', async () => {
  const ruta = rutaTemporal('validacion');
  try {
    await db.conectar({ motor: 'sqlite', ruta });
    const proyecto = await db.crearProyecto({ nombre: 'Validación' });
    const lugar = await db.crearEntidad('lugar', proyecto.id, { nombre: 'Lugar' });
    await assert.rejects(
      () => db.actualizarEntidad('lugar', lugar.id, { latitud: 10 }),
      /latitud y longitud juntas/i
    );
    const institucion = await db.crearEntidad('institucion', proyecto.id, { nombre: 'Cabildo' });
    await assert.rejects(
      () => db.actualizarEntidad('institucion', institucion.id, { nombre: '' }),
      /nombre es obligatorio/i
    );
    await assert.rejects(
      () => db.crearProyecto({ nombre: 'Inválido', descripcion: { texto: 'x' } }),
      /descripción del proyecto no es válida/i
    );
    await assert.rejects(
      () => db.crearEntidad('persona', proyecto.id, { nombre: { texto: 'x' } }),
      /campo.*no es válido/i
    );
  } finally {
    await limpiar(ruta);
  }
});

test('Proyectos: guardar una entidad actualiza fecha_modificacion', async () => {
  const ruta = rutaTemporal('fecha');
  try {
    await db.conectar({ motor: 'sqlite', ruta });
    const proyecto = await db.crearProyecto({ nombre: 'Fecha' });
    const [antes] = await db.pool.query(
      'SELECT fecha_modificacion FROM proyectos WHERE id = ?',
      [proyecto.id]
    );
    await new Promise((resolver) => setTimeout(resolver, 1100));
    await db.crearEntidad('persona', proyecto.id, { nombre: 'Ana' });
    const [despues] = await db.pool.query(
      'SELECT fecha_modificacion FROM proyectos WHERE id = ?',
      [proyecto.id]
    );
    assert.notEqual(despues[0].fecha_modificacion, antes[0].fecha_modificacion);
  } finally {
    await limpiar(ruta);
  }
});

test('Bloques: los datos con estructura inválida se marcan como dañados', async () => {
  const ruta = rutaTemporal('forma');
  try {
    await db.conectar({ motor: 'sqlite', ruta });
    const proyecto = await db.crearProyecto({ nombre: 'Forma' });
    const fuente = await db.crearEntidad('fuente', proyecto.id, { titulo: 'Fuente' });
    const bloque = await db.crearBloqueRegistro(fuente.id, { tipo: 'Actas, acuerdos y resoluciones' });
    await db.pool.query('UPDATE bloques_registro SET datos = ? WHERE id = ?', ['[]', bloque.id]);
    const [guardado] = await db.listarBloquesRegistro(fuente.id);
    assert.equal(guardado.datosInvalidos, true);
    const [resumen] = await db.listarBloquesResumen(fuente.id);
    assert.equal(resumen.datosInvalidos, true, 'el listado ligero también debe detectar el daño');
  } finally {
    await limpiar(ruta);
  }
});

test('Grafo: expone solo los datos permitidos de las entidades', async () => {
  const ruta = rutaTemporal('grafo');
  try {
    await db.conectar({ motor: 'sqlite', ruta });
    const proyecto = await db.crearProyecto({ nombre: 'Grafo' });
    const ana = await db.crearEntidad('persona', proyecto.id, {
      nombre: 'Ana',
      apellidos: 'Pérez',
      genero: 'Femenino',
      anio_nacimiento: 1500,
      anio_defuncion: 1560,
      ocupacion: 'Escribana',
      notas: 'Nota de Ana',
    });
    const bernardo = await db.crearEntidad('persona', proyecto.id, { nombre: 'Bernardo' });
    const lugar = await db.crearEntidad('lugar', proyecto.id, {
      nombre: 'Sevilla',
      tipo: 'ciudad',
      latitud: 37.39,
      longitud: -5.98,
      notas: 'Nota del lugar',
    });
    const fuente = await db.crearEntidad('fuente', proyecto.id, { titulo: 'Protocolo de prueba' });
    await db.crearRelacion({
      proyecto_id: proyecto.id,
      origen_tipo: 'persona',
      origen_id: ana.id,
      destino_tipo: 'persona',
      destino_id: bernardo.id,
      tipo: 'Hermanos',
      fecha_exacta_inicio: '19-X-1469',
      notas: 'Relación de prueba',
      fuentes: [fuente.id],
    });
    const grafo = await db.datosGrafo(proyecto.id);
    assert.equal(grafo.rango.minimo, null);
    assert.equal(grafo.rango.maximo, null);
    const nodoAna = grafo.nodos.find((n) => n.id === `persona:${ana.id}`);
    assert.equal(nodoAna.etiqueta, 'Ana Pérez');
    assert.equal(nodoAna.genero, 'Femenino');
    assert.equal(nodoAna.notas, 'Nota de Ana');
    assert.equal(nodoAna.identificador, ana.identificador);
    assert.equal(nodoAna.detalle, undefined);
    assert.equal(nodoAna.ocupacion, undefined);
    assert.equal(nodoAna.anioDesde, undefined);
    assert.equal(nodoAna.anioHasta, undefined);
    const nodoLugar = grafo.nodos.find((n) => n.id === `lugar:${lugar.id}`);
    assert.equal(nodoLugar.tipoEntidad, 'ciudad');
    assert.equal(nodoLugar.notas, 'Nota del lugar');
    assert.equal(nodoLugar.latitud, undefined);
    assert.equal(nodoLugar.longitud, undefined);
    assert.equal(grafo.aristas[0].anioDesde, null);
    assert.equal(grafo.aristas[0].anioHasta, null);
    assert.equal(grafo.aristas[0].fecha, '');
    assert.equal(grafo.aristas[0].procedencia, 'MANUAL');
    assert.equal(grafo.aristas[0].notas, 'Relación de prueba');
    assert.equal(grafo.aristas[0].fuentes[0].titulo, 'Protocolo de prueba');
  } finally {
    await limpiar(ruta);
  }
});

test('SQLite: detecta el uso de pool.query dentro de una transacción', async () => {
  const ruta = rutaTemporal('transaccion');
  try {
    await db.conectar({ motor: 'sqlite', ruta });
    await assert.rejects(
      () => db.pool.transaccion(async () => {
        await db.pool.query('SELECT 1');
      }),
      /dentro de una transacción SQLite/i
    );
  } finally {
    await limpiar(ruta);
  }
});


