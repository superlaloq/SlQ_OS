const categories = [
  { id: 'imagenes', title: 'Imágenes', description: 'Fotografías, ilustraciones y gráficos', icon: 'image', folder: 'imagenes', page: 'imagenes.html' },
  { id: 'videos', title: 'Videos', description: 'Videos y material multimedia', icon: 'video', folder: 'videos', page: 'videos.html' },
  { id: 'documentos', title: 'Documentos', description: 'Archivos para consultar o descargar', icon: 'document', folder: 'documentos', page: 'documentos.html' },
  { id: 'proyectos', title: 'Proyectos', description: 'Sitios y aplicaciones web', icon: 'layers', folder: 'proyectos', page: 'proyectos.html' },
  { id: 'redes-sociales', title: 'Redes sociales', description: 'Accesos directos a tus redes y comunidades', icon: 'network', folder: null, page: 'redes-sociales' },
  { id: 'correos', title: 'Correos electrónicos', description: 'Accesos para abrir tu correo en su servicio', icon: 'mail', folder: null, page: 'correos' },
  { id: 'webs-destacadas', title: 'Webs destacadas', description: 'Tus páginas favoritas reunidas en un lugar', icon: 'globe', folder: null, page: 'webs-destacadas' },
  { id: 'scripts', title: 'Scripts SlQ', description: 'Programas del sistema SlQ', icon: 'code', folder: null, page: 'scripts.html' }
];

const categoryIconMarkup = {
  image: '<rect x="3" y="3" width="18" height="18" rx="4"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/>',
  video: '<rect x="3" y="5" width="18" height="14" rx="3"/><path d="m10 9 5 3-5 3z"/>',
  document: '<path d="M7 3h7l5 5v13H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z"/><path d="M14 3v6h6M9 14h6m-6 4h6"/>',
  layers: '<path d="m12 3 9 5-9 5-9-5 9-5Z"/><path d="m3 12 9 5 9-5m-18 5 9 5 9-5"/>',
  network: '<circle cx="12" cy="12" r="3"/><circle cx="5" cy="5" r="2"/><circle cx="19" cy="5" r="2"/><circle cx="5" cy="19" r="2"/><circle cx="19" cy="19" r="2"/><path d="m10 10-3.5-3.5m7 0L17 10m-7 4-3.5 3.5m7 0L17 14"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="3"/><path d="m4 7 8 6 8-6"/>',
  globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a15 15 0 0 1 0 18m0-18a15 15 0 0 0 0 18"/>',
  code: '<path d="m8 8-4 4 4 4m8-8 4 4-4 4m-3-11-2 14"/>',
  external: '<path d="M14 4h6v6m0-6-9 9"/><path d="M18 13v5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h5"/>'
};

function createCategoryIcon(name) {
  const icon = document.createElement('span');
  icon.className = 'category-icon';
  icon.setAttribute('aria-hidden', 'true');
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '1.7');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  svg.innerHTML = categoryIconMarkup[name];
  icon.append(svg);
  return icon;
}

const page = document.querySelector('[data-category]');
const linkPage = document.querySelector('[data-links-category]');
const homeGrid = document.querySelector('#category-grid');
const applicationSearch = document.querySelector('#application-search');
const applicationSort = document.querySelector('#application-sort');
const applicationCategories = document.querySelector('#application-categories');
const applicationGroups = document.querySelector('#application-groups');
const applicationStatus = document.querySelector('#application-status');
const applicationEmpty = document.querySelector('#application-empty');
const searchInput = document.querySelector('#search');
const fileGrid = document.querySelector('#file-grid');
const statusMessage = document.querySelector('#status-message');
const emptyState = document.querySelector('#empty-state');
const breadcrumbs = document.querySelector('#manager-breadcrumbs');
const uploadInput = document.querySelector('#file-upload');
const folderUploadInput = document.querySelector('#folder-upload');
const projectAcceptButton = document.querySelector('#project-accept');
const projectPreviewButton = document.querySelector('#project-preview');
const projectEditorButton = document.querySelector('#project-editor');
const projectRunButton = document.querySelector('#project-run-slq');
let catalog = {};
let currentPath = new URLSearchParams(location.search).get('path') || '';
let currentEntries = [];
let pendingProjectInspection = null;
const applicationCategoryOrder = [
  'Desarrollo',
  'Oficina',
  'Internet',
  'Multimedia',
  'Gráficos',
  'Educación',
  'Juegos',
  'Sistema',
  'Aplicaciones'
];
let installedApplications = [];
let activeApplicationCategory = 'Todas';

function normalizeApplicationSearch(value) {
  return value.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLocaleLowerCase();
}

function compareApplicationNames(left, right) {
  return left.name.localeCompare(right.name, 'es', { sensitivity: 'base' });
}

