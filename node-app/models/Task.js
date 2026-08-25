// models/Task.js
const mongoose = require('mongoose');

const taskSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true }, // uuid
    project_id: { type: String, required: true },
    title: { type: String, required: true },
    description: { type: String },
    status: {
      type: String,
      enum: ['todo', 'in_progress', 'review', 'done', 'archived'],
      default: 'todo',
    },
    priority: {
      type: String,
      enum: ['low', 'medium', 'high', 'urgent'],
      default: 'medium',
    },
    assignee: { type: String }, // user id
    due_date: { type: String }, // ISO string
    archived: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// IMPORTANT: model name must be 'Task', not 'Project'
module.exports =
  mongoose.models.Task || mongoose.model('Task', taskSchema);
