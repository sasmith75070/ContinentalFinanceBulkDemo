const $ = (id) => document.getElementById(id);

const sendBtn = $('send-btn');
const threadEl = $('thread');
const rawReq = $('raw-request');
const rawRes = $('raw-response');
const opIdEl = $('op-id');
const httpEl = $('http-status');
const statTotal = $('stat-total');
const statDelivered = $('stat-delivered');
const statFailed = $('stat-failed');
const statUnaddr = $('stat-unaddressable');

let currentOperationId = null;
let pollTimer = null;

// Track every operation we've seen this session so we can display cumulative totals.
// { operationId: { total, delivered, failed, unaddressable, status } }
const sessionOperations = {};

function updateSessionTotals() {
  const totals = { total: 0, delivered: 0, failed: 0, unaddressable: 0 };
  for (const op of Object.values(sessionOperations)) {
    totals.total += op.total || 0;
    totals.delivered += op.delivered || 0;
    totals.failed += op.failed || 0;
    totals.unaddressable += op.unaddressable || 0;
  }
  statTotal.textContent = totals.total;
  statDelivered.textContent = totals.delivered;
  statFailed.textContent = totals.failed;
  statUnaddr.textContent = totals.unaddressable;
}

function addToThread({ direction, body }) {
  const div = document.createElement('div');
  div.className = `bubble ${direction}`;
  div.textContent = body;
  threadEl.appendChild(div);
  threadEl.scrollTop = threadEl.scrollHeight;
}

function renderTemplate(text, vars) {
  return Object.entries(vars || {}).reduce(
    (acc, [k, v]) => acc.replaceAll(`{{${k}}}`, v),
    text
  );
}

async function sendCampaign() {
  sendBtn.disabled = true;
  try {
    const res = await fetch('/api/campaigns/send', { method: 'POST' });
    const data = await res.json();
    httpEl.textContent = res.status;
    opIdEl.textContent = data.operationId || '—';
    currentOperationId = data.operationId;
    rawRes.textContent = JSON.stringify(data, null, 2);
    if (currentOperationId) startPolling();
  } catch (err) {
    rawRes.textContent = `ERROR: ${err.message}`;
  } finally {
    sendBtn.disabled = false;
  }
}

function startPolling() {
  if (pollTimer) clearInterval(pollTimer);
  pollOnce();
  pollTimer = setInterval(pollOnce, 2000);
}

async function pollOnce() {
  if (!currentOperationId) return;
  try {
    const res = await fetch(`/api/operations/${encodeURIComponent(currentOperationId)}`);
    if (!res.ok) return;
    const data = await res.json();
    const s = data.stats || {};
    sessionOperations[currentOperationId] = {
      total: s.total || 0,
      delivered: s.delivered || 0,
      failed: s.failed || 0,
      unaddressable: s.unaddressable || 0,
      status: data.status,
    };
    updateSessionTotals();
    if (data.status === 'COMPLETED' || data.status === 'FAILED') {
      clearInterval(pollTimer);
    }
  } catch (err) {
    // ignore transient poll errors
  }
}

sendBtn.addEventListener('click', sendCampaign);

const es = new EventSource('/events');
es.onmessage = (e) => {
  try {
    const evt = JSON.parse(e.data);
    if (evt.type === 'campaign.submitted') {
      rawReq.textContent = JSON.stringify(evt.request, null, 2);
      const body = evt.request?.content?.text || '';
      const vars = evt.request?.to?.[0]?.variables || {};
      addToThread({ direction: 'outbound', body: renderTemplate(body, vars) });
    }
  } catch (err) { /* ignore malformed */ }
};
