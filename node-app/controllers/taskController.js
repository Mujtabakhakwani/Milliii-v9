// controllers/taskController.js
const { v4: uuidv4 } = require('uuid');
const Task = require('../models/Task');

exports.listTasks = async (req, res, next) => {
  try {
    const { project_id } = req.query;
    const filter = {};
    if (project_id) filter.project_id = project_id;

    const tasks = await Task.find(filter).lean();
    res.json({ success: true, data: tasks });
  } catch (err) {
    next(err);
  }
};

exports.createTask = async (req, res, next) => {
  try {
    const { project_id, title, description, assignee, priority } = req.body;

    const task = await Task.create({
      id: uuidv4(),
      project_id,
      title,
      description,
      assignee,
      priority,
    });

    res.status(201).json({ success: true, data: task });
  } catch (err) {
    next(err);
  }
};
