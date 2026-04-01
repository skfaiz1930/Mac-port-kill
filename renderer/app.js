/* ──────────────────────────────────────────────────────────────────────────
   Port Kill — Renderer App Logic
   ──────────────────────────────────────────────────────────────────────── */

// ── State ──────────────────────────────────────────────────────────────────
const state = {
  ports: [],
  filtered: [],
  search: '',
  sortCol: 'port',
  sortDir: 'asc',
  protoFilter: 'ALL',
  refreshInterval: 3000,
  timer: null,
  countdownTimer: null,
  countdownStart: null,
  pendingKill: null,
};

// ── Selectors ──────────────────────────────────────────────────────────────
const $ = (id) => document.getElementById(id);
const tbody        = $('port-tbody');
const searchInput  = $('search-input');
const searchClear  = $('search-clear');
const statusDot    = $('status-dot');
const statusLabel  = $('status-label');
const refreshBtn   = $('refresh-btn');
const lastRefresh  = $('last-refresh');
const countdownFill= $('countdown-fill');
const modalOverlay = $('modal-overlay');
const modalDesc    = $('modal-desc');
const modalDetail  = $('modal-detail');
const modalCancel  = $('modal-cancel');
const modalConfirm = $('modal-confirm');
const detailPanel  = $('detail-panel');
const detailTitle  = $('detail-title');
const detailBody   = $('detail-body');
const detailClose  = $('detail-close');
const emptyState   = $('empty-state');
const toastContainer = $('toast-container');
const killAllBtn   = $('kill-all-btn');
const resultCount  = $('result-count');

// ── Well-known Ports ───────────────────────────────────────────────────────
const WELL_KNOWN = new Set([80, 443, 8080, 8443, 3000, 3001, 4000, 4200, 5000, 5173, 8000, 8888]);
const SYSTEM_PORTS = (p) => p < 1024;

// ── Init ───────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  fetchPorts();
  setupEventListeners();
  startAutoRefresh(state.refreshInterval);
});

// ── Fetch Ports ────────────────────────────────────────────────────────────
async function fetchPorts() {
  setStatus('refreshing');
  refreshBtn.classList.add('spinning');

  try {
    const ports = await window.electronAPI.getPorts();
    const prevPIDs = new Set(state.ports.map((p) => `${p.pid}-${p.port}`));
    state.ports = ports;

    // Mark new entries
    state.ports.forEach((p) => {
      p._isNew = !prevPIDs.has(`${p.pid}-${p.port}`);
    });

    applyFilters();
    updateStats();
    setStatus('live');
    lastRefresh.textContent = `Updated ${formatTime(new Date())}`;
  } catch (err) {
    setStatus('error');
    showToast('Failed to fetch ports', 'error');
  } finally {
    refreshBtn.classList.remove('spinning');
  }
}

// ── Apply Filters & Sort ───────────────────────────────────────────────────
function applyFilters() {
  const q = state.search.toLowerCase().trim();

  state.filtered = state.ports.filter((p) => {
    const protoMatch = state.protoFilter === 'ALL' || p.protocol === state.protoFilter;
    const searchMatch = !q ||
      String(p.port).includes(q) ||
      p.processName.toLowerCase().includes(q) ||
      String(p.pid).includes(q) ||
      p.address.toLowerCase().includes(q) ||
      p.protocol.toLowerCase().includes(q);
    return protoMatch && searchMatch;
  });

  // Sort
  state.filtered.sort((a, b) => {
    let av = a[state.sortCol], bv = b[state.sortCol];
    if (typeof av === 'string') { av = av.toLowerCase(); bv = bv.toLowerCase(); }
    if (av < bv) return state.sortDir === 'asc' ? -1 : 1;
    if (av > bv) return state.sortDir === 'asc' ? 1 : -1;
    return 0;
  });

  renderTable();
  updateResultCount();
}

// ── Render Table ───────────────────────────────────────────────────────────
function renderTable() {
  if (state.filtered.length === 0 && state.ports.length === 0) {
    tbody.innerHTML = '';
    emptyState.style.display = 'flex';
    return;
  }
  emptyState.style.display = 'none';

  if (state.filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:40px;color:var(--text-muted);font-size:13px;">No results for "${state.search}"</td></tr>`;
    return;
  }

  tbody.innerHTML = state.filtered.map((p) => rowHTML(p)).join('');

  // Attach events
  tbody.querySelectorAll('.kill-btn').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      const pid = parseInt(btn.dataset.pid);
      const port = parseInt(btn.dataset.port);
      const name = btn.dataset.name;
      openKillModal(pid, port, name);
    });
  });

  tbody.querySelectorAll('.port-number').forEach((el) => {
    el.addEventListener('click', () => copyToClipboard(el.dataset.val, 'Port copied!'));
  });

  tbody.querySelectorAll('.pid-badge').forEach((el) => {
    el.addEventListener('click', () => copyToClipboard(el.dataset.val, 'PID copied!'));
  });

  tbody.querySelectorAll('.process-name').forEach((el) => {
    el.addEventListener('click', () => {
      const pid = parseInt(el.dataset.pid);
      openDetailPanel(pid);
    });
    el.style.cursor = 'pointer';
  });

  // Flash new rows
  tbody.querySelectorAll('tr[data-new="true"]').forEach((row) => {
    row.classList.add('new-port');
  });
}

