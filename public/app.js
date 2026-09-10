const $ = (id) => document.getElementById(id);
const $$ = (sel) => document.querySelectorAll(sel);

// ────────── Per-scene activity log ──────────
// Each scene tab has its own log. Every logActivity call routes to the
// scene named in its `scene` field. Events from other scenes never bleed in.
function logActivity({ scene, tag, tech, plain, doc, status, statusClass, kind }) {
  if (!scene) return;                              // must be scoped to a scene
  const activityLogEl = document.getElementById(`activity-log-${scene}`);
  if (!activityLogEl) return;
  const placeholder = activityLogEl.querySelector('.activity-placeholder');
  if (placeholder) placeholder.remove();

  const row = document.createElement('div');
  row.className = `activity-row ${kind || 'local'}`;
  const time = new Date();
  const t = `${String(time.getHours()).padStart(2,'0')}:${String(time.getMinutes()).padStart(2,'0')}:${String(time.getSeconds()).padStart(2,'0')}.${String(time.getMilliseconds()).padStart(3,'0').slice(0,2)}`;

  row.innerHTML = `
    <div class="act-time">${t}</div>
    <div class="act-tag ${kind || 'local'}">${tag}</div>
    <div class="act-body">
      ${tech ? `<div class="act-tech">${tech}</div>` : ''}
      <div class="act-plain">${plain}</div>
      ${doc ? `<div class="act-doc"><a href="${doc.url}" target="_blank" rel="noreferrer">${doc.label} ↗</a></div>` : ''}
    </div>
    <div class="act-status ${statusClass || ''}">${status || ''}</div>`;
  activityLogEl.appendChild(row);
}

document.querySelectorAll('.activity-clear').forEach((btn) => {
  btn.addEventListener('click', () => {
    const scene = btn.dataset.scene;
    const el = document.getElementById(`activity-log-${scene}`);
    if (el) el.innerHTML = '<div class="activity-placeholder">Cleared. Trigger another action to see live events.</div>';
  });
});

// ────────── Coach steps ──────────
function advanceCoach(scene, stepNumber) {
  const steps = document.querySelectorAll(`.coach[data-scene-coach="${scene}"] .coach-step`);
  steps.forEach((el) => {
    const n = Number(el.dataset.step);
    el.classList.remove('active', 'done');
    if (n < stepNumber) el.classList.add('done');
    else if (n === stepNumber) el.classList.add('active');
  });
}
// Seed each scene's step 1 as active
['a', 'b', 'c'].forEach((s) => advanceCoach(s, 1));

// ────────── Scene navigation ──────────
$$('.scene-tab').forEach((tab) => {
  tab.addEventListener('click', () => {
    const scene = tab.dataset.scene;
    $$('.scene-tab').forEach((t) => t.classList.toggle('active', t === tab));
    $$('.scene[data-scene]').forEach((s) => s.classList.toggle('hidden', s.dataset.scene !== scene));
  });
});

// ────────── Operations polling ──────────
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
    const next = {
      total: Math.max(prev.total || 0, s.total || 0),
      delivered: Math.max(prev.delivered || 0, s.delivered || 0),
      failed: Math.max(prev.failed || 0, s.failed || 0),
      unaddressable: Math.max(prev.unaddressable || 0, s.unaddressable || 0),
      status: data.status,
    };
    sessionOperations[opId] = next;

    // Log an activity row only when counters change vs prev, to avoid spam.
    const changed = ['total', 'delivered', 'failed', 'unaddressable'].some(
      (k) => (prev[k] || 0) !== next[k]
    );
    if (changed) {
      logActivity({
        scene: 'a',
        kind: 'twilio-in',
        tag: 'Bulk Ops',
        tech: `GET /v1/Messages/Operations/${opId} · status: ${next.status}`,
        plain: `Twilio reports for this batch: <b>${next.delivered}</b> delivered · <b>${next.failed}</b> failed · <b>${next.unaddressable}</b> unaddressable (of ${next.total}).`,
      });
    }
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