function createApplicationCard(application) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'application-card';
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
  button.addEventListener('click', async () => {
    button.disabled = true;
    applicationStatus.textContent = `Abriendo ${application.name}…`;
    try {
      await apiRequest(`/api/apps/${encodeURIComponent(application.id)}/launch`, { method: 'POST' });
      applicationStatus.textContent = `${application.name} se abrió correctamente.`;
    } catch (error) {
      applicationStatus.textContent = `No se pudo abrir ${application.name}: ${error.message}`;
    } finally {
      button.disabled = false;
    }
  });
  return button;
}

function renderApplicationCatalog() {
  if (!applicationCategories || !applicationGroups || !applicationSearch ||
      !applicationSort || !applicationEmpty || !applicationStatus) return;

  const query = normalizeApplicationSearch(applicationSearch.value.trim());
  const visibleApplications = installedApplications.filter((application) => {
    const matchesCategory = activeApplicationCategory === 'Todas' ||
      application.category === activeApplicationCategory;
    const searchableText = normalizeApplicationSearch(`${application.name} ${application.category}`);
    return matchesCategory && searchableText.includes(query);
  });
  const availableCategories = [...new Set(installedApplications.map((application) => application.category))]
    .sort((left, right) => {
      const leftOrder = applicationCategoryOrder.indexOf(left);
      const rightOrder = applicationCategoryOrder.indexOf(right);
      return (leftOrder < 0 ? applicationCategoryOrder.length : leftOrder) -
        (rightOrder < 0 ? applicationCategoryOrder.length : rightOrder) ||
        left.localeCompare(right, 'es', { sensitivity: 'base' });
    });

  applicationCategories.replaceChildren();
  const filters = ['Todas', ...availableCategories];
  for (const categoryName of filters) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'application-category-filter';
    button.textContent = categoryName === 'Todas'
      ? `Todas · ${installedApplications.length}`
      : `${categoryName} · ${installedApplications.filter((application) => application.category === categoryName).length}`;
    button.setAttribute('aria-pressed', String(categoryName === activeApplicationCategory));
    button.addEventListener('click', () => {
      activeApplicationCategory = categoryName;
      renderApplicationCatalog();
    });
    applicationCategories.append(button);
  }

  applicationGroups.replaceChildren();
  const groups = applicationSort.value === 'category'
    ? availableCategories
      .filter((categoryName) => activeApplicationCategory === 'Todas' ||
        categoryName === activeApplicationCategory)
      .map((categoryName) => ({
        name: categoryName,
        applications: visibleApplications.filter((application) => application.category === categoryName)
      }))
      .filter((group) => group.applications.length)
    : visibleApplications.length
      ? [{ name: activeApplicationCategory === 'Todas' ? 'Todas las aplicaciones' : activeApplicationCategory, applications: [...visibleApplications] }]
      : [];

  for (const group of groups) {
    group.applications.sort(compareApplicationNames);
    if (applicationSort.value === 'name-desc') group.applications.reverse();
    const section = document.createElement('section');
    section.className = 'application-group';
    const heading = document.createElement('h3');
    heading.className = 'application-group-title';
    heading.textContent = group.name;
    const count = document.createElement('span');
    count.textContent = `${group.applications.length}`;
    heading.append(count);
    const grid = document.createElement('div');
    grid.className = 'application-grid';
    grid.setAttribute('aria-label', group.name);
    for (const application of group.applications) grid.append(createApplicationCard(application));
    section.append(heading, grid);
    applicationGroups.append(section);
  }

  applicationEmpty.hidden = visibleApplications.length > 0;
  applicationStatus.textContent = visibleApplications.length
    ? `${visibleApplications.length} de ${installedApplications.length} aplicaciones`
    : installedApplications.length
      ? 'No se encontraron aplicaciones con esos filtros.'
      : 'No se encontraron aplicaciones instaladas para mostrar.';
}

function formatSize(size) {
  if (size < 1024) return `${size} B`;
  const units = ['KB', 'MB', 'GB', 'TB'];
  let amount = size / 1024;
  let unit = 0;
  while (amount >= 1024 && unit < units.length - 1) {
    amount /= 1024;
    unit += 1;
  }
  return `${amount.toFixed(amount >= 10 ? 0 : 1)} ${units[unit]}`;
}

