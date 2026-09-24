# Continental Finance · SMS API Explainer

**A sample application demonstrating how Twilio Programmable Messaging can be integrated into Continental Finance's own systems.** Not a Twilio product interface. Every button in the dashboard fires a real Twilio API call — nothing is mocked or pre-recorded.

Prepared for the Continental Finance SMS Campaign Requirements RFP (August 31, 2026) and the Amplix-led evaluation.

---

## What this demo answers

Three of the four RFP core use cases, live end-to-end. Each is a real Twilio API call against a real Twilio account, sending real SMS to a real phone.

### Use Case 1 · Payment Reminder & Past-Due Messaging

Continental Finance sends **3.5 million payment reminders per month**, both proactive (upcoming payment due) and reactive (past-due delinquency). This tab shows the mechanic behind every one of those messages:

- **Send now** — a single Programmable Messaging API call. Twilio returns a MessageSid; the dashboard tracks the message through its full lifecycle (`queued → sending → sent → delivered`) with sub-second latency.
- **Schedule for 10am tomorrow ET** — the same API call with a `sendAt` value. Twilio holds the message and fires it at the scheduled time. Any per-cardholder timezone rule Continental Finance's scheduler applies produces the right per-message `sendAt`.

Every message has its own MessageSid, so every message is individually addressable, cancellable, and auditable.

### Use Case 2 · Payment-Triggered Message Suppression

Continental Finance's current lag from payment posting to reminder suppression is ~15 minutes. This tab demonstrates how Twilio's Update Message API closes that gap for messages already scheduled:

- **Schedule Jane's reminder (20 min out)** — a real Twilio scheduled send. Jane's row in the queue now has a MessageSid with status `scheduled`.
- **Payment posted → cancel scheduled SMS** — simulates Continental Finance's payment system firing a webhook. The server looks up Jane's MessageSid and calls Twilio's Update Message API with `Status=canceled`. Twilio drops the message before it reaches the carrier. Jane never gets a past-due reminder for a bill she already paid.
- **Verify in Twilio Console** — deep-link into Twilio's own Message Logs, where the status shows `canceled`. Full audit trail.

**Honest note on the cancellation window:** cancellation only works while the message is in `scheduled` status. Twilio moves scheduled messages into `queued` roughly 15 minutes before their fire time. After that, cancellation is no longer available. Continental Finance's schedule lead time should be designed with this window in mind.

### Use Case 3 · Customer Response & Opt-Out Management

Every inbound SMS from a cardholder is captured — keyword-matched or free-form. Two paths, both live:

- **STOP / START / HELP** — handled automatically by Twilio's Advanced Opt-Out feature. Continental Finance configures the reply copy once in the Twilio Console; Twilio sends the reply, updates its block list, and delivers an audit event to the application webhook. Zero code in Continental Finance's app.
- **Free-form inbound** (e.g., "please stop bugging me", "I paid this last week", "wrong number") — Twilio delivers the raw message to the application webhook. The dashboard surfaces it in an **Ops Review Queue** where a human decides what to do. One click adds the number to the **Do-Not-Contact list**, which is app-side and enforced across every sender Continental Finance ever adds — the cross-sender governance the RFP explicitly asks for.

### Use Case 4 · Message & Campaign Administration

Not a live tab. Addressed in the presenter guide as a talk-track with a specific concession: **SMS body copy still requires an application code change.** Twilio does not ship a business-user editor for SMS bodies. For everything else in RFP use case 4 — DNC management, opt-out wording, sender-pool configuration, scheduling, monitoring, alerts, reporting — the Twilio Console covers business-user self-service.

---

## What you're looking at

The dashboard is a **sample application** built specifically for this evaluation. It illustrates how Continental Finance would integrate Twilio Programmable Messaging into their own systems — the buttons trigger the same API calls their production platform would make.

Twilio does not ship this UI. Continental Finance would build their own admin surface on top of the same APIs. The value being demonstrated is the underlying Twilio capability — the Create Message endpoint, the Update Message endpoint with `Status=canceled`, the Advanced Opt-Out automation on the Messaging Service, the audit trail in the Twilio Console.

---

## Twilio capabilities demonstrated

| Capability | Where in the demo |
| --- | --- |
| **Programmable Messaging · Create Message** | Use Case 1 send + schedule, Use Case 2 schedule |
| **Message Scheduling** (`scheduleType=fixed` + `sendAt`) | Use Case 1 schedule button, Use Case 2 primary flow |
| **Programmable Messaging · Update Message** (`Status=canceled`) | Use Case 2 cancel button |
| **Fetch Message** (live status polling) | Use Case 1 status card |
| **Advanced Opt-Out** on the Messaging Service | Use Case 3 STOP / START / HELP path |
| **Inbound Webhook** | Use Case 3 free-form capture |
| **Messaging Service** | Sender pool + Advanced Opt-Out configuration |
| **Compliance Toolkit** *(on the path, talk-track)* | Consent + risk + known-litigators checks on every send |
| **Twilio Console — Message Logs** | Use Case 2 verification link |

---

## Honest concessions

Called out explicitly in the demo and the presenter guide — no product misrepresentation:

1. **No business-user SMS body editor.** Twilio does not ship one. Body copy edits are a code change, or a services engagement to build a content editor on top of Programmable Messaging.
2. **No programmatic re-opt from Twilio's Advanced Opt-Out block list.** Once a cardholder texts STOP, that entry is Console-managed; the cardholder must text START to re-subscribe, or Support intervenes.
3. **Compliance Toolkit does not enforce Quiet Hours for this program.** Continental Finance's traffic is transactional (`messageIntent: 'notifications'`, essential), and essential messages bypass CT Quiet Hours by design. Send-window timing stays in Continental Finance's scheduler.
4. **Genesys is out of scope.** Continental Finance's contact center runs entirely on Genesys. Twilio is competing for SMS only. Agent visibility integrations would be a services engagement.

---

## Presenter guide

The step-by-step run-book — what to click, what to say, what to point at — lives in `slides/demo-presenter-guide.pdf`.

Presenter, specialist, and developer notes (setup, `.env` reference, Console prerequisites, architecture, between-demo cleanup, npm scripts) are in [`PRESENTER-NOTES.md`](PRESENTER-NOTES.md).

---

## Doc references

Every Twilio API surface used in this demo is publicly documented:

- [Programmable Messaging · Create Message](https://www.twilio.com/docs/messaging/api/message-resource)
- [Message Scheduling](https://www.twilio.com/docs/messaging/features/message-scheduling)
- [Error 30409 — This message cannot be canceled](https://www.twilio.com/docs/api/errors/30409)
- [Advanced Opt-Out](https://www.twilio.com/docs/messaging/tutorials/advanced-opt-out)
- [Error 21610 — Attempt to send to unsubscribed recipient](https://www.twilio.com/docs/api/errors/21610)
- [Compliance Toolkit](https://www.twilio.com/docs/messaging/features/compliance-toolkit)
- [Messaging Services](https://www.twilio.com/docs/messaging/services)
