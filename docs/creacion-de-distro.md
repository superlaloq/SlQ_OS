# SlQ-OS 24.04 LTS: distro Ubuntu con XFCE

SlQ-OS se construye sobre Ubuntu 24.04 LTS (Noble), arquitectura amd64 y kernel
genérico de Ubuntu. La configuración prepara una ISO híbrida con Casper y GRUB
para arrancar en equipos BIOS y UEFI, iniciar una sesión live con XFCE y ofrecer
Ubiquity para instalar el sistema. Incluye NetworkManager, Firefox, Node.js, npm
y la aplicación SlQ-OS. No se incluye Ollama ni un modelo local; la IA remota es
opcional y se configura después de arrancar el sistema.

La ISO todavía debe construirse y probarse en una máquina virtual antes de
considerar verificados el arranque, el escritorio y el instalador.

## Construir la ISO

La construcción requiere Ubuntu o una distribución compatible con `live-build`,
`rsync`, `xorriso`, `debootstrap` y `sudo`, acceso a los repositorios de Ubuntu
y npm, y espacio libre suficiente para el sistema temporal y la ISO. El
constructor debe ejecutarse como root para preparar el sistema de archivos.

Instala las herramientas del anfitrión si aún no están disponibles:

```bash
sudo apt update
sudo apt install live-build rsync xorriso debootstrap
```

Desde la raíz del proyecto, ejecuta:

```bash
sudo ./scripts/build-distro-iso.sh
```

La salida queda en `build/slq-os-live/live-image-amd64.hybrid.iso`, junto con
`live-image-amd64.hybrid.iso.sha256`. El constructor sincroniza la configuración
Ubuntu de `distro/live-build/config`, copia una lista permitida de los archivos
de SlQ-OS a `/opt/slq-os` dentro de la imagen y limpia el chroot anterior antes
de reconstruirlo. También valida la distribución guardada en la caché de
bootstrap: si no corresponde a Ubuntu Noble amd64, elimina solo esa caché
generada y los paquetes descargados asociados, y verifica la nueva base Ubuntu
antes de instalar paquetes. No ejecutes dos construcciones simultáneamente ni
interrumpas `lb clean` o `lb build`.

El constructor no copia credenciales, tokens, usuarios locales, carpetas de
datos, registros, medios, proyectos del usuario, archivos `.slq` de la raíz ni
`node_modules`. Las dependencias npm de producción se instalan desde el archivo
de bloqueo durante la construcción. Las herramientas opcionales de auditoría y
red no se instalan ni se ejecutan automáticamente.

## Probar e instalar

1. Comprueba la suma SHA-256 de la ISO antes de probarla.
2. Arráncala primero en una máquina virtual Ubuntu de 64 bits; asigna al menos
   2 CPU, 4 GB de RAM y 30 GB de disco, y habilita red NAT.
3. Comprueba el inicio de XFCE, Wi-Fi o Ethernet, Firefox, el menú SlQ-OS y la
   conexión a Internet.
4. Para instalar, abre Ubiquity desde el menú de aplicaciones y sigue sus pasos.
   No la instales sobre un equipo real hasta validar sus gráficos, red, audio,
   suspensión y periféricos.
5. Después de instalar, configura el servidor web y sus credenciales según la
   [guía de operación](./guia-operacion-servicios-red-y-mantenimiento.md):

   ```bash
   cd /opt/slq-os
   sudo ./scripts/install-web-service.sh
   ```

La ISO no define contraseñas predeterminadas ni almacena credenciales. Configura
la IA online solo cuando la quieras usar, con `SLQ_AI_BASE_URL`,
`SLQ_AI_MODEL` y, si el servicio lo requiere, `SLQ_AI_API_KEY`. Las consultas
enviadas a ese proveedor salen del equipo; si no se configura, SlQ intenta usar
Ollama local, que no viene instalado en esta imagen.
