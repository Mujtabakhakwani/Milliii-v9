// routes/userRoutes.js
const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');

// GET /api/users
router.get('/', userController.listUsers);

// POST /api/users
router.post('/', userController.createUser);

module.exports = router;
