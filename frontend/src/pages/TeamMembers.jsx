import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Switch } from '../components/ui/switch';
import { toast } from 'sonner';
import { ArrowLeft, UserPlus, Mail, Key, Edit, Trash2, Users, CheckCircle, Clock, Grid3x3, List, UserCheck, UserX, Coffee, BarChart3, Shield, RefreshCw, User } from 'lucide-react';
import { getUserAvatarColor, getUserInitials } from '../utils/avatarUtils';
import { API_URL, BACKEND_URL } from "../config";

const API = `${BACKEND_URL}/api`;

const TeamMembers = ({ currentUser, onLogout }) => {
  const navigate = useNavigate();
  const [members, setMembers] = useState([]);
  const [projects, setProjects] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [teamActivity, setTeamActivity] = useState([]);
  const [guestLinks, setGuestLinks] = useState([]); // Guest access links
  const [loading, setLoading] = useState(true);
  const [addMemberOpen, setAddMemberOpen] = useState(false);
  const [editMemberOpen, setEditMemberOpen] = useState(false);
  const [selectedMember, setSelectedMember] = useState(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [addMethod, setAddMethod] = useState('manual'); // 'manual' or 'invite'
  const [viewMode, setViewMode] = useState('list'); // 'grid' or 'list' - DEFAULT TO LIST
  const [activeTab, setActiveTab] = useState('team'); // 'team' or 'clients'
  const [editingRole, setEditingRole] = useState(null); // For inline role editing
  const [dateFilter, setDateFilter] = useState('30'); // '7', '14', '30', 'month', 'custom'
  const [userPermissions, setUserPermissions] = useState(null); // Store user's permissions
  const [permissionOverrides, setPermissionOverrides] = useState(null); // Local state for editing
  
  const [newMember, setNewMember] = useState({
    name: '',
    email: '',
    password: '',
    role: 'user'
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const token = localStorage.getItem('token');
      const headers = token ? { Authorization: `Bearer ${token}` } : {};

      const [membersRes, projectsRes, tasksRes, activityRes] = await Promise.all([
        axios.get(`${API}/users`, { headers }),
        axios.get(`${API}/projects`, { headers }),
        axios.get(`${API}/tasks`, { headers }),
        axios.get(`${API}/jibble/team-activity`, { headers })
      ]);
      
      const membersData = Array.isArray(membersRes.data) ? membersRes.data : membersRes.data?.data || [];
      const projectsData = Array.isArray(projectsRes.data) ? projectsRes.data : projectsRes.data?.data || [];
      const tasksData = Array.isArray(tasksRes.data) ? tasksRes.data : tasksRes.data?.data || [];
      const activityData = Array.isArray(activityRes.data) ? activityRes.data : activityRes.data?.data || activityRes.data || [];
      
      setMembers(membersData); // Get ALL users (including guests)
      setProjects(projectsData);
      setTasks(tasksData);
      setTeamActivity(activityData);
      
      // Fetch guest links separately - don't let it break the page if it fails
      try {
        const guestLinksRes = await axios.get(`${API}/guest-links`, { headers });
        const guestLinksData = Array.isArray(guestLinksRes.data) ? guestLinksRes.data : guestLinksRes.data?.data || [];
        setGuestLinks(guestLinksData);
      } catch (guestError) {
        console.log('Guest links not available yet');
        setGuestLinks([]);
      }
      
      setLoading(false);
    } catch (error) {
      toast.error('Failed to load team data');
      setLoading(false);
    }
  };

  const getMemberStats = (memberId) => {
    const memberProjects = projects.filter(p => 
      p.project_owner === memberId || p.team_members?.includes(memberId)
    );
    const memberTasks = tasks.filter(t => t.assignee === memberId);
    const completedTasks = memberTasks.filter(t => t.status === 'Completed');
    const pendingTasks = memberTasks.filter(t => t.status !== 'Completed');
    
    // Calculate individual member KPIs (like their dashboard)
    const totalTasks = memberTasks.length;
    const completedCount = completedTasks.length;
    
    // Task Completion Rate
    const completionRate = totalTasks > 0 ? Math.round((completedCount / totalTasks) * 100) : 0;
    
    // On-Time Delivery Rate
    const tasksWithDueDate = memberTasks.filter(t => t.due_date && t.status === 'Completed');
    const onTimeTasks = tasksWithDueDate.filter(t => {
      const dueDate = new Date(t.due_date);
      const completedDate = t.updated_at ? new Date(t.updated_at) : new Date();
      return completedDate <= dueDate;
    });
    const onTimeRate = tasksWithDueDate.length > 0 ? Math.round((onTimeTasks.length / tasksWithDueDate.length) * 100) : 0;
    
    // Task Backlog (Overdue + Not Started)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const overdueTasks = memberTasks.filter(t => {
      if (!t.due_date || t.status === 'Completed') return false;
      const dueDate = new Date(t.due_date);
      dueDate.setHours(23, 59, 59, 999);
      return dueDate < today;
    });
    const notStartedTasks = memberTasks.filter(t => t.status === 'Not Started');
    const backlog = overdueTasks.length + notStartedTasks.length;
    
    // Active Projects
    const activeProjects = memberProjects.filter(p => !p.archived && p.status !== 'Completed').length;
    
    return {
      projectCount: memberProjects.length,
      activeProjects,
      totalTasks: memberTasks.length,
      completedTasks: completedTasks.length,
      pendingTasks: pendingTasks.length,
      completionRate,
      onTimeRate,
      backlog
    };
  };

  const handleAddMember = async (e) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('token');
      
      if (addMethod === 'manual') {
        // Manual creation with set credentials - send welcome email
        await axios.post(
          `${API}/auth/signup?send_welcome_email=true&inviter_name=${encodeURIComponent(currentUser?.name || 'Admin')}`, 
          newMember,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        toast.success(`Team member added successfully! Welcome email sent to ${newMember.email}`);
      } else {
        // Email invitation (for now, create with default password and notify)
        await axios.post(
          `${API}/auth/signup?send_welcome_email=true&inviter_name=${encodeURIComponent(currentUser?.name || 'Admin')}`,
          {
            ...newMember,
            password: 'changeme123' // Default password for invited users
          },
          { headers: { Authorization: `Bearer ${token}` } }
        );
        toast.success(`Invitation sent to ${newMember.email}!`);
      }
      setAddMemberOpen(false);
      setNewMember({ name: '', email: '', password: '', role: 'user' });
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to add member');
    }
  };

  const handleUpdatePassword = async (e) => {
    e.preventDefault();
    try {
      await axios.put(
        `${API}/users/${selectedMember.id}/password?new_password=${encodeURIComponent(selectedMember.newPassword)}`
      );
      toast.success('Password updated successfully!');
      setEditMemberOpen(false);
      setSelectedMember(null);
    } catch (error) {
      toast.error('Failed to update password');
    }
  };

  const handleDeleteMember = async (memberId) => {
    if (!window.confirm('Are you sure you want to delete this member?')) return;
    
    try {
      await axios.delete(`${API}/users/${memberId}`);
      toast.success('Member deleted successfully');
      fetchData();
    } catch (error) {
      toast.error('Failed to delete member');
    }
  };

  const handlePictureUpload = async (file, memberId) => {
    if (!file) return;
    
    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image size must be less than 5MB');
      return;
    }
    
    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('Please upload an image file');
      return;
    }
    
    try {
      const reader = new FileReader();
      reader.onloadend = async () => {
        try {
          // Update user's profile image
          await axios.put(`${API}/users/${memberId}`, {
            profile_image_url: reader.result
          });
          
          toast.success('Profile picture updated successfully!');
          fetchData();
          
          // Update selected member if modal is open
          if (selectedMember && selectedMember.id === memberId) {
            setSelectedMember({
              ...selectedMember,
              profile_image_url: reader.result
            });
          }
        } catch (error) {
          toast.error('Failed to upload profile picture');
        }
      };
      reader.readAsDataURL(file);
    } catch (error) {
      toast.error('Failed to process image');
    }
  };

  const fetchUserPermissions = async (userId) => {
    try {
      const response = await axios.get(`${API}/users/${userId}/permissions`);
      console.log('User permissions fetched:', response.data);
      setUserPermissions(response.data);
      // Initialize with effective permissions if no overrides exist
      setPermissionOverrides(response.data.permission_overrides || response.data.effective_permissions || {});
    } catch (error) {
      toast.error('Failed to load user permissions');
      console.error('Permission fetch error:', error);
    }
  };

  const handlePermissionOverrideToggle = (permission) => {
    setPermissionOverrides({
      ...permissionOverrides,
      [permission]: !permissionOverrides[permission]
    });
  };

  const handleSavePermissions = async (userId) => {
    try {
      await axios.put(`${API}/users/${userId}/permissions`, {
        user_id: userId,
        permission_overrides: Object.keys(permissionOverrides).length > 0 ? permissionOverrides : null
      });
      toast.success('User permissions updated successfully');
      fetchUserPermissions(userId);
    } catch (error) {
      toast.error('Failed to update permissions');
      console.error('Permission update error:', error);
    }
  };

  const handleResetToRoleDefaults = async (userId) => {
    try {
      await axios.put(`${API}/users/${userId}/permissions`, {
        user_id: userId,
        permission_overrides: null
      });
      toast.success('Permissions reset to role defaults');
      fetchUserPermissions(userId);
    } catch (error) {
      toast.error('Failed to reset permissions');
      console.error('Permission reset error:', error);
    }
  };

  // Filter members based on active tab
  const teamMembers = members.filter(m => m.role !== 'client'); // Admin, Manager, Team Member
  
  // Get clients (users with role 'client') and their associated projects
  const clientUsers = members.filter(m => m.role === 'client');
  const clientsWithProjects = clientUsers.map(client => {
    // Find projects where this client is in the guests array
    const clientProjects = projects.filter(p => 
      p.guests && p.guests.includes(client.id)
    );
    
    return {
      ...client,
      projects: clientProjects
    };
  });

  // Apply search filter (only team members, no clients)
  const filteredMembers = teamMembers.filter(m => 
    searchQuery === '' || 
    m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    m.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Check if user can view clients tab
  const canViewClients = currentUser?.role === 'admin' || currentUser?.role === 'manager';

  // Check if user can edit roles
  const canEditRoles = currentUser?.role === 'admin';

  // Handle role change
  const handleRoleChange = async (memberId, newRole) => {
    try {
      await axios.put(`${API}/users/${memberId}`, { role: newRole });
      toast.success(`Role updated to ${newRole}`);
      setEditingRole(null);
      fetchData();
    } catch (error) {
      toast.error('Failed to update role');
    }
  };

  // Role badge styling
  const getRoleBadge = (role) => {
    const badges = {
      admin: { bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-700 dark:text-red-400', label: 'Admin' },
      manager: { bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-700 dark:text-blue-400', label: 'Manager' },
      'team member': { bg: 'bg-purple-100 dark:bg-purple-900/30', text: 'text-purple-700 dark:text-purple-400', label: 'Team Member' },
      guest: { bg: 'bg-gray-100 dark:bg-gray-900/30', text: 'text-gray-700 dark:text-gray-400', label: 'Client' }
    };
    return badges[role?.toLowerCase()] || badges['team member'];
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Header with Tabs */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-2">Team Management</h1>
          <p className="text-gray-600 dark:text-gray-400">Manage team members with real-time status</p>
          
          {/* Tabs */}
          <div className="mt-6 flex space-x-1">
            <button
              onClick={() => setActiveTab('team')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === 'team'
                  ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800'
              }`}
            >
              Team Members ({teamMembers.length})
            </button>
            {canViewClients && (
              <button
                onClick={() => setActiveTab('clients')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  activeTab === 'clients'
                    ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800'
                }`}
              >
                Clients ({clientsWithProjects.length})
              </button>
            )}
          </div>
        </div>

        {/* Team Members Tab Content */}
        {activeTab === 'team' && (
          <>
            {/* Overview Stats - 5 Cards including Team Utilization - TEAM ONLY */}
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-6 mb-8">
          <Card className="border border-purple-200/50 dark:border-purple-800/50 bg-white/80 dark:bg-gray-800/80 backdrop-blur-xl shadow-lg hover:shadow-xl transition-all">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-1 font-medium">Total Members</p>
                  <h3 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">{teamMembers.length}</h3>
                  <p className="text-xs text-green-600 mt-1 font-semibold">{teamActivity.filter(m => m.status === 'IN').length} online</p>
                </div>
                <div className="p-3 rounded-2xl bg-gradient-to-br from-purple-500/20 to-pink-500/20 shadow-inner">
                  <Users className="w-7 h-7 text-purple-600 dark:text-purple-400" />
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="border border-purple-200/50 dark:border-purple-800/50 bg-white/80 dark:bg-gray-800/80 backdrop-blur-xl shadow-lg hover:shadow-xl transition-all">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-1 font-medium">Team Utilization</p>
                  <h3 className="text-2xl font-bold bg-gradient-to-r from-orange-600 to-red-600 bg-clip-text text-transparent">
                    {teamMembers.length > 0 ? Math.round((new Set(tasks.map(t => t.assignee)).size / teamMembers.length) * 100) : 0}%
                  </h3>
                  <p className="text-xs text-gray-600 mt-1 font-semibold">{new Set(tasks.map(t => t.assignee)).size} with tasks</p>
                </div>
                <div className="p-3 rounded-2xl bg-gradient-to-br from-orange-500/20 to-red-500/20 shadow-inner">
                  <BarChart3 className="w-7 h-7 text-orange-600 dark:text-orange-400" />
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="border border-purple-200/50 dark:border-purple-800/50 bg-white/80 dark:bg-gray-800/80 backdrop-blur-xl shadow-lg hover:shadow-xl transition-all">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-1 font-medium">Active Projects</p>
                  <h3 className="text-2xl font-bold bg-gradient-to-r from-green-600 to-blue-600 bg-clip-text text-transparent">{projects.length}</h3>
                </div>
                <div className="p-3 rounded-2xl bg-gradient-to-br from-green-500/20 to-blue-500/20 shadow-inner">
                  <CheckCircle className="w-7 h-7 text-green-600 dark:text-green-400" />
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="border border-purple-200/50 dark:border-purple-800/50 bg-white/80 dark:bg-gray-800/80 backdrop-blur-xl shadow-lg hover:shadow-xl transition-all">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-1 font-medium">Total Tasks</p>
                  <h3 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent">{tasks.length}</h3>
                </div>
                <div className="p-3 rounded-2xl bg-gradient-to-br from-blue-500/20 to-cyan-500/20 shadow-inner">
                  <Clock className="w-7 h-7 text-blue-600 dark:text-blue-400" />
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="border border-purple-200/50 dark:border-purple-800/50 bg-white/80 dark:bg-gray-800/80 backdrop-blur-xl shadow-lg hover:shadow-xl transition-all">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-1 font-medium">Avg Completion</p>
                  <h3 className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
                    {teamMembers.length > 0 ? Math.round(teamMembers.reduce((acc, m) => acc + getMemberStats(m.id).completionRate, 0) / teamMembers.length) : 0}%
                  </h3>
                </div>
                <div className="p-3 rounded-2xl bg-gradient-to-br from-purple-500/20 to-pink-500/20 shadow-inner">
                  <CheckCircle className="w-7 h-7 text-purple-600 dark:text-purple-400" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Actions Bar */}
        <div className="flex items-center justify-between mb-6 gap-4">
          <div className="flex-1 max-w-md">
            <Input
              placeholder="Search members by name or email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white/80 dark:bg-gray-800/80 backdrop-blur-xl border-purple-200/50 dark:border-purple-800/50"
            />
          </div>
          <div className="flex items-center gap-2">
            {/* Date Filter for KPIs */}
            <select
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="px-4 py-2 rounded-xl border border-purple-200/50 dark:border-purple-800/50 bg-white/80 dark:bg-gray-800/80 backdrop-blur-xl text-sm font-medium text-gray-700 dark:text-gray-300"
            >
              <option value="7">Last 7 Days</option>
              <option value="14">Last 14 Days</option>
              <option value="30">Last 30 Days</option>
              <option value="month">Last Month</option>
            </select>
            
            {/* View Toggle */}
            <div className="flex items-center space-x-1 bg-gradient-to-r from-purple-100/50 to-blue-100/50 dark:from-purple-900/30 dark:to-blue-900/30 p-1 rounded-xl backdrop-blur-sm border border-purple-200/30">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-2 rounded-lg transition-all ${viewMode === 'grid' ? 'bg-gradient-to-r from-blue-500 to-purple-500 text-white shadow-lg' : 'text-gray-600 dark:text-gray-400'}`}
              >
                <Grid3x3 className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`p-2 rounded-lg transition-all ${viewMode === 'list' ? 'bg-gradient-to-r from-blue-500 to-purple-500 text-white shadow-lg' : 'text-gray-600 dark:text-gray-400'}`}
              >
                <List className="w-4 h-4" />
              </button>
            </div>
            <Button 
              onClick={() => setAddMemberOpen(true)}
              className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-semibold"
            >
              <UserPlus className="w-4 h-4 mr-2" />
              Add Member
            </Button>
          </div>
        </div>

        {/* Members Display - Grid or List */}
        {viewMode === 'grid' ? (
          /* Grid View */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredMembers.map((member) => {
              const stats = getMemberStats(member.id);
              const jibbleData = teamActivity.find(m => m.email === member.email);
              const status = jibbleData?.status || 'OUT';
              const initials = getUserInitials(member.name);
              const avatarColor = getUserAvatarColor(member.id, member.email);
              
              return (
                <Card 
                  key={member.id}
                  className="border border-purple-200/50 dark:border-purple-800/50 bg-white/80 dark:bg-gray-800/80 backdrop-blur-xl shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105 cursor-pointer"
                  onClick={() => {
                    setSelectedMember(member);
                    setDetailsOpen(true);
                    fetchUserPermissions(member.id);
                  }}
                >
                  <CardContent className="pt-6">
                    <div className="flex flex-col items-center text-center">
                      {/* Avatar with Status */}
                      <div className="relative mb-4">
                        {member.profile_image_url ? (
                          <img 
                            src={member.profile_image_url} 
                            alt={member.name}
                            className="w-20 h-20 rounded-2xl object-cover shadow-lg"
                          />
                        ) : (
                          <div className={`w-20 h-20 rounded-2xl ${avatarColor} flex items-center justify-center text-white font-bold text-2xl shadow-lg`}>
                            {initials}
                          </div>
                        )}
                        <div className={`absolute -bottom-1 -right-1 w-6 h-6 rounded-full border-3 border-white shadow-lg ${
                          status === 'IN' ? 'bg-green-500' :
                          status === 'BREAK' ? 'bg-yellow-500' : 'bg-gray-400'
                        }`}>
                          {status === 'IN' && <UserCheck className="w-4 h-4 text-white m-auto" />}
                          {status === 'BREAK' && <Coffee className="w-4 h-4 text-white m-auto" />}
                          {status === 'OUT' && <UserX className="w-3 h-3 text-white m-auto mt-1" />}
                        </div>
                      </div>
                      
                      {/* Member Info */}
                      <h4 className="font-bold text-gray-900 dark:text-white mb-1 truncate w-full">{member.name}</h4>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mb-1 truncate w-full">{member.email}</p>
                      
                      {/* Role Badge - Editable */}
                      {editingRole === member.id && canEditRoles ? (
                        <select
                          value={member.role}
                          onChange={(e) => handleRoleChange(member.id, e.target.value)}
                          onBlur={() => setEditingRole(null)}
                          autoFocus
                          className="text-xs px-3 py-1 rounded-lg border-2 border-purple-500 font-semibold shadow-lg bg-white dark:bg-gray-800 mt-2"
                        >
                          <option value="admin">Admin</option>
                          <option value="manager">Manager</option>
                          <option value="team member">Team Member</option>
                        </select>
                      ) : (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (canEditRoles) {
                              setEditingRole(member.id);
                            }
                          }}
                          disabled={!canEditRoles}
                          className={`flex items-center justify-center gap-1 text-xs px-3 py-1 rounded-lg font-semibold mt-2 mb-1 ${getRoleBadge(member.role).bg} ${getRoleBadge(member.role).text} ${canEditRoles ? 'cursor-pointer hover:ring-2 hover:ring-purple-500 transition-all' : 'cursor-default'}`}
                          title={canEditRoles ? "Click to edit role" : ""}
                        >
                          {getRoleBadge(member.role).label}
                          {canEditRoles && <Edit className="w-3 h-3 ml-1" />}
                        </button>
                      )}
                      
                      {/* Online Status */}
                      <span className={`text-xs px-3 py-1 rounded-lg font-semibold mt-1 ${
                        status === 'IN' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                        status === 'BREAK' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' :
                        'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400'
                      }`}>
                        {status === 'IN' ? 'Online' : status === 'BREAK' ? 'On Break' : 'Offline'}
                      </span>
                      
                      {/* Stats */}
                      <div className="grid grid-cols-3 gap-3 w-full mt-4 pt-4 border-t border-purple-200/50 dark:border-purple-800/50">
                        <div>
                          <p className="text-xs text-gray-500 dark:text-gray-400">Projects</p>
                          <p className="text-lg font-bold text-purple-600 dark:text-purple-400">{stats.projectCount}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500 dark:text-gray-400">Tasks</p>
                          <p className="text-lg font-bold text-blue-600 dark:text-blue-400">{stats.totalTasks}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500 dark:text-gray-400">Done</p>
                          <p className="text-lg font-bold text-green-600 dark:text-green-400">{stats.completionRate}%</p>
                        </div>
                      </div>
                      
                      {/* Actions */}
                      <div className="flex items-center gap-2 mt-4 w-full">
                        <Button 
                          variant="outline" 
                          size="sm"
                          className="flex-1"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedMember(member);
                            setEditMemberOpen(true);
                          }}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        {member.id !== currentUser.id && (
                          <Button 
                            variant="outline" 
                            size="sm"
                            className="flex-1 text-red-600 hover:text-red-700"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteMember(member.id);
                            }}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ) : (
          /* List View */
          <Card className="border border-purple-200/50 dark:border-purple-800/50 bg-white/80 dark:bg-gray-800/80 backdrop-blur-xl shadow-lg">
            <CardHeader>
              <CardTitle className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                All Team Members
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {filteredMembers.map((member) => {
                  const stats = getMemberStats(member.id);
                  const jibbleData = teamActivity.find(m => m.email === member.email);
                  const status = jibbleData?.status || 'OUT';
                  const initials = getUserInitials(member.name);
                  const avatarColor = getUserAvatarColor(member.id, member.email);
                  
                  return (
                    <div 
                      key={member.id} 
                      className="flex items-center justify-between p-4 bg-gradient-to-r from-purple-50/50 to-blue-50/50 dark:from-purple-900/20 dark:to-blue-900/20 rounded-xl border border-purple-200/50 dark:border-purple-800/50 hover:shadow-md transition-all cursor-pointer"
                      onClick={() => {
                        setSelectedMember(member);
                        setDetailsOpen(true);
                        fetchUserPermissions(member.id);
                      }}
                    >
                      <div className="flex items-center space-x-4 flex-1">
                        <div className="relative">
                          {member.profile_image_url ? (
                            <img 
                              src={member.profile_image_url} 
                              alt={member.name}
                              className="w-14 h-14 rounded-xl object-cover shadow-md"
                            />
                          ) : (
                            <div className={`w-14 h-14 rounded-xl ${avatarColor} flex items-center justify-center text-white font-bold text-lg shadow-md`}>
                              {initials}
                            </div>
                          )}
                          <div className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-full border-2 border-white shadow-lg ${
                            status === 'IN' ? 'bg-green-500' :
                            status === 'BREAK' ? 'bg-yellow-500' : 'bg-gray-400'
                          }`}></div>
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <h4 className="font-bold text-gray-900 dark:text-white">{member.name}</h4>
                          </div>
                          <p className="text-sm text-gray-500 dark:text-gray-400">{member.email}</p>
                          <span className={`text-xs px-2 py-1 rounded-lg font-semibold mt-1 inline-block ${
                            status === 'IN' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                            status === 'BREAK' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' :
                            'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400'
                          }`}>
                            {status === 'IN' ? 'Online' : status === 'BREAK' ? 'On Break' : 'Offline'}
                          </span>
                        </div>
                      </div>
                      
                      {/* Individual Member KPIs */}
                      <div className="flex items-center space-x-6 mr-6">
                        <div className="text-center">
                          <p className="text-xs text-gray-500 dark:text-gray-400">Active Projects</p>
                          <p className="text-lg font-bold text-blue-600 dark:text-blue-400">{stats.activeProjects}</p>
                        </div>
                        <div className="text-center">
                          <p className="text-xs text-gray-500 dark:text-gray-400">Completion</p>
                          <p className="text-lg font-bold text-green-600 dark:text-green-400">{stats.completionRate}%</p>
                        </div>
                        <div className="text-center">
                          <p className="text-xs text-gray-500 dark:text-gray-400">On-Time</p>
                          <p className="text-lg font-bold text-purple-600 dark:text-purple-400">{stats.onTimeRate}%</p>
                        </div>
                        <div className="text-center">
                          <p className="text-xs text-gray-500 dark:text-gray-400">Backlog</p>
                          <p className="text-lg font-bold text-orange-600 dark:text-orange-400">{stats.backlog}</p>
                        </div>
                        <div className="text-center">
                          <p className="text-xs text-gray-500 dark:text-gray-400">Total Tasks</p>
                          <p className="text-lg font-bold text-gray-600 dark:text-gray-400">{stats.totalTasks}</p>
                        </div>
                      </div>

                      {/* Editable Role Badge - At End of Line */}
                      <div className="flex items-center space-x-3 mr-4">
                        {editingRole === member.id && canEditRoles ? (
                          <select
                            value={member.role}
                            onChange={(e) => handleRoleChange(member.id, e.target.value)}
                            onBlur={() => setEditingRole(null)}
                            autoFocus
                            className="text-xs px-3 py-1 rounded-lg border-2 border-purple-500 font-semibold shadow-lg bg-white dark:bg-gray-800"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <option value="admin">Admin</option>
                            <option value="manager">Manager</option>
                            <option value="team member">Team Member</option>
                          </select>
                        ) : (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              if (canEditRoles) {
                                setEditingRole(member.id);
                              }
                            }}
                            disabled={!canEditRoles}
                            className={`flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg font-semibold ${getRoleBadge(member.role).bg} ${getRoleBadge(member.role).text} ${canEditRoles ? 'cursor-pointer hover:ring-2 hover:ring-purple-500 transition-all hover:scale-105' : 'cursor-default'}`}
                            title={canEditRoles ? "Click to edit role" : ""}
                          >
                            {getRoleBadge(member.role).label}
                            {canEditRoles && <Edit className="w-3 h-3 ml-1" />}
                          </button>
                        )}
                      </div>

                      <div className="flex items-center space-x-2">
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedMember(member);
                            setEditMemberOpen(true);
                          }}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        {member.id !== currentUser.id && (
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteMember(member.id);
                            }}
                          >
                            <Trash2 className="w-4 h-4 text-red-600" />
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}
          </>
        )}

        {/* Clients Tab Content */}
        {activeTab === 'clients' && (
          <div className="space-y-6">
            {clientsWithProjects.length === 0 ? (
              <Card className="border border-purple-200/50 dark:border-purple-800/50 bg-white/80 dark:bg-gray-800/80 backdrop-blur-xl shadow-lg">
                <CardContent className="pt-6">
                  <div className="text-center py-12">
                    <Users className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-xl font-semibold text-gray-600 dark:text-gray-300 mb-2">No Clients Yet</h3>
                    <p className="text-gray-500 dark:text-gray-400">Clients will appear here when they access projects via shared links.</p>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card className="border border-purple-200/50 dark:border-purple-800/50 bg-white/80 dark:bg-gray-800/80 backdrop-blur-xl shadow-lg">
                <CardHeader>
                  <CardTitle className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                    Project Clients ({clientsWithProjects.length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {clientsWithProjects.map((client) => {
                      const initials = getUserInitials(client.name);
                      const avatarColor = getUserAvatarColor(client.id, client.email);
                      
                      return (
                        <div 
                          key={client.id} 
                          className="flex items-center justify-between p-4 bg-gradient-to-r from-purple-50/50 to-blue-50/50 dark:from-purple-900/20 dark:to-blue-900/20 rounded-xl border border-purple-200/50 dark:border-purple-800/50 hover:shadow-md transition-all"
                        >
                          <div className="flex items-center space-x-4 flex-1">
                            <div className="relative">
                              {client.profile_image_url ? (
                                <img 
                                  src={client.profile_image_url} 
                                  alt={client.name}
                                  className="w-12 h-12 rounded-xl object-cover shadow-md"
                                />
                              ) : (
                                <div className={`w-12 h-12 rounded-xl ${avatarColor} flex items-center justify-center text-white font-bold text-sm shadow-md`}>
                                  {initials}
                                </div>
                              )}
                              <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-blue-500 border-2 border-white shadow-lg flex items-center justify-center">
                                <User className="w-2 h-2 text-white" />
                              </div>
                            </div>
                            
                            <div className="flex-1">
                              <div className="flex items-center gap-3">
                                <h4 className="font-semibold text-gray-800 dark:text-white">{client.name}</h4>
                                <span className="px-2 py-1 rounded text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400">
                                  Client
                                </span>
                              </div>
                              <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">{client.email}</p>
                              <div className="text-sm text-gray-500 dark:text-gray-400">
                                <strong>Projects:</strong>{' '}
                                {client.projects.length === 0 ? (
                                  <span className="text-gray-400">No projects assigned</span>
                                ) : (
                                  client.projects.map((project, index) => (
                                    <span key={project.id}>
                                      {project.name}
                                      {index < client.projects.length - 1 ? ', ' : ''}
                                    </span>
                                  ))
                                )}
                              </div>
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-4">
                            <div className="text-right text-sm text-gray-500 dark:text-gray-400">
                              <div>{client.projects.length} project{client.projects.length !== 1 ? 's' : ''}</div>
                              <div className="text-xs">
                                Joined {new Date(client.created_at).toLocaleDateString()}
                              </div>
                            </div>
                            
                            {/* Delete Button - Only for admins */}
                            {currentUser?.role === 'admin' && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (window.confirm(`Are you sure you want to delete ${client.name}? This will revoke their access to all projects.`)) {
                                    handleDeleteMember(client.id);
                                  }
                                }}
                                className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
                                title="Delete client and revoke access"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </main>

      {/* Add Member Dialog */}
      <Dialog open={addMemberOpen} onOpenChange={setAddMemberOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Team Member</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAddMember} className="space-y-4">
            {/* Method Selection */}
            <div className="flex space-x-2 mb-4">
              <Button
                type="button"
                variant={addMethod === 'manual' ? 'default' : 'outline'}
                onClick={() => setAddMethod('manual')}
                className="flex-1"
              >
                <Key className="w-4 h-4 mr-2" />
                Set Credentials
              </Button>
              <Button
                type="button"
                variant={addMethod === 'invite' ? 'default' : 'outline'}
                onClick={() => setAddMethod('invite')}
                className="flex-1"
              >
                <Mail className="w-4 h-4 mr-2" />
                Send Invitation
              </Button>
            </div>

            <div className="space-y-2">
              <Label htmlFor="name">Full Name</Label>
              <Input
                id="name"
                value={newMember.name}
                onChange={(e) => setNewMember({ ...newMember, name: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={newMember.email}
                onChange={(e) => setNewMember({ ...newMember, email: e.target.value })}
                required
              />
            </div>
            {addMethod === 'manual' && (
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={newMember.password}
                  onChange={(e) => setNewMember({ ...newMember, password: e.target.value })}
                  required
                />
              </div>
            )}
            {addMethod === 'invite' && (
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-sm text-blue-800">
                  An invitation will be sent to {newMember.email || 'the email address'} with default password: <strong>changeme123</strong>
                </p>
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="role">Role</Label>
              <select
                id="role"
                value={newMember.role}
                onChange={(e) => setNewMember({ ...newMember, role: e.target.value })}
                className="w-full p-2 border border-gray-300 rounded-md"
              >
                <option value="user">Team Member</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <div className="flex justify-end space-x-2 pt-4">
              <Button type="button" variant="outline" onClick={() => setAddMemberOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" className="text-white" style={{ background: 'linear-gradient(135deg, #C23616 0%, #E84118 50%, #FFA502 100%)' }}>
                {addMethod === 'manual' ? 'Add Member' : 'Send Invitation'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Password Dialog */}
      <Dialog open={editMemberOpen} onOpenChange={setEditMemberOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Update Password for {selectedMember?.name}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleUpdatePassword} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="new-password">New Password</Label>
              <Input
                id="new-password"
                type="password"
                value={selectedMember?.newPassword || ''}
                onChange={(e) => setSelectedMember({ ...selectedMember, newPassword: e.target.value })}
                required
              />
            </div>
            <div className="flex justify-end space-x-2 pt-4">
              <Button type="button" variant="outline" onClick={() => setEditMemberOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" className="text-white" style={{ background: 'linear-gradient(135deg, #C23616 0%, #E84118 50%, #FFA502 100%)' }}>
                Update Password
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Member Details Modal - Enhanced */}
      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">Member Details & Settings</DialogTitle>
          </DialogHeader>
          {selectedMember && (
            <div className="space-y-6">
              {/* Profile Section */}
              <div className="flex items-start justify-between">
                <div className="flex items-center space-x-4">
                  {selectedMember.profile_image_url ? (
                    <img 
                      src={selectedMember.profile_image_url} 
                      alt={selectedMember.name}
                      className="w-20 h-20 rounded-full object-cover shadow-lg"
                    />
                  ) : (
                    <div className={`w-20 h-20 rounded-full ${getUserAvatarColor(selectedMember.id, selectedMember.email)} flex items-center justify-center text-white font-semibold text-2xl shadow-lg`}>
                      {getUserInitials(selectedMember.name)}
                    </div>
                  )}
                  <div>
                    <h3 className="text-xl font-semibold text-gray-900 dark:text-white">{selectedMember.name}</h3>
                    <p className="text-gray-500 dark:text-gray-400">{selectedMember.email}</p>
                    <span className={`inline-block mt-1 text-xs px-3 py-1 rounded-lg font-semibold ${getRoleBadge(selectedMember.role).bg} ${getRoleBadge(selectedMember.role).text}`}>
                      {getRoleBadge(selectedMember.role).label}
                    </span>
                  </div>
                </div>
                
                {/* Action Buttons */}
                <div className="flex flex-col gap-2">
                  {(currentUser?.role === 'admin' || currentUser?.role === 'manager') && (
                    <>
                      <Button
                        size="sm"
                        className="bg-gradient-to-r from-blue-600 to-purple-600 text-white"
                        onClick={() => document.getElementById(`picture-upload-${selectedMember.id}`).click()}
                      >
                        <Edit className="w-4 h-4 mr-2" />
                        Change Picture
                      </Button>
                      <input
                        id={`picture-upload-${selectedMember.id}`}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          if (e.target.files[0]) {
                            handlePictureUpload(e.target.files[0], selectedMember.id);
                          }
                        }}
                      />
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-orange-500 text-orange-600 hover:bg-orange-50"
                        onClick={() => {
                          if (confirm(`Reset password for ${selectedMember.name}?`)) {
                            toast.info('Password reset feature coming soon!');
                          }
                        }}
                      >
                        <Key className="w-4 h-4 mr-2" />
                        Reset Password
                      </Button>
                    </>
                  )}
                </div>
              </div>

              {/* Individual Dashboard KPIs */}
              <div>
                <h4 className="text-lg font-semibold mb-3 text-gray-900 dark:text-white">Individual Dashboard KPIs</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <Card className="border border-purple-200/50 bg-white/80 backdrop-blur-xl">
                    <CardContent className="pt-4">
                      <p className="text-xs text-gray-500 dark:text-gray-400">Active Projects</p>
                      <p className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent">
                        {getMemberStats(selectedMember.id).activeProjects}
                      </p>
                    </CardContent>
                  </Card>
                  <Card className="border border-purple-200/50 bg-white/80 backdrop-blur-xl">
                    <CardContent className="pt-4">
                      <p className="text-xs text-gray-500 dark:text-gray-400">Completion Rate</p>
                      <p className="text-3xl font-bold bg-gradient-to-r from-green-600 to-blue-600 bg-clip-text text-transparent">
                        {getMemberStats(selectedMember.id).completionRate}%
                      </p>
                    </CardContent>
                  </Card>
                  <Card className="border border-purple-200/50 bg-white/80 backdrop-blur-xl">
                    <CardContent className="pt-4">
                      <p className="text-xs text-gray-500 dark:text-gray-400">On-Time Delivery</p>
                      <p className="text-3xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
                        {getMemberStats(selectedMember.id).onTimeRate}%
                      </p>
                    </CardContent>
                  </Card>
                  <Card className="border border-purple-200/50 bg-white/80 backdrop-blur-xl">
                    <CardContent className="pt-4">
                      <p className="text-xs text-gray-500 dark:text-gray-400">Task Backlog</p>
                      <p className="text-3xl font-bold bg-gradient-to-r from-orange-600 to-red-600 bg-clip-text text-transparent">
                        {getMemberStats(selectedMember.id).backlog}
                      </p>
                    </CardContent>
                  </Card>
                </div>
              </div>

              {/* Task Breakdown */}
              <div>
                <h4 className="text-lg font-semibold mb-3 text-gray-900 dark:text-white">Task Overview</h4>
                <div className="grid grid-cols-3 gap-4">
                  <Card className="border border-green-200/50 bg-green-50/50 backdrop-blur-lg">
                    <CardContent className="pt-4">
                      <p className="text-xs text-gray-500">Completed Tasks</p>
                      <p className="text-2xl font-bold text-green-600">
                        {getMemberStats(selectedMember.id).completedTasks}
                      </p>
                    </CardContent>
                  </Card>
                  <Card className="border border-orange-200/50 bg-orange-50/50 backdrop-blur-lg">
                    <CardContent className="pt-4">
                      <p className="text-xs text-gray-500">Pending Tasks</p>
                      <p className="text-2xl font-bold text-orange-600">
                        {getMemberStats(selectedMember.id).pendingTasks}
                      </p>
                    </CardContent>
                  </Card>
                  <Card className="border border-blue-200/50 bg-blue-50/50 backdrop-blur-lg">
                    <CardContent className="pt-4">
                      <p className="text-xs text-gray-500">Total Tasks</p>
                      <p className="text-2xl font-bold text-blue-600">
                        {getMemberStats(selectedMember.id).totalTasks}
                      </p>
                    </CardContent>
                  </Card>
                </div>
              </div>

              {/* Completion Rate Progress Bar */}
              <Card className="border border-purple-200/50 bg-white/80 backdrop-blur-xl">
                <CardContent className="pt-4">
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">Overall Completion Progress</p>
                  <div className="flex items-center space-x-4">
                    <div className="flex-1">
                      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3">
                        <div 
                          className="bg-gradient-to-r from-green-500 to-blue-500 h-3 rounded-full transition-all duration-500"
                          style={{ width: `${getMemberStats(selectedMember.id).completionRate}%` }}
                        ></div>
                      </div>
                    </div>
                    <span className="text-lg font-bold text-green-600">
                      {getMemberStats(selectedMember.id).completionRate}%
                    </span>
                  </div>
                </CardContent>
              </Card>

              {/* Permission Overrides Section (Admin Only) */}
              {currentUser?.role === 'admin' && userPermissions && (
                <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center space-x-2">
                      <Shield className="w-5 h-5 text-purple-600" />
                      <h4 className="text-lg font-semibold text-gray-900 dark:text-white">Permission Overrides</h4>
                    </div>
                    {userPermissions.permission_overrides && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          if (confirm(`Reset ${selectedMember.name}'s permissions to role defaults?`)) {
                            handleResetToRoleDefaults(selectedMember.id);
                          }
                        }}
                        className="text-orange-600 border-orange-300 hover:bg-orange-50"
                      >
                        <RefreshCw className="w-4 h-4 mr-2" />
                        Reset to Role Defaults
                      </Button>
                    )}
                  </div>
                  
                  <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3 mb-4">
                    <p className="text-sm text-blue-800 dark:text-blue-200">
                      <strong>Current Role:</strong> {selectedMember.role.charAt(0).toUpperCase() + selectedMember.role.slice(1)}
                      <br />
                      <span className="text-xs">Override individual permissions below. Leave unconfigured to use role defaults.</span>
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {permissionOverrides && (() => {
                      const permissions = [
                        'can_view_team_tab',
                        'can_view_time_sheet_tab',
                        'can_view_reports_tab',
                        'can_complete_project_tasks',
                        'can_edit_workspace_settings',
                        'can_create_recurring_tasks',
                        'can_create_new_projects',
                        'can_chat_with_millii',
                        'can_have_direct_chat'
                      ];
                      
                      const labels = {
                        can_view_team_tab: 'View Team Tab',
                        can_view_time_sheet_tab: 'View Time Sheet Tab',
                        can_view_reports_tab: 'View Reports Tab',
                        can_complete_project_tasks: 'Complete Project Tasks',
                        can_edit_workspace_settings: 'Edit Workspace Settings',
                        can_create_recurring_tasks: 'Create Recurring Tasks',
                        can_create_new_projects: 'Create New Projects',
                        can_chat_with_millii: 'Chat with Millii AI',
                        can_have_direct_chat: 'Direct Chat'
                      };
                      
                      return permissions.map((permission) => {
                        const isOverridden = userPermissions?.permission_overrides?.[permission] !== undefined;
                        const roleDefault = userPermissions?.role_permissions?.[permission];
                        
                        return (
                          <div 
                            key={permission}
                            className={`flex items-center justify-between p-3 rounded-lg ${isOverridden ? 'bg-amber-50 dark:bg-amber-900/20 border border-amber-300 dark:border-amber-700' : 'bg-gray-50 dark:bg-gray-900/50'}`}
                          >
                            <div className="flex-1">
                              <p className="text-sm font-medium text-gray-800 dark:text-white">
                                {labels[permission]}
                              </p>
                              <p className="text-xs text-gray-500 dark:text-gray-400">
                                {isOverridden ? '⚠️ Overridden' : `Role default: ${roleDefault ? 'Yes' : 'No'}`}
                              </p>
                            </div>
                            <Switch
                              checked={permissionOverrides[permission] || false}
                              onCheckedChange={() => handlePermissionOverrideToggle(permission)}
                            />
                          </div>
                        );
                      });
                    })()}
                  </div>

                  <div className="flex justify-end mt-4 space-x-2">
                    <Button 
                      onClick={() => handleSavePermissions(selectedMember.id)}
                      className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
                    >
                      <CheckCircle className="w-4 h-4 mr-2" />
                      Save Permissions
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default TeamMembers;
