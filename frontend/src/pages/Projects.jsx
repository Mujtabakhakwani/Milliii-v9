import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Progress } from '../components/ui/progress';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../components/ui/tooltip';
import { toast } from 'sonner';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import { 
  ArrowLeft, Plus, LayoutGrid, List, Table2, Calendar, 
  Users, Edit, Archive, Download, Clock, Briefcase,
  Phone, DollarSign, User, ArchiveRestore, Trash2,
  FolderOpen, Link as LinkIcon, Video, Package, 
  AlertCircle, CheckCircle, Circle, PlusCircle, X, Check,
  CheckSquare, LayoutList, Edit2, MessageSquare, Loader, Upload, Activity, Eye, Flag
} from 'lucide-react';
import { getUserAvatarColor, getUserInitials } from '../utils/avatarUtils';
import { BACKEND_URL, API_URL } from '../config';
import ProjectVisibilityModal from '../components/ProjectVisibilityModal';
import TaskQuickEditModal from '../components/TaskQuickEditModal';
import TrelloTaskCard from '../components/TrelloTaskCard';
import TrelloTaskModal from '../components/TrelloTaskModal';
import InlineEditDropdown from '../components/InlineEditDropdown';
import InlineEditDate from '../components/InlineEditDate';
import InlineEditUser from '../components/InlineEditUser';

const API = API_URL;

const KANBAN_COLUMNS = [
  { id: 'Getting Started', title: 'Getting Started', color: 'bg-blue-100 border-blue-300' },
  { id: 'Onetime Setup', title: 'Onetime Setup', color: 'bg-purple-100 border-purple-300' },
  { id: 'Agency Setup', title: 'Agency Setup', color: 'bg-indigo-100 border-indigo-300' },
  { id: 'Service', title: 'Service', color: 'bg-green-100 border-green-300' },
  { id: 'Under Review', title: 'Under Review', color: 'bg-yellow-100 border-yellow-300' },
  { id: 'Completed', title: 'Completed', color: 'bg-emerald-100 border-emerald-300' }
];

// Helper functions for inline editors
const STATUS_OPTIONS = ['Not Started', 'In Progress', 'Under Review', 'Completed'];
const PRIORITY_OPTIONS = ['Low', 'Medium', 'High'];

const getStatusColor = (status) => {
  switch (status) {
    case 'Completed':
      return 'text-green-700 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800';
    case 'In Progress':
      return 'text-blue-700 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800';
    case 'Under Review':
      return 'text-purple-700 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800';
    case 'Not Started':
      return 'text-gray-700 bg-gray-50 dark:bg-gray-900/20 border border-gray-200 dark:border-gray-800';
    default:
      return 'text-gray-700 bg-gray-50 dark:bg-gray-900/20 border border-gray-200 dark:border-gray-800';
  }
};

const getStatusIcon = (status) => {
  switch (status) {
    case 'Completed':
      return <CheckCircle className="w-3.5 h-3.5" />;
    case 'In Progress':
      return <Clock className="w-3.5 h-3.5" />;
    case 'Under Review':
      return <Eye className="w-3.5 h-3.5" />;
    case 'Not Started':
      return <Circle className="w-3.5 h-3.5" />;
    default:
      return <Circle className="w-3.5 h-3.5" />;
  }
};

const getPriorityColor = (priority) => {
  switch (priority?.toLowerCase()) {
    case 'high':
      return 'text-red-700 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800';
    case 'medium':
      return 'text-yellow-700 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800';
    case 'low':
      return 'text-green-700 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800';
    default:
      return 'text-gray-700 bg-gray-50 dark:bg-gray-900/20 border border-gray-200 dark:border-gray-800';
  }
};

const getPriorityIcon = (priority) => {
  const className = "w-3.5 h-3.5";
  switch (priority?.toLowerCase()) {
    case 'high':
      return <Flag className={className} />;
    case 'medium':
      return <Flag className={className} />;
    case 'low':
      return <Flag className={className} />;
    default:
      return <Flag className={className} />;
  }
};

