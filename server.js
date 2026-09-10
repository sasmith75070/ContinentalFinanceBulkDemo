require('dotenv').config();
const express = require('express');
const path = require('node:path');

const streamRouter = require('./routes/stream');
const sendRouter = require('./routes/send');
const operationsRouter = require('./routes/operations');
const inboundRouter = require('./routes/inbound');
const statusRouter = require('./routes/status');
const queueRouter = require('./routes/queue');
const dncRouter = require('./routes/dnc');

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false })); // Twilio webhooks are form-encoded
app.use(express.static(path.join(__dirname, 'public')));
app.use(streamRouter);
app.use(sendRouter);
app.use(operationsRouter);
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
