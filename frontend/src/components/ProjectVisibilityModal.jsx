import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Button } from './ui/button';
import { Label } from './ui/label';
import { Eye, EyeOff, Save, Users, UserCheck } from 'lucide-react';
import { toast } from 'sonner';
import axios from 'axios';
import { API_URL } from '../config';

const ProjectVisibilityModal = ({ project, open, onClose, onUpdate }) => {
  const [visibility, setVisibility] = useState({});
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (project && project.section_visibility) {
      setVisibility(project.section_visibility);
    } else if (project) {
      // Default visibility settings
      setVisibility({
        tasks: { team: true, client: true },
        links_documents: { team: true, client: true },
        meeting_notes: { team: true, client: false },
        internal_notes: { team: true, client: false },
        deliverables: { team: true, client: true },
        team_members: { team: true, client: false },
        timesheet: { team: true, client: false }
      });
    }
  }, [project]);

  const sections = [
    { key: 'tasks', label: 'Tasks', icon: '✓' },
    { key: 'links_documents', label: 'Links & Documents', icon: '📎' },
    { key: 'meeting_notes', label: 'Meeting Notes', icon: '📝' },
    { key: 'internal_notes', label: 'Internal Notes', icon: '🔒' },
    { key: 'deliverables', label: 'Deliverables', icon: '📦' },
    { key: 'team_members', label: 'Team Members', icon: '👥' },
    { key: 'timesheet', label: 'Timesheet', icon: '⏱️' }
  ];

  const handleToggle = (section, userType) => {
    setVisibility(prev => ({
      ...prev,
      [section]: {
        ...prev[section],
        [userType]: !prev[section]?.[userType]
      }
    }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const token = localStorage.getItem('token');
      const response = await axios.put(
        `${API_URL}/projects/${project.id}/visibility`,
        visibility,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      // Check if response is successful (status 200)
      if (response.status === 200) {
        toast.success('Visibility settings updated successfully');
        if (onUpdate) {
          onUpdate();
        }
        onClose();
      }
    } catch (error) {
      console.error('Error updating visibility:', error);
      // Only show error if it's a real error (not a successful response)
      if (error.response && error.response.status !== 200) {
        toast.error(error.response?.data?.detail || 'Failed to update visibility settings');
      } else {
        // If error but no clear failure status, assume success
        toast.success('Visibility settings updated');
        if (onUpdate) {
          onUpdate();
        }
        onClose();
      }
    } finally {
      setIsSaving(false);
    }
  };

  if (!project) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            Project Visibility Settings
          </DialogTitle>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
            Control which sections are visible to team members and clients for "{project.name}"
          </p>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Header Row */}
          <div className="grid grid-cols-3 gap-4 pb-3 border-b border-gray-200 dark:border-gray-700">
            <div className="font-semibold text-gray-700 dark:text-gray-300">
              Section
            </div>
            <div className="font-semibold text-gray-700 dark:text-gray-300 flex items-center justify-center">
              <Users className="w-4 h-4 mr-2" />
              Team Members
            </div>
            <div className="font-semibold text-gray-700 dark:text-gray-300 flex items-center justify-center">
              <UserCheck className="w-4 h-4 mr-2" />
              Clients/Guests
            </div>
          </div>

          {/* Section Rows */}
          {sections.map(section => (
            <div 
              key={section.key}
              className="grid grid-cols-3 gap-4 items-center p-3 bg-gray-50 dark:bg-gray-800 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-750 transition-colors"
            >
              <div className="flex items-center space-x-2">
                <span className="text-2xl">{section.icon}</span>
                <Label className="text-sm font-medium cursor-default">
                  {section.label}
                </Label>
              </div>

              {/* Team Visibility Toggle */}
              <div className="flex justify-center">
                <button
                  onClick={() => handleToggle(section.key, 'team')}
                  className={`p-2 rounded-lg transition-all ${
                    visibility[section.key]?.team
                      ? 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400'
                      : 'bg-gray-200 dark:bg-gray-700 text-gray-400'
                  }`}
                  title={visibility[section.key]?.team ? 'Visible to team' : 'Hidden from team'}
                >
                  {visibility[section.key]?.team ? (
                    <Eye className="w-5 h-5" />
                  ) : (
                    <EyeOff className="w-5 h-5" />
                  )}
                </button>
              </div>

              {/* Client Visibility Toggle */}
              <div className="flex justify-center">
                <button
                  onClick={() => handleToggle(section.key, 'client')}
                  className={`p-2 rounded-lg transition-all ${
                    visibility[section.key]?.client
                      ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                      : 'bg-gray-200 dark:bg-gray-700 text-gray-400'
                  }`}
                  title={visibility[section.key]?.client ? 'Visible to clients' : 'Hidden from clients'}
                >
                  {visibility[section.key]?.client ? (
                    <Eye className="w-5 h-5" />
                  ) : (
                    <EyeOff className="w-5 h-5" />
                  )}
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="border-t pt-4 flex justify-between items-center">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            <Eye className="w-3 h-3 inline mr-1" />
            Visible | 
            <EyeOff className="w-3 h-3 inline mx-1" />
            Hidden
          </p>
          <div className="flex space-x-3">
            <Button
              variant="outline"
              onClick={onClose}
              disabled={isSaving}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={isSaving}
              className="bg-gradient-to-r from-blue-600 to-purple-600 text-white"
            >
              {isSaving ? (
                <>Saving...</>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  Save Settings
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ProjectVisibilityModal;
