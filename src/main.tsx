// api/health.js
import express from 'express';
const router = express.Router();

// Health check endpoint
router.get('/', async (req, res) => {
  try {
    // DB / service checks
    const dbIsHealthy = true; // እውነተኛ DB ping በእውነት ይቀይሩ
    const otherServiceOk = true;

    if (dbIsHealthy && otherServiceOk) {
      res.status(200).json({ status: 'ok', timestamp: new Date() });
    } else {
      res.status(500).json({ status: 'error', message: 'Service unavailable' });
    }
  } catch (err) {
    console.error("Health check failed:", err);
    res.status(500).json({ status: 'error', message: err.message });
  }
});

export default router;
