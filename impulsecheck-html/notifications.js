/* ============================================================
   notifications.js — ImpulseCheck
   Drop this script into every app page.
   It builds the notification bell + dropdown automatically
   and wires it up to the backend API.
   ============================================================ */

(function () {
  const API = 'https://impulsecheck-backend.onrender.com/api';

  /* ── Find the topbar-right and inject the bell ── */
  function injectBell() {
    const right = document.querySelector('.topbar-right');
    if (!right) return;

    // Build the bell HTML
    const wrap = document.createElement('div');
    wrap.className = 'notif-wrap';
    wrap.innerHTML = `
      <button class="notif-btn" id="notif-btn" onclick="toggleNotifDropdown(event)" title="Notifications">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
          <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
        </svg>
        <span class="notif-badge" id="notif-badge"></span>
      </button>

      <div class="notif-dropdown" id="notif-dropdown">
        <div class="notif-drop-header">
          <h4>Notifications</h4>
          <button class="notif-mark-all" onclick="markAllRead()">Mark all read</button>
        </div>
        <div class="notif-list" id="notif-list">
          <div class="notif-empty">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
            <div>No notifications yet</div>
          </div>
        </div>
      </div>
    `;

    // Insert BEFORE the help icon (or avatar if no help icon)
    const helpIcon = right.querySelector('a[href="help.html"]');
    const avatar   = right.querySelector('.avatar');
    if (helpIcon) {
      right.insertBefore(wrap, helpIcon);
    } else if (avatar) {
      right.insertBefore(wrap, avatar);
    } else {
      right.prepend(wrap);
    }

    // Load notifications
    loadNotifications();
  }

  /* ── Load from backend (or use local fallback) ── */
  async function loadNotifications() {
    const token = localStorage.getItem('ic_token');

    // Mock data for when backend is not connected yet
    const mockNotifs = JSON.parse(localStorage.getItem('ic_notifications') || 'null');

    if (!token) {
      renderNotifications(mockNotifs || []);
      return;
    }

    try {
      const res  = await fetch(`${API}/notifications`, {
        headers: { 'Authorization': 'Bearer ' + token }
      });
      const data = await res.json();
      if (res.ok) {
        renderNotifications(data.notifications, data.unread_count);
        // Cache locally
        localStorage.setItem('ic_notifications', JSON.stringify(data.notifications));
      } else {
        renderNotifications(mockNotifs || []);
      }
    } catch {
      renderNotifications(mockNotifs || []);
    }
  }

  /* ── Render notifications list ── */
  function renderNotifications(notifs, unreadCount) {
    const list  = document.getElementById('notif-list');
    const badge = document.getElementById('notif-badge');
    if (!list || !badge) return;

    const count = unreadCount != null ? unreadCount : notifs.filter(n => !n.is_read).length;

    // Badge
    if (count > 0) {
      badge.textContent = count > 9 ? '9+' : count;
      badge.classList.add('show');
    } else {
      badge.classList.remove('show');
    }

    if (!notifs || notifs.length === 0) {
      list.innerHTML = `
        <div class="notif-empty">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
          <div>No notifications yet</div>
        </div>`;
      return;
    }

    list.innerHTML = notifs.map(n => {
      const iconMap = {
        welcome: '🎉', budget: '💰', avoid: '🚫',
        wait: '⏳', buy: '✅', report: '📊', info: '💡',
      };
      const icon    = iconMap[n.type] || '💡';
      const typeClass = n.type === 'budget' ? 'warn' : n.type === 'avoid' ? 'avoid' : '';
      const timeAgo  = getTimeAgo(n.created_at);

      return `
        <div class="notif-item ${!n.is_read ? 'unread' : ''}" onclick="markOneRead(${n.id})">
          <div class="notif-icon ${typeClass}">${icon}</div>
          <div class="notif-content">
            <div class="notif-title">${escHTML(n.title)}</div>
            <div class="notif-msg">${escHTML(n.message)}</div>
            <div class="notif-time">${timeAgo}</div>
          </div>
          ${!n.is_read ? '<div class="notif-dot-unread"></div>' : ''}
        </div>`;
    }).join('');
  }

  /* ── Toggle dropdown ── */
  window.toggleNotifDropdown = function (e) {
    e.stopPropagation();
    const dropdown = document.getElementById('notif-dropdown');
    if (!dropdown) return;
    const isOpen = dropdown.classList.contains('open');
    document.querySelectorAll('.notif-dropdown.open').forEach(d => d.classList.remove('open'));
    if (!isOpen) {
      dropdown.classList.add('open');
      loadNotifications();
      setTimeout(() => markAllRead(), 1500);
    }
  };

  // Close when clicking outside
  document.addEventListener('click', () => {
    document.querySelectorAll('.notif-dropdown.open').forEach(d => d.classList.remove('open'));
  });

  /* ── Mark all read ── */
  window.markAllRead = async function () {
    const token = localStorage.getItem('ic_token');
    if (token) {
      try {
        await fetch(`${API}/notifications/read-all`, {
          method: 'PUT',
          headers: { 'Authorization': 'Bearer ' + token }
        });
      } catch {}
    }
    // Update local cache
    const cached = JSON.parse(localStorage.getItem('ic_notifications') || '[]');
    cached.forEach(n => n.is_read = 1);
    localStorage.setItem('ic_notifications', JSON.stringify(cached));
    renderNotifications(cached, 0);
  };

  /* ── Mark one read ── */
  window.markOneRead = async function (id) {
    const token = localStorage.getItem('ic_token');
    if (token) {
      try {
        await fetch(`${API}/notifications/${id}/read`, {
          method: 'PUT',
          headers: { 'Authorization': 'Bearer ' + token }
        });
      } catch {}
    }
    const cached = JSON.parse(localStorage.getItem('ic_notifications') || '[]');
    const n = cached.find(x => x.id === id);
    if (n) n.is_read = 1;
    localStorage.setItem('ic_notifications', JSON.stringify(cached));
    const unread = cached.filter(x => !x.is_read).length;
    renderNotifications(cached, unread);
  };

  /* ── Helpers ── */
  function getTimeAgo(dateStr) {
    if (!dateStr) return '';
    const diff = Date.now() - new Date(dateStr).getTime();
    const m = Math.floor(diff / 60000);
    const h = Math.floor(m / 60);
    const d = Math.floor(h / 24);
    if (m < 1)  return 'Just now';
    if (m < 60) return `${m}m ago`;
    if (h < 24) return `${h}h ago`;
    return `${d}d ago`;
  }

  function escHTML(str) {
    return String(str || '').replace(/[&<>"']/g, c =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
    );
  }

  /* ── Also add a local notification helper ── */
  window.addLocalNotification = function (title, message, type = 'info') {
    const cached = JSON.parse(localStorage.getItem('ic_notifications') || '[]');
    cached.unshift({
      id:         Date.now(),
      title,
      message,
      type,
      is_read:    0,
      created_at: new Date().toISOString(),
    });
    // Keep max 30
    if (cached.length > 30) cached.pop();
    localStorage.setItem('ic_notifications', JSON.stringify(cached));
  };

  /* ── Init when DOM is ready ── */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectBell);
  } else {
    injectBell();
  }

})();
