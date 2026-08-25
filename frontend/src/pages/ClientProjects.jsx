import { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { Briefcase, Calendar, DollarSign, User } from 'lucide-react';
import { Progress } from '../components/ui/progress';
import { toast } from 'sonner';
import { BACKEND_URL, API_URL } from '../config';

const API = API_URL;

const ClientProjects = ({ currentUser }) => {
  const navigate = useNavigate();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (currentUser?.id) {
      fetchGuestProjects();
    }
  }, [currentUser]);

  const fetchGuestProjects = async () => {
    try {
      const token = localStorage.getItem('token');
      console.log('Fetching projects for guest user:', currentUser?.id);
      
      const response = await axios.get(`${API}/projects`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      const projectsData = Array.isArray(response.data) ? response.data : response.data?.data || [];
      console.log('Projects returned for client user:', projectsData);

      // Backend already filters projects for the current user (including guests),
      // so we can use the list as-is for the client portal.
      setProjects(projectsData);
      setLoading(false);
    } catch (error) {
      toast.error('Failed to load projects');
      console.error('Error fetching projects:', error);
      setLoading(false);
    }
  };

  const getStatusColor = (status) => {
    const colors = {
      'Getting Started': 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
      'Onetime Setup': 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
      'Agency Setup': 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200',
      'Service': 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
      'Under Review': 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
      'Completed': 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
    };
    return colors[status] || 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-lg">Loading your projects...</div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-2">My Projects</h1>
        <p className="text-gray-600 dark:text-gray-400">View and manage projects you have access to</p>
      </div>

      {/* Projects Grid */}
      {projects.length === 0 ? (
        <div className="text-center py-16 bg-white/50 dark:bg-gray-800/50 backdrop-blur-lg rounded-lg border border-gray-200 dark:border-gray-700">
          <Briefcase className="w-20 h-20 mx-auto mb-4 text-gray-300 dark:text-gray-600" />
          <h3 className="text-xl font-semibold text-gray-700 dark:text-gray-300 mb-2">No Projects Yet</h3>
          <p className="text-gray-500 dark:text-gray-400">You haven't been invited to any projects yet.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {projects.map((project) => (
            <div
              key={project.id}
              onClick={() => navigate(`/client-portal/projects/${project.id}`)}
              className="group bg-white/70 dark:bg-gray-800/70 backdrop-blur-lg rounded-xl border border-gray-200 dark:border-gray-700 p-6 hover:shadow-2xl hover:scale-105 transition-all cursor-pointer"
            >
              {/* Project Header */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center space-x-3">
                  <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-purple-500 rounded-lg flex items-center justify-center">
                    <Briefcase className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                      {project.name}
                    </h3>
                  </div>
                </div>
                <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(project.status)}`}>
                  {project.status}
                </span>
              </div>

              {/* Project Info */}
              <div className="space-y-3 mb-4">
                <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
                  <User className="w-4 h-4 mr-2" />
                  <span className="font-medium">{project.client_name}</span>
                </div>
                
                {project.budget > 0 && (
                  <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
                    <DollarSign className="w-4 h-4 mr-2" />
                    <span>${project.budget.toLocaleString()}</span>
                  </div>
                )}
                
                {project.end_date && (
                  <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
                    <Calendar className="w-4 h-4 mr-2" />
                    <span>Due: {new Date(project.end_date).toLocaleDateString()}</span>
                  </div>
                )}
              </div>

              {/* Description */}
              {project.description && (
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4 line-clamp-2">
                  {project.description}
                </p>
              )}

              {/* Progress Bar */}
              <div className="mt-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Progress</span>
                  <span className="text-xs font-semibold text-gray-900 dark:text-white">0%</span>
                </div>
                <Progress value={0} className="h-2" />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ClientProjects;
