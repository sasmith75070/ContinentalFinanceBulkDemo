const BULK_ENDPOINT = 'https://comms.twilio.com/v1/Messages';

function requireEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}

function authHeader() {
  const keySid = requireEnv('TWILIO_API_KEY_SID');
  const keySecret = requireEnv('TWILIO_API_KEY_SECRET');
  return `Basic ${Buffer.from(`${keySid}:${keySecret}`).toString('base64')}`;
}

function tryParseJson(s) {
  try { return JSON.parse(s); } catch { return s; }
}

async function sendBulk({ from, to, content, schedule, tags }) {
  const body = { from, to, content };
  if (schedule) body.schedule = schedule;
  if (tags) body.tags = tags;

  const res = await fetch(BULK_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: authHeader(),
    },
    body: JSON.stringify(body),
  });

  const operationId =
    res.headers.get('operationId') ||
    res.headers.get('operation-id') ||
    res.headers.get('x-operation-id');
  const text = await res.text();
  const responseBody = text ? tryParseJson(text) : null;

  return {
    status: res.status,
    operationId,
    headers: Object.fromEntries(res.headers.entries()),
    body: responseBody,
    rawBody: text,
    ok: res.status >= 200 && res.status < 300,
  };
}

async function getOperation(operationId) {
  const res = await fetch(`${BULK_ENDPOINT}/Operations/${encodeURIComponent(operationId)}`, {
    headers: { Authorization: authHeader() },
  });
  const text = await res.text();
  const body = text ? tryParseJson(text) : null;
  return { status: res.status, body, ok: res.ok };
}

module.exports = { sendBulk, getOperation, BULK_ENDPOINT };
