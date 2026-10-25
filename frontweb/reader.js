const article = document.querySelector('#markdown-document');
const statusMessage = document.querySelector('#reader-status');

function appendInline(parent, text) {
  const pattern = /(\*\*[^*]+\*\*|`[^`]+`|\*[^*]+\*|\[[^\]]+\]\([^)]+\))/g;
  let position = 0;
  for (const match of text.matchAll(pattern)) {
    parent.append(document.createTextNode(text.slice(position, match.index)));
    const token = match[0];
    let element;
    if (token.startsWith('**')) {
      element = document.createElement('strong');
      element.textContent = token.slice(2, -2);
    } else if (token.startsWith('`')) {
      element = document.createElement('code');
      element.textContent = token.slice(1, -1);
    } else if (token.startsWith('*')) {
      element = document.createElement('em');
      element.textContent = token.slice(1, -1);
    } else {
      const linkMatch = token.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
      let url;
      try {
        url = new URL(linkMatch[2], location.origin);
      } catch (_error) {
        parent.append(document.createTextNode(linkMatch[1]));
        position = match.index + token.length;
        continue;
      }
      if (!['http:', 'https:', 'mailto:'].includes(url.protocol)) {
        parent.append(document.createTextNode(linkMatch[1]));
        position = match.index + token.length;
        continue;
      }
      element = document.createElement('a');
      element.href = url.href;
      element.textContent = linkMatch[1];
      if (url.origin !== location.origin) {
        element.target = '_blank';
        element.rel = 'noopener noreferrer';
      }
    }
    parent.append(element);
    position = match.index + token.length;
  }
  parent.append(document.createTextNode(text.slice(position)));
}

function renderMarkdown(markdown) {
  article.replaceChildren();
  const lines = markdown.replace(/\r\n?/g, '\n').split('\n');
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];
    if (!line.trim()) {
      index += 1;
      continue;
    }

    if (line.startsWith('```')) {
      const codeLines = [];
      index += 1;
      while (index < lines.length && !lines[index].startsWith('```')) {
        codeLines.push(lines[index]);
        index += 1;
      }
      if (index < lines.length) index += 1;
      const pre = document.createElement('pre');
      const code = document.createElement('code');
      code.textContent = codeLines.join('\n');
      pre.append(code);
      article.append(pre);
      continue;
    }

    const heading = line.match(/^(#{1,6})\s+(.+?)\s*#*$/);
    if (heading) {
      const element = document.createElement(`h${heading[1].length}`);
      appendInline(element, heading[2]);
      article.append(element);
      index += 1;
      continue;
    }

    if (/^\s*([-*_])(?:\s*\1){2,}\s*$/.test(line)) {
      article.append(document.createElement('hr'));
      index += 1;
      continue;
    }

    const listMatch = line.match(/^\s*(?:([-*+])|(\d+)\.)\s+(.+)$/);
    if (listMatch) {
      const ordered = Boolean(listMatch[2]);
      const list = document.createElement(ordered ? 'ol' : 'ul');
      while (index < lines.length) {
        const item = lines[index].match(/^\s*(?:([-*+])|(\d+)\.)\s+(.+)$/);
        if (!item || Boolean(item[2]) !== ordered) break;
        const li = document.createElement('li');
        appendInline(li, item[3]);
        list.append(li);
        index += 1;
      }
      article.append(list);
      continue;
    }

    if (/^\s*&gt;\s?/.test(line) || /^\s*>\s?/.test(line)) {
      const quote = document.createElement('blockquote');
      while (index < lines.length && /^\s*>\s?/.test(lines[index])) {
        const paragraph = document.createElement('p');
        appendInline(paragraph, lines[index].replace(/^\s*>\s?/, ''));
        quote.append(paragraph);
        index += 1;
      }
      article.append(quote);
      continue;
    }

    const paragraph = document.createElement('p');
    appendInline(paragraph, line);
    index += 1;
    while (index < lines.length && lines[index].trim() &&
        !/^(#{1,6})\s+/.test(lines[index]) &&
        !/^\s*(?:[-*+]|\d+\.)\s+/.test(lines[index]) &&
        !lines[index].startsWith('```') &&
        !/^\s*>/.test(lines[index])) {
      paragraph.append(document.createTextNode(' '));
      appendInline(paragraph, lines[index]);
      index += 1;
    }
    article.append(paragraph);
  }
}

async function loadDocument() {
  const relativePath = new URLSearchParams(location.search).get('path');
  if (!relativePath) throw new Error('No se especificó el documento que se desea leer.');
  const query = new URLSearchParams({ category: 'documentos', path: relativePath });
  const response = await fetch(`/api/manage/markdown?${query}`);
  if (response.status === 401) throw new Error('Sesión no autorizada. Recarga la página e inicia sesión.');
  if (!response.ok) {
    const result = await response.json().catch(() => ({}));
    throw new Error(result.error || `No se pudo cargar el documento (${response.status}).`);
  }
  const documentData = await response.json();
  document.title = `${documentData.name} | SlQ-OS Frontweb`;
  renderMarkdown(documentData.content);
  statusMessage.textContent = documentData.name;
}

loadDocument().catch((error) => {
  statusMessage.textContent = error.message;
  statusMessage.classList.add('reader-error');
});
