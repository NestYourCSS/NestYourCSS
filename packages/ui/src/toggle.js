export class NycssToggle extends HTMLElement {
  static observedAttributes = ['checked', 'disabled'];

  get checked() { return this.hasAttribute('checked'); }
  set checked(v) { v ? this.setAttribute('checked', '') : this.removeAttribute('checked'); }
  get disabled() { return this.hasAttribute('disabled'); }
  set disabled(v) { v ? this.setAttribute('disabled', '') : this.removeAttribute('disabled'); }

  connectedCallback() {
    this.classList.add('toggle');
    const onText = this.getAttribute('on-text') || 'On';
    const offText = this.getAttribute('off-text') || 'Off';
    const labelId = this.id ? `${this.id}-label` : '';
    const cbId = this.id ? `${this.id}-checkbox` : `tog-${this._uid()}`;
    this.innerHTML = `
      <input type="checkbox" role="switch" id="${cbId}" ${this.checked ? 'checked' : ''}${this.disabled ? ' disabled' : ''}${labelId ? ` aria-labelledby="${labelId}"` : ''}>
      <span aria-hidden="true">${offText}</span>
      <span aria-hidden="true">${onText}</span>
    `;

    this.input = this.querySelector('input');
    this.addEventListener('click', (e) => {
      if (e.target === this.input) return;
      if (this.disabled) return;
      this.input.checked = !this.input.checked;
      this.checked = this.input.checked;
      this.dispatchEvent(new CustomEvent('change', { detail: this.checked }));
    });
    this.input.addEventListener('change', (e) => {
      e.stopPropagation();
      this.checked = this.input.checked;
      this.dispatchEvent(new CustomEvent('change', { detail: this.checked }));
    });
    this.input.addEventListener('keydown', (e) => {
      if (this.disabled) return;
      if (e.code === 'Space') {
        e.stopPropagation();
        e.preventDefault();
        this.input.checked = !this.input.checked;
        this.checked = this.input.checked;
        this.dispatchEvent(new CustomEvent('change', { detail: this.checked }));
      }
    });
    this._updateDisabled();
  }

  attributeChangedCallback(name, _, newVal) {
    if (name === 'checked' && this.input) {
      this.input.checked = newVal !== null;
    }
    if (name === 'disabled' && this.input) {
      this._updateDisabled();
    }
  }

  _updateDisabled() {
    this.input.disabled = this.disabled;
  }

  _uid() { return `tog-${Math.random().toString(36).slice(2, 8)}`; }
}

customElements.define('nycss-toggle', NycssToggle);
