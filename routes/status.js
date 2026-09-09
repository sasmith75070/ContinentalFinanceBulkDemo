const { Router } = require('express');
const { publish } = require('./stream');
const { db } = require('../lib/state');

const router = Router();

router.post('/webhooks/twilio/status', (req, res) => {
  const body = req.body || {};
  const messageSid = body.MessageSid || body.SmsSid;
  const messageStatus = body.MessageStatus || body.SmsStatus;
  const to = body.To;
  const errorCode = body.ErrorCode;

  console.log('[status]', { messageSid, messageStatus, to, errorCode });

  if (messageSid) {
    db.prepare(
      `UPDATE messages SET status = ? WHERE message_sid = ?`
    ).run(messageStatus || 'unknown', messageSid);
  }

  publish({
    type: 'message.status',
    messageSid,
    status: messageStatus,
    to,
    errorCode: errorCode || null,
    at: new Date().toISOString(),
  });

  res.status(200).send('OK');
});

module.exports = router;
