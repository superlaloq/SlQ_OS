# SlQ-OS Live con Arch Linux

Este perfil de `archiso` genera una ISO live x86_64 con arranque UEFI, Linux, firmware,
NetworkManager, XFCE, Firefox, Archinstall, Node.js/npm y las dependencias de
SlQ-OS. Inicia sesion automaticamente en XFCE como el usuario sin privilegios
`slq`. La consola TTY2 conserva el inicio de la terminal SlQ.

El inicio automatico es deliberado para el medio live: cualquier persona con
acceso a la consola puede usar la sesion y ejecutar `sudo` sin contrasena. No
uses esta imagen como una instalacion permanente ni la dejes desatendida.
Los cambios de la sesion live no son persistentes despues de reiniciar. El
perfil incluye el instalador interactivo oficial `archinstall`, pero todavia
no ofrece un instalador SlQ que configure automaticamente el sistema
persistente.

La integracion de modelos esta separada en el paquete local
[`@slq/ia`](../../packages/slq-ia/README.md). El medio no incluye Ollama ni un
modelo; su proveedor online se configura explicitamente despues del arranque.
Firefox abre el Frontweb automaticamente despues de que se configuran las
credenciales y el servidor queda disponible. El Frontweb detecta aplicaciones
instaladas desde sus lanzadores `.desktop`, muestra sus iconos y permite
abrirlas en la sesion XFCE.

El primer arranque grafico usa LightDM con autologin porque esta ISO live ya
inicia sesion automaticamente en consola. Esta configuracion es solo para el
medio live de prueba; no debe trasladarse a una instalacion permanente.

La primera vez que se abre la terminal SlQ se solicitan credenciales HTTP para
el Frontweb. Se guardan el usuario, una sal aleatoria y el hash scrypt en
`/run/slq-os/web-auth.env`; la contraseña no se guarda y se vuelve a configurar
tras cada reinicio live. El servicio web requiere esa configuración y
permanece en `127.0.0.1:3000` independientemente de que se cierre la terminal.
Corre como servicio del usuario SlQ para poder abrir aplicaciones de la sesión
gráfica. El Frontweb enumera lanzadores `.desktop` visibles en XFCE y permite
abrirlos con `gio`; no ejecuta comandos enviados por la página.

El menú XFCE incluye **Instalar Arch Linux**, que abre `archinstall` en una
terminal. La instalación es interactiva y no contiene un disco preseleccionado
ni particionado automático de SlQ. Revisa cuidadosamente las opciones de disco
antes de confirmar. La documentación oficial recomienda ejecutar `archinstall`
desde la ISO oficial de Arch; el lanzador de SlQ es experimental y debe
probarse primero en una máquina virtual. Esta ruta instala Arch, no copia ni
configura automáticamente SlQ en el sistema destino.

## Construccion

La construccion debe ejecutarse en un anfitrion Arch Linux con `archiso`,
`rsync`, `npm` y `node` instalados. Desde la raiz del proyecto:

```bash
sudo pacman -S archiso rsync nodejs npm
sudo ./scripts/build-arch-iso.sh
```

El script prepara una copia aislada del perfil en `build/slq-os-arch/profile`,
copia `src/`, `packages/slq-ia/` y `frontweb/`, instala las dependencias de
produccion con `npm ci` y construye la ISO en
`build/slq-os-arch/out`. Solo incluye `src/`, `frontweb/`, el lanzador y los
manifiestos npm; excluye credenciales, cuentas locales, datos y el resto de
archivos del directorio del proyecto. La ISO y su SHA-256 quedan en `out/`.

Para arrancar la imagen en QEMU:

```bash
qemu-system-x86_64 -m 4096 -enable-kvm \
  -cdrom build/slq-os-arch/out/slq-os-AAAA.MM.DD-x86_64.iso
```

El nombre incluye la fecha de compilacion. En la sesion live se puede
conectar a una red Wi-Fi con `nmtui` o `nmcli`. La IA online requiere
configuracion propia y conectividad; no se incluyen tokens ni modelos locales.

El perfil actual admite UEFI x86_64, que es el modo configurado en la VM de
construccion. No ofrece arranque BIOS; ese modo requiere añadir y validar los
archivos de arranque Syslinux antes de habilitarlo. Prueba la ISO en UEFI en
una maquina virtual antes de considerarla validada. El perfil incluye hooks de
`mkinitcpio` de `archiso` para que el initramfs pueda montar el medio live.
