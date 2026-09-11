// Generate slides/demo-presenter-guide.pdf
// Run: `npm run pdf`

const fs = require('node:fs');
const path = require('node:path');
const PDFDocument = require('pdfkit');

const OUT_DIR = path.join(__dirname, '..', 'slides');
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });
const OUT = path.join(OUT_DIR, 'demo-presenter-guide.pdf');

const SURGE_RED = '#d81b3d';
const NAVY = '#0a1526';
const MUTED = '#5a6a86';

const doc = new PDFDocument({
  size: 'LETTER',
  margins: { top: 60, bottom: 60, left: 60, right: 60 },
  info: {
    Title: 'Continental Finance · Surge Mastercard SMS Demo · Presenter Guide',
    Author: 'Twilio Solutions Engineering',
    Subject: 'Presenter guide for the Twilio Bulk Messaging demo',
  },
});
doc.pipe(fs.createWriteStream(OUT));

// ────────── helpers ──────────
function h1(text) {
  doc.moveDown(0.3);
  doc.fillColor(NAVY).font('Helvetica-Bold').fontSize(22).text(text);
  doc.moveTo(60, doc.y + 4).lineTo(552, doc.y + 4).strokeColor(SURGE_RED).lineWidth(1.5).stroke();
  doc.moveDown(0.8);
}
function h2(text) {
  doc.moveDown(0.5);
  doc.fillColor(SURGE_RED).font('Helvetica-Bold').fontSize(11).text(text.toUpperCase(), { characterSpacing: 1.5 });
  doc.moveDown(0.2);
  doc.fillColor(NAVY).font('Helvetica-Bold').fontSize(15).text('');
}
function h3(text) {
  doc.moveDown(0.4);
  doc.fillColor(NAVY).font('Helvetica-Bold').fontSize(13).text(text);
  doc.moveDown(0.1);
}
function p(text, opts = {}) {
  doc.fillColor(NAVY).font('Helvetica').fontSize(10.5).text(text, { lineGap: 2, ...opts });
  doc.moveDown(0.25);
}
function muted(text) {
  doc.fillColor(MUTED).font('Helvetica-Oblique').fontSize(9.5).text(text, { lineGap: 1 });
  doc.moveDown(0.3);
}
function bullet(text) {
  doc.fillColor(NAVY).font('Helvetica').fontSize(10.5)
    .text('• ' + text, { indent: 6, lineGap: 2, paragraphGap: 2 });
}
function keyValue(k, v) {
  doc.fillColor(SURGE_RED).font('Helvetica-Bold').fontSize(10.5).text(k, { continued: true });
  doc.fillColor(NAVY).font('Helvetica').text('  ' + v);
  doc.moveDown(0.15);
}
function step(num, title, body) {
  doc.moveDown(0.35);
  doc.fillColor(SURGE_RED).font('Helvetica-Bold').fontSize(11).text('STEP ' + num, { continued: true });
  doc.fillColor(NAVY).font('Helvetica-Bold').text('  ' + title);
  doc.moveDown(0.15);
  doc.fillColor(NAVY).font('Helvetica').fontSize(10.5).text(body, { lineGap: 2 });
}
function newPage() { doc.addPage(); }
function code(text) {
  doc.font('Courier').fontSize(9.5).fillColor('#333').text(text, { lineGap: 1 });
  doc.moveDown(0.2);
}
function say(text) {
  doc.moveDown(0.15);
  doc.font('Helvetica-Oblique').fontSize(10.5).fillColor('#333')
    .text('Say: "' + text + '"', { lineGap: 2, indent: 8 });
  doc.moveDown(0.15);
}

// ────────── COVER ──────────
doc.rect(0, 0, 612, 792).fill(NAVY);
doc.fillColor('white').font('Helvetica-Bold').fontSize(11)
  .text('TWILIO · SOLUTIONS ENGINEERING', 60, 90, { characterSpacing: 2 });

doc.rect(60, 220, 200, 60).fill(SURGE_RED);
doc.fillColor('white').font('Helvetica-Bold').fontSize(30)
  .text('SURGE', 76, 232);
doc.fillColor('#f6c9cf').font('Helvetica').fontSize(9)
  .text('MASTERCARD®', 76, 265, { characterSpacing: 2 });

doc.fillColor('white').font('Helvetica-Bold').fontSize(34)
  .text('Continental Finance', 60, 340);
