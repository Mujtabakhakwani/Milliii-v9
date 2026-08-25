// routes/emailRoutes.js
const express = require('express');
const router = express.Router();
const emailController = require('../controllers/emailController');

// POST /api/email/send-password-reset
router.post('/send-password-reset', emailController.sendPasswordReset);

module.exports = router;
