import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Button } from '../components/ui/button';
import { Progress } from '../components/ui/progress';
import { ArrowLeft, CheckSquare, Link as LinkIcon, Package, MessageSquare, Users } from 'lucide-react';
import { toast } from 'sonner';
import { BACKEND_URL, API_URL } from '../config';

const API = API_URL;

const ClientProjectView = ({ currentUser }) => {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('tasks');

  useEffect(() => {
    if (projectId) {
      fetchProjectData();
    }
  }, [projectId]);

  const fetchProjectData = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/projects/${projectId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      // Verify user is a guest of this project
      if (!response.data.guests || !response.data.guests.includes(currentUser?.id)) {
        toast.error('You do not have access to this project');
        navigate('/client-portal/projects');
        return;
      }
      
      setProject(response.data);
      setLoading(false);
    } catch (error) {
      toast.error('Failed to load project');
      console.error('Error fetching project:', error);
      navigate('/client-portal/projects');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-lg">Loading project...</div>
      </div>
    );
  }

  if (!project) return null;

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="bg-white/50 dark:bg-gray-800/50 backdrop-blur-lg border-b border-gray-200 dark:border-gray-700">
        {/* Back Button */}
        <div className="px-6 pt-4">
          <button
            onClick={() => navigate('/client-portal/projects')}
            className="flex items-center space-x-2 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Projects</span>
          </button>
        </div>

        {/* Project Name and Status */}
        <div className="px-6 py-4">
          <div className="flex items-center justify-between mb-3">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">{project.name}</h1>
            <span className="px-4 py-2 rounded-full text-sm font-medium bg-blue-100 text-blue-800">
              {project.status}
            </span>
          </div>
          
          {/* Project Info */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm mb-4">
            <div>
              <p className="text-gray-500 dark:text-gray-400 mb-1">Client Name</p>
              <p className="font-medium text-gray-900 dark:text-white">{project.client_name || 'N/A'}</p>
            </div>
            <div>
              <p className="text-gray-500 dark:text-gray-400 mb-1">Budget</p>
              <p className="font-medium text-gray-900 dark:text-white">{project.budget ? `$${project.budget}` : 'N/A'}</p>
            </div>
            <div>
              <p className="text-gray-500 dark:text-gray-400 mb-1">Priority</p>
              <p className="font-medium text-gray-900 dark:text-white">{project.priority || 'N/A'}</p>
            </div>
          </div>

          {/* Description */}
          {project.description && (
            <div className="mb-4">
              <p className="text-gray-500 dark:text-gray-400 text-sm mb-1">Description</p>
              <p className="text-gray-700 dark:text-gray-300 text-sm">{project.description}</p>
            </div>
          )}
        </div>

        {/* Progress Bar */}
        <div className="px-6 pb-4">
          <div className="w-full">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Project Progress</p>
              <p className="text-sm font-semibold text-gray-900 dark:text-white">0% Complete</p>
            </div>
            <Progress value={0} className="h-3 w-full" />
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 dark:border-gray-700 bg-white/30 dark:bg-gray-800/30">
        <nav className="flex px-6">
          {[
            { id: 'tasks', label: 'Tasks', icon: CheckSquare },
            { id: 'useful-links', label: 'Useful Links', icon: LinkIcon },
            { id: 'deliverables', label: 'Deliverables', icon: Package },
            { id: 'team-guests', label: 'Team & Guests', icon: Users },
            { id: 'chat', label: 'Chat', icon: MessageSquare }
          ].map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center space-x-2 py-4 px-6 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === tab.id
                    ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400'
                    : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-200'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-auto p-6">
        <div className="text-center py-16 bg-white/30 dark:bg-gray-800/30 backdrop-blur-lg rounded-lg border border-gray-200 dark:border-gray-700">
          <p className="text-lg font-medium text-gray-700 dark:text-gray-300 mb-2">Coming Soon</p>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            This feature will display {activeTab.replace('-', ' ')} content
          </p>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">
            For now, you can view this project in the main Projects section
          </p>
          <Button
            onClick={() => navigate('/projects')}
            className="mt-4 bg-gradient-to-r from-blue-600 via-purple-600 to-blue-600 text-white"
          >
            Go to Full View
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ClientProjectView;
