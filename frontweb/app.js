function createApplicationCard(application) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'application-card';
  // Guardamos el ID de la aplicación en el dataset para referencias rápidas si se necesita
  button.dataset.appId = application.id;

  const icon = document.createElement('span');
  icon.className = 'application-icon';
  icon.setAttribute('aria-hidden', 'true');
  if (application.iconUrl) {
    const image = document.createElement('img');
    image.src = application.iconUrl;
    image.alt = '';
    image.loading = 'lazy';
    image.addEventListener('error', () => {
      icon.textContent = application.name.slice(0, 1).toLocaleUpperCase();
    }, { once: true });
    icon.append(image);
  } else {
    icon.textContent = application.name.slice(0, 1).toLocaleUpperCase();
  }

  const details = document.createElement('span');
  details.className = 'application-details';
  
  const name = document.createElement('span');
  name.className = 'application-name';
  name.textContent = application.name;
  
  const category = document.createElement('span');
  category.className = 'application-category';
  category.textContent = application.category;
  
  details.append(name, category);
  button.append(icon, details);

  // Manejador del clic optimizado para lanzar la aplicación local
  button.addEventListener('click', async () => {
    button.disabled = true;
    if (applicationStatus) {
      applicationStatus.textContent = `Abriendo ${application.name}…`;
    }
    
    try {
      // Petición POST al backend para ejecutar el lanzador del sistema (gio / xdg-open)
      const response = await apiRequest(`/api/apps/${encodeURIComponent(application.id)}/launch`, { 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      
      if (applicationStatus) {
        applicationStatus.textContent = `${response.name || application.name} se abrió correctamente.`;
      }
      console.log(`✅ Aplicación abierta: ${application.name} (${application.id})`);
    } catch (error) {
      console.error(`❌ Error al abrir ${application.name}:`, error);
      if (applicationStatus) {
        applicationStatus.textContent = `No se pudo abrir ${application.name}: ${error.message}`;
      }
    } finally {
      button.disabled = false;
    }
  });

  return button;
}