doc.fillColor(SURGE_RED).font('Helvetica-Bold').fontSize(20)
  .text('Twilio Bulk Messaging Demo', 60, 385);
doc.fillColor('#8ea0bd').font('Helvetica').fontSize(14)
  .text('Presenter Guide · Step-by-step run of book', 60, 415);

doc.fillColor('#8ea0bd').font('Helvetica').fontSize(10)
  .text('Prepared for: Amplix + Continental Finance RFP evaluation', 60, 700)
  .text('Date: ' + new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }), 60, 715)
  .text('Prepared by: Twilio SE', 60, 730);

// ────────── PURPOSE ──────────
newPage();
h1('Purpose & flow');
p('This demo answers Continental Finance\'s SMS RFP by proving three of the four core use cases live against Twilio\'s Programmable Messaging API. It runs 15–20 minutes end-to-end.');
p('The fourth use case (business-user campaign administration) is addressed as a talk-track in this document — Twilio Console covers most of it honestly, and we concede the one gap explicitly.');

h2('Three use cases, one browser, one cell phone');
keyValue('Use Case 1', 'Payment reminder + past-due messaging — high-volume, personalized, scheduled per RFP.');
keyValue('Use Case 2', 'Message pull-back — schedule + cancel via Update Message with Status=canceled.');
keyValue('Use Case 3', 'Response & opt-out — Advanced Opt-Out + free-form capture + DNC.');

h2('What you\'ll ask them to notice');
bullet('Per-message MessageSid — every send is individually addressable, cancellable, and auditable.');
bullet('Native scheduling from 15 min to 7 days out via scheduleType=fixed + sendAt.');
bullet('Per-cardholder timezone sendAt supports the RFP\'s 8am–9pm-local rule without segmentation gymnastics.');
bullet('Cancel-in-flight via Update Message with Status=canceled while message is still scheduled.');
bullet('STOP/START/HELP handled natively via Advanced Opt-Out — zero code.');
bullet('Free-form inbound captured for human review — real cross-sender DNC.');
bullet('At 3.5M/mo (~4/sec average), fan-out fits comfortably inside short-code throughput (100 MPS).');
bullet('Compliance Toolkit enabled — consent + risk + known-litigators checks on every send (talk-track).');

// ────────── SETUP ──────────
newPage();
h1('Pre-flight checklist');
p('Complete all six before the demo starts. Total time: ~2 minutes.');

step(1, 'Server up on :3001',
  'Terminal 1: cd ~/Documents/ContinentalFinanceBulkDemo && node server.js\nWatch for: "Continental Finance Bulk Messaging Demo running on http://localhost:3001". No missing env-var warnings.');

step(2, 'ngrok tunnel up',
  'Terminal 2: ngrok http 3001 --url sasmith.ngrok.app\nBrowser test: https://sasmith.ngrok.app/api/queue should return JSON (may 307 through ngrok abuse page — fine, Twilio\'s webhook UA bypasses it).');

step(3, 'Messaging Service inbound webhook',
  'Console → Messaging → Services → your Surge service → Integration → Inbound Webhook URL = https://sasmith.ngrok.app/webhooks/twilio/inbound. Method: POST.');

step(4, 'Advanced Opt-Out configured',
  'Same service → Opt-Out Management → Advanced enabled. Custom Surge STOP copy set (see appendix for suggested wording). Keywords: STOP/START/HELP.');

step('4b', 'Compliance Toolkit (optional)',
  'Console → Messaging → Services → your Surge service → Compliance Toolkit. Enabled is fine; it will apply consent/risk/litigators checks on the path. Continental Finance\'s traffic is classified as notifications (essential), so CT Quiet Hours enforcement does not apply — timing stays in Continental Finance\'s scheduler. Not required for the demo to run.');

step(5, 'Dashboard open',
  'Browser: http://localhost:3001 — you should see the Continental Finance SMS Operations header and three Use Case tabs (1, 2, 3).');

step(6, 'Cell in hand, signal confirmed',
  'You\'ll text to the Surge long code from your cell during Use Case 3. Test with a single "test" text before the demo starts — it will show up in the Inbound stream and you\'ll know the round-trip works.');

muted('Fallback: if ngrok flakes or Twilio 5xx during the demo, you have a screen-recorded backup take. Do not attempt to fix live — pivot to the recording and keep talking.');

// ────────── USE CASE 1 ──────────
newPage();
h1('Use Case 1 · Payment Reminder');
muted('RFP use case 1: high-volume payment reminder + past-due messaging. Target: 3 minutes.');

