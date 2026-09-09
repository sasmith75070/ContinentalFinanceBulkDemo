const { Router } = require('express');
const { getOperation } = require('../lib/bulk');

const router = Router();

router.get('/api/operations/:id', async (req, res) => {
  try {
    const result = await getOperation(req.params.id);
    res.status(result.status).json(result.body);
  } catch (err) {
    console.error('[operations] error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