// ────────── Scene A ──────────
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
  return text.replace(/\{\{\s*([a-zA-Z0-9_]+)(?:\s*\|\s*default:\s*'([^']*)')?\s*\}\}/g,
    (_, k, fallback) => (vars && vars[k] != null ? vars[k] : (fallback || '')));
}
function setRaw(request, response, endpoint) {
  if (request !== undefined) $('raw-request').textContent = request === null ? '—' : JSON.stringify(request, null, 2);
  if (response !== undefined) $('raw-response').textContent = response === null ? '—' : JSON.stringify(response, null, 2);
  if (endpoint) $('raw-endpoint').textContent = endpoint;
}

async function fireCampaign({ scheduleFor, buttonId, scheduleLabel } = {}) {
  const btn = $(buttonId);
  btn.disabled = true;
  advanceCoach('a', 2);
  logActivity({
    scene: 'a',
    kind: 'server',
    tag: 'Server',
    tech: `POST /api/campaigns/send${scheduleFor ? ' · scheduleFor=' + scheduleFor : ''}`,
    plain: scheduleFor
      ? `Server builds a Bulk payload with <code>schedule.sendAt</code> set to <b>${scheduleLabel}</b> and forwards to Twilio.`
      : 'Server builds an immediate Bulk payload and forwards to Twilio.',
  });
  const started = performance.now();
  try {
    const res = await fetch('/api/campaigns/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(scheduleFor ? { scheduleFor } : {}),
    });
    const data = await res.json();
    const ms = Math.round(performance.now() - started);
    $('http-status').textContent = res.status;
    $('op-id').textContent = data.operationId || '—';
    setRaw(undefined, data, 'POST https://comms.twilio.com/v1/Messages · Bulk API');

    let plain;
    if (!res.ok) {
      plain = `Twilio rejected the request: ${data.error || 'unknown error'}`;
    } else if (data.scheduled) {
      plain = `Twilio accepted a <b>scheduled</b> send for <b>${data.sendAt}</b> (no timezone → Twilio localizes to each cardholder). <b>${data.recipientCount}</b> cardholder(s). Operation <code>${data.operationId || '—'}</code>. Delivery fires at 10am <i>local</i> per cardholder — no cron on our side.`;
    } else {
      plain = `Twilio accepted <b>${data.recipientCount}</b> cardholder(s) for immediate delivery. Operation <code>${data.operationId || '—'}</code>. Per-recipient status will stream back via GET /Operations.`;
    }

    logActivity({
      scene: 'a',
      kind: 'bulk',
      tag: 'Bulk API',
      tech: 'POST https://comms.twilio.com/v1/Messages',
      plain,
      status: `${res.status} · ${ms}ms`,
      statusClass: res.ok ? 'ok' : 'err',
      doc: scheduleFor
        ? { url: 'https://www.twilio.com/docs/bulk-messaging/scheduling', label: 'Docs · Bulk Messaging: Scheduling' }
        : { url: 'https://www.twilio.com/docs/bulk-messaging/api/message-resource', label: 'Docs · Bulk Messaging: Message resource' },
    });

    if (data.operationId) { primeOperation(data.operationId, data.recipientCount); advanceCoach('a', 3); }
  } catch (err) {
    $('raw-response').textContent = `ERROR: ${err.message}`;
    logActivity({ scene: 'a', kind: 'local', tag: 'Error', plain: `Send failed locally: ${err.message}`, statusClass: 'err' });
  } finally {
    btn.disabled = false;
  }
}

$('send-btn').addEventListener('click', () => fireCampaign({ buttonId: 'send-btn' }));
$('schedule-btn').addEventListener('click', () => fireCampaign({
  scheduleFor: 'tomorrow-10am-local',
  scheduleLabel: '10:00 tomorrow (per-cardholder local time)',
  buttonId: 'schedule-btn',
}));

// ────────── Scene B — schedule + cancel ──────────
const queueTableBody = document.querySelector('#queue-table tbody');
const timelineEl = $('timeline');
const consoleLinkEl = $('console-link');
let customerPhoneClient = null;         // Jane's phone, discovered from /api/queue
let scheduledMessageSidClient = null;   // last MessageSid scheduled

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

