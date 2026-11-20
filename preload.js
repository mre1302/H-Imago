'use strict';

const { contextBridge, ipcRenderer } = require('electron');

const invocar = (canal, ...args) => ipcRenderer.invoke(canal, ...args);

contextBridge.exposeInMainWorld('api', {
  salir: () => ipcRenderer.send('app:salir'),

  // Configuración y conexión
  configObtener: () => invocar('config:obtener'),
  configGuardar: (cfg) => invocar('config:guardar', cfg),
  dbConectar: (cfg) => invocar('db:conectar', cfg),
  dbProbar: (cfg) => invocar('db:probar', cfg),
  dbEstado: () => invocar('db:estado'),

  // Proyectos
  proyectoListar: () => invocar('proyecto:listar'),
  proyectoCrear: (datos) => invocar('proyecto:crear', datos),
  proyectoObtener: (id) => invocar('proyecto:obtener', id),
  proyectoEliminar: (id) => invocar('proyecto:eliminar', id),
  proyectoGuardar: (id) => invocar('proyecto:guardar', id),
  proyectoEditar: (id, datos) => invocar('proyecto:editar', id, datos),
  proyectoExportar: (id) => invocar('proyecto:exportar', id),
  proyectoImportar: () => invocar('proyecto:importar'),

  // Entidades (personas, instituciones, lugares, patrimonios, fuentes)
  entidadListar: (tipo, proyectoId) => invocar('entidad:listar', tipo, proyectoId),
  entidadListarResumen: (tipo, proyectoId) => invocar('entidad:listar-resumen', tipo, proyectoId),
  entidadObtener: (tipo, id, proyectoId) => invocar('entidad:obtener', tipo, id, proyectoId),
  entidadCrear: (tipo, proyectoId, datos) => invocar('entidad:crear', tipo, proyectoId, datos),
  entidadActualizar: (tipo, id, datos, proyectoId) => invocar('entidad:actualizar', tipo, id, datos, proyectoId),
  entidadEliminar: (tipo, id, proyectoId) => invocar('entidad:eliminar', tipo, id, proyectoId),
  entidadFusionar: (tipo, supervivienteId, absorbidaId, proyectoId) => invocar('entidad:fusionar', tipo, supervivienteId, absorbidaId, proyectoId),

  // Coincidencias (datos auxiliares)
  coincidenciaListar: (proyectoId) => invocar('coincidencia:listar', proyectoId),
  coincidenciaCrear: (datos, proyectoId) => invocar('coincidencia:crear', datos, proyectoId),
  coincidenciaEliminar: (id, proyectoId) => invocar('coincidencia:eliminar', id, proyectoId),

  // Relaciones
  relacionListar: (proyectoId) => invocar('relacion:listar', proyectoId),
  relacionListarDeEntidad: (proyectoId, tipo, id) => invocar('relacion:listar-entidad', proyectoId, tipo, id),
  relacionCrear: (datos, proyectoId) => invocar('relacion:crear', datos, proyectoId),
  relacionActualizar: (id, datos, proyectoId) => invocar('relacion:actualizar', id, datos, proyectoId),
  relacionEliminar: (id, proyectoId) => invocar('relacion:eliminar', id, proyectoId),

  // Cuadernos de transcripción (fuentes)
  cuadernoListar: (fuenteId, proyectoId) => invocar('cuaderno:listar', fuenteId, proyectoId),
  cuadernoCrear: (fuenteId, proyectoId) => invocar('cuaderno:crear', fuenteId, proyectoId),
  cuadernoActualizar: (id, datos, proyectoId) => invocar('cuaderno:actualizar', id, datos, proyectoId),
  cuadernoEliminar: (id, proyectoId) => invocar('cuaderno:eliminar', id, proyectoId),

  // Bloques de registro (fuentes)
  bloqueListar: (fuenteId, proyectoId) => invocar('bloque:listar', fuenteId, proyectoId),
  bloqueCrear: (fuenteId, datos, proyectoId) => invocar('bloque:crear', fuenteId, datos, proyectoId),
  bloqueActualizar: (id, datos, proyectoId) => invocar('bloque:actualizar', id, datos, proyectoId),
  bloqueEliminar: (id, proyectoId) => invocar('bloque:eliminar', id, proyectoId),
  bloqueExportar: (id, proyectoId) => invocar('bloque:exportar', id, proyectoId),
  bloqueImportar: (id, proyectoId) => invocar('bloque:importar', id, proyectoId),

  // Grafo
  grafoDatos: (proyectoId) => invocar('grafo:datos', proyectoId),

  // Búsqueda general
  busquedaGlobal: (proyectoId, opciones) => invocar('busqueda:global', proyectoId, opciones),
});
