'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const db = require('../db/database');
const {
  normalizarConsulta,
  tokensDeConsulta,
  crearSnippet,
  rangosDeTokens,
} = require('../db/busqueda');

function rutaTemporal(nombre) {
  return path.join(os.tmpdir(), `himago-busqueda-${process.pid}-${Date.now()}-${nombre}.db`);
}

async function limpiar(ruta) {
  try { await db.pool?.end(); } catch { /* ya cerrada */ }
  const directorio = path.dirname(ruta);
  const base = path.basename(ruta);
  for (const archivo of fs.readdirSync(directorio)) {
    if (archivo === base || archivo.startsWith(`${base}-`) || archivo.startsWith(`${base}.bak-`)) {
      try { fs.rmSync(path.join(directorio, archivo), { force: true }); } catch { /* nada */ }
    }
  }
}

test('Búsqueda: normalización sin tildes, palabras y fragmentos resaltados', () => {
  assert.equal(normalizarConsulta('  Núñez   de la Torre '), 'nunez de la torre');
  assert.equal(normalizarConsulta('Pérez, Ana (1520-1560)'), 'perez ana 1520 1560');
  assert.deepEqual(tokensDeConsulta('Pérez Ana'), ['perez', 'ana']);
  const { snippet, resaltados } = crearSnippet(
    'Vecina de Medina del Campo, hija de vecinos, natural de la villa',
    ['medina']
  );
  assert.match(snippet, /Medina/);
  assert.ok(resaltados.length >= 1);
  assert.equal(snippet.slice(resaltados[0][0], resaltados[0][1]), 'Medina');
  const titulo = rangosDeTokens('Ana Pérez', ['perez']);
  assert.equal(titulo.length, 1);
  assert.equal('Ana Pérez'.slice(titulo[0][0], titulo[0][1]), 'Pérez');
});

