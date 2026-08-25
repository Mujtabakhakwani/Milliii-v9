// routes/projectRoutes.js
const express = require('express');
const router = express.Router();
const projectController = require('../controllers/projectController');

router.get('/', projectController.listProjects);
router.post('/', projectController.createProject);

module.exports = router;
