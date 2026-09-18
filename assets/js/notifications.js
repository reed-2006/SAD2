/* ==========================================================================
   SkillBridge — notifications.js
   Centralized in-app notification system.

   Every important action creates a notification:
   applying, application status changes, enrollment, employer verification,
   job approval, new recommendation digest, etc.

   Notification object shape (stored under skillbridge_notifications):
   { id, userId, title, message, type, read, createdAt }
   ========================================================================== */

const Notifications = {

  /* Create + persist a notification for one user. */
  notify(userId, title, message, type = 'system') {
    const list = Storage.get(KEYS.NOTIFICATIONS);
    list.push({
      id: generateId('ntf_'), userId, title, message, type,
      read: false, createdAt: new Date().toISOString()
    });
    Storage.set(KEYS.NOTIFICATIONS, list);
    this.refreshBellDot();
  },

  forUser(userId) {
    return Storage.get(KEYS.NOTIFICATIONS)
      .filter(n => n.userId === userId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },

  unreadCount(userId) {
    const uid = userId ?? getCurrentUser()?.id;
    if (!uid) return 0;
    return Storage.get(KEYS.NOTIFICATIONS)
      .filter(n => n.userId === uid && !n.read).length;
  },

  markRead(id) {
    const list = Storage.get(KEYS.NOTIFICATIONS);
    const n = list.find(x => x.id === id);
    if (n) { n.read = true; Storage.set(KEYS.NOTIFICATIONS, list); }
    this.refreshBellDot();
  },

  markAllRead(userId) {
    const uid = userId ?? getCurrentUser()?.id;
    const list = Storage.get(KEYS.NOTIFICATIONS);
    list.forEach(n => { if (n.userId === uid) n.read = true; });
    Storage.set(KEYS.NOTIFICATIONS, list);
    this.refreshBellDot();
  },

  remove(id) {
    Storage.set(KEYS.NOTIFICATIONS,
      Storage.get(KEYS.NOTIFICATIONS).filter(n => n.id !== id));
    this.refreshBellDot();
  },

  /* ------------------------------ bell icon ------------------------------ */
  TYPE_ICONS: {
    application: 'fa-file-lines',   status: 'fa-arrows-rotate',
    training: 'fa-graduation-cap',  employer: 'fa-building',
    job: 'fa-briefcase',            system: 'fa-bell'
  },

  refreshBellDot() {
    const dot = document.getElementById('notif-dot');
    if (!dot) return;
    const count = this.unreadCount();
    dot.textContent = count > 9 ? '9+' : count;
    dot.style.display = count > 0 ? 'flex' : 'none';
  },

  /* Dropdown panel attached to the topbar bell button. */
  togglePanel() {
    let panel = document.getElementById('notif-panel');
    if (panel && panel.classList.contains('open')) { panel.classList.remove('open'); return; }
    this.renderPanel();
  },

  renderPanel() {
    const user = getCurrentUser();
    if (!user) return;

    let panel = document.getElementById('notif-panel');
    if (!panel) {
      panel = document.createElement('div');
      panel.id = 'notif-panel';
      panel.className = 'notif-panel';
      document.body.appendChild(panel);
    }

    const items = this.forUser(user.id).slice(0, 12);
    const unread = this.unreadCount(user.id);

    panel.innerHTML = `
      <div class="panel-head">
        <span>Notifications ${unread ? `(${unread} new)` : ''}</span>
        <button class="btn btn-ghost btn-sm" id="np-mark-all">Mark all read</button>
      </div>
      <div style="padding:6px 10px">
        ${items.length === 0 ? UI.emptyState('fa-envelope-open', "You're all caught up!", 'New alerts will appear here.') :
          items.map(n => `
          <div class="notif-item ${n.read ? '' : 'unread'}" data-id="${n.id}">
            <div class="n-icon"><i class="fa-solid ${this.TYPE_ICONS[n.type] || 'fa-bell'}"></i></div>
            <div class="n-body">
              <strong>${UI.esc(n.title)}</strong>
              <span>${UI.esc(n.message)}</span>
              <small>${UI.timeAgo(n.createdAt)}</small>
            </div>
          </div>`).join('')}
        ${user.role === 'seeker'
          ? `<a href="${BASE}pages/job-seeker/notifications.html"
                style="display:block;text-align:center;padding:8px;font-size:.85rem">
              View all notifications →</a>`
          : ''}
      </div>`;

    panel.classList.add('open');

    // clicking an item marks it read
    panel.querySelectorAll('.notif-item').forEach(el =>
      el.onclick = () => { this.markRead(el.dataset.id); el.classList.remove('unread'); });

    panel.querySelector('#np-mark-all').onclick = () => {
      this.markAllRead(user.id);
      this.renderPanel();
    };
  }
};
