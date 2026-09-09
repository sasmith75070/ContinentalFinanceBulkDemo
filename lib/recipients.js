function buildRecipient({ phone, variables }) {
  return {
    address: phone,
    channel: 'PHONE',
    variables: variables || {},
  };
}

function customerRecipient() {
  const phone = process.env.CUSTOMER_PHONE;
  if (!phone) throw new Error('CUSTOMER_PHONE not set in env');
  return buildRecipient({
    phone,
    variables: {
      firstName: 'Jane',
      lastFour: '4832',
      dueDate: 'Sep 15',
      amountDue: '$47.50',
    },
  });
}

// TODO Day 2/3: replace with production-safe recipient padding for the 10k scale moment.
// Test-credential magic numbers only work with test credentials; production credentials
// need a different approach (e.g. deliberately invalid E.164 that resolves to `unaddressable`,
// or a switch to test credentials for the scale demo).
function magicNumberFill(count) {
  return [];
}

module.exports = { buildRecipient, customerRecipient, magicNumberFill };
