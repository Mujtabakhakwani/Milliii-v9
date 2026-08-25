import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { Clock, Square, Coffee, CheckCircle, Play as PlayNext, X, Loader } from 'lucide-react';
import { Button } from './ui/button';
import { Card, CardContent } from './ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { API_URL } from '../config';

const API = API_URL;

// Helper to broadcast updates so pages can stay in sync
const broadcastTrackerUpdate = (userId) => {
  try {
    window.dispatchEvent(new CustomEvent('time-tracker:updated', { detail: { userId, at: Date.now() } }));
  } catch (e) {
    // no-op
  }
};


const ClockInOutDialog = ({ open, onOpenChange, currentUser, activeTimeEntry, onTimeEntryChange }) => {
  const [tasks, setTasks] = useState([]);
  const [selectedTaskId, setSelectedTaskId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [clockingIn, setClockingIn] = useState(false);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [completingTask, setCompletingTask] = useState(false);
  const [showNextTaskDropdown, setShowNextTaskDropdown] = useState(false);
  const [showBreakDropdown, setShowBreakDropdown] = useState(false);
  const [previousTaskEntry, setPreviousTaskEntry] = useState(null);
  const [breaks, setBreaks] = useState([]);

  useEffect(() => {
    if (open) {
      fetchBreaks();
      if (!activeTimeEntry) fetchMyTasks();
    }
  }, [open, activeTimeEntry]);

  // Timer effect
  useEffect(() => {
    if (activeTimeEntry) {
      const interval = setInterval(() => {
        const clockInTime = new Date(activeTimeEntry.clock_in_time);
        const now = new Date();
        const seconds = Math.floor((now - clockInTime) / 1000);
        setElapsedTime(seconds);
      }, 1000);
      return () => clearInterval(interval);
    } else {
      setElapsedTime(0);
    }
  }, [activeTimeEntry]);

  const fetchMyTasks = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const [tasksRes, projectsRes] = await Promise.all([
        axios.get(`${API}/tasks`, { headers }),
        axios.get(`${API}/projects`, { headers })
      ]);
      const projectsData = Array.isArray(projectsRes.data) ? projectsRes.data : projectsRes.data?.data || [];
      const tasksData = Array.isArray(tasksRes.data) ? tasksRes.data : tasksRes.data?.data || [];
      const projectsMap = {};
      projectsData.forEach(project => { projectsMap[project.id] = project.name; });
      const myTasks = tasksData
        .filter(task => task.assignee === currentUser?.id && (task.status === 'Not Started' || task.status === 'In Progress'))
        .map(task => ({ ...task, project_name: projectsMap[task.project_id] || 'No Project' }));
      setTasks(myTasks);
    } catch (error) {
      console.error('Error fetching tasks:', error);
      toast.error('Failed to load tasks');
    } finally {
      setLoading(false);
    }
  };

  const fetchBreaks = async () => {
    try {
      const response = await axios.get(`${API}/breaks`);
      setBreaks(response.data);
    } catch (error) {
      console.error('Error fetching breaks:', error);
    }
  };

  const handleClockIn = async () => {
    if (!selectedTaskId) {
      toast.error('Please select a task');
      return;
    }
    setClockingIn(true);
    try {
      const selectedTask = tasks.find(t => t.id === selectedTaskId);
      const response = await axios.post(`${API}/time-entries/clock-in`, {
        task_id: selectedTaskId,
        project_id: selectedTask.project_id
      });
      onTimeEntryChange(response.data.time_entry);
      broadcastTrackerUpdate(currentUser?.id);
      toast.success('Clocked in successfully');
    } catch (error) {
      console.error('Error clocking in:', error);
      toast.error(error.response?.data?.detail || 'Failed to clock in');
    } finally {
      setClockingIn(false);
    }
  };

  const handleClockOut = async () => {
    setClockingIn(true);
    try {
      await axios.post(`${API}/time-entries/clock-out`, { time_entry_id: activeTimeEntry.id });
      onTimeEntryChange(null);
      broadcastTrackerUpdate(currentUser?.id);
      toast.success('Clocked out successfully');
      setSelectedTaskId(null);
    } catch (error) {
      console.error('Error clocking out:', error);
      toast.error(error.response?.data?.detail || 'Failed to clock out');
    } finally {
      setClockingIn(false);
    }
  };

  const handleCompleteAndNext = async (nextTaskId) => {
    if (!nextTaskId) {
      toast.error('Please select a next task');
      return;
    }
    setCompletingTask(true);
    try {
      await axios.put(`${API}/tasks/${activeTimeEntry.task_id}`, { ...activeTimeEntry.task, status: 'completed' });
      await axios.post(`${API}/time-entries/clock-out`, { time_entry_id: activeTimeEntry.id });
      toast.success('Task completed!');
      const nextTask = tasks.find(t => t.id === nextTaskId);
      const response = await axios.post(`${API}/time-entries/clock-in`, {
        task_id: nextTaskId,
        project_id: nextTask.project_id
      });
      onTimeEntryChange(response.data.time_entry);
      toast.success('Started next task!');
      await fetchMyTasks();
      setSelectedTaskId(null);
      setShowNextTaskDropdown(false);
    } catch (error) {
      console.error('Error completing and switching task:', error);
      toast.error('Failed to switch task');
    } finally {
      setCompletingTask(false);
    }
  };

  const handleCompleteTask = async () => {
    setCompletingTask(true);
    try {
      await axios.put(`${API}/tasks/${activeTimeEntry.task_id}`, { ...activeTimeEntry.task, status: 'completed' });
      await axios.post(`${API}/time-entries/clock-out`, { time_entry_id: activeTimeEntry.id });
      toast.success('Task completed and clocked out!');
      onTimeEntryChange(null);
      setSelectedTaskId(null);
    } catch (error) {
      console.error('Error completing task:', error);
      toast.error('Failed to complete task');
    } finally {
      setCompletingTask(false);
    }
  };

  const handleTakeBreak = () => {
    if (breaks.length === 0) {
      toast.error('No break types configured. Contact your admin.');
      return;
    }
    setShowBreakDropdown(!showBreakDropdown);
  };

  const handleStartBreak = async (breakId) => {
    setShowBreakDropdown(false);
    try {
      if (activeTimeEntry && !activeTimeEntry.is_break) {
        await axios.post(`${API}/time-entries/clock-out`, { time_entry_id: activeTimeEntry.id });
      }
      const response = await axios.post(`${API}/time-entries/clock-in-break?break_id=${breakId}`);
      toast.success('Break started');
      onTimeEntryChange(response.data.time_entry);
    } catch (error) {
      console.error('Error starting break:', error);
      toast.error('Failed to start break');
    }
  };

  const handleEndBreak = async () => {
    if (!activeTimeEntry || !activeTimeEntry.is_break) return;
    try {
      await axios.post(`${API}/time-entries/clock-out`, { time_entry_id: activeTimeEntry.id });
      toast.success('Break ended');
      onTimeEntryChange(null);
    } catch (error) {
      console.error('Error ending break:', error);
      toast.error('Failed to end break');
    }
  };

  const formatTime = (seconds) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  if (!open) return null;

  return (
    <>
      <div className="fixed top-20 right-8 w-96 bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 z-50 animate-slide-down">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-3">
              <Clock className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              <h2 className="text-xl font-bold text-gray-800 dark:text-white">Time Tracker</h2>
            </div>
            <button onClick={() => onOpenChange(false)} className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors" title={activeTimeEntry ? 'Minimize (tracking continues)' : 'Close'}>
              <X className="w-4 h-4 text-gray-600 dark:text-gray-400" />
            </button>
          </div>
          <div className="text-center bg-gradient-to-br from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 rounded-xl p-4">
            <div className="text-3xl font-bold text-gray-800 dark:text-white font-mono">{new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}</div>
            <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">{new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</div>
          </div>
        </div>

        <div className="p-6 space-y-4">
          {activeTimeEntry ? (
            <>
              <div className="text-center space-y-3">
                <div className="inline-flex items-center space-x-2 bg-green-100 dark:bg-green-900/30 px-3 py-1.5 rounded-full">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                  <span className="text-xs font-medium text-green-700 dark:text-green-300">Tracking Active</span>
                </div>
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">{activeTimeEntry.is_break ? 'On Break' : 'Working on'}</p>
                  <h3 className="text-lg font-semibold text-gray-800 dark:text-white">{activeTimeEntry.is_break ? (activeTimeEntry.break?.name || 'Break') : (activeTimeEntry.task?.title || 'Unknown Task')}</h3>
                </div>
                <div className="text-4xl font-bold text-blue-600 dark:text-blue-400 font-mono">{formatTime(elapsedTime)}</div>
                <p className="text-xs text-gray-500 dark:text-gray-400">Started {new Date(activeTimeEntry.clock_in_time).toLocaleTimeString()}</p>
              </div>

              <div className="flex items-center justify-center gap-3 pt-4">
                {!activeTimeEntry?.is_break && (
                  <>
                    <button onClick={handleCompleteTask} disabled={completingTask} className="group relative p-4 rounded-full bg-gradient-to-br from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-110 disabled:opacity-50" title="Complete Task">
                      <CheckCircle className="w-6 h-6" />
                      <span className="absolute -bottom-8 left-1/2 transform -translate-x-1/2 bg-gray-900 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">Complete Task</span>
                    </button>
                    <div className="relative next-task-dropdown-container">
                      <button onClick={() => setShowNextTaskDropdown(!showNextTaskDropdown)} disabled={completingTask || tasks.filter(t => t.id !== activeTimeEntry.task_id).length === 0} className="group relative p-4 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-110 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100" title={tasks.filter(t => t.id !== activeTimeEntry.task_id).length === 0 ? 'No tasks available' : 'Complete & Start Next'}>
                        <PlayNext className="w-6 h-6" />
                        <span className="absolute -bottom-8 left-1/2 transform -translate-x-1/2 bg-gray-900 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">{tasks.filter(t => t.id !== activeTimeEntry.task_id).length === 0 ? 'No Tasks Available' : 'Complete & Next'}</span>
                      </button>
                      {showNextTaskDropdown && tasks.filter(t => t.id !== activeTimeEntry.task_id).length > 0 && (
                        <div className="absolute top-full mt-2 left-1/2 transform -translate-x-1/2 bg-white dark:bg-gray-800 rounded-lg shadow-2xl border border-gray-200 dark:border-gray-700 p-2 w-64 z-50">
                          <p className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-2 px-2">Select next task:</p>
                          <div className="max-h-48 overflow-y-auto space-y-1">
                            {tasks.filter(t => t.id !== activeTimeEntry.task_id).map((task) => (
                              <button key={task.id} onClick={() => { handleCompleteAndNext(task.id); }} disabled={completingTask} className="w-full text-left px-3 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors disabled:opacity-50">
                                <p className="text-sm font-medium text-gray-800 dark:text-white">{task.title}</p>
                                <p className="text-xs text-gray-500 dark:text-gray-400">{task.project_name || 'No project'}</p>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </>
                )}
                {!activeTimeEntry?.is_break && (
                  <div className="relative break-dropdown-container">
                    <button onClick={handleTakeBreak} className="group relative p-4 rounded-full shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-110 bg-gradient-to-br from-yellow-500 to-orange-600 hover:from-yellow-600 hover:to-orange-700 text-white" title="Take a Break">
                      <Coffee className="w-6 h-6" />
                      <span className="absolute -bottom-8 left-1/2 transform -translate-x-1/2 bg-gray-900 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">Take Break</span>
                    </button>
                    {showBreakDropdown && (
                      <div className="absolute bottom-full mb-2 left-1/2 transform -translate-x-1/2 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 py-2 min-w-[180px] z-50 animate-slide-down">
                        <div className="px-3 py-1 text-xs font-semibold text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">Select Break Type</div>
                        {breaks.map((breakItem) => (
                          <button key={breakItem.id} onClick={() => handleStartBreak(breakItem.id)} className="w-full px-4 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex items-center justify-between">
                            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{breakItem.name}</span>
                            <span className="text-xs text-gray-500 dark:text-gray-400">{breakItem.duration_minutes}m</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                <button onClick={handleClockOut} disabled={clockingIn} className="group relative p-4 rounded-full bg-gradient-to-br from-red-500 to-pink-600 hover:from-red-600 hover:to-pink-700 text-white shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-110 disabled:opacity-50" title="Clock Out">
                  <Square className="w-6 h-6 fill-current" />
                  <span className="absolute -bottom-8 left-1/2 transform -translate-x-1/2 bg-gray-900 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">Clock Out</span>
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="space-y-3">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Select a task to start</label>
                {loading ? (
                  <div className="text-center py-6 text-gray-500 dark:text-gray-400">
                    <Loader className="w-5 h-5 animate-spin mx-auto mb-2" />
                    <p className="text-xs">Loading tasks...</p>
                  </div>
                ) : tasks.length === 0 ? (
                  <div className="text-center py-6 text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                    <p className="text-sm">No tasks assigned</p>
                  </div>
                ) : (
                  <Select value={selectedTaskId || ''} onValueChange={setSelectedTaskId}>
                    <SelectTrigger className="w-full h-11">
                      <SelectValue placeholder="Choose a task..." />
                    </SelectTrigger>
                    <SelectContent>
                      {tasks.map((task) => (
                        <SelectItem key={task.id} value={task.id}>
                          <div className="flex flex-col py-1">
                            <span className="font-medium">{task.title}</span>
                            <span className="text-xs text-gray-500">{task.project_name || 'No project'}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>

              <Button onClick={handleClockIn} disabled={!selectedTaskId || clockingIn} className="w-full h-12 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white font-semibold disabled:opacity-50">
                {clockingIn ? (<><Loader className="w-4 h-4 mr-2 animate-spin" />Starting...</>) : (<><Clock className="w-4 h-4 mr-2" />Start Tracking</>)}
              </Button>

              
            </>
          )}
        </div>
      </div>

      <style dangerouslySetInnerHTML={{__html: `
        @keyframes slide-down { from { opacity: 0; transform: translateY(-20px);} to { opacity: 1; transform: translateY(0);} }
        .animate-slide-down { animation: slide-down 0.3s ease-out; }
      `}} />
    </>
  );
};

export default ClockInOutDialog;
