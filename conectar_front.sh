#!/bin/bash

echo "=== Conectando los clics del Front-End con el Backend de Aplicaciones ==="

FRONTWEB_DIR="frontweb"

if [ ! -d "$FRONTWEB_DIR" ]; then
    echo "❌ Error: No se encuentra la carpeta '$FRONTWEB_DIR'."
    exit 1
fi

# Creamos o actualizamos un script central de control para las aplicaciones en el front
cat << 'EOF' > "$FRONTWEB_DIR/app-launcher.js"
document.addEventListener("DOMContentLoaded", () => {
  // Buscamos cualquier elemento que represente un botón de aplicación o tarjeta con ID/Data-id de app
  document.addEventListener("click", async (e) => {
    const appCard = e.target.closest("[data-app-id], .app-item, .application-btn");
    if (!appCard) return;
    
    const appId = appCard.getAttribute("data-app-id") || appCard.dataset.id;
    if (!appId) return;

    e.preventDefault();
    try {
      const response = await fetch(`/api/apps/${encodeURIComponent(appId)}/launch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" }
      });
      
      const data = await response.json();
      if (response.ok) {
        console.log(`✅ Aplicación abierta: ${data.name || appId}`);
      } else {
        console.error(`⚠️ Error al abrir app: ${data.error || 'Desconocido'}`);
        alert(`No se pudo abrir la aplicación: ${data.error || 'Error del sistema'}`);
      }
    } catch (err) {
      console.error("❌ Error de red al intentar lanzar la aplicación:", err);
    }
  });
});
EOF

echo "✅ Script de cliente creado en $FRONTWEB_DIR/app-launcher.js"

# Asegurarnos de que las páginas HTML principales incluyan este script antes de cerrar el body
python3 - << 'EOF'
import os

frontweb_dir = "frontweb"
script_tag = '<script src="app-launcher.js"></script>'

for filename in os.listdir(frontweb_dir):
    if filename.endswith(".html"):
        filepath = os.path.join(frontweb_dir, filename)
        with open(filepath, "r", encoding="utf-8") as f:
            content = f.read()
        
        if "app-launcher.js" not in content:
            if "</body>" in content:
                content = content.replace("</body>", f"  {script_tag}\n</body>")
            else:
                content += f"\n{script_tag}\n"
            
            with open(filepath, "w", encoding="utf-8") as f:
                f.write(content)
            print(f"📄 Actualizado HTML: {filename}")
EOF

echo "=== ¡Listo! Front-end y Back-end conectados. ==="