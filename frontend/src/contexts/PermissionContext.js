import React, { createContext, useContext, useState, useEffect } from "react";
import axios from "axios";

import { API_URL } from "../config";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = API_URL;

const PermissionContext = createContext();

export const usePermissions = () => {
  const context = useContext(PermissionContext);
  if (!context) {
    throw new Error("usePermissions must be used within PermissionProvider");
  }
  return context;
};

export const PermissionProvider = ({ children }) => {
  const [permissions, setPermissions] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState(null);

  // Fetch user's effective permissions
  const fetchPermissions = async (user) => {
    if (!user || !user.id) {
      setPermissions(null);
      setUserRole(null);
      setLoading(false);
      return;
    }

    try {
      setUserId(user.id);
      setUserRole(user.role);

      // Add cache busting timestamp to ensure fresh data
      const timestamp = new Date().getTime();
      console.log(API);
      const response = await axios.get(
        `${API}/users/${user.id}/permissions?_t=${timestamp}`
      );
      setPermissions(response.data.effective_permissions);
      console.log("Permissions loaded:", response.data.effective_permissions);
    } catch (error) {
      console.error("Failed to fetch permissions:", error);
      // Set default permissions (no access) if fetch fails
      setPermissions({
        can_view_team_tab: false,
        can_view_time_sheet_tab: false,
        can_view_reports_tab: false,
        can_complete_project_tasks: false,
        can_edit_workspace_settings: false,
        can_create_recurring_tasks: false,
        can_create_new_projects: false,
        can_chat_with_millii: false,
        can_have_direct_chat: false,
      });
    } finally {
      setLoading(false);
    }
  };

  // Initialize permissions from localStorage user on mount
  useEffect(() => {
    const user = JSON.parse(localStorage.getItem("user") || "{}");
    if (user && user.id) {
      fetchPermissions(user);
    } else {
      setLoading(false);
    }

    // Listen for custom 'userLoggedIn' event to refetch permissions
    const handleUserLoggedIn = (event) => {
      const user = event.detail;
      if (user && user.id) {
        fetchPermissions(user);
      }
    };

    // Listen for custom 'userLoggedOut' event to clear permissions
    const handleUserLoggedOut = () => {
      setPermissions(null);
      setUserRole(null);
      setUserId(null);
      setLoading(false);
      console.log("Permissions cleared on logout");
    };

    window.addEventListener("userLoggedIn", handleUserLoggedIn);
    window.addEventListener("userLoggedOut", handleUserLoggedOut);

    return () => {
      window.removeEventListener("userLoggedIn", handleUserLoggedIn);
      window.removeEventListener("userLoggedOut", handleUserLoggedOut);
    };
  }, []);

  // Check if user has a specific permission
  const hasPermission = (permission) => {
    if (!permissions) return false;
    return permissions[permission] === true;
  };

  // Check if user can view a specific tab
  const canViewTab = (tabName) => {
    const tabPermissions = {
      team: "can_view_team_tab",
      timesheet: "can_view_time_sheet_tab",
      reports: "can_view_reports_tab",
    };

    const permission = tabPermissions[tabName.toLowerCase()];
    return permission ? hasPermission(permission) : false;
  };

  // Check if user is admin (admins have all permissions)
  const isAdmin = () => {
    return userRole === "admin";
  };

  // Check if user is client (limited access)
  const isClientOrGuest = () => {
    return userRole === "client";
  };

  // Refresh permissions (call after role/permission changes)
  const refreshPermissions = async () => {
    const user = JSON.parse(localStorage.getItem("user") || "{}");
    if (user && user.id) {
      await fetchPermissions(user);
    }
  };

  const value = {
    permissions,
    userRole,
    userId,
    loading,
    hasPermission,
    canViewTab,
    isAdmin,
    isClientOrGuest,
    refreshPermissions,
    fetchPermissions,
  };

  return (
    <PermissionContext.Provider value={value}>
      {children}
    </PermissionContext.Provider>
  );
};

export default PermissionContext;
