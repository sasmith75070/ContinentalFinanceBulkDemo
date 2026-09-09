require('dotenv').config();

async function main() {
  const required = ['TWILIO_API_KEY_SID', 'TWILIO_API_KEY_SECRET', 'TWILIO_FROM_LONGCODE', 'CUSTOMER_PHONE'];
  const missing = required.filter((k) => !process.env[k]);
  if (missing.length) {
    console.error(`Missing env vars: ${missing.join(', ')}`);
    process.exit(1);
  }

  const auth = Buffer.from(
    `${process.env.TWILIO_API_KEY_SID}:${process.env.TWILIO_API_KEY_SECRET}`
  ).toString('base64');

  const body = {
    from: { address: process.env.TWILIO_FROM_LONGCODE, channel: 'SMS' },
    to: [
      {
        address: process.env.CUSTOMER_PHONE,
        channel: 'PHONE',
        variables: {
          firstName: 'Jane',
          lastFour: '4832',
          dueDate: 'Sep 15',
          amountDue: '$47.50',
        },
      },
    ],
    content: {
      text:
        "Hi {{firstName | default: 'Customer'}}, this is a reminder that your Surge Mastercard ending in {{lastFour | default: '0000'}} has a payment of {{amountDue | default: 'your balance'}} due on {{dueDate | default: 'soon'}}. Reply STOP to opt out.",
    },
  };

  console.log('POST https://comms.twilio.com/v1/Messages');
  console.log('Body:', JSON.stringify(body, null, 2));
  console.log('');

  const res = await fetch('https://comms.twilio.com/v1/Messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Basic ${auth}`,
    },
    body: JSON.stringify(body),
  });

  const text = await res.text();

  console.log(`HTTP ${res.status}`);
  console.log('Headers:', Object.fromEntries(res.headers.entries()));
  console.log('Body:', text || '(empty)');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
