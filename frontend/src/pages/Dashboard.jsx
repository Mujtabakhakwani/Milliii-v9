import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Progress } from '../components/ui/progress';
import { Textarea } from '../components/ui/textarea';
import { toast } from 'sonner';
import { PlusCircle, LogOut, Folder, Users, CheckCircle, TrendingUp, Settings, UserPlus, Calendar, Flag, Clock, AlertCircle, BarChart3, Target, Edit, Save, X, UserCheck, UserX, FolderKanban, Camera, Eye } from 'lucide-react';
import { getUserAvatarColor, getUserInitials } from '../utils/avatarUtils';
import { BACKEND_URL, API_URL } from '../config';
import TaskDetailModal from '../components/TaskDetailModal';
import TaskQuickEditModal from '../components/TaskQuickEditModal';
import TrelloTaskCard from '../components/TrelloTaskCard';
import TrelloTaskModal from '../components/TrelloTaskModal';

const API = API_URL;

const KANBAN_COLUMNS = [
  { id: 'Getting Started', title: 'Getting Started' },
  { id: 'Onetime Setup', title: 'Onetime Setup' },
  { id: 'Agency Setup', title: 'Agency Setup' },
  { id: 'Service', title: 'Service' },
  { id: 'Under Review', title: 'Under Review' },
  { id: 'Completed', title: 'Completed' }
];

