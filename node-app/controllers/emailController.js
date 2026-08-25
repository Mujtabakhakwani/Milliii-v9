// controllers/emailController.js
const emailService = require('../services/emailService');

exports.sendPasswordReset = async (req, res, next) => {
  try {
    const emailData = req.body; // { recipient, reset_link, expiration_hours, ... }

    const result = await emailService.sendPasswordReset(emailData);

    if (!result.success) {
      return res.status(500).json({
        success: false,
        message: result.message || 'Failed to send password reset email',
      });
    }

    res.json({
      success: true,
      message: 'Password reset email sent successfully',
      data: result.data || null,
    });
  } catch (err) {
    next(err);
  }
};
