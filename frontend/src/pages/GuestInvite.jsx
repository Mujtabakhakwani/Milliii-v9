import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { CheckCircle, Users, Link as LinkIcon, Package, MessageSquare, AlertCircle, Loader } from 'lucide-react';
import { toast } from 'sonner';
import { BACKEND_URL, API_URL } from '../config';

const API = API_URL;


const GuestInvite = ({ onLogin }) => {
  const { token } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [projectPreview, setProjectPreview] = useState(null);
  const [error, setError] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    email: ''
  });

  useEffect(() => {
    validateGuestLink();
  }, [token]);

  const validateGuestLink = async () => {
    try {
      const response = await axios.get(`${API}/guest-link/${token}`);
      setProjectPreview(response.data);
      setLoading(false);
    } catch (error) {
      setError(error.response?.data?.detail || 'Invalid or expired guest link');
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.name.trim() || !formData.email.trim()) {
      toast.error('Please enter both name and email');
      return;
    }

    setSubmitting(true);

    try {
      const response = await axios.post(`${API}/guest-access/${token}`, {
        name: formData.name,
        email: formData.email
      });

      console.log('Guest access response:', response.data);
      
      // Store token first
      localStorage.setItem('token', response.data.access_token);
      
      // Call onLogin to update app state
      onLogin(response.data.access_token, response.data.user);
      
      toast.success('Access granted! Welcome to the project.');
      
      // Navigate to projects page
      setTimeout(() => {
        navigate('/projects');
      }, 500);
      
    } catch (error) {
      console.error('Guest access error:', error);
      toast.error(error.response?.data?.detail || 'Failed to access project');
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
        <div className="text-lg text-gray-600 dark:text-gray-400">Loading...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 p-6">
        <Card className="max-w-md w-full">
          <CardHeader className="text-center">
            <div className="mx-auto w-16 h-16 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center mb-4">
              <AlertCircle className="w-8 h-8 text-red-600 dark:text-red-400" />
            </div>
            <CardTitle className="text-2xl font-bold text-gray-900 dark:text-white">Invalid Invite</CardTitle>
          </CardHeader>
          <CardContent className="text-center">
            <p className="text-gray-600 dark:text-gray-400 mb-6">{error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 p-6">
      <Card className="max-w-2xl w-full">
        <CardHeader className="text-center pb-4">
          <div className="mx-auto w-20 h-20 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-center mb-4">
            <Users className="w-10 h-10 text-white" />
          </div>
          <CardTitle className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            You're Invited!
          </CardTitle>
          <p className="text-gray-600 dark:text-gray-400">
            Enter your details to access the project
          </p>
        </CardHeader>
        
        <CardContent className="space-y-6">
          <div className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 rounded-lg p-6 border border-blue-200 dark:border-blue-800">
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
              {projectPreview.project_name}
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
              <span className="font-medium">Client:</span> {projectPreview.client_name}
            </p>
            {projectPreview.description && (
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                {projectPreview.description}
              </p>
            )}
            <div className="inline-block mt-2 px-3 py-1 bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-200 text-xs font-medium rounded-full">
              {projectPreview.status}
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="name">Full Name *</Label>
              <Input
                id="name"
                type="text"
                placeholder="John Doe"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="email">Email Address *</Label>
              <Input
                id="email"
                type="email"
                placeholder="john@example.com"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                required
                className="mt-1"
              />
            </div>

            <Button
              type="submit"
              disabled={submitting}
              className="w-full bg-gradient-to-r from-blue-600 via-purple-600 to-blue-600 text-white text-lg py-6"
            >
              {submitting ? (
                <>
                  <Loader className="w-5 h-5 mr-2 animate-spin" />
                  Getting Access...
                </>
              ) : (
                'Access Project'
              )}
            </Button>
          </form>

          <div className="space-y-3 pt-4 border-t border-gray-200 dark:border-gray-700">
            <h4 className="font-semibold text-gray-900 dark:text-white text-sm">What you can do as a guest:</h4>
            <div className="grid grid-cols-2 gap-2">
              <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
                <CheckCircle className="w-4 h-4 text-green-500" />
                <span>View & manage tasks</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
                <LinkIcon className="w-4 h-4 text-blue-500" />
                <span>Share useful links</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
                <Package className="w-4 h-4 text-purple-500" />
                <span>View deliverables</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
                <MessageSquare className="w-4 h-4 text-indigo-500" />
                <span>Chat with team</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default GuestInvite;
