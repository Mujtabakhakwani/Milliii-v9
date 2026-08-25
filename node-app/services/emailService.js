// services/emailService.js
// Implement with nodemailer or your GHL email logic
exports.sendPasswordReset = async (emailData) => {
  const { recipient, reset_link, expiration_hours } = emailData;

  console.log('Sending password reset email to:', recipient);
  console.log('Link:', reset_link, 'Expires in:', expiration_hours, 'hours');

  // TODO: integrate your real email sending logic
  return {
    success: true,
    data: { recipient, reset_link },
  };
};
