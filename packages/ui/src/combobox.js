export class NycssCombobox extends HTMLElement {
  static observedAttributes = ['value', 'label', 'placeholder'];

  get value() { return this.getAttribute('value') || ''; }
  set value(v) { this.setAttribute('value', v); }
  get placeholder() { return this.getAttribute('placeholder') || ''; }

  connectedCallback() {
    this.classList.add('combobox');
    this.setAttribute('role', 'combobox');
    this.setAttribute('aria-haspopup', 'listbox');
    this.setAttribute('aria-expanded', 'false');
    const id = this._uid();
    const placeholder = this.placeholder;
    const cbId = this.id ? `${this.id}-checkbox` : `${id}-cb`;
    const listId = this.id ? `${this.id}-listbox` : `${id}-list`;
    const inputId = this.id ? `${this.id}-input` : `${id}-input`;
    this.setAttribute('aria-owns', listId);
    const labelId = this.id ? `${this.id}-label` : '';
    this.innerHTML = `
      <input type="checkbox" id="${cbId}" class="combobox-toggle-cb" aria-hidden="true" tabindex="-1">
      <output>
        <div contenteditable="true" placeholder="${placeholder}" class="combobox-input" id="${inputId}" role="textbox"${labelId ? ` aria-labelledby="${labelId}"` : ''} aria-autocomplete="list" aria-controls="${listId}" aria-activedescendant="" tabindex="-1"></div>
      </output>
      <ul hidden id="${listId}" class="combobox-list" role="listbox"${labelId ? ` aria-labelledby="${labelId}"` : ''}>
        ${this._renderItems()}
      </ul>
    `;

    this.input = this.querySelector('.combobox-input');
    this.list = this.querySelector('.combobox-list');
    this.output = this.querySelector('output');
    this.toggleCb = this.querySelector('.combobox-toggle-cb');
    this.items = this.querySelectorAll('[role="option"]');

    this.items.forEach((item, i) => {
      item.setAttribute('tabindex', '-1');
      if (!this.value && i === 0) item.setAttribute('aria-selected', 'true');
      item.addEventListener('click', () => this._commit(item.textContent.trim()));
    });

    if (!this.value && this.items.length) {
      this.value = this.items[0].textContent.trim();
    }

    this.list.addEventListener('mousedown', (e) => {
      if (e.target === this.list) e.preventDefault();
    });

    this.input.addEventListener('input', () => {
      if (this.input.innerText.includes('\n')) {
        this.input.textContent = this.input.textContent.replace(/\n/g, '');
        const sel = window.getSelection();
        if (sel && this.input.lastChild) sel.collapse(this.input.lastChild, this.input.lastChild.length || 0);
      }
    });

    this.input.addEventListener('paste', (e) => {
      e.preventDefault();
      const text = (e.clipboardData || window.clipboardData).getData('text');
      document.execCommand('insertText', false, text);
    });

    this.input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        const val = this.input.textContent.trim();
        if (val) this._commit(val);
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        this._open();
        this._highlightNext(1);
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (this.list.hidden) {
          this._open();
          this._highlightNext(-1);
        } else {
          this._highlightNext(-1);
        }
      }
      if (e.key === 'Escape') {
        this._close();
        this.input.focus();
      }
      if (e.key === 'Home') {
        e.preventDefault();
        if (!this.list.hidden) this._highlight(0);
      }
      if (e.key === 'End') {
        e.preventDefault();
        if (!this.list.hidden) this._highlight(this.items.length - 1);
      }
    });

    this.output.addEventListener('click', () => {
      this.toggleCb.checked = !this.toggleCb.checked;
      this._syncToggle();
    });

    this.output.addEventListener('keydown', (e) => {
      if (e.key === ' ' || e.key === 'Enter' || e.key === 'ArrowDown') {
        e.preventDefault();
        this._open();
      }
      if (e.key === 'Escape' || e.key === 'ArrowUp') {
        e.preventDefault();
        this._close();
      }
    });

    this.input.addEventListener('focus', () => {
      this.setAttribute('data-focus', '');
    });

    this.input.addEventListener('blur', () => {
      this.removeAttribute('data-focus');
      setTimeout(() => {
        if (!this.contains(document.activeElement)) {
          this.toggleCb.checked = false;
          this._syncToggle();
        }
      }, 150);
    });

    this.output.addEventListener('blur', (e) => {
      setTimeout(() => {
        if (!this.contains(document.activeElement)) {
          this.toggleCb.checked = false;
          this._syncToggle();
        }
      }, 150);
    });

    this.toggleCb.addEventListener('change', (e) => { e.stopPropagation(); this._syncToggle(); });

    if (this.value) {
      this.input.textContent = this.value;
    }

    this.addEventListener('focusout', () => {
      setTimeout(() => {
        if (!this.contains(document.activeElement)) {
          this.toggleCb.checked = false;
          this._syncToggle();
        }
      }, 0);
    });
  }

  _renderItems() {
    return Array.from(this.children).map((child, i) => {
      const itemId = this.id ? `${this.id}-option-${i + 1}` : `opt-${this._uid()}-${i}`;
      const text = child.textContent.trim();
      const selected = text === this.value || (!this.value && i === 0);
      return `<li id="${itemId}" role="option" tabindex="-1"${selected ? ' aria-selected="true"' : ''}>${text}</li>`;
    }).join('');
  }

  _syncToggle() {
    const opened = this.toggleCb.checked;
    this.list.hidden = !opened;
    this.setAttribute('aria-expanded', opened);
    if (opened) {
      const sel = this.list.querySelector('[aria-selected="true"]') || this.items[0];
      if (sel) sel.focus();
    }
  }

  _open() {
    this.toggleCb.checked = true;
    this._syncToggle();
  }

  _close() {
    this.toggleCb.checked = false;
    this._syncToggle();
    this.removeAttribute('aria-activedescendant');
  }

  _highlight(idx) {
    this.items.forEach(i => i.removeAttribute('aria-selected'));
    this.items[idx].setAttribute('aria-selected', 'true');
    this.items[idx].focus();
  }

  _highlightNext(dir) {
    const activeIdx = Array.from(this.items).findIndex(i => i.getAttribute('aria-selected') === 'true');
    const next = ((activeIdx + dir) % this.items.length + this.items.length) % this.items.length;
    this._highlight(next);
  }

  addRecent(value) {
    const existing = Array.from(this.items).find(el => el.textContent === value);
    if (existing) return;
    if (this.items.length >= 5) this.list.lastElementChild.remove();
    this.items = this.querySelectorAll('[role="option"]');
    const el = document.createElement('li');
    el.role = 'option';
    el.tabIndex = -1;
    el.textContent = value;
    el.addEventListener('click', () => this._commit(value));
    this.list.insertAdjacentElement('afterbegin', el);
    this.items = this.querySelectorAll('[role="option"]');
  }

  _commit(val) {
    this.value = val;
    this.input.textContent = val;
    this.dispatchEvent(new CustomEvent('change', { detail: val }));
    this.toggleCb.checked = false;
    this._syncToggle();
  }

  attributeChangedCallback(name, _, newVal) {
    if (name === 'value' && this.input) {
      this.input.textContent = newVal || '';
    }
    if (name === 'placeholder' && this.input) {
      this.input.setAttribute('placeholder', newVal || '');
    }
  }

  _uid() { return `cbx-${Math.random().toString(36).slice(2, 8)}`; }
}

customElements.define('nycss-combobox', NycssCombobox);
