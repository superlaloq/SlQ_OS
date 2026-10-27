import re

path = "src/index.js"
with open(path, "r", encoding="utf-8") as f:
    code = f.read()

# Detectar la variable de Express
app_match = re.search(r"const\s+(\w+)\s*=\s*express\s*\(\)", code)
app_var = app_match.group(1) if app_match else "app"
print(f"🔍 Variable de Express detectada: {app_var}")

# Limpiar bloques anteriores mal inyectados
code = re.sub(r"// SlQ-OS App Routes adicionales.*?(?=\bapp\b|\bserver\b|\b" + app_var + r"\b)\.listen", "", code, flags=re.DOTALL)

routes_code = f"""
// SlQ-OS App Routes adicionales
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

target = f"{app_var}.listen"
if target in code:
    code = code.replace(target, routes_code + "\n" + target)
else:
    code += routes_code

with open(path, "w", encoding="utf-8") as f:
    f.write(code)

print("✅ Rutas añadidas exitosamente con el script auxiliar.")