function renderLinkEntries(links) {
  const grid = document.querySelector('#link-grid');
  const empty = document.querySelector('#link-empty');
  const status = document.querySelector('#link-status');
  grid.replaceChildren();

  for (const entry of links) {
    const card = document.createElement('article');
    card.className = 'category-card saved-link-card';
    const icon = createCategoryIcon(linkPage.dataset.linksCategory === 'correos' ? 'mail' : 'external');
    const title = document.createElement('h2');
    title.textContent = entry.name;
    const address = document.createElement('p');
    address.className = 'saved-link-address';
    address.textContent = entry.url.replace(/^mailto:/i, '');
    const actions = document.createElement('div');
    actions.className = `saved-link-actions${entry.loginUrl ? ' has-login-link' : ''}`;
    const openLink = document.createElement('a');
    openLink.className = 'file-button primary-file-button';
    openLink.href = entry.url;
    openLink.textContent = entry.url.startsWith('mailto:')
      ? 'Nuevo correo'
      : linkPage.dataset.linksCategory === 'correos' ? 'Abrir correo' : 'Inicio';
    if (!entry.url.startsWith('mailto:')) {
      openLink.target = '_blank';
      openLink.rel = 'noopener noreferrer';
    }
    actions.append(openLink);
    if (entry.loginUrl) {
      const loginLink = document.createElement('a');
      loginLink.className = 'file-button secondary-button';
      loginLink.href = entry.loginUrl;
      loginLink.target = '_blank';
      loginLink.rel = 'noopener noreferrer';
      loginLink.textContent = 'Iniciar sesión';
      actions.append(loginLink);
    }
    const deleteButton = document.createElement('button');
    deleteButton.type = 'button';
    deleteButton.className = 'file-button danger-button';
    deleteButton.textContent = 'Eliminar';
    deleteButton.addEventListener('click', async () => {
      if (!window.confirm(`¿Eliminar el acceso "${entry.name}"?`)) return;
      deleteButton.disabled = true;
      try {
        await apiRequest(`/api/links/${encodeURIComponent(linkPage.dataset.linksCategory)}/${encodeURIComponent(entry.id)}`, {
          method: 'DELETE'
        });
        await loadLinks();
      } catch (error) {
        showDialog('No se pudo eliminar el acceso', error.message);
      } finally {
        deleteButton.disabled = false;
      }
    });
    actions.append(deleteButton);
    card.append(icon, title, address, actions);
    grid.append(card);
  }

  empty.hidden = links.length > 0;
  status.textContent = `${links.length} acceso${links.length === 1 ? '' : 's'} guardado${links.length === 1 ? '' : 's'}.`;
}

async function loadLinks() {
  const category = linkPage.dataset.linksCategory;
  document.querySelector('#link-status').textContent = 'Cargando accesos…';
  renderLinkEntries(await apiRequest(`/api/links/${encodeURIComponent(category)}`));
}

