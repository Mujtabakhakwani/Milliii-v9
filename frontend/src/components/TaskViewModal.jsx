import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Button } from './ui/button';
import { X, Edit, Calendar, Flag, User, CheckCircle, Tag, FileText, Clock } from 'lucide-react';

const TaskViewModal = ({ task, open, onClose, onEdit, projects = [], users = [] }) => {
  if (!task) return null;

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

  const currentProject = projects.find(p => p.id === task.project_id);
  const assignedUser = users.find(u => u.id === task.assigned_to || u.email === task.assigned_to);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-white dark:bg-gray-800 border-b px-6 py-4">
          <div className="flex items-start justify-between">
            <div className="flex items-start space-x-3 flex-1">
              <CheckCircle className="w-6 h-6 text-purple-600 mt-1" />
              <div className="flex-1">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                  {task.title}
                </h2>
                <p className="text-sm text-gray-500 mt-1">
                  in {currentProject ? currentProject.name : 'Standalone Task'}
                </p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700"
            >
              <X className="w-5 h-5" />
            </Button>
          </div>
        </div>

        {/* Content */}
        <div className="px-6 py-4 space-y-6">
          {/* Status/Priority/Due/Assignee in one row (no wrap) */}
          <div className="flex flex-nowrap items-end gap-3 overflow-x-auto">
            <div className="flex flex-col w-44 shrink-0">
              <div className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1 flex items-center whitespace-nowrap">
                <Tag className="w-4 h-4 mr-2" />
                Status
              </div>
              <div className={`w-full px-4 py-2 rounded-lg border text-sm font-medium ${getStatusColor(task.status)}`}>
                {task.status || 'Not Started'}
              </div>
            </div>

            <div className="flex flex-col w-40 shrink-0">
              <div className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1 flex items-center whitespace-nowrap">
                <Flag className="w-4 h-4 mr-2" />
                Priority
              </div>
              <div className={`w-full px-4 py-2 rounded-lg border text-sm font-medium ${getPriorityColor(task.priority)}`}>
                {task.priority?.toUpperCase() || 'MEDIUM'}
              </div>
            </div>

            <div className="flex flex-col w-56 shrink-0">
              <div className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1 flex items-center whitespace-nowrap">
                <Calendar className="w-4 h-4 mr-2" />
                Due Date
              </div>
              <div className="text-sm text-gray-700 dark:text-gray-300 w-full">
                {task.due_date ? new Date(task.due_date).toLocaleDateString('en-US', {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                }) : 'Not set'}
              </div>
            </div>

            <div className="flex flex-col w-72 shrink-0">
              <div className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1 flex items-center whitespace-nowrap">
                <User className="w-4 h-4 mr-2" />
                Assigned To
              </div>
              {assignedUser ? (
                <div className="flex items-center space-x-2">
                  <div className="w-8 h-8 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center font-semibold text-purple-600 dark:text-purple-400">
                    {assignedUser.name?.charAt(0) || 'U'}
                  </div>
                  <div>
                    <div className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      {assignedUser.name}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      {assignedUser.email}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-sm text-gray-500 dark:text-gray-400">Unassigned</div>
              )}
            </div>
          </div>

          {/* Description */}
          {task.description && (
            <div>
              <div className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center">
                <FileText className="w-4 h-4 mr-2" />
                Description
              </div>
              <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-4 text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                {task.description}
              </div>
            </div>
          )}

          {/* Task Summary Box */}
          <div className="bg-gradient-to-r from-purple-50/50 to-blue-50/50 dark:from-purple-900/20 dark:to-blue-900/20 rounded-lg p-4 border border-purple-200/50 dark:border-purple-800/50">
            <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Quick Summary</h4>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">Status:</span>
                <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(task.status)}`}>
                  {task.status || 'Not Started'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">Priority:</span>
                <span className={`px-2 py-1 rounded text-xs font-medium ${getPriorityColor(task.priority)}`}>
                  {task.priority?.toUpperCase() || 'MEDIUM'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">Due Date:</span>
                <span className="text-gray-700 dark:text-gray-300">
                  {task.due_date ? new Date(task.due_date).toLocaleDateString() : 'Not set'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">Assignee:</span>
                <span className="text-gray-700 dark:text-gray-300">
                  {assignedUser?.name || 'Unassigned'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-white dark:bg-gray-800 border-t px-6 py-4 flex justify-end space-x-3">
          <Button
            variant="outline"
            onClick={onClose}
          >
            Close
          </Button>
          <Button
            onClick={() => {
              onClose();
              if (onEdit) onEdit();
            }}
            className="bg-gradient-to-r from-blue-600 to-purple-600 text-white"
          >
            <Edit className="w-4 h-4 mr-2" />
            Edit Task
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

// Label component for consistency
const Label = ({ children, className = '' }) => (
  <div className={className}>{children}</div>
);

export default TaskViewModal;
