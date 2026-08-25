import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { Upload, User as UserIcon, Lock, Globe, Building, Zap, Check, X, ExternalLink, Copy, Monitor, Clock, Eye, Coffee, Plus, Trash2, Settings as SettingsIcon } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Switch } from '../components/ui/switch';
import { Slider } from '../components/ui/slider';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '../components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import { BACKEND_URL, API_URL } from '../config';

const API = API_URL;

const Settings = ({ currentUser }) => {
  const [activeTab, setActiveTab] = useState('profile');
  const [uploading, setUploading] = useState(false);
  
  // Profile Settings State
  const [name, setName] = useState(currentUser?.name || '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  // Business Settings State
  const [businessSettings, setBusinessSettings] = useState({
    company_name: '',
    company_email: '',
    company_phone: '',
    company_address: '',
    company_logo_url: null
  });
  
  // Integrations State
  const [integrations, setIntegrations] = useState([]);
  const [showJibbleDialog, setShowJibbleDialog] = useState(false);
  const [showGHLDialog, setShowGHLDialog] = useState(false);
  const [jibbleForm, setJibbleForm] = useState({ client_id: '', secret_key: '' });
  const [ghlForm, setGhlForm] = useState({ api_key: '', location_id: '', pipeline_id: '', stage_id: '' });
  const [ghlStep, setGhlStep] = useState(1); // 1: credentials, 2: pipeline/stage selection
  const [ghlConnectionTested, setGhlConnectionTested] = useState(false);
  const [ghlLocationName, setGhlLocationName] = useState('');
  const [ghlPipelines, setGhlPipelines] = useState([]);
  const [ghlSelectedPipeline, setGhlSelectedPipeline] = useState(null);
  const [ghlStages, setGhlStages] = useState([]);
  
  // Time Sheet Settings State
  const [timeSheetSettings, setTimeSheetSettings] = useState({
    screen_capture_required: true,
    screenshot_interval_minutes: 5,
    blur_screenshots: false
  });
  const [breaks, setBreaks] = useState([]);
  const [showBreakDialog, setShowBreakDialog] = useState(false);
  const [breakForm, setBreakForm] = useState({
    name: '',
    duration_minutes: 15
  });
  
  // Roles & Permissions State
  const [roleConfigs, setRoleConfigs] = useState({});
  const [selectedRole, setSelectedRole] = useState('manager');
  const [loadingRoleConfigs, setLoadingRoleConfigs] = useState(false);

  useEffect(() => {
    if (activeTab === 'business') {
      fetchBusinessSettings();
    } else if (activeTab === 'integrations') {
      fetchIntegrations();
    } else if (activeTab === 'timesheet') {
      fetchTimeSheetSettings();
      fetchBreaks();
    } else if (activeTab === 'roles') {
      fetchRoleConfigs();
    }
  }, [activeTab]);

  const getInitials = (name) => {
    if (!name) return 'U';
    return name
      .split(' ')
      .map(word => word[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const fetchBusinessSettings = async () => {
    try {
      const response = await axios.get(`${API}/business-settings`);
      setBusinessSettings(response.data);
    } catch (error) {
      console.error('Error fetching business settings:', error);
    }
  };

  const fetchIntegrations = async () => {
    try {
      const response = await axios.get(`${API}/integrations/status`);
      setIntegrations(response.data);
    } catch (error) {
      console.error('Error fetching integrations:', error);
    }
  };

  const fetchTimeSheetSettings = async () => {
    try {
      const response = await axios.get(`${API}/time-tracker/settings`);
      setTimeSheetSettings(response.data);
    } catch (error) {
      console.error('Error fetching time sheet settings:', error);
      toast.error('Failed to load time sheet settings');
    }
  };

  const fetchBreaks = async () => {
    try {
      const response = await axios.get(`${API}/breaks`);
      setBreaks(response.data);
    } catch (error) {
      console.error('Error fetching breaks:', error);
      toast.error('Failed to load breaks');
    }
  };

  const handleSaveTimeSheetSettings = async () => {
    try {
      await axios.put(`${API}/time-tracker/settings`, timeSheetSettings);
      toast.success('Time sheet settings updated successfully');
    } catch (error) {
      console.error('Error saving settings:', error);
      toast.error('Failed to save settings');
    }
  };

  const handleAddBreak = async () => {
    if (!breakForm.name.trim()) {
      toast.error('Please enter a break name');
      return;
    }

    if (breakForm.duration_minutes <= 0) {
      toast.error('Duration must be greater than 0');
      return;
    }

    try {
      await axios.post(`${API}/breaks`, breakForm);
      toast.success('Break added successfully');
      setShowBreakDialog(false);
      setBreakForm({ name: '', duration_minutes: 15 });
      fetchBreaks();
    } catch (error) {
      console.error('Error adding break:', error);
      toast.error('Failed to add break');
    }
  };

  const handleDeleteBreak = async (breakId, breakName) => {
    if (!window.confirm(`Are you sure you want to delete "${breakName}"?`)) return;

    try {
      await axios.delete(`${API}/breaks/${breakId}`);
      toast.success('Break deleted successfully');
      fetchBreaks();
    } catch (error) {
      console.error('Error deleting break:', error);
      toast.error('Failed to delete break');
    }
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image size should be less than 5MB');
      return;
    }

    setUploading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await axios.post(`${API}/upload-profile-image`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      toast.success('Profile picture uploaded successfully');
      setTimeout(() => window.location.reload(), 1000);
    } catch (error) {
      toast.error('Failed to upload profile picture');
      console.error('Upload error:', error);
    } finally {
      setUploading(false);
    }
  };

  const handleUpdateProfile = async () => {
    if (!name.trim()) {
      toast.error('Name cannot be empty');
      return;
    }

    try {
      await axios.put(`${API}/users/me`, { name });
      toast.success('Profile updated successfully');
      setTimeout(() => window.location.reload(), 1000);
    } catch (error) {
      toast.error('Failed to update profile');
      console.error('Update error:', error);
    }
  };

  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      toast.error('Please fill in all password fields');
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error('New passwords do not match');
      return;
    }

    if (newPassword.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }

    try {
      await axios.put(`${API}/users/me/password`, {
        current_password: currentPassword,
        new_password: newPassword,
      });
      toast.success('Password changed successfully');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to change password');
      console.error('Password change error:', error);
    }
  };

  const handleUpdateBusinessSettings = async () => {
    if (currentUser?.role !== 'admin') {
      toast.error('Only admins can update business settings');
      return;
    }

    try {
      await axios.put(`${API}/business-settings`, businessSettings);
      toast.success('Business settings updated successfully');
    } catch (error) {
      toast.error('Failed to update business settings');
      console.error('Update error:', error);
    }
  };

  const handleConnectJibble = async () => {
    if (!jibbleForm.client_id || !jibbleForm.secret_key) {
      toast.error('Please enter both Client ID and Secret Key');
      return;
    }

    try {
      await axios.post(`${API}/integrations/jibble/connect`, jibbleForm);
      toast.success('Jibble connected successfully!');
      setShowJibbleDialog(false);
      setJibbleForm({ client_id: '', secret_key: '' });
      fetchIntegrations();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to connect Jibble');
      console.error('Jibble connection error:', error);
    }
  };

  const handleConnectGHL = async () => {
    try {
      // Simple activation - just generate webhook URL
      await axios.post(`${API}/integrations/ghl/connect`, {
        api_key: 'webhook-only',  // Placeholder
        location_id: 'webhook-only',  // Placeholder
        pipeline_id: 'webhook-only',
        stage_id: 'webhook-only',
        current_origin: window.location.origin  // Send current domain for webhook URL generation
      });
      toast.success('GoHighLevel integration activated!');
      setShowGHLDialog(false);
      resetGHLDialog();
      fetchIntegrations();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to activate GoHighLevel');
      console.error('GHL activation error:', error);
    }
  };

  const handleTestGHLConnection = async () => {
    if (!ghlForm.api_key || !ghlForm.location_id) {
      toast.error('Please enter API Key and Location ID');
      return;
    }

    try {
      const response = await axios.post(`${API}/integrations/ghl/test-connection`, {
        api_key: ghlForm.api_key,
        location_id: ghlForm.location_id
      });

      if (response.data.success) {
        toast.success('Connection successful!');
        setGhlConnectionTested(true);
        setGhlLocationName(response.data.location_name);
        
        // Fetch pipelines
        await fetchGHLPipelines();
        setGhlStep(2);
      }
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to test connection');
      console.error('GHL test error:', error);
    }
  };

  const fetchGHLPipelines = async () => {
    try {
      const response = await axios.post(`${API}/integrations/ghl/fetch-pipelines`, {
        api_key: ghlForm.api_key,
        location_id: ghlForm.location_id
      });

      if (response.data.success) {
        setGhlPipelines(response.data.pipelines);
      }
    } catch (error) {
      toast.error('Failed to fetch pipelines');
      console.error('Pipeline fetch error:', error);
    }
  };

  const handlePipelineSelect = (pipelineId) => {
    const pipeline = ghlPipelines.find(p => p.id === pipelineId);
    setGhlSelectedPipeline(pipeline);
    setGhlStages(pipeline?.stages || []);
    setGhlForm({ ...ghlForm, pipeline_id: pipelineId, stage_id: '' });
  };

  const handleStageSelect = (stageId) => {
    setGhlForm({ ...ghlForm, stage_id: stageId });
  };

  const resetGHLDialog = () => {
    setGhlForm({ api_key: '', location_id: '', pipeline_id: '', stage_id: '' });
    setGhlStep(1);
    setGhlConnectionTested(false);
    setGhlLocationName('');
    setGhlPipelines([]);
    setGhlSelectedPipeline(null);
    setGhlStages([]);
  };

  const handleDisconnect = async (integrationName) => {
    if (!window.confirm(`Are you sure you want to disconnect ${integrationName}?`)) return;

    try {
      await axios.delete(`${API}/integrations/${integrationName}/disconnect`);
      toast.success(`${integrationName} disconnected successfully`);
      fetchIntegrations();
    } catch (error) {
      toast.error('Failed to disconnect integration');
      console.error('Disconnect error:', error);
    }
  };

  const handleUpdateGHLWebhook = async () => {
    if (!ghlForm.api_key || ghlForm.api_key === 'webhook-only') {
      toast.error('Please enter a valid GHL webhook URL');
      return;
    }

    try {
      await axios.post(`${API}/integrations/ghl/connect`, {
        api_key: ghlForm.api_key,
        location_id: 'webhook-only',
        pipeline_id: 'webhook-only',
        stage_id: 'webhook-only',
        current_origin: window.location.origin  // Send current domain for webhook URL generation
      });
      toast.success('GHL outgoing webhook URL updated successfully!');
      fetchIntegrations();
    } catch (error) {
      toast.error('Failed to update webhook URL');
      console.error('Update error:', error);
    }
  };

  const copyWebhookURL = async (url) => {
    try {
      await navigator.clipboard.writeText(url);
      toast.success('Webhook URL copied to clipboard!');
    } catch (err) {
      // Fallback for browsers that block clipboard API
      const textArea = document.createElement('textarea');
      textArea.value = url;
      textArea.style.position = 'fixed';
      textArea.style.left = '-999999px';
      document.body.appendChild(textArea);
      textArea.select();
      
      try {
        document.execCommand('copy');
        toast.success('Webhook URL copied to clipboard!');
      } catch (execErr) {
        toast.error('Failed to copy. Please copy manually.');
      }
      
      document.body.removeChild(textArea);
    }
  };

  const fetchRoleConfigs = async () => {
    setLoadingRoleConfigs(true);
    try {
      const response = await axios.get(`${API}/roles/config`);
      console.log('Role configs fetched:', response.data);
      setRoleConfigs(response.data);
    } catch (error) {
      toast.error('Failed to load role configurations');
      console.error('Fetch role configs error:', error);
    } finally {
      setLoadingRoleConfigs(false);
    }
  };

  const handleUpdateRoleConfig = async (role) => {
    if (currentUser?.role !== 'admin') {
      toast.error('Only admins can update role configurations');
      return;
    }

    try {
      await axios.put(`${API}/roles/config`, {
        role: role,
        permissions: roleConfigs[role]
      });
      toast.success(`${role.charAt(0).toUpperCase() + role.slice(1)} role permissions updated successfully`);
    } catch (error) {
      toast.error('Failed to update role configuration');
      console.error('Update error:', error);
    }
  };

  const handlePermissionToggle = (role, permission) => {
    setRoleConfigs({
      ...roleConfigs,
      [role]: {
        ...roleConfigs[role],
        [permission]: !roleConfigs[role][permission]
      }
    });
  };

  const getTimezone = () => {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  };

  const getIntegrationStatus = (name) => {
    return integrations.find(i => i.name === name) || { is_connected: false };
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-800 dark:text-white mb-2">
          Settings
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Manage your account, business, and integrations
        </p>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className={`grid w-full mb-6 ${currentUser?.role === 'admin' ? 'grid-cols-5' : 'grid-cols-3'}`}>
          <TabsTrigger value="profile">Profile Settings</TabsTrigger>
          <TabsTrigger value="business">Business Settings</TabsTrigger>
          <TabsTrigger value="integrations">Integrations</TabsTrigger>
          {currentUser?.role === 'admin' && (
            <>
              <TabsTrigger value="timesheet">Time Sheet Settings</TabsTrigger>
              <TabsTrigger value="roles">Roles & Permissions</TabsTrigger>
            </>
          )}
        </TabsList>

        {/* Profile Settings Tab */}
        <TabsContent value="profile" className="space-y-6">
          {/* Profile Picture */}
          <Card className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-xl border-gray-200 dark:border-gray-700">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <UserIcon className="w-5 h-5" />
                <span>Profile Picture</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center space-x-6">
                {currentUser?.profile_image_url ? (
                  <img
                    src={currentUser.profile_image_url}
                    alt={currentUser.name}
                    className="w-24 h-24 rounded-full object-cover"
                  />
                ) : (
                  <div className="w-24 h-24 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-semibold text-2xl">
                    {getInitials(currentUser?.name)}
                  </div>
                )}
                <div className="flex-1">
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                    Upload a profile picture to personalize your account
                  </p>
                  <label htmlFor="profile-upload">
                    <Button
                      disabled={uploading}
                      className="cursor-pointer"
                      onClick={() => document.getElementById('profile-upload').click()}
                    >
                      <Upload className="w-4 h-4 mr-2" />
                      {uploading ? 'Uploading...' : 'Upload Image'}
                    </Button>
                  </label>
                  <input
                    id="profile-upload"
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="hidden"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Profile Information */}
          <Card className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-xl border-gray-200 dark:border-gray-700">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <UserIcon className="w-5 h-5" />
                <span>Profile Information</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Name</Label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your name"
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Email</Label>
                <Input
                  value={currentUser?.email || ''}
                  disabled
                  className="mt-1 bg-gray-100 dark:bg-gray-900"
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Email cannot be changed
                </p>
              </div>
              <div>
                <Label>Role</Label>
                <Input
                  value={currentUser?.role === 'admin' ? 'Administrator' : 'Team Member'}
                  disabled
                  className="mt-1 bg-gray-100 dark:bg-gray-900"
                />
              </div>
              <Button onClick={handleUpdateProfile} className="bg-blue-600 hover:bg-blue-700 text-white">
                Save Changes
              </Button>
            </CardContent>
          </Card>

          {/* Timezone */}
          <Card className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-xl border-gray-200 dark:border-gray-700">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Globe className="w-5 h-5" />
                <span>Timezone</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div>
                <Label>Current Timezone</Label>
                <Input
                  value={getTimezone()}
                  disabled
                  className="mt-1 bg-gray-100 dark:bg-gray-900"
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Automatically detected from your browser
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Change Password */}
          <Card className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-xl border-gray-200 dark:border-gray-700">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Lock className="w-5 h-5" />
                <span>Change Password</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Current Password</Label>
                <Input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Enter current password"
                  className="mt-1"
                />
              </div>
              <div>
                <Label>New Password</Label>
                <Input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Enter new password"
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Confirm New Password</Label>
                <Input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm new password"
                  className="mt-1"
                />
              </div>
              <Button onClick={handleChangePassword} className="bg-blue-600 hover:bg-blue-700 text-white">
                Change Password
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Business Settings Tab */}
        <TabsContent value="business" className="space-y-6">
          <Card className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-xl border-gray-200 dark:border-gray-700">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Building className="w-5 h-5" />
                <span>Company Information</span>
              </CardTitle>
              <CardDescription>
                {currentUser?.role === 'admin' 
                  ? 'Update your company details (Admin only)'
                  : 'View company details (Read-only for team members)'}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Company Name</Label>
                <Input
                  value={businessSettings.company_name}
                  onChange={(e) => setBusinessSettings({ ...businessSettings, company_name: e.target.value })}
                  placeholder="Your company name"
                  disabled={currentUser?.role !== 'admin'}
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Company Email</Label>
                <Input
                  type="email"
                  value={businessSettings.company_email || ''}
                  onChange={(e) => setBusinessSettings({ ...businessSettings, company_email: e.target.value })}
                  placeholder="contact@company.com"
                  disabled={currentUser?.role !== 'admin'}
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Company Phone</Label>
                <Input
                  value={businessSettings.company_phone || ''}
                  onChange={(e) => setBusinessSettings({ ...businessSettings, company_phone: e.target.value })}
                  placeholder="+1 (555) 000-0000"
                  disabled={currentUser?.role !== 'admin'}
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Company Address</Label>
                <Input
                  value={businessSettings.company_address || ''}
                  onChange={(e) => setBusinessSettings({ ...businessSettings, company_address: e.target.value })}
                  placeholder="123 Business St, City, State ZIP"
                  disabled={currentUser?.role !== 'admin'}
                  className="mt-1"
                />
              </div>
              {currentUser?.role === 'admin' && (
                <Button onClick={handleUpdateBusinessSettings} className="bg-blue-600 hover:bg-blue-700 text-white">
                  Save Business Settings
                </Button>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Integrations Tab */}
        <TabsContent value="integrations" className="space-y-6">
          {currentUser?.role !== 'admin' && (
            <Card className="bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800">
              <CardContent className="pt-6">
                <p className="text-yellow-800 dark:text-yellow-200">
                  ⚠️ Only administrators can manage integrations
                </p>
              </CardContent>
            </Card>
          )}

          {/* Jibble Integration */}
          <Card className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-xl border-gray-200 dark:border-gray-700">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white font-bold">
                    J
                  </div>
                  <div>
                    <CardTitle>Jibble Time Tracking</CardTitle>
                    <CardDescription>
                      {getIntegrationStatus('jibble').is_connected 
                        ? '✅ Connected - Syncing team activity'
                        : 'Connect your Jibble account to sync team members and activity'}
                    </CardDescription>
                  </div>
                </div>
                {getIntegrationStatus('jibble').is_connected ? (
                  <div className="flex items-center space-x-2">
                    <Check className="w-5 h-5 text-green-500" />
                    {getIntegrationStatus('jibble').connected_via === 'environment' && (
                      <span className="text-xs text-gray-500 dark:text-gray-400 mr-2">
                        (via .env)
                      </span>
                    )}
                    {currentUser?.role === 'admin' && getIntegrationStatus('jibble').connected_via !== 'environment' && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDisconnect('jibble')}
                      >
                        Disconnect
                      </Button>
                    )}
                  </div>
                ) : (
                  currentUser?.role === 'admin' && (
                    <Button onClick={() => setShowJibbleDialog(true)}>
                      <Zap className="w-4 h-4 mr-2" />
                      Connect Jibble
                    </Button>
                  )
                )}
              </div>
            </CardHeader>
          </Card>

          {/* GoHighLevel Integration */}
          <Card className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-xl border-gray-200 dark:border-gray-700">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-green-500 to-green-600 flex items-center justify-center text-white font-bold">
                    GHL
                  </div>
                  <div>
                    <CardTitle>GoHighLevel CRM</CardTitle>
                    <CardDescription>
                      Simple webhook integration - no API key needed!
                    </CardDescription>
                  </div>
                </div>
                {getIntegrationStatus('gohighlevel').is_connected ? (
                  <div className="flex items-center space-x-2">
                    <Check className="w-5 h-5 text-green-500" />
                    {currentUser?.role === 'admin' && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDisconnect('gohighlevel')}
                      >
                        Disconnect
                      </Button>
                    )}
                  </div>
                ) : (
                  currentUser?.role === 'admin' && (
                    <Button onClick={() => setShowGHLDialog(true)}>
                      <Zap className="w-4 h-4 mr-2" />
                      Setup GoHighLevel
                    </Button>
                  )
                )}
              </div>
            </CardHeader>
            {getIntegrationStatus('gohighlevel').is_connected && (
              <CardContent className="space-y-4">
                <div className="bg-gray-100 dark:bg-gray-900 p-4 rounded-lg">
                  <Label className="text-sm font-medium mb-2 block">📥 Incoming Webhook (GHL → Millii)</Label>
                  <p className="text-xs text-gray-600 dark:text-gray-400 mb-2">
                    Paste this URL in your GHL workflow to send opportunity data
                  </p>
                  <div className="flex items-center space-x-2">
                    <code className="flex-1 text-xs bg-white dark:bg-gray-800 p-2 rounded border">
                      {getIntegrationStatus('gohighlevel').webhook_url}
                    </code>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => copyWebhookURL(getIntegrationStatus('gohighlevel').webhook_url)}
                    >
                      <Copy className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
                
                {currentUser?.role === 'admin' && (
                  <div className="bg-gray-100 dark:bg-gray-900 p-4 rounded-lg">
                    <Label className="text-sm font-medium mb-2 block">📤 Outgoing Webhook (Millii → GHL)</Label>
                    <p className="text-xs text-gray-600 dark:text-gray-400 mb-2">
                      Enter your GHL webhook URL to enable "Sync with GHL" button
                    </p>
                    <div className="flex items-center space-x-2">
                      <Input
                        value={ghlForm.api_key !== 'webhook-only' && ghlForm.api_key ? ghlForm.api_key : ''}
                        onChange={(e) => setGhlForm({ ...ghlForm, api_key: e.target.value || 'webhook-only' })}
                        placeholder="https://services.leadconnectorhq.com/hooks/..."
                        className="flex-1"
                      />
                      <Button
                        size="sm"
                        onClick={handleUpdateGHLWebhook}
                        className="bg-green-600 hover:bg-green-700 text-white"
                      >
                        Update
                      </Button>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                      Get this from GHL: Settings → Webhooks → Create Incoming Webhook
                    </p>
                  </div>
                )}
              </CardContent>
            )}
          </Card>
        </TabsContent>

        {/* Time Sheet Settings Tab */}
        {currentUser?.role === 'admin' && (
          <TabsContent value="timesheet" className="space-y-6">
            {/* Screen Capture Settings */}
            <Card className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-xl border-gray-200 dark:border-gray-700">
              <CardHeader>
                <CardTitle className="flex items-center space-x-2 text-gray-800 dark:text-white">
                  <Monitor className="w-5 h-5" />
                  <span>Screen Capture Settings</span>
                </CardTitle>
                <CardDescription>
                  Control how screen monitoring works for team members
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Screen Capture Required */}
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <Label className="text-base font-medium text-gray-800 dark:text-white">
                      Require Screen Capture
                    </Label>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Team members must enable screen capture to track time
                    </p>
                  </div>
                  <Switch
                    checked={timeSheetSettings.screen_capture_required}
                    onCheckedChange={(checked) => 
                      setTimeSheetSettings({ ...timeSheetSettings, screen_capture_required: checked })
                    }
                  />
                </div>

                {/* Screenshot Interval */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-base font-medium text-gray-800 dark:text-white">
                      Screenshot Interval
                    </Label>
                    <span className="text-sm font-semibold text-blue-600 dark:text-blue-400">
                      {timeSheetSettings.screenshot_interval_minutes} minutes
                    </span>
                  </div>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">
                    How often to capture screenshots (2-60 minutes)
                  </p>
                  <Slider
                    value={[timeSheetSettings.screenshot_interval_minutes]}
                    onValueChange={([value]) => 
                      setTimeSheetSettings({ ...timeSheetSettings, screenshot_interval_minutes: value })
                    }
                    min={2}
                    max={60}
                    step={1}
                    className="w-full"
                  />
                  <div className="flex justify-between text-xs text-gray-400 dark:text-gray-500">
                    <span>2 min</span>
                    <span>30 min</span>
                    <span>60 min</span>
                  </div>
                </div>

                {/* Blur Screenshots */}
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <Label className="text-base font-medium text-gray-800 dark:text-white">
                      Blur Screenshots
                    </Label>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Apply blur effect to screenshots for privacy
                    </p>
                  </div>
                  <Switch
                    checked={timeSheetSettings.blur_screenshots}
                    onCheckedChange={(checked) => 
                      setTimeSheetSettings({ ...timeSheetSettings, blur_screenshots: checked })
                    }
                  />
                </div>

                {/* Save Button */}
                <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                  <Button 
                    onClick={handleSaveTimeSheetSettings}
                    className="bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    <SettingsIcon className="w-4 h-4 mr-2" />
                    Save Screen Capture Settings
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Break Management */}
            <Card className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-xl border-gray-200 dark:border-gray-700">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center space-x-2 text-gray-800 dark:text-white">
                      <Coffee className="w-5 h-5" />
                      <span>Break Types</span>
                    </CardTitle>
                    <CardDescription>
                      Manage break options available to team members
                    </CardDescription>
                  </div>
                  <Button 
                    onClick={() => setShowBreakDialog(true)}
                    className="bg-green-600 hover:bg-green-700 text-white"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Add Break Type
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {breaks.length === 0 ? (
                  <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                    <Coffee className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p>No break types configured</p>
                    <p className="text-sm mt-1">Add break types for your team to use</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {breaks.map((breakItem) => (
                      <div
                        key={breakItem.id}
                        className="flex items-center justify-between p-4 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                      >
                        <div className="flex items-center space-x-3">
                          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-green-500 to-teal-600 flex items-center justify-center text-white">
                            <Coffee className="w-5 h-5" />
                          </div>
                          <div>
                            <p className="font-medium text-gray-800 dark:text-white">
                              {breakItem.name}
                            </p>
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                              <Clock className="w-3 h-3 inline mr-1" />
                              {breakItem.duration_minutes} minutes
                            </p>
                          </div>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDeleteBreak(breakItem.id, breakItem.name)}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Info Card */}
            <Card className="bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
              <CardContent className="pt-6">
                <div className="flex items-start space-x-3">
                  <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Eye className="w-4 h-4 text-white" />
                  </div>
                  <div className="space-y-2">
                    <p className="text-sm text-blue-800 dark:text-blue-200 font-medium">
                      How it works
                    </p>
                    <ul className="text-sm text-blue-700 dark:text-blue-300 space-y-1 list-disc list-inside">
                      <li>Screen capture settings apply to all team members using the time tracker</li>
                      <li>Screenshots are captured automatically at the specified interval</li>
                      <li>Blur option adds privacy protection while maintaining accountability</li>
                      <li>Break types can be selected when taking a break to track break time separately</li>
                      <li>If screen capture is required, team members cannot start tracking without full screen access</li>
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {/* Roles & Permissions Tab */}
        {currentUser?.role === 'admin' && (
          <TabsContent value="roles" className="space-y-6">
            <Card className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-xl border-gray-200 dark:border-gray-700">
              <CardHeader>
                <CardTitle className="flex items-center space-x-2 text-gray-800 dark:text-white">
                  <SettingsIcon className="w-5 h-5" />
                  <span>Roles & Permissions Configuration</span>
                </CardTitle>
                <CardDescription className="text-gray-600 dark:text-gray-400">
                  Configure what each role can access and do in the workspace
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Role Selector */}
                <div>
                  <Label className="text-gray-700 dark:text-gray-300 mb-2">Select Role to Configure</Label>
                  <Select value={selectedRole} onValueChange={setSelectedRole}>
                    <SelectTrigger className="w-full bg-white dark:bg-gray-800">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="admin">Admin (All Permissions)</SelectItem>
                      <SelectItem value="manager">Manager</SelectItem>
                      <SelectItem value="user">Team Member</SelectItem>
                      <SelectItem value="client">Client/Guest</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Permission Toggles */}
                {loadingRoleConfigs ? (
                  <div className="text-center py-8 text-gray-500">Loading permissions...</div>
                ) : (selectedRole && roleConfigs[selectedRole]) ? (
                  <div className="space-y-4 border-t border-gray-200 dark:border-gray-700 pt-6">
                    <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide">
                      {selectedRole.charAt(0).toUpperCase() + selectedRole.slice(1)} Permissions
                    </h3>
                    
                    {selectedRole === 'admin' ? (
                      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                        <p className="text-sm text-blue-800 dark:text-blue-200">
                          ℹ️ Admin role has all permissions enabled by default and cannot be modified.
                        </p>
                      </div>
                    ) : (
                      <>
                        {/* Tab Visibility Permissions */}
                        <div className="space-y-3">
                          <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg">
                            <div>
                              <p className="text-sm font-medium text-gray-800 dark:text-white">View Team Tab</p>
                              <p className="text-xs text-gray-500 dark:text-gray-400">Access to team members list and stats</p>
                            </div>
                            <Switch
                              checked={roleConfigs[selectedRole]?.can_view_team_tab || false}
                              onCheckedChange={() => handlePermissionToggle(selectedRole, 'can_view_team_tab')}
                            />
                          </div>

                          <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg">
                            <div>
                              <p className="text-sm font-medium text-gray-800 dark:text-white">View Time Sheet Tab</p>
                              <p className="text-xs text-gray-500 dark:text-gray-400">Access to time tracking and timesheets</p>
                            </div>
                            <Switch
                              checked={roleConfigs[selectedRole]?.can_view_time_sheet_tab || false}
                              onCheckedChange={() => handlePermissionToggle(selectedRole, 'can_view_time_sheet_tab')}
                            />
                          </div>

                          <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg">
                            <div>
                              <p className="text-sm font-medium text-gray-800 dark:text-white">View Reports Tab</p>
                              <p className="text-xs text-gray-500 dark:text-gray-400">Access to analytics and reports</p>
                            </div>
                            <Switch
                              checked={roleConfigs[selectedRole]?.can_view_reports_tab || false}
                              onCheckedChange={() => handlePermissionToggle(selectedRole, 'can_view_reports_tab')}
                            />
                          </div>
                        </div>

                        {/* Feature Permissions */}
                        <div className="space-y-3 border-t border-gray-200 dark:border-gray-700 pt-4">
                          <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg">
                            <div>
                              <p className="text-sm font-medium text-gray-800 dark:text-white">Complete Project Tasks</p>
                              <p className="text-xs text-gray-500 dark:text-gray-400">Mark tasks as completed</p>
                            </div>
                            <Switch
                              checked={roleConfigs[selectedRole]?.can_complete_project_tasks || false}
                              onCheckedChange={() => handlePermissionToggle(selectedRole, 'can_complete_project_tasks')}
                            />
                          </div>

                          <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg">
                            <div>
                              <p className="text-sm font-medium text-gray-800 dark:text-white">Edit Workspace Settings</p>
                              <p className="text-xs text-gray-500 dark:text-gray-400">Modify workspace configuration</p>
                            </div>
                            <Switch
                              checked={roleConfigs[selectedRole]?.can_edit_workspace_settings || false}
                              onCheckedChange={() => handlePermissionToggle(selectedRole, 'can_edit_workspace_settings')}
                            />
                          </div>

                          <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg">
                            <div>
                              <p className="text-sm font-medium text-gray-800 dark:text-white">Create Recurring Tasks</p>
                              <p className="text-xs text-gray-500 dark:text-gray-400">Set up automated recurring tasks</p>
                            </div>
                            <Switch
                              checked={roleConfigs[selectedRole]?.can_create_recurring_tasks || false}
                              onCheckedChange={() => handlePermissionToggle(selectedRole, 'can_create_recurring_tasks')}
                            />
                          </div>

                          <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg">
                            <div>
                              <p className="text-sm font-medium text-gray-800 dark:text-white">Create New Projects</p>
                              <p className="text-xs text-gray-500 dark:text-gray-400">Start new projects in workspace</p>
                            </div>
                            <Switch
                              checked={roleConfigs[selectedRole]?.can_create_new_projects || false}
                              onCheckedChange={() => handlePermissionToggle(selectedRole, 'can_create_new_projects')}
                            />
                          </div>

                          <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg">
                            <div>
                              <p className="text-sm font-medium text-gray-800 dark:text-white">Chat with Millii (AI Assistant)</p>
                              <p className="text-xs text-gray-500 dark:text-gray-400">Access to AI-powered assistance</p>
                            </div>
                            <Switch
                              checked={roleConfigs[selectedRole]?.can_chat_with_millii || false}
                              onCheckedChange={() => handlePermissionToggle(selectedRole, 'can_chat_with_millii')}
                            />
                          </div>

                          <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg">
                            <div>
                              <p className="text-sm font-medium text-gray-800 dark:text-white">Direct Chat with Team</p>
                              <p className="text-xs text-gray-500 dark:text-gray-400">Send direct messages to team members</p>
                            </div>
                            <Switch
                              checked={roleConfigs[selectedRole]?.can_have_direct_chat || false}
                              onCheckedChange={() => handlePermissionToggle(selectedRole, 'can_have_direct_chat')}
                            />
                          </div>
                        </div>

                        {/* Save Button */}
                        <div className="flex justify-end pt-4">
                          <Button 
                            onClick={() => handleUpdateRoleConfig(selectedRole)}
                            className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
                          >
                            <Check className="w-4 h-4 mr-2" />
                            Save {selectedRole.charAt(0).toUpperCase() + selectedRole.slice(1)} Permissions
                          </Button>
                        </div>
                      </>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    Please select a role to configure
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Info Card */}
            <Card className="bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800">
              <CardContent className="pt-6">
                <div className="flex items-start space-x-3">
                  <div className="w-8 h-8 rounded-full bg-amber-600 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <SettingsIcon className="w-4 h-4 text-white" />
                  </div>
                  <div className="space-y-2">
                    <p className="text-sm text-amber-800 dark:text-amber-200 font-medium">
                      About Roles & Permissions
                    </p>
                    <ul className="text-sm text-amber-700 dark:text-amber-300 space-y-1 list-disc list-inside">
                      <li><strong>Admin:</strong> Has all permissions and cannot be modified</li>
                      <li><strong>Manager:</strong> Can manage teams and projects but not workspace settings</li>
                      <li><strong>Team Member:</strong> Limited access, primarily for task execution</li>
                      <li><strong>Client/Guest:</strong> Can only access projects they're invited to</li>
                      <li>Changes apply immediately to all users with that role</li>
                      <li>Per-user permission overrides can be set in the Team Members tab</li>
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>

      {/* Jibble Connect Dialog */}
      <Dialog open={showJibbleDialog} onOpenChange={setShowJibbleDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Connect Jibble</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>Client ID</Label>
              <Input
                value={jibbleForm.client_id}
                onChange={(e) => setJibbleForm({ ...jibbleForm, client_id: e.target.value })}
                placeholder="Enter your Jibble Client ID"
                className="mt-1"
              />
            </div>
            <div>
              <Label>Secret Key</Label>
              <Input
                type="password"
                value={jibbleForm.secret_key}
                onChange={(e) => setJibbleForm({ ...jibbleForm, secret_key: e.target.value })}
                placeholder="Enter your Jibble Secret Key"
                className="mt-1"
              />
            </div>
            <div className="text-sm text-gray-500 dark:text-gray-400">
              <p>To get your Jibble API credentials:</p>
              <ol className="list-decimal list-inside mt-2 space-y-1">
                <li>Go to Jibble Settings → Integrations</li>
                <li>Create a new API application</li>
                <li>Copy the Client ID and Secret Key</li>
              </ol>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowJibbleDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleConnectJibble} className="bg-blue-600 hover:bg-blue-700 text-white">
              Connect Jibble
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* GoHighLevel Connect Dialog */}
      <Dialog open={showGHLDialog} onOpenChange={(open) => {
        setShowGHLDialog(open);
        if (!open) resetGHLDialog();
      }}>
        <DialogContent className="sm:max-w-[700px]">
          <DialogHeader>
            <DialogTitle>Setup GoHighLevel Integration</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-6 py-4">
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 p-4 rounded-lg">
              <p className="text-sm text-blue-800 dark:text-blue-200 mb-3">
                <strong>Simple Webhook Integration</strong> - No API key needed! Just configure webhooks in both directions.
              </p>
            </div>
            
            <div className="space-y-4">
              <h3 className="font-semibold text-gray-800 dark:text-white">📥 Part 1: Receive Data from GHL</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Click "Activate Integration" below to get your webhook URL. Paste it in GHL to send opportunity data to Millii.
              </p>
            </div>
            
            <div className="space-y-4">
              <h3 className="font-semibold text-gray-800 dark:text-white">📤 Part 2: Send Data to GHL</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                Paste your GHL webhook URL here. This allows "Sync with GHL" button to send project updates.
              </p>
              <div>
                <Label>GHL Webhook URL (Optional)</Label>
                <Input
                  value={ghlForm.api_key !== 'webhook-only' ? ghlForm.api_key : ''}
                  onChange={(e) => setGhlForm({ ...ghlForm, api_key: e.target.value || 'webhook-only' })}
                  placeholder="https://services.leadconnectorhq.com/hooks/..."
                  className="mt-1"
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Get this from GHL: Settings → Webhooks → Create Incoming Webhook
                </p>
              </div>
            </div>
            
            <div className="space-y-4">
              <h3 className="font-semibold text-gray-800 dark:text-white">🔧 GHL Automation Setup (Incoming)</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                In your GHL workflow, add "Send Outbound Webhook" action with this payload:
              </p>
              <div className="bg-gray-900 dark:bg-gray-800 p-4 rounded text-xs text-green-400 overflow-x-auto">
                <pre>{`{
  "opportunity_id": "{{opportunity.id}}",
  "opportunity_name": "{{opportunity.name}}",
  "client_name": "{{contact.full_name}}",
  "client_email": "{{contact.email}}",
  "client_phone": "{{contact.phone}}",
  "company_name": "{{contact.company_name}}",
  "lead_value": "{{opportunity.monetary_value}}",
  "description": "{{opportunity.description}}",
  "stage_name": "{{opportunity.stage_name}}"
}`}</pre>
              </div>
            </div>
            
            <div className="space-y-4">
              <h3 className="font-semibold text-gray-800 dark:text-white">✅ What Happens?</h3>
              <ul className="list-disc list-inside text-sm text-gray-600 dark:text-gray-400 space-y-1">
                <li><strong>Incoming:</strong> GHL sends data → Project created in Millii</li>
                <li><strong>Outgoing:</strong> Click "Sync with GHL" → Project updates sent to GHL</li>
                <li>Guest link auto-generated for each project</li>
              </ul>
            </div>
          </div>
          
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => {
                setShowGHLDialog(false);
                resetGHLDialog();
              }}
            >
              Cancel
            </Button>
            <Button 
              onClick={handleConnectGHL}
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              Activate Integration
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Break Dialog */}
      <Dialog open={showBreakDialog} onOpenChange={setShowBreakDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Add Break Type</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>Break Name</Label>
              <Input
                value={breakForm.name}
                onChange={(e) => setBreakForm({ ...breakForm, name: e.target.value })}
                placeholder="e.g., Lunch Break, Tea Break"
                className="mt-1"
              />
            </div>
            <div>
              <Label>Duration (minutes)</Label>
              <Input
                type="number"
                value={breakForm.duration_minutes}
                onChange={(e) => setBreakForm({ ...breakForm, duration_minutes: parseInt(e.target.value) || 0 })}
                placeholder="15"
                min="1"
                max="120"
                className="mt-1"
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Typical duration in minutes (1-120)
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => {
                setShowBreakDialog(false);
                setBreakForm({ name: '', duration_minutes: 15 });
              }}
            >
              Cancel
            </Button>
            <Button 
              onClick={handleAddBreak}
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Break
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Settings;