function rowHTML(p) {
  const portClass = SYSTEM_PORTS(p.port) ? 'system' : WELL_KNOWN.has(p.port) ? 'well-known' : '';
  const avatar = p.processName.slice(0, 2).toUpperCase();
  const protoClass = p.protocol.toLowerCase();

  return `
    <tr data-pid="${p.pid}" data-port="${p.port}" data-new="${p._isNew}">
      <td>
        <span class="port-number ${portClass}" data-val="${p.port}" title="Click to copy">
          ${p.port}
        </span>
      </td>
      <td>
        <div class="process-name" data-pid="${p.pid}" title="Click for details">
          <div class="process-avatar">${avatar}</div>
          <span class="process-label">${escHtml(p.processName)}</span>
        </div>
      </td>
      <td>
        <span class="pid-badge" data-val="${p.pid}" title="Click to copy">
          ${p.pid}
        </span>
      </td>
      <td><span class="proto-badge ${protoClass}">${p.protocol}</span></td>
      <td><span class="address-text">${escHtml(p.address)}</span></td>
      <td class="action-cell">
        <button class="kill-btn" data-pid="${p.pid}" data-port="${p.port}" data-name="${escHtml(p.processName)}">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
          Kill
        </button>
      </td>
    </tr>`;
}

// ── Update Stats ───────────────────────────────────────────────────────────
function updateStats() {
  $('stat-total').textContent = state.ports.length;
  $('stat-processes').textContent = new Set(state.ports.map((p) => p.processName)).size;
  $('stat-tcp').textContent = state.ports.filter((p) => p.protocol === 'TCP').length;
  $('stat-udp').textContent = state.ports.filter((p) => p.protocol === 'UDP').length;
}

function updateResultCount() {
  resultCount.textContent = state.filtered.length > 0
    ? `${state.filtered.length} port${state.filtered.length !== 1 ? 's' : ''}`
    : '';
}

// ── Status ─────────────────────────────────────────────────────────────────
function setStatus(s) {
  statusDot.className = `status-dot ${s === 'live' ? '' : s}`;
  statusLabel.textContent = s === 'live' ? 'Live' : s === 'refreshing' ? 'Refreshing…' : 'Error';
}

// ── Kill Modal ─────────────────────────────────────────────────────────────
function openKillModal(pid, port, name) {
  state.pendingKill = { pid, port, name };
  modalDesc.textContent = `You're about to send SIGKILL (kill -9) to the process on port ${port}.`;
  modalDetail.innerHTML = `<b>Process:</b> ${escHtml(name)}<br><b>PID:</b> ${pid}<br><b>Port:</b> ${port}`;
  modalOverlay.classList.add('open');
}

function closeModal() {
  modalOverlay.classList.remove('open');
  state.pendingKill = null;
}

async function confirmKill() {
  if (!state.pendingKill) return;
  const { pid, port, name } = state.pendingKill;
  closeModal();

  // Fade out row
  const row = tbody.querySelector(`tr[data-pid="${pid}"][data-port="${port}"]`);
  if (row) { row.classList.add('dying'); }

  setTimeout(async () => {
    const result = await window.electronAPI.killProcess(pid);
    if (result.success) {
      showToast(`✓ Killed ${name} (PID ${pid}) on :${port}`, 'success');
      await fetchPorts();
    } else {
      if (row) row.classList.remove('dying');
      showToast(`Failed to kill ${name}: ${result.error}`, 'error');
    }
  }, 300);
}

// ── Kill All ───────────────────────────────────────────────────────────────
killAllBtn.addEventListener('click', async () => {
  if (state.filtered.length === 0) return;

  const confirmed = await showConfirmDialog(
    `Kill ${state.filtered.length} process${state.filtered.length !== 1 ? 'es' : ''}?`,
    `This will send kill -9 to all ${state.filtered.length} currently visible ports.`
  );

  if (!confirmed) return;

  let killed = 0, failed = 0;
  for (const p of state.filtered) {
    const result = await window.electronAPI.killProcess(p.pid);
    if (result.success) killed++;
    else failed++;
  }

  showToast(`Killed ${killed} process${killed !== 1 ? 'es' : ''}${failed > 0 ? `, ${failed} failed` : ''}`, killed > 0 ? 'success' : 'error');
  await fetchPorts();
});

async function showConfirmDialog(title, message) {
  return new Promise((resolve) => {
    state.pendingKill = { _confirmOnly: true };
    modalDesc.textContent = message;
    modalDetail.innerHTML = `<b>${escHtml(title)}</b>`;
    modalOverlay.classList.add('open');
    state._confirmResolve = resolve;
  });
}

