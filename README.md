# Continental Finance · SMS API Explainer

A sample application demonstrating how Twilio Programmable Messaging can be integrated into Continental Finance's own systems. Not a Twilio product interface — Twilio does not ship this UI. Every button in the dashboard fires a real Twilio API call against a real Twilio account.

Prepared for the Continental Finance SMS Campaign Requirements RFP (August 31, 2026) and the Amplix-led evaluation.

---

## What the demo answers

Three of the four RFP core use cases, live end-to-end:

| Tab | RFP use case | Mechanic |
| --- | --- | --- |
| **1 · Payment Reminder** | Payment Reminder & Past-Due Messaging | Programmable Messaging **Create Message**, immediate + scheduled (`scheduleType=fixed` + `sendAt`) |
| **2 · Message Pull-back** | Payment-Triggered Message Suppression | Scheduled Create Message + payment webhook + **Update Message** with `Status=canceled` |
| **3 · Response & Opt-Out** | Customer Response & Opt-Out Management | **Advanced Opt-Out** (Console-configured) + inbound webhook + app-side DNC list |

**RFP use case 4** (Message & Campaign Administration) is not a live tab. It is covered in `slides/demo-presenter-guide.pdf` as a talk-track with an explicit concession: SMS body copy still requires an application code change; Twilio does not ship a business-user editor for SMS bodies.

---

## Prerequisites

Set these up before running the demo. Total time: 15–20 minutes if you don't already have a Twilio account.

### 1. Local machine

