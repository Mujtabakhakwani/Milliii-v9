/**
 * Permission utility functions
 * These functions help check user permissions throughout the app
 */

// Permission constants
export const PERMISSIONS = {
  VIEW_TEAM_TAB: 'can_view_team_tab',
  VIEW_TIME_SHEET_TAB: 'can_view_time_sheet_tab',
  VIEW_REPORTS_TAB: 'can_view_reports_tab',
  COMPLETE_PROJECT_TASKS: 'can_complete_project_tasks',
  EDIT_WORKSPACE_SETTINGS: 'can_edit_workspace_settings',
  CREATE_RECURRING_TASKS: 'can_create_recurring_tasks',
  CREATE_NEW_PROJECTS: 'can_create_new_projects',
  CHAT_WITH_MILLII: 'can_chat_with_millii',
  HAVE_DIRECT_CHAT: 'can_have_direct_chat'
};

// Role constants
export const ROLES = {
  ADMIN: 'admin',
  MANAGER: 'manager',
  USER: 'user',
  TEAM_MEMBER: 'team member',
  CLIENT: 'client'
};

/**
 * Check if permissions object has a specific permission
 * @param {Object} permissions - User's effective permissions
 * @param {String} permission - Permission key to check
 * @returns {Boolean}
 */
export const checkPermission = (permissions, permission) => {
  if (!permissions) return false;
  return permissions[permission] === true;
};

/**
 * Check if user role is admin
 * @param {String} role - User's role
 * @returns {Boolean}
 */
export const isAdmin = (role) => {
  return role === ROLES.ADMIN;
};

/**
 * Check if user is client (external user)
 * @param {String} role - User's role
 * @returns {Boolean}
 */
export const isExternalUser = (role) => {
  return role === ROLES.CLIENT;
};

/**
 * Get navigation items based on permissions
 * @param {Object} permissions - User's effective permissions
 * @param {String} role - User's role
 * @returns {Array} - Array of allowed navigation items
 */
export const getAllowedNavItems = (permissions, role) => {
  if (!permissions) return ['dashboard', 'my-tasks', 'my-projects'];
  
  const navItems = ['dashboard', 'my-tasks', 'my-projects'];
  
  // Chats - only if can have direct chat or chat with Millii
  if (permissions.can_have_direct_chat || permissions.can_chat_with_millii) {
    navItems.push('chats');
  }
  
  // Team Members - only if can view team tab
  if (permissions.can_view_team_tab) {
    navItems.push('team-members');
  }
  
  // Time Sheet - only if can view time sheet tab
  if (permissions.can_view_time_sheet_tab) {
    navItems.push('time-sheet');
  }
  
  // Reports - only if can view reports tab
  if (permissions.can_view_reports_tab) {
    navItems.push('reports');
  }
  
  // Settings - always available but content varies by permission
  navItems.push('settings');
  
  return navItems;
};

/**
 * Check if user can perform an action
 * @param {Object} permissions - User's effective permissions
 * @param {String} action - Action to check
 * @returns {Boolean}
 */
export const canPerformAction = (permissions, action) => {
  const actionPermissions = {
    'create-project': PERMISSIONS.CREATE_NEW_PROJECTS,
    'complete-task': PERMISSIONS.COMPLETE_PROJECT_TASKS,
    'create-recurring-task': PERMISSIONS.CREATE_RECURRING_TASKS,
    'edit-settings': PERMISSIONS.EDIT_WORKSPACE_SETTINGS,
    'chat-millii': PERMISSIONS.CHAT_WITH_MILLII,
    'direct-chat': PERMISSIONS.HAVE_DIRECT_CHAT
  };
  
  const permission = actionPermissions[action];
  return permission ? checkPermission(permissions, permission) : false;
};

export default {
  PERMISSIONS,
  ROLES,
  checkPermission,
  isAdmin,
  isExternalUser,
  getAllowedNavItems,
  canPerformAction
};
