path = "src/web/system-dashboard.html"
with open(path, "r", encoding="utf-8") as f:
    content = f.read()

# Reemplazamos la función launchApp para que ejecute peticiones reales al servidor si corresponde
old_script = """    function launchApp(appName, message) {
      console.log(`[SlQ-OS] Lanzando ${appName}`);
      alert(`⚡ [SlQ-OS] ${appName}\\n${message}`);
    }"""

new_script = """    function launchApp(appName, actionType) {
      console.log(`[SlQ-OS] Ejecutando orden para: ${appName}`);
      if (actionType === 'terminal') {
        window.open('http://localhost:3000/terminal', '_blank') || alert('⚡ Abriendo terminal del sistema SlQ-OS...');
      } else if (actionType === 'editor') {
        window.open('http://localhost:3000/editor', '_blank') || alert('⚡ Abriendo editor de código...');
      } else if (actionType === 'files') {
        window.open('http://localhost:3000/files', '_blank') || alert('⚡ Abriendo gestor de archivos...');
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
    }"""

content = content.replace(old_script, new_script)

# Actualizamos también los objetos de las apps con acciones reales
old_apps = """    const allApps = [
      { id: 'slq-terminal', name: 'SlQ Terminal', category: 'Sistema', icon: '💻', action: () => launchApp('Terminal', 'Iniciando consola SlQ...') },
      { id: 'slq-editor', name: 'Editor de Código', category: 'Desarrollo', icon: '📝', action: () => launchApp('Editor de Código', 'Abriendo entorno de desarrollo...') },
      { id: 'slq-browser', name: 'Navegador Web', category: 'Internet', icon: '🌐', action: () => launchApp('Navegador Web', 'Cargando navegador seguro...') },
      { id: 'slq-files', name: 'Gestor de Archivos', category: 'Sistema', icon: '📁', action: () => launchApp('Gestor de Archivos', 'Abriendo explorador de archivos...') },
      { id: 'slq-monitor', name: 'Monitor de Sistema', category: 'Sistema', icon: '📊', action: () => launchApp('Monitor de Sistema', 'Cargando métricas de rendimiento...') },
      { id: 'slq-ai', name: 'SlQ-AI Assistant', category: 'Inteligencia Artificial', icon: '⚡', action: () => launchApp('SlQ-AI', 'Conectando con el asistente inteligente...') }
    ];"""

new_apps = """    const allApps = [
      { id: 'slq-terminal', name: 'SlQ Terminal', category: 'Sistema', icon: '💻', action: () => launchApp('SlQ Terminal', 'terminal') },
      { id: 'slq-editor', name: 'Editor de Código', category: 'Desarrollo', icon: '📝', action: () => launchApp('Editor de Código', 'editor') },
      { id: 'slq-browser', name: 'Navegador Web', category: 'Internet', icon: '🌐', action: () => launchApp('Navegador Web', 'browser') },
      { id: 'slq-files', name: 'Gestor de Archivos', category: 'Sistema', icon: '📁', action: () => launchApp('Gestor de Archivos', 'files') },
      { id: 'slq-monitor', name: 'Monitor de Sistema', category: 'Sistema', icon: '📊', action: () => launchApp('Monitor de Sistema', 'monitor') },
      { id: 'slq-ai', name: 'SlQ-AI Assistant', category: 'Inteligencia Artificial', icon: '⚡', action: () => launchApp('SlQ-AI Assistant', 'ai') }
    ];"""

content = content.replace(old_apps, new_apps)

with open(path, "w", encoding="utf-8") as f:
    f.write(content)

print("✅ Acciones de aplicaciones actualizadas correctamente.")
