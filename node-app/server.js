require('dotenv').config();
const path = require('path');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const cookieParser = require('cookie-parser');

const { connectDB } = require('./config/db');
const { FRONTEND_ORIGINS, PORT } = require('./config/env');

// API Routers
const userRouter = require('./routes/userRoutes');
// later: const projectRouter = require('./routes/projectRoutes');
// later: const taskRouter = require('./routes/taskRoutes');
// later: const timeRouter = require('./routes/timeTrackingRoutes');
// later: const emailRouter = require('./routes/emailRoutes');

// Web (EJS) router
const webRouter = require('./routes/webRoutes');

const app = express();

// Connect MongoDB
connectDB();

// --- View engine (EJS) ---
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

// --- Middlewares ---
app.use(helmet());
app.use(compression());
app.use(morgan('dev'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

app.use(
  cors({
    origin: FRONTEND_ORIGINS,
    credentials: true,
  })
);

// Static assets (CSS/JS/images) from /public
app.use(express.static(path.join(__dirname, 'public')));

// --- WEB ROUTES (EJS PAGES) ---
app.use('/', webRouter);

// --- API ROUTES (JSON) ---
app.use('/api/users', userRouter);
// app.use('/api/projects', projectRouter);
// app.use('/api/tasks', taskRouter);
// app.use('/api/time', timeRouter);
// app.use('/api/email', emailRouter);

// 404 handler
app.use((req, res, next) => {
  if (req.originalUrl.startsWith('/api')) {
    return res.status(404).json({
      success: false,
      message: 'Route not found',
    });
  }

  // Web route 404
  res.status(404);
  res.render('error', {
    title: 'Page not found',
    message: 'The page you are looking for does not exist.',
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Global error:', err);

  if (req.originalUrl.startsWith('/api')) {
    return res.status(err.status || 500).json({
      success: false,
      message: err.message || 'Server error',
    });
  }

  res.status(err.status || 500);
  res.render('error', {
    title: 'Server error',
    message: err.message || 'Something went wrong',
  });
});

const port = PORT || 4000;
app.listen(port, () => {
  console.log(`🔥 Milliii backend + EJS frontend running on http://localhost:${port}`);
});
