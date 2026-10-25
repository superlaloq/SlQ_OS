# Estructura del proyecto

Esta guía describe la organización actual de SlQ-OS y distingue el código de
los datos operativos. Las rutas de ejecución se mantienen estables: los
instaladores, el servidor web, la ISO y los comandos esperan algunas carpetas y
archivos en ubicaciones concretas.

## Mapa de carpetas

| Ruta | Responsabilidad |
| --- | --- |
| `src/` | Punto de entrada y módulos del shell, intérprete SlQ, sistema e IA. |
| `src/web/` | Servidor web, autenticación, gestores, panel y recursos del servidor. |
| `frontweb/` | Interfaz web estática: páginas, estilos, JavaScript y `assets/`. |
| `packages/slq-ia/` | Paquete local `@slq/ia` y sus adaptadores de modelos. |
| `test/` | Pruebas automatizadas del intérprete, IA, sistema y servidor web. |
| `scripts/` | Instalación, construcción de imágenes, lanzamiento y mantenimiento. |
| `distro/` | Configuración específica de las distribuciones y sus imágenes. |
| `docs/` | Documentación de desarrollo, arquitectura, operación y distribución. |
| `documentos/` | Copias publicadas desde el Frontweb para consulta y descarga. |
| `examples/legacy-tests/` | Scripts de prueba antiguos conservados como referencia. |
| `proyectos/` | Contenido de proyectos web administrado desde el Frontweb. |
| `imagenes/`, `videos/` | Archivos de usuario publicados por el servidor web. |
| `reports/legacy/` | Informes históricos conservados como referencia. |
| `build/` | Salida y cachés de construcción de distribuciones; se pueden regenerar. |
| `node_modules/` | Dependencias instaladas por npm; se pueden regenerar con `npm install`. |

## Archivos de la raíz

- `package.json` y `package-lock.json` definen los comandos, dependencias y
  punto de entrada del programa.
- `src/index.js` inicia el shell y el servidor web. Los lanzadores y
  constructores también hacen referencia a esta ruta.
- Los archivos `.slq` de la raíz son programas de trabajo: el shell los carga
  por nombre y el Frontweb los publica en la sección Scripts. No son archivos
  temporales ni ejemplos archivados.
- `index.html` es la salida del panel de sistema generado por el comando
  correspondiente; la plantilla mantenida está en `src/web/`.
- `credentials.json`, `usuarios.json`, los datos bajo `data/` y los archivos
  personales de `imagenes/`, `videos/` y `proyectos/` son datos locales. No
  deben incorporarse a documentación, ejemplos o paquetes públicos.

## Reglas para reorganizar

1. Mantener las rutas que consumen `package.json`, los instaladores, los
   constructores de ISO, systemd y el servidor web, salvo que se actualicen
   juntos y se pruebe cada superficie.
2. Mantener `docs/` como fuente de la documentación. Las copias de
   `documentos/` existen para publicarlas en el Frontweb; al editar una guía,
   actualizar ambas versiones.
3. No mover, borrar ni inspeccionar el contenido de credenciales y archivos
   personales como parte de una limpieza del código.
4. No tratar `build/` ni `node_modules/` como código fuente. Conservarlos
   durante una reorganización y regenerarlos solo cuando una tarea de
   construcción lo requiera.
5. Antes de mover módulos de `src/`, revisar sus `require`, los puntos de
   entrada, pruebas y scripts de instalación y construcción. Ejecutar
   `npm test` después de cualquier cambio de rutas.

## Siguiente etapa sugerida

Con el mapa validado, la siguiente mejora puede enfocarse en separar con más
claridad las responsabilidades internas de `src/` (shell, intérprete y
servicios), sin mezclar ese trabajo con los datos del usuario ni con cambios
funcionales del sistema operativo. Cada extracción debería ser pequeña,
conservar `src/index.js` como punto de entrada y pasar las pruebas antes de
continuar.
