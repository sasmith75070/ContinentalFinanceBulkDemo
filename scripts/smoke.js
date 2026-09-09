require('dotenv').config();
const twilio = require('twilio');

async function main() {
  const required = [
    'TWILIO_ACCOUNT_SID',
    'TWILIO_API_KEY_SID',
    'TWILIO_API_KEY_SECRET',
    'TWILIO_FROM_LONGCODE',
    'CUSTOMER_PHONE',
  ];
  const missing = required.filter((k) => !process.env[k]);
  if (missing.length) {
    console.error(`Missing env vars: ${missing.join(', ')}`);
    process.exit(1);
  }

  const client = twilio(
    process.env.TWILIO_API_KEY_SID,
    process.env.TWILIO_API_KEY_SECRET,
    { accountSid: process.env.TWILIO_ACCOUNT_SID }
  );

  const msg = await client.messages.create({
    from: process.env.TWILIO_FROM_LONGCODE,
    to: process.env.CUSTOMER_PHONE,
    body: 'Smoke test: Continental Finance Bulk Demo scaffold is alive.',
  });

  console.log(`Sent  SID=${msg.sid}`);
  console.log(`Status=${msg.status}`);
  console.log(`From =${msg.from}  To=${msg.to}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
