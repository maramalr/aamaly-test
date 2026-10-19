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
  // QA tracker statuses and meanings (same as the QA Daily Status Tracker workbook)
  const QA_STATUS = ['Not Started', 'In Progress', 'Waiting for Build', 'Blocked', 'On Hold', 'Done'];
  const QA_STATUS_HELP = {
    'Not Started': 'Assigned, testing not begun',
    'In Progress': 'Testing under way',
    'Waiting for Build': 'Ready to test, build not delivered yet',
    'Blocked': 'Cannot continue – write the reason in Notes',
    'On Hold': 'Paused by priority decision',
    'Done': 'Testing complete and signed off'
  };
  const SYSTEM_STATUS = ['Active', 'Release Week', 'Maintenance', 'On Hold'];

  const TONE = {
    'Waiting for Build': 't-warn', 'On Hold': 't-idle',
    'Active': 't-ok', 'Release Week': 't-info', 'Maintenance': 't-idle',
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
    },
    qaTasks: {
      label: 'QA task',
      fields: [
        { key: 'weekStart', label: 'Week (Sun – Thu)', type: 'select', options: () => weekOptions().map(w => ({ value: w, label: weekLabel(w) })), half: true },
        { key: 'status', label: 'Status', type: 'select', options: QA_STATUS, half: true },
        { key: 'member', label: 'Team member', type: 'select', options: () => memberNames(), required: true, half: true },
        { key: 'system', label: 'System', type: 'select', options: () => systemNames(), required: true, half: true },
        { key: 'task', label: 'Current task', type: 'text', required: true },
        { key: 'build', label: 'Build name', type: 'text', half: true },
        { key: 'testPlan', label: 'Test plan (link or name)', type: 'text', half: true },
        { key: 'due', label: 'Due date', type: 'date', half: true },
        { key: 'expectedBuild', label: 'Expected coming build', type: 'text', half: true },
        { key: 'notes', label: 'Blockers / notes', type: 'textarea' }
      ],
      defaults: () => ({ weekStart: ui.qaWeek !== 'All' ? ui.qaWeek : weekStartOf(todayISO()), status: 'Not Started' })
    },
    systems: {
      label: 'System',
      fields: [
        { key: 'name', label: 'System name', type: 'text', required: true, placeholder: 'e.g. Payment Portal EPG' },
        { key: 'status', label: 'Status', type: 'select', options: SYSTEM_STATUS },
        { key: 'notes', label: 'Notes', type: 'textarea', placeholder: 'Owner, environments, release dates…' }
      ],
      defaults: () => ({ status: 'Active' })
    }
  };

  const VIEW_TITLES = {
    dashboard: 'Dashboard', handovers: 'Handovers', urls: 'Test URLs',
    team: 'Team Status', qaTasks: 'QA Tracker', reports: 'Reports', systems: 'Systems',
    todos: 'To-Do List', notes: 'Notes'
  };

  // ---------- State ----------
  let db = load();
  const ui = {
    view: 'dashboard',
    search: '',
    handoverFilter: 'All',
    envFilter: 'All',
    teamFilter: 'All',
    todoFilter: 'Today',
    qaWeek: weekStartOf(todayISO()),
    qaStatus: 'All',
    qaMember: 'All',
    qaSystem: 'All',
    reportTab: 'daily',
    reportDate: todayISO(),
    reportWeek: weekStartOf(todayISO())
  };

  function emptyDb() {
    return { handovers: [], urls: [], team: [], todos: [], notes: [], qaTasks: [], systems: [] };
  }

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return Object.assign(emptyDb(), JSON.parse(raw));
    } catch (e) { /* storage unavailable or corrupted: start fresh */ }
    return Object.assign(emptyDb(), seed());
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
  function isoOf(d) { return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10); }
  function todayISO() { return isoOf(new Date()); }
  function addDays(iso, n) { const d = new Date(iso + 'T00:00:00'); d.setDate(d.getDate() + n); return isoOf(d); }
  // QA weeks run Sunday – Thursday and are identified by their Sunday date.
  function weekStartOf(iso) { const d = new Date(iso + 'T00:00:00'); return addDays(iso, -d.getDay()); }
  function weekLabel(ws) {
    if (!ws) return '';
    const s = new Date(ws + 'T00:00:00'), e = new Date(addDays(ws, 4) + 'T00:00:00');
    const dm = d => d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
    return `${dm(s)} – ${dm(e)} ${e.getFullYear()}`;
  }
  // Weeks offered in pickers: 4 back to 8 ahead of this week, plus any week that has tasks.
  function weekOptions() {
    const cur = weekStartOf(todayISO());
    const set = new Set(db.qaTasks.map(t => t.weekStart).filter(Boolean));
    for (let i = -4; i <= 8; i++) set.add(addDays(cur, i * 7));
    return [...set].sort();
  }
  function daysBetween(a, b) { return Math.round((new Date(b + 'T00:00:00') - new Date(a + 'T00:00:00')) / 86400000); }
  function memberNames() { return db.team.map(m => m.name).filter(Boolean).sort((a, b) => a.localeCompare(b)); }
  function systemNames() { return db.systems.map(s => s.name).filter(Boolean).sort((a, b) => a.localeCompare(b)); }
  function sameName(a, b) { return String(a || '').trim().toLowerCase() === String(b || '').trim().toLowerCase(); }
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
  function importExcelButton(primary) {
    return `<label class="btn ${primary ? 'primary' : 'ghost'} small" title="Read team members, systems and tasks from your QA Daily Status Tracker (.xlsx)">⤒ Import Excel tracker
      <input type="file" data-act="import-xlsx" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" hidden></label>`;
  }
  function selectHtml(key, options, value, allLabel) {
    return `<select class="inline-select" data-act="ui" data-key="${key}" aria-label="${esc(allLabel || 'Week')}">
      ${allLabel ? `<option value="All">${esc(allLabel)}</option>` : ''}
      ${options.map(o => typeof o === 'object' ? o : { value: o, label: o }).map(o => `<option value="${esc(o.value)}"${o.value === value ? ' selected' : ''}>${esc(o.label)}</option>`).join('')}</select>`;
  }
  function dueCell(t, refDate) {
    if (!t.due) return '<span class="muted">—</span>';
    const d = daysBetween(refDate || todayISO(), t.due);
    const late = d < 0 && t.status !== 'Done';
    return `${fmtDate(t.due)}<div class="desc${late ? ' overdue' : ''}">${t.status === 'Done' ? 'Done' : d < 0 ? `${-d} day${d === -1 ? '' : 's'} overdue` : d === 0 ? 'Due today' : `${d} day${d === 1 ? '' : 's'} left`}</div>`;
  }
  function linkOrText(v) {
    const u = safeUrl(v);
    return u ? `<a href="${esc(u)}" target="_blank" rel="noopener">${esc(v)}</a>` : esc(v);
  }
  function chips(options, active, act, counts) {
    return options.map(o => `<button class="chip${o === active ? ' active' : ''}" data-act="${act}" data-val="${esc(o)}">${esc(o)}${counts ? `<span class="n">${counts[o] || 0}</span>` : ''}</button>`).join('');
  }

  // ---------- Rendering ----------
  const $content = document.getElementById('content');

  function render() {
    document.getElementById('view-title').textContent = VIEW_TITLES[ui.view];
    document.querySelectorAll('.nav-item').forEach(b => b.classList.toggle('active', b.dataset.view === ui.view));
    document.getElementById('btn-add').style.visibility = SCHEMAS[ui.view] ? 'visible' : 'hidden';
    document.querySelector('.search').style.display = ui.view === 'dashboard' || ui.view === 'reports' ? 'none' : '';
    $content.innerHTML = VIEWS[ui.view]();
  }

  const VIEWS = {
    qaTasks() {
      const inWeek = db.qaTasks.filter(t => ui.qaWeek === 'All' || t.weekStart === ui.qaWeek);
      const scoped = inWeek
        .filter(t => ui.qaMember === 'All' || t.member === ui.qaMember)
        .filter(t => ui.qaSystem === 'All' || t.system === ui.qaSystem);
      const counts = { All: scoped.length };
      QA_STATUS.forEach(s => counts[s] = count(scoped, t => t.status === s));
      const items = scoped
        .filter(t => ui.qaStatus === 'All' || t.status === ui.qaStatus)
        .filter(t => matches(t, ['member', 'system', 'task', 'build', 'testPlan', 'status', 'expectedBuild', 'notes']))
        .sort((a, b) => (b.weekStart || '').localeCompare(a.weekStart || '') || (a.member || '').localeCompare(b.member || '') || a.created - b.created);
      const showWeek = ui.qaWeek === 'All';
      const unfinished = count(inWeek, t => t.status !== 'Done');

      const rows = items.map(t => `
        <tr>
          ${showWeek ? `<td class="nowrap">${esc(weekLabel(t.weekStart))}</td>` : ''}
          <td class="nowrap"><strong>${esc(t.member)}</strong></td>
          <td>${esc(t.system)}</td>
          <td><div class="title">${esc(t.task)}</div>${t.notes ? `<div class="desc">📝 ${esc(t.notes)}</div>` : ''}</td>
          <td class="hide-sm">${esc(t.build)}${t.expectedBuild ? `<div class="desc">Next: ${esc(t.expectedBuild)}</div>` : ''}</td>
          <td class="hide-sm">${linkOrText(t.testPlan)}</td>
          <td><select class="inline-select" data-act="set" data-coll="qaTasks" data-id="${t.id}" data-key="status">
            ${QA_STATUS.map(s => `<option${s === t.status ? ' selected' : ''}>${s}</option>`).join('')}</select></td>
          <td class="nowrap">${dueCell(t)}</td>
          <td><div class="actions">
            ${t.status !== 'Done' ? `<button class="icon-btn sm" data-act="next-week" data-id="${t.id}" title="Copy to next week">↪</button>` : ''}
            <button class="icon-btn sm" data-act="edit" data-coll="qaTasks" data-id="${t.id}" title="Edit">✎</button></div></td>
        </tr>`).join('');

      const empty = db.qaTasks.length
        ? emptyState('📋', 'No QA tasks match this week and filters.', 'qaTasks')
        : `<div class="empty"><div class="big">📋</div><div>No QA tasks yet.</div>
            <p>Import your <b>QA Daily Status Tracker</b> Excel file to bring in team members, systems and tasks, or add a task by hand.</p>
            <p class="row-gap">${importExcelButton(true)} <button class="btn ghost small" data-act="new" data-coll="qaTasks">+ Add QA task</button></p></div>`;

      return `
        <div class="toolbar">
          ${selectHtml('qaWeek', weekOptions().map(w => ({ value: w, label: (w === weekStartOf(todayISO()) ? 'This week · ' : '') + weekLabel(w) })), ui.qaWeek, 'All weeks')}
          ${selectHtml('qaMember', memberNames(), ui.qaMember, 'All team members')}
          ${selectHtml('qaSystem', systemNames(), ui.qaSystem, 'All systems')}
          <span class="spacer"></span>
          ${ui.qaWeek !== 'All' && unfinished ? `<button class="btn ghost small" data-act="carry-over" title="Copy every task that is not Done to next week">↪ Carry ${unfinished} unfinished to next week</button>` : ''}
          ${importExcelButton(false)}
        </div>
        <div class="toolbar">${chips(['All', ...QA_STATUS], ui.qaStatus, 'qastatus', counts)}</div>
        <div class="card">${items.length ? `
          <div class="table-wrap"><table>
            <thead><tr>${showWeek ? '<th>Week</th>' : ''}<th>Team member</th><th>System</th><th>Current task</th><th class="hide-sm">Build</th><th class="hide-sm">Test plan</th><th>Status</th><th>Due</th><th></th></tr></thead>
            <tbody>${rows}</tbody></table></div>` : empty}
        </div>
        <details class="legend"><summary>Status meanings</summary>
          <ul>${QA_STATUS.map(s => `<li>${pill(s)} ${esc(QA_STATUS_HELP[s])}</li>`).join('')}</ul>
          <p class="muted">Keep one row per task per week and update it during the week. At the end of the week use “Carry unfinished to next week”.</p>
        </details>`;
    },

    reports() {
      const daily = ui.reportTab === 'daily';
      const refDate = daily ? (ui.reportDate || todayISO()) : todayISO();
      const ws = daily ? weekStartOf(refDate) : ui.reportWeek;
      const r = buildReport(ws, refDate);
      const statTile = (label, value, sub, cls) => `<div class="card stat${cls ? ' ' + cls : ''}"><span class="label">${label}</span><span class="value">${value}</span><span class="sub">${sub}</span></div>`;
      const sum = (rows, label) => `
        <div class="table-wrap"><table class="report">
          <thead><tr><th>${label}</th>${QA_STATUS.map(s => `<th class="num">${esc(s)}</th>`).join('')}<th class="num">Total</th><th class="num">Overdue</th></tr></thead>
          <tbody>${rows.map(x => `<tr><td>${esc(x.name)}</td>${x.counts.map(n => `<td class="num${n ? '' : ' zero'}">${n}</td>`).join('')}<td class="num"><b>${x.total}</b></td><td class="num${x.overdue ? ' overdue' : ' zero'}">${x.overdue}</td></tr>`).join('')}</tbody>
          <tfoot><tr><td>Total</td>${r.totals.counts.map(n => `<td class="num">${n}</td>`).join('')}<td class="num">${r.totals.total}</td><td class="num${r.totals.overdue ? ' overdue' : ''}">${r.totals.overdue}</td></tr></tfoot>
        </table></div>`;
      const details = r.tasks.map(t => `
        <tr><td class="nowrap"><strong>${esc(t.member)}</strong></td><td>${esc(t.system)}</td>
          <td><div class="title">${esc(t.task)}</div>${t.notes ? `<div class="desc">📝 ${esc(t.notes)}</div>` : ''}</td>
          <td class="hide-sm">${esc(t.build)}${t.expectedBuild ? `<div class="desc">Next: ${esc(t.expectedBuild)}</div>` : ''}</td>
          <td>${pill(t.status)}</td><td class="nowrap">${dueCell(t, refDate)}</td></tr>`).join('');
      const c = name => r.totals.counts[QA_STATUS.indexOf(name)];

      return `
        <div class="toolbar no-print">
          ${chips(['Daily report', 'Weekly report'], daily ? 'Daily report' : 'Weekly report', 'rtab')}
          ${daily
            ? `<label class="muted">Date <input type="date" class="inline-select" data-act="ui" data-key="reportDate" value="${esc(refDate)}"></label>`
            : selectHtml('reportWeek', weekOptions().map(w => ({ value: w, label: (w === weekStartOf(todayISO()) ? 'This week · ' : '') + weekLabel(w) })), ws, null)}
          <span class="spacer"></span>
          <button class="btn ghost small" data-act="copy-report">⧉ Copy as text</button>
          <button class="btn ghost small" data-act="print">🖨 Print / PDF</button>
          <button class="btn primary small" data-act="xlsx" title="Summary and task sheets with live formulas">⤓ Export to Excel</button>
        </div>
        <div class="report-head">
          <h2>QA ${daily ? 'Daily' : 'Weekly'} Report</h2>
          <div class="muted">Week ${esc(weekLabel(ws))} (Sunday – Thursday)${daily ? ` · Status as of ${esc(fmtDate(refDate))}` : ''} · Overdue = due before ${esc(fmtDate(refDate))} and not Done</div>
        </div>
        <div class="stats">
          ${statTile('Total tasks', r.totals.total, `${r.activeMembers} of ${r.byMember.length} team members`, 'accent')}
          ${statTile('In progress', c('In Progress'), `${c('Not Started')} not started`)}
          ${statTile('Waiting / blocked', c('Waiting for Build') + c('Blocked'), `${c('On Hold')} on hold`)}
          ${statTile('Done', c('Done'), r.totals.overdue ? `<span class="overdue">${r.totals.overdue} overdue</span>` : '0 overdue')}
        </div>
        ${r.tasks.length ? '' : `<div class="card empty no-print">No QA tasks in this week. Add tasks in the <button class="link-btn" data-act="go" data-val="qaTasks">QA Tracker</button>.</div>`}
        <div class="card card-pad report-block"><h3>👥 By team member</h3>${sum(r.byMember, 'Team member')}</div>
        <div class="card card-pad report-block"><h3>🖥 By system</h3>${sum(r.bySystem, 'System')}</div>
        ${r.tasks.length ? `<div class="card report-block"><div class="card-pad" style="padding-bottom:0"><h3>📋 Task details</h3></div>
          <div class="table-wrap"><table><thead><tr><th>Team member</th><th>System</th><th>Task</th><th class="hide-sm">Build</th><th>Status</th><th>Due</th></tr></thead>
          <tbody>${details}</tbody></table></div></div>` : ''}`;
    },

    systems() {
      const ws = weekStartOf(todayISO());
      const items = db.systems.filter(s => matches(s, ['name', 'status', 'notes'])).sort((a, b) => a.name.localeCompare(b.name));
      const cards = items.map(s => {
        const tasks = db.qaTasks.filter(t => t.weekStart === ws && sameName(t.system, s.name));
        const people = [...new Set(tasks.map(t => t.member))];
        const breakdown = QA_STATUS.map(st => [st, count(tasks, t => t.status === st)]).filter(x => x[1]);
        return `
        <div class="card member">
          <div class="top">
            <div class="avatar" style="background:${avatarColor(s.name)}">${esc(initials(s.name))}</div>
            <div class="who"><div class="n">${esc(s.name)}</div><div class="r">${tasks.length} QA task${tasks.length === 1 ? '' : 's'} this week</div></div>
            <button class="icon-btn sm" data-act="edit" data-coll="systems" data-id="${s.id}" title="Edit">✎</button>
          </div>
          <div class="bottom">
            <select class="inline-select" data-act="set" data-coll="systems" data-id="${s.id}" data-key="status" title="System status">
              ${SYSTEM_STATUS.map(x => `<option${x === s.status ? ' selected' : ''}>${x}</option>`).join('')}</select>
          </div>
          ${breakdown.length ? `<div class="bottom">${breakdown.map(([st, n]) => pill(`${st} ${n}`, true).replace('t-idle', TONE[st] || 't-idle')).join(' ')}</div>` : ''}
          ${people.length ? `<div class="bottom">👥 ${people.map(esc).join(', ')}</div>` : ''}
          ${s.notes ? `<div class="task">${esc(s.notes)}</div>` : ''}
          <div class="bottom"><button class="link-btn" data-act="qa-system" data-val="${esc(s.name)}">View tasks →</button></div>
        </div>`;
      }).join('');
      return `
        <div class="toolbar"><span class="muted">Task counts are for this week (${esc(weekLabel(ws))}).</span><span class="spacer"></span>${importExcelButton(false)}</div>
        ${items.length ? `<div class="grid">${cards}</div>` : `<div class="card">${emptyState('🖥', 'No systems yet. Add them here or import your Excel tracker.', 'systems')}</div>`}`;
    },

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
            ${qaCard()}
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
            ${qaLine(m.name)}
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

  // "📋 2 QA tasks this week (1 In Progress…)" on a team member card
  function qaLine(name) {
    const ws = weekStartOf(todayISO());
    const list = db.qaTasks.filter(t => t.weekStart === ws && sameName(t.member, name));
    if (!list.length) return '';
    return `<button class="link-btn" data-act="qa-member" data-val="${esc(name)}">📋 ${list.length} QA task${list.length === 1 ? '' : 's'} this week</button>`;
  }

  // Dashboard card: this week's QA tasks by status
  function qaCard() {
    if (!db.qaTasks.length) return '';
    const ws = weekStartOf(todayISO());
    const r = buildReport(ws, todayISO());
    const parts = QA_STATUS.map((s, i) => r.totals.counts[i] ? pill(`${s} ${r.totals.counts[i]}`, true).replace('t-idle', TONE[s] || 't-idle') : '').join(' ');
    return `<div class="card card-pad"><h3>📋 QA this week <button class="link" data-act="go" data-val="reports">Reports →</button></h3>
      <div class="muted" style="margin-bottom:8px">${esc(weekLabel(ws))} · ${r.totals.total} task${r.totals.total === 1 ? '' : 's'}${r.totals.overdue ? ` · <span class="overdue">${r.totals.overdue} overdue</span>` : ''}</div>
      <div class="pills">${parts || '<span class="muted">No tasks yet this week</span>'}</div></div>`;
  }

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
      // options may be a list or a function (e.g. current team members), as strings or { value, label }
      const dynamic = typeof f.options === 'function';
      const opts = (dynamic ? f.options() : f.options).map(o => typeof o === 'object' ? o : { value: o, label: o });
      if (v && !opts.some(o => o.value === v)) opts.unshift({ value: v, label: v });
      if (dynamic && f.required) opts.unshift({ value: '', label: '— Select —' });
      input = `<select id="${id}" name="${f.key}">${opts.map(o => `<option value="${esc(o.value)}"${o.value === v ? ' selected' : ''}>${esc(o.label)}</option>`).join('')}</select>`;
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
    else {
      db[coll].push(Object.assign({ id: uid(), created: now, updated: now }, data));
      // Show the new item even if the current tab or search would hide it.
      const filterKey = { handovers: 'handoverFilter', urls: 'envFilter', team: 'teamFilter', todos: 'todoFilter', qaTasks: 'qaStatus' }[coll];
      if (filterKey) ui[filterKey] = 'All';
      if (coll === 'qaTasks') { ui.qaMember = ui.qaSystem = 'All'; ui.qaWeek = data.weekStart; }
      clearSearch();
    }
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
      case 'qastatus': ui.qaStatus = val; render(); break;
      case 'rtab': ui.reportTab = val === 'Daily report' ? 'daily' : 'weekly'; render(); break;
      case 'qa-member': ui.qaMember = val; ui.qaSystem = ui.qaStatus = 'All'; ui.qaWeek = weekStartOf(todayISO()); go('qaTasks'); break;
      case 'qa-system': ui.qaSystem = val; ui.qaMember = ui.qaStatus = 'All'; ui.qaWeek = weekStartOf(todayISO()); go('qaTasks'); break;
      case 'copy-report': copy(reportText()); break;
      case 'print': window.print(); break;
      case 'xlsx': exportXlsx(); break;
      case 'next-week': {
        const t = find('qaTasks', id);
        if (!t) break;
        const n = copyToNextWeek([t]);
        save(); render();
        toast(n ? `Copied to ${weekLabel(addDays(t.weekStart, 7))}` : 'Already in next week');
        break;
      }
      case 'carry-over': {
        const next = addDays(ui.qaWeek, 7);
        const n = copyToNextWeek(db.qaTasks.filter(t => t.weekStart === ui.qaWeek && t.status !== 'Done'));
        ui.qaWeek = next;
        save(); render();
        toast(n ? `Carried ${n} task${n === 1 ? '' : 's'} over to ${weekLabel(next)}` : 'These tasks are already in next week');
        break;
      }
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
    } else if (el.dataset.act === 'ui') {
      if (el.value || el.type !== 'date') { ui[el.dataset.key] = el.value; render(); }
    } else if (el.dataset.act === 'import-xlsx') {
      if (el.files[0]) importExcel(el.files[0]);
      el.value = '';
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
    const field = e.target.elements.title;
    const title = field.value.trim();
    if (!title) {
      field.classList.add('invalid');
      field.focus();
      toast('Type a task first, then click Add');
      return;
    }
    const now = Date.now();
    db.todos.push({ id: uid(), title, priority: e.target.elements.priority.value, due: todayISO(), category: '', notes: '', done: false, created: now, updated: now });
    // The new task is due today: switch away from a tab or search that would hide it.
    if (ui.view === 'todos' && ui.todoFilter !== 'Today' && ui.todoFilter !== 'All') ui.todoFilter = 'Today';
    clearSearch();
    save();
    render();
    toast('Task added');
    const input = $content.querySelector('.quick-add input');
    if (input) input.focus();
  });

  $content.addEventListener('input', e => {
    if (e.target.classList.contains('invalid')) e.target.classList.remove('invalid');
  });

  function clearSearch() {
    ui.search = '';
    document.getElementById('search').value = '';
  }

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

  // ---------- QA reports ----------
  // Counts each task row of the week once, with its current status. Overdue = due before refDate and not Done.
  function buildReport(ws, refDate) {
    const tasks = db.qaTasks.filter(t => t.weekStart === ws)
      .sort((a, b) => (a.member || '').localeCompare(b.member || '') || (a.system || '').localeCompare(b.system || ''));
    const isOverdue = t => t.due && t.due < refDate && t.status !== 'Done';
    const row = (name, list) => ({ name, counts: QA_STATUS.map(s => count(list, t => t.status === s)), total: list.length, overdue: count(list, isOverdue) });
    const names = (base, key) => {
      const out = base.slice();
      tasks.forEach(t => { if (t[key] && !out.some(n => sameName(n, t[key]))) out.push(t[key]); });
      return out;
    };
    const byMember = names(memberNames(), 'member').map(n => row(n, tasks.filter(t => sameName(t.member, n))));
    const bySystem = names(systemNames(), 'system').map(n => row(n, tasks.filter(t => sameName(t.system, n))));
    return { ws, refDate, tasks, byMember, bySystem, totals: row('Total', tasks), activeMembers: count(byMember, m => m.total) };
  }

  function reportText() {
    const daily = ui.reportTab === 'daily';
    const refDate = daily ? (ui.reportDate || todayISO()) : todayISO();
    const r = buildReport(daily ? weekStartOf(refDate) : ui.reportWeek, refDate);
    const breakdown = counts => QA_STATUS.map((s, i) => counts[i] ? `${s} ${counts[i]}` : '').filter(Boolean).join(', ');
    const lines = [
      `QA ${daily ? 'Daily' : 'Weekly'} Report – ${daily ? fmtDate(refDate) + ' – ' : ''}Week ${weekLabel(r.ws)}`,
      `Total tasks: ${r.totals.total}${r.totals.total ? ` (${breakdown(r.totals.counts)})` : ''} · Overdue: ${r.totals.overdue}`,
      '', 'By team member:'
    ];
    r.byMember.filter(m => m.total).forEach(m => lines.push(`- ${m.name}: ${m.total} task${m.total === 1 ? '' : 's'} (${breakdown(m.counts)})${m.overdue ? ` – ${m.overdue} overdue` : ''}`));
    const idle = r.byMember.filter(m => !m.total).map(m => m.name);
    if (idle.length) lines.push(`- No tasks: ${idle.join(', ')}`);
    lines.push('', 'By system:');
    r.bySystem.filter(s => s.total).forEach(s => lines.push(`- ${s.name}: ${s.total} (${breakdown(s.counts)})${s.overdue ? ` – ${s.overdue} overdue` : ''}`));
    if (r.tasks.length) {
      lines.push('', 'Task details:');
      r.tasks.forEach(t => {
        lines.push(`• ${t.member} | ${t.system} | ${t.task} | ${t.status}${t.build ? ` | Build: ${t.build}` : ''}${t.due ? ` | Due ${fmtDate(t.due)}` : ''}`);
        if (t.notes) lines.push(`    Notes: ${t.notes}`);
      });
    }
    return lines.join('\n');
  }

  // ---------- Excel (.xlsx) export ----------
  // Builds a real Excel workbook (zip of XML files) with a Summary sheet (COUNTIFS formulas over
  // the Tasks sheet, with their current values cached) and a Tasks sheet in the tracker's columns.
  const CRC_TABLE = (() => {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; }
    return t;
  })();
  function crc32(u8) { let c = 0xFFFFFFFF; for (let i = 0; i < u8.length; i++) c = CRC_TABLE[(c ^ u8[i]) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }

  function zipStore(files) {
    const enc = new TextEncoder(), parts = [], central = [];
    let offset = 0;
    files.forEach(f => {
      const name = enc.encode(f.name), data = enc.encode(f.text), crc = crc32(data);
      const h = new DataView(new ArrayBuffer(30));
      h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint16(6, 0x0800, true); h.setUint16(12, 0x21, true);
      h.setUint32(14, crc, true); h.setUint32(18, data.length, true); h.setUint32(22, data.length, true); h.setUint16(26, name.length, true);
      parts.push(h, name, data);
      const c = new DataView(new ArrayBuffer(46));
      c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint16(8, 0x0800, true); c.setUint16(14, 0x21, true);
      c.setUint32(16, crc, true); c.setUint32(20, data.length, true); c.setUint32(24, data.length, true); c.setUint16(28, name.length, true); c.setUint32(42, offset, true);
      central.push(c, name);
      offset += 30 + name.length + data.length;
    });
    const size = central.reduce((n, x) => n + x.byteLength, 0);
    const e = new DataView(new ArrayBuffer(22));
    e.setUint32(0, 0x06054b50, true); e.setUint16(8, files.length, true); e.setUint16(10, files.length, true); e.setUint32(12, size, true); e.setUint32(16, offset, true);
    return new Blob([...parts, ...central, e], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  }

  function xmlEsc(v) {
    return String(v).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  }
  function colName(i) { let s = ''; for (i++; i; i = Math.floor((i - 1) / 26)) s = String.fromCharCode(65 + (i - 1) % 26) + s; return s; }
  function dateSerial(iso) { return Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10)) / 86400000 + 25569; }

  // rows: arrays of cells; a cell is a string, a number, or { v, s: styleIndex, f: formula }
  function sheetXml(rows, { widths, freeze, filter }) {
    const body = rows.map((r, ri) => `<row r="${ri + 1}">${(r || []).map((cell, ci) => {
      if (cell == null || cell === '') return '';
      const o = typeof cell === 'object' ? cell : { v: cell };
      const ref = colName(ci) + (ri + 1), st = o.s ? ` s="${o.s}"` : '';
      if (o.f) return `<c r="${ref}"${st}${typeof o.v === 'number' ? '' : ' t="str"'}><f>${xmlEsc(o.f)}</f>${o.v === '' || o.v == null ? '' : `<v>${xmlEsc(o.v)}</v>`}</c>`;
      if (typeof o.v === 'number') return `<c r="${ref}"${st}><v>${o.v}</v></c>`;
      return `<c r="${ref}"${st} t="inlineStr"><is><t xml:space="preserve">${xmlEsc(o.v)}</t></is></c>`;
    }).join('')}</row>`).join('');
    return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
      (freeze ? `<sheetViews><sheetView workbookViewId="0"><pane ySplit="${freeze}" topLeftCell="A${freeze + 1}" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>` : '') +
      `<cols>${widths.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join('')}</cols>` +
      `<sheetData>${body}</sheetData>${filter ? `<autoFilter ref="${filter}"/>` : ''}</worksheet>`;
  }

  function exportXlsx() {
    const daily = ui.reportTab === 'daily';
    const refDate = daily ? (ui.reportDate || todayISO()) : todayISO();
    const today = todayISO();
    const r = buildReport(daily ? weekStartOf(refDate) : ui.reportWeek, refDate);
    const S = { header: 1, bold: 2, title: 3, date: 4, wrap: 5, num: 6, boldNum: 7 };

    // Tasks sheet: A Week, B Team Member, C System, D Task, E Build, F Test Plan, G Status, H Due, I Expected build, J Notes, K Days to Due
    const head = ['Week', 'Team Member', 'System', 'Current Task', 'Build Name', 'Test Plan URL', 'Status', 'Due Date', 'Expected Coming Build', 'Blockers / Notes', 'Days to Due'];
    const taskRows = [head.map(h => ({ v: h, s: S.header }))];
    r.tasks.forEach((t, i) => {
      const row = i + 2;
      taskRows.push([weekLabel(t.weekStart), t.member, t.system, { v: t.task, s: S.wrap }, { v: t.build, s: S.wrap }, t.testPlan, t.status,
        t.due ? { v: dateSerial(t.due), s: S.date } : '', t.expectedBuild, { v: t.notes, s: S.wrap },
        { f: `IF(H${row}="","",H${row}-TODAY())`, v: t.due ? daysBetween(today, t.due) : '' }]);
    });
    const last = Math.max(2, r.tasks.length + 1);
    const rng = col => `Tasks!$${col}$2:$${col}$${last}`;

    // Summary sheet
    const sum = [
      [{ v: `QA ${daily ? 'Daily' : 'Weekly'} Report`, s: S.title }],
      ['Week (Sun – Thu)', weekLabel(r.ws)],
      ['Status as of', { v: dateSerial(refDate), s: S.date }],
      ['Overdue = due before the "Status as of" date and not Done. Counts are formulas on the Tasks sheet and update if you edit it.'],
      []
    ];
    const table = (title, rows, col) => {
      sum.push([{ v: title, s: S.bold }]);
      const hr = sum.length + 1;
      sum.push([title === 'By team member' ? 'Team Member' : 'System', ...QA_STATUS, 'Total', 'Overdue'].map(h => ({ v: h, s: S.header })));
      const first = sum.length + 1;
      rows.forEach(x => {
        const rr = sum.length + 1;
        sum.push([x.name,
          ...QA_STATUS.map((st, i) => ({ f: `COUNTIFS(${rng(col)},$A${rr},${rng('G')},${colName(i + 1)}$${hr})`, v: x.counts[i], s: S.num })),
          { f: `SUM(B${rr}:G${rr})`, v: x.total, s: S.boldNum },
          { f: `COUNTIFS(${rng(col)},$A${rr},${rng('H')},"<"&$B$3,${rng('G')},"<>Done")`, v: x.overdue, s: S.num }]);
      });
      const end = sum.length;
      const totals = [...r.totals.counts, r.totals.total, r.totals.overdue];
      sum.push([{ v: 'Total', s: S.bold }, ...totals.map((v, i) => ({ f: rows.length ? `SUM(${colName(i + 1)}${first}:${colName(i + 1)}${end})` : '0', v: rows.length ? v : 0, s: S.boldNum }))]);
      sum.push([]);
    };
    table('By team member', r.byMember, 'B');
    table('By system', r.bySystem, 'C');

    const styles = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
      '<numFmts count="1"><numFmt numFmtId="164" formatCode="dd-mmm-yyyy"/></numFmts>' +
      '<fonts count="4"><font><sz val="10"/><name val="Arial"/></font><font><b/><sz val="10"/><color rgb="FFFFFFFF"/><name val="Arial"/></font>' +
      '<font><b/><sz val="10"/><name val="Arial"/></font><font><b/><sz val="14"/><name val="Arial"/></font></fonts>' +
      '<fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill>' +
      '<fill><patternFill patternType="solid"><fgColor rgb="FF00897B"/><bgColor indexed="64"/></patternFill></fill></fills>' +
      '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>' +
      '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
      '<cellXfs count="8"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>' +
      '<xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf>' +
      '<xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1"/>' +
      '<xf numFmtId="0" fontId="3" fillId="0" borderId="0" xfId="0" applyFont="1"/>' +
      '<xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1" applyAlignment="1"><alignment horizontal="left"/></xf>' +
      '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>' +
      '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment horizontal="center"/></xf>' +
      '<xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1" applyAlignment="1"><alignment horizontal="center"/></xf></cellXfs>' +
      '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>';
    const ns = 'http://schemas.openxmlformats.org';
    const files = [
      { name: '[Content_Types].xml', text: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="${ns}/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/worksheets/sheet2.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>` },
      { name: '_rels/.rels', text: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="${ns}/package/2006/relationships"><Relationship Id="rId1" Type="${ns}/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>` },
      { name: 'xl/workbook.xml', text: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="${ns}/spreadsheetml/2006/main" xmlns:r="${ns}/officeDocument/2006/relationships"><sheets><sheet name="Summary" sheetId="1" r:id="rId1"/><sheet name="Tasks" sheetId="2" r:id="rId2"/></sheets><definedNames><definedName name="_xlnm._FilterDatabase" localSheetId="1" hidden="1">Tasks!$A$1:$K$${last}</definedName></definedNames><calcPr calcId="191029" fullCalcOnLoad="1"/></workbook>` },
      { name: 'xl/_rels/workbook.xml.rels', text: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="${ns}/package/2006/relationships"><Relationship Id="rId1" Type="${ns}/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="${ns}/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet2.xml"/><Relationship Id="rId3" Type="${ns}/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>` },
      { name: 'xl/styles.xml', text: styles },
      { name: 'xl/worksheets/sheet1.xml', text: sheetXml(sum, { widths: [30, 12, 12, 17, 10, 10, 10, 9, 10] }) },
      { name: 'xl/worksheets/sheet2.xml', text: sheetXml(taskRows, { widths: [22, 24, 26, 40, 32, 26, 17, 13, 22, 36, 11], freeze: 1, filter: `A1:K${last}` }) }
    ];
    const a = document.createElement('a');
    a.href = URL.createObjectURL(zipStore(files));
    a.download = `QA_${daily ? 'Daily' : 'Weekly'}_Report_${daily ? refDate : r.ws}.xlsx`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    toast('Excel report downloaded');
  }

  // Copies tasks to the following week (skipping ones already there) and keeps their status.
  function copyToNextWeek(tasks) {
    let added = 0;
    const now = Date.now();
    tasks.forEach(t => {
      const next = addDays(t.weekStart, 7);
      const exists = db.qaTasks.some(x => x.weekStart === next && sameName(x.member, t.member) && sameName(x.system, t.system) && sameName(x.task, t.task));
      if (exists) return;
      db.qaTasks.push(Object.assign({}, t, { id: uid(), weekStart: next, created: now + added, updated: now }));
      added++;
    });
    return added;
  }

  // ---------- Excel import (QA Daily Status Tracker .xlsx) ----------
  // An .xlsx file is a zip of XML files; it is read here with the browser's built-in
  // DecompressionStream and DOMParser, so no library is needed.
  async function unzip(buf) {
    const dv = new DataView(buf), u8 = new Uint8Array(buf), dec = new TextDecoder();
    let eocd = -1;
    for (let i = buf.byteLength - 22; i >= Math.max(0, buf.byteLength - 65557); i--) {
      if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
    }
    if (eocd < 0) throw new Error('not xlsx');
    const files = {};
    let p = dv.getUint32(eocd + 16, true);
    for (let i = 0, n = dv.getUint16(eocd + 10, true); i < n; i++) {
      if (dv.getUint32(p, true) !== 0x02014b50) throw new Error('not xlsx');
      const nameLen = dv.getUint16(p + 28, true);
      files[dec.decode(u8.subarray(p + 46, p + 46 + nameLen))] = { method: dv.getUint16(p + 10, true), size: dv.getUint32(p + 20, true), local: dv.getUint32(p + 42, true) };
      p += 46 + nameLen + dv.getUint16(p + 30, true) + dv.getUint16(p + 32, true);
    }
    return async name => {
      const f = files[name];
      if (!f) return null;
      const start = f.local + 30 + dv.getUint16(f.local + 26, true) + dv.getUint16(f.local + 28, true);
      const data = u8.subarray(start, start + f.size);
      if (f.method === 0) return dec.decode(data);
      return new Response(new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).text();
    };
  }

  async function readXlsx(buf) {
    const get = await unzip(buf);
    const xml = async name => { const t = await get(name); return t ? new DOMParser().parseFromString(t, 'application/xml') : null; };
    const text = el => [...el.getElementsByTagName('t')].filter(t => t.parentNode.nodeName !== 'rPh').map(t => t.textContent).join('');
    const shared = [];
    const ss = await xml('xl/sharedStrings.xml');
    if (ss) for (const si of ss.getElementsByTagName('si')) shared.push(text(si));
    const rels = {};
    for (const r of (await xml('xl/_rels/workbook.xml.rels')).getElementsByTagName('Relationship')) rels[r.getAttribute('Id')] = r.getAttribute('Target');
    const sheets = {};
    for (const s of (await xml('xl/workbook.xml')).getElementsByTagName('sheet')) {
      const target = rels[s.getAttribute('r:id')] || '';
      sheets[s.getAttribute('name')] = target.startsWith('/') ? target.slice(1) : 'xl/' + target.replace(/^\.\//, '');
    }
    const colIndex = ref => { let n = 0; for (const ch of ref.replace(/\d+$/, '')) n = n * 26 + ch.charCodeAt(0) - 64; return n - 1; };
    async function rows(name) {
      const doc = await xml(sheets[name]);
      const out = [];
      if (!doc) return out;
      for (const row of doc.getElementsByTagName('row')) {
        const r = [];
        let next = 0;
        for (const c of row.getElementsByTagName('c')) {
          const col = c.getAttribute('r') ? colIndex(c.getAttribute('r')) : next;
          next = col + 1;
          const t = c.getAttribute('t'), v = c.getElementsByTagName('v')[0];
          if (t === 's') r[col] = v ? shared[+v.textContent] : null;
          else if (t === 'inlineStr') r[col] = text(c);
          else if (v) r[col] = t === 'str' || t === 'e' || t === 'b' ? v.textContent : Number(v.textContent);
        }
        out.push(r);
      }
      return out;
    }
    return { names: Object.keys(sheets), rows };
  }

  function excelDate(n) { return new Date(Math.round((n - 25569) * 86400000)).toISOString().slice(0, 10); }
  function toISODate(v) {
    if (typeof v === 'number' && v > 20000 && v < 90000) return excelDate(v);
    if (typeof v === 'string' && v.trim()) { const d = new Date(v); if (!isNaN(d)) return isoOf(d); }
    return '';
  }
  // "18 Oct – 22 Oct 2026" -> Sunday of that week
  function weekFromLabel(label) {
    const m = String(label || '').match(/(\d{1,2})\s+([A-Za-z]{3})[A-Za-z]*\.?\s*[–—-]\s*(\d{1,2})\s+([A-Za-z]{3})[A-Za-z]*\.?\s+(\d{4})/);
    if (!m) return '';
    const months = 'janfebmaraprmayjunjulaugsepoctnovdec';
    const sm = months.indexOf(m[2].toLowerCase()) / 3, em = months.indexOf(m[4].toLowerCase()) / 3;
    if (sm < 0 || em < 0) return '';
    const year = +m[5] - (sm > em ? 1 : 0);
    return weekStartOf(isoOf(new Date(year, sm, +m[1])));
  }

  async function parseTracker(x) {
    const str = v => v == null ? '' : String(v).trim();
    const result = { members: [], systems: [], tasks: [] };
    // Lists sheet: "Team Members" and "Systems" columns
    const listName = x.names.find(n => /^lists?$/i.test(n.trim()));
    if (listName) {
      const rows = await x.rows(listName);
      const head = (rows[0] || []).map(h => str(h).toLowerCase());
      const mc = head.findIndex(h => h.startsWith('team member')), sc = head.findIndex(h => h.startsWith('system'));
      rows.slice(1).forEach(r => {
        if (mc >= 0 && str(r[mc])) result.members.push(str(r[mc]));
        if (sc >= 0 && str(r[sc])) result.systems.push(str(r[sc]));
      });
    }
    // Weekly Tasks sheet (never the "How to use" example)
    const taskName = x.names.find(n => /weekly\s*tasks?/i.test(n)) || x.names.find(n => !/how to use|summary|lists?/i.test(n));
    if (!taskName) throw new Error('no tasks sheet');
    const rows = await x.rows(taskName);
    const hi = rows.findIndex(r => r && r.some(c => str(c).toLowerCase() === 'team member') && r.some(c => /current task|^task$/i.test(str(c))));
    if (hi < 0) throw new Error('no tasks sheet');
    const map = {};
    rows[hi].forEach((h, i) => {
      const k = str(h).toLowerCase();
      const key = k === 'week' ? 'weekLabel' : k === 'week start' ? 'weekStartRaw' : k === 'team member' ? 'member' : k === 'system' ? 'system'
        : /current task|^task$/.test(k) ? 'task' : k.startsWith('build') ? 'build' : k.startsWith('test plan') ? 'testPlan' : k === 'status' ? 'status'
        : k.startsWith('due date') ? 'due' : k.startsWith('expected') ? 'expectedBuild' : /blocker|note/.test(k) ? 'notes' : null;
      if (key && map[key] === undefined) map[key] = i;
    });
    rows.slice(hi + 1).forEach(r => {
      if (!r) return;
      const val = k => map[k] === undefined ? null : r[map[k]];
      const task = str(val('task')), member = str(val('member'));
      if (!task && !member) return;
      const rawWs = val('weekStartRaw');
      const weekStart = (typeof rawWs === 'number' ? weekStartOf(excelDate(rawWs)) : '') || weekFromLabel(val('weekLabel')) || weekStartOf(todayISO());
      const exp = val('expectedBuild');
      result.tasks.push({
        weekStart, member, system: str(val('system')), task,
        build: str(val('build')), testPlan: str(val('testPlan')),
        status: QA_STATUS.find(s => sameName(s, val('status'))) || 'Not Started',
        due: toISODate(val('due')),
        expectedBuild: typeof exp === 'number' && exp > 20000 && exp < 90000 ? fmtDate(excelDate(exp)) : str(exp),
        notes: str(val('notes'))
      });
    });
    result.tasks.forEach(t => {
      if (t.member && !result.members.some(n => sameName(n, t.member))) result.members.push(t.member);
      if (t.system && !result.systems.some(n => sameName(n, t.system))) result.systems.push(t.system);
    });
    return result;
  }

  // Adds new members/systems and tasks; a task already in the hub (same week, member, system and task) is updated instead.
  function mergeTracker(data) {
    const now = Date.now();
    const n = { members: 0, systems: 0, tasks: 0, updated: 0 };
    data.members.forEach(name => {
      if (db.team.some(m => sameName(m.name, name))) return;
      db.team.push({ id: uid(), name, role: 'QA Engineer', status: 'Available', handover: 'N/A', task: '', backup: '', returnDate: '', created: now, updated: now });
      n.members++;
    });
    data.systems.forEach(name => {
      if (db.systems.some(s => sameName(s.name, name))) return;
      db.systems.push({ id: uid(), name, status: 'Active', notes: '', created: now, updated: now });
      n.systems++;
    });
    data.tasks.forEach((t, i) => {
      const existing = db.qaTasks.find(x => x.weekStart === t.weekStart && sameName(x.member, t.member) && sameName(x.system, t.system) && sameName(x.task, t.task));
      if (existing) { Object.assign(existing, t, { updated: now }); n.updated++; }
      else { db.qaTasks.push(Object.assign({ id: uid(), created: now + i, updated: now }, t)); n.tasks++; }
    });
    return n;
  }

  async function importExcel(file) {
    if (typeof DecompressionStream !== 'function') return toast('Excel import needs a recent Chrome or Edge');
    try {
      const data = await parseTracker(await readXlsx(await file.arrayBuffer()));
      if (!data.tasks.length && !data.members.length && !data.systems.length) return toast('No team members, systems or tasks found in this file');
      const n = mergeTracker(data);
      const weeks = data.tasks.map(t => t.weekStart).sort();
      if (weeks.length) { ui.qaWeek = weeks[weeks.length - 1]; ui.reportWeek = ui.qaWeek; }
      ui.qaStatus = ui.qaMember = ui.qaSystem = 'All';
      clearSearch();
      save();
      render();
      toast(`Imported ${n.members} new members, ${n.systems} new systems, ${n.tasks} new tasks${n.updated ? `, ${n.updated} updated` : ''}`);
    } catch (e) {
      toast(e && e.message === 'no tasks sheet' ? 'No "Weekly Tasks" sheet found in this file' : 'Could not read this Excel file (.xlsx)');
    }
  }

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
