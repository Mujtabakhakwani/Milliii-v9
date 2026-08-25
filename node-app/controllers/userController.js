// controllers/userController.js
const { v4: uuidv4 } = require('uuid');
const User = require('../models/User');

exports.listUsers = async (req, res, next) => {
  try {
    const users = await User.find().lean();
    res.json({ success: true, data: users });
  } catch (err) {
    next(err);
  }
};

exports.createUser = async (req, res, next) => {
  try {
    const { name, email, role } = req.body;

    const id = uuidv4();
    const user = await User.create({
      id,
      name,
      email,
      role: role || 'team_member',
    });

    res.status(201).json({ success: true, data: user });
  } catch (err) {
    next(err);
  }
};
