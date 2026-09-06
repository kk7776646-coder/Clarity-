window.NexaRAG = window.NexaRAG || {};

window.NexaRAG.toast = {
  show(message, type) {
    const root = document.getElementById('toasts');
    if (!root) return;
    const toast = document.createElement('div');
    toast.className = 'toast toast--' + (type || 'info');
    toast.textContent = message;
    root.appendChild(toast);
    setTimeout(() => {
      toast.remove();
    }, 2400);
  }
};
