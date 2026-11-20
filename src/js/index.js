'use strict';

/* H-IMAGO · Pantalla de inicio (Index) */

/* ------------------------------------------------------------------ */
/* Estado de la conexión                                               */
/* ------------------------------------------------------------------ */

function ponerEstado(texto, conectado) {
  const punto = $('#estado-punto');
  const textoEl = $('#estado-texto');
  if (!punto || !textoEl) return;
  punto.className = `punto ${conectado ? 'verde' : 'rojo'}`;
  textoEl.textContent = texto;
}

async function comprobarConexion() {
  try {
    const cfg = await llamar(api.configObtener());
    if (!cfg) {
      ponerEstado('Base de datos sin configurar — abre «Configuración» para empezar.', false);
      return;
    }
    if (cfg.avisoConfig) aviso(cfg.avisoConfig, 'error');
    const descripcion = cfg.motor === 'mysql'
      ? `MySQL/MariaDB · base «${cfg.database}»`
      : 'base local SQLite';
    ponerEstado(`Conectando a ${descripcion}…`, false);
    const r = await llamar(api.dbConectar());
    ponerEstado(`Conectado · ${r.motor === 'mysql' ? `MySQL/MariaDB · base «${r.database}»` : 'base local SQLite'}`, true);
  } catch (err) {
    ponerEstado(`Sin conexión: ${err.message}`, false);
  }
}

/* ------------------------------------------------------------------ */
/* Lista de proyectos                                                  */
/* ------------------------------------------------------------------ */

function resumenProyecto(p) {
  const partes = [];
  if (p.n_personas) partes.push(`${p.n_personas} personas`);
  if (p.n_instituciones) partes.push(`${p.n_instituciones} instituciones`);
  if (p.n_lugares) partes.push(`${p.n_lugares} lugares`);
  if (p.n_patrimonios) partes.push(`${p.n_patrimonios} patrimonios`);
  if (p.n_fuentes) partes.push(`${p.n_fuentes} fuentes`);
  if (p.n_relaciones) partes.push(`${p.n_relaciones} relaciones`);
  return partes.length ? partes.join(' · ') : 'Proyecto vacío';
}

async function mostrarProyectos() {
  const panel = $('#panel-proyectos');
  const lista = $('#lista-proyectos');
  panel.hidden = false;
  lista.innerHTML = '<div class="vacio">Cargando proyectos…</div>';
  try {
    const proyectos = await llamar(api.proyectoListar());
    lista.innerHTML = '';
    if (!proyectos.length) {
      lista.innerHTML = '<div class="vacio">Aún no hay proyectos. Usa «Crear proyecto» para comenzar.</div>';
      return;
    }
    for (const p of proyectos) {
      const tarjeta = el('div', 'tarjeta-proyecto');
      tarjeta.tabIndex = 0;
      tarjeta.setAttribute('role', 'button');
      tarjeta.setAttribute('aria-label', `Abrir el proyecto ${p.nombre}`);

      const cuerpo = el('div', 'tarjeta-proyecto-cuerpo');
      cuerpo.appendChild(el('h3', '', p.nombre));
      if (p.creador) cuerpo.appendChild(el('div', 'meta', `Autoría: ${p.creador}`));
      if (p.descripcion) cuerpo.appendChild(el('p', 'descripcion', p.descripcion));
      cuerpo.appendChild(el('div', 'meta', resumenProyecto(p)));
      cuerpo.appendChild(el('div', 'meta suave',
        `Creado: ${formatearFecha(p.fecha_creacion)} · Última modificación: ${formatearFecha(p.fecha_modificacion)}`));
      tarjeta.appendChild(cuerpo);

      const acciones = el('div', 'tarjeta-proyecto-acciones');
      const btnAbrir = el('button', 'btn btn-primario', 'Abrir');
      btnAbrir.addEventListener('click', () => { location.href = `proyecto.html?id=${p.id}`; });
      const btnExportar = el('button', 'btn btn-mini', 'Exportar');
      btnExportar.addEventListener('click', async (ev) => {
        ev.stopPropagation();
        try {
          const r = await llamar(api.proyectoExportar(p.id));
          if (r && r.cancelado) return;
          aviso(`Proyecto exportado a ${r.ruta}`, 'exito');
        } catch (err) { aviso(err.message, 'error'); }
      });
      const btnEditarProyecto = el('button', 'btn btn-mini', 'Editar');
      btnEditarProyecto.addEventListener('click', (ev) => {
        ev.stopPropagation();
        dialogoEditarProyecto(p);
      });
      const btnBorrar = el('button', 'btn btn-peligroso btn-mini', 'Eliminar');
      btnBorrar.addEventListener('click', async (ev) => {
        ev.stopPropagation();
        const ok = await confirmar(
          `¿Eliminar el proyecto «${p.nombre}»? Se borrarán todos sus registros, fuentes y relaciones.`,
          'Eliminar proyecto'
        );
        if (!ok) return;
        try {
          await llamar(api.proyectoEliminar(p.id));
          aviso('Proyecto eliminado', 'exito');
          mostrarProyectos();
        } catch (err) { aviso(err.message, 'error'); }
      });
      acciones.append(btnAbrir, btnExportar, btnEditarProyecto, btnBorrar);
      tarjeta.appendChild(acciones);

      tarjeta.addEventListener('click', () => { location.href = `proyecto.html?id=${p.id}`; });
      tarjeta.addEventListener('keydown', (ev) => {
        if (ev.target === tarjeta && (ev.key === 'Enter' || ev.key === ' ')) {
          ev.preventDefault();
          location.href = `proyecto.html?id=${p.id}`;
        }
      });
      lista.appendChild(tarjeta);
    }
  } catch (err) {
    lista.innerHTML = `<div class="vacio error">${escaparHTML(err.message)}</div>`;
  }
}

