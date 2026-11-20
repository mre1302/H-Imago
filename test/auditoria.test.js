'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const { Database } = require('node-sqlite3-wasm');
const db = require('../db/database');

function rutaTemporal(nombre) {
  return path.join(os.tmpdir(), `himago-test-${process.pid}-${Date.now()}-${nombre}.db`);
}

async function limpiar(ruta) {
  try { await db.pool?.end(); } catch { /* ya cerrada */ }
  for (const sufijo of ['', '-wal', '-shm']) {
    try { fs.rmSync(`${ruta}${sufijo}`, { force: true }); } catch { /* nada */ }
  }
}

test('SQLite: CRUD, exportación e importación conservan referencias', async () => {
  const ruta = rutaTemporal('crud');
  try {
    await db.conectar({ motor: 'sqlite', ruta });
    const p = await db.crearProyecto({ nombre: 'Pruebas', creador: 'test' });
    const inst = await db.crearEntidad('institucion', p.id, { nombre: 'Cabildo' });
    const persona = await db.crearEntidad('persona', p.id, {
      nombre: 'Ana', apellidos: 'Pérez', institucion_id: inst.id, ocupacion: 'Escribana',
    });
    const fuente = await db.crearEntidad('fuente', p.id, { titulo: 'Fuente' });
    await db.crearRelacion({
      proyecto_id: p.id,
      origen_tipo: 'persona',
      origen_id: persona.id,
      destino_tipo: 'institucion',
      destino_id: inst.id,
      tipo: 'Miembro',
      fuentes: [fuente.id],
    });
    const resumen = await db.listarEntidadesResumen('fuente', p.id);
    assert.equal(resumen[0].titulo, 'Fuente');
    assert.equal('transcripcion' in resumen[0], false);
    assert.equal((await db.listarRelacionesDeEntidad(p.id, 'persona', persona.id)).length, 1);

    const exportado = await db.exportarProyecto(p.id);
    const importado = await db.importarProyecto(JSON.parse(JSON.stringify(exportado)));
    const personas = await db.listarEntidades('persona', importado.id);
    const instituciones = await db.listarEntidades('institucion', importado.id);
    assert.equal(personas[0].institucion_id, instituciones[0].id);
    assert.equal((await db.listarRelaciones(importado.id)).length, 1);
  } finally {
    await limpiar(ruta);
  }
});

test('Importación fallida no deja un proyecto parcial', async () => {
  const ruta = rutaTemporal('rollback');
  try {
    await db.conectar({ motor: 'sqlite', ruta });
    const objeto = {
      formato: 'h-imago-proyecto',
      version: 2,
      proyecto: { nombre: 'Fallido' },
      registros: {
        lugar: [], institucion: [], persona: [{ id: 1, nombre: 'Ana', apellidos: 'P' }],
        patrimonio: [], fuente: [{ id: 1, titulo: '' }],
      },
      relaciones: [], cuadernos: [], bloques_registro: [], exclusiones: [], coincidencias: [],
    };
    await assert.rejects(() => db.importarProyecto(objeto), /título es obligatorio/i);
    assert.deepEqual(await db.listarProyectos(), []);
  } finally {
    await limpiar(ruta);
  }
});

test('Fusión: actualiza el JSON de bloques y conserva las relaciones', async () => {
  const ruta = rutaTemporal('fusion');
  try {
    await db.conectar({ motor: 'sqlite', ruta });
    const p = await db.crearProyecto({ nombre: 'Fusión' });
    const lugar = await db.crearEntidad('lugar', p.id, { nombre: 'Sede' });
    const inst = await db.crearEntidad('institucion', p.id, { nombre: 'Cabildo' });
    const superviviente = await db.crearEntidad('persona', p.id, { nombre: 'A', apellidos: 'Sup' });
    const absorbida = await db.crearEntidad('persona', p.id, { nombre: 'B', apellidos: 'Abs' });
    const fuente = await db.crearEntidad('fuente', p.id, { titulo: 'Fuente' });
    const bloque = await db.crearBloqueRegistro(fuente.id, { tipo: 'Actas, acuerdos y resoluciones' });
    await db.actualizarBloqueRegistro(bloque.id, {
      valores: { f2: lugar.id, f3: inst.id, f4: 1500 },
      personas: { p1: [{ persona_id: absorbida.id, institucion_id: inst.id }] },
    });
    await db.fusionarEntidades('persona', superviviente.id, absorbida.id);
    const [guardado] = await db.listarBloquesRegistro(fuente.id);
    assert.equal(guardado.datos.personas.p1[0].persona_id, superviviente.id);
    await db.actualizarBloqueRegistro(bloque.id, guardado.datos);
    const relaciones = await db.listarRelaciones(p.id);
    assert.ok(relaciones.some((r) => r.origen_id === superviviente.id));
  } finally {
    await limpiar(ruta);
  }
});

test('Fusión: no resucita relaciones automáticas excluidas', async () => {
  const ruta = rutaTemporal('fusion-exclusion');
  try {
    await db.conectar({ motor: 'sqlite', ruta });
    const p = await db.crearProyecto({ nombre: 'Fusión exclusión' });
    const lugar = await db.crearEntidad('lugar', p.id, { nombre: 'Santiago' });
    const inst = await db.crearEntidad('institucion', p.id, { nombre: 'Cabildo' });
    const fuente = await db.crearEntidad('fuente', p.id, { titulo: 'Fuente' });
    const superviviente = await db.crearEntidad('persona', p.id, { nombre: 'Ana', apellidos: 'Sup' });
    const absorbida = await db.crearEntidad('persona', p.id, { nombre: 'B', apellidos: 'Abs' });
    const bloque = await db.crearBloqueRegistro(fuente.id, { tipo: 'Actas, acuerdos y resoluciones' });
    await db.actualizarBloqueRegistro(bloque.id, {
      valores: { f2: lugar.id, f3: inst.id, f4: 1500, f5: '1 de enero de 1500' },
      personas: { p1: [{ persona_id: absorbida.id, institucion_id: inst.id }] },
    });

    const presidente = (await db.listarRelaciones(p.id))
      .find((r) => r.tipo === 'Presidente/Director');
    assert.ok(presidente);
    await db.eliminarRelacion(presidente.id);
    assert.equal(
      (await db.listarRelaciones(p.id)).filter((r) => r.tipo === 'Presidente/Director').length,
      0
    );

    await db.fusionarEntidades('persona', superviviente.id, absorbida.id);
    const despues = await db.listarRelaciones(p.id);
    assert.equal(
      despues.filter((r) => r.tipo === 'Presidente/Director').length,
      0,
      'la relación automática excluida no debe reaparecer tras fusionar'
    );
    const miembro = despues.find((r) => r.tipo === 'Miembro');
    assert.ok(miembro);
    assert.equal(miembro.origen_tipo, 'persona');
    assert.equal(Number(miembro.origen_id), superviviente.id);
  } finally {
    await limpiar(ruta);
  }
});

