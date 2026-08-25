import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { toast } from 'sonner';
import { Save, Calendar, Flag, User, Clock, Tag, FileText } from 'lucide-react';
import axios from 'axios';
import { API_URL } from '../config';

const TaskQuickEditModal = ({ task, open, onClose, onUpdate, projects = [], users = [], currentUser }) => {
  const [editedTask, setEditedTask] = useState({});
  const [isSaving, setIsSaving] = useState(false);

  const isAdminOrManager = currentUser?.role?.toLowerCase() === 'admin' || currentUser?.role?.toLowerCase() === 'manager';
  const isStandaloneTask = !task?.project_id;
  const isAssignedToCurrentUser = task?.assignee === currentUser?.id || task?.assignee === currentUser?.email || task?.assigned_to === currentUser?.id || task?.assigned_to === currentUser?.email;
  const canEdit = isAdminOrManager || (isStandaloneTask && isAssignedToCurrentUser);

  useEffect(() => {
    if (task) {
      setEditedTask({
        status: task.status || 'Not Started',
        priority: task.priority || 'medium',
        due_date: task.due_date || '',
        assignee: task.assignee || task.assigned_to || '',
        project_id: task.project_id || ''
      });
    }
  }, [task]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const token = localStorage.getItem('token');
      const response = await axios.put(`${API_URL}/tasks/${task.id}`, editedTask, { headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' } });
      toast.success('Task updated successfully');
      if (onUpdate) onUpdate(response.data);
      onClose();
    } catch (error) {
      console.error('Error updating task:', error);
      toast.error(error.response?.data?.detail || 'Failed to update task');
    } finally {
      setIsSaving(false);
    }
  };

  const handleChange = (field, value) => setEditedTask(prev => ({ ...prev, [field]: value }));

  const getPriorityColor = (priority) => {
    switch (priority?.toLowerCase()) {
      case 'high':
        return 'text-red-600 bg-red-50 dark:bg-red-900/20 border-red-200';
      case 'medium':
        return 'text-yellow-600 bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200';
      case 'low':
        return 'text-green-600 bg-green-50 dark:bg-green-900/20 border-green-200';
      default:
        return 'text-gray-600 bg-gray-50 dark:bg-gray-900/20 border-gray-200';
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'Completed':
        return 'text-green-600 bg-green-50 dark:bg-green-900/20 border-green-200';
      case 'In Progress':
        return 'text-blue-600 bg-blue-50 dark:bg-blue-900/20 border-blue-200';
      case 'Under Review':
        return 'text-purple-600 bg-purple-50 dark:bg-purple-900/20 border-purple-200';
      case 'Not Started':
        return 'text-gray-600 bg-gray-50 dark:bg-gray-900/20 border-gray-200';
      default:
        return 'text-gray-600 bg-gray-50 dark:bg-gray-900/20 border-gray-200';
    }
  };

  const currentProject = projects.find(p => p.id === editedTask.project_id);
  const assignedUser = users.find(u => u.id === editedTask.assignee || u.email === editedTask.assignee || u.id === task?.assignee || u.email === task?.assignee);

  if (!task) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="border-b pb-4">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">{task.title}</h2>
          {task.description && (<p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2">{task.description}</p>)}
          <p className="text-xs text-gray-500 mt-2">in {currentProject ? currentProject.name : 'Standalone Task'}</p>
          {!canEdit && (<p className="text-xs text-amber-600 dark:text-amber-400 mt-2 font-semibold">ℹ️ View Only - {isStandaloneTask ? 'This task is not assigned to you' : 'You can only edit your own standalone tasks'}</p>)}
        </div>

        {/* One-line edit bar (no wrap, scroll on overflow) */}
        <div className="py-4">
          <div className="flex flex-nowrap items-center gap-4 overflow-x-auto whitespace-nowrap">
            {/* Status */}
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-xs font-semibold text-gray-700 dark:text-gray-300 flex items-center"><Tag className="w-4 h-4 mr-1" />Status</span>
              <select value={editedTask.status || 'Not Started'} onChange={(e) => handleChange('status', e.target.value)} disabled={!canEdit} className={`h-9 px-3 rounded-lg border text-sm font-medium ${getStatusColor(editedTask.status)} ${!canEdit ? 'opacity-60 cursor-not-allowed' : ''}`}>
                <option value="Not Started">Not Started</option>
                <option value="In Progress">In Progress</option>
                <option value="Under Review">Under Review</option>
                <option value="Completed">Completed</option>
              </select>
            </div>

            {/* Priority */}
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-xs font-semibold text-gray-700 dark:text-gray-300 flex items-center"><Flag className="w-4 h-4 mr-1" />Priority</span>
              <select value={editedTask.priority || 'medium'} onChange={(e) => handleChange('priority', e.target.value)} disabled={!canEdit} className={`h-9 px-3 rounded-lg border text-sm font-medium ${getPriorityColor(editedTask.priority)} ${!canEdit ? 'opacity-60 cursor-not-allowed' : ''}`}>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>

            {/* Due Date */}
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-xs font-semibold text-gray-700 dark:text-gray-300 flex items-center"><Calendar className="w-4 h-4 mr-1" />Due</span>
              <Input type="date" value={editedTask.due_date || ''} onChange={(e) => handleChange('due_date', e.target.value)} disabled={!canEdit} className={`h-9 ${!canEdit ? 'opacity-60 cursor-not-allowed' : ''}`} />
            </div>

            {/* Assigned To - only for project tasks */}
            {!isStandaloneTask && (
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-xs font-semibold text-gray-700 dark:text-gray-300 flex items-center"><User className="w-4 h-4 mr-1" />Assignee</span>
                <select value={editedTask.assignee || ''} onChange={(e) => handleChange('assignee', e.target.value)} disabled={!canEdit} className={`h-9 px-3 rounded-lg border text-sm bg-white dark:bg-gray-800 ${!canEdit ? 'opacity-60 cursor-not-allowed' : ''}`}>
                  <option value="">Unassigned</option>
                  {users.map(user => (<option key={user.id} value={user.id}>{user.name} ({user.email})</option>))}
                </select>
              </div>
            )}

            {/* Project */}
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-xs font-semibold text-gray-700 dark:text-gray-300 flex items-center"><FileText className="w-4 h-4 mr-1" />Project</span>
              <select value={editedTask.project_id || ''} onChange={(e) => handleChange('project_id', e.target.value)} disabled={!canEdit} className={`h-9 px-3 rounded-lg border text-sm bg-white dark:bg-gray-800 ${!canEdit ? 'opacity-60 cursor-not-allowed' : ''}`}>
                <option value="">Standalone Task</option>
                {projects.map(project => (<option key={project.id} value={project.id}>{project.name}</option>))}
              </select>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t pt-4 flex justify-end space-x-3">
          <Button variant="outline" onClick={onClose}>{canEdit ? 'Cancel' : 'Close'}</Button>
          {canEdit && (
            <Button onClick={handleSave} disabled={isSaving} className="bg-gradient-to-r from-blue-600 to-purple-600 text-white">
              {isSaving ? (<><Clock className="w-4 h-4 mr-2 animate-spin" />Saving...</>) : (<><Save className="w-4 h-4 mr-2" />Save Changes</>)}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default TaskQuickEditModal;
