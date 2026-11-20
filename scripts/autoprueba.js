'use strict';

function configurarAutoprueba({ app, ventana, fs }) {
    let etapa = 0;
    ventana.webContents.on('did-finish-load', async () => {
      const url = ventana.webContents.getURL();
      try {
        if (etapa === 0) {
          etapa = 1;
          const r = await ventana.webContents.executeJavaScript(`(async () => {
            const esperar = (ms) => new Promise((res) => setTimeout(res, ms));
            const salida = { pantalla: 'index', errores: [] };
            window.addEventListener('unhandledrejection', (e) => salida.errores.push('promesa: ' + String(e.reason)));
            for (let i = 0; i < 120 && !document.querySelector('#estado-punto.verde'); i++) await esperar(100);
            salida.conectado = !!document.querySelector('#estado-punto.verde');
            salida.estado = document.querySelector('#estado-texto')?.textContent || '';
            document.getElementById('btn-abrir').click();
            await esperar(1200);
            salida.tarjetasProyecto = document.querySelectorAll('.tarjeta-proyecto').length;
            const tarjeta = document.querySelector('.tarjeta-proyecto');
            salida.avisos = [...document.querySelectorAll('.toast')].map((t) => t.textContent);
            const btnEditarProyecto = tarjeta ? [...tarjeta.querySelectorAll('.btn')].find((b) => b.textContent === 'Editar') : null;
            if (btnEditarProyecto) {
              btnEditarProyecto.click();
              await esperar(300);
              const modal = document.querySelector('.modal');
              salida.editarProyecto = {
                abierto: !!modal,
                campos: modal ? modal.querySelectorAll('input, textarea').length : 0,
                nombre: modal?.querySelector('input')?.value || '',
              };
              const cancelarProyecto = modal ? [...modal.querySelectorAll('.modal-acciones .btn')].find((b) => b.textContent === 'Cancelar') : null;
              if (cancelarProyecto) cancelarProyecto.click();
              await esperar(200);
            }
            const btnConfig = document.getElementById('btn-estado-config');
            if (btnConfig) {
              btnConfig.click();
              await esperar(350);
              const modalConfig = [...document.querySelectorAll('.modal')].pop();
              const selMotor = modalConfig?.querySelector('.dialogo-config select');
              salida.configDialogo = {
                abierto: !!modalConfig,
                motor: selMotor?.value || null,
                opciones: selMotor ? [...selMotor.options].map((o) => o.value) : [],
              };
              if (selMotor) {
                const paneles = modalConfig.querySelectorAll('.dialogo-config .campos-grid');
                selMotor.value = 'mysql';
                selMotor.dispatchEvent(new Event('change', { bubbles: true }));
                await esperar(200);
                salida.configDialogo.panelSqliteOculto = !!paneles[0]?.hidden;
                salida.configDialogo.panelMysqlVisible = !paneles[1]?.hidden;
              }
              const cancelarConfig = modalConfig
                ? [...modalConfig.querySelectorAll('.modal-acciones .btn')].find((b) => b.textContent === 'Cancelar')
                : null;
              if (cancelarConfig) cancelarConfig.click();
              await esperar(250);
              salida.configDialogo.cerrado = !document.querySelector('.modal');
            }
            salida.preparadoParaAbrir = !!document.querySelector('.tarjeta-proyecto');
            return salida;
          })()`);
          console.log('[autoprueba:index]', JSON.stringify(r));
          if (process.env.HIMAGO_CAPTURA) {
            const imagen = await ventana.webContents.capturePage();
            await fs.promises.writeFile(process.env.HIMAGO_CAPTURA, imagen.toPNG());
            console.log('[captura] guardada en', process.env.HIMAGO_CAPTURA);
          }
          await ventana.webContents.executeJavaScript("document.querySelector('.tarjeta-proyecto')?.click()");
        } else {
          const r = await ventana.webContents.executeJavaScript(`(async () => {
            const esperar = (ms) => new Promise((res) => setTimeout(res, ms));
            const salida = { pantalla: 'proyecto', url: location.href, errores: [] };
            window.addEventListener('unhandledrejection', (e) => salida.errores.push('promesa: ' + String(e.reason)));
            await esperar(1600);
            salida.titulo = document.title;
            const marca = document.querySelector('.marca-mini');
            salida.marca = marca ? {
              imagenes: marca.querySelectorAll('img.marca-logo').length,
              visibles: [...marca.querySelectorAll('img.marca-logo')]
                .filter((i) => getComputedStyle(i).display !== 'none')
                .map((i) => i.getAttribute('src')),
              alto: marca.querySelector('img.marca-logo')?.getBoundingClientRect().height || null,
              texto: marca.textContent.trim(),
            } : null;
            const botonTema = document.querySelector('[data-tema-boton]');
            if (marca && botonTema) {
              botonTema.click();
              await esperar(250);
              salida.marcaClaro = [...marca.querySelectorAll('img.marca-logo')]
                .filter((i) => getComputedStyle(i).display !== 'none')
                .map((i) => i.getAttribute('src'));
              botonTema.click();
              await esperar(250);
            }
            salida.botonesMenu = document.querySelectorAll('.item-menu').length;
            salida.moduloInicial = document.getElementById('contenido')?.firstElementChild?.className || 'sin contenido';
            salida.avisos = [...document.querySelectorAll('.toast')].map((t) => t.textContent);
            salida.barraCambios = {
              deshacer: !!document.querySelector('#btn-deshacer'),
              campana: !!document.querySelector('#btn-cambios'),
              deshacerDeshabilitado: document.querySelector('#btn-deshacer')?.disabled ?? null,
              campanaSinCambios: document.querySelector('#btn-cambios')?.classList.contains('sin-cambios') ?? null,
            };
            const tDe = document.querySelector('.grafo-tiempo-controles input[data-campo="de"]');
            const tA = document.querySelector('.grafo-tiempo-controles input[data-campo="a"]');
            const tAfinar = [...document.querySelectorAll('.grafo-tiempo-controles .btn')].find((b) => b.textContent === 'Afinar intervalo');
            if (tDe && tA && tAfinar) {
              salida.grafoTiempo = {
                desdeInicial: document.querySelector('.anio-etiqueta.izq')?.textContent,
                hastaInicial: document.querySelector('.anio-etiqueta.der')?.textContent,
                contadorInicial: document.querySelector('.contador-grafo')?.textContent,
                marcas: [...document.querySelectorAll('.grafo-rango-marcas span')].map((s) => s.textContent),
              };
              tDe.value = '1475';
              tA.value = '1510';
              tAfinar.click();
              await esperar(300);
              salida.grafoTiempo.desde = document.querySelector('.anio-etiqueta.izq')?.textContent;
              salida.grafoTiempo.hasta = document.querySelector('.anio-etiqueta.der')?.textContent;
              salida.grafoTiempo.contador = document.querySelector('.contador-grafo')?.textContent;
              salida.grafoTiempo.valoresCampos = [tDe.value, tA.value];
              const rangoMin = document.querySelector('.grafo-rango input.rango-min');
              if (rangoMin) {
                rangoMin.value = '1490';
                rangoMin.dispatchEvent(new Event('input', { bubbles: true }));
                await esperar(250);
                salida.grafoTiempo.sliderDesde = document.querySelector('.anio-etiqueta.izq')?.textContent;
                salida.grafoTiempo.contadorSlider = document.querySelector('.contador-grafo')?.textContent;
              }
            }
            /* Filtros del grafo: entidades y categorías de relaciones */
            if (tDe && tA && tAfinar) {
              tDe.value = String(Number(tDe.min));
              tA.value = String(Number(tA.max));
              tAfinar.click();
              await esperar(250);
            }
            const chipsEntidad = [...document.querySelectorAll('.grafo-barra:not(.grafo-barra-relaciones) .chip')];
            const chipsRelacion = [...document.querySelectorAll('.grafo-barra-relaciones .chip')];
            const contadorTexto = () => document.querySelector('.contador-grafo')?.textContent || '';
            const cuentaRelaciones = (texto) => {
              const m = /([0-9]+) de ([0-9]+) relaciones/.exec(texto);
              return m ? Number(m[1]) : null;
            };
            const cuentaEntidades = (texto) => {
              const m = /Mostrando ([0-9]+) de ([0-9]+) entidades/.exec(texto);
              return m ? Number(m[1]) : null;
            };
            salida.grafoFiltros = {
              entidades: chipsEntidad.map((c) => c.textContent.trim()),
              relaciones: chipsRelacion.map((c) => c.textContent.trim()),
              contador: contadorTexto(),
            };
            const chipPersona = chipsEntidad[0];
            if (chipPersona) {
              const antes = cuentaEntidades(contadorTexto());
              chipPersona.click();
              await esperar(250);
              const despues = cuentaEntidades(contadorTexto());
              salida.grafoFiltros.entidadesAntes = antes;
              salida.grafoFiltros.entidadesDespues = despues;
              salida.grafoFiltros.reorganizaEntidades = antes != null && despues != null && despues < antes;
              chipPersona.click();
              await esperar(250);
            }
            const chipRelacion = chipsRelacion.find(
              (c) => Number(c.querySelector('.chip-cuenta')?.textContent || 0) > 0
            );
            if (chipRelacion) {
              const antes = cuentaRelaciones(contadorTexto());
              chipRelacion.click();
              await esperar(250);
              const despues = cuentaRelaciones(contadorTexto());
              salida.grafoFiltros.relacionesAntes = antes;
              salida.grafoFiltros.relacionesDespues = despues;
              salida.grafoFiltros.reorganizaRelaciones = antes != null && despues != null && despues < antes;
              chipRelacion.click();
              await esperar(250);
            }
            const infoGrafo = document.querySelector('.grafo-info');
            const botonTemaGrafo = document.querySelector('[data-tema-boton]');
            if (infoGrafo && botonTemaGrafo) {
              const leerInfo = () => ({
                fondo: getComputedStyle(infoGrafo).backgroundColor,
                color: getComputedStyle(infoGrafo).color,
              });
              salida.grafoInfoOscuro = leerInfo();
              botonTemaGrafo.click();
              await esperar(250);
              salida.grafoInfoClaro = leerInfo();
              botonTemaGrafo.click();
              await esperar(250);
            }
            const btnExportarGrafo = [...document.querySelectorAll('.grafo-acciones .btn')]
              .find((b) => b.textContent === 'Exportar PNG');
            if (btnExportarGrafo) {
              const clickOriginal = HTMLAnchorElement.prototype.click;
              let descarga = null;
              let descargaBlob = null;
              HTMLAnchorElement.prototype.click = function () {
                if (this.download === 'grafo-himago.png') {
                  descarga = this.href;
                  descargaBlob = fetch(this.href).then((r) => r.blob()).catch(() => null);
                  return;
                }
                return clickOriginal.apply(this, arguments);
              };
              btnExportarGrafo.click();
              await esperar(1500);
              HTMLAnchorElement.prototype.click = clickOriginal;
              const lienzoGrafo = document.querySelector('.grafo-canvas');
              if (descarga && descarga.startsWith('data:image/png;base64,')) {
                const bytes = atob(descarga.split(',')[1].slice(0, 40));
                const anchoPng = (bytes.charCodeAt(16) << 24) | (bytes.charCodeAt(17) << 16)
                  | (bytes.charCodeAt(18) << 8) | bytes.charCodeAt(19);
                const altoPng = (bytes.charCodeAt(20) << 24) | (bytes.charCodeAt(21) << 16)
                  | (bytes.charCodeAt(22) << 8) | bytes.charCodeAt(23);
                salida.grafoExport = {
                  ancho: anchoPng,
                  alto: altoPng,
                  anchoCanvas: lienzoGrafo?.width || null,
                  altoCanvas: lienzoGrafo?.height || null,
                  factor: lienzoGrafo && lienzoGrafo.width
                    ? +(anchoPng / lienzoGrafo.width).toFixed(2) : null,
                };
              } else if (descarga && descarga.startsWith('blob:') && descargaBlob) {
                const blob = await descargaBlob;
                const bitmap = blob ? await createImageBitmap(blob) : null;
                salida.grafoExport = {
                  ancho: bitmap ? bitmap.width : null,
                  alto: bitmap ? bitmap.height : null,
                  anchoCanvas: lienzoGrafo?.width || null,
                  altoCanvas: lienzoGrafo?.height || null,
                  factor: bitmap && lienzoGrafo?.width
                    ? +(bitmap.width / lienzoGrafo.width).toFixed(2) : null,
                  formato: 'blob',
                };
              } else {
                salida.grafoExport = { error: 'sin descarga' };
              }
            }
            const boton = document.querySelector('[data-seccion="persona"]');
            if (!boton) { salida.error = 'sin botón de Personas'; return salida; }
            boton.click();
            await esperar(900);
            salida.trasClicPersonas = document.getElementById('contenido')?.firstElementChild?.className || 'sin contenido';
            salida.errorModulo = document.querySelector('#contenido .vacio.error')?.textContent || '';
            const tituloEnt = document.querySelector('.ent-titulo');
            salida.tipografia = {
              cuerpo: getComputedStyle(document.body).fontFamily,
              titulo: tituloEnt ? getComputedStyle(tituloEnt).fontFamily : null,
            };
            salida.itemsLista = document.querySelectorAll('.ent-item').length;
            salida.directorio = !!document.querySelector('.tabla-directorio');
            salida.filasDirectorio = document.querySelectorAll('.tabla-directorio tbody tr').length;
            salida.letras = document.querySelectorAll('.letra').length;
            const barraAbecedario = document.querySelector('.directorio-abecedario');
            const envolturaTabla = document.querySelector('.directorio-tabla');
            salida.anchos = {
              abecedario: barraAbecedario?.clientWidth,
              tabla: envolturaTabla?.clientWidth,
              tablaInterior: document.querySelector('.tabla-directorio')?.clientWidth,
              desborda: (envolturaTabla?.scrollWidth || 0) > (envolturaTabla?.clientWidth || 0),
            };
            salida.cabeceras = [...document.querySelectorAll('.tabla-directorio thead th')].map((th) => th.textContent);
            salida.botonesDirectorio = document.querySelectorAll('.directorio .detalle-cabecera .btn').length;
            salida.botonBarra = [...document.querySelectorAll('.modulo-entidad .ent-barra .btn')].map((b) => b.textContent);
            const letraG = [...document.querySelectorAll('.letra')].find((b) => b.textContent === 'G');
            if (letraG) {
              letraG.click();
              await esperar(200);
              salida.filasTrasG = document.querySelectorAll('.tabla-directorio tbody tr').length;
              letraG.click();
              await esperar(200);
              salida.filasSinFiltro = document.querySelectorAll('.tabla-directorio tbody tr').length;
            }
            const primeraFila = document.querySelector('.tabla-directorio tbody tr');
            if (primeraFila) {
              primeraFila.click();
              await esperar(700);
              salida.camposFicha = document.querySelectorAll('.ent-detalle .campo').length;
              const campoLugarNac = [...document.querySelectorAll('.ent-detalle .campo')]
                .find((c) => c.querySelector('label')?.textContent === 'Lugar de nacimiento');
              const campoLugarDef = [...document.querySelectorAll('.ent-detalle .campo')]
                .find((c) => c.querySelector('label')?.textContent === 'Lugar de defunción');
              salida.lugaresPersona = {
                nacimiento: {
                  tag: campoLugarNac?.querySelector('select')?.tagName || null,
                  opciones: campoLugarNac?.querySelectorAll('option').length || 0,
                  valor: campoLugarNac?.querySelector('select')?.value || '',
                },
                defuncion: {
                  tag: campoLugarDef?.querySelector('select')?.tagName || null,
                  opciones: campoLugarDef?.querySelectorAll('option').length || 0,
                  valor: campoLugarDef?.querySelector('select')?.value || '',
                },
              };
              const campoUndo = [...document.querySelectorAll('.ent-detalle .campo')]
                .find((c) => c.querySelector('label')?.textContent === 'Ocupación / oficio');
              const inputUndo = campoUndo?.querySelector('input');
              const btnDeshacer = document.querySelector('#btn-deshacer');
              const btnCambios = document.querySelector('#btn-cambios');
              if (inputUndo && btnDeshacer && btnCambios) {
                const originalUndo = inputUndo.value;
                inputUndo.value = originalUndo + ' prueba-undo';
                inputUndo.dispatchEvent(new Event('input', { bubbles: true }));
                await esperar(450);
                salida.deshacer = {
                  campanaConCambios: btnCambios.classList.contains('con-cambios'),
                  deshacerHabilitado: !btnDeshacer.disabled,
                };
                btnDeshacer.click();
                await esperar(200);
                salida.deshacer.valorRestaurado = inputUndo.value === originalUndo;
                salida.deshacer.campanaSinCambios = btnCambios.classList.contains('sin-cambios');
                salida.deshacer.deshacerDeshabilitado = btnDeshacer.disabled;
              }
              salida.botonesDetalle = [...document.querySelectorAll('.detalle-acciones .btn')]
                .map((b) => b.textContent.trim());
              const btnImprimirFicha = [...document.querySelectorAll('.detalle-acciones .btn')]
                .find((b) => b.textContent.includes('IMPRIMIR'));
              if (btnImprimirFicha) {
                const printOriginal = window.print;
                let contenidoImpresion = '';
                window.print = () => {
                  contenidoImpresion = document.querySelector('#zona-impresion')?.textContent || '';
                };
                btnImprimirFicha.click();
                await esperar(200);
                window.print = printOriginal;
                salida.impresion = {
                  boton: btnImprimirFicha.textContent.trim(),
                  tieneDatos: contenidoImpresion.includes('Datos de la ficha'),
                  tieneRelaciones: contenidoImpresion.includes('Relaciones'),
                  longitud: contenidoImpresion.length,
                  zona: !!document.querySelector('#zona-impresion'),
                };
                const zonaImpresion = document.querySelector('#zona-impresion');
                if (zonaImpresion) zonaImpresion.innerHTML = '';
              }
              const labelCampo = document.querySelector('.campo label');
              salida.tipografia.etiqueta = labelCampo ? getComputedStyle(labelCampo).fontFamily : null;
              salida.errorDetalle = document.querySelector('.ent-detalle .vacio.error')?.textContent || '';
              salida.tipografia.transcripcion = getComputedStyle(document.querySelector('textarea') || document.body).fontFamily;
              salida.avisos2 = [...document.querySelectorAll('.toast')].map((t) => t.textContent);
              salida.relCats = [...document.querySelectorAll('.rel-cat')].map((b) => b.textContent);
              const gruposVoc = [...document.querySelectorAll('.form-relacion optgroup')]
                .map((g) => ({ categoria: g.label, tipos: [...g.children].map((o) => o.value) }));
              const vocClientelar = gruposVoc.find((g) => g.categoria === 'Clientelar');
              const vocInstitucional = gruposVoc.find((g) => g.categoria === 'Institucional');
              const vocLegal = gruposVoc.find((g) => g.categoria === 'Legal');
              salida.vocabulario = {
                total: gruposVoc.reduce((n, g) => n + g.tipos.length, 0),
                clientelarElectorElecto: !!vocClientelar?.tipos.includes('Elector – Electo'),
                institucionalElecto: !!vocInstitucional?.tipos.includes('Electo'),
                institucionalEscribanoNotario: !!vocInstitucional?.tipos.includes('Escribano/Notario'),
                legalOtorganteEscribanoNotario: !!vocLegal?.tipos.includes('Otorgante – Escribano/Notario'),
              };
              const relFam = [...document.querySelectorAll('.rel-cat')].find((b) => b.textContent === 'Familiares');
              const relTodas = [...document.querySelectorAll('.rel-cat')].find((b) => b.textContent === 'Todas');
              if (relFam) {
                relFam.click();
                await esperar(150);
                salida.relFiltrada = document.querySelectorAll('.lista-relaciones .relacion-item').length;
                salida.relVacio = !!document.querySelector('.lista-relaciones .vacio');
              }
              if (relTodas) {
                relTodas.click();
                await esperar(150);
                salida.relTodas = document.querySelectorAll('.lista-relaciones .relacion-item').length;
              }
              const primeraRel = document.querySelector('.lista-relaciones .relacion-item');
              if (primeraRel) {
                primeraRel.click();
                await esperar(250);
                const pista = document.querySelector('.pista-edicion');
                const guardarRel = document.querySelector('.form-relacion-botones .btn-primario');
                salida.edicionRelacion = {
                  pistaVisible: !!pista && !pista.hidden,
                  guardarHabilitado: !!guardarRel && !guardarRel.disabled,
                  marcada: !!document.querySelector('.relacion-item.seleccionada'),
                };
                const cancelarEdicion = pista ? [...pista.querySelectorAll('.btn')].find((b) => b.textContent === 'Cancelar edición') : null;
                if (cancelarEdicion) {
                  cancelarEdicion.click();
                  await esperar(200);
                  salida.edicionCancelada = document.querySelector('.form-relacion-botones .btn-primario')?.disabled;
                  salida.pistaOculta = document.querySelector('.pista-edicion')?.hidden;
                }
              }

              /* Campo FUENTES del formulario de relaciones */
              const btnFuentes = document.querySelector('.multi-fuentes-boton');
              const campoFuentes = document.querySelector('.form-relacion-fuentes');
              if (btnFuentes && campoFuentes) {
                const anchoForm = document.querySelector('.form-relacion-cuerpo')?.getBoundingClientRect().width || 0;
                const anchoIzquierda = document.querySelector('.form-relacion-izquierda')?.getBoundingClientRect().width || 0;
                const anchoCampo = campoFuentes.getBoundingClientRect().width || 0;
                btnFuentes.click();
                await esperar(150);
                const panelFuentes = document.querySelector('.multi-fuentes-panel');
                const checksFuentes = [...(panelFuentes?.querySelectorAll('input[type="checkbox"]') || [])];
                salida.fuentesRelacion = {
                  boton: btnFuentes.textContent.trim(),
                  panelVisible: !!panelFuentes && !panelFuentes.hidden,
                  opciones: checksFuentes.length,
                  titulos: [...document.querySelectorAll('.multi-fuentes-titulo')].map((s) => s.textContent),
                  anchoForm: Math.round(anchoForm),
                  anchoIzquierda: Math.round(anchoIzquierda),
                  anchoCampo: Math.round(anchoCampo),
                  proporcion: anchoForm ? +(anchoIzquierda / anchoForm).toFixed(2) : null,
                  filasNotas: document.querySelector('.form-relacion-notas textarea')?.rows || null,
                };
                if (checksFuentes[0]) {
                  checksFuentes[0].checked = true;
                  checksFuentes[0].dispatchEvent(new Event('change', { bubbles: true }));
                  await esperar(100);
                  salida.fuentesRelacion.seleccion = btnFuentes.textContent.trim();
                  checksFuentes[0].checked = false;
                  checksFuentes[0].dispatchEvent(new Event('change', { bubbles: true }));
                }
                btnFuentes.click();
              }

              const botonFecha = document.querySelector('.fecha-historica-boton');
              if (botonFecha) {
                botonFecha.click();
                await esperar(300);
                salida.fecha = {
                  popover: !!document.querySelector('.fh-popover'),
                  paneles: document.querySelectorAll('.fh-panel').length,
                  dias: document.querySelectorAll('.fh-dia').length,
                  detalleInicial: document.querySelector('.fh-detalle')?.textContent,
                };
                const dias = [...document.querySelectorAll('.fh-dia')];
                const diaElegido = dias[9];
                if (diaElegido) diaElegido.click();
                await esperar(200);
                salida.fecha.detalleSeleccion = document.querySelector('.fh-detalle')?.textContent;
                const aplicar = [...document.querySelectorAll('.fh-acciones .btn')].find((b) => b.textContent === 'Aplicar');
                if (aplicar) aplicar.click();
                await esperar(250);
                salida.fecha.valor = document.querySelector('.fecha-historica .entrada')?.value || '';
                salida.fecha.popoverCerrado = !document.querySelector('.fh-popover');
              }

              salida.identificador = document.querySelector('.identificador-entidad')?.textContent || '';
              const bloqueFusiones = document.querySelector('.bloque-fusiones');
              salida.fusiones = {
                bloque: !!bloqueFusiones,
                botones: [...document.querySelectorAll('.fusion-acciones .btn')].map((b) => b.textContent),
                opciones: [...document.querySelectorAll('.fusion-selector select option')].length,
              };
              const selComparar = document.querySelector('.fusion-selector select');
              const btnCoincidencia = [...document.querySelectorAll('.fusion-acciones .btn')]
                .find((b) => b.textContent === 'POSIBLE COINCIDENCIA');
              if (selComparar && btnCoincidencia && selComparar.options.length > 1) {
                selComparar.value = selComparar.options[1].value;
                btnCoincidencia.click();
                await esperar(250);
                const notasCoincidencia = document.querySelector('.coincidencia-form textarea');
                if (notasCoincidencia) notasCoincidencia.value = 'prueba automática';
                const btnRegistrarCoinc = [...document.querySelectorAll('.coincidencia-form .btn')]
                  .find((b) => b.textContent.includes('Registrar'));
                if (btnRegistrarCoinc) {
                  btnRegistrarCoinc.click();
                  await esperar(500);
                }
                salida.fusiones.coincidencias = document.querySelectorAll('.coincidencia-item').length;
                const btnBorrarCoinc = document.querySelector('.coincidencia-item .btn');
                if (btnBorrarCoinc) {
                  btnBorrarCoinc.click();
                  await esperar(300);
                  const modalCoinc = document.querySelector('.modal');
                  if (modalCoinc) {
                    const aceptarCoinc = [...modalCoinc.querySelectorAll('.modal-acciones .btn')]
                      .find((b) => b.textContent === 'Aceptar');
                    if (aceptarCoinc) aceptarCoinc.click();
                  }
                  await esperar(450);
                }
                salida.fusiones.coincidenciasFinales = document.querySelectorAll('.coincidencia-item').length;
              }
            }
            /* Relaciones manuales desde la ficha: ocupación → institución y
               propietario/titular → patrimonio. */
            const proyectoRelFicha = Number(new URLSearchParams(location.search).get('id'));
            let personaRelFicha = null;
            let patrimonioRelFicha = null;
            try {
              const btnNuevaPersona = [...document.querySelectorAll('.modulo-entidad .ent-barra .btn')]
                .find((b) => b.textContent.includes('Nueva persona'));
              if (btnNuevaPersona) {
                btnNuevaPersona.click();
                await esperar(500);
                const campoFicha = (etiqueta) => [...document.querySelectorAll('.ent-detalle .campo')]
                  .find((c) => c.querySelector('label')?.textContent === etiqueta);
                const inputFicha = (etiqueta) => campoFicha(etiqueta)?.querySelector('input');
                const nombreFicha = inputFicha('Nombre');
                if (nombreFicha) {
                  /* Se deja vacío a propósito: basta con los apellidos. */
                  nombreFicha.value = '';
                  nombreFicha.dispatchEvent(new Event('input', { bubbles: true }));
                }
                const apellidosFicha = inputFicha('Apellidos');
                if (apellidosFicha) {
                  apellidosFicha.value = 'Autoprueba';
                  apellidosFicha.dispatchEvent(new Event('input', { bubbles: true }));
                }
                const ocupacionFicha = inputFicha('Ocupación / oficio');
                if (ocupacionFicha) {
                  ocupacionFicha.value = 'Oficio autoprueba';
                  ocupacionFicha.dispatchEvent(new Event('input', { bubbles: true }));
                }
                const selInstitucionFicha = campoFicha('Institución (ocupación)')?.querySelector('select');
                const opcionInstitucion = selInstitucionFicha
                  ? [...selInstitucionFicha.options].find((o) => o.value)
                  : null;
                if (selInstitucionFicha && opcionInstitucion) {
                  selInstitucionFicha.value = opcionInstitucion.value;
                  selInstitucionFicha.dispatchEvent(new Event('change', { bubbles: true }));
                }
                const guardarFicha = [...document.querySelectorAll('.detalle-acciones .btn')]
                  .find((b) => b.textContent.trim() === 'Guardar');
                if (guardarFicha) { guardarFicha.click(); await esperar(1100); }
                const personasApi = await llamar(api.entidadListar('persona', proyectoRelFicha));
                personaRelFicha = personasApi.find(
                  (p) => p.apellidos === 'Autoprueba' && !p.nombre
                ) || null;
                salida.personaApellidosSinNombre = !!personaRelFicha;
                if (personaRelFicha && opcionInstitucion) {
                  const rels = await llamar(api.relacionListar(proyectoRelFicha));
                  const rel = rels.find((r) =>
                    r.origen_tipo === 'persona' && r.origen_id === personaRelFicha.id
                    && r.destino_tipo === 'institucion'
                    && r.destino_id === Number(opcionInstitucion.value)
                    && r.tipo === 'Miembro');
                  salida.relacionOcupacion = {
                    personaId: personaRelFicha.id,
                    institucionId: Number(opcionInstitucion.value),
                    creada: !!rel,
                    procedencia: rel?.procedencia || null,
                    tipo: rel?.tipo || null,
                  };
                }
              }

              /* Directorio: clasificación por APELLIDOS y, después, NOMBRES.
                 Se crean tres personas temporales y se comprueba su orden. */
              const sufijoOrden = String(Date.now()).slice(-6);
              const personasOrden = [];
              let ordenDirectorio = null;
              try {
                personasOrden.push(await llamar(api.entidadCrear('persona', proyectoRelFicha, {
                  apellidos: 'Zzz Orden ' + sufijoOrden, nombre: 'Ana',
                })));
                personasOrden.push(await llamar(api.entidadCrear('persona', proyectoRelFicha, {
                  apellidos: 'Zzz Orden ' + sufijoOrden, nombre: 'Bruno',
                })));
                personasOrden.push(await llamar(api.entidadCrear('persona', proyectoRelFicha, {
                  nombre: 'Zzz Orden C ' + sufijoOrden,
                })));
                const botonPersonasOrden = document.querySelector('[data-seccion="persona"]');
                if (botonPersonasOrden) {
                  botonPersonasOrden.click();
                  await esperar(900);
                }
                const filasDir = [...document.querySelectorAll('.tabla-directorio tbody tr')]
                  .map((tr) => [...tr.querySelectorAll('td')].map((td) => td.textContent.trim()));
                const indice = (apellidos, nombre) => filasDir
                  .findIndex((c) => c[0] === apellidos && c[1] === nombre);
                const iA = indice('Zzz Orden ' + sufijoOrden, 'Ana');
                const iB = indice('Zzz Orden ' + sufijoOrden, 'Bruno');
                const iC = indice('—', 'Zzz Orden C ' + sufijoOrden);
                ordenDirectorio = {
                  iA, iB, iC,
                  correcto: iA >= 0 && iB >= 0 && iC >= 0 && iA < iB && iB < iC,
                };
              } catch (err) {
                ordenDirectorio = { correcto: false, error: String(err.message || err) };
              } finally {
                salida.directorioOrdenPersonas = ordenDirectorio;
                for (const p of personasOrden) {
                  try { await llamar(api.entidadEliminar('persona', p.id)); } catch { /* limpieza */ }
                }
              }

              const botonPatrimonioFicha = document.querySelector('[data-seccion="patrimonio"]');
              if (botonPatrimonioFicha) {
                botonPatrimonioFicha.click();
                await esperar(900);
                const modalPatrimonio = document.querySelector('.modal');
                if (modalPatrimonio) {
                  const aceptar = [...modalPatrimonio.querySelectorAll('.modal-acciones .btn')]
                    .find((b) => b.textContent === 'Aceptar');
                  if (aceptar) aceptar.click();
                  await esperar(400);
                }
                const btnNuevoPatrimonio = [...document.querySelectorAll('.modulo-entidad .ent-barra .btn')]
                  .find((b) => b.textContent.includes('Nuevo patrimonio'));
                if (btnNuevoPatrimonio && personaRelFicha) {
                  btnNuevoPatrimonio.click();
                  await esperar(500);
                  const campoPatrimonio = (etiqueta) => [...document.querySelectorAll('.ent-detalle .campo')]
                    .find((c) => c.querySelector('label')?.textContent === etiqueta);
                  const nombrePatrimonio = campoPatrimonio('Nombre *')?.querySelector('input');
                  if (nombrePatrimonio) {
                    nombrePatrimonio.value = 'Patrimonio prueba relación manual';
                    nombrePatrimonio.dispatchEvent(new Event('input', { bubbles: true }));
                  }
                  const selPropietario = [...document.querySelectorAll('.ent-detalle .campo')]
                    .find((c) => c.querySelector('label')?.textContent.startsWith('Propietario / titular'))
                    ?.querySelector('select');
                  const etiquetaPropietario = [personaRelFicha.nombre, personaRelFicha.apellidos]
                    .filter(Boolean).join(' ');
                  if (selPropietario) {
                    selPropietario.value = etiquetaPropietario;
                    selPropietario.dispatchEvent(new Event('change', { bubbles: true }));
                  }
                  const guardarPatrimonio = [...document.querySelectorAll('.detalle-acciones .btn')]
                    .find((b) => b.textContent.trim() === 'Guardar');
                  if (guardarPatrimonio) { guardarPatrimonio.click(); await esperar(1100); }
                  const patrimoniosApi = await llamar(api.entidadListar('patrimonio', proyectoRelFicha));
                  patrimonioRelFicha = patrimoniosApi.find(
                    (p) => p.nombre === 'Patrimonio prueba relación manual'
                  ) || null;
                  if (patrimonioRelFicha) {
                    const rels = await llamar(api.relacionListar(proyectoRelFicha));
                    const rel = rels.find((r) =>
                      r.origen_tipo === 'persona' && r.origen_id === personaRelFicha.id
                      && r.destino_tipo === 'patrimonio'
                      && r.destino_id === patrimonioRelFicha.id
                      && r.tipo === 'Propietario');
                    salida.relacionPropietario = {
                      personaId: personaRelFicha.id,
                      patrimonioId: patrimonioRelFicha.id,
                      creada: !!rel,
                      procedencia: rel?.procedencia || null,
                      tipo: rel?.tipo || null,
                    };
                  }
                }
              }
            } catch (err) {
              salida.relacionesFichaError = String(err.message || err);
            } finally {
              if (patrimonioRelFicha) {
                try { await llamar(api.entidadEliminar('patrimonio', patrimonioRelFicha.id)); } catch { /* limpieza */ }
              }
              if (personaRelFicha) {
                try { await llamar(api.entidadEliminar('persona', personaRelFicha.id)); } catch { /* limpieza */ }
              }
            }

            const botonLugar = document.querySelector('[data-seccion="lugar"]');
            if (botonLugar) {
              botonLugar.click();
              await esperar(300);
              const modalLugar = document.querySelector('.modal');
              if (modalLugar) {
                const aceptarLugar = [...modalLugar.querySelectorAll('.modal-acciones .btn')]
                  .find((b) => b.textContent === 'Aceptar');
                if (aceptarLugar) aceptarLugar.click();
              }
              await esperar(900);
              salida.botonNuevoLugar = [...document.querySelectorAll('.modulo-entidad .ent-barra .btn')].map((b) => b.textContent);
            }
            const botonFuente = document.querySelector('[data-seccion="fuente"]');
            if (botonFuente) {
              botonFuente.click();
              await esperar(900);
              const btnNuevaF = [...document.querySelectorAll('.modulo-entidad .ent-barra .btn')].find((b) => b.textContent.includes('Nueva fuente'));
              if (btnNuevaF) {
                btnNuevaF.click();
                await esperar(400);
                const etiquetas = () => [...document.querySelectorAll('.campo label')].map((l) => l.textContent);
                const selDe = (et) => [...document.querySelectorAll('.campo')]
                  .find((c) => c.querySelector('label')?.textContent === et)?.querySelector('select');
                const cambiar = async (categoria, tipo) => {
                  const selC = selDe('Categoría');
                  if (!selC) return;
                  selC.value = categoria;
                  selC.dispatchEvent(new Event('change', { bubbles: true }));
                  await esperar(150);
                  if (tipo) {
                    const selT = selDe('Tipo de fuente');
                    if (selT) {
                      selT.value = tipo;
                      selT.dispatchEvent(new Event('change', { bubbles: true }));
                      await esperar(150);
                    }
                  }
                };
                salida.fuentes = {
                  categorias: selDe('Categoría')?.options.length - 1,
                  gruposTipoTotales: selDe('Tipo de fuente')?.querySelectorAll('optgroup').length,
                  tiposTotales: selDe('Tipo de fuente')?.options.length - 1,
                  general: etiquetas(),
                };
                await cambiar('Registros vitales', null);
                salida.fuentes.tiposRegistrosVitales = selDe('Tipo de fuente')?.options.length - 1;
                await cambiar('Bibliografía', 'Libros');
                salida.fuentes.libro = etiquetas();
                await cambiar('Bibliografía', 'Capítulos de libro');
                salida.fuentes.capitulo = etiquetas();
                await cambiar('Bibliografía', 'Artículos académicos');
                salida.fuentes.articulo = etiquetas();
                await cambiar('Bibliografía', 'Actas, presentaciones y conferencias');
                salida.fuentes.actas = etiquetas();
                await cambiar('Bibliografía', 'Tesis');
                salida.fuentes.tesis = etiquetas();

                /* Cuadernos: sobre una fuente existente */
                const menuFuente = document.querySelector('[data-seccion="fuente"]');
                menuFuente.click();
                await esperar(300);
                const modalF = document.querySelector('.modal');
                if (modalF) {
                  const aceptarF = [...modalF.querySelectorAll('.modal-acciones .btn')].find((b) => b.textContent === 'Aceptar');
                  if (aceptarF) aceptarF.click();
                }
                await esperar(900);
                const filaFuente = document.querySelector('.tabla-directorio tbody tr');
                if (filaFuente) {
                  filaFuente.click();
                  await esperar(800);
                  const btnAddCuaderno = [...document.querySelectorAll('.cuadernos-barra .btn')]
                    .find((b) => b.textContent.includes('Añadir cuaderno'));
                  salida.cuadernos = {
                    boton: !!btnAddCuaderno,
                    botonBloque: [...document.querySelectorAll('.cuadernos-barra .btn')]
                      .some((b) => b.textContent.includes('bloque de registro')),
                  };
                  if (btnAddCuaderno) {
                    btnAddCuaderno.click();
                    await esperar(600);
                    const tarjetaC = [...document.querySelectorAll('.cuaderno')].pop();
                    const ta = tarjetaC?.querySelector('.cuaderno-texto');
                    salida.cuadernos.creado = !!ta;
                    if (ta) {
                      ta.value = 'linea uno\\nlinea dos\\nlinea tres';
                      ta.dispatchEvent(new Event('input', { bubbles: true }));
                      const btnNum = [...tarjetaC.querySelectorAll('.cuaderno-herramientas .btn')]
                        .find((b) => b.textContent === 'NUMERAR LÍNEAS');
                      btnNum.click();
                      await esperar(200);
                      salida.cuadernos.numeros = tarjetaC.querySelector('.cuaderno-numeros')?.textContent;
                      const btnFoja = [...tarjetaC.querySelectorAll('.cuaderno-herramientas .btn')]
                        .find((b) => b.textContent === 'INSERTAR FOJA');
                      ta.setSelectionRange(ta.value.length, ta.value.length);
                      btnFoja.click();
                      await esperar(200);
                      salida.cuadernos.numerosConFoja = tarjetaC.querySelector('.cuaderno-numeros')?.textContent;
                      const btnGuardarC = [...tarjetaC.querySelectorAll('.cuaderno-acciones .btn')]
                        .find((b) => b.textContent === 'GUARDAR');
                      btnGuardarC.click();
                      await esperar(500);
                      const btnEliminarC = [...tarjetaC.querySelectorAll('.cuaderno-acciones .btn')]
                        .find((b) => b.textContent === 'ELIMINAR');
                      btnEliminarC.click();
                      await esperar(300);
                      const modalC = document.querySelector('.modal');
                      if (modalC) {
                        const okC = [...modalC.querySelectorAll('.modal-acciones .btn')].find((b) => b.textContent === 'Aceptar');
                        if (okC) okC.click();
                      }
                      await esperar(500);
                      salida.cuadernos.eliminado = document.querySelectorAll('.cuaderno').length;
                    }
                  }

                  const btnBloqueR = [...document.querySelectorAll('.cuadernos-barra .btn')]
                    .find((b) => b.textContent.includes('bloque de registro'));
                  salida.bloques = { boton: !!btnBloqueR };
                  if (btnBloqueR) {
                    btnBloqueR.click();
                    await esperar(250);
                    const periodos = [...document.querySelectorAll('.bloques-periodo')];
                    salida.bloques.periodos = periodos.map((b) => ({
                      texto: b.textContent,
                      deshabilitado: b.disabled,
                    }));
                    salida.bloques.filtros = document.querySelectorAll('.bloques-filtro').length;
                    salida.bloques.etiquetasEspaciales = [...document.querySelectorAll('.bloques-region')].map((b) => ({
                      texto: b.textContent,
                      activo: b.classList.contains('activo'),
                      deshabilitado: b.disabled,
                    }));
                    salida.bloques.contexto = document.querySelector('.bloques-contexto')?.textContent || '';
                    const habilitado = periodos.find((b) => !b.disabled);
                    if (habilitado) {
                      habilitado.click();
                      await esperar(300);
                      salida.bloques.opciones = document.querySelectorAll('.bloque-opcion').length;
                      salida.bloques.grupos = [...document.querySelectorAll('.bloques-grupo-titulo')]
                        .map((g) => g.textContent);
                      const primeraOpcion = document.querySelector('.bloque-opcion');
                      if (primeraOpcion) {
                        const tarjetasAntesB = document.querySelectorAll('.bloque-registrado').length;
                        primeraOpcion.click();
                        await esperar(1400);
                        const tarjetaB = document.querySelectorAll('.bloque-registrado').length > tarjetasAntesB
                          ? [...document.querySelectorAll('.bloque-registrado')].pop()
                          : null;
                        for (let i = 0; i < 20 && !tarjetaB?.querySelector('.form-bloque'); i++) await esperar(200);
                        const formB = tarjetaB?.querySelector('.form-bloque');
                        salida.bloques.formulario = !!formB;
                        salida.bloques.errorCuerpo = tarjetaB?.querySelector('.bloque-cuerpo .vacio.error')?.textContent || '';
                        salida.bloques.secciones = formB
                          ? formB.querySelectorAll('.seccion-bloque, .subseccion-bloque').length : 0;
                        salida.bloques.campos = formB
                          ? formB.querySelectorAll('.bloque-campos .campo').length : 0;
                        salida.bloques.personas = formB
                          ? formB.querySelectorAll('.fila-persona').length : 0;
                        salida.bloques.filasCampos = formB
                          ? [...formB.querySelectorAll(':scope > .bloque-campos')]
                            .map((fila) => fila.querySelectorAll('.campo').length)
                          : [];
                        const filaDatos = formB?.querySelectorAll(':scope > .bloque-campos')[1];
                        if (filaDatos) {
                          salida.bloques.anchosFilaDatos = [...filaDatos.querySelectorAll('.campo')]
                            .map((c) => [...c.classList].find((x) => /^campo-[0-9]+$/.test(x)));
                        }
                        const primerRol = formB?.querySelector('.bloque-personas');
                        if (primerRol) {
                          salida.bloques.lineasPrimerRol = primerRol.querySelectorAll('.persona-linea').length;
                          salida.bloques.botonesAnadirPersona = primerRol.querySelectorAll('.btn[title="Añadir persona"]').length;
                          salida.bloques.botonesQuitarPersona = primerRol.querySelectorAll('.btn[title="Quitar persona"]').length;
                          salida.bloques.botonesAnadirEmpleo = primerRol.querySelectorAll('.btn[title="Añadir empleo"]').length;
                          salida.bloques.botonesEliminarEmpleo = primerRol.querySelectorAll('.btn[title="Eliminar empleo"]').length;
                          const btnAddEmpleo = primerRol.querySelector('.btn[title="Añadir empleo"]');
                          if (btnAddEmpleo) {
                            btnAddEmpleo.click();
                            await esperar(300);
                          }
                          salida.bloques.lineasTrasAnadirEmpleo = primerRol.querySelectorAll('.persona-linea').length;
                          salida.bloques.empleosTrasAnadir = primerRol.querySelectorAll('.btn[title="Eliminar empleo"]').length;
                          const btnDelEmpleo = [...primerRol.querySelectorAll('.btn[title="Eliminar empleo"]')][1];
                          if (btnDelEmpleo) {
                            btnDelEmpleo.click();
                            await esperar(300);
                          }
                          salida.bloques.lineasTrasEliminarEmpleo = primerRol.querySelectorAll('.persona-linea').length;
                          salida.bloques.vincularInstitucion = [...primerRol.querySelectorAll('.campo label')]
                            .some((l) => l.textContent === 'VINCULAR INSTITUCIÓN');
                          salida.bloques.rolesPersonas = formB
                            ? formB.querySelectorAll('.bloque-personas').length : 0;
                          salida.bloques.totalBotonesEmpleo = formB
                            ? formB.querySelectorAll('.btn[title="Añadir empleo"]').length : 0;
                          salida.bloques.rolesConVinculos = formB
                            ? formB.querySelectorAll('.persona-vinculos').length : 0;
                          const areas = formB ? [...formB.querySelectorAll('.campo')] : [];
                          const areaDe = (nombre) => areas.find((c) => c.querySelector('label')?.textContent === nombre)?.querySelector('textarea');
                          salida.bloques.filasMateria = areaDe('MATERIA')?.rows || null;
                          salida.bloques.filasNotas = areaDe('NOTAS')?.rows || null;
                          salida.bloques.botonCrearInstitucion = [...primerRol.querySelectorAll('.btn')]
                            .some((b) => b.textContent.includes('Crear institución'));
                          const campoInstitucion = [...primerRol.querySelectorAll('.campo')]
                            .find((c) => c.querySelector('label')?.textContent === 'INSTITUCIÓN');
                          salida.bloques.institucionEsTexto = !!campoInstitucion?.querySelector('input');
                        }
                        if (tarjetaB) {
                          salida.bloques.contextoTarjeta = tarjetaB.querySelector('.bloque-contexto')?.textContent || '';
                          const btnGuardarB = [...tarjetaB.querySelectorAll('.bloque-registrado-acciones .btn')]
                            .find((b) => b.textContent === 'GUARDAR');
                          if (btnGuardarB && !btnGuardarB.hidden) { btnGuardarB.click(); await esperar(1600); }
                          const btnEliminarB = [...tarjetaB.querySelectorAll('.bloque-registrado-acciones .btn')]
                            .find((b) => b.textContent === 'ELIMINAR');
                          salida.bloques.eliminarVisible = btnEliminarB ? !btnEliminarB.hidden : null;
                          salida.bloques.botonesVisibles = [...tarjetaB.querySelectorAll('.bloque-registrado-acciones .btn')]
                            .filter((b) => !b.hidden)
                            .map((b) => b.textContent);
                          const botonesB = [...tarjetaB.querySelectorAll('.bloque-registrado-acciones .btn')].map((b) => b.textContent);
                          const iEditar = botonesB.indexOf('EDITAR');
                          const iImportar = botonesB.indexOf('IMPORTAR');
                          const iDescargar = botonesB.indexOf('DESCARGAR');
                          const iEliminar = botonesB.indexOf('ELIMINAR');
                          salida.bloques.ordenImportarDescargar = iEditar >= 0
                            && iImportar > iEditar && iDescargar > iImportar && iEliminar > iDescargar;
                          if (btnEliminarB && !btnEliminarB.hidden) {
                            btnEliminarB.click();
                            await esperar(400);
                            const modalB = document.querySelector('.modal');
                            salida.bloques.modalEliminar = !!modalB;
                            if (modalB) {
                              const okB = [...modalB.querySelectorAll('.modal-acciones .btn')].find((b) => b.textContent === 'Aceptar');
                              if (okB) okB.click();
                            }
                            await esperar(700);
                            salida.bloques.avisoBorrado = [...document.querySelectorAll('.toast')]
                              .map((t) => t.textContent).pop() || '';
                          }
                        }
                        salida.bloques.tarjetasFinales = document.querySelectorAll('.bloque-registrado').length;
                      }

                      /* Procesos judiciales: grupos con roles y empleos */
                      const btnAddBloque2 = [...document.querySelectorAll('.cuadernos-barra .btn')]
                        .find((b) => b.textContent.includes('Añadir bloque de registro'));
                      if (btnAddBloque2) btnAddBloque2.click();
                      await esperar(300);
                      const periodoActivo = [...document.querySelectorAll('.bloques-periodo')].find((b) => !b.disabled);
                      if (periodoActivo) { periodoActivo.click(); await esperar(400); }
                      const opcionProcesos = [...document.querySelectorAll('.bloque-opcion')]
                        .find((b) => b.textContent === 'Procesos judiciales');
                      if (opcionProcesos) {
                        opcionProcesos.click();
                        await esperar(1200);
                        salida.procesos = {
                          grupos: document.querySelectorAll('.form-bloque .grupo-bloque').length,
                          instancias: document.querySelectorAll('.form-bloque .grupo-instancia').length,
                          rolesEnGrupos: document.querySelectorAll('.form-bloque .grupo-instancia .bloque-personas').length,
                          botonesEmpleo: document.querySelectorAll('.form-bloque .grupo-instancia .btn[title="Añadir empleo"]').length,
                        };
                        const formP = document.querySelector('.form-bloque');
                        const campoP = (etiqueta) => [...(formP?.querySelectorAll('.campo') || [])]
                          .find((c) => c.querySelector('label')?.textContent === etiqueta);
                        const seleccionarOpcionP = (sel, indice = 1) => {
                          if (!sel) return;
                          const opciones = [...sel.options].filter((o) => o.value);
                          if (opciones[indice - 1]) sel.value = opciones[indice - 1].value;
                          sel.dispatchEvent(new Event('change', { bubbles: true }));
                        };
                        const fijarSelectP = (etiqueta, indice = 1) => {
                          seleccionarOpcionP(campoP(etiqueta)?.querySelector('select'), indice);
                        };
                        const fijarEntradaP = (etiqueta, valor) => {
                          const input = campoP(etiqueta)?.querySelector('input');
                          if (!input) return;
                          input.value = valor;
                          input.dispatchEvent(new Event('input', { bubbles: true }));
                          input.dispatchEvent(new Event('change', { bubbles: true }));
                        };
                        const vincularRolP = (rol, indicePersona, indiceInstitucion) => {
                          const fila = rol?.querySelector(':scope > .filas-persona > .fila-persona');
                          if (!fila) return;
                          const campoFila = (etiqueta) => [...fila.querySelectorAll('.campo')]
                            .find((c) => c.querySelector('label')?.textContent === etiqueta);
                          seleccionarOpcionP(
                            campoFila('VINCULAR PERSONA')?.querySelector('select'), indicePersona
                          );
                          seleccionarOpcionP(
                            campoFila('VINCULAR INSTITUCIÓN')?.querySelector('select'), indiceInstitucion
                          );
                        };
                        const rolesTopP = [...(formP?.querySelectorAll(':scope > .bloque-personas') || [])];
                        const rolTopP = (titulo) => rolesTopP.find(
                          (r) => r.querySelector('.rol-titulo')?.textContent === titulo
                        );
                        fijarSelectP('LUGAR');
                        fijarSelectP('INSTITUCIÓN');
                        fijarEntradaP('DESDE', '1726');
                        fijarEntradaP('FECHA EXACTA (desde)', '06-07-1726');
                        vincularRolP(rolTopP('JUECES'), 1, 1);
                        vincularRolP(rolTopP('DEMANDANTES'), 2, 2);
                        vincularRolP(rolTopP('DEMANDADOS'), 3, 3);
                        vincularRolP(rolTopP('TERCEROS'), 4, 4);
                        const instanciasP = [...(formP?.querySelectorAll('.grupo-instancia') || [])];
                        const rolGrupoP = (indice, titulo) => {
                          const rol = [...(instanciasP[indice]?.querySelectorAll('.bloque-personas') || [])]
                            .find((r) => r.querySelector('.rol-titulo')?.textContent === titulo);
                          return rol;
                        };
                        vincularRolP(rolGrupoP(0, 'PRODUCTOR'), 5, 5);
                        vincularRolP(rolGrupoP(0, 'DESTINATARIO'), 1, 2);
                        vincularRolP(rolGrupoP(1, 'PRODUCTOR'), 2, 3);
                        vincularRolP(rolGrupoP(1, 'DESTINATARIO'), 3, 4);
                        vincularRolP(rolGrupoP(2, 'PRODUCTOR'), 4, 5);
                        vincularRolP(rolGrupoP(2, 'DESTINATARIO'), 5, 1);
                        const tarjetaP = [...document.querySelectorAll('.bloque-registrado')].pop();
                        if (tarjetaP) {
                          const guardarP = [...tarjetaP.querySelectorAll('.bloque-registrado-acciones .btn')]
                            .find((b) => b.textContent === 'GUARDAR');
                          if (guardarP) { guardarP.click(); await esperar(1200); }
                          const proyectoP = Number(new URLSearchParams(location.search).get('id'));
                          const todasRelP = await llamar(api.relacionListar(proyectoP));
                          const autosP = todasRelP.filter(
                            (r) => String(r.bloque_id) === String(tarjetaP.dataset.bloqueId)
                          );
                          salida.procesosAuto = {
                            bloqueId: tarjetaP.dataset.bloqueId,
                            total: autosP.length,
                            tipos: autosP.map((r) => r.tipo),
                            reglas: autosP.map((r) => r.regla).sort(),
                            destinos: autosP.map(
                              (r) => r.origen_tipo + ':' + r.origen_id + '->' + r.destino_tipo + ':' + r.destino_id
                            ),
                            procedencias: [...new Set(autosP.map((r) => r.procedencia))],
                            fuentes: autosP.map((r) => (r.fuentes || []).length),
                            fechas: autosP.map((r) => r.fecha_exacta_inicio),
                          };
                          const eliminarP = [...tarjetaP.querySelectorAll('.bloque-registrado-acciones .btn')]
                            .find((b) => b.textContent === 'ELIMINAR');
                          if (eliminarP) {
                            eliminarP.click();
                            await esperar(300);
                            const modalP = [...document.querySelectorAll('.modal')].pop();
                            if (modalP) {
                              const okP = [...modalP.querySelectorAll('.modal-acciones .btn')]
                                .find((b) => b.textContent === 'Aceptar');
                              if (okP) okP.click();
                            }
                            await esperar(600);
                          }
                          const trasP = await llamar(api.relacionListar(proyectoP));
                          salida.procesosAuto.restos = trasP
                            .filter((r) => String(r.bloque_id) === String(tarjetaP.dataset.bloqueId)).length;
                        }
                        salida.procesos.restos = document.querySelectorAll('.bloque-registrado').length;
                      }

                      /* Hojas de servicio: roles, soldado sin botones e instituciones */
                      if (btnAddBloque2) btnAddBloque2.click();
                      await esperar(300);
                      const periodoActivo2 = [...document.querySelectorAll('.bloques-periodo')].find((b) => !b.disabled);
                      if (periodoActivo2) { periodoActivo2.click(); await esperar(400); }
                      const opcionHojas = [...document.querySelectorAll('.bloque-opcion')]
                        .find((b) => b.textContent === 'Hojas de servicio');
                      if (opcionHojas) {
                        opcionHojas.click();
                        await esperar(1200);
                        const rolesHojas = [...document.querySelectorAll('.form-bloque .bloque-personas')];
                        salida.hojas = {
                          formulario: !!document.querySelector('.form-bloque'),
                          roles: rolesHojas.length,
                          autoridadConEmpleo: rolesHojas[0]?.querySelectorAll('.btn[title="Añadir empleo"]').length || 0,
                          soldadoSinBotones: rolesHojas[1] ? rolesHojas[1].querySelectorAll('.btn[title="Añadir persona"], .btn[title="Añadir empleo"]').length : null,
                          soldadoExtras: rolesHojas[1] ? [...rolesHojas[1].querySelectorAll('.campo label')].map((l) => l.textContent) : [],
                          instituciones: document.querySelectorAll('.form-bloque .bloque-instituciones').length,
                        };
                        const campanas = [...document.querySelectorAll('.form-bloque .campo')]
                          .find((c) => c.querySelector('label')?.textContent === 'CAMPAÑAS Y ACCIONES');
                        salida.hojas.campanasFilas = campanas?.querySelector('textarea')?.rows || null;
                        const filaServicio = document.querySelector('.form-bloque .fila-servicio:not(.fila-servicio-totales)');
                        const filaTotalesServicio = document.querySelector('.form-bloque .fila-servicio-totales');
                        salida.hojas.serviciosFilas = filaServicio ? 1 : 0;
                        salida.hojas.serviciosTotales = filaTotalesServicio
                          ? filaTotalesServicio.querySelectorAll('.campo').length : 0;
                        salida.hojas.inicioConCalendario = !!filaServicio
                          && filaServicio.querySelectorAll('.fecha-historica .fecha-historica-boton').length === 1;
                        salida.hojas.botonesServicio = document.querySelectorAll('.form-bloque .btn[title="Añadir servicio"]').length;
                        if (filaServicio && filaTotalesServicio) {
                          salida.hojas.plantillasIguales =
                            getComputedStyle(filaServicio).gridTemplateColumns ===
                            getComputedStyle(filaTotalesServicio).gridTemplateColumns;
                        }
                        const btnAddServicio = document.querySelector('.form-bloque .btn[title="Añadir servicio"]');
                        if (btnAddServicio) {
                          btnAddServicio.click();
                          await esperar(250);
                          salida.hojas.serviciosTrasAnadir = document.querySelectorAll('.form-bloque .fila-servicio:not(.fila-servicio-totales)').length;
                          const fijar = (fila, etiqueta, valor) => {
                            const campoFila = [...fila.querySelectorAll('.campo')]
                              .find((c) => c.querySelector('label')?.textContent === etiqueta);
                            const input = campoFila?.querySelector('input');
                            if (input) {
                              input.value = valor;
                              input.dispatchEvent(new Event('input', { bubbles: true }));
                            }
                          };
                          const campoRegistro = [...document.querySelectorAll('.form-bloque .campo')]
                            .find((c) => c.querySelector('label')?.textContent === 'FECHA EXACTA');
                          const inputRegistro = campoRegistro?.querySelector('input');
                          if (inputRegistro) {
                            inputRegistro.value = '1 de marzo de 1700';
                            inputRegistro.dispatchEvent(new Event('input', { bubbles: true }));
                          }
                          const filasServ = [...document.querySelectorAll('.form-bloque .fila-servicio:not(.fila-servicio-totales)')];
                          if (filasServ[0]) fijar(filasServ[0], 'INICIO', '7 de febrero de 1700');
                          if (filasServ[1]) fijar(filasServ[1], 'INICIO', '21 de febrero de 1700');
                          await esperar(300);
                          const duracionDeFila = (fila) => {
                            const leer = (etiqueta) => {
                              const campoFila = [...fila.querySelectorAll('.campo')]
                                .find((c) => c.querySelector('label')?.textContent === etiqueta);
                              return campoFila?.querySelector('input')?.value ?? null;
                            };
                            return [leer('AÑOS'), leer('MESES'), leer('DÍAS')];
                          };
                          salida.hojas.duraciones = [
                            filasServ[0] ? duracionDeFila(filasServ[0]) : null,
                            filasServ[1] ? duracionDeFila(filasServ[1]) : null,
                          ];
                          const valorTotal = (etiqueta) => {
                            const campoTotal = [...document.querySelectorAll('.form-bloque .fila-servicio-totales .campo')]
                              .find((c) => c.querySelector('label')?.textContent === etiqueta);
                            return campoTotal?.querySelector('input')?.value ?? null;
                          };
                          salida.hojas.totales = [valorTotal('TOTAL AÑOS'), valorTotal('TOTAL MESES'), valorTotal('TOTAL DÍAS')];
                          if (inputRegistro) {
                            inputRegistro.value = '2 de marzo de 1700';
                            inputRegistro.dispatchEvent(new Event('input', { bubbles: true }));
                            await esperar(200);
                            salida.hojas.ultimaTrasCambiarCierre = filasServ[1] ? duracionDeFila(filasServ[1]) : null;
                            salida.hojas.totalesTrasCambiarCierre = [
                              valorTotal('TOTAL AÑOS'), valorTotal('TOTAL MESES'), valorTotal('TOTAL DÍAS'),
                            ];
                          }
                          /* Acarreo: 20 + 10 días = 30 → 1 mes; 11 + 1 = 12 meses → 1 año. */
                          if (filasServ[0] && filasServ[1]) {
                            fijar(filasServ[0], 'INICIO', '1 de enero de 1700');
                            fijar(filasServ[1], 'INICIO', '21 de diciembre de 1700');
                            if (inputRegistro) {
                              inputRegistro.value = '31 de diciembre de 1700';
                              inputRegistro.dispatchEvent(new Event('input', { bubbles: true }));
                            }
                            await esperar(300);
                            salida.hojas.duracionesAcarreo = [
                              duracionDeFila(filasServ[0]), duracionDeFila(filasServ[1]),
                            ];
                            salida.hojas.totalesAcarreo = [
                              valorTotal('TOTAL AÑOS'), valorTotal('TOTAL MESES'), valorTotal('TOTAL DÍAS'),
                            ];
                          }
                          salida.hojas.duracionesReadonly = filasServ
                            .every((fila) => ['AÑOS', 'MESES', 'DÍAS'].every((etiqueta) => {
                              const campoFila = [...fila.querySelectorAll('.campo')]
                                .find((c) => c.querySelector('label')?.textContent === etiqueta);
                              return campoFila?.querySelector('input')?.readOnly === true;
                            }));
                          salida.hojas.totalesReadonly = [...document.querySelectorAll('.form-bloque .fila-servicio-totales input')]
                            .every((i) => i.readOnly);
                        }
                        const tarjetaH = [...document.querySelectorAll('.bloque-registrado')].pop();
                        const formHojas = tarjetaH?.querySelector('.form-bloque');
                        const camposHojas = () => (formHojas ? [...formHojas.querySelectorAll('.campo')] : []);
                        const campoHojas = (etiqueta) => camposHojas()
                          .find((c) => c.querySelector('label')?.textContent === etiqueta);
                        const seleccionarOpcionHojas = (sel, indice = 1) => {
                          if (!sel) return;
                          const opciones = [...sel.options].filter((o) => o.value);
                          if (opciones[indice - 1]) sel.value = opciones[indice - 1].value;
                          sel.dispatchEvent(new Event('change', { bubbles: true }));
                        };
                        const fijarSelectHojas = (etiqueta, indice = 1) => {
                          seleccionarOpcionHojas(campoHojas(etiqueta)?.querySelector('select'), indice);
                        };
                        const fijarEntradaHojas = (etiqueta, valor) => {
                          const input = campoHojas(etiqueta)?.querySelector('input');
                          if (!input) return;
                          input.value = valor;
                          input.dispatchEvent(new Event('input', { bubbles: true }));
                          input.dispatchEvent(new Event('change', { bubbles: true }));
                        };
                        const rolHojas = (titulo) => (formHojas
                          ? [...formHojas.querySelectorAll('.bloque-personas')]
                            .find((b) => b.querySelector('.rol-titulo')?.textContent === titulo)
                          : null);
                        const vincularHojas = (titulo, indicePersona, indiceInstitucion = null) => {
                          const rol = rolHojas(titulo);
                          if (!rol) return;
                          const campoRol = (etiqueta) => [...rol.querySelectorAll('.campo')]
                            .find((c) => c.querySelector('label')?.textContent === etiqueta);
                          seleccionarOpcionHojas(campoRol('VINCULAR PERSONA')?.querySelector('select'), indicePersona);
                          if (indiceInstitucion) {
                            seleccionarOpcionHojas(campoRol('VINCULAR INSTITUCIÓN')?.querySelector('select'), indiceInstitucion);
                          }
                        };
                        fijarSelectHojas('LUGAR');
                        fijarSelectHojas('INSTITUCIÓN');
                        fijarEntradaHojas('AÑO', '1704');
                        fijarEntradaHojas('FECHA EXACTA', '11-06-1704');
                        vincularHojas('AUTORIDAD EMISORA', 1, 1);
                        vincularHojas('SOLDADO', 2);
                        const rolSoldadoHojas = rolHojas('SOLDADO');
                        const campoPatriaHojas = rolSoldadoHojas
                          ? [...rolSoldadoHojas.querySelectorAll('.campo')]
                            .find((c) => c.querySelector('label')?.textContent === 'PATRIA')
                          : null;
                        seleccionarOpcionHojas(campoPatriaHojas?.querySelector('select'), 1);
                        const bloqueCuerposHojas = formHojas?.querySelector('.bloque-instituciones');
                        seleccionarOpcionHojas(
                          bloqueCuerposHojas?.querySelector('.persona-linea select'), 1
                        );
                        if (tarjetaH) {
                          const guardarH = [...tarjetaH.querySelectorAll('.bloque-registrado-acciones .btn')]
                            .find((b) => b.textContent === 'GUARDAR');
                          if (guardarH) { guardarH.click(); await esperar(1000); }
                          const proyectoHojas = Number(new URLSearchParams(location.search).get('id'));
                          const todasHojas = await llamar(api.relacionListar(proyectoHojas));
                          const autosHojas = todasHojas.filter(
                            (r) => String(r.bloque_id) === String(tarjetaH.dataset.bloqueId)
                          );
                          salida.hojasAuto = {
                            bloqueId: tarjetaH.dataset.bloqueId,
                            total: autosHojas.length,
                            tipos: autosHojas.map((r) => r.tipo),
                            reglas: autosHojas.map((r) => r.regla).sort(),
                            destinos: autosHojas.map(
                              (r) => r.origen_tipo + ':' + r.origen_id + '->' + r.destino_tipo + ':' + r.destino_id
                            ),
                            procedencias: [...new Set(autosHojas.map((r) => r.procedencia))],
                            fuentes: autosHojas.map((r) => (r.fuentes || []).length),
                            fechas: autosHojas.map((r) => r.fecha_exacta_inicio),
                          };
                          const eliminarH = [...tarjetaH.querySelectorAll('.bloque-registrado-acciones .btn')]
                            .find((b) => b.textContent === 'ELIMINAR');
                          if (eliminarH) {
                            eliminarH.click();
                            await esperar(300);
                            const modalH = [...document.querySelectorAll('.modal')].pop();
                            if (modalH) {
                              const okH = [...modalH.querySelectorAll('.modal-acciones .btn')]
                                .find((b) => b.textContent === 'Aceptar');
                              if (okH) okH.click();
                            }
                            await esperar(600);
                          }
                          const trasHojas = await llamar(api.relacionListar(proyectoHojas));
                          salida.hojasAuto.restos = trasHojas
                            .filter((r) => String(r.bloque_id) === String(tarjetaH.dataset.bloqueId)).length;
                        }
                        salida.hojas.restos = document.querySelectorAll('.bloque-registrado').length;

                        /* Arriendo: mismo sistema que Actas */
                        const proyectoArriendoPrueba = Number(new URLSearchParams(location.search).get('id'));
                        let patrimonioArriendoPrueba = null;
                        try {
                          patrimonioArriendoPrueba = await llamar(api.entidadCrear(
                            'patrimonio', proyectoArriendoPrueba,
                            { nombre: 'Patrimonio autoprueba Arriendo' }
                          ));
                        } catch { /* sin patrimonio de prueba */ }
                        const btnAddArriendo = [...document.querySelectorAll('.cuadernos-barra .btn')]
                          .find((b) => b.textContent.includes('Añadir bloque de registro'));
                        if (btnAddArriendo) btnAddArriendo.click();
                        await esperar(300);
                        const periodoArriendo = [...document.querySelectorAll('.bloques-periodo')].find((b) => !b.disabled);
                        if (periodoArriendo) { periodoArriendo.click(); await esperar(400); }
                        const opcionArriendo = [...document.querySelectorAll('.bloque-opcion')]
                          .find((b) => b.textContent === 'Arriendo');
                        if (opcionArriendo) {
                          opcionArriendo.click();
                          await esperar(1200);
                          const filasArriendo = [...document.querySelectorAll('.form-bloque > .bloque-campos')];
                          const rolesArriendo = [...document.querySelectorAll('.form-bloque .bloque-personas')];
                          salida.arriendo = {
                            filasCampos: filasArriendo.length,
                            camposTitulo: filasArriendo[0]?.querySelectorAll('.campo').length || 0,
                            anchosRegistro: filasArriendo[1] ? [...filasArriendo[1].querySelectorAll('.campo')]
                              .map((c) => [...c.classList].find((x) => /^campo-[0-9]+$/.test(x))) : [],
                            roles: rolesArriendo.map((r) => {
                              const campoInstitucion = [...r.querySelectorAll('.campo')]
                                .find((c) => c.querySelector('label')?.textContent === 'INSTITUCIÓN');
                              return {
                                titulo: r.querySelector('.rol-titulo')?.textContent || '',
                                lineas: r.querySelectorAll(
                                  ':scope > .filas-persona > .fila-persona > .persona-linea'
                                ).length,
                                botonesEmpleo: r.querySelectorAll('.btn[title="Añadir empleo"]').length,
                                institucionTexto: !!campoInstitucion?.querySelector('input'),
                                vinculos: r.querySelectorAll('.persona-vinculos').length,
                              };
                            }),
                          };
                          const formArriendo = document.querySelector('.form-bloque');
                          const rolArriendo = (titulo) => rolesArriendo
                            .find((r) => r.querySelector('.rol-titulo')?.textContent === titulo);
                          const hipotecaDe = (titulo) => {
                            const rol = rolArriendo(titulo);
                            const sub = rol?.querySelector('.persona-subbloques .bloque-patrimonios');
                            const vinculos = rol?.querySelector('.persona-vinculos');
                            return {
                              titulo: sub?.querySelector('.rol-titulo')?.textContent || '',
                              despuesVinculos: !!(sub && vinculos
                                && (vinculos.compareDocumentPosition(sub) & 4)),
                              subbloques: rol?.querySelectorAll('.persona-subbloques .bloque-patrimonios').length || 0,
                            };
                          };
                          salida.arriendo.hipotecas = {
                            independientes: formArriendo
                              ? [...formArriendo.querySelectorAll(':scope > .bloque-patrimonios')]
                                .filter((b) => /^HIPOTECA/.test(
                                  b.querySelector('.rol-titulo')?.textContent || ''
                                )).length
                              : null,
                            arrendatario: hipotecaDe('ARRENDATARIO'),
                            fiador: hipotecaDe('FIADOR/AVAL'),
                          };
                          const rolArrendatario = rolArriendo('ARRENDATARIO');
                          const btnAddPersonaArriendo = rolArrendatario
                            ? [...rolArrendatario.querySelectorAll('.btn[title="Añadir persona"]')]
                              .find((b) => !b.hidden)
                            : null;
                          if (btnAddPersonaArriendo) {
                            btnAddPersonaArriendo.click();
                            await esperar(300);
                            salida.arriendo.hipotecas.personas = rolArrendatario
                              ?.querySelectorAll(':scope > .filas-persona > .fila-persona').length;
                            salida.arriendo.hipotecas.replicadas = rolArrendatario
                              .querySelectorAll('.persona-subbloques .bloque-patrimonios').length;
                          }
                          const camposArriendo = () => (formArriendo
                            ? [...formArriendo.querySelectorAll('.campo')] : []);
                          const campoArriendo = (etiqueta) => camposArriendo()
                            .find((c) => c.querySelector('label')?.textContent === etiqueta);
                          const seleccionarOpcionArriendo = (sel, indice = 1) => {
                            if (!sel) return;
                            const opciones = [...sel.options].filter((o) => o.value);
                            if (opciones[indice - 1]) sel.value = opciones[indice - 1].value;
                            sel.dispatchEvent(new Event('change', { bubbles: true }));
                          };
                          const fijarSelectArriendo = (etiqueta, indice = 1) => {
                            seleccionarOpcionArriendo(campoArriendo(etiqueta)?.querySelector('select'), indice);
                          };
                          const fijarEntradaArriendo = (etiqueta, valor) => {
                            const input = campoArriendo(etiqueta)?.querySelector('input');
                            if (!input) return;
                            input.value = valor;
                            input.dispatchEvent(new Event('input', { bubbles: true }));
                            input.dispatchEvent(new Event('change', { bubbles: true }));
                          };
                          const vincularPersonaArriendo = (titulo, indicePersona, indiceInstitucion) => {
                            const rol = rolArriendo(titulo);
                            const fila = rol?.querySelector(':scope > .filas-persona > .fila-persona');
                            if (!fila) return;
                            const campoFila = (etiqueta) => [...fila.querySelectorAll('.campo')]
                              .find((c) => c.querySelector('label')?.textContent === etiqueta);
                            seleccionarOpcionArriendo(
                              campoFila('VINCULAR PERSONA')?.querySelector('select'), indicePersona
                            );
                            seleccionarOpcionArriendo(
                              campoFila('VINCULAR INSTITUCIÓN')?.querySelector('select'), indiceInstitucion
                            );
                          };
                          const vincularHipotecaArriendo = (titulo, indicePatrimonio = 1) => {
                            const rol = rolArriendo(titulo);
                            const fila = rol?.querySelector(':scope > .filas-persona > .fila-persona');
                            const bloqueHipoteca = fila
                              ?.querySelector('.persona-subbloques .bloque-patrimonios');
                            const campo = bloqueHipoteca
                              ? [...bloqueHipoteca.querySelectorAll('.campo')]
                                .find((c) => c.querySelector('label')?.textContent === 'VINCULAR PATRIMONIO')
                              : null;
                            seleccionarOpcionArriendo(campo?.querySelector('select'), indicePatrimonio);
                          };
                          fijarSelectArriendo('LUGAR');
                          fijarEntradaArriendo('AÑO', '1710');
                          fijarEntradaArriendo('FECHA EXACTA', '01-02-1710');
                          vincularPersonaArriendo('ESCRIBANO/NOTARIO', 1, 1);
                          vincularPersonaArriendo('TESTIGOS', 2, 2);
                          vincularPersonaArriendo('ARRENDADOR', 3, 3);
                          vincularPersonaArriendo('ARRENDATARIO', 4, 4);
                          vincularPersonaArriendo('FIADOR/AVAL', 5, 5);
                          vincularHipotecaArriendo('ARRENDATARIO', 1);
                          vincularHipotecaArriendo('FIADOR/AVAL', 1);
                          const contratoArriendo = formArriendo
                            ?.querySelector(':scope > .bloque-patrimonios');
                          const campoContratoArriendo = contratoArriendo
                            ? [...contratoArriendo.querySelectorAll('.campo')]
                              .find((c) => c.querySelector('label')?.textContent === 'VINCULAR PATRIMONIO')
                            : null;
                          seleccionarOpcionArriendo(campoContratoArriendo?.querySelector('select'), 1);
                          const tarjetaA = [...document.querySelectorAll('.bloque-registrado')].pop();
                          if (tarjetaA) {
                            const guardarA = [...tarjetaA.querySelectorAll('.bloque-registrado-acciones .btn')]
                              .find((b) => b.textContent === 'GUARDAR');
                            if (guardarA) { guardarA.click(); await esperar(1200); }
                            const proyectoArriendo = Number(new URLSearchParams(location.search).get('id'));
                            const todasArriendo = await llamar(api.relacionListar(proyectoArriendo));
                            const autosArriendo = todasArriendo.filter(
                              (r) => String(r.bloque_id) === String(tarjetaA.dataset.bloqueId)
                            );
                            salida.arriendoAuto = {
                              bloqueId: tarjetaA.dataset.bloqueId,
                              total: autosArriendo.length,
                              tipos: autosArriendo.map((r) => r.tipo),
                              reglas: autosArriendo.map((r) => r.regla).sort(),
                              destinos: autosArriendo.map(
                                (r) => r.origen_tipo + ':' + r.origen_id + '->' + r.destino_tipo + ':' + r.destino_id
                              ),
                              procedencias: [...new Set(autosArriendo.map((r) => r.procedencia))],
                              fuentes: autosArriendo.map((r) => (r.fuentes || []).length),
                              fechas: autosArriendo.map((r) => r.fecha_exacta_inicio),
                            };
                            const eliminarA = [...tarjetaA.querySelectorAll('.bloque-registrado-acciones .btn')]
                              .find((b) => b.textContent === 'ELIMINAR');
                            if (eliminarA) {
                              eliminarA.click();
                              await esperar(300);
                              const modalA = [...document.querySelectorAll('.modal')].pop();
                              if (modalA) {
                                const okA = [...modalA.querySelectorAll('.modal-acciones .btn')]
                                  .find((b) => b.textContent === 'Aceptar');
                                if (okA) okA.click();
                              }
                              await esperar(600);
                            }
                            const trasArriendo = await llamar(api.relacionListar(proyectoArriendo));
                            salida.arriendoAuto.restos = trasArriendo
                              .filter((r) => String(r.bloque_id) === String(tarjetaA.dataset.bloqueId)).length;
                          }
                          salida.arriendo.restos = document.querySelectorAll('.bloque-registrado').length;
                        }
                        if (patrimonioArriendoPrueba) {
                          try {
                            await llamar(api.entidadEliminar('patrimonio', patrimonioArriendoPrueba.id));
                          } catch { /* limpieza best-effort */ }
                        }

                        /* COMPRA/VENTA: relaciones automatizadas desde el bloque */
                        const proyectoCompraVentaPrueba = Number(new URLSearchParams(location.search).get('id'));
                        const patrimoniosCompraVentaPrueba = [];
                        for (const sufijo of ['Contrato', 'Hipoteca comprador', 'Hipoteca fiador']) {
                          try {
                            patrimoniosCompraVentaPrueba.push(await llamar(api.entidadCrear(
                              'patrimonio', proyectoCompraVentaPrueba,
                              { nombre: 'Patrimonio autoprueba Compra/Venta ' + sufijo }
                            )));
                          } catch { /* sin patrimonio de prueba */ }
                        }
                        const btnAddCompraVenta = [...document.querySelectorAll('.cuadernos-barra .btn')]
                          .find((b) => b.textContent.includes('Añadir bloque de registro'));
                        if (btnAddCompraVenta) btnAddCompraVenta.click();
                        await esperar(300);
                        const periodoCompraVenta = [...document.querySelectorAll('.bloques-periodo')]
                          .find((b) => !b.disabled);
                        if (periodoCompraVenta) { periodoCompraVenta.click(); await esperar(400); }
                        const opcionCompraVenta = [...document.querySelectorAll('.bloque-opcion')]
                          .find((b) => b.textContent === 'Compra/Venta');
                        if (opcionCompraVenta) {
                          const tarjetasAntesCV = document.querySelectorAll('.bloque-registrado').length;
                          opcionCompraVenta.click();
                          for (let i = 0; i < 30 && document.querySelectorAll('.bloque-registrado').length <= tarjetasAntesCV; i++) {
                            await esperar(200);
                          }
                          await esperar(800);
                          const tarjetaCV = document.querySelectorAll('.bloque-registrado').length > tarjetasAntesCV
                            ? [...document.querySelectorAll('.bloque-registrado')].pop()
                            : null;
                          for (let i = 0; i < 20 && !tarjetaCV?.querySelector('.form-bloque'); i++) await esperar(200);
                          const formCV = tarjetaCV?.querySelector('.form-bloque');
                          const camposCV = () => (formCV ? [...formCV.querySelectorAll('.campo')] : []);
                          const campoCV = (etiqueta) => camposCV()
                            .find((c) => c.querySelector('label')?.textContent === etiqueta);
                          const seleccionarOpcionCV = (sel, indice = 1) => {
                            if (!sel) return;
                            const opciones = [...sel.options].filter((o) => o.value);
                            if (opciones[indice - 1]) sel.value = opciones[indice - 1].value;
                            sel.dispatchEvent(new Event('change', { bubbles: true }));
                          };
                          const fijarSelectCV = (etiqueta, indice = 1) => {
                            seleccionarOpcionCV(campoCV(etiqueta)?.querySelector('select'), indice);
                          };
                          const fijarEntradaCV = (etiqueta, valor) => {
                            const input = campoCV(etiqueta)?.querySelector('input');
                            if (!input) return;
                            input.value = valor;
                            input.dispatchEvent(new Event('input', { bubbles: true }));
                            input.dispatchEvent(new Event('change', { bubbles: true }));
                          };
                          const rolCV = (titulo) => (formCV
                            ? [...formCV.querySelectorAll('.bloque-personas')]
                              .find((b) => b.querySelector('.rol-titulo')?.textContent === titulo)
                            : null);
                          const vincularCV = (titulo, indicePersona, indiceInstitucion) => {
                            const rol = rolCV(titulo);
                            const fila = rol?.querySelector(':scope > .filas-persona > .fila-persona');
                            if (!fila) return;
                            const campoFila = (etiqueta) => [...fila.querySelectorAll('.campo')]
                              .find((c) => c.querySelector('label')?.textContent === etiqueta);
                            seleccionarOpcionCV(
                              campoFila('VINCULAR PERSONA')?.querySelector('select'), indicePersona
                            );
                            seleccionarOpcionCV(
                              campoFila('VINCULAR INSTITUCIÓN')?.querySelector('select'), indiceInstitucion
                            );
                          };
                          const seleccionarPatrimonioCV = (sel, texto) => {
                            if (!sel) return;
                            const opcion = [...sel.options].find((o) => o.textContent.includes(texto));
                            if (!opcion) return;
                            sel.value = opcion.value;
                            sel.dispatchEvent(new Event('change', { bubbles: true }));
                          };
                          const vincularHipotecaCV = (titulo, textoPatrimonio) => {
                            const rol = rolCV(titulo);
                            const fila = rol?.querySelector(':scope > .filas-persona > .fila-persona');
                            const bloqueHipoteca = fila
                              ?.querySelector('.persona-subbloques .bloque-patrimonios');
                            const campo = bloqueHipoteca
                              ? [...bloqueHipoteca.querySelectorAll('.campo')]
                                .find((c) => c.querySelector('label')?.textContent === 'VINCULAR PATRIMONIO')
                              : null;
                            seleccionarPatrimonioCV(campo?.querySelector('select'), textoPatrimonio);
                          };
                          fijarSelectCV('LUGAR');
                          fijarEntradaCV('AÑO', '1711');
                          fijarEntradaCV('FECHA EXACTA', '05-06-1711');
                          vincularCV('ESCRIBANO/NOTARIO', 1, 1);
                          vincularCV('TESTIGOS', 2, 2);
                          vincularCV('VENDEDOR', 3, 3);
                          vincularCV('COMPRADOR', 4, 4);
                          vincularCV('FIADOR/AVAL', 5, 5);
                          vincularHipotecaCV('COMPRADOR', 'Hipoteca comprador');
                          vincularHipotecaCV('FIADOR/AVAL', 'Hipoteca fiador');
                          const contratoCV = formCV
                            ?.querySelector(':scope > .bloque-patrimonios');
                          const campoContratoCV = contratoCV
                            ? [...contratoCV.querySelectorAll('.campo')]
                              .find((c) => c.querySelector('label')?.textContent === 'VINCULAR PATRIMONIO')
                            : null;
                          seleccionarPatrimonioCV(campoContratoCV?.querySelector('select'), 'Contrato');
                          const bloqueCVId = tarjetaCV?.dataset.bloqueId || null;
                          if (tarjetaCV) {
                            const guardarCV = [...tarjetaCV.querySelectorAll('.bloque-registrado-acciones .btn')]
                              .find((b) => b.textContent === 'GUARDAR');
                            if (guardarCV) { guardarCV.click(); await esperar(1200); }
                          }
                          const proyectoCV = Number(new URLSearchParams(location.search).get('id'));
                          const todasRelCV = await llamar(api.relacionListar(proyectoCV));
                          const autosCV = todasRelCV.filter(
                            (r) => String(r.bloque_id) === String(bloqueCVId)
                          );
                          const contratoRelCV = autosCV.find(
                            (r) => r.regla === 'compraventa:vendedor:contrato:propietario'
                          );
                          const contratoCompradorRelCV = autosCV.find(
                            (r) => r.regla === 'compraventa:comprador:contrato:propietario'
                          );
                          salida.compraventaAuto = {
                            bloqueId: bloqueCVId,
                            total: autosCV.length,
                            tipos: autosCV.map((r) => r.tipo),
                            reglas: autosCV.map((r) => r.regla).sort(),
                            destinos: autosCV.map(
                              (r) => r.origen_tipo + ':' + r.origen_id + '->' + r.destino_tipo + ':' + r.destino_id
                            ),
                            procedencias: [...new Set(autosCV.map((r) => r.procedencia))],
                            fuentes: autosCV.map((r) => (r.fuentes || []).length),
                            fechas: autosCV.map((r) => r.fecha_exacta_inicio),
                            contrato: contratoRelCV ? {
                              inicio: [
                                contratoRelCV.anio_inicio,
                                contratoRelCV.fecha_exacta_inicio,
                                contratoRelCV.lugar_inicio,
                              ],
                              fin: [
                                contratoRelCV.anio_fin,
                                contratoRelCV.fecha_exacta_fin,
                                contratoRelCV.lugar_fin,
                              ],
                            } : null,
                            contratoComprador: contratoCompradorRelCV ? {
                              inicio: [
                                contratoCompradorRelCV.anio_inicio,
                                contratoCompradorRelCV.fecha_exacta_inicio,
                                contratoCompradorRelCV.lugar_inicio,
                              ],
                              fin: [
                                contratoCompradorRelCV.anio_fin,
                                contratoCompradorRelCV.fecha_exacta_fin,
                                contratoCompradorRelCV.lugar_fin,
                              ],
                            } : null,
                          };
                          if (tarjetaCV) {
                            const eliminarCV = [...tarjetaCV.querySelectorAll('.bloque-registrado-acciones .btn')]
                              .find((b) => b.textContent === 'ELIMINAR');
                            if (eliminarCV) {
                              eliminarCV.click();
                              await esperar(300);
                              const modalCV = [...document.querySelectorAll('.modal')].pop();
                              if (modalCV) {
                                const okCV = [...modalCV.querySelectorAll('.modal-acciones .btn')]
                                  .find((b) => b.textContent === 'Aceptar');
                                if (okCV) okCV.click();
                              }
                              await esperar(600);
                            }
                          }
                          const trasCV = await llamar(api.relacionListar(proyectoCV));
                          salida.compraventaAuto.restos = trasCV
                            .filter((r) => String(r.bloque_id) === String(bloqueCVId)).length;
                        }
                        for (const patrimonio of patrimoniosCompraVentaPrueba) {
                          try {
                            await llamar(api.entidadEliminar('patrimonio', patrimonio.id));
                          } catch { /* limpieza best-effort */ }
                        }

                        /* DIEZMOS: relaciones automatizadas desde el bloque */
                        const proyectoDiezmosPrueba = Number(new URLSearchParams(location.search).get('id'));
                        let patrimonioDiezmosPrueba = null;
                        try {
                          patrimonioDiezmosPrueba = await llamar(api.entidadCrear(
                            'patrimonio', proyectoDiezmosPrueba,
                            { nombre: 'Patrimonio autoprueba Diezmos' }
                          ));
                        } catch { /* sin patrimonio de prueba */ }
                        const btnAddDiezmos = [...document.querySelectorAll('.cuadernos-barra .btn')]
                          .find((b) => b.textContent.includes('Añadir bloque de registro'));
                        if (btnAddDiezmos) btnAddDiezmos.click();
                        await esperar(300);
                        const periodoDiezmos = [...document.querySelectorAll('.bloques-periodo')]
                          .find((b) => !b.disabled);
                        if (periodoDiezmos) { periodoDiezmos.click(); await esperar(400); }
                        const opcionDiezmos = [...document.querySelectorAll('.bloque-opcion')]
                          .find((b) => b.textContent === 'Diezmos');
                        if (opcionDiezmos) {
                          const tarjetasAntesDz = document.querySelectorAll('.bloque-registrado').length;
                          opcionDiezmos.click();
                          for (let i = 0; i < 30 && document.querySelectorAll('.bloque-registrado').length <= tarjetasAntesDz; i++) {
                            await esperar(200);
                          }
                          await esperar(800);
                          const tarjetaDz = document.querySelectorAll('.bloque-registrado').length > tarjetasAntesDz
                            ? [...document.querySelectorAll('.bloque-registrado')].pop()
                            : null;
                          for (let i = 0; i < 20 && !tarjetaDz?.querySelector('.form-bloque'); i++) await esperar(200);
                          const formDz = tarjetaDz?.querySelector('.form-bloque');
                          const camposDz = () => (formDz ? [...formDz.querySelectorAll('.campo')] : []);
                          const campoDz = (etiqueta) => camposDz()
                            .find((c) => c.querySelector('label')?.textContent === etiqueta);
                          const seleccionarOpcionDz = (sel, indice = 1) => {
                            if (!sel) return;
                            const opciones = [...sel.options].filter((o) => o.value);
                            if (opciones[indice - 1]) sel.value = opciones[indice - 1].value;
                            sel.dispatchEvent(new Event('change', { bubbles: true }));
                          };
                          const fijarSelectDz = (etiqueta, indice = 1) => {
                            seleccionarOpcionDz(campoDz(etiqueta)?.querySelector('select'), indice);
                          };
                          const fijarEntradaDz = (etiqueta, valor) => {
                            const input = campoDz(etiqueta)?.querySelector('input');
                            if (!input) return;
                            input.value = valor;
                            input.dispatchEvent(new Event('input', { bubbles: true }));
                            input.dispatchEvent(new Event('change', { bubbles: true }));
                          };
                          const rolDz = (titulo) => (formDz
                            ? [...formDz.querySelectorAll('.bloque-personas')]
                              .find((b) => b.querySelector('.rol-titulo')?.textContent === titulo)
                            : null);
                          const vincularDz = (titulo, indicePersona, indiceInstitucion) => {
                            const rol = rolDz(titulo);
                            const fila = rol?.querySelector(':scope > .filas-persona > .fila-persona');
                            if (!fila) return;
                            const campoFila = (etiqueta) => [...fila.querySelectorAll('.campo')]
                              .find((c) => c.querySelector('label')?.textContent === etiqueta);
                            seleccionarOpcionDz(
                              campoFila('VINCULAR PERSONA')?.querySelector('select'), indicePersona
                            );
                            seleccionarOpcionDz(
                              campoFila('VINCULAR INSTITUCIÓN')?.querySelector('select'), indiceInstitucion
                            );
                          };
                          const vincularHipotecaDz = (titulo, indicePatrimonio = 1) => {
                            const rol = rolDz(titulo);
                            const fila = rol?.querySelector(':scope > .filas-persona > .fila-persona');
                            const bloqueHipoteca = fila
                              ?.querySelector('.persona-subbloques .bloque-patrimonios');
                            const campo = bloqueHipoteca
                              ? [...bloqueHipoteca.querySelectorAll('.campo')]
                                .find((c) => c.querySelector('label')?.textContent === 'VINCULAR PATRIMONIO')
                              : null;
                            seleccionarOpcionDz(campo?.querySelector('select'), indicePatrimonio);
                          };
                          fijarSelectDz('LUGAR');
                          fijarEntradaDz('AÑO', '1712');
                          fijarEntradaDz('FECHA EXACTA', '06-07-1712');
                          vincularDz('ESCRIBANO/NOTARIO', 1, 1);
                          vincularDz('TESTIGOS', 2, 2);
                          vincularDz('DIEZMERO', 3, 3);
                          vincularDz('FIADOR/AVAL', 4, 4);
                          vincularDz('BENEFICIARIO', 5, 5);
                          vincularHipotecaDz('DIEZMERO', 1);
                          vincularHipotecaDz('FIADOR/AVAL', 1);
                          const bloqueDzId = tarjetaDz?.dataset.bloqueId || null;
                          if (tarjetaDz) {
                            const guardarDz = [...tarjetaDz.querySelectorAll('.bloque-registrado-acciones .btn')]
                              .find((b) => b.textContent === 'GUARDAR');
                            if (guardarDz) { guardarDz.click(); await esperar(1200); }
                          }
                          const proyectoDz = Number(new URLSearchParams(location.search).get('id'));
                          const todasRelDz = await llamar(api.relacionListar(proyectoDz));
                          const autosDz = todasRelDz.filter(
                            (r) => String(r.bloque_id) === String(bloqueDzId)
                          );
                          salida.diezmosAuto = {
                            bloqueId: bloqueDzId,
                            total: autosDz.length,
                            tipos: autosDz.map((r) => r.tipo),
                            reglas: autosDz.map((r) => r.regla).sort(),
                            destinos: autosDz.map(
                              (r) => r.origen_tipo + ':' + r.origen_id + '->' + r.destino_tipo + ':' + r.destino_id
                            ),
                            procedencias: [...new Set(autosDz.map((r) => r.procedencia))],
                            fuentes: autosDz.map((r) => (r.fuentes || []).length),
                            fechas: autosDz.map((r) => r.fecha_exacta_inicio),
                          };
                          if (tarjetaDz) {
                            const eliminarDz = [...tarjetaDz.querySelectorAll('.bloque-registrado-acciones .btn')]
                              .find((b) => b.textContent === 'ELIMINAR');
                            if (eliminarDz) {
                              eliminarDz.click();
                              await esperar(300);
                              const modalDz = [...document.querySelectorAll('.modal')].pop();
                              if (modalDz) {
                                const okDz = [...modalDz.querySelectorAll('.modal-acciones .btn')]
                                  .find((b) => b.textContent === 'Aceptar');
                                if (okDz) okDz.click();
                              }
                              await esperar(600);
                            }
                          }
                          const trasDz = await llamar(api.relacionListar(proyectoDz));
                          salida.diezmosAuto.restos = trasDz
                            .filter((r) => String(r.bloque_id) === String(bloqueDzId)).length;
                        }
                        if (patrimonioDiezmosPrueba) {
                          try {
                            await llamar(api.entidadEliminar('patrimonio', patrimonioDiezmosPrueba.id));
                          } catch { /* limpieza best-effort */ }
                        }

                        /* DONACIÓN: relaciones automatizadas desde el bloque */
                        const proyectoDonacionPrueba = Number(new URLSearchParams(location.search).get('id'));
                        let patrimonioDonacionPrueba = null;
                        try {
                          patrimonioDonacionPrueba = await llamar(api.entidadCrear(
                            'patrimonio', proyectoDonacionPrueba,
                            { nombre: 'Patrimonio autoprueba Donación' }
                          ));
                        } catch { /* sin patrimonio de prueba */ }
                        const btnAddDonacion = [...document.querySelectorAll('.cuadernos-barra .btn')]
                          .find((b) => b.textContent.includes('Añadir bloque de registro'));
                        if (btnAddDonacion) btnAddDonacion.click();
                        await esperar(300);
                        const periodoDonacion = [...document.querySelectorAll('.bloques-periodo')]
                          .find((b) => !b.disabled);
                        if (periodoDonacion) { periodoDonacion.click(); await esperar(400); }
                        const opcionDonacion = [...document.querySelectorAll('.bloque-opcion')]
                          .find((b) => b.textContent === 'Donación');
                        if (opcionDonacion) {
                          const tarjetasAntesDon = document.querySelectorAll('.bloque-registrado').length;
                          opcionDonacion.click();
                          for (let i = 0; i < 30 && document.querySelectorAll('.bloque-registrado').length <= tarjetasAntesDon; i++) {
                            await esperar(200);
                          }
                          await esperar(800);
                          const tarjetaDon = document.querySelectorAll('.bloque-registrado').length > tarjetasAntesDon
                            ? [...document.querySelectorAll('.bloque-registrado')].pop()
                            : null;
                          for (let i = 0; i < 20 && !tarjetaDon?.querySelector('.form-bloque'); i++) await esperar(200);
                          const formDon = tarjetaDon?.querySelector('.form-bloque');
                          const camposDon = () => (formDon ? [...formDon.querySelectorAll('.campo')] : []);
                          const campoDon = (etiqueta) => camposDon()
                            .find((c) => c.querySelector('label')?.textContent === etiqueta);
                          const seleccionarOpcionDon = (sel, indice = 1) => {
                            if (!sel) return;
                            const opciones = [...sel.options].filter((o) => o.value);
                            if (opciones[indice - 1]) sel.value = opciones[indice - 1].value;
                            sel.dispatchEvent(new Event('change', { bubbles: true }));
                          };
                          const fijarSelectDon = (etiqueta, indice = 1) => {
                            seleccionarOpcionDon(campoDon(etiqueta)?.querySelector('select'), indice);
                          };
                          const fijarEntradaDon = (etiqueta, valor) => {
                            const input = campoDon(etiqueta)?.querySelector('input');
                            if (!input) return;
                            input.value = valor;
                            input.dispatchEvent(new Event('input', { bubbles: true }));
                            input.dispatchEvent(new Event('change', { bubbles: true }));
                          };
                          const rolDon = (titulo) => (formDon
                            ? [...formDon.querySelectorAll('.bloque-personas')]
                              .find((b) => b.querySelector('.rol-titulo')?.textContent === titulo)
                            : null);
                          const vincularDon = (titulo, indicePersona, indiceInstitucion) => {
                            const rol = rolDon(titulo);
                            const fila = rol?.querySelector(':scope > .filas-persona > .fila-persona');
                            if (!fila) return;
                            const campoFila = (etiqueta) => [...fila.querySelectorAll('.campo')]
                              .find((c) => c.querySelector('label')?.textContent === etiqueta);
                            seleccionarOpcionDon(
                              campoFila('VINCULAR PERSONA')?.querySelector('select'), indicePersona
                            );
                            seleccionarOpcionDon(
                              campoFila('VINCULAR INSTITUCIÓN')?.querySelector('select'), indiceInstitucion
                            );
                          };
                          fijarSelectDon('LUGAR');
                          fijarEntradaDon('AÑO', '1713');
                          fijarEntradaDon('FECHA EXACTA', '07-08-1713');
                          vincularDon('ESCRIBANO/NOTARIO', 1, 1);
                          vincularDon('TESTIGOS', 2, 2);
                          vincularDon('DONADOR', 3, 3);
                          vincularDon('DONATARIO', 4, 4);
                          const contratoDon = formDon
                            ?.querySelector(':scope > .bloque-patrimonios');
                          const campoContratoDon = contratoDon
                            ? [...contratoDon.querySelectorAll('.campo')]
                              .find((c) => c.querySelector('label')?.textContent === 'VINCULAR PATRIMONIO')
                            : null;
                          seleccionarOpcionDon(campoContratoDon?.querySelector('select'), 1);
                          const bloqueDonId = tarjetaDon?.dataset.bloqueId || null;
                          if (tarjetaDon) {
                            const guardarDon = [...tarjetaDon.querySelectorAll('.bloque-registrado-acciones .btn')]
                              .find((b) => b.textContent === 'GUARDAR');
                            if (guardarDon) { guardarDon.click(); await esperar(1200); }
                          }
                          const proyectoDon = Number(new URLSearchParams(location.search).get('id'));
                          const todasRelDon = await llamar(api.relacionListar(proyectoDon));
                          const autosDon = todasRelDon.filter(
                            (r) => String(r.bloque_id) === String(bloqueDonId)
                          );
                          const donadorContratoDon = autosDon.find(
                            (r) => r.regla === 'donacion:donador:contrato:propietario'
                          );
                          const donatarioContratoDon = autosDon.find(
                            (r) => r.regla === 'donacion:donatario:contrato:propietario'
                          );
                          salida.donacionAuto = {
                            bloqueId: bloqueDonId,
                            total: autosDon.length,
                            tipos: autosDon.map((r) => r.tipo),
                            reglas: autosDon.map((r) => r.regla).sort(),
                            destinos: autosDon.map(
                              (r) => r.origen_tipo + ':' + r.origen_id + '->' + r.destino_tipo + ':' + r.destino_id
                            ),
                            procedencias: [...new Set(autosDon.map((r) => r.procedencia))],
                            fuentes: autosDon.map((r) => (r.fuentes || []).length),
                            fechas: autosDon.map((r) => r.fecha_exacta_inicio),
                            contratoDonador: donadorContratoDon ? {
                              inicio: [
                                donadorContratoDon.anio_inicio,
                                donadorContratoDon.fecha_exacta_inicio,
                                donadorContratoDon.lugar_inicio,
                              ],
                              fin: [
                                donadorContratoDon.anio_fin,
                                donadorContratoDon.fecha_exacta_fin,
                                donadorContratoDon.lugar_fin,
                              ],
                            } : null,
                            contratoDonatario: donatarioContratoDon ? {
                              inicio: [
                                donatarioContratoDon.anio_inicio,
                                donatarioContratoDon.fecha_exacta_inicio,
                                donatarioContratoDon.lugar_inicio,
                              ],
                              fin: [
                                donatarioContratoDon.anio_fin,
                                donatarioContratoDon.fecha_exacta_fin,
                                donatarioContratoDon.lugar_fin,
                              ],
                            } : null,
                          };
                          if (tarjetaDon) {
                            const eliminarDon = [...tarjetaDon.querySelectorAll('.bloque-registrado-acciones .btn')]
                              .find((b) => b.textContent === 'ELIMINAR');
                            if (eliminarDon) {
                              eliminarDon.click();
                              await esperar(300);
                              const modalDon = [...document.querySelectorAll('.modal')].pop();
                              if (modalDon) {
                                const okDon = [...modalDon.querySelectorAll('.modal-acciones .btn')]
                                  .find((b) => b.textContent === 'Aceptar');
                                if (okDon) okDon.click();
                              }
                              await esperar(600);
                            }
                          }
                          const trasDon = await llamar(api.relacionListar(proyectoDon));
                          salida.donacionAuto.restos = trasDon
                            .filter((r) => String(r.bloque_id) === String(bloqueDonId)).length;
                        }
                        if (patrimonioDonacionPrueba) {
                          try {
                            await llamar(api.entidadEliminar('patrimonio', patrimonioDonacionPrueba.id));
                          } catch { /* limpieza best-effort */ }
                        }

                        /* FIANZA: relaciones automatizadas desde el bloque */
                        const proyectoFianzaPrueba = Number(new URLSearchParams(location.search).get('id'));
                        let patrimonioFianzaPrueba = null;
                        try {
                          patrimonioFianzaPrueba = await llamar(api.entidadCrear(
                            'patrimonio', proyectoFianzaPrueba,
                            { nombre: 'Patrimonio autoprueba Fianza' }
                          ));
                        } catch { /* sin patrimonio de prueba */ }
                        const btnAddFianza = [...document.querySelectorAll('.cuadernos-barra .btn')]
                          .find((b) => b.textContent.includes('Añadir bloque de registro'));
                        if (btnAddFianza) btnAddFianza.click();
                        await esperar(300);
                        const periodoFianza = [...document.querySelectorAll('.bloques-periodo')]
                          .find((b) => !b.disabled);
                        if (periodoFianza) { periodoFianza.click(); await esperar(400); }
                        const opcionFianza = [...document.querySelectorAll('.bloque-opcion')]
                          .find((b) => b.textContent === 'Fianza');
                        if (opcionFianza) {
                          const tarjetasAntesFz = document.querySelectorAll('.bloque-registrado').length;
                          opcionFianza.click();
                          for (let i = 0; i < 30 && document.querySelectorAll('.bloque-registrado').length <= tarjetasAntesFz; i++) {
                            await esperar(200);
                          }
                          await esperar(800);
                          const tarjetaFz = document.querySelectorAll('.bloque-registrado').length > tarjetasAntesFz
                            ? [...document.querySelectorAll('.bloque-registrado')].pop()
                            : null;
                          for (let i = 0; i < 20 && !tarjetaFz?.querySelector('.form-bloque'); i++) await esperar(200);
                          const formFz = tarjetaFz?.querySelector('.form-bloque');
                          const camposFz = () => (formFz ? [...formFz.querySelectorAll('.campo')] : []);
                          const campoFz = (etiqueta) => camposFz()
                            .find((c) => c.querySelector('label')?.textContent === etiqueta);
                          const seleccionarOpcionFz = (sel, indice = 1) => {
                            if (!sel) return;
                            const opciones = [...sel.options].filter((o) => o.value);
                            if (opciones[indice - 1]) sel.value = opciones[indice - 1].value;
                            sel.dispatchEvent(new Event('change', { bubbles: true }));
                          };
                          const fijarSelectFz = (etiqueta, indice = 1) => {
                            seleccionarOpcionFz(campoFz(etiqueta)?.querySelector('select'), indice);
                          };
                          const fijarEntradaFz = (etiqueta, valor) => {
                            const input = campoFz(etiqueta)?.querySelector('input');
                            if (!input) return;
                            input.value = valor;
                            input.dispatchEvent(new Event('input', { bubbles: true }));
                            input.dispatchEvent(new Event('change', { bubbles: true }));
                          };
                          const rolFz = (titulo) => (formFz
                            ? [...formFz.querySelectorAll('.bloque-personas')]
                              .find((b) => b.querySelector('.rol-titulo')?.textContent === titulo)
                            : null);
                          const vincularFz = (titulo, indicePersona, indiceInstitucion) => {
                            const rol = rolFz(titulo);
                            const fila = rol?.querySelector(':scope > .filas-persona > .fila-persona');
                            if (!fila) return;
                            const campoFila = (etiqueta) => [...fila.querySelectorAll('.campo')]
                              .find((c) => c.querySelector('label')?.textContent === etiqueta);
                            seleccionarOpcionFz(
                              campoFila('VINCULAR PERSONA')?.querySelector('select'), indicePersona
                            );
                            seleccionarOpcionFz(
                              campoFila('VINCULAR INSTITUCIÓN')?.querySelector('select'), indiceInstitucion
                            );
                          };
                          const vincularHipotecaFz = (titulo, indicePatrimonio = 1) => {
                            const rol = rolFz(titulo);
                            const fila = rol?.querySelector(':scope > .filas-persona > .fila-persona');
                            const bloqueHipoteca = fila
                              ?.querySelector('.persona-subbloques .bloque-patrimonios');
                            const campo = bloqueHipoteca
                              ? [...bloqueHipoteca.querySelectorAll('.campo')]
                                .find((c) => c.querySelector('label')?.textContent === 'VINCULAR PATRIMONIO')
                              : null;
                            seleccionarOpcionFz(campo?.querySelector('select'), indicePatrimonio);
                          };
                          fijarSelectFz('LUGAR');
                          fijarEntradaFz('AÑO', '1714');
                          fijarEntradaFz('FECHA EXACTA', '08-09-1714');
                          vincularFz('ESCRIBANO/NOTARIO', 1, 1);
                          vincularFz('TESTIGOS', 2, 2);
                          vincularFz('FIADOR/AVAL', 3, 3);
                          vincularFz('DEUDOR', 4, 4);
                          vincularFz('ACREEDOR', 5, 5);
                          vincularHipotecaFz('FIADOR/AVAL', 1);
                          vincularHipotecaFz('DEUDOR', 1);
                          const bloqueFzId = tarjetaFz?.dataset.bloqueId || null;
                          if (tarjetaFz) {
                            const guardarFz = [...tarjetaFz.querySelectorAll('.bloque-registrado-acciones .btn')]
                              .find((b) => b.textContent === 'GUARDAR');
                            if (guardarFz) { guardarFz.click(); await esperar(1200); }
                          }
                          const proyectoFz = Number(new URLSearchParams(location.search).get('id'));
                          const todasRelFz = await llamar(api.relacionListar(proyectoFz));
                          const autosFz = todasRelFz.filter(
                            (r) => String(r.bloque_id) === String(bloqueFzId)
                          );
                          salida.fianzaAuto = {
                            bloqueId: bloqueFzId,
                            total: autosFz.length,
                            tipos: autosFz.map((r) => r.tipo),
                            reglas: autosFz.map((r) => r.regla).sort(),
                            destinos: autosFz.map(
                              (r) => r.origen_tipo + ':' + r.origen_id + '->' + r.destino_tipo + ':' + r.destino_id
                            ),
                            procedencias: [...new Set(autosFz.map((r) => r.procedencia))],
                            fuentes: autosFz.map((r) => (r.fuentes || []).length),
                            fechas: autosFz.map((r) => r.fecha_exacta_inicio),
                            propietarios: autosFz.filter((r) => r.tipo === 'Propietario').map((r) => ({
                              regla: r.regla,
                              inicio: [r.anio_inicio, r.fecha_exacta_inicio, r.lugar_inicio],
                              fin: [r.anio_fin, r.fecha_exacta_fin, r.lugar_fin],
                            })),
                          };
                          if (tarjetaFz) {
                            const eliminarFz = [...tarjetaFz.querySelectorAll('.bloque-registrado-acciones .btn')]
                              .find((b) => b.textContent === 'ELIMINAR');
                            if (eliminarFz) {
                              eliminarFz.click();
                              await esperar(300);
                              const modalFz = [...document.querySelectorAll('.modal')].pop();
                              if (modalFz) {
                                const okFz = [...modalFz.querySelectorAll('.modal-acciones .btn')]
                                  .find((b) => b.textContent === 'Aceptar');
                                if (okFz) okFz.click();
                              }
                              await esperar(600);
                            }
                          }
                          const trasFz = await llamar(api.relacionListar(proyectoFz));
                          salida.fianzaAuto.restos = trasFz
                            .filter((r) => String(r.bloque_id) === String(bloqueFzId)).length;
                        }
                        if (patrimonioFianzaPrueba) {
                          try {
                            await llamar(api.entidadEliminar('patrimonio', patrimonioFianzaPrueba.id));
                          } catch { /* limpieza best-effort */ }
                        }

                        /* HIPOTECA: relaciones automatizadas desde el bloque */
                        const proyectoHipotecaPrueba = Number(new URLSearchParams(location.search).get('id'));
                        let patrimonioHipotecaPrueba = null;
                        try {
                          patrimonioHipotecaPrueba = await llamar(api.entidadCrear(
                            'patrimonio', proyectoHipotecaPrueba,
                            { nombre: 'Patrimonio autoprueba Hipoteca' }
                          ));
                        } catch { /* sin patrimonio de prueba */ }
                        const btnAddHipoteca = [...document.querySelectorAll('.cuadernos-barra .btn')]
                          .find((b) => b.textContent.includes('Añadir bloque de registro'));
                        if (btnAddHipoteca) btnAddHipoteca.click();
                        await esperar(300);
                        const periodoHipoteca = [...document.querySelectorAll('.bloques-periodo')]
                          .find((b) => !b.disabled);
                        if (periodoHipoteca) { periodoHipoteca.click(); await esperar(400); }
                        const opcionHipoteca = [...document.querySelectorAll('.bloque-opcion')]
                          .find((b) => b.textContent === 'Hipoteca');
                        if (opcionHipoteca) {
                          const tarjetasAntesHp = document.querySelectorAll('.bloque-registrado').length;
                          opcionHipoteca.click();
                          for (let i = 0; i < 30 && document.querySelectorAll('.bloque-registrado').length <= tarjetasAntesHp; i++) {
                            await esperar(200);
                          }
                          await esperar(800);
                          const tarjetaHp = document.querySelectorAll('.bloque-registrado').length > tarjetasAntesHp
                            ? [...document.querySelectorAll('.bloque-registrado')].pop()
                            : null;
                          for (let i = 0; i < 20 && !tarjetaHp?.querySelector('.form-bloque'); i++) await esperar(200);
                          const formHp = tarjetaHp?.querySelector('.form-bloque');
                          const camposHp = () => (formHp ? [...formHp.querySelectorAll('.campo')] : []);
                          const campoHp = (etiqueta) => camposHp()
                            .find((c) => c.querySelector('label')?.textContent === etiqueta);
                          const seleccionarOpcionHp = (sel, indice = 1) => {
                            if (!sel) return;
                            const opciones = [...sel.options].filter((o) => o.value);
                            if (opciones[indice - 1]) sel.value = opciones[indice - 1].value;
                            sel.dispatchEvent(new Event('change', { bubbles: true }));
                          };
                          const fijarSelectHp = (etiqueta, indice = 1) => {
                            seleccionarOpcionHp(campoHp(etiqueta)?.querySelector('select'), indice);
                          };
                          const fijarEntradaHp = (etiqueta, valor) => {
                            const input = campoHp(etiqueta)?.querySelector('input');
                            if (!input) return;
                            input.value = valor;
                            input.dispatchEvent(new Event('input', { bubbles: true }));
                            input.dispatchEvent(new Event('change', { bubbles: true }));
                          };
                          const rolHp = (titulo) => (formHp
                            ? [...formHp.querySelectorAll('.bloque-personas')]
                              .find((b) => b.querySelector('.rol-titulo')?.textContent === titulo)
                            : null);
                          const vincularHp = (titulo, indicePersona, indiceInstitucion) => {
                            const rol = rolHp(titulo);
                            const fila = rol?.querySelector(':scope > .filas-persona > .fila-persona');
                            if (!fila) return;
                            const campoFila = (etiqueta) => [...fila.querySelectorAll('.campo')]
                              .find((c) => c.querySelector('label')?.textContent === etiqueta);
                            seleccionarOpcionHp(
                              campoFila('VINCULAR PERSONA')?.querySelector('select'), indicePersona
                            );
                            seleccionarOpcionHp(
                              campoFila('VINCULAR INSTITUCIÓN')?.querySelector('select'), indiceInstitucion
                            );
                          };
                          const vincularHipotecaHp = (titulo, indicePatrimonio = 1) => {
                            const rol = rolHp(titulo);
                            const fila = rol?.querySelector(':scope > .filas-persona > .fila-persona');
                            const bloqueHipoteca = fila
                              ?.querySelector('.persona-subbloques .bloque-patrimonios');
                            const campo = bloqueHipoteca
                              ? [...bloqueHipoteca.querySelectorAll('.campo')]
                                .find((c) => c.querySelector('label')?.textContent === 'VINCULAR PATRIMONIO')
                              : null;
                            seleccionarOpcionHp(campo?.querySelector('select'), indicePatrimonio);
                          };
                          fijarSelectHp('LUGAR');
                          fijarEntradaHp('AÑO', '1715');
                          fijarEntradaHp('FECHA EXACTA', '09-10-1715');
                          vincularHp('ESCRIBANO/NOTARIO', 1, 1);
                          vincularHp('TESTIGOS', 2, 2);
                          vincularHp('FIADOR/AVAL', 3, 3);
                          vincularHp('DEUDOR', 4, 4);
                          vincularHp('ACREEDOR', 5, 5);
                          vincularHipotecaHp('FIADOR/AVAL', 1);
                          vincularHipotecaHp('DEUDOR', 1);
                          const bloqueHpId = tarjetaHp?.dataset.bloqueId || null;
                          if (tarjetaHp) {
                            const guardarHp = [...tarjetaHp.querySelectorAll('.bloque-registrado-acciones .btn')]
                              .find((b) => b.textContent === 'GUARDAR');
                            if (guardarHp) { guardarHp.click(); await esperar(1200); }
                          }
                          const proyectoHp = Number(new URLSearchParams(location.search).get('id'));
                          const todasRelHp = await llamar(api.relacionListar(proyectoHp));
                          const autosHp = todasRelHp.filter(
                            (r) => String(r.bloque_id) === String(bloqueHpId)
                          );
                          salida.hipotecaAuto = {
                            bloqueId: bloqueHpId,
                            total: autosHp.length,
                            tipos: autosHp.map((r) => r.tipo),
                            reglas: autosHp.map((r) => r.regla).sort(),
                            destinos: autosHp.map(
                              (r) => r.origen_tipo + ':' + r.origen_id + '->' + r.destino_tipo + ':' + r.destino_id
                            ),
                            procedencias: [...new Set(autosHp.map((r) => r.procedencia))],
                            fuentes: autosHp.map((r) => (r.fuentes || []).length),
                            fechas: autosHp.map((r) => r.fecha_exacta_inicio),
                            propietarios: autosHp.filter((r) => r.tipo === 'Propietario').map((r) => ({
                              regla: r.regla,
                              inicio: [r.anio_inicio, r.fecha_exacta_inicio, r.lugar_inicio],
                              fin: [r.anio_fin, r.fecha_exacta_fin, r.lugar_fin],
                            })),
                          };
                          if (tarjetaHp) {
                            const eliminarHp = [...tarjetaHp.querySelectorAll('.bloque-registrado-acciones .btn')]
                              .find((b) => b.textContent === 'ELIMINAR');
                            if (eliminarHp) {
                              eliminarHp.click();
                              await esperar(300);
                              const modalHp = [...document.querySelectorAll('.modal')].pop();
                              if (modalHp) {
                                const okHp = [...modalHp.querySelectorAll('.modal-acciones .btn')]
                                  .find((b) => b.textContent === 'Aceptar');
                                if (okHp) okHp.click();
                              }
                              await esperar(600);
                            }
                          }
                          const trasHp = await llamar(api.relacionListar(proyectoHp));
                          salida.hipotecaAuto.restos = trasHp
                            .filter((r) => String(r.bloque_id) === String(bloqueHpId)).length;
                        }
                        if (patrimonioHipotecaPrueba) {
                          try {
                            await llamar(api.entidadEliminar('patrimonio', patrimonioHipotecaPrueba.id));
                          } catch { /* limpieza best-effort */ }
                        }

                        /* OBLIGACIÓN: relaciones automatizadas desde el bloque */
                        const proyectoObligacionPrueba = Number(new URLSearchParams(location.search).get('id'));
                        let patrimonioObligacionPrueba = null;
                        try {
                          patrimonioObligacionPrueba = await llamar(api.entidadCrear(
                            'patrimonio', proyectoObligacionPrueba,
                            { nombre: 'Patrimonio autoprueba Obligación' }
                          ));
                        } catch { /* sin patrimonio de prueba */ }
                        const btnAddObligacion = [...document.querySelectorAll('.cuadernos-barra .btn')]
                          .find((b) => b.textContent.includes('Añadir bloque de registro'));
                        if (btnAddObligacion) btnAddObligacion.click();
                        await esperar(300);
                        const periodoObligacion = [...document.querySelectorAll('.bloques-periodo')]
                          .find((b) => !b.disabled);
                        if (periodoObligacion) { periodoObligacion.click(); await esperar(400); }
                        const opcionObligacion = [...document.querySelectorAll('.bloque-opcion')]
                          .find((b) => b.textContent === 'Obligación');
                        if (opcionObligacion) {
                          const tarjetasAntesOb = document.querySelectorAll('.bloque-registrado').length;
                          opcionObligacion.click();
                          for (let i = 0; i < 30 && document.querySelectorAll('.bloque-registrado').length <= tarjetasAntesOb; i++) {
                            await esperar(200);
                          }
                          await esperar(900);
                          const tarjetaOb = document.querySelectorAll('.bloque-registrado').length > tarjetasAntesOb
                            ? [...document.querySelectorAll('.bloque-registrado')].pop()
                            : null;
                          for (let i = 0; i < 25 && !tarjetaOb?.querySelector('.form-bloque'); i++) await esperar(200);
                          const formOb = tarjetaOb?.querySelector('.form-bloque');
                          const camposOb = () => (formOb ? [...formOb.querySelectorAll('.campo')] : []);
                          const campoOb = (etiqueta) => camposOb()
                            .find((c) => c.querySelector('label')?.textContent === etiqueta);
                          const seleccionarOpcionOb = (sel, indice = 1) => {
                            if (!sel) return;
                            const opciones = [...sel.options].filter((o) => o.value);
                            if (opciones[indice - 1]) sel.value = opciones[indice - 1].value;
                            sel.dispatchEvent(new Event('change', { bubbles: true }));
                          };
                          const fijarSelectOb = (etiqueta, indice = 1) => {
                            seleccionarOpcionOb(campoOb(etiqueta)?.querySelector('select'), indice);
                          };
                          const fijarEntradaOb = (etiqueta, valor) => {
                            const input = campoOb(etiqueta)?.querySelector('input');
                            if (!input) return;
                            input.value = valor;
                            input.dispatchEvent(new Event('input', { bubbles: true }));
                            input.dispatchEvent(new Event('change', { bubbles: true }));
                          };
                          const rolOb = (titulo) => (formOb
                            ? [...formOb.querySelectorAll('.bloque-personas')]
                              .find((b) => b.querySelector('.rol-titulo')?.textContent === titulo)
                            : null);
                          const vincularOb = (titulo, indicePersona, indiceInstitucion) => {
                            const rol = rolOb(titulo);
                            const fila = rol?.querySelector(':scope > .filas-persona > .fila-persona');
                            if (!fila) return;
                            const campoFila = (etiqueta) => [...fila.querySelectorAll('.campo')]
                              .find((c) => c.querySelector('label')?.textContent === etiqueta);
                            seleccionarOpcionOb(
                              campoFila('VINCULAR PERSONA')?.querySelector('select'), indicePersona
                            );
                            seleccionarOpcionOb(
                              campoFila('VINCULAR INSTITUCIÓN')?.querySelector('select'), indiceInstitucion
                            );
                          };
                          const vincularHipotecaOb = (titulo, indicePatrimonio = 1) => {
                            const rol = rolOb(titulo);
                            const fila = rol?.querySelector(':scope > .filas-persona > .fila-persona');
                            const bloqueHipoteca = fila
                              ?.querySelector('.persona-subbloques .bloque-patrimonios');
                            const campo = bloqueHipoteca
                              ? [...bloqueHipoteca.querySelectorAll('.campo')]
                                .find((c) => c.querySelector('label')?.textContent === 'VINCULAR PATRIMONIO')
                              : null;
                            seleccionarOpcionOb(campo?.querySelector('select'), indicePatrimonio);
                          };
                          fijarSelectOb('LUGAR');
                          fijarEntradaOb('AÑO', '1722');
                          fijarEntradaOb('FECHA EXACTA', '02-03-1722');
                          vincularOb('ESCRIBANO/NOTARIO', 1, 1);
                          vincularOb('TESTIGOS', 2, 2);
                          vincularOb('FIADOR/AVAL', 3, 3);
                          vincularOb('DEUDOR', 4, 4);
                          vincularOb('ACREEDOR', 5, 5);
                          vincularHipotecaOb('FIADOR/AVAL', 1);
                          vincularHipotecaOb('DEUDOR', 1);
                          const bloqueObId = tarjetaOb?.dataset.bloqueId || null;
                          if (tarjetaOb) {
                            const guardarOb = [...tarjetaOb.querySelectorAll('.bloque-registrado-acciones .btn')]
                              .find((b) => b.textContent === 'GUARDAR');
                            if (guardarOb) { guardarOb.click(); await esperar(1200); }
                          }
                          const proyectoOb = Number(new URLSearchParams(location.search).get('id'));
                          const todasRelOb = await llamar(api.relacionListar(proyectoOb));
                          const autosOb = todasRelOb.filter(
                            (r) => String(r.bloque_id) === String(bloqueObId)
                          );
                          salida.obligacionAuto = {
                            bloqueId: bloqueObId,
                            total: autosOb.length,
                            tipos: autosOb.map((r) => r.tipo),
                            reglas: autosOb.map((r) => r.regla).sort(),
                            destinos: autosOb.map(
                              (r) => r.origen_tipo + ':' + r.origen_id + '->' + r.destino_tipo + ':' + r.destino_id
                            ),
                            procedencias: [...new Set(autosOb.map((r) => r.procedencia))],
                            fuentes: autosOb.map((r) => (r.fuentes || []).length),
                            fechas: autosOb.map((r) => r.fecha_exacta_inicio),
                            propietarios: autosOb.filter((r) => r.tipo === 'Propietario').map((r) => ({
                              regla: r.regla,
                              inicio: [r.anio_inicio, r.fecha_exacta_inicio, r.lugar_inicio],
                              fin: [r.anio_fin, r.fecha_exacta_fin, r.lugar_fin],
                            })),
                          };
                          if (tarjetaOb) {
                            const eliminarOb = [...tarjetaOb.querySelectorAll('.bloque-registrado-acciones .btn')]
                              .find((b) => b.textContent === 'ELIMINAR');
                            if (eliminarOb) {
                              eliminarOb.click();
                              await esperar(300);
                              const modalOb = [...document.querySelectorAll('.modal')].pop();
                              if (modalOb) {
                                const okOb = [...modalOb.querySelectorAll('.modal-acciones .btn')]
                                  .find((b) => b.textContent === 'Aceptar');
                                if (okOb) okOb.click();
                              }
                              await esperar(600);
                            }
                          }
                          const trasOb = await llamar(api.relacionListar(proyectoOb));
                          salida.obligacionAuto.restos = trasOb
                            .filter((r) => String(r.bloque_id) === String(bloqueObId)).length;
                        }
                        if (patrimonioObligacionPrueba) {
                          try {
                            await llamar(api.entidadEliminar('patrimonio', patrimonioObligacionPrueba.id));
                          } catch { /* limpieza best-effort */ }
                        }

                        /* PODER: relaciones automatizadas desde el bloque */
                        const btnAddPoder = [...document.querySelectorAll('.cuadernos-barra .btn')]
                          .find((b) => b.textContent.includes('Añadir bloque de registro'));
                        if (btnAddPoder) btnAddPoder.click();
                        await esperar(300);
                        const periodoPoder = [...document.querySelectorAll('.bloques-periodo')]
                          .find((b) => !b.disabled);
                        if (periodoPoder) { periodoPoder.click(); await esperar(400); }
                        const opcionPoder = [...document.querySelectorAll('.bloque-opcion')]
                          .find((b) => b.textContent === 'Poder');
                        if (opcionPoder) {
                          const tarjetasAntesPod = document.querySelectorAll('.bloque-registrado').length;
                          opcionPoder.click();
                          for (let i = 0; i < 30 && document.querySelectorAll('.bloque-registrado').length <= tarjetasAntesPod; i++) {
                            await esperar(200);
                          }
                          await esperar(900);
                          const tarjetaPod = document.querySelectorAll('.bloque-registrado').length > tarjetasAntesPod
                            ? [...document.querySelectorAll('.bloque-registrado')].pop()
                            : null;
                          for (let i = 0; i < 25 && !tarjetaPod?.querySelector('.form-bloque'); i++) await esperar(200);
                          const formPod = tarjetaPod?.querySelector('.form-bloque');
                          const camposPod = () => (formPod ? [...formPod.querySelectorAll('.campo')] : []);
                          const campoPod = (etiqueta) => camposPod()
                            .find((c) => c.querySelector('label')?.textContent === etiqueta);
                          const seleccionarOpcionPod = (sel, indice = 1) => {
                            if (!sel) return;
                            const opciones = [...sel.options].filter((o) => o.value);
                            if (opciones[indice - 1]) sel.value = opciones[indice - 1].value;
                            sel.dispatchEvent(new Event('change', { bubbles: true }));
                          };
                          const fijarSelectPod = (etiqueta, indice = 1) => {
                            seleccionarOpcionPod(campoPod(etiqueta)?.querySelector('select'), indice);
                          };
                          const fijarEntradaPod = (etiqueta, valor) => {
                            const input = campoPod(etiqueta)?.querySelector('input');
                            if (!input) return;
                            input.value = valor;
                            input.dispatchEvent(new Event('input', { bubbles: true }));
                            input.dispatchEvent(new Event('change', { bubbles: true }));
                          };
                          const rolPod = (titulo) => (formPod
                            ? [...formPod.querySelectorAll('.bloque-personas')]
                              .find((b) => b.querySelector('.rol-titulo')?.textContent === titulo)
                            : null);
                          const vincularPod = (titulo, indicePersona, indiceInstitucion) => {
                            const rol = rolPod(titulo);
                            const fila = rol?.querySelector(':scope > .filas-persona > .fila-persona');
                            if (!fila) return;
                            const campoFila = (etiqueta) => [...fila.querySelectorAll('.campo')]
                              .find((c) => c.querySelector('label')?.textContent === etiqueta);
                            seleccionarOpcionPod(
                              campoFila('VINCULAR PERSONA')?.querySelector('select'), indicePersona
                            );
                            seleccionarOpcionPod(
                              campoFila('VINCULAR INSTITUCIÓN')?.querySelector('select'), indiceInstitucion
                            );
                          };
                          fijarSelectPod('LUGAR');
                          fijarEntradaPod('AÑO', '1723');
                          fijarEntradaPod('FECHA EXACTA', '03-04-1723');
                          vincularPod('ESCRIBANO/NOTARIO', 1, 1);
                          vincularPod('TESTIGOS', 2, 2);
                          vincularPod('OTORGANTE', 3, 3);
                          vincularPod('APODERADO', 4, 4);
                          const bloquePodId = tarjetaPod?.dataset.bloqueId || null;
                          if (tarjetaPod) {
                            const guardarPod = [...tarjetaPod.querySelectorAll('.bloque-registrado-acciones .btn')]
                              .find((b) => b.textContent === 'GUARDAR');
                            if (guardarPod) { guardarPod.click(); await esperar(1200); }
                          }
                          const proyectoPod = Number(new URLSearchParams(location.search).get('id'));
                          const todasRelPod = await llamar(api.relacionListar(proyectoPod));
                          const autosPod = todasRelPod.filter(
                            (r) => String(r.bloque_id) === String(bloquePodId)
                          );
                          salida.poderAuto = {
                            bloqueId: bloquePodId,
                            total: autosPod.length,
                            tipos: autosPod.map((r) => r.tipo),
                            reglas: autosPod.map((r) => r.regla).sort(),
                            destinos: autosPod.map(
                              (r) => r.origen_tipo + ':' + r.origen_id + '->' + r.destino_tipo + ':' + r.destino_id
                            ),
                            procedencias: [...new Set(autosPod.map((r) => r.procedencia))],
                            fuentes: autosPod.map((r) => (r.fuentes || []).length),
                            fechas: autosPod.map((r) => r.fecha_exacta_inicio),
                          };
                          if (tarjetaPod) {
                            const eliminarPod = [...tarjetaPod.querySelectorAll('.bloque-registrado-acciones .btn')]
                              .find((b) => b.textContent === 'ELIMINAR');
                            if (eliminarPod) {
                              eliminarPod.click();
                              await esperar(300);
                              const modalPod = [...document.querySelectorAll('.modal')].pop();
                              if (modalPod) {
                                const okPod = [...modalPod.querySelectorAll('.modal-acciones .btn')]
                                  .find((b) => b.textContent === 'Aceptar');
                                if (okPod) okPod.click();
                              }
                              await esperar(600);
                            }
                          }
                          const trasPod = await llamar(api.relacionListar(proyectoPod));
                          salida.poderAuto.restos = trasPod
                            .filter((r) => String(r.bloque_id) === String(bloquePodId)).length;
                        }

                        /* EPÍSTOLAS: relaciones automatizadas desde el bloque */
                        const btnAddEpistolas = [...document.querySelectorAll('.cuadernos-barra .btn')]
                          .find((b) => b.textContent.includes('Añadir bloque de registro'));
                        if (btnAddEpistolas) btnAddEpistolas.click();
                        await esperar(300);
                        const periodoEpistolas = [...document.querySelectorAll('.bloques-periodo')]
                          .find((b) => !b.disabled);
                        if (periodoEpistolas) { periodoEpistolas.click(); await esperar(400); }
                        const opcionEpistolas = [...document.querySelectorAll('.bloque-opcion')]
                          .find((b) => b.textContent === 'Epístolas');
                        if (opcionEpistolas) {
                          const tarjetasAntesEpi = document.querySelectorAll('.bloque-registrado').length;
                          opcionEpistolas.click();
                          for (let i = 0; i < 30 && document.querySelectorAll('.bloque-registrado').length <= tarjetasAntesEpi; i++) {
                            await esperar(200);
                          }
                          await esperar(900);
                          const tarjetaEpi = document.querySelectorAll('.bloque-registrado').length > tarjetasAntesEpi
                            ? [...document.querySelectorAll('.bloque-registrado')].pop()
                            : null;
                          for (let i = 0; i < 25 && !tarjetaEpi?.querySelector('.form-bloque'); i++) await esperar(200);
                          const formEpi = tarjetaEpi?.querySelector('.form-bloque');
                          const camposEpi = () => (formEpi ? [...formEpi.querySelectorAll('.campo')] : []);
                          const campoEpi = (etiqueta) => camposEpi()
                            .find((c) => c.querySelector('label')?.textContent === etiqueta);
                          const seleccionarOpcionEpi = (sel, indice = 1) => {
                            if (!sel) return;
                            const opciones = [...sel.options].filter((o) => o.value);
                            if (opciones[indice - 1]) sel.value = opciones[indice - 1].value;
                            sel.dispatchEvent(new Event('change', { bubbles: true }));
                          };
                          const fijarSelectEpi = (etiqueta, indice = 1) => {
                            seleccionarOpcionEpi(campoEpi(etiqueta)?.querySelector('select'), indice);
                          };
                          const fijarEntradaEpi = (etiqueta, valor) => {
                            const input = campoEpi(etiqueta)?.querySelector('input');
                            if (!input) return;
                            input.value = valor;
                            input.dispatchEvent(new Event('input', { bubbles: true }));
                            input.dispatchEvent(new Event('change', { bubbles: true }));
                          };
                          const rolEpi = (titulo) => (formEpi
                            ? [...formEpi.querySelectorAll('.bloque-personas')]
                              .find((b) => b.querySelector('.rol-titulo')?.textContent === titulo)
                            : null);
                          const vincularEpi = (titulo, indicePersona, indiceInstitucion) => {
                            const rol = rolEpi(titulo);
                            const fila = rol?.querySelector(':scope > .filas-persona > .fila-persona');
                            if (!fila) return;
                            const campoFila = (etiqueta) => [...fila.querySelectorAll('.campo')]
                              .find((c) => c.querySelector('label')?.textContent === etiqueta);
                            seleccionarOpcionEpi(
                              campoFila('VINCULAR PERSONA')?.querySelector('select'), indicePersona
                            );
                            seleccionarOpcionEpi(
                              campoFila('VINCULAR INSTITUCIÓN')?.querySelector('select'), indiceInstitucion
                            );
                          };
                          const rolesEpistolas = [...(formEpi?.querySelectorAll('.bloque-personas') || [])]
                            .map((r) => r.querySelector('.rol-titulo')?.textContent || '');
                          fijarSelectEpi('LUGAR');
                          fijarEntradaEpi('AÑO', '1724');
                          fijarEntradaEpi('FECHA EXACTA', '04-05-1724');
                          vincularEpi('REMITENTE', 1, 1);
                          vincularEpi('DESTINATARIO', 2, 2);
                          const bloqueEpiId = tarjetaEpi?.dataset.bloqueId || null;
                          if (tarjetaEpi) {
                            const guardarEpi = [...tarjetaEpi.querySelectorAll('.bloque-registrado-acciones .btn')]
                              .find((b) => b.textContent === 'GUARDAR');
                            if (guardarEpi) { guardarEpi.click(); await esperar(1200); }
                          }
                          const proyectoEpi = Number(new URLSearchParams(location.search).get('id'));
                          const todasRelEpi = await llamar(api.relacionListar(proyectoEpi));
                          const autosEpi = todasRelEpi.filter(
                            (r) => String(r.bloque_id) === String(bloqueEpiId)
                          );
                          salida.epistolasAuto = {
                            bloqueId: bloqueEpiId,
                            roles: rolesEpistolas,
                            total: autosEpi.length,
                            tipos: autosEpi.map((r) => r.tipo),
                            reglas: autosEpi.map((r) => r.regla).sort(),
                            destinos: autosEpi.map(
                              (r) => r.origen_tipo + ':' + r.origen_id + '->' + r.destino_tipo + ':' + r.destino_id
                            ),
                            procedencias: [...new Set(autosEpi.map((r) => r.procedencia))],
                            fuentes: autosEpi.map((r) => (r.fuentes || []).length),
                            fechas: autosEpi.map((r) => r.fecha_exacta_inicio),
                            correspondientesPersonales: autosEpi
                              .filter((r) => r.tipo === 'Correspondientes personales')
                              .map((r) => r.origen_tipo + ':' + r.origen_id + '->' + r.destino_tipo + ':' + r.destino_id),
                          };
                          if (tarjetaEpi) {
                            const eliminarEpi = [...tarjetaEpi.querySelectorAll('.bloque-registrado-acciones .btn')]
                              .find((b) => b.textContent === 'ELIMINAR');
                            if (eliminarEpi) {
                              eliminarEpi.click();
                              await esperar(300);
                              const modalEpi = [...document.querySelectorAll('.modal')].pop();
                              if (modalEpi) {
                                const okEpi = [...modalEpi.querySelectorAll('.modal-acciones .btn')]
                                  .find((b) => b.textContent === 'Aceptar');
                                if (okEpi) okEpi.click();
                              }
                              await esperar(600);
                            }
                          }
                          const trasEpi = await llamar(api.relacionListar(proyectoEpi));
                          salida.epistolasAuto.restos = trasEpi
                            .filter((r) => String(r.bloque_id) === String(bloqueEpiId)).length;
                        }

                        /* INVENTARIOS DE BIENES: relaciones automatizadas */
                        const btnAddInventarios = [...document.querySelectorAll('.cuadernos-barra .btn')]
                          .find((b) => b.textContent.includes('Añadir bloque de registro'));
                        if (btnAddInventarios) btnAddInventarios.click();
                        await esperar(300);
                        const periodoInventarios = [...document.querySelectorAll('.bloques-periodo')]
                          .find((b) => !b.disabled);
                        if (periodoInventarios) { periodoInventarios.click(); await esperar(400); }
                        const opcionInventarios = [...document.querySelectorAll('.bloque-opcion')]
                          .find((b) => b.textContent === 'Inventarios de bienes');
                        if (opcionInventarios) {
                          const tarjetasAntesInv = document.querySelectorAll('.bloque-registrado').length;
                          opcionInventarios.click();
                          for (let i = 0; i < 30 && document.querySelectorAll('.bloque-registrado').length <= tarjetasAntesInv; i++) {
                            await esperar(200);
                          }
                          await esperar(900);
                          const tarjetaInv = document.querySelectorAll('.bloque-registrado').length > tarjetasAntesInv
                            ? [...document.querySelectorAll('.bloque-registrado')].pop()
                            : null;
                          for (let i = 0; i < 25 && !tarjetaInv?.querySelector('.form-bloque'); i++) await esperar(200);
                          const formInv = tarjetaInv?.querySelector('.form-bloque');
                          const camposInv = () => (formInv ? [...formInv.querySelectorAll('.campo')] : []);
                          const campoInv = (etiqueta) => camposInv()
                            .find((c) => c.querySelector('label')?.textContent === etiqueta);
                          const seleccionarOpcionInv = (sel, indice = 1) => {
                            if (!sel) return;
                            const opciones = [...sel.options].filter((o) => o.value);
                            if (opciones[indice - 1]) sel.value = opciones[indice - 1].value;
                            sel.dispatchEvent(new Event('change', { bubbles: true }));
                          };
                          const fijarSelectInv = (etiqueta, indice = 1) => {
                            seleccionarOpcionInv(campoInv(etiqueta)?.querySelector('select'), indice);
                          };
                          const fijarEntradaInv = (etiqueta, valor) => {
                            const input = campoInv(etiqueta)?.querySelector('input');
                            if (!input) return;
                            input.value = valor;
                            input.dispatchEvent(new Event('input', { bubbles: true }));
                            input.dispatchEvent(new Event('change', { bubbles: true }));
                          };
                          const rolInv = (titulo) => (formInv
                            ? [...formInv.querySelectorAll('.bloque-personas')]
                              .find((b) => b.querySelector('.rol-titulo')?.textContent === titulo)
                            : null);
                          const vincularInv = (titulo, indicePersona, indiceInstitucion) => {
                            const rol = rolInv(titulo);
                            const fila = rol?.querySelector(':scope > .filas-persona > .fila-persona');
                            if (!fila) return;
                            const campoFila = (etiqueta) => [...fila.querySelectorAll('.campo')]
                              .find((c) => c.querySelector('label')?.textContent === etiqueta);
                            seleccionarOpcionInv(
                              campoFila('VINCULAR PERSONA')?.querySelector('select'), indicePersona
                            );
                            seleccionarOpcionInv(
                              campoFila('VINCULAR INSTITUCIÓN')?.querySelector('select'), indiceInstitucion
                            );
                          };
                          fijarSelectInv('LUGAR');
                          fijarEntradaInv('AÑO', '1716');
                          fijarEntradaInv('FECHA EXACTA', '10-11-1716');
                          vincularInv('ESCRIBANO/NOTARIO', 1, 1);
                          vincularInv('PROPIETARIO', 2, 2);
                          vincularInv('ADMINISTRADOR', 3, 3);
                          const bloqueInvId = tarjetaInv?.dataset.bloqueId || null;
                          if (tarjetaInv) {
                            const guardarInv = [...tarjetaInv.querySelectorAll('.bloque-registrado-acciones .btn')]
                              .find((b) => b.textContent === 'GUARDAR');
                            if (guardarInv) { guardarInv.click(); await esperar(1300); }
                          }
                          const proyectoInv = Number(new URLSearchParams(location.search).get('id'));
                          const todasRelInv = await llamar(api.relacionListar(proyectoInv));
                          const autosInv = todasRelInv.filter(
                            (r) => String(r.bloque_id) === String(bloqueInvId)
                          );
                          salida.inventariosAuto = {
                            bloqueId: bloqueInvId,
                            total: autosInv.length,
                            tipos: autosInv.map((r) => r.tipo),
                            reglas: autosInv.map((r) => r.regla).sort(),
                            destinos: autosInv.map(
                              (r) => r.origen_tipo + ':' + r.origen_id + '->' + r.destino_tipo + ':' + r.destino_id
                            ),
                            procedencias: [...new Set(autosInv.map((r) => r.procedencia))],
                            fuentes: autosInv.map((r) => (r.fuentes || []).length),
                            fechas: autosInv.map((r) => r.fecha_exacta_inicio),
                          };
                          if (tarjetaInv) {
                            const eliminarInv = [...tarjetaInv.querySelectorAll('.bloque-registrado-acciones .btn')]
                              .find((b) => b.textContent === 'ELIMINAR');
                            if (eliminarInv) {
                              eliminarInv.click();
                              await esperar(300);
                              const modalInv = [...document.querySelectorAll('.modal')].pop();
                              if (modalInv) {
                                const okInv = [...modalInv.querySelectorAll('.modal-acciones .btn')]
                                  .find((b) => b.textContent === 'Aceptar');
                                if (okInv) okInv.click();
                              }
                              await esperar(600);
                            }
                          }
                          const trasInv = await llamar(api.relacionListar(proyectoInv));
                          salida.inventariosAuto.restos = trasInv
                            .filter((r) => String(r.bloque_id) === String(bloqueInvId)).length;
                        }

                        /* Resto de formularios: validación del esquema ajustado */
                        const nombresRestantes = [
                          'Compra/Venta', 'Diezmos', 'Donación', 'Fianza', 'Hipoteca',
                          'Inventarios de bienes', 'Legados testamentarios', 'Obligación',
                          'Testamentos', 'Cuenta personal', 'Actas de bautismo',
                          'Actas de defunción', 'Actas de matrimonio',
                        ];
                        salida.restantes = {};
                        for (const nombre of nombresRestantes) {
                          const formulario = window.FORMULARIOS_BLOQUES[nombre];
                          if (!formulario) { salida.restantes[nombre] = null; continue; }
                          const indiceReg = formulario.bloques.findIndex(
                            (b) => b.tipo === 'seccion' && b.titulo === 'REGISTRO'
                          );
                          const filasReg = [];
                          for (let i = indiceReg + 1;
                            i < formulario.bloques.length && formulario.bloques[i].tipo === 'campos';
                            i++) {
                            filasReg.push(formulario.bloques[i]);
                          }
                          const rolesForm = formulario.bloques.filter((b) => b.tipo === 'personas');
                          salida.restantes[nombre] = {
                            tituloCompleto: filasReg[0]?.campos.length === 1
                              && filasReg[0].campos[0].nombre === 'TÍTULO'
                              && filasReg[0].campos[0].ancho === 12,
                            filaRegistro: filasReg[1]?.campos.map((c) => c.nombre) || [],
                            anchos: filasReg[1]?.campos.map((c) => c.ancho) || [],
                            roles: rolesForm.length,
                            dosLineas: rolesForm.every(
                              (b) => b.disposicion === 'dos-lineas' && b.institucionTexto === true
                            ),
                            inventario: formulario.bloques.some((b) => b.tipo === 'grupo'
                              && b.bloques.some((h) => h.tipo === 'items-inventario'))
                              && formulario.bloques.some((b) => b.tipo === 'totales-inventario'),
                            camposPersonaSuelta: formulario.bloques.some((b) => b.tipo === 'campos'
                              && b.campos.some((c) => ['TRATAMIENTO/TÍTULO', 'NOMBRES', 'APELLIDOS'].includes(c.nombre))),
                            hipotecasSueltas: formulario.bloques.filter(
                              (b) => b.tipo === 'patrimonios' && b.titulo === 'HIPOTECA'
                            ).length,
                            hipotecasAnidadas: rolesForm.flatMap(
                              (b) => (b.bloques || [])
                                .filter((h) => h.tipo === 'patrimonios')
                                .map((h) => h.titulo)
                            ),
                            albaceas: rolesForm.some((b) => b.titulo === 'ALBACEAS'),
                            patrimonios: formulario.bloques
                              .filter((b) => b.tipo === 'patrimonios')
                              .map((b) => b.titulo),
                            condiciones: formulario.bloques
                              .flatMap((b) => (Array.isArray(b.campos) ? b.campos : []))
                              .filter((c) => c.nombre === 'CONDICIÓN')
                              .map((c) => ({ tipo: c.tipo, opciones: c.opciones || [] })),
                          };
                        }

                        /* Actas de bautismo: comprobación real en pantalla */
                        const btnAddBautismo = [...document.querySelectorAll('.cuadernos-barra .btn')]
                          .find((b) => b.textContent.includes('Añadir bloque de registro'));
                        if (btnAddBautismo) btnAddBautismo.click();
                        await esperar(300);
                        const periodoBautismo = [...document.querySelectorAll('.bloques-periodo')].find((b) => !b.disabled);
                        if (periodoBautismo) { periodoBautismo.click(); await esperar(400); }
                        const opcionBautismo = [...document.querySelectorAll('.bloque-opcion')]
                          .find((b) => b.textContent === 'Actas de bautismo');
                        if (opcionBautismo) {
                          opcionBautismo.click();
                          await esperar(1200);
                          const filasBautismo = [...document.querySelectorAll('.form-bloque > .bloque-campos')];
                          const rolesBautismo = [...document.querySelectorAll('.form-bloque .bloque-personas')];
                          salida.bautismo = {
                            tituloCompleto: filasBautismo[0]?.querySelectorAll('.campo').length === 1,
                            camposRegistro: filasBautismo[1]
                              ? [...filasBautismo[1].querySelectorAll('.campo label')].map((l) => l.textContent) : [],
                            anchosRegistro: filasBautismo[1] ? [...filasBautismo[1].querySelectorAll('.campo')]
                              .map((c) => [...c.classList].find((x) => /^campo-[0-9]+$/.test(x))) : [],
                            roles: rolesBautismo.length,
                            rolesDosLineas: rolesBautismo.every((r) =>
                              r.querySelectorAll('.persona-linea').length === 3
                              && r.querySelectorAll('.btn[title="Añadir empleo"]').length === 1),
                            institucionesTexto: rolesBautismo.every((r) => {
                              const campoInst = [...r.querySelectorAll('.campo')]
                                .find((c) => c.querySelector('label')?.textContent === 'INSTITUCIÓN');
                              return !!campoInst?.querySelector('input');
                            }),
                          };
                          const formBau = document.querySelector('.form-bloque');
                          const campoFormBau = (etiqueta) => [...(formBau?.querySelectorAll('.campo') || [])]
                            .find((c) => c.querySelector('label')?.textContent === etiqueta);
                          const seleccionarOpcionBau = (sel, indice = 1) => {
                            if (!sel) return;
                            const opciones = [...sel.options].filter((o) => o.value);
                            if (opciones[indice - 1]) sel.value = opciones[indice - 1].value;
                            sel.dispatchEvent(new Event('change', { bubbles: true }));
                          };
                          const fijarSelectBau = (etiqueta, indice = 1) => {
                            seleccionarOpcionBau(campoFormBau(etiqueta)?.querySelector('select'), indice);
                          };
                          const fijarEntradaBau = (etiqueta, valor) => {
                            const input = campoFormBau(etiqueta)?.querySelector('input');
                            if (!input) return;
                            input.value = valor;
                            input.dispatchEvent(new Event('input', { bubbles: true }));
                            input.dispatchEvent(new Event('change', { bubbles: true }));
                          };
                          const rolBau = (titulo) => rolesBautismo.find(
                            (r) => r.querySelector('.rol-titulo')?.textContent === titulo
                          );
                          const vincularRolBau = (titulo, indicePersona, indiceInstitucion) => {
                            const rol = rolBau(titulo);
                            const fila = rol?.querySelector(':scope > .filas-persona > .fila-persona');
                            if (!fila) return;
                            const campoFila = (etiqueta) => [...fila.querySelectorAll('.campo')]
                              .find((c) => c.querySelector('label')?.textContent === etiqueta);
                            seleccionarOpcionBau(
                              campoFila('VINCULAR PERSONA')?.querySelector('select'), indicePersona
                            );
                            seleccionarOpcionBau(
                              campoFila('VINCULAR INSTITUCIÓN')?.querySelector('select'), indiceInstitucion
                            );
                          };
                          fijarSelectBau('LUGAR');
                          fijarEntradaBau('AÑO', '1728');
                          fijarEntradaBau('FECHA EXACTA', '08-09-1728');
                          fijarSelectBau('CONDICIÓN', 1);
                          vincularRolBau('OFICIANTE', 1, 1);
                          vincularRolBau('BAUTIZADO', 2, 2);
                          vincularRolBau('PADRE', 3, 3);
                          vincularRolBau('MADRE', 4, 4);
                          vincularRolBau('PADRINOS', 5, 5);
                          vincularRolBau('TESTIGOS', 1, 2);
                          const tarjetaBau = [...document.querySelectorAll('.bloque-registrado')].pop();
                          if (tarjetaBau) {
                            const guardarBau = [...tarjetaBau.querySelectorAll('.bloque-registrado-acciones .btn')]
                              .find((b) => b.textContent === 'GUARDAR');
                            if (guardarBau) { guardarBau.click(); await esperar(1200); }
                            const proyectoBau = Number(new URLSearchParams(location.search).get('id'));
                            const todasRelBau = await llamar(api.relacionListar(proyectoBau));
                            const autosBau = todasRelBau.filter(
                              (r) => String(r.bloque_id) === String(tarjetaBau.dataset.bloqueId)
                            );
                            salida.bautismoAuto = {
                              bloqueId: tarjetaBau.dataset.bloqueId,
                              total: autosBau.length,
                              tipos: autosBau.map((r) => r.tipo),
                              reglas: autosBau.map((r) => r.regla).sort(),
                              destinos: autosBau.map(
                                (r) => r.origen_tipo + ':' + r.origen_id + '->' + r.destino_tipo + ':' + r.destino_id
                              ),
                              procedencias: [...new Set(autosBau.map((r) => r.procedencia))],
                              fuentes: autosBau.map((r) => (r.fuentes || []).length),
                              fechas: autosBau.map((r) => r.fecha_exacta_inicio),
                            };
                            const eliminarBau = [...tarjetaBau.querySelectorAll('.bloque-registrado-acciones .btn')]
                              .find((b) => b.textContent === 'ELIMINAR');
                            if (eliminarBau) {
                              eliminarBau.click();
                              await esperar(300);
                              const modalBau = [...document.querySelectorAll('.modal')].pop();
                              if (modalBau) {
                                const okBau = [...modalBau.querySelectorAll('.modal-acciones .btn')]
                                  .find((b) => b.textContent === 'Aceptar');
                                if (okBau) okBau.click();
                              }
                              await esperar(600);
                            }
                            const trasBau = await llamar(api.relacionListar(proyectoBau));
                            salida.bautismoAuto.restos = trasBau
                              .filter((r) => String(r.bloque_id) === String(tarjetaBau.dataset.bloqueId)).length;
                          }
                          salida.bautismo.restos = document.querySelectorAll('.bloque-registrado').length;
                        }

                        /* ACTAS DE DEFUNCIÓN: relaciones automatizadas */
                        const btnAddDefuncion = [...document.querySelectorAll('.cuadernos-barra .btn')]
                          .find((b) => b.textContent.includes('Añadir bloque de registro'));
                        if (btnAddDefuncion) btnAddDefuncion.click();
                        await esperar(300);
                        const periodoDefuncion = [...document.querySelectorAll('.bloques-periodo')]
                          .find((b) => !b.disabled);
                        if (periodoDefuncion) { periodoDefuncion.click(); await esperar(400); }
                        const opcionDefuncion = [...document.querySelectorAll('.bloque-opcion')]
                          .find((b) => b.textContent === 'Actas de defunción');
                        if (opcionDefuncion) {
                          const tarjetasAntesDef = document.querySelectorAll('.bloque-registrado').length;
                          opcionDefuncion.click();
                          for (let i = 0; i < 30 && document.querySelectorAll('.bloque-registrado').length <= tarjetasAntesDef; i++) {
                            await esperar(200);
                          }
                          await esperar(900);
                          const tarjetaDef = document.querySelectorAll('.bloque-registrado').length > tarjetasAntesDef
                            ? [...document.querySelectorAll('.bloque-registrado')].pop()
                            : null;
                          for (let i = 0; i < 25 && !tarjetaDef?.querySelector('.form-bloque'); i++) await esperar(200);
                          const formDef = tarjetaDef?.querySelector('.form-bloque');
                          const camposDef = () => (formDef ? [...formDef.querySelectorAll('.campo')] : []);
                          const campoDef = (etiqueta) => camposDef()
                            .find((c) => c.querySelector('label')?.textContent === etiqueta);
                          const seleccionarOpcionDef = (sel, indice = 1) => {
                            if (!sel) return;
                            const opciones = [...sel.options].filter((o) => o.value);
                            if (opciones[indice - 1]) sel.value = opciones[indice - 1].value;
                            sel.dispatchEvent(new Event('change', { bubbles: true }));
                          };
                          const fijarSelectDef = (etiqueta, indice = 1) => {
                            seleccionarOpcionDef(campoDef(etiqueta)?.querySelector('select'), indice);
                          };
                          const fijarEntradaDef = (etiqueta, valor) => {
                            const input = campoDef(etiqueta)?.querySelector('input');
                            if (!input) return;
                            input.value = valor;
                            input.dispatchEvent(new Event('input', { bubbles: true }));
                            input.dispatchEvent(new Event('change', { bubbles: true }));
                          };
                          const rolDef = (titulo) => (formDef
                            ? [...formDef.querySelectorAll('.bloque-personas')]
                              .find((b) => b.querySelector('.rol-titulo')?.textContent === titulo)
                            : null);
                          const vincularDef = (titulo, indicePersona, indiceInstitucion) => {
                            const rol = rolDef(titulo);
                            const fila = rol?.querySelector(':scope > .filas-persona > .fila-persona');
                            if (!fila) return;
                            const campoFila = (etiqueta) => [...fila.querySelectorAll('.campo')]
                              .find((c) => c.querySelector('label')?.textContent === etiqueta);
                            seleccionarOpcionDef(
                              campoFila('VINCULAR PERSONA')?.querySelector('select'), indicePersona
                            );
                            seleccionarOpcionDef(
                              campoFila('VINCULAR INSTITUCIÓN')?.querySelector('select'), indiceInstitucion
                            );
                          };
                          fijarSelectDef('LUGAR');
                          fijarEntradaDef('AÑO', '1729');
                          fijarEntradaDef('FECHA EXACTA', '09-10-1729');
                          vincularDef('OFICIANTE', 1, 1);
                          vincularDef('FINADO', 2, 2);
                          vincularDef('CÓNYUGE', 3, 3);
                          vincularDef('PADRE', 4, 4);
                          vincularDef('MADRE', 5, 5);
                          const bloqueDefId = tarjetaDef?.dataset.bloqueId || null;
                          if (tarjetaDef) {
                            const guardarDef = [...tarjetaDef.querySelectorAll('.bloque-registrado-acciones .btn')]
                              .find((b) => b.textContent === 'GUARDAR');
                            if (guardarDef) { guardarDef.click(); await esperar(1200); }
                          }
                          const proyectoDef = Number(new URLSearchParams(location.search).get('id'));
                          const todasRelDef = await llamar(api.relacionListar(proyectoDef));
                          const autosDef = todasRelDef.filter(
                            (r) => String(r.bloque_id) === String(bloqueDefId)
                          );
                          salida.defuncionAuto = {
                            bloqueId: bloqueDefId,
                            total: autosDef.length,
                            tipos: autosDef.map((r) => r.tipo),
                            reglas: autosDef.map((r) => r.regla).sort(),
                            destinos: autosDef.map(
                              (r) => r.origen_tipo + ':' + r.origen_id + '->' + r.destino_tipo + ':' + r.destino_id
                            ),
                            procedencias: [...new Set(autosDef.map((r) => r.procedencia))],
                            fuentes: autosDef.map((r) => (r.fuentes || []).length),
                            fechas: autosDef.map((r) => r.fecha_exacta_inicio),
                          };
                          if (tarjetaDef) {
                            const eliminarDef = [...tarjetaDef.querySelectorAll('.bloque-registrado-acciones .btn')]
                              .find((b) => b.textContent === 'ELIMINAR');
                            if (eliminarDef) {
                              eliminarDef.click();
                              await esperar(300);
                              const modalDef = [...document.querySelectorAll('.modal')].pop();
                              if (modalDef) {
                                const okDef = [...modalDef.querySelectorAll('.modal-acciones .btn')]
                                  .find((b) => b.textContent === 'Aceptar');
                                if (okDef) okDef.click();
                              }
                              await esperar(600);
                            }
                          }
                          const trasDef = await llamar(api.relacionListar(proyectoDef));
                          salida.defuncionAuto.restos = trasDef
                            .filter((r) => String(r.bloque_id) === String(bloqueDefId)).length;
                        }

                        /* Inventarios de bienes: grupo repetible por categoría */
                        const btnAddInventario = [...document.querySelectorAll('.cuadernos-barra .btn')]
                          .find((b) => b.textContent.includes('Añadir bloque de registro'));
                        if (btnAddInventario) btnAddInventario.click();
                        await esperar(300);
                        const periodoInventario = [...document.querySelectorAll('.bloques-periodo')].find((b) => !b.disabled);
                        if (periodoInventario) { periodoInventario.click(); await esperar(400); }
                        const opcionInventario = [...document.querySelectorAll('.bloque-opcion')]
                          .find((b) => b.textContent === 'Inventarios de bienes');
                        if (opcionInventario) {
                          opcionInventario.click();
                          await esperar(1200);
                          const grupoInv = document.querySelector('.form-bloque .grupo-bloque');
                          const instanciasInv = [...document.querySelectorAll('.form-bloque .grupo-instancia')];
                          const filasFuera = [...document.querySelectorAll('.form-bloque > .bloque-campos')];
                          const campoCategoria = [...(instanciasInv[0]?.querySelectorAll('.campo') || [])]
                            .find((c) => c.querySelector('label')?.textContent === 'CATEGORÍAS');
                          const itemsInv = instanciasInv[0]?.querySelector('.inventario-items');
                          const filasInv = [...(itemsInv?.querySelectorAll('.fila-inventario') || [])];
                          const filaItem = filasInv[0];
                          const filaSubtotal = filasInv[1];
                          const bloqueTotalInv = document.querySelector('.form-bloque .totales-inventario');
                          const filaTotal = bloqueTotalInv?.querySelector('.fila-inventario');
                          const campoDe = (fila, etiqueta) => [...(fila?.querySelectorAll('.campo') || [])]
                            .find((c) => c.querySelector('label')?.textContent === etiqueta);
                          const rectCampo = (fila, etiqueta) => campoDe(fila, etiqueta)?.getBoundingClientRect() || null;
                          salida.inventario = {
                            grupos: document.querySelectorAll('.form-bloque .grupo-bloque').length,
                            instancias: instanciasInv.length,
                            tituloGrupo: grupoInv?.querySelector('.subseccion-bloque')?.textContent || '',
                            tituloFuncion: itemsInv?.querySelector('.inventario-items-titulo')?.textContent || '',
                            etiquetasItem: filaItem ? [...filaItem.querySelectorAll('.campo label')].map((l) => l.textContent) : [],
                            etiquetasSubtotal: filaSubtotal ? [...filaSubtotal.querySelectorAll('.campo label')].map((l) => l.textContent) : [],
                            etiquetasTotal: filaTotal ? [...filaTotal.querySelectorAll('.campo label')].map((l) => l.textContent) : [],
                            botonesItem: filaItem ? [...filaItem.querySelectorAll('.inventario-botones .btn')].map((b) => b.title) : [],
                            totalesBloques: document.querySelectorAll('.form-bloque .totales-inventario').length,
                            totalesFueraDelGrupo: !!filaTotal && !!grupoInv && !grupoInv.contains(filaTotal),
                            ultimasFilasFuera: filasFuera.slice(-2)
                              .map((f) => [...f.querySelectorAll('.campo label')].map((l) => l.textContent)),
                            anchoCategoria: campoCategoria
                              ? [...campoCategoria.classList].find((x) => /^campo-[0-9]+$/.test(x)) : null,
                          };
                          const cCant = rectCampo(filaItem, 'CANTIDAD');
                          const sCant = rectCampo(filaSubtotal, 'SUBTOTAL CANTIDAD');
                          const tCant = rectCampo(filaTotal, 'TOTAL SUBTOTALES CANTIDAD');
                          const cMonto = rectCampo(filaItem, 'PESO');
                          const sMonto = rectCampo(filaSubtotal, 'SUBTOTAL PESO');
                          const tMonto = rectCampo(filaTotal, 'TOTAL SUBTOTALES PESO');
                          const iItem = rectCampo(filaItem, 'ÍTEM');
                          const fFecha = rectCampo(filaItem, 'FECHA EXACTA');
                          if (cCant && sCant && tCant && cMonto && sMonto && tMonto && iItem && fFecha) {
                            salida.inventario.alineacion = {
                              cantidadSubtotal: Math.abs(cCant.left - sCant.left) < 2
                                && Math.abs(cCant.width - sCant.width) < 2,
                              montoSubtotal: Math.abs(cMonto.left - sMonto.left) < 2
                                && Math.abs(cMonto.width - sMonto.width) < 2,
                              subtotalTotalCantidad: Math.abs(sCant.left - tCant.left) < 2
                                && Math.abs(sCant.width - tCant.width) < 2,
                              subtotalTotalMonto: Math.abs(sMonto.left - tMonto.left) < 2
                                && Math.abs(sMonto.width - tMonto.width) < 2,
                            };
                            salida.inventario.proporciones = {
                              fechaItem: +(fFecha.width / iItem.width).toFixed(2),
                              cantidadItem: +(cCant.width / iItem.width).toFixed(2),
                            };
                          }
                          const fijarCampoInv = (fila, etiqueta, valor) => {
                            const campoFila = [...(fila?.querySelectorAll('.campo') || [])]
                              .find((c) => c.querySelector('label')?.textContent === etiqueta);
                            const input = campoFila?.querySelector('input');
                            if (input) {
                              input.value = valor;
                              input.dispatchEvent(new Event('input', { bubbles: true }));
                            }
                          };
                          const fijarSelectInv = (fila, etiqueta, valor) => {
                            const campoFila = [...(fila?.querySelectorAll('.campo') || [])]
                              .find((c) => c.querySelector('label')?.textContent === etiqueta);
                            const select = campoFila?.querySelector('select');
                            if (select) {
                              select.value = valor;
                              select.dispatchEvent(new Event('change', { bubbles: true }));
                            }
                          };
                          const leerSubtotalInv = (fila) => ({
                            cantidad: campoDe(fila, 'SUBTOTAL CANTIDAD')?.querySelector('input')?.value ?? null,
                            peso: campoDe(fila, 'SUBTOTAL PESO')?.querySelector('input')?.value ?? null,
                            reales: campoDe(fila, 'SUBTOTAL REALES')?.querySelector('input')?.value ?? null,
                            cuartillos: campoDe(fila, 'SUBTOTAL CUARTILLOS')?.querySelector('input')?.value ?? null,
                          });
                          const leerTotalInv = () => ({
                            cantidad: document.querySelector('.form-bloque .entrada-total-cantidad')?.value ?? null,
                            peso: document.querySelector('.form-bloque .entrada-total-peso')?.value ?? null,
                            reales: document.querySelector('.form-bloque .entrada-total-reales')?.value ?? null,
                            cuartillos: document.querySelector('.form-bloque .entrada-total-cuartillos')?.value ?? null,
                          });
                          fijarCampoInv(filaItem, 'CANTIDAD', '12');
                          fijarCampoInv(filaItem, 'PESO', '100');
                          fijarSelectInv(filaItem, 'REALES', '8');
                          fijarSelectInv(filaItem, 'CUARTILLOS', '1/2');
                          await esperar(250);
                          salida.inventario.subtotalInicial = leerSubtotalInv(filaSubtotal);
                          salida.inventario.totalInicial = leerTotalInv();
                          salida.inventario.calculadosReadonly = [...document.querySelectorAll(
                            '.form-bloque .entrada-subtotal-cantidad, .form-bloque .entrada-subtotal-peso, .form-bloque .entrada-subtotal-reales, .form-bloque .entrada-subtotal-cuartillos, .form-bloque .entrada-total-cantidad, .form-bloque .entrada-total-peso, .form-bloque .entrada-total-reales, .form-bloque .entrada-total-cuartillos'
                          )].every((i) => i.readOnly);
                          const btnAddItem = filaItem?.querySelector('.inventario-botones .btn:not(.btn-peligroso)');
                          if (btnAddItem) {
                            btnAddItem.click();
                            await esperar(250);
                            salida.inventario.filasTrasAnadir = document.querySelectorAll('.form-bloque .fila-inventario').length;
                            const filasNuevas = [...document.querySelectorAll('.form-bloque .fila-inventario')];
                            const nuevoItem = filasNuevas[1];
                            fijarCampoInv(nuevoItem, 'CANTIDAD', '8');
                            fijarCampoInv(nuevoItem, 'PESO', '50');
                            await esperar(250);
                            salida.inventario.subtotalTrasAnadir = leerSubtotalInv(filasNuevas[2]);
                            salida.inventario.totalTrasAnadir = leerTotalInv();
                            const btnDelItem = nuevoItem?.querySelector('.inventario-botones .btn-peligroso');
                            if (btnDelItem) {
                              btnDelItem.click();
                              await esperar(250);
                              salida.inventario.filasTrasEliminar = document.querySelectorAll('.form-bloque .fila-inventario').length;
                              const filasFinales = [...document.querySelectorAll('.form-bloque .fila-inventario')];
                              salida.inventario.subtotalTrasEliminar = leerSubtotalInv(filasFinales[1]);
                              salida.inventario.totalTrasEliminar = leerTotalInv();
                            }
                          }
                          const btnAddCategoria = grupoInv?.querySelector('.grupo-cab .btn');
                          if (btnAddCategoria) {
                            btnAddCategoria.click();
                            await esperar(300);
                            salida.inventario.instanciasTrasAnadir = document.querySelectorAll('.form-bloque .grupo-instancia').length;
                            salida.inventario.totalesTrasAnadir = document.querySelectorAll('.form-bloque .totales-inventario').length;
                            salida.inventario.titulosInstancias = [...document.querySelectorAll('.form-bloque .grupo-instancia .rol-titulo')]
                              .map((t) => t.textContent);
                            const categorias = [...document.querySelectorAll('.form-bloque .grupo-instancia .campo')]
                              .filter((c) => c.querySelector('label')?.textContent === 'CATEGORÍAS');
                            if (categorias[0]) {
                              const entradaCat = categorias[0].querySelector('input');
                              entradaCat.value = 'Bienes inmuebles';
                              entradaCat.dispatchEvent(new Event('input', { bubbles: true }));
                              await esperar(150);
                              salida.inventario.categorias = categorias.map(
                                (c) => c.querySelector('input')?.value
                              );
                            }
                            const instanciasNuevas = [...document.querySelectorAll('.form-bloque .grupo-instancia')];
                            const items2 = instanciasNuevas[1]?.querySelector('.inventario-items');
                            const filas2 = [...(items2?.querySelectorAll('.fila-inventario') || [])];
                            const item2 = filas2[0];
                            const subtotal2 = filas2[1];
                            fijarCampoInv(item2, 'CANTIDAD', '5');
                            fijarCampoInv(item2, 'PESO', '25');
                            await esperar(250);
                            salida.inventario.subtotalCategoria2 = leerSubtotalInv(subtotal2);
                            salida.inventario.totalFinal = leerTotalInv();
                          }
                          const tarjetaInv = [...document.querySelectorAll('.bloque-registrado')].pop();
                          if (tarjetaInv) {
                            const guardarInv = [...tarjetaInv.querySelectorAll('.bloque-registrado-acciones .btn')]
                              .find((b) => b.textContent === 'GUARDAR');
                            if (guardarInv) { guardarInv.click(); await esperar(700); }
                            const eliminarInv = [...tarjetaInv.querySelectorAll('.bloque-registrado-acciones .btn')]
                              .find((b) => b.textContent === 'ELIMINAR');
                            if (eliminarInv) {
                              eliminarInv.click();
                              await esperar(300);
                              const modalInv = [...document.querySelectorAll('.modal')].pop();
                              if (modalInv) {
                                const okInv = [...modalInv.querySelectorAll('.modal-acciones .btn')]
                                  .find((b) => b.textContent === 'Aceptar');
                                if (okInv) okInv.click();
                              }
                              await esperar(600);
                            }
                          }
                          salida.inventario.restos = document.querySelectorAll('.bloque-registrado').length;
                        }

                        /* Legados testamentarios: inventario con IDs de campo propios */
                        const proyectoLegadosPrueba = Number(new URLSearchParams(location.search).get('id'));
                        let patrimonioLegadosPrueba = null;
                        try {
                          patrimonioLegadosPrueba = await llamar(api.entidadCrear(
                            'patrimonio', proyectoLegadosPrueba,
                            { nombre: 'Patrimonio autoprueba Legados' }
                          ));
                        } catch { /* sin patrimonio de prueba */ }
                        const btnAddLegados = [...document.querySelectorAll('.cuadernos-barra .btn')]
                          .find((b) => b.textContent.includes('Añadir bloque de registro'));
                        if (btnAddLegados) btnAddLegados.click();
                        await esperar(300);
                        const periodoLegados = [...document.querySelectorAll('.bloques-periodo')].find((b) => !b.disabled);
                        if (periodoLegados) { periodoLegados.click(); await esperar(400); }
                        const opcionLegados = [...document.querySelectorAll('.bloque-opcion')]
                          .find((b) => b.textContent === 'Legados testamentarios');
                        if (opcionLegados) {
                          opcionLegados.click();
                          await esperar(1400);
                          const grupoLeg = document.querySelector('.form-bloque .grupo-bloque');
                          const itemsLeg = grupoLeg?.querySelector('.inventario-items');
                          const filasLeg = [...(itemsLeg?.querySelectorAll('.fila-inventario') || [])];
                          const filaItemLeg = filasLeg[0];
                          const filaSubLeg = filasLeg[1];
                          const filaTotalLeg = document.querySelector('.form-bloque .totales-inventario .fila-inventario');
                          const campoDeLeg = (fila, etiqueta) => [...(fila?.querySelectorAll('.campo') || [])]
                            .find((c) => c.querySelector('label')?.textContent === etiqueta);
                          const fijarLeg = (fila, etiqueta, valor) => {
                            const input = campoDeLeg(fila, etiqueta)?.querySelector('input');
                            if (input) {
                              input.value = valor;
                              input.dispatchEvent(new Event('input', { bubbles: true }));
                            }
                          };
                          const leerLeg = (fila, etiqueta) => campoDeLeg(fila, etiqueta)?.querySelector('input')?.value ?? null;
                          const rolesLeg = [...document.querySelectorAll('.form-bloque .bloque-personas')];
                          const titulosLeg = rolesLeg.map(
                            (r) => r.querySelector('.rol-titulo')?.textContent || ''
                          );
                          const indiceHerederosLeg = titulosLeg.indexOf('HEREDEROS');
                          const indiceAlbaceasLeg = titulosLeg.indexOf('ALBACEAS');
                          const rolAlbaceasLeg = indiceAlbaceasLeg >= 0 ? rolesLeg[indiceAlbaceasLeg] : null;
                          const bloquePatrimoniosLeg = document.querySelector('.form-bloque .bloque-patrimonios');
                          const totalesPatrimoniosLeg = document.querySelector('.form-bloque .totales-inventario');
                          const materiaLeg = [...document.querySelectorAll('.form-bloque .campo')]
                            .find((c) => c.querySelector('label')?.textContent === 'MATERIA');
                          salida.legados = {
                            grupo: !!grupoLeg,
                            instancias: document.querySelectorAll('.form-bloque .grupo-instancia').length,
                            items: !!itemsLeg,
                            totales: document.querySelectorAll('.form-bloque .totales-inventario').length,
                            primeraEtiqueta: grupoLeg
                              ? ([...grupoLeg.querySelectorAll('.campo label')].map((l) => l.textContent)[0] || null)
                              : null,
                            albaceas: {
                              existe: indiceAlbaceasLeg >= 0,
                              despuesHerederos: indiceAlbaceasLeg === indiceHerederosLeg + 1,
                              filas: rolAlbaceasLeg?.querySelectorAll('.fila-persona').length || 0,
                              vinculos: rolAlbaceasLeg?.querySelectorAll('.persona-vinculos').length || 0,
                            },
                            patrimonios: {
                              existe: !!bloquePatrimoniosLeg,
                              titulo: bloquePatrimoniosLeg
                                ?.querySelector('.rol-titulo')?.textContent || '',
                              filas: bloquePatrimoniosLeg
                                ?.querySelectorAll('.fila-persona').length || 0,
                              vinculo: !!bloquePatrimoniosLeg
                                && [...bloquePatrimoniosLeg.querySelectorAll('.campo label')]
                                  .some((l) => l.textContent === 'VINCULAR PATRIMONIO'),
                              despuesTotales: !!(bloquePatrimoniosLeg && totalesPatrimoniosLeg
                                && (totalesPatrimoniosLeg.compareDocumentPosition(bloquePatrimoniosLeg) & 4)),
                              antesMateria: !!(bloquePatrimoniosLeg && materiaLeg
                                && (bloquePatrimoniosLeg.compareDocumentPosition(materiaLeg) & 4)),
                            },
                          };
                          fijarLeg(filaItemLeg, 'CANTIDAD', '12');
                          fijarLeg(filaItemLeg, 'PESO', '100');
                          await esperar(250);
                          salida.legados.subtotal = [
                            leerLeg(filaSubLeg, 'SUBTOTAL CANTIDAD'),
                            leerLeg(filaSubLeg, 'SUBTOTAL PESO'),
                          ];
                          salida.legados.total = [
                            leerLeg(filaTotalLeg, 'TOTAL SUBTOTALES CANTIDAD'),
                            leerLeg(filaTotalLeg, 'TOTAL SUBTOTALES PESO'),
                          ];
                          const btnAddCatLeg = grupoLeg?.querySelector('.grupo-cab .btn');
                          if (btnAddCatLeg) {
                            btnAddCatLeg.click();
                            await esperar(300);
                            const instanciasLeg = [...document.querySelectorAll('.form-bloque .grupo-instancia')];
                            const items2Leg = instanciasLeg[1]?.querySelector('.inventario-items');
                            const filas2Leg = [...(items2Leg?.querySelectorAll('.fila-inventario') || [])];
                            fijarLeg(filas2Leg[0], 'CANTIDAD', '5');
                            fijarLeg(filas2Leg[0], 'PESO', '25');
                            await esperar(250);
                            salida.legados.subtotal2 = [
                              leerLeg(filas2Leg[1], 'SUBTOTAL CANTIDAD'),
                              leerLeg(filas2Leg[1], 'SUBTOTAL PESO'),
                            ];
                            salida.legados.totalFinal = [
                              leerLeg(filaTotalLeg, 'TOTAL SUBTOTALES CANTIDAD'),
                              leerLeg(filaTotalLeg, 'TOTAL SUBTOTALES PESO'),
                            ];
                            salida.legados.totalesTrasAnadir = document.querySelectorAll('.form-bloque .totales-inventario').length;
                          }
                          salida.legados.readonly = [...document.querySelectorAll(
                            '.form-bloque .entrada-subtotal-cantidad, .form-bloque .entrada-subtotal-peso, .form-bloque .entrada-subtotal-reales, .form-bloque .entrada-subtotal-cuartillos, .form-bloque .entrada-total-cantidad, .form-bloque .entrada-total-peso, .form-bloque .entrada-total-reales, .form-bloque .entrada-total-cuartillos'
                          )].every((i) => i.readOnly);

                          const formLeg = document.querySelector('.form-bloque');
                          const campoFormLeg = (etiqueta) => [...(formLeg?.querySelectorAll('.campo') || [])]
                            .find((c) => c.querySelector('label')?.textContent === etiqueta);
                          const seleccionarOpcionLeg = (sel, indice = 1) => {
                            if (!sel) return;
                            const opciones = [...sel.options].filter((o) => o.value);
                            if (opciones[indice - 1]) sel.value = opciones[indice - 1].value;
                            sel.dispatchEvent(new Event('change', { bubbles: true }));
                          };
                          const fijarSelectLeg = (etiqueta, indice = 1) => {
                            seleccionarOpcionLeg(campoFormLeg(etiqueta)?.querySelector('select'), indice);
                          };
                          const fijarEntradaLeg = (etiqueta, valor) => {
                            const input = campoFormLeg(etiqueta)?.querySelector('input');
                            if (!input) return;
                            input.value = valor;
                            input.dispatchEvent(new Event('input', { bubbles: true }));
                            input.dispatchEvent(new Event('change', { bubbles: true }));
                          };
                          const vincularRolLeg = (titulo, indicePersona, indiceInstitucion) => {
                            const rol = rolesLeg.find(
                              (r) => r.querySelector('.rol-titulo')?.textContent === titulo
                            );
                            const fila = rol?.querySelector(':scope > .filas-persona > .fila-persona');
                            if (!fila) return;
                            const campoFila = (etiqueta) => [...fila.querySelectorAll('.campo')]
                              .find((c) => c.querySelector('label')?.textContent === etiqueta);
                            seleccionarOpcionLeg(
                              campoFila('VINCULAR PERSONA')?.querySelector('select'), indicePersona
                            );
                            seleccionarOpcionLeg(
                              campoFila('VINCULAR INSTITUCIÓN')?.querySelector('select'), indiceInstitucion
                            );
                          };
                          fijarSelectLeg('LUGAR');
                          fijarEntradaLeg('AÑO', '1720');
                          fijarEntradaLeg('FECHA EXACTA', '01-02-1720');
                          vincularRolLeg('TESTADOR', 1, 1);
                          vincularRolLeg('ESCRIBANO/NOTARIO', 2, 2);
                          vincularRolLeg('TESTIGOS', 3, 3);
                          vincularRolLeg('ALBACEAS', 4, 4);
                          vincularRolLeg('HEREDEROS', 5, 5);
                          const campoPatrimonioLeg = bloquePatrimoniosLeg
                            ? [...bloquePatrimoniosLeg.querySelectorAll('.campo')]
                              .find((c) => c.querySelector('label')?.textContent === 'VINCULAR PATRIMONIO')
                            : null;
                          seleccionarOpcionLeg(campoPatrimonioLeg?.querySelector('select'), 1);

                          const tarjetaLeg = [...document.querySelectorAll('.bloque-registrado')].pop();
                          if (tarjetaLeg) {
                            const guardarLeg = [...tarjetaLeg.querySelectorAll('.bloque-registrado-acciones .btn')]
                              .find((b) => b.textContent === 'GUARDAR');
                            if (guardarLeg) { guardarLeg.click(); await esperar(1200); }
                            const todasRelLeg = await llamar(api.relacionListar(proyectoLegadosPrueba));
                            const autosLeg = todasRelLeg.filter(
                              (r) => String(r.bloque_id) === String(tarjetaLeg.dataset.bloqueId)
                            );
                            salida.legadosAuto = {
                              bloqueId: tarjetaLeg.dataset.bloqueId,
                              total: autosLeg.length,
                              tipos: autosLeg.map((r) => r.tipo),
                              reglas: autosLeg.map((r) => r.regla).sort(),
                              destinos: autosLeg.map(
                                (r) => r.origen_tipo + ':' + r.origen_id + '->' + r.destino_tipo + ':' + r.destino_id
                              ),
                              procedencias: [...new Set(autosLeg.map((r) => r.procedencia))],
                              fuentes: autosLeg.map((r) => (r.fuentes || []).length),
                              fechas: autosLeg.map((r) => r.fecha_exacta_inicio),
                              propietarios: autosLeg.filter((r) => r.tipo === 'Propietario').map((r) => ({
                                regla: r.regla,
                                inicio: [r.anio_inicio, r.fecha_exacta_inicio, r.lugar_inicio],
                                fin: [r.anio_fin, r.fecha_exacta_fin, r.lugar_fin],
                              })),
                            };
                            const eliminarLeg = [...tarjetaLeg.querySelectorAll('.bloque-registrado-acciones .btn')]
                              .find((b) => b.textContent === 'ELIMINAR');
                            if (eliminarLeg) {
                              eliminarLeg.click();
                              await esperar(300);
                              const modalLeg = [...document.querySelectorAll('.modal')].pop();
                              if (modalLeg) {
                                const okLeg = [...modalLeg.querySelectorAll('.modal-acciones .btn')]
                                  .find((b) => b.textContent === 'Aceptar');
                                if (okLeg) okLeg.click();
                              }
                              await esperar(600);
                            }
                            const trasLeg = await llamar(api.relacionListar(proyectoLegadosPrueba));
                            salida.legadosAuto.restos = trasLeg
                              .filter((r) => String(r.bloque_id) === String(tarjetaLeg.dataset.bloqueId)).length;
                          }
                          salida.legados.restos = document.querySelectorAll('.bloque-registrado').length;
                        }
                        if (patrimonioLegadosPrueba) {
                          try {
                            await llamar(api.entidadEliminar('patrimonio', patrimonioLegadosPrueba.id));
                          } catch { /* limpieza best-effort */ }
                        }

                        /* TESTAMENTOS: relaciones automatizadas desde el bloque */
                        const proyectoTestamentosPrueba = Number(new URLSearchParams(location.search).get('id'));
                        let patrimonioTestamentosPrueba = null;
                        try {
                          patrimonioTestamentosPrueba = await llamar(api.entidadCrear(
                            'patrimonio', proyectoTestamentosPrueba,
                            { nombre: 'Patrimonio autoprueba Testamentos' }
                          ));
                        } catch { /* sin patrimonio de prueba */ }
                        const btnAddTestamentos = [...document.querySelectorAll('.cuadernos-barra .btn')]
                          .find((b) => b.textContent.includes('Añadir bloque de registro'));
                        if (btnAddTestamentos) btnAddTestamentos.click();
                        await esperar(300);
                        const periodoTestamentos = [...document.querySelectorAll('.bloques-periodo')]
                          .find((b) => !b.disabled);
                        if (periodoTestamentos) { periodoTestamentos.click(); await esperar(400); }
                        const opcionTestamentos = [...document.querySelectorAll('.bloque-opcion')]
                          .find((b) => b.textContent === 'Testamentos');
                        if (opcionTestamentos) {
                          const tarjetasAntesTst = document.querySelectorAll('.bloque-registrado').length;
                          opcionTestamentos.click();
                          for (let i = 0; i < 30 && document.querySelectorAll('.bloque-registrado').length <= tarjetasAntesTst; i++) {
                            await esperar(200);
                          }
                          await esperar(900);
                          const tarjetaTst = document.querySelectorAll('.bloque-registrado').length > tarjetasAntesTst
                            ? [...document.querySelectorAll('.bloque-registrado')].pop()
                            : null;
                          for (let i = 0; i < 25 && !tarjetaTst?.querySelector('.form-bloque'); i++) await esperar(200);
                          const formTst = tarjetaTst?.querySelector('.form-bloque');
                          const camposTst = () => (formTst ? [...formTst.querySelectorAll('.campo')] : []);
                          const campoTst = (etiqueta) => camposTst()
                            .find((c) => c.querySelector('label')?.textContent === etiqueta);
                          const seleccionarOpcionTst = (sel, indice = 1) => {
                            if (!sel) return;
                            const opciones = [...sel.options].filter((o) => o.value);
                            if (opciones[indice - 1]) sel.value = opciones[indice - 1].value;
                            sel.dispatchEvent(new Event('change', { bubbles: true }));
                          };
                          const fijarSelectTst = (etiqueta, indice = 1) => {
                            seleccionarOpcionTst(campoTst(etiqueta)?.querySelector('select'), indice);
                          };
                          const fijarEntradaTst = (etiqueta, valor) => {
                            const input = campoTst(etiqueta)?.querySelector('input');
                            if (!input) return;
                            input.value = valor;
                            input.dispatchEvent(new Event('input', { bubbles: true }));
                            input.dispatchEvent(new Event('change', { bubbles: true }));
                          };
                          const rolTst = (titulo) => (formTst
                            ? [...formTst.querySelectorAll('.bloque-personas')]
                              .find((b) => b.querySelector('.rol-titulo')?.textContent === titulo)
                            : null);
                          const vincularTst = (titulo, indicePersona, indiceInstitucion) => {
                            const rol = rolTst(titulo);
                            const fila = rol?.querySelector(':scope > .filas-persona > .fila-persona');
                            if (!fila) return;
                            const campoFila = (etiqueta) => [...fila.querySelectorAll('.campo')]
                              .find((c) => c.querySelector('label')?.textContent === etiqueta);
                            seleccionarOpcionTst(
                              campoFila('VINCULAR PERSONA')?.querySelector('select'), indicePersona
                            );
                            seleccionarOpcionTst(
                              campoFila('VINCULAR INSTITUCIÓN')?.querySelector('select'), indiceInstitucion
                            );
                          };
                          fijarSelectTst('LUGAR');
                          fijarEntradaTst('AÑO', '1721');
                          fijarEntradaTst('FECHA EXACTA', '01-02-1721');
                          vincularTst('TESTADOR', 1, 1);
                          vincularTst('ESCRIBANO/NOTARIO', 2, 2);
                          vincularTst('TESTIGOS', 3, 3);
                          vincularTst('ALBACEAS', 4, 4);
                          vincularTst('HEREDEROS', 5, 5);
                          const patrimonioTst = formTst
                            ?.querySelector(':scope > .bloque-patrimonios');
                          const campoTstPatrimonio = patrimonioTst
                            ? [...patrimonioTst.querySelectorAll('.campo')]
                              .find((c) => c.querySelector('label')?.textContent === 'VINCULAR PATRIMONIO')
                            : null;
                          seleccionarOpcionTst(campoTstPatrimonio?.querySelector('select'), 1);
                          const bloqueTstId = tarjetaTst?.dataset.bloqueId || null;
                          if (tarjetaTst) {
                            const guardarTst = [...tarjetaTst.querySelectorAll('.bloque-registrado-acciones .btn')]
                              .find((b) => b.textContent === 'GUARDAR');
                            if (guardarTst) { guardarTst.click(); await esperar(1200); }
                          }
                          const proyectoTst = Number(new URLSearchParams(location.search).get('id'));
                          const todasRelTst = await llamar(api.relacionListar(proyectoTst));
                          const autosTst = todasRelTst.filter(
                            (r) => String(r.bloque_id) === String(bloqueTstId)
                          );
                          salida.testamentosAuto = {
                            bloqueId: bloqueTstId,
                            total: autosTst.length,
                            tipos: autosTst.map((r) => r.tipo),
                            reglas: autosTst.map((r) => r.regla).sort(),
                            destinos: autosTst.map(
                              (r) => r.origen_tipo + ':' + r.origen_id + '->' + r.destino_tipo + ':' + r.destino_id
                            ),
                            procedencias: [...new Set(autosTst.map((r) => r.procedencia))],
                            fuentes: autosTst.map((r) => (r.fuentes || []).length),
                            fechas: autosTst.map((r) => r.fecha_exacta_inicio),
                            propietarios: autosTst.filter((r) => r.tipo === 'Propietario').map((r) => ({
                              regla: r.regla,
                              inicio: [r.anio_inicio, r.fecha_exacta_inicio, r.lugar_inicio],
                              fin: [r.anio_fin, r.fecha_exacta_fin, r.lugar_fin],
                            })),
                          };
                          if (tarjetaTst) {
                            const eliminarTst = [...tarjetaTst.querySelectorAll('.bloque-registrado-acciones .btn')]
                              .find((b) => b.textContent === 'ELIMINAR');
                            if (eliminarTst) {
                              eliminarTst.click();
                              await esperar(300);
                              const modalTst = [...document.querySelectorAll('.modal')].pop();
                              if (modalTst) {
                                const okTst = [...modalTst.querySelectorAll('.modal-acciones .btn')]
                                  .find((b) => b.textContent === 'Aceptar');
                                if (okTst) okTst.click();
                              }
                              await esperar(600);
                            }
                          }
                          const trasTst = await llamar(api.relacionListar(proyectoTst));
                          salida.testamentosAuto.restos = trasTst
                            .filter((r) => String(r.bloque_id) === String(bloqueTstId)).length;
                        }
                        if (patrimonioTestamentosPrueba) {
                          try {
                            await llamar(api.entidadEliminar('patrimonio', patrimonioTestamentosPrueba.id));
                          } catch { /* limpieza best-effort */ }
                        }

                        /* Cuenta personal: DEBE y HABER independientes */
                        const btnAddCuenta = [...document.querySelectorAll('.cuadernos-barra .btn')]
                          .find((b) => b.textContent.includes('Añadir bloque de registro'));
                        if (btnAddCuenta) btnAddCuenta.click();
                        await esperar(300);
                        const periodoCuenta = [...document.querySelectorAll('.bloques-periodo')].find((b) => !b.disabled);
                        if (periodoCuenta) { periodoCuenta.click(); await esperar(400); }
                        const opcionCuenta = [...document.querySelectorAll('.bloque-opcion')]
                          .find((b) => b.textContent === 'Cuenta personal');
                        if (opcionCuenta) {
                          opcionCuenta.click();
                          await esperar(1300);
                          const grupoDebe = document.querySelector('.grupo-bloque[data-grupo="g-inventario-debe"]');
                          const grupoHaber = document.querySelector('.grupo-bloque[data-grupo="g-inventario-haber"]');
                          const totalesDebe = document.querySelector('.totales-inventario[data-totales="totales-inventario-debe"]');
                          const totalesHaber = document.querySelector('.totales-inventario[data-totales="totales-inventario-haber"]');
                          const campoCta = (fila, etiqueta) => [...(fila?.querySelectorAll('.campo') || [])]
                            .find((c) => c.querySelector('label')?.textContent === etiqueta);
                          const fijarCta = (fila, etiqueta, valor) => {
                            const input = campoCta(fila, etiqueta)?.querySelector('input');
                            if (input) {
                              input.value = valor;
                              input.dispatchEvent(new Event('input', { bubbles: true }));
                            }
                          };
                          const leerCta = (fila, etiqueta) => campoCta(fila, etiqueta)?.querySelector('input')?.value ?? null;
                          const leerTotalCta = (bloque, etiqueta) => {
                            const fila = bloque?.querySelector('.fila-inventario');
                            return leerCta(fila, etiqueta);
                          };
                          const filasDebe = [...(grupoDebe?.querySelectorAll('.inventario-items .fila-inventario') || [])];
                          const filasHaber = [...(grupoHaber?.querySelectorAll('.inventario-items .fila-inventario') || [])];
                          salida.cuenta = {
                            debe: !!grupoDebe,
                            haber: !!grupoHaber,
                            totalesDebe: !!totalesDebe,
                            totalesHaber: !!totalesHaber,
                            instanciasDebe: grupoDebe?.querySelectorAll('.grupo-instancia').length || 0,
                            instanciasHaber: grupoHaber?.querySelectorAll('.grupo-instancia').length || 0,
                          };
                          fijarCta(filasDebe[0], 'CANTIDAD', '10');
                          fijarCta(filasDebe[0], 'PESO', '200');
                          await esperar(250);
                          salida.cuenta.subtotalDebe = [
                            leerCta(filasDebe[1], 'SUBTOTAL CANTIDAD'),
                            leerCta(filasDebe[1], 'SUBTOTAL PESO'),
                          ];
                          salida.cuenta.totalDebe = [
                            leerTotalCta(totalesDebe, 'TOTAL SUBTOTALES CANTIDAD'),
                            leerTotalCta(totalesDebe, 'TOTAL SUBTOTALES PESO'),
                          ];
                          salida.cuenta.totalHaberInicial = [
                            leerTotalCta(totalesHaber, 'TOTAL SUBTOTALES CANTIDAD'),
                            leerTotalCta(totalesHaber, 'TOTAL SUBTOTALES PESO'),
                          ];
                          fijarCta(filasHaber[0], 'CANTIDAD', '4');
                          fijarCta(filasHaber[0], 'PESO', '50');
                          await esperar(250);
                          salida.cuenta.subtotalHaber = [
                            leerCta(filasHaber[1], 'SUBTOTAL CANTIDAD'),
                            leerCta(filasHaber[1], 'SUBTOTAL PESO'),
                          ];
                          salida.cuenta.totalHaber = [
                            leerTotalCta(totalesHaber, 'TOTAL SUBTOTALES CANTIDAD'),
                            leerTotalCta(totalesHaber, 'TOTAL SUBTOTALES PESO'),
                          ];
                          salida.cuenta.totalDebeTrasHaber = [
                            leerTotalCta(totalesDebe, 'TOTAL SUBTOTALES CANTIDAD'),
                            leerTotalCta(totalesDebe, 'TOTAL SUBTOTALES PESO'),
                          ];
                          const btnAddCatDebe = grupoDebe?.querySelector('.grupo-cab .btn');
                          if (btnAddCatDebe) {
                            btnAddCatDebe.click();
                            await esperar(300);
                            const instanciasDebe = [...grupoDebe.querySelectorAll('.grupo-instancia')];
                            const filasDebe2 = [...(instanciasDebe[1]?.querySelectorAll('.inventario-items .fila-inventario') || [])];
                            fijarCta(filasDebe2[0], 'CANTIDAD', '5');
                            fijarCta(filasDebe2[0], 'PESO', '25');
                            await esperar(250);
                            salida.cuenta.instanciasDebeTrasAnadir = instanciasDebe.length;
                            salida.cuenta.totalDebeFinal = [
                              leerTotalCta(totalesDebe, 'TOTAL SUBTOTALES CANTIDAD'),
                              leerTotalCta(totalesDebe, 'TOTAL SUBTOTALES PESO'),
                            ];
                            salida.cuenta.totalHaberFinal = [
                              leerTotalCta(totalesHaber, 'TOTAL SUBTOTALES CANTIDAD'),
                              leerTotalCta(totalesHaber, 'TOTAL SUBTOTALES PESO'),
                            ];
                          }
                          salida.cuenta.readonly = [...document.querySelectorAll(
                            '.form-bloque .entrada-subtotal-cantidad, .form-bloque .entrada-subtotal-peso, .form-bloque .entrada-subtotal-reales, .form-bloque .entrada-subtotal-cuartillos, .form-bloque .entrada-total-cantidad, .form-bloque .entrada-total-peso, .form-bloque .entrada-total-reales, .form-bloque .entrada-total-cuartillos'
                          )].every((i) => i.readOnly);
                          const formCta = document.querySelector('.form-bloque');
                          const campoFormCta = (etiqueta) => [...(formCta?.querySelectorAll('.campo') || [])]
                            .find((c) => c.querySelector('label')?.textContent === etiqueta);
                          const seleccionarOpcionCta = (sel, indice = 1) => {
                            if (!sel) return;
                            const opciones = [...sel.options].filter((o) => o.value);
                            if (opciones[indice - 1]) sel.value = opciones[indice - 1].value;
                            sel.dispatchEvent(new Event('change', { bubbles: true }));
                          };
                          const fijarSelectCta = (etiqueta, indice = 1) => {
                            seleccionarOpcionCta(campoFormCta(etiqueta)?.querySelector('select'), indice);
                          };
                          const fijarEntradaCta = (etiqueta, valor) => {
                            const input = campoFormCta(etiqueta)?.querySelector('input');
                            if (!input) return;
                            input.value = valor;
                            input.dispatchEvent(new Event('input', { bubbles: true }));
                            input.dispatchEvent(new Event('change', { bubbles: true }));
                          };
                          const rolesTopCta = [...(formCta?.querySelectorAll(':scope > .bloque-personas') || [])];
                          const vincularRolCta = (titulo, indicePersona, indiceInstitucion) => {
                            const rol = rolesTopCta.find(
                              (r) => r.querySelector('.rol-titulo')?.textContent === titulo
                            );
                            const fila = rol?.querySelector(':scope > .filas-persona > .fila-persona');
                            if (!fila) return;
                            const campoFila = (etiqueta) => [...fila.querySelectorAll('.campo')]
                              .find((c) => c.querySelector('label')?.textContent === etiqueta);
                            seleccionarOpcionCta(
                              campoFila('VINCULAR PERSONA')?.querySelector('select'), indicePersona
                            );
                            seleccionarOpcionCta(
                              campoFila('VINCULAR INSTITUCIÓN')?.querySelector('select'), indiceInstitucion
                            );
                          };
                          fijarSelectCta('LUGAR');
                          fijarEntradaCta('AÑO', '1727');
                          fijarEntradaCta('FECHA EXACTA', '07-08-1727');
                          vincularRolCta('ESCRIBANO/NOTARIO', 1, 1);
                          vincularRolCta('ACREEDOR', 2, 2);
                          vincularRolCta('DEUDOR', 3, 3);
                          const tarjetaCta = [...document.querySelectorAll('.bloque-registrado')].pop();
                          if (tarjetaCta) {
                            const guardarCta = [...tarjetaCta.querySelectorAll('.bloque-registrado-acciones .btn')]
                              .find((b) => b.textContent === 'GUARDAR');
                            if (guardarCta) { guardarCta.click(); await esperar(1200); }
                            const proyectoCta = Number(new URLSearchParams(location.search).get('id'));
                            const todasRelCta = await llamar(api.relacionListar(proyectoCta));
                            const autosCta = todasRelCta.filter(
                              (r) => String(r.bloque_id) === String(tarjetaCta.dataset.bloqueId)
                            );
                            salida.cuentaAuto = {
                              bloqueId: tarjetaCta.dataset.bloqueId,
                              total: autosCta.length,
                              tipos: autosCta.map((r) => r.tipo),
                              reglas: autosCta.map((r) => r.regla).sort(),
                              destinos: autosCta.map(
                                (r) => r.origen_tipo + ':' + r.origen_id + '->' + r.destino_tipo + ':' + r.destino_id
                              ),
                              procedencias: [...new Set(autosCta.map((r) => r.procedencia))],
                              fuentes: autosCta.map((r) => (r.fuentes || []).length),
                              fechas: autosCta.map((r) => r.fecha_exacta_inicio),
                            };
                            const eliminarCta = [...tarjetaCta.querySelectorAll('.bloque-registrado-acciones .btn')]
                              .find((b) => b.textContent === 'ELIMINAR');
                            if (eliminarCta) {
                              eliminarCta.click();
                              await esperar(300);
                              const modalCta = [...document.querySelectorAll('.modal')].pop();
                              if (modalCta) {
                                const okCta = [...modalCta.querySelectorAll('.modal-acciones .btn')]
                                  .find((b) => b.textContent === 'Aceptar');
                                if (okCta) okCta.click();
                              }
                              await esperar(600);
                            }
                            const trasCta = await llamar(api.relacionListar(proyectoCta));
                            salida.cuentaAuto.restos = trasCta
                              .filter((r) => String(r.bloque_id) === String(tarjetaCta.dataset.bloqueId)).length;
                          }
                          salida.cuenta.restos = document.querySelectorAll('.bloque-registrado').length;
                        }

                        /* ACTAS: relaciones automatizadas desde el bloque */
                        const btnAddActas = [...document.querySelectorAll('.cuadernos-barra .btn')]
                          .find((b) => b.textContent.includes('Añadir bloque de registro'));
                        if (btnAddActas) btnAddActas.click();
                        await esperar(300);
                        const periodoActas = [...document.querySelectorAll('.bloques-periodo')].find((b) => !b.disabled);
                        if (periodoActas) { periodoActas.click(); await esperar(400); }
                        const opcionActas = [...document.querySelectorAll('.bloque-opcion')]
                          .find((b) => b.textContent === 'Actas, acuerdos y resoluciones');
                        if (opcionActas) {
                          const tarjetasAntesActas = document.querySelectorAll('.bloque-registrado').length;
                          opcionActas.click();
                          for (let i = 0; i < 30 && document.querySelectorAll('.bloque-registrado').length <= tarjetasAntesActas; i++) {
                            await esperar(200);
                          }
                          await esperar(800);
                          const tarjetaActas = document.querySelectorAll('.bloque-registrado').length > tarjetasAntesActas
                            ? [...document.querySelectorAll('.bloque-registrado')].pop()
                            : null;
                          for (let i = 0; i < 20 && !tarjetaActas?.querySelector('.form-bloque'); i++) await esperar(200);
                          const formActas = tarjetaActas?.querySelector('.form-bloque');
                          const camposForm = () => (formActas ? [...formActas.querySelectorAll('.campo')] : []);
                          const campoForm = (etiqueta) => camposForm()
                            .find((c) => c.querySelector('label')?.textContent === etiqueta);
                          const fijarSelect = (etiqueta, indiceOpcion = 1) => {
                            const sel = campoForm(etiqueta)?.querySelector('select');
                            if (!sel) return;
                            const opciones = [...sel.options].filter((o) => o.value);
                            if (opciones[indiceOpcion - 1]) sel.value = opciones[indiceOpcion - 1].value;
                            sel.dispatchEvent(new Event('change', { bubbles: true }));
                          };
                          const fijarEntrada = (etiqueta, valor) => {
                            const input = campoForm(etiqueta)?.querySelector('input');
                            if (!input) return;
                            input.value = valor;
                            input.dispatchEvent(new Event('input', { bubbles: true }));
                            input.dispatchEvent(new Event('change', { bubbles: true }));
                          };
                          fijarSelect('LUGAR');
                          fijarSelect('INSTITUCIÓN');
                          fijarEntrada('AÑO', '1700');
                          fijarEntrada('FECHA EXACTA', '07-02-1700');
                          const rolActas = formActas
                            ? [...formActas.querySelectorAll('.bloque-personas')]
                              .find((b) => b.querySelector('.rol-titulo')?.textContent === 'AUTORIDAD EMISORA')
                            : null;
                          if (rolActas) {
                            const campoRol = (etiqueta) => [...rolActas.querySelectorAll('.campo')]
                              .find((c) => c.querySelector('label')?.textContent === etiqueta);
                            const selPersona = campoRol('VINCULAR PERSONA')?.querySelector('select');
                            const selInstitucion = campoRol('VINCULAR INSTITUCIÓN')?.querySelector('select');
                            if (selPersona) {
                              const op = [...selPersona.options].find((o) => o.value);
                              if (op) {
                                selPersona.value = op.value;
                                selPersona.dispatchEvent(new Event('change', { bubbles: true }));
                              }
                            }
                            if (selInstitucion) {
                              const opciones = [...selInstitucion.options].filter((o) => o.value);
                              if (opciones[0]) {
                                selInstitucion.value = opciones[0].value;
                                selInstitucion.dispatchEvent(new Event('change', { bubbles: true }));
                              }
                            }
                          }
                          const rolEscribanoActas = formActas
                            ? [...formActas.querySelectorAll('.bloque-personas')]
                              .find((b) => b.querySelector('.rol-titulo')?.textContent === 'ESCRIBANO/NOTARIO')
                            : null;
                          if (rolEscribanoActas) {
                            const campoRol = (etiqueta) => [...rolEscribanoActas.querySelectorAll('.campo')]
                              .find((c) => c.querySelector('label')?.textContent === etiqueta);
                            const selPersona = campoRol('VINCULAR PERSONA')?.querySelector('select');
                            const selInstitucion = campoRol('VINCULAR INSTITUCIÓN')?.querySelector('select');
                            const opciones = (sel) => [...(sel?.options || [])].filter((o) => o.value);
                            const persona = opciones(selPersona)[1];
                            const institucion = opciones(selInstitucion)[1];
                            if (persona) {
                              selPersona.value = persona.value;
                              selPersona.dispatchEvent(new Event('change', { bubbles: true }));
                            }
                            if (institucion) {
                              selInstitucion.value = institucion.value;
                              selInstitucion.dispatchEvent(new Event('change', { bubbles: true }));
                            }
                          }
                          /* Varias instituciones en una misma persona:
                             cada línea de empleo crea y vincula la suya. */
                          let institucionesMultiActas = [];
                          if (formActas) {
                            const rolVocalesActas = [...formActas.querySelectorAll('.bloque-personas')]
                              .find((b) => b.querySelector('.rol-titulo')?.textContent === 'VOCALES/CONSEJEROS');
                            if (rolVocalesActas) {
                              const campoLinea = (linea, etiqueta) => [...linea.querySelectorAll('.campo')]
                                .find((c) => c.querySelector('label')?.textContent === etiqueta);
                              const lineasEmpleo = () => [...rolVocalesActas.querySelectorAll(
                                ':scope > .filas-persona > .fila-persona > .persona-linea'
                              )].filter((l) => campoLinea(l, 'INSTITUCIÓN'));
                              const escribirInstitucion = (linea, nombre) => {
                                const input = campoLinea(linea, 'INSTITUCIÓN')?.querySelector('input');
                                if (!input) return;
                                input.value = nombre;
                                input.dispatchEvent(new Event('input', { bubbles: true }));
                                input.dispatchEvent(new Event('change', { bubbles: true }));
                              };
                              const lineaA = lineasEmpleo()[0];
                              if (lineaA) {
                                escribirInstitucion(lineaA, 'Institución múltiple A');
                                const btnA = [...lineaA.querySelectorAll('.btn')]
                                  .find((b) => b.textContent.includes('Crear institución'));
                                if (btnA) { btnA.click(); await esperar(900); }
                              }
                              const btnAddEmpleoV = [...rolVocalesActas.querySelectorAll('.btn[title="Añadir empleo"]')][0];
                              if (btnAddEmpleoV) { btnAddEmpleoV.click(); await esperar(500); }
                              const lineasV = lineasEmpleo();
                              const lineaB = lineasV.find((l) => {
                                const input = campoLinea(l, 'INSTITUCIÓN')?.querySelector('input');
                                return input && !input.value;
                              }) || lineasV[lineasV.length - 1];
                              if (lineaB) {
                                escribirInstitucion(lineaB, 'Institución múltiple B');
                                const btnB = [...lineaB.querySelectorAll('.btn')]
                                  .find((b) => b.textContent.includes('Crear institución'));
                                if (btnB) { btnB.click(); await esperar(900); }
                              }
                              const selPersonaV = [...rolVocalesActas.querySelectorAll('.campo')]
                                .find((c) => c.querySelector('label')?.textContent === 'VINCULAR PERSONA')
                                ?.querySelector('select');
                              const opcionV = [...(selPersonaV?.options || [])].find((o) => o.value);
                              if (selPersonaV && opcionV) {
                                selPersonaV.value = opcionV.value;
                                selPersonaV.dispatchEvent(new Event('change', { bubbles: true }));
                              }
                            }
                          }
                          const bloqueActasId = tarjetaActas?.dataset.bloqueId || null;
                          if (tarjetaActas) {
                            const guardarActas = [...tarjetaActas.querySelectorAll('.bloque-registrado-acciones .btn')]
                              .find((b) => b.textContent === 'GUARDAR');
                            if (guardarActas) { guardarActas.click(); await esperar(1000); }
                          }
                          const proyectoActual = Number(new URLSearchParams(location.search).get('id'));
                          const todasRel = await llamar(api.relacionListar(proyectoActual));
                          const autosActas = todasRel.filter((r) => String(r.bloque_id) === String(bloqueActasId));
                          salida.actasAuto = {
                            bloqueId: bloqueActasId,
                            total: autosActas.length,
                            tipos: autosActas.map((r) => r.tipo),
                            procedencias: [...new Set(autosActas.map((r) => r.procedencia))],
                            fuentes: autosActas.map((r) => (r.fuentes || []).length),
                            fechas: autosActas.map((r) => r.fecha_exacta_inicio),
                          };
                          try {
                            const fuentesMulti = await llamar(api.entidadListar('fuente', proyectoActual));
                            let datosMulti = null;
                            for (const f of fuentesMulti) {
                              const bs = await llamar(api.bloqueListar(f.id));
                              const b = bs.find((x) => String(x.id) === String(bloqueActasId));
                              if (b) { datosMulti = b.datos; break; }
                            }
                            const filaV = datosMulti?.personas?.p2?.[0] || null;
                            const insts = (filaV?.empleos || [])
                              .map((e) => String(e.institucion_id || ''))
                              .filter((x) => x && x !== 'null');
                            const miembros = autosActas
                              .filter((r) => r.tipo === 'Miembro'
                                && String(r.origen_id) === String(filaV?.persona_id))
                              .map((r) => String(r.destino_id));
                            salida.actasMultiInstitucion = {
                              institucionPrincipal: filaV?.institucion_id || null,
                              institucionesLineas: insts,
                              miembros,
                              correcto: insts.length === 2
                                && insts.every((id) => miembros.includes(id)),
                            };
                            institucionesMultiActas = insts;
                          } catch (err) {
                            salida.actasMultiInstitucion = { error: String(err.message || err) };
                          }
                          if (tarjetaActas) {
                            const eliminarActas = [...tarjetaActas.querySelectorAll('.bloque-registrado-acciones .btn')]
                              .find((b) => b.textContent === 'ELIMINAR');
                            if (eliminarActas) {
                              eliminarActas.click();
                              await esperar(300);
                              const modalActas = [...document.querySelectorAll('.modal')].pop();
                              if (modalActas) {
                                const okActas = [...modalActas.querySelectorAll('.modal-acciones .btn')]
                                  .find((b) => b.textContent === 'Aceptar');
                                if (okActas) okActas.click();
                              }
                              await esperar(700);
                            }
                          }
                          const trasActas = await llamar(api.relacionListar(proyectoActual));
                          salida.actasAuto.restos = trasActas
                            .filter((r) => String(r.bloque_id) === String(bloqueActasId)).length;
                          for (const id of institucionesMultiActas) {
                            try {
                              await llamar(api.entidadEliminar('institucion', Number(id)));
                            } catch { /* limpieza */ }
                          }
                        }

                        /* COMUNICACIONES: relaciones automatizadas desde el bloque */
                        const btnAddCom = [...document.querySelectorAll('.cuadernos-barra .btn')]
                          .find((b) => b.textContent.includes('Añadir bloque de registro'));
                        if (btnAddCom) btnAddCom.click();
                        await esperar(300);
                        const periodoCom = [...document.querySelectorAll('.bloques-periodo')].find((b) => !b.disabled);
                        if (periodoCom) { periodoCom.click(); await esperar(400); }
                        const opcionCom = [...document.querySelectorAll('.bloque-opcion')]
                          .find((b) => b.textContent === 'Comunicaciones');
                        if (opcionCom) {
                          const tarjetasAntesCom = document.querySelectorAll('.bloque-registrado').length;
                          opcionCom.click();
                          for (let i = 0; i < 30 && document.querySelectorAll('.bloque-registrado').length <= tarjetasAntesCom; i++) {
                            await esperar(200);
                          }
                          await esperar(800);
                          const tarjetaCom = document.querySelectorAll('.bloque-registrado').length > tarjetasAntesCom
                            ? [...document.querySelectorAll('.bloque-registrado')].pop()
                            : null;
                          for (let i = 0; i < 20 && !tarjetaCom?.querySelector('.form-bloque'); i++) await esperar(200);
                          const formCom = tarjetaCom?.querySelector('.form-bloque');
                          const camposCom = () => (formCom ? [...formCom.querySelectorAll('.campo')] : []);
                          const campoCom = (etiqueta) => camposCom()
                            .find((c) => c.querySelector('label')?.textContent === etiqueta);
                          const fijarSelectCom = (etiqueta, indiceOpcion = 1) => {
                            const sel = campoCom(etiqueta)?.querySelector('select');
                            if (!sel) return;
                            const opciones = [...sel.options].filter((o) => o.value);
                            if (opciones[indiceOpcion - 1]) sel.value = opciones[indiceOpcion - 1].value;
                            sel.dispatchEvent(new Event('change', { bubbles: true }));
                          };
                          const fijarEntradaCom = (etiqueta, valor) => {
                            const input = campoCom(etiqueta)?.querySelector('input');
                            if (!input) return;
                            input.value = valor;
                            input.dispatchEvent(new Event('input', { bubbles: true }));
                            input.dispatchEvent(new Event('change', { bubbles: true }));
                          };
                          fijarSelectCom('LUGAR');
                          fijarSelectCom('INSTITUCIÓN');
                          fijarEntradaCom('AÑO', '1701');
                          fijarEntradaCom('FECHA EXACTA', '12-03-1701');
                          const rolCom = (titulo) => (formCom
                            ? [...formCom.querySelectorAll('.bloque-personas')]
                              .find((b) => b.querySelector('.rol-titulo')?.textContent === titulo)
                            : null);
                          const vincularCom = (titulo, indicePersona, indiceInstitucion) => {
                            const rol = rolCom(titulo);
                            if (!rol) return;
                            const campoRol = (etiqueta) => [...rol.querySelectorAll('.campo')]
                              .find((c) => c.querySelector('label')?.textContent === etiqueta);
                            const selPersona = campoRol('VINCULAR PERSONA')?.querySelector('select');
                            const selInstitucion = campoRol('VINCULAR INSTITUCIÓN')?.querySelector('select');
                            const opciones = (sel) => [...(sel?.options || [])].filter((o) => o.value);
                            const persona = opciones(selPersona)[indicePersona - 1];
                            const institucion = opciones(selInstitucion)[indiceInstitucion - 1];
                            if (persona) {
                              selPersona.value = persona.value;
                              selPersona.dispatchEvent(new Event('change', { bubbles: true }));
                            }
                            if (institucion) {
                              selInstitucion.value = institucion.value;
                              selInstitucion.dispatchEvent(new Event('change', { bubbles: true }));
                            }
                          };
                          vincularCom('REMITENTE', 1, 1);
                          vincularCom('DESTINATARIO', 2, 2);
                          vincularCom('ESCRIBANO/NOTARIO', 3, 3);
                          const bloqueComId = tarjetaCom?.dataset.bloqueId || null;
                          if (tarjetaCom) {
                            const guardarCom = [...tarjetaCom.querySelectorAll('.bloque-registrado-acciones .btn')]
                              .find((b) => b.textContent === 'GUARDAR');
                            if (guardarCom) { guardarCom.click(); await esperar(1000); }
                          }
                          const proyectoCom = Number(new URLSearchParams(location.search).get('id'));
                          const todasRelCom = await llamar(api.relacionListar(proyectoCom));
                          const autosCom = todasRelCom.filter((r) => String(r.bloque_id) === String(bloqueComId));
                          salida.comunicacionesAuto = {
                            bloqueId: bloqueComId,
                            total: autosCom.length,
                            tipos: autosCom.map((r) => r.tipo),
                            procedencias: [...new Set(autosCom.map((r) => r.procedencia))],
                            fuentes: autosCom.map((r) => (r.fuentes || []).length),
                            fechas: autosCom.map((r) => r.fecha_exacta_inicio),
                            correspondientesLegales: autosCom
                              .filter((r) => r.tipo === 'Correspondientes legales')
                              .map((r) => r.origen_tipo + ':' + r.origen_id + '->' + r.destino_tipo + ':' + r.destino_id),
                          };
                          if (tarjetaCom) {
                            const eliminarCom = [...tarjetaCom.querySelectorAll('.bloque-registrado-acciones .btn')]
                              .find((b) => b.textContent === 'ELIMINAR');
                            if (eliminarCom) {
                              eliminarCom.click();
                              await esperar(300);
                              const modalCom = [...document.querySelectorAll('.modal')].pop();
                              if (modalCom) {
                                const okCom = [...modalCom.querySelectorAll('.modal-acciones .btn')]
                                  .find((b) => b.textContent === 'Aceptar');
                                if (okCom) okCom.click();
                              }
                              await esperar(700);
                            }
                          }
                          const trasCom = await llamar(api.relacionListar(proyectoCom));
                          salida.comunicacionesAuto.restos = trasCom
                            .filter((r) => String(r.bloque_id) === String(bloqueComId)).length;
                        }

                        /* LEYES, DECRETOS, ORDENANZAS Y REGLAMENTOS: relaciones automatizadas */
                        const btnAddLeyes = [...document.querySelectorAll('.cuadernos-barra .btn')]
                          .find((b) => b.textContent.includes('Añadir bloque de registro'));
                        if (btnAddLeyes) btnAddLeyes.click();
                        await esperar(300);
                        const periodoLeyes = [...document.querySelectorAll('.bloques-periodo')].find((b) => !b.disabled);
                        if (periodoLeyes) { periodoLeyes.click(); await esperar(400); }
                        const opcionLeyes = [...document.querySelectorAll('.bloque-opcion')]
                          .find((b) => b.textContent === 'Leyes, decretos, ordenanzas, reglamentos');
                        if (opcionLeyes) {
                          const tarjetasAntesLeyes = document.querySelectorAll('.bloque-registrado').length;
                          opcionLeyes.click();
                          for (let i = 0; i < 30 && document.querySelectorAll('.bloque-registrado').length <= tarjetasAntesLeyes; i++) {
                            await esperar(200);
                          }
                          await esperar(800);
                          const tarjetaLeyes = document.querySelectorAll('.bloque-registrado').length > tarjetasAntesLeyes
                            ? [...document.querySelectorAll('.bloque-registrado')].pop()
                            : null;
                          for (let i = 0; i < 20 && !tarjetaLeyes?.querySelector('.form-bloque'); i++) await esperar(200);
                          const formLeyes = tarjetaLeyes?.querySelector('.form-bloque');
                          const camposLeyes = () => (formLeyes ? [...formLeyes.querySelectorAll('.campo')] : []);
                          const campoLeyes = (etiqueta) => camposLeyes()
                            .find((c) => c.querySelector('label')?.textContent === etiqueta);
                          const fijarSelectLeyes = (etiqueta, indiceOpcion = 1) => {
                            const sel = campoLeyes(etiqueta)?.querySelector('select');
                            if (!sel) return;
                            const opciones = [...sel.options].filter((o) => o.value);
                            if (opciones[indiceOpcion - 1]) sel.value = opciones[indiceOpcion - 1].value;
                            sel.dispatchEvent(new Event('change', { bubbles: true }));
                          };
                          const fijarEntradaLeyes = (etiqueta, valor) => {
                            const input = campoLeyes(etiqueta)?.querySelector('input');
                            if (!input) return;
                            input.value = valor;
                            input.dispatchEvent(new Event('input', { bubbles: true }));
                            input.dispatchEvent(new Event('change', { bubbles: true }));
                          };
                          fijarSelectLeyes('LUGAR');
                          fijarSelectLeyes('INSTITUCIÓN');
                          fijarEntradaLeyes('AÑO', '1702');
                          fijarEntradaLeyes('FECHA EXACTA', '08-04-1702');
                          const rolLeyes = (titulo) => (formLeyes
                            ? [...formLeyes.querySelectorAll('.bloque-personas')]
                              .find((b) => b.querySelector('.rol-titulo')?.textContent === titulo)
                            : null);
                          const vincularLeyes = (titulo, indicePersona, indiceInstitucion) => {
                            const rol = rolLeyes(titulo);
                            if (!rol) return;
                            const campoRol = (etiqueta) => [...rol.querySelectorAll('.campo')]
                              .find((c) => c.querySelector('label')?.textContent === etiqueta);
                            const selPersona = campoRol('VINCULAR PERSONA')?.querySelector('select');
                            const selInstitucion = campoRol('VINCULAR INSTITUCIÓN')?.querySelector('select');
                            const opciones = (sel) => [...(sel?.options || [])].filter((o) => o.value);
                            const persona = opciones(selPersona)[indicePersona - 1];
                            const institucion = opciones(selInstitucion)[indiceInstitucion - 1];
                            if (persona) {
                              selPersona.value = persona.value;
                              selPersona.dispatchEvent(new Event('change', { bubbles: true }));
                            }
                            if (institucion) {
                              selInstitucion.value = institucion.value;
                              selInstitucion.dispatchEvent(new Event('change', { bubbles: true }));
                            }
                          };
                          vincularLeyes('AUTORIDAD EMISORA', 1, 1);
                          vincularLeyes('VOCALES/CONSEJEROS', 2, 2);
                          vincularLeyes('ESCRIBANO/NOTARIO', 3, 3);
                          const bloqueLeyesId = tarjetaLeyes?.dataset.bloqueId || null;
                          if (tarjetaLeyes) {
                            const guardarLeyes = [...tarjetaLeyes.querySelectorAll('.bloque-registrado-acciones .btn')]
                              .find((b) => b.textContent === 'GUARDAR');
                            if (guardarLeyes) { guardarLeyes.click(); await esperar(1000); }
                          }
                          const proyectoLeyes = Number(new URLSearchParams(location.search).get('id'));
                          const todasRelLeyes = await llamar(api.relacionListar(proyectoLeyes));
                          const autosLeyes = todasRelLeyes.filter((r) => String(r.bloque_id) === String(bloqueLeyesId));
                          salida.leyesAuto = {
                            bloqueId: bloqueLeyesId,
                            total: autosLeyes.length,
                            tipos: autosLeyes.map((r) => r.tipo),
                            reglas: autosLeyes.map((r) => r.regla).sort(),
                            procedencias: [...new Set(autosLeyes.map((r) => r.procedencia))],
                            fuentes: autosLeyes.map((r) => (r.fuentes || []).length),
                            fechas: autosLeyes.map((r) => r.fecha_exacta_inicio),
                          };
                          if (tarjetaLeyes) {
                            const eliminarLeyes = [...tarjetaLeyes.querySelectorAll('.bloque-registrado-acciones .btn')]
                              .find((b) => b.textContent === 'ELIMINAR');
                            if (eliminarLeyes) {
                              eliminarLeyes.click();
                              await esperar(300);
                              const modalLeyes = [...document.querySelectorAll('.modal')].pop();
                              if (modalLeyes) {
                                const okLeyes = [...modalLeyes.querySelectorAll('.modal-acciones .btn')]
                                  .find((b) => b.textContent === 'Aceptar');
                                if (okLeyes) okLeyes.click();
                              }
                              await esperar(700);
                            }
                          }
                          const trasLeyes = await llamar(api.relacionListar(proyectoLeyes));
                          salida.leyesAuto.restos = trasLeyes
                            .filter((r) => String(r.bloque_id) === String(bloqueLeyesId)).length;
                        }

                        /* ELECCIONES: relaciones automatizadas desde el bloque */
                        const btnAddElecciones = [...document.querySelectorAll('.cuadernos-barra .btn')]
                          .find((b) => b.textContent.includes('Añadir bloque de registro'));
                        if (btnAddElecciones) btnAddElecciones.click();
                        await esperar(300);
                        const periodoElecciones = [...document.querySelectorAll('.bloques-periodo')].find((b) => !b.disabled);
                        if (periodoElecciones) { periodoElecciones.click(); await esperar(400); }
                        const opcionElecciones = [...document.querySelectorAll('.bloque-opcion')]
                          .find((b) => b.textContent === 'Elecciones');
                        if (opcionElecciones) {
                          const tarjetasAntesElecciones = document.querySelectorAll('.bloque-registrado').length;
                          opcionElecciones.click();
                          for (let i = 0; i < 30 && document.querySelectorAll('.bloque-registrado').length <= tarjetasAntesElecciones; i++) {
                            await esperar(200);
                          }
                          await esperar(800);
                          const tarjetaElecciones = document.querySelectorAll('.bloque-registrado').length > tarjetasAntesElecciones
                            ? [...document.querySelectorAll('.bloque-registrado')].pop()
                            : null;
                          for (let i = 0; i < 20 && !tarjetaElecciones?.querySelector('.form-bloque'); i++) await esperar(200);
                          const formElecciones = tarjetaElecciones?.querySelector('.form-bloque');
                          const camposElecciones = () => (formElecciones ? [...formElecciones.querySelectorAll('.campo')] : []);
                          const campoElecciones = (etiqueta) => camposElecciones()
                            .find((c) => c.querySelector('label')?.textContent === etiqueta);
                          const fijarSelectElecciones = (etiqueta, indiceOpcion = 1) => {
                            const sel = campoElecciones(etiqueta)?.querySelector('select');
                            if (!sel) return;
                            const opciones = [...sel.options].filter((o) => o.value);
                            if (opciones[indiceOpcion - 1]) sel.value = opciones[indiceOpcion - 1].value;
                            sel.dispatchEvent(new Event('change', { bubbles: true }));
                          };
                          const fijarEntradaElecciones = (etiqueta, valor) => {
                            const input = campoElecciones(etiqueta)?.querySelector('input');
                            if (!input) return;
                            input.value = valor;
                            input.dispatchEvent(new Event('input', { bubbles: true }));
                            input.dispatchEvent(new Event('change', { bubbles: true }));
                          };
                          fijarSelectElecciones('LUGAR');
                          fijarSelectElecciones('INSTITUCIÓN');
                          fijarEntradaElecciones('AÑO', '1703');
                          fijarEntradaElecciones('FECHA EXACTA', '10-05-1703');
                          const rolElecciones = (titulo) => (formElecciones
                            ? [...formElecciones.querySelectorAll('.bloque-personas')]
                              .find((b) => b.querySelector('.rol-titulo')?.textContent === titulo)
                            : null);
                          const vincularElecciones = (titulo, indicePersona, indiceInstitucion) => {
                            const rol = rolElecciones(titulo);
                            if (!rol) return;
                            const campoRol = (etiqueta) => [...rol.querySelectorAll('.campo')]
                              .find((c) => c.querySelector('label')?.textContent === etiqueta);
                            const selPersona = campoRol('VINCULAR PERSONA')?.querySelector('select');
                            const selInstitucion = campoRol('VINCULAR INSTITUCIÓN')?.querySelector('select');
                            const opciones = (sel) => [...(sel?.options || [])].filter((o) => o.value);
                            const persona = opciones(selPersona)[indicePersona - 1];
                            const institucion = opciones(selInstitucion)[indiceInstitucion - 1];
                            if (persona) {
                              selPersona.value = persona.value;
                              selPersona.dispatchEvent(new Event('change', { bubbles: true }));
                            }
                            if (institucion) {
                              selInstitucion.value = institucion.value;
                              selInstitucion.dispatchEvent(new Event('change', { bubbles: true }));
                            }
                          };
                          vincularElecciones('AUTORIDAD EMISORA', 1, 1);
                          vincularElecciones('VOCALES/CONSEJEROS', 2, 2);
                          vincularElecciones('ESCRIBANO/NOTARIO', 3, 3);
                          vincularElecciones('ELECTORES', 4, 4);
                          vincularElecciones('ELEGIBLES', 5, 5);
                          vincularElecciones('ELECTOS', 1, 2);
                          const bloqueEleccionesId = tarjetaElecciones?.dataset.bloqueId || null;
                          if (tarjetaElecciones) {
                            const guardarElecciones = [...tarjetaElecciones.querySelectorAll('.bloque-registrado-acciones .btn')]
                              .find((b) => b.textContent === 'GUARDAR');
                            if (guardarElecciones) { guardarElecciones.click(); await esperar(1000); }
                          }
                          const proyectoElecciones = Number(new URLSearchParams(location.search).get('id'));
                          const todasRelElecciones = await llamar(api.relacionListar(proyectoElecciones));
                          const autosElecciones = todasRelElecciones.filter((r) => String(r.bloque_id) === String(bloqueEleccionesId));
                          salida.eleccionesAuto = {
                            bloqueId: bloqueEleccionesId,
                            total: autosElecciones.length,
                            tipos: autosElecciones.map((r) => r.tipo),
                            reglas: autosElecciones.map((r) => r.regla).sort(),
                            procedencias: [...new Set(autosElecciones.map((r) => r.procedencia))],
                            fuentes: autosElecciones.map((r) => (r.fuentes || []).length),
                            fechas: autosElecciones.map((r) => r.fecha_exacta_inicio),
                          };
                          if (tarjetaElecciones) {
                            const eliminarElecciones = [...tarjetaElecciones.querySelectorAll('.bloque-registrado-acciones .btn')]
                              .find((b) => b.textContent === 'ELIMINAR');
                            if (eliminarElecciones) {
                              eliminarElecciones.click();
                              await esperar(300);
                              const modalElecciones = [...document.querySelectorAll('.modal')].pop();
                              if (modalElecciones) {
                                const okElecciones = [...modalElecciones.querySelectorAll('.modal-acciones .btn')]
                                  .find((b) => b.textContent === 'Aceptar');
                                if (okElecciones) okElecciones.click();
                              }
                              await esperar(700);
                            }
                          }
                          const trasElecciones = await llamar(api.relacionListar(proyectoElecciones));
                          salida.eleccionesAuto.restos = trasElecciones
                            .filter((r) => String(r.bloque_id) === String(bloqueEleccionesId)).length;
                        }

                        /* NOMBRAMIENTOS Y DESIGNACIONES: relaciones automatizadas */
                        const btnAddNombramientos = [...document.querySelectorAll('.cuadernos-barra .btn')]
                          .find((b) => b.textContent.includes('Añadir bloque de registro'));
                        if (btnAddNombramientos) btnAddNombramientos.click();
                        await esperar(300);
                        const periodoNombramientos = [...document.querySelectorAll('.bloques-periodo')].find((b) => !b.disabled);
                        if (periodoNombramientos) { periodoNombramientos.click(); await esperar(400); }
                        const opcionNombramientos = [...document.querySelectorAll('.bloque-opcion')]
                          .find((b) => b.textContent === 'Nombramientos y designaciones');
                        if (opcionNombramientos) {
                          const tarjetasAntesNombramientos = document.querySelectorAll('.bloque-registrado').length;
                          opcionNombramientos.click();
                          for (let i = 0; i < 30 && document.querySelectorAll('.bloque-registrado').length <= tarjetasAntesNombramientos; i++) {
                            await esperar(200);
                          }
                          await esperar(800);
                          const tarjetaNombramientos = document.querySelectorAll('.bloque-registrado').length > tarjetasAntesNombramientos
                            ? [...document.querySelectorAll('.bloque-registrado')].pop()
                            : null;
                          for (let i = 0; i < 20 && !tarjetaNombramientos?.querySelector('.form-bloque'); i++) await esperar(200);
                          const formNombramientos = tarjetaNombramientos?.querySelector('.form-bloque');
                          const camposNombramientos = () => (formNombramientos ? [...formNombramientos.querySelectorAll('.campo')] : []);
                          const campoNombramientos = (etiqueta) => camposNombramientos()
                            .find((c) => c.querySelector('label')?.textContent === etiqueta);
                          const fijarSelectNombramientos = (etiqueta, indiceOpcion = 1) => {
                            const sel = campoNombramientos(etiqueta)?.querySelector('select');
                            if (!sel) return;
                            const opciones = [...sel.options].filter((o) => o.value);
                            if (opciones[indiceOpcion - 1]) sel.value = opciones[indiceOpcion - 1].value;
                            sel.dispatchEvent(new Event('change', { bubbles: true }));
                          };
                          const fijarEntradaNombramientos = (etiqueta, valor) => {
                            const input = campoNombramientos(etiqueta)?.querySelector('input');
                            if (!input) return;
                            input.value = valor;
                            input.dispatchEvent(new Event('input', { bubbles: true }));
                            input.dispatchEvent(new Event('change', { bubbles: true }));
                          };
                          fijarSelectNombramientos('LUGAR');
                          fijarSelectNombramientos('INSTITUCIÓN');
                          fijarEntradaNombramientos('AÑO', '1705');
                          fijarEntradaNombramientos('FECHA EXACTA', '12-07-1705');
                          const rolNombramientos = (titulo) => (formNombramientos
                            ? [...formNombramientos.querySelectorAll('.bloque-personas')]
                              .find((b) => b.querySelector('.rol-titulo')?.textContent === titulo)
                            : null);
                          const vincularNombramientos = (titulo, indicePersona, indiceInstitucion) => {
                            const rol = rolNombramientos(titulo);
                            if (!rol) return;
                            const campoRol = (etiqueta) => [...rol.querySelectorAll('.campo')]
                              .find((c) => c.querySelector('label')?.textContent === etiqueta);
                            const selPersona = campoRol('VINCULAR PERSONA')?.querySelector('select');
                            const selInstitucion = campoRol('VINCULAR INSTITUCIÓN')?.querySelector('select');
                            const opciones = (sel) => [...(sel?.options || [])].filter((o) => o.value);
                            const persona = opciones(selPersona)[indicePersona - 1];
                            const institucion = opciones(selInstitucion)[indiceInstitucion - 1];
                            if (persona) {
                              selPersona.value = persona.value;
                              selPersona.dispatchEvent(new Event('change', { bubbles: true }));
                            }
                            if (institucion) {
                              selInstitucion.value = institucion.value;
                              selInstitucion.dispatchEvent(new Event('change', { bubbles: true }));
                            }
                          };
                          vincularNombramientos('AUTORIDAD EMISORA', 1, 1);
                          vincularNombramientos('SECRETARIO', 2, 2);
                          vincularNombramientos('ESCRIBANO/NOTARIO', 3, 3);
                          vincularNombramientos('DESTINATARIO', 4, 4);
                          const bloqueNombramientosId = tarjetaNombramientos?.dataset.bloqueId || null;
                          if (tarjetaNombramientos) {
                            const guardarNombramientos = [...tarjetaNombramientos.querySelectorAll('.bloque-registrado-acciones .btn')]
                              .find((b) => b.textContent === 'GUARDAR');
                            if (guardarNombramientos) { guardarNombramientos.click(); await esperar(1000); }
                          }
                          const proyectoNombramientos = Number(new URLSearchParams(location.search).get('id'));
                          const todasRelNombramientos = await llamar(api.relacionListar(proyectoNombramientos));
                          const autosNombramientos = todasRelNombramientos.filter(
                            (r) => String(r.bloque_id) === String(bloqueNombramientosId)
                          );
                          salida.nombramientosAuto = {
                            bloqueId: bloqueNombramientosId,
                            total: autosNombramientos.length,
                            tipos: autosNombramientos.map((r) => r.tipo),
                            reglas: autosNombramientos.map((r) => r.regla).sort(),
                            destinos: autosNombramientos.map(
                              (r) => r.origen_tipo + ':' + r.origen_id + '->' + r.destino_tipo + ':' + r.destino_id
                            ),
                            procedencias: [...new Set(autosNombramientos.map((r) => r.procedencia))],
                            fuentes: autosNombramientos.map((r) => (r.fuentes || []).length),
                            fechas: autosNombramientos.map((r) => r.fecha_exacta_inicio),
                          };
                          if (tarjetaNombramientos) {
                            const eliminarNombramientos = [...tarjetaNombramientos.querySelectorAll('.bloque-registrado-acciones .btn')]
                              .find((b) => b.textContent === 'ELIMINAR');
                            if (eliminarNombramientos) {
                              eliminarNombramientos.click();
                              await esperar(300);
                              const modalNombramientos = [...document.querySelectorAll('.modal')].pop();
                              if (modalNombramientos) {
                                const okNombramientos = [...modalNombramientos.querySelectorAll('.modal-acciones .btn')]
                                  .find((b) => b.textContent === 'Aceptar');
                                if (okNombramientos) okNombramientos.click();
                              }
                              await esperar(700);
                            }
                          }
                          const trasNombramientos = await llamar(api.relacionListar(proyectoNombramientos));
                          salida.nombramientosAuto.restos = trasNombramientos
                            .filter((r) => String(r.bloque_id) === String(bloqueNombramientosId)).length;
                        }

                        /* TÍTULOS: relaciones automatizadas desde el bloque */
                        const btnAddTitulos = [...document.querySelectorAll('.cuadernos-barra .btn')]
                          .find((b) => b.textContent.includes('Añadir bloque de registro'));
                        if (btnAddTitulos) btnAddTitulos.click();
                        await esperar(300);
                        const periodoTitulos = [...document.querySelectorAll('.bloques-periodo')].find((b) => !b.disabled);
                        if (periodoTitulos) { periodoTitulos.click(); await esperar(400); }
                        const opcionTitulos = [...document.querySelectorAll('.bloque-opcion')]
                          .find((b) => b.textContent === 'Títulos');
                        if (opcionTitulos) {
                          const tarjetasAntesTitulos = document.querySelectorAll('.bloque-registrado').length;
                          opcionTitulos.click();
                          for (let i = 0; i < 30 && document.querySelectorAll('.bloque-registrado').length <= tarjetasAntesTitulos; i++) {
                            await esperar(200);
                          }
                          await esperar(800);
                          const tarjetaTitulos = document.querySelectorAll('.bloque-registrado').length > tarjetasAntesTitulos
                            ? [...document.querySelectorAll('.bloque-registrado')].pop()
                            : null;
                          for (let i = 0; i < 20 && !tarjetaTitulos?.querySelector('.form-bloque'); i++) await esperar(200);
                          const formTitulos = tarjetaTitulos?.querySelector('.form-bloque');
                          const camposTitulos = () => (formTitulos ? [...formTitulos.querySelectorAll('.campo')] : []);
                          const campoTitulos = (etiqueta) => camposTitulos()
                            .find((c) => c.querySelector('label')?.textContent === etiqueta);
                          const fijarSelectTitulos = (etiqueta, indiceOpcion = 1) => {
                            const sel = campoTitulos(etiqueta)?.querySelector('select');
                            if (!sel) return;
                            const opciones = [...sel.options].filter((o) => o.value);
                            if (opciones[indiceOpcion - 1]) sel.value = opciones[indiceOpcion - 1].value;
                            sel.dispatchEvent(new Event('change', { bubbles: true }));
                          };
                          const fijarEntradaTitulos = (etiqueta, valor) => {
                            const input = campoTitulos(etiqueta)?.querySelector('input');
                            if (!input) return;
                            input.value = valor;
                            input.dispatchEvent(new Event('input', { bubbles: true }));
                            input.dispatchEvent(new Event('change', { bubbles: true }));
                          };
                          fijarSelectTitulos('LUGAR');
                          fijarSelectTitulos('INSTITUCIÓN');
                          fijarEntradaTitulos('AÑO', '1706');
                          fijarEntradaTitulos('FECHA EXACTA', '13-08-1706');
                          const rolTitulos = (titulo) => (formTitulos
                            ? [...formTitulos.querySelectorAll('.bloque-personas')]
                              .find((b) => b.querySelector('.rol-titulo')?.textContent === titulo)
                            : null);
                          const vincularTitulos = (titulo, indicePersona, indiceInstitucion) => {
                            const rol = rolTitulos(titulo);
                            if (!rol) return;
                            const campoRol = (etiqueta) => [...rol.querySelectorAll('.campo')]
                              .find((c) => c.querySelector('label')?.textContent === etiqueta);
                            const selPersona = campoRol('VINCULAR PERSONA')?.querySelector('select');
                            const selInstitucion = campoRol('VINCULAR INSTITUCIÓN')?.querySelector('select');
                            const opciones = (sel) => [...(sel?.options || [])].filter((o) => o.value);
                            const persona = opciones(selPersona)[indicePersona - 1];
                            const institucion = opciones(selInstitucion)[indiceInstitucion - 1];
                            if (persona) {
                              selPersona.value = persona.value;
                              selPersona.dispatchEvent(new Event('change', { bubbles: true }));
                            }
                            if (institucion) {
                              selInstitucion.value = institucion.value;
                              selInstitucion.dispatchEvent(new Event('change', { bubbles: true }));
                            }
                          };
                          vincularTitulos('AUTORIDAD EMISORA', 1, 1);
                          vincularTitulos('SECRETARIO', 2, 2);
                          vincularTitulos('ESCRIBANO/NOTARIO', 3, 3);
                          vincularTitulos('DESTINATARIO', 4, 4);
                          const bloqueTitulosId = tarjetaTitulos?.dataset.bloqueId || null;
                          if (tarjetaTitulos) {
                            const guardarTitulos = [...tarjetaTitulos.querySelectorAll('.bloque-registrado-acciones .btn')]
                              .find((b) => b.textContent === 'GUARDAR');
                            if (guardarTitulos) { guardarTitulos.click(); await esperar(1000); }
                          }
                          const proyectoTitulos = Number(new URLSearchParams(location.search).get('id'));
                          const todasRelTitulos = await llamar(api.relacionListar(proyectoTitulos));
                          const autosTitulos = todasRelTitulos.filter(
                            (r) => String(r.bloque_id) === String(bloqueTitulosId)
                          );
                          salida.titulosAuto = {
                            bloqueId: bloqueTitulosId,
                            total: autosTitulos.length,
                            tipos: autosTitulos.map((r) => r.tipo),
                            reglas: autosTitulos.map((r) => r.regla).sort(),
                            destinos: autosTitulos.map(
                              (r) => r.origen_tipo + ':' + r.origen_id + '->' + r.destino_tipo + ':' + r.destino_id
                            ),
                            procedencias: [...new Set(autosTitulos.map((r) => r.procedencia))],
                            fuentes: autosTitulos.map((r) => (r.fuentes || []).length),
                            fechas: autosTitulos.map((r) => r.fecha_exacta_inicio),
                          };
                          if (tarjetaTitulos) {
                            const eliminarTitulos = [...tarjetaTitulos.querySelectorAll('.bloque-registrado-acciones .btn')]
                              .find((b) => b.textContent === 'ELIMINAR');
                            if (eliminarTitulos) {
                              eliminarTitulos.click();
                              await esperar(300);
                              const modalTitulos = [...document.querySelectorAll('.modal')].pop();
                              if (modalTitulos) {
                                const okTitulos = [...modalTitulos.querySelectorAll('.modal-acciones .btn')]
                                  .find((b) => b.textContent === 'Aceptar');
                                if (okTitulos) okTitulos.click();
                              }
                              await esperar(700);
                            }
                          }
                          const trasTitulos = await llamar(api.relacionListar(proyectoTitulos));
                          salida.titulosAuto.restos = trasTitulos
                            .filter((r) => String(r.bloque_id) === String(bloqueTitulosId)).length;
                        }
                      }
                    }
                  }
                }
              }
            }
            const botonGeo = document.querySelector('[data-seccion="geo"]');
            if (botonGeo) {
              botonGeo.click();
              await esperar(300);
              const modalDescarte = document.querySelector('.modal');
              if (modalDescarte) {
                const aceptar = [...modalDescarte.querySelectorAll('.modal-acciones .btn')]
                  .find((b) => b.textContent === 'Aceptar');
                if (aceptar) aceptar.click();
              }
              await esperar(2400);
              salida.geo = {
                barra: !!document.querySelector('.modulo-geo .ent-barra'),
                buscar: !!document.querySelector('.modulo-geo .ent-buscar'),
                mapa: !!document.querySelector('.leaflet-container'),
                botones: [...document.querySelectorAll('.geo-acciones .btn')].map((b) => ({
                  texto: b.textContent,
                  ancho: Math.round(b.getBoundingClientRect().width),
                  deshabilitado: b.disabled,
                })),
                estado: document.querySelector('.geo-estado')?.textContent || '',
                lista: document.querySelectorAll('.geo-item').length,
              };
            }
            const volverGrafo = document.querySelector('[data-seccion="grafo"]');
            if (volverGrafo) {
              volverGrafo.click();
              await esperar(1000);
            }
            return salida;
          })()`);
          console.log('[autoprueba:proyecto]', 'url=' + url, JSON.stringify(r));
          if (process.env.HIMAGO_CAPTURA_GRAFO) {
            const imagen = await ventana.webContents.capturePage();
            await fs.promises.writeFile(process.env.HIMAGO_CAPTURA_GRAFO, imagen.toPNG());
            console.log('[captura] grafo en', process.env.HIMAGO_CAPTURA_GRAFO);
          }
          setTimeout(() => app.quit(), 600);
        }
      } catch (err) {
        console.error('[autoprueba] error en etapa', etapa, ':', err.message, '| url:', url);
        setTimeout(() => app.quit(), 400);
      }
    });
}

module.exports = { configurarAutoprueba };
