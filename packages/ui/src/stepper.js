export class NycssStepper extends HTMLElement {
  static observedAttributes = ['value', 'min', 'max', 'label', 'disabled', 'placeholder'];

  get value() { return parseInt(this.getAttribute('value')) || 0; }
  set value(v) { this.setAttribute('value', v); }
  get min() { return parseInt(this.getAttribute('min')) || 0; }
  get max() { return parseInt(this.getAttribute('max')) || 99999; }
  get disabled() { return this.hasAttribute('disabled'); }
  set disabled(v) { v ? this.setAttribute('disabled', '') : this.removeAttribute('disabled'); }
  get placeholder() { return this.getAttribute('placeholder') || ''; }
  set placeholder(v) { this.setAttribute('placeholder', v); }

  connectedCallback() {
    this.classList.add('number');
    const id = this._uid();
    const label = this.getAttribute('label') || '';
    const labelId = this.id ? `${this.id}-label` : `${id}-label`;
    const inputId = this.id ? `${this.id}-input` : `${id}-input`;
    this.innerHTML = `
      ${label ? `<span id="${labelId}" class="stepper-label">${label}</span>` : ''}
      <output>
        <input type="text" inputmode="numeric" value="${this.value}" placeholder="${this.placeholder}" class="stepper-input" id="${inputId}"${labelId ? ` aria-labelledby="${labelId}"` : ''}>
        <div>
          <svg class="stepper-up" role="button" aria-label="Increase" viewBox="0 0 24 24" tabindex="0"><path d="M3 19h18a1.002 1.002 0 0 0 .823-1.569l-9-13c-.373-.539-1.271-.539-1.645 0l-9 13A.999.999 0 0 0 3 19z"/></svg>
          <svg class="stepper-down" role="button" aria-label="Decrease" viewBox="0 0 24 24" tabindex="0"><path d="M11.178 19.569a.998.998 0 0 0 1.644 0l9-13A.999.999 0 0 0 21 5H3a1.002 1.002 0 0 0-.822 1.569l9 13z"/></svg>
        </div>
      </output>
    `;

    this.input = this.querySelector('.stepper-input');
    this.upBtn = this.querySelector('.stepper-up');
    this.downBtn = this.querySelector('.stepper-down');
    this.output = this.querySelector('output');

    this.input.addEventListener('input', () => {
      if (this.disabled) return;
      let v = parseInt(this.input.value) || 0;
      v = Math.max(this.min, Math.min(v, this.max));
      this.value = v;
      this._adjustWidth();
      this.dispatchEvent(new CustomEvent('change', { detail: v }));
    });
    this.input.addEventListener('change', (e) => {
      e.stopPropagation();
    });

    this.input.addEventListener('keydown', (e) => {
      if (this.disabled) return;
      if (e.key === 'ArrowUp') { e.preventDefault(); this._step(1); }
      if (e.key === 'ArrowDown') { e.preventDefault(); this._step(-1); }
    });

    this._addHoldSupport(this.upBtn, 1);
    this._addHoldSupport(this.downBtn, -1);
    this._updateDisabled();
  }

  _addHoldSupport(btn, dir) {
    let interval = null;
    let timeout = null;
    const step = () => { this._step(dir); };
    const start = (e) => {
      if (e.type === 'mousedown' && e.button !== 0) return;
      e.preventDefault();
      step();
      clearTimeout(timeout);
      clearInterval(interval);
      timeout = setTimeout(() => {
        interval = setInterval(step, 100);
      }, 500);
    };
    const stop = () => {
      clearTimeout(timeout);
      clearInterval(interval);
      interval = null;
      timeout = null;
    };
    btn.addEventListener('mousedown', start);
    btn.addEventListener('mouseup', stop);
    btn.addEventListener('mouseleave', stop);
    btn.addEventListener('touchstart', start, { passive: false });
    btn.addEventListener('touchend', stop);
    btn.addEventListener('touchcancel', stop);
      }

  attributeChangedCallback(name, _, newVal) {
    if (name === 'value' && this.input) {
      this.input.value = newVal;
      this._adjustWidth();
    }
    if (name === 'disabled' && this.input) {
      this._updateDisabled();
    }
    if (name === 'placeholder' && this.input) {
      this.input.placeholder = newVal || '';
    }
  }

  _updateDisabled() {
    this.input.disabled = this.disabled;
  }

  _step(dir) {
    if (this.disabled) return;
    let v = this.value + dir;
    v = Math.max(this.min, Math.min(v, this.max));
    this.value = v;
    this.dispatchEvent(new CustomEvent('change', { detail: v }));
  }

  _adjustWidth() {
    this.input.style.width = `${Math.max(3, String(this.input.value || '0').length + 2)}ch`;
  }

  _uid() { return `st-${Math.random().toString(36).slice(2, 8)}`; }
}

customElements.define('nycss-stepper', NycssStepper);
