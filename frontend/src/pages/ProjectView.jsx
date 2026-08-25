import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Progress } from '../components/ui/progress';
import { toast } from 'sonner';
import { ArrowLeft, Link as LinkIcon, PlusCircle, Trash2, CheckCircle, Circle, Users, Calendar, Flag, LogOut, Copy, FolderOpen, Video, Package, AlertCircle, Edit, Settings, Activity } from 'lucide-react';
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
  const [visibilityModalOpen, setVisibilityModalOpen] = useState(false);
  const [newTask, setNewTask] = useState({ title: '', description: '', assignee: '', due_date: '', priority: 'Medium', status: 'Not Started' });
  const [newDoc, setNewDoc] = useState({ title: '', url: '' });
  const [timeEntries, setTimeEntries] = useState([]);

  useEffect(() => { fetchProjectData(); fetchUsers(); }, [projectId]);
  // Keep project view timesheet in sync with tracker updates
  useEffect(() => {
    const handler = () => fetchProjectData();
    window.addEventListener('time-tracker:updated', handler);
    return () => window.removeEventListener('time-tracker:updated', handler);
  }, [projectId]);


  const fetchProjectData = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/projects/${projectId}/full-data`, { headers: { Authorization: `Bearer ${token}` } });
      const data = response.data;
      setProject(data.project);
      setTasks(data.tasks || []);
      setDocuments(data.documents || []);
      setGuestLink(data.guest_link);
      // Fetch time entries for this project (durations only)
      try {
        const te = await axios.get(`${API}/time-entries`, { params: { project_id: projectId, include_enhanced: false }, headers: { Authorization: `Bearer ${token}` } });
        setTimeEntries(Array.isArray(te.data) ? te.data : []);
      } catch (e) { setTimeEntries([]); }
      setLoading(false);
    } catch (error) {
      console.error('Error fetching project:', error);
      toast.error('Failed to load project');
      setLoading(false);
    }
  };

  const fetchUsers = async () => {
    try { const token = localStorage.getItem('token'); const response = await axios.get(`${API}/users`, { headers: { Authorization: `Bearer ${token}` } }); setUsers(response.data); } catch (error) { console.error('Error fetching users:', error); }
  };

  const handleGenerateGuestLink = async () => {
    try { const token = localStorage.getItem('token'); const response = await axios.post(`${API}/guest-links`, { project_id: projectId, expires_in: 7 * 24 * 60 * 60 }, { headers: { Authorization: `Bearer ${token}` } }); setGuestLink(response.data); toast.success('Guest link generated successfully'); } catch (error) { console.error('Error generating guest link:', error); toast.error('Failed to generate guest link'); }
  };

  const copyGuestLink = () => { const fullLink = `${window.location.origin}/guest/${guestLink.token}`; navigator.clipboard.writeText(fullLink); toast.success('Guest link copied to clipboard'); };

  const handleCreateTask = async () => {
    try { const token = localStorage.getItem('token'); const taskData = { ...newTask, project_id: projectId }; await axios.post(`${API}/tasks`, taskData, { headers: { Authorization: `Bearer ${token}` } }); toast.success('Task created successfully'); setTaskDialogOpen(false); setNewTask({ title: '', description: '', assignee: '', due_date: '', priority: 'Medium', status: 'Not Started' }); fetchProjectData(); } catch (error) { console.error('Error creating task:', error); toast.error('Failed to create task'); }
  };

  const handleUpdateTask = async (taskId, updates) => {
    try { const token = localStorage.getItem('token'); await axios.put(`${API}/tasks/${taskId}`, updates, { headers: { Authorization: `Bearer ${token}` } }); toast.success('Task updated successfully'); fetchProjectData(); } catch (error) { console.error('Error updating task:', error); toast.error('Failed to update task'); }
  };

  const handleDeleteTask = async (taskId) => {
    if (window.confirm('Are you sure you want to delete this task?')) {
      try { const token = localStorage.getItem('token'); await axios.delete(`${API}/tasks/${taskId}`, { headers: { Authorization: `Bearer ${token}` } }); toast.success('Task deleted successfully'); fetchProjectData(); } catch (error) { console.error('Error deleting task:', error); toast.error('Failed to delete task'); }
    }
  };

  const getPriorityColor = (p) => ({ 'Low': 'text-green-600 bg-green-50', 'Medium': 'text-yellow-600 bg-yellow-50', 'High': 'text-red-600 bg-red-50' }[p] || 'text-gray-600 bg-gray-50');
  const getStatusIcon = (s) => s === 'Completed' ? <CheckCircle className="w-4 h-4 text-green-600" /> : <Circle className="w-4 h-4 text-gray-400" />;
  const getUserName = (id) => { const u = users.find(u => u.id === id); return u ? u.name : 'Unassigned'; };
  const getStatusColor = (s) => ({ 'Not Started': 'bg-gray-100 text-gray-800', 'In Progress': 'bg-blue-100 text-blue-800', 'Completed': 'bg-green-100 text-green-800', 'On Hold': 'bg-yellow-100 text-yellow-800', 'Cancelled': 'bg-red-100 text-red-800' }[s] || 'bg-gray-100 text-gray-800');

  const isSectionVisible = (key) => {
    if (currentUser?.role === 'admin' || currentUser?.role === 'manager') return true;
    if (!project || !project.section_visibility) {
      const defaults = { tasks: { team: true, client: true }, links_documents: { team: true, client: true }, meeting_notes: { team: true, client: false }, internal_notes: { team: true, client: false }, deliverables: { team: true, client: true }, team_members: { team: true, client: false }, timesheet: { team: true, client: false } };
      const dv = defaults[key] || { team: true, client: false };
      const isClient = currentUser?.role === 'client';
      return isClient ? dv.client : dv.team;
    }
    const v = project.section_visibility[key]; if (!v) return false; const isClient = currentUser?.role === 'client'; return isClient ? v.client : v.team;
  };

  if (loading) return (<div className="flex items-center justify-center h-screen bg-gray-50 dark:bg-gray-950"><div className="text-lg text-gray-600 dark:text-gray-400">Loading project...</div></div>);
  if (!project) return (<div className="flex items-center justify-center h-screen bg-gray-50 dark:bg-gray-950"><div className="text-center"><h2 className="text-xl font-semibold mb-2 text-gray-800 dark:text-white">Project not found</h2><Button onClick={() => navigate('/projects')}>Back to Projects</Button></div></div>);

  const docsLinks = documents.filter(d => d.type === 'docs_links');
  const meetingSummaries = documents.filter(d => d.type === 'meeting_summaries');
  const deliverables = documents.filter(d => d.type === 'deliverables');

  const allTabs = [
    { id: 'information', label: 'Information', icon: FolderOpen, visibilityKey: null },
    { id: 'useful-links', label: 'Useful Links', icon: LinkIcon, visibilityKey: 'links_documents' },
    { id: 'meeting-notes', label: 'Meeting Notes', icon: Video, visibilityKey: 'meeting_notes' },
    { id: 'deliverables', label: 'Deliverables', icon: Package, visibilityKey: 'deliverables' },
    { id: 'timesheet', label: 'Timesheet', icon: Activity, visibilityKey: 'timesheet' }
  ];
  const tabs = allTabs.filter(tab => !tab.visibilityKey || isSectionVisible(tab.visibilityKey));

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <header className="bg-white/50 dark:bg-gray-800/50 backdrop-blur-lg border-b border-gray-200 dark:border-gray-700 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Button variant="ghost" size="sm" onClick={() => navigate('/projects')} data-testid="back-button" className="hover:bg-white/20 dark:hover:bg-gray-700/20"><ArrowLeft className="w-4 h-4" /></Button>
            <div className="flex items-center space-x-2"><div className="text-lg">🔥</div><span className="text-lg font-bold" style={{ background: 'linear-gradient(135deg, #C23616 0%, #E84118 50%, #FFA502 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Millii</span></div>
            <div className="h-6 w-px bg-gray-300 dark:bg-gray-600 mx-2"></div>
            <div><h1 className="text-lg font-semibold text-gray-800 dark:text-white">{project.name}</h1><p className="text-sm text-gray-500 dark:text-gray-400">{project.business_name || project.client_name}</p></div>
          </div>
          <div className="flex items-center space-x-4">
            <span className="text-sm text-gray-600 dark:text-gray-400">{currentUser?.name}</span>
            {(currentUser?.role === 'admin' || currentUser?.role === 'manager') && (
              <Button variant="outline" size="sm" onClick={() => setVisibilityModalOpen(true)} className="hover:bg-white/20 dark:hover:bg-gray-700/20" title="Configure section visibility">
                <Settings className="w-4 h-4 mr-2" />Edit Visibility
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={onLogout} data-testid="logout-button" className="hover:bg-white/20 dark:hover:bg-gray-700/20"><LogOut className="w-4 h-4" /></Button>
          </div>
        </div>
      </header>

      <div className="bg-white/30 dark:bg-gray-800/30 backdrop-blur-lg border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-6">
          <nav className="flex space-x-8">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`flex items-center space-x-2 py-4 px-1 border-b-2 font-medium text-sm transition-colors ${activeTab === tab.id ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'}`}>
                  <Icon className="w-4 h-4" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </nav>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {activeTab === 'information' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2">
                <Card className="bg-white/50 dark:bg-gray-800/50 backdrop-blur-lg border-gray-200 dark:border-gray-700">
                  <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle className="text-lg font-medium text-gray-800 dark:text-white">Project Overview</CardTitle>
                    {!guestLink ? (
                      <Button onClick={handleGenerateGuestLink} data-testid="generate-guest-link-button" className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-medium hover:shadow-lg transition-all duration-300" size="sm"><LinkIcon className="w-4 h-4 mr-2" />Generate Guest Link</Button>
                    ) : (
                      <Button onClick={copyGuestLink} data-testid="copy-guest-link-button" variant="outline" size="sm" className="hover:bg-white/20 dark:hover:bg-gray-700/20"><Copy className="w-4 h-4 mr-2" />Copy Guest Link</Button>
                    )}
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div><Label className="text-sm font-medium text-gray-600 dark:text-gray-400">Client Name</Label><p className="text-gray-800 dark:text-white font-medium">{project.client_name}</p></div>
                      <div><Label className="text-sm font-medium text-gray-600 dark:text-gray-400">Business Name</Label><p className="text-gray-800 dark:text-white font-medium">{project.business_name || 'N/A'}</p></div>
                      <div><Label className="text-sm font-medium text-gray-600 dark:text-gray-400">Project Owner</Label><p className="text-gray-800 dark:text-white font-medium">{getUserName(project.project_owner)}</p></div>
                      <div><Label className="text-sm font-medium text-gray-600 dark:text-gray-400">Status</Label><span className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(project.status)}`}>{project.status}</span></div>
                      <div><Label className="text-sm font-medium text-gray-600 dark:text-gray-400">Start Date</Label><p className="text-gray-800 dark:text-white font-medium">{project.start_date ? new Date(project.start_date).toLocaleDateString() : 'N/A'}</p></div>
                      <div><Label className="text-sm font-medium text-gray-600 dark:text-gray-400">End Date</Label><p className="text-gray-800 dark:text-white font-medium">{project.end_date ? new Date(project.end_date).toLocaleDateString() : 'N/A'}</p></div>
                    </div>
                    {project.description && (<div><Label className="text-sm font-medium text-gray-600 dark:text-gray-400">Description</Label><p className="text-gray-800 dark:text-white mt-1">{project.description}</p></div>)}
                    {project.team_members && project.team_members.length > 0 && (
                      <div>
                        <Label className="text-sm font-medium text-gray-600 dark:text-gray-400">Team Members</Label>
                        <div className="flex flex-wrap gap-2 mt-2">
                          {project.team_members.map(memberId => { const member = users.find(u => u.id === memberId); return member ? (<span key={memberId} className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200">{member.name}</span>) : null; })}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
              <div>
                <Card className="bg-white/50 dark:bg-gray-800/50 backdrop-blur-lg border-gray-200 dark:border-gray-700">
                  <CardHeader className="pb-3"><CardTitle className="text-lg font-medium text-gray-800 dark:text-white flex items-center space-x-2"><AlertCircle className="w-4 h-4 text-amber-500" /><span>Internal Notes</span></CardTitle><p className="text-xs text-amber-600 dark:text-amber-400 font-medium">⚠️ These notes are internal only - clients cannot see them</p></CardHeader>
                  <CardContent className="space-y-3"><Textarea value={project.internal_notes || ''} onChange={(e) => setProject({ ...project, internal_notes: e.target.value })} placeholder="Add internal notes about this project..." className="min-h-[120px] bg-white/50 dark:bg-gray-900/50" disabled={currentUser?.role !== 'admin' && currentUser?.role !== 'manager'} /><Button onClick={async () => { try { await axios.put(`${API}/projects/${projectId}`, { internal_notes: project.internal_notes }); toast.success('Internal notes updated successfully'); } catch { toast.error('Failed to update internal notes'); } }} size="sm" className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white hover:shadow-lg transition-all duration-300">Save Notes</Button></CardContent>
                </Card>
              </div>
            </div>

            <Card className="bg-white/50 dark:bg-gray-800/50 backdrop-blur-lg border-gray-200 dark:border-gray-700">
              <CardHeader className="flex flex-row items-center justify-between"><CardTitle className="text-lg font-medium text-gray-800 dark:text-white">Tasks</CardTitle>
                <Dialog open={taskDialogOpen} onOpenChange={setTaskDialogOpen}>
                  <Button size="sm" className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white hover:shadow-lg transition-all duration-300" onClick={() => setTaskDialogOpen(true)}><PlusCircle className="w-4 h-4 mr-2" />Add Task</Button>
                  <DialogContent className="max-w-md bg-white/95 dark:bg-gray-800/95 backdrop-blur-lg"><DialogHeader><DialogTitle>Create New Task</DialogTitle></DialogHeader>
                    <div className="space-y-4">
                      <div><Label htmlFor="task-title">Title</Label><Input id="task-title" value={newTask.title} onChange={(e) => setNewTask({ ...newTask, title: e.target.value })} placeholder="Enter task title" /></div>
                      <div><Label htmlFor="task-description">Description</Label><Textarea id="task-description" value={newTask.description} onChange={(e) => setNewTask({ ...newTask, description: e.target.value })} placeholder="Enter task description" /></div>
                      <div><Label htmlFor="task-assignee">Assignee</Label><select id="task-assignee" value={newTask.assignee} onChange={(e) => setNewTask({ ...newTask, assignee: e.target.value })} className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700"><option value="">Select assignee</option>{users.map(user => (<option key={user.id} value={user.id}>{user.name}</option>))}</select></div>
                      <div><Label htmlFor="task-due-date">Due Date</Label><Input id="task-due-date" type="date" value={newTask.due_date} onChange={(e) => setNewTask({ ...newTask, due_date: e.target.value })} /></div>
                      <div><Label htmlFor="task-priority">Priority</Label><select id="task-priority" value={newTask.priority} onChange={(e) => setNewTask({ ...newTask, priority: e.target.value })} className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700"><option value="Low">Low</option><option value="Medium">Medium</option><option value="High">High</option></select></div>
                      <div className="flex justify-end space-x-2 pt-4"><Button variant="outline" onClick={() => setTaskDialogOpen(false)}>Cancel</Button><Button onClick={handleCreateTask} className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white">Create Task</Button></div>
                    </div>
                  </DialogContent>
                </Dialog>
              </CardHeader>
              <CardContent>
                {tasks.length === 0 ? (
                  <div className="text-center py-8 text-gray-500 dark:text-gray-400">No tasks found. Create your first task to get started.</div>
                ) : (
                  <div className="space-y-3">
                    {tasks.map((task) => (
                      <div key={task.id} className="flex items-center justify-between p-4 bg-white/50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600 hover:shadow-md transition-shadow">
                        <div className="flex items-center space-x-4">
                          <button onClick={() => handleUpdateTask(task.id, { status: task.status === 'Completed' ? 'In Progress' : 'Completed' })} className="hover:bg-gray-100 dark:hover:bg-gray-600 p-1 rounded">{getStatusIcon(task.status)}</button>
                          <div className="flex-1">
                            <h4 className="font-medium text-gray-800 dark:text-white">{task.title}</h4>
                            {task.description && (<p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{task.description}</p>)}
                            <div className="flex items-center space-x-4 mt-2 text-xs text-gray-500 dark:text-gray-400">
                              <span className="flex items-center space-x-1"><Users className="w-3 h-3" /><span>{getUserName(task.assignee)}</span></span>
                              {task.due_date && (<span className="flex items-center space-x-1"><Calendar className="w-3 h-3" /><span>{new Date(task.due_date).toLocaleDateString()}</span></span>)}
                              <span className={`px-2 py-0.5 rounded-full ${getPriorityColor(task.priority)}`}>{task.priority}</span>
                              <span className={`px-2 py-0.5 rounded-full text-xs ${getStatusColor(task.status)}`}>{task.status}</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Button variant="ghost" size="sm" onClick={() => setEditingTask(task)} className="hover:bg-gray-100 dark:hover:bg-gray-600"><Edit className="w-4 h-4" /></Button>
                          <Button variant="ghost" size="sm" onClick={() => handleDeleteTask(task.id)} className="hover:bg-red-50 dark:hover:bg-red-900/20 text-red-600"><Trash2 className="w-4 h-4" /></Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {activeTab === 'useful-links' && (
          <Card className="bg-white/50 dark:bg-gray-800/50 backdrop-blur-lg border-gray-200 dark:border-gray-700">
            <CardHeader className="flex flex-row items-center justify-between"><CardTitle className="text-lg font-medium text-gray-800 dark:text-white">Useful Links</CardTitle>
              <Dialog open={docDialogOpen && selectedDocType === 'docs_links'} onOpenChange={(open) => { setDocDialogOpen(open); if (open) setSelectedDocType('docs_links'); }}>
                <Button size="sm" className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white hover:shadow-lg transition-all duration-300"><PlusCircle className="w-4 h-4 mr-2" />Add Link</Button>
                <DialogContent className="max-w-md bg-white/95 dark:bg-gray-800/95 backdrop-blur-lg"><DialogHeader><DialogTitle>Add Useful Link</DialogTitle></DialogHeader>
                  <div className="space-y-4">
                    <div><Label htmlFor="doc-title">Title</Label><Input id="doc-title" value={newDoc.title} onChange={(e) => setNewDoc({ ...newDoc, title: e.target.value })} placeholder="Enter link title" /></div>
                    <div><Label htmlFor="doc-url">URL</Label><Input id="doc-url" value={newDoc.url} onChange={(e) => setNewDoc({ ...newDoc, url: e.target.value })} placeholder="Enter URL" /></div>
                    <div className="flex justify-end space-x-2 pt-4"><Button variant="outline" onClick={() => setDocDialogOpen(false)}>Cancel</Button><Button onClick={async () => { try { await axios.post(`${API}/documents`, { ...newDoc, project_id: projectId, type: selectedDocType }); toast.success('Document created successfully'); setDocDialogOpen(false); setNewDoc({ title: '', url: '' }); fetchProjectData(); } catch { toast.error('Failed to create document'); } }} className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white">Add Link</Button></div>
                  </div>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              {docsLinks.length === 0 ? (<div className="text-center py-8 text-gray-500 dark:text-gray-400">No useful links added yet.</div>) : (
                <div className="space-y-3">
                  {docsLinks.map((doc) => (
                    <div key={doc.id} className="flex items-center justify-between p-4 bg-white/50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600">
                      <div><h4 className="font-medium text-gray-800 dark:text-white">{doc.title}</h4><a href={doc.url} target="_blank" rel="noopener noreferrer" className="text-sm text-indigo-600 dark:text-indigo-400 hover:underline">{doc.url}</a></div>
                      <Button variant="ghost" size="sm" onClick={() => handleDeleteDocument(doc.id)} className="hover:bg-red-50 dark:hover:bg-red-900/20 text-red-600"><Trash2 className="w-4 h-4" /></Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {activeTab === 'meeting-notes' && (
          <Card className="bg-white/50 dark:bg-gray-800/50 backdrop-blur-lg border-gray-200 dark:border-gray-700">
            <CardHeader className="flex flex-row items-center justify-between"><CardTitle className="text-lg font-medium text-gray-800 dark:text-white">Meeting Notes</CardTitle>
              <Dialog open={docDialogOpen && selectedDocType === 'meeting_summaries'} onOpenChange={(open) => { setDocDialogOpen(open); if (open) setSelectedDocType('meeting_summaries'); }}>
                <Button size="sm" className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white hover:shadow-lg transition-all duration-300"><PlusCircle className="w-4 h-4 mr-2" />Add Notes</Button>
                <DialogContent className="max-w-md bg-white/95 dark:bg-gray-800/95 backdrop-blur-lg"><DialogHeader><DialogTitle>Add Meeting Notes</DialogTitle></DialogHeader>
                  <div className="space-y-4">
                    <div><Label htmlFor="meeting-title">Title</Label><Input id="meeting-title" value={newDoc.title} onChange={(e) => setNewDoc({ ...newDoc, title: e.target.value })} placeholder="Enter meeting title" /></div>
                    <div><Label htmlFor="meeting-url">Notes URL or Content</Label><Input id="meeting-url" value={newDoc.url} onChange={(e) => setNewDoc({ ...newDoc, url: e.target.value })} placeholder="Enter URL or notes content" /></div>
                    <div className="flex justify-end space-x-2 pt-4"><Button variant="outline" onClick={() => setDocDialogOpen(false)}>Cancel</Button><Button onClick={async () => { try { await axios.post(`${API}/documents`, { ...newDoc, project_id: projectId, type: selectedDocType }); toast.success('Document created successfully'); setDocDialogOpen(false); setNewDoc({ title: '', url: '' }); fetchProjectData(); } catch { toast.error('Failed to create document'); } }} className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white">Add Notes</Button></div>
                  </div>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              {meetingSummaries.length === 0 ? (<div className="text-center py-8 text-gray-500 dark:text-gray-400">No meeting notes added yet.</div>) : (
                <div className="space-y-3">
                  {meetingSummaries.map((doc) => (
                    <div key={doc.id} className="flex items-center justify-between p-4 bg-white/50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600">
                      <div><h4 className="font-medium text-gray-800 dark:text-white">{doc.title}</h4><p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{doc.url}</p></div>
                      <Button variant="ghost" size="sm" onClick={() => handleDeleteDocument(doc.id)} className="hover:bg-red-50 dark:hover:bg-red-900/20 text-red-600"><Trash2 className="w-4 h-4" /></Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {activeTab === 'deliverables' && (
          <Card className="bg-white/50 dark:bg-gray-800/50 backdrop-blur-lg border-gray-200 dark:border-gray-700">
            <CardHeader className="flex flex-row items-center justify-between"><CardTitle className="text-lg font-medium text-gray-800 dark:text-white">Deliverables</CardTitle>
              <Dialog open={docDialogOpen && selectedDocType === 'deliverables'} onOpenChange={(open) => { setDocDialogOpen(open); if (open) setSelectedDocType('deliverables'); }}>
                <Button size="sm" className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white hover:shadow-lg transition-all duration-300"><PlusCircle className="w-4 h-4 mr-2" />Add Deliverable</Button>
                <DialogContent className="max-w-md bg-white/95 dark:bg-gray-800/95 backdrop-blur-lg"><DialogHeader><DialogTitle>Add Deliverable</DialogTitle></DialogHeader>
                  <div className="space-y-4">
                    <div><Label htmlFor="deliverable-title">Title</Label><Input id="deliverable-title" value={newDoc.title} onChange={(e) => setNewDoc({ ...newDoc, title: e.target.value })} placeholder="Enter deliverable title" /></div>
                    <div><Label htmlFor="deliverable-url">URL or Description</Label><Input id="deliverable-url" value={newDoc.url} onChange={(e) => setNewDoc({ ...newDoc, url: e.target.value })} placeholder="Enter URL or description" /></div>
                    <div className="flex justify-end space-x-2 pt-4"><Button variant="outline" onClick={() => setDocDialogOpen(false)}>Cancel</Button><Button onClick={async () => { try { await axios.post(`${API}/documents`, { ...newDoc, project_id: projectId, type: selectedDocType }); toast.success('Document created successfully'); setDocDialogOpen(false); setNewDoc({ title: '', url: '' }); fetchProjectData(); } catch { toast.error('Failed to create deliverable'); } }} className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white">Add Deliverable</Button></div>
                  </div>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              {deliverables.length === 0 ? (<div className="text-center py-8 text-gray-500 dark:text-gray-400">No deliverables added yet.</div>) : (
                <div className="space-y-3">
                  {deliverables.map((doc) => (
                    <div key={doc.id} className="flex items-center justify-between p-4 bg-white/50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600">
                      <div><h4 className="font-medium text-gray-800 dark:text-white">{doc.title}</h4><p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{doc.url}</p></div>
                      <Button variant="ghost" size="sm" onClick={() => handleDeleteDocument(doc.id)} className="hover:bg-red-50 dark:hover:bg-red-900/20 text-red-600"><Trash2 className="w-4 h-4" /></Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {activeTab === 'timesheet' && (
          <Card className="bg-white/50 dark:bg-gray-800/50 backdrop-blur-lg border-gray-200 dark:border-gray-700">
            <CardHeader><CardTitle className="text-lg font-medium text-gray-800 dark:text-white">Timesheet</CardTitle></CardHeader>
            <CardContent>
              {timeEntries.length === 0 ? (
                <div className="text-center py-10 text-gray-500 dark:text-gray-400">No time entries yet for this project.</div>
              ) : (
                <div className="space-y-6">
                  {timeEntries.map((entry) => (
                    <div key={entry.id} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                      <div className="flex items-start justify-between">
                        <div>
                          <h4 className="font-semibold text-gray-800 dark:text-white">{entry.task?.title || 'Unknown Task'}</h4>
                          <p className="text-xs text-gray-500 dark:text-gray-400">{entry.project?.name || 'Unknown Project'}</p>
                        </div>
                        <div className="text-right text-sm text-gray-600 dark:text-gray-300">
                          <div>{new Date(entry.clock_in_time).toLocaleTimeString()} {entry.clock_out_time ? `- ${new Date(entry.clock_out_time).toLocaleTimeString()}` : '(Active)'}</div>
                          {typeof entry.duration_seconds === 'number' && (<div className="font-medium">{Math.floor(entry.duration_seconds / 3600)}h {Math.floor((entry.duration_seconds % 3600) / 60)}m</div>)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
};

export default ProjectView;