// ── Detail Panel ───────────────────────────────────────────────────────────
async function openDetailPanel(pid) {
  detailPanel.classList.add('open');
  detailTitle.textContent = `Process · PID ${pid}`;
  detailBody.innerHTML = `<div class="loading-state" style="margin-top:20px"><div class="spinner"></div></div>`;

  const info = await window.electronAPI.getProcessInfo(pid);
  if (!info) {
    detailBody.innerHTML = `<p style="color:var(--text-muted);font-size:13px;">Could not load process info.</p>`;
    return;
  }

  const port = state.ports.find((p) => p.pid === pid);
  const rows = [
    ['PID',     info.pid],
    ['PPID',    info.ppid],
    ['User',    info.user],
    ['CPU %',   info.cpu + '%'],
    ['MEM %',   info.mem + '%'],
    ['Port',    port ? port.port : '—'],
    ['Protocol',port ? port.protocol : '—'],
    ['Address', port ? port.address : '—'],
    ['Command', info.command],
  ];

  detailBody.innerHTML = rows.map(([k, v]) => `
    <div class="detail-row">
      <div class="detail-key">${k}</div>
      <div class="detail-val">${escHtml(String(v))}</div>
    </div>
  `).join('');
}

// ── Sorting ────────────────────────────────────────────────────────────────
document.querySelectorAll('.sortable').forEach((th) => {
  th.addEventListener('click', () => {
    const col = th.dataset.col;
    if (state.sortCol === col) {
      state.sortDir = state.sortDir === 'asc' ? 'desc' : 'asc';
    } else {
      state.sortCol = col;
      state.sortDir = 'asc';
    }
    updateSortArrows();
    applyFilters();
  });
});

function updateSortArrows() {
  document.querySelectorAll('.sort-arrow').forEach((el) => {
    el.classList.remove('active', 'asc', 'desc');
    el.textContent = '↕';
  });
  const arrow = $(`sort-${state.sortCol}`);
  if (arrow) {
    arrow.classList.add('active', state.sortDir);
    arrow.textContent = state.sortDir === 'asc' ? '↑' : '↓';
  }
}

// ── Auto Refresh ───────────────────────────────────────────────────────────
function startAutoRefresh(ms) {
  clearInterval(state.timer);
  clearInterval(state.countdownTimer);
  state.refreshInterval = ms;

  if (ms === 0) {
    countdownFill.style.width = '0%';
    return;
  }

  state.timer = setInterval(fetchPorts, ms);
  state.countdownStart = Date.now();

  state.countdownTimer = setInterval(() => {
    const elapsed = Date.now() - state.countdownStart;
    const pct = Math.max(0, 100 - (elapsed / ms) * 100);
    countdownFill.style.width = `${pct}%`;
    if (elapsed >= ms) state.countdownStart = Date.now();
  }, 100);
}

document.querySelectorAll('.refresh-option').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.refresh-option').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    startAutoRefresh(parseInt(btn.dataset.interval));
  });
});

document.querySelectorAll('.filter-proto').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.filter-proto').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    state.protoFilter = btn.dataset.proto;
    applyFilters();
  });
});

refreshBtn.addEventListener('click', () => {
  fetchPorts();
  if (state.refreshInterval > 0) state.countdownStart = Date.now();
});

// ── Search ─────────────────────────────────────────────────────────────────
searchInput.addEventListener('input', () => {
  state.search = searchInput.value;
  searchClear.style.display = state.search ? 'block' : 'none';
  applyFilters();
});

searchClear.addEventListener('click', () => {
  searchInput.value = '';
  state.search = '';
  searchClear.style.display = 'none';
  searchInput.focus();
  applyFilters();
});

// ── Modal Events ───────────────────────────────────────────────────────────
modalCancel.addEventListener('click', () => {
  if (state._confirmResolve) { state._confirmResolve(false); state._confirmResolve = null; }
  closeModal();
});

modalConfirm.addEventListener('click', () => {
  if (state._confirmResolve) {
    state._confirmResolve(true);
    state._confirmResolve = null;
    closeModal();
  } else {
    confirmKill();
  }
});

modalOverlay.addEventListener('click', (e) => {
  if (e.target === modalOverlay) {
    if (state._confirmResolve) { state._confirmResolve(false); state._confirmResolve = null; }
    closeModal();
  }
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    if (detailPanel.classList.contains('open')) {
      detailPanel.classList.remove('open');
    } else if (modalOverlay.classList.contains('open')) {
      if (state._confirmResolve) { state._confirmResolve(false); state._confirmResolve = null; }
      closeModal();
    }
  }
});

// ── Detail Panel Events ────────────────────────────────────────────────────
detailClose.addEventListener('click', () => detailPanel.classList.remove('open'));

// ── Toast ──────────────────────────────────────────────────────────────────
function showToast(msg, type = 'info', duration = 3000) {
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = msg;
  toastContainer.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('fade-out');
    toast.addEventListener('animationend', () => toast.remove());
  }, duration);
}

// ── Copy to Clipboard ──────────────────────────────────────────────────────
function copyToClipboard(val, msg = 'Copied!') {
  navigator.clipboard.writeText(String(val)).then(() => {
    showToast(`📋 ${msg}`, 'info', 1500);
  });
}

// ── Helpers ────────────────────────────────────────────────────────────────
function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatTime(date) {
  return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function setupEventListeners() {
  // All listeners are set up inline above
}
