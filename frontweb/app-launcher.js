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
