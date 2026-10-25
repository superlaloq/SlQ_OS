# SlQ_IA (`@slq/ia`)

Paquete de integracion de modelos para SlQ-OS. Mantiene separados los
adaptadores de Ollama local y de servicios remotos compatibles con la API de
chat de OpenAI; no incluye ni descarga modelos.

## Configuracion

- `SLQ_AI_BASE_URL`: URL base del proveedor remoto.
- `SLQ_AI_MODEL`: identificador del modelo remoto.
- `SLQ_AI_API_KEY`: clave opcional, provista por el usuario.
- `SLQ_AI_LOCAL_MODEL`: modelo local de Ollama; por defecto `qwen2.5:1.5b`.
- `SLQ_OLLAMA_HOST` y `SLQ_OLLAMA_PORT`: destino de Ollama; por defecto
  `127.0.0.1:11434`.

Las conexiones remotas exigen HTTPS. HTTP se permite unicamente en loopback
para pruebas o servicios locales. Sin proveedor remoto configurado, el shell
puede recurrir a Ollama en `127.0.0.1:11434`. El modelo local debe estar
descargado en Ollama; SlQ no lo descarga automáticamente. Los errores del
servidor o del modelo se muestran en la consola en lugar de confundirse con una
respuesta de IA.

La IA propone respuestas y acciones; no concede permisos ni ejecuta cambios por
si sola. La autorizacion y ejecucion pertenecen a SlQ-OS y al usuario.

Para inventariar una red privada, el intérprete entiende `escanear red` o
`escanear red 192.168.1.0/24`. El comando usa `nmap` para descubrir equipos y
probar la identificación de sus sistemas operativos; la detección puede
requerir privilegios de administrador y no siempre es concluyente. El escaneo
se limita a redes IPv4 privadas de hasta 256 direcciones. El paquete Arch de
SlQ-OS incluye `nmap`; en otros sistemas instálalo con el gestor de paquetes
correspondiente.

La identidad visual del paquete usa un simbolo abstracto de nodos:
[marca SlQ_IA](../../frontweb/assets/slq-ai-mark.svg).

## API

```js
const { askOllama, askOnlineAI, isOnlineAIConfigured } = require('@slq/ia');
```

El paquete se instala como dependencia local desde `packages/slq-ia` dentro del
workspace SlQ-OS. La ISO Arch debe incluir este directorio antes de ejecutar
`npm ci`.
