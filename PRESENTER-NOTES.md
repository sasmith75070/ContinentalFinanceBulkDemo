# Presenter & Developer Notes

Everything the presenter and specialist need to run, extend, or verify the demo. The customer-facing README (`README.md`) is deliberately non-technical; this file holds the plumbing.

The full run-book (what to click, what to say) is in **`slides/demo-presenter-guide.pdf`**. Regenerate with `npm run pdf`.

---

## Quick start

Prerequisites: Node 20+, a Twilio account with a Messaging Service, a phone number (long code, toll-free, or short code) attached to that service, and Advanced Opt-Out configured on the service.

```bash
git clone git@github.com:sasmith75070/ContinentalFinanceBulkDemo.git
cd ContinentalFinanceBulkDemo
npm install
cp .env.example .env
# edit .env — fill in every value (see Configuration below)
node server.js
# in a second terminal:
ngrok http 3001
# open the dashboard
open http://localhost:3001
```

---

## Configuration

Every value in `.env` is required unless noted:

| Variable | Purpose |
| --- | --- |
| `TWILIO_ACCOUNT_SID` | Account SID (starts with `AC`). |
| `TWILIO_API_KEY_SID` | API Key SID (starts with `SK`). Used for all authenticated calls. |
| `TWILIO_API_KEY_SECRET` | API Key secret. |
| `TWILIO_AUTH_TOKEN` | Account Auth Token — required for validating inbound webhook signatures. |
| `TWILIO_FROM_LONGCODE` | Sender phone number in E.164. Must be attached to the Messaging Service below. |
| `TWILIO_MESSAGING_SERVICE_SID` | Messaging Service SID (`MG…`). Required — every Create Message call references it, and it is required for message scheduling and cancellation. |
| `CUSTOMER_PHONE` | The presenter's cell in E.164. This is the demo's "Jane." Every outbound SMS goes here; every inbound in Use Case 3 originates here. |
| `SAFE_MODE` | `true` to refuse outbound sends to `CUSTOMER_PHONE`. Used during rehearsal so the presenter's cell is not spammed. |
| `PUBLIC_BASE_URL` | The public URL Twilio can reach for inbound webhooks. Typically an ngrok tunnel. |
| `PORT` | Server port. Defaults to `3001`. |
| `MESSAGE_INTENT` *(optional)* | Overrides the default `messageIntent` classification. Defaults to `notifications` — the correct classification for Continental Finance's transactional traffic. |

---

## Twilio Console prerequisites

Before the demo runs correctly, configure the following in the Twilio Console:

1. **Messaging Service** — `TWILIO_MESSAGING_SERVICE_SID` must reference a service in the same account. `TWILIO_FROM_LONGCODE` must be in that service's sender pool.
2. **Inbound Webhook URL** — set on the Messaging Service to `<PUBLIC_BASE_URL>/webhooks/twilio/inbound` (POST). Required for Use Case 3.
3. **Advanced Opt-Out** — enabled on the Messaging Service. Custom STOP/START/HELP copy configured (see the appendix in the presenter guide for suggested wording). Required for Use Case 3's automatic STOP path.
4. **Compliance Toolkit** *(optional)* — enabled if you want consent/risk/known-litigators checks on every send. Not required for the demo to run; addressed as a talk-track in Use Case 1.

---

## Architecture

- **Node 20 + Express** — single-process server, no build step.
- **Server-Sent Events (SSE)** — the dashboard subscribes to `/events` and receives every server-originated event (queue updates, inbound messages, DNC changes) in real time.
- **SQLite (`better-sqlite3`)** — file-backed at `data/demo.db`. Holds the pending queue, DNC list, inbound message log, and campaign history. Reseeded on each server start's `seedQueue()` call.
- **Twilio Node SDK v5** — every API call goes through `client().messages.create()`, `client().messages(sid).update()`, or `client().messages(sid).fetch()`.
- **No Bulk Messaging.** `comms.twilio.com/v1/Messages` is not called anywhere. `lib/bulk.js` and `routes/operations.js` are deleted.

### Twilio APIs used

