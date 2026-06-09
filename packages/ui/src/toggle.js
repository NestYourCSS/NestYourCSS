export class NycssToggle extends HTMLElement {
  static observedAttributes = ['checked'];

  get checked() { return this.hasAttribute('checked'); }
  set checked(v) { v ? this.setAttribute('checked', '') : this.removeAttribute('checked'); }

  connectedCallback() {
    this.classList.add('toggle');
    const onText = this.getAttribute('on-text') || 'On';
    const offText = this.getAttribute('off-text') || 'Off';
    const labelId = this.id ? `${this.id}-label` : '';
    const cbId = this.id ? `${this.id}-checkbox` : `tog-${this._uid()}`;
    this.innerHTML = `
      <input type="checkbox" role="switch" id="${cbId}" ${this.checked ? 'checked' : ''}${labelId ? ` aria-labelledby="${labelId}"` : ''}>
      <span aria-hidden="true">${offText}</span>
      <span aria-hidden="true">${onText}</span>
    `;

    this.input = this.querySelector('input');
    this.addEventListener('click', (e) => {
      if (e.target === this.input) return;
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
      if (e.code === 'Space') {
        e.stopPropagation();
        e.preventDefault();
        this.input.checked = !this.input.checked;
        this.checked = this.input.checked;
        this.dispatchEvent(new CustomEvent('change', { detail: this.checked }));
      }
    });
  }

  attributeChangedCallback(name, _, newVal) {
    if (name === 'checked' && this.input) {
      this.input.checked = newVal !== null;
    }
  }

  _uid() { return `tog-${Math.random().toString(36).slice(2, 8)}`; }
}

customElements.define('nycss-toggle', NycssToggle);
