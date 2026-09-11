const { Router } = require('express');
const { client } = require('../lib/twilio');
const { defaultQueue } = require('../lib/recipients');
const { db } = require('../lib/state');
const { publish } = require('./stream');

const router = Router();

// Personalized reminder body — server-side rendered for Programmable Messaging.
const REMINDER_BODY = (r) =>
  `Hi ${r.firstName}, this is a reminder that your Surge Mastercard ending in ${r.lastFour} has a payment of ${r.amountDue} due on ${r.dueDate}. Reply STOP to opt out.`;

// Idempotent schema extensions for the schedule/cancel flow.
try { db.exec(`ALTER TABLE queue ADD COLUMN message_sid TEXT`); } catch {}
try { db.exec(`ALTER TABLE queue ADD COLUMN send_at TEXT`); } catch {}

function readQueue() {
  return db.prepare(`SELECT * FROM queue ORDER BY is_customer DESC, phone ASC`).all().map((r) => ({
    phone: r.phone,
    firstName: r.first_name,
    lastFour: r.last_four,
    dueDate: r.due_date,
    amountDue: r.amount_due,
    isCustomer: !!r.is_customer,
    status: r.status,
    messageSid: r.message_sid,
    sendAt: r.send_at,
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

// Schedule the reminder for Continental Finance's real cardholder (the
// presenter's cell) via Programmable Messaging Create Message.
//   scheduleType = 'fixed'
//   sendAt = now + 20 min (Twilio requires ≥ 15 min lead time)
//   messagingServiceSid = required for scheduling and cancellation
// https://www.twilio.com/docs/messaging/features/message-scheduling
router.post('/api/queue/schedule', async (req, res) => {
  try {
    if (!process.env.TWILIO_MESSAGING_SERVICE_SID) {
      return res.status(500).json({ error: 'TWILIO_MESSAGING_SERVICE_SID not set in env' });
    }
    const customerPhone = process.env.CUSTOMER_PHONE;
    const row = db.prepare(`SELECT * FROM queue WHERE phone = ?`).get(customerPhone);
    if (!row) {
      return res.status(404).json({ error: `${customerPhone} not in queue. Reset the queue first.` });
    }

    const sendAt = new Date(Date.now() + 20 * 60 * 1000).toISOString();
    const body = REMINDER_BODY({
      firstName: row.first_name,
      lastFour: row.last_four,
      dueDate: row.due_date,
      amountDue: row.amount_due,
    });

    const request = {
      messagingServiceSid: process.env.TWILIO_MESSAGING_SERVICE_SID,
      to: customerPhone,
      body,
      scheduleType: 'fixed',
      sendAt,
    };

    const message = await client().messages.create(request);

    db.prepare(
      `UPDATE queue SET status = ?, message_sid = ?, send_at = ?, updated_at = datetime('now')
       WHERE phone = ?`
    ).run(message.status, message.sid, sendAt, customerPhone);

    publish({
      type: 'queue.scheduled',
      phone: customerPhone,
      firstName: row.first_name,
      messageSid: message.sid,
      status: message.status,
      sendAt,
      request,
      response: { sid: message.sid, status: message.status, dateCreated: message.dateCreated },
      at: new Date().toISOString(),
    });

    res.json({
      phone: customerPhone,
      firstName: row.first_name,
      messageSid: message.sid,
      status: message.status,
      sendAt,
      request,
      response: { sid: message.sid, status: message.status, dateCreated: message.dateCreated },
    });
  } catch (err) {
    console.error('[queue/schedule] error:', err);
    res.status(500).json({ error: err.message, code: err.code, moreInfo: err.moreInfo });
  }
});

// Payment webhook: look up the MessageSid on this cardholder's queue row and
// cancel it via Update Message (Status=canceled). Cancellation is only
// available while the message is in `scheduled` status; Twilio moves it to
// `queued` ~15 min before sendAt, at which point Update Message returns
// error 30409.
// https://www.twilio.com/docs/api/errors/30409
router.post('/webhooks/payment', async (req, res) => {
  const phone = (req.body && req.body.phone) || '';
  if (!phone) return res.status(400).json({ error: 'phone required' });

  const row = db.prepare(`SELECT * FROM queue WHERE phone = ?`).get(phone);
  if (!row) return res.status(404).json({ error: 'phone not in current queue' });

  try {
    let canceledSid = null;
    let newStatus = 'suppressed';
    let twilioResponse = null;

    if (row.message_sid) {
      const updated = await client().messages(row.message_sid).update({ status: 'canceled' });
      canceledSid = row.message_sid;
      newStatus = updated.status;
      twilioResponse = { sid: updated.sid, status: updated.status, dateUpdated: updated.dateUpdated };
    }

    db.prepare(
      `UPDATE queue SET status = ?, updated_at = datetime('now') WHERE phone = ?`
    ).run(newStatus, phone);

    publish({
      type: 'queue.canceled',
      phone,
      firstName: row.first_name,
      messageSid: canceledSid,
      status: newStatus,
      payload: req.body || {},
      response: twilioResponse,
      at: new Date().toISOString(),
    });

    res.json({
      ok: true,
      phone,
      firstName: row.first_name,
      messageSid: canceledSid,
      status: newStatus,
      response: twilioResponse,
    });
  } catch (err) {
    console.error('[payment cancel] error:', err);
    res.status(400).json({
      error: err.message,
      code: err.code,
      hint: err.code === 30409
        ? 'Twilio has already moved this message out of scheduled status (typically ~15 min before sendAt). Cancellation is no longer available.'
        : undefined,
    });
  }
});

seedQueue();

module.exports = router;