test('Búsqueda general: entidades, relaciones, bloques, transcripciones y coincidencias', async () => {
  const ruta = rutaTemporal('global');
  try {
    await db.conectar({ motor: 'sqlite', ruta });
    const proyecto = await db.crearProyecto({ nombre: 'Búsqueda' });
    const ana = await db.crearEntidad('persona', proyecto.id, {
      nombre: 'Ana',
      apellidos: 'Pérez',
      alias: 'La Escribana',
      notas: 'Vecina de Medina del Campo',
    });
    const bernardo = await db.crearEntidad('persona', proyecto.id, {
      nombre: 'Bernardo',
      apellidos: 'Gil',
    });
    const sevilla = await db.crearEntidad('lugar', proyecto.id, {
      nombre: 'Sevilla',
      tipo: 'ciudad',
      notas: 'Puerto fluvial',
    });
    const cabildo = await db.crearEntidad('institucion', proyecto.id, {
      nombre: 'Cabildo',
      tipo: 'municipal',
      lugar_id: sevilla.id,
    });
    await db.crearEntidad('patrimonio', proyecto.id, {
      nombre: 'Casa de la Moneda',
      propietario: 'Ana Pérez',
      valor: '12.000 maravedíes',
    });
    const fuente = await db.crearEntidad('fuente', proyecto.id, {
      titulo: 'Protocolo de Sevilla',
      autor: 'Escribano Mayor',
      signatura: 'Leg. 42',
      repositorio: 'Archivo Municipal',
    });
    const bloque = await db.crearBloqueRegistro(fuente.id, {
      tipo: 'Hojas de servicio',
      categoria: 'Registros institucionales',
    });
    await db.actualizarBloqueRegistro(bloque.id, {
      valores: { f1: 'Hoja de Bernardo Gil', f2: String(sevilla.id), f3: String(cabildo.id) },
      personas: {
        'p-soldado': [{ nombres: 'Bernardo', apellidos: 'Gil', patria: String(sevilla.id) }],
      },
    });
    const cuaderno = await db.crearCuaderno(fuente.id);
    await db.actualizarCuaderno(cuaderno.id, {
      contenido: 'En la ciudad de Sevilla, ante el escribano, pareció Ana Pérez…',
      fojas: [],
    });
    await db.crearCoincidencia({
      proyecto_id: proyecto.id,
      tipo: 'persona',
      entidad_a: ana.id,
      entidad_b: bernardo.id,
      notas: 'Posible parentesco',
    });
    await db.crearRelacion({
      proyecto_id: proyecto.id,
      origen_tipo: 'persona',
      origen_id: ana.id,
      destino_tipo: 'institucion',
      destino_id: cabildo.id,
      tipo: 'Miembro',
      notas: 'Asistente a cabildos',
      anio_inicio: 1520,
    });

    const perez = await db.buscarGlobal(proyecto.id, { texto: 'perez', forzar: true });
    assert.equal(perez.resultados.entidades[0].titulo, 'Ana Pérez');
    assert.ok(perez.resultados.cuadernos.length >= 1);
    assert.ok(perez.resultados.coincidencias.length >= 1);

    const alias = await db.buscarGlobal(proyecto.id, { texto: 'escribana' });
    assert.ok(alias.resultados.entidades.some((e) => e.id === ana.id));

    const notas = await db.buscarGlobal(proyecto.id, { texto: 'medina' });
    assert.ok(notas.resultados.entidades.some((e) => e.id === ana.id));

    const notasRelacion = await db.buscarGlobal(proyecto.id, { texto: 'cabildos' });
    assert.ok(notasRelacion.resultados.relaciones.some((r) => r.tipoRelacion === 'Miembro'));

    const bloqueTexto = await db.buscarGlobal(proyecto.id, { texto: 'bernardo gil' });
    assert.ok(bloqueTexto.resultados.bloques.some((b) => b.bloqueId === bloque.id));

    const transcripcion = await db.buscarGlobal(proyecto.id, { texto: 'parecio' });
    assert.ok(transcripcion.resultados.cuadernos.some((c) => c.cuadernoId === cuaderno.id));
    assert.ok(transcripcion.resultados.cuadernos[0].snippet.includes('pareció'));

    const coincidencia = await db.buscarGlobal(proyecto.id, { texto: 'parentesco' });
    assert.ok(coincidencia.resultados.coincidencias.length >= 1);

    const soloLugares = await db.buscarGlobal(proyecto.id, {
      tiposEntidad: ['lugar'],
      forzar: true,
    });
    assert.equal(soloLugares.totalesBusqueda.entidades, 1);
    assert.equal(soloLugares.resultados.entidades[0].titulo, 'Sevilla');
    assert.equal(soloLugares.resultados.relaciones.length, 0);
    assert.equal(soloLugares.resultados.bloques.length, 0);
    assert.equal(soloLugares.resultados.cuadernos.length, 0);

    const soloRelacion = await db.buscarGlobal(proyecto.id, {
      tipoRelacion: 'Miembro',
      forzar: true,
    });
    assert.equal(soloRelacion.totalesBusqueda.relaciones, 1);
    assert.equal(soloRelacion.resultados.relaciones[0].tipoRelacion, 'Miembro');
    assert.equal(soloRelacion.resultados.entidades.length, 0);

    const explorar = await db.buscarGlobal(proyecto.id, { forzar: true });
    assert.equal(explorar.totalesBusqueda.total, 0);
    assert.equal(explorar.totales.entidades, 6);
    assert.ok(explorar.totales.relaciones >= 1);
    assert.ok(explorar.tiposRelacion.some((t) => t.tipo === 'Miembro'));

    const otra = await db.crearProyecto({ nombre: 'Otro proyecto' });
    const otroLugar = await db.crearEntidad('lugar', otra.id, { nombre: 'Sevilla la Nueva' });
    const aislado = await db.buscarGlobal(otra.id, { texto: 'sevilla', forzar: true });
    assert.equal(aislado.resultados.entidades.length, 1);
    assert.equal(aislado.resultados.entidades[0].id, otroLugar.id);

    await db.crearEntidad('lugar', proyecto.id, { nombre: 'Cartagena' });
    const refrescado = await db.buscarGlobal(proyecto.id, { texto: 'cartagena' });
    assert.equal(refrescado.resultados.entidades.length, 1);
    assert.equal(refrescado.resultados.entidades[0].titulo, 'Cartagena');
  } finally {
    await limpiar(ruta);
  }
});