test('Borrar una institución limpia personas.institucion_id', async () => {
  const ruta = rutaTemporal('borrado');
  try {
    await db.conectar({ motor: 'sqlite', ruta });
    const p = await db.crearProyecto({ nombre: 'Borrado' });
    const inst = await db.crearEntidad('institucion', p.id, { nombre: 'Cabildo' });
    const persona = await db.crearEntidad('persona', p.id, { nombre: 'Ana', institucion_id: inst.id });
    await db.eliminarEntidad('institucion', inst.id);
    assert.equal((await db.obtenerEntidad('persona', persona.id)).institucion_id, null);
  } finally {
    await limpiar(ruta);
  }
});

test('Migración: una base SQLite antigua recibe las columnas nuevas', async () => {
  const ruta = rutaTemporal('migracion');
  try {
    const antigua = new Database(ruta);
    antigua.exec('CREATE TABLE proyectos (id INTEGER PRIMARY KEY AUTOINCREMENT, nombre TEXT NOT NULL)');
    antigua.exec('CREATE TABLE fuentes (id INTEGER PRIMARY KEY AUTOINCREMENT, proyecto_id INTEGER NOT NULL, titulo TEXT NOT NULL)');
    antigua.exec('CREATE TABLE bloques_registro (id INTEGER PRIMARY KEY AUTOINCREMENT, fuente_id INTEGER NOT NULL, tipo TEXT NOT NULL)');
    antigua.close();

    await db.conectar({ motor: 'sqlite', ruta });
    const p = await db.crearProyecto({ nombre: 'Migrado', descripcion: 'ok' });
    const fuente = await db.crearEntidad('fuente', p.id, { titulo: 'Fuente' });
    const bloque = await db.crearBloqueRegistro(fuente.id, { tipo: 'Test' });
    assert.ok(p.id > 0);
    assert.ok(fuente.id > 0);
    assert.ok(bloque.id > 0);
  } finally {
    await limpiar(ruta);
  }
});

test('Esquema: SQLite contiene todas las columnas de la definición compartida', async () => {
  const ruta = rutaTemporal('esquema');
  try {
    await db.conectar({ motor: 'sqlite', ruta });
    const { COLUMNAS_NUEVAS, columnasMySQL } = require('../db/columnas-nuevas');
    const porTabla = new Map();
    for (const [tabla, nombre] of COLUMNAS_NUEVAS) {
      if (!porTabla.has(tabla)) porTabla.set(tabla, new Set());
      porTabla.get(tabla).add(nombre);
    }
    for (const [tabla, columnas] of porTabla) {
      const [filas] = await db.pool.query(`PRAGMA table_info(${tabla})`);
      const existentes = new Set(filas.map((f) => f.name));
      for (const columna of columnas) {
        assert.ok(existentes.has(columna), `Falta ${tabla}.${columna} en SQLite`);
      }
    }
    assert.equal(columnasMySQL().length, COLUMNAS_NUEVAS.length);
  } finally {
    await limpiar(ruta);
  }
});

test('Relaciones: actualizarRelacion puede cambiar el otro extremo', async () => {
  const ruta = rutaTemporal('cambiar-extremo');
  try {
    await db.conectar({ motor: 'sqlite', ruta });
    const p = await db.crearProyecto({ nombre: 'Extremos' });
    const persona = await db.crearEntidad('persona', p.id, { nombre: 'Ana' });
    const otra = await db.crearEntidad('persona', p.id, { nombre: 'Bernardo' });
    const lugar = await db.crearEntidad('lugar', p.id, { nombre: 'Sevilla' });
    const id = await db.crearRelacion({
      proyecto_id: p.id,
      origen_tipo: 'persona',
      origen_id: persona.id,
      destino_tipo: 'persona',
      destino_id: otra.id,
      tipo: 'Hermanos',
      anio_inicio: 1500,
    });

    await db.actualizarRelacion(id, {
      proyecto_id: p.id,
      origen_tipo: 'persona',
      origen_id: persona.id,
      destino_tipo: 'lugar',
      destino_id: lugar.id,
      tipo: 'Vecino',
      anio_inicio: 1501,
    });

    const relacion = await db.obtenerRelacion(id);
    assert.equal(relacion.destino_tipo, 'lugar');
    assert.equal(Number(relacion.destino_id), lugar.id);
    assert.equal(relacion.tipo, 'Vecino');
    assert.equal(Number(relacion.anio_inicio), 1501);

    await assert.rejects(() => db.actualizarRelacion(id, {
      proyecto_id: p.id,
      tipo: 'Vecino',
      origen_tipo: 'persona',
      origen_id: persona.id,
      destino_tipo: 'persona',
      destino_id: persona.id,
    }), /misma entidad/i);
  } finally {
    await limpiar(ruta);
  }
});

