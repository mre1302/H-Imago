'use strict';
/* eslint-disable no-unused-vars -- navegarARegistro se usa desde grafo.js */

/* H-IMAGO · Pantalla de proyecto: navegación entre secciones y acciones globales */

const params = new URLSearchParams(location.search);
const idProyecto = Number(params.get('id'));

let proyecto = null;
let moduloActual = null;
let seccionActual = null;
let salidaConfirmada = false;
let generacionNavegacion = 0;

const btnDeshacer = $('#btn-deshacer');
const btnCambios = $('#btn-cambios');

/* ------------------------------------------------------------------ */
/* Indicador de cambios y deshacer                                     */
/* ------------------------------------------------------------------ */

function actualizarIndicadorCambios() {
  const hay = !!(moduloActual && moduloActual.hayCambios && moduloActual.hayCambios());
  const puede = !!(moduloActual && moduloActual.puedeDeshacer && moduloActual.puedeDeshacer());
  btnCambios.classList.toggle('con-cambios', hay);
  btnCambios.classList.toggle('sin-cambios', !hay);
  btnCambios.title = hay ? 'Hay cambios sin guardar' : 'Sin cambios pendientes';
  btnCambios.setAttribute('aria-label', hay ? 'Hay cambios sin guardar' : 'Sin cambios pendientes');
  btnDeshacer.disabled = !puede;
  btnDeshacer.title = puede ? 'Deshacer último cambio (Ctrl+Z)' : 'No hay cambios que deshacer';
}

function deshacerProyecto() {
  if (!moduloActual || !moduloActual.deshacer) {
    aviso('Esta sección no admite deshacer.', 'info');
    return;
  }
  const ok = moduloActual.deshacer();
  actualizarIndicadorCambios();
  if (!ok) aviso('No hay cambios que deshacer.', 'info');
}

/* ------------------------------------------------------------------ */
/* Arranque                                                            */
/* ------------------------------------------------------------------ */

async function asegurarConexion() {
  const estado = await llamar(api.dbEstado());
  if (!estado.conectado) await llamar(api.dbConectar());
}

async function iniciarProyecto() {
  try {
    await asegurarConexion();
    proyecto = await llamar(api.proyectoObtener(idProyecto));
  } catch (err) {
    aviso(err.message, 'error');
    setTimeout(() => { location.href = 'index.html'; }, 1200);
    return;
  }
  refrescarTitulo();
  refrescarContadores();
  navegar('grafo');
}

function refrescarTitulo() {
  $('#titulo-proyecto').textContent = proyecto.nombre;
  document.title = `H-IMAGO · ${proyecto.nombre}`;
}

function pareceErrorDeConexion(mensaje) {
  return /sin conexi[oó]n|conectar|ECONNREFUSED|ENOTFOUND|PROTOCOL_CONNECTION_LOST|Connection lost|database is locked|SQLITE_BUSY|bloqueada|closed/i.test(String(mensaje || ''));
}

let avisoReconexionMostrado = false;

async function obtenerProyectoConReintento() {
  try {
    return await llamar(api.proyectoObtener(idProyecto));
  } catch (err) {
    if (!pareceErrorDeConexion(err.message)) throw err;
    await llamar(api.dbConectar());
    return llamar(api.proyectoObtener(idProyecto));
  }
}

async function refrescarContadores() {
  try {
    proyecto = await obtenerProyectoConReintento();
    const e = proyecto.estadisticas;
    $$('[data-cuenta]').forEach((span) => {
      const clave = span.dataset.cuenta;
      if (clave === 'geolocalizados') return; // se calcula en el módulo geo
      if (e[clave] !== undefined) span.textContent = e[clave];
    });
    avisoReconexionMostrado = false;
  } catch (err) {
    if (!avisoReconexionMostrado) {
      aviso(`Sin conexión con la base de datos: ${err.message}. Usa «Configuración» para reconectar.`, 'error');
      avisoReconexionMostrado = true;
    }
  }
}

/* ------------------------------------------------------------------ */
/* Navegación entre secciones                                          */
/* ------------------------------------------------------------------ */

