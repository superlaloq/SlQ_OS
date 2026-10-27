import re

path = "src/index.js"
with open(path, "r", encoding="utf-8") as f:
    content = f.read()

# Limpiar adiciones anteriores para evitar duplicados o conflictos
content = re.sub(r'// === RUTAS SLQ-OS APLICACIONES ===.*?\n\n', '', content, flags=re.DOTALL)
content = re.sub(r'// SlQ-OS App Routes adicionales.*?\n\n', '', content, flags=re.DOTALL)

# Detectar automáticamente la variable con la que Express escucha (.listen)
match = re.search(r'(\w+)\.listen\(', content)
app_var = match.group(1) if match else 'app'
print(f"🔍 Variable de Express detectada: {app_var}")

routes_code = f"""
// === RUTAS SLQ-OS APLICACIONES ===
{app_var}.get("/editor", (req, res) => {{
    res.send(`<!doctype html><html lang="es" data-bs-theme="dark"><head><meta charset="utf-8"><title>SlQ-OS // Editor</title><link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet"><style>body{{background:#090d14;color:#e2e8f0;font-family:monospace;padding:20px;}}</style></head><body><h2>📝 SlQ-OS // Editor de Código</h2><textarea class="form-control bg-dark text-light font-monospace mt-3" rows="15" placeholder="// Escribe tu código aquí..."></textarea><div class="mt-3"><button class="btn btn-success btn-sm" onclick="alert('¡Guardado!')">Guardar</button> <a href="/" class="btn btn-outline-secondary btn-sm">Volver al Command Center</a></div></body></html>`);
}});

{app_var}.get("/files", (req, res) => {{
    res.send(`<!doctype html><html lang="es" data-bs-theme="dark"><head><meta charset="utf-8"><title>SlQ-OS // Archivos</title><link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet"><style>body{{background:#090d14;color:#e2e8f0;font-family:monospace;padding:20px;}}</style></head><body><h2>📁 SlQ-OS // Gestor de Archivos</h2><ul class="list-group bg-dark mt-3"><li class="list-group-item bg-dark text-light border-secondary">📄 /src/index.js</li><li class="list-group-item bg-dark text-light border-secondary">📄 /src/web/system-dashboard.html</li></ul><div class="mt-3"><a href="/" class="btn btn-outline-secondary btn-sm">Volver al Command Center</a></div></body></html>`);
}});

{app_var}.get("/terminal", (req, res) => {{
    res.send(`<!doctype html><html lang="es" data-bs-theme="dark"><head><meta charset="utf-8"><title>SlQ-OS // Terminal</title><link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet"><style>body{{background:#090d14;color:#58dfc0;font-family:monospace;padding:20px;}}</style></head><body><h2>💻 SlQ-OS // Terminal Interactiva</h2><div class="bg-black p-3 rounded border border-secondary mt-3" style="min-height:250px;">eduardo@SlQ:~$ <span>_</span></div><div class="mt-3"><a href="/" class="btn btn-outline-secondary btn-sm">Volver al Command Center</a></div></body></html>`);
}});
"""

if f"{app_var}.listen(" in content:
    content = content.replace(f"{app_var}.listen(", routes_code + f"\n{app_var}.listen(")
else:
    content += routes_code

with open(path, "w", encoding="utf-8") as f:
    f.write(content)

print("✅ Rutas inyectadas correctamente en src/index.js")