test('Relaciones: rechaza fuentes de otro proyecto sin dejar la relación', async () => {
  const ruta = rutaTemporal('fuentes');
  try {
    await db.conectar({ motor: 'sqlite', ruta });
    const p1 = await db.crearProyecto({ nombre: 'Uno' });
    const p2 = await db.crearProyecto({ nombre: 'Dos' });
    const persona = await db.crearEntidad('persona', p1.id, { nombre: 'Ana' });
    const institucion = await db.crearEntidad('institucion', p1.id, { nombre: 'Cabildo' });
    const fuenteAjena = await db.crearEntidad('fuente', p2.id, { titulo: 'Ajena' });
    await assert.rejects(() => db.crearRelacion({
      proyecto_id: p1.id,
      origen_tipo: 'persona',
      origen_id: persona.id,
      destino_tipo: 'institucion',
      destino_id: institucion.id,
      tipo: 'Miembro',
      fuentes: [fuenteAjena.id],
    }), /fuentes seleccionadas/i);
    assert.equal((await db.listarRelaciones(p1.id)).length, 0);
  } finally {
    await limpiar(ruta);
  }
});

test('Bloques: importar conserva las relaciones EDITADA del bloque', async () => {
  const ruta = rutaTemporal('bloque-editada');
  try {
    await db.conectar({ motor: 'sqlite', ruta });
    const p = await db.crearProyecto({ nombre: 'Bloque editado' });
    const persona = await db.crearEntidad('persona', p.id, { nombre: 'Ana' });
    const institucion = await db.crearEntidad('institucion', p.id, { nombre: 'Cabildo' });
    const fuente = await db.crearEntidad('fuente', p.id, { titulo: 'Fuente' });
    const bloque = await db.crearBloqueRegistro(fuente.id, { tipo: 'Actas, acuerdos y resoluciones' });
    const relacionId = await db.crearRelacion({
      proyecto_id: p.id,
      origen_tipo: 'persona',
      origen_id: persona.id,
      destino_tipo: 'institucion',
      destino_id: institucion.id,
      tipo: 'Miembro',
    });
    await db.pool.query(
      "UPDATE relaciones SET procedencia = 'EDITADA', bloque_id = ? WHERE id = ?",
      [bloque.id, relacionId]
    );
    await db.importarBloqueRegistro(bloque.id, {
      formato: 'h-imago-bloque-registro',
      tipo: bloque.tipo,
      proyecto: { id: p.id },
      datos: {},
    });
    const relaciones = await db.listarRelaciones(p.id);
    const editada = relaciones.find((r) => Number(r.id) === Number(relacionId));
    assert.ok(editada, 'La relación EDITADA debe seguir existiendo');
    assert.equal(editada.procedencia, 'EDITADA');
    assert.equal(Number(editada.bloque_id), Number(bloque.id));
  } finally {
    await limpiar(ruta);
  }
});

test('Bloques: PATRIA de Hojas de servicio se remapea al exportar e importar', async () => {
  const ruta = rutaTemporal('bloque-patria');
  try {
    await db.conectar({ motor: 'sqlite', ruta });
    const origen = await db.crearProyecto({ nombre: 'Origen' });
    const madrid = await db.crearEntidad('lugar', origen.id, { nombre: 'Madrid' });
    const sevilla = await db.crearEntidad('lugar', origen.id, { nombre: 'Sevilla' });
    const fuenteOrigen = await db.crearEntidad('fuente', origen.id, { titulo: 'Hoja' });
    const bloqueOrigen = await db.crearBloqueRegistro(fuenteOrigen.id, { tipo: 'Hojas de servicio' });
    await db.actualizarBloqueRegistro(bloqueOrigen.id, {
      valores: { f2: String(madrid.id), f9: String(sevilla.id) },
    });
    const exportado = await db.exportarBloqueRegistro(bloqueOrigen.id);
    assert.ok(
      exportado.entidades.lugares.some((l) => Number(l.id) === Number(sevilla.id)),
      'La exportación debe incluir el lugar de PATRIA'
    );

    const destino = await db.crearProyecto({ nombre: 'Destino' });
    const fuenteDestino = await db.crearEntidad('fuente', destino.id, { titulo: 'Hoja' });
    const bloqueDestino = await db.crearBloqueRegistro(fuenteDestino.id, { tipo: 'Hojas de servicio' });
    await db.importarBloqueRegistro(bloqueDestino.id, exportado);

    const [importado] = await db.listarBloquesRegistro(fuenteDestino.id);
    const lugares = await db.listarEntidades('lugar', destino.id);
    const sevillaDestino = lugares.find((l) => l.nombre === 'Sevilla');
    assert.ok(sevillaDestino, 'El lugar de PATRIA debe existir en el proyecto destino');
    assert.equal(String(importado.datos.valores.f9), String(sevillaDestino.id));
  } finally {
    await limpiar(ruta);
  }
});

test('Proyectos: la exportación e importación conserva PATRIA de Hojas de servicio', async () => {
  const ruta = rutaTemporal('proyecto-patria');
  try {
    await db.conectar({ motor: 'sqlite', ruta });
    const origen = await db.crearProyecto({ nombre: 'Origen PATRIA' });
    const sevilla = await db.crearEntidad('lugar', origen.id, { nombre: 'Sevilla' });
    const fuente = await db.crearEntidad('fuente', origen.id, { titulo: 'Hoja' });
    const bloque = await db.crearBloqueRegistro(fuente.id, { tipo: 'Hojas de servicio' });
    await db.actualizarBloqueRegistro(bloque.id, { valores: { f9: String(sevilla.id) } });

    const exportado = await db.exportarProyecto(origen.id);
    const importado = await db.importarProyecto(JSON.parse(JSON.stringify(exportado)));
    const [fuenteImportada] = await db.listarEntidades('fuente', importado.id);
    const [bloqueImportado] = await db.listarBloquesRegistro(fuenteImportada.id);
    const sevillaImportada = (await db.listarEntidades('lugar', importado.id))
      .find((l) => l.nombre === 'Sevilla');
    assert.ok(sevillaImportada, 'El lugar de PATRIA debe existir tras importar el proyecto');
    assert.equal(String(bloqueImportado.datos.valores.f9), String(sevillaImportada.id));
  } finally {
    await limpiar(ruta);
  }
});

