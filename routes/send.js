const { Router } = require('express');
const { client } = require('../lib/twilio');
const { customerRecord } = require('../lib/recipients');
const { db } = require('../lib/state');
const { publish } = require('./stream');

const router = Router();

// Personalization is rendered server-side for Programmable Messaging.
// Content is what actually goes on the wire in the `body` parameter.
function renderBody(r) {
  return `Hi ${r.firstName}, this is a reminder that your Surge Mastercard ending in ${r.lastFour} has a payment of ${r.amountDue} due on ${r.dueDate}. Reply STOP to opt out.`;
}

// Build a sendAt of "10:00 tomorrow ET" as an ISO datetime. PM's sendAt
// takes a single ISO datetime — it does NOT auto-localize per recipient.
// Continental Finance would compute this per-cardholder based on their
// timezone in production. For the demo we use ET.
function tomorrow10amEt() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  const pad = (n) => String(n).padStart(2, '0');
  // 10:00 ET during standard time is 15:00 UTC; during EDT it's 14:00 UTC.
  // We're pinning to -04:00 (EDT) for demo purposes — Sep is EDT.
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T10:00:00-04:00`;
}

router.post('/api/campaigns/send', async (req, res) => {
  try {
    if (!process.env.TWILIO_MESSAGING_SERVICE_SID) {
      return res.status(500).json({ error: 'TWILIO_MESSAGING_SERVICE_SID not set in env' });
    }
    const safeMode = process.env.SAFE_MODE === 'true';
    const dnc = new Set(db.prepare(`SELECT phone FROM dnc`).all().map((r) => r.phone));
    const scheduleFor = req.body && req.body.scheduleFor;

    const c = customerRecord();
    if (dnc.has(c.phone)) {
      return res.status(400).json({
        error: `Customer ${c.phone} is on the local DNC list. Remove them first, or use the DNC panel.`,
        blockedByDnc: [c.phone],
      });
    }
    if (safeMode) {
      return res.status(400).json({ error: 'SAFE_MODE is true; refusing to send to the real cell.' });
    }

    // messageIntent classifies the message for Compliance Toolkit's ML
    // pipeline. Continental Finance's traffic is entirely transactional
    // (payment reminders + past-due per RFP), so `notifications` is the
    // honest classification. Essential-category messages bypass CT Quiet
    // Hours enforcement, so Continental Finance's own scheduler retains
    // responsibility for the 8am–9pm-local send window (Message
    // Scheduling below). Env-overridable if counsel decides differently.
    const params = {
      messagingServiceSid: process.env.TWILIO_MESSAGING_SERVICE_SID,
      to: c.phone,
      body: renderBody(c),
      messageIntent: process.env.MESSAGE_INTENT || 'notifications',
    };
    if (scheduleFor) {
      params.scheduleType = 'fixed';
      params.sendAt = scheduleFor === 'tomorrow-10am-et' ? tomorrow10amEt() : scheduleFor;
    }

    const info = db
      .prepare(`INSERT INTO campaigns (name, payload_json) VALUES (?, ?)`)
      .run(scheduleFor ? 'surge-reminder-scheduled' : 'surge-reminder', JSON.stringify(params));
    const campaignId = info.lastInsertRowid;

    const message = await client().messages.create(params);

    db.prepare(
      `UPDATE campaigns SET operation_id = ?, status = ?, response_json = ? WHERE id = ?`
    ).run(
      message.sid,
      message.status,
      JSON.stringify({ sid: message.sid, status: message.status, dateCreated: message.dateCreated }),
      campaignId
    );

    publish({
      type: 'campaign.submitted',
      campaignId,
      messageSid: message.sid,
      status: message.status,
      scheduled: !!scheduleFor,
      sendAt: params.sendAt || null,
      to: c.phone,
      firstName: c.firstName,
      body: params.body,
      request: params,
      response: { sid: message.sid, status: message.status, dateCreated: message.dateCreated },
    });

    res.status(201).json({
      campaignId,
      messageSid: message.sid,
      status: message.status,
      scheduled: !!scheduleFor,
      sendAt: params.sendAt || null,
      request: params,
      response: { sid: message.sid, status: message.status, dateCreated: message.dateCreated },
    });
  } catch (err) {
    console.error('[send] error:', err);
    res.status(500).json({ error: err.message, code: err.code, moreInfo: err.moreInfo });
  }
});

// Fetch current status of a specific MessageSid. Replaces the old Bulk
// Operations polling endpoint. Called by the frontend at 750ms cadence to
// update the UC1 status card as Twilio transitions the message through
// queued → sending → sent → delivered.
router.get('/api/messages/:sid', async (req, res) => {
  try {
    const message = await client().messages(req.params.sid).fetch();
    res.json({
      sid: message.sid,
      status: message.status,
      errorCode: message.errorCode,
      errorMessage: message.errorMessage,
      dateCreated: message.dateCreated,
      dateSent: message.dateSent,
      dateUpdated: message.dateUpdated,
      numSegments: message.numSegments,
      price: message.price,
      priceUnit: message.priceUnit,
    });
  } catch (err) {
    res.status(500).json({ error: err.message, code: err.code });
  }
});

module.exports = router;
