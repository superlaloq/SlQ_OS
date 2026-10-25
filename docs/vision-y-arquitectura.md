# SlQ-OS: visión y arquitectura del sistema

## Identidad y filosofia

SlQ-OS es una distribucion de software libre en desarrollo, basada en Arch
Linux. Su proposito es ofrecer una base Linux pequena, eficiente y robusta que
el usuario pueda convertir en la herramienta que necesite: un entorno de
desarrollo, una estacion tecnica o una plataforma para programar y construir
soluciones destinadas a computadoras, Raspberry Pi y otros dispositivos.

La distribucion debe empezar con lo esencial y dejar que cada persona decida
que instalar. Ser minimalista no significa limitar al usuario: significa no
imponerle aplicaciones, servicios ni un flujo de trabajo que no necesita.
SlQ-OS aspira a facilitar la programacion, la administracion y la creacion de
software, sin afirmar compatibilidad con hardware que aun no se haya probado.

La marca **SlQ** fue desarrollada por **Eduardo Barría**. Su lenguaje visual
parte de la identidad ya aplicada en el Frontweb: azul casi negro, violeta
plasma y acentos menta. Las marcas e iconos SVG originales se documentan en
`frontweb/assets/README.md`.

## Propósito

SlQ-OS nace de una idea: crear un entorno ligero, inteligente y cercano a las personas, donde sea posible interactuar con la computadora mediante una terminal, una interfaz web y, progresivamente, instrucciones expresadas en lenguaje natural.

El sistema busca acercar las capacidades del computador a más personas. Un programador puede usar SlQ como un atajo para describir una tarea y relacionarla con operaciones que ya conoce. Una persona que no desea aprender comandos, o que encuentra barreras en las interfaces tradicionales, podría expresar su intención con sus propias palabras y recibir ayuda para llevarla a cabo. Para las personas ciegas y con baja visión, la visión incluye una experiencia accesible que pueda combinar voz, lectores de pantalla, teclado y asistencia de IA.

SlQ-OS se plantea además como un puente entre las personas, sus computadoras y el entorno conectado: redes, servicios y, en el futuro, objetos del Internet de las cosas (IoT).

## Qué es SlQ-OS hoy

SlQ-OS es actualmente un proyecto de software que se ejecuta sobre Linux; no reemplaza el kernel ni constituye todavía una distribución autónoma. Integra una terminal interactiva, un intérprete de instrucciones y scripts `.slq`, servicios auxiliares y un Frontweb servido con Node.js y Express.

La terminal puede iniciar el servidor web junto con la sesión interactiva. El Frontweb organiza archivos en secciones —imágenes, videos, documentos y proyectos— y permite administrarlos con autenticación. El servidor local escucha en `127.0.0.1`; esta configuración protege el acceso frente a otros equipos de la red, pero significa que el portal no está publicado para acceso remoto por defecto.

La IA actual puede configurarse para usar un servicio compatible con una API de chat o un servidor local Ollama. En la interacción de terminal, el programa intenta procesar primero comandos reconocidos por SlQ y, cuando corresponde, consulta el modelo para generar una respuesta estructurada. El sistema también interpreta scripts `.slq` con su intérprete. La ejecución de scripts y comandos puede modificar archivos o el sistema, así que se deben ejecutar únicamente instrucciones comprendidas y de confianza.

Estas capacidades son la base existente del proyecto, no una afirmación de que SlQ-OS ya pueda aprender por sí solo, controlar cualquier dispositivo IoT, entender cualquier idioma o desarrollar y desplegar autónomamente nuevas versiones.

La variante Arch y el paquete SlQ_IA estan en desarrollo. El perfil actual
prepara un medio live x86_64 con XFCE sin persistencia; incluye el instalador
interactivo `archinstall`, pero aún no configura automáticamente SlQ en la
instalación persistente. No demuestra soporte de Raspberry Pi. La imagen debe
validarse en máquinas virtuales y en cada clase de hardware objetivo antes de
publicarse como compatible.

## Componentes y limites

- **Arch Linux** aporta la base rolling release y su sistema de paquetes.
- **SlQ-OS** integra el shell, el interprete SlQ, utilidades de sistema y el
  Frontweb.
