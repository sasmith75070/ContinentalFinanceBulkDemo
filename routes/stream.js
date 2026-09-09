const { Router } = require('express');

const router = Router();
const clients = new Set();

router.get('/events', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();
  res.write(`event: hello\ndata: ${JSON.stringify({ ok: true, ts: new Date().toISOString() })}\n\n`);

  clients.add(res);
  req.on('close', () => clients.delete(res));
});

function publish(event) {
  const payload = `data: ${JSON.stringify(event)}\n\n`;
  for (const c of clients) {
    try { c.write(payload); } catch (e) { /* client gone */ }
  }
}

module.exports = router;
module.exports.publish = publish;
