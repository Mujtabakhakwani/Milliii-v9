import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { Plus, Calendar, User, Flag, LayoutList, LayoutGrid, Table as TableIcon, Edit2, Trash2, Archive, ArchiveRestore, Clock, Eye, RefreshCw } from 'lucide-react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { Button } from '../components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '../components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { Label } from '../components/ui/label';
import { API_URL } from '../config';
import TaskQuickEditModal from '../components/TaskQuickEditModal';
import TrelloTaskCard from '../components/TrelloTaskCard';
import TrelloTaskModal from '../components/TrelloTaskModal';

const API = API_URL;

const MyTasks = ({ currentUser }) => {
  const [tasks, setTasks] = useState([]);
  const [projects, setProjects] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('list'); // list, table, kanban - default to list
  const [showTaskDialog, setShowTaskDialog] = useState(false);
  const [taskQuickEditModalOpen, setTaskQuickEditModalOpen] = useState(false);
  const [trelloTaskModalOpen, setTrelloTaskModalOpen] = useState(false);
  const [showCompleted, setShowCompleted] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);
  const [editingTask, setEditingTask] = useState(null);
  const [editingField, setEditingField] = useState(null); // { taskId, field } - for inline editing
  const [sortField, setSortField] = useState('due_date'); // For table sorting
  const [sortOrder, setSortOrder] = useState('asc'); // 'asc' or 'desc'
  const [showRecurringTasks, setShowRecurringTasks] = useState(false); // Show recurring tasks modal
  const [recurringTasks, setRecurringTasks] = useState([]); // List of recurring task templates
  const [taskForm, setTaskForm] = useState({
    title: '',
    description: '',
    assignee: '',
    assign_to_team: false,
    due_date: '',
    priority: 'Medium',
    status: 'Not Started',
    project_id: null,
    is_recurring: false,
    recurrence_frequency: 'Weekly',
    recurrence_interval: 1,
    recurrence_days: [], // For weekly: ['Monday', 'Wednesday', 'Friday']
    recurrence_time: '09:00' // Time when task should appear
  });

  // Timezone conversion utilities
  const getUserTimezone = () => {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  };

  // Convert local time (HH:MM) to UTC time (HH:MM)
  const convertLocalTimeToUTC = (localTime) => {
    if (!localTime) return '00:00';
    
    const [hours, minutes] = localTime.split(':').map(Number);
    const now = new Date();
    const localDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hours, minutes, 0);
    
    const utcHours = localDate.getUTCHours().toString().padStart(2, '0');
    const utcMinutes = localDate.getUTCMinutes().toString().padStart(2, '0');
    
    return `${utcHours}:${utcMinutes}`;
  };

  // Convert UTC time (HH:MM) to local time (HH:MM)
  const convertUTCTimeToLocal = (utcTime) => {
    if (!utcTime) return '09:00';
    
    const [hours, minutes] = utcTime.split(':').map(Number);
    const now = new Date();
    const utcDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), hours, minutes, 0));
    
    const localHours = utcDate.getHours().toString().padStart(2, '0');
    const localMinutes = utcDate.getMinutes().toString().padStart(2, '0');
    
    return `${localHours}:${localMinutes}`;
  };

  useEffect(() => {
    fetchMyTasks();
    fetchProjects();
    fetchUsers();
    if (currentUser?.role?.toLowerCase() === 'admin' || currentUser?.role?.toLowerCase() === 'manager') {
      fetchRecurringTasks();
    }
  }, []);

  const fetchRecurringTasks = async () => {
    try {
      const token = localStorage.getItem('token');
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const response = await axios.get(`${API}/recurring-tasks`, { headers });
      const data = Array.isArray(response.data) ? response.data : response.data?.data || [];
      setRecurringTasks(data);
    } catch (error) {
      console.error('Error fetching recurring tasks:', error);
    }
  };

  const fetchMyTasks = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const response = await axios.get(`${API}/my-tasks`, { headers });
      
      // Fetch projects to check their status
      const projectsResponse = await axios.get(`${API}/projects`, { headers });
      const projectsData = Array.isArray(projectsResponse.data) ? projectsResponse.data : projectsResponse.data?.data || [];
      const completedProjectIds = projectsData
        .filter(p => p.status === 'Completed')
        .map(p => p.id);
      
      // Filter out tasks from completed projects
      const tasksData = Array.isArray(response.data) ? response.data : response.data?.data || [];
      const activeTasks = tasksData.filter(task => 
        !task.project_id || !completedProjectIds.includes(task.project_id)
      );
      
      setTasks(activeTasks);
    } catch (error) {
      toast.error('Failed to fetch tasks');
      console.error('Error fetching tasks:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchProjects = async () => {
    try {
      const token = localStorage.getItem('token');
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const response = await axios.get(`${API}/projects`, { headers });
      const projectsData = Array.isArray(response.data) ? response.data : response.data?.data || [];
      setProjects(projectsData);
    } catch (error) {
      console.error('Error fetching projects:', error);
    }
  };

  const fetchUsers = async () => {
    try {
      const token = localStorage.getItem('token');
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const response = await axios.get(`${API}/users`, { headers });
      const usersData = Array.isArray(response.data) ? response.data : response.data?.data || [];
      setUsers(usersData);
    } catch (error) {
      console.error('Error fetching users:', error);
    }
  };

  const handleCreateTask = async () => {
    // Check if user is admin or manager
    const userRole = currentUser?.role?.toLowerCase();
    const canAssignToOthers = userRole === 'admin' || userRole === 'manager';
    
    if (canAssignToOthers) {
      // Open dialog for admin/manager to assign task
      setTaskForm({
        title: '',
        description: '',
        assignee: currentUser?.id,
        assign_to_team: false,
        due_date: '',
        priority: 'Medium',
        status: 'Not Started',
        project_id: null,
        is_recurring: false,
        recurrence_frequency: 'Weekly',
        recurrence_interval: 1,
        recurrence_days: []
      });
      setEditingTask(null);
      setShowTaskDialog(true);
    } else {
      // Auto-create task for team members
      try {
        const standaloneTasksCount = tasks.filter(t => !t.project_id && !t.archived).length;
        const taskName = `Task ${standaloneTasksCount + 1}`;
        
        const newTask = {
          title: taskName,
          description: '',
          assignee: currentUser?.id,
          due_date: '',
          priority: 'Medium',
          status: 'Not Started',
          project_id: null
        };
        
        await axios.post(`${API}/tasks`, newTask);
        toast.success(`${taskName} created successfully`);
        fetchMyTasks();
      } catch (error) {
        toast.error('Failed to create task');
        console.error('Error creating task:', error);
      }
    }
  };

  const handleEditTask = (task) => {
    setEditingTask(task);
    setTaskForm({
      title: task.title,
      description: task.description || '',
      assignee: task.assignee || '',
      due_date: task.due_date || '',
      priority: task.priority,
      status: task.status,
      project_id: task.project_id || null
    });
    setShowTaskDialog(true);
  };

  const handleSaveTask = async () => {
    try {
      if (editingTask) {
        // Check if this is a recurring task being edited
        if (taskForm.is_recurring && editingTask.recurrence_frequency) {
          // Update recurring task template
          // Convert local time to UTC before sending to backend
          const recurringTaskData = {
            ...taskForm,
            recurrence_time: convertLocalTimeToUTC(taskForm.recurrence_time),
            assign_to_team: taskForm.assign_to_team ? true : false,
            assignee: taskForm.assign_to_team ? null : taskForm.assignee
          };
          await axios.put(`${API}/recurring-tasks/${editingTask.id}`, recurringTaskData);
          toast.success('Recurring task updated successfully');
          fetchRecurringTasks();
        } else {
          // Update regular task
          await axios.put(`${API}/tasks/${editingTask.id}`, taskForm);
          toast.success('Task updated successfully');
        }
      } else {
        // Handle recurring task
        if (taskForm.is_recurring) {
          // Save as recurring task template
          // Convert local time to UTC before sending to backend
          const recurringTaskData = {
            ...taskForm,
            recurrence_time: convertLocalTimeToUTC(taskForm.recurrence_time),
            assign_to_team: taskForm.assign_to_team ? true : false,
            assignee: taskForm.assign_to_team ? null : taskForm.assignee
          };
          await axios.post(`${API}/recurring-tasks`, recurringTaskData);
          toast.success('Recurring task created successfully');
          fetchRecurringTasks();
        } else {
          // Handle team assignment for regular tasks
          if (taskForm.assign_to_team) {
            // Create task for each team member
            const teamMembers = users.filter(u => 
              u.role && ['admin', 'manager', 'team member', 'user'].includes(u.role.toLowerCase())
            );
            
            for (const member of teamMembers) {
              const taskData = {
                ...taskForm,
                assignee: member.id,
                assign_to_team: undefined,
                is_recurring: undefined,
                recurrence_frequency: undefined,
                recurrence_interval: undefined,
                recurrence_days: undefined,
                recurrence_time: undefined
              };
              await axios.post(`${API}/tasks`, taskData);
            }
            toast.success(`Task created for ${teamMembers.length} team members`);
          } else {
            // Create single task
            const taskData = {
              ...taskForm,
              assign_to_team: undefined,
              is_recurring: undefined,
              recurrence_frequency: undefined,
              recurrence_interval: undefined,
              recurrence_days: undefined,
              recurrence_time: undefined
            };
            await axios.post(`${API}/tasks`, taskData);
            toast.success('Task created successfully');
          }
        }
      }
      setShowTaskDialog(false);
      fetchMyTasks();
    } catch (error) {
      toast.error('Failed to save task');
      console.error('Error saving task:', error);
    }
  };

  const handleEditRecurringTask = (recurringTask) => {
    setEditingTask(recurringTask);
    setTaskForm({
      title: recurringTask.title,
      description: recurringTask.description || '',
      assignee: recurringTask.assignee || '',
      assign_to_team: recurringTask.assign_to_team || false,
      due_date: recurringTask.due_date || '',
      priority: recurringTask.priority,
      status: recurringTask.status,
      project_id: recurringTask.project_id || null,
      is_recurring: true,
      recurrence_frequency: recurringTask.recurrence_frequency,
      recurrence_interval: recurringTask.recurrence_interval,
      recurrence_days: recurringTask.recurrence_days || [],
      // Convert UTC time to local time for editing
      recurrence_time: convertUTCTimeToLocal(recurringTask.recurrence_time || '00:00')
    });
    setShowTaskDialog(true);
    setShowRecurringTasks(false);
  };

  const handleDeleteRecurringTask = async (recurringTaskId) => {
    if (!window.confirm('Are you sure you want to delete this recurring task? Future instances will not be created.')) {
      return;
    }
    
    try {
      await axios.delete(`${API}/recurring-tasks/${recurringTaskId}`);
      toast.success('Recurring task deleted successfully');
      fetchRecurringTasks();
    } catch (error) {
      toast.error('Failed to delete recurring task');
      console.error('Error deleting recurring task:', error);
    }
  };

  const handleGenerateTasksFromTemplate = async (recurringTaskId) => {
    if (!window.confirm('Generate tasks from this recurring template now? This will create tasks for all assigned team members or the assigned person.')) {
      return;
    }
    
    try {
      const response = await axios.post(`${API}/recurring-tasks/${recurringTaskId}/generate`);
      const { count, message } = response.data;
      toast.success(message || `Generated ${count} tasks successfully`);
      fetchMyTasks(); // Refresh tasks to show newly generated ones
    } catch (error) {
      toast.error('Failed to generate tasks');
      console.error('Error generating tasks:', error);
    }
  };

  const handleGenerateAllRecurringTasks = async () => {
    if (!window.confirm('Generate tasks for ALL recurring templates? This will create tasks for all active recurring task templates.')) {
      return;
    }
    
    try {
      const response = await axios.post(`${API}/recurring-tasks/generate-all`);
      const { total_generated, message } = response.data;
      toast.success(message || `Generated ${total_generated} tasks successfully`);
      fetchMyTasks(); // Refresh tasks to show newly generated ones
    } catch (error) {
      toast.error('Failed to generate tasks');
      console.error('Error generating all tasks:', error);
    }
  };

  const handleDeleteTask = async (taskId) => {
    if (!window.confirm('Are you sure you want to delete this task?')) return;
    
    try {
      await axios.delete(`${API}/tasks/${taskId}`);
      toast.success('Task deleted successfully');
      fetchMyTasks();
    } catch (error) {
      toast.error('Failed to delete task');
      console.error('Error deleting task:', error);
    }
  };

  const handleArchiveTask = async (taskId, archived) => {
    try {
      await axios.put(`${API}/tasks/${taskId}`, { archived: !archived });
      toast.success(archived ? 'Task unarchived' : 'Task archived');
      fetchMyTasks();
    } catch (error) {
      toast.error('Failed to update task');
      console.error('Error archiving task:', error);
    }
  };

  // Open task details modal (quick edit - everything except title/description)
  const handleTaskCardClick = (task) => {
    setSelectedTask(task);
    setTrelloTaskModalOpen(true);
  };

  const handleTaskUpdate = async (updatedTask) => {
    if (!updatedTask) {
      // If updatedTask is null, it means deletion - close modals and refresh
      setTrelloTaskModalOpen(false);
      setTaskQuickEditModalOpen(false);
      fetchMyTasks();
      return;
    }
    
    // Update the task in the local state but DON'T close modals
    setTasks(prevTasks => 
      prevTasks.map(task => task.id === updatedTask.id ? updatedTask : task)
    );
    
    // DON'T close modals for regular updates - let user close manually
    // Only refresh data in background
    fetchMyTasks();
  };

  // Task approval handler
  const handleTaskApprove = async (task) => {
    try {
      await axios.post(`${API}/tasks/${task.id}/approve`);
      toast.success('Task approved successfully');
      fetchMyTasks();
    } catch (error) {
      console.error('Error approving task:', error);
      if (error.response?.status === 403) {
        toast.error('You do not have permission to approve this task');
      } else if (error.response?.status === 400) {
        toast.error('Task is not in the correct status for approval');
      } else {
        toast.error('Failed to approve task');
      }
    }
  };

  // Task rejection handler - opens modal with rejection dialog
  const handleTaskReject = async (task) => {
    // Open the task modal and show rejection dialog
    setSelectedTask(task);
    setTrelloTaskModalOpen(true);
    
    // We'll trigger the rejection dialog in the modal
    setTimeout(() => {
      // This will be handled by the modal component
      if (window.triggerRejectDialog) {
        window.triggerRejectDialog();
      }
    }, 100);
  };

  // Inline editing handler
  const handleInlineUpdate = async (taskId, field, value) => {
    try {
      await axios.put(`${API}/tasks/${taskId}`, { [field]: value });
      toast.success('Task updated');
      fetchMyTasks();
      setEditingField(null);
    } catch (error) {
      toast.error('Failed to update task');
      console.error('Error updating task:', error);
    }
  };

  // Check if a specific field is being edited
  const isFieldEditing = (taskId, field) => {
    return editingField && editingField.taskId === taskId && editingField.field === field;
  };

  // Check if user can complete a task based on role and task type
  const canCompleteTask = (task) => {
    const userRole = currentUser?.role?.toLowerCase();
    
    // Standalone tasks (no project_id) - team members can complete
    if (!task.project_id) {
      return true;
    }
    
    // Project tasks - only managers and admins can complete
    if (userRole === 'admin' || userRole === 'manager') {
      return true;
    }
    
    return false;
  };

  // Get available status options based on task type and user role
  const getAvailableStatuses = (task) => {
    const allStatuses = ['Not Started', 'In Progress', 'Under Review', 'Completed'];
    
    if (canCompleteTask(task)) {
      return allStatuses;
    }
    
    // Team members can't set project tasks to "Completed"
    return allStatuses.filter(s => s !== 'Completed');
  };

  // Sorting handler for table view
  const handleSort = (field) => {
    if (sortField === field) {
      // Toggle sort order if same field
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      // New field, default to ascending
      setSortField(field);
      setSortOrder('asc');
    }
  };

  // Get sorted tasks for table view
  const getSortedTasks = () => {
    const sortedTasks = [...tasks];
    sortedTasks.sort((a, b) => {
      let aVal = a[sortField];
      let bVal = b[sortField];
      
      // Handle null/undefined values
      if (aVal == null) aVal = '';
      if (bVal == null) bVal = '';
      
      // Handle dates
      if (sortField === 'due_date' || sortField === 'created_at') {
        aVal = new Date(aVal);
        bVal = new Date(bVal);
      }
      
      // Compare values
      if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });
    return sortedTasks;
  };

  const handleDragEnd = async (result) => {
    if (!result.destination) return;

    const { source, destination, draggableId } = result;

    if (source.droppableId === destination.droppableId) return;

    const newStatus = destination.droppableId;
    
    try {
      await axios.put(`${API}/tasks/${draggableId}`, { status: newStatus });
      fetchMyTasks();
      toast.success('Task status updated');
    } catch (error) {
      toast.error('Failed to update task status');
      console.error('Error updating task:', error);
    }
  };

  const getProjectName = (projectId) => {
    if (!projectId) return 'Standalone Task';
    const project = projects.find(p => p.id === projectId);
    return project ? project.name : 'Unknown Project';
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'High': return 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20';
      case 'Medium': return 'text-yellow-600 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-900/20';
      case 'Low': return 'text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20';
      default: return 'text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-900/20';
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'Completed': return 'bg-green-100 dark:bg-green-900/20 text-green-800 dark:text-green-400';
      case 'In Progress': return 'bg-blue-100 dark:bg-blue-900/20 text-blue-800 dark:text-blue-400';
      case 'Under Review': return 'bg-purple-100 dark:bg-purple-900/20 text-purple-800 dark:text-purple-400';
      default: return 'bg-gray-100 dark:bg-gray-900/20 text-gray-800 dark:text-gray-400';
    }
  };

  const columns = [
    { id: 'Not Started', title: 'Not Started' },
    { id: 'In Progress', title: 'In Progress' },
    { id: 'Under Review', title: 'Under Review' },
    { id: 'Completed', title: 'Completed' }
  ];

  const renderKanbanView = () => (
    <DragDropContext onDragEnd={handleDragEnd}>
      <div className="grid grid-cols-4 gap-4">
        {columns.map((column) => (
          <div key={column.id} className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-xl rounded-lg border border-gray-200 dark:border-gray-700 p-4">
            <h3 className="font-semibold text-gray-800 dark:text-white mb-4">
              {column.title}
              <span className="ml-2 text-sm text-gray-500 dark:text-gray-400">
                ({tasks.filter(t => t.status === column.id && !t.archived).length})
              </span>
            </h3>
            <Droppable droppableId={column.id}>
              {(provided) => (
                <div
                  ref={provided.innerRef}
                  {...provided.droppableProps}
                  className="space-y-2 min-h-[200px]"
                >
                  {tasks
                    .filter(t => t.status === column.id && !t.archived)
                    .map((task, index) => (
                      <Draggable key={task.id} draggableId={task.id} index={index}>
                        {(provided) => (
                          <div
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            {...provided.dragHandleProps}
                            className="bg-white dark:bg-gray-800 rounded-lg p-3 shadow-sm border border-gray-200 dark:border-gray-700 hover:shadow-md transition-shadow"
                          >
                            <div className="flex justify-between items-start mb-2">
                              <h4 className="font-medium text-gray-800 dark:text-white text-sm">
                                {task.title}
                              </h4>
                              <div className="flex space-x-1">
                                <button
                                  onClick={() => handleEditTask(task)}
                                  className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                                >
                                  <Edit2 className="w-3 h-3 text-gray-600 dark:text-gray-400" />
                                </button>
                              </div>
                            </div>
                            <p className="text-xs text-gray-600 dark:text-gray-400 mb-2">
                              {getProjectName(task.project_id)}
                            </p>
                            <div className="flex items-center justify-between text-xs">
                              <span className={`px-2 py-1 rounded ${getPriorityColor(task.priority)}`}>
                                {task.priority}
                              </span>
                              {task.due_date && (
                                <span className="text-gray-500 dark:text-gray-400">
                                  {new Date(task.due_date).toLocaleDateString()}
                                </span>
                              )}
                            </div>
                          </div>
                        )}
                      </Draggable>
                    ))}
                  {provided.placeholder}
                </div>
              )}
            </Droppable>
          </div>
        ))}
      </div>
    </DragDropContext>
  );

  const renderListView = () => {
    // Separate tasks into categories
    const standaloneTasks = tasks.filter(t => !t.archived && !t.project_id);
    const projectTasks = tasks.filter(t => !t.archived && t.project_id);
    
    // Further separate by completion status
    const activeStandaloneTasks = standaloneTasks.filter(t => t.status !== 'Completed');
    const completedStandaloneTasks = standaloneTasks.filter(t => t.status === 'Completed');
    const activeProjectTasks = projectTasks.filter(t => t.status !== 'Completed');
    const completedProjectTasks = projectTasks.filter(t => t.status === 'Completed');
    
    const allCompletedTasks = [...completedStandaloneTasks, ...completedProjectTasks];
    
    const TaskCardWrapper = ({ task }) => {
      // Get project name for display
      const projectName = task.project_id ? getProjectName(task.project_id) : null;
      const taskWithProject = { ...task, project_name: projectName };
      
      return (
        <TrelloTaskCard
          task={taskWithProject}
          users={users}
          onClick={() => handleTaskCardClick(task)}
          onApprove={handleTaskApprove}
          onReject={handleTaskReject}
          currentUser={currentUser}
          showProject={true}
          className="group"
        />
      );
    };
    
    return (
      <div className="space-y-6">
        {/* My Tasks (Standalone) - Only show if there are tasks */}
        {activeStandaloneTasks.length > 0 && (
          <div>
            <h3 className="text-xl font-bold text-gray-800 dark:text-white mb-3">
              My Tasks ({activeStandaloneTasks.length})
            </h3>
            <div className="space-y-2">
              {activeStandaloneTasks.map(task => <TaskCardWrapper key={task.id} task={task} />)}
            </div>
          </div>
        )}
        
        {/* Project Tasks - Only show if there are tasks */}
        {activeProjectTasks.length > 0 && (
          <div>
            <h3 className="text-xl font-bold text-gray-800 dark:text-white mb-3">
              Project Tasks ({activeProjectTasks.length})
            </h3>
            <div className="space-y-2">
              {activeProjectTasks.map(task => <TaskCardWrapper key={task.id} task={task} />)}
            </div>
          </div>
        )}
        
        {/* Show message if no active tasks */}
        {activeStandaloneTasks.length === 0 && activeProjectTasks.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-500 dark:text-gray-400 text-lg">No active tasks</p>
            <p className="text-gray-400 dark:text-gray-500 text-sm mt-2">Create a new task to get started</p>
          </div>
        )}
        
        {/* Completed Tasks - Collapsible, only show if there are completed tasks */}
        {allCompletedTasks.length > 0 && (
          <div>
            <button
              onClick={() => setShowCompleted(!showCompleted)}
              className="w-full flex items-center justify-between text-xl font-bold text-gray-800 dark:text-white mb-3 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
            >
              <span>Completed ({allCompletedTasks.length})</span>
              <span className="text-2xl">{showCompleted ? '−' : '+'}</span>
            </button>
            
            {showCompleted && (
              <div className="space-y-2 opacity-60">
                {allCompletedTasks.map(task => <TaskCardWrapper key={task.id} task={task} />)}
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  const renderTableView = () => {
    const sortedTasks = getSortedTasks().filter(t => !t.archived);
    
    // Separate tasks
    const standaloneTasks = sortedTasks.filter(t => !t.project_id);
    const projectTasks = sortedTasks.filter(t => t.project_id);
    
    const activeStandaloneTasks = standaloneTasks.filter(t => t.status !== 'Completed');
    const completedStandaloneTasks = standaloneTasks.filter(t => t.status === 'Completed');
    const activeProjectTasks = projectTasks.filter(t => t.status !== 'Completed');
    const completedProjectTasks = projectTasks.filter(t => t.status === 'Completed');
    
    const allCompletedTasks = [...completedStandaloneTasks, ...completedProjectTasks];
    
    const SortableHeader = ({ field, children }) => (
      <th 
        className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors select-none"
        onClick={() => handleSort(field)}
      >
        <div className="flex items-center gap-2">
          {children}
          {sortField === field && (
            <span className="text-blue-600">
              {sortOrder === 'asc' ? '↑' : '↓'}
            </span>
          )}
        </div>
      </th>
    );
    
    const TaskRow = ({ task }) => (
      <tr 
        key={task.id} 
        className="hover:bg-gray-50 dark:hover:bg-gray-900/30"
      >
        {/* Title - Click to edit */}
        <td className="px-4 py-3 text-sm">
          {isFieldEditing(task.id, 'title') ? (
            <Input
              defaultValue={task.title}
              onBlur={(e) => handleInlineUpdate(task.id, 'title', e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleInlineUpdate(task.id, 'title', e.target.value);
                }
                if (e.key === 'Escape') {
                  setEditingField(null);
                }
              }}
              className="h-8 text-sm"
              autoFocus
            />
          ) : (
            <span
              className="text-gray-800 dark:text-white cursor-pointer hover:text-blue-600"
              onClick={() => setEditingField({ taskId: task.id, field: 'title' })}
            >
              {task.title}
            </span>
          )}
        </td>
        
        {/* Project */}
        <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
          {task.project_id ? getProjectName(task.project_id) : '-'}
        </td>
        
        {/* Status - Click to edit */}
        <td className="px-4 py-3">
          {isFieldEditing(task.id, 'status') ? (
            <Select
              value={task.status}
              onValueChange={(value) => handleInlineUpdate(task.id, 'status', value)}
              open={true}
              onOpenChange={(open) => {
                if (!open) setEditingField(null);
              }}
            >
              <SelectTrigger className="w-32 h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {getAvailableStatuses(task).map(status => (
                  <SelectItem key={status} value={status}>{status}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <span 
              className={`px-2 py-1 rounded text-xs cursor-pointer hover:ring-2 hover:ring-blue-400 transition-all ${getStatusColor(task.status)}`}
              onClick={() => setEditingField({ taskId: task.id, field: 'status' })}
            >
              {task.status}
            </span>
          )}
        </td>
        
        {/* Priority - Click to edit */}
        <td className="px-4 py-3">
          {isFieldEditing(task.id, 'priority') ? (
            <Select
              value={task.priority}
              onValueChange={(value) => handleInlineUpdate(task.id, 'priority', value)}
              open={true}
              onOpenChange={(open) => {
                if (!open) setEditingField(null);
              }}
            >
              <SelectTrigger className="w-28 h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Low">Low</SelectItem>
                <SelectItem value="Medium">Medium</SelectItem>
                <SelectItem value="High">High</SelectItem>
              </SelectContent>
            </Select>
          ) : (
            <span 
              className={`px-2 py-1 rounded text-xs cursor-pointer hover:ring-2 hover:ring-blue-400 transition-all ${getPriorityColor(task.priority)}`}
              onClick={() => setEditingField({ taskId: task.id, field: 'priority' })}
            >
              {task.priority}
            </span>
          )}
        </td>
        
        {/* Due Date - Click to edit */}
        <td className="px-4 py-3 text-sm">
          {isFieldEditing(task.id, 'due_date') ? (
            <Input
              type="date"
              defaultValue={task.due_date || ''}
              onChange={(e) => handleInlineUpdate(task.id, 'due_date', e.target.value)}
              onBlur={() => setEditingField(null)}
              className="w-40 h-8 text-xs"
              autoFocus
            />
          ) : (
            <span
              className="text-gray-600 dark:text-gray-400 cursor-pointer hover:text-blue-600"
              onClick={() => setEditingField({ taskId: task.id, field: 'due_date' })}
            >
              {task.due_date ? new Date(task.due_date).toLocaleDateString() : 'Set date'}
            </span>
          )}
        </td>
        
        {/* Actions */}
        <td className="px-4 py-3">
          <div className="flex space-x-2">
            <button
              onClick={() => handleTaskClick(task)}
              className="p-1 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded"
            >
              <Edit2 className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            </button>
            <button
              onClick={() => handleDeleteTask(task.id)}
              className="p-1 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
            >
              <Trash2 className="w-4 h-4 text-red-600 dark:text-red-400" />
            </button>
          </div>
        </td>
      </tr>
    );
    
    const TableSection = ({ title, taskList }) => (
      <div className="mb-6">
        <h3 className="text-lg font-bold text-gray-800 dark:text-white mb-3 px-4">
          {title} ({taskList.length})
        </h3>
        <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-xl rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-700">
              <tr>
                <SortableHeader field="title">Task</SortableHeader>
                <SortableHeader field="project_id">Project</SortableHeader>
                <SortableHeader field="status">Status</SortableHeader>
                <SortableHeader field="priority">Priority</SortableHeader>
                <SortableHeader field="due_date">Due Date</SortableHeader>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {taskList.map(task => <TaskRow key={task.id} task={task} />)}
            </tbody>
          </table>
        </div>
      </div>
    );
    
    return (
      <div className="space-y-6">
        {/* Only show sections if they have tasks */}
        {activeStandaloneTasks.length > 0 && (
          <TableSection title="My Tasks" taskList={activeStandaloneTasks} />
        )}
        
        {activeProjectTasks.length > 0 && (
          <TableSection title="Project Tasks" taskList={activeProjectTasks} />
        )}
        
        {/* Show message if no active tasks */}
        {activeStandaloneTasks.length === 0 && activeProjectTasks.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-500 dark:text-gray-400 text-lg">No active tasks</p>
            <p className="text-gray-400 dark:text-gray-500 text-sm mt-2">Create a new task to get started</p>
          </div>
        )}
        
        {/* Completed Tasks - Collapsible */}
        {allCompletedTasks.length > 0 && (
          <div>
            <button
              onClick={() => setShowCompleted(!showCompleted)}
              className="w-full flex items-center justify-between text-lg font-bold text-gray-800 dark:text-white mb-3 px-4 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
            >
              <span>Completed ({allCompletedTasks.length})</span>
              <span className="text-2xl">{showCompleted ? '−' : '+'}</span>
            </button>
            
            {showCompleted && (
              <TableSection title="" taskList={allCompletedTasks} />
            )}
          </div>
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-lg text-gray-600 dark:text-gray-400">Loading tasks...</div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-800 dark:text-white mb-2">
          My Tasks
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Manage all your assigned tasks and standalone tasks
        </p>
      </div>

      {/* Toolbar */}
      <div className="mb-6 flex justify-between items-center">
        <div className="flex space-x-2">
          <button
            onClick={() => setView('list')}
            className={`p-2 rounded-lg ${view === 'list' ? 'bg-blue-100 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'}`}
            title="List View"
          >
            <LayoutList className="w-5 h-5" />
          </button>
          <button
            onClick={() => setView('table')}
            className={`p-2 rounded-lg ${view === 'table' ? 'bg-blue-100 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'}`}
            title="Table View"
          >
            <TableIcon className="w-5 h-5" />
          </button>
          <button
            onClick={() => setView('kanban')}
            className={`p-2 rounded-lg ${view === 'kanban' ? 'bg-blue-100 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'}`}
            title="Kanban View"
          >
            <LayoutGrid className="w-5 h-5" />
          </button>
        </div>

        <div className="flex gap-2">
          {(currentUser?.role?.toLowerCase() === 'admin' || currentUser?.role?.toLowerCase() === 'manager') && (
            <Button 
              onClick={() => setShowRecurringTasks(true)} 
              variant="outline"
              className="border-purple-600 text-purple-600 hover:bg-purple-50"
            >
              <Clock className="w-4 h-4 mr-2" />
              Recurring Tasks ({recurringTasks.length})
            </Button>
          )}
          <Button onClick={handleCreateTask} className="bg-blue-600 hover:bg-blue-700 text-white">
            <Plus className="w-4 h-4 mr-2" />
            Create Task
          </Button>
        </div>
      </div>

      {/* View Renderer */}
      {view === 'kanban' && renderKanbanView()}
      {view === 'list' && renderListView()}
      {view === 'table' && renderTableView()}

      {/* Task Dialog */}
      <Dialog open={showTaskDialog} onOpenChange={setShowTaskDialog}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>{editingTask ? 'Edit Task' : 'Create Task'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>Title</Label>
              <Input
                value={taskForm.title}
                onChange={(e) => setTaskForm({ ...taskForm, title: e.target.value })}
                placeholder="Task title"
              />
            </div>
            <div>
              <Label>Description</Label>
              <Textarea
                value={taskForm.description}
                onChange={(e) => setTaskForm({ ...taskForm, description: e.target.value })}
                placeholder="Task description"
                rows={3}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Link to Project (Optional)</Label>
                <Select
                  value={taskForm.project_id || 'none'}
                  onValueChange={(value) => setTaskForm({ ...taskForm, project_id: value === 'none' ? null : value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select project" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Standalone Task</SelectItem>
                    {projects.map((project) => (
                      <SelectItem key={project.id} value={project.id}>
                        {project.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Assignee</Label>
                {taskForm.assign_to_team ? (
                  <div className="h-10 px-3 py-2 rounded-md border border-gray-300 bg-gray-100 flex items-center">
                    <span className="text-sm text-gray-700">Entire Team</span>
                  </div>
                ) : (
                  <Select
                    value={taskForm.assignee}
                    onValueChange={(value) => setTaskForm({ ...taskForm, assignee: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select assignee" />
                    </SelectTrigger>
                    <SelectContent>
                      {users.map((user) => (
                        <SelectItem key={user.id} value={user.id}>
                          {user.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            </div>
            
            {/* Assign to Team Checkbox */}
            {(currentUser?.role?.toLowerCase() === 'admin' || currentUser?.role?.toLowerCase() === 'manager') && !editingTask && (
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="assign-to-team"
                  checked={taskForm.assign_to_team}
                  onChange={(e) => setTaskForm({ ...taskForm, assign_to_team: e.target.checked })}
                  className="w-4 h-4 text-blue-600 rounded"
                />
                <Label htmlFor="assign-to-team" className="text-sm font-medium cursor-pointer">
                  Assign to entire team
                </Label>
              </div>
            )}
            
            {/* Recurring Task Section */}
            <div className="space-y-4 border-t pt-4">
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="is-recurring"
                  checked={taskForm.is_recurring}
                  onChange={(e) => setTaskForm({ ...taskForm, is_recurring: e.target.checked })}
                  className="w-4 h-4 text-blue-600 rounded"
                />
                <Label htmlFor="is-recurring" className="text-sm font-medium cursor-pointer">
                  Recurring Task
                </Label>
              </div>
              
              {taskForm.is_recurring && (
                <div className="space-y-4 pl-6 border-l-2 border-blue-200">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Frequency</Label>
                      <Select
                        value={taskForm.recurrence_frequency}
                        onValueChange={(value) => setTaskForm({ ...taskForm, recurrence_frequency: value, recurrence_days: [] })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Daily">Daily</SelectItem>
                          <SelectItem value="Weekly">Weekly</SelectItem>
                          <SelectItem value="Monthly">Monthly</SelectItem>
                          <SelectItem value="Yearly">Yearly</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Every</Label>
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          min="1"
                          value={taskForm.recurrence_interval}
                          onChange={(e) => setTaskForm({ ...taskForm, recurrence_interval: parseInt(e.target.value) || 1 })}
                          className="w-20"
                        />
                        <span className="text-sm text-gray-600">
                          {taskForm.recurrence_frequency === 'Daily' && 'day(s)'}
                          {taskForm.recurrence_frequency === 'Weekly' && 'week(s)'}
                          {taskForm.recurrence_frequency === 'Monthly' && 'month(s)'}
                          {taskForm.recurrence_frequency === 'Yearly' && 'year(s)'}
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  {/* Time picker */}
                  <div>
                    <Label>Appears at</Label>
                    <Input
                      type="time"
                      value={taskForm.recurrence_time}
                      onChange={(e) => setTaskForm({ ...taskForm, recurrence_time: e.target.value })}
                      className="w-full"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Task will be created at this time in your timezone ({getUserTimezone()})
                    </p>
                  </div>
                  
                  {/* Schedule Mode Toggle */}
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="schedule-mode"
                      checked={taskForm.schedule_mode || false}
                      onChange={(e) => setTaskForm({ ...taskForm, schedule_mode: e.target.checked })}
                      className="w-4 h-4 text-blue-600 rounded"
                    />
                    <Label htmlFor="schedule-mode" className="text-sm font-medium cursor-pointer">
                      Schedule task
                    </Label>
                  </div>
                  
                  {/* Day selection for Weekly */}
                  {taskForm.recurrence_frequency === 'Weekly' && (
                    <div>
                      <Label className="mb-2 block">On days:</Label>
                      <div className="flex gap-2">
                        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, index) => {
                          const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
                          const dayName = dayNames[index];
                          const isSelected = taskForm.recurrence_days.includes(dayName);
                          
                          return (
                            <button
                              key={index}
                              type="button"
                              onClick={() => {
                                const newDays = isSelected
                                  ? taskForm.recurrence_days.filter(d => d !== dayName)
                                  : [...taskForm.recurrence_days, dayName];
                                setTaskForm({ ...taskForm, recurrence_days: newDays });
                              }}
                              className={`w-10 h-10 rounded-full border-2 font-semibold transition-all ${
                                isSelected
                                  ? 'bg-blue-500 text-white border-blue-500'
                                  : 'bg-white text-gray-600 border-gray-300 hover:border-blue-400'
                              }`}
                            >
                              {day}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label>Status</Label>
                <Select
                  value={taskForm.status}
                  onValueChange={(value) => setTaskForm({ ...taskForm, status: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Not Started">Not Started</SelectItem>
                    <SelectItem value="In Progress">In Progress</SelectItem>
                    <SelectItem value="Under Review">Under Review</SelectItem>
                    <SelectItem value="Completed">Completed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Priority</Label>
                <Select
                  value={taskForm.priority}
                  onValueChange={(value) => setTaskForm({ ...taskForm, priority: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Low">Low</SelectItem>
                    <SelectItem value="Medium">Medium</SelectItem>
                    <SelectItem value="High">High</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Due Date</Label>
                <Input
                  type="date"
                  value={taskForm.due_date}
                  onChange={(e) => setTaskForm({ ...taskForm, due_date: e.target.value })}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowTaskDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveTask} className="bg-blue-600 hover:bg-blue-700 text-white">
              {editingTask 
                ? 'Update Task' 
                : (taskForm.is_recurring && taskForm.schedule_mode 
                    ? '⏰ Schedule Recurring Task' 
                    : 'Create Task')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Recurring Tasks Management Modal */}
      <Dialog open={showRecurringTasks} onOpenChange={setShowRecurringTasks}>
        <DialogContent className="sm:max-w-[900px] max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <DialogTitle className="text-2xl">Manage Recurring Tasks</DialogTitle>
              {recurringTasks.length > 0 && (
                <Button
                  onClick={handleGenerateAllRecurringTasks}
                  className="bg-green-600 hover:bg-green-700 text-white"
                  size="sm"
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Generate All Tasks
                </Button>
              )}
            </div>
          </DialogHeader>
          
          <div className="py-4">
            {recurringTasks.length === 0 ? (
              <div className="text-center py-12">
                <Clock className="w-16 h-16 mx-auto text-gray-400 mb-4" />
                <p className="text-gray-500 text-lg">No recurring tasks yet</p>
                <p className="text-gray-400 text-sm mt-2">Create a task with recurring enabled to see it here</p>
              </div>
            ) : (
              <div className="space-y-4">
                {recurringTasks.map((recurringTask) => (
                  <div 
                    key={recurringTask.id}
                    className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:shadow-md transition-shadow bg-gradient-to-r from-purple-50/50 to-blue-50/50 dark:from-purple-900/20 dark:to-blue-900/20"
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h4 className="font-bold text-gray-900 dark:text-white text-lg">
                            {recurringTask.title}
                          </h4>
                          <span className="px-2 py-1 bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 rounded text-xs font-semibold">
                            🔄 Recurring
                          </span>
                        </div>
                        
                        {recurringTask.description && (
                          <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                            {recurringTask.description}
                          </p>
                        )}
                        
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <span className="text-gray-500">Frequency:</span>
                            <p className="font-medium">
                              Every {recurringTask.recurrence_interval} {recurringTask.recurrence_frequency.toLowerCase()}
                              {recurringTask.recurrence_interval > 1 ? 's' : ''}
                            </p>
                          </div>
                          
                          {recurringTask.recurrence_frequency === 'Weekly' && recurringTask.recurrence_days?.length > 0 && (
                            <div>
                              <span className="text-gray-500">On days:</span>
                              <p className="font-medium">
                                {recurringTask.recurrence_days.map(d => d.slice(0, 3)).join(', ')}
                              </p>
                            </div>
                          )}
                          
                          <div>
                            <span className="text-gray-500">Appears at:</span>
                            <p className="font-medium">{convertUTCTimeToLocal(recurringTask.recurrence_time || '00:00')} (Your timezone)</p>
                          </div>
                          
                          <div>
                            <span className="text-gray-500">Assigned to:</span>
                            <p className="font-medium">
                              {recurringTask.assign_to_team 
                                ? 'Entire Team' 
                                : users.find(u => u.id === recurringTask.assignee)?.name || 'Unknown'}
                            </p>
                          </div>
                          
                          <div>
                            <span className="text-gray-500">Priority:</span>
                            <span className={`ml-2 px-2 py-1 rounded text-xs ${getPriorityColor(recurringTask.priority)}`}>
                              {recurringTask.priority}
                            </span>
                          </div>
                          
                          {recurringTask.project_id && (
                            <div>
                              <span className="text-gray-500">Project:</span>
                              <p className="font-medium text-blue-600">{getProjectName(recurringTask.project_id)}</p>
                            </div>
                          )}
                        </div>
                      </div>
                      
                      <div className="flex gap-2 ml-4">
                        <button
                          onClick={() => handleGenerateTasksFromTemplate(recurringTask.id)}
                          className="p-2 hover:bg-green-100 dark:hover:bg-green-900/20 rounded"
                          title="Generate tasks now"
                        >
                          <RefreshCw className="w-5 h-5 text-green-600 dark:text-green-400" />
                        </button>
                        <button
                          onClick={() => handleEditRecurringTask(recurringTask)}
                          className="p-2 hover:bg-blue-100 dark:hover:bg-blue-900/20 rounded"
                          title="Edit recurring task"
                        >
                          <Edit2 className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                        </button>
                        <button
                          onClick={() => handleDeleteRecurringTask(recurringTask.id)}
                          className="p-2 hover:bg-red-100 dark:hover:bg-red-900/20 rounded"
                          title="Delete recurring task"
                        >
                          <Trash2 className="w-5 h-5 text-red-600 dark:text-red-400" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          
          <DialogFooter>
            <Button onClick={() => setShowRecurringTasks(false)} variant="outline">
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Task Quick Edit Modal (Card Click - Edit everything except title/description) */}
      <TaskQuickEditModal
        task={selectedTask}
        open={taskQuickEditModalOpen}
        onClose={() => {
          setTaskQuickEditModalOpen(false);
          setSelectedTask(null);
        }}
        onUpdate={handleTaskUpdate}
        projects={projects}
        users={users}
        currentUser={currentUser}
      />

      {/* Trello Task Modal (Full Task Management) */}
      <TrelloTaskModal
        task={selectedTask}
        open={trelloTaskModalOpen}
        onClose={() => {
          setTrelloTaskModalOpen(false);
          setSelectedTask(null);
        }}
        onUpdate={handleTaskUpdate}
        onApprove={handleTaskApprove}
        onReject={handleTaskReject}
        projects={projects}
        users={users}
        currentUser={currentUser}
      />
    </div>
  );
};

export default MyTasks;
