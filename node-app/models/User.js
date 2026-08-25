// models/User.js
const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true }, // uuid string
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    role: {
      type: String,
      enum: ['admin', 'manager', 'team_member', 'user'],
      required: true,
    },
    profile_image_url: { type: String },
    timezone: { type: String },
    permission_overrides: { type: Map, of: Boolean },
    is_online: { type: Boolean, default: false },
    last_seen_at: { type: String }, // ISO string
    is_active: { type: Boolean, default: true },
  },
  { timestamps: true }
);
module.exports = mongoose.models.User || mongoose.model('User', userSchema);