- **SlQ_IA (`@slq/ia`)** encapsula adaptadores para Ollama local y APIs remotas
  compatibles. No contiene modelos, no aprende automaticamente y no recibe
  autoridad para saltarse los permisos del usuario.
- **Perfiles de hardware** futuros deberan especificar arquitectura,
  firmware, kernel y pruebas para cada dispositivo; una ISO amd64 no equivale
  a soporte de ARM o Raspberry Pi.
- **Inicio de la ISO live**: el perfil experimental inicia sesion
  automaticamente como usuario sin privilegios para abrir SlQ. `sudo` sin
  contrasena solo se contempla para el medio de prueba y no debe trasladarse
  a una instalacion permanente.

## El lenguaje SlQ

SlQ pretende ser un lenguaje de interacción y automatización que reduzca la distancia entre la intención humana y las instrucciones que una máquina puede ejecutar.

Su propósito es permitir que una persona describa una tarea en un lenguaje familiar y que la IA ayude a relacionarla con una forma ejecutable: una instrucción reconocida por el intérprete, un script SlQ o, cuando sea necesario y esté autorizado, una operación formal del sistema. Para quien conoce distintas sintaxis, SlQ aspira a ser un atajo: expresar el objetivo sin escribir cada detalle mecánico. Para quien no programa, aspira a ofrecer una entrada más comprensible y guiada.

El lenguaje y la IA cumplen funciones distintas:

- **SlQ** proporciona instrucciones y scripts que pueden inspeccionarse, guardarse y volver a ejecutarse.
- **El intérprete** determina qué instrucciones reconoce y cómo se ejecutan.
- **La IA** puede ayudar a interpretar una petición, proponer una acción o producir una respuesta estructurada.
- **El sistema operativo anfitrión** aplica los permisos reales disponibles al proceso.

La IA no debe considerarse un intérprete infalible. Una propuesta generada necesita validarse antes de convertirse en una acción. La sintaxis ejecutable debe ser explícita y auditable, y las acciones sensibles deben pedir autorización comprensible a la persona.

## La web como espacio de interacción

El Frontweb busca ser una interfaz humana para explorar recursos y operar servicios de SlQ-OS desde un navegador. La web complementa la terminal: puede ofrecer navegación visual, controles directos y, con trabajo adicional, interfaces adaptables a distintos dispositivos y tecnologías de asistencia.

La intención no es que la web sustituya siempre a la consola ni que la IA oculte lo que ocurre. Las interfaces deben mostrar qué recurso se va a cambiar, qué acción se propone, cuál fue el resultado y cómo detener o revertir una operación cuando sea posible. Las tareas que afecten el sistema deben conservar controles acordes al riesgo.

La sección Proyectos ya incorpora un flujo de inspección y aprobación explícita `slqaccept`: calcula un hash del contenido visible del proyecto, muestra archivos y dependencias reconocidas, y solo sirve una vista web cuando existe una aprobación vigente. Cambiar el contenido invalida esa aprobación. Las dependencias se sugieren para revisión e instalación manual; el sistema no las descarga. Los scripts `.slq` de proyectos requieren aprobación y una confirmación de ejecución adicional. Esos scripts corren con los permisos del proceso SlQ y pueden modificar el sistema, por lo que la aprobación no debe confundirse con una caja de aislamiento.

En equipos de escritorio, el instalador puede abrir el proyecto en Visual Studio Code y una tarea del workspace inicia la terminal interactiva SlQ. Esta comodidad depende de que VS Code esté instalado y de que el usuario confíe el workspace; el Frontweb y el inicio por TTY siguen siendo alternativas.

## Experiencia de escritorio objetivo

La meta de la sesión diaria es que terminal, IA, servidor y navegador se
complementen sin que uno dependa del ciclo de vida de los otros:

1. Al iniciar la sesión de escritorio, se abre una terminal interactiva SlQ
   lista para recibir comandos o conversar con la IA configurada. La terminal
   permanece como aplicación de usuario, no como servicio de fondo.
2. El servidor web SlQ-OS se inicia como servicio de usuario/sistema y continúa
   disponible aunque se cierre la ventana de terminal. El Frontweb mantiene la
   gestión de archivos existente y ofrece una entrada al catálogo de
   aplicaciones.
3. Firefox se abre al iniciar la sesión con el Frontweb local de SlQ-OS. La
   dirección se configura explícitamente y no depende de cambiar el navegador
   predeterminado de todo el sistema.