function statusBadge(status) {
  if (status === 'scheduled') return '<span class="badge scheduled">Scheduled</span>';
  if (status === 'canceled')  return '<span class="badge canceled">Canceled</span>';
  if (status === 'suppressed') return '<span class="badge suppressed">Suppressed</span>';
  return '<span class="badge pending">Pending</span>';
}

function renderQueue(queue) {
  queueTableBody.innerHTML = '';
  for (const r of queue) {
    if (r.isCustomer) customerPhoneClient = r.phone;
    const tr = document.createElement('tr');
    if (r.isCustomer) tr.classList.add('customer-row');
    if (r.status === 'canceled' || r.status === 'suppressed') tr.classList.add('suppressed');
    const sidCell = r.messageSid
      ? `<code>${r.messageSid}</code>`
      : (r.isCustomer ? '<span class="sub">not scheduled yet</span>' : '<span class="sub">—</span>');
    tr.innerHTML = `
      <td>${r.firstName || '—'}${r.isCustomer ? '<span class="badge customer">Real</span>' : ''}</td>
      <td>&bull;&bull;&bull;&bull; ${r.lastFour || '—'}</td>
      <td>${r.amountDue || '—'}</td>
      <td class="mono">${sidCell}</td>
      <td>${statusBadge(r.status)}</td>`;
    queueTableBody.appendChild(tr);
  }
}

async function loadQueue() {
  const res = await fetch('/api/queue');
  const data = await res.json();
  renderQueue(data.queue || []);
}

function setConsoleLink(sid) {
  if (!sid) {
    consoleLinkEl.innerHTML = '<span class="sub">Schedule a message to reveal its Console link.</span>';
    return;
  }
  const url = `https://console.twilio.com/us1/monitor/logs/sms?frameUrl=/console/sms/logs/${sid}`;
  consoleLinkEl.innerHTML = `
    <a href="${url}" target="_blank" rel="noreferrer">Open ${sid} in Twilio Console ↗</a>
    <span class="console-hint">Console → Monitor → Logs → Messaging. Refresh the log to watch the status flip live.</span>`;
}

$('queue-reset').addEventListener('click', async () => {
  advanceCoach('b', 1);
  scheduledMessageSidClient = null;
  $('queue-cancel').disabled = true;
  setConsoleLink(null);
  logActivity({
    scene: 'b',
    kind: 'server', tag: 'Server',
    tech: 'POST /api/queue/reset',
    plain: `Rebuilding today's Surge Mastercard reminder queue — no Twilio call.`,
  });
  const res = await fetch('/api/queue/reset', { method: 'POST' });
  const data = await res.json();
  renderQueue(data.queue || []);
  addTimeline({ label: 'Queue reset', detail: `${(data.queue || []).length} rows loaded`, kind: '' });
});

$('queue-schedule').addEventListener('click', async () => {
  const btn = $('queue-schedule');
  btn.disabled = true;
  advanceCoach('b', 1);
  logActivity({
    scene: 'b',
    kind: 'server', tag: 'Server',
    tech: 'POST /api/queue/schedule',
    plain: `Dashboard asks the server to schedule Jane's Surge reminder 20 minutes from now.`,
  });
  const started = performance.now();
  try {
    const res = await fetch('/api/queue/schedule', { method: 'POST' });
    const data = await res.json();
    const ms = Math.round(performance.now() - started);
    if (!res.ok) {
      logActivity({ scene: 'b', kind: 'local', tag: 'Error', tech: `HTTP ${res.status}`, plain: data.error || 'Schedule failed', status: `${res.status} · ${ms}ms`, statusClass: 'err' });
      addTimeline({ label: 'Schedule failed', detail: data.error || `HTTP ${res.status}`, kind: 'suppress' });
      return;
    }
    scheduledMessageSidClient = data.messageSid;
    setRaw(
      data.request,
      { sid: data.messageSid, status: data.status, sendAt: data.sendAt, dateCreated: data.dateCreated },
      'POST https://api.twilio.com/2010-04-01/Accounts/{Sid}/Messages.json · Programmable Messaging'
    );
    logActivity({
      scene: 'b',
      kind: 'bulk', tag: 'Twilio API',
      tech: 'POST https://api.twilio.com/2010-04-01/Accounts/{Sid}/Messages.json',
      plain: `Twilio Programmable Messaging accepted the scheduled send.<br>
              MessageSid: <code>${data.messageSid}</code><br>
              Status: <b><code>${data.status}</code></b><br>
              sendAt: <code>${data.sendAt}</code><br>
              This message is now on Twilio's schedule. Cancel is available until Twilio moves it to <code>queued</code> (~15 min before sendAt).`,
      status: `${res.status} · ${ms}ms`, statusClass: 'ok',
      doc: { url: 'https://www.twilio.com/docs/messaging/features/message-scheduling', label: 'Docs · Message Scheduling' },
    });
    addTimeline({ label: 'Scheduled', detail: `${data.messageSid} · fires ${new Date(data.sendAt).toLocaleTimeString()}`, kind: 'send' });
    setConsoleLink(data.messageSid);
    $('queue-cancel').disabled = false;
    advanceCoach('b', 2);
    loadQueue();
  } finally {
    btn.disabled = false;
  }
});