test('Migración: corrige las relaciones Sede automáticas con el sentido invertido', async () => {
  const ruta = rutaTemporal('sede-invertida');
  const { firmaDescriptor } = require('../db/relaciones-automaticas');
  try {
    await db.conectar({ motor: 'sqlite', ruta });
    const p = await db.crearProyecto({ nombre: 'Sede invertida' });
    const lugar = await db.crearEntidad('lugar', p.id, { nombre: 'Santiago' });
    const institucion = await db.crearEntidad('institucion', p.id, { nombre: 'Cabildo' });
    const fuente = await db.crearEntidad('fuente', p.id, { titulo: 'Fuente' });
    const bloque = await db.crearBloqueRegistro(fuente.id, { tipo: 'Actas, acuerdos y resoluciones' });
    await db.actualizarBloqueRegistro(bloque.id, {
      valores: { f2: lugar.id, f3: institucion.id, f4: 1810, f5: '1 de enero de 1810' },
    });

    /* Sustituye la Sede correcta por la fila que dejaban las versiones
       anteriores, con INSTITUCIÓN como origen y LUGAR como destino. */
    await db.pool.query("DELETE FROM relaciones WHERE bloque_id = ? AND tipo = 'Sede'", [bloque.id]);
    const firmaVieja = firmaDescriptor({
      origen_tipo: 'institucion',
      origen_id: institucion.id,
      destino_tipo: 'lugar',
      destino_id: lugar.id,
      tipo: 'Sede',
      anio_inicio: 1810,
      fecha_exacta_inicio: '1 de enero de 1810',
      lugar_inicio: lugar.id,
      fuente_id: fuente.id,
    });
    await db.pool.query(
      `INSERT INTO relaciones
        (proyecto_id, origen_tipo, origen_id, destino_tipo, destino_id, tipo,
         anio_inicio, fecha_exacta_inicio, lugar_inicio, procedencia, bloque_id, regla, firma)
       VALUES (?, 'institucion', ?, 'lugar', ?, 'Sede', 1810, '1 de enero de 1810', ?,
               'AUTOMATIZADA', ?, 'registro:institucion:sede:lugar', ?)`,
      [p.id, institucion.id, lugar.id, lugar.id, bloque.id, firmaVieja]
    );
    /* Una relación MANUAL heredada en el mismo sentido inverso no debe
       modificarse: la política conserva las manuales y las marca con ⚠. */
    await db.pool.query(
      `INSERT INTO relaciones
        (proyecto_id, origen_tipo, origen_id, destino_tipo, destino_id, tipo,
         procedencia, notas)
       VALUES (?, 'institucion', ?, 'lugar', ?, 'Sede', 'MANUAL', 'Heredada')`,
      [p.id, institucion.id, lugar.id]
    );

    /* Simula una base con el esquema anterior para que se ejecute la
       migración al volver a abrirla. */
    await db.pool.query('PRAGMA user_version = 4');
    await db.pool.end();
    await db.conectar({ motor: 'sqlite', ruta });

    const sedes = (await db.listarRelaciones(p.id)).filter((r) => r.tipo === 'Sede');
    const sede = sedes.find((r) => r.procedencia === 'AUTOMATIZADA');
    const manual = sedes.find((r) => r.procedencia === 'MANUAL');
    assert.ok(sede);
    assert.ok(manual);
    assert.equal(sede.origen_tipo, 'lugar');
    assert.equal(Number(sede.origen_id), lugar.id);
    assert.equal(sede.destino_tipo, 'institucion');
    assert.equal(Number(sede.destino_id), institucion.id);
    assert.equal(manual.origen_tipo, 'institucion');
    assert.equal(Number(manual.origen_id), institucion.id);
    assert.equal(manual.destino_tipo, 'lugar');
    assert.equal(Number(manual.destino_id), lugar.id);
    assert.equal(manual.notas, 'Heredada');
    const firmaEsperada = firmaDescriptor({
      origen_tipo: 'lugar',
      origen_id: lugar.id,
      destino_tipo: 'institucion',
      destino_id: institucion.id,
      tipo: 'Sede',
      anio_inicio: 1810,
      fecha_exacta_inicio: '1 de enero de 1810',
      lugar_inicio: lugar.id,
      fuente_id: fuente.id,
    });
    assert.equal(sede.firma, firmaEsperada);
  } finally {
    await limpiar(ruta);
  }
});

test('Migración: renombra las etiquetas del nuevo mapeo', async () => {
  const ruta = rutaTemporal('renombrados');
  const cambios = {
    'Donante – Beneficiario': 'Mecenas/Donante – Beneficiario',
    'Mecenas/Benefactor – Beneficiario': 'Mecenas/Donante – Beneficiario',
    'Comisionista – Dependiente': 'Comitente – Comisionista',
    'Contratista/Comisionista': 'Asentista/contratista',
    'Espía': 'Espía – Espiado',
    'Espiado': 'Espía – Espiado',
    'Infiltrado': 'Espía/Infiltrado',
    'Señor – Esclavo': 'Patrón – Esclavo',
    'Cómplices': 'Cómplice – Infractor',
    'Enamorado': 'Enamorados',
    'Encubridor – Encubierto': 'Encubridor – Infractor',
    'Encubridor': 'Encubridor – Infractor',
    'Rechazo': 'No correspondido',
    'Ambivalencia': 'Ambivalentes',
    'Indiferente': 'Indiferentes',
    'Sobrestima': 'Sobrestimado',
    'Subestima': 'Subestimado',
    'Violencia': 'Violentador – Violentado',
  };
  try {
    await db.conectar({ motor: 'sqlite', ruta });
    const p = await db.crearProyecto({ nombre: 'Renombrados' });
    const persona = await db.crearEntidad('persona', p.id, { nombre: 'Ana' });
    for (const viejo of [...Object.keys(cambios), 'Ruptura']) {
      await db.pool.query(
        `INSERT INTO relaciones
          (proyecto_id, origen_tipo, origen_id, destino_tipo, destino_id, tipo, procedencia, notas)
         VALUES (?, 'persona', ?, 'persona', ?, ?, 'MANUAL', ?)`,
        [p.id, persona.id, persona.id, viejo, viejo]
      );
    }

    /* Simula una base anterior a la migración de etiquetas. */
    await db.pool.query('PRAGMA user_version = 6');
    await db.pool.end();
    await db.conectar({ motor: 'sqlite', ruta });

    const [filas] = await db.pool.query(
      'SELECT notas, tipo FROM relaciones WHERE proyecto_id = ?',
      [p.id]
    );
    for (const [viejo, nuevo] of Object.entries(cambios)) {
      const fila = filas.find((f) => f.notas === viejo);
      assert.ok(fila, `No se encontró la relación «${viejo}»`);
      assert.equal(fila.tipo, nuevo, `«${viejo}» debe pasar a «${nuevo}»`);
    }
    const ruptura = filas.find((f) => f.notas === 'Ruptura');
    assert.ok(ruptura);
    assert.equal(ruptura.tipo, 'Ruptura');
  } finally {
    await limpiar(ruta);
  }
});

