'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');

const RAIZ = path.join(__dirname, '..', 'src', 'js');

function cargarBusqueda(override = null) {
  const dom = new JSDOM(`<!doctype html><html><body>
    <nav><span data-cuenta="busqueda"></span></nav>
    <div id="contenido"></div><div id="capa-modales"></div><div id="avisos"></div>
    <div id="zona-impresion"></div>
  </body></html>`, { runScripts: 'dangerously', url: 'http://localhost/', pretendToBeVisual: true });
  const { window } = dom;
  const respuesta = override || {
    generadoEn: new Date().toISOString(),
    totales: { entidades: 3, relaciones: 2, bloques: 1, cuadernos: 1, coincidencias: 1 },
    porTipoEntidad: { persona: 1, institucion: 1, lugar: 1, patrimonio: 0, fuente: 0 },
    tiposRelacion: [{ tipo: 'Miembro', total: 1 }, { tipo: 'Hermanos', total: 1 }],
    resultados: {
      entidades: [{
        tipo: 'persona', id: 1, identificador: 'PE00001',
        titulo: 'Ana Pérez', subtitulo: '1500 – 1560 · Escribana',
        snippet: 'Vecina de Medina del Campo', resaltados: [[10, 16]], resaltadosTitulo: [],
      }],
      relaciones: [{
        relacionId: 1, tipoRelacion: 'Miembro',
        origen: { tipo: 'persona', id: 1, nombre: 'Ana Pérez' },
        destino: { tipo: 'institucion', id: 2, nombre: 'Cabildo' },
        procedencia: 'MANUAL', anioInicio: 1520, anioFin: null,
        fechaInicio: '', fechaFin: '', lugarInicio: '', lugarFin: '', fuentes: [],
        titulo: 'Ana Pérez → Cabildo', subtitulo: 'Miembro · 1520 – ¿?',
        snippet: 'Ana Pérez → Cabildo', resaltados: [], resaltadosTitulo: [],
      }],
      bloques: [{
        bloqueId: 4, fuenteId: 5, fuenteTitulo: 'Protocolo', tipoBloque: 'Hojas de servicio',
        categoria: 'Registros', datosInvalidos: false,
        titulo: 'Hoja de servicio', subtitulo: 'Hojas de servicio · Protocolo',
        snippet: 'Bernardo Gil', resaltados: [], resaltadosTitulo: [],
      }],
      cuadernos: [{
        cuadernoId: 6, fuenteId: 5, fuenteTitulo: 'Protocolo', numero: 1,
        titulo: 'Transcripción · Protocolo', subtitulo: 'Cuaderno 1',
        snippet: 'En la ciudad de Sevilla…', resaltados: [], resaltadosTitulo: [],
      }],
      coincidencias: [{
        coincidenciaId: 7, tipo: 'persona', entidadA: 1, entidadB: 3,
        nombreA: 'Ana Pérez', nombreB: 'Bernardo Gil', notas: 'Posible parentesco',
        titulo: 'Ana Pérez ↔ Bernardo Gil', subtitulo: 'Posible coincidencia · persona',
        snippet: 'Posible parentesco', resaltados: [], resaltadosTitulo: [],
      }],
    },
    totalesBusqueda: { entidades: 1, relaciones: 1, bloques: 1, cuadernos: 1, coincidencias: 1, total: 5 },
    truncado: false,
  };
  window.__peticiones = [];
  window.api = {
    busquedaGlobal: async (_proyectoId, opciones) => {
      window.__peticiones.push(opciones);
      return { ok: true, datos: respuesta };
    },
  };
  for (const archivo of ['comun.js', 'modulos/taxonomia-relaciones.js', 'modulos/busqueda.js']) {
    const script = window.document.createElement('script');
    script.textContent = fs.readFileSync(path.join(RAIZ, archivo), 'utf8');
    window.document.head.appendChild(script);
  }
  return window;
}

test('UI de búsqueda: monta, explora, filtra y navega a una ficha', async () => {
  const window = cargarBusqueda();
  const cont = window.document.getElementById('contenido');
  await window.MODULOS.busqueda.montar(cont, { id: 1, nombre: 'Proyecto' }, {});
  await new Promise((r) => setTimeout(r, 40));

  assert.equal(cont.querySelector('.busqueda-titulo').textContent, 'Búsqueda general');
  assert.equal(cont.querySelectorAll('.busqueda-explorar-card').length, 5);
  assert.equal(window.document.querySelector('[data-cuenta="busqueda"]').textContent, '7');

  const entrada = cont.querySelector('.busqueda-entrada');
  entrada.value = 'medina';
  entrada.dispatchEvent(new window.Event('input', { bubbles: true }));
  await new Promise((r) => setTimeout(r, 400));

  assert.equal(cont.querySelectorAll('.busqueda-resultado').length, 5);
  assert.equal(cont.querySelector('mark').textContent, 'Medina');
  assert.match(cont.querySelector('.busqueda-estado').textContent, /5 resultados/);

  let navegacion = null;
  window.document.addEventListener('himago:navegar', (ev) => { navegacion = ev.detail; });
  cont.querySelector('.busqueda-resultado').click();
  assert.deepEqual(JSON.parse(JSON.stringify(navegacion)), {
    seccion: 'persona',
    opciones: { seleccionar: { tipo: 'persona', id: 1 } },
  });

  const chipLugares = [...cont.querySelectorAll('.busqueda-chip')]
    .find((b) => b.dataset.tipo === 'lugar');
  chipLugares.click();
  await new Promise((r) => setTimeout(r, 20));
  const ultima = window.__peticiones[window.__peticiones.length - 1];
  assert.deepEqual(Array.from(ultima.tiposEntidad), ['lugar']);
  assert.equal(chipLugares.getAttribute('aria-pressed'), 'true');

  window.MODULOS.busqueda.desmontar();
});

test('UI de búsqueda: sin relaciones el selector queda deshabilitado', async () => {
  const window = cargarBusqueda({
    generadoEn: new Date().toISOString(),
    totales: { entidades: 1, relaciones: 0, bloques: 0, cuadernos: 0, coincidencias: 0 },
    porTipoEntidad: { persona: 1, institucion: 0, lugar: 0, patrimonio: 0, fuente: 0 },
    tiposRelacion: [],
    resultados: { entidades: [], relaciones: [], bloques: [], cuadernos: [], coincidencias: [] },
    totalesBusqueda: { entidades: 0, relaciones: 0, bloques: 0, cuadernos: 0, coincidencias: 0, total: 0 },
    truncado: false,
  });
  const cont = window.document.getElementById('contenido');
  await window.MODULOS.busqueda.montar(cont, { id: 1, nombre: 'Proyecto' }, {});
  await new Promise((r) => setTimeout(r, 40));

  const select = cont.querySelector('#busqueda-tipo-relacion');
  assert.equal(select.disabled, true);
  assert.equal(select.options[0].textContent, 'Sin relaciones registradas');
  window.MODULOS.busqueda.desmontar();
});
