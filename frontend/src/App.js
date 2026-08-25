import { useState, useEffect, lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import axios from 'axios';
import './App.css';

// Import critical pages immediately (needed for initial load)
import Login from './pages/Login';
import ForgotPassword from './pages/ForgotPassword';
import VerifyOTP from './pages/VerifyOTP';

// Lazy load non-critical pages (code splitting for better performance)
const Dashboard = lazy(() => import('./pages/Dashboard'));
const GuestAccess = lazy(() => import('./pages/GuestAccess'));
const GuestInvite = lazy(() => import('./pages/GuestInvite'));
const TeamMembers = lazy(() => import('./pages/TeamMembers'));
const Projects = lazy(() => import('./pages/Projects'));
const MyTasks = lazy(() => import('./pages/MyTasks'));
const Settings = lazy(() => import('./pages/Settings'));
const Chats = lazy(() => import('./pages/Chats'));
const ClientProjects = lazy(() => import('./pages/ClientProjects'));
const ClientProjectView = lazy(() => import('./pages/ClientProjectView'));
const TimeSheet = lazy(() => import('./pages/TimeSheet'));
const Reports = lazy(() => import('./pages/Reports'));
const DebugPermissions = lazy(() => import('./pages/DebugPermissions'));

import MainLayout from './components/MainLayout';
import ClientPortalLayout from './components/ClientPortalLayout';
import ProtectedRoute from './components/ProtectedRoute';
import { ThemeProvider } from './contexts/ThemeContext';
import { SocketProvider } from './contexts/SocketContext';
import { PermissionProvider } from './contexts/PermissionContext';
import { Toaster } from './components/ui/sonner';
import { toast } from 'sonner';
import { BACKEND_URL, API_URL } from './config';

// Loading component for Suspense fallback
const PageLoader = () => (
  <div className="flex items-center justify-center min-h-screen bg-background">
    <div className="text-center">
      <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      <p className="mt-4 text-muted-foreground">Loading...</p>
    </div>
  </div>
);

const API = API_URL;

// Axios interceptor for auth token
axios.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  // Cookies are automatically sent by browser, no need to add manually
  config.withCredentials = true;  // Enable sending cookies
  return config;
});

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState(null);

  useEffect(() => {
    checkAuth();
    
    // Listen for permission changes from admin
    const handlePermissionChange = (event) => {
      console.log('Received permission change notification:', event.detail);
      toast.info('Your permissions have been updated by admin. Logging you out...', {
        duration: 3000
      });
      
      // Auto logout after 2 seconds
      setTimeout(() => {
        handleLogout();
      }, 2000);
    };
    
    window.addEventListener('permissionsChangedByAdmin', handlePermissionChange);
    
    return () => {
      window.removeEventListener('permissionsChangedByAdmin', handlePermissionChange);
    };
  }, []);

  const checkAuth = async () => {
    const token = localStorage.getItem('token');
    
    // Check if either token exists or session_token cookie exists
    if (token || document.cookie.includes('session_token=')) {
      try {
        const response = await axios.get(`${API}/auth/me`);
        setCurrentUser(response.data);
        setIsAuthenticated(true);
      } catch (error) {
        // Clear both token and cookie on auth failure
        localStorage.removeItem('token');
        document.cookie = 'session_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 UTC';
        setIsAuthenticated(false);
      }
    }
    setLoading(false);
  };

  const handleLogin = (token, user) => {
    console.log('handleLogin called with user:', user);
    // Only set localStorage token if provided (not for Google auth)
    if (token) {
      localStorage.setItem('token', token);
    }
    // Save user to localStorage for PermissionContext
    localStorage.setItem('user', JSON.stringify(user));
    setCurrentUser(user);
    setIsAuthenticated(true);
    
    // Trigger permission fetch in PermissionContext
    window.dispatchEvent(new CustomEvent('userLoggedIn', { detail: user }));
  };

  const handleLogout = async () => {
    try {
      // Call backend logout to clear session
      await axios.post(`${API}/auth/logout`);
    } catch (error) {
      console.error('Logout error:', error);
    }
    
    // Clear local storage and cookie
    localStorage.removeItem('token');
    localStorage.removeItem('user');  // Clear user data
    document.cookie = 'session_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 UTC';
    setCurrentUser(null);
    setIsAuthenticated(false);
    
    // Dispatch logout event to clear permissions in PermissionContext
    window.dispatchEvent(new CustomEvent('userLoggedOut'));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }

  return (
    <ThemeProvider>
      <PermissionProvider>
        <SocketProvider>
          <div className="App">
            <BrowserRouter>
            <Suspense fallback={<PageLoader />}>
              <Routes>
                <Route path="/guest/:token" element={<GuestAccess />} />
                <Route path="/guest-invite/:token" element={<GuestInvite onLogin={handleLogin} />} />
                <Route path="/forgot-password" element={<ForgotPassword />} />
                <Route path="/verify-otp" element={<VerifyOTP />} />
                <Route
                  path="/login"
                  element={
                    isAuthenticated ? (
                      currentUser?.role === 'client' ? (
                        <Navigate to="/projects" />
                      ) : (
                        <Navigate to="/dashboard" />
                      )
                    ) : (
                      <Login onLogin={handleLogin} />
                    )
                  }
                />
                <Route
                  path="/signup"
                  element={
                    isAuthenticated ? (
                      currentUser?.role === 'client' ? (
                        <Navigate to="/projects" />
                      ) : (
                        <Navigate to="/dashboard" />
                      )
                    ) : (
                      <Login onLogin={handleLogin} initialIsSignup={true} />
                    )
                  }
                />
                <Route
                  path="/dashboard"
                  element={
                    isAuthenticated ? (
                      currentUser?.role === 'client' ? (
                        <Navigate to="/projects" />
                      ) : (
                        <MainLayout currentUser={currentUser} onLogout={handleLogout}>
                          <Dashboard currentUser={currentUser} onLogout={handleLogout} />
                        </MainLayout>
                      )
                    ) : (
                      <Navigate to="/login" />
                    )
                  }
                />
              <Route
                path="/my-tasks"
                element={
                  isAuthenticated ? (
                    <MainLayout currentUser={currentUser} onLogout={handleLogout}>
                      <MyTasks currentUser={currentUser} />
                    </MainLayout>
                  ) : (
                    <Navigate to="/login" />
                  )
                }
              />
              {/* Projects Route - Works for both workspace and client portal */}
              <Route
                path="/projects"
                element={
                  isAuthenticated ? (
                    (currentUser?.role === 'client') ? (
                      <ClientPortalLayout currentUser={currentUser} onLogout={handleLogout}>
                        <Projects currentUser={currentUser} />
                      </ClientPortalLayout>
                    ) : (
                      <MainLayout currentUser={currentUser} onLogout={handleLogout}>
                        <Projects currentUser={currentUser} />
                      </MainLayout>
                    )
                  ) : (
                    <Navigate to="/login" />
                  )
                }
              />
              {/* Chats Route - Works for both workspace and client portal */}
              <Route
                path="/chats"
                element={
                  isAuthenticated ? (
                    (currentUser?.role === 'client') ? (
                      <ClientPortalLayout currentUser={currentUser} onLogout={handleLogout}>
                        <ProtectedRoute permission={['can_have_direct_chat', 'can_chat_with_millii']}>
                          <Chats currentUser={currentUser} />
                        </ProtectedRoute>
                      </ClientPortalLayout>
                    ) : (
                      <MainLayout currentUser={currentUser} onLogout={handleLogout}>
                        <ProtectedRoute permission={['can_have_direct_chat', 'can_chat_with_millii']}>
                          <Chats />
                        </ProtectedRoute>
                      </MainLayout>
                    )
                  ) : (
                    <Navigate to="/login" />
                  )
                }
              />
              <Route
                path="/settings"
                element={
                  isAuthenticated ? (
                    <MainLayout currentUser={currentUser} onLogout={handleLogout}>
                      <Settings currentUser={currentUser} />
                    </MainLayout>
                  ) : (
                    <Navigate to="/login" />
                  )
                }
              />
              <Route
                path="/time-sheet"
                element={
                  isAuthenticated ? (
                    <MainLayout currentUser={currentUser} onLogout={handleLogout}>
                      <ProtectedRoute permission="can_view_time_sheet_tab">
                        <TimeSheet currentUser={currentUser} />
                      </ProtectedRoute>
                    </MainLayout>
                  ) : (
                    <Navigate to="/login" />
                  )
                }
              />
              <Route
                path="/reports"
                element={
                  isAuthenticated ? (
                    <MainLayout currentUser={currentUser} onLogout={handleLogout}>
                      <ProtectedRoute permission="can_view_reports_tab">
                        <Reports currentUser={currentUser} />
                      </ProtectedRoute>
                    </MainLayout>
                  ) : (
                    <Navigate to="/login" />
                  )
                }
              />
              <Route
                path="/team-members"
                element={
                  isAuthenticated ? (
                    <MainLayout currentUser={currentUser} onLogout={handleLogout}>
                      <ProtectedRoute permission="can_view_team_tab">
                        <TeamMembers currentUser={currentUser} onLogout={handleLogout} />
                      </ProtectedRoute>
                    </MainLayout>
                  ) : (
                    <Navigate to="/login" />
                  )
                }
              />
              
              {/* Debug Permissions Route - Available to all authenticated users */}
              <Route
                path="/debug-permissions"
                element={
                  isAuthenticated ? (
                    currentUser?.role === 'client' ? (
                      <ClientPortalLayout currentUser={currentUser} onLogout={handleLogout}>
                        <DebugPermissions />
                      </ClientPortalLayout>
                    ) : (
                      <MainLayout currentUser={currentUser} onLogout={handleLogout}>
                        <DebugPermissions />
                      </MainLayout>
                    )
                  ) : (
                    <Navigate to="/login" />
                  )
                }
              />
              
              {/* Root redirect based on user role */}
              <Route 
                path="/" 
                element={
                  isAuthenticated ? (
                    (currentUser?.role === 'client') ? (
                      <Navigate to="/projects" />
                    ) : (
                      <Navigate to="/dashboard" />
                    )
                  ) : (
                    <Navigate to="/login" />
                  )
                } 
              />
            </Routes>
            </Suspense>
          </BrowserRouter>
          <Toaster position="top-right" />
        </div>
      </SocketProvider>
      </PermissionProvider>
    </ThemeProvider>
  );
}

export default App;