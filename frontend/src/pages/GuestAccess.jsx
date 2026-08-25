import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Progress } from '../components/ui/progress';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from '../components/ui/dialog';
import { toast } from 'sonner';
import { CheckCircle, Circle, Users, Calendar, Flag, FolderOpen, Video, Package, AlertCircle, PlusCircle, Trash2, LayoutGrid, List as ListIcon, Table2, FileText } from 'lucide-react';
import { BACKEND_URL, API_URL } from '../config';

const API = API_URL;

const GuestAccess = () => {
  const { token } = useParams();
  const [project, setProject] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [guestLink, setGuestLink] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);
  const [showSatisfactionDialog, setShowSatisfactionDialog] = useState(false);
  const [taskDialogOpen, setTaskDialogOpen] = useState(false);
  const [taskViewType, setTaskViewType] = useState('list'); // 'kanban', 'list', 'table'
  const [editingTaskId, setEditingTaskId] = useState(null);
  const [editingField, setEditingField] = useState(null);
  
  const [guestInfo, setGuestInfo] = useState({
    guest_name: '',
    guest_email: ''
  });

  const [newTask, setNewTask] = useState({
    title: '',
    description: '',
    assignee: '',
    due_date: '',
    priority: 'Medium',
    status: 'Not Started'
  });
  
  const TASK_STATUSES = ['Not Started', 'In Progress', 'Under Review', 'Completed'];

  useEffect(() => {
    checkGuestAuth();
  }, [token]);

  useEffect(() => {
    if (authenticated) {
      checkIfAllTasksApproved();
    }
  }, [tasks, authenticated]);

  const checkGuestAuth = async () => {
    // Check if already authenticated
    const storedToken = sessionStorage.getItem(`guest_${token}`);
    if (storedToken) {
      await fetchGuestProject();
      setAuthenticated(true);
    } else {
      setLoading(false);
    }
  };

  const handleGuestLogin = async (e) => {
    e.preventDefault();
    try {
      const response = await axios.post(`${API}/guest-access/${token}`, guestInfo);
      sessionStorage.setItem(`guest_${token}`, 'true');
      setAuthenticated(true);
      toast.success('Access granted!');
      await fetchGuestProject();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Access denied');
    }
  };

  const fetchGuestProject = async () => {
    try {
      const [projectRes, tasksRes, docsRes] = await Promise.all([
        axios.get(`${API}/guest-project/${token}`),
        axios.get(`${API}/tasks/${token}`).catch(() => ({ data: [] })),
        axios.get(`${API}/documents/${token}`).catch(() => ({ data: [] }))
      ]);
      
      setProject(projectRes.data);
      
      // Fetch tasks by project ID
      const tasksResponse = await axios.get(`${API}/tasks/${projectRes.data.id}`);
      setTasks(tasksResponse.data);
      
      // Fetch documents by project ID
      const docsResponse = await axios.get(`${API}/documents/${projectRes.data.id}`);
      setDocuments(docsResponse.data);
      
      // Get guest link info
      const linkData = await axios.get(`${API}/guest-project/${token}`);
      setGuestLink(linkData.data);
    } catch (error) {
      toast.error('Failed to load project');
    } finally {
      setLoading(false);
    }
  };

  const checkIfAllTasksApproved = () => {
    if (tasks.length === 0) return;
    
    const underReviewTasks = tasks.filter(t => t.status === 'Under Review');
    const allUnderReviewApproved = underReviewTasks.every(t => t.approved_by_guest);
    
    if (underReviewTasks.length > 0 && allUnderReviewApproved && !guestLink?.satisfaction_confirmed) {
      setShowSatisfactionDialog(true);
    }
  };

  const handleApproveTask = async (taskId) => {
    try {
      await axios.post(`${API}/guest-approve-task/${token}/${taskId}`);
      toast.success('Task approved!');
      await fetchGuestProject();
    } catch (error) {
      toast.error('Failed to approve task');
    }
  };
  
  const handleTaskDragEnd = async (result) => {
    const { destination, source, draggableId } = result;
    
    if (!destination) return;
    if (destination.droppableId === source.droppableId && destination.index === source.index) return;
    
    try {
      const taskId = draggableId;
      const newStatus = destination.droppableId;
      
      await axios.put(`${API}/tasks/${taskId}`, { status: newStatus });
      toast.success('Task status updated!');
      await fetchGuestProject();
    } catch (error) {
      toast.error('Failed to update task status');
    }
  };
  
  const handleInlineEdit = (taskId, field, value) => {
    setEditingTaskId(taskId);
    setEditingField({ field, value });
  };
  
  const handleSaveInlineEdit = async (taskId, field, value) => {
    try {
      await axios.put(`${API}/tasks/${taskId}`, { [field]: value });
      toast.success('Task updated!');
      setEditingTaskId(null);
      setEditingField(null);
      await fetchGuestProject();
    } catch (error) {
      toast.error('Failed to update task');
    }
  };

  const handleApproveDeliverable = async (docId) => {
    try {
      // Update document to mark as approved
      await axios.post(`${API}/guest-approve-document/${token}/${docId}`);
      toast.success('Deliverable approved!');
      await fetchGuestProject();
      
      // Check if all deliverables are approved
      const allDeliverables = documents.filter(d => d.type === 'deliverables');
      const allApproved = allDeliverables.every(d => d.id === docId || d.approved_by_guest);
      
      if (allApproved && !guestLink?.satisfaction_confirmed) {
        setShowSatisfactionDialog(true);
      }
    } catch (error) {
      toast.error('Failed to approve deliverable');
    }
  };

  const handleCreateTask = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API}/tasks`, { ...newTask, project_id: project.id });
      toast.success('Task created successfully!');
      setTaskDialogOpen(false);
      setNewTask({
        title: '',
        description: '',
        assignee: '',
        due_date: '',
        priority: 'Medium',
        status: 'Not Started'
      });
      await fetchGuestProject();
    } catch (error) {
      toast.error('Failed to create task');
    }
  };

  const handleSatisfactionConfirm = async (satisfied) => {
    try {
      await axios.post(`${API}/guest-satisfaction/${token}`, null, {
        params: { satisfied }
      });
      
      if (satisfied) {
        toast.success('Thank you! This link will expire in 2 weeks.');
        setShowSatisfactionDialog(false);
      } else {
        toast.info('Please continue working with the team.');
        setShowSatisfactionDialog(false);
      }
      
      await fetchGuestProject();
    } catch (error) {
      toast.error('Failed to save response');
    }
  };

  const getProgress = () => {
    if (tasks.length === 0) return 0;
    const completed = tasks.filter(t => t.status === 'Completed').length;
    return Math.round((completed / tasks.length) * 100);
  };

  const getPriorityColor = (priority) => {
    const colors = {
      'Low': 'text-green-600 bg-green-50',
      'Medium': 'text-amber-600 bg-amber-50',
      'High': 'text-red-600 bg-red-50'
    };
    return colors[priority] || 'text-gray-600 bg-gray-50';
  };
  
  const getStatusColor = (status) => {
    switch (status) {
      case 'Completed':
        return 'bg-green-100 text-green-700';
      case 'In Progress':
        return 'bg-blue-100 text-blue-700';
      case 'Under Review':
        return 'bg-yellow-100 text-yellow-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  const getStatusIcon = (status) => {
    if (status === 'Completed') return <CheckCircle className="w-4 h-4 text-green-600" />;
    return <Circle className="w-4 h-4 text-gray-400" />;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }

  if (!authenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-purple-50 to-blue-50 p-4 relative overflow-hidden">
        {/* Animated Background Elements */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-400/20 rounded-full blur-3xl animate-pulse"></div>
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-400/20 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }}></div>
        </div>
        
        <Card className="w-full max-w-lg shadow-2xl border-0 relative z-10 animate-scale-in backdrop-blur-xl bg-white/70 dark:bg-gray-900/70" data-testid="guest-login-card">
          <CardHeader className="space-y-4 text-center pb-6">
            <div className="flex items-center justify-center space-x-3 mb-2">
              <div className="text-5xl">🔥</div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 via-purple-600 to-blue-600 bg-clip-text text-transparent animate-shimmer bg-[length:200%_auto]">
                Millii
              </h1>
            </div>
            <div className="space-y-2">
              <CardTitle className="text-2xl font-semibold">Welcome to Millii</CardTitle>
              <p className="text-sm text-gray-600 leading-relaxed">
                Everything related to your project will be here. You can view project details, track tasks, access documents, and collaborate with the team in one place.
              </p>
            </div>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleGuestLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="guest-name">Your Name</Label>
                <Input
                  id="guest-name"
                  data-testid="guest-name-input"
                  placeholder="John Doe"
                  value={guestInfo.guest_name}
                  onChange={(e) => setGuestInfo({ ...guestInfo, guest_name: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="guest-email">Your Email</Label>
                <Input
                  id="guest-email"
                  data-testid="guest-email-input"
                  type="email"
                  placeholder="you@example.com"
                  value={guestInfo.guest_email}
                  onChange={(e) => setGuestInfo({ ...guestInfo, guest_email: e.target.value })}
                  required
                />
              </div>
              <Button
                type="submit"
                data-testid="guest-submit-button"
                className="w-full text-white font-medium"
                style={{ background: 'linear-gradient(135deg, #2563EB 0%, #7C3AED 50%, #3B82F6 100%)' }}
              >
                Access Project
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <AlertCircle className="w-16 h-16 mx-auto text-red-500 mb-4" />
          <h2 className="text-xl font-semibold mb-2">Project not found</h2>
          <p className="text-gray-500">This guest link may be invalid or expired.</p>
        </div>
      </div>
    );
  }

  const docsLinks = documents.filter(d => d.type === 'docs_links');
  const meetingSummaries = documents.filter(d => d.type === 'meeting_summaries');
  const deliverables = documents.filter(d => d.type === 'deliverables');

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="border-b border-gray-200 bg-white sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center space-x-3">
            <div className="text-2xl">🔥</div>
            <h1 className="text-xl font-bold bg-gradient-to-r from-blue-600 via-purple-600 to-blue-600 bg-clip-text text-transparent">
              Millii
            </h1>
            <div className="h-6 w-px bg-gray-300 mx-2"></div>
            <div>
              <h2 className="text-lg font-semibold text-slate-900">{project.name}</h2>
              <p className="text-sm text-gray-500">{project.company_name}</p>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Welcome Banner */}
        {guestInfo.guest_name && (
          <div className="mb-8 p-6 rounded-lg border-2 border-blue-200 bg-gradient-to-r from-blue-50 to-purple-50">
            <h2 className="text-2xl font-bold mb-2">
              Welcome, {guestInfo.guest_name}! 👋
            </h2>
            <p className="text-gray-700">
              Here's everything you need to know about your project. Feel free to review tasks, documents, and deliverables.
            </p>
          </div>
        )}
        
        {/* Project Overview */}
        <Card className="mb-6 border border-gray-200">
          <CardHeader>
            <CardTitle className="text-lg font-medium">Project Overview</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <p className="text-xs text-gray-500 mb-1">Company</p>
                <p className="text-sm font-medium">{project.company_name}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1">Client</p>
                <p className="text-sm font-medium">{project.client_name}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1">Status</p>
                <p className="text-sm font-medium">{project.status}</p>
              </div>
            </div>
            <div className="mt-6">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs text-gray-500">Progress</p>
                <p className="text-xs font-medium text-gray-700">{getProgress()}%</p>
              </div>
              <Progress value={getProgress()} className="h-2" />
            </div>
          </CardContent>
        </Card>

        {/* Tasks Section */}
        <Card className="mb-6 border border-gray-200">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg font-medium">Tasks</CardTitle>
              <div className="flex items-center space-x-2">
                {/* View Switcher */}
                <div className="flex items-center space-x-1 bg-gray-100 p-1 rounded-lg">
                  <button
                    onClick={() => setTaskViewType('list')}
                    className={`p-2 rounded transition-all ${
                      taskViewType === 'list' ? 'bg-white shadow' : 'hover:bg-gray-200'
                    }`}
                    title="List View"
                  >
                    <ListIcon className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setTaskViewType('kanban')}
                    className={`p-2 rounded transition-all ${
                      taskViewType === 'kanban' ? 'bg-white shadow' : 'hover:bg-gray-200'
                    }`}
                    title="Kanban View"
                  >
                    <LayoutGrid className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setTaskViewType('table')}
                    className={`p-2 rounded transition-all ${
                      taskViewType === 'table' ? 'bg-white shadow' : 'hover:bg-gray-200'
                    }`}
                    title="Table View"
                  >
                    <Table2 className="w-4 h-4" />
                  </button>
                </div>
                <Dialog open={taskDialogOpen} onOpenChange={setTaskDialogOpen}>
                <DialogTrigger asChild>
                  <Button
                    data-testid="guest-add-task-button"
                    size="sm"
                    className="text-white font-medium"
                    style={{ background: 'linear-gradient(135deg, #2563EB 0%, #7C3AED 50%, #3B82F6 100%)' }}
                  >
                    <PlusCircle className="w-4 h-4 mr-2" />
                    Add Task
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl">
                  <DialogHeader>
                    <DialogTitle>Create New Task</DialogTitle>
                  </DialogHeader>
                  <form onSubmit={handleCreateTask} className="space-y-4 mt-4">
                    <div className="space-y-2">
                      <Label htmlFor="task-title">Title *</Label>
                      <Input
                        id="task-title"
                        placeholder="Task title"
                        value={newTask.title}
                        onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="task-description">Description</Label>
                      <Textarea
                        id="task-description"
                        placeholder="Task description"
                        value={newTask.description}
                        onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
                        rows={3}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="task-due-date">Due Date</Label>
                        <Input
                          id="task-due-date"
                          type="date"
                          value={newTask.due_date}
                          onChange={(e) => setNewTask({ ...newTask, due_date: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="task-priority">Priority</Label>
                        <select
                          id="task-priority"
                          className="w-full px-3 py-2 border rounded-md"
                          value={newTask.priority}
                          onChange={(e) => setNewTask({ ...newTask, priority: e.target.value })}
                        >
                          <option value="Low">Low</option>
                          <option value="Medium">Medium</option>
                          <option value="High">High</option>
                        </select>
                      </div>
                    </div>
                    <div className="flex justify-end space-x-2 pt-4">
                      <Button type="button" variant="outline" onClick={() => setTaskDialogOpen(false)}>
                        Cancel
                      </Button>
                      <Button type="submit" className="text-white" style={{ background: 'linear-gradient(135deg, #2563EB 0%, #7C3AED 50%, #3B82F6 100%)' }}>
                        Create Task
                      </Button>
                    </div>
                  </form>
                </DialogContent>
              </Dialog>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {tasks.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-8">No tasks yet</p>
            ) : (
              <>
                {/* List View */}
                {taskViewType === 'list' && (
                  <div className="space-y-2">
                    {tasks.map((task) => (
                      <div
                        key={task.id}
                        data-testid={`guest-task-item-${task.id}`}
                        className="flex items-center justify-between p-4 bg-white border rounded-lg hover:shadow-sm transition-shadow"
                      >
                        <div className="flex items-center space-x-4 flex-1">
                          <FileText className="w-5 h-5 text-gray-400" />
                          <div className="flex-1">
                            {editingTaskId === task.id && editingField?.field === 'title' ? (
                              <input
                                type="text"
                                className="font-medium text-sm border rounded px-2 py-1 w-full"
                                defaultValue={task.title}
                                autoFocus
                                onBlur={(e) => handleSaveInlineEdit(task.id, 'title', e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') handleSaveInlineEdit(task.id, 'title', e.target.value);
                                  if (e.key === 'Escape') { setEditingTaskId(null); setEditingField(null); }
                                }}
                              />
                            ) : (
                              <h4 
                                className="font-medium text-sm cursor-pointer hover:text-blue-600"
                                onClick={() => handleInlineEdit(task.id, 'title', task.title)}
                              >
                                {task.title}
                              </h4>
                            )}
                            {task.description && (
                              editingTaskId === task.id && editingField?.field === 'description' ? (
                                <textarea
                                  className="text-xs text-gray-500 mt-1 border rounded px-2 py-1 w-full"
                                  defaultValue={task.description}
                                  autoFocus
                                  onBlur={(e) => handleSaveInlineEdit(task.id, 'description', e.target.value)}
                                  rows={2}
                                />
                              ) : (
                                <p 
                                  className="text-xs text-gray-500 mt-1 cursor-pointer hover:text-blue-600"
                                  onClick={() => handleInlineEdit(task.id, 'description', task.description)}
                                >
                                  {task.description}
                                </p>
                              )
                            )}
                          </div>
                        </div>
                        <div className="flex items-center space-x-4">
                          <div className="flex items-center space-x-1">
                            <div className={`w-2 h-2 rounded-full ${
                              task.status === 'Completed' ? 'bg-green-500' :
                              task.status === 'In Progress' ? 'bg-blue-500' :
                              task.status === 'Under Review' ? 'bg-yellow-500' :
                              'bg-gray-400'
                            }`}></div>
                            {editingTaskId === task.id && editingField?.field === 'status' ? (
                              <select
                                className="text-sm text-gray-700 border rounded px-2 py-1"
                                defaultValue={task.status}
                                autoFocus
                                onBlur={(e) => handleSaveInlineEdit(task.id, 'status', e.target.value)}
                                onChange={(e) => handleSaveInlineEdit(task.id, 'status', e.target.value)}
                              >
                                {TASK_STATUSES.map(status => (
                                  <option key={status} value={status}>{status}</option>
                                ))}
                              </select>
                            ) : (
                              <span 
                                className="text-sm text-gray-700 cursor-pointer hover:text-blue-600"
                                onClick={() => handleInlineEdit(task.id, 'status', task.status)}
                              >
                                {task.status}
                              </span>
                            )}
                          </div>
                          {editingTaskId === task.id && editingField?.field === 'due_date' ? (
                            <input
                              type="date"
                              className="text-sm text-gray-500 border rounded px-2 py-1"
                              defaultValue={task.due_date}
                              autoFocus
                              onBlur={(e) => handleSaveInlineEdit(task.id, 'due_date', e.target.value)}
                              onChange={(e) => handleSaveInlineEdit(task.id, 'due_date', e.target.value)}
                            />
                          ) : task.due_date ? (
                            <span 
                              className="text-sm text-gray-500 cursor-pointer hover:text-blue-600"
                              onClick={() => handleInlineEdit(task.id, 'due_date', task.due_date)}
                            >
                              {new Date(task.due_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                            </span>
                          ) : (
                            <span 
                              className="text-sm text-gray-400 cursor-pointer hover:text-blue-600"
                              onClick={() => handleInlineEdit(task.id, 'due_date', '')}
                            >
                              Add date
                            </span>
                          )}
                          {editingTaskId === task.id && editingField?.field === 'priority' ? (
                            <select
                              className={`text-xs px-3 py-1 rounded-full border ${getPriorityColor(task.priority)}`}
                              defaultValue={task.priority}
                              autoFocus
                              onBlur={(e) => handleSaveInlineEdit(task.id, 'priority', e.target.value)}
                              onChange={(e) => handleSaveInlineEdit(task.id, 'priority', e.target.value)}
                            >
                              <option value="Low">Low</option>
                              <option value="Medium">Medium</option>
                              <option value="High">High</option>
                            </select>
                          ) : (
                            <span 
                              className={`text-xs px-3 py-1 rounded-full cursor-pointer hover:opacity-75 ${getPriorityColor(task.priority)}`}
                              onClick={() => handleInlineEdit(task.id, 'priority', task.priority)}
                            >
                              {task.priority}
                            </span>
                          )}
                          {task.status === 'Under Review' && !task.approved_by_guest && (
                            <Button
                              size="sm"
                              onClick={() => handleApproveTask(task.id)}
                              data-testid={`approve-task-${task.id}`}
                              className="bg-green-600 hover:bg-green-700"
                            >
                              Approve
                            </Button>
                          )}
                          {task.approved_by_guest && task.approved_by && (
                            <div className="text-xs text-green-600 flex items-center">
                              <CheckCircle className="w-3 h-3 mr-1" />
                              Approved by {task.approved_by}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Kanban View */}
                {taskViewType === 'kanban' && (
                  <DragDropContext onDragEnd={handleTaskDragEnd}>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                      {TASK_STATUSES.map(status => {
                        const statusTasks = tasks.filter(t => t.status === status);
                        return (
                          <Droppable key={status} droppableId={status}>
                            {(provided, snapshot) => (
                              <div
                                ref={provided.innerRef}
                                {...provided.droppableProps}
                                className={`rounded-lg border-2 p-4 min-h-[400px] ${
                                  snapshot.isDraggingOver ? 'bg-blue-50 border-blue-300' : 'bg-gray-50 border-gray-200'
                                }`}
                              >
                                <h3 className="font-semibold mb-3 text-sm">
                                  {status} ({statusTasks.length})
                                </h3>
                                <div className="space-y-3">
                                  {statusTasks.map((task, index) => (
                                    <Draggable
                                      key={task.id}
                                      draggableId={task.id}
                                      index={index}
                                    >
                                      {(provided, snapshot) => (
                                        <div
                                          ref={provided.innerRef}
                                          {...provided.draggableProps}
                                          {...provided.dragHandleProps}
                                          className={`bg-white border rounded-lg p-3 ${
                                            snapshot.isDragging ? 'shadow-lg' : 'shadow-sm'
                                          }`}
                                        >
                                          <h4 className="font-medium text-sm mb-2">{task.title}</h4>
                                          {task.description && (
                                            <p className="text-xs text-gray-500 mb-2 line-clamp-2">{task.description}</p>
                                          )}
                                          <div className="flex items-center justify-between text-xs mb-2">
                                            <span className={`px-2 py-0.5 rounded text-xs ${getPriorityColor(task.priority)}`}>
                                              {task.priority}
                                            </span>
                                          </div>
                                          {task.due_date && (
                                            <div className="text-xs text-gray-500 mb-2">
                                              Due: {new Date(task.due_date).toLocaleDateString()}
                                            </div>
                                          )}
                                          {task.status === 'Under Review' && !task.approved_by_guest && (
                                            <Button
                                              size="sm"
                                              onClick={() => handleApproveTask(task.id)}
                                              className="w-full mt-2 bg-green-600 hover:bg-green-700 text-white"
                                            >
                                              Approve
                                            </Button>
                                          )}
                                          {task.approved_by_guest && task.approved_by && (
                                            <div className="text-xs text-green-600 mt-2 flex items-center">
                                              <CheckCircle className="w-3 h-3 mr-1" />
                                              Approved by {task.approved_by}
                                            </div>
                                          )}
                                        </div>
                                      )}
                                    </Draggable>
                                  ))}
                                  {provided.placeholder}
                                </div>
                              </div>
                            )}
                          </Droppable>
                        );
                      })}
                    </div>
                  </DragDropContext>
                )}

                {/* Table View */}
                {taskViewType === 'table' && (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-50 border-b">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Task Name
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Status
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Deadline
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Priority
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {tasks.map((task) => (
                          <tr key={task.id} data-testid={`guest-task-item-${task.id}`} className="hover:bg-gray-50">
                            <td className="px-4 py-4">
                              <div className="flex items-center space-x-3">
                                <FileText className="w-5 h-5 text-gray-400 flex-shrink-0" />
                                <div className="flex-1">
                                  {editingTaskId === task.id && editingField?.field === 'title' ? (
                                    <input
                                      type="text"
                                      className="text-sm font-medium text-gray-900 border rounded px-2 py-1 w-full"
                                      defaultValue={task.title}
                                      autoFocus
                                      onBlur={(e) => handleSaveInlineEdit(task.id, 'title', e.target.value)}
                                      onKeyDown={(e) => {
                                        if (e.key === 'Enter') handleSaveInlineEdit(task.id, 'title', e.target.value);
                                        if (e.key === 'Escape') { setEditingTaskId(null); setEditingField(null); }
                                      }}
                                    />
                                  ) : (
                                    <div 
                                      className="text-sm font-medium text-gray-900 cursor-pointer hover:text-blue-600"
                                      onClick={() => handleInlineEdit(task.id, 'title', task.title)}
                                    >
                                      {task.title}
                                    </div>
                                  )}
                                  {task.description && (
                                    editingTaskId === task.id && editingField?.field === 'description' ? (
                                      <textarea
                                        className="text-xs text-gray-500 mt-1 border rounded px-2 py-1 w-full"
                                        defaultValue={task.description}
                                        autoFocus
                                        onBlur={(e) => handleSaveInlineEdit(task.id, 'description', e.target.value)}
                                        rows={2}
                                      />
                                    ) : (
                                      <div 
                                        className="text-xs text-gray-500 mt-1 line-clamp-1 cursor-pointer hover:text-blue-600"
                                        onClick={() => handleInlineEdit(task.id, 'description', task.description)}
                                      >
                                        {task.description}
                                      </div>
                                    )
                                  )}
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-4 whitespace-nowrap">
                              <div className="flex items-center space-x-2">
                                <div className={`w-2 h-2 rounded-full ${
                                  task.status === 'Completed' ? 'bg-green-500' :
                                  task.status === 'In Progress' ? 'bg-blue-500' :
                                  task.status === 'Under Review' ? 'bg-yellow-500' :
                                  'bg-gray-400'
                                }`}></div>
                                {editingTaskId === task.id && editingField?.field === 'status' ? (
                                  <select
                                    className="text-sm text-gray-700 border rounded px-2 py-1"
                                    defaultValue={task.status}
                                    autoFocus
                                    onBlur={(e) => handleSaveInlineEdit(task.id, 'status', e.target.value)}
                                    onChange={(e) => handleSaveInlineEdit(task.id, 'status', e.target.value)}
                                  >
                                    {TASK_STATUSES.map(status => (
                                      <option key={status} value={status}>{status}</option>
                                    ))}
                                  </select>
                                ) : (
                                  <span 
                                    className="text-sm text-gray-700 cursor-pointer hover:text-blue-600"
                                    onClick={() => handleInlineEdit(task.id, 'status', task.status)}
                                  >
                                    {task.status}
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">
                              {editingTaskId === task.id && editingField?.field === 'due_date' ? (
                                <input
                                  type="date"
                                  className="text-sm text-gray-500 border rounded px-2 py-1"
                                  defaultValue={task.due_date}
                                  autoFocus
                                  onBlur={(e) => handleSaveInlineEdit(task.id, 'due_date', e.target.value)}
                                  onChange={(e) => handleSaveInlineEdit(task.id, 'due_date', e.target.value)}
                                />
                              ) : task.due_date ? (
                                <span 
                                  className="cursor-pointer hover:text-blue-600"
                                  onClick={() => handleInlineEdit(task.id, 'due_date', task.due_date)}
                                >
                                  {new Date(task.due_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                                </span>
                              ) : (
                                <span 
                                  className="text-gray-400 cursor-pointer hover:text-blue-600"
                                  onClick={() => handleInlineEdit(task.id, 'due_date', '')}
                                >
                                  Add date
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-4 whitespace-nowrap">
                              {editingTaskId === task.id && editingField?.field === 'priority' ? (
                                <select
                                  className={`text-xs px-3 py-1.5 rounded-full font-medium border ${getPriorityColor(task.priority)}`}
                                  defaultValue={task.priority}
                                  autoFocus
                                  onBlur={(e) => handleSaveInlineEdit(task.id, 'priority', e.target.value)}
                                  onChange={(e) => handleSaveInlineEdit(task.id, 'priority', e.target.value)}
                                >
                                  <option value="Low">Low</option>
                                  <option value="Medium">Medium</option>
                                  <option value="High">High</option>
                                </select>
                              ) : (
                                <span 
                                  className={`text-xs px-3 py-1.5 rounded-full font-medium cursor-pointer hover:opacity-75 ${getPriorityColor(task.priority)}`}
                                  onClick={() => handleInlineEdit(task.id, 'priority', task.priority)}
                                >
                                  {task.priority}
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-4 whitespace-nowrap text-sm">
                              {task.status === 'Under Review' && !task.approved_by_guest ? (
                                <Button
                                  size="sm"
                                  onClick={() => handleApproveTask(task.id)}
                                  data-testid={`approve-task-${task.id}`}
                                  className="bg-green-600 hover:bg-green-700"
                                >
                                  Approve
                                </Button>
                              ) : task.approved_by_guest && task.approved_by ? (
                                <div className="text-xs text-green-600 flex items-center">
                                  <CheckCircle className="w-3 h-3 mr-1" />
                                  Approved by {task.approved_by}
                                </div>
                              ) : (
                                <span className="text-xs text-gray-400">-</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>

        {/* Documents Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Docs & Links */}
          <Card className="border border-gray-200">
            <CardHeader>
              <div className="flex items-center space-x-2">
                <FolderOpen className="w-4 h-4" style={{ color: '#7C3AED' }} />
                <CardTitle className="text-base font-medium">Docs & Links</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              {docsLinks.length === 0 ? (
                <p className="text-xs text-gray-500 text-center py-4">No documents yet</p>
              ) : (
                <div className="space-y-2">
                  {docsLinks.map((doc) => (
                    <a
                      key={doc.id}
                      href={doc.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm hover:underline block truncate"
                      style={{ color: '#7C3AED' }}
                      data-testid={`guest-doc-link-${doc.id}`}
                    >
                      {doc.title}
                    </a>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Meeting Summaries */}
          <Card className="border border-gray-200">
            <CardHeader>
              <div className="flex items-center space-x-2">
                <Video className="w-4 h-4" style={{ color: '#7C3AED' }} />
                <CardTitle className="text-base font-medium">Meeting Summaries</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              {meetingSummaries.length === 0 ? (
                <p className="text-xs text-gray-500 text-center py-4">No summaries yet</p>
              ) : (
                <div className="space-y-2">
                  {meetingSummaries.map((doc) => (
                    <a
                      key={doc.id}
                      href={doc.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm hover:underline block truncate"
                      style={{ color: '#7C3AED' }}
                    >
                      {doc.title}
                    </a>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Deliverables */}
          <Card className="border border-gray-200">
            <CardHeader>
              <div className="flex items-center space-x-2">
                <Package className="w-4 h-4" style={{ color: '#7C3AED' }} />
                <CardTitle className="text-base font-medium">Deliverables</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              {deliverables.length === 0 ? (
                <p className="text-xs text-gray-500 text-center py-4">No deliverables yet</p>
              ) : (
                <div className="space-y-3">
                  {deliverables.map((doc) => (
                    <div key={doc.id} className="border border-gray-200 rounded-lg p-3">
                      <div className="flex items-start justify-between">
                        <a
                          href={doc.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm hover:underline flex-1 truncate"
                          style={{ color: '#7C3AED' }}
                          data-testid={`guest-deliverable-link-${doc.id}`}
                        >
                          {doc.title}
                        </a>
                        {!doc.approved_by_guest ? (
                          <Button
                            size="sm"
                            onClick={() => handleApproveDeliverable(doc.id)}
                            data-testid={`approve-deliverable-${doc.id}`}
                            className="ml-2 text-white font-medium text-xs"
                            style={{ background: 'linear-gradient(135deg, #16A34A 0%, #22C55E 100%)' }}
                          >
                            Approve
                          </Button>
                        ) : (
                          <div className="ml-2">
                            <div className="flex items-center text-xs text-green-600">
                              <CheckCircle className="w-4 h-4 mr-1" />
                              Approved
                            </div>
                            {doc.approved_by && (
                              <div className="text-xs text-gray-500 mt-1">
                                by {doc.approved_by}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>

      {/* Satisfaction Dialog */}
      <Dialog open={showSatisfactionDialog} onOpenChange={setShowSatisfactionDialog}>
        <DialogContent data-testid="satisfaction-dialog">
          <DialogHeader>
            <DialogTitle>Project Satisfaction</DialogTitle>
            <DialogDescription>
              All tasks have been reviewed and approved. Are you satisfied with the project?
            </DialogDescription>
          </DialogHeader>
          <div className="flex space-x-4 mt-4">
            <Button
              onClick={() => handleSatisfactionConfirm(true)}
              data-testid="satisfaction-yes-button"
              className="flex-1 text-white font-medium"
              style={{ background: 'linear-gradient(135deg, #16A34A 0%, #22C55E 100%)' }}
            >
              Yes, I'm Satisfied
            </Button>
            <Button
              onClick={() => handleSatisfactionConfirm(false)}
              data-testid="satisfaction-no-button"
              variant="outline"
              className="flex-1"
              style={{ borderColor: '#7C3AED', color: '#7C3AED' }}
            >
              No, Continue
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default GuestAccess;