| API | Where |
| --- | --- |
| `POST /2010-04-01/Accounts/{Sid}/Messages.json` (Create Message) | Use Case 1 send + schedule (`routes/send.js`), Use Case 2 schedule (`routes/queue.js`) |
| `POST /2010-04-01/Accounts/{Sid}/Messages/{Sid}.json` with `Status=canceled` (Update Message) | Use Case 2 cancel (`routes/queue.js`) |
| `GET /2010-04-01/Accounts/{Sid}/Messages/{Sid}.json` (Fetch Message) | Use Case 1 status polling (`routes/send.js`, `/api/messages/:sid`) |
| Advanced Opt-Out on the Messaging Service | Configured in Console; Use Case 3 receives `OptOutType` headers on the inbound webhook |
| Messaging Service | Referenced on every send; owns the sender pool + Advanced Opt-Out config |

### Continental Finance's own integration (not Twilio products)

Called out honestly in the demo:

- The `/webhooks/payment` endpoint — Continental Finance's payment system fires it. Would come from Fiserv → DBA-managed process in production per the RFP.
- The pending queue — Continental Finance's data layer, holding the cardholders scheduled for today's reminder.
- The app-side DNC list — cross-sender suppression governance the RFP explicitly asks for. Separate from Twilio's Advanced Opt-Out block list.

---

## Use case details

### Use Case 1 · Payment Reminder

Two buttons in the dashboard:

- **Send now** → `client.messages.create({ messagingServiceSid, to, body, messageIntent: 'notifications' })`. Twilio returns a MessageSid with an initial status. The status card polls `GET /Messages/{Sid}.json` every 750 ms until the message reaches a terminal state (`delivered` / `failed` / `undelivered` / `canceled`).
- **Schedule for 10am tomorrow ET** → same call, plus `scheduleType: 'fixed'` and `sendAt`. Twilio returns status `scheduled`. Fires at the sendAt time.

Personalization is server-rendered (no Liquid). Continental Finance's application builds the body per cardholder before the API call. See `routes/send.js` → `renderBody()`.

