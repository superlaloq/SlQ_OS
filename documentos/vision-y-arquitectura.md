# SlQ-OS: visión y arquitectura del sistema

## Propósito

SlQ-OS nace de una idea: crear un entorno ligero, inteligente y cercano a las personas, donde sea posible interactuar con la computadora mediante una terminal, una interfaz web y, progresivamente, instrucciones expresadas en lenguaje natural.

El sistema busca acercar las capacidades del computador a más personas. Un programador puede usar SlQ como un atajo para describir una tarea y relacionarla con operaciones que ya conoce. Una persona que no desea aprender comandos, o que encuentra barreras en las interfaces tradicionales, podría expresar su intención con sus propias palabras y recibir ayuda para llevarla a cabo. Para las personas ciegas y con baja visión, la visión incluye una experiencia accesible que pueda combinar voz, lectores de pantalla, teclado y asistencia de IA.

SlQ-OS se plantea además como un puente entre las personas, sus computadoras y el entorno conectado: redes, servicios y, en el futuro, objetos del Internet de las cosas (IoT).

## Qué es SlQ-OS hoy

SlQ-OS es actualmente un proyecto de software que se ejecuta sobre Linux; no reemplaza el kernel ni constituye todavía una distribución autónoma. Integra una terminal interactiva, un intérprete de instrucciones y scripts `.slq`, servicios auxiliares y un Frontweb servido con Node.js y Express.

La terminal puede iniciar el servidor web junto con la sesión interactiva. El Frontweb organiza archivos en secciones —imágenes, videos, documentos y proyectos— y permite administrarlos con autenticación. El servidor local escucha en `127.0.0.1`; esta configuración protege el acceso frente a otros equipos de la red, pero significa que el portal no está publicado para acceso remoto por defecto.

La IA actual puede configurarse para usar un servicio compatible con una API de chat o un servidor local Ollama. En la interacción de terminal, el programa intenta procesar primero comandos reconocidos por SlQ y, cuando corresponde, consulta el modelo para generar una respuesta estructurada. El sistema también interpreta scripts `.slq` con su intérprete. La ejecución de scripts y comandos puede modificar archivos o el sistema, así que se deben ejecutar únicamente instrucciones comprendidas y de confianza.

Estas capacidades son la base existente del proyecto, no una afirmación de que SlQ-OS ya pueda aprender por sí solo, controlar cualquier dispositivo IoT, entender cualquier idioma o desarrollar y desplegar autónomamente nuevas versiones.

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
