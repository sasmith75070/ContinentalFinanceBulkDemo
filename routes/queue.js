const { Router } = require('express');
const { sendBulk } = require('../lib/bulk');
const { buildRecipient, defaultQueue } = require('../lib/recipients');
const { db } = require('../lib/state');
const { publish } = require('./stream');

const router = Router();

// Liquid template used on the Bulk send. `default` filter on every variable —
// Twilio's Liquid parser rejects JSON-escaped double quotes, so single quotes inside.
const REMINDER_TEMPLATE =
  "Hi {{firstName | default: 'Customer'}}, this is a reminder that your Surge Mastercard ending in {{lastFour | default: '0000'}} has a payment of {{amountDue | default: 'your balance'}} due on {{dueDate | default: 'soon'}}. Reply STOP to opt out.";

function readQueue() {
  return db.prepare(`SELECT * FROM queue ORDER BY is_customer DESC, phone ASC`).all().map((r) => ({
    phone: r.phone,
    firstName: r.first_name,
    lastFour: r.last_four,
    dueDate: r.due_date,
    amountDue: r.amount_due,
    isCustomer: !!r.is_customer,
    status: r.status,
    suppressedReason: r.suppressed_reason,
  }));
}

function seedQueue() {
  db.prepare(`DELETE FROM queue`).run();
  const insert = db.prepare(
    `INSERT INTO queue (phone, first_name, last_four, due_date, amount_due, is_customer, status)
     VALUES (?, ?, ?, ?, ?, ?, 'pending')`
  );
  const tx = db.transaction((rows) => {
    for (const r of rows) {
      insert.run(r.phone, r.firstName, r.lastFour, r.dueDate, r.amountDue, r.isCustomer ? 1 : 0);
    }
  });
  tx(defaultQueue().filter((r) => !!r.phone));
}

router.get('/api/queue', (req, res) => {
  res.json({ queue: readQueue() });
});

router.post('/api/queue/reset', (req, res) => {
  seedQueue();
  const queue = readQueue();
  publish({ type: 'queue.reset', queue, at: new Date().toISOString() });
  res.json({ queue });
});

// Payment webhook. Shape mirrors what Continental Finance's payment system
// (Fiserv → their DBA-managed process) would produce. Marks the cardholder
// as suppressed in the pending queue. NO Twilio API call in this step —
// the suppression lives entirely in Continental Finance's data layer until
// the next Bulk send fires.
router.post('/webhooks/payment', (req, res) => {
  const phone = (req.body && req.body.phone) || '';
  if (!phone) return res.status(400).json({ error: 'phone required' });

  const before = db.prepare(`SELECT status, first_name FROM queue WHERE phone = ?`).get(phone);
  if (!before) return res.status(404).json({ error: 'phone not in current queue' });

  db.prepare(
    `UPDATE queue SET status = 'suppressed', suppressed_reason = 'payment_posted', updated_at = datetime('now')
     WHERE phone = ?`
  ).run(phone);

  publish({
    type: 'queue.suppressed',
    phone,
    firstName: before.first_name,
    reason: 'payment_posted',
    payload: req.body || {},
    at: new Date().toISOString(),
  });
  res.json({ ok: true, phone, firstName: before.first_name });
});

// Send today's reminder. Reads the pending queue AT THIS MOMENT, filters out
// cardholders on the app-side DNC, and calls the Bulk Messaging API with only
// the remaining recipients. This is the "list-right-before-send" mechanic —
// payment webhooks that arrive between scheduling and send time all take effect.
router.post('/api/queue/send', async (req, res) => {
  try {
    const safeMode = process.env.SAFE_MODE === 'true';
    const customerPhone = process.env.CUSTOMER_PHONE;

    const pending = readQueue().filter((r) => r.status === 'pending');
    if (pending.length === 0) {
      return res.status(400).json({ error: 'Queue is empty. Reset the queue first.' });
    }

    const dnc = new Set(db.prepare(`SELECT phone FROM dnc`).all().map((r) => r.phone));
    const safeExcluded = safeMode && customerPhone
      ? pending.filter((r) => r.phone === customerPhone).map((r) => r.phone)
      : [];
    const finalList = pending.filter((r) =>
      !dnc.has(r.phone) && !safeExcluded.includes(r.phone)
    );
    const blocked = pending.filter((r) => dnc.has(r.phone));

    const to = finalList.map((r) =>
      buildRecipient({
        phone: r.phone,
        variables: {
          firstName: r.firstName,
          lastFour: r.lastFour,
          dueDate: r.dueDate,
          amountDue: r.amountDue,
        },
      })
    );

    const body = {
      from: { address: process.env.TWILIO_FROM_LONGCODE, channel: 'SMS' },
      to,
      content: { text: REMINDER_TEMPLATE },
    };

    const info = db
      .prepare(`INSERT INTO campaigns (name, payload_json) VALUES (?, ?)`)
      .run('surge-10am-reminder', JSON.stringify(body));
    const campaignId = info.lastInsertRowid;

    const result = await sendBulk(body);

    db.prepare(
      `UPDATE campaigns SET operation_id = ?, status = ?, response_json = ? WHERE id = ?`
    ).run(
      result.operationId || null,
      result.ok ? 'submitted' : 'error',
      JSON.stringify({ status: result.status, body: result.body, headers: result.headers }),
      campaignId
    );

    publish({
      type: 'campaign.submitted',
      campaignId,
      operationId: result.operationId,
      status: result.status,
      recipientCount: to.length,
      suppressed: pending.length - finalList.length,
      blockedByDnc: blocked.map((r) => r.phone),
      safeModeExcluded: safeExcluded,
      request: body,
      response: { status: result.status, body: result.body, headers: result.headers },
    });

    res.status(result.status).json({
      campaignId,
      operationId: result.operationId,
      status: result.status,
      recipientCount: to.length,
      suppressedCount: pending.length - finalList.length,
      blockedByDnc: blocked.map((r) => r.phone),
      safeModeExcluded: safeExcluded,
      request: body,
      response: result.body,
    });
  } catch (err) {
    console.error('[queue/send] error:', err);
    res.status(500).json({ error: err.message });
  }
});

seedQueue();

module.exports = router;
