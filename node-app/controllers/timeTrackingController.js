// controllers/timeTrackingController.js
const { v4: uuidv4 } = require('uuid');
const TimeEntry = require('../models/TimeEntry');

exports.getTimeEntries = async (req, res, next) => {
  try {
    const {
      user_id,
      task_id,
      project_id,
      start_date,
      end_date,
      include_enhanced,
    } = req.query;

    const filter = {};

    if (user_id) filter.user_id = user_id;
    if (task_id) filter.task_id = task_id;
    if (project_id) filter.project_id = project_id;

    if (start_date || end_date) {
      filter.clock_in_time = {};
      if (start_date) filter.clock_in_time.$gte = start_date;
      if (end_date) filter.clock_in_time.$lte = end_date;
    }

    const entries = await TimeEntry.find(filter).lean();

    // For now we ignore "enhanced" screenshots/logs.
    res.json({
      success: true,
      data: entries,
      enhanced: include_enhanced === 'true' ? false : undefined,
    });
  } catch (err) {
    next(err);
  }
};

exports.clockIn = async (req, res, next) => {
  try {
    const { user_id, task_id, project_id, is_break } = req.body;

    const entry = await TimeEntry.create({
      id: uuidv4(),
      user_id,
      task_id,
      project_id,
      is_break: !!is_break,
      clock_in_time: new Date().toISOString(),
      is_active: true,
    });

    res.status(201).json({ success: true, data: entry });
  } catch (err) {
    next(err);
  }
};

exports.clockOut = async (req, res, next) => {
  try {
    const { time_entry_id, note } = req.body;

    const entry = await TimeEntry.findOne({ id: time_entry_id });

    if (!entry) {
      return res.status(404).json({
        success: false,
        message: 'Time entry not found',
      });
    }

    if (!entry.is_active) {
      return res.status(400).json({
        success: false,
        message: 'Time entry already clocked out',
      });
    }

    const now = new Date().toISOString();
    const durationSeconds = Math.floor(
      (new Date(now).getTime() - new Date(entry.clock_in_time).getTime()) /
        1000
    );

    entry.clock_out_time = now;
    entry.duration_seconds = durationSeconds;
    entry.is_active = false;
    entry.clock_out_note = note || entry.clock_out_note;

    await entry.save();

    res.json({ success: true, data: entry });
  } catch (err) {
    next(err);
  }
};
