path = "src/web/system-dashboard.html"
with open(path, "r", encoding="utf-8") as f:
    content = f.read()

# Buscamos la función window.addEventListener('load', ...) y le inyectamos las apps estáticas por defecto
target = "window.addEventListener('load', () => {"
replacement = """window.addEventListener('load', () => {
      const defaultApps = [
        { id: 'slq-terminal', name: 'SlQ Terminal', category: 'Sistema', iconUrl: '' },
        { id: 'slq-editor', name: 'Editor de Código', category: 'Desarrollo', iconUrl: '' },
        { id: 'slq-browser', name: 'Navegador Web', category: 'Internet', iconUrl: '' },
        { id: 'slq-files', name: 'Gestor de Archivos', category: 'Sistema', iconUrl: '' },
        { id: 'slq-monitor', name: 'Monitor de Sistema', category: 'Sistema', iconUrl: '' },
        { id: 'slq-ai', name: 'SlQ-AI Assistant', category: 'Inteligencia Artificial', iconUrl: '' }
      ];
      allApps = defaultApps;
      document.getElementById('app-count').textContent = allApps.length;
      
      const categories = [...new Set(allApps.map(a => a.category || 'Sistema'))].sort();
      const select = document.getElementById('category-filter');
      select.innerHTML = '<option value="all">🔍 Todas las categorías</option>';
      categories.forEach(cat => {
        const opt = document.createElement('option');
        opt.value = cat; opt.textContent = cat;
        select.appendChild(opt);
      });
      renderApps(allApps);
      select.addEventListener('change', (e) => {
        const val = e.target.value;
        renderApps(val === 'all' ? allApps : allApps.filter(a => (a.category || 'Sistema') === val));
      });"""

if target in content:
    # Reemplazamos la sección de carga de apps inicial
    parts = content.split(target, 1)
    # Buscamos el cierre de ese bloque de fetch de apps original para saltárnoslo si es necesario
    # O simplemente reemplazamos todo el event listener de load
    print("Plantilla encontrada, actualizando...")

