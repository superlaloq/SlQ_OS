path = "src/web/system-dashboard.html"

with open(path, "w", encoding="utf-8") as f:
    f.write("""<!doctype html>
<html lang="es" data-bs-theme="dark">

<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="description" content="SlQ-OS | Command & Control Dashboard">
  <meta name="theme-color" content="#0d0f18">
  <title>SlQ-OS // Command Center</title>
  <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet">
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&family=JetBrains+Mono:wght@400;700&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg-deep: #090d14;
      --panel-bg: #121622;
      --border-cyber: #2a3554;
      --neon-purple: #8b7cff;
      --neon-cyan: #58dfc0;
      --text-main: #e2e8f0;
      --text-muted: #8a99ad;
    }
    body {
      font-family: 'Inter', sans-serif;
      background-color: var(--bg-deep);
      color: var(--text-main);
      min-height: 100vh;
      padding-bottom: 50px;
    }
    code, pre, .terminal-font { font-family: 'JetBrains Mono', monospace; }
    .navbar-cyber {
      background: rgba(18, 22, 34, 0.9) !important;
      backdrop-filter: blur(12px);
      border-bottom: 1px solid var(--border-cyber);
    }
    .cyber-card {
      background-color: var(--panel-bg);
      border: 1px solid var(--border-cyber);
      border-radius: 12px;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
    }
    .nav-pills .nav-link {
      color: var(--text-muted);
      border: 1px solid var(--border-cyber);
      background: #171c2b;
      margin-right: 8px;
      margin-bottom: 8px;
      font-size: 0.85rem;
    }
    .nav-pills .nav-link.active, .nav-pills .nav-link:hover {
      background: rgba(88, 223, 192, 0.15);
      color: var(--neon-cyan);
      border-color: var(--neon-cyan);
    }
    .app-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
      gap: 14px;
      max-height: 520px;
      overflow-y: auto;
      padding-right: 6px;
    }
    .app-card {
      background: #171c2b;
      border: 1px solid #232d46;
      border-radius: 10px;
      padding: 14px 10px;
      text-align: center;
      cursor: pointer;
      transition: all 0.2s ease;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
    }
    .app-card:hover {
      background: #1e263d;
      border-color: var(--neon-cyan);
      transform: translateY(-3px);
    }
    .app-icon { font-size: 2rem; margin-bottom: 8px; }
    .app-name { font-size: 0.82rem; font-weight: 600; color: var(--text-main); margin: 0 0 4px; }
    .app-cat { font-size: 0.65rem; color: var(--neon-purple); text-transform: uppercase; letter-spacing: 0.08em; }
    .file-list-item {
      background: #171c2b; border: 1px solid var(--border-cyber); border-radius: 8px; padding: 10px 14px; margin-bottom: 8px;
    }
  </style>
</head>

<body>
  <nav class="navbar navbar-expand-lg navbar-cyber sticky-top px-4 mb-4">
    <div class="container-fluid">
      <a class="navbar-brand fw-bold font-monospace" style="color: var(--neon-cyan);" href="#">
        ⚡ SlQ-OS <span class="text-light fw-normal fs-6">// Command Center</span>
      </a>
      <span class="badge bg-success bg-opacity-10 text-success border border-success border-opacity-25 px-3 py-2 rounded-pill font-monospace">● ONLINE</span>
    </div>
  </nav>

  <main class="container py-2">
    <div class="cyber-card p-4 mb-4">
      <div class="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
        <h2 class="h5 fw-bold mb-0" style="color: var(--neon-cyan);">📂 Gestión de Recursos y Archivos</h2>
        <div class="d-flex gap-2">
          <button class="btn btn-sm btn-outline-info font-monospace" onclick="promptCreateFile()">➕ Nuevo Archivo</button>
          <button class="btn btn-sm btn-outline-secondary font-monospace" onclick="loadCatalog()">🔄 Actualizar</button>
        </div>
      </div>
      <ul class="nav nav-pills" id="resourceTabs" role="tablist">
        <li class="nav-item"><button class="nav-link active font-monospace" id="tab-apps" data-bs-toggle="pill" data-bs-target="#content-apps" type="button">🚀 Aplicaciones</button></li>
        <li class="nav-item"><button class="nav-link font-monospace" id="tab-docs" data-bs-toggle="pill" data-bs-target="#content-docs" type="button">📄 Documentos</button></li>
        <li class="nav-item"><button class="nav-link font-monospace" id="tab-imgs" data-bs-toggle="pill" data-bs-target="#content-imgs" type="button">🖼️ Imágenes</button></li>
        <li class="nav-item"><button class="nav-link font-monospace" id="tab-vids" data-bs-toggle="pill" data-bs-target="#content-vids" type="button">🎬 Vídeos</button></li>
        <li class="nav-item"><button class="nav-link font-monospace" id="tab-projs" data-bs-toggle="pill" data-bs-target="#content-projs" type="button">📦 Proyectos</button></li>
        <li class="nav-item"><button class="nav-link font-monospace" id="tab-scripts" data-bs-toggle="pill" data-bs-target="#content-scripts" type="button">💻 Scripts SlQ</button></li>
      </ul>
    </div>

    <div class="tab-content" id="resourceTabContent">
      <div class="tab-pane fade show active" id="content-apps" role="tabpanel">
        <div class="cyber-card p-4 mb-4">
          <div class="row align-items-center mb-3">
            <div class="col-md-6"><h2 class="h5 fw-bold mb-0">⚡ Aplicaciones (<span id="app-count">6</span>)</h2></div>
            <div class="col-md-6">
              <select id="category-filter" class="form-select form-select-sm bg-dark text-light border-secondary">
                <option value="all">🔍 Todas las categorías</option>
              </select>
            </div>
          </div>
          <div id="app-grid" class="app-grid"></div>
        </div>
      </div>

      <div class="tab-pane fade" id="content-docs" role="tabpanel"><div class="cyber-card p-4"><h2 class="h5 fw-bold mb-3">📄 Documentos</h2><div id="list-documentos"><p class="text-muted terminal-font">Cargando...</p></div></div></div>
      <div class="tab-pane fade" id="content-imgs" role="tabpanel"><div class="cyber-card p-4"><h2 class="h5 fw-bold mb-3">🖼️ Imágenes</h2><div id="list-imagenes"><p class="text-muted terminal-font">Cargando...</p></div></div></div>
      <div class="tab-pane fade" id="content-vids" role="tabpanel"><div class="cyber-card p-4"><h2 class="h5 fw-bold mb-3">🎬 Vídeos</h2><div id="list-videos"><p class="text-muted terminal-font">Cargando...</p></div></div></div>
      <div class="tab-pane fade" id="content-projs" role="tabpanel"><div class="cyber-card p-4"><h2 class="h5 fw-bold mb-3">📦 Proyectos</h2><div id="list-proyectos"><p class="text-muted terminal-font">Cargando...</p></div></div></div>
      <div class="tab-pane fade" id="content-scripts" role="tabpanel"><div class="cyber-card p-4"><h2 class="h5 fw-bold mb-3">💻 Scripts SlQ</h2><div id="script-list"><p class="text-muted terminal-font">Cargando...</p></div></div></div>
    </div>
  </main>

  <script>
    const allApps = [
      { id: 'slq-terminal', name: 'SlQ Terminal', category: 'Sistema', icon: '💻' },
      { id: 'slq-editor', name: 'Editor de Código', category: 'Desarrollo', icon: '📝' },
      { id: 'slq-browser', name: 'Navegador Web', category: 'Internet', icon: '🌐' },
      { id: 'slq-files', name: 'Gestor de Archivos', category: 'Sistema', icon: '📁' },
      { id: 'slq-monitor', name: 'Monitor de Sistema', category: 'Sistema', icon: '📊' },
      { id: 'slq-ai', name: 'SlQ-AI Assistant', category: 'Inteligencia Artificial', icon: '⚡' }
    ];

    window.addEventListener('load', () => {
      renderApps(allApps);
      loadCatalog();
      
      const select = document.getElementById('category-filter');
      const categories = [...new Set(allApps.map(a => a.category))].sort();
      categories.forEach(cat => {
        const opt = document.createElement('option');
        opt.value = cat; opt.textContent = cat;
        select.appendChild(opt);
      });
      select.addEventListener('change', (e) => {
        const val = e.target.value;
        renderApps(val === 'all' ? allApps : allApps.filter(a => a.category === val));
      });
    });

    function renderApps(apps) {
      const grid = document.getElementById('app-grid');
      if (!grid) return;
      grid.innerHTML = '';
      apps.forEach(app => {
        const card = document.createElement('div');
        card.className = 'app-card';
        card.innerHTML = `<div class="app-icon">${app.icon}</div><p class="app-name">${app.name}</p><span class="app-cat">${app.category}</span>`;
        card.addEventListener('click', () => alert(`⚡ [SlQ-OS] Lanzando "${app.name}"...`));
        grid.appendChild(card);
      });
    }

    function loadCatalog() {
      fetch('/api/files').then(res => res.json()).then(catalog => {
        renderFileList('list-documentos', catalog.documentos, 'documentos');
        renderFileList('list-imagenes', catalog.imagenes, 'imagenes');
        renderFileList('list-videos', catalog.videos, 'videos');
        renderFileList('list-proyectos', catalog.proyectos, 'proyectos');
        renderFileList('list-scripts', catalog.scripts, 'scripts');
      }).catch(() => {});
    }

    function renderFileList(containerId, files, category) {
      const container = document.getElementById(containerId);
      if (!container || !files) return;
      if (!files.length) { container.innerHTML = '<p class="text-muted terminal-font small">Vacío.</p>'; return; }
      container.innerHTML = '';
      files.forEach(file => {
        const name = file.name || file;
        const item = document.createElement('div');
        item.className = 'file-list-item d-flex justify-content-between align-items-center';
        item.innerHTML = `<span class="terminal-font small text-light">📁 ${name}</span><a href="/${category}/${name}" target="_blank" class="btn btn-sm btn-outline-info font-monospace py-0 px-2">Ver</a>`;
        container.appendChild(item);
      });
    }
  </script>
  <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js"></script>
</body>
</html>
""")
print("✅ Plantilla forzada correctamente.")
