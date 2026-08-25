// models/Project.js
const mongoose = require('mongoose');

const projectSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true }, // uuid
    name: { type: String, required: true },
    description: { type: String },
    status: {
      type: String,
      enum: ['active', 'archived', 'completed'],
      default: 'active',
    },
    owner_id: { type: String }, // user id
    member_ids: [{ type: String }], // user ids
    client_name: { type: String },
    archived: { type: Boolean, default: false },
  },
  { timestamps: true }
);

module.exports = mongoose.models.Project || mongoose.model('Project', projectSchema);
