// models/TimeEntry.js
const mongoose = require('mongoose');

const timeEntrySchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true }, // uuid
    user_id: { type: String, required: true },
    task_id: { type: String },
    project_id: { type: String },
    break_id: { type: String },
    is_break: { type: Boolean, default: false },
    clock_in_time: { type: String, required: true }, // ISO
    clock_out_time: { type: String }, // ISO
    duration_seconds: { type: Number },
    is_active: { type: Boolean, default: true },
    clock_out_note: { type: String },
  },
  { timestamps: true }
);

// IMPORTANT: variable name must match exactly: timeEntrySchema
module.exports =
  mongoose.models.TimeEntry || mongoose.model('TimeEntry', timeEntrySchema);
