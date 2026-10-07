/* ELM Team Hub — handovers, test URLs, team status, notes and daily to-dos.
 * All data is stored in the browser (localStorage). Use Export/Import for backups. */
(function () {
  'use strict';

  const STORAGE_KEY = 'elm-team-hub-v1';
  const SYNC_KEY = 'elm-team-hub-sync';
  const THEME_KEY = 'elm-team-hub-theme';

  // ---------- Option lists & status colors ----------
  const HANDOVER_STATUS = ['Pending', 'In Progress', 'Completed', 'Blocked'];
  const TEAM_STATUS = ['Available', 'Busy', 'In Meeting', 'On Leave', 'Offline'];
  const TEAM_HANDOVER = ['Not Started', 'In Progress', 'Done', 'N/A'];
  const ENVIRONMENTS = ['DEV', 'SIT', 'UAT', 'Staging', 'Pre-Prod', 'PROD'];
  const PRIORITIES = ['High', 'Medium', 'Low'];
  const NOTE_COLORS = ['#00897b', '#2d7dd2', '#c98200', '#d64545', '#7b5cd6', '#6b7c86'];

  const TONE = {
    'Pending': 't-warn', 'In Progress': 't-info', 'Completed': 't-ok', 'Blocked': 't-bad',
    'Available': 't-ok', 'Busy': 't-warn', 'In Meeting': 't-info', 'On Leave': 't-idle', 'Offline': 't-idle',
    'Not Started': 't-idle', 'Done': 't-ok', 'N/A': 't-idle',
    'High': 't-bad', 'Medium': 't-warn', 'Low': 't-idle',
    'DEV': 't-info', 'SIT': 't-info', 'UAT': 't-warn', 'Staging': 't-warn', 'Pre-Prod': 't-bad', 'PROD': 't-bad'
  };

  // ---------- Form schemas ----------
  const SCHEMAS = {
    handovers: {
      label: 'Handover',
      fields: [
        { key: 'title', label: 'Handover title', type: 'text', required: true, placeholder: 'e.g. Payment module release support' },
        { key: 'system', label: 'System / Module', type: 'text', placeholder: 'e.g. Absher, Tamm…' },
        { key: 'from', label: 'Handed over by', type: 'text', half: true },
        { key: 'to', label: 'Handed over to', type: 'text', half: true },
        { key: 'date', label: 'Handover date', type: 'date', half: true },
        { key: 'status', label: 'Status', type: 'select', options: HANDOVER_STATUS, half: true },
        { key: 'priority', label: 'Priority', type: 'select', options: PRIORITIES, half: true },
        { key: 'ticket', label: 'Ticket / Reference', type: 'text', half: true, placeholder: 'JIRA-1234' },
        { key: 'details', label: 'Handover details', type: 'textarea', placeholder: 'Current state, open issues, pending actions, contacts…' },
        { key: 'links', label: 'Related links / documents (one per line)', type: 'textarea' }
      ],
      defaults: () => ({ status: 'Pending', priority: 'Medium', date: todayISO() })
    },
    urls: {
      label: 'Test URL',
      fields: [
        { key: 'name', label: 'Name', type: 'text', required: true, placeholder: 'e.g. Admin portal' },
        { key: 'system', label: 'System', type: 'text', half: true },
        { key: 'env', label: 'Environment', type: 'select', options: ENVIRONMENTS, half: true },
        { key: 'url', label: 'URL', type: 'url', required: true, placeholder: 'https://' },
        { key: 'username', label: 'Test user / account (avoid storing passwords)', type: 'text' },
        { key: 'notes', label: 'Notes', type: 'textarea', placeholder: 'VPN needed, test data, known issues…' }
      ],
      defaults: () => ({ env: 'SIT' })
    },
    team: {
      label: 'Team member',
      fields: [
        { key: 'name', label: 'Name', type: 'text', required: true },
        { key: 'role', label: 'Role', type: 'text', placeholder: 'e.g. QA Engineer' },
        { key: 'status', label: 'Availability', type: 'select', options: TEAM_STATUS, half: true },
        { key: 'handover', label: 'Handover status', type: 'select', options: TEAM_HANDOVER, half: true },
        { key: 'task', label: 'Currently working on', type: 'textarea' },
        { key: 'backup', label: 'Backup person', type: 'text', half: true },
        { key: 'returnDate', label: 'Back on (if on leave)', type: 'date', half: true }
      ],
      defaults: () => ({ status: 'Available', handover: 'N/A' })
    },
    todos: {
      label: 'Task',
      fields: [
        { key: 'title', label: 'Task', type: 'text', required: true },
        { key: 'priority', label: 'Priority', type: 'select', options: PRIORITIES, half: true },
        { key: 'due', label: 'Due date', type: 'date', half: true },
        { key: 'category', label: 'Category', type: 'text', placeholder: 'e.g. Testing, Meeting, Follow-up' },
        { key: 'notes', label: 'Notes', type: 'textarea' },
        { key: 'done', label: 'Completed', type: 'checkbox' }
      ],
      defaults: () => ({ priority: 'Medium', due: todayISO(), done: false })
    },
    notes: {
      label: 'Note',
      fields: [
        { key: 'title', label: 'Title', type: 'text', required: true },
        { key: 'body', label: 'Note', type: 'textarea', rows: 10 },
        { key: 'color', label: 'Color', type: 'color' },
        { key: 'pinned', label: 'Pin to top', type: 'checkbox' }
      ],
      defaults: () => ({ color: NOTE_COLORS[0], pinned: false })
    }
  };

  const VIEW_TITLES = {
    dashboard: 'Dashboard', handovers: 'Handovers', urls: 'Test URLs',
    team: 'Team Status', todos: 'To-Do List', notes: 'Notes'
  };

  // ---------- State ----------
  let db = load();
  const ui = {
    view: 'dashboard',
    search: '',
    handoverFilter: 'All',
    envFilter: 'All',
    teamFilter: 'All',
    todoFilter: 'Today'
  };

  function emptyDb() {
    return { handovers: [], urls: [], team: [], todos: [], notes: [] };
  }

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return Object.assign(emptyDb(), JSON.parse(raw));
    } catch (e) { /* storage unavailable or corrupted: start fresh */ }
    return seed();
  }

  function persistLocal() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(db)); }
    catch (e) { toast('Could not save — browser storage is unavailable'); }
    updateBadges();
  }

  // Called after every change: saves in the browser and, if linked, to the data file.
  function save() {
    persistLocal();
    setSync({ localChanged: Date.now() });
    scheduleFileWrite();
  }

  // Tracks when data last changed vs. when it last reached the data file,
  // so unsaved changes made while the file was disconnected are not silently lost.
  function getSync() {
    try { return JSON.parse(localStorage.getItem(SYNC_KEY)) || {}; } catch (e) { return {}; }
  }
  function setSync(patch) {
    try { localStorage.setItem(SYNC_KEY, JSON.stringify(Object.assign(getSync(), patch))); } catch (e) { /* ignore */ }
  }

  function serialize() {
    return JSON.stringify({ app: 'elm-team-hub', version: 1, exported: new Date().toISOString(), data: db }, null, 2);
  }

  // Parses an export / data file; throws if it is not ELM Team Hub data.
  function parseBackup(text) {
    const parsed = JSON.parse(text);
    const data = parsed && (parsed.data || parsed);
    const keys = Object.keys(emptyDb());
    if (!data || !keys.some(k => Array.isArray(data[k]))) throw new Error('bad file');
    const next = emptyDb();
    keys.forEach(k => {
      if (Array.isArray(data[k])) next[k] = data[k].filter(x => x && typeof x === 'object').map(x => Object.assign({ id: uid(), created: Date.now() }, x));
    });
    return next;
  }

  function seed() {
    const t = todayISO();
    const now = Date.now();
    return {
      handovers: [
        { id: uid(), title: 'Example: Release 2.4 support', system: 'Customer Portal', from: 'Ahmed', to: 'Sara', date: t, status: 'In Progress', priority: 'High', ticket: 'REL-240', details: 'Smoke test done on SIT.\nPending: UAT sign-off from business.', links: '', created: now }
      ],
      urls: [
        { id: uid(), name: 'Example: Customer Portal', system: 'Portal', env: 'SIT', url: 'https://sit.example.com', username: 'test.user01', notes: 'Requires VPN', created: now }
      ],
      team: [
        { id: uid(), name: 'Sara', role: 'QA Engineer', status: 'Available', handover: 'In Progress', task: 'Regression testing for Release 2.4', backup: 'Ahmed', returnDate: '', created: now }
      ],
      todos: [
        { id: uid(), title: 'Review handover notes from yesterday', priority: 'High', due: t, category: 'Handover', notes: '', done: false, created: now },
        { id: uid(), title: 'Update test URLs list', priority: 'Low', due: t, category: 'Admin', notes: '', done: false, created: now }
      ],
      notes: [
        { id: uid(), title: 'Welcome 👋', body: 'This is your ELM Team Hub.\n\n• Store handovers & test URLs\n• Track team & handover status\n• Keep notes and a daily to-do list\n\nData is saved in this browser. Use Export for backups.', color: NOTE_COLORS[0], pinned: true, created: now, updated: now }
      ]
    };
  }

  // ---------- Helpers ----------
  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }
  function todayISO() {
    const d = new Date();
    return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
  function safeUrl(u) { return /^https?:\/\//i.test(String(u || '').trim()) ? String(u).trim() : ''; }
  function fmtDate(iso) {
    if (!iso) return '';
    const d = new Date(iso + 'T00:00:00');
    return isNaN(d) ? iso : d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
  }
  function fmtTime(ts) { return ts ? new Date(ts).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : ''; }
  function pill(v, nodot) { return v ? `<span class="pill ${TONE[v] || 't-idle'}${nodot ? ' nodot' : ''}">${esc(v)}</span>` : ''; }
  function initials(name) { return String(name || '?').trim().split(/\s+/).slice(0, 2).map(p => p[0]).join('').toUpperCase(); }
  function avatarColor(name) {
    let h = 0; for (const c of String(name)) h = (h * 31 + c.charCodeAt(0)) % 360;
    return `hsl(${h} 45% 45%)`;
  }
  function matches(item, keys) {
    if (!ui.search) return true;
    const q = ui.search.toLowerCase();
    return keys.some(k => String(item[k] || '').toLowerCase().includes(q));
  }
  function find(coll, id) { return db[coll].find(x => x.id === id); }
  function count(arr, pred) { return arr.filter(pred).length; }
  function emptyState(icon, text, coll) {
    return `<div class="empty"><div class="big">${icon}</div><div>${text}</div>${coll ? `<p><button class="btn primary" data-act="new" data-coll="${coll}">+ Add ${esc(SCHEMAS[coll].label.toLowerCase())}</button></p>` : ''}</div>`;
  }
  function chips(options, active, act, counts) {
    return options.map(o => `<button class="chip${o === active ? ' active' : ''}" data-act="${act}" data-val="${esc(o)}">${esc(o)}${counts ? `<span class="n">${counts[o] || 0}</span>` : ''}</button>`).join('');
  }

  // ---------- Rendering ----------
  const $content = document.getElementById('content');

  function render() {
    document.getElementById('view-title').textContent = VIEW_TITLES[ui.view];
    document.querySelectorAll('.nav-item').forEach(b => b.classList.toggle('active', b.dataset.view === ui.view));
    document.getElementById('btn-add').style.visibility = ui.view === 'dashboard' ? 'hidden' : 'visible';
    document.querySelector('.search').style.display = ui.view === 'dashboard' ? 'none' : '';
    $content.innerHTML = VIEWS[ui.view]();
  }

  const VIEWS = {
    dashboard() {
      const t = todayISO();
      const openHandovers = db.handovers.filter(h => h.status !== 'Completed');
      const todays = db.todos.filter(x => x.due && x.due <= t && (!x.done || x.due === t));
      const doneToday = count(todays, x => x.done);
      const overdue = count(db.todos, x => !x.done && x.due && x.due < t);
      const avail = count(db.team, m => m.status === 'Available');
      const pct = todays.length ? Math.round(doneToday / todays.length * 100) : 0;

      const todayList = todays.slice().sort(todoSort).slice(0, 7).map(todoRow).join('') ||
        `<div class="empty">Nothing due today 🎉</div>`;

      const hoList = openHandovers.slice().sort((a, b) => (b.date || '').localeCompare(a.date || '')).slice(0, 5).map(h => `
        <li>
          <div class="grow"><div class="t">${esc(h.title)}</div>
          <div class="s">${esc(h.from || '—')} → ${esc(h.to || '—')} · ${fmtDate(h.date)}</div></div>
          ${pill(h.status)}
        </li>`).join('') || '<li class="muted">No open handovers</li>';

      const teamList = db.team.slice(0, 6).map(m => `
        <li>
          <div class="avatar" style="width:32px;height:32px;font-size:12px;background:${avatarColor(m.name)}">${esc(initials(m.name))}</div>
          <div class="grow"><div class="t">${esc(m.name)}</div><div class="s">${esc(m.task || m.role || '')}</div></div>
          ${pill(m.status)}
        </li>`).join('') || '<li class="muted">No team members yet</li>';

      const pinned = db.notes.filter(n => n.pinned).slice(0, 3).map(n => `
        <li><span style="width:10px;height:10px;border-radius:3px;background:${esc(n.color)}"></span>
        <div class="grow"><div class="t">${esc(n.title)}</div><div class="s">${esc((n.body || '').split('\n')[0])}</div></div></li>`).join('');

      return `
        <div class="stats">
          <div class="card stat accent" data-act="go" data-val="todos">
            <span class="label">Today's tasks</span>
            <span class="value">${doneToday}/${todays.length}</span>
            <div class="progress" style="background:rgba(255,255,255,.25);border:0"><div style="width:${pct}%;background:#fff"></div></div>
            <span class="sub">${overdue ? overdue + ' overdue' : 'No overdue tasks'}</span>
          </div>
          <div class="card stat" data-act="go" data-val="handovers">
            <span class="label">Open handovers</span>
            <span class="value">${openHandovers.length}</span>
            <span class="sub">${count(db.handovers, h => h.status === 'Blocked')} blocked · ${count(db.handovers, h => h.status === 'Completed')} completed</span>
          </div>
          <div class="card stat" data-act="go" data-val="team">
            <span class="label">Team available</span>
            <span class="value">${avail}/${db.team.length}</span>
            <span class="sub">${count(db.team, m => m.status === 'On Leave')} on leave</span>
          </div>
          <div class="card stat" data-act="go" data-val="urls">
            <span class="label">Test URLs</span>
            <span class="value">${db.urls.length}</span>
            <span class="sub">${new Set(db.urls.map(u => u.env)).size} environments</span>
          </div>
        </div>
        <div class="dash-grid">
          <div class="card">
            <div class="card-pad" style="padding-bottom:0"><h3>✓ Today's to-do <button class="link" data-act="go" data-val="todos">View all →</button></h3></div>
            ${quickAdd()}
            <div>${todayList}</div>
          </div>
          <div style="display:flex;flex-direction:column;gap:16px">
            <div class="card card-pad"><h3>⇄ Open handovers <button class="link" data-act="go" data-val="handovers">View all →</button></h3><ul class="list">${hoList}</ul></div>
            <div class="card card-pad"><h3>👥 Team status <button class="link" data-act="go" data-val="team">View all →</button></h3><ul class="list">${teamList}</ul></div>
            ${pinned ? `<div class="card card-pad"><h3>📌 Pinned notes <button class="link" data-act="go" data-val="notes">View all →</button></h3><ul class="list">${pinned}</ul></div>` : ''}
          </div>
        </div>`;
    },

    handovers() {
      const counts = { All: db.handovers.length };
      HANDOVER_STATUS.forEach(s => counts[s] = count(db.handovers, h => h.status === s));
      const items = db.handovers
        .filter(h => ui.handoverFilter === 'All' || h.status === ui.handoverFilter)
        .filter(h => matches(h, ['title', 'system', 'from', 'to', 'details', 'ticket', 'links']))
        .sort((a, b) => (b.date || '').localeCompare(a.date || '') || b.created - a.created);

      const rows = items.map(h => {
        const links = String(h.links || '').split('\n').map(l => l.trim()).filter(Boolean).map(l => {
          const u = safeUrl(l);
          return u ? `<a href="${esc(u)}" target="_blank" rel="noopener">${esc(l)}</a>` : esc(l);
        }).join('<br>');
        return `
        <tr>
          <td><div class="title">${esc(h.title)}</div>
            ${h.ticket ? `<div class="desc">${esc(h.ticket)}</div>` : ''}
            ${h.details ? `<div class="desc">${esc(h.details)}</div>` : ''}
            ${links ? `<div class="desc">${links}</div>` : ''}</td>
          <td class="hide-sm">${esc(h.system)}</td>
          <td>${esc(h.from || '—')} → ${esc(h.to || '—')}</td>
          <td class="hide-sm">${fmtDate(h.date)}</td>
          <td class="hide-sm">${pill(h.priority, true)}</td>
          <td><select class="inline-select" data-act="set" data-coll="handovers" data-id="${h.id}" data-key="status">
            ${HANDOVER_STATUS.map(s => `<option${s === h.status ? ' selected' : ''}>${s}</option>`).join('')}</select></td>
          <td><div class="actions"><button class="icon-btn sm" data-act="edit" data-coll="handovers" data-id="${h.id}" title="Edit">✎</button></div></td>
        </tr>`;
      }).join('');

      return `
        <div class="toolbar">${chips(['All', ...HANDOVER_STATUS], ui.handoverFilter, 'hfilter', counts)}</div>
        <div class="card">${items.length ? `
          <div class="table-wrap"><table>
            <thead><tr><th>Handover</th><th class="hide-sm">System</th><th>From → To</th><th class="hide-sm">Date</th><th class="hide-sm">Priority</th><th>Status</th><th></th></tr></thead>
            <tbody>${rows}</tbody></table></div>` : emptyState('⇄', 'No handovers found.', 'handovers')}
        </div>`;
    },

    urls() {
      const envs = ['All', ...ENVIRONMENTS];
      const counts = { All: db.urls.length };
      ENVIRONMENTS.forEach(e => counts[e] = count(db.urls, u => u.env === e));
      const items = db.urls
        .filter(u => ui.envFilter === 'All' || u.env === ui.envFilter)
        .filter(u => matches(u, ['name', 'system', 'env', 'url', 'username', 'notes']))
        .sort((a, b) => (a.system || '').localeCompare(b.system || '') || a.name.localeCompare(b.name));

      const cards = items.map(u => {
        const href = safeUrl(u.url);
        return `
        <div class="card url-card">
          <div class="head"><span class="name">${esc(u.name)}</span>${pill(u.env, true)}</div>
          ${u.system ? `<div class="meta">System: ${esc(u.system)}</div>` : ''}
          <div class="url">${esc(u.url)}</div>
          ${u.username ? `<div class="meta">👤 ${esc(u.username)}</div>` : ''}
          ${u.notes ? `<div class="meta">${esc(u.notes)}</div>` : ''}
          <div class="foot">
            ${href ? `<a class="btn primary small" href="${esc(href)}" target="_blank" rel="noopener">Open ↗</a>` : ''}
            <button class="btn ghost small" data-act="copy" data-val="${esc(u.url)}">Copy URL</button>
            ${u.username ? `<button class="btn ghost small" data-act="copy" data-val="${esc(u.username)}">Copy user</button>` : ''}
            <span class="spacer"></span>
            <button class="icon-btn sm" data-act="edit" data-coll="urls" data-id="${u.id}" title="Edit">✎</button>
          </div>
        </div>`;
      }).join('');

      return `
        <div class="toolbar">${chips(envs, ui.envFilter, 'efilter', counts)}</div>
        ${items.length ? `<div class="grid">${cards}</div>` : `<div class="card">${emptyState('🔗', 'No test URLs found.', 'urls')}</div>`}`;
    },

    team() {
      const counts = { All: db.team.length };
      TEAM_STATUS.forEach(s => counts[s] = count(db.team, m => m.status === s));
      const items = db.team
        .filter(m => ui.teamFilter === 'All' || m.status === ui.teamFilter)
        .filter(m => matches(m, ['name', 'role', 'status', 'task', 'backup', 'handover']))
        .sort((a, b) => a.name.localeCompare(b.name));

      const cards = items.map(m => `
        <div class="card member">
          <div class="top">
            <div class="avatar" style="background:${avatarColor(m.name)}">${esc(initials(m.name))}</div>
            <div class="who"><div class="n">${esc(m.name)}</div><div class="r">${esc(m.role || '')}</div></div>
            <button class="icon-btn sm" data-act="edit" data-coll="team" data-id="${m.id}" title="Edit">✎</button>
          </div>
          ${m.task ? `<div class="task">${esc(m.task)}</div>` : ''}
          <div class="bottom">
            <select class="inline-select" data-act="set" data-coll="team" data-id="${m.id}" data-key="status" title="Availability">
              ${TEAM_STATUS.map(s => `<option${s === m.status ? ' selected' : ''}>${s}</option>`).join('')}</select>
            <span>Handover:</span>
            <select class="inline-select" data-act="set" data-coll="team" data-id="${m.id}" data-key="handover" title="Handover status">
              ${TEAM_HANDOVER.map(s => `<option${s === m.handover ? ' selected' : ''}>${s}</option>`).join('')}</select>
          </div>
          <div class="bottom">
            ${pill(m.status)} ${m.handover && m.handover !== 'N/A' ? pill('Handover: ' + m.handover, true).replace('t-idle', TONE[m.handover] || 't-idle') : ''}
            ${m.backup ? `<span>Backup: ${esc(m.backup)}</span>` : ''}
            ${m.status === 'On Leave' && m.returnDate ? `<span>Back ${fmtDate(m.returnDate)}</span>` : ''}
          </div>
        </div>`).join('');

      return `
        <div class="toolbar">${chips(['All', ...TEAM_STATUS], ui.teamFilter, 'tfilter', counts)}</div>
        ${items.length ? `<div class="grid">${cards}</div>` : `<div class="card">${emptyState('👥', 'No team members found.', 'team')}</div>`}`;
    },

    todos() {
      const t = todayISO();
      const filters = {
        Today: x => !x.done && x.due && x.due <= t || x.done && x.due === t,
        Upcoming: x => !x.done && x.due && x.due > t,
        'No date': x => !x.done && !x.due,
        Completed: x => x.done,
        All: () => true
      };
      const counts = {};
      Object.keys(filters).forEach(k => counts[k] = count(db.todos, filters[k]));
      const items = db.todos.filter(filters[ui.todoFilter])
        .filter(x => matches(x, ['title', 'category', 'notes', 'priority']))
        .sort(todoSort);
      const today = db.todos.filter(filters.Today);
      const doneToday = count(today, x => x.done);
      const pct = today.length ? Math.round(doneToday / today.length * 100) : 0;

      return `
        <div class="card card-pad" style="margin-bottom:16px">
          <div style="display:flex;justify-content:space-between;margin-bottom:8px">
            <strong>Today's progress</strong><span class="muted">${doneToday} of ${today.length} done · ${pct}%</span>
          </div>
          <div class="progress"><div style="width:${pct}%"></div></div>
        </div>
        <div class="toolbar">${chips(Object.keys(filters), ui.todoFilter, 'dfilter', counts)}
          <span class="spacer"></span>
          ${counts.Completed ? '<button class="btn ghost small" data-act="clear-done">Clear completed</button>' : ''}
        </div>
        <div class="card">
          ${quickAdd()}
          ${items.length ? items.map(todoRow).join('') : emptyState('✓', 'No tasks here.')}
        </div>`;
    },

    notes() {
      const items = db.notes
        .filter(n => matches(n, ['title', 'body']))
        .sort((a, b) => (b.pinned - a.pinned) || (b.updated || b.created) - (a.updated || a.created));
      const cards = items.map(n => `
        <div class="card note" style="--note:${esc(n.color)}" data-act="edit" data-coll="notes" data-id="${n.id}">
          <div class="t">${n.pinned ? '📌' : ''}<span>${esc(n.title)}</span></div>
          <div class="b">${esc(n.body)}</div>
          <div class="d">Updated ${fmtTime(n.updated || n.created)}</div>
        </div>`).join('');
      return items.length ? `<div class="grid">${cards}</div>` : `<div class="card">${emptyState('✎', 'No notes yet.', 'notes')}</div>`;
    }
  };

  function todoSort(a, b) {
    const p = { High: 0, Medium: 1, Low: 2 };
    return (a.done - b.done) || (a.due || '9999').localeCompare(b.due || '9999') || (p[a.priority] - p[b.priority]) || a.created - b.created;
  }

  function todoRow(x) {
    const t = todayISO();
    const overdue = !x.done && x.due && x.due < t;
    return `
      <div class="todo${x.done ? ' done' : ''}">
        <input type="checkbox" class="chk" data-act="toggle" data-id="${x.id}" ${x.done ? 'checked' : ''} aria-label="Mark done">
        <div class="body">
          <div class="t">${esc(x.title)}</div>
          <div class="m">${pill(x.priority, true)}
            ${x.due ? `<span class="${overdue ? 'overdue' : ''}">📅 ${x.due === t ? 'Today' : fmtDate(x.due)}${overdue ? ' (overdue)' : ''}</span>` : ''}
            ${x.category ? `<span>🏷 ${esc(x.category)}</span>` : ''}</div>
          ${x.notes ? `<div class="n">${esc(x.notes)}</div>` : ''}
        </div>
        <button class="icon-btn sm" data-act="edit" data-coll="todos" data-id="${x.id}" title="Edit">✎</button>
      </div>`;
  }

  function quickAdd() {
    return `
      <form class="quick-add" data-form="quick-todo">
        <input name="title" placeholder="Add a task for today and press Enter…" autocomplete="off" aria-label="New task">
        <select name="priority" aria-label="Priority">${PRIORITIES.map(p => `<option${p === 'Medium' ? ' selected' : ''}>${p}</option>`).join('')}</select>
        <button class="btn primary" type="submit">Add</button>
      </form>`;
  }

  function updateBadges() {
    const t = todayISO();
    const open = count(db.handovers, h => h.status !== 'Completed');
    const due = count(db.todos, x => !x.done && x.due && x.due <= t);
    document.getElementById('badge-handovers').textContent = open || '';
    document.getElementById('badge-todos').textContent = due || '';
  }

  // ---------- Modal form ----------
  const $modal = document.getElementById('modal');
  const $form = document.getElementById('modal-form');
  const $body = document.getElementById('modal-body');
  const $del = document.getElementById('modal-delete');
  const $save = document.getElementById('modal-save');
  const $cancel = document.getElementById('modal-cancel');
  let editing = null; // { coll, id }

  function fieldHtml(f, v) {
    const id = 'f-' + f.key;
    const req = f.required ? ' <span style="color:var(--bad)">*</span>' : '';
    if (f.type === 'checkbox') {
      return `<div class="field check"><input type="checkbox" id="${id}" name="${f.key}" ${v ? 'checked' : ''}><label for="${id}">${esc(f.label)}</label></div>`;
    }
    let input;
    if (f.type === 'select') {
      input = `<select id="${id}" name="${f.key}">${f.options.map(o => `<option${o === v ? ' selected' : ''}>${esc(o)}</option>`).join('')}</select>`;
    } else if (f.type === 'textarea') {
      input = `<textarea id="${id}" name="${f.key}" rows="${f.rows || 4}" placeholder="${esc(f.placeholder || '')}">${esc(v)}</textarea>`;
    } else if (f.type === 'color') {
      input = `<div style="display:flex;gap:8px">${NOTE_COLORS.map(c => `
        <label style="cursor:pointer"><input type="radio" name="${f.key}" value="${c}" ${c === v ? 'checked' : ''} hidden>
        <span style="display:block;width:28px;height:28px;border-radius:50%;background:${c};outline:${c === v ? '3px solid var(--text)' : 'none'};outline-offset:2px" data-swatch></span></label>`).join('')}</div>`;
    } else {
      input = `<input id="${id}" name="${f.key}" type="${f.type === 'url' ? 'text' : f.type}" value="${esc(v)}" placeholder="${esc(f.placeholder || '')}" ${f.type === 'url' ? 'inputmode="url"' : ''}>`;
    }
    return `<div class="field"><label for="${id}">${esc(f.label)}${req}</label>${input}<span class="err" hidden></span></div>`;
  }

  function openModal(coll, id) {
    const schema = SCHEMAS[coll];
    const item = id ? find(coll, id) : schema.defaults();
    editing = { coll, id };
    document.getElementById('modal-title').textContent = (id ? 'Edit ' : 'New ') + schema.label.toLowerCase();
    $del.hidden = !id;
    $save.hidden = false;
    $cancel.textContent = 'Cancel';

    let html = '', halfBuf = [];
    const flush = () => { if (halfBuf.length) { html += `<div class="row2">${halfBuf.join('')}</div>`; halfBuf = []; } };
    schema.fields.forEach(f => {
      const h = fieldHtml(f, item[f.key] == null ? '' : item[f.key]);
      if (f.half) { halfBuf.push(h); if (halfBuf.length === 2) flush(); }
      else { flush(); html += h; }
    });
    flush();
    $body.innerHTML = html;
    $modal.hidden = false;
    const first = $body.querySelector('input:not([type=checkbox]):not([type=radio]), textarea');
    if (first) first.focus();
  }

  function closeModal() { $modal.hidden = true; editing = null; }

  $body.addEventListener('change', e => {
    if (e.target.type === 'radio') {
      $body.querySelectorAll('[data-swatch]').forEach(s => s.style.outline = 'none');
      e.target.nextElementSibling.style.outline = '3px solid var(--text)';
    }
  });

  $form.addEventListener('submit', e => {
    e.preventDefault();
    if (!editing) return;
    const { coll, id } = editing;
    const schema = SCHEMAS[coll];
    const data = {};
    let valid = true;
    schema.fields.forEach(f => {
      const el = $form.elements[f.key];
      let v;
      if (f.type === 'checkbox') v = el.checked;
      else if (f.type === 'color') v = ($form.querySelector(`input[name="${f.key}"]:checked`) || {}).value || NOTE_COLORS[0];
      else v = el.value.trim();
      if (f.type === 'url' && v && !/^[a-z][a-z0-9+.-]*:\/\//i.test(v)) v = 'https://' + v;
      const err = el && el.closest && el.closest('.field') && el.closest('.field').querySelector('.err');
      if (f.required && !v) {
        valid = false;
        if (err) { err.textContent = 'This field is required'; err.hidden = false; }
      } else if (err) err.hidden = true;
      data[f.key] = v;
    });
    if (!valid) return;

    const now = Date.now();
    if (id) Object.assign(find(coll, id), data, { updated: now });
    else db[coll].push(Object.assign({ id: uid(), created: now, updated: now }, data));
    save();
    closeModal();
    render();
    toast(`${schema.label} ${id ? 'updated' : 'added'}`);
  });

  $del.addEventListener('click', () => {
    if (!editing || !editing.id) return;
    const { coll, id } = editing;
    if (!confirm(`Delete this ${SCHEMAS[coll].label.toLowerCase()}?`)) return;
    db[coll] = db[coll].filter(x => x.id !== id);
    save();
    closeModal();
    render();
    toast(`${SCHEMAS[coll].label} deleted`);
  });

  $modal.addEventListener('click', e => {
    if (e.target === $modal || e.target.closest('[data-close]')) closeModal();
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && !$modal.hidden) closeModal();
  });

  // ---------- Event delegation ----------
  function go(view) {
    ui.view = view;
    ui.search = '';
    document.getElementById('search').value = '';
    document.getElementById('sidebar').classList.remove('open');
    try { history.replaceState(null, '', '#' + view); } catch (e) { /* ignore */ }
    render();
    window.scrollTo(0, 0);
  }

  document.getElementById('nav').addEventListener('click', e => {
    const b = e.target.closest('.nav-item');
    if (b) go(b.dataset.view);
  });

  $content.addEventListener('click', e => {
    const el = e.target.closest('[data-act]');
    if (!el || el.tagName === 'SELECT' || el.dataset.act === 'toggle') return;
    const { act, coll, id, val } = el.dataset;
    switch (act) {
      case 'go': go(val); break;
      case 'new': openModal(coll); break;
      case 'edit': openModal(coll, id); break;
      case 'hfilter': ui.handoverFilter = val; render(); break;
      case 'efilter': ui.envFilter = val; render(); break;
      case 'tfilter': ui.teamFilter = val; render(); break;
      case 'dfilter': ui.todoFilter = val; render(); break;
      case 'copy': copy(val); break;
      case 'clear-done':
        if (confirm('Remove all completed tasks?')) {
          db.todos = db.todos.filter(x => !x.done); save(); render(); toast('Completed tasks cleared');
        }
        break;
    }
  });

  $content.addEventListener('change', e => {
    const el = e.target;
    if (el.dataset.act === 'set') {
      const item = find(el.dataset.coll, el.dataset.id);
      if (item) { item[el.dataset.key] = el.value; item.updated = Date.now(); save(); render(); toast('Status updated'); }
    } else if (el.dataset.act === 'toggle') {
      const item = find('todos', el.dataset.id);
      if (item) {
        item.done = el.checked; item.updated = Date.now(); item.completedAt = el.checked ? Date.now() : null;
        save(); render();
        if (el.checked) toast('Nice work! Task completed ✓');
      }
    }
  });

  $content.addEventListener('submit', e => {
    if (e.target.dataset.form !== 'quick-todo') return;
    e.preventDefault();
    const title = e.target.elements.title.value.trim();
    if (!title) return;
    const now = Date.now();
    db.todos.push({ id: uid(), title, priority: e.target.elements.priority.value, due: todayISO(), category: '', notes: '', done: false, created: now, updated: now });
    save();
    render();
    const input = $content.querySelector('.quick-add input');
    if (input) input.focus();
  });

  document.getElementById('btn-add').addEventListener('click', () => { if (SCHEMAS[ui.view]) openModal(ui.view); });
  document.getElementById('btn-menu').addEventListener('click', () => document.getElementById('sidebar').classList.toggle('open'));

  let searchTimer;
  document.getElementById('search').addEventListener('input', e => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => { ui.search = e.target.value.trim(); render(); }, 150);
  });

  // ---------- Copy, toast ----------
  function copy(text) {
    const done = () => toast('Copied to clipboard');
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text).then(done, () => fallbackCopy(text, done));
    } else fallbackCopy(text, done);
  }
  function fallbackCopy(text, cb) {
    const ta = document.createElement('textarea');
    ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); cb(); } catch (e) { toast('Copy failed'); }
    ta.remove();
  }
  let toastTimer;
  function toast(msg) {
    const t = document.getElementById('toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('show'), 2200);
  }

  // ---------- Export / Import ----------
  document.getElementById('btn-export').addEventListener('click', () => {
    const blob = new Blob([serialize()], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `elm-team-hub-backup-${todayISO()}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    toast('Backup downloaded');
  });

  document.getElementById('file-import').addEventListener('change', e => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const next = parseBackup(reader.result);
        if (!confirm('Importing will replace all current data. Continue?')) return;
        db = next;
        save();
        render();
        toast('Data imported');
      } catch (err) {
        toast('Invalid backup file');
      } finally {
        e.target.value = '';
      }
    };
    reader.readAsText(file);
  });

  // ---------- Data file ----------
  // Chrome/Edge only: keep the data in a JSON file the user picks (e.g. next to index.html).
  // The file handle is remembered in IndexedDB; the browser may ask for permission again
  // on a later visit, which needs a click (the "Reconnect" banner).
  const FILE_TYPES = [{ description: 'ELM Team Hub data', accept: { 'application/json': ['.json'] } }];
  const fileApi = typeof window.showSaveFilePicker === 'function' && typeof window.showOpenFilePicker === 'function';
  // state: unsupported | none | connected | reconnect | error
  const df = { handle: null, state: fileApi ? 'none' : 'unsupported', lastSaved: 0, timer: null, queue: Promise.resolve() };

  function handleStore(action, value) {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open('elm-team-hub', 1);
      req.onupgradeneeded = () => req.result.createObjectStore('kv');
      req.onerror = () => reject(req.error);
      req.onsuccess = () => {
        const idb = req.result;
        const tx = idb.transaction('kv', action === 'get' ? 'readonly' : 'readwrite');
        const store = tx.objectStore('kv');
        const r = action === 'get' ? store.get('dataFile') : action === 'set' ? store.put(value, 'dataFile') : store.delete('dataFile');
        r.onsuccess = () => resolve(r.result);
        r.onerror = () => reject(r.error);
        tx.oncomplete = () => idb.close();
      };
    });
  }

  function scheduleFileWrite() {
    if (df.state !== 'connected') return;
    clearTimeout(df.timer);
    df.timer = setTimeout(() => { df.queue = df.queue.then(writeFile); }, 200);
  }

  async function writeFile() {
    if (!df.handle) return;
    try {
      const w = await df.handle.createWritable();
      await w.write(serialize());
      await w.close();
      df.lastSaved = Date.now();
      setSync({ fileSynced: df.lastSaved });
      df.state = 'connected';
    } catch (e) {
      df.state = 'error';
      toast('Could not save to the data file');
    }
    renderDataFile();
  }

  // mode: 'new' (empty file just created), 'open' (user chose to load it), 'reconnect' (remembered file)
  async function linkHandle(handle, mode) {
    if (mode !== 'new') {
      const text = await (await handle.getFile()).text();
      if (text.trim()) {
        const fileDb = parseBackup(text);
        const s = getSync();
        const unsaved = (s.localChanged || 0) > (s.fileSynced || 0);
        const keepLocal = mode === 'reconnect' && unsaved && confirm(
          `You made changes that were not saved to "${handle.name}".\n\n` +
          'OK = keep these changes and save them to the file\nCancel = discard them and load the file');
        if (!keepLocal) { db = fileDb; persistLocal(); render(); }
      }
    }
    df.handle = handle;
    df.state = 'connected';
    try { await handleStore('set', handle); } catch (e) { /* remembered for this visit only */ }
    await (df.queue = df.queue.then(writeFile));
    if (df.state !== 'connected') throw new Error('write failed');
  }

  function fileError(e, fallback) {
    if (e && e.name === 'AbortError') return; // user closed the picker
    toast(e && (e instanceof SyntaxError || e.message === 'bad file') ? 'That file is not ELM Team Hub data' : fallback);
  }

  async function createDataFile() {
    try {
      const h = await window.showSaveFilePicker({ suggestedName: 'elm-team-hub-data.json', types: FILE_TYPES });
      await linkHandle(h, 'new');
      closeModal();
      toast(`Now saving to ${h.name}`);
    } catch (e) { fileError(e, 'Could not create the file'); }
  }

  async function openDataFile() {
    try {
      const [h] = await window.showOpenFilePicker({ types: FILE_TYPES });
      if ((await h.requestPermission({ mode: 'readwrite' })) !== 'granted') return toast('Permission is needed to save to the file');
      const text = await (await h.getFile()).text();
      if (text.trim()) parseBackup(text); // reject a wrong file before asking
      if (!confirm(`Load the data from "${h.name}"?\nIt replaces the data currently shown.`)) return;
      await linkHandle(h, 'open');
      closeModal();
      toast(`Loaded and saving to ${h.name}`);
    } catch (e) { fileError(e, 'Could not open the file'); }
  }

  async function reconnectDataFile() {
    if (!df.handle) return;
    try {
      if ((await df.handle.requestPermission({ mode: 'readwrite' })) !== 'granted') return;
      await linkHandle(df.handle, 'reconnect');
      toast(`Connected to ${df.handle.name}`);
    } catch (e) {
      df.state = 'error';
      renderDataFile();
      fileError(e, 'Could not open the data file — it may have been moved or deleted');
    }
  }

  async function disconnectDataFile() {
    df.handle = null;
    df.state = 'none';
    try { await handleStore('del'); } catch (e) { /* ignore */ }
    closeModal();
    renderDataFile();
    toast('Data is now saved in this browser only');
  }

  function renderDataFile() {
    const name = df.handle ? df.handle.name : '';
    const view = {
      unsupported: ['idle', 'Saved in this browser only', 'Use Chrome or Edge to save to a file'],
      none: ['idle', 'Saved in this browser only', 'Click to save to a file in your folder'],
      connected: ['ok', `Saving to ${name}`, df.lastSaved ? 'Last saved ' + new Date(df.lastSaved).toLocaleTimeString(undefined, { timeStyle: 'short' }) : 'Connected'],
      reconnect: ['warn', `Reconnect ${name}`, 'Click to allow access'],
      error: ['bad', `Not saving to ${name}`, 'Click to reconnect']
    }[df.state];
    document.getElementById('df-dot').className = 'df-dot ' + view[0];
    document.getElementById('df-title').textContent = view[1];
    document.getElementById('df-sub').textContent = view[2];

    const needsClick = df.state === 'reconnect' || df.state === 'error';
    document.getElementById('df-banner').hidden = !needsClick;
    if (needsClick) {
      document.getElementById('df-banner-text').textContent = df.state === 'reconnect'
        ? `Click Reconnect so changes keep saving to your data file "${name}".`
        : `Changes are not being saved to "${name}". Reconnect, or choose the file again if you moved it.`;
    }
  }

  function openDataFileDialog() {
    editing = null;
    document.getElementById('modal-title').textContent = 'Data file';
    $del.hidden = true;
    $save.hidden = true;
    $cancel.textContent = 'Close';
    const name = df.handle ? esc(df.handle.name) : '';
    const tip = '<p class="muted">Tip: save it in your ELM Team Hub folder, next to <b>index.html</b>. Keep using Export now and then for extra backups.</p>';
    const body = {
      unsupported: `<p>Saving to a file needs <b>Google Chrome</b> or <b>Microsoft Edge</b>. This browser doesn't support it.</p>
        <p class="muted">Your data is still saved in this browser. Use <b>Export</b> to download backups.</p>`,
      none: `<p>Right now your data is saved <b>inside this browser only</b>. Link a data file to keep everything in a folder you choose; every change is saved to it automatically.</p>
        <div class="df-choices">
          <button type="button" class="btn primary" data-df="create">📄 Create a new data file</button>
          <button type="button" class="btn ghost" data-df="open">📂 Open an existing data file</button>
        </div>
        <p class="muted">Create a new file to start saving what you have now. Open an existing one (or a backup from Export) to load its data.</p>${tip}`,
      connected: `<p>✅ Your data is saved automatically to <b>${name}</b>${df.lastSaved ? ` (last saved ${esc(fmtTime(df.lastSaved))})` : ''}.</p>
        <div class="df-choices">
          <button type="button" class="btn ghost" data-df="open">📂 Switch to another file</button>
          <button type="button" class="btn ghost" data-df="create">📄 Save to a new file</button>
          <button type="button" class="btn danger ghost" data-df="disconnect">Stop saving to file</button>
        </div>${tip}`,
      reconnect: `<p>The browser needs your permission again to save to <b>${name}</b>.</p>
        <div class="df-choices"><button type="button" class="btn primary" data-df="reconnect">Reconnect</button>
        <button type="button" class="btn ghost" data-df="open">📂 Choose the file again</button></div>`,
      error: `<p>Changes can't be saved to <b>${name}</b>. It may have been moved, renamed or deleted.</p>
        <div class="df-choices"><button type="button" class="btn primary" data-df="reconnect">Try again</button>
        <button type="button" class="btn ghost" data-df="open">📂 Choose the file again</button>
        <button type="button" class="btn ghost" data-df="create">📄 Save to a new file</button></div>`
    }[df.state];
    $body.innerHTML = `<div class="df-dialog">${body}</div>`;
    $modal.hidden = false;
  }

  $body.addEventListener('click', e => {
    const b = e.target.closest('[data-df]');
    if (!b) return;
    ({ create: createDataFile, open: openDataFile, reconnect: reconnectDataFile, disconnect: disconnectDataFile })[b.dataset.df]();
  });
  document.getElementById('btn-datafile').addEventListener('click', openDataFileDialog);
  document.getElementById('df-banner-btn').addEventListener('click', reconnectDataFile);

  async function initDataFile() {
    if (fileApi) {
      let h = null;
      try { h = await handleStore('get'); } catch (e) { /* no remembered file */ }
      if (h) {
        df.handle = h;
        let perm = 'prompt';
        try { perm = await h.queryPermission({ mode: 'readwrite' }); } catch (e) { /* ask */ }
        if (perm === 'granted') {
          try { await linkHandle(h, 'reconnect'); } catch (e) { df.state = 'error'; }
        } else df.state = 'reconnect';
      }
    }
    renderDataFile();
  }

  // ---------- Theme ----------
  function applyTheme(theme) {
    if (theme) document.documentElement.dataset.theme = theme;
    else delete document.documentElement.dataset.theme;
  }
  try { applyTheme(localStorage.getItem(THEME_KEY)); } catch (e) { /* ignore */ }
  document.getElementById('btn-theme').addEventListener('click', () => {
    const current = document.documentElement.dataset.theme ||
      (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    const next = current === 'dark' ? 'light' : 'dark';
    applyTheme(next);
    try { localStorage.setItem(THEME_KEY, next); } catch (e) { /* ignore */ }
  });

  // ---------- Init ----------
  document.getElementById('today-label').textContent =
    new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const initial = location.hash.slice(1);
  if (VIEW_TITLES[initial]) ui.view = initial;
  updateBadges();
  render();
  initDataFile();
})();