**Compliance Toolkit** is enabled on the Messaging Service, so every send passes through it — for consent + risk + known-litigators checks. Because `messageIntent` is `notifications` (essential, given Continental Finance's transactional-only traffic), CT does not enforce Quiet Hours. Send-window timing remains Continental Finance's scheduler's responsibility, which is what the Schedule button demonstrates.

### Use Case 2 · Message Pull-back

Three buttons:

- **Reset queue** — rebuilds the pending queue from `lib/recipients.js` fixture.
- **Schedule Jane's reminder (20 min from now)** → `client.messages.create({ ..., scheduleType: 'fixed', sendAt: <+20min> })`. Twilio returns a MessageSid with status `scheduled`. Stored on Jane's queue row. Twilio Console deep-link appears in the timeline column.
- **Payment posted → cancel scheduled SMS** → fires `POST /webhooks/payment` (Continental Finance's own webhook shape). Server looks up Jane's stored MessageSid, then calls `client.messages(sid).update({ status: 'canceled' })`. Twilio flips the status. Queue row shows `Canceled`.

**Cancellation window:** cancellation only works while status is `scheduled`. Twilio moves scheduled messages to `queued` roughly 15 minutes before `sendAt`, at which point Update Message returns error `30409`. Design Continental Finance's schedule lead time so a cancel window is always available before send.

### Use Case 3 · Response & Opt-Out

No buttons for the outbound side — the presenter texts the Continental Finance SMS line from their cell.

- **STOP / START / HELP** — handled entirely by Twilio's Advanced Opt-Out on the Messaging Service. Twilio auto-replies with the configured STOP confirmation copy, updates the block list, and POSTs the event to `/webhooks/twilio/inbound` with an `OptOutType` header. The dashboard renders a red-bordered row in the Inbound Stream.
- **Free-form text** (anything non-keyword) — no auto-reply; Twilio posts the raw text to the same webhook. Dashboard renders an amber-bordered row. Presenter clicks **Add to DNC**, which adds the number to the app-side DNC list. Every subsequent PM send checks this list before the API call.

The DNC list is intentionally separate from Twilio's Advanced Opt-Out block list. The RFP asks for cross-sender governance ("how a customer appearing in multiple campaigns/brands should be handled when they opt out") — that is what the app-side DNC delivers.

---

## Repository layout

```
.
├── .env.example           # required environment variables, all documented
├── .gitignore
├── package.json
├── server.js              # Express entrypoint; mounts every route
├── lib/
│   ├── recipients.js      # queue fixture: Jane (real) + 6 fictional peers on 555-01xx
│   ├── state.js           # SQLite handle + schema
│   └── twilio.js          # Twilio SDK client factory
├── routes/
│   ├── dnc.js             # app-side DNC + inbound message reads (UC3)
│   ├── inbound.js         # POST /webhooks/twilio/inbound (UC3)
│   ├── queue.js           # queue reset + schedule + cancel webhook (UC2)
│   ├── send.js            # /api/campaigns/send + /api/messages/:sid (UC1)
│   ├── status.js          # POST /webhooks/twilio/status (Twilio status callbacks)
│   └── stream.js          # GET /events (SSE)
├── public/
│   ├── index.html         # single-page dashboard, three Use Case tabs
│   ├── app.js             # SSE client, per-scene activity logs, all UI wiring
│   └── styles.css         # palette, coach strips, activity log rows
├── scripts/
│   ├── generate-presenter-pdf.js   # regenerate slides/demo-presenter-guide.pdf
│   ├── smoke.js                    # single-SMS smoke test (verify auth end-to-end)
│   ├── list-senders.js             # utility: list Messaging Service senders
│   ├── bulk-scale-test.js          # RETIRED (Bulk-era); do not run
│   └── verify-bulk-endpoint.js     # RETIRED (Bulk-era); do not run
├── slides/
│   └── demo-presenter-guide.pdf    # regenerated with `npm run pdf`
└── data/                  # SQLite DB (gitignored); auto-created on first run
```

---

## npm scripts

```bash
npm start          # node server.js
npm run dev        # node --watch server.js
npm run smoke      # single-SMS end-to-end sanity check
npm run pdf        # regenerate slides/demo-presenter-guide.pdf
```

---

## Between-demo cleanup

Between demos (or after the presenter has texted STOP from their cell):

**Reset the pending queue (UC2):** click Reset queue in the dashboard.

**Clear the DNC + inbound log (UC3):**
```bash
sqlite3 data/demo.db "DELETE FROM messages WHERE direction='inbound'; DELETE FROM dnc;"
```
Then click the **Clear** button in the UC3 activity log panel.

**Re-opt back in on Twilio's block list:** if the presenter texted STOP during the demo, Twilio has their cell on the Console-managed opt-out block list. Text **START** from that cell before the next demo, or subsequent UC1 sends will fail with error `21610`.

---

## Honest concessions

Explicitly documented in the demo and the presenter guide:

1. **No business-user SMS body editor.** Twilio does not ship one. Body copy edits are a code change, or a services engagement to build a content editor on top of Programmable Messaging.
2. **No programmatic re-opt from Twilio's Advanced Opt-Out block list.** The block list is Console-managed; the customer must text `START`, or Support intervenes.
3. **Compliance Toolkit does not enforce Quiet Hours for this program.** `messageIntent: 'notifications'` (essential) is the honest classification for transactional traffic — and essential-category messages bypass CT Quiet Hours. Send-window timing stays in Continental Finance's scheduler.
4. **Genesys is out of scope.** Continental Finance's contact center is entirely Genesys; Twilio is competing for SMS only. Agent visibility integrations would be a services engagement.

---

## Known limitations

- `scripts/bulk-scale-test.js` and `scripts/verify-bulk-endpoint.js` are Bulk-era leftovers. They will not work against the current backend. Safe to delete.
- The plan file at `~/.claude/plans/continental-finance-bulk-demo.md` reflects the pre-pivot Bulk architecture and is stale.
- Repo name still starts with "Bulk" — intentional. The internal architecture is Programmable Messaging.

---

## References

- [Programmable Messaging · Create Message](https://www.twilio.com/docs/messaging/api/message-resource)
- [Message Scheduling](https://www.twilio.com/docs/messaging/features/message-scheduling)
- [Error 30409 — This message cannot be canceled](https://www.twilio.com/docs/api/errors/30409)
- [Advanced Opt-Out](https://www.twilio.com/docs/messaging/tutorials/advanced-opt-out)
- [Error 21610 — Attempt to send to unsubscribed recipient](https://www.twilio.com/docs/api/errors/21610)
- [Compliance Toolkit](https://www.twilio.com/docs/messaging/features/compliance-toolkit)
- [Messaging Services](https://www.twilio.com/docs/messaging/services)