test('Taxonomía: incluye las nuevas relaciones solicitadas', () => {
  const contexto = { window: {}, console: { log() {} } };
  vm.createContext(contexto);
  vm.runInContext(
    fs.readFileSync(path.join(__dirname, '..', 'src', 'js', 'modulos', 'taxonomia-relaciones.js'), 'utf8'),
    contexto
  );
  const tax = contexto.window.TAXONOMIA_RELACIONES;
  assert.ok(tax.Clientelar.includes('Señor – Confidente'));
  assert.ok(tax.Clientelar.includes('Señor – Súbdito'));
  assert.ok(tax.Clientelar.includes('Desfavorecedor – Desfavorecido'));
  assert.ok(tax.Clientelar.includes('Mecenas/Donante – Beneficiario'));
  assert.ok(tax.Clientelar.includes('Patrón – Esclavo'));
  assert.ok(!tax.Clientelar.includes('Señor – Esclavo'));
  assert.ok(!tax.Clientelar.includes('Guardia – Dependiente'));
  assert.ok(tax.Económica.includes('Asentista/contratista'));
  assert.ok(tax.Económica.includes('Comitente – Comisionista'));
  assert.ok(!tax.Económica.includes('Mecenas/Benefactor – Beneficiario'));
  assert.ok(tax.Institucional.includes('Emisario'));
  assert.ok(tax.Institucional.includes('Espía/Infiltrado'));
  assert.ok(tax.Institucional.includes('Sancionado'));
  assert.ok(!tax.Institucional.includes('Infiltrado'));
  assert.ok(!tax.Institucional.includes('Espiado'));
  assert.ok(!tax.Institucional.includes('Administrador'));
  assert.ok(!tax.Institucional.includes('Espía'));
  assert.ok(tax.Territorial.includes('Capitán/Comandante'));
  assert.ok(tax.Territorial.includes('Destinado'));
  assert.ok(!tax.Institucional.includes('Capitán/Comandante'));
  assert.ok(!tax.Institucional.includes('Destinado'));
  assert.ok(tax.Territorial.includes('Mayordomo/Administrador'));
  assert.ok(tax.Territorial.includes('Adscripción'));
  assert.ok(tax.Territorial.includes('Apresado/retenido'));
  for (const etiqueta of [
    'Fiscal – Acusado', 'Fiscal – Defensor', 'Fiscal – Demandante',
    'Infractor – Damnificado', 'Juez – Absuelto', 'Juez – Acusado',
    'Juez – Condenado', 'Juez – Defensor', 'Juez – Demandante',
    'Juez – Sobreseído',
  ]) {
    assert.ok(tax.Legal.includes(etiqueta), `Falta «${etiqueta}» en Legal`);
  }
  for (const etiqueta of [
    'Desprecio', 'Ambivalentes', 'Asesino – Asesinado',
    'Cómplice – Infractor', 'Enamorados', 'Encubridor – Infractor',
    'Espía – Espiado', 'Homicida – Fallecido', 'Indiferentes',
    'Enemistados', 'No correspondido', 'Sobrestimado',
    'Subestimado', 'Violentador – Violentado',
  ]) {
    assert.ok(tax.Sentimental.includes(etiqueta), `Falta «${etiqueta}» en Sentimental`);
  }
  assert.ok(!tax.Sentimental.includes('Ruptura'));
  assert.ok(!tax.Sentimental.includes('Rechazo'));
});

test('Taxonomía: recuento de categorías y tipos del mapeo vigente', () => {
  const contexto = { window: {}, console: { log() {} } };
  vm.createContext(contexto);
  vm.runInContext(
    fs.readFileSync(path.join(__dirname, '..', 'src', 'js', 'modulos', 'taxonomia-relaciones.js'), 'utf8'),
    contexto
  );
  const tax = contexto.window.TAXONOMIA_RELACIONES;
  assert.deepEqual(
    Object.fromEntries(Object.entries(tax).map(([categoria, etiquetas]) => [categoria, etiquetas.length])),
    {
      Clientelar: 22,
      Comunicacional: 4,
      Económica: 11,
      Familiar: 32,
      Institucional: 33,
      Legal: 23,
      Sentimental: 32,
      Territorial: 25,
    }
  );
  assert.equal(Object.values(tax).flat().length, 182);
  assert.equal(contexto.window.RELACIONES_TIPOS.length, 182);
});