4. El catálogo de aplicaciones detecta lanzadores instalados del escritorio
   Linux (entradas `.desktop` visibles para el usuario), presenta nombre,
   categoría e icono y permite abrir la aplicación correspondiente.

El catálogo no debe inventar iconos para programas que no los proporcionan ni
mostrar aplicaciones no instaladas. Debe respetar las restricciones de cada
lanzador y los permisos de la sesión. La página web no ejecutará texto
arbitrario como comandos de shell: para lanzar aplicaciones se requiere una
integración explícita con la sesión gráfica del usuario y una lista de
lanzadores validados. El servidor web permanece ligado a loopback; exponerlo a
la red requiere una decisión de seguridad separada.

La IA local es un proveedor opcional que debe indicar con claridad si el
servicio y el modelo están disponibles. Si no hay modelo local configurado, la
terminal conserva sus comandos y explica cómo configurar el proveedor; no debe
simular una respuesta de IA. Los proveedores remotos siguen siendo optativos y
deben informar cuándo se envía información fuera del equipo.

### Estado y fases

Esta experiencia completa es una meta de producto, no el estado actual. El
perfil Arch declara XFCE, Firefox, LightDM y `archinstall` para el medio live,
pero la ISO debe construirse y validarse en una máquina virtual antes de
considerar estable el arranque gráfico. El perfil configura el inicio
automático de la terminal SlQ, la configuración inicial de credenciales, el
servicio web independiente y la apertura de Firefox con el Frontweb cuando el
servicio está listo. El medio tampoco incluye Ollama ni un modelo. El Frontweb
detecta lanzadores de aplicaciones, aunque su integración debe validarse en
XFCE. El acceso a `archinstall` instala Arch de forma interactiva; aún no
instala ni configura SlQ en el sistema destino. El instalador Debian/Ubuntu
existente puede iniciar el servidor y abrir el navegador predeterminado y VS
Code, pero no garantiza que ese navegador sea Firefox. El gestor de archivos
del Frontweb sí está implementado.

La implementación debe avanzar en etapas verificables:

1. **Base de escritorio:** XFCE está elegido para el primer perfil Arch y ya
   está declarado junto con LightDM, Firefox y un emulador de terminal.
   Falta construir y validar la ISO; mantener el modo live de consola como
   ruta de respaldo.
2. **Sesión SlQ:** el perfil configura el inicio de una terminal interactiva
   por sesión XFCE y el servidor web independiente. El primer uso solicita
   credenciales y conserva el usuario, una sal aleatoria y el hash scrypt en
   `/run` (nunca la contraseña); falta construir y validar el flujo completo y
   manejar el cierre y reapertura de sesiones.
3. **Firefox y Frontweb:** el perfil instala Firefox y configura su apertura
   automática del portal local cuando las credenciales están listas y el
   servidor responde. Falta construir y validar el orden de arranque y los
   casos en que Firefox o el servidor no estén disponibles.
4. **Catálogo de aplicaciones:** el Frontweb enumera entradas de aplicación
   `.desktop`, presenta nombre, categoría e icono y solicita abrir la entrada
   seleccionada con `gio` desde el servicio del usuario. Falta validar el
   flujo en XFCE, además de comprobar prioridades y compatibilidad de los
   lanzadores de las aplicaciones incluidas.
5. **Instalación persistente e IA local:** el medio incluye un acceso al
   instalador interactivo `archinstall`, pero no un flujo SlQ de
   postinstalación. Falta copiar y configurar SlQ en el sistema destino y
   conservar los datos entre reinicios. Después se podrá instalar Ollama y
   descargar el modelo con conectividad y espacio suficientes; no conviene
   incluir un modelo de varios gigabytes en la ISO live ni redescargarlo en
   cada arranque. Toda selección de disco y operación de particionado debe ser
   visible y confirmada por la persona.
6. **Distribución e integración:** incluir los componentes elegidos en la
   imagen objetivo, mantener el perfil mínimo disponible, documentar
   instalación/recuperación y validar el flujo completo en máquina virtual y
   hardware compatible.

Cada etapa debe conservar una ruta de administración por terminal y permitir
desactivar los inicios automáticos. No se debe afirmar que la experiencia está
completa hasta verificar el arranque, el uso de IA local, las rutas de archivos
y el lanzamiento de aplicaciones en una instalación limpia.

