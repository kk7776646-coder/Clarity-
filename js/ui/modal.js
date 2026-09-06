window.Clarity = window.Clarity || {};

window.Clarity.modal = {
  _onKeydown: null,

  open(title, bodyHtml, actions) {
    const root = document.getElementById('modalRoot');
    if (!root) return;
    root.innerHTML = [
      '<div class="modal" role="dialog" aria-modal="true" aria-labelledby="modalTitle">',
      '<div class="modal__head"><h3 id="modalTitle">' + window.Clarity.utils.escapeHtml(title || 'Dialog') + '</h3><button class="btn btn--ghost btn--icon-sm" type="button" data-modal-close="true" aria-label="Close">',
      '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg>',
      '</button></div>',
      '<div class="modal__body">' + (bodyHtml || '') + '</div>',
      '<div class="modal__actions">' + (actions || '<button class="btn btn--primary" type="button" data-modal-close="true">Close</button>') + '</div>',
      '</div>'
    ].join('');
    root.classList.add('is-open');

    // Every close control must work, not just the first one.
    root.querySelectorAll('[data-modal-close]').forEach((btn) => {
      btn.addEventListener('click', () => this.close());
    });

    // Clicking the backdrop (outside the dialog) closes it.
    root.addEventListener('mousedown', (event) => {
      if (event.target === root) this.close();
    });

    this._onKeydown = (event) => {
      if (event.key === 'Escape') this.close();
    };
    document.addEventListener('keydown', this._onKeydown);

    const firstField = root.querySelector('input:not([type="hidden"]), select, textarea');
    if (firstField) firstField.focus();

    return root;
  },

  close() {
    const root = document.getElementById('modalRoot');
    if (this._onKeydown) {
      document.removeEventListener('keydown', this._onKeydown);
      this._onKeydown = null;
    }
    if (!root) return;
    root.classList.remove('is-open');
    root.innerHTML = '';
  }
};

