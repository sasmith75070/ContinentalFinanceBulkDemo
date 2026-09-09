require('dotenv').config();

async function main() {
  const missing = ['TWILIO_API_KEY_SID', 'TWILIO_API_KEY_SECRET'].filter((k) => !process.env[k]);
  if (missing.length) {
    console.error(`Missing env vars: ${missing.join(', ')}`);
    process.exit(1);
  }

  const auth = Buffer.from(
    `${process.env.TWILIO_API_KEY_SID}:${process.env.TWILIO_API_KEY_SECRET}`
  ).toString('base64');

  const res = await fetch('https://comms.twilio.com/v1/Senders', {
    headers: { Authorization: `Basic ${auth}` },
  });

  const text = await res.text();
  console.log(`HTTP ${res.status}`);
  try {
    const parsed = JSON.parse(text);
    const senders = parsed.senders || [];
    console.log(`\nFound ${senders.length} sender(s):\n`);
    for (const s of senders) {
      console.log(`  ${s.status.padEnd(11)}  ${s.channel.padEnd(8)}  ${s.address.padEnd(20)}  id=${s.id}`);
    }
    const long = process.env.TWILIO_FROM_LONGCODE;
    if (long) {
      const match = senders.find((s) => s.address === long);
      console.log(`\nYour TWILIO_FROM_LONGCODE (${long}):`);
      console.log(match ? `  status=${match.status}  channel=${match.channel}  senderId=${match.id}` : '  NOT FOUND in Senders list');
    }
  } catch {
    console.log('Raw body:', text);
  }
}

main().catch((err) => { console.error(err); process.exit(1); });
