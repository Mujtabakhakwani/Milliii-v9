import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Progress } from '../components/ui/progress';
import { Textarea } from '../components/ui/textarea';
import { toast } from 'sonner';
import { 
  ArrowLeft, Edit, Save, X, Calendar, DollarSign, 
  Users, Briefcase, Phone, Mail, User, Clock, LogOut,
  Plus, CheckSquare, FileText, Link2, Video, Package,
  Archive, ArchiveRestore, Trash2, ExternalLink, 
  LayoutGrid, List as ListIcon, Table2, Flag
} from 'lucide-react';
import { BACKEND_URL, API_URL } from '../config';

const API = API_URL;

const KANBAN_COLUMNS = [
  { id: 'Getting Started', title: 'Getting Started' },
  { id: 'Onetime Setup', title: 'Onetime Setup' },
  { id: 'Agency Setup', title: 'Agency Setup' },
  { id: 'Service', title: 'Service' },
  { id: 'Under Review', title: 'Under Review' },
  { id: 'Completed', title: 'Completed' }
];

const TASK_STATUSES = ['Not Started', 'In Progress', 'Under Review', 'Completed'];

const ProjectViewNew = ({ currentUser, onLogout }) => {
  const { projectId } = useParams();
  const navigate = useNavigate();
  
  // State
  const [project, setProject] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [internalNotes, setInternalNotes] = useState([]);
  const [usefulLinks, setUsefulLinks] = useState([]);
  const [meetingNotes, setMeetingNotes] = useState([]);
  const [deliverables, setDeliverables] = useState([]);
  const [users, setUsers] = useState([]);
  const [guestLink, setGuestLink] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showArchived, setShowArchived] = useState(false);
  const [taskViewType, setTaskViewType] = useState('list'); // 'kanban', 'list', 'table'
  const [ghlIntegrationActive, setGhlIntegrationActive] = useState(false);
  const [syncingToGHL, setSyncingToGHL] = useState(false);
  const [editingTaskIdInline, setEditingTaskIdInline] = useState(null);
  const [editingFieldInline, setEditingFieldInline] = useState(null);
  
  // Edit states
  const [editingField, setEditingField] = useState(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [tempProject, setTempProject] = useState(null);
  
  // Task dialog states
  const [taskDialogOpen, setTaskDialogOpen] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [newTask, setNewTask] = useState({
    title: '',
    description: '',
    assignee: '',
    due_date: '',
    priority: 'Medium',
    status: 'Not Started'
  });
  
  // Internal Note dialog states
  const [noteDialogOpen, setNoteDialogOpen] = useState(false);
  const [editingNote, setEditingNote] = useState(null);
  const [noteContent, setNoteContent] = useState('');
  
  // Useful Link dialog states
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [editingLink, setEditingLink] = useState(null);
  const [newLink, setNewLink] = useState({ name: '', url: '', description: '' });
  
  // Meeting Note dialog states
  const [meetingDialogOpen, setMeetingDialogOpen] = useState(false);
  const [editingMeeting, setEditingMeeting] = useState(null);
  const [newMeeting, setNewMeeting] = useState({
    meeting_name: '',
    meeting_date: '',
    summary: '',
    recording_link: ''
  });
  
  // Deliverable dialog states
  const [deliverableDialogOpen, setDeliverableDialogOpen] = useState(false);
  const [newDeliverable, setNewDeliverable] = useState({
    title: '',
    url: '',
    description: ''
  });

  useEffect(() => {
    fetchData();
  }, [projectId]);

  const fetchData = async () => {
    try {
      setLoading(true);
      
      // OPTIMIZED: Single API call to fetch all project data
      const response = await axios.get(`${API}/projects/${projectId}/full-data`);
      const data = response.data;
      
      // Set all data from single response
      setProject(data.project);
      setTempProject(data.project);
      setTasks(data.tasks || []);
      setUsers(data.users || []);
      setInternalNotes(data.internal_notes || []);
      setUsefulLinks(data.useful_links || []);
      setMeetingNotes(data.meeting_notes || []);
      setDeliverables(data.deliverables || []);
      setGuestLink(data.guest_link || null);
      setGhlIntegrationActive(data.ghl_integration_active || false);
      
      setLoading(false);
    } catch (error) {
      toast.error('Failed to load project');
      setLoading(false);
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

  // ============ GHL INTEGRATION ============
  // Note: GHL integration status is now fetched with project data for better performance

  const handleSyncToGHL = async () => {
    setSyncingToGHL(true);
    try {
      const response = await axios.post(`${API}/projects/${projectId}/sync-to-ghl`);
      toast.success('Project data synced to GoHighLevel successfully!');
    } catch (error) {
      if (error.response?.status === 400 && error.response?.data?.detail?.includes('webhook URL not configured')) {
        toast.error('Please configure GHL webhook URL in Settings → Integrations first');
      } else {
        toast.error(error.response?.data?.detail || 'Failed to sync to GoHighLevel');
      }
      console.error('GHL sync error:', error);
    } finally {
      setSyncingToGHL(false);
    }
  };

  // ============ PROJECT HANDLERS ============
  
  const handleInlineEdit = (field) => {
    setEditingField(field);
  };

  const handleSaveInline = async (field, value) => {
    try {
      await axios.put(`${API}/projects/${projectId}`, { [field]: value });
      setProject({ ...project, [field]: value });
      setEditingField(null);
      toast.success('Updated successfully!');
    } catch (error) {
      toast.error('Failed to update');
    }
  };

  const handleCancelInline = () => {
    setEditingField(null);
  };

  const handleOpenEditDialog = () => {
    setTempProject({ ...project });
    setEditDialogOpen(true);
  };

  const handleSaveDialog = async () => {
    try {
      await axios.put(`${API}/projects/${projectId}`, tempProject);
      setProject(tempProject);
      setEditDialogOpen(false);
      toast.success('Project updated successfully!');
      fetchData();
    } catch (error) {
      toast.error('Failed to update project');
    }
  };

  // ============ TASK HANDLERS ============
  
  const handleCreateTask = async (e) => {
    e.preventDefault();
    try {
      if (editingTask) {
        // Update existing task
        await axios.put(`${API}/tasks/${editingTask.id}`, newTask);
        toast.success('Task updated!');
      } else {
        // Create new task
        await axios.post(`${API}/tasks`, { ...newTask, project_id: projectId });
        toast.success('Task created!');
      }
      setTaskDialogOpen(false);
      setEditingTask(null);
      setNewTask({
        title: '',
        description: '',
        assignee: '',
        due_date: '',
        priority: 'Medium',
        status: 'Not Started'
      });
      fetchData();
    } catch (error) {
      toast.error(editingTask ? 'Failed to update task' : 'Failed to create task');
    }
  };
  
  const openEditTask = (task) => {
    setEditingTask(task);
    setNewTask({
      title: task.title,
      description: task.description || '',
      assignee: task.assignee || '',
      due_date: task.due_date || '',
      priority: task.priority,
      status: task.status
    });
    setTaskDialogOpen(true);
  };
  
  const openNewTask = () => {
    setEditingTask(null);
    setNewTask({
      title: '',
      description: '',
      assignee: '',
      due_date: '',
      priority: 'Medium',
      status: 'Not Started'
    });
    setTaskDialogOpen(true);
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
      fetchData();
    } catch (error) {
      console.error('Drag error:', error);
      toast.error('Failed to update task status');
    }
  };
  
  const handleArchiveTask = async (taskId) => {
    try {
      await axios.put(`${API}/tasks/${taskId}`, { archived: true });
      toast.success('Task archived!');
      fetchData();
    } catch (error) {
      toast.error('Failed to archive task');
    }
  };
  
  const handleUnarchiveTask = async (taskId) => {
    try {
      await axios.put(`${API}/tasks/${taskId}`, { archived: false });
      toast.success('Task restored!');
      fetchData();
    } catch (error) {
      toast.error('Failed to restore task');
    }
  };
  
  const handleDeleteTask = async (taskId) => {
    if (!window.confirm('Are you sure you want to delete this task?')) return;
    try {
      await axios.delete(`${API}/tasks/${taskId}`);
      toast.success('Task deleted!');
      fetchData();
    } catch (error) {
      toast.error('Failed to delete task');
    }
  };
  
  const handleInlineEditTask = (taskId, field, value) => {
    setEditingTaskIdInline(taskId);
    setEditingFieldInline({ field, value });
  };
  
  const handleSaveInlineEditTask = async (taskId, field, value) => {
    try {
      await axios.put(`${API}/tasks/${taskId}`, { [field]: value });
      toast.success('Task updated!');
      setEditingTaskIdInline(null);
      setEditingFieldInline(null);
      fetchData();
    } catch (error) {
      toast.error('Failed to update task');
    }
  };

  // ============ INTERNAL NOTE HANDLERS ============
  
  const handleCreateNote = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API}/internal-notes`, { 
        project_id: projectId, 
        content: noteContent 
      });
      toast.success('Note created!');
      setNoteDialogOpen(false);
      setNoteContent('');
      fetchData();
    } catch (error) {
      toast.error('Failed to create note');
    }
  };
  
  const handleUpdateNote = async (e) => {
    e.preventDefault();
    try {
      await axios.put(`${API}/internal-notes/${editingNote.id}?content=${encodeURIComponent(noteContent)}`);
      toast.success('Note updated!');
      setNoteDialogOpen(false);
      setEditingNote(null);
      setNoteContent('');
      fetchData();
    } catch (error) {
      toast.error('Failed to update note');
    }
  };
  
  const handleDeleteNote = async (noteId) => {
    if (!window.confirm('Are you sure you want to delete this note?')) return;
    try {
      await axios.delete(`${API}/internal-notes/${noteId}`);
      toast.success('Note deleted!');
      fetchData();
    } catch (error) {
      toast.error('Failed to delete note');
    }
  };
  
  const openEditNote = (note) => {
    setEditingNote(note);
    setNoteContent(note.content);
    setNoteDialogOpen(true);
  };

  // ============ USEFUL LINK HANDLERS ============
  
  const handleCreateLink = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API}/useful-links`, { 
        project_id: projectId, 
        ...newLink 
      });
      toast.success('Link created!');
      setLinkDialogOpen(false);
      setNewLink({ name: '', url: '', description: '' });
      fetchData();
    } catch (error) {
      toast.error('Failed to create link');
    }
  };
  
  const handleUpdateLink = async (e) => {
    e.preventDefault();
    try {
      await axios.put(`${API}/useful-links/${editingLink.id}`, newLink);
      toast.success('Link updated!');
      setLinkDialogOpen(false);
      setEditingLink(null);
      setNewLink({ name: '', url: '', description: '' });
      fetchData();
    } catch (error) {
      toast.error('Failed to update link');
    }
  };
  
  const handleDeleteLink = async (linkId) => {
    if (!window.confirm('Are you sure you want to delete this link?')) return;
    try {
      await axios.delete(`${API}/useful-links/${linkId}`);
      toast.success('Link deleted!');
      fetchData();
    } catch (error) {
      toast.error('Failed to delete link');
    }
  };
  
  const openEditLink = (link) => {
    setEditingLink(link);
    setNewLink({ name: link.name, url: link.url, description: link.description || '' });
    setLinkDialogOpen(true);
  };

  // ============ MEETING NOTE HANDLERS ============
  
  const handleCreateMeeting = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API}/meeting-notes`, { 
        project_id: projectId, 
        ...newMeeting 
      });
      toast.success('Meeting note created!');
      setMeetingDialogOpen(false);
      setNewMeeting({
        meeting_name: '',
        meeting_date: '',
        summary: '',
        recording_link: ''
      });
      fetchData();
    } catch (error) {
      toast.error('Failed to create meeting note');
    }
  };
  
  const handleUpdateMeeting = async (e) => {
    e.preventDefault();
    try {
      await axios.put(`${API}/meeting-notes/${editingMeeting.id}`, newMeeting);
      toast.success('Meeting note updated!');
      setMeetingDialogOpen(false);
      setEditingMeeting(null);
      setNewMeeting({
        meeting_name: '',
        meeting_date: '',
        summary: '',
        recording_link: ''
      });
      fetchData();
    } catch (error) {
      toast.error('Failed to update meeting note');
    }
  };
  
  const handleDeleteMeeting = async (meetingId) => {
    if (!window.confirm('Are you sure you want to delete this meeting note?')) return;
    try {
      await axios.delete(`${API}/meeting-notes/${meetingId}`);
      toast.success('Meeting note deleted!');
      fetchData();
    } catch (error) {
      toast.error('Failed to delete meeting note');
    }
  };
  
  const openEditMeeting = (meeting) => {
    setEditingMeeting(meeting);
    setNewMeeting({
      meeting_name: meeting.meeting_name,
      meeting_date: meeting.meeting_date,
      summary: meeting.summary,
      recording_link: meeting.recording_link || ''
    });
    setMeetingDialogOpen(true);
  };

  // ============ DELIVERABLE HANDLERS ============
  
  const handleCreateDeliverable = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API}/documents`, { 
        project_id: projectId, 
        type: 'deliverables',
        ...newDeliverable 
      });
      toast.success('Deliverable created!');
      setDeliverableDialogOpen(false);
      setNewDeliverable({ title: '', url: '', description: '' });
      fetchData();
    } catch (error) {
      toast.error('Failed to create deliverable');
    }
  };
  
  const handleDeleteDeliverable = async (docId) => {
    if (!window.confirm('Are you sure you want to delete this deliverable?')) return;
    try {
      await axios.delete(`${API}/documents/${docId}`);
      toast.success('Deliverable deleted!');
      fetchData();
    } catch (error) {
      toast.error('Failed to delete deliverable');
    }
  };

  // ============ HELPER FUNCTIONS ============
  
  const getProjectProgress = () => {
    if (tasks.length === 0) return 0;
    const completed = tasks.filter(t => t.status === 'Completed').length;
    return Math.round((completed / tasks.length) * 100);
  };

  const getDaysElapsed = () => {
    if (!project?.start_date) return 0;
    const start = new Date(project.start_date);
    const now = new Date();
    const diffTime = Math.abs(now - start);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const getOwnerName = () => {
    const owner = users.find(u => u.id === project?.project_owner);
    return owner?.name || 'Unassigned';
  };

  const getTeamMemberNames = () => {
    if (!project?.team_members || project.team_members.length === 0) return [];
    return users.filter(u => project.team_members.includes(u.id));
  };
  
  const getAssigneeName = (assigneeId) => {
    if (!assigneeId) return 'Unassigned';
    const user = users.find(u => u.id === assigneeId);
    return user?.name || 'Unknown';
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
  
  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'High':
        return 'bg-red-100 text-red-700';
      case 'Medium':
        return 'bg-yellow-100 text-yellow-700';
      default:
        return 'bg-green-100 text-green-700';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-lg">Project not found</div>
      </div>
    );
  }

  const progress = getProjectProgress();
  const daysElapsed = getDaysElapsed();
  const teamMembers = getTeamMemberNames();
  const filteredTasks = tasks.filter(t => showArchived ? t.archived : !t.archived);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Page Header with Guest Link Button */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <Button variant="ghost" onClick={() => navigate('/projects')} className="mb-2">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Projects
            </Button>
            <h1 className="text-3xl font-bold text-gray-800 dark:text-white">{project.name}</h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">{project.company_name || project.business_name}</p>
          </div>
          <div className="flex items-center space-x-4">
            {ghlIntegrationActive && (
              <Button
                onClick={handleSyncToGHL}
                disabled={syncingToGHL}
                variant="outline"
                className="border-green-600 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20"
              >
                <ExternalLink className="w-4 h-4 mr-2" />
                {syncingToGHL ? 'Syncing...' : 'Sync with GHL'}
              </Button>
            )}
            {!guestLink ? (
              <Button
                onClick={handleGenerateGuestLink}
                className="text-white"
                style={{ background: 'linear-gradient(135deg, #C23616 0%, #E84118 50%, #FFA502 100%)' }}
              >
                <Users className="w-4 h-4 mr-2" />
                Generate Guest Link
              </Button>
            ) : (
              <Button
                onClick={copyGuestLink}
                variant="outline"
              >
                <Users className="w-4 h-4 mr-2" />
                Copy Guest Link
              </Button>
            )}
          </div>
        </div>

        {/* Project Overview Section */}
        <Card className="mb-8 bg-white/50 dark:bg-gray-800/50 backdrop-blur-lg border-gray-200 dark:border-gray-700">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Project Overview</CardTitle>
            <Button 
              variant="outline" 
              size="sm"
              onClick={handleOpenEditDialog}
            >
              <Edit className="w-4 h-4 mr-2" />
              Edit All
            </Button>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {/* Project Name */}
              <div>
                <label className="text-sm text-gray-500 mb-1 block">Project Name</label>
                {editingField === 'name' ? (
                  <div className="flex items-center space-x-2">
                    <Input
                      value={project.name}
                      onChange={(e) => setProject({ ...project, name: e.target.value })}
                      className="flex-1"
                      autoFocus
                    />
                    <Button size="sm" onClick={() => handleSaveInline('name', project.name)}>
                      <Save className="w-4 h-4" />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={handleCancelInline}>
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                ) : (
                  <div 
                    className="flex items-center justify-between p-2 rounded hover:bg-gray-50 cursor-pointer"
                    onClick={() => handleInlineEdit('name')}
                  >
                    <span className="font-medium">{project.name}</span>
                    <Edit className="w-4 h-4 text-gray-400" />
                  </div>
                )}
              </div>

              {/* Client Name */}
              <div>
                <label className="text-sm text-gray-500 mb-1 block">Client Name</label>
                <div className="p-2 rounded bg-gray-50">
                  <span className="font-medium">{project.client_name}</span>
                </div>
              </div>

              {/* Business Name */}
              <div>
                <label className="text-sm text-gray-500 mb-1 block">Business Name</label>
                <div className="p-2 rounded bg-gray-50">
                  <span className="font-medium">{project.business_name || 'Not set'}</span>
                </div>
              </div>

              {/* Client Email */}
              <div>
                <label className="text-sm text-gray-500 mb-1 block flex items-center">
                  <Mail className="w-4 h-4 mr-1" />
                  Client Email
                </label>
                <div className="p-2 rounded bg-gray-50">
                  <span className="font-medium text-blue-600">{project.client_email || 'Not set'}</span>
                </div>
              </div>

              {/* Client Phone */}
              <div>
                <label className="text-sm text-gray-500 mb-1 block flex items-center">
                  <Phone className="w-4 h-4 mr-1" />
                  Client Phone
                </label>
                <div className="p-2 rounded bg-gray-50">
                  <span className="font-medium">{project.client_phone || 'Not set'}</span>
                </div>
              </div>

              {/* Budget */}
              <div>
                <label className="text-sm text-gray-500 mb-1 block flex items-center">
                  <DollarSign className="w-4 h-4 mr-1" />
                  Budget
                </label>
                <div className="p-2 rounded bg-gray-50">
                  <span className="font-medium">${project.budget || 0}</span>
                </div>
              </div>

              {/* Start Date */}
              <div>
                <label className="text-sm text-gray-500 mb-1 block flex items-center">
                  <Calendar className="w-4 h-4 mr-1" />
                  Start Date
                </label>
                <div className="p-2 rounded bg-gray-50">
                  <span className="font-medium">{project.start_date || 'Not set'}</span>
                </div>
              </div>

              {/* End Date */}
              <div>
                <label className="text-sm text-gray-500 mb-1 block flex items-center">
                  <Calendar className="w-4 h-4 mr-1" />
                  End Date
                </label>
                <div className="p-2 rounded bg-gray-50">
                  <span className="font-medium">{project.end_date || 'Not set'}</span>
                </div>
              </div>

              {/* Status */}
              <div>
                <label className="text-sm text-gray-500 mb-1 block">Project Status</label>
                <div className="p-2 rounded bg-gray-50">
                  <span className="px-3 py-1 rounded-full text-sm bg-blue-100 text-blue-800">
                    {project.status}
                  </span>
                </div>
              </div>

              {/* Project Owner */}
              <div>
                <label className="text-sm text-gray-500 mb-1 block flex items-center">
                  <User className="w-4 h-4 mr-1" />
                  Project Owner
                </label>
                <div className="p-2 rounded bg-gray-50">
                  <span className="font-medium">{getOwnerName()}</span>
                </div>
              </div>

              {/* Team Members */}
              <div className="md:col-span-2">
                <label className="text-sm text-gray-500 mb-1 block flex items-center">
                  <Users className="w-4 h-4 mr-1" />
                  Team Members ({teamMembers.length})
                </label>
                <div className="flex flex-wrap gap-2 p-2 rounded bg-gray-50">
                  {teamMembers.length > 0 ? teamMembers.map(member => (
                    <div key={member.id} className="flex items-center space-x-2 bg-white px-3 py-1 rounded-full border">
                      <div className="w-6 h-6 rounded-full bg-gradient-to-r from-orange-500 to-red-500 flex items-center justify-center text-white text-xs font-semibold">
                        {member.name.split(' ').map(n => n[0]).join('').toUpperCase()}
                      </div>
                      <span className="text-sm font-medium">{member.name}</span>
                    </div>
                  )) : (
                    <span className="text-sm text-gray-500">No team members assigned</span>
                  )}
                </div>
              </div>

              {/* Timer */}
              <div>
                <label className="text-sm text-gray-500 mb-1 block flex items-center">
                  <Clock className="w-4 h-4 mr-1" />
                  Time Elapsed
                </label>
                <div className="p-2 rounded bg-gray-50">
                  <span className="font-medium text-lg">Day {daysElapsed}</span>
                </div>
              </div>

              {/* Progress */}
              <div className="md:col-span-2">
                <label className="text-sm text-gray-500 mb-1 block">Progress</label>
                <div className="p-2 rounded bg-gray-50">
                  <div className="flex items-center space-x-4">
                    <Progress value={progress} className="flex-1 h-3" />
                    <span className="font-semibold text-lg">{progress}%</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    {tasks.filter(t => t.status === 'Completed').length} of {tasks.length} tasks completed
                  </p>
                </div>
              </div>
            </div>

            {/* Notes/Description */}
            {project.description && (
              <div className="mt-6">
                <label className="text-sm text-gray-500 mb-1 block">Project Notes</label>
                <div className="p-4 rounded bg-gray-50 border">
                  <p className="text-sm text-gray-700">{project.description}</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Tasks Section */}
        <Card className="mb-8">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <CheckSquare className="w-5 h-5 text-orange-600" />
                <CardTitle>Tasks ({filteredTasks.length})</CardTitle>
              </div>
              <div className="flex items-center space-x-2">
                {/* View Switcher */}
                <div className="flex items-center space-x-1 bg-gray-100 p-1 rounded-lg mr-2">
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
                
                <Button
                  variant={showArchived ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setShowArchived(!showArchived)}
                >
                  {showArchived ? <ArchiveRestore className="w-4 h-4 mr-2" /> : <Archive className="w-4 h-4 mr-2" />}
                  {showArchived ? 'Active' : 'Archived'}
                </Button>
                <Button
                  size="sm"
                  onClick={openNewTask}
                  className="text-white"
                  style={{ background: 'linear-gradient(135deg, #C23616 0%, #E84118 50%, #FFA502 100%)' }}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  New
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {filteredTasks.length === 0 ? (
              <p className="text-center text-gray-500 py-8">
                {showArchived ? 'No archived tasks' : 'No tasks yet. Click "New" to create one.'}
              </p>
            ) : (
              <>
                {/* List View */}
                {taskViewType === 'list' && (
                  <div className="space-y-1.5">
                    {filteredTasks.map((task) => (
                      <div
                        key={task.id}
                        className="flex items-center justify-between p-4 bg-white border rounded-lg hover:shadow-sm transition-shadow"
                      >
                        <div className="flex items-center space-x-4 flex-1">
                          <FileText className="w-5 h-5 text-gray-400" />
                          <div className="flex-1">
                            {editingTaskIdInline === task.id && editingFieldInline?.field === 'title' ? (
                              <input
                                type="text"
                                className="font-medium text-sm border rounded px-2 py-1 w-full"
                                defaultValue={task.title}
                                autoFocus
                                onBlur={(e) => handleSaveInlineEditTask(task.id, 'title', e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') handleSaveInlineEditTask(task.id, 'title', e.target.value);
                                  if (e.key === 'Escape') { setEditingTaskIdInline(null); setEditingFieldInline(null); }
                                }}
                              />
                            ) : (
                              <h4 
                                className="font-medium text-sm cursor-pointer hover:text-blue-600"
                                onClick={() => handleInlineEditTask(task.id, 'title', task.title)}
                              >
                                {task.title}
                              </h4>
                            )}
                            {task.description && (
                              editingTaskIdInline === task.id && editingFieldInline?.field === 'description' ? (
                                <textarea
                                  className="text-xs text-gray-500 mt-1 border rounded px-2 py-1 w-full"
                                  defaultValue={task.description}
                                  autoFocus
                                  onBlur={(e) => handleSaveInlineEditTask(task.id, 'description', e.target.value)}
                                  rows={2}
                                />
                              ) : (
                                <p 
                                  className="text-xs text-gray-500 mt-1 cursor-pointer hover:text-blue-600"
                                  onClick={() => handleInlineEditTask(task.id, 'description', task.description)}
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
                            {editingTaskIdInline === task.id && editingFieldInline?.field === 'status' ? (
                              <select
                                className="text-sm text-gray-700 border rounded px-2 py-1"
                                defaultValue={task.status}
                                autoFocus
                                onBlur={(e) => handleSaveInlineEditTask(task.id, 'status', e.target.value)}
                                onChange={(e) => handleSaveInlineEditTask(task.id, 'status', e.target.value)}
                              >
                                {TASK_STATUSES.map(status => (
                                  <option key={status} value={status}>{status}</option>
                                ))}
                              </select>
                            ) : (
                              <span 
                                className="text-sm text-gray-700 cursor-pointer hover:text-blue-600"
                                onClick={() => handleInlineEditTask(task.id, 'status', task.status)}
                              >
                                {task.status}
                              </span>
                            )}
                          </div>
                          {editingTaskIdInline === task.id && editingFieldInline?.field === 'due_date' ? (
                            <input
                              type="date"
                              className="text-sm text-gray-500 border rounded px-2 py-1"
                              defaultValue={task.due_date}
                              autoFocus
                              onBlur={(e) => handleSaveInlineEditTask(task.id, 'due_date', e.target.value)}
                              onChange={(e) => handleSaveInlineEditTask(task.id, 'due_date', e.target.value)}
                            />
                          ) : task.due_date ? (
                            <span 
                              className="text-sm text-gray-500 cursor-pointer hover:text-blue-600"
                              onClick={() => handleInlineEditTask(task.id, 'due_date', task.due_date)}
                            >
                              {new Date(task.due_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                            </span>
                          ) : (
                            <span 
                              className="text-sm text-gray-400 cursor-pointer hover:text-blue-600"
                              onClick={() => handleInlineEditTask(task.id, 'due_date', '')}
                            >
                              Add date
                            </span>
                          )}
                          <span className={`text-xs px-3 py-1 rounded-full ${getPriorityColor(task.priority)}`}>
                            {getAssigneeName(task.assignee)}
                          </span>
                          <div className="flex items-center space-x-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openEditTask(task)}
                              title="Edit in dialog"
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                            {showArchived ? (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleUnarchiveTask(task.id)}
                              >
                                <ArchiveRestore className="w-4 h-4" />
                              </Button>
                            ) : (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleArchiveTask(task.id)}
                              >
                                <Archive className="w-4 h-4" />
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteTask(task.id)}
                              className="text-red-600"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
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
                        const statusTasks = filteredTasks.filter(t => t.status === status);
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
                                <div className="space-y-2">
                                  {statusTasks.map((task, index) => (
                                    <Draggable
                                      key={task.id}
                                      draggableId={task.id}
                                      index={index}
                                      isDragDisabled={showArchived}
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
                                            <span className="text-gray-600">{getAssigneeName(task.assignee)}</span>
                                            <span className={`px-2 py-0.5 rounded text-xs ${getPriorityColor(task.priority)}`}>
                                              {task.priority}
                                            </span>
                                          </div>
                                          {task.due_date && (
                                            <div className="text-xs text-gray-500 mb-2">
                                              Due: {new Date(task.due_date).toLocaleDateString()}
                                            </div>
                                          )}
                                          <div className="flex items-center space-x-1 mt-2 pt-2 border-t">
                                            <Button
                                              variant="ghost"
                                              size="sm"
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                openEditTask(task);
                                              }}
                                              className="text-xs h-7"
                                            >
                                              <Edit className="w-3 h-3" />
                                            </Button>
                                          </div>
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
                            Team Member
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {filteredTasks.map((task) => (
                          <tr key={task.id} className="hover:bg-gray-50">
                            <td className="px-4 py-4">
                              <div className="flex items-center space-x-3">
                                <FileText className="w-5 h-5 text-gray-400 flex-shrink-0" />
                                <div className="flex-1">
                                  {editingTaskIdInline === task.id && editingFieldInline?.field === 'title' ? (
                                    <input
                                      type="text"
                                      className="text-sm font-medium text-gray-900 border rounded px-2 py-1 w-full"
                                      defaultValue={task.title}
                                      autoFocus
                                      onBlur={(e) => handleSaveInlineEditTask(task.id, 'title', e.target.value)}
                                      onKeyDown={(e) => {
                                        if (e.key === 'Enter') handleSaveInlineEditTask(task.id, 'title', e.target.value);
                                        if (e.key === 'Escape') { setEditingTaskIdInline(null); setEditingFieldInline(null); }
                                      }}
                                    />
                                  ) : (
                                    <div 
                                      className="text-sm font-medium text-gray-900 cursor-pointer hover:text-blue-600"
                                      onClick={() => handleInlineEditTask(task.id, 'title', task.title)}
                                    >
                                      {task.title}
                                    </div>
                                  )}
                                  {task.description && (
                                    editingTaskIdInline === task.id && editingFieldInline?.field === 'description' ? (
                                      <textarea
                                        className="text-xs text-gray-500 mt-1 border rounded px-2 py-1 w-full"
                                        defaultValue={task.description}
                                        autoFocus
                                        onBlur={(e) => handleSaveInlineEditTask(task.id, 'description', e.target.value)}
                                        rows={2}
                                      />
                                    ) : (
                                      <div 
                                        className="text-xs text-gray-500 mt-1 line-clamp-1 cursor-pointer hover:text-blue-600"
                                        onClick={() => handleInlineEditTask(task.id, 'description', task.description)}
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
                                {editingTaskIdInline === task.id && editingFieldInline?.field === 'status' ? (
                                  <select
                                    className="text-sm text-gray-700 border rounded px-2 py-1"
                                    defaultValue={task.status}
                                    autoFocus
                                    onBlur={(e) => handleSaveInlineEditTask(task.id, 'status', e.target.value)}
                                    onChange={(e) => handleSaveInlineEditTask(task.id, 'status', e.target.value)}
                                  >
                                    {TASK_STATUSES.map(status => (
                                      <option key={status} value={status}>{status}</option>
                                    ))}
                                  </select>
                                ) : (
                                  <span 
                                    className="text-sm text-gray-700 cursor-pointer hover:text-blue-600"
                                    onClick={() => handleInlineEditTask(task.id, 'status', task.status)}
                                  >
                                    {task.status}
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">
                              {editingTaskIdInline === task.id && editingFieldInline?.field === 'due_date' ? (
                                <input
                                  type="date"
                                  className="text-sm text-gray-500 border rounded px-2 py-1"
                                  defaultValue={task.due_date}
                                  autoFocus
                                  onBlur={(e) => handleSaveInlineEditTask(task.id, 'due_date', e.target.value)}
                                  onChange={(e) => handleSaveInlineEditTask(task.id, 'due_date', e.target.value)}
                                />
                              ) : task.due_date ? (
                                <span 
                                  className="cursor-pointer hover:text-blue-600"
                                  onClick={() => handleInlineEditTask(task.id, 'due_date', task.due_date)}
                                >
                                  {new Date(task.due_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                                </span>
                              ) : (
                                <span 
                                  className="text-gray-400 cursor-pointer hover:text-blue-600"
                                  onClick={() => handleInlineEditTask(task.id, 'due_date', '')}
                                >
                                  Add date
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-4 whitespace-nowrap">
                              <span className={`text-xs px-3 py-1.5 rounded-full font-medium ${getPriorityColor(task.priority)}`}>
                                {getAssigneeName(task.assignee)}
                              </span>
                            </td>
                            <td className="px-4 py-4 whitespace-nowrap text-sm">
                              <div className="flex items-center space-x-2">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => openEditTask(task)}
                                  title="Edit in dialog"
                                >
                                  <Edit className="w-4 h-4" />
                                </Button>
                                {showArchived ? (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleUnarchiveTask(task.id)}
                                  >
                                    <ArchiveRestore className="w-4 h-4" />
                                  </Button>
                                ) : (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleArchiveTask(task.id)}
                                  >
                                    <Archive className="w-4 h-4" />
                                  </Button>
                                )}
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleDeleteTask(task.id)}
                                  className="text-red-600"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </div>
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

        {/* Internal Notes Section */}
        <Card className="mb-8">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <FileText className="w-5 h-5 text-orange-600" />
                <CardTitle>Internal Notes ({internalNotes.length})</CardTitle>
              </div>
              <Button
                size="sm"
                onClick={() => {
                  setEditingNote(null);
                  setNoteContent('');
                  setNoteDialogOpen(true);
                }}
                className="text-white"
                style={{ background: 'linear-gradient(135deg, #C23616 0%, #E84118 50%, #FFA502 100%)' }}
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Note
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {internalNotes.length === 0 ? (
              <p className="text-center text-gray-500 py-8">No internal notes yet.</p>
            ) : (
              <div className="space-y-3">
                {internalNotes.map(note => (
                  <div key={note.id} className="border rounded-lg p-4 bg-white">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <p className="text-sm text-gray-700 whitespace-pre-wrap">{note.content}</p>
                        <p className="text-xs text-gray-400 mt-2">
                          Created: {new Date(note.created_at).toLocaleString()}
                        </p>
                      </div>
                      <div className="flex items-center space-x-1 ml-4">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openEditNote(note)}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteNote(note.id)}
                          className="text-red-600"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Useful Links Section */}
        <Card className="mb-8">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <Link2 className="w-5 h-5 text-orange-600" />
                <CardTitle>Useful Links ({usefulLinks.length})</CardTitle>
              </div>
              <Button
                size="sm"
                onClick={() => {
                  setEditingLink(null);
                  setNewLink({ name: '', url: '', description: '' });
                  setLinkDialogOpen(true);
                }}
                className="text-white"
                style={{ background: 'linear-gradient(135deg, #C23616 0%, #E84118 50%, #FFA502 100%)' }}
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Link
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {usefulLinks.length === 0 ? (
              <p className="text-center text-gray-500 py-8">No useful links yet.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {usefulLinks.map(link => (
                  <div key={link.id} className="border rounded-lg p-4 bg-white hover:shadow-md transition-shadow">
                    <div className="flex items-start justify-between mb-2">
                      <h4 className="font-medium text-sm">{link.name}</h4>
                      <div className="flex items-center space-x-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openEditLink(link)}
                        >
                          <Edit className="w-3 h-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteLink(link.id)}
                          className="text-red-600"
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                    {link.description && (
                      <p className="text-xs text-gray-500 mb-2">{link.description}</p>
                    )}
                    <a
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-blue-600 hover:underline flex items-center"
                    >
                      <ExternalLink className="w-3 h-3 mr-1" />
                      Open Link
                    </a>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Meeting Notes Section */}
        <Card className="mb-8">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <Video className="w-5 h-5 text-orange-600" />
                <CardTitle>Meeting Notes ({meetingNotes.length})</CardTitle>
              </div>
              <Button
                size="sm"
                onClick={() => {
                  setEditingMeeting(null);
                  setNewMeeting({
                    meeting_name: '',
                    meeting_date: '',
                    summary: '',
                    recording_link: ''
                  });
                  setMeetingDialogOpen(true);
                }}
                className="text-white"
                style={{ background: 'linear-gradient(135deg, #C23616 0%, #E84118 50%, #FFA502 100%)' }}
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Meeting
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {meetingNotes.length === 0 ? (
              <p className="text-center text-gray-500 py-8">No meeting notes yet.</p>
            ) : (
              <div className="space-y-3">
                {meetingNotes.map(meeting => (
                  <div key={meeting.id} className="border rounded-lg p-4 bg-white">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <h4 className="font-semibold text-base">{meeting.meeting_name}</h4>
                        <p className="text-xs text-gray-500">
                          {new Date(meeting.meeting_date).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="flex items-center space-x-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openEditMeeting(meeting)}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteMeeting(meeting.id)}
                          className="text-red-600"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                    <p className="text-sm text-gray-700 mb-2 whitespace-pre-wrap">{meeting.summary}</p>
                    {meeting.recording_link && (
                      <a
                        href={meeting.recording_link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-blue-600 hover:underline flex items-center"
                      >
                        <Video className="w-3 h-3 mr-1" />
                        View Recording
                      </a>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Deliverables Section */}
        <Card className="mb-8">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <Package className="w-5 h-5 text-orange-600" />
                <CardTitle>Deliverables ({deliverables.length})</CardTitle>
              </div>
              <Button
                size="sm"
                onClick={() => {
                  setNewDeliverable({ title: '', url: '', description: '' });
                  setDeliverableDialogOpen(true);
                }}
                className="text-white"
                style={{ background: 'linear-gradient(135deg, #C23616 0%, #E84118 50%, #FFA502 100%)' }}
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Deliverable
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {deliverables.length === 0 ? (
              <p className="text-center text-gray-500 py-8">No deliverables yet.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {deliverables.map(doc => (
                  <div key={doc.id} className="border rounded-lg p-4 bg-white hover:shadow-md transition-shadow">
                    <div className="flex items-start justify-between mb-2">
                      <h4 className="font-medium text-sm">{doc.title}</h4>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteDeliverable(doc.id)}
                        className="text-red-600"
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                    {doc.description && (
                      <p className="text-xs text-gray-500 mb-2">{doc.description}</p>
                    )}
                    <a
                      href={doc.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-blue-600 hover:underline flex items-center"
                    >
                      <ExternalLink className="w-3 h-3 mr-1" />
                      View Deliverable
                    </a>
                    {doc.approved_by_guest && (
                      <div className="mt-2 text-xs text-green-600 flex items-center">
                        <CheckSquare className="w-3 h-3 mr-1" />
                        Approved{doc.approved_by && ` by ${doc.approved_by}`}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </main>

      {/* Edit Project Dialog (already implemented above in Project Overview) */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Project Details</DialogTitle>
          </DialogHeader>
          {tempProject && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Project Name</Label>
                  <Input
                    value={tempProject.name}
                    onChange={(e) => setTempProject({ ...tempProject, name: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Business Name</Label>
                  <Input
                    value={tempProject.business_name || ''}
                    onChange={(e) => setTempProject({ ...tempProject, business_name: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Client Name</Label>
                  <Input
                    value={tempProject.client_name}
                    onChange={(e) => setTempProject({ ...tempProject, client_name: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Client Email</Label>
                  <Input
                    value={tempProject.client_email || ''}
                    onChange={(e) => setTempProject({ ...tempProject, client_email: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Client Phone</Label>
                  <Input
                    value={tempProject.client_phone || ''}
                    onChange={(e) => setTempProject({ ...tempProject, client_phone: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Budget</Label>
                  <Input
                    type="number"
                    value={tempProject.budget || 0}
                    onChange={(e) => setTempProject({ ...tempProject, budget: parseFloat(e.target.value) })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Start Date</Label>
                  <Input
                    type="date"
                    value={tempProject.start_date || ''}
                    onChange={(e) => setTempProject({ ...tempProject, start_date: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>End Date</Label>
                  <Input
                    type="date"
                    value={tempProject.end_date || ''}
                    onChange={(e) => setTempProject({ ...tempProject, end_date: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Status</Label>
                  <select
                    value={tempProject.status}
                    onChange={(e) => setTempProject({ ...tempProject, status: e.target.value })}
                    className="w-full p-2 border border-gray-300 rounded-md"
                  >
                    {KANBAN_COLUMNS.map(col => (
                      <option key={col.id} value={col.id}>{col.title}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label>Priority</Label>
                  <select
                    value={tempProject.priority}
                    onChange={(e) => setTempProject({ ...tempProject, priority: e.target.value })}
                    className="w-full p-2 border border-gray-300 rounded-md"
                  >
                    <option value="Low">Low</option>
                    <option value="Medium">Medium</option>
                    <option value="High">High</option>
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Project Owner</Label>
                <select
                  value={tempProject.project_owner || ''}
                  onChange={(e) => setTempProject({ ...tempProject, project_owner: e.target.value })}
                  className="w-full p-2 border border-gray-300 rounded-md"
                >
                  <option value="">Select Owner</option>
                  {users
                    .filter(user => user.name && user.name !== 'Unknown' && user.email)
                    .sort((a, b) => a.name.localeCompare(b.name))
                    .map(user => (
                      <option key={user.id} value={user.id}>{user.name}</option>
                    ))}
                </select>
              </div>

              <div className="space-y-2">
                <Label>Description</Label>
                <textarea
                  value={tempProject.description || ''}
                  onChange={(e) => setTempProject({ ...tempProject, description: e.target.value })}
                  className="w-full p-2 border border-gray-300 rounded-md min-h-[100px]"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-4">
                <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
                  Cancel
                </Button>
                <Button 
                  onClick={handleSaveDialog}
                  className="text-white"
                  style={{ background: 'linear-gradient(135deg, #C23616 0%, #E84118 50%, #FFA502 100%)' }}
                >
                  Save Changes
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Add Task Dialog */}
      <Dialog open={taskDialogOpen} onOpenChange={setTaskDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingTask ? 'Edit Task' : 'Create New Task'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateTask} className="space-y-4">
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
                <Label htmlFor="task-assignee">Assignee</Label>
                <select
                  id="task-assignee"
                  value={newTask.assignee}
                  onChange={(e) => setNewTask({ ...newTask, assignee: e.target.value })}
                  className="w-full p-2 border border-gray-300 rounded-md"
                >
                  <option value="">Unassigned</option>
                  {users
                    .filter(user => user.name && user.name !== 'Unknown' && user.email)
                    .sort((a, b) => a.name.localeCompare(b.name))
                    .map(user => (
                      <option key={user.id} value={user.id}>{user.name}</option>
                    ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="task-due-date">Due Date</Label>
                <Input
                  id="task-due-date"
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
                  className="w-full p-2 border border-gray-300 rounded-md"
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
                  className="w-full p-2 border border-gray-300 rounded-md"
                  value={newTask.status}
                  onChange={(e) => setNewTask({ ...newTask, status: e.target.value })}
                >
                  {TASK_STATUSES.map(status => (
                    <option key={status} value={status}>{status}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex justify-end space-x-2 pt-4">
              <Button type="button" variant="outline" onClick={() => setTaskDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" className="text-white" style={{ background: 'linear-gradient(135deg, #C23616 0%, #E84118 50%, #FFA502 100%)' }}>
                {editingTask ? 'Update Task' : 'Create Task'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Add/Edit Internal Note Dialog */}
      <Dialog open={noteDialogOpen} onOpenChange={setNoteDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingNote ? 'Edit' : 'Create'} Internal Note</DialogTitle>
          </DialogHeader>
          <form onSubmit={editingNote ? handleUpdateNote : handleCreateNote} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="note-content">Note Content *</Label>
              <Textarea
                id="note-content"
                placeholder="Enter your note here..."
                value={noteContent}
                onChange={(e) => setNoteContent(e.target.value)}
                rows={8}
                required
              />
            </div>
            <div className="flex justify-end space-x-2 pt-4">
              <Button type="button" variant="outline" onClick={() => setNoteDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" className="text-white" style={{ background: 'linear-gradient(135deg, #C23616 0%, #E84118 50%, #FFA502 100%)' }}>
                {editingNote ? 'Update' : 'Create'} Note
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Add/Edit Useful Link Dialog */}
      <Dialog open={linkDialogOpen} onOpenChange={setLinkDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingLink ? 'Edit' : 'Create'} Useful Link</DialogTitle>
          </DialogHeader>
          <form onSubmit={editingLink ? handleUpdateLink : handleCreateLink} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="link-name">Link Name *</Label>
              <Input
                id="link-name"
                placeholder="e.g., Project Documentation"
                value={newLink.name}
                onChange={(e) => setNewLink({ ...newLink, name: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="link-url">URL *</Label>
              <Input
                id="link-url"
                type="url"
                placeholder="https://..."
                value={newLink.url}
                onChange={(e) => setNewLink({ ...newLink, url: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="link-description">Description</Label>
              <Textarea
                id="link-description"
                placeholder="Optional description"
                value={newLink.description}
                onChange={(e) => setNewLink({ ...newLink, description: e.target.value })}
                rows={3}
              />
            </div>
            <div className="flex justify-end space-x-2 pt-4">
              <Button type="button" variant="outline" onClick={() => setLinkDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" className="text-white" style={{ background: 'linear-gradient(135deg, #C23616 0%, #E84118 50%, #FFA502 100%)' }}>
                {editingLink ? 'Update' : 'Create'} Link
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Add/Edit Meeting Note Dialog */}
      <Dialog open={meetingDialogOpen} onOpenChange={setMeetingDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingMeeting ? 'Edit' : 'Create'} Meeting Note</DialogTitle>
          </DialogHeader>
          <form onSubmit={editingMeeting ? handleUpdateMeeting : handleCreateMeeting} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="meeting-name">Meeting Name *</Label>
              <Input
                id="meeting-name"
                placeholder="e.g., Weekly Review"
                value={newMeeting.meeting_name}
                onChange={(e) => setNewMeeting({ ...newMeeting, meeting_name: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="meeting-date">Meeting Date *</Label>
              <Input
                id="meeting-date"
                type="date"
                value={newMeeting.meeting_date}
                onChange={(e) => setNewMeeting({ ...newMeeting, meeting_date: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="meeting-summary">Summary *</Label>
              <Textarea
                id="meeting-summary"
                placeholder="Meeting summary and key points"
                value={newMeeting.summary}
                onChange={(e) => setNewMeeting({ ...newMeeting, summary: e.target.value })}
                rows={5}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="recording-link">Recording Link</Label>
              <Input
                id="recording-link"
                type="url"
                placeholder="https://..."
                value={newMeeting.recording_link}
                onChange={(e) => setNewMeeting({ ...newMeeting, recording_link: e.target.value })}
              />
            </div>
            <div className="flex justify-end space-x-2 pt-4">
              <Button type="button" variant="outline" onClick={() => setMeetingDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" className="text-white" style={{ background: 'linear-gradient(135deg, #C23616 0%, #E84118 50%, #FFA502 100%)' }}>
                {editingMeeting ? 'Update' : 'Create'} Meeting Note
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Add Deliverable Dialog */}
      <Dialog open={deliverableDialogOpen} onOpenChange={setDeliverableDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Add Deliverable</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateDeliverable} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="deliverable-title">Title *</Label>
              <Input
                id="deliverable-title"
                placeholder="e.g., Final Design Files"
                value={newDeliverable.title}
                onChange={(e) => setNewDeliverable({ ...newDeliverable, title: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="deliverable-url">URL *</Label>
              <Input
                id="deliverable-url"
                type="url"
                placeholder="https://..."
                value={newDeliverable.url}
                onChange={(e) => setNewDeliverable({ ...newDeliverable, url: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="deliverable-description">Description</Label>
              <Textarea
                id="deliverable-description"
                placeholder="Optional description"
                value={newDeliverable.description}
                onChange={(e) => setNewDeliverable({ ...newDeliverable, description: e.target.value })}
                rows={3}
              />
            </div>
            <div className="flex justify-end space-x-2 pt-4">
              <Button type="button" variant="outline" onClick={() => setDeliverableDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" className="text-white" style={{ background: 'linear-gradient(135deg, #C23616 0%, #E84118 50%, #FFA502 100%)' }}>
                Add Deliverable
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ProjectViewNew;
