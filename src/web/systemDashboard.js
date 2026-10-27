const fs = require('fs');
const path = require('path');

function replaceSlot(template, slot, value) {
    if (!template.includes(`{{${slot}}}`)) {
        // Tolerante: si no está, devolvemos el template intacto
        return template;
    }
    return template.replace(new RegExp(`{{${slot}}}`, "g"), value || "");
}

function generateSystemDashboard() {
    const templatePath = path.join(__dirname, 'system-dashboard.html');
    if (!fs.existsSync(templatePath)) {
        console.error("⚠️ No se encontró la plantilla system-dashboard.html");
        return;
    }
    
    let template = fs.readFileSync(templatePath, 'utf8');
    
    // Rellenar slots si existen
    template = replaceSlot(template, 'system-report', 'SlQ-OS Command Center Active - All Systems Normal');
    template = replaceSlot(template, 'report-content', '<div class="alert alert-success">Dashboard Operativo</div>');
    template = replaceSlot(template, 'active-ip', '127.0.0.1');
    template = replaceSlot(template, 'local-url', 'http://localhost:3000');
    
    const outputPath = path.join(__dirname, '../../index.html');
    fs.writeFileSync(outputPath, template, 'utf8');
    console.log("✅ Panel generado correctamente en la raíz.");
}

module.exports = { generateSystemDashboard };
