import React from 'react';
import { Navigate } from 'react-router-dom';
import { usePermissions } from '../contexts/PermissionContext';

/**
 * ProtectedRoute component
 * Wraps routes that require specific permissions
 * Redirects based on user role if permission is denied
 */
const ProtectedRoute = ({ children, permission, requireAll = false }) => {
  const { permissions, loading, hasPermission, isAdmin } = usePermissions();

  // Show loading state while permissions are being fetched
  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }

  // Admins bypass all permission checks
  if (isAdmin()) {
    return children;
  }

  // If no permission specified, allow access
  if (!permission) {
    return children;
  }

  // Determine redirect path based on user role
  const getRedirectPath = () => {
    try {
      const user = JSON.parse(localStorage.getItem('user'));
      console.log('[ProtectedRoute] User from localStorage:', user);
      if (user?.role === 'client' || user?.role === 'user') {
        console.log('[ProtectedRoute] Redirecting external user to /projects');
        return '/projects'; // Client portal projects page
      }
    } catch (e) {
      console.error('Error parsing user from localStorage:', e);
    }
    console.log('[ProtectedRoute] Redirecting to /dashboard');
    return '/dashboard';
  };

  // Check single permission
  if (typeof permission === 'string') {
    const hasPerm = hasPermission(permission);
    console.log(`[ProtectedRoute] Checking permission: ${permission}, has it: ${hasPerm}`);
    if (!hasPerm) {
      return <Navigate to={getRedirectPath()} replace />;
    }
    return children;
  }

  // Check multiple permissions
  if (Array.isArray(permission)) {
    console.log('[ProtectedRoute] Checking permissions array:', permission);
    console.log('[ProtectedRoute] Current permissions object:', JSON.stringify(permissions));
    
    if (requireAll) {
      // User must have ALL permissions
      const permResults = permission.map(perm => ({perm, has: hasPermission(perm)}));
      console.log('[ProtectedRoute] RequireAll permission check:', permResults);
      const hasAllPermissions = permission.every(perm => hasPermission(perm));
      console.log(`[ProtectedRoute] RequireAll result: ${hasAllPermissions}`);
      if (!hasAllPermissions) {
        console.log('[ProtectedRoute] REDIRECTING - User does not have all required permissions');
        return <Navigate to={getRedirectPath()} replace />;
      }
    } else {
      // User must have AT LEAST ONE permission
      const permResults = permission.map(perm => ({perm, has: hasPermission(perm)}));
      console.log('[ProtectedRoute] HasAny permission check:', permResults);
      const hasAnyPermission = permission.some(perm => hasPermission(perm));
      console.log(`[ProtectedRoute] HasAny result: ${hasAnyPermission}`);
      if (!hasAnyPermission) {
        console.log('[ProtectedRoute] REDIRECTING - User does not have any of the required permissions');
        return <Navigate to={getRedirectPath()} replace />;
      }
    }
  }

  console.log('[ProtectedRoute] Permission check passed, rendering children');
  return children;
};

export default ProtectedRoute;
