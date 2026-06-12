export class NycssDropdown extends HTMLElement {
  static observedAttributes = ['value', 'label', 'disabled'];

  get value() { return this.getAttribute('value') || ''; }
  set value(v) { this.setAttribute('value', v); }
  get disabled() { return this.hasAttribute('disabled'); }
  set disabled(v) { v ? this.setAttribute('disabled', '') : this.removeAttribute('disabled'); }

  connectedCallback() {
    this.classList.add('dropdown');
    this.setAttribute('role', 'combobox');
    this.setAttribute('aria-haspopup', 'listbox');
    this.setAttribute('aria-expanded', 'false');
    const id = this._uid();
    const cbId = this.id ? `${this.id}-checkbox` : `${id}-cb`;
    const listId = this.id ? `${this.id}-listbox` : `${id}-listbox`;
    const labelId = this.id ? `${this.id}-label` : '';
    this.setAttribute('aria-controls', listId);
    this.innerHTML = `
      <input type="checkbox" id="${cbId}" class="dropdown-toggle" aria-hidden="true" tabindex="-1">
      <output role="button" tabindex="0" aria-haspopup="listbox" aria-expanded="false" aria-controls="${listId}"${labelId ? ` aria-labelledby="${labelId}"` : ''} class="dropdown-output">${this.value || this.querySelector('[role="option"]')?.textContent || ''}</output>
      <ul hidden id="${listId}" class="dropdown-list" role="listbox"${labelId ? ` aria-labelledby="${labelId}"` : ''}>
        ${this._renderItems()}
      </ul>
    `;

    this.output = this.querySelector('.dropdown-output');
    this.list = this.querySelector('.dropdown-list');
    this.toggle = this.querySelector('.dropdown-toggle');
    this.items = this.querySelectorAll('[role="option"]');

    this._initSelection();

    this.output.addEventListener('click', () => {
      if (this.disabled) return;
      this.toggle.checked = !this.toggle.checked;
      this._syncToggle();
    });

    this.output.addEventListener('keydown', (e) => {
      if (this.disabled) return;
      if (e.key === ' ' || e.key === 'Enter' || e.key === 'ArrowDown') {
        e.preventDefault();
        this.toggle.checked = true;
        this._syncToggle();
      }
      if (e.key === 'Escape' || e.key === 'ArrowUp') {
        e.preventDefault();
        this.toggle.checked = false;
        this._syncToggle();
      }
    });

    this.output.addEventListener('blur', () => {
      setTimeout(() => {
        if (!this.contains(document.activeElement)) {
          this.toggle.checked = false;
          this._syncToggle();
        }
      }, 150);
    });

    this.items.forEach((item) => {
      item.setAttribute('tabindex', '-1');
      item.addEventListener('click', () => this._select(item));
    });

    this.toggle.addEventListener('change', (e) => { e.stopPropagation(); this._syncToggle(); });

    this.list.addEventListener('mousedown', (e) => {
      if (e.target === this.list) e.preventDefault();
    });

    this.list.addEventListener('keydown', (e) => {
      const active = this.list.querySelector('[aria-selected="true"]') || this.items[0];
      const idx = Array.from(this.items).indexOf(active);
      let next = -1;
      if (e.key === 'ArrowDown') { e.preventDefault(); next = (idx + 1) % this.items.length; }
      if (e.key === 'ArrowUp') { e.preventDefault(); next = idx <= 0 ? this.items.length - 1 : idx - 1; }
      if (e.key === 'Home') { e.preventDefault(); next = 0; }
      if (e.key === 'End') { e.preventDefault(); next = this.items.length - 1; }
      if (next >= 0) {
        this._highlight(next);
      }
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        this._select(active);
      }
      if (e.key === 'Escape') {
        this.toggle.checked = false;
        this._syncToggle();
        this.output.focus();
      }
    });

    this.addEventListener('focusout', () => {
      setTimeout(() => {
        if (!this.contains(document.activeElement)) {
          this.toggle.checked = false;
          this._syncToggle();
        }
      }, 0);
    });

    this._updateDisabled();
  }

  _renderItems() {
    return Array.from(this.children).map((child, i) => {
      const value = child.getAttribute('value') || child.textContent.trim();
      const itemId = this.id ? `${this.id}-option-${i + 1}` : `opt-${this._uid()}-${i}`;
      const selected = value === this.value || (!this.value && i === 0);
      return `<li id="${itemId}" role="option" tabindex="-1" value="${value}"${selected ? ' aria-selected="true"' : ''}>${child.innerHTML}</li>`;
    }).join('');
  }

  _initSelection() {
    if (this.value) {
      const match = Array.from(this.items).find(el => (el.getAttribute('value') || el.textContent.trim()) === this.value);
      if (match) {
        this.output.textContent = match.textContent.trim();
        this.items.forEach(i => i.removeAttribute('aria-selected'));
        match.setAttribute('aria-selected', 'true');
        this._updateActiveDescendant();
      }
    } else {
      const first = this.items[0];
      if (first) {
        first.setAttribute('aria-selected', 'true');
        this.value = first.getAttribute('value') || first.textContent.trim();
        this.output.textContent = first.textContent.trim();
        this._updateActiveDescendant();
      }
    }
  }

  _syncToggle() {
    const opened = this.toggle.checked;
    this.list.hidden = !opened;
    this.output.setAttribute('aria-expanded', opened);
    this.setAttribute('aria-expanded', opened);
    if (opened) {
      const sel = this.list.querySelector('[aria-selected="true"]') || this.items[0];
      if (sel) sel.focus();
    }
  }

  _highlight(idx) {
    this.items.forEach(i => i.removeAttribute('aria-selected'));
    this.items[idx].setAttribute('aria-selected', 'true');
    this.items[idx].focus();
    this._updateActiveDescendant();
  }

  _updateActiveDescendant() {
    const sel = this.list.querySelector('[aria-selected="true"]') || this.items[0];
    if (sel && sel.id) {
      this.output.setAttribute('aria-activedescendant', sel.id);
    }
  }

  attributeChangedCallback(name, _, newVal) {
    if (name === 'value' && this.output) {
      const item = Array.from(this.items).find(el => (el.getAttribute('value') || el.textContent.trim()) === newVal);
      if (item) {
        this.output.textContent = item.textContent.trim();
        this.items.forEach(i => i.removeAttribute('aria-selected'));
        item.setAttribute('aria-selected', 'true');
        this._updateActiveDescendant();
      }
    }
    if (name === 'disabled') {
      this._updateDisabled();
    }
  }

  _updateDisabled() {
    if (this.disabled) {
      this.setAttribute('aria-disabled', 'true');
      this.output?.setAttribute('aria-disabled', 'true');
      this.output?.setAttribute('tabindex', '-1');
    } else {
      this.removeAttribute('aria-disabled');
      this.output?.removeAttribute('aria-disabled');
      this.output?.setAttribute('tabindex', '0');
    }
  }

  _select(item) {
    const val = item.getAttribute('value') || item.textContent.trim();
    this.value = val;
    this.output.textContent = item.textContent.trim();
    this.items.forEach(i => i.removeAttribute('aria-selected'));
    item.setAttribute('aria-selected', 'true');
    this._updateActiveDescendant();
    this.toggle.checked = false;
    this._syncToggle();
    this.output.focus();
    this.dispatchEvent(new CustomEvent('change', { detail: val }));
  }

  _uid() { return `dd-${Math.random().toString(36).slice(2, 8)}`; }
}

customElements.define('nycss-dropdown', NycssDropdown);
