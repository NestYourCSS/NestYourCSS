export function bindCheckbox(store, key, inputEl) {
  store._subscribe(key, (value) => {
    inputEl.checked = value;
  });
  inputEl.addEventListener('change', () => {
    store[key] = inputEl.checked;
  });
}

export function bindRadioGroup(store, key, containerEl) {
  const radios = containerEl.querySelectorAll('[type="radio"]');
  store._subscribe(key, (value) => {
    if (radios[value]) radios[value].checked = true;
  });
  containerEl.addEventListener('change', (e) => {
    if (e.target?.matches('[type="radio"]')) {
      const idx = Array.from(radios).indexOf(e.target);
      if (idx >= 0) store[key] = idx;
    }
  });
}

export function bindNumberStepper(store, key, displayEl, upBtn, downBtn) {
  store._subscribe(key, (value) => {
    displayEl.value = value;
    adjustInputWidth(displayEl);
  });
  displayEl.addEventListener('input', () => {
    const v = Math.max(0, Math.min(+displayEl.value || 0, 99999));
    store[key] = v;
  });
  displayEl.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowUp') { e.preventDefault(); store[key] = Math.min((store[key] || 0) + 1, 99999); }
    if (e.key === 'ArrowDown') { e.preventDefault(); store[key] = Math.max(0, (store[key] || 0) - 1); }
  });
  if (upBtn) {
    upBtn.addEventListener('click', () => store[key] = Math.min((store[key] || 0) + 1, 99999));
  }
  if (downBtn) {
    downBtn.addEventListener('click', () => store[key] = Math.max(0, (store[key] || 0) - 1));
  }
}

export function bindDropdown(store, key, listEl, outputEl) {
  store._subscribe(key, (value) => {
    const items = Array.from(listEl.children);
    const match = items.find(el => el.textContent.trim() === value || el.getAttribute('value') === value);
    if (match) {
      outputEl.textContent = match.textContent;
      items.forEach(el => el.removeAttribute('aria-selected'));
      match.setAttribute('aria-selected', 'true');
    }
  });
  listEl.addEventListener('click', (e) => {
    const item = e.target.closest('[role="option"]');
    if (item) store[key] = item.getAttribute('value') || item.textContent.trim();
  });
}

export function bindCombobox(store, key, listEl, outputEl, inputCheckbox) {
  store._subscribe(key, (value) => {
    outputEl.textContent = value;
  });
  listEl.addEventListener('click', (e) => {
    const item = e.target.closest('[role="option"]');
    if (item) {
      const val = item.textContent.trim();
      outputEl.textContent = val;
      store[key] = val;
      if (inputCheckbox) inputCheckbox.checked = false;
    }
  });
}

export function adjustInputWidth(displayEl) {
  const ts = document.createElement('span');
  ts.style.visibility = 'hidden';
  ts.style.whiteSpace = 'pre';
  ts.style.font = window.getComputedStyle(displayEl).font;
  ts.textContent = displayEl.value || displayEl.placeholder || '0';
  document.body.appendChild(ts);
  const w = ts.getBoundingClientRect().width;
  document.body.removeChild(ts);
  displayEl.style.width = `calc(1ch + ${w}px)`;
}