test('Taxonomía: COMUNICACIONALES y traslados a TERRITORIAL', () => {
  const contexto = { window: {}, console: { log() {} } };
  vm.createContext(contexto);
  vm.runInContext(
    fs.readFileSync(path.join(__dirname, '..', 'src', 'js', 'modulos', 'taxonomia-relaciones.js'), 'utf8'),
    contexto
  );
  const tax = contexto.window.TAXONOMIA_RELACIONES;
  assert.deepEqual(JSON.parse(JSON.stringify(tax.Comunicacional)), [
    'Correspondientes legales',
    'Correspondientes personales',
    'Correo/Emisario',
    'Remitente – Mensajero',
  ]);
  assert.equal(contexto.window.RELACIONES_CATEGORIAS_PLURAL.Comunicacional, 'Comunicacionales');
  assert.equal(contexto.window.categoriaRelacion('Señor – Súbdito'), 'Clientelar');
  assert.equal(contexto.window.categoriaRelacion('Remitente – Mensajero'), 'Comunicacional');
  assert.equal(contexto.window.categoriaRelacion('Propietario'), 'Territorial');
  assert.equal(contexto.window.categoriaRelacion('Postor'), 'Territorial');
  assert.equal(contexto.window.categoriaRelacion('Mejor postor'), 'Territorial');
  assert.equal(contexto.window.categoriaRelacion('Amotinado/Sublevado'), 'Territorial');
  assert.equal(contexto.window.categoriaRelacion('Jefe/Gobernador'), 'Territorial');
  assert.equal(contexto.window.categoriaRelacion('Capitán/Comandante'), 'Territorial');
  assert.equal(contexto.window.categoriaRelacion('Destinado'), 'Territorial');
  assert.ok(!tax.Institucional.includes('Amotinado/Sublevado'));
  assert.ok(!tax.Institucional.includes('Jefe/Gobernador'));
  assert.ok(!tax.Institucional.includes('Correo/Emisario'));
  assert.ok(!tax.Económica.includes('Propietario'));
  assert.ok(!tax.Legal.includes('Postor'));
  assert.ok(!tax.Legal.includes('Mejor postor'));
  assert.ok(!tax.Legal.includes('Correspondientes legales'));
  assert.ok(!tax.Sentimental.includes('Correspondientes personales'));
  assert.ok(!tax.Clientelar.includes('Remitente – Mensajero'));
});

