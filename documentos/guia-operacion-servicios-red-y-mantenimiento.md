# Guía de operación de SlQ-OS

Esta guía reúne comandos para iniciar SlQ-OS, revisar servicios y conexiones,
diagnosticar la red y mantener el equipo en buen estado. Los ejemplos están
pensados para Debian y Ubuntu con systemd. Algunos requieren `sudo`; úsalo solo
cuando el comando modifique servicios, paquetes o archivos del sistema.

## 1. Iniciar SlQ-OS y el Frontweb

Desde la carpeta del proyecto:

```bash
cd ~/SlQ_lenguaje
npm start
```

`npm start` ejecuta `node src/index.js`: inicia el servidor web y abre la
terminal interactiva SlQ en esa sesión. El Frontweb está en
<http://localhost:3000>. Para iniciar únicamente el servidor:

```bash
npm run start:web
```

Si el servicio de systemd ya ocupa el puerto, no inicies una segunda instancia
web. Inicia la terminal SlQ sin intentar iniciar otro servidor:

```bash
cd ~/SlQ_lenguaje
node src/index.js --no-web-server
```

El servicio persistente se instala y habilita para el arranque del sistema con:

```bash
cd ~/SlQ_lenguaje
npm install
sudo ./scripts/install-web-service.sh
```

La instalación solicita las credenciales iniciales del Frontweb. Para
actualizar la instalación existente, vuelve a ejecutar el instalador. Para
cambiar la contraseña de acceso:

```bash
sudo ./scripts/install-web-service.sh --reset-password
```

El instalador configura `slq-os-web.service` y el inicio automático. El servidor
escucha en `127.0.0.1:3000`, es decir, solo acepta conexiones desde el mismo
equipo por defecto.

## 2. Consultar y enumerar servicios

Ver el estado del servicio web SlQ-OS:

```bash
systemctl status slq-os-web.service --no-pager
systemctl is-active slq-os-web.service
systemctl is-enabled slq-os-web.service
```

Listar unidades de servicio cargadas, activas e inactivas:

```bash
systemctl list-units --type=service --all --no-pager
```

Mostrar solo los servicios activos:

```bash
systemctl list-units --type=service --state=active --no-pager
```

Mostrar servicios cargados que están fallidos:

```bash
systemctl --failed --type=service --no-pager
```

Enumerar los archivos de unidad y su configuración de inicio (habilitados,
deshabilitados, estáticos o enmascarados):

```bash
systemctl list-unit-files --type=service --no-pager
```

Filtrar unidades habilitadas o deshabilitadas:

```bash
systemctl list-unit-files --type=service --state=enabled --no-pager
systemctl list-unit-files --type=service --state=disabled --no-pager
```

`list-units` describe el estado actual de las unidades cargadas; `list-unit-files`
describe la configuración de inicio de los archivos de unidad instalados. Un
servicio deshabilitado puede iniciarse manualmente, y un servicio habilitado
puede estar detenido hasta el siguiente arranque.

## 3. Iniciar, detener y revisar el servidor

Usa estos comandos para el servicio web de SlQ-OS:

```bash
sudo systemctl start slq-os-web.service
sudo systemctl stop slq-os-web.service
sudo systemctl restart slq-os-web.service
sudo systemctl enable slq-os-web.service
sudo systemctl disable slq-os-web.service
```

`enable` configura el inicio automático, pero no necesariamente inicia un
servicio en ese momento; `enable --now` hace ambas cosas. El instalador de SlQ-OS
ya habilita e inicia el servicio.

Ver registros recientes y seguirlos en vivo:

```bash
sudo journalctl -u slq-os-web.service -n 100 --no-pager
sudo journalctl -u slq-os-web.service -f
```

Comprobar que el puerto web responde localmente:

```bash
curl -I http://localhost:3000/
sudo ss -ltnp 'sport = :3000'
```

El Frontweb usa autenticación HTTP Basic; `curl` puede responder `401
Unauthorized` sin credenciales. Eso demuestra que el servidor respondió, no que
el acceso autenticado esté configurado incorrectamente. No escribas contraseñas
en comandos o historiales compartidos.

Si no inicia, revisa el estado, los registros y el puerto antes de reinstalar:

```bash
systemctl status slq-os-web.service --no-pager
sudo journalctl -u slq-os-web.service -n 100 --no-pager
sudo ss -ltnp 'sport = :3000'
node --version
cd ~/SlQ_lenguaje && npm test
```

No finalices procesos desconocidos solo porque escuchan en el puerto 3000.
Identifica primero el PID y el nombre del programa con `ss`.

## 4. Revisar el estado de la red

Mostrar interfaces, direcciones IP y rutas:

```bash
ip -brief address
ip route
ip -6 route
```

Ver conexiones administradas por NetworkManager:

```bash
nmcli general status
nmcli device status
nmcli connection show --active
```

En equipos sin NetworkManager, consulta el estado de los servicios de red
disponibles:

