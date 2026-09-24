require('dotenv').config();
const express = require('express');
const path = require('node:path');

const streamRouter = require('./routes/stream');
const sendRouter = require('./routes/send');
const inboundRouter = require('./routes/inbound');
const statusRouter = require('./routes/status');
const queueRouter = require('./routes/queue');
const dncRouter = require('./routes/dnc');

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false })); // Twilio webhooks are form-encoded
app.use(express.static(path.join(__dirname, 'public')));
// Client-safe subset of the server config. Exposes only the sender phone
// so the UC3 prompt card can display whatever number is in this deployment's
// .env, without hardcoding the demo author's number in the source.
app.get('/api/config', (req, res) => {
  res.json({ smsLine: process.env.TWILIO_FROM_LONGCODE || null });
});

app.use(streamRouter);
app.use(sendRouter);
app.use(inboundRouter);
app.use(statusRouter);
app.use(queueRouter);
app.use(dncRouter);

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Continental Finance Bulk Messaging Demo running on http://localhost:${PORT}`);
  const required = [
    'TWILIO_ACCOUNT_SID',
    'TWILIO_API_KEY_SID',
    'TWILIO_API_KEY_SECRET',
    'TWILIO_FROM_LONGCODE',
    'CUSTOMER_PHONE',
  ];
  const missing = required.filter((k) => !process.env[k]);
  if (missing.length) console.warn(`WARN: missing env vars: ${missing.join(', ')}`);
});