test('Taxonomía: restricciones de origen y destino por tipo de relación', () => {
  const contexto = { window: {}, console: { log() {} } };
  vm.createContext(contexto);
  vm.runInContext(
    fs.readFileSync(path.join(__dirname, '..', 'src', 'js', 'modulos', 'taxonomia-relaciones.js'), 'utf8'),
    contexto
  );
  const w = contexto.window;
  const etiquetas = Object.values(w.TAXONOMIA_RELACIONES).flat();
  assert.equal(Object.keys(w.RESTRICCIONES_RELACION).length, etiquetas.length);
  for (const etiqueta of etiquetas) {
    assert.ok(w.RESTRICCIONES_RELACION[etiqueta], `Falta la restricción de «${etiqueta}»`);
  }
  assert.equal(w.relacionPermitida('Hermanos', 'persona', 'persona'), true);
  assert.equal(w.relacionPermitida('Hermanos', 'persona', 'institucion'), false);
  assert.equal(w.relacionPermitida('Sede', 'lugar', 'institucion'), true);
  assert.equal(w.relacionPermitida('Sede', 'lugar', 'patrimonio'), true);
  assert.equal(w.relacionPermitida('Sede', 'institucion', 'lugar'), false);
  assert.equal(w.relacionPermitida('Desfavorecedor – Desfavorecido', 'persona', 'persona'), true);
  assert.equal(w.relacionPermitida('Desfavorecedor – Desfavorecido', 'persona', 'institucion'), false);
  assert.equal(w.relacionPermitida('Desprecio', 'persona', 'persona'), true);
  assert.equal(w.relacionPermitida('Violentador – Violentado', 'persona', 'persona'), true);
  assert.equal(w.relacionPermitida('Violentador – Violentado', 'persona', 'institucion'), false);
  assert.equal(w.relacionPermitida('Mecenas/Donante – Beneficiario', 'persona', 'persona'), true);
  assert.equal(w.relacionPermitida('Patrón – Esclavo', 'persona', 'persona'), true);
  assert.equal(w.relacionPermitida('Emisario', 'persona', 'persona'), true);
  assert.equal(w.relacionPermitida('Emisario', 'persona', 'patrimonio'), true);
  assert.equal(w.relacionPermitida('Sancionado', 'persona', 'institucion'), true);
  assert.equal(w.relacionPermitida('Sancionado', 'persona', 'persona'), false);
  assert.equal(w.relacionPermitida('Espía/Infiltrado', 'persona', 'institucion'), true);
  assert.equal(w.relacionPermitida('Espía/Infiltrado', 'persona', 'patrimonio'), true);
  assert.equal(w.relacionPermitida('Espía/Infiltrado', 'persona', 'persona'), false);
  assert.equal(w.restriccionRelacion('Guardia – Dependiente'), null);
  assert.ok(!w.relacionesPorOrigen('persona').includes('Guardia – Dependiente'));
  assert.ok(w.relacionesPorOrigen('persona').includes('Espía/Infiltrado'));
  assert.ok(w.relacionesPorOrigen('persona').includes('Emisario'));
  assert.ok(w.relacionesPorOrigen('persona').includes('Sancionado'));
  assert.ok(!w.relacionesPorOrigen('persona').includes('Infiltrado'));
  assert.ok(!w.relacionesPorOrigen('persona').includes('Espiado'));
  assert.equal(w.categoriaRelacion('Guardia – Dependiente'), 'Clientelar');
  assert.equal(w.categoriaRelacion('Espía/Infiltrado'), 'Institucional');
  assert.equal(w.categoriaRelacion('Ruptura'), 'Sentimental');
  assert.equal(w.categoriaRelacion('Administrador'), 'Institucional');
  assert.equal(w.categoriaRelacion('Fiscal – Litigante'), 'Legal');
  assert.equal(w.categoriaRelacion('Juez – Litigante'), 'Legal');
  assert.equal(w.categoriaRelacion('Secuestrador/Apresador'), 'Legal');
  assert.equal(w.relacionPermitida('Aspirante/Postulante', 'persona', 'institucion'), true);
  assert.equal(w.relacionPermitida('Aspirante/Postulante', 'persona', 'patrimonio'), true);
  assert.equal(w.relacionPermitida('Capitán/Comandante', 'persona', 'institucion'), true);
  assert.equal(w.relacionPermitida('Capitán/Comandante', 'persona', 'patrimonio'), true);
  assert.equal(w.relacionPermitida('Destinado', 'persona', 'institucion'), true);
  assert.equal(w.relacionPermitida('Destinado', 'persona', 'patrimonio'), true);
  assert.equal(w.relacionPermitida('Adscripción', 'institucion', 'institucion'), true);
  assert.equal(w.relacionPermitida('Adscripción', 'persona', 'institucion'), false);
  assert.equal(w.relacionPermitida('Propietario', 'persona', 'patrimonio'), true);
  assert.equal(w.relacionPermitida('Propietario', 'institucion', 'patrimonio'), true);
  assert.equal(w.relacionPermitida('Propietario', 'persona', 'persona'), false);
  assert.equal(w.relacionPermitida('Candidato', 'persona', 'patrimonio'), true);
  assert.equal(w.relacionPermitida('Empleado', 'persona', 'patrimonio'), true);
  assert.equal(w.relacionPermitida('Apoderado – Representado', 'persona', 'persona'), true);
  assert.equal(w.relacionPermitida('Apoderado – Representado', 'persona', 'institucion'), true);
  assert.equal(w.relacionPermitida('Apoderado – Representado', 'persona', 'patrimonio'), true);
  assert.equal(w.relacionPermitida('Defensor – Defendido', 'persona', 'persona'), true);
  assert.equal(w.relacionPermitida('Fiscal – Acusado', 'persona', 'institucion'), true);
  assert.equal(w.relacionPermitida('Fiscal – Defensor', 'persona', 'institucion'), true);
  assert.equal(w.relacionPermitida('Fiscal – Defensor', 'institucion', 'persona'), false);
  assert.equal(w.relacionPermitida('Fiscal – Demandante', 'persona', 'institucion'), true);
  assert.equal(w.relacionPermitida('Infractor – Damnificado', 'institucion', 'patrimonio'), true);
  assert.equal(w.relacionPermitida('Juez – Acusado', 'persona', 'institucion'), true);
  assert.equal(w.relacionPermitida('Juez – Demandante', 'persona', 'institucion'), true);
  assert.equal(w.relacionPermitida('Juez – Sobreseído', 'persona', 'institucion'), true);
  assert.equal(w.relacionPermitida('Asesino – Asesinado', 'persona', 'persona'), true);
  assert.equal(w.relacionPermitida('Cómplice – Infractor', 'persona', 'persona'), true);
  assert.equal(w.relacionPermitida('Enamorados', 'persona', 'persona'), true);
  assert.equal(w.relacionPermitida('Encubridor – Infractor', 'persona', 'persona'), true);
  assert.equal(w.relacionPermitida('Espía – Espiado', 'persona', 'persona'), true);
  assert.equal(w.relacionPermitida('No correspondido', 'persona', 'persona'), true);
  assert.equal(w.relacionPermitida('Asentista/contratista', 'institucion', 'patrimonio'), false);
  assert.equal(w.relacionPermitida('Comitente – Comisionista', 'persona', 'institucion'), true);
  assert.equal(w.relacionPermitida('Comitente – Comisionista', 'persona', 'patrimonio'), false);
  assert.equal(w.relacionPermitida('Embargador – Embargado', 'persona', 'patrimonio'), false);
  assert.equal(w.relacionPermitida('Financista/Inversor', 'persona', 'patrimonio'), false);
  assert.equal(w.relacionPermitida('Permutantes', 'persona', 'patrimonio'), false);
  assert.equal(w.relacionPermitida('Proveedor – Receptador', 'persona', 'patrimonio'), false);
  assert.equal(w.relacionPermitida('Amotinado/Sublevado', 'persona', 'lugar'), true);
  assert.equal(w.relacionPermitida('Jefe/Gobernador', 'persona', 'institucion'), true);
  assert.equal(w.relacionPermitida('Mayordomo/Administrador', 'persona', 'institucion'), true);
  assert.equal(w.relacionPermitida('Prisionero/Cautivo', 'persona', 'persona'), true);
  assert.equal(w.relacionPermitida('Apresado/retenido', 'patrimonio', 'persona'), true);
  assert.equal(w.relacionPermitida('Apresado/retenido', 'persona', 'patrimonio'), false);
  assert.equal(w.relacionPermitida('Jurisdicción', 'institucion', 'lugar'), true);
  assert.equal(w.relacionPermitida('Jurisdicción', 'institucion', 'patrimonio'), true);
  assert.equal(w.relacionPermitida('Jurisdicción', 'institucion', 'institucion'), false);
  assert.equal(w.relacionPermitida('Tipo personalizado', 'patrimonio', 'lugar'), true);
  assert.deepEqual(JSON.parse(JSON.stringify(w.tiposDestinoRelacion('Sede', 'lugar'))), ['institucion', 'patrimonio']);
  assert.deepEqual(JSON.parse(JSON.stringify(w.tiposDestinoRelacion('Jurisdicción', 'institucion'))), ['lugar', 'patrimonio']);
  assert.deepEqual(JSON.parse(JSON.stringify(w.relacionesPorOrigen('patrimonio'))), ['Apresado/retenido']);
  assert.ok(w.relacionesPorOrigen('persona').includes('Vecino'));
  assert.ok(w.relacionesPorOrigen('institucion').includes('Adscripción'));
});

test('Reglas automáticas: Sede va de LUGAR a INSTITUCIÓN', () => {
  const relaciones = require('../db/relaciones-automaticas');
  const propuestas = relaciones.reglasDeBloque(
    { tipo: 'Actas, acuerdos y resoluciones', fuente_id: 1 },
    {
      valores: { f2: 10, f3: 20, f4: 1700, f5: '01-01-1700' },
      personas: { p1: [{ persona_id: 30, institucion_id: 40 }] },
    }
  );
  const sede = propuestas.find((r) => r.regla === 'registro:institucion:sede:lugar');
  assert.ok(sede);
  assert.equal(sede.origen_tipo, 'lugar');
  assert.equal(sede.origen_id, 10);
  assert.equal(sede.destino_tipo, 'institucion');
  assert.equal(sede.destino_id, 20);
});

