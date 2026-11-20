# Reglas de automatización de los bloques de registro

- **Relaciones automatizadas desde BLOQUES DE REGISTRO**: al guardar un bloque,
  sus reglas materializan los vínculos del formulario como relaciones con
  procedencia `AUTOMATIZADA`, conservando `bloque_id`, `regla` y una `firma`
  (huella de los campos comparados). La comparación se hace contra todas las
  relaciones del proyecto: mismo sentido ENTIDAD 1 → ENTIDAD 2, TIPO, AÑO
  INICIAL, FECHA EXACTA DESDE, LUGAR y FUENTE. Si coincide una relación manual
  o editada no se duplica; si difiere cualquiera de esos campos se crea una
  nueva. Sólo los vínculos a entidades existentes generan relaciones. Al
  re-guardar el bloque se actualizan sus automatizadas y se respetan las
  `EDITADA`; editar una automatizada la convierte en `EDITADA` y el bloque deja
  de actualizarla. Al eliminar una relación automatizada o editada se registra
  una exclusión en `relaciones_exclusiones` para que el bloque no la recree.
  Al importar un proyecto o fusionar fichas se remapean también las firmas de
  las exclusiones, de modo que una relación eliminada no reaparezca cuando
  cambian los identificadores de las entidades.
  Al eliminar el bloque desaparecen sus automatizadas y sus exclusiones, pero
  se conservan las editadas; al eliminar una entidad se eliminan todas sus
  relaciones. En **ACTAS, ACUERDOS Y RESOLUCIONES**, **COMUNICACIONES**,
  **LEYES, DECRETOS, ORDENANZAS, REGLAMENTOS**, **ELECCIONES**, **HOJAS DE
  SERVICIO**, **NOMBRAMIENTOS Y DESIGNACIONES**, **TÍTULOS** y **PROCESOS
  JUDICIALES**, la INSTITUCIÓN y el LUGAR de la sección REGISTRO forman
  LUGAR → `Sede` → INSTITUCIÓN; el LUGAR, AÑO y FECHA EXACTA de REGISTRO pasan
  a LUGAR [de DESDE], AÑO INICIAL y FECHA EXACTA DESDE de la relación, y la
  FUENTE del bloque a sus FUENTES. Las relaciones `Sede` automáticas que las
  versiones anteriores creaban en sentido inverso (INSTITUCIÓN → LUGAR) se
  corrigen automáticamente al migrar la base; las manuales y editadas se
  conservan y se marcan con ⚠ si no cumplen la taxonomía. En **ACTAS, ACUERDOS
  Y RESOLUCIONES** las reglas son: AUTORIDAD EMISORA → `Presidente/Director` (institución de
  REGISTRO) y → `Miembro` (institución propia); VOCALES/CONSEJEROS →
  `Vocal/Consejero` y → `Miembro`;
  ESCRIBANO/NOTARIO → `Escribano/Notario` y → `Miembro`; FIRMANTES →
  `Firmante` y → `Miembro`. En **LEYES, DECRETOS, ORDENANZAS, REGLAMENTOS**:
  AUTORIDAD EMISORA → `Presidente/Director` (institución de REGISTRO) y →
  `Miembro` (institución propia); VOCALES/CONSEJEROS → `Vocal/Consejero` y →
  `Miembro`; ESCRIBANO/NOTARIO → `Escribano/Notario` y → `Miembro`. En
  **ELECCIONES**: AUTORIDAD EMISORA → `Presidente/Director` y → `Miembro`;
  VOCALES/CONSEJEROS → `Vocal/Consejero` y → `Miembro`; ESCRIBANO/NOTARIO →
  `Escribano/Notario` y → `Miembro`; ELECTORES → `Elector` y → `Miembro`;
  ELEGIBLES → `Candidato` y → `Miembro`; ELECTOS → `Electo` y → `Miembro`.
  En **HOJAS DE SERVICIO**: AUTORIDAD EMISORA → `Asistente/Colaborador`
  (institución de REGISTRO) y → `Miembro` (institución propia); SOLDADO →
  `Miembro` por cada institución vinculada en CUERPOS Y CAMPAÑAS y →
  `Oriundo` hacia el LUGAR indicado en PATRIA. En **NOMBRAMIENTOS Y
  DESIGNACIONES**: AUTORIDAD EMISORA → `Presidente/Director` (REGISTRO) y →
  `Miembro` (propia); SECRETARIO → `Asistente/Colaborador` (REGISTRO) y →
  `Miembro` (propia); AUTORIDAD EMISORA → SECRETARIO → `Jefe – Secretario`;
  ESCRIBANO/NOTARIO → `Escribano/Notario` y → `Miembro`; DESTINATARIO →
  `Nombrado/Designado` y → `Miembro`. En **TÍTULOS**: AUTORIDAD EMISORA →
  `Presidente/Director` (REGISTRO) y → `Miembro` (propia); SECRETARIO →
  `Asistente/Colaborador` (REGISTRO) y → `Miembro` (propia); AUTORIDAD
  EMISORA → SECRETARIO → `Jefe – Secretario`; ESCRIBANO/NOTARIO →
  `Escribano/Notario` y → `Miembro`; DESTINATARIO → `Nombrado/Designado` y →
  `Miembro`. En **ARRIENDO**: ESCRIBANO/NOTARIO, TESTIGOS, ARRENDADOR,
  ARRENDATARIO y FIADOR/AVAL → `Miembro` con su institución; ARRENDADOR →
  ESCRIBANO/NOTARIO → `Otorgante – Escribano/Notario`; ARRENDADOR → TESTIGOS
  → `Otorgante – Testigo`; ARRENDADOR → ARRENDATARIO → `Arrendatario –
  Arrendador`; FIADOR/AVAL → ARRENDATARIO → `Fiador/Aval – Deudor`;
  ARRENDADOR → patrimonio de CONTRATO DE ARRIENDO → `Propietario`;
  ARRENDATARIO → patrimonio de HIPOTECA ARRENDATARIO → `Propietario`;
  FIADOR/AVAL → patrimonio de HIPOTECA FIADOR/AVAL → `Propietario`.
  En **COMPRA/VENTA**: ESCRIBANO/NOTARIO, TESTIGOS, VENDEDOR, COMPRADOR y
  FIADOR/AVAL → `Miembro` con su institución; VENDEDOR → ESCRIBANO/NOTARIO →
  `Otorgante – Escribano/Notario`; VENDEDOR → TESTIGOS → `Otorgante – Testigo`;
  COMPRADOR → VENDEDOR → `Comprador – Vendedor`; FIADOR/AVAL → COMPRADOR →
  `Fiador/Aval – Deudor`; VENDEDOR → patrimonio de CONTRATO DE COMPRA/VENTA →
  `Propietario` (con los campos de REGISTRO en el lado HASTA);
  COMPRADOR → patrimonio de CONTRATO DE COMPRA/VENTA → `Propietario` (con los
  campos de REGISTRO en el lado DESDE); COMPRADOR → patrimonio de HIPOTECA
  COMPRADOR → `Propietario`; FIADOR/AVAL → patrimonio de HIPOTECA FIADOR/AVAL
  → `Propietario`.
  En **DIEZMOS**: ESCRIBANO/NOTARIO, TESTIGOS, DIEZMERO, FIADOR/AVAL y
  BENEFICIARIO → `Miembro` con su institución; DIEZMERO → ESCRIBANO/NOTARIO →
  `Otorgante – Escribano/Notario`; DIEZMERO → TESTIGOS → `Otorgante – Testigo`;
  BENEFICIARIO → DIEZMERO → `Acreedor – Deudor`; FIADOR/AVAL → DIEZMERO →
  `Fiador/Aval – Deudor`; DIEZMERO → patrimonio de HIPOTECA DIEZMERO →
  `Propietario`; FIADOR/AVAL → patrimonio de HIPOTECA FIADOR/AVAL →
  `Propietario`.
  En **DONACIÓN**: ESCRIBANO/NOTARIO, TESTIGOS, DONADOR y DONATARIO →
  `Miembro` con su institución; DONADOR → ESCRIBANO/NOTARIO → `Otorgante –
  Escribano/Notario`; DONADOR → TESTIGOS → `Otorgante – Testigo`; DONADOR →
  DONATARIO → `Mecenas/Donante – Beneficiario`; DONADOR → patrimonio de CONTRATO DE
  DONACIÓN → `Propietario` (con los campos de REGISTRO en el lado HASTA);
  DONATARIO → patrimonio de CONTRATO DE DONACIÓN → `Propietario` (con los
  campos de REGISTRO en el lado DESDE).
  En **FIANZA**: ESCRIBANO/NOTARIO, TESTIGOS, FIADOR/AVAL y DEUDOR →
  `Miembro` con su institución; DEUDOR → ESCRIBANO/NOTARIO → `Otorgante –
  Escribano/Notario`; DEUDOR → TESTIGOS → `Otorgante – Testigo`; FIADOR/AVAL
  → DEUDOR → `Fiador/Aval – Deudor`; ACREEDOR → DEUDOR → `Acreedor – Deudor`;
  DEUDOR → patrimonio de HIPOTECA DEUDOR → `Propietario` (con los campos de
  REGISTRO en el lado HASTA); FIADOR/AVAL → patrimonio de HIPOTECA FIADOR/AVAL
  → `Propietario` (con los campos de REGISTRO en el lado HASTA).
  En **HIPOTECA** se aplican las mismas reglas que en FIANZA, con sus propios
  identificadores `hipoteca:*`. En **INVENTARIOS DE BIENES**:
  ESCRIBANO/NOTARIO, PROPIETARIO y ADMINISTRADOR → `Miembro` con su
  institución; PROPIETARIO → ESCRIBANO/NOTARIO → `Otorgante –
  Escribano/Notario`; PROPIETARIO → ADMINISTRADOR → `Patrón – Mayordomo`.
  En **OBLIGACIÓN**: ESCRIBANO/NOTARIO, TESTIGOS, FIADOR/AVAL, DEUDOR y
  ACREEDOR → `Miembro` con su institución; DEUDOR → ESCRIBANO/NOTARIO →
  `Otorgante – Escribano/Notario`; DEUDOR → TESTIGOS → `Otorgante – Testigo`;
  FIADOR/AVAL → DEUDOR → `Fiador/Aval – Deudor`; ACREEDOR → DEUDOR →
  `Acreedor – Deudor`; DEUDOR → patrimonio de HIPOTECA DEUDOR → `Propietario`
  (con los campos de REGISTRO en el lado HASTA); FIADOR/AVAL → patrimonio de
  HIPOTECA FIADOR/AVAL → `Propietario` (con los campos de REGISTRO en el lado
  HASTA). En **PODER**: ESCRIBANO/NOTARIO, TESTIGOS, OTORGANTE y APODERADO →
  `Miembro` con su institución; OTORGANTE → ESCRIBANO/NOTARIO → `Otorgante –
  Escribano/Notario`; OTORGANTE → TESTIGOS → `Otorgante – Testigo`; APODERADO
  → OTORGANTE → `Apoderado – Representado`.
  En **EPÍSTOLAS**: REMITENTE y DESTINATARIO → `Miembro` con su institución;
  REMITENTE → DESTINATARIO → `Correspondientes personales`.
  En **LEGADOS TESTAMENTARIOS**: los 14 roles (ESCRIBANO/NOTARIO, TESTIGOS,
  TESTADOR, PADRE, MADRE, CÓNYUGE, VIUDO DE, HIJOS LEGÍTIMOS, HIJOS NATURALES,
  DEUDORES, ACREEDORES, LEGATARIO TESTAMENTARIO, HEREDEROS y ALBACEAS) →
  `Miembro` con su institución; TESTADOR → ESCRIBANO/NOTARIO → `Otorgante –
  Escribano/Notario`; TESTADOR → TESTIGOS → `Otorgante – Testigo`; PADRE y
  MADRE → TESTADOR → `Padre/Madre legítimo – Hijo legítimo`; CÓNYUGE →
  TESTADOR → `Cónyuges`; TESTADOR → VIUDO DE → `Viudo – Finado`; TESTADOR →
  HIJOS LEGÍTIMOS → `Padre/Madre legítimo – Hijo legítimo`; TESTADOR → HIJOS
  NATURALES → `Padre/Madre natural – Hijo natural`; TESTADOR → DEUDORES y
  ACREEDORES → TESTADOR → `Acreedor – Deudor`; LEGATARIO TESTAMENTARIO →
  TESTADOR → `Apoderado – Representado`; TESTADOR → ALBACEAS → `Testador –
  Albacea`; TESTADOR → HEREDEROS → `Testador – Heredero`; TESTADOR →
  patrimonio de PATRIMONIOS → `Propietario` (con los campos de REGISTRO en el
  lado HASTA).
  En **TESTAMENTOS**: ESCRIBANO/NOTARIO, TESTIGOS, TESTADOR, PADRE, MADRE,
  CÓNYUGE, VIUDO DE, HIJOS LEGÍTIMOS, HIJOS NATURALES, DEUDORES, ACREEDORES,
  ALBACEAS y HEREDEROS → `Miembro` con su institución; TESTADOR →
  ESCRIBANO/NOTARIO → `Otorgante – Escribano/Notario`; TESTADOR → TESTIGOS →
  `Otorgante – Testigo`; PADRE y MADRE → TESTADOR → `Padre/Madre legítimo –
  Hijo legítimo`; CÓNYUGE → TESTADOR → `Cónyuges`; TESTADOR → VIUDO DE →
  `Viudo – Finado`; TESTADOR → HIJOS LEGÍTIMOS → `Padre/Madre legítimo – Hijo
  legítimo`; TESTADOR → HIJOS NATURALES → `Padre/Madre natural – Hijo
  natural`; TESTADOR → DEUDORES y ACREEDORES → TESTADOR → `Acreedor – Deudor`;
  TESTADOR → ALBACEAS → `Testador – Albacea`; TESTADOR → HEREDEROS →
  `Testador – Heredero`; TESTADOR → patrimonio de PATRIMONIOS → `Propietario`
  (con los campos de REGISTRO en el lado HASTA). En **PROCESOS JUDICIALES**:
  JUECES, DEMANDANTES, DEMANDADOS y TERCEROS → `Miembro` con su institución;
  PRODUCTOR y DESTINATARIO de ESCRITOS DE LAS PARTES, RESOLUCIONES
  JUDICIALES y ACTAS Y REGISTROS JUDICIALES → `Miembro` con su institución;
  DEMANDANTES → DEMANDADOS → `Litigantes` y `Demandante – Acusado`. LUGAR,
  DESDE y FECHA EXACTA (desde) de REGISTRO alimentan LUGAR, AÑO INICIAL y
  FECHA EXACTA DESDE. En **CUENTA PERSONAL**: ESCRIBANO/NOTARIO, ACREEDOR y
  DEUDOR → `Miembro` con su institución; ACREEDOR → ESCRIBANO/NOTARIO →
  `Otorgante – Escribano/Notario`; ACREEDOR → DEUDOR → `Acreedor – Deudor`.
  En **ACTAS DE BAUTISMO**: OFICIANTE, BAUTIZADO, PADRE, MADRE, PADRINOS y
  TESTIGOS → `Miembro` con su institución; BAUTIZADO → OFICIANTE → `Otorgante
  – Oficiante`; BAUTIZADO → TESTIGOS → `Otorgante – Testigo`; PADRE y MADRE →
  PADRINOS → `Compadres`; PADRINOS → BAUTIZADO → `Padrino/Madrina – Ahijado`.
  Según CONDICIÓN BAUTIZADO: `Legítimo` añade PADRE/MADRE → BAUTIZADO →
  `Padre/Madre legítimo – Hijo legítimo` y PADRE → MADRE → `Cónyuges`;
  `Natural`, `Padres no conocidos`, `Madre no conocida` o `Padre no conocido`
  añaden las relaciones `Padre/Madre natural – Hijo natural`; `No informada` no
  añade parentesco.
  En **ACTAS DE DEFUNCIÓN**: OFICIANTE, FINADO, CÓNYUGE, PADRE y MADRE →
  `Miembro` con su institución; FINADO → OFICIANTE → `Otorgante – Oficiante`;
  FINADO → CÓNYUGE → `Cónyuges`. En **ACTAS DE MATRIMONIO**: los once roles
  (OFICIANTE, NOVIO, VIUDO DE, PADRE y MADRE NOVIO, NOVIA, VIUDA DE, PADRE y
  MADRE NOVIA, PADRINOS y TESTIGOS) → `Miembro`; NOVIO y NOVIA → OFICIANTE →
  `Otorgante – Oficiante`; NOVIO y NOVIA → TESTIGOS → `Otorgante – Testigo`;
  PADRINOS → NOVIO y NOVIA → `Padrino/Madrina de bodas – Ahijado de bodas`;
  NOVIO → NOVIA → `Cónyuges`; NOVIO → VIUDO DE y NOVIA → VIUDA DE → `Viudo –
  Finado`; PADRE/MADRE NOVIA → NOVIO y PADRE/MADRE NOVIO → NOVIA → `Suegro –
  Yerno/Nuera`; PADRE NOVIO → PADRE NOVIA, PADRE NOVIO → MADRE NOVIA, PADRE
  NOVIA → MADRE NOVIO y MADRE NOVIO → MADRE NOVIA → `Consuegros`. Según
  CONDICIÓN: `Legítimo` genera `Padre/Madre legítimo –
  Hijo legítimo` y `Cónyuges` entre los padres; `Natural`, `Padres no
  conocidos`, `Madre no conocida` o `Padre no conocido` generan `Padre/Madre
  natural – Hijo natural`; `No informada` no genera parentesco. NOVIO → PATRIA
  NOVIO y NOVIA → PATRIA NOVIA → `Oriundo`.
  En **COMUNICACIONES**:
  REMITENTE y DESTINATARIO → `Miembro` con su institución;
  ESCRIBANO/NOTARIO → `Miembro` con la suya y → `Escribano/Notario` con la
  institución de REGISTRO; además, cada pareja de REMITENTE → DESTINATARIO
  genera `Correspondientes legales`. LUGAR, AÑO y FECHA EXACTA
  de REGISTRO alimentan LUGAR, AÑO INICIAL y FECHA EXACTA DESDE de la relación,
  y FUENTES del bloque pasa a FUENTES de la relación.