/* ------------------------------------------------------------------ */
/* Crear proyecto                                                      */
/* ------------------------------------------------------------------ */

function dialogoCrearProyecto() {
  const contenido = el('div', 'modal-contenido');
  contenido.appendChild(el('h3', 'modal-titulo', 'Crear proyecto'));

  const c1 = el('div', 'campo');
  c1.appendChild(el('label', '', 'Nombre del proyecto *'));
  const inNombre = el('input', 'entrada');
  inNombre.placeholder = 'Ej.: Redes de poder en la Castilla del Quinientos';
  c1.appendChild(inNombre);
  contenido.appendChild(c1);

  const c0 = el('div', 'campo');
  c0.appendChild(el('label', '', 'Creador / autora'));
  const inCreador = el('input', 'entrada');
  inCreador.placeholder = 'Tu nombre o el del equipo responsable';
  inCreador.maxLength = 255;
  c0.appendChild(inCreador);
  contenido.appendChild(c0);

  const c2 = el('div', 'campo');
  c2.appendChild(el('label', '', 'Descripción'));
  const inDesc = el('textarea', 'entrada');
  inDesc.rows = 4;
  inDesc.placeholder = 'Objeto de estudio, periodo, corpus documental…';
  c2.appendChild(inDesc);
  contenido.appendChild(c2);

  const fila = el('div', 'modal-acciones');
  const btnNo = el('button', 'btn', 'Cancelar');
  const btnSi = el('button', 'btn btn-primario', 'Crear y abrir');
  fila.append(btnNo, btnSi);
  contenido.appendChild(fila);

  const { cerrar } = mostrarModal(contenido);
  btnNo.addEventListener('click', cerrar);

  let creando = false;
  const crear = async () => {
    if (creando) return;
    const nombre = inNombre.value.trim();
    if (!nombre) { aviso('El nombre del proyecto es obligatorio.', 'error'); return; }
    creando = true;
    btnSi.disabled = true;
    try {
      const proyecto = await llamar(api.proyectoCrear({
        nombre,
        descripcion: inDesc.value.trim(),
        creador: inCreador.value.trim(),
      }));
      aviso(`Proyecto «${proyecto.nombre}» creado`, 'exito');
      cerrar();
      location.href = `proyecto.html?id=${proyecto.id}`;
    } catch (err) {
      aviso(err.message, 'error');
    } finally {
      creando = false;
      if (btnSi.isConnected) btnSi.disabled = false;
    }
  };
  btnSi.addEventListener('click', crear);
  inNombre.addEventListener('keydown', (ev) => { if (ev.key === 'Enter') crear(); });
}