test('Reglas automáticas: Apoderado – Representado va del apoderado al otorgante', () => {
  const relaciones = require('../db/relaciones-automaticas');
  const propuestas = relaciones.reglasDeBloque(
    { tipo: 'Poder', fuente_id: 1 },
    {
      valores: {},
      personas: {
        p3: [{ persona_id: 30 }],
        p4: [{ persona_id: 40 }],
      },
    }
  );
  const apoderado = propuestas.find((r) => r.tipo === 'Apoderado – Representado');
  assert.ok(apoderado);
  assert.equal(apoderado.origen_tipo, 'persona');
  assert.equal(apoderado.origen_id, 40);
  assert.equal(apoderado.destino_tipo, 'persona');
  assert.equal(apoderado.destino_id, 30);
});

test('Fechas históricas: era hispánica y formatos habituales', () => {
  const contexto = {
    window: {},
    document: { addEventListener() {}, removeEventListener() {} },
    console: { log() {} },
  };
  vm.createContext(contexto);
  vm.runInContext(
    fs.readFileSync(path.join(__dirname, '..', 'src', 'js', 'modulos', 'fecha-historica.js'), 'utf8'),
    contexto
  );
  const f = contexto.window.FechaHistorica;
  assert.equal(f.formatear(f.parsear('era 1507')), 'era 1507');
  assert.deepEqual(
    JSON.parse(JSON.stringify(f.parsear('19-X-1469'))),
    { sistema: '', precision: 'dia', anio: 1469, mes: 10, dia: 19 }
  );
  assert.equal(f.parsear('antes de 1603').anio, 1603);
  assert.equal(f.parsear('fl. 1489-1512').precision, 'rango');
  assert.equal(f.anioReferencia(() => '1469'), 1469);
  assert.equal(f.anioReferencia({ value: '1520' }), 1520);
  assert.equal(f.anioReferencia(''), null);
  assert.equal(f.anioReferencia(null), null);
});

test('Bloques: EDICTOS, BANDOS Y PANFLETOS clona LEYES y genera reglas propias', () => {
  const contexto = { window: {}, console: { log() {} } };
  vm.createContext(contexto);
  vm.runInContext(
    fs.readFileSync(path.join(__dirname, '..', 'src', 'js', 'modulos', 'taxonomia-bloques.js'), 'utf8'),
    contexto
  );
  vm.runInContext(
    fs.readFileSync(path.join(__dirname, '..', 'src', 'js', 'modulos', 'formularios-bloques.js'), 'utf8'),
    contexto
  );
  vm.runInContext(
    fs.readFileSync(path.join(__dirname, '..', 'src', 'js', 'modulos', 'ajustes-bloques.js'), 'utf8'),
    contexto
  );
  const formularios = contexto.window.FORMULARIOS_BLOQUES;
  assert.ok(contexto.window.BLOQUES_XVIII_XIX['Registros institucionales'].includes('Edictos, bandos, panfletos'));
  assert.ok(formularios['Edictos, bandos, panfletos']);
  assert.equal(formularios['Edictos, bandos, panfletos'].titulo, 'Edictos, bandos, panfletos');
  assert.equal(formularios['Edictos, bandos, panfletos'].categoria, 'Registros institucionales');
  assert.ok(formularios['Edictos, bandos, panfletos'].bloques.length > 0);

  const diezmos = formularios['Diezmos'];
  const camposDiezmos = diezmos.bloques
    .filter((b) => b.tipo === 'campos')
    .flatMap((b) => b.campos)
    .map((c) => c.nombre);
  assert.ok(camposDiezmos.includes('PESO'));
  assert.ok(camposDiezmos.includes('REALES'));
  assert.ok(camposDiezmos.includes('CUARTILLOS'));
  assert.ok(diezmos.montosOctavales.some((m) => m.base === 'f6'));

  const inventario = formularios['Inventarios de bienes'];
  const grupoInventario = inventario.bloques.find((b) => b.tipo === 'grupo');
  const itemsInventario = grupoInventario.bloques.find((b) => b.tipo === 'items-inventario');
  assert.ok(itemsInventario.campos.peso);
  assert.ok(itemsInventario.campos.reales);
  assert.ok(itemsInventario.campos.cuartillos);
  assert.ok(itemsInventario.campos.subtotalPeso);
  assert.ok(itemsInventario.campos.subtotalReales);
  assert.ok(itemsInventario.campos.subtotalCuartillos);
  const totalesInventario = inventario.bloques.find((b) => b.tipo === 'totales-inventario');
  assert.ok(totalesInventario.campos.totalPeso);
  assert.ok(totalesInventario.campos.totalReales);
  assert.ok(totalesInventario.campos.totalCuartillos);

  const relaciones = require('../db/relaciones-automaticas');
  const propuestas = relaciones.reglasDeBloque(
    { tipo: 'Edictos, bandos, panfletos', fuente_id: 1 },
    {
      valores: { f2: 10, f3: 20, f4: 1700, f5: '01-01-1700' },
      personas: { p1: [{ persona_id: 30, institucion_id: 40 }] },
    }
  );
  assert.ok(propuestas.some((r) => r.regla === 'edictos:autoridad:registro:presidente'));
  assert.ok(propuestas.some((r) => r.regla === 'edictos:autoridad:propia:miembro'));
  assert.ok(propuestas.some((r) => r.regla === 'registro:institucion:sede:lugar'));
});

test('Comunicaciones: remitente o destinatario sin persona usan su institución', () => {
  const relaciones = require('../db/relaciones-automaticas');
  const propuestas = relaciones.reglasDeBloque(
    { tipo: 'Comunicaciones', fuente_id: 1 },
    {
      valores: { f2: 10, f3: 20, f4: 1700, f5: '01-01-1700' },
      personas: {
        p1: [{ institucion_id: 30 }],
        p2: [{ persona_id: 40, institucion_id: 50 }],
      },
    }
  );
  const corresponsalia = propuestas.filter(
    (r) => r.regla === 'comunicaciones:remitente:destinatario:corresponsales'
  );
  assert.equal(corresponsalia.length, 1);
  assert.equal(corresponsalia[0].origen_tipo, 'institucion');
  assert.equal(corresponsalia[0].origen_id, 30);
  assert.equal(corresponsalia[0].destino_tipo, 'persona');
  assert.equal(corresponsalia[0].destino_id, 40);
});
