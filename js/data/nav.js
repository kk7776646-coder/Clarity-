window.Clarity = window.Clarity || {};

/**
 * Navigation configuration.
 * Every entry here maps to a real implemented route in js/app.js.
 */
window.Clarity.data = {
  nav: [
    { id: 'chat', label: 'Chat', href: '#/chat', icon: 'chat' },
    { id: 'home', label: 'Home', href: '#/home', icon: 'house' },
    { id: 'project', label: 'Projects', href: '#/project', icon: 'folder' },
    { id: 'history', label: 'History', href: '#/history', icon: 'clock' }
  ],
  secondaryNav: [
    { id: 'model', label: 'Model', href: '#/model', icon: 'cpu' },
    { id: 'settings', label: 'Settings', href: '#/settings', icon: 'gear' }
  ]
};
