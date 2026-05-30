export class NycssRadioGroup extends HTMLElement {
  static observedAttributes = ['value', 'label'];

  get value() { return parseInt(this.getAttribute('value')) || 0; }
  set value(v) { this.setAttribute('value', v); }

  connectedCallback() {
    this.classList.add('radio-group');
    this.setAttribute('role', 'radiogroup');
    const label = this.getAttribute('label') || '';
    if (label) {
      const labelId = this.id ? `${this.id}-group-label` : '';
      if (labelId) this.setAttribute('aria-labelledby', labelId);
    }
    const name = this.id || this._uid();
    const labels = this.querySelectorAll('label');

    this.innerHTML = Array.from(labels).map((l, i) => {
      const text = l.textContent.trim();
      const itemId = this.id ? `${this.id}-${text.toLowerCase()}` : `rg-${this._uid()}-${i}`;
      return `<label${i === this.value ? ' class="nycss-radio-checked"' : ''}>${text}<input type="radio" name="${name}" role="radio" id="${itemId}" ${i === this.value ? 'checked' : ''}></label>`;
    }).join('');

    this.radios = this.querySelectorAll('[type="radio"]');
    this.radioLabels = this.querySelectorAll(':scope > label');

    if (this.radioLabels[this.value]) this.radioLabels[this.value].setAttribute('tabindex', '0');

    this.radios.forEach((radio, i) => {
      radio.addEventListener('change', (e) => {
        e.stopPropagation();
        if (radio.checked) {
          this.value = i;
          this._updateTabindex(i);
          this.dispatchEvent(new CustomEvent('change', { detail: i }));
        }
      });
    });

    this.addEventListener('keydown', (e) => {
      const current = this.value;
      let next = -1;
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = (current + 1) % this.radios.length;
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') next = (current - 1 + this.radios.length) % this.radios.length;
      if (e.key === 'Home') next = 0;
      if (e.key === 'End') next = this.radios.length - 1;
      if (next >= 0) {
        e.preventDefault();
        this.radios[next].checked = true;
        this.value = next;
        this._updateTabindex(next);
        this.radioLabels[next].focus();
        this.dispatchEvent(new CustomEvent('change', { detail: next }));
      }
    });
  }

  _updateTabindex(idx) {
    this.radioLabels.forEach((l, i) => l.setAttribute('tabindex', i === idx ? '0' : '-1'));
    this.radioLabels.forEach((l, i) => l.classList.toggle('nycss-radio-checked', i === idx));
  }

  attributeChangedCallback(name, _, newVal) {
    if (name === 'value' && this.radios) {
      const idx = parseInt(newVal) || 0;
      if (this.radios[idx]) this.radios[idx].checked = true;
      if (this.radioLabels) this._updateTabindex(idx);
    }
  }

  _uid() { return `rg-${Math.random().toString(36).slice(2, 8)}`; }
}

customElements.define('nycss-radio-group', NycssRadioGroup);