h3('Open on Use Case 1 tab');
say('Continental Finance sends 3.5 million payment reminders a month — both proactive upcoming-payment nudges and past-due delinquency messaging — from short codes, inside an 8-to-9 ET window. Watch what one Programmable Messaging call looks like.');

step(1, 'Click "Send now"',
  'Dashboard hits our server. Server renders Jane\'s personalized body and calls client.messages.create() with the Messaging Service SID, the recipient, the body, and messageIntent="notifications". Twilio returns 201 Created + a MessageSid. The status card flips through queued → sending → sent → delivered as GET /Messages/{Sid} is polled every 750ms. Your cell buzzes with the real message.');
say('One API call, one MessageSid. At Continental Finance\'s 3.5 million a month — about four per second average — this is a fan-out: one call per cardholder. A single short code handles 100 messages per second, so throughput is not the bottleneck. And every message has its own SID: fully cancellable, fully auditable, one row per cardholder in Console.');

step(2, 'Click "Schedule for 10am tomorrow ET"',
  'Same Programmable Messaging endpoint, this time with scheduleType=fixed and sendAt=<tomorrow 10:00 ET>. Twilio returns a MessageSid with status=scheduled. This message will hold on Twilio\'s schedule and fire at the sendAt time.');
say('Programmable Messaging supports scheduling from fifteen minutes to seven days out. Continental Finance would compute per-cardholder sendAt in their scheduler based on each cardholder\'s timezone — that gives them the 8am-9pm-local rule the RFP requires, at the granularity the RFP requires it, without any segmentation gymnastics in their file. That work stays in their scheduler where it already lives; it just gets easier with per-message sendAt values instead of batched sends.');

h3('Compliance Toolkit — talk-track');
p('Compliance Toolkit is enabled on the Messaging Service, so every outbound message flows through it. What CT gives Continental Finance on the path: consent enforcement, risk-check evaluation, known-litigators screening, per-recipient TCPA metadata.');
p('Because Continental Finance\'s traffic is entirely transactional — payment reminders + past-due, no marketing — the correct classification is messageIntent="notifications" (essential). Essential-category messages bypass CT Quiet Hours enforcement, so send-window timing stays where it belongs: in Continental Finance\'s scheduler, using per-cardholder sendAt.');
say('If evaluators ask whether CT could handle the send window automatically: technically yes for non-essential traffic, but their program is not non-essential. We passed on the mislabel — it would be a bigger compliance problem than the one it solved.');


// ────────── USE CASE 2 ──────────
newPage();
h1('Use Case 2 · Message Pull-back (Payment-Triggered Cancel)');
muted('RFP use case 2: "receive payment/account updates quickly enough to remove customers from active campaigns and prevent unnecessary reminders after payment." Target: 4 minutes.');

h3('Open Use Case 2 tab');
say('Continental Finance\'s current lag from payment to suppression is about fifteen minutes. Payment posts, but the SMS provider does not know about it in time, and the reminder still fires. Watch how message pull-back on Programmable Messaging closes that gap for scheduled sends.');

step(1, 'Click "Schedule Jane\'s reminder (20 min from now)"',
  'Our server calls POST /2010-04-01/Accounts/{Sid}/Messages.json with scheduleType=fixed, sendAt=+20min, and the Messaging Service SID. Twilio returns a MessageSid and status=scheduled. Jane\'s row in the queue table shows the MessageSid; status badge flips to "Scheduled" (blue). The Twilio Console link lights up on the right so you can verify Twilio\'s view of the state.');
say('Twilio now holds this message on its schedule. It will fire in twenty minutes unless we cancel it first. Every cardholder scheduled the same way gets their own MessageSid — no batch handle, no shared operationId. Each message is independently addressable.');

step(2, 'Click "Payment posted → cancel scheduled SMS"',
  'Simulates Continental Finance\'s payment system firing a webhook — POST /webhooks/payment with {phone, accountId, amount, postedAt}. Our server looks up Jane\'s MessageSid, then calls POST /2010-04-01/Accounts/{Sid}/Messages/{MessageSid}.json with Status=canceled. Twilio returns status=canceled. The queue row flips to "Canceled" (red).');
say('That was one API call to pull back one specific message. Update Message with Status=canceled. Twilio drops the scheduled SMS before it ever reaches the carrier. At Continental Finance\'s scale, this is the pattern: payment webhook fires, server looks up the MessageSid for that cardholder, cancel API call goes out. Millisecond latency, per-cardholder precision.');

