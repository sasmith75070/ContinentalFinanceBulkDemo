require('dotenv').config();

// Usage: node scripts/bulk-scale-test.js [count]
// Default count = 10. Sends 1 to CUSTOMER_PHONE (real) + (count-1) to synthetic 555-area-code
// numbers that Twilio will mark unaddressable/failed. Purpose: verify the Bulk endpoint
// accepts and processes larger recipient lists without needing A2P 10DLC approval.

async function main() {
  const count = Math.max(1, parseInt(process.argv[2] || '10', 10));
  const missing = ['TWILIO_API_KEY_SID', 'TWILIO_API_KEY_SECRET', 'TWILIO_FROM_LONGCODE', 'CUSTOMER_PHONE'].filter((k) => !process.env[k]);
  if (missing.length) {
    console.error(`Missing env vars: ${missing.join(', ')}`);
    process.exit(1);
  }

  const auth = Buffer.from(
    `${process.env.TWILIO_API_KEY_SID}:${process.env.TWILIO_API_KEY_SECRET}`
  ).toString('base64');

  const recipients = [
    {
      address: process.env.CUSTOMER_PHONE,
      channel: 'PHONE',
      variables: { firstName: 'Jane', lastFour: '4832', dueDate: 'Sep 15', amountDue: '$47.50' },
    },
  ];

  // Fill with 555-exchange numbers (NANP-reserved for fictional use).
  for (let i = 1; i < count; i++) {
    const suffix = String(i).padStart(4, '0');
    recipients.push({
      address: `+1555010${suffix}`, // 555-01xx block, non-dialable
      channel: 'PHONE',
      variables: {
        firstName: `Test${i}`,
        lastFour: String(1000 + i).slice(-4),
        dueDate: 'Sep 15',
        amountDue: `$${(50 + (i % 50)).toFixed(2)}`,
      },
    });
  }

  const body = {
    from: { address: process.env.TWILIO_FROM_LONGCODE, channel: 'SMS' },
    to: recipients,
    content: {
      text: "Hi {{firstName | default: 'Customer'}}, your Surge Mastercard ending in {{lastFour | default: '0000'}} has a payment of {{amountDue | default: 'your balance'}} due on {{dueDate | default: 'soon'}}. Reply STOP to opt out.",
    },
  };

  console.log(`POST https://comms.twilio.com/v1/Messages  (${recipients.length} recipient(s), 1 real + ${recipients.length - 1} synthetic)`);
  console.log(`From: ${body.from.address}`);
  console.log('');

  const t0 = Date.now();
  const res = await fetch('https://comms.twilio.com/v1/Messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Basic ${auth}` },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  const t1 = Date.now();
  const parsed = tryParseJson(text);

  console.log(`HTTP ${res.status}  (${t1 - t0}ms)`);
  console.log('Response:', typeof parsed === 'object' ? JSON.stringify(parsed) : text);

  const operationId = parsed?.operationId;
  if (!operationId) {
    console.log('\nNo operationId returned. Aborting poll.');
    return;
  }

  console.log(`\nPolling Operations resource for ${operationId}...`);
  let lastStatus = null;
  for (let attempt = 0; attempt < 30; attempt++) {
    await sleep(1500);
    const opRes = await fetch(`https://comms.twilio.com/v1/Messages/Operations/${operationId}`, {
      headers: { Authorization: `Basic ${auth}` },
    });
    const opText = await opRes.text();
    const opBody = tryParseJson(opText);
    const status = opBody?.status || 'UNKNOWN';
    const stats = opBody?.stats || {};
    process.stdout.write(
      `  [${String(attempt + 1).padStart(2, ' ')}] status=${status.padEnd(11, ' ')} total=${stats.total ?? '-'} delivered=${stats.delivered ?? '-'} sent=${stats.sent ?? '-'} failed=${stats.failed ?? '-'} undelivered=${stats.undelivered ?? '-'} unaddressable=${stats.unaddressable ?? '-'}\n`
    );
    lastStatus = status;
    if (status === 'COMPLETED' || status === 'FAILED') break;
  }
  console.log(`\nFinal status: ${lastStatus}`);
}

function tryParseJson(s) {
  try { return JSON.parse(s); } catch { return s; }
}
function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

main().catch((err) => { console.error(err); process.exit(1); });
