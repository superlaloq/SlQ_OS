html_content = """<!doctype html>
<html lang="es" data-bs-theme="dark">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>SlQ-OS // Command Center</title>
  <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet">
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&family=JetBrains+Mono:wght@400;700&display=swap" rel="stylesheet">
  <style>
    :root { --bg-deep: #090d14; --panel-bg: #121622; --border-cyber: #2a3554; --neon-cyan: #58dfc0; }
    body { background-color: var(--bg-deep); color: #e2e8f0; font-family: 'Inter', sans-serif; min-height: 100vh; padding-bottom: 50px; }
    .cyber-card { background-color: var(--panel-bg); border: 1px solid var(--border-cyber); border-radius: 12px; padding: 20px; margin-bottom: 20px; }
    .app-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 14px; }
    .app-card { background: #171c2b; border: 1px solid #232d46; border-radius: 10px; padding: 14px; text-align: center; cursor: pointer; }
    .app-card:hover { border-color: var(--neon-cyan); }
  </style>
</head>
<body>
  <div class="container py-4">
    <div class="cyber-card d-flex justify-content-between align-items-center">
      <h2 class="h5 fw-bold text-info mb-0">⚡ SlQ-OS // Command Center</h2>
      <span class="badge bg-success">● ONLINE</span>
    </div>

    <div class="cyber-card">
      <h3 class="h6 fw-bold mb-3 text-info">🚀 Aplicaciones</h3>
      <div id="app-grid" class="app-grid">
        <div class="app-card" onclick="alert('SlQ Terminal')">
          <div style="font-size: 2rem;">💻</div>
          <div class="fw-bold small mt-2">SlQ Terminal</div>
          <span class="text-muted" style="font-size: 0.65rem;">SISTEMA</span>
        </div>
        <div class="app-card" onclick="alert('Editor de Código')">
          <div style="font-size: 2rem;">📝</div>
          <div class="fw-bold small mt-2">Editor de Código</div>
          <span class="text-muted" style="font-size: 0.65rem;">DESARROLLO</span>
        </div>
        <div class="app-card" onclick="alert('Gestor de Archivos')">
          <div style="font-size: 2rem;">📁</div>
          <div class="fw-bold small mt-2">Gestor de Archivos</div>
          <span class="text-muted" style="font-size: 0.65rem;">SISTEMA</span>
        </div>
      </div>
    </div>

    <div class="cyber-card">
      <h3 class="h6 fw-bold mb-3 text-info">📊 Informe del Sistema</h3>
      <div class="text-muted font-monospace small">{{system-report}}</div>
      <div class="d-none">{{report-content}}</div>
    </div>

    <div class="cyber-card">
      <div class="row">
        <div class="col-6"><strong>IP ACTIVA:</strong> <span class="text-info" id="active-ip">{{active-ip}}</span></div>
        <div class="col-6"><strong>URL LOCAL:</strong> <span class="text-success" id="local-url">{{local-url}}</span></div>
      </div>
    </div>
  </div>
</body>
</html>
"""

with open("src/web/system-dashboard.html", "w", encoding="utf-8") as f:
    f.write(html_content)

print("✅ Plantilla HTML creada con todos los slots obligatorios.")
