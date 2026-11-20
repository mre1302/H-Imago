'use strict';
/* eslint-disable no-unused-vars -- abrirDialogoConfig se usa desde index.js y proyecto.js */

/* H-IMAGO · Diálogo de configuración de la base de datos (compartido)
   Modo personal = SQLite local. Modo equipo = MySQL/MariaDB. */

async function abrirDialogoConfig({ alGuardar } = {}) {
  let cfg = {};
  try { cfg = (await llamar(api.configObtener())) || {}; } catch { /* sin configuración */ }
  if (cfg.avisoConfig) aviso(cfg.avisoConfig, 'error');
  const motorInicial = cfg.motor === 'mysql' ? 'mysql' : 'sqlite';

  const contenido = el('div', 'modal-contenido dialogo-config');
  contenido.appendChild(el('h3', 'modal-titulo', 'Configuración · Base de datos'));
  contenido.appendChild(el('p', 'modal-mensaje',
    'Modo personal: SQLite, sin servidor y sin configuración. '
    + 'Modo equipo: MySQL/MariaDB, para varias personas conectadas a la misma base.'));

  const campoMotor = el('div', 'campo campo-12');
  campoMotor.appendChild(el('label', '', 'Modo de trabajo'));
  const selMotor = el('select', 'entrada');
  selMotor.appendChild(new Option('Personal · SQLite (recomendado)', 'sqlite'));
  selMotor.appendChild(new Option('Equipo · MySQL/MariaDB', 'mysql'));
  selMotor.value = motorInicial;
  campoMotor.appendChild(selMotor);
  contenido.appendChild(campoMotor);

  /* Panel SQLite */
  const panelSqlite = el('div', 'campos-grid');
  const campoRuta = el('div', 'campo campo-12');
  campoRuta.appendChild(el('label', '', 'Archivo de la base de datos'));
  const entradaRuta = el('input', 'entrada');
  entradaRuta.value = cfg.ruta || '';
  entradaRuta.placeholder = 'Se usará la carpeta de datos de H-IMAGO';
  campoRuta.appendChild(entradaRuta);
  campoRuta.appendChild(el('div', 'pista',
    'Se crea automáticamente si no existe. Debe estar en la carpeta de datos de H-IMAGO, Documentos, Escritorio, Descargas o una carpeta temporal.'));
  panelSqlite.appendChild(campoRuta);
  contenido.appendChild(panelSqlite);

  /* Panel MySQL/MariaDB */
  const panelMysql = el('div', 'campos-grid');
  const entradasMysql = {};
  const camposMysql = [
    { clave: 'host', etiqueta: 'Servidor (host)', valor: cfg.host || '127.0.0.1' },
    { clave: 'port', etiqueta: 'Puerto', valor: cfg.port || 3306, tipo: 'numero' },
    { clave: 'user', etiqueta: 'Usuario', valor: cfg.user || 'root' },
    { clave: 'password', etiqueta: 'Contraseña', valor: '', tipo: 'password' },
    { clave: 'database', etiqueta: 'Base de datos', valor: cfg.database || 'himago' },
  ];
  for (const c of camposMysql) {
    const envoltura = el('div', 'campo campo-6');
    envoltura.appendChild(el('label', '', c.etiqueta));
    const entrada = el('input', 'entrada');
    entrada.value = c.valor;
    entrada.type = c.tipo === 'numero' ? 'number' : (c.tipo === 'password' ? 'password' : 'text');
    if (c.clave === 'password' && cfg.passwordConfigurada) {
      entrada.placeholder = '•••••• (guardada; déjala vacía para conservarla)';
    }
    entradasMysql[c.clave] = entrada;
    envoltura.appendChild(entrada);
    panelMysql.appendChild(envoltura);
  }
  panelMysql.appendChild(el('div', 'pista campo-12',
    'La base de datos se crea automáticamente si el usuario tiene permiso. '
    + 'Los proyectos de SQLite y de MariaDB son independientes: usa Exportar/Importar para trasladarlos.'));

  const campoSsl = el('div', 'campo campo-12');
  const labelSsl = el('label', '', '');
  const checkSsl = document.createElement('input');
  checkSsl.type = 'checkbox';
  const hostInicial = String(cfg.host || '127.0.0.1').trim().toLowerCase();
  const esHostLocal = (host) => ['localhost', '127.0.0.1', '::1', '[::1]'].includes(String(host || '').toLowerCase());
  checkSsl.checked = cfg.ssl === undefined ? !esHostLocal(hostInicial) : Boolean(cfg.ssl);
  labelSsl.append(checkSsl, document.createTextNode(' Cifrar la conexión con TLS'));
  campoSsl.appendChild(labelSsl);
  const checkVerificar = document.createElement('input');
  checkVerificar.type = 'checkbox';
  checkVerificar.checked = cfg.sslVerificar !== false;
  checkVerificar.disabled = !checkSsl.checked;
  const labelVerificar = el('label', '', '');
  labelVerificar.append(checkVerificar, document.createTextNode(' Verificar el certificado del servidor'));
  campoSsl.appendChild(labelVerificar);
  campoSsl.appendChild(el('div', 'pista',
    'Recomendado si el servidor MySQL/MariaDB no está en este equipo. '
    + 'Desactiva la verificación solo si el servidor usa un certificado autofirmado de confianza.'));
  panelMysql.appendChild(campoSsl);
  const campoCa = el('div', 'campo campo-12');
  campoCa.appendChild(el('label', '', 'CA del servidor (PEM, opcional)'));
  const entradaCa = el('textarea', 'entrada');
  entradaCa.rows = 4;
  entradaCa.placeholder = '-----BEGIN CERTIFICATE-----…';
  entradaCa.value = cfg.sslCa || '';
  campoCa.appendChild(entradaCa);
  campoCa.appendChild(el('div', 'pista',
    'Si el servidor usa una CA privada, pega aquí su certificado para verificarlo sin desactivar la seguridad.'));
  panelMysql.appendChild(campoCa);
  entradasMysql.sslCa = entradaCa;
  entradasMysql.ssl = checkSsl;
  entradasMysql.sslVerificar = checkVerificar;
  contenido.appendChild(panelMysql);

  let sslTocado = false;
  const actualizarSslSugerido = () => {
    if (sslTocado) return;
    checkSsl.checked = !esHostLocal(entradasMysql.host.value.trim());
    checkVerificar.disabled = !checkSsl.checked;
  };
  entradasMysql.host.addEventListener('change', actualizarSslSugerido);
  checkSsl.addEventListener('change', () => {
    sslTocado = true;
    checkVerificar.disabled = !checkSsl.checked;
  });

  function actualizarPaneles() {
    const sqlite = selMotor.value === 'sqlite';
    panelSqlite.hidden = !sqlite;
    panelMysql.hidden = sqlite;
  }
  selMotor.addEventListener('change', actualizarPaneles);
  actualizarPaneles();

  const estado = el('div', 'config-estado', '');
  contenido.appendChild(estado);

  const fila = el('div', 'modal-acciones');
  const btnProbar = el('button', 'btn', 'Probar conexión');
  const btnGuardar = el('button', 'btn btn-primario', 'Guardar y conectar');
  const btnCancelar = el('button', 'btn', 'Cancelar');
  fila.append(btnCancelar, btnProbar, btnGuardar);
  contenido.appendChild(fila);

  const { cerrar } = mostrarModal(contenido);
  btnCancelar.addEventListener('click', cerrar);

  const reunir = () => {
    if (selMotor.value === 'sqlite') {
      return { motor: 'sqlite', ruta: entradaRuta.value.trim() };
    }
    return {
      motor: 'mysql',
      host: entradasMysql.host.value.trim(),
      port: entradasMysql.port.value.trim() || 3306,
      user: entradasMysql.user.value.trim(),
      password: entradasMysql.password.value,
      database: entradasMysql.database.value.trim() || 'himago',
      ssl: Boolean(entradasMysql.ssl && entradasMysql.ssl.checked),
      sslVerificar: Boolean(entradasMysql.sslVerificar && entradasMysql.sslVerificar.checked),
      sslCa: entradasMysql.sslCa ? entradasMysql.sslCa.value.trim() : '',
      mantenerPassword: Boolean(cfg.passwordConfigurada && !entradasMysql.password.value),
    };
  };

  const configCambiada = (datos) => {
    if (datos.motor !== (cfg.motor === 'mysql' ? 'mysql' : 'sqlite')) return true;
    if (datos.motor === 'sqlite') return String(datos.ruta || '') !== String(cfg.ruta || '');
    return String(datos.host || '') !== String(cfg.host || '')
      || String(datos.port || 3306) !== String(cfg.port || 3306)
      || String(datos.user || '') !== String(cfg.user || '')
      || String(datos.password || '') !== String(cfg.password || '')
      || String(datos.database || 'himago') !== String(cfg.database || 'himago')
      || Boolean(datos.ssl) !== Boolean(cfg.ssl)
      || Boolean(datos.sslVerificar) !== (cfg.sslVerificar !== false)
      || String(datos.sslCa || '') !== String(cfg.sslCa || '');
  };

  btnProbar.addEventListener('click', async () => {
    estado.textContent = 'Probando conexión…';
    estado.className = 'config-estado';
    try {
      const datos = reunir();
      const info = await llamar(api.dbProbar(datos));
      if (datos.motor === 'sqlite') {
        estado.textContent = `Base local correcta · ${info.version} · ${info.ruta}`;
      } else {
        estado.textContent = `Conexión correcta · MySQL/MariaDB ${info.version} · base «${info.database}» lista.`;
      }
      estado.className = 'config-estado ok';
    } catch (err) {
      estado.textContent = err.message;
      estado.className = 'config-estado error';
    }
  });

  btnGuardar.addEventListener('click', async () => {
    const datos = reunir();
    const cambiada = configCambiada(datos);
    estado.textContent = 'Conectando…';
    estado.className = 'config-estado';
    try {
      const guardada = await llamar(api.configGuardar(datos));
      if (guardada && guardada.avisoConfig) aviso(guardada.avisoConfig, 'error');
      const r = await llamar(api.dbConectar());
      if (datos.motor === 'sqlite') {
        aviso('Trabajando en modo personal · base local SQLite', 'exito');
      } else {
        aviso(`Conectado a «${r.database}» en ${r.host}`, 'exito');
      }
      cerrar();
      if (alGuardar) alGuardar({ cambiada, config: datos });
    } catch (err) {
      estado.textContent = err.message;
      estado.className = 'config-estado error';
    }
  });
}
