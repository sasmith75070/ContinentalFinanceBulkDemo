const { Router } = require('express');
const { publish } = require('./stream');
const { db } = require('../lib/state');

const router = Router();

// Twilio posts form-encoded bodies to webhooks. This handler expects
// express.urlencoded() to be mounted in server.js.
router.post('/webhooks/twilio/inbound', (req, res) => {
  const body = req.body || {};
  const from = body.From;
  const to = body.To;
  const text = body.Body;
  const optOutType = body.OptOutType; // 'STOP' | 'START' | 'HELP' when Advanced Opt-Out matched

  console.log('[inbound]', { from, to, body: text, optOutType });

  db.prepare(
    `INSERT INTO messages (phone, direction, body, status) VALUES (?, 'inbound', ?, ?)`
  ).run(from || '', text || '', optOutType ? `advanced_optout:${optOutType}` : 'received');

  publish({
    type: 'message.inbound',
    from,
    to,
    body: text,
    optOutType: optOutType || null,
    receivedAt: new Date().toISOString(),
  });

  // Empty TwiML — Advanced Opt-Out already sent any auto-reply if a keyword matched.
  res.type('text/xml').status(200).send('<?xml version="1.0" encoding="UTF-8"?><Response></Response>');
});

module.exports = router;
