const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

function registerApiRoutes(app, rootDir) {
    if (!app) return;

    // API para listar archivos del proyecto de forma segura
    app.get("/api/files-list", (_req, res) => {
        try {
            const walk = (dir, fileList = []) => {
                fs.readdirSync(dir).forEach(file => {
                    const filePath = path.join(dir, file);
                    if (fs.statSync(filePath).isDirectory()) {
                        if (!filePath.includes("node_modules") && !filePath.includes(".git")) {
                            walk(filePath, fileList);
                        }
                    } else {
                        fileList.push(path.relative(rootDir, filePath));
                    }
                });
                return fileList;
            };
            res.json({ success: true, files: walk(rootDir) });
        } catch (err) {
            res.status(500).json({ success: false, error: err.message });
        }
    });

    // API para leer archivo
    app.get("/api/read-file", (req, res) => {
        try {
            const fullPath = path.resolve(rootDir, req.query.path);
            const content = fs.readFileSync(fullPath, "utf8");
            res.json({ success: true, content });
        } catch (err) {
            res.status(500).json({ success: false, error: err.message });
        }
    });

    // API para guardar archivo
    app.post("/api/save-file", (req, res) => {
        try {
            const { path: relPath, content } = req.body;
            const fullPath = path.resolve(rootDir, relPath);
            fs.writeFileSync(fullPath, content, "utf8");
            res.json({ success: true });
        } catch (err) {
            res.status(500).json({ success: false, error: err.message });
        }
    });

    // API para ejecutar comandos de terminal reales
    app.post("/api/terminal-exec", (req, res) => {
        const { command } = req.body;
        if (!command) {
            return res.status(400).json({ success: false, error: "Comando vacío." });
        }
        exec(command, { cwd: rootDir, timeout: 15000 }, (error, stdout, stderr) => {
            res.json({
                success: !error,
                output: stdout || stderr || (error ? error.message : "Comando ejecutado sin salida.")
            });
        });
    });
}

module.exports = { registerApiRoutes };