function setUpLinksPage() {
  const form = document.querySelector('#link-form');
  const addressInput = document.querySelector('#link-address');
  const loginAddressInput = document.querySelector('#link-login-address');
  if (linkPage.dataset.linksCategory === 'correos') {
    addressInput.type = 'text';
    addressInput.autocomplete = 'off';
  } else {
    addressInput.type = 'url';
    addressInput.autocomplete = 'url';
    addressInput.placeholder = 'https://ejemplo.com';
  }
  if (loginAddressInput) {
    loginAddressInput.type = 'url';
    loginAddressInput.autocomplete = 'url';
  }
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const submit = form.querySelector('button[type="submit"]');
    submit.disabled = true;
    try {
      await apiRequest(`/api/links/${encodeURIComponent(linkPage.dataset.linksCategory)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: document.querySelector('#link-name').value,
          url: addressInput.value,
          ...(loginAddressInput?.value ? { loginUrl: loginAddressInput.value } : {})
        })
      });
      form.reset();
      await loadLinks();
    } catch (error) {
      showDialog('No se pudo guardar el acceso', error.message);
    } finally {
      submit.disabled = false;
    }
  });
  loadLinks().catch((error) => {
    document.querySelector('#link-status').textContent = error.message;
  });
}

function fileUrl(category, name) {
  const prefix = category === 'scripts' ? '' : `/${category}`;
  return `${prefix}/${name.split('/').map(encodeURIComponent).join('/')}`;
}

function openActionDialog(dialog) {
  if (!dialog.open) dialog.showModal();
}

function showDialog(title, content) {
  const dialog = document.querySelector('#action-dialog');
  if (!dialog) {
    window.alert(`${title}\n\n${content}`);
    return;
  }
  document.querySelector('#dialog-title').textContent = title;
  document.querySelector('#dialog-content').textContent = content;
  projectAcceptButton?.setAttribute('hidden', '');
  projectPreviewButton?.setAttribute('hidden', '');
  projectEditorButton?.setAttribute('hidden', '');
  projectRunButton?.setAttribute('hidden', '');
  openActionDialog(dialog);
}

async function inspectProject(relativePath) {
  const query = new URLSearchParams({ path: relativePath });
  try {
    const inspection = await apiRequest(`/api/projects/inspect?${query}`);
    pendingProjectInspection = inspection;
    const dependencyLines = inspection.dependencies.flatMap((item) => [
      `Dependencias (${item.manifest}): ${item.dependencies.length ? item.dependencies.join(', ') : 'sin lista automática'}`,
      ...item.commands.map((command) => `  Sugerencia manual: ${command}`),
      ...(item.scripts?.length ? [`Scripts definidos (no ejecutados): ${item.scripts.join(', ')}`] : [])
    ]);
    const lines = [
      `Elemento: ${inspection.path}`,
      `Tipo: ${inspection.kind}`,
      `Archivos analizados: ${inspection.fileCount}${inspection.truncated ? ' (lista parcial)' : ''}`,
      `Tamaño total: ${formatSize(inspection.totalBytes)}`,
      `SHA-256: ${inspection.hash}`,
      `Estado: ${inspection.approved ? `aprobado por ${inspection.approvedBy} el ${inspection.approvedAt}` : 'pendiente de aprobación'}`
    ];
    if (inspection.entryPoint) lines.push(`Entrada web: ${inspection.entryPoint}`);
    if (inspection.files.length) {
      lines.push('', 'Archivos:', ...inspection.files.map((file) => `  ${file.name} (${formatSize(file.size)})`));
    }
    if (dependencyLines.length) lines.push('', ...dependencyLines);
    if (inspection.manifestErrors.length) lines.push('', 'Errores de manifiesto:', ...inspection.manifestErrors);
    lines.push('', ...inspection.warnings.map((warning) => `Aviso: ${warning}`));
    document.querySelector('#dialog-title').textContent = 'Análisis del proyecto';
    document.querySelector('#dialog-content').textContent = lines.join('\n');
    projectAcceptButton?.toggleAttribute('hidden', inspection.approved);
    projectPreviewButton?.toggleAttribute('hidden', !inspection.approved || !inspection.entryPoint);
    projectEditorButton?.removeAttribute('hidden');
    projectRunButton?.toggleAttribute('hidden', !inspection.approved || !inspection.isSlq);
    openActionDialog(document.querySelector('#action-dialog'));
  } catch (error) {
    showDialog('No se pudo analizar el proyecto', error.message);
  }
}

async function apiRequest(url, options = {}) {
  const response = await fetch(url, options);
  if (response.status === 401) {
    throw new Error('Sesión no autorizada. Recarga la página e inicia sesión.');
  }
  if (!response.ok) {
    let message = `Error del servidor (${response.status}).`;
    try {
      const result = await response.json();
      if (result.error) message = result.error;
    } catch (_error) {
      // La respuesta de error no incluyó JSON.
    }
    throw new Error(message);
  }
  if (response.status === 204) return null;
  return response.json();
}

function renderHome() {
  homeGrid.replaceChildren();
  for (const category of categories) {
    const link = document.createElement('a');
    link.className = 'category-card';
    link.href = `/frontweb/${category.page}`;
    const icon = createCategoryIcon(category.icon);
    const title = document.createElement('h2');
    title.textContent = category.title;
    const description = document.createElement('p');
    description.textContent = category.description;
    const count = document.createElement('span');
    count.className = 'category-count';
    const total = catalog[category.id];
    count.textContent = `${Array.isArray(total) ? total.length : Number(total) || 0} ${category.folder ? 'archivos' : 'accesos'}`;
    link.append(icon, title, description, count);
    homeGrid.append(link);
  }
}

async function loadApplications() {
  if (!applicationGroups || !applicationStatus) return;
  applicationStatus.textContent = 'Buscando aplicaciones instaladas…';
  try {
    installedApplications = await apiRequest('/api/apps', { headers: { Accept: 'application/json' } });
    applicationSearch.addEventListener('input', renderApplicationCatalog);
    applicationSort.addEventListener('change', renderApplicationCatalog);
    renderApplicationCatalog();
  } catch (error) {
    applicationStatus.textContent = `No se pudo cargar el catálogo: ${error.message}`;
  }
}

function appendAction(actions, label, className, handler) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = `file-button ${className || ''}`.trim();
  button.textContent = label;
  button.addEventListener('click', handler);
  actions.append(button);
}

function getEntryPath(name) {
  return currentPath ? `${currentPath}/${name}` : name;
}

function renderBreadcrumbs() {
  breadcrumbs.replaceChildren();
  const rootLink = document.createElement('button');
  rootLink.type = 'button';
  rootLink.className = 'breadcrumb';
  rootLink.textContent = categories.find((category) => category.id === page.dataset.category).title;
  rootLink.addEventListener('click', () => navigateTo(''));
  breadcrumbs.append(rootLink);

  let accumulated = '';
  for (const segment of currentPath.split('/').filter(Boolean)) {
    const separator = document.createElement('span');
    separator.className = 'breadcrumb-separator';
    separator.textContent = '/';
    breadcrumbs.append(separator);
    accumulated = accumulated ? `${accumulated}/${segment}` : segment;
    const target = accumulated;
    const link = document.createElement('button');
    link.type = 'button';
    link.className = 'breadcrumb';
    link.textContent = segment;
    link.addEventListener('click', () => navigateTo(target));
    breadcrumbs.append(link);
  }
}

function navigateTo(directory) {
  currentPath = directory;
  const url = new URL(location.href);
  if (directory) url.searchParams.set('path', directory);
  else url.searchParams.delete('path');
  history.pushState({}, '', url);
  loadDirectory();
}

async function performAction(button, action) {
  button.disabled = true;
  try {
    await action();
    await loadDirectory();
  } catch (error) {
    showDialog('No se pudo completar la acción', error.message);
  } finally {
    button.disabled = false;
  }
}

function createEntryCard(category, entry) {
  const card = document.createElement('article');
  card.className = `file-card${entry.kind === 'directory' ? ' folder-card' : ''}${category === 'documentos' ? ' document-card' : ''}`;
  const preview = document.createElement('div');
  preview.className = 'file-preview';

  if (entry.kind === 'directory') {
    preview.textContent = '▰';
    preview.setAttribute('aria-label', 'Carpeta');
  } else if (category === 'documentos') {
    preview.classList.add('document-preview');
    const windowBar = document.createElement('div');
    windowBar.className = 'document-window-bar';
    windowBar.setAttribute('aria-hidden', 'true');
    for (let index = 0; index < 3; index += 1) {
      const dot = document.createElement('span');
      windowBar.append(dot);
    }
    const documentMark = document.createElement('span');
    documentMark.className = 'document-mark';
    documentMark.textContent = 'S';
    const documentType = document.createElement('span');
    documentType.className = 'document-type';
    documentType.textContent = 'SlQ-OS · DOCUMENTO';
    preview.append(windowBar, documentMark, documentType);
  } else if (category === 'imagenes' && /\.(avif|gif|jpe?g|png|svg|webp)$/i.test(entry.name)) {
    const image = document.createElement('img');
    image.src = fileUrl(category, getEntryPath(entry.name));
    image.alt = entry.name;
    image.loading = 'lazy';
    preview.append(image);
  } else if (category === 'videos' && /\.(mkv|mov|mp4|mpeg|webm)$/i.test(entry.name)) {
    const video = document.createElement('video');
    video.src = fileUrl(category, getEntryPath(entry.name));
    video.controls = true;
    video.preload = 'metadata';
    video.addEventListener('click', (event) => event.stopPropagation());
    preview.append(video);
  } else {
    preview.textContent = category === 'proyectos' ? '{ }' : '▤';
  }

  const info = document.createElement('div');
  info.className = 'file-info';
  const name = document.createElement('span');
  name.className = 'file-name';
  name.title = entry.name;
  name.textContent = entry.name;
  const size = document.createElement('span');
  size.className = 'file-meta';
  size.textContent = entry.kind === 'directory' ? 'Carpeta' : formatSize(entry.size);
  info.append(name, size);

  if (entry.kind === 'directory') {
    if (category === 'proyectos') {
      const actions = document.createElement('div');
      actions.className = 'file-actions';
      const exploreButton = document.createElement('button');
      exploreButton.type = 'button';
      exploreButton.className = 'file-button';
      exploreButton.textContent = 'Explorar';
      exploreButton.addEventListener('click', () => navigateTo(getEntryPath(entry.name)));
      const inspectButton = document.createElement('button');
      inspectButton.type = 'button';
      inspectButton.className = 'file-button primary-file-button';
      inspectButton.textContent = 'Analizar';
      inspectButton.addEventListener('click', () => inspectProject(getEntryPath(entry.name)));
      actions.append(exploreButton, inspectButton);
      card.append(preview, info, actions);
      return card;
    }
    card.tabIndex = 0;
    card.setAttribute('role', 'button');
    card.setAttribute('aria-label', `Abrir carpeta ${entry.name}`);
    card.addEventListener('click', () => navigateTo(getEntryPath(entry.name)));
    card.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        navigateTo(getEntryPath(entry.name));
      }
    });
    card.append(preview, info);
    return card;
  }

  const actions = document.createElement('div');
  actions.className = 'file-actions';
  let openLink;
  const isMarkdownDocument = category === 'documentos' && /\.md$/i.test(entry.name);
  if (category === 'proyectos') {
    openLink = document.createElement('button');
    openLink.type = 'button';
    openLink.textContent = 'Analizar';
    openLink.addEventListener('click', () => inspectProject(getEntryPath(entry.name)));
  } else {
    openLink = document.createElement('a');
    openLink.textContent = isMarkdownDocument ? 'Leer' : 'Abrir';
    openLink.href = isMarkdownDocument
      ? `/frontweb/reader.html?${new URLSearchParams({ path: getEntryPath(entry.name) })}`
      : `/api/manage/open?${new URLSearchParams({ category, path: getEntryPath(entry.name) })}`;
  }
  openLink.className = 'file-button primary-file-button';
  actions.append(openLink);

  const copyButton = document.createElement('button');
  copyButton.type = 'button';
  copyButton.className = 'file-button';
  copyButton.textContent = 'Copiar';
  copyButton.addEventListener('click', () => {
    const suggested = `${entry.name}.copia`;
    const nameInput = window.prompt('Nombre de la copia en esta carpeta:', suggested);
    if (nameInput === null) return;
    performAction(copyButton, async () => apiRequest('/api/manage/copy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        category,
        path: getEntryPath(entry.name),
        destinationPath: currentPath,
        name: nameInput
      })
    }));
  });
  actions.append(copyButton);

  const moveButton = document.createElement('button');
  moveButton.type = 'button';
  moveButton.className = 'file-button';
  moveButton.textContent = 'Mover';
  moveButton.addEventListener('click', () => {
    const destinationPath = window.prompt('Carpeta destino dentro de esta sección (vacío = raíz):', currentPath);
    if (destinationPath === null) return;
    performAction(moveButton, async () => apiRequest('/api/manage/move', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ category, path: getEntryPath(entry.name), destinationCategory: category, destinationPath })
    }));
  });
  actions.append(moveButton);

  const renameButton = document.createElement('button');
  renameButton.type = 'button';
  renameButton.className = 'file-button';
  renameButton.textContent = 'Renombrar';
  renameButton.addEventListener('click', () => {
    const nameInput = window.prompt('Nuevo nombre:', entry.name);
    if (nameInput === null || nameInput === entry.name) return;
    performAction(renameButton, async () => apiRequest('/api/manage/rename', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ category, path: getEntryPath(entry.name), name: nameInput })
    }));
  });
  actions.append(renameButton);

  const deleteButton = document.createElement('button');
  deleteButton.type = 'button';
  deleteButton.className = 'file-button danger-button';
  deleteButton.textContent = 'Eliminar';
  deleteButton.addEventListener('click', () => {
    if (!window.confirm(`¿Eliminar "${entry.name}"? Esta acción no se puede deshacer.`)) return;
    performAction(deleteButton, async () => apiRequest('/api/manage/files', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ category, path: getEntryPath(entry.name) })
    }));
  });
  actions.append(deleteButton);
  card.append(preview, info, actions);
  return card;
}

function renderListing(listing) {
  currentEntries = listing.entries;
  renderBreadcrumbs();
  fileGrid.replaceChildren();
  if (listing.parent !== null) {
    const parentCard = document.createElement('button');
    parentCard.type = 'button';
    parentCard.className = 'parent-folder';
    parentCard.textContent = '↑ Subir un nivel';
    parentCard.addEventListener('click', () => navigateTo(listing.parent));
    fileGrid.append(parentCard);
  }
  const query = searchInput.value.trim().toLocaleLowerCase();
  const visibleEntries = listing.entries.filter((entry) => entry.name.toLocaleLowerCase().includes(query));
  for (const entry of visibleEntries) fileGrid.append(createEntryCard(listing.category, entry));

  const isEmpty = visibleEntries.length === 0;
  emptyState.hidden = !isEmpty;
  fileGrid.hidden = false;
  emptyState.textContent = query
    ? 'No hay elementos que coincidan con la búsqueda.'
    : 'Esta carpeta está vacía. Puedes subir archivos o crear una carpeta.';
  statusMessage.textContent = `${visibleEntries.length} elemento${visibleEntries.length === 1 ? '' : 's'} en ${listing.path || listing.category}.`;
}

async function loadDirectory() {
  const category = page.dataset.category;
  statusMessage.textContent = 'Cargando contenido…';
  const query = new URLSearchParams({ category, path: currentPath });
  const listing = await apiRequest(`/api/manage/files?${query}`);
  renderListing(listing);
}

function setUpFileManager() {
  document.querySelector('#create-folder')?.addEventListener('click', async () => {
    const name = window.prompt('Nombre de la carpeta:');
    if (name === null) return;
    try {
      await apiRequest('/api/manage/folders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category: page.dataset.category, path: currentPath, name })
      });
      await loadDirectory();
    } catch (error) {
      showDialog('No se pudo crear la carpeta', error.message);
    }
  });

  document.querySelector('#refresh-files')?.addEventListener('click', () => loadDirectory().catch((error) => {
    showDialog('No se pudo actualizar', error.message);
  }));

  uploadInput?.addEventListener('change', async () => {
    if (!uploadInput.files.length) return;
    const formData = new FormData();
    formData.set('category', page.dataset.category);
    formData.set('path', currentPath);
    for (const file of uploadInput.files) formData.append('files', file);
    statusMessage.textContent = `Subiendo ${uploadInput.files.length} archivo(s)…`;
    try {
      const result = await apiRequest('/api/manage/upload', { method: 'POST', body: formData });
      await loadDirectory();
      statusMessage.textContent = `Se subieron ${result.created.length} archivo(s): ${result.created.join(', ')}`;
    } catch (error) {
      showDialog('No se pudieron subir los archivos', error.message);
      statusMessage.textContent = error.message;
    } finally {
      uploadInput.value = '';
    }
  });

  folderUploadInput?.addEventListener('change', async () => {
    if (!folderUploadInput.files.length) return;
    const files = [...folderUploadInput.files];
    const formData = new FormData();
    formData.set('destination', currentPath);
    for (const file of files) {
      formData.append('files', file, file.webkitRelativePath || file.name);
    }
    const folderName = (files[0].webkitRelativePath || files[0].name).split('/')[0];
    statusMessage.textContent = `Preparando carpeta ${folderName} (${files.length} archivos)…`;
    folderUploadInput.disabled = true;
    try {
      const result = await apiRequest('/api/projects/upload-folder', {
        method: 'POST',
        body: formData
      });
      await loadDirectory();
      statusMessage.textContent =
        `Carpeta ${result.folder} incorporada (${result.fileCount} archivos).${
          result.skippedFiles ? ` Se omitieron ${result.skippedFiles} elementos ocultos o de dependencias.` : ''
        } Analízala y apruébala antes de servirla.`;
    } catch (error) {
      showDialog('No se pudo subir la carpeta', error.message);
      statusMessage.textContent = error.message;
    } finally {
      folderUploadInput.value = '';
      folderUploadInput.disabled = false;
    }
  });

  searchInput.addEventListener('input', () => {
    const listing = { category: page.dataset.category, path: currentPath, parent: currentPath || null, entries: currentEntries };
    renderListing(listing);
  });

  window.addEventListener('popstate', () => {
    currentPath = new URLSearchParams(location.search).get('path') || '';
    loadDirectory().catch((error) => showDialog('No se pudo abrir la carpeta', error.message));
  });

  loadDirectory().catch((error) => {
    statusMessage.textContent = error.message;
    emptyState.hidden = false;
    emptyState.textContent = 'No se pudo cargar la carpeta solicitada.';
  });
}

function setUpProjectApproval() {
  projectAcceptButton?.addEventListener('click', async () => {
    if (!pendingProjectInspection) return;
    projectAcceptButton.disabled = true;
    try {
      const approval = await apiRequest('/api/projects/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          path: pendingProjectInspection.path,
          hash: pendingProjectInspection.hash
        })
      });
      pendingProjectInspection.approved = true;
      pendingProjectInspection.approvedBy = approval.approvedBy;
      pendingProjectInspection.approvedAt = approval.approvedAt;
      projectAcceptButton.hidden = true;
      projectPreviewButton?.toggleAttribute('hidden', !pendingProjectInspection.entryPoint);
      projectRunButton?.toggleAttribute('hidden', !pendingProjectInspection.isSlq);
      document.querySelector('#dialog-title').textContent = 'Proyecto certificado con slqaccept';
      document.querySelector('#dialog-content').textContent =
        `${approval.path}\nAprobado por: ${approval.approvedBy}\nSHA-256: ${approval.hash}\n\nSi cambia cualquier archivo incluido en el análisis, la certificación deja de ser válida.`;
    } catch (error) {
      document.querySelector('#dialog-title').textContent = 'No se pudo certificar el proyecto';
      document.querySelector('#dialog-content').textContent = error.message;
      if (error.message.includes('cambió después del análisis')) {
        pendingProjectInspection = null;
        projectAcceptButton.hidden = true;
      }
    } finally {
      projectAcceptButton.disabled = false;
    }
  });

  projectPreviewButton?.addEventListener('click', () => {
    if (!pendingProjectInspection?.approved || !pendingProjectInspection.entryPoint) return;
    const entryPoint = pendingProjectInspection.entryPoint
      .split('/')
      .map(encodeURIComponent)
      .join('/');
    window.open(`/proyectos/${entryPoint}`, '_blank', 'noopener');
  });

  projectEditorButton?.addEventListener('click', () => {
    if (!pendingProjectInspection?.editorUrl) return;
    window.location.assign(pendingProjectInspection.editorUrl);
  });

  projectRunButton?.addEventListener('click', async () => {
    if (!pendingProjectInspection?.approved || !pendingProjectInspection.isSlq) return;
    if (!window.confirm(
      `¿Ejecutar ${pendingProjectInspection.path}?\n\nEl script SlQ puede ejecutar comandos y modificar este sistema. Continúa solo si revisaste y confías en el contenido aprobado.`
    )) return;
    projectRunButton.disabled = true;
    try {
      const result = await apiRequest('/api/projects/run-slq', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: pendingProjectInspection.path })
      });
      showDialog(`Salida de ${pendingProjectInspection.path}`, result.output || 'El script terminó sin salida.');
    } catch (error) {
      showDialog('No se pudo ejecutar el script SlQ', error.message);
    } finally {
      projectRunButton.disabled = false;
    }
  });
}

async function renderScripts() {
  const scripts = await apiRequest('/api/manage/scripts');
  fileGrid.replaceChildren();
  const query = searchInput.value.trim().toLocaleLowerCase();
  const visibleScripts = scripts.filter((script) => script.name.toLocaleLowerCase().includes(query));
  for (const script of visibleScripts) {
    const card = document.createElement('article');
    card.className = 'file-card';
    const preview = document.createElement('div');
    preview.className = 'file-preview';
    preview.textContent = '</>';
    const info = document.createElement('div');
    info.className = 'file-info';
    const name = document.createElement('span');
    name.className = 'file-name';
    name.textContent = script.name;
    const size = document.createElement('span');
    size.className = 'file-meta';
    size.textContent = formatSize(script.size);
    info.append(name, size);
    const actions = document.createElement('div');
    actions.className = 'file-actions';
    const openLink = document.createElement('a');
    openLink.className = 'file-button';
    openLink.textContent = 'Abrir';
    openLink.href = `/${encodeURIComponent(script.name)}`;
    openLink.target = '_blank';
    openLink.rel = 'noopener';
    actions.append(openLink);
    const runButton = document.createElement('button');
    runButton.type = 'button';
    runButton.className = 'file-button run-button';
    runButton.textContent = 'Ejecutar';
    runButton.addEventListener('click', async () => {
      const confirmed = window.confirm(`¿Ejecutar ${script.name}?\n\nLos scripts SlQ pueden ejecutar comandos del sistema y modificar archivos.`);
      if (!confirmed) return;
      runButton.disabled = true;
      statusMessage.textContent = `Ejecutando ${script.name}…`;
      try {
        const result = await apiRequest('/api/manage/run-script', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: script.name })
        });
        showDialog(`Salida de ${script.name}`, result.output || 'El script terminó sin salida.');
        statusMessage.textContent = `${script.name} finalizado.`;
      } catch (error) {
        showDialog('No se pudo ejecutar el script', error.message);
        statusMessage.textContent = error.message;
      } finally {
        runButton.disabled = false;
      }
    });
    actions.append(runButton);
    card.append(preview, info, actions);
    fileGrid.append(card);
  }
  emptyState.hidden = visibleScripts.length > 0;
  fileGrid.hidden = false;
  emptyState.textContent = query ? 'No hay scripts que coincidan con la búsqueda.' : 'No hay scripts .slq disponibles en la raíz.';
  statusMessage.textContent = `${visibleScripts.length} script${visibleScripts.length === 1 ? '' : 's'} disponible${visibleScripts.length === 1 ? '' : 's'}.`;
}

async function loadData() {
  try {
    catalog = await apiRequest('/api/files', { headers: { Accept: 'application/json' } });
    if (homeGrid) {
      statusMessage.textContent = 'Elige una categoría para ver y administrar su contenido.';
      renderHome();
      await loadApplications();
    } else if (linkPage) {
      setUpLinksPage();
    } else if (page?.dataset.category === 'scripts') {
      await renderScripts();
      searchInput.addEventListener('input', () => renderScripts().catch((error) => {
        statusMessage.textContent = error.message;
      }));
    } else if (page && fileGrid && searchInput && statusMessage && emptyState) {
      setUpFileManager();
      if (page.dataset.category === 'proyectos') setUpProjectApproval();
    }
  } catch (error) {
    statusMessage.textContent = `No se pudo cargar el contenido: ${error.message}`;
    if (homeGrid) homeGrid.textContent = 'Verifica la sesión y vuelve a cargar la página.';
    if (fileGrid) fileGrid.textContent = 'Verifica la sesión y vuelve a cargar la página.';
  }
}

document.addEventListener('keydown', (event) => {
  if (event.key === '/' && searchInput && !['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) {
    event.preventDefault();
    searchInput.focus();
  }
});

loadData();
