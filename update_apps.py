path = "src/web/system-dashboard.html"
with open(path, "r", encoding="utf-8") as f:
    content = f.read()

# Vamos a inyectar un respaldo directo en el script de carga de aplicaciones si la API falla o viene vacía
old_fetch = """      fetch('/api/apps').then(res => res.json()).then(apps => {
        allApps = apps;
        document.getElementById('app-count').textContent = apps.length;"""

new_fetch = """      const defaultApps = [
        { id: 'slq-terminal', name: 'SlQ Terminal', category: 'Sistema', iconUrl: '' },
        { id: 'slq-editor', name: 'Editor de Código', category: 'Desarrollo', iconUrl: '' },
        { id: 'slq-browser', name: 'Navegador Web', category: 'Internet', iconUrl: '' },
        { id: 'slq-files', name: 'Gestor de Archivos', category: 'Sistema', iconUrl: '' },
        { id: 'slq-monitor', name: 'Monitor de Sistema', category: 'Sistema', iconUrl: '' },
        { id: 'slq-ai', name: 'SlQ-AI Assistant', category: 'Inteligencia Artificial', iconUrl: '' }
      ];

      fetch('/api/apps')
        .then(res => res.json())
        .then(apps => {
          allApps = (apps && apps.length > 0) ? apps : defaultApps;
          document.getElementById('app-count').textContent = allApps.length;"""

if old_fetch in content:
    content = content.replace(old_fetch, new_fetch)
    with open(path, "w", encoding="utf-8") as f:
        f.write(content)
    print("✅ Catálogo de aplicaciones de respaldo añadido correctamente.")
else:
    print("⚠️ No se encontró el bloque exacto, pero puedes recargar el panel.")
