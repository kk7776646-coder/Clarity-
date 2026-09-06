window.Clarity = window.Clarity || {};
window.Clarity.pages = window.Clarity.pages || {};

window.Clarity.pages.history = async function renderHistoryPage() {
  const main = document.getElementById('main');
  if (!main) return;

  let conversations = [];
  try {
    const data = await window.Clarity.api.get("/api/conversations");
    conversations = data.conversations || [];
  } catch (e) {
    window.Clarity.toast.show("Failed to load history", "danger");
  }

  const hasConversations = conversations.length > 0;
  const clearAllBtn = hasConversations
    ? '<button class="btn btn--danger-outline" id="clearAllHistoryBtn" type="button" style="display:inline-flex;align-items:center;gap:6px;">' +
        window.Clarity.icons.trash2 +
        '<span>Clear all history</span></button>'
    : '';

  main.innerHTML = [
    '<div class="page"><div class="page__inner page__inner--narrow">',
    '<header class="page__header">',
      '<div><h1 class="page__title">History</h1>',
      '<p class="page__subtitle">All your past conversations. Click any item to reopen it.</p></div>',
      '<div class="hstack" style="gap:8px;">' + clearAllBtn +
      '<button class="btn btn--primary" id="newFromHistoryBtn" type="button">',
        '<svg class="icon" viewBox="0 0 24 24" style="width:14px;height:14px;"><path d="M12 5v14M5 12h14"/></svg>',
        ' New conversation</button></div>',
    '</header>',
    '<section class="panel"><div class="panel__body">',
    conversations.length === 0
      ? '<div class="empty-state"><div style="margin-bottom:8px;">' + window.Clarity.icons.clock + '</div>No conversation history<div style="font-size:13px;margin-top:4px;">Start a new chat to begin.</div></div>'
      : '<div class="history-list">' + conversations.map(historyItemHtml).join('') + '</div>',
    '</div></section>',
    '</div></div>'
  ].join('');

  document.getElementById('newFromHistoryBtn')?.addEventListener('click', async () => {
    await window.Clarity.uiChat.startNewConversation();
    window.location.hash = '#/chat';
  });

  document.getElementById('clearAllHistoryBtn')?.addEventListener('click', () => {
    const body = '<p style="margin:0;color:var(--ink);">This will permanently delete all your conversations from history. This action cannot be undone.</p>';
    const actions = [
      '<button class="btn btn--outline" type="button" data-modal-close="true">Cancel</button>',
      '<button class="btn btn--danger" id="confirmClearAllBtn" type="button">Clear history</button>'
    ].join('');
    window.Clarity.modal.open('Clear all history?', body, actions);

    document.getElementById('confirmClearAllBtn')?.addEventListener('click', async () => {
      const btn = document.getElementById('confirmClearAllBtn');
      if (btn) {
        btn.disabled = true;
        btn.textContent = 'Deleting...';
      }
      try {
        const result = await window.Clarity.api.del('/api/conversations');
        window.Clarity.modal.close();
        window.Clarity.store.remove("active_conversation");
        if (window.Clarity.uiSidebar) await window.Clarity.uiSidebar.refresh();
        await window.Clarity.pages.history('#/history');
        window.Clarity.toast.show('All conversation history cleared permanently.', 'success');
      } catch (err) {
        window.Clarity.modal.close();
        const errorDetail = err.message || err.statusText || 'Unknown error';
        console.error('Clear all history failed:', err);
        window.Clarity.toast.show('Clear all failed: ' + errorDetail, 'danger');
        if (btn) {
          btn.disabled = false;
          btn.textContent = 'Clear history';
        }
      }
    }, { once: true });
  });

  document.querySelectorAll('[data-history-open]').forEach(el => {
    el.addEventListener('click', (e) => {
      e.preventDefault();
      const id = el.getAttribute('data-history-open');
      window.location.hash = '#/chat/' + id;
    });
  });
  document.querySelectorAll('[data-history-delete]').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const id = btn.getAttribute('data-history-delete');
      if (!confirm('Delete this conversation?')) return;
      const deleteBtn = btn;
      deleteBtn.disabled = true;
      deleteBtn.innerHTML = '<span>Deleting...</span>';
      try {
        await window.Clarity.api.del('/api/conversations/' + id);
        const currentActive = window.Clarity.store.get("active_conversation");
        if (currentActive === id) {
          window.Clarity.store.remove("active_conversation");
        }
        if (window.Clarity.uiSidebar) await window.Clarity.uiSidebar.refresh();
        await window.Clarity.pages.history('#/history');
        window.Clarity.toast.show('Conversation deleted.', 'success');
      } catch (err) {
        window.Clarity.toast.show('Delete failed: ' + (err.message || ''), 'danger');
        deleteBtn.disabled = false;
        deleteBtn.innerHTML = window.Clarity.icons.trash;
      }
    }, { once: true });
  });
};

function historyItemHtml(conv) {
  let timeStr = '';
  if (conv.updated_at) {
    const d = new Date(conv.updated_at * 1000);
    timeStr = d.toLocaleString();
  }
  let title = conv.title || '';
  if (title.length > 60) {
    title = title.slice(0, 57) + '...';
  }
  title = window.Clarity.utils.escapeHtml(title) || 'New conversation';
  return '<a class="history-item" href="#/chat/' + conv.id + '" data-history-open="' + conv.id + '">' +
    '<div><div class="history-item__title">' + title + '</div>' +
    '<div class="history-item__desc">' + (conv.message_count || 0) + ' message' + ((conv.message_count || 0) === 1 ? '' : 's') + ' • Model: ' + window.Clarity.utils.escapeHtml(conv.model_id || 'default') + '</div></div>' +
    '<div class="hstack" style="gap:8px;">' +
      '<span class="muted">' + timeStr + '</span>' +
      '<button class="btn btn--ghost btn--icon-sm" data-history-delete="' + conv.id + '" title="Delete" aria-label="Delete conversation">' +
        window.Clarity.icons.trash +
      '</button>' +
    '</div></a>';
}