async function navegar(seccion, opciones = {}) {
  const modulo = MODULOS[seccion];
  if (!modulo) return;
  const generacion = ++generacionNavegacion;

  if (moduloActual && moduloActual.hayCambios && moduloActual.hayCambios()) {
    const ok = await confirmar('Hay cambios sin guardar en esta sección. ¿Descartarlos?', 'Cambios sin guardar');
    if (!ok || generacion !== generacionNavegacion) return;
  }

  seccionActual = seccion;
  $$('.item-menu').forEach((b) => b.classList.toggle('activo', b.dataset.seccion === seccion));
  if (window.FechaHistorica && typeof window.FechaHistorica.cerrar === 'function') {
    window.FechaHistorica.cerrar();
  }

  if (moduloActual && moduloActual.desmontar) {
    try { moduloActual.desmontar(); } catch (err) { console.error('[navegar] desmontar:', err); }
  }
  const contenido = $('#contenido');
  contenido.innerHTML = '';
  moduloActual = modulo;
  try {
    await modulo.montar(contenido, proyecto, opciones);
  } catch (err) {
    if (generacion === generacionNavegacion) {
      contenido.appendChild(el('div', 'vacio error', `Error al cargar la sección: ${err.message}`));
    }
  }
  if (generacion !== generacionNavegacion) return;
  if (seccion !== 'geo') refrescarContadores();
  actualizarIndicadorCambios();
}

function navegarARegistro(tipo, id) {
  navegar(tipo, { seleccionar: { tipo, id } });
}

/* ------------------------------------------------------------------ */
/* Guardar proyecto (Ctrl+S) y acciones de barra                       */
/* ------------------------------------------------------------------ */

async function guardarProyecto() {
  const boton = $('#btn-guardar');
  if (boton) {
    if (boton.disabled) return;
    boton.disabled = true;
    boton.textContent = 'Guardando…';
  }
  try {
    if (moduloActual && moduloActual.guardarPendiente) {
      const guardado = await moduloActual.guardarPendiente();
      if (guardado === false) {
        aviso('No se pudieron guardar todos los cambios pendientes.', 'error');
        return;
      }
    }
    await llamar(api.proyectoGuardar(idProyecto));
    await refrescarContadores();
    actualizarIndicadorCambios();
    aviso('Proyecto guardado', 'exito');
  } catch (err) {
    aviso(`No se pudo guardar: ${err.message}`, 'error');
  } finally {
    if (boton) {
      boton.disabled = false;
      boton.textContent = 'Guardar proyecto';
    }
  }
}

$('#btn-guardar').addEventListener('click', guardarProyecto);
btnDeshacer.addEventListener('click', deshacerProyecto);
btnCambios.addEventListener('click', () => {
  const hay = !!(moduloActual && moduloActual.hayCambios && moduloActual.hayCambios());
  aviso(hay
    ? 'Hay cambios sin guardar en la ficha actual. Usa «Guardar proyecto» o Ctrl+S.'
    : 'No hay cambios pendientes.', hay ? 'info' : 'exito');
});
document.addEventListener('himago:cambios', actualizarIndicadorCambios);
document.addEventListener('himago:contadores', refrescarContadores);
document.addEventListener('keydown', (ev) => {
  const editable = ev.target && ev.target.closest
    && ev.target.closest('input, textarea, select, [contenteditable="true"]');
  if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === 's') {
    ev.preventDefault();
    guardarProyecto();
  }
  if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === 'z' && !editable) {
    if (moduloActual && moduloActual.puedeDeshacer && moduloActual.puedeDeshacer()) {
      ev.preventDefault();
      deshacerProyecto();
    }
  }
});
window.addEventListener('beforeunload', (ev) => {
  if (!salidaConfirmada && moduloActual && moduloActual.hayCambios && moduloActual.hayCambios()) {
    ev.preventDefault();
    ev.returnValue = '';
  }
});

$('#btn-inicio').addEventListener('click', async () => {
  if (moduloActual && moduloActual.hayCambios && moduloActual.hayCambios()) {
    const ok = await confirmar('Hay cambios sin guardar. ¿Salir de todas formas?', 'Cambios sin guardar');
    if (!ok) return;
  }
  salidaConfirmada = true;
  if (moduloActual && moduloActual.desmontar) moduloActual.desmontar();
  location.href = 'index.html';
});

$('#btn-config').addEventListener('click', () => {
  abrirDialogoConfig({
    alGuardar: ({ cambiada } = {}) => {
      if (!cambiada) {
        navegar(seccionActual);
        return;
      }
      salidaConfirmada = true;
      if (moduloActual && moduloActual.desmontar) {
        try { moduloActual.desmontar(); } catch { /* ya desmontado */ }
      }
      location.href = 'index.html';
    },
  });
});

$$('#menu .item-menu').forEach((boton) => {
  boton.addEventListener('click', () => navegar(boton.dataset.seccion));
});

/* Los módulos pueden pedir una navegación con destino concreto (por ejemplo,
   la Búsqueda general al abrir una entidad, un bloque o una transcripción). */
document.addEventListener('himago:navegar', (ev) => {
  const detalle = ev.detail || {};
  if (!detalle.seccion) return;
  navegar(detalle.seccion, detalle.opciones || {});
});

iniciarProyecto();
