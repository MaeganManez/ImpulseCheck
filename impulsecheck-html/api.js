/* ============================================================
   api.js — ImpulseCheck Frontend API Helper
   Handles all calls to the Node.js backend.
   Include this in every HTML page:
     <script src="api.js"></script>
   ============================================================ */

const API_BASE = 'https://impulsecheck-backend.onrender.com/api';

/* ════════════════════════════════════════
   TOKEN HELPERS
════════════════════════════════════════ */
function getToken()        { return localStorage.getItem('ic_token') || localStorage.getItem('token'); }
function setToken(token)   { localStorage.setItem('ic_token', token); }
function removeToken()     { localStorage.removeItem('ic_token'); }
function setUser(user)     { localStorage.setItem('ic_user', JSON.stringify(user)); }
function getUser()         { return JSON.parse(localStorage.getItem('ic_user') || 'null'); }
function removeUser()      { localStorage.removeItem('ic_user'); }

/* ════════════════════════════════════════
   BASE FETCH WRAPPER
════════════════════════════════════════ */
async function apiFetch(endpoint, options = {}) {
  const token = getToken();

  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
    ...(options.headers || {}),
  };

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || 'Something went wrong.');
  }

  return data;
}

/* ════════════════════════════════════════
   AUTH
════════════════════════════════════════ */
const Auth = {
  async register(full_name, email, password) {
    const data = await apiFetch('/auth/register', {
      method: 'POST',
      body:   JSON.stringify({ full_name, email, password }),
    });
    setToken(data.token);
    setUser(data.user);
    return data;
  },

  async login(email, password) {
    const data = await apiFetch('/auth/login', {
      method: 'POST',
      body:   JSON.stringify({ email, password }),
    });
    setToken(data.token);
    setUser(data.user);
    return data;
  },

  logout() {
    removeToken();
    removeUser();
    localStorage.removeItem('ic_budget_data');
    localStorage.removeItem('ic_currency');
    window.location.href = 'login.html';
  },

  isLoggedIn() {
    return !!getToken();
  },

  requireAuth() {
    if (!this.isLoggedIn()) {
      window.location.href = 'login.html';
    }
  },
};

/* ════════════════════════════════════════
   BUDGET
════════════════════════════════════════ */
const Budget = {
  async save(amount, period, categories) {
    return apiFetch('/budget', {
      method: 'POST',
      body:   JSON.stringify({ amount, period, categories }),
    });
  },

  async get() {
    return apiFetch('/budget');
  },
};

/* ════════════════════════════════════════
   AI
════════════════════════════════════════ */
const AI = {
  async analyze(item_name, price, category, reason, emotion) {
    return apiFetch('/ai/analyze', {
      method: 'POST',
      body:   JSON.stringify({ item_name, price, category, reason, emotion }),
    });
  },
};

/* ════════════════════════════════════════
   PURCHASES
════════════════════════════════════════ */
const Purchases = {
  async getAll() {
    return apiFetch('/purchases');
  },

  async save(purchase) {
    return apiFetch('/purchases', {
      method: 'POST',
      body:   JSON.stringify(purchase),
    });
  },

  async delete(id) {
    return apiFetch(`/purchases/${id}`, { method: 'DELETE' });
  },

  async clearAll() {
    return apiFetch('/purchases/clear', { method: 'DELETE' });
  },

  async getReport() {
    return apiFetch('/purchases/report');
  },
};

/* ════════════════════════════════════════
   PROFILE
════════════════════════════════════════ */
const Profile = {
  async update(full_name, email, currency, avatar_url) {
    return apiFetch('/profile', {
      method: 'PUT',
      body:   JSON.stringify({ full_name, email, currency, avatar_url }),
    });
  },

  async savePreferences(currency, preselect_emotion, default_emotion) {
    return apiFetch('/profile/preferences', {
      method: 'PUT',
      body:   JSON.stringify({ currency, preselect_emotion, default_emotion }),
    });
  },
};