$('queue-cancel').addEventListener('click', async () => {
  const btn = $('queue-cancel');
  if (!customerPhoneClient) { logActivity({ scene: 'b', kind: 'local', tag: 'Error', plain: 'No customer phone in queue.' }); return; }
  btn.disabled = true;
  advanceCoach('b', 2);
  logActivity({
    scene: 'b',
    kind: 'server', tag: 'Payment webhook',
    tech: 'POST /webhooks/payment',
    plain: `Continental Finance's payment system posts a payment for Jane. Server looks up her MessageSid.`,
  });
  const started = performance.now();
  try {
    const res = await fetch('/webhooks/payment', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        phone: customerPhoneClient,
        accountId: 'ACCT-' + customerPhoneClient.slice(-4),
        amount: '47.50',
        postedAt: new Date().toISOString(),
        event: 'payment.posted',
      }),
    });
    const data = await res.json();
    const ms = Math.round(performance.now() - started);
    if (!res.ok) {
      const hint = data.hint ? `<br><i>${data.hint}</i>` : '';
      logActivity({
        scene: 'b',
        kind: 'local', tag: 'Cancel failed',
        tech: `HTTP ${res.status} · code ${data.code || '—'}`,
        plain: `${data.error || 'Cancel failed'}${hint}`,
        status: `${res.status} · ${ms}ms`, statusClass: 'err',
      });
      return;
    }
    setRaw(
      { messagesResource: `/2010-04-01/Accounts/{AccountSid}/Messages/${data.messageSid}.json`, method: 'POST', body: { Status: 'canceled' } },
      data.response || { sid: data.messageSid, status: data.status },
      `POST https://api.twilio.com/2010-04-01/Accounts/{Sid}/Messages/${data.messageSid}.json · Update Message`
    );
    logActivity({
      scene: 'b',
      kind: 'bulk', tag: 'Twilio API',
      tech: `POST https://api.twilio.com/2010-04-01/Accounts/{Sid}/Messages/${data.messageSid}.json · Status=canceled`,
      plain: `Twilio flipped the message status.<br>
              MessageSid: <code>${data.messageSid}</code><br>
              Status: <b><code>${data.status}</code></b><br>
              The scheduled SMS will never be delivered. Verify in the Twilio Console.`,
      status: `${res.status} · ${ms}ms`, statusClass: 'ok',
      doc: { url: 'https://www.twilio.com/docs/api/errors/30409', label: 'Docs · Cancellation rules' },
    });
    advanceCoach('b', 3);
  } finally {
    // leave button disabled after successful cancel to prevent double-clicks
  }
});

// ────────── Scene C ──────────
const inboundListEl = $('inbound-list');
const dncListEl = $('dnc-list');

