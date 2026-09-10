const $ = (id) => document.getElementById(id);
const $$ = (sel) => document.querySelectorAll(sel);

// ────────── Scene navigation ──────────
$$('.scene-tab').forEach((tab) => {
  tab.addEventListener('click', () => {
    const scene = tab.dataset.scene;
    $$('.scene-tab').forEach((t) => t.classList.toggle('active', t === tab));
    $$('.scene[data-scene]').forEach((s) => s.classList.toggle('hidden', s.dataset.scene !== scene));
  });
});

// ────────── Live clock ──────────
function tickClock() {
  const now = new Date();
  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  const ss = String(now.getSeconds()).padStart(2, '0');
  const el = $('live-clock');
  if (el) el.textContent = `${hh}:${mm}:${ss}`;
}
setInterval(tickClock, 1000); tickClock();

// ────────── Session-wide operation stats ──────────
const sessionOperations = {};
let pollTimer = null;

function updateSessionTotals() {
  const totals = { total: 0, delivered: 0, failed: 0, unaddressable: 0 };
  for (const op of Object.values(sessionOperations)) {
    totals.total += op.total || 0;
    totals.delivered += op.delivered || 0;
    totals.failed += op.failed || 0;
    totals.unaddressable += op.unaddressable || 0;
  }
  $('stat-total').textContent = totals.total;
  $('stat-delivered').textContent = totals.delivered;
  $('stat-failed').textContent = totals.failed;
  $('stat-unaddressable').textContent = totals.unaddressable;
}

async function pollSingle(opId) {
  try {
    const res = await fetch(`/api/operations/${encodeURIComponent(opId)}`);
    if (!res.ok) return;
    const data = await res.json();
    const s = data.stats || {};
    const prev = sessionOperations[opId] || {};
    sessionOperations[opId] = {
      total: Math.max(prev.total || 0, s.total || 0),
      delivered: Math.max(prev.delivered || 0, s.delivered || 0),
      failed: Math.max(prev.failed || 0, s.failed || 0),
      unaddressable: Math.max(prev.unaddressable || 0, s.unaddressable || 0),
      status: data.status,
    };
  } catch { /* transient */ }
}

async function pollAll() {
  const pending = Object.entries(sessionOperations).filter(
    ([, op]) => op.status !== 'COMPLETED' && op.status !== 'FAILED'
  );
  if (pending.length === 0) { clearInterval(pollTimer); pollTimer = null; return; }
  await Promise.all(pending.map(([opId]) => pollSingle(opId)));
  updateSessionTotals();
}

function startPolling() {
  if (pollTimer) clearInterval(pollTimer);
  pollAll();
  pollTimer = setInterval(pollAll, 750);
}

function primeOperation(operationId, recipientCount) {
  if (!operationId) return;
  sessionOperations[operationId] = {
    total: recipientCount || 0,
    delivered: 0, failed: 0, unaddressable: 0,
    status: 'SUBMITTED',
  };
  updateSessionTotals();
  startPolling();
}

