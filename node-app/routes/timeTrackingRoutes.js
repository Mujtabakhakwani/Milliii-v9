// routes/timeTrackingRoutes.js
const express = require('express');
const router = express.Router();
const timeTrackingController = require('../controllers/timeTrackingController');

router.get('/entries', timeTrackingController.getTimeEntries);
router.post('/clock-in', timeTrackingController.clockIn);
router.post('/clock-out', timeTrackingController.clockOut);

module.exports = router;
