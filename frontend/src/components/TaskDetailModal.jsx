import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { toast } from 'sonner';
import { Save, Calendar, Flag, User, CheckCircle, Clock, Tag, FileText } from 'lucide-react';
import axios from 'axios';
import { API_URL } from '../config';

const TaskDetailModal = ({ task, open, onClose, onUpdate, projects = [], users = [], mode = 'title-description' }) => {
  const [editedTask, setEditedTask] = useState({});
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (task) {
      if (mode === 'title-description') {
        setEditedTask({
          title: task.title || '',
          description: task.description || ''
        });
      } else {
        setEditedTask({
          title: task.title || '',
          description: task.description || '',
          status: task.status || 'Not Started',
          priority: task.priority || 'medium',
          due_date: task.due_date || '',
          assigned_to: task.assigned_to || '',
          project_id: task.project_id || ''
        });
      }
    }
  }, [task, mode]);

  const handleSave = async () => {
    if (!editedTask.title?.trim()) {
      toast.error('Task title is required');
      return;
    }

    setIsSaving(true);
    try {
      const token = localStorage.getItem('token');
      const response = await axios.put(
        `${API_URL}/tasks/${task.id}`,
        editedTask,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

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

  const assignedUser = users.find(u => u.id === editedTask.assigned_to || u.email === editedTask.assigned_to);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className={mode === 'title-description' ? 'max-w-5xl' : 'max-w-6xl'} style={{maxHeight: '90vh', overflow: 'auto'}}>
        {/* Header */}
        <div className="border-b pb-4">
          <div className="flex items-start space-x-3">
            <CheckCircle className="w-6 h-6 text-purple-600 mt-1" />
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-2">
                {mode === 'title-description' ? 'Edit Task Title & Description' : 'Edit Task'}
              </h3>
            </div>
          </div>
        </div>

        {mode === 'title-description' ? (
          <div className="space-y-6 py-4">
            <div>
              <Label className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Task Title</Label>
              <Input value={editedTask.title || ''} onChange={(e) => handleChange('title', e.target.value)} className="text-lg font-semibold" placeholder="Enter task title..." />
            </div>
            <div>
              <Label className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Description</Label>
              <Textarea value={editedTask.description || ''} onChange={(e) => handleChange('description', e.target.value)} className="min-h-[300px] resize-none" placeholder="Add a detailed description..." />
            </div>
          </div>
        ) : (
          <div className="py-4 space-y-6">
            {/* One-line property editor (no wrap, scroll on overflow) */}
            <div className="flex flex-nowrap items-center gap-4 overflow-x-auto whitespace-nowrap py-1">
              {/* Assignee */}
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-xs font-semibold text-gray-700 dark:text-gray-300 flex items-center"><User className="w-4 h-4 mr-1" />Assignee</span>
                <select value={editedTask.assigned_to || ''} onChange={(e) => handleChange('assigned_to', e.target.value)} className="h-9 px-3 rounded-lg border text-sm bg-white dark:bg-gray-800">
                  <option value="">Unassigned</option>
                  {users.map(user => (
                    <option key={user.id} value={user.id}>{user.name} ({user.email})</option>
                  ))}
                </select>
              </div>

              {/* Priority */}
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-xs font-semibold text-gray-700 dark:text-gray-300 flex items-center"><Flag className="w-4 h-4 mr-1" />Priority</span>
                <select value={editedTask.priority || 'medium'} onChange={(e) => handleChange('priority', e.target.value)} className={`h-9 px-3 rounded-lg border text-sm font-medium ${getPriorityColor(editedTask.priority)}`}>
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </div>

              {/* Status */}
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-xs font-semibold text-gray-700 dark:text-gray-300 flex items-center"><Tag className="w-4 h-4 mr-1" />Status</span>
                <select value={editedTask.status || 'Not Started'} onChange={(e) => handleChange('status', e.target.value)} className={`h-9 px-3 rounded-lg border text-sm font-medium ${getStatusColor(editedTask.status)}`}>
                  <option value="Not Started">Not Started</option>
                  <option value="In Progress">In Progress</option>
                  <option value="Under Review">Under Review</option>
                  <option value="Completed">Completed</option>
                </select>
              </div>

              {/* Due Date */}
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-xs font-semibold text-gray-700 dark:text-gray-300 flex items-center"><Calendar className="w-4 h-4 mr-1" />Due</span>
                <Input type="date" value={editedTask.due_date || ''} onChange={(e) => handleChange('due_date', e.target.value)} className="h-9" />
              </div>

              {/* Project */}
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-xs font-semibold text-gray-700 dark:text-gray-300 flex items-center"><FileText className="w-4 h-4 mr-1" />Project</span>
                <select value={editedTask.project_id || ''} onChange={(e) => handleChange('project_id', e.target.value)} className="h-9 px-3 rounded-lg border text-sm bg-white dark:bg-gray-800">
                  <option value="">Standalone Task</option>
                  {projects.map(project => (
                    <option key={project.id} value={project.id}>{project.name}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Description */}
            <div>
              <Label className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center"><FileText className="w-4 h-4 mr-2" />Description</Label>
              <Textarea value={editedTask.description || ''} onChange={(e) => handleChange('description', e.target.value)} className="min-h-[300px] resize-none" placeholder="Add a more detailed description..." />
            </div>

            {/* Meta */}
            <div className="pt-2 text-xs text-gray-500 dark:text-gray-400"><Clock className="inline w-3 h-3 mr-2" />Created: {new Date(task?.created_at).toLocaleDateString()}</div>
          </div>
        )}

        {/* Footer */}
        <div className="border-t pt-4 flex justify-end space-x-3">
          <Button variant="outline" onClick={onClose} disabled={isSaving}>Cancel</Button>
          <Button onClick={handleSave} disabled={isSaving} className="bg-gradient-to-r from-blue-600 to-purple-600 text-white">
            {isSaving ? (<><Clock className="w-4 h-4 mr-2 animate-spin" />Saving...</>) : (<><Save className="w-4 h-4 mr-2" />Save Changes</>)}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default TaskDetailModal;
