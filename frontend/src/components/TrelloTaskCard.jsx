import React, { useState, useMemo, useCallback } from 'react';
import { 
  Calendar, 
  MessageCircle, 
  Paperclip, 
  User, 
  Flag,
  Clock,
  CheckSquare,
  Check,
  X,
  Circle,
  CheckCircle,
  Eye
} from 'lucide-react';
import InlineEditDropdown from './InlineEditDropdown';
import InlineEditDate from './InlineEditDate';
import InlineEditUser from './InlineEditUser';

// Memoized component for better performance (prevents unnecessary re-renders)
const TrelloTaskCard = React.memo(({ 
  task, 
  users = [], 
  onClick, 
  onApprove,
  onReject,
  onUpdate,  // NEW: Handler for inline updates
  currentUser,
  className = "",
  showProject = false,
  projectTeamMembers = [] // NEW: Project team members for filtering
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const [isAssigneeEditing, setIsAssigneeEditing] = useState(false); // NEW: State for assignee editing
  const [hasOpenDropdown, setHasOpenDropdown] = useState(false); // NEW: Track if any dropdown is open
  
  const assignee = users.find(u => u.id === task.assignee);
  const isOverdue = task.due_date && new Date(task.due_date) < new Date() && task.status !== 'Completed';
  
  // Check if current user can approve/reject this task
  const canApproveReject = () => {
    if (!currentUser || task.status !== 'Under Review') return false;
    
    const userRole = currentUser.role?.toLowerCase();
    
    // Admins can approve/reject any task
    if (userRole === 'admin') return true;
    
    // Managers can approve/reject tasks in projects they own
    if (userRole === 'manager') {
      // For standalone tasks, managers cannot approve
      if (!task.project_id) return false;
      // Check if manager owns the project (this would need project data, for now assume true)
      return true;
    }
    
    // Clients can approve/reject tasks in projects they are members of
    if (userRole === 'client' || userRole === 'user') {
      // Only project tasks, not standalone tasks
      if (!task.project_id) return false;
      // Check if client is member of project (this would need project data, for now assume true)
      return true;
    }
    
    return false;
  };
  
  // Get priority color
  const getPriorityColor = (priority) => {
    switch (priority?.toLowerCase()) {
      case 'high': return 'border-l-red-500';
      case 'medium': return 'border-l-yellow-500'; 
      case 'low': return 'border-l-green-500';
      default: return 'border-l-gray-300';
    }
  };
  
  // Get status color for dropdown
  const getStatusColorForDropdown = (status) => {
    switch (status) {
      case 'Completed':
        return 'text-green-700 bg-green-50 dark:bg-green-900/20 border border-green-200';
      case 'In Progress':
        return 'text-blue-700 bg-blue-50 dark:bg-blue-900/20 border border-blue-200';
      case 'Under Review':
        return 'text-purple-700 bg-purple-50 dark:bg-purple-900/20 border border-purple-200';
      case 'Not Started':
        return 'text-gray-700 bg-gray-50 dark:bg-gray-900/20 border border-gray-200';
      default:
        return 'text-gray-700 bg-gray-50 dark:bg-gray-900/20 border border-gray-200';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'Completed':
        return <CheckCircle className="w-3 h-3" />;
      case 'In Progress':
        return <Clock className="w-3 h-3" />;
      case 'Under Review':
        return <Eye className="w-3 h-3" />;
      case 'Not Started':
        return <Circle className="w-3 h-3" />;
      default:
        return <Circle className="w-3 h-3" />;
    }
  };

  const getPriorityColorForDropdown = (priority) => {
    switch (priority?.toLowerCase()) {
      case 'high':
        return 'text-red-700 bg-red-50 dark:bg-red-900/20 border border-red-200';
      case 'medium':
        return 'text-yellow-700 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200';
      case 'low':
        return 'text-green-700 bg-green-50 dark:bg-green-900/20 border border-green-200';
      default:
        return 'text-gray-700 bg-gray-50 dark:bg-gray-900/20 border border-gray-200';
    }
  };

  const getPriorityIcon = (priority) => {
    return <Flag className="w-3 h-3" />;
  };
  
  // Get status color (old function for compatibility)
  const getStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case 'not started': return 'bg-gray-100 text-gray-800';
      case 'in progress': return 'bg-blue-100 text-blue-800';
      case 'under review': return 'bg-yellow-100 text-yellow-800';
      case 'completed': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  // Handle inline field updates
  const handleInlineUpdate = (field, value) => {
    if (onUpdate) {
      onUpdate(task.id, { [field]: value });
    }
  };

  // Generate user avatar (no title tooltip for cleaner UX)
  const getUserAvatar = (user, showTitle = false) => {
    if (user?.profile_image_url) {
      return (
        <img 
          src={user.profile_image_url} 
          alt={user.name}
          className="w-6 h-6 rounded-full object-cover"
        />
      );
    }
    
    const initials = user?.name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || '??';
    const colors = [
      'bg-blue-500', 'bg-green-500', 'bg-purple-500', 'bg-pink-500',
      'bg-indigo-500', 'bg-red-500', 'bg-yellow-500', 'bg-teal-500'
    ];
    const colorIndex = user?.email ? user.email.length % colors.length : 0;
    
    return (
      <div 
        className={`w-6 h-6 rounded-full ${colors[colorIndex]} flex items-center justify-center text-white text-xs font-semibold`}
      >
        {initials}
      </div>
    );
  };

  return (
    <div
      className={`
        bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 
        shadow-sm hover:shadow-md transition-all duration-200 cursor-pointer
        ${getPriorityColor(task.priority)} border-l-4
        ${isHovered ? 'transform translate-y-[-1px]' : ''}
        ${hasOpenDropdown || isAssigneeEditing ? 'z-[10000]' : 'z-0'}
        ${className}
        relative overflow-visible
      `}
      onClick={(e) => {
        // Reset dropdown state when opening modal
        setHasOpenDropdown(false);
        setIsAssigneeEditing(false);
        onClick(e);
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Cover image area - if task has cover attachment */}
      {task.cover_attachment_id && (
        <div className="h-20 bg-gradient-to-r from-blue-400 to-purple-500 rounded-t-lg">
          {/* This would show the actual cover image when implemented */}
        </div>
      )}
      
      {/* Labels */}
      {task.labels && task.labels.length > 0 && (
        <div className="px-2 pt-2 flex flex-wrap gap-1">
          {task.labels.slice(0, 3).map((label, index) => (
            <span
              key={index}
              className="px-2 py-1 rounded text-xs font-medium text-white"
              style={{ backgroundColor: label.color || '#6B7280' }}
            >
              {label.name || label}
            </span>
          ))}
          {task.labels.length > 3 && (
            <span className="px-2 py-1 rounded text-xs font-medium bg-gray-100 text-gray-600">
              +{task.labels.length - 3}
            </span>
          )}
        </div>
      )}
      
      <div className="p-2.5">
        {/* Task Title */}
        <h4 className="font-semibold text-gray-900 dark:text-white text-sm mb-1.5 line-clamp-2">
          {task.title}
        </h4>
        
        {/* Task Description Preview */}
        {task.description && (
          <p className="text-xs text-gray-600 dark:text-gray-400 mb-2 line-clamp-2">
            {task.description}
          </p>
        )}
        
        {/* Task Meta Information */}
        <div className="flex items-center justify-between text-xs text-gray-500">
          <div className="flex items-center space-x-2">
            {/* Due Date */}
            {task.due_date && (
              <div className={`flex items-center space-x-1 ${isOverdue ? 'text-red-500 font-medium' : ''}`}>
                <Clock className="w-3 h-3" />
                <span>{new Date(task.due_date).toLocaleDateString()}</span>
              </div>
            )}
            
            {/* Comments Count */}
            {task.comment_count > 0 && (
              <div className="flex items-center space-x-1">
                <MessageCircle className="w-3 h-3" />
                <span>{task.comment_count}</span>
              </div>
            )}
            
            {/* Attachments Count */}
            {task.attachment_count > 0 && (
              <div className="flex items-center space-x-1">
                <Paperclip className="w-3 h-3" />
                <span>{task.attachment_count}</span>
              </div>
            )}
            
            {/* Checklist Progress */}
            {task.checklist_items && task.checklist_items.length > 0 && (
              <div className="flex items-center space-x-1">
                <CheckSquare className="w-3 h-3" />
                <span>
                  {task.checklist_items.filter(item => item.completed).length}/
                  {task.checklist_items.length}
                </span>
              </div>
            )}
          </div>
          
          {/* Avatar and Actions */}
          <div className="flex items-center space-x-1">
            {/* Assignee Avatar - Click to edit */}
            {onUpdate ? (
              <div 
                onClick={(e) => {
                  e.stopPropagation();
                  setIsAssigneeEditing(!isAssigneeEditing);
                }}
                className="relative"
              >
                {assignee ? (
                  <div className="cursor-pointer hover:ring-2 hover:ring-blue-400 rounded-full transition-all">
                    {getUserAvatar(assignee)}
                  </div>
                ) : (
                  <div className="w-6 h-6 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center cursor-pointer hover:ring-2 hover:ring-blue-400 transition-all">
                    <User className="w-3 h-3 text-gray-500" />
                  </div>
                )}
                
                {/* Assignee Edit Dropdown - Just the dropdown list, no button */}
                {isAssigneeEditing && (
                  <div className="absolute top-full right-0 mt-1 z-[9999] w-64 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 py-1 max-h-80 overflow-y-auto"
                       onClick={(e) => e.stopPropagation()}>
                    {/* Search input */}
                    <div className="px-3 py-2 border-b border-gray-200 dark:border-gray-700">
                      <input
                        type="text"
                        placeholder="Search users..."
                        className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-md
                                 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100
                                 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        autoFocus
                        onChange={(e) => {
                          // We'll add search functionality inline
                          const searchValue = e.target.value.toLowerCase();
                          // Filter users in real-time
                        }}
                      />
                    </div>

                    {/* Unassign option */}
                    {task.assignee && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleInlineUpdate('assignee', '');
                          setIsAssigneeEditing(false);
                        }}
                        className="w-full px-3 py-2 text-left text-sm flex items-center gap-2
                                 hover:bg-gray-100 dark:hover:bg-gray-700 text-red-600 dark:text-red-400
                                 border-b border-gray-200 dark:border-gray-700"
                      >
                        <X className="w-4 h-4" />
                        <span>Unassign</span>
                      </button>
                    )}

                    {/* User list */}
                    {users
                      .filter(u => {
                        // Exclude clients
                        if (u.role?.toLowerCase() === 'client') return false;
                        // Only show project team members
                        if (projectTeamMembers && projectTeamMembers.length > 0) {
                          return projectTeamMembers.includes(u.id) || projectTeamMembers.includes(u.email);
                        }
                        return true;
                      })
                      .map((user) => {
                        const isSelected = user.id === task.assignee || user.email === task.assignee;
                        const initials = user.name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || '??';
                        const colors = ['bg-blue-500', 'bg-green-500', 'bg-purple-500', 'bg-pink-500'];
                        const colorIndex = user.email ? user.email.length % colors.length : 0;
                        
                        return (
                          <button
                            key={user.id}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleInlineUpdate('assignee', user.id || user.email);
                              setIsAssigneeEditing(false);
                            }}
                            className={`
                              w-full px-3 py-2 text-left text-sm flex items-center gap-2
                              hover:bg-gray-100 dark:hover:bg-gray-700
                              transition-colors duration-150
                              ${isSelected ? 'bg-blue-50 dark:bg-blue-900/20' : ''}
                            `}
                          >
                            <div className={`w-6 h-6 rounded-full ${colors[colorIndex]} text-white text-xs flex items-center justify-center font-semibold`}>
                              {initials}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="font-medium text-gray-900 dark:text-gray-100 truncate">
                                {user.name}
                              </div>
                              <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                                {user.email}
                              </div>
                            </div>
                            {isSelected && <Check className="w-4 h-4 text-blue-600 dark:text-blue-400 flex-shrink-0" />}
                          </button>
                        );
                      })}
                  </div>
                )}
              </div>
            ) : (
              assignee && getUserAvatar(assignee)
            )}
            
            {/* Approve/Reject Buttons for Under Review tasks - Always visible and prominent */}
            {canApproveReject() && (
              <>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onApprove?.(task);
                  }}
                  className="flex items-center px-2 py-1 bg-green-500 hover:bg-green-600 text-white rounded text-xs font-medium transition-colors duration-200"
                  title="Approve Task"
                >
                  <Check className="w-3 h-3 mr-1" />
                  Approve
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onReject?.(task);
                  }}
                  className="flex items-center px-2 py-1 bg-red-500 hover:bg-red-600 text-white rounded text-xs font-medium transition-colors duration-200"
                  title="Reject Task"
                >
                  <X className="w-3 h-3 mr-1" />
                  Reject
                </button>
              </>
            )}
          </div>
        </div>
        
        {/* Inline Editing Fields (bottom) - Compact badges, click to edit */}
        <div className="mt-2 pt-1.5 border-t border-gray-100 dark:border-gray-700 flex flex-wrap items-center gap-1.5">
          {/* Status - Compact badge, click to edit */}
          <div onClick={(e) => e.stopPropagation()}>
            <InlineEditDropdown
              value={task.status}
              options={['Not Started', 'In Progress', 'Under Review', 'Completed']}
              onChange={(newStatus) => onUpdate && handleInlineUpdate('status', newStatus)}
              getColor={getStatusColorForDropdown}
              getIcon={getStatusIcon}
              label="Status"
              disabled={!onUpdate}
              onOpenChange={setHasOpenDropdown}
            />
          </div>
          
          {/* Priority - Compact badge, click to edit */}
          <div onClick={(e) => e.stopPropagation()}>
            <InlineEditDropdown
              value={task.priority || 'Medium'}
              options={['Low', 'Medium', 'High']}
              onChange={(newPriority) => onUpdate && handleInlineUpdate('priority', newPriority)}
              getColor={getPriorityColorForDropdown}
              getIcon={getPriorityIcon}
              label="Priority"
              disabled={!onUpdate}
              onOpenChange={(isOpen) => setHasOpenDropdown(prev => isOpen || prev)}
            />
          </div>

          {/* Due Date - Compact badge, click to edit */}
          {onUpdate && (
            <div onClick={(e) => e.stopPropagation()}>
              <InlineEditDate
                value={task.due_date || ''}
                onChange={(newDate) => handleInlineUpdate('due_date', newDate)}
                onOpenChange={(isOpen) => setHasOpenDropdown(prev => isOpen || prev)}
              />
            </div>
          )}
          
          {/* Approval Status Indicator */}
          {task.approval_status === 'approved' && (
            <span className="px-2 py-1 rounded text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400 flex items-center space-x-1">
              <Check className="w-3 h-3" />
              <span>Approved</span>
            </span>
          )}
          {task.approval_status === 'rejected' && (
            <span className="px-2 py-1 rounded text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400 flex items-center space-x-1">
              <X className="w-3 h-3" />
              <span>Rejected</span>
            </span>
          )}
        </div>
        
        {/* Project Name (if showing cross-project tasks) */}
        {showProject && task.project_name && (
          <div className="mt-2 text-xs text-gray-500">
            in {task.project_name}
          </div>
        )}
      </div>
    </div>
  );
});

// Add display name for debugging
TrelloTaskCard.displayName = 'TrelloTaskCard';

export default TrelloTaskCard;