// Explicit popup rather than native datalist UI: browsers differ on whether
// datalist suggestions open on focus, first click, or a subsequent click.
export function filterOptions(options, query) {
  const terms = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  return options.filter(option => terms.every(term =>
    `${option.value} ${option.label}`.toLocaleLowerCase().includes(term)));
}
let closeActive = () => {};
export function attachCombobox(input, source) {
  input.removeAttribute('list');
  input.autocomplete = 'off';
  input.classList.add('combobox-input');
  input.setAttribute('role', 'combobox');
  input.setAttribute('aria-autocomplete', 'list');
  input.setAttribute('aria-haspopup', 'listbox');
  input.setAttribute('aria-expanded', 'false');
  const popup = document.createElement('div');
  popup.id = `${input.id}Listbox`;
  popup.className = 'combobox-popup';
  popup.setAttribute('role', 'listbox');
  popup.setAttribute('aria-label', input.labels?.[0]?.textContent || 'Suggestions');
  popup.hidden = true;
  document.body.append(popup);
  input.setAttribute('aria-controls', popup.id);
  let matches = [], active = -1, showAll = true;
  const close = () => {
    popup.hidden = true;
    active = -1;
    input.setAttribute('aria-expanded', 'false');
    input.removeAttribute('aria-activedescendant');
  };
  const position = () => {
    if (popup.hidden) return;
    const rect = input.getBoundingClientRect();
    const height = window.visualViewport?.height || window.innerHeight;
    const below = height - rect.bottom - 8;
    const above = rect.top - 8;
    const flip = below < 160 && above > below;
    popup.style.left = `${rect.left}px`;
    popup.style.width = `${rect.width}px`;
    popup.style.maxHeight = `${Math.max(60, Math.min(280, flip ? above : below))}px`;
    popup.style.top = flip ? 'auto' : `${rect.bottom + 4}px`;
    popup.style.bottom = flip ? `${window.innerHeight - rect.top + 4}px` : 'auto';
  };
  const highlight = index => {
    active = index;
    [...popup.children].forEach((item, i) => item.setAttribute('aria-selected', String(i === active)));
    if (active >= 0) {
      const item = popup.children[active];
      input.setAttribute('aria-activedescendant', item.id);
      item.scrollIntoView({block: 'nearest'});
    } else input.removeAttribute('aria-activedescendant');
  };
  const choose = index => {
    input.value = matches[index].value;
    close();
    input.dispatchEvent(new Event('input', {bubbles: true}));
    input.dispatchEvent(new Event('change', {bubbles: true}));
    // The input event can open suggestions; selection should close them.
    close();
  };
  const render = () => {
    const options = [...source.options].map(option => ({value: option.value, label: option.label || option.textContent || option.value}));
    matches = showAll ? options : filterOptions(options, input.value);
    active = -1;
    input.removeAttribute('aria-activedescendant');
    popup.replaceChildren();
    matches.forEach((option, index) => {
      const row = document.createElement('div');
      row.id = `${popup.id}-${index}`;
      row.setAttribute('role', 'option');
      row.setAttribute('aria-selected', 'false');
      row.textContent = option.label;
      row.addEventListener('pointermove', () => highlight(index));
      row.addEventListener('click', () => choose(index));
      popup.append(row);
    });
    if (!matches.length) {
      const empty = document.createElement('div');
      empty.className = 'combobox-empty';
      empty.textContent = 'No matches. You can use a custom entry.';
      popup.append(empty);
    }
    position();
  };
  const open = all => {
    if (input.disabled) return;
    closeActive();
    closeActive = close;
    showAll = all;
    popup.hidden = false;
    input.setAttribute('aria-expanded', 'true');
    render();
  };
  // Focus handles keyboard navigation; click also reopens an already-focused
  // input. Neither needs a second click or typed character.
  input.addEventListener('focus', () => open(true));
  input.addEventListener('click', () => open(true));
  input.addEventListener('input', () => open(false));
  input.addEventListener('blur', close);
  // Capture Enter before the multi-entry field's handler adds a custom value.
  input.addEventListener('keydown', event => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      if (popup.hidden) open(true);
      if (matches.length) highlight(event.key === 'ArrowDown' ? (active + 1) % matches.length : (active < 0 ? matches.length - 1 : (active - 1 + matches.length) % matches.length));
    } else if (event.key === 'Enter' && !popup.hidden && active >= 0) {
      event.preventDefault();
      event.stopImmediatePropagation();
      choose(active);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      close();
    } else if (event.key === 'Tab' || event.key === 'Enter') close();
  }, true);
  // Retain input focus while clicking a suggestion, so blur cannot hide it
  // before the click arrives. Touch scrolling remains native.
  popup.addEventListener('mousedown', event => event.preventDefault());
  document.addEventListener('pointerdown', event => {
    if (event.target !== input && !popup.contains(event.target)) close();
  });
  window.addEventListener('resize', position);
  window.addEventListener('scroll', position, true);
  window.visualViewport?.addEventListener('resize', position);
  new MutationObserver(() => { if (!popup.hidden) render(); }).observe(source, {childList: true, subtree: true});
}
