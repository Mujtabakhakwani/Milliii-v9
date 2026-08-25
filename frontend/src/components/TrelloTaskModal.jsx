import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { toast } from 'sonner';
import { 
  Save, 
  Calendar, 
  Flag, 
  User, 
  CheckSquare, 
  Tag,
  FileText,
  MessageCircle,
  Paperclip,
  Clock,
  Activity,
  Copy,
  Archive,
  Move,
  Share,
  Upload,
  X,
  Plus,
  Trash2,
  Eye,
  Users,
  Palette,
  Image,
  Settings,
  ArrowRight,
  Download,
  MoreHorizontal,
  Edit,
  ChevronUp,
  ChevronDown,
  Check
} from 'lucide-react';
import axios from 'axios';
import { API_URL } from '../config';
import RichTextEditor from './RichTextEditor';

const TrelloTaskModal = ({ 
  task, 
  open, 
  onClose, 
  onUpdate, 
  onApprove,
  onReject,
  projects = [], 
  users = [],
  currentUser
}) => {
  const [editedTask, setEditedTask] = useState({});
  const [isSaving, setIsSaving] = useState(false);
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [attachments, setAttachments] = useState([]);
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(false);
  const [projectMembers, setProjectMembers] = useState([]);
  
  // UI States
  const [editingTitle, setEditingTitle] = useState(false);
  const [editingDescription, setEditingDescription] = useState(false);
  const [showActivityDetails, setShowActivityDetails] = useState(true);
  const [editingAssignee, setEditingAssignee] = useState(false);
  const [editingPriority, setEditingPriority] = useState(false);
  const [editingStatus, setEditingStatus] = useState(false);
  const [showCommentBox, setShowCommentBox] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [rejectionComment, setRejectionComment] = useState('');

  // Check if current user can approve/reject this task
  const canApproveReject = () => {
    if (!currentUser || task?.status !== 'Under Review') return false;
    
    const userRole = currentUser.role?.toLowerCase();
    
    // Admins can approve/reject any task
    if (userRole === 'admin') return true;
    
    // Managers can approve/reject tasks in projects they own
    if (userRole === 'manager') {
      // For standalone tasks, managers cannot approve
      if (!task?.project_id) return false;
      // Check if manager owns the project (this would need project data, for now assume true)
      return true;
    }
    
    // Clients can approve/reject tasks in projects they are members of
    if (userRole === 'client' || userRole === 'user') {
      // Only project tasks, not standalone tasks
      if (!task?.project_id) return false;
      // Check if client is member of project (this would need project data, for now assume true)
      return true;
    }
    
    return false;
  };

  useEffect(() => {
    if (task && open) {
      setEditedTask({
        title: task.title || '',
        description: task.description || '',
        status: task.status || 'Not Started',
        priority: task.priority || 'Medium',
        due_date: task.due_date || '',
        assignee: task.assignee || '',
        project_id: task.project_id || '',
        labels: task.labels || [],
        members: task.members || [],
        checklist_items: task.checklist_items || []
      });
      
      // Reset states when opening
      setShowCommentBox(false);
      setShowDeleteConfirm(false);
      setNewComment('');
      
      // Load task data
      fetchComments();
      fetchAttachments();
      fetchActivities();
      
      // Fetch project members if task belongs to a project
      if (task.project_id) {
        fetchProjectMembers();
      }
    }
  }, [task, open]);

  const fetchProjectMembers = async () => {
    if (!task?.project_id || !users) return;
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API_URL}/projects/${task.project_id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      // Extract team member IDs from project
      const memberIds = response.data.team_members || [];
      
      // Filter users to only include project members
      const filteredMembers = users.filter(user => memberIds.includes(user.id));
      setProjectMembers(filteredMembers);
    } catch (error) {
      console.error('Error fetching project members:', error);
      // Fallback to all users if project fetch fails
      setProjectMembers(users || []);
    }
  };

  const fetchComments = async () => {
    if (!task?.id) return;
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API_URL}/tasks/${task.id}/comments`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setComments(response.data || []);
    } catch (error) {
      console.error('Error fetching comments:', error);
      setComments([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchAttachments = async () => {
    if (!task?.id) return;
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API_URL}/tasks/${task.id}/attachments`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setAttachments(response.data || []);
    } catch (error) {
      console.error('Error fetching attachments:', error);
      setAttachments([]);
    }
  };

  const fetchActivities = async () => {
    if (!task?.id) return;
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API_URL}/tasks/${task.id}/activities`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setActivities(response.data || []);
    } catch (error) {
      console.error('Error fetching activities:', error);
      setActivities([]);
    }
  };

  const handleSave = async (fieldUpdates = null) => {
    if (!task?.id) {
      toast.error('Task not found');
      return;
    }
    
    const updates = fieldUpdates || editedTask;
    
    if (!updates.title?.trim()) {
      toast.error('Task title is required');
      return;
    }

    setIsSaving(true);
    try {
      const token = localStorage.getItem('token');
      const response = await axios.put(
        `${API_URL}/tasks/${task.id}`,
        updates,
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      
      toast.success('Task updated successfully');
      
      // Update the task object to reflect changes but DON'T close modal
      if (onUpdate) {
        onUpdate(response.data);
      }
      
      // Reset editing states but DON'T close dialog
      setEditingTitle(false);
      setEditingDescription(false);
      setEditingAssignee(false);
      setEditingPriority(false);
      setEditingStatus(false);
    } catch (error) {
      console.error('Error updating task:', error);
      toast.error('Failed to update task');
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddComment = async () => {
    if (!task?.id) {
      toast.error('Task not found');
      return;
    }
    
    if (!newComment.trim()) return;
    
    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(
        `${API_URL}/tasks/${task.id}/comments`,
        { content: newComment },
        { headers: { Authorization: `Bearer ${token}` }}
      );
      
      setComments([...comments, response.data]);
      setNewComment('');
      setShowCommentBox(false); // Hide comment box after adding comment
      toast.success('Comment added successfully');
    } catch (error) {
      console.error('Error adding comment:', error);
      toast.error('Failed to add comment');
    }
  };

  const handleFileUpload = async (event) => {
    if (!task?.id) {
      toast.error('Task not found');
      return;
    }
    
    const file = event.target.files[0];
    if (!file) return;

    // Check file size (limit to 10MB)
    if (file.size > 10 * 1024 * 1024) {
      toast.error('File too large. Maximum size is 10MB.');
      return;
    }

    const formData = new FormData();
    formData.append('file', file);

    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(
        `${API_URL}/tasks/${task.id}/attachments`,
        formData,
        {
          headers: { 
            Authorization: `Bearer ${token}`,
            'Content-Type': 'multipart/form-data'
          }
        }
      );
      
      setAttachments([...attachments, response.data]);
      toast.success('File uploaded successfully');
    } catch (error) {
      console.error('Error uploading file:', error);
      toast.error('Failed to upload file. Please try again.');
    }
  };

  const handleDownloadAttachment = async (attachmentId, filename) => {
    if (!task?.id) {
      toast.error('Task not found');
      return;
    }
    
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(
        `${API_URL}/tasks/${task.id}/attachments/${attachmentId}/download`,
        {
          headers: { Authorization: `Bearer ${token}` },
          responseType: 'blob'
        }
      );
      
      // Create blob URL and trigger download
      const blob = new Blob([response.data]);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      
      toast.success('File downloaded successfully');
    } catch (error) {
      console.error('Error downloading file:', error);
      toast.error('Failed to download file');
    }
  };

  const addCommentFromSidebar = () => {
    setShowCommentBox(true);
    setTimeout(() => {
      const commentTextarea = document.querySelector('textarea[placeholder*="comment"]');
      if (commentTextarea) {
        commentTextarea.focus();
        commentTextarea.scrollIntoView({ behavior: 'smooth' });
      }
    }, 100);
  };

  const handleDeleteTask = async () => {
    if (!task?.id) {
      toast.error('Task not found');
      setShowDeleteConfirm(false);
      return;
    }
    
    try {
      const token = localStorage.getItem('token');
      await axios.delete(`${API_URL}/tasks/${task.id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      toast.success('Task deleted successfully');
      onClose(); // Close modal after deletion
      
      // Refresh the parent component
      if (onUpdate) {
        onUpdate(null); // Null indicates deletion
      }
    } catch (error) {
      console.error('Error deleting task:', error);
      toast.error('Failed to delete task');
      setShowDeleteConfirm(false);
    }
  };

  const handleApproveTask = async () => {
    if (!task?.id) {
      toast.error('Task not found');
      return;
    }
    
    try {
      const token = localStorage.getItem('token');
      await axios.post(
        `${API_URL}/tasks/${task.id}/approve`,
        {},
        { headers: { Authorization: `Bearer ${token}` }}
      );
      
      toast.success('Task approved successfully');
      
      // Update task status to Completed
      const updatedTask = { ...task, status: 'Completed' };
      if (onUpdate) {
        onUpdate(updatedTask);
      }
      if (onApprove) {
        onApprove(task.id);
      }
      
      // Refresh activities to show the approval
      fetchActivities();
    } catch (error) {
      console.error('Error approving task:', error);
      toast.error('Failed to approve task');
    }
  };

  const handleRejectTask = async () => {
    if (!task?.id) {
      toast.error('Task not found');
      return;
    }
    
    if (!rejectionComment.trim()) {
      toast.error('Please provide a reason for rejection');
      return;
    }
    
    try {
      const token = localStorage.getItem('token');
      await axios.post(
        `${API_URL}/tasks/${task.id}/reject`,
        { comment: rejectionComment },
        { headers: { Authorization: `Bearer ${token}` }}
      );
      
      toast.success('Task rejected successfully');
      
      // Update task status to In Progress and close dialog
      const updatedTask = { ...task, status: 'In Progress' };
      if (onUpdate) {
        onUpdate(updatedTask);
      }
      if (onReject) {
        onReject(task.id, rejectionComment);
      }
      
      // Refresh activities to show the rejection reason
      fetchActivities();
      
      // Reset rejection dialog
      setShowRejectDialog(false);
      setRejectionComment('');
    } catch (error) {
      console.error('Error rejecting task:', error);
      toast.error('Failed to reject task');
    }
  };

  const getPriorityColor = (priority) => {
    switch (priority?.toLowerCase()) {
      case 'high': return 'bg-red-100 text-red-800 border-red-200';
      case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'low': return 'bg-green-100 text-green-800 border-green-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case 'not started': return 'bg-gray-100 text-gray-800 border-gray-200';
      case 'in progress': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'under review': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'completed': return 'bg-green-100 text-green-800 border-green-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const formatActivityTime = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' at ' + date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
  };

  const getUserById = (userId) => {
    if (!users || !Array.isArray(users)) return null;
    return users.find(u => u.id === userId);
  };

  const assignedUser = getUserById(editedTask.assignee);

  if (!task || !open) return null;

  return (
    <>
      <style jsx global>{`
        .scrollbar-thin {
          scrollbar-width: thin;
          scrollbar-color: rgb(209 213 219) rgb(243 244 246);
        }
        .scrollbar-thin::-webkit-scrollbar {
          width: 6px;
        }
        .scrollbar-thin::-webkit-scrollbar-track {
          background: rgb(243 244 246);
          border-radius: 3px;
        }
        .scrollbar-thin::-webkit-scrollbar-thumb {
          background: rgb(209 213 219);
          border-radius: 3px;
        }
        .scrollbar-thin::-webkit-scrollbar-thumb:hover {
          background: rgb(156 163 175);
        }
      `}</style>
      <Dialog open={open} onOpenChange={(newOpen) => {
        // Only allow closing through explicit user action, not through save operations
        if (!newOpen && !isSaving) {
          onClose();
        }
      }}>
        <DialogContent className="max-w-4xl max-h-[90vh] p-0 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <div className="flex items-center gap-3">
            <FileText className="w-5 h-5 text-gray-600" />
            <div>
              {editingTitle ? (
                <div className="flex items-center gap-2">
                  <Input
                    value={editedTask.title}
                    onChange={(e) => setEditedTask({...editedTask, title: e.target.value})}
                    className="text-xl font-semibold"
                    autoFocus
                  />
                  <Button 
                    size="sm"
                    onClick={() => handleSave()}
                    disabled={isSaving}
                  >
                    <Save className="w-4 h-4" />
                  </Button>
                </div>
              ) : (
                <h1 
                  className="text-xl font-semibold cursor-pointer hover:bg-gray-100 px-2 py-1 rounded transition-colors"
                  onClick={() => setEditingTitle(true)}
                >
                  {editedTask.title}
                  <Edit className="w-4 h-4 inline ml-2 opacity-50" />
                </h1>
              )}
              <div className="text-sm text-gray-500 mt-1">
                in list <span className="underline">{task.project_name || 'My Tasks'}</span>
              </div>
            </div>
          </div>
          {/* Close button removed as requested */}
        </div>

        <div className="flex h-full max-h-[calc(90vh-120px)]">
          {/* Main Content Area */}
          <div className="flex-1 p-6 pr-4 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100"
               style={{maxHeight: 'calc(90vh - 180px)'}}>
            {/* Task Properties - Horizontal Layout */}
            <div className="flex flex-wrap gap-4 mb-6 p-4 bg-gray-50 rounded-lg">
              {/* Assignee */}
              <div className="flex items-center gap-2">
                <User className="w-4 h-4 text-gray-600" />
                <span className="text-sm font-medium">Assignee:</span>
                {editingAssignee ? (
                  <div className="flex items-center gap-2">
                    <select
                      value={editedTask.assignee}
                      onChange={(e) => setEditedTask({...editedTask, assignee: e.target.value})}
                      className="px-2 py-1 border rounded text-sm"
                    >
                      <option value="">Unassigned</option>
                      {(task.project_id ? projectMembers : users).map((user) => (
                        <option key={user.id} value={user.id}>{user.name}</option>
                      ))}
                    </select>
                    <Button 
                      size="sm" 
                      onClick={() => {
                        handleSave();
                        setEditingAssignee(false);
                      }}
                    >
                      <Check className="w-3 h-3" />
                    </Button>
                  </div>
                ) : (
                  <div 
                    className="flex items-center gap-2 cursor-pointer hover:bg-gray-200 px-2 py-1 rounded transition-colors"
                    onClick={() => setEditingAssignee(true)}
                  >
                    {assignedUser ? (
                      <>
                        <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center text-white text-xs font-semibold">
                          {assignedUser.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                        </div>
                        <span className="text-sm">{assignedUser.name}</span>
                      </>
                    ) : (
                      <span className="text-sm text-gray-500">Click to assign</span>
                    )}
                  </div>
                )}
              </div>

              {/* Priority */}
              <div className="flex items-center gap-2">
                <Flag className="w-4 h-4 text-gray-600" />
                <span className="text-sm font-medium">Priority:</span>
                {editingPriority ? (
                  <div className="flex items-center gap-2">
                    <select
                      value={editedTask.priority}
                      onChange={(e) => setEditedTask({...editedTask, priority: e.target.value})}
                      className="px-2 py-1 border rounded text-sm"
                    >
                      <option value="Low">Low</option>
                      <option value="Medium">Medium</option>
                      <option value="High">High</option>
                    </select>
                    <Button 
                      size="sm" 
                      onClick={() => {
                        handleSave();
                        setEditingPriority(false);
                      }}
                    >
                      <Check className="w-3 h-3" />
                    </Button>
                  </div>
                ) : (
                  <span 
                    className={`px-3 py-1 rounded-full text-xs font-medium border cursor-pointer hover:opacity-80 transition-opacity ${getPriorityColor(editedTask.priority)}`}
                    onClick={() => setEditingPriority(true)}
                  >
                    {editedTask.priority}
                  </span>
                )}
              </div>

              {/* Status */}
              <div className="flex items-center gap-2">
                <CheckSquare className="w-4 h-4 text-gray-600" />
                <span className="text-sm font-medium">Status:</span>
                {editingStatus ? (
                  <div className="flex items-center gap-2">
                    <select
                      value={editedTask.status}
                      onChange={(e) => setEditedTask({...editedTask, status: e.target.value})}
                      className="px-2 py-1 border rounded text-sm"
                    >
                      <option value="Not Started">Not Started</option>
                      <option value="In Progress">In Progress</option>
                      <option value="Under Review">Under Review</option>
                      <option value="Completed">Completed</option>
                    </select>
                    <Button 
                      size="sm" 
                      onClick={() => {
                        handleSave();
                        setEditingStatus(false);
                      }}
                    >
                      <Check className="w-3 h-3" />
                    </Button>
                  </div>
                ) : (
                  <span 
                    className={`px-3 py-1 rounded-full text-xs font-medium border cursor-pointer hover:opacity-80 transition-opacity ${getStatusColor(editedTask.status)}`}
                    onClick={() => setEditingStatus(true)}
                  >
                    {editedTask.status}
                  </span>
                )}
              </div>
            </div>

            {/* Description Section */}
            <div className="mb-6">
              <div className="flex items-center gap-2 mb-3">
                <FileText className="w-5 h-5 text-gray-600" />
                <h3 className="font-semibold text-lg">Description</h3>
                {!editingDescription && (
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => setEditingDescription(true)}
                    className="ml-auto text-xs hover:bg-gray-100"
                  >
                    <Edit className="w-3 h-3 mr-1" />
                    Edit
                  </Button>
                )}
              </div>
              
              {editingDescription ? (
                <div className="space-y-3">
                  <RichTextEditor
                    value={editedTask.description}
                    onChange={(value) => setEditedTask({...editedTask, description: value})}
                    placeholder="Add a more detailed description..."
                  />
                  <div className="flex gap-2">
                    <Button 
                      onClick={() => {
                        handleSave();
                        setEditingDescription(false);
                      }} 
                      size="sm"
                      disabled={isSaving}
                    >
                      <Save className="w-4 h-4 mr-1" />
                      Save
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => setEditingDescription(false)}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <div 
                  className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg min-h-[80px] cursor-pointer hover:bg-gray-100 transition-colors"
                  onClick={() => setEditingDescription(true)}
                >
                  {editedTask.description ? (
                    <div dangerouslySetInnerHTML={{ __html: editedTask.description }} />
                  ) : (
                    <span className="text-gray-500 italic">Click to add a description...</span>
                  )}
                </div>
              )}
            </div>

            {/* Attachments Section */}
            {attachments.length > 0 && (
              <div className="mb-6">
                <div className="flex items-center gap-2 mb-3">
                  <Paperclip className="w-5 h-5 text-gray-600" />
                  <h3 className="font-semibold text-lg">Attachments ({attachments.length})</h3>
                </div>
                <div className="grid grid-cols-1 gap-3 max-h-64 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100 pr-2">
                  {attachments.map((attachment) => (
                    <div key={attachment.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                      <div className="flex items-center gap-3">
                        <Paperclip className="w-4 h-4 text-gray-500" />
                        <div>
                          <p className="font-medium text-sm">{attachment.original_filename}</p>
                          <p className="text-xs text-gray-500">
                            {(attachment.file_size / 1024).toFixed(1)} KB • 
                            Added by {attachment.uploaded_by_name}
                          </p>
                        </div>
                      </div>
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => handleDownloadAttachment(attachment.id, attachment.original_filename)}
                        className="hover:bg-blue-100"
                      >
                        <Download className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Activity Section */}
            <div className="mb-6">
              <div className="flex items-center gap-2 mb-3">
                <Activity className="w-5 h-5 text-gray-600" />
                <h3 className="font-semibold text-lg">Activity</h3>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => setShowActivityDetails(!showActivityDetails)}
                  className="ml-auto text-xs hover:bg-gray-100"
                >
                  {showActivityDetails ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  {showActivityDetails ? 'Hide details' : 'Show details'}
                </Button>
              </div>

              {/* Add Comment - Only show when showCommentBox is true */}
              {showCommentBox && (
                <div className="flex gap-3 mb-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
                  <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center text-white font-semibold text-sm">
                    {currentUser?.name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || 'U'}
                  </div>
                  <div className="flex-1">
                    <Textarea
                      value={newComment}
                      onChange={(e) => setNewComment(e.target.value)}
                      placeholder="Write a comment..."
                      className="mb-2 min-h-[80px] bg-white"
                      rows={3}
                      autoFocus
                    />
                    <div className="flex gap-2">
                      <Button 
                        onClick={handleAddComment} 
                        size="sm" 
                        className="bg-blue-600 hover:bg-blue-700"
                        disabled={!newComment.trim()}
                      >
                        <MessageCircle className="w-4 h-4 mr-1" />
                        Save Comment
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => {
                          setShowCommentBox(false);
                          setNewComment('');
                        }}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {/* Comments List - Collapsible with scroll */}
              {showActivityDetails && (
                <div className="space-y-4 max-h-96 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100">
                  {comments.map((comment) => (
                    <div key={comment.id} className="flex gap-3">
                      <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white font-semibold text-sm">
                        {comment.user_name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || 'U'}
                      </div>
                      <div className="flex-1">
                        <div className="bg-white border rounded-lg p-3 shadow-sm">
                          <div className="flex items-center justify-between mb-2">
                            <span className="font-medium text-sm">{comment.user_name}</span>
                            <span className="text-xs text-gray-500">
                              {formatActivityTime(comment.created_at)}
                            </span>
                          </div>
                          <p className="text-sm text-gray-700">{comment.content}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                  
                  {/* Activity Timeline */}
                  {activities.map((activity) => {
                    // Get appropriate icon and color for different activity types
                    const getActivityIcon = (actionType) => {
                      switch (actionType) {
                        case 'approved': return { icon: Check, color: 'bg-green-500' };
                        case 'rejected': return { icon: X, color: 'bg-red-500' };
                        case 'created': return { icon: Plus, color: 'bg-blue-500' };
                        case 'status_changed': return { icon: ArrowRight, color: 'bg-purple-500' };
                        case 'commented': return { icon: MessageCircle, color: 'bg-gray-500' };
                        case 'attachment_added': return { icon: Paperclip, color: 'bg-indigo-500' };
                        default: return { icon: Activity, color: 'bg-gray-400' };
                      }
                    };

                    const { icon: IconComponent, color } = getActivityIcon(activity.action_type);

                    return (
                      <div key={activity.id} className="flex gap-3">
                        <div className={`w-8 h-8 ${color} rounded-full flex items-center justify-center text-white font-semibold text-xs`}>
                          <IconComponent className="w-4 h-4" />
                        </div>
                        <div className="flex-1">
                          <div className="text-sm text-gray-600">
                            <span className="font-medium">{activity.user_name}</span>
                            <span className="mx-1">
                              {activity.action_type === 'created' && 'created this task'}
                              {activity.action_type === 'status_changed' && `changed status from ${activity.action_details.from} to ${activity.action_details.to}`}
                              {activity.action_type === 'commented' && 'added a comment'}
                              {activity.action_type === 'attachment_added' && `uploaded ${activity.action_details.filename}`}
                              {activity.action_type === 'approved' && 'approved this task'}
                              {activity.action_type === 'rejected' && (
                                <span>
                                  rejected this task
                                  {activity.action_details?.reason && (
                                    <div className="mt-1 p-2 bg-red-50 border border-red-200 rounded text-red-800 text-xs">
                                      <strong>Reason:</strong> {activity.action_details.reason}
                                    </div>
                                  )}
                                </span>
                              )}
                            </span>
                            <span className="text-xs text-gray-500 ml-2">
                              {formatActivityTime(activity.created_at)}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  
                  {comments.length === 0 && activities.length === 0 && (
                    <div className="text-center py-8 text-gray-500">
                      No activity yet. Be the first to comment!
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Right Sidebar - Only Essential Actions */}
          <div className="w-56 p-6 pl-4 border-l bg-gray-50 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100">
            <h3 className="font-semibold mb-4 text-sm text-gray-700">ACTIONS</h3>
            <div className="space-y-2">
              <div>
                <input
                  type="file"
                  id="file-upload"
                  onChange={handleFileUpload}
                  className="hidden"
                  accept="*/*"
                />
                <Button 
                  variant="ghost" 
                  className="w-full justify-start h-9 text-sm hover:bg-gray-200"
                  onClick={() => document.getElementById('file-upload')?.click()}
                >
                  <Paperclip className="w-4 h-4 mr-2" />
                  Add Attachment
                </Button>
              </div>
              
              <Button 
                variant="ghost" 
                className="w-full justify-start h-9 text-sm hover:bg-gray-200"
                onClick={addCommentFromSidebar}
              >
                <MessageCircle className="w-4 h-4 mr-2" />
                Add Comment
              </Button>
              
              {/* Approval/Rejection Buttons - Only show for tasks Under Review */}
              {canApproveReject() && (
                <div className="pt-2 border-t border-gray-200">
                  <div className="space-y-2">
                    <Button 
                      variant="ghost" 
                      className="w-full justify-start h-9 text-sm hover:bg-green-100 text-green-600 hover:text-green-700"
                      onClick={handleApproveTask}
                    >
                      <Check className="w-4 h-4 mr-2" />
                      Approve Task
                    </Button>
                    
                    {!showRejectDialog ? (
                      <Button 
                        variant="ghost" 
                        className="w-full justify-start h-9 text-sm hover:bg-red-100 text-red-600 hover:text-red-700"
                        onClick={() => setShowRejectDialog(true)}
                      >
                        <X className="w-4 h-4 mr-2" />
                        Reject Task
                      </Button>
                    ) : (
                      <div className="space-y-2 p-2 bg-red-50 rounded border border-red-200">
                        <p className="text-xs text-red-600 font-medium">Reason for rejection:</p>
                        <Textarea
                          value={rejectionComment}
                          onChange={(e) => setRejectionComment(e.target.value)}
                          placeholder="Please provide a reason..."
                          className="text-xs min-h-[60px] bg-white"
                          rows={2}
                        />
                        <div className="flex gap-1">
                          <Button 
                            variant="destructive"
                            size="sm"
                            className="flex-1 h-7 text-xs"
                            onClick={handleRejectTask}
                            disabled={!rejectionComment.trim()}
                          >
                            Reject
                          </Button>
                          <Button 
                            variant="outline"
                            size="sm" 
                            className="flex-1 h-7 text-xs"
                            onClick={() => {
                              setShowRejectDialog(false);
                              setRejectionComment('');
                            }}
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
              
              {/* Delete Button */}
              <div className="pt-2 border-t border-gray-200">
                {!showDeleteConfirm ? (
                  <Button 
                    variant="ghost" 
                    className="w-full justify-start h-9 text-sm hover:bg-red-100 text-red-600 hover:text-red-700"
                    onClick={() => setShowDeleteConfirm(true)}
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete Task
                  </Button>
                ) : (
                  <div className="space-y-2">
                    <p className="text-xs text-red-600 font-medium">Delete this task?</p>
                    <div className="flex gap-1">
                      <Button 
                        variant="destructive"
                        size="sm"
                        className="flex-1 h-7 text-xs"
                        onClick={handleDeleteTask}
                      >
                        Yes
                      </Button>
                      <Button 
                        variant="outline"
                        size="sm" 
                        className="flex-1 h-7 text-xs"
                        onClick={() => setShowDeleteConfirm(false)}
                      >
                        No
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
    </>
  );
};

export default TrelloTaskModal;