## Relación con el entorno y con IoT

La visión contempla que SlQ pueda conectarse con dispositivos y servicios de su entorno para consultar estados y, cuando la persona lo autorice, ejecutar acciones. Esto podría incluir sensores, equipos domésticos, dispositivos de asistencia u otros objetos conectados.

La integración con IoT es una meta de evolución, no una capacidad general disponible hoy. Para desarrollarla responsablemente será necesario definir protocolos y adaptadores concretos, inventario de dispositivos, permisos por dispositivo y operación, manejo seguro de credenciales, límites de red y registros de actividad. Un dispositivo no debe recibir instrucciones solo porque la IA las haya sugerido: la persona y las políticas configuradas deben determinar qué está permitido.

## IA, aprendizaje y evolución del sistema

La aspiración es que la IA ayude a mejorar SlQ-OS con el tiempo: detectar problemas, explicar oportunidades de mejora, proponer cambios al código y facilitar el mantenimiento de servicios. En versiones futuras también podría ayudar a construir automatizaciones a partir de tareas repetidas.

La visión contempla mantener copias de versiones anteriores para poder recuperar un sistema funcional si una actualización falla. Sin embargo, la copia de respaldo y la auto-mejora autónoma no están implementadas como un ciclo automático en el sistema actual. Deben abordarse como capacidades futuras con controles explícitos.

Una evolución responsable debería incluir, como mínimo:

1. **Propuesta antes que cambio:** la IA presenta el cambio y su motivo; no modifica código silenciosamente.
2. **Revisión y autorización:** la persona puede inspeccionar, aprobar o rechazar los cambios, con confirmación reforzada para los que afecten seguridad, datos o servicios.
3. **Versionado y respaldo verificable:** guardar una versión previa identificable, comprobar que el respaldo se puede restaurar y conservar un historial de cambios.
4. **Pruebas antes de activar:** ejecutar validaciones en un entorno separado y no sustituir la versión estable si fallan.
5. **Despliegue reversible:** permitir volver a una versión conocida y mantener una vía de recuperación que no dependa de la IA.
6. **Transparencia:** registrar qué se cambió, cuándo, quién lo autorizó y cuál fue el resultado.

La IA puede asistir al mantenimiento, pero no debe ser el único mecanismo que mantenga los servicios disponibles ni la única autoridad sobre sus propias modificaciones.

## Principios de diseño

- **Ligereza:** priorizar un consumo moderado de memoria, CPU, almacenamiento y conectividad, y permitir el uso sin depender permanentemente de servicios remotos.
- **Control humano:** hacer visibles las acciones, solicitar consentimiento proporcional al riesgo y permitir cancelar cuando sea posible.
- **Accesibilidad:** diseñar para teclado, lectores de pantalla, ampliación, alto contraste y, a futuro, interacción por voz; estas cualidades deben probarse con usuarios y tecnologías reales.
- **Seguridad por defecto:** limitar permisos, proteger credenciales, evitar exponer servicios innecesariamente y separar las propuestas de IA de las operaciones autorizadas.
- **Privacidad:** explicar qué datos se envían a una IA remota; favorecer procesamiento local cuando sea viable y ofrecer opciones comprensibles.
- **Interoperabilidad:** integrar componentes y dispositivos mediante interfaces explícitas, documentadas y reemplazables.
- **Recuperación:** respaldar los datos importantes, probar restauraciones y conservar mecanismos de arranque y administración independientes de la IA.
- **Honestidad sobre las capacidades:** distinguir entre lo que está implementado, lo que está en desarrollo y lo que pertenece a la visión futura.

## Dirección del proyecto

La meta es construir, paso a paso, un sistema operativo ligero e inteligente que permita a las personas comunicarse con su computadora de una manera más natural, accesible y útil. SlQ quiere servir como lenguaje común entre intención, automatización y ejecución, mientras la web ofrece un espacio de interacción y la IA ayuda a traducir, explicar y mantener.

El valor de esa visión dependerá tanto de las capacidades nuevas como de la confianza: que las acciones sean comprensibles, que los datos estén protegidos, que las personas con distintas capacidades puedan participar y que siempre exista una forma segura de revisar o recuperar el sistema.
