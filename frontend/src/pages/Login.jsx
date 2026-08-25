import { useState, useEffect } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { toast } from 'sonner';
import { Sparkles, LogIn, UserPlus } from 'lucide-react';
import { Loader2 } from 'lucide-react';
import { API_URL } from '../config';

const API = API_URL;

const Login = ({ onLogin, initialIsSignup = false }) => {
  const [isSignup, setIsSignup] = useState(initialIsSignup);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    role: 'user'
  });
  const [loading, setLoading] = useState(false);
  const [processingGoogle, setProcessingGoogle] = useState(false);
  const [logoClickCount, setLogoClickCount] = useState(0);
  const [showAdminOption, setShowAdminOption] = useState(false);

  // Handle logo clicks for admin access
  const handleLogoClick = () => {
    // Only allow on signup page
    if (!isSignup) {
      return;
    }
    
    const newCount = logoClickCount + 1;
    setLogoClickCount(newCount);
    
    console.log('Logo clicked:', newCount, 'times');
    
    if (newCount === 3) {
      setShowAdminOption(true);
      toast.success('Admin signup enabled! 🔓');
    } else if (newCount < 3) {
      toast.info(`Click ${3 - newCount} more time${3 - newCount > 1 ? 's' : ''}`);
    }
  };

  // Process Google session_id from URL fragment
  useEffect(() => {
    const processGoogleAuth = async () => {
      const hash = window.location.hash;
      const params = new URLSearchParams(hash.substring(1));
      const sessionId = params.get('session_id');

      if (sessionId) {
        setProcessingGoogle(true);
        
        try {
          // Exchange session_id for user data
          const response = await axios.post(`${API}/auth/google/process-session`, {
            session_id: sessionId
          });

          const { user, session_token } = response.data;

          // Set cookie with session_token
          document.cookie = `session_token=${session_token}; path=/; secure; samesite=none; max-age=${7 * 24 * 60 * 60}`;

          // Clean URL fragment
          window.history.replaceState(null, '', window.location.pathname);

          toast.success('Signed in with Google successfully!');
          onLogin(null, user);  // Pass null for access_token since we're using session_token
        } catch (error) {
          console.error('Google auth error:', error);
          toast.error('Failed to sign in with Google');
          setProcessingGoogle(false);
        }
      }
    };

    processGoogleAuth();
  }, [onLogin]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const endpoint = isSignup ? '/auth/signup' : '/auth/login';
      const payload = isSignup
        ? formData
        : { email: formData.email, password: formData.password };

      const response = await axios.post(`${API}${endpoint}`, payload);
      const { access_token, user } = response.data;

      toast.success(isSignup ? 'Account created successfully!' : 'Welcome back!');
      onLogin(access_token, user);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = () => {
    // Redirect to Emergent Auth with redirect_url pointing to dashboard
    const redirectUrl = `${window.location.origin}/dashboard`;
    const authUrl = process.env.REACT_APP_AUTH_URL || 'https://auth.emergentagent.com';
    window.location.href = `${authUrl}/?redirect=${encodeURIComponent(redirectUrl)}`;
  };

  // Show loading state while processing Google auth
  if (processingGoogle) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-purple-50 to-blue-50">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-purple-600 mx-auto mb-4" />
          <p className="text-gray-600 font-medium">Signing you in with Google...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-purple-50 to-blue-50 p-4 relative overflow-hidden">
      {/* Animated Background Elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-400/20 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-400/20 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }}></div>
      </div>

      {/* Login Card */}
      <Card className="w-full max-w-md shadow-2xl border-0 relative z-10 animate-scale-in backdrop-blur-xl bg-white/70 dark:bg-gray-900/70" data-testid="login-card">
        <CardHeader className="space-y-4 text-center pb-8">
          {/* Logo */}
          <div 
            className="flex items-center justify-center space-x-3 mb-4 animate-fade-in cursor-pointer"
            onClick={handleLogoClick}
            title="Click 3 times for admin access"
          >
            <div className="relative">
              <Sparkles className="w-12 h-12 text-purple-600 animate-pulse" />
              <div className="absolute inset-0 bg-purple-500/30 blur-2xl rounded-full"></div>
            </div>
            <h1 className="text-4xl font-extrabold bg-gradient-to-r from-blue-600 via-purple-600 to-blue-600 bg-clip-text text-transparent animate-shimmer bg-[length:200%_auto]">
              Millii
            </h1>
          </div>
          
          {/* Title */}
          <CardTitle className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            {isSignup ? 'Create Account' : 'Welcome Back'}
          </CardTitle>
          
          {/* Description */}
          <CardDescription className="text-center text-gray-600 dark:text-gray-400">
            {isSignup
              ? 'Sign up to start managing your projects'
              : 'Sign in to your account'}
          </CardDescription>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Name Field (Signup Only) */}
            {isSignup && (
              <div className="space-y-2 animate-fade-in">
                <Label htmlFor="name" className="text-gray-700 dark:text-gray-300 font-semibold">Full Name</Label>
                <Input
                  id="name"
                  data-testid="name-input"
                  placeholder="John Doe"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="border-purple-200 dark:border-purple-800 focus:border-purple-500 focus:ring-purple-500/20 bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm transition-all duration-300 hover:shadow-md"
                  required
                />
              </div>
            )}

            {/* Email Field */}
            <div className="space-y-2 animate-fade-in" style={{ animationDelay: '0.1s' }}>
              <Label htmlFor="email" className="text-gray-700 dark:text-gray-300 font-semibold">Email</Label>
              <Input
                id="email"
                data-testid="email-input"
                type="email"
                placeholder="you@example.com"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="border-purple-200 dark:border-purple-800 focus:border-purple-500 focus:ring-purple-500/20 bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm transition-all duration-300 hover:shadow-md"
                required
              />
            </div>

            {/* Password Field */}
            <div className="space-y-2 animate-fade-in" style={{ animationDelay: '0.2s' }}>
              <div className="flex justify-between items-center">
                <Label htmlFor="password" className="text-gray-700 dark:text-gray-300 font-semibold">Password</Label>
                {!isSignup && (
                  <Link 
                    to="/forgot-password" 
                    className="text-xs text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 font-medium transition-colors"
                  >
                    Forgot Password?
                  </Link>
                )}
              </div>
              <Input
                id="password"
                data-testid="password-input"
                type="password"
                placeholder="••••••••"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                className="border-purple-200 dark:border-purple-800 focus:border-purple-500 focus:ring-purple-500/20 bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm transition-all duration-300 hover:shadow-md"
                required
              />
            </div>

            {/* Role Field (Signup Only) - Shows when admin access is enabled */}
            {isSignup && showAdminOption && (
              <div className="space-y-2 animate-fade-in" style={{ animationDelay: '0.3s' }}>
                <Label htmlFor="role" className="text-gray-700 dark:text-gray-300 font-semibold">Role</Label>
                <select
                  id="role"
                  data-testid="role-select"
                  className="w-full px-4 py-2.5 border border-purple-200 dark:border-purple-800 rounded-lg bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 transition-all duration-300 hover:shadow-md text-gray-700 dark:text-gray-300"
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                >
                  <option value="user">User</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
            )}

            {/* Submit Button */}
            <Button
              type="submit"
              data-testid="submit-button"
              className="w-full text-white font-semibold py-3 rounded-xl bg-gradient-to-r from-blue-600 via-purple-600 to-blue-600 bg-[length:200%_auto] hover:shadow-xl hover:shadow-purple-500/50 transition-all duration-300 hover:scale-105 animate-fade-in border-0"
              style={{ animationDelay: '0.4s' }}
              disabled={loading}
            >
              <div className="flex items-center justify-center space-x-2">
                {loading ? (
                  <span>Please wait...</span>
                ) : (
                  <>
                    {isSignup ? <UserPlus className="w-5 h-5" /> : <LogIn className="w-5 h-5" />}
                    <span>{isSignup ? 'Sign Up' : 'Sign In'}</span>
                  </>
                )}
              </div>
            </Button>
          </form>

          {/* Google Sign In Button - TEMPORARILY HIDDEN */}
          {/* {isSignup && formData.role === 'user' && (
            <>
              <div className="relative my-6">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-300 dark:border-gray-600"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-2 bg-white/70 dark:bg-gray-900/70 text-gray-500 dark:text-gray-400">
                    Or continue with
                  </span>
                </div>
              </div>

              <Button
                type="button"
                onClick={handleGoogleSignIn}
                className="w-full text-gray-700 dark:text-gray-300 font-semibold py-3 rounded-xl bg-white dark:bg-gray-800 border-2 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 hover:shadow-lg transition-all duration-300 hover:scale-105"
                disabled={loading}
              >
                <div className="flex items-center justify-center space-x-2">
                  <svg className="w-5 h-5" viewBox="0 0 24 24">
                    <path
                      fill="currentColor"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="currentColor"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="currentColor"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                    />
                    <path
                      fill="currentColor"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    />
                  </svg>
                  <span>Sign up with Google</span>
                </div>
              </Button>
            </>
          )} */}

          {/* Toggle Mode Button */}
          <div className="mt-6 text-center animate-fade-in" style={{ animationDelay: '0.5s' }}>
            <button
              data-testid="toggle-mode-button"
              onClick={() => setIsSignup(!isSignup)}
              className="text-sm font-medium text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 transition-colors duration-300 hover:underline"
            >
              {isSignup
                ? 'Already have an account? Sign in'
                : "Don't have an account? Sign up"}
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Login;