step(3, 'Verify in Twilio Console',
  'Click the "Open in Twilio Console" link on the right side of the scene. Console → Monitor → Logs → Messaging shows the MessageSid with status=canceled. Refresh to confirm.');
say('That is the audit record. Continental Finance\'s compliance team, or Amplix during their review, can walk this trail for any message: scheduled at X, canceled at Y, never delivered. No cardholder ever saw the past-due reminder they had already paid.');

h3('Honest note on the cancellation window');
p('Cancellation is only available while status = scheduled. Twilio moves scheduled messages to queued approximately 15 minutes before sendAt. After that, Update Message returns error 30409 and the message is committed.');
p('Practical implication for Continental Finance: design schedule lead time so there is always a cancel window before send. If a payment can post right up to the reminder fire time, schedule at least 15 minutes into the future.');
say('This is documented behavior. If evaluators ask what happens if payment posts fourteen minutes before send: Twilio returns error thirty-thousand-four-oh-nine, the message is already committed to queue. Design your lead time accordingly.');

// ────────── SCENE C ──────────
newPage();
h1('Use Case 3 · Response & Opt-Out');
muted('RFP use case 3: capture every inbound, handle STOP compliantly, review the rest, block on request. Target: 5 minutes. Two things happen here — the automated path (STOP/START/HELP handled entirely by Twilio) and the manual path (free-form text captured for a human).');

h3('Open Use Case 3 tab');
say('Every SMS platform has to handle inbound messages from customers. There are two flavors: the compliance-critical keywords like STOP, and everything else. Watch how Twilio handles each.');

step(1, 'PART A — Text "STOP" from your cell to the Surge long code',
  'Within 1–2 seconds:\n• Twilio auto-replies with your custom Surge confirmation copy — no code on your side.\n• A red-bordered row appears in the Inbound Stream: "Advanced Opt-Out · STOP".\n• The activity log narrates the OptOutType=STOP event with a link to the Twilio doc.\n• Twilio adds your cell to its block list.');
say('That reply, that block-list entry, that audit record — all handled by Twilio\'s Advanced Opt-Out feature on the Messaging Service. You configured the reply copy once in Console. No downstream sync, no code, no risk of missing a STOP.');

step(2, 'PART A — Prove the block by trying to send again',
  'Click the Use Case 1 tab. Click "Send now". The activity log will show Twilio accepted the request but the response will surface error 21610 — attempt to send to unsubscribed recipient — and the Delivered counter for your cell does not increment.');
say('Continental\'s STOP compliance is now enforced at the Twilio edge. Even a rogue downstream send is blocked before it leaves. That\'s a compliance posture your incumbent can\'t match without your engineers writing the enforcement themselves.');

step(3, 'PART A — Text "START" to re-opt',
  'Back on Use Case 3. Text START from your cell. Twilio auto-replies with the re-opt confirmation. Row appears: "Advanced Opt-Out · START". Number is removed from Twilio\'s block list. Future sends go through.');
say('Same automation for opt-in. Same audit trail. Same zero code.');

newPage();
h1('Use Case 3 · continued');

step(4, 'PART B — Text "please stop bugging me" from your cell',
  'This is NOT a keyword. Twilio doesn\'t classify it. Twilio delivers the raw text to our inbound webhook. An amber-bordered row appears in the Inbound Stream: "Free-form (needs human review)".');
say('Every SMS platform has this problem: cardholders don\'t always say STOP. They say "quit texting me," or "I paid this last week," or "wrong number." Your incumbent misses these because it only classifies the exact word STOP. Watch what Twilio does.');

step(5, 'PART B — Click "Add to DNC" on that row',
  'The row moves. The Do-Not-Contact panel on the right lists that number. Timeline in the activity log stamps the addition.');
say('That number is now on our app-side Do-Not-Contact list. This is a suppression layer that Continental controls — separate from Twilio\'s Advanced Opt-Out block list. Two important reasons.');
p('One: it works across every sender you ever add. If you buy a second Surge number tomorrow, the DNC still applies. That\'s the cross-sender governance the RFP explicitly asks for. Two: it lets a compliance officer intervene proactively — for example, adding a number after a support call, or a complaint routed through Genesys.');

step(6, 'PART B — Prove the DNC block by trying to send again',
  'Click the Use Case 1 tab. Click "Send now". The response payload will show "blockedByDnc": [<your cell>]. The send never leaves our server — Twilio isn\'t even called for that number.');
