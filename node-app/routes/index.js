// routes/index.js
const express = require('express');
const router = express.Router();

// Health check – JSON only
router.get('/', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Milliii Node backend is running (JSON only)',
  });
});

module.exports = router;
