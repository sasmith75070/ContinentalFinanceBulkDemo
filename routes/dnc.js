const { Router } = require('express');
const { db } = require('../lib/state');
const { publish } = require('./stream');

const router = Router();

router.get('/api/dnc', (req, res) => {
  const rows = db.prepare(`SELECT phone, reason, added_at FROM dnc ORDER BY added_at DESC`).all();
  res.json({ dnc: rows });
});

router.post('/api/dnc/add', (req, res) => {
  const phone = (req.body && req.body.phone) || '';
  const reason = (req.body && req.body.reason) || 'ops_review';
  if (!phone) return res.status(400).json({ error: 'phone required' });

  db.prepare(
    `INSERT OR REPLACE INTO dnc (phone, reason, added_at) VALUES (?, ?, datetime('now'))`
  ).run(phone, reason);

  publish({ type: 'dnc.added', phone, reason, at: new Date().toISOString() });
  res.json({ ok: true, phone, reason });
});

router.post('/api/dnc/remove', (req, res) => {
  const phone = (req.body && req.body.phone) || '';
  if (!phone) return res.status(400).json({ error: 'phone required' });

  db.prepare(`DELETE FROM dnc WHERE phone = ?`).run(phone);
  publish({ type: 'dnc.removed', phone, at: new Date().toISOString() });
  res.json({ ok: true, phone });
});

router.get('/api/inbound', (req, res) => {
  const rows = db
    .prepare(
      `SELECT id, phone, body, status, timestamp
       FROM messages
       WHERE direction = 'inbound'
       ORDER BY id DESC
       LIMIT 100`
    )
    .all();
  res.json({ inbound: rows });
});

module.exports = router;
