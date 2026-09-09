const twilio = require('twilio');

function client() {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const keySid = process.env.TWILIO_API_KEY_SID;
  const keySecret = process.env.TWILIO_API_KEY_SECRET;
  if (!accountSid || !keySid || !keySecret) {
    throw new Error(
      'Missing Twilio credentials in env (TWILIO_ACCOUNT_SID, TWILIO_API_KEY_SID, TWILIO_API_KEY_SECRET)'
    );
  }
  return twilio(keySid, keySecret, { accountSid });
}

module.exports = { client };
