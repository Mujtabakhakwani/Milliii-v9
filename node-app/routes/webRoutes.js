const express = require('express');
const User = require('../models/User');
const Project = require('../models/Project');
const Task = require('../models/Task');

const router = express.Router();

/* ---------- AUTH ---------- */

// Login page
router.get('/login', (req, res) => {
  res.render('login', { title: 'Milliii – Sign In' });
});

// TEMP login handler – later we’ll plug real auth here
router.post('/login', (req, res) => {
  // TODO: verify email/password and set session
  return res.redirect('/dashboard');
});

// TEMP logout
router.get('/logout', (req, res) => {
  // TODO: destroy session
  return res.redirect('/login');
});

/* ---------- DASHBOARD ---------- */

// In original app, main tab is /dashboard.
// Make / redirect there as well.
router.get('/', (req, res) => {
  res.redirect('/dashboard');
});

router.get('/dashboard', async (req, res, next) => {
  try {
    const [userCount, projectCount, taskCount] = await Promise.all([
      User.countDocuments(),
      Project.countDocuments(),
      Task.countDocuments(),
    ]);

    res.render('dashboard', {
      title: 'Dashboard',
      active: 'dashboard',
      userName: 'Irfan Ahmad', // later from session
      stats: {
        users: userCount,
        projects: projectCount,
        tasks: taskCount,
      },
    });
  } catch (err) {
    next(err);
  }
});

/* ---------- MAIN NAV TABS (matching MainLayout.jsx) ---------- */

// /my-tasks
router.get('/my-tasks', async (req, res, next) => {
  try {
    const tasks = await Task.find().lean().sort({ createdAt: -1 });

    res.render('my-tasks', {
      title: 'My Tasks',
      active: 'my-tasks',
      userName: 'Irfan Ahmad',
      tasks,
    });
  } catch (err) {
    next(err);
  }
});

// /projects
router.get('/projects', async (req, res, next) => {
  try {
    const projects = await Project.find().lean().sort({ createdAt: -1 });

    res.render('projects', {
      title: 'My Projects',
      active: 'projects',
      userName: 'Irfan Ahmad',
      projects,
    });
  } catch (err) {
    next(err);
  }
});

// /chats
router.get('/chats', (req, res) => {
  res.render('chats', {
    title: 'Chats',
    active: 'chats',
    userName: 'Irfan Ahmad',
  });
});

// /team-members
router.get('/team-members', async (req, res, next) => {
  try {
    const users = await User.find().lean().sort({ createdAt: -1 });

    res.render('team-members', {
      title: 'Team Members',
      active: 'team-members',
      userName: 'Irfan Ahmad',
      users,
    });
  } catch (err) {
    next(err);
  }
});

// /time-sheet
router.get('/time-sheet', (req, res) => {
  res.render('time-sheet', {
    title: 'Time Sheet',
    active: 'time-sheet',
    userName: 'Irfan Ahmad',
  });
});

// /reports
router.get('/reports', (req, res) => {
  res.render('reports', {
    title: 'Reports',
    active: 'reports',
    userName: 'Irfan Ahmad',
  });
});

// /settings
router.get('/settings', (req, res) => {
  res.render('settings', {
    title: 'Settings',
    active: 'settings',
    userName: 'Irfan Ahmad',
  });
});

module.exports = router;
