// Recipient fixtures for the Continental Finance / Surge Mastercard demo.
//
// Only CUSTOMER_PHONE (presenter's cell) is a real deliverable number. Peer
// records use the 555-01xx block reserved for fictional numbers so a live Bulk
// send returns them as `unaddressable` in the Operations resource — a real
// demonstration of Bulk's per-recipient status tracking without spamming anyone.

const PEERS = [
  { firstName: 'Marcus',   lastFour: '2211', dueDate: 'Sep 15', amountDue: '$62.00', phone: '+12025550118' },
  { firstName: 'Alicia',   lastFour: '9034', dueDate: 'Sep 15', amountDue: '$45.00', phone: '+12025550143' },
  { firstName: 'Dwayne',   lastFour: '5561', dueDate: 'Sep 16', amountDue: '$120.00', phone: '+12025550164' },
  { firstName: 'Priya',    lastFour: '7788', dueDate: 'Sep 15', amountDue: '$35.00', phone: '+12025550172' },
  { firstName: 'Terrence', lastFour: '3040', dueDate: 'Sep 17', amountDue: '$88.50', phone: '+12025550189' },
  { firstName: 'Sofia',    lastFour: '4471', dueDate: 'Sep 15', amountDue: '$52.00', phone: '+12025550196' },
];

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

function customerRecord() {
  return {
    phone: process.env.CUSTOMER_PHONE || '',
    firstName: 'Jane',
    lastFour: '4832',
    dueDate: 'Sep 15',
    amountDue: '$47.50',
    isCustomer: true,
  };
}

function peerRecords() {
  return PEERS.map((p) => ({ ...p, isCustomer: false }));
}

function defaultQueue() {
  return [customerRecord(), ...peerRecords()];
}

module.exports = {
  buildRecipient,
  customerRecipient,
  customerRecord,
  peerRecords,
  defaultQueue,
};