/* ------------------------------------------------------------------ */
/* Editar proyecto                                                     */
/* ------------------------------------------------------------------ */

function dialogoEditarProyecto(p) {
  const contenido = el('div', 'modal-contenido');
  contenido.appendChild(el('h3', 'modal-titulo', 'Editar proyecto'));

  const c1 = el('div', 'campo');
  c1.appendChild(el('label', '', 'Nombre del proyecto *'));
  const inNombre = el('input', 'entrada');
  inNombre.value = p.nombre || '';
  c1.appendChild(inNombre);
  contenido.appendChild(c1);

  const c2 = el('div', 'campo');
  c2.appendChild(el('label', '', 'Creador / autora'));
  const inCreador = el('input', 'entrada');
  inCreador.value = p.creador || '';
  inCreador.placeholder = 'Tu nombre o el del equipo responsable';
  c2.appendChild(inCreador);
  contenido.appendChild(c2);

  const c3 = el('div', 'campo');
  c3.appendChild(el('label', '', 'Descripción'));
  const inDesc = el('textarea', 'entrada');
  inDesc.rows = 4;
  inDesc.value = p.descripcion || '';
  c3.appendChild(inDesc);
  contenido.appendChild(c3);

  const fila = el('div', 'modal-acciones');
  const btnNo = el('button', 'btn', 'Cancelar');
  const btnSi = el('button', 'btn btn-primario', 'Guardar cambios');
  fila.append(btnNo, btnSi);
  contenido.appendChild(fila);

  const { cerrar } = mostrarModal(contenido);
  btnNo.addEventListener('click', cerrar);

  let guardando = false;
  const guardar = async () => {
    if (guardando) return;
    const nombre = inNombre.value.trim();
    if (!nombre) { aviso('El nombre del proyecto es obligatorio.', 'error'); return; }
    guardando = true;
    btnSi.disabled = true;
    try {
      await llamar(api.proyectoEditar(p.id, {
        nombre,
        creador: inCreador.value.trim(),
        descripcion: inDesc.value.trim(),
      }));
      aviso('Proyecto actualizado', 'exito');
      cerrar();
      mostrarProyectos();
    } catch (err) {
      aviso(err.message, 'error');
    } finally {
      guardando = false;
      if (btnSi.isConnected) btnSi.disabled = false;
    }
  };
  btnSi.addEventListener('click', guardar);
  inNombre.addEventListener('keydown', (ev) => { if (ev.key === 'Enter') guardar(); });
}

/* ------------------------------------------------------------------ */
/* Cableado de la interfaz                                             */
/* ------------------------------------------------------------------ */

$('#btn-crear').addEventListener('click', () => {
  if (!$('#estado-punto').classList.contains('verde')) {
    aviso('Sin conexión con la base de datos. Abre «Configuración» antes de crear proyectos.', 'error');
    return;
  }
  dialogoCrearProyecto();
});

$('#btn-abrir').addEventListener('click', () => {
  if (!$('#estado-punto').classList.contains('verde')) {
    aviso('Sin conexión con la base de datos. Abre «Configuración» para acceder a tus proyectos.', 'error');
    return;
  }
  mostrarProyectos();
});

$('#btn-salir').addEventListener('click', () => api.salir());

$('#btn-importar').addEventListener('click', async () => {
  if (!$('#estado-punto').classList.contains('verde')) {
    aviso('Sin conexión con la base de datos. Abre «Configuración» antes de importar.', 'error');
    return;
  }
  try {
    const r = await llamar(api.proyectoImportar());
    if (r && r.cancelado) return;
    aviso(`Proyecto «${r.proyecto.nombre}» importado`, 'exito');
    mostrarProyectos();
  } catch (err) { aviso(err.message, 'error'); }
});

$('#btn-estado-config').addEventListener('click', () => {
  abrirDialogoConfig({
    alGuardar: () => {
      const panel = $('#panel-proyectos');
      if (panel) panel.hidden = true;
      comprobarConexion();
    },
  });
});

comprobarConexion();