say('That\'s defense in depth. Twilio blocks at the edge for STOP. We block before the API call for our own DNC list. Cardholders don\'t receive messages they asked us to stop.');

muted('Honest concession on re-opt: Twilio\'s Advanced Opt-Out block list is Console-managed. There is no public REST API to remove a number from that block list — the customer must text START. If Continental wants programmatic re-opt for support-desk workflows, that\'s a Support case or a manual Console action.');

// ────────── ADMIN TALK-TRACK ──────────
newPage();
h1('RFP use case 4 · Business-user administration (talk-track)');
muted('No live UI. This is the section you present with slides on the projector when the evaluation team asks about business-user self-service.');

h2('Business users self-serve for');
bullet('DNC / suppression list management via Messaging > Advanced Opt-Out (Console).');
bullet('Opt-out confirmation wording — the custom Surge copy is editable in Console without a code deploy.');
bullet('Sender Pool / Messaging Service configuration — add or remove numbers, change routing rules.');
bullet('Scheduling adjustments and pausing campaigns — Programmable Messaging scheduling window from 15 min to 7 days out.');
bullet('Delivery monitoring, alerts, reports — Console + Insights + Event Streams for BI destinations.');
bullet('User & role management via Twilio IAM for tenant-scoped access.');

h2('Where we concede honestly');
p('Changing SMS body copy itself still requires an application code change. Twilio does not ship a business-user editor for SMS body text.');
p('If Continental Finance wants a business-user-facing content editor on top of Programmable Messaging, that is a scoped services engagement — quoted separately. We won\'t fake it in this demo.');
say('The RFP explicitly asks for business-user self-service without IT code changes. For everything except message body copy, Console + IAM cover it. For message body copy, you get a services engagement price with a real Twilio partner. That is honest, and if that gap is the deal-breaker, we\'ll size the services engagement in the follow-up.');

// ────────── CONCESSIONS SUMMARY ──────────
newPage();
h1('Honest concessions summary');
muted('You will get asked. Answer directly.');

h2('Business-user SMS body editor');
p('Twilio does not ship this. Console covers DNC, sender config, opt-out wording, scheduling, monitoring — but NOT body copy. Body copy edits are a code change, or a services engagement to build a content editor on top of Programmable Messaging.');

h2('Programmatic re-opt from Twilio block list');
p('Advanced Opt-Out block list is Console-managed. No public REST API to remove numbers from that block list. Customer texts START, or Support intervenes.');

h2('Genesys integration');
p('Continental\'s contact center is entirely Genesys. Twilio is not competing to replace it. If agents ever need SMS visibility inside Genesys, that\'s a services integration — not part of this demo.');

// ────────── APPENDIX ──────────
newPage();
h1('Appendix · Suggested Advanced Opt-Out copy');

h3('STOP confirmation');
code('You\'ve been unsubscribed from Surge Mastercard reminders.\nReply START to resubscribe. For help, reply HELP.');

h3('START confirmation');
code('You\'re re-subscribed to Surge Mastercard reminders.\nMsg&data rates may apply. Reply STOP to opt out.');

h3('HELP reply');
code('Surge Mastercard from Continental Finance.\nCall 1-877-xxx-xxxx for cardholder services.\nMsg&data rates may apply. Reply STOP to opt out.');

h1('Appendix · Sample Programmable Messaging payloads');

h3('Immediate send');
code('POST /2010-04-01/Accounts/{AccountSid}/Messages.json\n\nmessagingServiceSid = MG…\nto = +15551234567\nbody = "Hi Jane, this is a reminder that your Surge Mastercard ending in 4832 has a payment of $47.50 due on Sep 15. Reply STOP to opt out."');

h3('Scheduled send (15 min – 7 days out)');
code('POST /2010-04-01/Accounts/{AccountSid}/Messages.json\n\nmessagingServiceSid = MG…\nto = +15551234567\nbody = "Hi Jane, this is a reminder…"\nscheduleType = fixed\nsendAt = 2026-09-12T14:00:00Z');
p('Returns MessageSid + status=scheduled.');

h3('Cancel a scheduled message');
code('POST /2010-04-01/Accounts/{AccountSid}/Messages/{MessageSid}.json\n\nStatus = canceled');
p('Returns status=canceled. Only valid while message is in scheduled status; returns error 30409 otherwise.');

doc.end();
console.log('Wrote', OUT);