// ────────── Scene A — customer thread ──────────
const threadEl = $('thread');
function addToThread({ direction, body }) {
  const div = document.createElement('div');
  div.className = `bubble ${direction}`;
  div.textContent = body;
  threadEl.appendChild(div);
  threadEl.scrollTop = threadEl.scrollHeight;
}
function addSystem(text) {
  const div = document.createElement('div');
  div.className = 'bubble system';
  div.textContent = text;
  threadEl.appendChild(div);
  threadEl.scrollTop = threadEl.scrollHeight;
}
function renderTemplate(text, vars) {
  // Best-effort render for display. Handles {{name | default: 'x'}} and plain {{name}}.
  return text.replace(/\{\{\s*([a-zA-Z0-9_]+)(?:\s*\|\s*default:\s*'([^']*)')?\s*\}\}/g,
    (_, k, fallback) => (vars && vars[k] != null ? vars[k] : (fallback || '')));
}
function setRaw(request, response) {
  if (request) $('raw-request').textContent = JSON.stringify(request, null, 2);
  if (response) $('raw-response').textContent = JSON.stringify(response, null, 2);
}

$('send-btn').addEventListener('click', async () => {
  const btn = $('send-btn');
  btn.disabled = true;
  try {
    const res = await fetch('/api/campaigns/send', { method: 'POST' });
    const data = await res.json();
    $('http-status').textContent = res.status;
    $('op-id').textContent = data.operationId || '—';
    setRaw(undefined, data);
    if (data.operationId) primeOperation(data.operationId, data.recipientCount);
  } catch (err) {
    $('raw-response').textContent = `ERROR: ${err.message}`;
  } finally {
    btn.disabled = false;
  }
});

// ────────── Scene B — queue + timeline ──────────
const queueTableBody = document.querySelector('#queue-table tbody');
const timelineEl = $('timeline');

function fmtTime(iso) {
  const d = iso ? new Date(iso) : new Date();
  return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}:${String(d.getSeconds()).padStart(2,'0')}`;
}

function addTimeline({ label, detail, kind, at }) {
  const li = document.createElement('li');
  li.className = kind || '';
  li.innerHTML = `<span class="t-time">${fmtTime(at)}</span><span class="t-label">${label}</span><span class="t-detail">${detail || ''}</span>`;
  timelineEl.prepend(li);
}

function renderQueue(queue) {
  queueTableBody.innerHTML = '';
  for (const r of queue) {
    const tr = document.createElement('tr');
    if (r.isCustomer) tr.classList.add('customer-row');
    if (r.status !== 'pending') tr.classList.add('suppressed');
    const badge = r.status === 'pending'
      ? '<span class="badge pending">Pending</span>'
      : '<span class="badge suppressed">Suppressed</span>';
    tr.innerHTML = `
      <td>${r.firstName || '—'}${r.isCustomer ? '<span class="badge customer">Real</span>' : ''}</td>
      <td>&bull;&bull;&bull;&bull; ${r.lastFour || '—'}</td>
      <td>${r.dueDate || '—'}</td>
      <td>${r.amountDue || '—'}</td>
      <td>${badge}</td>
      <td>${r.status === 'pending'
        ? `<button class="btn small ghost pay-btn" data-phone="${r.phone}">Payment posted</button>`
        : ''}</td>`;
    queueTableBody.appendChild(tr);
  }
  queueTableBody.querySelectorAll('.pay-btn').forEach((btn) => {
    btn.addEventListener('click', async () => {
      btn.disabled = true;
      const phone = btn.dataset.phone;
      try {
        // Fiserv-shaped payload
        await fetch('/webhooks/payment', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            phone,
            accountId: 'ACCT-' + phone.slice(-4),
            amount: '47.50',
            postedAt: new Date().toISOString(),
            source: 'fiserv-sim',
          }),
        });
      } catch (err) { console.error(err); }
    });
  });
}

async function loadQueue() {
  const res = await fetch('/api/queue');
  const data = await res.json();
  renderQueue(data.queue || []);
}

$('queue-reset').addEventListener('click', async () => {
  const res = await fetch('/api/queue/reset', { method: 'POST' });
  const data = await res.json();
  renderQueue(data.queue || []);
  addTimeline({ label: 'Queue reset', detail: `${(data.queue || []).length} recipients loaded`, kind: '' });
});

$('queue-send').addEventListener('click', async () => {
  const btn = $('queue-send');
  btn.disabled = true;
  try {
    const res = await fetch('/api/queue/send', { method: 'POST' });
    const data = await res.json();
    if (!res.ok) {
      addTimeline({ label: 'Send failed', detail: data.error || `HTTP ${res.status}`, kind: 'suppress' });
      return;
    }
    addTimeline({
      label: 'Send fired',
      detail: `${data.recipientCount} sent · ${data.suppressedCount || 0} suppressed · op ${data.operationId || '—'}`,
      kind: 'send',
    });
    if (data.operationId) primeOperation(data.operationId, data.recipientCount);
  } finally {
    btn.disabled = false;
  }
});

// ────────── Scene C — inbound + DNC ──────────
const inboundListEl = $('inbound-list');
const dncListEl = $('dnc-list');

function renderInbound(rows) {
  inboundListEl.innerHTML = '';
  for (const r of rows) {
    const isOptOut = r.status && r.status.startsWith('advanced_optout');
    const row = document.createElement('div');
    row.className = `inbound-row ${isOptOut ? 'optout' : 'freeform'}`;
    row.innerHTML = `
      <div>
        <div class="inb-meta">${r.phone} · ${new Date(r.timestamp + 'Z').toLocaleTimeString()} · ${isOptOut ? r.status.replace('advanced_optout:', 'Advanced Opt-Out · ') : 'Free-form'}</div>
        <div class="inb-body">${escapeHtml(r.body || '')}</div>
      </div>
      <div class="inb-actions">
        ${isOptOut ? '' : `<button class="btn small danger dnc-add" data-phone="${r.phone}">Add to DNC</button>`}
      </div>`;
    inboundListEl.appendChild(row);
  }
  inboundListEl.querySelectorAll('.dnc-add').forEach((btn) => {
    btn.addEventListener('click', async () => {
      btn.disabled = true;
      const phone = btn.dataset.phone;
      await fetch('/api/dnc/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, reason: 'ops_review' }),
      });
    });
  });
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[c]);
}

async function loadInbound() {
  const res = await fetch('/api/inbound');
  const data = await res.json();
  renderInbound(data.inbound || []);
}

async function loadDnc() {
  const res = await fetch('/api/dnc');
  const data = await res.json();
  renderDnc(data.dnc || []);
}

function renderDnc(rows) {
  dncListEl.innerHTML = '';
  if (rows.length === 0) {
    dncListEl.innerHTML = '<div class="sub" style="padding: 8px 4px;">No numbers on DNC yet.</div>';
    return;
  }
  for (const r of rows) {
    const div = document.createElement('div');
    div.className = 'dnc-row';
    div.innerHTML = `
      <div>
        <span class="dnc-phone">${r.phone}</span>
        <span class="badge dnc">DNC</span>
        <span class="sub" style="margin-left: 8px;">${r.reason || ''}</span>
      </div>
      <button class="btn small ghost dnc-remove" data-phone="${r.phone}">Remove</button>`;
    dncListEl.appendChild(div);
  }
  dncListEl.querySelectorAll('.dnc-remove').forEach((btn) => {
    btn.addEventListener('click', async () => {
      btn.disabled = true;
      const phone = btn.dataset.phone;
      await fetch('/api/dnc/remove', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone }),
      });
    });
  });
}

// ────────── SSE ──────────
const sseStatusEl = $('sse-status');
const es = new EventSource('/events');
es.addEventListener('hello', () => { sseStatusEl.textContent = 'SSE: connected'; });
es.onerror = () => { sseStatusEl.textContent = 'SSE: reconnecting…'; };

es.onmessage = (e) => {
  try {
    const evt = JSON.parse(e.data);
    switch (evt.type) {
      case 'campaign.submitted': {
        setRaw(evt.request, { status: evt.status, body: evt.response && evt.response.body, headers: evt.response && evt.response.headers });
        const body = (evt.request && evt.request.content && evt.request.content.text) || '';
        const firstRecipient = evt.request && evt.request.to && evt.request.to[0];
        const vars = (firstRecipient && firstRecipient.variables) || {};
        if (body) addToThread({ direction: 'outbound', body: renderTemplate(body, vars) });
        break;
      }
      case 'queue.reset': {
        renderQueue(evt.queue || []);
        break;
      }
      case 'queue.suppressed': {
        loadQueue();
        addTimeline({
          label: 'Payment posted → suppressed',
          detail: `${evt.firstName || evt.phone} removed from queue`,
          kind: 'suppress', at: evt.at,
        });
        break;
      }
      case 'message.inbound': {
        loadInbound();
        if (evt.optOutType) {
          addSystem(`Advanced Opt-Out matched: ${evt.optOutType}`);
        }
        break;
      }
      case 'message.status': {
        // reserved for future per-message updates
        break;
      }
      case 'dnc.added': {
        loadDnc(); loadInbound();
        addTimeline({ label: 'Added to DNC', detail: evt.phone, kind: 'suppress', at: evt.at });
        break;
      }
      case 'dnc.removed': {
        loadDnc();
        addTimeline({ label: 'Removed from DNC', detail: evt.phone, kind: '', at: evt.at });
        break;
      }
    }
  } catch { /* ignore */ }
};

// ────────── Initial loads ──────────
loadQueue();
loadInbound();
loadDnc();
