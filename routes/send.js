const { Router } = require('express');
const { sendBulk } = require('../lib/bulk');
const { customerRecipient } = require('../lib/recipients');
const { db } = require('../lib/state');
const { publish } = require('./stream');

const router = Router();

// Bulk Messaging requires the `default` Liquid filter on every variable occurrence.
// Use SINGLE QUOTES inside the filter — Twilio's Liquid parser rejects JSON-escaped double quotes.
const REMINDER_TEMPLATE =
  "Hi {{firstName | default: 'Customer'}}, this is a reminder that your Surge Mastercard ending in {{lastFour | default: '0000'}} has a payment of {{amountDue | default: 'your balance'}} due on {{dueDate | default: 'soon'}}. Reply STOP to opt out.";

// Build a "10:00 tomorrow" ISO expression WITHOUT a timezone marker so Twilio
// auto-localizes the delivery time to each recipient's timezone (determined
// from the address, falling back to UTC). Docs:
// https://www.twilio.com/docs/bulk-messaging/scheduling
function tomorrowLocal10am() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T10:00:00`;
}

router.post('/api/campaigns/send', async (req, res) => {
  try {
    const safeMode = process.env.SAFE_MODE === 'true';
    const dnc = new Set(db.prepare(`SELECT phone FROM dnc`).all().map((r) => r.phone));
    const scheduleFor = req.body && req.body.scheduleFor;

    const recipients = [];
    if (!safeMode) {
      const c = customerRecipient();
      if (dnc.has(c.address)) {
        return res.status(400).json({
          error: `Customer ${c.address} is on the local DNC list. Remove them first, or use the DNC panel.`,
          blockedByDnc: [c.address],
        });
      }
      recipients.push(c);
    }

    if (recipients.length === 0) {
      return res.status(400).json({
        error: 'No recipients. SAFE_MODE is true and no test-only recipients are configured yet.',
      });
    }

    const body = {
      from: { address: process.env.TWILIO_FROM_LONGCODE, channel: 'SMS' },
      to: recipients,
      content: { text: REMINDER_TEMPLATE },
    };
    if (scheduleFor) {
      body.schedule = { sendAt: [scheduleFor === 'tomorrow-10am-local' ? tomorrowLocal10am() : scheduleFor] };
    }

    const info = db
      .prepare(`INSERT INTO campaigns (name, payload_json) VALUES (?, ?)`)
      .run(scheduleFor ? 'surge-past-due-scheduled' : 'surge-past-due', JSON.stringify(body));
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
      recipientCount: recipients.length,
      scheduled: !!body.schedule,
      sendAt: body.schedule && body.schedule.sendAt && body.schedule.sendAt[0] || null,
      request: body,
      response: { status: result.status, body: result.body, headers: result.headers },
    });

    res.status(result.status).json({
      campaignId,
      operationId: result.operationId,
      status: result.status,
      recipientCount: recipients.length,
      scheduled: !!body.schedule,
      sendAt: body.schedule && body.schedule.sendAt && body.schedule.sendAt[0] || null,
      response: result.body,
    });
  } catch (err) {
    console.error('[send] error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
