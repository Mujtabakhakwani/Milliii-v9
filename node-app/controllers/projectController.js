// controllers/projectController.js
const { v4: uuidv4 } = require('uuid');
const Project = require('../models/Project');

exports.listProjects = async (req, res, next) => {
  try {
    const projects = await Project.find().lean();
    res.json({ success: true, data: projects });
  } catch (err) {
    next(err);
  }
};

exports.createProject = async (req, res, next) => {
  try {
    const { name, description, owner_id } = req.body;

    const project = await Project.create({
      id: uuidv4(),
      name,
      description,
      owner_id,
    });

    res.status(201).json({ success: true, data: project });
  } catch (err) {
    next(err);
  }
};