- **Node.js 20 or newer** — download from [nodejs.org](https://nodejs.org/) or install with your package manager
- **Git** — to clone the repository
- **A code editor** — VS Code, Sublime, or anything that can edit a `.env` file
- **`ngrok`** — install from [ngrok.com/download](https://ngrok.com/download). Free tier is sufficient. Any HTTPS tunneling tool (Cloudflare Tunnel, localtunnel, etc.) works — ngrok is just the one referenced in this doc.

### 2. Twilio account

You need a Twilio account (trial or paid). Sign up at [twilio.com/try-twilio](https://www.twilio.com/try-twilio).

**A. Get your credentials.** In the Twilio Console, go to [API Keys & Tokens](https://console.twilio.com/us1/account/keys-credentials/api-keys) and note or create:
  - Your **Account SID** (`AC…`) — visible on the Console home page
  - Your **Auth Token** — Console home page
  - An **API Key** (`SK…`) + **API Secret** — click "Create API Key," name it, save the secret immediately (it's shown only once)

**B. Get a phone number.** In the Console, go to [Phone Numbers → Buy a number](https://console.twilio.com/us1/develop/phone-numbers/manage/search). A US long code is easiest for a demo. Toll-free and short codes work but require additional carrier registration.

**C. Create a Messaging Service.** In the Console, go to [Messaging → Services](https://console.twilio.com/us1/develop/sms/services) → **Create Messaging Service**:
  - Give it a name (e.g. "Continental Finance Demo")
  - Under **Sender Pool**, add the phone number from step B
  - Save the **Messaging Service SID** (`MG…`) — you'll need it for `.env`

**D. Enable Advanced Opt-Out on the Messaging Service.** In the same service, go to **Opt-Out Management** → toggle **Advanced** on. Configure the STOP/START/HELP reply copy. The presenter guide (`slides/demo-presenter-guide.pdf`) includes suggested wording in the appendix. **Required for Use Case 3.**

**E. (Optional) Enable Compliance Toolkit.** Same service, **Compliance Toolkit** section, toggle on. Not required for the demo to run, but adds consent/risk/known-litigators checks and is referenced in the Use Case 1 talk-track.

### 3. Cell phone

- You'll need a real cell phone in E.164 format for the demo — this is the "customer" number that receives every outbound SMS in Use Case 1 and Use Case 2, and the number you'll text FROM during Use Case 3.
- If Twilio's Geographic Permissions are enabled in your account, make sure the country the cell is in is allowed for SMS. Trial accounts also require the recipient number to be verified in Twilio's Console under [Verified Caller IDs](https://console.twilio.com/us1/develop/phone-numbers/manage/verified).

---

## Setup

```bash
# 1. Install dependencies
npm install

# 2. Copy the env template and fill in your Twilio values
cp .env.example .env
# then edit .env — every value is required (see table below)

# 3. Start the server
node server.js
# You should see: "Continental Finance Bulk Messaging Demo running on http://localhost:3001"

# 4. In a second terminal, start ngrok pointed at the server
ngrok http 3001
# Copy the https:// forwarding URL into .env as PUBLIC_BASE_URL, then restart the server

# 5. In the Twilio Console, set the Messaging Service inbound webhook URL to:
#    <PUBLIC_BASE_URL>/webhooks/twilio/inbound   (POST)

# 6. Open the dashboard
open http://localhost:3001
```

---

## Environment variables

Every value in `.env` is required unless noted:

| Variable | Purpose |
| --- | --- |
| `TWILIO_ACCOUNT_SID` | Account SID (starts with `AC`). |
| `TWILIO_API_KEY_SID` | API Key SID (starts with `SK`). Used for all authenticated calls. |
| `TWILIO_API_KEY_SECRET` | API Key secret. |
| `TWILIO_AUTH_TOKEN` | Account Auth Token — required for validating inbound webhook signatures. |
| `TWILIO_FROM_LONGCODE` | Sender phone number in E.164 (e.g. `+15551234567`). Must be attached to the Messaging Service below. |
| `TWILIO_MESSAGING_SERVICE_SID` | Messaging Service SID (`MG…`). Every Create Message call references it, and it is required for message scheduling and cancellation. |
| `CUSTOMER_PHONE` | The presenter's cell in E.164. Every outbound SMS goes here; every inbound in Use Case 3 originates here. |
| `SAFE_MODE` | `true` to refuse outbound sends to `CUSTOMER_PHONE`. Useful for rehearsal without spamming the presenter's cell. |
| `PUBLIC_BASE_URL` | The public HTTPS URL Twilio can reach for the inbound webhook. Typically the ngrok forwarding URL. |
| `PORT` | Server port. Defaults to `3001`. |
| `MESSAGE_INTENT` *(optional)* | Overrides the default `messageIntent` classification. Defaults to `notifications` (essential) — the correct classification for Continental Finance's transactional traffic. |

---

## Running the demo

1. Open [http://localhost:3001](http://localhost:3001) in a browser
2. Follow the step-by-step run-book in **`slides/demo-presenter-guide.pdf`**

Each tab has a "coach" strip at the top with numbered steps, a **Twilio Products used** panel listing the APIs each button calls, and a live activity log at the bottom that narrates every API request and response as it happens.

For text-based interaction on Use Case 3 (STOP / START / free-form), text the phone number stored in `TWILIO_FROM_LONGCODE` from a real cell phone.

---

## Between-demo cleanup

If you run the demo multiple times, some state persists in `data/demo.db`:

- **Reset the pending queue (UC2):** click **Reset queue** in the dashboard
- **Clear the DNC + inbound log (UC3):**
  ```bash
  sqlite3 data/demo.db "DELETE FROM messages WHERE direction='inbound'; DELETE FROM dnc;"
  ```
  Then click **Clear** in the UC3 activity log panel
- **Re-opt back in on Twilio's block list:** if the presenter texted STOP during the last run, Twilio has that cell on its Console-managed opt-out block list. Text **START** from that cell before the next demo, or subsequent UC1 sends will fail with error `21610`.

---

## Twilio Console prerequisites

The demo runs correctly only when the following are configured in the Twilio Console:

1. **Messaging Service** — `TWILIO_MESSAGING_SERVICE_SID` must reference a service in the same account. `TWILIO_FROM_LONGCODE` must be in that service's sender pool.
2. **Inbound Webhook URL** — set on the Messaging Service to `<PUBLIC_BASE_URL>/webhooks/twilio/inbound` (POST). Required for Use Case 3.
3. **Advanced Opt-Out** — enabled on the Messaging Service with custom STOP/START/HELP copy configured. Required for Use Case 3's automatic keyword path.
4. **Compliance Toolkit** *(optional)* — enabled if you want consent/risk/known-litigators checks on every send. Not required for the demo to run; addressed as a talk-track in Use Case 1.

---

## Architecture

- **Node 20 + Express** — single-process server, no build step
- **Server-Sent Events (SSE)** — the dashboard subscribes to `/events` and receives every server-originated event (queue updates, inbound messages, DNC changes) in real time
- **SQLite (`better-sqlite3`)** — file-backed at `data/demo.db`. Holds the pending queue, DNC list, inbound message log, and campaign history. Auto-created on first run.
- **Twilio Node SDK v5** — every API call goes through `client().messages.create()`, `client().messages(sid).update()`, or `client().messages(sid).fetch()`

### Twilio APIs the demo calls

| API | Where |
| --- | --- |
| `POST /2010-04-01/Accounts/{Sid}/Messages.json` (Create Message) | Use Case 1 send + schedule (`routes/send.js`), Use Case 2 schedule (`routes/queue.js`) |
| `POST /2010-04-01/Accounts/{Sid}/Messages/{Sid}.json` with `Status=canceled` (Update Message) | Use Case 2 cancel (`routes/queue.js`) |
| `GET /2010-04-01/Accounts/{Sid}/Messages/{Sid}.json` (Fetch Message) | Use Case 1 status polling (`routes/send.js`, `/api/messages/:sid`) |
| Advanced Opt-Out on the Messaging Service | Configured in Console; Use Case 3 receives `OptOutType` headers on the inbound webhook |
| Messaging Service | Referenced on every send; owns the sender pool + Advanced Opt-Out config |

### Continental Finance's own integration (not Twilio products)

Called out explicitly in the demo so the boundary is clear:

- The `/webhooks/payment` endpoint — Continental Finance's payment system fires it. Would come from Fiserv → DBA-managed process in production per the RFP.
- The pending queue — Continental Finance's data layer, holding the cardholders scheduled for today's reminder.
- The app-side DNC list — cross-sender suppression governance the RFP explicitly asks for. Separate from Twilio's Advanced Opt-Out block list.

---

## Use case detail

### Use Case 1 · Payment Reminder

Two buttons:

- **Send now** → `client.messages.create({ messagingServiceSid, to, body, messageIntent: 'notifications' })`. Twilio returns a MessageSid with an initial status. The dashboard polls `GET /Messages/{Sid}.json` every 750 ms until the message reaches a terminal state (`delivered` / `failed` / `undelivered` / `canceled`).
- **Schedule for 10am tomorrow ET** → same call plus `scheduleType: 'fixed'` and `sendAt`. Twilio returns status `scheduled` and fires at the sendAt time (min 15 min, max 7 days out).

Personalization is server-rendered before the API call (no template language). See `routes/send.js` → `renderBody()`.

**Compliance Toolkit talk-track:** CT is enabled on the Messaging Service, so every send passes through it — for consent, risk, and known-litigators checks. Because `messageIntent` is `notifications` (essential), CT does not enforce Quiet Hours; send-window timing stays in Continental Finance's scheduler, which is what the Schedule button demonstrates.

### Use Case 2 · Message Pull-back

Three buttons:

- **Reset queue** — rebuilds the pending queue from the `lib/recipients.js` fixture
- **Schedule Jane's reminder (20 min from now)** → `client.messages.create({ ..., scheduleType: 'fixed', sendAt: <+20min> })`. Twilio returns a MessageSid with status `scheduled`. Stored on Jane's queue row. Twilio Console deep-link appears in the timeline column.
- **Payment posted → cancel scheduled SMS** → fires `POST /webhooks/payment` (Continental Finance's own webhook shape). Server looks up Jane's stored MessageSid, then calls `client.messages(sid).update({ status: 'canceled' })`. Twilio flips the status. Queue row shows `Canceled`.

**Cancellation window:** cancellation only works while status is `scheduled`. Twilio moves scheduled messages to `queued` roughly 15 minutes before `sendAt`, at which point Update Message returns error `30409`. Design Continental Finance's schedule lead time so a cancel window is always available before send.

### Use Case 3 · Response & Opt-Out

No buttons for the outbound side — the presenter texts the phone number in `TWILIO_FROM_LONGCODE` from their cell.

- **STOP / START / HELP** — handled entirely by Twilio's Advanced Opt-Out on the Messaging Service. Twilio auto-replies with the configured copy, updates the block list, and POSTs the event to `/webhooks/twilio/inbound` with an `OptOutType` header. Dashboard renders a red-bordered row in the Inbound Stream.
- **Free-form text** — no auto-reply. Twilio posts the raw text to the same webhook. Dashboard renders an amber-bordered row in the Ops Review Queue. Click **Add to DNC** to place the number on the app-side DNC list; every subsequent send checks this list before the API call.

The DNC list is intentionally separate from Twilio's Advanced Opt-Out block list. The RFP asks for cross-sender governance — that is what the app-side DNC delivers.

---

## Repository layout

```
.
├── .env.example                    # required environment variables
├── package.json
├── server.js                       # Express entrypoint; mounts every route
├── README.md                       # this file
├── lib/
│   ├── recipients.js               # queue fixture: Jane (real) + 6 fictional peers on 555-01xx
│   ├── state.js                    # SQLite handle + schema
│   └── twilio.js                   # Twilio SDK client factory
├── routes/
│   ├── dnc.js                      # app-side DNC + inbound message reads (UC3)
│   ├── inbound.js                  # POST /webhooks/twilio/inbound (UC3)
│   ├── queue.js                    # queue reset + schedule + cancel webhook (UC2)
│   ├── send.js                     # /api/campaigns/send + /api/messages/:sid (UC1)
│   ├── status.js                   # POST /webhooks/twilio/status (Twilio status callbacks)
│   └── stream.js                   # GET /events (SSE)
├── public/
│   ├── index.html                  # single-page dashboard, three Use Case tabs
│   ├── app.js                      # SSE client, per-scene activity logs, UI wiring
│   └── styles.css
├── scripts/
│   ├── generate-presenter-pdf.js   # regenerate slides/demo-presenter-guide.pdf
│   ├── list-senders.js             # utility: list Messaging Service senders
│   └── smoke.js                    # single-SMS smoke test (verify auth end-to-end)
├── slides/
│   └── demo-presenter-guide.pdf    # regenerated with `npm run pdf`
└── data/                           # SQLite DB (gitignored); auto-created on first run
```

---

## npm scripts

```bash
npm start          # node server.js
npm run dev        # node --watch server.js (auto-restart on file changes)
npm run smoke      # single-SMS end-to-end sanity check
npm run pdf        # regenerate slides/demo-presenter-guide.pdf
```

---

## Honest concessions

Explicitly documented in the demo and the presenter guide — no product misrepresentation:

1. **No business-user SMS body editor.** Twilio does not ship one. Body copy edits are a code change, or a services engagement to build a content editor on top of Programmable Messaging.
2. **No programmatic re-opt from Twilio's Advanced Opt-Out block list.** Once a cardholder texts STOP, that entry is Console-managed; the cardholder must text START, or Support intervenes.
3. **Compliance Toolkit does not enforce Quiet Hours for this program.** Continental Finance's traffic is transactional (`messageIntent: 'notifications'`, essential), and essential messages bypass CT Quiet Hours by design. Send-window timing stays in Continental Finance's scheduler.
4. **Genesys is out of scope.** Continental Finance's contact center runs entirely on Genesys. Twilio is competing for SMS only. Agent visibility integrations would be a services engagement.

---

## Twilio doc references

- [Programmable Messaging · Create Message](https://www.twilio.com/docs/messaging/api/message-resource)
- [Message Scheduling](https://www.twilio.com/docs/messaging/features/message-scheduling)
- [Error 30409 — This message cannot be canceled](https://www.twilio.com/docs/api/errors/30409)
- [Advanced Opt-Out](https://www.twilio.com/docs/messaging/tutorials/advanced-opt-out)
- [Error 21610 — Attempt to send to unsubscribed recipient](https://www.twilio.com/docs/api/errors/21610)
- [Compliance Toolkit](https://www.twilio.com/docs/messaging/features/compliance-toolkit)
- [Messaging Services](https://www.twilio.com/docs/messaging/services)
