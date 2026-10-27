import re

path = "src/web/system-dashboard.html"
with open(path, "r", encoding="utf-8") as f:
    html = f.read()

# Actualizar la función launchApp para que apunte directamente a las rutas web integradas
new_func = """
    function launchApp(appName, actionType) {
        console.log(`[SlQ-OS] Ejecutando orden para: ${appName}`);
        if (actionType === 'terminal') {
            window.open('/terminal', '_blank') || alert('⚡ Abriendo terminal del sistema SlQ-OS...');
        } else if (actionType === 'editor') {
            window.open('/editor', '_blank') || alert('⚡ Abriendo editor de código...');
        } else if (actionType === 'files') {
            window.open('/files', '_blank') || alert('⚡ Abriendo gestor de archivos...');
        } else if (actionType === 'monitor') {
            window.open('/monitor', '_blank') || alert('⚡ Abriendo monitor de sistema...');
        } else {
            fetch('/api/execute', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ app: appName, action: actionType })
            }).then(res => res.json()).then(data => {
                alert(`⚡ [SlQ-OS] ${appName} ejecutado con éxito.\\n${data.output || 'Orden procesada.'}`);
            }).catch(() => {
                alert(`⚡ [SlQ-OS] Ejecutando orden local para "${appName}".`);
            });
        }
    }
"""

html = re.sub(r"function\s+launchApp\s*\([^}]+\}\s*\}", new_func, html, flags=re.DOTALL)

with open(path, "w", encoding="utf-8") as f:
    f.write(html)

print("✅ Plantilla del dashboard actualizada correctamente.")
