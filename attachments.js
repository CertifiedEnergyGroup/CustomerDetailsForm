const imageExtensions = /\.(avif|bmp|gif|heic|heif|ico|jpe?g|png|svg|tiff?|webp)$/i;
const videoExtensions = /\.(mp4|m4v|mov|webm|mkv|avi|mpeg|mpg|3gp|ogv)$/i;
export function fileKind(file) {
  if (file.type?.startsWith('image/')) return 'image';
  if (file.type?.startsWith('video/')) return 'video';
  if (file.type === 'application/pdf') return 'pdf';
  // Some file pickers omit MIME type or report a generic binary type.
  if (!file.type || file.type === 'application/octet-stream') {
    if (imageExtensions.test(file.name)) return 'image';
    if (videoExtensions.test(file.name)) return 'video';
    if (/\.pdf$/i.test(file.name)) return 'pdf';
  }
  return null;
}
export function fileSize(size) {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  if (size < 1024 * 1024 * 1024) return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  return `${(size / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}
export function mountAttachments({zone, picker, grid, summary, message, onChange}) {
  let records = [], nextId = 0, busy = false;
  const update = () => {
    const size = records.reduce((total, record) => total + record.file.size, 0);
    summary.textContent = records.length ? `${records.length} file${records.length === 1 ? '' : 's'} · ${fileSize(size)}` : '';
    onChange(records.length);
  };
  function remove(record) {
    if (busy) return;
    records = records.filter(item => item !== record);
    record.card.remove();
    // Stop active video/PDF resources before revoking their preview URL.
    record.card.replaceChildren();
    URL.revokeObjectURL(record.url);
    update();
  }
  function cardFor(record) {
    const card = document.createElement('article');
    card.className = 'attachment-card';
    const preview = document.createElement('div');
    preview.className = 'attachment-preview';
    const fallback = document.createElement('span');
    fallback.className = 'attachment-fallback';
    fallback.textContent = record.kind === 'pdf' ? 'PDF' : 'Preview unavailable';
    preview.append(fallback);
    let media;
    if (record.kind === 'image') {
      media = document.createElement('img');
      media.alt = record.file.name; media.loading = 'lazy';
    } else if (record.kind === 'video') {
      media = document.createElement('video');
      media.controls = true; media.preload = 'metadata'; media.playsInline = true;
      media.setAttribute('aria-label', record.file.name);
    } else {
      media = document.createElement('iframe');
      media.title = `PDF preview: ${record.file.name}`; media.loading = 'lazy';
    }
    media.src = record.url + (record.kind === 'pdf' ? '#page=1&toolbar=0&navpanes=0' : '');
    media.addEventListener('error', () => { media.hidden = true; });
    preview.append(media);
    const info = document.createElement('div');
    info.className = 'attachment-info';
    const name = document.createElement('div');
    name.className = 'attachment-name'; name.textContent = record.file.name; name.title = record.file.name;
    const size = document.createElement('small'); size.textContent = fileSize(record.file.size);
    const actions = document.createElement('div'); actions.className = 'attachment-actions';
    const open = document.createElement('a');
    open.textContent = 'Open'; open.href = record.url; open.target = '_blank'; open.rel = 'noopener noreferrer';
    open.setAttribute('aria-label', `Open ${record.file.name}`);
    const removeButton = document.createElement('button');
    removeButton.type = 'button'; removeButton.textContent = 'Remove';
    removeButton.setAttribute('aria-label', `Remove ${record.file.name}`);
    removeButton.onclick = () => remove(record);
    actions.append(open, removeButton); info.append(name, size, actions); card.append(preview, info);
    return card;
  }
  function add(files) {
    if (busy) return;
    const rejected = [];
    for (const file of files) {
      const kind = fileKind(file);
      if (!kind) { rejected.push(file.name); continue; }
      const record = {id: ++nextId, file, kind, url: URL.createObjectURL(kind === 'pdf' ? file.slice(0, file.size, 'application/pdf') : file)};
      record.card = cardFor(record); records.push(record); grid.append(record.card);
    }
    picker.value = '';
    message.textContent = rejected.length ? `Unsupported file type: ${rejected.join(', ')}. Choose images, PDFs or videos.` : '';
    update();
  }
  zone.onclick = () => { if (!busy) picker.click(); };
  picker.addEventListener('change', () => add(picker.files));
  let dragDepth = 0;
  zone.addEventListener('dragenter', event => { event.preventDefault(); dragDepth++; if (!busy) zone.classList.add('dragover'); });
  zone.addEventListener('dragover', event => { event.preventDefault(); if (event.dataTransfer) event.dataTransfer.dropEffect = busy ? 'none' : 'copy'; });
  zone.addEventListener('dragleave', event => { event.preventDefault(); if (--dragDepth <= 0) { dragDepth = 0; zone.classList.remove('dragover'); } });
  zone.addEventListener('drop', event => {
    event.preventDefault(); dragDepth = 0; zone.classList.remove('dragover');
    add([...(event.dataTransfer?.files || [])]);
  });
  // Prevent a missed drop from navigating away and losing the current form.
  for (const type of ['dragover', 'drop']) document.addEventListener(type, event => {
    if ([...(event.dataTransfer?.types || [])].includes('Files')) event.preventDefault();
  });
  update();
  return {
    files: () => records.map(record => record.file),
    clear() { for (const record of [...records]) remove(record); message.textContent = ''; picker.value = ''; },
    setBusy(value) {
      busy = value; zone.disabled = value; picker.disabled = value;
      grid.querySelectorAll('button').forEach(button => { button.disabled = value; });
    }
  };
}
