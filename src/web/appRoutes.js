const fs = require('fs');
const path = require('path');

function registerAppRoutes(app) {
    if (!app || typeof app.get !== 'function') return;

    // Endpoint API para listar archivos reales del proyecto de forma segura
    app.get("/api/files-list", (req, res) => {
        try {
            const baseDir = path.resolve(__dirname, '../../');
            const walk = (dir, fileList = []) => {
                const files = fs.readdirSync(dir);
                files.forEach(file => {
                    const filePath = path.join(dir, file);
                    if (fs.statSync(filePath).isDirectory()) {
                        if (!filePath.includes('node_modules') && !filePath.includes('.git')) {
                            walk(filePath, fileList);
                        }
                    } else {
                        fileList.push(path.relative(baseDir, filePath));
                    }
                });
                return fileList;
            };
            const allFiles = walk(baseDir);
            res.json({ success: true, files: allFiles });
        } catch (err) {
            res.status(500).json({ success: false, error: err.message });
        }
    });

    // Vista Interactiva del Editor de Código con lectura y guardado
    app.get("/editor", (req, res) => {
        res.send(`<!doctype html><html lang="es" data-bs-theme="dark"><head><meta charset="utf-8"><title>SlQ-OS // Editor</title><link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet"><style>body{background:#090d14;color:#e2e8f0;font-family:monospace;padding:20px;}</style></head><body><h2>📝 SlQ-OS // Editor de Código</h2><div class="mb-2"><select id="file-select" class="form-select form-select-sm bg-dark text-light border-secondary mb-2"><option value="">Selecciona un archivo para editar...</option></select></div><textarea id="code-area" class="form-control bg-dark text-light font-monospace mt-2" rows="16" placeholder="// Selecciona un archivo..."></textarea><div class="mt-3"><button class="btn btn-success btn-sm" onclick="saveFile()">Guardar Cambios</button> <a href="/" class="btn btn-outline-secondary btn-sm">Volver al Command Center</a></div><script>
        fetch('/api/files-list').then(r=>r.json()).then(data => {
            if(data.success) {
                const sel = document.getElementById('file-select');
                data.files.forEach(f => {
                    const opt = document.createElement('option');
                    opt.value = f; opt.textContent = f;
                    sel.appendChild(opt);
                });
            }
        });
        document.getElementById('file-select').addEventListener('change', (e) => {
            if(!e.target.value) return;
            fetch('/api/read-file?path=' + encodeURIComponent(e.target.value)).then(r=>r.json()).then(d => {
                document.getElementById('code-area').value = d.content || '';
            });
        });
        function saveFile() {
            const filePath = document.getElementById('file-select').value;
            const content = document.getElementById('code-area').value;
            if(!filePath) return alert('Selecciona un archivo primero');
            fetch('/api/save-file', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({path: filePath, content})})
            .then(r=>r.json()).then(d => alert(d.success ? '✅ Archivo guardado con éxito' : '❌ Error al guardar'));
        }
        </script></body></html>`);
    });

    // API para leer archivos
    app.get("/api/read-file", (req, res) => {
        try {
            const relPath = req.query.path;
            const fullPath = path.resolve(__dirname, '../../', relPath);
            const content = fs.readFileSync(fullPath, 'utf8');
            res.json({ success: true, content });
        } catch (err) {
            res.status(500).json({ success: false, error: err.message });
        }
    });

    // API para guardar archivos
    app.use(express.json());
    app.post("/api/save-file", (req, res) => {
        try {
            const { path: relPath, content } = req.body;
            const fullPath = path.resolve(__dirname, '../../', relPath);
            fs.writeFileSync(fullPath, content, 'utf8');
            res.json({ success: true });
        } catch (err) {
            res.status(500).json({ success: false, error: err.message });
        }
    });

    // Vista de Gestor de Archivos optimizada
    app.get("/files", (req, res) => {
        res.send(`<!doctype html><html lang="es" data-bs-theme="dark"><head><meta charset="utf-8"><title>SlQ-OS // Archivos</title><link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet"><style>body{background:#090d14;color:#e2e8f0;font-family:monospace;padding:20px;}</style></head><body><h2>📁 SlQ-OS // Gestor de Recursos y Archivos</h2><div id="file-list" class="list-group bg-dark mt-3" style="max-height:450px; overflow-y:auto;">Cargando archivos...</div><div class="mt-3"><a href="/" class="btn btn-outline-secondary btn-sm">Volver al Command Center</a></div><script>
        fetch('/api/files-list').then(r=>r.json()).then(data => {
            if(data.success) {
                const container = document.getElementById('file-list');
                container.innerHTML = '';
                data.files.forEach(f => {
                    const item = document.createElement('ahref="#"');
                    item.className = 'list-group-item list-group-item-action bg-dark text-light border-secondary small';
                    item.textContent = '📄 ' + f;
                    item.onclick = () => window.open('/editor', '_blank');
                    container.appendChild(item);
                });
            }
        });
        </script></body></html>`);
    });

    // Vista de Terminal interactiva
    app.get("/terminal", (req, res) => {
        res.send(`<!doctype html><html lang="es" data-bs-theme="dark"><head><meta charset="utf-8"><title>SlQ-OS // Terminal</title><link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet"><style>body{background:#090d14;color:#58dfc0;font-family:monospace;padding:20px;}</style></head><body><h2>💻 SlQ-OS // Terminal Interactiva</h2><div id="terminal-out" class="bg-black p-3 rounded border border-secondary mt-3" style="min-height:300px; max-height:400px; overflow-y:auto;">eduardo@SlQ:~$ Sistema inicializado correctamente.\n</div><div class="input-group mt-3"><span class="input-group-text bg-dark text-success border-secondary">$</span><input id="cmd-input" type="text" class="form-control bg-dark text-light border-secondary font-monospace" placeholder="Escribe un comando..." autofocus></div><div class="mt-3"><a href="/" class="btn btn-outline-secondary btn-sm">Volver al Command Center</a></div><script>
        const input = document.getElementById('cmd-input');
        const out = document.getElementById('terminal-out');
        input.addEventListener('keypress', (e) => {
            if(e.key === 'Enter') {
                const cmd = input.value;
                out.innerHTML += \`\\neduardo@SlQ:~$ \${cmd}\\n[Simulado] Comando ejecutado con éxito.\`;
                input.value = '';
                out.scrollTop = out.scrollHeight;
            }
        });
        </script></body></html>`);
    });
}

module.exports = registerAppRoutes;