const Dashboard = ({ currentUser, onLogout }) => {
  const navigate = useNavigate();
  const [projects, setProjects] = useState([]);
  const [users, setUsers] = useState([]);
  const [tasks, setTasks] = useState([]); // User's tasks for KPIs
  const [allTasks, setAllTasks] = useState([]); // All tasks for project progress
  const [teamActivity, setTeamActivity] = useState([]);
  const [activeStatusTab, setActiveStatusTab] = useState('IN');
  const [memberSearchQuery, setMemberSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [addUserOpen, setAddUserOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);
  const [taskQuickEditModalOpen, setTaskQuickEditModalOpen] = useState(false);
  const [taskDetailModalOpen, setTaskDetailModalOpen] = useState(false);
  const [trelloTaskModalOpen, setTrelloTaskModalOpen] = useState(false);
  const [integrations, setIntegrations] = useState([]);

  const getIntegrationStatus = (name) => {
    const found = integrations.find((i) => i.name === name);
    return found || { name, is_connected: false };
  };

  
  const [newProject, setNewProject] = useState({
    name: '',
    company_name: '',
    business_name: '',
    client_name: '',
    client_email: '',
    client_phone: '',
    budget: '',
    project_owner: currentUser?.id || '',
    team_members: [],
    start_date: new Date().toISOString().split('T')[0],
    end_date: '',
    description: '',
    status: 'Getting Started',
    priority: 'Medium'
  });

  const [newUser, setNewUser] = useState({
    name: '',
    email: '',
    password: '',
    role: 'user'
  });

  const [userSettings, setUserSettings] = useState({
    name: currentUser?.name || '',
    email: currentUser?.email || ''
  });

  useEffect(() => {
    const loadData = async () => {
      await fetchProjects();
    await fetchIntegrationsStatus();
      await fetchUsers();
      await fetchAllTasks();
      await fetchJibbleTeamActivity();
    };
    loadData();
    
    // Refresh team activity every 30 seconds for real-time updates
    const interval = setInterval(fetchJibbleTeamActivity, 30000);
    return () => clearInterval(interval);
  }, []);

  // Removed the separate useEffect that was dependent on projects

  const fetchProjects = async () => {
    try {
      const token = localStorage.getItem('token');
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const response = await axios.get(`${API}/projects`, { headers });
      const projectsData = Array.isArray(response.data) ? response.data : response.data?.data || [];
      // Filter to show only projects where user is owner, team member, or guest
      // AND exclude completed projects
      const myProjects = projectsData.filter(p => 
        (p.project_owner === currentUser?.id || 
        p.team_members?.includes(currentUser?.id) ||
        p.guests?.includes(currentUser?.id)) &&
        p.status !== 'Completed'
      );
      setProjects(myProjects);
    } catch (error) {
      toast.error('Failed to load projects');
    } finally {
      setLoading(false);
    }
  };
  const fetchIntegrationsStatus = async () => {
    try {
      const token = localStorage.getItem('token');
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const res = await axios.get(`${API}/integrations/status`, { headers });
      const list = Array.isArray(res.data) ? res.data : res.data?.data || res.data || [];
      setIntegrations(list);
    } catch (e) {
      // fail silently; default is not connected
      setIntegrations([]);
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
      console.error('Failed to load users');
    }
  };

  const fetchJibbleTeamActivity = async () => {
    try {
      // First try to get time tracking data
      const timeTrackingData = await fetchTimeTrackingActivity();
      
      if (timeTrackingData && timeTrackingData.length > 0) {
        setTeamActivity(timeTrackingData);
        return;
      }
      
      // Fallback to Jibble if time tracking has no data
      const token = localStorage.getItem('token');
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const [jibbleResponse, usersResponse] = await Promise.all([
        axios.get(`${API}/jibble/team-activity`, { headers }),
        axios.get(`${API}/users`, { headers })
      ]);
      
      const usersList = Array.isArray(usersResponse.data) ? usersResponse.data : usersResponse.data?.data || [];
      if (jibbleResponse.data && jibbleResponse.data.length > 0 && usersList) {
        // Get list of user emails and IDs from database, only team members
        const usersByEmail = new Map(
          usersList
            .filter(user => ['admin', 'manager', 'team member', 'user'].includes(user.role)) // Only team members (exclude clients)
            .map(user => [user.email, user])
        );
        
        // Filter Jibble members to only show those who exist in our team (and are not clients/guests)
        const filteredJibbleMembers = jibbleResponse.data.filter(member => 
          usersByEmail.has(member.email)
        );
        
        // Add consistent color classes to team members based on user ID
        const teamWithColors = filteredJibbleMembers.map((member) => {
          const user = usersByEmail.get(member.email);
          return {
            ...member,
            color: getUserAvatarColor(user?.id, member.email),
            initials: getUserInitials(member.name || member.fullName),
            profile_image_url: user?.profile_image_url
          };
        });
        setTeamActivity(teamWithColors);
      } else {
        // Use empty array if no data
        setTeamActivity([]);
      }
    } catch (error) {
      console.error('Failed to load team activity');
      setTeamActivity([]);
    }
  };

  const fetchTimeTrackingActivity = async () => {
    try {
      const token = localStorage.getItem('token');
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const [usersResponse, timeEntriesResponse, projectsResponse, tasksResponse, screenshotsResponse] = await Promise.all([
        axios.get(`${API}/users`, { headers }),
        axios.get(`${API}/time-entries`, { headers }),
        axios.get(`${API}/projects`, { headers }),
        axios.get(`${API}/tasks`, { headers }),
        axios.get(`${API}/time-screenshots`, { headers })
      ]);

      // Get all active time entries
      const timeEntriesData = Array.isArray(timeEntriesResponse.data) ? timeEntriesResponse.data : timeEntriesResponse.data?.data || [];
      const activeEntries = timeEntriesData.filter(entry => entry.is_active);
      
      // Create lookups
      const projectsMap = {};
      const projectsData = Array.isArray(projectsResponse.data) ? projectsResponse.data : projectsResponse.data?.data || [];
      projectsData.forEach(project => {
        projectsMap[project.id] = project.name;
      });

      const tasksMap = {};
      const tasksData = Array.isArray(tasksResponse.data) ? tasksResponse.data : tasksResponse.data?.data || [];
      tasksData.forEach(task => {
        tasksMap[task.id] = task;
      });

      // Check for recent screenshots (within last 7 minutes)
      const recentScreenshotsByTimeEntry = {};
      const sevenMinutesAgo = new Date(Date.now() - 7 * 60 * 1000);
      const screenshotsData = Array.isArray(screenshotsResponse.data) ? screenshotsResponse.data : screenshotsResponse.data?.data || [];
      screenshotsData.forEach(screenshot => {
        const screenshotTime = new Date(screenshot.timestamp);
        if (screenshotTime > sevenMinutesAgo) {
          recentScreenshotsByTimeEntry[screenshot.time_entry_id] = true;
        }
      });

      // Create a map of active entries by user ID
      const activeEntriesByUser = {};
      activeEntries.forEach(entry => {
        activeEntriesByUser[entry.user_id] = entry;
      });

      // Build activity data for team members only (exclude clients)
      const usersList = Array.isArray(usersResponse.data) ? usersResponse.data : usersResponse.data?.data || [];
      const activity = usersList
        .filter(user => ['admin', 'manager', 'team member', 'user'].includes(user.role)) // Only team members (exclude clients)
        .map(user => {
        const activeEntry = activeEntriesByUser[user.id];
        
        if (activeEntry) {
          // User is actively tracking
          const isBreak = activeEntry.is_break;
          const task = !isBreak ? tasksMap[activeEntry.task_id] : null;
          const projectName = !isBreak ? projectsMap[activeEntry.project_id] : null;
          const breakInfo = isBreak ? activeEntry.break : null;
          
          // Calculate elapsed time
          const clockInTime = new Date(activeEntry.clock_in_time);
          const now = new Date();
          const seconds = Math.floor((now - clockInTime) / 1000);
          const hours = Math.floor(seconds / 3600);
          const minutes = Math.floor((seconds % 3600) / 60);
          const timeString = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;

          // Check if screen capture is active (has recent screenshots)
          const hasRecentScreenshots = recentScreenshotsByTimeEntry[activeEntry.id] || false;

          return {
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
            status: isBreak ? 'BREAK' : 'IN',
            lastActivity: isBreak 
              ? `On ${breakInfo?.name || 'Break'}`
              : (task ? `Working on ${task.title}` : 'Working on a task'),
            project: projectName || (isBreak ? 'Break' : 'Unknown Project'),
            tracking: true,
            elapsedTime: timeString,
            clockedInAt: clockInTime,
            color: getUserAvatarColor(user.id, user.email),
            initials: getUserInitials(user.name),
            profile_image_url: user.profile_image_url,
            screenCapture: hasRecentScreenshots,
            taskTitle: task?.title,
            isBreak: isBreak
          };
        } else {
          // User is not tracking (clocked out or never clocked in)
          return {
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
            status: 'OUT',
            lastActivity: 'Not tracking',
            color: getUserAvatarColor(user.id, user.email),
            initials: getUserInitials(user.name),
            profile_image_url: user.profile_image_url,
            screenCapture: false
          };
        }
      });

      return activity;
    } catch (error) {
      console.error('Failed to fetch time tracking activity:', error);
      return [];
    }
  };

  const fetchAllTasks = async () => {
    try {
      const token = localStorage.getItem('token');
      const headers = token ? { Authorization: `Bearer ${token}` } : {};

      // Fetch ALL tasks (paginated endpoint)
      const response = await axios.get(`${API}/tasks`, { headers });

      const tasksData = Array.isArray(response.data)
        ? response.data
        : response.data?.data || [];
      
      // Store ALL tasks for project progress calculation
      setAllTasks(tasksData);
      
      // Filter to show tasks assigned to current user for KPIs
      const myTasks = tasksData.filter(task => 
        task.assignee === currentUser?.id || task.assignee === currentUser?.email
      );
      setTasks(myTasks);
    } catch (error) {
      console.error('Failed to load tasks');
    }
  };

  const handleCreateProject = async (e) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('token');
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      await axios.post(
        `${API}/projects`,
        {
        ...newProject,
        budget: parseFloat(newProject.budget) || 0,
        created_by: currentUser?.id
        },
        { headers }
      );
      toast.success('Project created successfully!');
      setCreateDialogOpen(false);
      setNewProject({
        name: '',
        company_name: '',
        business_name: '',
        client_name: '',
        client_email: '',
        client_phone: '',
        budget: '',
        project_owner: currentUser?.id || '',
        team_members: [],
        start_date: new Date().toISOString().split('T')[0],
        end_date: '',
        description: '',
        status: 'Getting Started',
        priority: 'Medium'
      });
      fetchProjects();
    } catch (error) {
      toast.error('Failed to create project');
    }
  };

  const handleAddUser = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API}/auth/signup`, newUser);
      toast.success('User added successfully!');
      setAddUserOpen(false);
      setNewUser({ name: '', email: '', password: '', role: 'user' });
      fetchUsers();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to add user');
    }
  };

  const handleSyncJibbleTeam = async () => {
    try {
      const response = await axios.post(`${API}/jibble/sync-team-members`);
      toast.success(response.data.message);
      await fetchUsers();
      await fetchJibbleTeamActivity();
    } catch (error) {
      toast.error('Failed to sync team members from Jibble');
    }
  };

  const handleTaskCardClick = (task) => {
    setSelectedTask(task);
    setTrelloTaskModalOpen(true);
  };

  const handleTaskEyeClick = (task) => {
    setSelectedTask(task);
    setTaskDetailModalOpen(true);
  };

  const handleTaskUpdate = async (updatedTask) => {
    if (!updatedTask) {
      // If updatedTask is null, it means deletion - close modals and refresh
      setTrelloTaskModalOpen(false);
      setTaskDetailModalOpen(false);
      setTaskQuickEditModalOpen(false);
      
      // Refresh the tasks list
      await fetchAllTasks();
      return;
    }
    
    // Update the task in the local state but DON'T close modals
    setTasks(prevTasks => 
      prevTasks.map(task => task.id === updatedTask.id ? updatedTask : task)
    );
    setAllTasks(prevTasks => 
      prevTasks.map(task => task.id === updatedTask.id ? updatedTask : task)
    );
    
    // DON'T close modals for regular updates - let user close manually
    // Only refresh data in background
    await fetchAllTasks();
  };

  const handleToggleTaskComplete = async (task) => {
    try {
      let newStatus;
      // Standalone tasks can be marked complete/incomplete
      if (!task.project_id) {
        newStatus = task.status === 'Completed' ? 'In Progress' : 'Completed';
      } else {
        // Project tasks can only be marked as "Under Review", not complete
        newStatus = task.status === 'Under Review' ? 'In Progress' : 'Under Review';
      }
      
      await axios.put(`${API}/tasks/${task.id}`, { status: newStatus });
      toast.success(`Task marked as ${newStatus}!`);
      await fetchAllTasks();
    } catch (error) {
      toast.error('Failed to update task');
    }
  };

  const getStatusColor = (status) => {
    const colors = {
      'Getting Started': 'bg-blue-100 text-blue-700',
      'In Progress': 'bg-amber-100 text-amber-700',
      'Under Review': 'bg-purple-100 text-purple-700',
      'Completed': 'bg-green-100 text-green-700'
    };
    return colors[status] || 'bg-gray-100 text-gray-700';
  };

  const getPriorityColor = (priority) => {
    const colors = {
      'Low': 'bg-green-100 text-green-700',
      'Medium': 'bg-amber-100 text-amber-700',
      'High': 'bg-red-100 text-red-700'
    };
    return colors[priority] || 'bg-gray-100 text-gray-700';
  };

  const getProjectProgress = (projectId) => {
    const projectTasks = allTasks.filter(t => t.project_id === projectId);
    if (projectTasks.length === 0) return 0;
    const completed = projectTasks.filter(t => t.status === 'Completed').length;
    return Math.round((completed / projectTasks.length) * 100);
  };

  // KPI Calculations - USER SPECIFIC
  const calculateKPIs = () => {
    const userTasks = tasks; // Already filtered to current user's tasks
    const totalTasks = userTasks.length;
    const completedTasks = userTasks.filter(t => t.status === 'Completed').length;
    
    // 1. Task Completion Rate
    const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
    
    // 2. On-Time Delivery Rate
    const tasksWithDueDate = userTasks.filter(t => t.due_date && t.status === 'Completed');
    const onTimeTasks = tasksWithDueDate.filter(t => {
      const dueDate = new Date(t.due_date);
      const completedDate = t.updated_at ? new Date(t.updated_at) : new Date();
      return completedDate <= dueDate;
    });
    const onTimeRate = tasksWithDueDate.length > 0 ? Math.round((onTimeTasks.length / tasksWithDueDate.length) * 100) : 0;
    
    // 3. Task Backlog (Overdue + Not Started)
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Start of today
    const overdueTasks = userTasks.filter(t => {
      if (!t.due_date || t.status === 'Completed') return false;
      const dueDate = new Date(t.due_date);
      dueDate.setHours(23, 59, 59, 999); // End of due date day
      return dueDate < today;
    });
    const notStartedTasks = userTasks.filter(t => t.status === 'Not Started');
    const backlog = overdueTasks.length + notStartedTasks.length;
    
    // 4. Active Projects Count
    // Admin: ALL workspace active projects
    // Team Member: Only projects where user is owner or team member
    let activeProjects;
    if (currentUser?.role === 'admin') {
      activeProjects = projects.filter(p => !p.archived && p.status !== 'Completed').length;
    } else {
      activeProjects = projects.filter(p => 
        !p.archived && 
        p.status !== 'Completed' && 
        (p.project_owner === currentUser?.id || p.team_members?.includes(currentUser?.id))
      ).length;
    }
    
    return {
      activeProjects,
      completionRate,
      onTimeRate,
      backlog
    };
  };

  const kpis = calculateKPIs();

  // Sort tasks by deadline (upcoming first) and FILTER OUT COMPLETED
  const sortedTasks = [...tasks]
    .filter(t => t.status !== 'Completed') // Remove completed tasks from dashboard
    .sort((a, b) => {
      // Tasks without deadline go to bottom
      if (!a.due_date && !b.due_date) return 0;
      if (!a.due_date) return 1;
      if (!b.due_date) return -1;
      
      // Sort by due date ascending (earliest first)
      return new Date(a.due_date) - new Date(b.due_date);
    });

  // Filter to show only pending tasks (not completed)
  const userTasks = tasks.filter(t => t.assignee === currentUser?.id && t.status !== 'Completed');
  const completedTasks = userTasks.filter(t => t.status === 'Completed').length;
  const totalTasks = userTasks.length;
  const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
  const onlineMembers = teamActivity.filter(m => m.status === 'IN').length;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-6 overflow-hidden">
      {/* Main Content */}
      <main className="max-w-[1920px] mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Left Content - Main Dashboard */}
          <div className="lg:col-span-3 space-y-6">
        {/* Welcome Banner with Blue-Purple Gradient */}
        <Card className="border-0 relative overflow-hidden shadow-2xl animate-fade-in">
          <div className="absolute inset-0 bg-gradient-to-r from-blue-600 via-purple-600 to-blue-600"></div>
          <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImdyaWQiIHdpZHRoPSI2MCIgaGVpZ2h0PSI2MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHBhdGggZD0iTSAxMCAwIEwgMCAwIDAgMTAiIGZpbGw9Im5vbmUiIHN0cm9rZT0id2hpdGUiIHN0cm9rZS1vcGFjaXR5PSIwLjEiIHN0cm9rZS13aWR0aD0iMSIvPjwvcGF0dGVybj48L2RlZnM+PHJlY3Qgd2lkdGg9IjEwMCUiIGhlaWdodD0iMTAwJSIgZmlsbD0idXJsKCNncmlkKSIvPjwvc3ZnPg==')] opacity-20"></div>
          <CardContent className="pt-8 pb-8 relative z-10">
            <h2 className="text-3xl font-bold text-white mb-3 animate-fade-in">Welcome back, {currentUser?.name}! 👋</h2>
            <p className="text-white/90 text-sm mb-6 animate-fade-in" style={{ animationDelay: '0.1s' }}>
              You have {projects.length} active project{projects.length !== 1 ? 's' : ''} and {userTasks.length} task{userTasks.length !== 1 ? 's' : ''} pending. Let's make today productive!
            </p>
            <div className="flex space-x-4">
              <Button
                onClick={() => setCreateDialogOpen(true)}
                className="bg-white/20 hover:bg-white/30 text-white border-white/40 hover:border-white/60 backdrop-blur-sm transition-all duration-300 hover:scale-105 hover:shadow-xl animate-scale-in"
                data-testid="new-project-button"
              >
                <PlusCircle className="w-4 h-4 mr-2" />
                New Project
              </Button>
              {currentUser?.role === 'admin' && getIntegrationStatus('jibble').is_connected && (
                <Button 
                  onClick={handleSyncJibbleTeam}
                  className="bg-white/20 hover:bg-white/30 text-white border-white/40 hover:border-white/60 backdrop-blur-sm transition-all duration-300 hover:scale-105 hover:shadow-xl animate-scale-in"
                  data-testid="sync-jibble-button"
                  title="Sync team from Jibble"
                  style={{ animationDelay: '0.1s' }}
                >
                  <Users className="w-4 h-4 mr-2" />
                  Sync Jibble Team
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Stats Grid with 4 KPIs - USER SPECIFIC - Glassmorphism */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {/* KPI 1: Active Projects */}
          <Card className="border border-purple-200/50 dark:border-purple-800/50 bg-white/80 dark:bg-gray-800/80 backdrop-blur-xl shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105 animate-fade-in">
            <CardContent className="pt-6">
              <div className="flex flex-col items-center text-center">
                <div className="p-3 rounded-2xl bg-gradient-to-br from-blue-500/20 to-cyan-500/20 shadow-inner mb-3">
                  <Folder className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                </div>
                <p className="text-xs text-gray-600 dark:text-gray-400 mb-1 font-medium">Active Projects</p>
                <h3 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent">{kpis.activeProjects}</h3>
                <p className="text-xs text-gray-500 mt-1">{projects.length} total</p>
              </div>
            </CardContent>
          </Card>

          {/* KPI 2: Task Completion Rate */}
          <Card className="border border-purple-200/50 dark:border-purple-800/50 bg-white/60 dark:bg-gray-900/60 backdrop-blur-lg shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105 animate-fade-in" style={{ animationDelay: '0.1s' }}>
            <CardContent className="pt-6">
              <div className="flex flex-col items-center text-center">
                <div className="p-3 rounded-2xl bg-gradient-to-br from-green-500/20 to-blue-500/20 shadow-inner mb-3">
                  <CheckCircle className="w-6 h-6 text-green-600 dark:text-green-400" />
                </div>
                <p className="text-xs text-gray-600 dark:text-gray-400 mb-1 font-medium">Task Completion</p>
                <h3 className="text-2xl font-bold bg-gradient-to-r from-green-600 to-blue-600 bg-clip-text text-transparent">{kpis.completionRate}%</h3>
                <p className="text-xs text-gray-500 mt-1">{tasks.filter(t => t.status === 'Completed').length}/{tasks.length} tasks</p>
              </div>
            </CardContent>
          </Card>

          {/* KPI 3: On-Time Delivery */}
          <Card className="border border-purple-200/50 dark:border-purple-800/50 bg-white/60 dark:bg-gray-900/60 backdrop-blur-lg shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105 animate-fade-in" style={{ animationDelay: '0.2s' }}>
            <CardContent className="pt-6">
              <div className="flex flex-col items-center text-center">
                <div className="p-3 rounded-2xl bg-gradient-to-br from-blue-500/20 to-purple-500/20 shadow-inner mb-3">
                  <Clock className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                </div>
                <p className="text-xs text-gray-600 dark:text-gray-400 mb-1 font-medium">On-Time Delivery</p>
                <h3 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">{kpis.onTimeRate}%</h3>
                <p className="text-xs text-gray-500 mt-1">Tasks on schedule</p>
              </div>
            </CardContent>
          </Card>

          {/* KPI 4: Task Backlog */}
          <Card className="border border-purple-200/50 dark:border-purple-800/50 bg-white/60 dark:bg-gray-900/60 backdrop-blur-lg shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105 animate-fade-in" style={{ animationDelay: '0.3s' }}>
            <CardContent className="pt-6">
              <div className="flex flex-col items-center text-center">
                <div className="p-3 rounded-2xl bg-gradient-to-br from-orange-500/20 to-red-500/20 shadow-inner mb-3">
                  <AlertCircle className="w-6 h-6 text-orange-600 dark:text-orange-400" />
                </div>
                <p className="text-xs text-gray-600 dark:text-gray-400 mb-1 font-medium">Task Backlog</p>
                <h3 className="text-2xl font-bold bg-gradient-to-r from-orange-600 to-red-600 bg-clip-text text-transparent">{kpis.backlog}</h3>
                <p className="text-xs text-gray-500 mt-1">Overdue/Pending</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Your Tasks - TOP SECTION with Inline Editing - Max 4 Tasks Sorted by Deadline */}
        <Card className="border border-purple-200/50 dark:border-purple-800/50 bg-white/80 dark:bg-gray-800/80 backdrop-blur-xl shadow-lg">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">Your Tasks</CardTitle>
              <div className="flex items-center space-x-2">
                <span className="text-sm text-gray-600 dark:text-gray-400 font-medium">{tasks.length} total</span>
                <span className="text-xs px-3 py-1 rounded-lg bg-gradient-to-r from-green-500/20 to-blue-500/20 text-green-700 dark:text-green-400 font-semibold border border-green-500/30">{tasks.filter(t => t.status === 'Completed').length} completed</span>
                {sortedTasks.length > 4 && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => navigate('/my-tasks')}
                    className="text-xs font-semibold text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 transition-colors border-purple-300 dark:border-purple-700"
                  >
                    See More ({sortedTasks.length})
                  </Button>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {sortedTasks.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-8">
                {tasks.length === 0 ? 'No tasks assigned to you yet' : 'All tasks completed! 🎉 Check My Tasks for completed items.'}
              </p>
            ) : (
              <div className="space-y-2">
                {sortedTasks.slice(0, 4).map((task) => {
                  const taskProject = projects.find(p => p.id === task.project_id);
                  const taskWithProject = { 
                    ...task, 
                    project_name: taskProject ? taskProject.name : null 
                  };
                  
                  return (
                    <TrelloTaskCard
                      key={task.id}
                      task={taskWithProject}
                      users={users}
                      onClick={() => handleTaskCardClick(task)}
                      onEyeClick={() => handleTaskEyeClick(task)}
                      showProject={true}
                      className="group !bg-gradient-to-r !from-purple-50/50 !to-blue-50/50 dark:!from-purple-900/20 dark:!to-blue-900/20 !border-purple-200/50 dark:!border-purple-800/50"
                    />
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* My Projects - BOTTOM SECTION */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-semibold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">My Projects</h3>
            {projects.length > 2 && (
              <Button
                onClick={() => navigate('/projects')}
                variant="outline"
                className="text-sm font-semibold text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 transition-colors border-purple-300 dark:border-purple-700 hover:bg-purple-50 dark:hover:bg-purple-900/20"
              >
                See More ({projects.length})
              </Button>
            )}
          </div>
          
          {projects.length === 0 ? (
            <div className="text-center py-12 bg-white/60 dark:bg-gray-900/60 backdrop-blur-lg rounded-xl border border-purple-200/50 dark:border-purple-800/50">
              <FolderKanban className="w-16 h-16 mx-auto mb-4 text-gray-400 dark:text-gray-600" />
              <p className="text-gray-500 dark:text-gray-400 mb-2">No projects yet</p>
              <p className="text-sm text-gray-400 dark:text-gray-500">Create your first project to get started</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {projects.slice(0, 2).map((project, index) => {
                const progress = getProjectProgress(project.id);
                const projectTasks = allTasks.filter(t => t.project_id === project.id);
                return (
                  <Card
                    key={project.id}
                    className="border border-purple-200/50 dark:border-purple-800/50 bg-white/60 dark:bg-gray-900/60 backdrop-blur-lg shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105 cursor-pointer animate-fade-in"
                    onClick={() => navigate(`/projects?selected=${project.id}`)}
                    data-testid={`project-card-${project.id}`}
                    style={{ animationDelay: `${index * 0.1}s` }}
                  >
                  <CardContent className="pt-6">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h4 className="font-semibold text-gray-900 dark:text-white mb-1">{project.name}</h4>
                        <p className="text-sm text-gray-500 dark:text-gray-400">{project.company_name}</p>
                      </div>
                      <span className={`text-xs px-3 py-1 rounded-lg font-semibold ${getStatusColor(project.status)}`}>
                        {project.status === 'Getting Started' ? 'Active' : project.status}
                      </span>
                    </div>
                    <div className="mb-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs text-gray-600 dark:text-gray-400 font-medium">Progress</span>
                        <span className="text-xs font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">{progress}%</span>
                      </div>
                      <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all duration-500 rounded-full"
                          style={{ width: `${progress}%` }}
                        ></div>
                      </div>
                    </div>
                    <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                      <div className="flex items-center space-x-4">
                        <span className="flex items-center">
                          <CheckCircle className="w-3 h-3 mr-1 text-purple-500" />
                          {projectTasks.length} tasks
                        </span>
                        <span className="flex items-center">
                          <Users className="w-3 h-3 mr-1 text-purple-500" />
                          {project.team_members.length} members
                        </span>
                      </div>
                      {project.end_date && (
                        <span className="flex items-center">
                          <Calendar className="w-3 h-3 mr-1 text-purple-500" />
                          Due: {new Date(project.end_date).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full mt-3 bg-gradient-to-r from-blue-500/10 to-purple-500/10 border-purple-300 dark:border-purple-700 hover:from-blue-500/20 hover:to-purple-500/20 text-purple-700 dark:text-purple-300 font-semibold transition-all duration-300"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/projects?selected=${project.id}`);
                      }}
                    >
                      View Project →
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
            </div>
          )}
        </div>
        </div>

        {/* Right Sidebar - Team Activity (Who's in/out) */}
        <div className="lg:col-span-1">
          <Card className="border border-purple-200/50 dark:border-purple-800/50 bg-white/60 dark:bg-gray-900/60 backdrop-blur-lg shadow-lg sticky top-6">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">Team Activity</CardTitle>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 font-medium">{teamActivity.length} members</p>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Status Tabs */}
              <div className="flex items-center space-x-1 bg-gradient-to-r from-purple-100/50 to-blue-100/50 dark:from-purple-900/30 dark:to-blue-900/30 p-1 rounded-xl backdrop-blur-sm border border-purple-200/30 dark:border-purple-700/30">
                <button
                  onClick={() => setActiveStatusTab('IN')}
                  className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition-all duration-300 ${
                    activeStatusTab === 'IN'
                      ? 'bg-gradient-to-r from-green-500 to-blue-500 text-white shadow-lg scale-105'
                      : 'text-gray-600 dark:text-gray-400 hover:text-purple-700 dark:hover:text-purple-300'
                  }`}
                >
                  <UserCheck className="w-3 h-3 inline mr-1" />
                  {teamActivity.filter(m => m.status === 'IN').length} IN
                </button>
                <button
                  onClick={() => setActiveStatusTab('BREAK')}
                  className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition-all duration-300 ${
                    activeStatusTab === 'BREAK'
                      ? 'bg-gradient-to-r from-yellow-500 to-orange-500 text-white shadow-lg scale-105'
                      : 'text-gray-600 dark:text-gray-400 hover:text-purple-700 dark:hover:text-purple-300'
                  }`}
                >
                  {teamActivity.filter(m => m.status === 'BREAK').length} BREAK
                </button>
                <button
                  onClick={() => setActiveStatusTab('OUT')}
                  className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition-all duration-300 ${
                    activeStatusTab === 'OUT'
                      ? 'bg-gradient-to-r from-gray-500 to-gray-600 text-white shadow-lg scale-105'
                      : 'text-gray-600 dark:text-gray-400 hover:text-purple-700 dark:hover:text-purple-300'
                  }`}
                >
                  <UserX className="w-3 h-3 inline mr-1" />
                  {teamActivity.filter(m => m.status === 'OUT').length} OUT
                </button>
              </div>

              {/* Search Bar */}
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search members..."
                  value={memberSearchQuery}
                  onChange={(e) => setMemberSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 border border-purple-200 dark:border-purple-800 rounded-xl text-sm bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-300"
                />
                <svg
                  className="absolute left-3 top-3 h-5 w-5 text-purple-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
              </div>

              {/* Member List - Status View */}
              <div className="space-y-2 max-h-[500px] overflow-y-auto pr-2">
                {teamActivity
                  .filter(m => m.status === activeStatusTab)
                  .filter(m => 
                    memberSearchQuery === '' || 
                    m.name.toLowerCase().includes(memberSearchQuery.toLowerCase())
                  )
                  .map((member) => (
                    <div key={member.id} className="flex items-center space-x-3 p-3 bg-gradient-to-r from-purple-50/50 to-blue-50/50 dark:from-purple-900/20 dark:to-blue-900/20 rounded-xl hover:shadow-md transition-all duration-300 hover:scale-[1.02] border border-purple-200/50 dark:border-purple-800/50">
                      <div className="relative">
                        {member.profile_image_url ? (
                          <img 
                            src={member.profile_image_url} 
                            alt={member.name}
                            className="w-12 h-12 rounded-xl object-cover shadow-lg ring-2 ring-purple-500/30"
                          />
                        ) : (
                          <div className={`w-12 h-12 rounded-xl ${member.color} flex items-center justify-center text-white font-bold text-sm shadow-lg ring-2 ring-purple-500/30`}>
                            {member.initials || getUserInitials(member.name)}
                          </div>
                        )}
                        <div className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-white shadow-md ${
                          member.status === 'IN' ? 'bg-green-500' :
                          member.status === 'BREAK' ? 'bg-yellow-500' : 'bg-gray-400'
                        }`}></div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <h5 className="text-sm font-semibold text-gray-900 dark:text-white truncate">{member.name}</h5>
                          {member.status === 'IN' && (
                            <Camera className={`w-4 h-4 flex-shrink-0 ${
                              member.screenCapture ? 'text-green-500' : 'text-red-500'
                            }`} />
                          )}
                        </div>
                        {member.status === 'IN' && (
                          <>
                            {member.project && (
                              <p className="text-xs text-purple-600 dark:text-purple-400 truncate font-medium">
                                📁 {member.project}
                              </p>
                            )}
                            {member.taskTitle && (
                              <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                                {member.taskTitle}
                              </p>
                            )}
                            {member.elapsedTime && (
                              <p className="text-xs text-gray-400 dark:text-gray-500">
                                ⏱️ {member.elapsedTime}
                              </p>
                            )}
                          </>
                        )}
                        {member.status !== 'IN' && (
                          <p className="text-xs text-gray-500 dark:text-gray-400">{member.lastActivity}</p>
                        )}
                      </div>
                    </div>
                  ))}
                
                {/* Empty State */}
                {teamActivity.filter(m => m.status === activeStatusTab).filter(m => 
                    memberSearchQuery === '' || 
                    m.name.toLowerCase().includes(memberSearchQuery.toLowerCase())
                  ).length === 0 && (
                  <div className="text-center py-8 text-gray-400">
                    {memberSearchQuery ? (
                      <p className="text-sm">No members found matching "{memberSearchQuery}"</p>
                    ) : activeStatusTab === 'IN' ? (
                      <p className="text-sm">No one clocked in</p>
                    ) : activeStatusTab === 'BREAK' ? (
                      <p className="text-sm">No one on break</p>
                    ) : (
                      <p className="text-sm">Everyone is clocked in!</p>
                    )}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
        </div>
      </main>

    {/* Create Project Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create New Project</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateProject} className="space-y-4 mt-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="project-name">Project Name *</Label>
                <Input
                  id="project-name"
                  data-testid="project-name-input"
                  placeholder="Website Redesign"
                  value={newProject.name}
                  onChange={(e) => setNewProject({ ...newProject, name: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="company-name">Company Name *</Label>
                <Input
                  id="company-name"
                  data-testid="company-name-input"
                  placeholder="Acme Inc"
                  value={newProject.company_name}
                  onChange={(e) => setNewProject({ ...newProject, company_name: e.target.value })}
                  required
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="client-name">Client Name *</Label>
                <Input
                  id="client-name"
                  data-testid="client-name-input"
                  placeholder="John Doe"
                  value={newProject.client_name}
                  onChange={(e) => setNewProject({ ...newProject, client_name: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="client-email">Client Email</Label>
                <Input
                  id="client-email"
                  data-testid="client-email-input"
                  type="email"
                  placeholder="john@example.com"
                  value={newProject.client_email}
                  onChange={(e) => setNewProject({ ...newProject, client_email: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="business-name">Business Name</Label>
                <Input
                  id="business-name"
                  placeholder="Acme Corp"
                  value={newProject.business_name}
                  onChange={(e) => setNewProject({ ...newProject, business_name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="client-phone">Client Phone</Label>
                <Input
                  id="client-phone"
                  placeholder="+1 234 567 8900"
                  value={newProject.client_phone}
                  onChange={(e) => setNewProject({ ...newProject, client_phone: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="budget">Budget ($)</Label>
                <Input
                  id="budget"
                  type="number"
                  placeholder="10000"
                  value={newProject.budget}
                  onChange={(e) => setNewProject({ ...newProject, budget: e.target.value })}
                />
              </div>
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
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="end_date">End Date / Deadline</Label>
                <Input
                  id="end_date"
                  type="date"
                  value={newProject.end_date}
                  onChange={(e) => setNewProject({ ...newProject, end_date: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                {/* Empty for grid alignment */}
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
                  className="w-full p-2 border border-gray-300 rounded-md"
                  value={newProject.priority}
                  onChange={(e) => setNewProject({ ...newProject, priority: e.target.value })}
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
                  .filter(user => user.name && user.name !== 'Unknown' && user.email)
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
                  .filter(user => user.name && user.name !== 'Unknown' && user.email)
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
              <Button type="button" variant="outline" onClick={() => setCreateDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" className="bg-gradient-to-r from-blue-600 via-purple-600 to-blue-600 text-white font-semibold hover:shadow-xl hover:shadow-purple-500/50 transition-all duration-300 hover:scale-105 border-0">
                Create Project
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Settings Dialog */}
      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>User Settings</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="settings-name">Full Name</Label>
              <Input
                id="settings-name"
                value={userSettings.name}
                onChange={(e) => setUserSettings({ ...userSettings, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="settings-email">Email</Label>
              <Input
                id="settings-email"
                type="email"
                value={userSettings.email}
                onChange={(e) => setUserSettings({ ...userSettings, email: e.target.value })}
                disabled
              />
              <p className="text-xs text-gray-500">Email cannot be changed</p>
            </div>
            <div className="flex justify-end space-x-2 pt-4">
              <Button variant="outline" onClick={() => setSettingsOpen(false)}>
                Cancel
              </Button>
              <Button className="text-white" style={{ background: 'linear-gradient(135deg, #C23616 0%, #E84118 50%, #FFA502 100%)' }}>
                Save Changes
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add User Dialog (Admin Only) */}
      {currentUser?.role === 'admin' && (
        <Dialog open={addUserOpen} onOpenChange={setAddUserOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New User</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleAddUser} className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label htmlFor="new-user-name">Full Name *</Label>
                <Input
                  id="new-user-name"
                  placeholder="John Doe"
                  value={newUser.name}
                  onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-user-email">Email *</Label>
                <Input
                  id="new-user-email"
                  type="email"
                  placeholder="john@example.com"
                  value={newUser.email}
                  onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-user-password">Password *</Label>
                <Input
                  id="new-user-password"
                  type="password"
                  placeholder="••••••••"
                  value={newUser.password}
                  onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-user-role">Role *</Label>
                <select
                  id="new-user-role"
                  className="w-full px-3 py-2 border rounded-md"
                  value={newUser.role}
                  onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}
                >
                  <option value="user">User</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <div className="flex justify-end space-x-2 pt-4">
                <Button type="button" variant="outline" onClick={() => setAddUserOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" className="text-white" style={{ background: 'linear-gradient(135deg, #C23616 0%, #E84118 50%, #FFA502 100%)' }}>
                  Add User
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      )}

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

      {/* Task Detail Modal (Pencil Click - Edit only title & description) */}
      <TaskDetailModal
        task={selectedTask}
        open={taskDetailModalOpen}
        onClose={() => {
          setTaskDetailModalOpen(false);
          setSelectedTask(null);
        }}
        onUpdate={handleTaskUpdate}
        projects={projects}
        users={users}
        mode="title-description"
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
        projects={projects}
        users={users}
        currentUser={currentUser}
      />
    </div>
  );
};

export default Dashboard;