```bash
systemctl --type=service --state=running --no-pager | grep -Ei 'network|NetworkManager|systemd-resolved'
```

Consultar DNS y probar conectividad:

```bash
resolvectl status
ping -c 4 1.1.1.1
ping -c 4 example.com
```

Si la prueba a `1.1.1.1` funciona pero `example.com` no, revisa DNS. Si ninguna
funciona, revisa la interfaz, la ruta predeterminada, el punto de acceso y el
cable o enlace Wi-Fi. Algunos equipos o redes bloquean ICMP; en ese caso, prueba
un servicio HTTPS:

```bash
curl -I --max-time 10 https://example.com/
```

## 5. Ver conexiones, puertos y servicios conectados

Listar puertos TCP y UDP en escucha:

```bash
sudo ss -lntup
```

Mostrar conexiones TCP establecidas:

```bash
ss -tn state established
```

Mostrar conexiones de escucha junto con los procesos asociados:

```bash
sudo ss -lntp
```

El parámetro `-p` puede mostrar nombres de procesos y requiere permisos para
ver todos los usuarios. `LISTEN` significa que una aplicación espera conexiones;
no demuestra por sí solo que el servicio esté accesible desde Internet. El
firewall, el router y la dirección de escucha también determinan la exposición.

Para revisar los dispositivos vecinos detectados en la red local:

```bash
ip neigh
```

Para escanear con Nmap, limita la revisión a equipos y redes propios o con
autorización explícita. Primero identifica tu subred con `ip -brief address` y
`ip route`; luego sustituye el ejemplo por el rango correcto:

```bash
nmap -sn 192.168.1.0/24
```

No ejecutes escaneos de redes ajenas ni de rangos desconocidos.

## 6. VPN e IKE/IPsec

SlQ-OS instala strongSwan para implementar IKE/IPsec, pero instalarlo no crea una
VPN ni establece una conexión. Revisa el estado del servicio si está disponible:

```bash
systemctl status strongswan-starter.service --no-pager
systemctl status strongswan.service --no-pager
```

El nombre de unidad puede variar según la versión de Debian/Ubuntu. Para
identificar las unidades presentes:

```bash
systemctl list-unit-files --type=service | grep -i strongswan
```

No inicies ni habilites una conexión IKE hasta disponer de los parámetros
legítimos del proveedor o administrador de red. No publiques claves, secretos
precompartidos, certificados privados ni archivos de configuración sensibles.

## 7. Mantenimiento y optimización segura

Revisa primero uso de CPU, memoria, espacio y carga:

```bash
uptime
free -h
df -h
du -sh ~/SlQ_lenguaje
top
```

Consulta procesos de Node.js y los registros de SlQ-OS:

```bash
pgrep -a -f 'node.*src/index.js'
sudo journalctl -u slq-os-web.service --since '24 hours ago' --no-pager
```

Mantén el sistema actualizado con los repositorios configurados por la
distribución:

```bash
sudo apt update
apt list --upgradable
sudo apt upgrade
```

Lee la lista de paquetes antes de confirmar. Reinicia el equipo solo cuando sea
necesario, por ejemplo, si una actualización del kernel lo solicita:

```bash
sudo reboot
```

Para verificar el proyecto tras actualizar dependencias o código:

```bash
cd ~/SlQ_lenguaje
npm test
sudo systemctl restart slq-os-web.service
systemctl is-active slq-os-web.service
```

Buenas prácticas:

- Mantén libres espacio en disco y memoria; investiga antes de borrar archivos.
- No elimines dependencias, servicios o procesos que no reconozcas.
- Instala paquetes desde fuentes confiables y revisa qué servicios habilitan.
- Conserva las credenciales fuera del código y no compartas archivos de secretos.
- Ejecuta `aircrack-ng`, Wireshark y Nmap solo en redes propias o autorizadas.
- Analiza con cuidado los proyectos importados; aprobar o ejecutar un `.slq`
  puede habilitar contenido o realizar acciones en el sistema.
- Evita ejecutar scripts con `sudo` si no has leído su contenido y entendido sus
  efectos.

## 8. Referencia rápida

| Necesidad | Comando |
| --- | --- |
| Iniciar SlQ-OS con terminal | `cd ~/SlQ_lenguaje && npm start` |
| Iniciar solo la web | `cd ~/SlQ_lenguaje && npm run start:web` |
| Estado del servicio SlQ-OS | `systemctl status slq-os-web.service --no-pager` |
| Servicios activos | `systemctl list-units --type=service --state=active --no-pager` |
| Servicios fallidos | `systemctl --failed --type=service --no-pager` |
| Registros del servidor | `sudo journalctl -u slq-os-web.service -n 100 --no-pager` |
| Interfaces y direcciones IP | `ip -brief address` |
| Conexiones activas | `ss -tn state established` |
| Puertos en escucha | `sudo ss -lntup` |
| Espacio y memoria | `df -h && free -h` |
| Pruebas del proyecto | `cd ~/SlQ_lenguaje && npm test` |