function renderInbound(rows) {
  inboundListEl.innerHTML = '';
  if (rows.length === 0) {
    inboundListEl.innerHTML = '<div class="sub" style="padding: 8px 4px;">No inbound messages yet. Text the Surge long code from your cell.</div>';
    return;
  }
  for (const r of rows) {
    const isOptOut = r.status && r.status.startsWith('advanced_optout');
    const row = document.createElement('div');
    row.className = `inbound-row ${isOptOut ? 'optout' : 'freeform'}`;
    row.innerHTML = `
      <div>
        <div class="inb-meta">${r.phone} · ${new Date(r.timestamp + 'Z').toLocaleTimeString()} · ${isOptOut ? r.status.replace('advanced_optout:', 'Advanced Opt-Out · ') : 'Free-form (needs human review)'}</div>
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
      advanceCoach('c', 3);
      logActivity({
        scene: 'c',
        kind: 'server', tag: 'Server',
        tech: 'POST /api/dnc/add',
        plain: `Adding <code>${phone}</code> to the app-side Do-Not-Contact list. All future Bulk sends will filter this number out before the API call.`,
      });
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
    dncListEl.innerHTML = '<div class="sub" style="padding: 8px 4px;">No numbers on DNC yet. Add one from the inbound stream.</div>';
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
      logActivity({
        scene: 'c',
        kind: 'server', tag: 'Server',
        tech: 'POST /api/dnc/remove',
        plain: `Removing <code>${phone}</code> from the app-side DNC list. Note: Twilio's own opt-out block list is Console-managed; the customer must text START to fully re-opt.`,
      });
      await fetch('/api/dnc/remove', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone }),
      });
    });
  });
}

// ────────── SSE ──────────
const es = new EventSource('/events');
es.addEventListener('hello', () => { /* connected — no chrome needed */ });
es.onerror = () => { /* connection dropped; browser will auto-reconnect */ };

es.onmessage = (e) => {
  try {
    const evt = JSON.parse(e.data);
    switch (evt.type) {
      case 'campaign.submitted': {
        setRaw(
          evt.request,
          { status: evt.status, body: evt.response && evt.response.body, headers: evt.response && evt.response.headers },
          'POST https://comms.twilio.com/v1/Messages · Bulk API'
        );
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
      case 'queue.scheduled': {
        loadQueue();
        addTimeline({
          label: 'Scheduled',
          detail: `${evt.messageSid} for ${evt.firstName || evt.phone}`,
          kind: 'send', at: evt.at,
        });
        break;
      }
      case 'queue.canceled': {
        loadQueue();
        addTimeline({
          label: 'Payment posted → canceled',
          detail: `${evt.messageSid || evt.phone} · status = ${evt.status}`,
          kind: 'suppress', at: evt.at,
        });
        break;
      }
      case 'message.inbound': {
        loadInbound();
        if (evt.optOutType) {
          addSystem(`Advanced Opt-Out matched: ${evt.optOutType}`);
          logActivity({
            scene: 'c',
            kind: 'twilio-in', tag: 'Twilio Inbound',
            tech: `POST /webhooks/twilio/inbound · OptOutType=${evt.optOutType}`,
            plain: `Twilio's <b>Advanced Opt-Out</b> matched <code>${evt.optOutType}</code>. Twilio already sent the custom Surge confirmation reply and added the number to its block list. Our webhook received the event with an <code>OptOutType</code> header for audit.`,
            doc: { url: 'https://www.twilio.com/docs/messaging/tutorials/advanced-opt-out', label: 'Docs · Advanced Opt-Out' },
          });
          advanceCoach('c', 2);
        } else {
          logActivity({
            scene: 'c',
            kind: 'twilio-in', tag: 'Twilio Inbound',
            tech: 'POST /webhooks/twilio/inbound',
            plain: `Twilio delivered a free-form inbound SMS from <code>${evt.from}</code>: "${escapeHtml(evt.body || '')}". No keyword matched — the message lands in the Ops Review Queue for a human.`,
            doc: { url: 'https://www.twilio.com/docs/messaging/tutorials/how-to-receive-and-reply', label: 'Docs · Receive & reply' },
          });
          advanceCoach('c', 3);
        }
        break;
      }
      case 'dnc.added': {
        loadDnc(); loadInbound();
        addTimeline({ label: 'Added to DNC', detail: evt.phone, kind: 'suppress', at: evt.at });
        logActivity({
          scene: 'c',
          kind: 'twilio-in', tag: 'DNC',
          plain: `<code>${evt.phone}</code> now on the app-side DNC list. Future sends will filter this number.`,
        });
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