const Projects = ({ currentUser, onLogout }) => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [projects, setProjects] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewType, setViewType] = useState('list'); // Default to list view
  const [showMyProjects, setShowMyProjects] = useState(currentUser?.role !== 'admin');
  const [projectStatusFilter, setProjectStatusFilter] = useState('active'); // 'active', 'completed', 'archived'
  const [addProjectOpen, setAddProjectOpen] = useState(false);
  const [editingProject, setEditingProject] = useState(null);
  const [visibilityModalOpen, setVisibilityModalOpen] = useState(false);
  const [projectForVisibility, setProjectForVisibility] = useState(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [projectToDelete, setProjectToDelete] = useState(null);
  const [deleteConfirmation, setDeleteConfirmation] = useState('');
  const [selectedProject, setSelectedProject] = useState(null);
  const [activeTab, setActiveTab] = useState('tasks');
  const [taskView, setTaskView] = useState('list'); // list, kanban, table
  const [showCompletedTasks, setShowCompletedTasks] = useState(false);
  const [taskFilter, setTaskFilter] = useState('activeTasks'); // 'activeTasks' or 'myTasks'
  
  // Modal state for task cards (matching MyTasks.jsx)
  const [taskQuickEditModalOpen, setTaskQuickEditModalOpen] = useState(false);
  const [trelloTaskModalOpen, setTrelloTaskModalOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);
  
  const [projectTasks, setProjectTasks] = useState([]);
  const [projectDocuments, setProjectDocuments] = useState([]);
  const [internalNotes, setInternalNotes] = useState([]);
  const [newNote, setNewNote] = useState('');
  const [noteDialogOpen, setNoteDialogOpen] = useState(false);
  const [editingNoteId, setEditingNoteId] = useState(null);
  const [taskDialogOpen, setTaskDialogOpen] = useState(false);
  const [editingTaskId, setEditingTaskId] = useState(null);
  const [docDialogOpen, setDocDialogOpen] = useState(false);
  const [editingDocId, setEditingDocId] = useState(null);
  const [timeTrackingData, setTimeTrackingData] = useState({ time_entries: [] });
  const [selectedDocType, setSelectedDocType] = useState('docs_links');
  const [newTask, setNewTask] = useState({
    title: '',
    description: '',
    assignee: '',
    due_date: '',
    priority: 'Medium',
    status: 'Not Started'
  });

  // Task extraction dialog state
  const [showTaskExtractionDialog, setShowTaskExtractionDialog] = useState(false);
  const [taskExtractionOptions, setTaskExtractionOptions] = useState({
    include_meeting_notes: true,
    include_useful_links: true
  });
  const [availableMeetingNotes, setAvailableMeetingNotes] = useState([]);
  const [availableUsefulLinks, setAvailableUsefulLinks] = useState([]);
  const [selectedMeetingNotes, setSelectedMeetingNotes] = useState([]);
  const [selectedUsefulLinks, setSelectedUsefulLinks] = useState([]);
  const [loadingExtractionData, setLoadingExtractionData] = useState(false);

  // Helper function to check if a section is visible to current user
  const isSectionVisible = (project, sectionKey) => {
    if (!project || !project.section_visibility) {
      // Default visibility if not set
      const defaults = {
        tasks: { team: true, client: true },
        links_documents: { team: true, client: true },
        meeting_notes: { team: true, client: false },
        internal_notes: { team: true, client: false },
        deliverables: { team: true, client: true },
        team_members: { team: true, client: false },
        timesheet: { team: true, client: false }
      };
      const defaultVisibility = defaults[sectionKey] || { team: true, client: false };
      
      // Check user role
      const isClient = currentUser?.role === 'client';
      return isClient ? defaultVisibility.client : defaultVisibility.team;
    }

    const visibility = project.section_visibility[sectionKey];
    if (!visibility) return false;

    // Check if user is client
    const isClient = currentUser?.role === 'client';
    return isClient ? visibility.client : visibility.team;
  };

  // Helper function to filter tasks based on the selected filter
  const getFilteredTasks = () => {
    if (!projectTasks || projectTasks.length === 0) return [];
    
    if (taskFilter === 'myTasks') {
      // My Tasks: All tasks assigned to current user (both active and completed)
      return projectTasks.filter(task => 
        task.assignee === currentUser?.id || 
        task.assignee === currentUser?.email
      );
    } else {
      // Active Tasks: All tasks in the project (both active and completed)
      return projectTasks.filter(task => !task.archived);
    }
  };

  const [newDoc, setNewDoc] = useState({
    title: '',
    url: ''
  });
  
  // Document upload state
  const [uploadMode, setUploadMode] = useState('link'); // 'link' or 'document'
  const [uploadedFile, setUploadedFile] = useState(null);
  const [uploadingFile, setUploadingFile] = useState(false);
  
  // Guest link state
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [guestLink, setGuestLink] = useState(null);
  const [generatingLink, setGeneratingLink] = useState(false);
  
  // AI task extraction state
  const [aiDialogOpen, setAiDialogOpen] = useState(false);
  const [extractingTasks, setExtractingTasks] = useState(false);
  const [extractedTasks, setExtractedTasks] = useState([]);
  const [selectedTasksToImport, setSelectedTasksToImport] = useState([]);
  
  // GHL integration state
  const [ghlIntegrationActive, setGhlIntegrationActive] = useState(false);
  const [syncingToGHL, setSyncingToGHL] = useState(false);
  
  // Task time tracking state
  const [taskTimeDialogOpen, setTaskTimeDialogOpen] = useState(false);
  const [selectedTaskTime, setSelectedTaskTime] = useState(null);
  const [loadingTaskTime, setLoadingTaskTime] = useState(false);
  
  const [newProject, setNewProject] = useState({
    name: '',
    client_name: '',
    client_email: '',
    client_phone: '',
    business_name: '',
    budget: '',
    project_owner: currentUser?.id || '',
    team_members: [],
    start_date: new Date().toISOString().split('T')[0],
    end_date: '',
    description: '',
    status: 'Getting Started',
    priority: 'Medium'
  });

  useEffect(() => {
    fetchData();
  }, []);

  // Handle project selection from URL parameter
  useEffect(() => {
    const selectedId = searchParams.get('selected');
    if (selectedId && projects.length > 0) {
      const project = projects.find(p => p.id === selectedId);
      if (project) {
        setSelectedProject(project);
        setActiveTab('tasks');
        fetchProjectDetails(project.id);
      }
    }
  }, [searchParams, projects]);

  const fetchData = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      const headers = token ? { Authorization: `Bearer ${token}` } : {};

      const [projectsRes, tasksRes, usersRes, integrationsRes] = await Promise.all([
        axios.get(`${API}/projects`, { headers }),
        axios.get(`${API}/tasks`, { headers }),
        axios.get(`${API}/users`, { headers }),
        axios.get(`${API}/integrations/status`, { headers })
      ]);

      // Backend list endpoints are paginated and return { data, pagination }
      // but some older versions may return a plain array, so handle both.
      const projectsData = Array.isArray(projectsRes.data) ? projectsRes.data : projectsRes.data?.data || [];
      const tasksData = Array.isArray(tasksRes.data) ? tasksRes.data : tasksRes.data?.data || [];
      const usersData = Array.isArray(usersRes.data) ? usersRes.data : usersRes.data?.data || [];

      setProjects(projectsData);
      setTasks(tasksData);
      setUsers(usersData);
      
      // Check GHL integration status
      const integrationsList = Array.isArray(integrationsRes.data) ? integrationsRes.data : integrationsRes.data?.data || integrationsRes.data || [];
      const ghlIntegration = integrationsList.find(i => i.name === 'gohighlevel');
      setGhlIntegrationActive(ghlIntegration?.is_connected && ghlIntegration?.config?.outbound_webhook_url);
      
      setLoading(false);
    } catch (error) {
      console.error('Error loading projects view data:', error);
      toast.error('Failed to load projects');
      setLoading(false);
    }
  }, []);

  const filteredProjects = useMemo(() => {
    // Admin can optionally see all projects
    if (currentUser?.role === 'admin' && !showMyProjects) {
      return projects;
    }

    // Clients / guests: backend already filters projects they have access to,
    // and the projection may not include all membership fields, so just use list as-is.
    if (currentUser?.role === 'client') {
      return projects;
    }

    // For internal users, show projects where user is owner, team member, or guest
    return projects.filter(p => 
      p.project_owner === currentUser?.id || 
      p.team_members?.includes(currentUser?.id) ||
      p.guests?.includes(currentUser?.id)
    );
  }, [projects, currentUser, showMyProjects]);

  const getProjectProgress = useCallback((projectId) => {
    const projectTasks = tasks.filter(t => t.project_id === projectId);
    if (projectTasks.length === 0) return 0;
    const completed = projectTasks.filter(t => t.status === 'Completed').length;
    return Math.round((completed / projectTasks.length) * 100);
  }, [tasks]);

  const getDaysElapsed = useCallback((startDate) => {
    if (!startDate) return 0;
    const start = new Date(startDate);
    const now = new Date();
    const diffTime = Math.abs(now - start);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  }, []);

  const handleAddProject = async (e) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('token');
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      await axios.post(
        `${API}/projects`,
        {
        ...newProject,
        budget: parseFloat(newProject.budget) || 0
        },
        { headers }
      );
      toast.success('Project created successfully!');
      setAddProjectOpen(false);
      setNewProject({
        name: '',
        client_name: '',
        client_email: '',
        client_phone: '',
        business_name: '',
        budget: '',
        project_owner: currentUser?.id || '',
        team_members: [],
        start_date: new Date().toISOString().split('T')[0],
        end_date: '',
        description: '',
        status: 'Getting Started',
        priority: 'Medium'
      });
      fetchData();
    } catch (error) {
      toast.error('Failed to create project');
    }
  };

  const handleUpdateProject = async (projectId, updates) => {
    try {
      const token = localStorage.getItem('token');
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      await axios.put(`${API}/projects/${projectId}`, updates, { headers });
      toast.success('Project updated successfully!');
      fetchData();
    } catch (error) {
      toast.error('Failed to update project');
    }
  };

  const handleArchiveProject = async (projectId) => {
    if (!window.confirm('Are you sure you want to archive this project?')) return;
    
    try {
      const token = localStorage.getItem('token');
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      await axios.put(`${API}/projects/${projectId}`, { archived: true }, { headers });
      toast.success('Project archived successfully!');
      fetchData();
    } catch (error) {
      toast.error('Failed to archive project');
    }
  };

  const handleUnarchiveProject = async (projectId) => {
    try {
      const token = localStorage.getItem('token');
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      await axios.put(`${API}/projects/${projectId}`, { archived: false }, { headers });
      toast.success('Project restored successfully!');
      fetchData();
    } catch (error) {
      toast.error('Failed to restore project');
    }
  };

  const handleDragEnd = async (result) => {
    const { destination, source, draggableId } = result;
    
    if (!destination) return;
    if (destination.droppableId === source.droppableId && destination.index === source.index) return;
    
    // Update project status
    try {
      const projectId = draggableId;
      const newStatus = destination.droppableId;
      
      const token = localStorage.getItem('token');
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      await axios.put(`${API}/projects/${projectId}`, { status: newStatus }, { headers });
      toast.success('Project status updated!');
      fetchData();
    } catch (error) {
      console.error('Drag error:', error);
      toast.error('Failed to update project status');
    }
  };

  const handleExportPDF = (project) => {
    // Simple implementation - in production, use a PDF library like jsPDF
    toast.info('PDF export will be implemented with jsPDF library');
  };

  const handleDeleteProject = (project) => {
    setProjectToDelete(project);
    setDeleteDialogOpen(true);
    setDeleteConfirmation('');
  };

  const confirmDeleteProject = async () => {
    if (deleteConfirmation !== 'DELETE') {
      toast.error('Please type DELETE to confirm');
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      await axios.delete(`${API}/projects/${projectToDelete.id}`, { headers });
      toast.success('Project deleted successfully');
      setDeleteDialogOpen(false);
      setProjectToDelete(null);
      setDeleteConfirmation('');
      fetchData();
    } catch (error) {
      toast.error('Failed to delete project');
      console.error('Delete error:', error);
    }
  };

  const handleProjectClick = async (project) => {
    setSelectedProject(project);
    setActiveTab('tasks');
    await fetchProjectDetails(project.id);
  };

  const fetchProjectDetails = async (projectId) => {
    try {
      const token = localStorage.getItem('token');
      
      console.log('Fetching project details for:', projectId);
      
      // Fetch project tasks
      const tasksResponse = await axios.get(`${API}/tasks/${projectId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      console.log('Tasks loaded:', tasksResponse.data);
      setProjectTasks(tasksResponse.data);

      // Fetch project documents
      const docsResponse = await axios.get(`${API}/documents/${projectId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      console.log('Documents loaded:', docsResponse.data);
      setProjectDocuments(docsResponse.data);

      // Fetch internal notes (only for non-clients)
      if (currentUser?.role !== 'client') {
        const notesResponse = await axios.get(`${API}/internal-notes/${projectId}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setInternalNotes(notesResponse.data);
      }

      // Fetch project to get guest link
      const projectResponse = await axios.get(`${API}/projects/${projectId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setGuestLink(projectResponse.data.guest_link);
      
      // Fetch time tracking data for timesheet (filtered by project) with enhanced data
      try {
        const timeTrackingResponse = await axios.get(`${API}/time-entries`, {
          params: { 
            project_id: projectId,
            include_enhanced: true  // Request enhanced tracking data
          },
          headers: { Authorization: `Bearer ${token}` }
        });
        // Transform the response to match expected format
        setTimeTrackingData({ 
          time_entries: timeTrackingResponse.data || [] 
        });
        console.log('Enhanced time entries loaded:', timeTrackingResponse.data?.length || 0);
      } catch (timeError) {
        console.log('Time tracking not available:', timeError);
        setTimeTrackingData({ time_entries: [] });
      }
      
      console.log('All project details loaded successfully');
    } catch (error) {
      console.error('Error fetching project details:', error);
      toast.error('Failed to load project details');
    }
  };

  const handleCreateNote = async () => {
    if (!newNote.trim()) return;

    try {
      const token = localStorage.getItem('token');
      
      if (editingNoteId) {
        // Update existing note
        await axios.put(`${API}/internal-notes/${editingNoteId}`, 
          { content: newNote },
          { headers: { Authorization: `Bearer ${token}` } }
        );
        toast.success('Note updated successfully');
      } else {
        // Create new note
        const noteData = {
          project_id: selectedProject.id,
          content: newNote,
          created_by: currentUser.id
        };
        await axios.post(`${API}/internal-notes`, noteData, {
          headers: { Authorization: `Bearer ${token}` }
        });
        toast.success('Note created successfully');
      }
      
      setNoteDialogOpen(false);
      setEditingNoteId(null);
      setNewNote('');
      fetchProjectDetails(selectedProject.id);
    } catch (error) {
      toast.error('Failed to save note');
      console.error('Note save error:', error);
    }
  };

  const handleUpdateTask = async (taskId, updates) => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.put(`${API}/tasks/${taskId}`, updates, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      // OPTIMIZATION: Update local state instead of refetching everything
      setProjectTasks(prevTasks => 
        prevTasks.map(task => 
          task.id === taskId ? { ...task, ...updates } : task
        )
      );
      
      toast.success('Task updated successfully');
      
      // Note: We don't call fetchProjectDetails anymore to avoid the 3-4 second freeze
      // If you need fresh data, call it manually after batch operations
    } catch (error) {
      toast.error('Failed to update task');
      console.error('Task update error:', error);
    }
  };

  const handleDeleteTask = async (taskId) => {
    if (!window.confirm('Are you sure you want to delete this task?')) return;
    
    try {
      const token = localStorage.getItem('token');
      await axios.delete(`${API}/tasks/${taskId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Task deleted successfully');
      fetchProjectDetails(selectedProject.id);
    } catch (error) {
      toast.error('Failed to delete task');
      console.error('Task delete error:', error);
    }
  };

  const handleCreateTask = async () => {
    if (!newTask.title.trim()) {
      toast.error('Task title is required');
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const taskData = {
        ...newTask,
        project_id: selectedProject.id
      };
      
      if (editingTaskId) {
        // Update existing task
        await axios.put(`${API}/tasks/${editingTaskId}`, taskData, {
          headers: { Authorization: `Bearer ${token}` }
        });
        toast.success('Task updated successfully');
      } else {
        // Create new task
        await axios.post(`${API}/tasks`, taskData, {
          headers: { Authorization: `Bearer ${token}` }
        });
        toast.success('Task created successfully');
      }
      
      setTaskDialogOpen(false);
      setEditingTaskId(null);
      setNewTask({
        title: '',
        description: '',
        assignee: '',
        due_date: '',
        priority: 'Medium',
        status: 'Not Started'
      });
      fetchProjectDetails(selectedProject.id);
    } catch (error) {
      toast.error('Failed to create task');
      console.error('Task creation error:', error);
    }
  };

  const handleCreateDocument = async () => {
    // Validation
    if (!newDoc.title.trim()) {
      toast.error('Title is required');
      return;
    }
    
    if (uploadMode === 'link' && !newDoc.url.trim()) {
      toast.error('URL is required');
      return;
    }
    
    if (uploadMode === 'document' && !uploadedFile && !editingDocId) {
      toast.error('Please select a file to upload');
      return;
    }

    try {
      setUploadingFile(true);
      const token = localStorage.getItem('token');
      
      let documentData = { ...newDoc };
      
      // Handle file upload for documents
      if (uploadMode === 'document' && uploadedFile && selectedDocType === 'docs_links') {
        // Read file content as text
        const fileContent = await uploadedFile.text();
        
        // Store file content in URL field with metadata
        documentData.url = `[UPLOADED_FILE: ${uploadedFile.name}]\n\n${fileContent}`;
        
        toast.info('Processing uploaded file...');
      }
      
      if (editingDocId) {
        // Update existing document
        await axios.put(`${API}/documents/${editingDocId}`, documentData, {
          headers: { Authorization: `Bearer ${token}` }
        });
        toast.success('Document updated successfully');
      } else {
        // Create new document
        const docData = {
          ...documentData,
          project_id: selectedProject.id,
          type: selectedDocType
        };
        await axios.post(`${API}/documents`, docData, {
          headers: { Authorization: `Bearer ${token}` }
        });
        toast.success(uploadMode === 'document' ? 'Document uploaded successfully' : 'Link added successfully');
      }
      
      setDocDialogOpen(false);
      setEditingDocId(null);
      setNewDoc({ title: '', url: '' });
      setUploadedFile(null);
      setUploadMode('link');
      fetchProjectDetails(selectedProject.id);
    } catch (error) {
      toast.error('Failed to save document');
      console.error('Document save error:', error);
    } finally {
      setUploadingFile(false);
    }
  };

  const handleDeleteDocument = async (docId) => {
    if (!window.confirm('Are you sure you want to delete this document?')) return;
    
    try {
      const token = localStorage.getItem('token');
      await axios.delete(`${API}/documents/${docId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      toast.success('Document deleted successfully');
      fetchProjectDetails(selectedProject.id);
    } catch (error) {
      toast.error('Failed to delete document');
      console.error('Document delete error:', error);
    }
  };

  const handleDeleteNote = async (noteId) => {
    if (!window.confirm('Are you sure you want to delete this note?')) return;
    
    try {
      const token = localStorage.getItem('token');
      await axios.delete(`${API}/internal-notes/${noteId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      toast.success('Note deleted successfully');
      fetchProjectDetails(selectedProject.id);
    } catch (error) {
      toast.error('Failed to delete note');
      console.error('Note delete error:', error);
    }
  };

  // Guest link handlers
  const handleGenerateGuestLink = async () => {
    setGeneratingLink(true);
    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(
        `${API}/projects/${selectedProject.id}/generate-guest-link`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setGuestLink(response.data.guest_link);
      toast.success('Guest link generated successfully');
    } catch (error) {
      toast.error('Failed to generate guest link');
      console.error('Error generating guest link:', error);
    } finally {
      setGeneratingLink(false);
    }
  };

  const handleRevokeGuestLink = async () => {
    if (!window.confirm('Are you sure you want to revoke this guest link? All existing shared links will stop working.')) return;
    
    try {
      const token = localStorage.getItem('token');
      await axios.delete(
        `${API}/projects/${selectedProject.id}/revoke-guest-link`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setGuestLink(null);
      toast.success('Guest link revoked successfully');
      fetchProjectDetails(selectedProject.id);
    } catch (error) {
      toast.error('Failed to revoke guest link');
      console.error('Error revoking guest link:', error);
    }
  };

  const handleCopyGuestLink = () => {
    const fullLink = `${window.location.origin}/guest-invite/${guestLink}`;
    
    // Try modern clipboard API first
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(fullLink)
        .then(() => {
          toast.success('Guest link copied to clipboard');
        })
        .catch((err) => {
          console.error('Clipboard error:', err);
          // Fallback to old method
          fallbackCopyToClipboard(fullLink);
        });
    } else {
      // Fallback for older browsers
      fallbackCopyToClipboard(fullLink);
    }
  };
  
  const fallbackCopyToClipboard = (text) => {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '-999999px';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    
    try {
      const successful = document.execCommand('copy');
      if (successful) {
        toast.success('Guest link copied to clipboard');
      } else {
        toast.error('Failed to copy link');
      }
    } catch (err) {
      console.error('Fallback copy error:', err);
      toast.error('Failed to copy link');
    }
    
    document.body.removeChild(textArea);
  };

  // AI Task Extraction Handler - Show selection dialog first
  const handleExtractTasksAI = async () => {
    setLoadingExtractionData(true);
    setShowTaskExtractionDialog(true);
    
    try {
      console.log('Using existing project data...');
      console.log('Project Documents:', projectDocuments);
      
      // Filter meeting notes from projectDocuments
      const meetingNotes = projectDocuments.filter(doc => doc.type === 'meeting_summaries');
      console.log('Meeting notes found:', meetingNotes);
      setAvailableMeetingNotes(meetingNotes);
      
      // Filter useful links from projectDocuments
      const usefulLinks = projectDocuments.filter(doc => doc.type === 'docs_links');
      console.log('Useful links found:', usefulLinks);
      setAvailableUsefulLinks(usefulLinks);
      
      // Pre-select all items by default
      setSelectedMeetingNotes(meetingNotes.map(note => note.id));
      setSelectedUsefulLinks(usefulLinks.map(link => link.id));
      
    } catch (error) {
      console.error('Error setting extraction data:', error);
      toast.error('Failed to load meeting notes and links');
    } finally {
      setLoadingExtractionData(false);
    }
  };

  // Proceed with AI task extraction after user selection
  const proceedWithTaskExtraction = async () => {
    // Validate that at least one item is selected
    if (selectedMeetingNotes.length === 0 && selectedUsefulLinks.length === 0) {
      toast.error('Please select at least one meeting note or useful link to proceed.');
      return;
    }

    setShowTaskExtractionDialog(false);
    setExtractingTasks(true);
    
    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(
        `${API}/projects/${selectedProject.id}/extract-tasks-ai`,
        {
          selected_meeting_notes: selectedMeetingNotes,
          selected_useful_links: selectedUsefulLinks
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (response.data.tasks && response.data.tasks.length > 0) {
        setExtractedTasks(response.data.tasks);
        setSelectedTasksToImport(response.data.tasks.map((_, index) => index)); // Select all by default
        setAiDialogOpen(true); // Show the import dialog with extracted tasks
        toast.success(`Found ${response.data.tasks.length} tasks to import!`);
      } else {
        toast.info('No tasks found in the selected content.');
      }
    } catch (error) {
      console.error('Error extracting tasks:', error);
      const message = error.response?.data?.detail || 'Failed to extract tasks. Please try again.';
      toast.error(message);
    } finally {
      setExtractingTasks(false);
    }
  };

  const handleSyncToGHL = async () => {
    setSyncingToGHL(true);
    try {
      const response = await axios.post(`${API}/projects/${selectedProject.id}/sync-to-ghl`, {
        frontend_origin: window.location.origin  // Send current domain for guest link generation
      });
      toast.success('Project data synced to GoHighLevel successfully!');
    } catch (error) {
      console.error('GHL sync error:', error);
      if (error.response?.status === 400) {
        toast.error(error.response?.data?.detail || 'GHL webhook URL not configured');
      } else {
        toast.error(error.response?.data?.detail || 'Failed to sync to GoHighLevel');
      }
    } finally {
      setSyncingToGHL(false);
    }
  };

  const handleViewTaskTime = async (taskId) => {
    setLoadingTaskTime(true);
    setTaskTimeDialogOpen(true);
    try {
      const response = await axios.get(`${API}/time-entries/task-summary`, {
        params: { task_id: taskId }
      });
      setSelectedTaskTime(response.data);
    } catch (error) {
      console.error('Error fetching task time summary:', error);
      toast.error('Failed to load time tracking data');
      setTaskTimeDialogOpen(false);
    } finally {
      setLoadingTaskTime(false);
    }
  };

  const handleImportSelectedTasks = async () => {
    const tasksToImport = selectedTasksToImport.map(index => extractedTasks[index]);
    
    if (tasksToImport.length === 0) {
      toast.error('Please select at least one task to import');
      return;
    }

    try {
      const token = localStorage.getItem('token');
      
      for (const task of tasksToImport) {
        await axios.post(`${API}/tasks`, {
          ...task,
          project_id: selectedProject.id,
          assigned_to: null, // Manual assignment as requested
          created_by: currentUser.id
        }, {
          headers: { Authorization: `Bearer ${token}` }
        });
      }

      toast.success(`Successfully imported ${tasksToImport.length} task(s)`);
      setAiDialogOpen(false);
      setExtractedTasks([]);
      setSelectedTasksToImport([]);
      fetchProjectDetails(selectedProject.id);
    } catch (error) {
      console.error('Error importing tasks:', error);
      toast.error('Failed to import tasks');
    }
  };

  const toggleTaskSelection = (index) => {
    setSelectedTasksToImport(prev => 
      prev.includes(index) 
        ? prev.filter(i => i !== index)
        : [...prev, index]
    );
  };

  // Modal handlers (matching MyTasks.jsx)
  const handleTaskCardClick = (task) => {
    setSelectedTask(task);
    setTrelloTaskModalOpen(true);
  };

  const handleTaskUpdate = async (updatedTask) => {
    if (!updatedTask) {
      // If updatedTask is null, it means deletion - close modals and refresh
      setTrelloTaskModalOpen(false);
      setTaskQuickEditModalOpen(false);
      
      // Refresh project details to get updated data
      if (selectedProject) {
        fetchProjectDetails(selectedProject.id);
      }
      return;
    }
    
    // Update task in local state but DON'T close modals
    // Only refresh data in background
    if (selectedProject) {
      fetchProjectDetails(selectedProject.id);
    }
  };

  // Task approval handler
  const handleTaskApprove = async (task) => {
    try {
      await axios.post(`${API}/tasks/${task.id}/approve`);
      toast.success('Task approved successfully');
      if (selectedProject) {
        fetchProjectDetails(selectedProject.id);
      }
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

  const getStatusColor = (status) => {
    const colors = {
      'Getting Started': 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
      'Onetime Setup': 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
      'Agency Setup': 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200',
      'Service': 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
      'Under Review': 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
      'Completed': 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
    };
    return colors[status] || 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
  };

  const getPriorityColor = (priority) => {
    const colors = {
      'Low': 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200',
      'Medium': 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
      'High': 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
    };
    return colors[priority] || 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
  };

  const renderKanbanView = () => {
    const displayedProjects = filteredProjects;
    
    return (
      <DragDropContext 
        onDragEnd={handleDragEnd}
        onDragStart={() => {}}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          {KANBAN_COLUMNS.map((column) => {
            const columnProjects = displayedProjects.filter(p => p.status === column.id);
            
            return (
              <Droppable key={column.id} droppableId={column.id}>
                {(provided, snapshot) => (
                  <div 
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className={`rounded-lg border-2 ${column.color} p-4 min-h-[500px] ${
                      snapshot.isDraggingOver ? 'bg-opacity-50' : ''
                    }`}
                  >
                    <h3 className="font-semibold mb-3 text-sm">{column.title} ({columnProjects.length})</h3>
                    <div className="space-y-3">
                      {columnProjects.map((project, index) => {
                        const progress = getProjectProgress(project.id);
                        const daysElapsed = getDaysElapsed(project.start_date);
                        const projectId = String(project.id); // Ensure it's a string
                        
                        return (
                          <Draggable key={projectId} draggableId={projectId} index={index}>
                            {(provided, snapshot) => (
                              <div
                                ref={provided.innerRef}
                                {...provided.draggableProps}
                                {...provided.dragHandleProps}
                                style={{
                                  ...provided.draggableProps.style,
                                  cursor: snapshot.isDragging ? 'grabbing' : 'grab'
                                }}
                              >
                                <Card 
                                  className={`cursor-pointer hover:shadow-md transition-shadow ${
                                    snapshot.isDragging ? 'shadow-lg' : ''
                                  }`}
                                  onClick={(e) => {
                                    // Only select if not dragging
                                    if (!snapshot.isDragging) {
                                      handleProjectClick(project);
                                    }
                                  }}
                                >
                                  <CardContent className="pt-4 pb-3 px-3">
                                    <div className="flex justify-between items-start mb-2">
                                      <h4 className="font-medium text-sm line-clamp-2 flex-1">{project.name}</h4>
                                      {currentUser?.role === 'admin' && (
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          className="h-6 w-6 p-0 ml-2"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setProjectForVisibility(project);
                                            setVisibilityModalOpen(true);
                                          }}
                                          title="Manage visibility"
                                        >
                                          <Eye className="w-3 h-3 text-purple-600" />
                                        </Button>
                                      )}
                                    </div>
                                    <p className="text-xs text-gray-500 mb-2">{project.client_name}</p>
                                    
                                    <div className="flex items-center justify-between text-xs text-gray-500 mb-2">
                                      <span className="flex items-center">
                                        <Clock className="w-3 h-3 mr-1" />
                                        Day {daysElapsed}
                                      </span>
                                      {project.budget && (
                                        <span className="flex items-center">
                                          <DollarSign className="w-3 h-3" />
                                          {project.budget}
                                        </span>
                                      )}
                                    </div>
                                    
                                    <div className="mb-2">
                                      <div className="flex justify-between text-xs mb-1">
                                        <span>Progress</span>
                                        <span>{progress}%</span>
                                      </div>
                                      <Progress value={progress} className="h-1" />
                                    </div>
                                    
                                    {project.team_members && project.team_members.length > 0 && (
                                      <div className="flex items-center text-xs text-gray-500">
                                        <Users className="w-3 h-3 mr-1" />
                                        {project.team_members.length} member{project.team_members.length !== 1 ? 's' : ''}
                                      </div>
                                    )}
                                    
                                    {projectStatusFilter === 'archived' && (
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="w-full mt-2"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleUnarchiveProject(project.id);
                                        }}
                                      >
                                        <ArchiveRestore className="w-3 h-3 mr-1" />
                                        Restore
                                      </Button>
                                    )}
                                  </CardContent>
                                </Card>
                              </div>
                            )}
                          </Draggable>
                        );
                      })}
                      {provided.placeholder}
                    </div>
                  </div>
                )}
              </Droppable>
            );
          })}
        </div>
      </DragDropContext>
    );
  };

  const renderListView = () => {
    const displayedProjects = filteredProjects.filter(p => 
      projectStatusFilter === 'active' ? (!p.archived && p.status !== 'Completed') :
      projectStatusFilter === 'completed' ? (!p.archived && p.status === 'Completed') :
      projectStatusFilter === 'archived' ? p.archived : false
    );
    
    // Sort by status priority: Getting Started, then others, then Under Review, then Completed
    const statusPriority = {
      'Getting Started': 1,
      'Onetime Setup': 2,
      'Agency Setup': 3,
      'Service': 4,
      'Under Review': 5,
      'Completed': 6
    };
    
    const sortedProjects = [...displayedProjects].sort((a, b) => {
      return (statusPriority[a.status] || 99) - (statusPriority[b.status] || 99);
    });
    
    return (
      <div className="space-y-3">
        {sortedProjects.map((project) => {
          const progress = getProjectProgress(project.id);
          const daysElapsed = getDaysElapsed(project.start_date);
          const owner = users.find(u => u.id === project.project_owner);
          const teamMembers = users.filter(u => project.team_members?.includes(u.id));
          
          return (
            <Card key={project.id} className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-xl border-gray-200 dark:border-gray-700 hover:shadow-md transition-shadow">
              <CardContent className="pt-4">
                <div className="flex items-center justify-between">
                  <div 
                    className="flex-1 cursor-pointer"
                    onClick={() => handleProjectClick(project)}
                  >
                    <div className="flex items-center space-x-4">
                      <div className="flex-1">
                        <h3 className="font-semibold text-lg">{project.name}</h3>
                        <p className="text-sm text-gray-500">{project.client_name} • {project.business_name}</p>
                      </div>
                      
                      <div className="flex items-center space-x-8 text-sm">
                        <div className="text-center min-w-[80px]">
                          <p className="text-gray-500 text-xs">Timer</p>
                          <p className="font-semibold">Day {daysElapsed}</p>
                        </div>
                        
                        <div className="text-center min-w-[120px]">
                          <p className="text-gray-500 text-xs">Status</p>
                          <span className="px-2 py-1 rounded-full text-xs bg-blue-100 text-blue-800">
                            {project.status}
                          </span>
                        </div>
                        
                        <div className="text-center min-w-[120px]">
                          <p className="text-gray-500 text-xs mb-1">Progress</p>
                          <Progress value={progress} className="h-2" />
                          <p className="text-xs font-semibold mt-1">{progress}%</p>
                        </div>
                        
                        <div className="text-center min-w-[100px]">
                          <p className="text-gray-500 text-xs">Team</p>
                          <div className="flex -space-x-2 justify-center mt-1">
                            {teamMembers.slice(0, 3).map((member) => (
                              member.profile_image_url ? (
                                <img 
                                  key={member.id}
                                  src={member.profile_image_url}
                                  alt={member.name}
                                  className="w-6 h-6 rounded-full object-cover border-2 border-white"
                                  title={member.name}
                                />
                              ) : (
                                <div 
                                  key={member.id}
                                  className={`w-6 h-6 rounded-full ${getUserAvatarColor(member.id, member.email)} flex items-center justify-center text-white text-xs font-semibold border-2 border-white`}
                                  title={member.name}
                                >
                                  {getUserInitials(member.name)}
                                </div>
                              )
                            ))}
                            {teamMembers.length > 3 && (
                              <div className="w-6 h-6 rounded-full bg-gray-300 flex items-center justify-center text-xs font-semibold border-2 border-white">
                                +{teamMembers.length - 3}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-2 ml-4">
                    <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); setEditingProject(project); }}>
                      <Edit className="w-4 h-4" />
                    </Button>
                    {projectStatusFilter === 'archived' ? (
                      <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); handleUnarchiveProject(project.id); }}>
                        <ArchiveRestore className="w-4 h-4" />
                      </Button>
                    ) : (
                      <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); handleArchiveProject(project.id); }}>
                        <Archive className="w-4 h-4" />
                      </Button>
                    )}
                    <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); handleExportPDF(project); }}>
                      <Download className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); handleDeleteProject(project); }}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    );
  };

  const renderTableView = () => {
    const displayedProjects = filteredProjects.filter(p => 
      projectStatusFilter === 'active' ? (!p.archived && p.status !== 'Completed') :
      projectStatusFilter === 'completed' ? (!p.archived && p.status === 'Completed') :
      projectStatusFilter === 'archived' ? p.archived : false
    );
    
    return (
      <Card className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-xl border-gray-200 dark:border-gray-700">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Project Name</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Client</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Progress</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Timer</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Team</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Budget</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {displayedProjects.map((project) => {
                  const progress = getProjectProgress(project.id);
                  const daysElapsed = getDaysElapsed(project.start_date);
                  const teamMembers = users.filter(u => project.team_members?.includes(u.id));
                  
                  return (
                    <tr key={project.id} className="hover:bg-gray-50">
                      <td 
                        className="px-4 py-3 cursor-pointer font-medium text-blue-600 hover:underline"
                        onClick={() => handleProjectClick(project)}
                      >
                        {project.name}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <div>{project.client_name}</div>
                        <div className="text-gray-500 text-xs">{project.business_name}</div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-1 rounded-full text-xs bg-blue-100 text-blue-800">
                          {project.status}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="w-24">
                          <Progress value={progress} className="h-2" />
                          <p className="text-xs text-center mt-1">{progress}%</p>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <span className="flex items-center">
                          <Clock className="w-3 h-3 mr-1" />
                          Day {daysElapsed}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex -space-x-2">
                          {teamMembers.slice(0, 3).map((member) => (
                            member.profile_image_url ? (
                              <img 
                                key={member.id}
                                src={member.profile_image_url}
                                alt={member.name}
                                className="w-6 h-6 rounded-full object-cover border-2 border-white"
                                title={member.name}
                              />
                            ) : (
                              <div 
                                key={member.id}
                                className={`w-6 h-6 rounded-full ${getUserAvatarColor(member.id, member.email)} flex items-center justify-center text-white text-xs font-semibold border-2 border-white`}
                                title={member.name}
                              >
                                {getUserInitials(member.name)}
                              </div>
                            )
                          ))}
                          {teamMembers.length > 3 && (
                            <div className="w-6 h-6 rounded-full bg-gray-300 flex items-center justify-center text-xs font-semibold border-2 border-white">
                              +{teamMembers.length - 3}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm">
                        ${project.budget || 0}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center space-x-1">
                          {currentUser?.role === 'admin' && (
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              onClick={(e) => {
                                e.stopPropagation();
                                setProjectForVisibility(project);
                                setVisibilityModalOpen(true);
                              }}
                              title="Manage visibility"
                            >
                              <Eye className="w-3 h-3 text-purple-600" />
                            </Button>
                          )}
                          <Button variant="ghost" size="sm" onClick={() => setEditingProject(project)}>
                            <Edit className="w-3 h-3" />
                          </Button>
                          {projectStatusFilter === 'archived' ? (
                            <Button variant="ghost" size="sm" onClick={() => handleUnarchiveProject(project.id)}>
                              <ArchiveRestore className="w-3 h-3" />
                            </Button>
                          ) : (
                            <Button variant="ghost" size="sm" onClick={() => handleArchiveProject(project.id)}>
                              <Archive className="w-3 h-3" />
                            </Button>
                          )}
                          <Button variant="ghost" size="sm" onClick={() => handleExportPDF(project)}>
                            <Download className="w-3 h-3" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => handleDeleteProject(project)}>
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    );
  };

  // Project Tasks List View
  const renderProjectTasksListView = () => {
    const filteredTasks = getFilteredTasks();
    const activeTasks = filteredTasks.filter(t => t.status !== 'Completed' && !t.archived);
    const completedTasks = filteredTasks.filter(t => t.status === 'Completed' && !t.archived);
    
    return (
      <div className="space-y-6">
        {activeTasks.length > 0 && (
          <div>
            <h3 className="text-xl font-bold text-gray-800 dark:text-white mb-3">
              {taskFilter === 'myTasks' ? 'My Active Tasks' : 'Active Tasks'} ({activeTasks.length})
            </h3>
            <div className="space-y-4">
              {activeTasks.map((task) => (
                <TrelloTaskCard
                  key={task.id}
                  task={task}
                  users={users}
                  onClick={() => handleTaskCardClick(task)}
                  onUpdate={handleUpdateTask}
                  onApprove={handleTaskApprove}
                  onReject={handleTaskReject}
                  currentUser={currentUser}
                  projectTeamMembers={selectedProject?.team_members || []}
                  className="group"
                />
              ))}
            </div>
          </div>
        )}

        {completedTasks.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-3 cursor-pointer" onClick={() => setShowCompletedTasks(!showCompletedTasks)}>
              <h3 className="text-xl font-bold text-gray-800 dark:text-white">
                {taskFilter === 'myTasks' ? 'My Completed Tasks' : 'Completed Tasks'} ({completedTasks.length})
              </h3>
              <button className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 transition-colors">
                {showCompletedTasks ? (
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                ) : (
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                )}
              </button>
            </div>
            {showCompletedTasks && (
              <div className="space-y-4 opacity-60">
                {completedTasks.map((task) => (
                  <TrelloTaskCard
                    key={task.id}
                    task={task}
                    users={users}
                    onClick={() => handleTaskCardClick(task)}
                    onUpdate={handleUpdateTask}
                    onApprove={handleTaskApprove}
                    onReject={handleTaskReject}
                    currentUser={currentUser}
                    projectTeamMembers={selectedProject?.team_members || []}
                    className="group"
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {filteredTasks.length === 0 && (
          <div className="text-center py-12 text-gray-500 dark:text-gray-400">
            <CheckSquare className="w-16 h-16 mx-auto mb-4 text-gray-300" />
            <p className="text-lg">
              {taskFilter === 'myTasks' ? 'No tasks assigned to you in this project' : 'No tasks found for this project'}
            </p>
            <p className="text-sm mt-2">
              {taskFilter === 'myTasks' ? 'Check with your project manager for task assignments' : 'Create your first task to get started'}
            </p>
          </div>
        )}
      </div>
    );
  };

  // Project Tasks Kanban View
  const renderProjectTasksKanbanView = () => {
    const columns = [
      { id: 'Not Started', title: 'Not Started', color: 'bg-gray-100 border-gray-300' },
      { id: 'In Progress', title: 'In Progress', color: 'bg-blue-100 border-blue-300' },
      { id: 'Under Review', title: 'Under Review', color: 'bg-yellow-100 border-yellow-300' },
      { id: 'Completed', title: 'Completed', color: 'bg-green-100 border-green-300' }
    ];

    // Handle task drag-and-drop
    const handleTaskDragEnd = async (result) => {
      if (!result.destination) return;

      const { source, destination, draggableId } = result;

      if (source.droppableId === destination.droppableId) return;

      const newStatus = destination.droppableId;
      
      try {
        await axios.put(`${API}/tasks/${draggableId}`, { status: newStatus });
        
        // OPTIMIZATION: Update local state instead of refetching
        setProjectTasks(prevTasks =>
          prevTasks.map(task =>
            task.id === draggableId ? { ...task, status: newStatus } : task
          )
        );
        
        toast.success('Task status updated');
      } catch (error) {
        toast.error('Failed to update task status');
        console.error('Error updating task:', error);
      }
    };

    return (
      <DragDropContext onDragEnd={handleTaskDragEnd}>
        <div className="grid grid-cols-4 gap-4">
          {columns.map((column) => {
            const filteredTasks = getFilteredTasks();
            const columnTasks = filteredTasks.filter(t => t.status === column.id && !t.archived);
            
            return (
              <div key={column.id} className={`p-4 rounded-lg border-2 ${column.color} min-h-[400px]`}>
                <h3 className="font-semibold text-gray-800 dark:text-white mb-4 flex items-center justify-between">
                  <span>{column.title}</span>
                  <span className="text-sm bg-gray-200 dark:bg-gray-700 px-2 py-1 rounded">
                    {columnTasks.length}
                  </span>
                </h3>
                
                <Droppable droppableId={column.id}>
                  {(provided) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className="space-y-4 min-h-[300px]"
                    >
                      {columnTasks.map((task, index) => (
                        <Draggable key={task.id} draggableId={task.id} index={index}>
                          {(provided) => (
                            <div
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              {...provided.dragHandleProps}
                            >
                              <TrelloTaskCard
                                task={task}
                                users={users}
                                onClick={() => handleTaskCardClick(task)}
                                onUpdate={handleUpdateTask}
                                onApprove={handleTaskApprove}
                                onReject={handleTaskReject}
                                currentUser={currentUser}
                                projectTeamMembers={selectedProject?.team_members || []}
                                className="group !bg-white dark:!bg-gray-800"
                              />
                            </div>
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}
                      
                      {columnTasks.length === 0 && (
                        <div className="text-center py-8 text-gray-400">
                          <div className="text-sm">Drop tasks here</div>
                        </div>
                      )}
                    </div>
                  )}
                </Droppable>
              </div>
            );
          })}
        </div>
      </DragDropContext>
    );
  };

  // Project Tasks Table View
  const renderProjectTasksTableView = () => {
    const filteredTasks = getFilteredTasks();
    const activeTasks = filteredTasks.filter(t => !t.archived);

    return (
      <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-xl rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-700">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Task
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Status
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Priority
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Assignee
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Due Date
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {activeTasks.map((task) => {
              const assignee = users.find(u => u.id === task.assignee);
              const isOverdue = task.due_date && new Date(task.due_date) < new Date() && task.status !== 'Completed';
              
              return (
                <tr key={task.id} className="hover:bg-gray-50 dark:hover:bg-gray-900/30 transition-colors relative" style={{ zIndex: editingTaskId === task.id ? 9999 : 'auto' }}>
                  <td className="px-4 py-3">
                    <div>
                      <p className={`font-medium text-sm text-gray-900 dark:text-white ${task.status === 'Completed' ? 'line-through text-gray-500' : ''}`}>
                        {task.title}
                      </p>
                      {task.description && (
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 line-clamp-1">
                          {task.description}
                        </p>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(task.status)}`}>
                      {task.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${getPriorityColor(task.priority)}`}>
                      {task.priority}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {assignee && (
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-gradient-to-r from-blue-500 to-purple-500 flex items-center justify-center text-white text-xs font-semibold">
                          {assignee.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                        </div>
                        <span className="text-sm text-gray-700 dark:text-gray-300">{assignee.name}</span>
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {task.due_date && (
                      <span className={`text-sm ${isOverdue ? 'text-red-600 dark:text-red-400 font-medium' : 'text-gray-700 dark:text-gray-300'}`}>
                        {new Date(task.due_date).toLocaleDateString()}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => {
                          setNewTask({
                            ...task,
                            title: task.title,
                            description: task.description || '',
                            assignee: task.assignee || '',
                            due_date: task.due_date || '',
                            priority: task.priority,
                            status: task.status
                          });
                          setEditingTaskId(task.id);
                          setTaskDialogOpen(true);
                        }}
                        className="p-1.5 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded"
                        title="Edit"
                      >
                        <Edit2 className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                      </button>
                      <button
                        onClick={() => handleDeleteTask(task.id)}
                        className="p-1.5 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4 text-red-600 dark:text-red-400" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        
        {activeTasks.length === 0 && (
          <div className="text-center py-12 text-gray-500 dark:text-gray-400">
            <CheckSquare className="w-16 h-16 mx-auto mb-4 text-gray-300" />
            <p className="text-lg">No tasks found for this project</p>
            <p className="text-sm mt-2">Create your first task to get started</p>
          </div>
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }

  return (
    <div className={selectedProject ? "h-full" : "p-6 max-w-6xl mx-auto space-y-6"}>
      <div className={selectedProject ? "h-full" : ""}>
        {/* Page Header - Only show when no project is selected */}
        {!selectedProject && (
          <>
            {/* Page Title */}
            <div className="mb-6">
              <h1 className="text-3xl font-bold text-gray-800 dark:text-white mb-2">My Projects</h1>
              <p className="text-gray-600 dark:text-gray-400">View and manage your projects</p>
            </div>
            
            {/* Controls Bar */}
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center space-x-4">
                {/* Filter Toggle */}
                {currentUser?.role === 'admin' && (
                  <div className="flex items-center space-x-2 bg-white/50 dark:bg-gray-700/50 backdrop-blur-lg p-1 rounded-lg">
                    <button
                      onClick={() => setShowMyProjects(false)}
                      className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                        !showMyProjects
                          ? 'bg-gradient-to-r from-blue-500 to-purple-500 text-white shadow'
                          : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'
                      }`}
                    >
                      All Projects ({projects.filter(p => 
                        projectStatusFilter === 'active' ? (!p.archived && p.status !== 'Completed') :
                        projectStatusFilter === 'completed' ? (!p.archived && p.status === 'Completed') :
                        projectStatusFilter === 'archived' ? p.archived : false
                      ).length})
                    </button>
                    <button
                      onClick={() => setShowMyProjects(true)}
                      className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                        showMyProjects
                          ? 'bg-gradient-to-r from-blue-500 to-purple-500 text-white shadow'
                          : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'
                      }`}
                    >
                      My Projects ({projects.filter(p => 
                        (p.project_owner === currentUser?.id || p.team_members?.includes(currentUser?.id)) &&
                        (projectStatusFilter === 'active' ? (!p.archived && p.status !== 'Completed') :
                         projectStatusFilter === 'completed' ? (!p.archived && p.status === 'Completed') :
                         projectStatusFilter === 'archived' ? p.archived : false)
                      ).length})
                    </button>
                  </div>
                )}
                
                {/* Status Filter Tabs */}
                <div className="flex items-center space-x-2 bg-white/50 dark:bg-gray-700/50 backdrop-blur-lg p-1 rounded-lg">
                  <button
                    onClick={() => setProjectStatusFilter('active')}
                    className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                      projectStatusFilter === 'active'
                        ? 'bg-white/80 dark:bg-gray-600/80 backdrop-blur-lg shadow text-gray-900 dark:text-white'
                        : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'
                    }`}
                  >
                    Active
                  </button>
                  <button
                    onClick={() => setProjectStatusFilter('completed')}
                    className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                      projectStatusFilter === 'completed'
                        ? 'bg-white/80 dark:bg-gray-600/80 backdrop-blur-lg shadow text-gray-900 dark:text-white'
                        : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'
                    }`}
                  >
                    <CheckCircle className="w-4 h-4 inline mr-1" />
                    Completed
                  </button>
                  <button
                    onClick={() => setProjectStatusFilter('archived')}
                    className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                      projectStatusFilter === 'archived'
                        ? 'bg-white/80 dark:bg-gray-600/80 backdrop-blur-lg shadow text-gray-900 dark:text-white'
                        : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'
                    }`}
                  >
                    <Archive className="w-4 h-4 inline mr-1" />
                    Archived
                  </button>
                </div>
                
                {/* View Switcher */}
                <div className="flex items-center space-x-2 bg-white/50 dark:bg-gray-700/50 backdrop-blur-lg p-1 rounded-lg">
                  <button
                    onClick={() => setViewType('kanban')}
                    className={`p-2 rounded-md transition-all ${
                      viewType === 'kanban' ? 'bg-white/80 dark:bg-gray-600/80 backdrop-blur-lg shadow text-gray-900 dark:text-white' : 'hover:bg-gray-200/50 dark:hover:bg-gray-600/50 text-gray-600 dark:text-gray-300'
                    }`}
                    title="Kanban View"
                  >
                    <LayoutGrid className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setViewType('list')}
                    className={`p-2 rounded-md transition-all ${
                      viewType === 'list' ? 'bg-white/80 dark:bg-gray-600/80 backdrop-blur-lg shadow text-gray-900 dark:text-white' : 'hover:bg-gray-200/50 dark:hover:bg-gray-600/50 text-gray-600 dark:text-gray-300'
                    }`}
                    title="List View"
                  >
                    <List className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setViewType('table')}
                    className={`p-2 rounded-md transition-all ${
                      viewType === 'table' ? 'bg-white/80 dark:bg-gray-600/80 backdrop-blur-lg shadow text-gray-900 dark:text-white' : 'hover:bg-gray-200/50 dark:hover:bg-gray-600/50 text-gray-600 dark:text-gray-300'
                    }`}
                    title="Table View"
                  >
                    <Table2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Add Project Button - Hidden for clients */}
              {currentUser?.role !== 'client' && (
                <Button 
                  onClick={() => setAddProjectOpen(true)}
                  className="bg-gradient-to-r from-blue-600 via-purple-600 to-blue-600 text-white font-semibold hover:shadow-xl hover:shadow-purple-500/50 transition-all duration-300 hover:scale-105 border-0"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add Project
                </Button>
              )}
            </div>
          </>
        )}

        {/* Projects Display */}
        {filteredProjects.length === 0 ? (
          <Card className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-xl border-gray-200 dark:border-gray-700">
            <CardContent className="py-12 text-center">
              <Briefcase className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No projects found</h3>
              <p className="text-gray-500 mb-4">
                {showMyProjects ? "You don't have any assigned projects yet." : "No projects have been created yet."}
              </p>
              <Button 
                onClick={() => setAddProjectOpen(true)}
                className="text-white"
                className="bg-gradient-to-r from-blue-600 via-purple-600 to-blue-600 text-white font-semibold hover:shadow-xl hover:shadow-purple-500/50 transition-all duration-300 hover:scale-105 border-0"
              >
                <Plus className="w-4 h-4 mr-2" />
                Create Your First Project
              </Button>
            </CardContent>
          </Card>
        ) : !selectedProject ? (
          <>
            {viewType === 'kanban' && renderKanbanView()}
            {viewType === 'list' && renderListView()}
            {viewType === 'table' && renderTableView()}
          </>
        ) : null}

        {/* Project Detail View - Full Screen */}
        {selectedProject && (
          <div className="h-full flex flex-col">
            {/* Back Button and Project Header */}
            <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-xl border-b border-gray-200 dark:border-gray-700">
              {/* Back Button and Action Buttons */}
              <div className="px-6 pt-4 flex items-center justify-between">
                <button
                  onClick={() => setSelectedProject(null)}
                  className="flex items-center space-x-2 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Back to Projects</span>
                </button>
                
                <TooltipProvider>
                  <div className="flex items-center gap-3">
                    {/* Sync with GHL Button (Icon only) */}
                    {currentUser?.role !== 'client' && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            onClick={handleSyncToGHL}
                            disabled={syncingToGHL}
                            variant="ghost"
                            size="sm"
                            className="hover:bg-gray-100 dark:hover:bg-gray-700 p-2"
                          >
                            {syncingToGHL ? (
                              <Loader className="w-5 h-5 animate-spin text-gray-700 dark:text-gray-300" />
                            ) : (
                              <Upload className="w-5 h-5 text-gray-700 dark:text-gray-300" />
                            )}
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Sync with GHL</p>
                        </TooltipContent>
                      </Tooltip>
                    )}
                    
                    {/* Import Tasks via AI Button (Icon only) */}
                    {currentUser?.role !== 'client' && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            onClick={handleExtractTasksAI}
                            disabled={extractingTasks}
                            variant="ghost"
                            size="sm"
                            className="hover:bg-gray-100 dark:hover:bg-gray-700 p-2"
                          >
                            {extractingTasks ? (
                              <Loader className="w-5 h-5 animate-spin text-gray-700 dark:text-gray-300" />
                            ) : (
                              <CheckSquare className="w-5 h-5 text-gray-700 dark:text-gray-300" />
                            )}
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Import Tasks via AI</p>
                        </TooltipContent>
                      </Tooltip>
                    )}
                    
                    {/* Share Project Button (Icon only - Admin/Manager) */}
                    {(currentUser?.role === 'admin' || currentUser?.role === 'manager') && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            onClick={() => setShareDialogOpen(true)}
                            variant="ghost"
                            size="sm"
                            className="hover:bg-gray-100 dark:hover:bg-gray-700 p-2"
                          >
                            <LinkIcon className="w-5 h-5 text-gray-700 dark:text-gray-300" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Share Project</p>
                        </TooltipContent>
                      </Tooltip>
                    )}
                    
                    {/* Edit Visibility Button (Icon only - Admin/Manager) */}
                    {(currentUser?.role === 'admin' || currentUser?.role === 'manager') && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            onClick={() => {
                              setProjectForVisibility(selectedProject);
                              setVisibilityModalOpen(true);
                            }}
                            variant="ghost"
                            size="sm"
                            className="hover:bg-gray-100 dark:hover:bg-gray-700 p-2"
                          >
                            <Eye className="w-5 h-5 text-gray-700 dark:text-gray-300" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Edit Visibility</p>
                        </TooltipContent>
                      </Tooltip>
                    )}
                  </div>
                </TooltipProvider>
              </div>

              {/* Project Name and Status */}
              <div className="px-6 py-4">
                <div className="flex items-center justify-between mb-3">
                  <h1 className="text-3xl font-bold text-gray-900 dark:text-white">{selectedProject.name}</h1>
                  <span className={`px-4 py-2 rounded-full text-sm font-medium ${getStatusColor(selectedProject.status)}`}>
                    {selectedProject.status}
                  </span>
                </div>
                
                {/* Project Info Grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm mb-4">
                  <div>
                    <p className="text-gray-500 dark:text-gray-400 mb-1">Business Name</p>
                    <p className="font-medium text-gray-900 dark:text-white">{selectedProject.business_name || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-gray-500 dark:text-gray-400 mb-1">Client Name</p>
                    <p className="font-medium text-gray-900 dark:text-white">{selectedProject.client_name || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-gray-500 dark:text-gray-400 mb-1">Contact Email</p>
                    <p className="font-medium text-gray-900 dark:text-white">{selectedProject.client_email || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-gray-500 dark:text-gray-400 mb-1">Phone</p>
                    <p className="font-medium text-gray-900 dark:text-white">{selectedProject.client_phone || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-gray-500 dark:text-gray-400 mb-1">Budget</p>
                    <p className="font-medium text-gray-900 dark:text-white">{selectedProject.budget ? `$${selectedProject.budget}` : 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-gray-500 dark:text-gray-400 mb-1">Priority</p>
                    <p className="font-medium text-gray-900 dark:text-white">{selectedProject.priority || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-gray-500 dark:text-gray-400 mb-1">Project Owner</p>
                    <p className="font-medium text-gray-900 dark:text-white">
                      {users.find(u => u.id === selectedProject.project_owner)?.name || 'N/A'}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-500 dark:text-gray-400 mb-1">Team Members</p>
                    <p className="font-medium text-gray-900 dark:text-white">
                      {selectedProject.team_members?.length || 0} members
                    </p>
                  </div>
                </div>

                {/* Description */}
                {selectedProject.description && (
                  <div className="mb-4">
                    <p className="text-gray-500 dark:text-gray-400 text-sm mb-1">Description</p>
                    <p className="text-gray-700 dark:text-gray-300 text-sm">{selectedProject.description}</p>
                  </div>
                )}

                {/* Edit Button for Admin/Manager */}
                {(currentUser?.role === 'admin' || currentUser?.role === 'manager') && (
                  <button
                    onClick={() => setEditingProject(selectedProject)}
                    className="flex items-center space-x-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors"
                  >
                    <Edit className="w-4 h-4" />
                    <span>Edit Project Info</span>
                  </button>
                )}
              </div>

              {/* Full-Width Progress Bar */}
              <div className="px-6 pb-4">
                <div className="w-full">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Project Progress</p>
                    <p className="text-sm font-semibold text-gray-900 dark:text-white">{getProjectProgress(selectedProject.id)}% Complete</p>
                  </div>
                  <Progress value={getProjectProgress(selectedProject.id)} className="h-3 w-full" />
                </div>
              </div>
            </div>

            {/* Project Tabs */}
            <div className="border-b border-gray-200 dark:border-gray-700 bg-white/30 dark:bg-gray-800/30">
              <nav className="flex px-6">
                {[
                  { id: 'tasks', label: 'Tasks', icon: CheckSquare, visibilityKey: 'tasks' },
                  { id: 'useful-links', label: 'Links & Documents', icon: LinkIcon, visibilityKey: 'links_documents' },
                  { id: 'meeting-notes', label: 'Meeting Notes', icon: Video, visibilityKey: 'meeting_notes' },
                  { id: 'deliverables', label: 'Deliverables', icon: Package, visibilityKey: 'deliverables' },
                  { id: 'internal-notes', label: 'Internal Notes', icon: AlertCircle, visibilityKey: 'internal_notes' },
                  { id: 'team-guests', label: 'Team & Guests', icon: Users, visibilityKey: 'team_members' },
                  { id: 'timesheet', label: 'Timesheet', icon: Clock, visibilityKey: 'timesheet' }
                ].filter(tab => isSectionVisible(selectedProject, tab.visibilityKey)).map((tab) => {
                  const Icon = tab.icon;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`flex items-center space-x-2 py-4 px-6 border-b-2 font-medium text-sm transition-colors ${
                        activeTab === tab.id
                          ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400'
                          : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-200'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      <span>{tab.label}</span>
                    </button>
                  );
                })}
              </nav>
            </div>

              {/* Tab Content */}
              <div className="flex-1 overflow-auto p-6">
                {/* Tasks Tab */}
                {activeTab === 'tasks' && (
                  <div className="space-y-6">
                    {/* Header with View Switcher and Create Button */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-4">
                        {/* View Switcher */}
                        <div className="flex items-center space-x-2 bg-white/50 dark:bg-gray-700/50 backdrop-blur-lg p-1 rounded-lg">
                          <button
                            onClick={() => setTaskView('list')}
                            className={`p-2 rounded-md transition-all ${
                              taskView === 'list' ? 'bg-white/80 dark:bg-gray-600/80 backdrop-blur-lg shadow text-gray-900 dark:text-white' : 'hover:bg-gray-200/50 dark:hover:bg-gray-600/50 text-gray-600 dark:text-gray-300'
                            }`}
                            title="List View"
                          >
                            <LayoutList className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setTaskView('kanban')}
                            className={`p-2 rounded-md transition-all ${
                              taskView === 'kanban' ? 'bg-white/80 dark:bg-gray-600/80 backdrop-blur-lg shadow text-gray-900 dark:text-white' : 'hover:bg-gray-200/50 dark:hover:bg-gray-600/50 text-gray-600 dark:text-gray-300'
                            }`}
                            title="Kanban View"
                          >
                            <LayoutGrid className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setTaskView('table')}
                            className={`p-2 rounded-md transition-all ${
                              taskView === 'table' ? 'bg-white/80 dark:bg-gray-600/80 backdrop-blur-lg shadow text-gray-900 dark:text-white' : 'hover:bg-gray-200/50 dark:hover:bg-gray-600/50 text-gray-600 dark:text-gray-300'
                            }`}
                            title="Table View"
                          >
                            <Table2 className="w-4 h-4" />
                          </button>
                        </div>
                        
                        {/* Task Filter */}
                        <Select value={taskFilter} onValueChange={setTaskFilter}>
                          <SelectTrigger className="w-40 bg-white/80 dark:bg-gray-700/80 backdrop-blur-lg">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="activeTasks">Active Tasks</SelectItem>
                            <SelectItem value="myTasks">My Tasks</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <Button 
                        onClick={() => setTaskDialogOpen(true)}
                        className="bg-gradient-to-r from-blue-600 via-purple-600 to-blue-600 text-white font-semibold hover:shadow-xl transition-all"
                      >
                        <Plus className="w-4 h-4 mr-2" />
                        Create Task
                      </Button>
                    </div>

                    {/* Task Views */}
                    {taskView === 'list' && renderProjectTasksListView()}
                    {taskView === 'kanban' && renderProjectTasksKanbanView()}
                    {taskView === 'table' && renderProjectTasksTableView()}
                  </div>
                )}

                {/* Useful Links Tab */}
                {activeTab === 'useful-links' && (
                  <div className="space-y-6">
                    {/* Header */}
                    <div className="flex items-center justify-between">
                      <div>
                        <h2 className="text-2xl font-bold text-gray-800 dark:text-white">Useful Links</h2>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Manage important project resources and links</p>
                      </div>
                      <Button 
                        onClick={() => {
                          setSelectedDocType('docs_links');
                          setDocDialogOpen(true);
                        }}
                        className="bg-gradient-to-r from-blue-600 via-purple-600 to-blue-600 text-white font-semibold hover:shadow-xl transition-all"
                      >
                        <Plus className="w-4 h-4 mr-2" />
                        Add Link
                      </Button>
                    </div>
                    
                    {projectDocuments.filter(d => d.type === 'docs_links').length === 0 ? (
                      <div className="text-center py-16 text-gray-500 dark:text-gray-400">
                        <LinkIcon className="w-20 h-20 mx-auto mb-4 text-gray-300 dark:text-gray-600" />
                        <p className="text-xl font-medium mb-2">No useful links added yet</p>
                        <p className="text-sm">Add important links and resources for this project</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {projectDocuments.filter(d => d.type === 'docs_links').map((doc) => {
                          let domain = '';
                          let faviconUrl = '';
                          
                          try {
                            const url = new URL(doc.url);
                            domain = url.hostname;
                            faviconUrl = `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;
                          } catch (e) {
                            domain = doc.url;
                            faviconUrl = '';
                          }
                          
                          return (
                            <div key={doc.id} className="group relative bg-white/80 dark:bg-gray-800/80 backdrop-blur-xl rounded-lg border border-gray-200 dark:border-gray-700 p-4 hover:shadow-md transition-all"
                              style={{ zIndex: editingDocId === doc.id ? 9997 : 'auto' }}
                            >
                              <div className="flex items-center gap-4">
                                {/* Favicon */}
                                <div className="w-12 h-12 rounded-lg bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 flex items-center justify-center flex-shrink-0 overflow-hidden">
                                  {faviconUrl ? (
                                    <>
                                      <img 
                                        src={faviconUrl} 
                                        alt={doc.title}
                                        className="w-8 h-8"
                                        onError={(e) => {
                                          e.target.style.display = 'none';
                                          e.target.nextSibling.style.display = 'flex';
                                        }}
                                      />
                                      <LinkIcon className="w-6 h-6 text-gray-400 hidden" />
                                    </>
                                  ) : (
                                    <LinkIcon className="w-6 h-6 text-gray-400" />
                                  )}
                                </div>
                                
                                {/* Link Info - Clickable to open in new tab */}
                                <a 
                                  href={doc.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex-1 min-w-0 cursor-pointer hover:opacity-80 transition-opacity"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <h4 className="font-semibold text-base text-gray-900 dark:text-white mb-0.5 truncate">{doc.title}</h4>
                                  <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{domain}</p>
                                </a>
                                
                                {/* Three-dot Menu */}
                                <div className="relative z-50">
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setEditingDocId(editingDocId === doc.id ? null : doc.id);
                                    }}
                                    className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                                  >
                                    <svg className="w-5 h-5 text-gray-600 dark:text-gray-400" fill="currentColor" viewBox="0 0 24 24">
                                      <circle cx="12" cy="5" r="2" />
                                      <circle cx="12" cy="12" r="2" />
                                      <circle cx="12" cy="19" r="2" />
                                    </svg>
                                  </button>
                                  
                                  {/* Dropdown Menu */}
                                  {editingDocId === doc.id && (
                                    <>
                                      <div 
                                        className="fixed inset-0"
                                        style={{ zIndex: 99998 }}
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setEditingDocId(null);
                                        }}
                                      />
                                      <div className="absolute right-0 top-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl py-1 w-48"
                                        style={{
                                          zIndex: 99999
                                        }}
                                        onClick={(e) => e.stopPropagation()}
                                      >
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            navigator.clipboard.writeText(doc.url);
                                            toast.success('Link copied to clipboard');
                                            setEditingDocId(null);
                                          }}
                                          className="w-full px-4 py-2.5 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-3"
                                        >
                                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                          </svg>
                                          Copy link
                                        </button>
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setNewDoc({ title: doc.title, url: doc.url });
                                            setEditingDocId(doc.id);
                                            setSelectedDocType('docs_links');
                                            setDocDialogOpen(true);
                                          }}
                                          className="w-full px-4 py-2.5 text-left text-sm text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 flex items-center gap-3"
                                        >
                                          <Edit2 className="w-4 h-4" />
                                          Edit link
                                        </button>
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleDeleteDocument(doc.id);
                                            setEditingDocId(null);
                                          }}
                                          className="w-full px-4 py-2.5 text-left text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-3 border-t border-gray-200 dark:border-gray-700"
                                        >
                                          <Trash2 className="w-4 h-4" />
                                          Delete link
                                        </button>
                                      </div>
                                    </>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {/* Meeting Notes Tab */}
                {activeTab === 'meeting-notes' && (
                  <div className="space-y-6">
                    {/* Header */}
                    <div className="flex items-center justify-between">
                      <div>
                        <h2 className="text-2xl font-bold text-gray-800 dark:text-white">Meeting Notes</h2>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Document important meetings and discussions</p>
                      </div>
                      <Button 
                        onClick={() => {
                          setSelectedDocType('meeting_summaries');
                          setDocDialogOpen(true);
                        }}
                        className="bg-gradient-to-r from-blue-600 via-purple-600 to-blue-600 text-white font-semibold hover:shadow-xl transition-all"
                      >
                        <Plus className="w-4 h-4 mr-2" />
                        Add Notes
                      </Button>
                    </div>
                    
                    {projectDocuments.filter(d => d.type === 'meeting_summaries').length === 0 ? (
                      <div className="text-center py-16 text-gray-500 dark:text-gray-400">
                        <Video className="w-20 h-20 mx-auto mb-4 text-gray-300 dark:text-gray-600" />
                        <p className="text-xl font-medium mb-2">No meeting notes added yet</p>
                        <p className="text-sm">Document important meetings and discussions</p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {projectDocuments.filter(d => d.type === 'meeting_summaries').map((doc) => {
                          // Check if content has YouTube/Vimeo/Loom links
                          const urlRegex = /(https?:\/\/[^\s]+)/g;
                          const youtubeRegex = /(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]+)/;
                          const loomRegex = /loom\.com\/share\/([a-zA-Z0-9]+)/;
                          
                          const youtubeMatch = doc.url.match(youtubeRegex);
                          const loomMatch = doc.url.match(loomRegex);
                          
                          // Function to render text with clickable links
                          const renderTextWithLinks = (text) => {
                            const parts = text.split(urlRegex);
                            return parts.map((part, index) => {
                              if (part.match(urlRegex)) {
                                return (
                                  <a 
                                    key={index}
                                    href={part} 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className="text-indigo-600 dark:text-indigo-400 hover:underline font-medium"
                                  >
                                    {part}
                                  </a>
                                );
                              }
                              return part;
                            });
                          };
                          
                          return (
                            <div key={doc.id} className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-xl rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden hover:shadow-lg transition-all">
                              <div className="p-4">
                                <div className="flex justify-between items-start gap-4 mb-3">
                                  <h4 className="font-semibold text-lg text-gray-900 dark:text-white">{doc.title}</h4>
                                  <div className="flex gap-2">
                                    <button
                                      onClick={() => {
                                        setNewDoc({ title: doc.title, url: doc.url });
                                        setEditingDocId(doc.id);
                                        setSelectedDocType('meeting_summaries');
                                        setDocDialogOpen(true);
                                      }}
                                      className="p-2 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors"
                                      title="Edit notes"
                                    >
                                      <Edit2 className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                                    </button>
                                    <button
                                      onClick={() => handleDeleteDocument(doc.id)}
                                      className="p-2 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                                      title="Delete notes"
                                    >
                                      <Trash2 className="w-4 h-4 text-red-600 dark:text-red-400" />
                                    </button>
                                  </div>
                                </div>
                                <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap leading-relaxed">
                                  {renderTextWithLinks(doc.url)}
                                </p>
                              </div>
                              
                              {/* Embedded Video */}
                              {youtubeMatch && (
                                <div className="px-4 pb-4">
                                  <div className="aspect-video rounded-lg overflow-hidden">
                                    <iframe
                                      src={`https://www.youtube.com/embed/${youtubeMatch[1]}`}
                                      title={doc.title}
                                      className="w-full h-full"
                                      frameBorder="0"
                                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                      allowFullScreen
                                    ></iframe>
                                  </div>
                                </div>
                              )}
                              
                              {loomMatch && (
                                <div className="px-4 pb-4">
                                  <div className="aspect-video rounded-lg overflow-hidden">
                                    <iframe
                                      src={`https://www.loom.com/embed/${loomMatch[1]}`}
                                      title={doc.title}
                                      className="w-full h-full"
                                      frameBorder="0"
                                      allowFullScreen
                                    ></iframe>
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {/* Deliverables Tab */}
                {activeTab === 'deliverables' && (
                  <div className="space-y-6">
                    {/* Header */}
                    <div className="flex items-center justify-between">
                      <div>
                        <h2 className="text-2xl font-bold text-gray-800 dark:text-white">Deliverables</h2>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Track project deliverables and milestones</p>
                      </div>
                      <Button 
                        onClick={() => {
                          setSelectedDocType('deliverables');
                          setDocDialogOpen(true);
                        }}
                        className="bg-gradient-to-r from-blue-600 via-purple-600 to-blue-600 text-white font-semibold hover:shadow-xl transition-all"
                      >
                        <Plus className="w-4 h-4 mr-2" />
                        Add Deliverable
                      </Button>
                    </div>
                    
                    {projectDocuments.filter(d => d.type === 'deliverables').length === 0 ? (
                      <div className="text-center py-16 text-gray-500 dark:text-gray-400">
                        <Package className="w-20 h-20 mx-auto mb-4 text-gray-300 dark:text-gray-600" />
                        <p className="text-xl font-medium mb-2">No deliverables added yet</p>
                        <p className="text-sm">Track project deliverables and milestones</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {projectDocuments.filter(d => d.type === 'deliverables').map((doc) => (
                          <div key={doc.id} className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-xl rounded-lg border border-gray-200 dark:border-gray-700 p-4 hover:shadow-md transition-shadow">
                            <div className="flex justify-between items-start gap-4">
                              <div className="flex-1 min-w-0 space-y-2">
                                <h4 className="font-semibold text-lg text-gray-900 dark:text-white">{doc.title}</h4>
                                <p className="text-sm text-gray-600 dark:text-gray-400 whitespace-pre-wrap">{doc.url}</p>
                              </div>
                              <button
                                onClick={() => handleDeleteDocument(doc.id)}
                                className="p-2 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors flex-shrink-0"
                              >
                                <Trash2 className="w-4 h-4 text-red-600 dark:text-red-400" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Internal Notes Tab */}
                {activeTab === 'internal-notes' && (
                  <div className="space-y-6">
                    {/* Header */}
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="flex items-center space-x-3 mb-2">
                          <AlertCircle className="w-6 h-6 text-amber-500" />
                          <h2 className="text-2xl font-bold text-gray-800 dark:text-white">Internal Notes</h2>
                        </div>
                        <p className="text-sm text-amber-600 dark:text-amber-400 font-medium">
                          ⚠️ These notes are internal only - guests cannot see them
                        </p>
                      </div>
                      <Button 
                        onClick={() => {
                          setEditingNoteId(null);
                          setNewNote('');
                          setNoteDialogOpen(true);
                        }}
                        className="bg-gradient-to-r from-blue-600 via-purple-600 to-blue-600 text-white font-semibold hover:shadow-xl transition-all"
                      >
                        <Plus className="w-4 h-4 mr-2" />
                        Add Note
                      </Button>
                    </div>

                    {/* Sticky Notes Grid */}
                    {internalNotes.length === 0 ? (
                      <div className="text-center py-16 text-gray-500 dark:text-gray-400">
                        <AlertCircle className="w-20 h-20 mx-auto mb-4 text-gray-300 dark:text-gray-600" />
                        <p className="text-xl font-medium mb-2">No internal notes yet</p>
                        <p className="text-sm">Click "Add Note" to create your first sticky note</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                        {internalNotes.map((note, index) => {
                          const author = users.find(u => u.id === note.created_by);
                          const isOwner = currentUser?.id === note.created_by;
                          const colors = [
                            'bg-yellow-100 border-yellow-300 shadow-yellow-200',
                            'bg-pink-100 border-pink-300 shadow-pink-200',
                            'bg-blue-100 border-blue-300 shadow-blue-200',
                            'bg-green-100 border-green-300 shadow-green-200',
                            'bg-purple-100 border-purple-300 shadow-purple-200',
                            'bg-orange-100 border-orange-300 shadow-orange-200'
                          ];
                          const colorClass = colors[index % colors.length];
                          
                          return (
                            <div 
                              key={note.id} 
                              className={`group relative p-4 rounded-lg border-2 shadow-md hover:shadow-xl transition-all transform hover:-rotate-1 ${colorClass}`}
                              style={{
                                minHeight: '200px',
                                transform: `rotate(${(index % 3 - 1) * 2}deg)`
                              }}
                            >
                              {/* Pin at top */}
                              <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                                <div className="w-6 h-6 rounded-full bg-red-500 shadow-lg border-2 border-red-600"></div>
                              </div>
                              
                              {/* Edit and Delete buttons - only for owner */}
                              {isOwner && (
                                <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <button
                                    onClick={() => {
                                      setNewNote(note.content);
                                      setEditingNoteId(note.id);
                                      setNoteDialogOpen(true);
                                    }}
                                    className="p-1.5 bg-blue-100 hover:bg-blue-200 rounded-full transition-colors"
                                    title="Edit note"
                                  >
                                    <Edit2 className="w-3.5 h-3.5 text-blue-600" />
                                  </button>
                                  <button
                                    onClick={() => handleDeleteNote(note.id)}
                                    className="p-1.5 bg-red-100 hover:bg-red-200 rounded-full transition-colors"
                                    title="Delete note"
                                  >
                                    <X className="w-3.5 h-3.5 text-red-600" />
                                  </button>
                                </div>
                              )}
                              
                              {/* Note content */}
                              <div className="mt-4 mb-16">
                                <p className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">
                                  {note.content}
                                </p>
                              </div>
                              
                              {/* Author info at bottom */}
                              <div className="absolute bottom-3 left-3 right-3 pt-3 border-t border-gray-400/30">
                                <div className="flex items-center gap-2">
                                  <div className="w-6 h-6 rounded-full bg-gradient-to-r from-blue-500 to-purple-500 flex items-center justify-center text-white text-xs font-semibold">
                                    {author?.name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || '??'}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-xs font-semibold text-gray-700 truncate">{author?.name || 'Unknown'}</p>
                                    <p className="text-xs text-gray-600">
                                      {new Date(note.created_at).toLocaleDateString()}
                                    </p>
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {/* Timesheet Tab */}
                {activeTab === 'timesheet' && (
                  <div className="space-y-6">
                    {/* Header */}
                    <div className="flex items-center justify-between">
                      <div>
                        <h2 className="text-2xl font-bold text-gray-800 dark:text-white">Timesheet</h2>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">View time spent on project tasks</p>
                      </div>
                    </div>

                    {/* Timesheet Summary Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <Card className="bg-gradient-to-r from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20">
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-sm text-blue-600 dark:text-blue-400 font-medium">Total Hours</p>
                              <p className="text-2xl font-bold text-blue-900 dark:text-blue-300">
                                {(projectTasks.reduce((total, task) => {
                                  const timeEntries = timeTrackingData?.time_entries?.filter(entry => entry.task_id === task.id) || [];
                                  return total + timeEntries.reduce((sum, entry) => sum + (entry.duration_seconds || 0), 0);
                                }, 0) / 3600).toFixed(1)}h
                              </p>
                            </div>
                            <Clock className="w-10 h-10 text-blue-600 dark:text-blue-400" />
                          </div>
                        </CardContent>
                      </Card>

                      <Card className="bg-gradient-to-r from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20">
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-sm text-green-600 dark:text-green-400 font-medium">Completed Tasks</p>
                              <p className="text-2xl font-bold text-green-900 dark:text-green-300">
                                {projectTasks.filter(t => t.status === 'Completed').length}/{projectTasks.length}
                              </p>
                            </div>
                            <CheckSquare className="w-10 h-10 text-green-600 dark:text-green-400" />
                          </div>
                        </CardContent>
                      </Card>

                      <Card className="bg-gradient-to-r from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20">
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-sm text-purple-600 dark:text-purple-400 font-medium">Active Tasks</p>
                              <p className="text-2xl font-bold text-purple-900 dark:text-purple-300">
                                {projectTasks.filter(t => t.status === 'In Progress').length}
                              </p>
                            </div>
                            <Activity className="w-10 h-10 text-purple-600 dark:text-purple-400" />
                          </div>
                        </CardContent>
                      </Card>
                    </div>

                    {/* Task Time Breakdown Table */}
                    <Card>
                      <CardContent className="p-6">
                        <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-4">Task Time Breakdown</h3>
                        
                        {projectTasks.length === 0 ? (
                          <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                            <Clock className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                            <p className="text-lg">No tasks found</p>
                          </div>
                        ) : (
                          <div className="overflow-x-auto">
                            <table className="w-full">
                              <thead>
                                <tr className="border-b border-gray-200 dark:border-gray-700">
                                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700 dark:text-gray-300">Task</th>
                                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700 dark:text-gray-300">Status</th>
                                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700 dark:text-gray-300">Assignee</th>
                                  <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700 dark:text-gray-300">Time Spent</th>
                                </tr>
                              </thead>
                              <tbody>
                                {projectTasks.map(task => {
                                  const assignee = users.find(u => u.id === task.assignee || u.email === task.assignee);
                                  const timeEntries = timeTrackingData?.time_entries?.filter(entry => entry.task_id === task.id) || [];
                                  const totalSeconds = timeEntries.reduce((sum, entry) => sum + (entry.duration_seconds || 0), 0);
                                  const hours = Math.floor(totalSeconds / 3600);
                                  const minutes = Math.floor((totalSeconds % 3600) / 60);
                                  
                                  return (
                                    <tr key={task.id} className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                                      <td className="py-3 px-4">
                                        <p className="font-medium text-gray-900 dark:text-white">{task.title}</p>
                                      </td>
                                      <td className="py-3 px-4">
                                        <span className={`px-2 py-1 rounded text-xs font-medium ${
                                          task.status === 'Completed' ? 'bg-green-100 text-green-800' :
                                          task.status === 'In Progress' ? 'bg-blue-100 text-blue-800' :
                                          task.status === 'Under Review' ? 'bg-purple-100 text-purple-800' :
                                          'bg-gray-100 text-gray-800'
                                        }`}>
                                          {task.status}
                                        </span>
                                      </td>
                                      <td className="py-3 px-4">
                                        {assignee ? (
                                          <div className="flex items-center space-x-2">
                                            <div className="w-6 h-6 rounded-full bg-purple-600 flex items-center justify-center text-white text-xs font-semibold">
                                              {assignee.name?.charAt(0) || 'U'}
                                            </div>
                                            <span className="text-sm text-gray-700 dark:text-gray-300">{assignee.name}</span>
                                          </div>
                                        ) : (
                                          <span className="text-sm text-gray-400">Unassigned</span>
                                        )}
                                      </td>
                                      <td className="py-3 px-4 text-right">
                                        <span className="font-mono text-sm font-semibold text-gray-900 dark:text-white">
                                          {hours > 0 && `${hours}h `}
                                          {minutes}m
                                        </span>
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                              <tfoot>
                                <tr className="bg-gray-50 dark:bg-gray-800/50 font-semibold">
                                  <td colSpan="3" className="py-3 px-4 text-right text-gray-900 dark:text-white">
                                    Total Project Time:
                                  </td>
                                  <td className="py-3 px-4 text-right">
                                    <span className="font-mono text-lg text-blue-600 dark:text-blue-400">
                                      {(projectTasks.reduce((total, task) => {
                                        const timeEntries = timeTrackingData?.time_entries?.filter(entry => entry.task_id === task.id) || [];
                                        return total + timeEntries.reduce((sum, entry) => sum + (entry.duration_seconds || 0), 0);
                                      }, 0) / 3600).toFixed(1)}h
                                    </span>
                                  </td>
                                </tr>
                              </tfoot>
                            </table>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </div>
                )}

                {/* Team & Guests Tab */}
                {activeTab === 'team-guests' && (
                  <div className="space-y-6">
                    {/* Header */}
                    <div>
                      <h2 className="text-2xl font-bold text-gray-800 dark:text-white mb-1">Team & Guests</h2>
                      <p className="text-sm text-gray-500 dark:text-gray-400">View all team members and guests with access to this project</p>
                    </div>

                    {/* Team Members Section */}
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <Users className="w-5 h-5 text-indigo-600" />
                        <h3 className="text-lg font-semibold text-gray-800 dark:text-white">
                          Team Members ({[selectedProject.created_by, ...(selectedProject.team_members || [])].length})
                        </h3>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {[selectedProject.created_by, ...(selectedProject.team_members || [])]
                          .map(memberId => users.find(u => u.id === memberId))
                          .filter(Boolean)
                          .map((member) => (
                            <div key={member.id} className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-xl rounded-lg border border-gray-200 dark:border-gray-700 p-4 hover:shadow-md transition-all">
                              <div className="flex items-center gap-3">
                                <div className="w-12 h-12 rounded-full bg-gradient-to-r from-blue-500 to-purple-500 flex items-center justify-center text-white text-lg font-bold flex-shrink-0">
                                  {member.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="font-semibold text-gray-900 dark:text-white truncate">{member.name}</p>
                                  <p className="text-sm text-gray-600 dark:text-gray-400 truncate">{member.email}</p>
                                  <div className="flex items-center gap-2 mt-1">
                                    <span className={`inline-block px-2 py-0.5 text-xs font-medium rounded-full ${
                                      member.id === selectedProject.created_by 
                                        ? 'bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-200'
                                        : member.role === 'admin'
                                        ? 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-200'
                                        : member.role === 'manager'
                                        ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-200'
                                        : 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-200'
                                    }`}>
                                      {member.id === selectedProject.created_by ? 'Owner' : member.role}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            </div>
                          ))}
                      </div>
                    </div>

                    {/* Guests Section */}
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <User className="w-5 h-5 text-green-600" />
                        <h3 className="text-lg font-semibold text-gray-800 dark:text-white">
                          Guests ({selectedProject.guests?.length || 0})
                        </h3>
                      </div>
                      
                      {(!selectedProject.guests || selectedProject.guests.length === 0) ? (
                        <div className="text-center py-12 bg-white/30 dark:bg-gray-800/30 backdrop-blur-xl rounded-lg border border-gray-200 dark:border-gray-700">
                          <User className="w-16 h-16 mx-auto mb-3 text-gray-300 dark:text-gray-600" />
                          <p className="text-gray-500 dark:text-gray-400">No guests have joined this project yet</p>
                          {(currentUser?.role === 'admin' || currentUser?.role === 'manager') && (
                            <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">Share the guest link to invite collaborators</p>
                          )}
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                          {selectedProject.guests
                            .map(guestId => users.find(u => u.id === guestId))
                            .filter(Boolean)
                            .map((guest) => (
                              <div key={guest.id} className="bg-green-50/50 dark:bg-green-900/10 backdrop-blur-xl rounded-lg border border-green-200 dark:border-green-800 p-4 hover:shadow-md transition-all">
                                <div className="flex items-center gap-3">
                                  <div className="w-12 h-12 rounded-full bg-gradient-to-r from-green-500 to-teal-500 flex items-center justify-center text-white text-lg font-bold flex-shrink-0">
                                    {guest.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="font-semibold text-gray-900 dark:text-white truncate">{guest.name}</p>
                                    <p className="text-sm text-gray-600 dark:text-gray-400 truncate">{guest.email}</p>
                                    <span className="inline-block mt-1 px-2 py-0.5 text-xs font-medium rounded-full bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-200">
                                      Guest
                                    </span>
                                  </div>
                                </div>
                              </div>
                            ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}

              </div>
          </div>
        )}
      </div>

      {/* Add Project Dialog */}
      <Dialog open={addProjectOpen} onOpenChange={setAddProjectOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create New Project</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAddProject} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Project Name *</Label>
                <Input
                  id="name"
                  value={newProject.name}
                  onChange={(e) => setNewProject({ ...newProject, name: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="business_name">Business Name</Label>
                <Input
                  id="business_name"
                  value={newProject.business_name}
                  onChange={(e) => setNewProject({ ...newProject, business_name: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="client_name">Client Name *</Label>
                <Input
                  id="client_name"
                  value={newProject.client_name}
                  onChange={(e) => setNewProject({ ...newProject, client_name: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="client_email">Client Email *</Label>
                <Input
                  id="client_email"
                  type="email"
                  value={newProject.client_email}
                  onChange={(e) => setNewProject({ ...newProject, client_email: e.target.value })}
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="client_phone">Client Phone</Label>
                <Input
                  id="client_phone"
                  value={newProject.client_phone}
                  onChange={(e) => setNewProject({ ...newProject, client_phone: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="budget">Budget ($)</Label>
                <Input
                  id="budget"
                  type="number"
                  value={newProject.budget}
                  onChange={(e) => setNewProject({ ...newProject, budget: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="start_date">Start Date *</Label>
                <Input
                  id="start_date"
                  type="date"
                  value={newProject.start_date}
                  onChange={(e) => setNewProject({ ...newProject, start_date: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="end_date">End Date / Deadline</Label>
                <Input
                  id="end_date"
                  type="date"
                  value={newProject.end_date}
                  onChange={(e) => setNewProject({ ...newProject, end_date: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <select
                  id="status"
                  value={newProject.status}
                  onChange={(e) => setNewProject({ ...newProject, status: e.target.value })}
                  className="w-full p-2 border border-gray-300 rounded-md"
                >
                  {KANBAN_COLUMNS.map(col => (
                    <option key={col.id} value={col.id}>{col.title}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="priority">Priority</Label>
                <select
                  id="priority"
                  value={newProject.priority}
                  onChange={(e) => setNewProject({ ...newProject, priority: e.target.value })}
                  className="w-full p-2 border border-gray-300 rounded-md"
                >
                  <option value="Low">Low</option>
                  <option value="Medium">Medium</option>
                  <option value="High">High</option>
                </select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="project_owner">Project Owner</Label>
              <select
                id="project_owner"
                value={newProject.project_owner}
                onChange={(e) => setNewProject({ ...newProject, project_owner: e.target.value })}
                className="w-full p-2 border border-gray-300 rounded-md"
              >
                <option value="">Select Owner</option>
                {users
                  .filter(user => user.name && user.name !== 'Unknown' && user.email && user.role !== 'client')
                  .sort((a, b) => a.name.localeCompare(b.name))
                  .map(user => (
                    <option key={user.id} value={user.id}>
                      {user.name}
                    </option>
                  ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="team_members">Team Members</Label>
              <div className="border border-gray-300 rounded-md p-3 max-h-[250px] overflow-y-auto bg-white">
                {users
                  .filter(user => user.name && user.name !== 'Unknown' && user.email && user.role !== 'client')
                  .sort((a, b) => a.name.localeCompare(b.name))
                  .map(user => (
                    <label 
                      key={user.id} 
                      className="flex items-center space-x-3 p-2 hover:bg-gray-50 rounded cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={newProject.team_members.includes(user.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setNewProject({
                              ...newProject,
                              team_members: [...newProject.team_members, user.id]
                            });
                          } else {
                            setNewProject({
                              ...newProject,
                              team_members: newProject.team_members.filter(id => id !== user.id)
                            });
                          }
                        }}
                        className="w-4 h-4 text-purple-600 rounded border-gray-300 focus:ring-purple-500"
                      />
                      <div className="w-8 h-8 rounded-full bg-gradient-to-r from-blue-500 to-purple-500 flex items-center justify-center text-white text-xs font-semibold flex-shrink-0">
                        {user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                      </div>
                      <span className="text-sm font-medium flex-1">{user.name}</span>
                    </label>
                  ))}
              </div>
              <p className="text-xs text-gray-500 mt-2">
                Selected: {newProject.team_members.length} member(s)
              </p>
              {newProject.team_members.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2 p-3 bg-gray-50 rounded-md">
                  {newProject.team_members.map(memberId => {
                    const member = users.find(u => u.id === memberId);
                    return member ? (
                      <div key={memberId} className="flex items-center space-x-2 bg-white px-3 py-2 rounded-full border shadow-sm">
                        {member.profile_image_url ? (
                          <img 
                            src={member.profile_image_url} 
                            alt={member.name}
                            className="w-6 h-6 rounded-full object-cover"
                          />
                        ) : (
                          <div className={`w-6 h-6 rounded-full ${getUserAvatarColor(member.id, member.email)} flex items-center justify-center text-white text-xs font-semibold`}>
                            {getUserInitials(member.name)}
                          </div>
                        )}
                        <span className="text-sm font-medium">{member.name}</span>
                        <button
                          type="button"
                          onClick={() => setNewProject({
                            ...newProject,
                            team_members: newProject.team_members.filter(id => id !== memberId)
                          })}
                          className="text-gray-400 hover:text-red-500 font-bold"
                        >
                          ×
                        </button>
                      </div>
                    ) : null;
                  })}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <textarea
                id="description"
                value={newProject.description}
                onChange={(e) => setNewProject({ ...newProject, description: e.target.value })}
                className="w-full p-2 border border-gray-300 rounded-md min-h-[100px]"
              />
            </div>

            <div className="flex justify-end space-x-2 pt-4">
              <Button type="button" variant="outline" onClick={() => setAddProjectOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" className="bg-gradient-to-r from-blue-600 via-purple-600 to-blue-600 text-white font-semibold hover:shadow-xl hover:shadow-purple-500/50 transition-all duration-300 hover:scale-105 border-0">
                Create Project
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Project Dialog */}
      <Dialog open={!!editingProject} onOpenChange={(open) => !open && setEditingProject(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{currentUser?.role === 'admin' || currentUser?.role === 'manager' ? 'Edit Project' : 'View Project Details'}</DialogTitle>
          </DialogHeader>
          {editingProject && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Project Name</Label>
                  <Input
                    value={editingProject.name}
                    disabled={currentUser?.role !== 'admin' && currentUser?.role !== 'manager'}
                    onChange={(e) => setEditingProject({ ...editingProject, name: e.target.value })}
                    className={currentUser?.role !== 'admin' && currentUser?.role !== 'manager' ? "bg-gray-100 dark:bg-gray-800 cursor-not-allowed" : ""}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Business Name</Label>
                  <Input
                    value={editingProject.business_name || ''}
                    disabled={currentUser?.role !== 'admin' && currentUser?.role !== 'manager'}
                    onChange={(e) => setEditingProject({ ...editingProject, business_name: e.target.value })}
                    className={currentUser?.role !== 'admin' && currentUser?.role !== 'manager' ? "bg-gray-100 dark:bg-gray-800 cursor-not-allowed" : ""}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Client Name</Label>
                  <Input
                    value={editingProject.client_name}
                    disabled={currentUser?.role !== 'admin' && currentUser?.role !== 'manager'}
                    onChange={(e) => setEditingProject({ ...editingProject, client_name: e.target.value })}
                    className={currentUser?.role !== 'admin' && currentUser?.role !== 'manager' ? "bg-gray-100 dark:bg-gray-800 cursor-not-allowed" : ""}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Client Email</Label>
                  <Input
                    value={editingProject.client_email || ''}
                    disabled={currentUser?.role !== 'admin' && currentUser?.role !== 'manager'}
                    onChange={(e) => setEditingProject({ ...editingProject, client_email: e.target.value })}
                    className={currentUser?.role !== 'admin' && currentUser?.role !== 'manager' ? "bg-gray-100 dark:bg-gray-800 cursor-not-allowed" : ""}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Client Phone</Label>
                  <Input
                    value={editingProject.client_phone || ''}
                    disabled={currentUser?.role !== 'admin' && currentUser?.role !== 'manager'}
                    onChange={(e) => setEditingProject({ ...editingProject, client_phone: e.target.value })}
                    className={currentUser?.role !== 'admin' && currentUser?.role !== 'manager' ? "bg-gray-100 dark:bg-gray-800 cursor-not-allowed" : ""}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Budget</Label>
                  <Input
                    type="number"
                    value={editingProject.budget || 0}
                    disabled={currentUser?.role !== 'admin' && currentUser?.role !== 'manager'}
                    onChange={(e) => setEditingProject({ ...editingProject, budget: parseFloat(e.target.value) })}
                    className={currentUser?.role !== 'admin' && currentUser?.role !== 'manager' ? "bg-gray-100 dark:bg-gray-800 cursor-not-allowed" : ""}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Start Date</Label>
                  <Input
                    type="date"
                    value={editingProject.start_date || ''}
                    disabled={currentUser?.role !== 'admin' && currentUser?.role !== 'manager'}
                    onChange={(e) => setEditingProject({ ...editingProject, start_date: e.target.value })}
                    className={currentUser?.role !== 'admin' && currentUser?.role !== 'manager' ? "bg-gray-100 dark:bg-gray-800 cursor-not-allowed" : ""}
                  />
                </div>
                <div className="space-y-2">
                  <Label>End Date</Label>
                  <Input
                    type="date"
                    value={editingProject.end_date || ''}
                    disabled={currentUser?.role !== 'admin' && currentUser?.role !== 'manager'}
                    onChange={(e) => setEditingProject({ ...editingProject, end_date: e.target.value })}
                    className={currentUser?.role !== 'admin' && currentUser?.role !== 'manager' ? "bg-gray-100 dark:bg-gray-800 cursor-not-allowed" : ""}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Status</Label>
                  <select
                    value={editingProject.status}
                    disabled={currentUser?.role !== 'admin' && currentUser?.role !== 'manager'}
                    onChange={(e) => setEditingProject({ ...editingProject, status: e.target.value })}
                    className={`w-full p-2 border border-gray-300 rounded-md ${currentUser?.role !== 'admin' && currentUser?.role !== 'manager' ? "bg-gray-100 dark:bg-gray-800 cursor-not-allowed" : ""}`}
                  >
                    {KANBAN_COLUMNS.map(col => (
                      <option key={col.id} value={col.id}>{col.title}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label>Priority</Label>
                  <select
                    value={editingProject.priority}
                    disabled={currentUser?.role !== 'admin' && currentUser?.role !== 'manager'}
                    onChange={(e) => setEditingProject({ ...editingProject, priority: e.target.value })}
                    className={`w-full p-2 border border-gray-300 rounded-md ${currentUser?.role !== 'admin' && currentUser?.role !== 'manager' ? "bg-gray-100 dark:bg-gray-800 cursor-not-allowed" : ""}`}
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
                  value={editingProject.project_owner || ''}
                  disabled={currentUser?.role !== 'admin' && currentUser?.role !== 'manager'}
                  onChange={(e) => setEditingProject({ ...editingProject, project_owner: e.target.value })}
                  className={`w-full p-2 border border-gray-300 rounded-md ${currentUser?.role !== 'admin' && currentUser?.role !== 'manager' ? "bg-gray-100 dark:bg-gray-800 cursor-not-allowed" : ""}`}
                >
                  <option value="">Select Owner</option>
                  {users
                    .filter(user => user.name && user.name !== 'Unknown' && user.email && user.role !== 'client')
                    .sort((a, b) => a.name.localeCompare(b.name))
                    .map(user => (
                      <option key={user.id} value={user.id}>{user.name}</option>
                    ))}
                </select>
              </div>

              <div className="space-y-2">
                <Label>Team Members</Label>
                <div className="border border-gray-300 rounded-md p-3 max-h-[250px] overflow-y-auto bg-white">
                  {users
                    .filter(user => user.name && user.name !== 'Unknown' && user.email && user.role !== 'client')
                    .sort((a, b) => a.name.localeCompare(b.name))
                    .map(user => (
                      <label 
                        key={user.id} 
                        className={`flex items-center space-x-3 p-2 rounded ${currentUser?.role === 'admin' || currentUser?.role === 'manager' ? 'hover:bg-gray-50 cursor-pointer' : 'opacity-60'}`}
                      >
                        <input
                          type="checkbox"
                          checked={editingProject.team_members?.includes(user.id) || false}
                          disabled={currentUser?.role !== 'admin' && currentUser?.role !== 'manager'}
                          onChange={(e) => {
                            if (currentUser?.role === 'admin' || currentUser?.role === 'manager') {
                              const currentTeam = editingProject.team_members || [];
                              if (e.target.checked) {
                                setEditingProject({
                                  ...editingProject,
                                  team_members: [...currentTeam, user.id]
                                });
                              } else {
                                setEditingProject({
                                  ...editingProject,
                                  team_members: currentTeam.filter(id => id !== user.id)
                                });
                              }
                            }
                          }}
                          className={`w-4 h-4 text-purple-600 rounded border-gray-300 focus:ring-purple-500 ${currentUser?.role !== 'admin' && currentUser?.role !== 'manager' ? 'cursor-not-allowed opacity-50' : ''}`}
                        />
                        <div className="w-8 h-8 rounded-full bg-gradient-to-r from-blue-500 to-purple-500 flex items-center justify-center text-white text-xs font-semibold flex-shrink-0">
                          {user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                        </div>
                        <span className="text-sm font-medium flex-1">{user.name}</span>
                      </label>
                    ))}
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  Selected: {editingProject.team_members?.length || 0} member(s)
                </p>
              </div>

              <div className="space-y-2">
                <Label>Description</Label>
                <textarea
                  value={editingProject.description || ''}
                  disabled={currentUser?.role !== 'admin' && currentUser?.role !== 'manager'}
                  onChange={(e) => setEditingProject({ ...editingProject, description: e.target.value })}
                  className={`w-full p-2 border border-gray-300 rounded-md min-h-[100px] ${currentUser?.role !== 'admin' && currentUser?.role !== 'manager' ? "bg-gray-100 dark:bg-gray-800 cursor-not-allowed" : ""}`}
                />
              </div>

              <div className="flex justify-end space-x-2 pt-4">
                <Button variant="outline" onClick={() => setEditingProject(null)}>
                  {currentUser?.role === 'admin' || currentUser?.role === 'manager' ? 'Cancel' : 'Close'}
                </Button>
                {(currentUser?.role === 'admin' || currentUser?.role === 'manager') && (
                  <Button 
                    onClick={async () => {
                      await handleUpdateProject(editingProject.id, editingProject);
                      setEditingProject(null);
                    }}
                    className="bg-gradient-to-r from-blue-600 via-purple-600 to-blue-600 text-white font-semibold hover:shadow-xl hover:shadow-purple-500/50 transition-all duration-300 hover:scale-105 border-0"
                  >
                    Save Changes
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Project Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Delete Project</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              This action cannot be undone. This will permanently delete the project and all associated data.
            </p>
            <p className="text-sm font-medium text-gray-800 dark:text-gray-200">
              Type <span className="font-bold">DELETE</span> to confirm:
            </p>
            <Input
              value={deleteConfirmation}
              onChange={(e) => setDeleteConfirmation(e.target.value)}
              placeholder="Type DELETE to confirm"
            />
            <div className="flex justify-end space-x-2 pt-4">
              <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
                Cancel
              </Button>
              <Button 
                onClick={confirmDeleteProject}
                variant="destructive"
                disabled={deleteConfirmation !== 'DELETE'}
              >
                Delete Project
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Task Dialog */}
      <Dialog open={taskDialogOpen} onOpenChange={(open) => {
        setTaskDialogOpen(open);
        if (!open) {
          setEditingTaskId(null);
          setNewTask({
            title: '',
            description: '',
            assignee: '',
            due_date: '',
            priority: 'Medium',
            status: 'Not Started'
          });
        }
      }}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto bg-white/95 dark:bg-gray-800/95 backdrop-blur-xl">
          <DialogHeader>
            <DialogTitle>{editingTaskId ? 'Edit Task' : 'Create New Task'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="task-title">Title</Label>
              <Input
                id="task-title"
                value={newTask.title}
                onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
                placeholder="Enter task title"
              />
            </div>
            <div>
              <Label htmlFor="task-description">Description</Label>
              <Textarea
                id="task-description"
                value={newTask.description}
                onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
                placeholder="Enter task description"
                className="min-h-[80px]"
              />
            </div>
            <div>
              <Label htmlFor="task-assignee">Assignee</Label>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {users
                  .filter(user => selectedProject?.team_members?.includes(user.id))
                  .map(user => (
                    <div
                      key={user.id}
                      onClick={() => setNewTask({ ...newTask, assignee: user.id })}
                      className={`flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all ${
                        newTask.assignee === user.id
                          ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20'
                          : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                      }`}
                    >
                      <div className="w-10 h-10 rounded-full bg-gradient-to-r from-blue-500 to-purple-500 flex items-center justify-center text-white font-semibold flex-shrink-0">
                        {user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900 dark:text-white truncate">{user.name}</p>
                        <p className="text-sm text-gray-500 dark:text-gray-400 truncate">{user.email}</p>
                      </div>
                      {newTask.assignee === user.id && (
                        <CheckCircle className="w-5 h-5 text-indigo-600 flex-shrink-0" />
                      )}
                    </div>
                  ))}
              </div>
              {selectedProject?.team_members?.length === 0 && (
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                  No team members in this project. Add team members to the project first.
                </p>
              )}
            </div>
            <div>
              <Label htmlFor="task-due-date">Due Date</Label>
              <Input
                id="task-due-date"
                type="date"
                value={newTask.due_date}
                onChange={(e) => setNewTask({ ...newTask, due_date: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="task-priority">Priority</Label>
              <select
                id="task-priority"
                value={newTask.priority}
                onChange={(e) => setNewTask({ ...newTask, priority: e.target.value })}
                className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700"
              >
                <option value="Low">Low</option>
                <option value="Medium">Medium</option>
                <option value="High">High</option>
              </select>
            </div>
            <div>
              <Label htmlFor="task-status">Status</Label>
              <select
                id="task-status"
                value={newTask.status}
                onChange={(e) => setNewTask({ ...newTask, status: e.target.value })}
                className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700"
              >
                <option value="Not Started">Not Started</option>
                <option value="In Progress">In Progress</option>
                <option value="Under Review">Under Review</option>
                <option value="Completed">Completed</option>
              </select>
            </div>
            <div className="flex justify-end space-x-2 pt-4">
              <Button variant="outline" onClick={() => setTaskDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreateTask} className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white">
                {editingTaskId ? 'Update Task' : 'Create Task'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Document Dialog */}
      <Dialog open={docDialogOpen} onOpenChange={(open) => {
        setDocDialogOpen(open);
        if (!open) {
          setEditingDocId(null);
          setNewDoc({ title: '', url: '' });
          setUploadMode('link');
          setUploadedFile(null);
        }
      }}>
        <DialogContent className="max-w-md bg-white/95 dark:bg-gray-800/95 backdrop-blur-xl">
          <DialogHeader>
            <DialogTitle>
              {editingDocId ? 'Edit' : 'Add'} {' '}
              {selectedDocType === 'docs_links' && 'Link or Document'}
              {selectedDocType === 'meeting_summaries' && 'Meeting Notes'}
              {selectedDocType === 'deliverables' && 'Deliverable'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* Toggle between Link and Document for docs_links */}
            {selectedDocType === 'docs_links' && !editingDocId && (
              <div className="flex items-center gap-2 p-2 bg-gray-100 dark:bg-gray-800 rounded-lg">
                <button
                  onClick={() => setUploadMode('link')}
                  className={`flex-1 py-2 px-4 rounded-md transition-all ${
                    uploadMode === 'link'
                      ? 'bg-indigo-600 text-white shadow-md'
                      : 'bg-transparent text-gray-600 dark:text-gray-400'
                  }`}
                >
                  <LinkIcon className="w-4 h-4 inline mr-2" />
                  Add Link
                </button>
                <button
                  onClick={() => setUploadMode('document')}
                  className={`flex-1 py-2 px-4 rounded-md transition-all ${
                    uploadMode === 'document'
                      ? 'bg-indigo-600 text-white shadow-md'
                      : 'bg-transparent text-gray-600 dark:text-gray-400'
                  }`}
                >
                  <Upload className="w-4 h-4 inline mr-2" />
                  Upload Document
                </button>
              </div>
            )}
            
            <div>
              <Label htmlFor="doc-title">Title</Label>
              <Input
                id="doc-title"
                value={newDoc.title}
                onChange={(e) => setNewDoc({ ...newDoc, title: e.target.value })}
                placeholder="Enter title"
              />
            </div>
            
            {/* Show different input based on mode */}
            {selectedDocType === 'docs_links' && uploadMode === 'link' && (
              <div>
                <Label htmlFor="doc-url">URL</Label>
                <Input
                  id="doc-url"
                  value={newDoc.url}
                  onChange={(e) => setNewDoc({ ...newDoc, url: e.target.value })}
                  placeholder="https://example.com or https://docs.google.com/..."
                />
              </div>
            )}
            
            {selectedDocType === 'docs_links' && uploadMode === 'document' && (
              <div>
                <Label htmlFor="doc-file">Upload Document (PDF, Word, Text, etc.)</Label>
                <input
                  id="doc-file"
                  type="file"
                  accept=".pdf,.doc,.docx,.txt,.csv,.xlsx,.xls"
                  onChange={(e) => setUploadedFile(e.target.files[0])}
                  className="block w-full text-sm text-gray-500 dark:text-gray-400
                    file:mr-4 file:py-2 file:px-4
                    file:rounded-lg file:border-0
                    file:text-sm file:font-semibold
                    file:bg-indigo-50 file:text-indigo-700
                    hover:file:bg-indigo-100
                    dark:file:bg-indigo-900/20 dark:file:text-indigo-400"
                />
                {uploadedFile && (
                  <p className="text-sm text-green-600 dark:text-green-400 mt-2">
                    Selected: {uploadedFile.name}
                  </p>
                )}
              </div>
            )}
            
            {selectedDocType !== 'docs_links' && (
              <div>
                <Label htmlFor="doc-url">
                  {selectedDocType === 'meeting_summaries' && 'Notes Content'}
                  {selectedDocType === 'deliverables' && 'Description'}
                </Label>
                <Textarea
                  id="doc-url"
                  value={newDoc.url}
                  onChange={(e) => setNewDoc({ ...newDoc, url: e.target.value })}
                  placeholder={
                    selectedDocType === 'meeting_summaries' ? 'Enter meeting notes and discussion points...' :
                    'Enter deliverable description or details...'
                  }
                  rows={4}
                />
              </div>
            )}
            
            <div className="flex justify-end space-x-2 pt-4">
              <Button variant="outline" onClick={() => setDocDialogOpen(false)}>
                Cancel
              </Button>
              <Button 
                onClick={handleCreateDocument} 
                disabled={uploadingFile}
                className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white"
              >
                {uploadingFile ? (
                  <>
                    <Loader className="w-4 h-4 mr-2 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  <>
                    {selectedDocType === 'docs_links' && uploadMode === 'link' && 'Add Link'}
                    {selectedDocType === 'docs_links' && uploadMode === 'document' && 'Upload Document'}
                    {selectedDocType === 'meeting_summaries' && 'Add Notes'}
                    {selectedDocType === 'deliverables' && 'Add Deliverable'}
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add/Edit Note Dialog */}
      <Dialog open={noteDialogOpen} onOpenChange={(open) => {
        setNoteDialogOpen(open);
        if (!open) {
          setEditingNoteId(null);
          setNewNote('');
        }
      }}>
        <DialogContent className="max-w-md bg-white/95 dark:bg-gray-800/95 backdrop-blur-xl">
          <DialogHeader>
            <DialogTitle>{editingNoteId ? 'Edit Internal Note' : 'Add Internal Note'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="note-content">Note Content</Label>
              <Textarea
                id="note-content"
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                placeholder="Write your internal note here..."
                className="min-h-[150px]"
                autoFocus
              />
              <p className="text-xs text-amber-600 dark:text-amber-400 mt-2">
                ⚠️ This note will only be visible to team members, not guests
              </p>
            </div>
            <div className="flex justify-end space-x-2 pt-4">
              <Button variant="outline" onClick={() => setNoteDialogOpen(false)}>
                Cancel
              </Button>
              <Button 
                onClick={handleCreateNote} 
                disabled={!newNote.trim()}
                className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white"
              >
                {editingNoteId ? 'Update Note' : 'Save Note'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Share Project Dialog */}
      <Dialog open={shareDialogOpen} onOpenChange={setShareDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Share Project with Guests</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Generate a guest link to share this project with clients or external collaborators. 
              They can create an account or login to access the project.
            </p>
            
            {guestLink ? (
              <div className="space-y-4">
                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Guest Link:</p>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={`${window.location.origin}/guest-invite/${guestLink}`}
                      readOnly
                      className="flex-1 px-3 py-2 text-sm bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md"
                    />
                    <Button
                      onClick={handleCopyGuestLink}
                      variant="outline"
                      className="flex-shrink-0"
                    >
                      Copy
                    </Button>
                  </div>
                </div>
                
                <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
                  <p className="text-sm font-medium text-amber-800 dark:text-amber-200 mb-2">Guest Permissions:</p>
                  <ul className="text-xs text-amber-700 dark:text-amber-300 space-y-1 ml-4 list-disc">
                    <li>Can view and create tasks</li>
                    <li>Can edit tasks and approve tasks under review</li>
                    <li>Can create and edit useful links</li>
                    <li>Can view deliverables</li>
                    <li>Can chat with team members in project channel</li>
                    <li>Cannot view or edit meeting notes</li>
                  </ul>
                </div>
                
                <div className="flex justify-between pt-4">
                  <Button 
                    onClick={handleRevokeGuestLink}
                    variant="destructive"
                  >
                    Revoke Link
                  </Button>
                  <Button 
                    onClick={handleGenerateGuestLink}
                    variant="outline"
                    disabled={generatingLink}
                  >
                    {generatingLink ? 'Regenerating...' : 'Regenerate Link'}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="text-center py-8">
                <LinkIcon className="w-16 h-16 mx-auto text-gray-300 dark:text-gray-600 mb-4" />
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">No guest link generated yet</p>
                <Button 
                  onClick={handleGenerateGuestLink}
                  disabled={generatingLink}
                  className="bg-gradient-to-r from-blue-600 via-purple-600 to-blue-600 text-white"
                >
                  {generatingLink ? 'Generating...' : 'Generate Guest Link'}
                </Button>
              </div>
            )}
            
            <div className="pt-2">
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Note: Guest link will automatically expire when the project status is marked as "Completed"
              </p>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* AI Task Extraction Preview Dialog */}
      <Dialog open={aiDialogOpen} onOpenChange={setAiDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>AI Extracted Tasks - Review & Import</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Review the tasks extracted by AI. Uncheck any tasks you don't want to import.
            </p>

            {extractedTasks.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-500">No tasks extracted</p>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between mb-4 pb-2 border-b border-gray-200 dark:border-gray-700">
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    {selectedTasksToImport.length} of {extractedTasks.length} tasks selected
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setSelectedTasksToImport(extractedTasks.map((_, i) => i))}
                    >
                      Select All
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setSelectedTasksToImport([])}
                    >
                      Deselect All
                    </Button>
                  </div>
                </div>

                <div className="space-y-3 max-h-[500px] overflow-y-auto">
                  {extractedTasks.map((task, index) => (
                    <div
                      key={index}
                      className={`p-4 border rounded-lg transition-all cursor-pointer ${
                        selectedTasksToImport.includes(index)
                          ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20'
                          : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800'
                      }`}
                      onClick={() => toggleTaskSelection(index)}
                    >
                      <div className="flex items-start gap-3">
                        <input
                          type="checkbox"
                          checked={selectedTasksToImport.includes(index)}
                          onChange={() => toggleTaskSelection(index)}
                          className="mt-1 w-4 h-4"
                          onClick={(e) => e.stopPropagation()}
                        />
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <h4 className="font-semibold text-gray-900 dark:text-white">
                              {task.title}
                            </h4>
                            <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                              task.priority === 'High' 
                                ? 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-200'
                                : task.priority === 'Medium'
                                ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-200'
                                : 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-200'
                            }`}>
                              {task.priority}
                            </span>
                            {task.due_date && (
                              <span className="text-xs text-gray-500 dark:text-gray-400">
                                Due: {new Date(task.due_date).toLocaleDateString()}
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-gray-600 dark:text-gray-400">
                            {task.description}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                  <Button
                    variant="outline"
                    onClick={() => setAiDialogOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleImportSelectedTasks}
                    disabled={selectedTasksToImport.length === 0}
                    className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white"
                  >
                    Import {selectedTasksToImport.length} Task(s)
                  </Button>
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Task Time Tracking Dialog */}
      <Dialog open={taskTimeDialogOpen} onOpenChange={setTaskTimeDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {selectedTaskTime?.task && (
                <div className="flex items-center space-x-3">
                  <Clock className="w-6 h-6 text-green-600 dark:text-green-400" />
                  <div>
                    <p className="text-xl font-bold">{selectedTaskTime.task.title}</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Time Tracking Summary
                    </p>
                  </div>
                </div>
              )}
            </DialogTitle>
          </DialogHeader>

          {loadingTaskTime ? (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              Loading time tracking data...
            </div>
          ) : selectedTaskTime ? (
            <div className="space-y-6 mt-4">
              {/* Summary Stats */}
              <div className="grid grid-cols-3 gap-4">
                <Card className="border-gray-200 dark:border-gray-700">
                  <CardContent className="pt-6">
                    <div className="text-center">
                      <p className="text-3xl font-bold text-gray-800 dark:text-white">
                        {selectedTaskTime.total_formatted}
                      </p>
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                        Total Time
                      </p>
                    </div>
                  </CardContent>
                </Card>
                <Card className="border-gray-200 dark:border-gray-700">
                  <CardContent className="pt-6">
                    <div className="text-center">
                      <p className="text-3xl font-bold text-gray-800 dark:text-white">
                        {selectedTaskTime.total_screenshots}
                      </p>
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                        Screenshots
                      </p>
                    </div>
                  </CardContent>
                </Card>
                <Card className="border-gray-200 dark:border-gray-700">
                  <CardContent className="pt-6">
                    <div className="text-center">
                      <p className="text-3xl font-bold text-gray-800 dark:text-white">
                        {selectedTaskTime.time_entries.length}
                      </p>
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                        Sessions
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Time Entries */}
              <div>
                <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-3">
                  Time Entries
                </h3>
                <div className="space-y-3">
                  {selectedTaskTime.time_entries.map((entry) => (
                    <Card key={entry.id} className="border-gray-200 dark:border-gray-700">
                      <CardContent className="pt-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-3">
                            {entry.user?.profile_image_url ? (
                              <img
                                src={entry.user.profile_image_url}
                                alt={entry.user.name}
                                className="w-10 h-10 rounded-full object-cover"
                              />
                            ) : (
                              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-semibold">
                                {entry.user?.name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || 'U'}
                              </div>
                            )}
                            <div>
                              <p className="font-medium text-gray-800 dark:text-white">
                                {entry.user?.name || 'Unknown'}
                              </p>
                              <p className="text-sm text-gray-500 dark:text-gray-400">
                                {new Date(entry.clock_in_time).toLocaleDateString('en-US', { 
                                  month: 'short', 
                                  day: 'numeric',
                                  year: 'numeric'
                                })}
                                {' at '}
                                {new Date(entry.clock_in_time).toLocaleTimeString('en-US', { 
                                  hour: '2-digit', 
                                  minute: '2-digit'
                                })}
                                {entry.clock_out_time && (
                                  <> - {new Date(entry.clock_out_time).toLocaleTimeString('en-US', { 
                                    hour: '2-digit', 
                                    minute: '2-digit'
                                  })}</>
                                )}
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-lg font-bold text-gray-800 dark:text-white">
                              {entry.duration_seconds ? 
                                `${Math.floor(entry.duration_seconds / 3600)}h ${Math.floor((entry.duration_seconds % 3600) / 60)}m` 
                                : 'In Progress'}
                            </p>
                            {entry.is_active && (
                              <span className="text-xs text-green-600 dark:text-green-400">● Active</span>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>

              {/* Screenshots */}
              {selectedTaskTime.screenshots.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-3">
                    Screenshots ({selectedTaskTime.screenshots.length})
                  </h3>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {selectedTaskTime.screenshots.map((screenshot) => (
                      <div key={screenshot.id} className="relative group">
                        <div className="aspect-video bg-gray-900 rounded-lg overflow-hidden">
                          <img
                            src={`${BACKEND_URL}${screenshot.screenshot_url}`}
                            alt="Screenshot"
                            className="w-full h-full object-contain"
                          />
                        </div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 text-center">
                          {new Date(screenshot.timestamp).toLocaleString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Activity Summary */}
              {(selectedTaskTime.total_mouse_clicks > 0 || selectedTaskTime.total_keyboard_strokes > 0) && (
                <div>
                  <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-3">
                    Activity Summary
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    <Card className="border-gray-200 dark:border-gray-700">
                      <CardContent className="pt-4">
                        <div className="flex items-center space-x-3">
                          <Activity className="w-8 h-8 text-blue-600 dark:text-blue-400" />
                          <div>
                            <p className="text-2xl font-bold text-gray-800 dark:text-white">
                              {selectedTaskTime.total_mouse_clicks.toLocaleString()}
                            </p>
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                              Mouse Clicks
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                    <Card className="border-gray-200 dark:border-gray-700">
                      <CardContent className="pt-4">
                        <div className="flex items-center space-x-3">
                          <Activity className="w-8 h-8 text-purple-600 dark:text-purple-400" />
                          <div>
                            <p className="text-2xl font-bold text-gray-800 dark:text-white">
                              {selectedTaskTime.total_keyboard_strokes.toLocaleString()}
                            </p>
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                              Keyboard Strokes
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              No time tracking data available
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Project Visibility Settings Modal */}
      <ProjectVisibilityModal
        project={projectForVisibility}
        open={visibilityModalOpen}
        onClose={() => {
          setVisibilityModalOpen(false);
          setProjectForVisibility(null);
        }}
        onUpdate={() => {
          // Refresh the selected project details to get updated visibility settings
          if (selectedProject) {
            fetchProjectDetails(selectedProject.id);
          }
        }}
      />

      {/* Task Quick Edit Modal (Card Click - Edit everything except title/description) */}
      <TaskQuickEditModal
        task={selectedTask}
        open={taskQuickEditModalOpen}
        onClose={() => {
          setTaskQuickEditModalOpen(false);
          setSelectedTask(null);
        }}
        onUpdate={handleTaskUpdate}
        projects={[selectedProject].filter(Boolean)}
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
        projects={[selectedProject].filter(Boolean)}
        users={users}
        currentUser={currentUser}
      />

      {/* Task Extraction Selection Dialog */}
      {showTaskExtractionDialog && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white/95 dark:bg-gray-900/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-gray-200/50 dark:border-gray-700/50 w-full max-w-4xl max-h-[85vh] overflow-hidden">
            {/* Header */}
            <div className="px-8 py-6 border-b border-gray-200/50 dark:border-gray-700/50">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                    AI Task Extraction
                  </h3>
                  <p className="text-gray-600 dark:text-gray-300 mt-1">
                    Choose which specific meeting notes and useful links to analyze for automatic task extraction using AI.
                  </p>
                </div>
                <button
                  onClick={() => setShowTaskExtractionDialog(false)}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors"
                >
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="px-8 py-6 overflow-y-auto max-h-[60vh]">
              {loadingExtractionData ? (
                <div className="flex items-center justify-center py-12">
                  <div className="text-center">
                    <Loader className="w-8 h-8 animate-spin mx-auto mb-4 text-blue-600" />
                    <p className="text-gray-600 dark:text-gray-300">Loading project content...</p>
                  </div>
                </div>
              ) : (
                <div className="grid md:grid-cols-2 gap-8">
                  {/* Meeting Notes Section */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xl font-semibold text-gray-900 dark:text-white flex items-center">
                        <MessageSquare className="w-5 h-5 mr-3 text-blue-600" />
                        Meeting Notes
                        <span className="ml-2 px-2 py-1 text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200 rounded-full">
                          {availableMeetingNotes.length}
                        </span>
                      </h4>
                    </div>
                    
                    {availableMeetingNotes.length === 0 ? (
                      <div className="text-center py-8 text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800/50 rounded-xl">
                        <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-30" />
                        <p className="font-medium">No meeting notes available</p>
                        <p className="text-sm">Add meeting notes to extract tasks from them</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {/* Select All */}
                        <label className="flex items-center p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-200 dark:border-blue-800 cursor-pointer hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors">
                          <input
                            type="checkbox"
                            checked={selectedMeetingNotes.length === availableMeetingNotes.length}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedMeetingNotes(availableMeetingNotes.map(note => note.id));
                              } else {
                                setSelectedMeetingNotes([]);
                              }
                            }}
                            className="w-5 h-5 text-blue-600 bg-white border-2 border-blue-300 rounded focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                          />
                          <span className="ml-3 font-semibold text-blue-800 dark:text-blue-200">
                            Select All Meeting Notes
                          </span>
                        </label>

                        {/* Individual Meeting Notes */}
                        <div className="space-y-2 max-h-80 overflow-y-auto">
                          {availableMeetingNotes.map((note) => (
                            <label key={note.id} className="flex items-start p-4 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-xl border border-gray-200 dark:border-gray-700 cursor-pointer hover:shadow-md hover:border-blue-300 dark:hover:border-blue-600 transition-all group">
                              <input
                                type="checkbox"
                                checked={selectedMeetingNotes.includes(note.id)}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setSelectedMeetingNotes(prev => [...prev, note.id]);
                                  } else {
                                    setSelectedMeetingNotes(prev => prev.filter(id => id !== note.id));
                                  }
                                }}
                                className="w-5 h-5 text-blue-600 bg-white border-2 border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 mt-0.5"
                              />
                              <div className="ml-3 flex-1 min-w-0">
                                <div className="font-semibold text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors truncate">
                                  {note.title || `Meeting Note ${note.id.slice(-8)}`}
                                </div>
                                {note.url && (
                                  <div className="text-sm text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">
                                    {note.url.substring(0, 120)}...
                                  </div>
                                )}
                                <div className="flex items-center mt-2 text-xs text-gray-400 dark:text-gray-500">
                                  <Calendar className="w-3 h-3 mr-1" />
                                  {new Date(note.created_at).toLocaleDateString('en-US', { 
                                    month: 'short', 
                                    day: 'numeric', 
                                    year: 'numeric' 
                                  })}
                                </div>
                              </div>
                            </label>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Useful Links Section */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xl font-semibold text-gray-900 dark:text-white flex items-center">
                        <LinkIcon className="w-5 h-5 mr-3 text-purple-600" />
                        Useful Links
                        <span className="ml-2 px-2 py-1 text-xs bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-200 rounded-full">
                          {availableUsefulLinks.length}
                        </span>
                      </h4>
                    </div>
                    
                    {availableUsefulLinks.length === 0 ? (
                      <div className="text-center py-8 text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800/50 rounded-xl">
                        <LinkIcon className="w-12 h-12 mx-auto mb-3 opacity-30" />
                        <p className="font-medium">No useful links available</p>
                        <p className="text-sm">Add useful links to extract tasks from them</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {/* Select All */}
                        <label className="flex items-center p-4 bg-purple-50 dark:bg-purple-900/20 rounded-xl border border-purple-200 dark:border-purple-800 cursor-pointer hover:bg-purple-100 dark:hover:bg-purple-900/30 transition-colors">
                          <input
                            type="checkbox"
                            checked={selectedUsefulLinks.length === availableUsefulLinks.length}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedUsefulLinks(availableUsefulLinks.map(link => link.id));
                              } else {
                                setSelectedUsefulLinks([]);
                              }
                            }}
                            className="w-5 h-5 text-purple-600 bg-white border-2 border-purple-300 rounded focus:ring-2 focus:ring-purple-500 focus:ring-offset-2"
                          />
                          <span className="ml-3 font-semibold text-purple-800 dark:text-purple-200">
                            Select All Useful Links
                          </span>
                        </label>

                        {/* Individual Useful Links */}
                        <div className="space-y-2 max-h-80 overflow-y-auto">
                          {availableUsefulLinks.map((link) => {
                            let domain = '';
                            let faviconUrl = '';
                            
                            try {
                              const url = new URL(link.url);
                              domain = url.hostname;
                              faviconUrl = `https://www.google.com/s2/favicons?domain=${domain}&sz=32`;
                            } catch (e) {
                              domain = link.url;
                            }

                            return (
                              <label key={link.id} className="flex items-start p-4 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-xl border border-gray-200 dark:border-gray-700 cursor-pointer hover:shadow-md hover:border-purple-300 dark:hover:border-purple-600 transition-all group">
                                <input
                                  type="checkbox"
                                  checked={selectedUsefulLinks.includes(link.id)}
                                  onChange={(e) => {
                                    if (e.target.checked) {
                                      setSelectedUsefulLinks(prev => [...prev, link.id]);
                                    } else {
                                      setSelectedUsefulLinks(prev => prev.filter(id => id !== link.id));
                                    }
                                  }}
                                  className="w-5 h-5 text-purple-600 bg-white border-2 border-gray-300 rounded focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 mt-0.5"
                                />
                                <div className="ml-3 flex-1 min-w-0">
                                  <div className="flex items-center mb-1">
                                    {faviconUrl && (
                                      <img 
                                        src={faviconUrl} 
                                        alt="" 
                                        className="w-4 h-4 mr-2 rounded-sm"
                                        onError={(e) => { e.target.style.display = 'none'; }}
                                      />
                                    )}
                                    <div className="font-semibold text-gray-900 dark:text-white group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors truncate">
                                      {link.title || domain}
                                    </div>
                                  </div>
                                  <div className="text-sm text-blue-600 dark:text-blue-400 truncate hover:underline">
                                    {link.url}
                                  </div>
                                  <div className="flex items-center mt-2 text-xs text-gray-400 dark:text-gray-500">
                                    <Calendar className="w-3 h-3 mr-1" />
                                    Added {new Date(link.created_at).toLocaleDateString('en-US', { 
                                      month: 'short', 
                                      day: 'numeric', 
                                      year: 'numeric' 
                                    })}
                                  </div>
                                </div>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Validation Message */}
              {!loadingExtractionData && selectedMeetingNotes.length === 0 && selectedUsefulLinks.length === 0 && (
                <div className="mt-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl">
                  <div className="flex items-center">
                    <AlertCircle className="w-5 h-5 text-red-500 mr-3" />
                    <p className="text-red-800 dark:text-red-200 font-medium">
                      Please select at least one meeting note or useful link to proceed.
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-8 py-6 border-t border-gray-200/50 dark:border-gray-700/50 bg-gray-50/80 dark:bg-gray-800/80">
              <div className="flex items-center justify-between">
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  <span className="font-medium">Selected:</span> {selectedMeetingNotes.length} meeting notes, {selectedUsefulLinks.length} useful links
                </div>
                <div className="flex space-x-3">
                  <Button
                    variant="outline"
                    onClick={() => setShowTaskExtractionDialog(false)}
                    className="px-6 py-2.5 border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={proceedWithTaskExtraction}
                    disabled={loadingExtractionData || (selectedMeetingNotes.length === 0 && selectedUsefulLinks.length === 0)}
                    className="px-6 py-2.5 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white shadow-lg hover:shadow-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {extractingTasks ? (
                      <>
                        <Loader className="w-4 h-4 animate-spin mr-2" />
                        Extracting Tasks...
                      </>
                    ) : (
                      <>
                        <CheckSquare className="w-4 h-4 mr-2" />
                        Extract Tasks
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Projects;
