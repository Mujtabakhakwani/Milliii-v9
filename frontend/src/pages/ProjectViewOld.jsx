import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Progress } from '../components/ui/progress';
import { toast } from 'sonner';
import { ArrowLeft, Link as LinkIcon, PlusCircle, Trash2, CheckCircle, Circle, Users, Calendar, Flag, LogOut, Copy, FolderOpen, Video, Package, AlertCircle, Edit } from 'lucide-react';

import { BACKEND_URL, API_URL } from '../config';

const API = API_URL;

const ProjectView = ({ currentUser, onLogout }) => {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const [project, setProject] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [guestLink, setGuestLink] = useState(null);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('information');
  
  const [taskDialogOpen, setTaskDialogOpen] = useState(false);
  const [docDialogOpen, setDocDialogOpen] = useState(false);
  const [selectedDocType, setSelectedDocType] = useState('docs_links');
  const [editingTask, setEditingTask] = useState(null);
  const [internalNotes, setInternalNotes] = useState('');
  
  const [newTask, setNewTask] = useState({
    title: '',
    description: '',
    assignee: '',
    due_date: '',
    priority: 'Medium',
    status: 'Not Started'
  });
  
  const [newDoc, setNewDoc] = useState({
    title: '',
    url: ''
  });

  useEffect(() => {
    fetchProjectData();
    fetchUsers();
  }, [projectId]);

  const fetchProjectData = async () => {
    try {
      const [projectRes, tasksRes, docsRes] = await Promise.all([
        axios.get(`${API}/projects/${projectId}`),
        axios.get(`${API}/tasks/${projectId}`),
        axios.get(`${API}/documents/${projectId}`)
      ]);
      
      setProject(projectRes.data);
      setTasks(tasksRes.data);
      setDocuments(docsRes.data);
      setInternalNotes(projectRes.data.internal_notes || '');
      
      try {
        const linkRes = await axios.get(`${API}/guest-links/project/${projectId}`);
        setGuestLink(linkRes.data);
      } catch (err) {
        // No guest link yet
      }
    } catch (error) {
      toast.error('Failed to load project data');
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = async () => {
    try {
      const response = await axios.get(`${API}/users`);
      setUsers(response.data);
    } catch (error) {
      console.error('Failed to load users');
    }
  };

  const handleCreateTask = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API}/tasks`, { ...newTask, project_id: projectId });
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
      fetchProjectData();
    } catch (error) {
      toast.error('Failed to create task');
    }
  };

  // Removed duplicate functions - moved below

  const handleCreateDocument = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API}/documents`, {
        ...newDoc,
        project_id: projectId,
        type: selectedDocType
      });
      toast.success('Document added successfully!');
      setDocDialogOpen(false);
      setNewDoc({ title: '', url: '' });
      fetchProjectData();
    } catch (error) {
      toast.error('Failed to add document');
    }
  };

  const handleUpdateTask = async (taskId, updates) => {
    try {
      const token = localStorage.getItem('token');
      await axios.put(`${API}/tasks/${taskId}`, updates, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      toast.success('Task updated successfully');
      fetchProjectData();
    } catch (error) {
      console.error('Error updating task:', error);
      toast.error('Failed to update task');
    }
  };

  const handleDeleteTask = async (taskId) => {
    if (window.confirm('Are you sure you want to delete this task?')) {
      try {
        const token = localStorage.getItem('token');
        await axios.delete(`${API}/tasks/${taskId}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        
        toast.success('Task deleted successfully');
        fetchProjectData();
      } catch (error) {
        console.error('Error deleting task:', error);
        toast.error('Failed to delete task');
      }
    }
  };

  const handleDeleteDocument = async (docId) => {
    if (!window.confirm('Delete this document?')) return;
    try {
      await axios.delete(`${API}/documents/${docId}`);
      toast.success('Document deleted');
      fetchProjectData();
    } catch (error) {
      toast.error('Failed to delete document');
    }
  };

  const handleUpdateInternalNotes = async () => {
    try {
      const token = localStorage.getItem('token');
      await axios.put(`${API}/projects/${projectId}`, {
        internal_notes: internalNotes
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      toast.success('Internal notes updated successfully');
    } catch (error) {
      console.error('Error updating internal notes:', error);
      toast.error('Failed to update internal notes');
    }
  };

  const handleGenerateGuestLink = async () => {
    try {
      const response = await axios.post(`${API}/guest-links`, { project_id: projectId });
      setGuestLink(response.data);
      toast.success('Guest link generated!');
    } catch (error) {
      toast.error('Failed to generate guest link');
    }
  };

  const copyGuestLink = async () => {
    const link = `${window.location.origin}/guest/${guestLink.token}`;
    
    try {
      // Try using the Clipboard API first
      await navigator.clipboard.writeText(link);
      toast.success('Guest link copied to clipboard!');
    } catch (err) {
      // Fallback for browsers that block clipboard API
      const textArea = document.createElement('textarea');
      textArea.value = link;
      textArea.style.position = 'fixed';
      textArea.style.left = '-999999px';
      document.body.appendChild(textArea);
      textArea.select();
      
      try {
        document.execCommand('copy');
        toast.success('Guest link copied to clipboard!');
      } catch (execErr) {
        toast.error('Failed to copy. Please copy manually: ' + link);
      }
      
      document.body.removeChild(textArea);
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

  const getStatusIcon = (status) => {
    if (status === 'Completed') return <CheckCircle className="w-4 h-4 text-green-600" />;
    return <Circle className="w-4 h-4 text-gray-400" />;
  };

  const getUserName = (userId) => {
    const user = users.find(u => u.id === userId);
    return user ? user.name : 'Unassigned';
  };

  const getStatusColor = (status) => {
    const colors = {
      'Not Started': 'bg-gray-100 text-gray-800',
      'In Progress': 'bg-blue-100 text-blue-800',
      'Completed': 'bg-green-100 text-green-800',
      'On Hold': 'bg-yellow-100 text-yellow-800',
      'Cancelled': 'bg-red-100 text-red-800'
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50 dark:bg-gray-950">
        <div className="text-lg text-gray-600 dark:text-gray-400">Loading project...</div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50 dark:bg-gray-950">
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-2 text-gray-800 dark:text-white">Project not found</h2>
          <Button onClick={() => navigate('/projects')}>Back to Projects</Button>
        </div>
      </div>
    );
  }

  const docsLinks = documents.filter(d => d.type === 'docs_links');
  const meetingSummaries = documents.filter(d => d.type === 'meeting_summaries');
  const deliverables = documents.filter(d => d.type === 'deliverables');

  const tabs = [
    { id: 'information', label: 'Information', icon: FolderOpen },
    { id: 'useful-links', label: 'Useful Links', icon: LinkIcon },
    { id: 'meeting-notes', label: 'Meeting Notes', icon: Video },
    { id: 'deliverables', label: 'Deliverables', icon: Package }
  ];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      {/* Header */}
      <header className="bg-white/50 dark:bg-gray-800/50 backdrop-blur-lg border-b border-gray-200 dark:border-gray-700 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/projects')}
              data-testid="back-button"
              className="hover:bg-white/20 dark:hover:bg-gray-700/20"
            >
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div className="flex items-center space-x-2">
              <div className="text-lg">🔥</div>
              <span className="text-lg font-bold" style={{ background: 'linear-gradient(135deg, #C23616 0%, #E84118 50%, #FFA502 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                Millii
              </span>
            </div>
            <div className="h-6 w-px bg-gray-300 dark:bg-gray-600 mx-2"></div>
            <div>
              <h1 className="text-lg font-semibold text-gray-800 dark:text-white">{project.name}</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">{project.business_name || project.client_name}</p>
            </div>
          </div>
          <div className="flex items-center space-x-4">
            <span className="text-sm text-gray-600 dark:text-gray-400">{currentUser?.name}</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={onLogout}
              data-testid="logout-button"
              className="hover:bg-white/20 dark:hover:bg-gray-700/20"
            >
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </header>

      {/* Project Tabs */}
      <div className="bg-white/30 dark:bg-gray-800/30 backdrop-blur-lg border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-6">
          <nav className="flex space-x-8">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center space-x-2 py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                    activeTab === tab.id
                      ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Project Overview */}
        <Card className="mb-6 border border-gray-200">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg font-medium">Project Overview</CardTitle>
              {!guestLink ? (
                <Button
                  onClick={handleGenerateGuestLink}
                  data-testid="generate-guest-link-button"
                  className="text-white font-medium"
                  style={{ background: 'linear-gradient(135deg, #C23616 0%, #E84118 50%, #FFA502 100%)' }}
                  size="sm"
                >
                  <LinkIcon className="w-4 h-4 mr-2" />
                  Generate Guest Link
                </Button>
              ) : (
                <Button
                  onClick={copyGuestLink}
                  data-testid="copy-guest-link-button"
                  variant="outline"
                  size="sm"
                  style={{ borderColor: '#E84118', color: '#E84118' }}
                >
                  <Copy className="w-4 h-4 mr-2" />
                  Copy Guest Link
                </Button>
              )}
            </div>
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
                <p className="text-xs font-medium" style={{ color: '#E84118' }}>{getProgress()}%</p>
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
              <Dialog open={taskDialogOpen} onOpenChange={setTaskDialogOpen}>
                <DialogTrigger asChild>
                  <Button
                    data-testid="add-task-button"
                    size="sm"
                    className="text-white font-medium"
                    style={{ background: 'linear-gradient(135deg, #C23616 0%, #E84118 50%, #FFA502 100%)' }}
                  >
                    <PlusCircle className="w-4 h-4 mr-2" />
                    Add Task
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Create New Task</DialogTitle>
                  </DialogHeader>
                  <form onSubmit={handleCreateTask} className="space-y-4 mt-4">
                    <div className="space-y-2">
                      <Label htmlFor="task-title">Title *</Label>
                      <Input
                        id="task-title"
                        data-testid="task-title-input"
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
                        data-testid="task-description-input"
                        placeholder="Task description"
                        value={newTask.description}
                        onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
                        rows={3}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="task-assignee">Assignee</Label>
                        <select
                          id="task-assignee"
                          data-testid="task-assignee-select"
                          className="w-full px-3 py-2 border rounded-md"
                          value={newTask.assignee}
                          onChange={(e) => setNewTask({ ...newTask, assignee: e.target.value })}
                        >
                          <option value="">Unassigned</option>
                          {users.filter(u => u.role !== 'guest').map(user => (
                            <option key={user.id} value={user.id}>{user.name}</option>
                          ))}
                        </select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="task-due-date">Due Date</Label>
                        <Input
                          id="task-due-date"
                          data-testid="task-due-date-input"
                          type="date"
                          value={newTask.due_date}
                          onChange={(e) => setNewTask({ ...newTask, due_date: e.target.value })}
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="task-priority">Priority</Label>
                        <select
                          id="task-priority"
                          data-testid="task-priority-select"
                          className="w-full px-3 py-2 border rounded-md"
                          value={newTask.priority}
                          onChange={(e) => setNewTask({ ...newTask, priority: e.target.value })}
                        >
                          <option value="Low">Low</option>
                          <option value="Medium">Medium</option>
                          <option value="High">High</option>
                        </select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="task-status">Status</Label>
                        <select
                          id="task-status"
                          data-testid="task-status-select"
                          className="w-full px-3 py-2 border rounded-md"
                          value={newTask.status}
                          onChange={(e) => setNewTask({ ...newTask, status: e.target.value })}
                        >
                          <option value="Not Started">Not Started</option>
                          <option value="In Progress">In Progress</option>
                          <option value="Under Review">Under Review</option>
                          <option value="Completed">Completed</option>
                        </select>
                      </div>
                    </div>
                    <div className="flex justify-end space-x-2">
                      <Button type="button" variant="outline" onClick={() => setTaskDialogOpen(false)}>
                        Cancel
                      </Button>
                      <Button type="submit" className="text-white" style={{ background: 'linear-gradient(135deg, #C23616 0%, #E84118 50%, #FFA502 100%)' }}>
                        Create Task
                      </Button>
                    </div>
                  </form>
                </DialogContent>
              </Dialog>
            </div>
          </CardHeader>
          <CardContent>
            {tasks.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-8">No tasks yet. Create your first task!</p>
            ) : (
              <div className="space-y-3">
                {tasks.map((task) => (
                  <div
                    key={task.id}
                    data-testid={`task-item-${task.id}`}
                    className="border border-gray-200 rounded-lg p-4 hover:shadow-sm transition-shadow"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start space-x-3 flex-1">
                        <button
                          onClick={() => handleUpdateTask(task.id, {
                            status: task.status === 'Completed' ? 'In Progress' : 'Completed'
                          })}
                          className="mt-1"
                          data-testid={`task-status-toggle-${task.id}`}
                        >
                          {getStatusIcon(task.status)}
                        </button>
                        <div className="flex-1">
                          <h4 className="text-sm font-medium text-gray-900">{task.title}</h4>
                          {task.description && (
                            <p className="text-xs text-gray-500 mt-1">{task.description}</p>
                          )}
                          <div className="flex items-center space-x-4 mt-2">
                            {task.assignee && (
                              <div className="flex items-center text-xs text-gray-600">
                                <Users className="w-3 h-3 mr-1" />
                                {getUserName(task.assignee)}
                              </div>
                            )}
                            {task.due_date && (
                              <div className="flex items-center text-xs text-gray-600">
                                <Calendar className="w-3 h-3 mr-1" />
                                {new Date(task.due_date).toLocaleDateString()}
                              </div>
                            )}
                            <div className="flex items-center">
                              <Flag className="w-3 h-3 mr-1" />
                              <span className={`text-xs px-2 py-0.5 rounded ${getPriorityColor(task.priority)}`}>
                                {task.priority}
                              </span>
                            </div>
                            <span className="text-xs text-gray-500">{task.status}</span>
                          </div>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteTask(task.id)}
                        data-testid={`delete-task-${task.id}`}
                      >
                        <Trash2 className="w-4 h-4 text-gray-400 hover:text-red-600" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Documents Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Docs & Links */}
          <Card className="border border-gray-200">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <FolderOpen className="w-4 h-4" style={{ color: '#E84118' }} />
                  <CardTitle className="text-base font-medium">Documents & Links</CardTitle>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setSelectedDocType('docs_links');
                    setDocDialogOpen(true);
                  }}
                  data-testid="add-docs-links-button"
                >
                  <PlusCircle className="w-4 h-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {docsLinks.length === 0 ? (
                <p className="text-xs text-gray-500 text-center py-4">No documents yet</p>
              ) : (
                <div className="space-y-2">
                  {docsLinks.map((doc) => (
                    <div key={doc.id} className="flex items-center justify-between group">
                      <a
                        href={doc.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm hover:underline flex-1 truncate"
                        style={{ color: '#E84118' }}
                        data-testid={`doc-link-${doc.id}`}
                      >
                        {doc.title}
                      </a>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteDocument(doc.id)}
                        className="opacity-0 group-hover:opacity-100"
                        data-testid={`delete-doc-${doc.id}`}
                      >
                        <Trash2 className="w-3 h-3 text-gray-400" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Meeting Summaries */}
          <Card className="border border-gray-200">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Video className="w-4 h-4" style={{ color: '#E84118' }} />
                  <CardTitle className="text-base font-medium">Meeting Summaries</CardTitle>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setSelectedDocType('meeting_summaries');
                    setDocDialogOpen(true);
                  }}
                  data-testid="add-meeting-summary-button"
                >
                  <PlusCircle className="w-4 h-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {meetingSummaries.length === 0 ? (
                <p className="text-xs text-gray-500 text-center py-4">No summaries yet</p>
              ) : (
                <div className="space-y-2">
                  {meetingSummaries.map((doc) => (
                    <div key={doc.id} className="flex items-center justify-between group">
                      <a
                        href={doc.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm hover:underline flex-1 truncate"
                        style={{ color: '#E84118' }}
                        data-testid={`meeting-link-${doc.id}`}
                      >
                        {doc.title}
                      </a>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteDocument(doc.id)}
                        className="opacity-0 group-hover:opacity-100"
                      >
                        <Trash2 className="w-3 h-3 text-gray-400" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Deliverables */}
          <Card className="border border-gray-200">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Package className="w-4 h-4" style={{ color: '#E84118' }} />
                  <CardTitle className="text-base font-medium">Deliverables</CardTitle>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setSelectedDocType('deliverables');
                    setDocDialogOpen(true);
                  }}
                  data-testid="add-deliverable-button"
                >
                  <PlusCircle className="w-4 h-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {deliverables.length === 0 ? (
                <p className="text-xs text-gray-500 text-center py-4">No deliverables yet</p>
              ) : (
                <div className="space-y-2">
                  {deliverables.map((doc) => (
                    <div key={doc.id} className="flex items-center justify-between group">
                      <a
                        href={doc.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm hover:underline flex-1 truncate"
                        style={{ color: '#E84118' }}
                        data-testid={`deliverable-link-${doc.id}`}
                      >
                        {doc.title}
                      </a>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteDocument(doc.id)}
                        className="opacity-0 group-hover:opacity-100"
                      >
                        <Trash2 className="w-3 h-3 text-gray-400" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>

      {/* Document Dialog */}
      <Dialog open={docDialogOpen} onOpenChange={setDocDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Add {selectedDocType === 'docs_links' ? 'Document/Link' : selectedDocType === 'meeting_summaries' ? 'Meeting Summary' : 'Deliverable'}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateDocument} className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="doc-title">Title *</Label>
              <Input
                id="doc-title"
                data-testid="doc-title-input"
                placeholder="Document title"
                value={newDoc.title}
                onChange={(e) => setNewDoc({ ...newDoc, title: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="doc-url">URL *</Label>
              <Input
                id="doc-url"
                data-testid="doc-url-input"
                type="url"
                placeholder="https://..."
                value={newDoc.url}
                onChange={(e) => setNewDoc({ ...newDoc, url: e.target.value })}
                required
              />
            </div>
            <div className="flex justify-end space-x-2">
              <Button type="button" variant="outline" onClick={() => setDocDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" className="text-white" style={{ background: 'linear-gradient(135deg, #C23616 0%, #E84118 50%, #FFA502 100%)' }}>
                Add
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ProjectView;
