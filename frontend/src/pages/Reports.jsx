import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { ChevronLeft, ChevronRight, Calendar, Download, Activity, FolderKanban, Users, Clock, ChevronDown, ChevronUp, X, Filter, Check } from 'lucide-react';
import { API_URL } from '../config';

const API = API_URL;

const Reports = ({ currentUser }) => {
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState('month'); // 'today', 'week', 'month', 'custom'
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [weekStart, setWeekStart] = useState(getMonday(new Date()));
  const [weekEnd, setWeekEnd] = useState(getSunday(new Date()));
  const [reportData, setReportData] = useState(null);
  const [filterBy, setFilterBy] = useState('member'); // 'member', 'project', 'task', 'client'
  const [expandedRows, setExpandedRows] = useState(new Set());
  
  // New filter states
  const [selectedProjects, setSelectedProjects] = useState([]);
  const [selectedMembers, setSelectedMembers] = useState([]);
  const [selectedClients, setSelectedClients] = useState([]);
  const [allProjects, setAllProjects] = useState([]);
  const [allMembers, setAllMembers] = useState([]);
  const [allClients, setAllClients] = useState([]);
  
  // Dropdown states
  const [showProjectDropdown, setShowProjectDropdown] = useState(false);
  const [showMemberDropdown, setShowMemberDropdown] = useState(false);
  const [showClientDropdown, setShowClientDropdown] = useState(false);
  
  // Refs for click outside
  const projectDropdownRef = useRef(null);
  const memberDropdownRef = useRef(null);
  const clientDropdownRef = useRef(null);

  function getMonday(date) {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    return new Date(d.setDate(diff));
  }

  function getSunday(date) {
    const monday = getMonday(date);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    return sunday;
  }
  
  function getStartOfMonth(date) {
    return new Date(date.getFullYear(), date.getMonth(), 1);
  }
  
  function getEndOfMonth(date) {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0);
  }
  
  function getStartOfDay(date) {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    return d;
  }
  
  function getEndOfDay(date) {
    const d = new Date(date);
    d.setHours(23, 59, 59, 999);
    return d;
  }
  
  // Click outside handler for dropdowns
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (projectDropdownRef.current && !projectDropdownRef.current.contains(event.target)) {
        setShowProjectDropdown(false);
      }
      if (memberDropdownRef.current && !memberDropdownRef.current.contains(event.target)) {
        setShowMemberDropdown(false);
      }
      if (clientDropdownRef.current && !clientDropdownRef.current.contains(event.target)) {
        setShowClientDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Keep reports in sync with tracker updates
  useEffect(() => {
    const handler = () => {
      // Reuse current dateRange settings to refresh
      let start, end;
      const today = new Date();
      switch (dateRange) {
        case 'today':
          start = getStartOfDay(today); end = getEndOfDay(today); break;
        case 'week':
          start = getMonday(today); end = getSunday(today); break;
        case 'month':
          start = getStartOfMonth(today); end = getEndOfMonth(today); break;
        case 'custom':
          if (customStartDate && customEndDate) {
            start = new Date(customStartDate); end = new Date(customEndDate);
          } else { start = getStartOfMonth(today); end = getEndOfMonth(today); }
          break;
        default:
          start = getStartOfMonth(today); end = getEndOfMonth(today);
      }
      fetchReportData(start, end);
    };
    window.addEventListener('time-tracker:updated', handler);
    return () => window.removeEventListener('time-tracker:updated', handler);
  }, [dateRange, customStartDate, customEndDate]);

  useEffect(() => {
    if (currentUser?.role === 'admin') {
      // Update date range based on selection
      let start, end;
      const today = new Date();
      
      switch (dateRange) {
        case 'today':
          start = getStartOfDay(today);
          end = getEndOfDay(today);
          break;
        case 'week':
          start = getMonday(today);
    // Initialize selectors for projects, members, clients based on loaded data
    try {
      const users = response.data?.users || [];
      const members = Array.from(new Set(users.map(u => u.user_name).filter(Boolean))).sort();
      const projects = Array.from(new Set(users.flatMap(u => (u.time_entries || []).map(e => e.project?.name).filter(Boolean)))).sort();
      const clients = Array.from(new Set(users.flatMap(u => (u.time_entries || []).map(e => e.project?.client_name).filter(n => n && n !== 'No Client')))).sort();
      setAllMembers(members);
      setAllProjects(projects);
      setAllClients(clients);
    } catch (e) { /* ignore */ }

          end = getSunday(today);
          break;
        case 'month':
          start = getStartOfMonth(today);
          end = getEndOfMonth(today);
          break;
        case 'custom':
          if (customStartDate && customEndDate) {
            start = new Date(customStartDate);
      // Normalize: ensure each user has an id for counting unique members
      (data.users || []).forEach(u => { if (!u.user_id && u.id) u.user_id = u.id; });

            end = new Date(customEndDate);
          } else {
            start = getStartOfMonth(today);
            end = getEndOfMonth(today);
          }
          break;
        default:
          start = getStartOfMonth(today);
          end = getEndOfMonth(today);
      }
      
      setWeekStart(start);
      setWeekEnd(end);
      fetchReportData(start, end);
    }
  }, [dateRange, customStartDate, customEndDate, currentUser]);

  const fetchReportData = async (start, end) => {
    setLoading(true);
    try {
      // Fetch real data from API
      const response = await axios.get(`${API}/time-entries/reports-data`, {
        params: {
          start_date: start.toISOString(),
          end_date: end.toISOString()
        }
      });
      const data = response.data;
      
      // Calculate breakdowns with detailed information
      const projectBreakdown = {};
      const taskBreakdown = {};
      const memberBreakdown = {};
      const clientBreakdown = {};
      
      // Detailed breakdowns for expandable rows
      const memberDetails = {}; // member -> projects/tasks
      const projectDetails = {}; // project -> members/tasks
      const taskDetails = {}; // task -> members/projects
      const clientDetails = {}; // client -> projects/members
      
      const activitySet = new Set();
      const projectSet = new Set();
      const memberSet = new Set();
      const clientSet = new Set();
      let totalSeconds = 0;
      
      data.users?.forEach(user => {
        memberSet.add(user.user_name);
        const userName = user.user_name;
        const memberTotal = user.total_seconds || 0;
        memberBreakdown[userName] = memberTotal;
        totalSeconds += memberTotal;
        
        if (!memberDetails[userName]) {
          memberDetails[userName] = { projects: {}, tasks: {} };
        }
        
        user.time_entries?.forEach(entry => {
          const projectName = entry.project?.name || 'No Project';
          const taskName = entry.task?.title || 'Untitled Task';
          const clientName = entry.project?.client_name || 'No Client';
          const seconds = entry.duration_seconds || 0;
          
          // Project breakdown
          if (!projectBreakdown[projectName]) {
            projectBreakdown[projectName] = 0;
            projectSet.add(projectName);
            projectDetails[projectName] = { members: {}, tasks: {} };
          }
          projectBreakdown[projectName] += seconds;
          
          // Track clients
          if (clientName && clientName !== 'No Client') {
            clientSet.add(clientName);
          }
          
          // Task breakdown
          if (!taskBreakdown[taskName]) {
            taskBreakdown[taskName] = 0;
            taskDetails[taskName] = { members: {}, projects: {} };
          }
          taskBreakdown[taskName] += seconds;
          
          // Client breakdown
          if (!clientBreakdown[clientName]) {
            clientBreakdown[clientName] = 0;
            clientDetails[clientName] = { projects: {}, members: {} };
          }
          clientBreakdown[clientName] += seconds;
          
          // Member details
          if (!memberDetails[userName].projects[projectName]) {
            memberDetails[userName].projects[projectName] = 0;
          }
          memberDetails[userName].projects[projectName] += seconds;
          
          if (!memberDetails[userName].tasks[taskName]) {
            memberDetails[userName].tasks[taskName] = 0;
          }
          memberDetails[userName].tasks[taskName] += seconds;
          
          // Project details
          if (!projectDetails[projectName].members[userName]) {
            projectDetails[projectName].members[userName] = 0;
          }
          projectDetails[projectName].members[userName] += seconds;
          
          if (!projectDetails[projectName].tasks[taskName]) {
            projectDetails[projectName].tasks[taskName] = 0;
          }
          projectDetails[projectName].tasks[taskName] += seconds;
          
          // Task details
          if (!taskDetails[taskName].members[userName]) {
            taskDetails[taskName].members[userName] = 0;
          }
          taskDetails[taskName].members[userName] += seconds;
          
          if (!taskDetails[taskName].projects[projectName]) {
            taskDetails[taskName].projects[projectName] = 0;
          }
          taskDetails[taskName].projects[projectName] += seconds;
          
          // Client details
          if (!clientDetails[clientName].projects[projectName]) {
            clientDetails[clientName].projects[projectName] = 0;
          }
          clientDetails[clientName].projects[projectName] += seconds;
          
          if (!clientDetails[clientName].members[userName]) {
            clientDetails[clientName].members[userName] = 0;
          }
          clientDetails[clientName].members[userName] += seconds;
          
          if (entry.task?.title) {
            activitySet.add(entry.task.title);
          }
        });
      });

      // Set filter options
      setAllProjects(Array.from(projectSet).sort());
      setAllMembers(Array.from(memberSet).sort());
      setAllClients(Array.from(clientSet).sort());
      
      setReportData({
        ...data,
        projectBreakdown,
        taskBreakdown,
        memberBreakdown,
        clientBreakdown,
        memberDetails,
        projectDetails,
        taskDetails,
        clientDetails,
        totalActivities: activitySet.size,
        totalProjects: projectSet.size,
        totalHours: totalSeconds
      });
    } catch (error) {
      console.error('Error fetching report data:', error);
      const errorMsg = error.response?.data?.detail || error.message || 'Failed to load report data';
      toast.error(errorMsg);
      
      // Set empty data to show "no data" state instead of infinite loading
      setReportData({
        users: [],
        start_date: start.toISOString(),
        end_date: end.toISOString()
      });
      setAllProjects([]);
      setAllMembers([]);
      setAllClients([]);
    } finally {
      setLoading(false);
    }
  };

  const handlePreviousWeek = () => {
    const newStart = new Date(weekStart);
    newStart.setDate(newStart.getDate() - 7);
    const newEnd = new Date(weekEnd);
    newEnd.setDate(newEnd.getDate() - 7);
    setWeekStart(newStart);
    setWeekEnd(newEnd);
  };

  const handleNextWeek = () => {
    const newStart = new Date(weekStart);
    newStart.setDate(newStart.getDate() + 7);
    const newEnd = new Date(weekEnd);
    newEnd.setDate(newEnd.getDate() + 7);
    setWeekStart(newStart);
    setWeekEnd(newEnd);
  };

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const formatSeconds = (seconds) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
  };

  const exportReport = () => {
    if (!reportData) {
      toast.error('No data available to export');
      return;
    }

    const csvData = [
      ['Date', 'Team Member', 'Project', 'Task', 'Clock In', 'Clock Out', 'Break Times', 'Total Hours']
    ];

    // Use filtered data for export
    let usersToExport = reportData.users || [];
    
    // Apply member filter
    if (selectedMembers.length > 0) {
      usersToExport = usersToExport.filter(user => selectedMembers.includes(user.user_name));
    }

    usersToExport.forEach(user => {
      let entriesToExport = user.time_entries || [];
      
      // Apply project filter
      if (selectedProjects.length > 0) {
        entriesToExport = entriesToExport.filter(entry => 
          selectedProjects.includes(entry.project?.name)
        );
      }
      
      // Apply client filter
      if (selectedClients.length > 0) {
        entriesToExport = entriesToExport.filter(entry => 
          selectedClients.includes(entry.project?.client_name)
        );
      }
      
      entriesToExport.forEach(entry => {
        const date = new Date(entry.clock_in_time).toLocaleDateString('en-US', { 
          year: 'numeric', 
          month: 'short', 
          day: 'numeric' 
        });
        const clockIn = new Date(entry.clock_in_time).toLocaleTimeString('en-US', { 
          hour: '2-digit', 
          minute: '2-digit',
          hour12: true 
        });
        const clockOut = entry.clock_out_time ? 
          new Date(entry.clock_out_time).toLocaleTimeString('en-US', { 
            hour: '2-digit', 
            minute: '2-digit',
            hour12: true 
          }) : 'In Progress';
        
        const duration = entry.duration_seconds ? 
          formatSeconds(entry.duration_seconds) : 'In Progress';
        
        const breakInfo = entry.is_break ? 
          `Break: ${entry.break?.name || 'Break'}` : 
          'No breaks';

        csvData.push([
          date,
          user.user_name,
          entry.project?.name || 'No Project',
          entry.task?.title || 'No Task',
          clockIn,
          clockOut,
          breakInfo,
          duration
        ]);
      });
    });

    // Check if we have any data to export
    if (csvData.length === 1) {
      toast.warning('No time entries found for the selected filters');
      return;
    }

    const csv = csvData.map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = url;
    a.download = `time-report-${weekStart.toISOString().split('T')[0]}-${weekEnd.toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
    toast.success('Report exported successfully');
  };

  // Apply filters to data
  const getFilteredData = () => {
    if (!reportData) return null;
    
    let filteredUsers = reportData.users || [];
    
    // Determine whether to apply filters (if user actually narrowed results)
    const applyMemberFilter = selectedMembers.length > 0 && selectedMembers.length < allMembers.length;
    const applyProjectFilter = selectedProjects.length > 0 && selectedProjects.length < allProjects.length;
    const applyClientFilter = selectedClients.length > 0 && selectedClients.length < allClients.length;

    // Filter by selected members
    if (applyMemberFilter) {
      filteredUsers = filteredUsers.filter(user => selectedMembers.includes(user.user_name));
    }
    
    // Filter time entries by projects and clients
    filteredUsers = filteredUsers.map(user => {
      let filteredEntries = user.time_entries || [];
      
      if (applyProjectFilter) {
        filteredEntries = filteredEntries.filter(entry => selectedProjects.includes(entry.project?.name));
      }
      
      if (applyClientFilter) {
        filteredEntries = filteredEntries.filter(entry => selectedClients.includes(entry.project?.client_name));
      }
      
      return { ...user, time_entries: filteredEntries };
    });
    
    // Remove users with no entries after filtering
    filteredUsers = filteredUsers.filter(user => 
      user.time_entries && user.time_entries.length > 0
    );
    
    // Recalculate breakdowns with filtered data
    const projectBreakdown = {};
    const taskBreakdown = {};
    const memberBreakdown = {};
    const clientBreakdown = {};
    const memberDetails = {};
    const projectDetails = {};
    const taskDetails = {};
    const clientDetails = {};

    // Sets for unique counts using IDs when available
    const memberIdSet = new Set();
    const projectIdSet = new Set();
    const taskIdSet = new Set();
    const clientIdSet = new Set();

    let totalSeconds = 0;
    
    filteredUsers.forEach(user => {
      const userName = user.user_name;
      const userId = user.user_id || user.id || userName; // fallback to name
      let memberTotal = 0;
      memberIdSet.add(userId);
      
      if (!memberDetails[userName]) {
        memberDetails[userName] = { projects: {}, tasks: {} };
      }
      
      user.time_entries?.forEach(entry => {
        const projectName = entry.project?.name || 'No Project';
        const projectKey = entry.project?.id || projectName;
        const taskName = entry.task?.title || 'Untitled Task';
        const taskKey = entry.task?.id || taskName;
        const clientNameRaw = entry.project?.client_name || '';
        const clientKey = entry.project?.client_id || (clientNameRaw && clientNameRaw !== 'No Client' ? clientNameRaw : null);
        const clientName = clientNameRaw && clientNameRaw !== 'No Client' ? clientNameRaw : null;
        const seconds = entry.duration_seconds || 0;
        
        memberTotal += seconds;
        totalSeconds += seconds;
        
        // Unique sets
        projectIdSet.add(projectKey);
        taskIdSet.add(taskKey);
        if (clientKey) clientIdSet.add(clientKey);
        
        // Project breakdown
        if (!projectBreakdown[projectName]) {
          projectBreakdown[projectName] = 0;
          projectDetails[projectName] = { members: {}, tasks: {} };
        }
        projectBreakdown[projectName] += seconds;
        
        // Task breakdown
        if (!taskBreakdown[taskName]) {
          taskBreakdown[taskName] = 0;
          taskDetails[taskName] = { members: {}, projects: {} };
        }
        taskBreakdown[taskName] += seconds;
        
        // Client breakdown (only count real clients)
        if (clientName) {
          if (!clientBreakdown[clientName]) {
            clientBreakdown[clientName] = 0;
            clientDetails[clientName] = { projects: {}, members: {} };
          }
          clientBreakdown[clientName] += seconds;
        }
        
        // Member details
        if (!memberDetails[userName].projects[projectName]) {
          memberDetails[userName].projects[projectName] = 0;
        }
        memberDetails[userName].projects[projectName] += seconds;
        
        if (!memberDetails[userName].tasks[taskName]) {
          memberDetails[userName].tasks[taskName] = 0;
        }
        memberDetails[userName].tasks[taskName] += seconds;
        
        // Project details
        if (!projectDetails[projectName].members[userName]) {
          projectDetails[projectName].members[userName] = 0;
        }
        projectDetails[projectName].members[userName] += seconds;
        
        if (!projectDetails[projectName].tasks[taskName]) {
          projectDetails[projectName].tasks[taskName] = 0;
        }
        projectDetails[projectName].tasks[taskName] += seconds;
        
        // Task details
        if (!taskDetails[taskName].members[userName]) {
          taskDetails[taskName].members[userName] = 0;
        }
        taskDetails[taskName].members[userName] += seconds;
        
        if (!taskDetails[taskName].projects[projectName]) {
          taskDetails[taskName].projects[projectName] = 0;
        }
        taskDetails[taskName].projects[projectName] += seconds;
        
        // Client details
        if (clientName) {
          if (!clientDetails[clientName].projects[projectName]) {
            clientDetails[clientName].projects[projectName] = 0;
          }
          clientDetails[clientName].projects[projectName] += seconds;
          
          if (!clientDetails[clientName].members[userName]) {
            clientDetails[clientName].members[userName] = 0;
          }
          clientDetails[clientName].members[userName] += seconds;
        }
      });
      
      memberBreakdown[userName] = memberTotal;
    });
    
    return {
      projectBreakdown,
      taskBreakdown,
      memberBreakdown,
      clientBreakdown,
      memberDetails,
      projectDetails,
      taskDetails,
      clientDetails,
      totalProjects: Array.from(projectIdSet).filter(Boolean).length,
      totalTasks: Object.keys(taskBreakdown).length,
      totalHours: totalSeconds,
      totalClients: Array.from(clientIdSet).filter(Boolean).length,
      totalMembers: Array.from(memberIdSet).filter(Boolean).length
    };
  };
  
  // Get breakdown data based on filter
  const getBreakdownData = () => {
    const filtered = getFilteredData();
    if (!filtered) return [];
    
    let breakdown = {};
    switch (filterBy) {
      case 'project':
        breakdown = filtered.projectBreakdown || {};
        break;
      case 'task':
        breakdown = filtered.taskBreakdown || {};
        break;
      case 'client':
        breakdown = filtered.clientBreakdown || {};
        break;
      case 'member':
      default:
        breakdown = filtered.memberBreakdown || {};
        break;
    }
    
    return Object.entries(breakdown)
      .map(([name, seconds]) => ({ name, seconds }))
      .sort((a, b) => b.seconds - a.seconds);
  };

  const breakdownData = getBreakdownData();
  const filteredReportData = getFilteredData();

  // Toggle row expansion
  const toggleRow = (name) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(name)) {
      newExpanded.delete(name);
    } else {
      newExpanded.add(name);
    }
    setExpandedRows(newExpanded);
  };

  // Get details for expanded row
  const getRowDetails = (name) => {
    const filtered = getFilteredData();
    if (!filtered) return null;
    
    switch (filterBy) {
      case 'member':
        return filtered.memberDetails?.[name] || null;
      case 'project':
        return filtered.projectDetails?.[name] || null;
      case 'task':
        return filtered.taskDetails?.[name] || null;
      case 'client':
        return filtered.clientDetails?.[name] || null;
      default:
        return null;
    }
  };
  
  // Clear all filters
  const clearAllFilters = () => {
    setSelectedProjects([]);
    setSelectedMembers([]);
    setSelectedClients([]);
    setDateRange('month');
    setCustomStartDate('');
    setCustomEndDate('');
    toast.success('All filters cleared');
  };
  
  // Toggle filter selection
  const toggleFilter = (filterType, value) => {
    let setter, current;
    switch (filterType) {
      case 'project':
        setter = setSelectedProjects;
        current = selectedProjects;
        break;
      case 'member':
        setter = setSelectedMembers;
        current = selectedMembers;
        break;
      case 'client':
        setter = setSelectedClients;
        current = selectedClients;
        break;
      default:
        return;
    }
    
    if (current.includes(value)) {
      setter(current.filter(item => item !== value));
    } else {
      setter([...current, value]);
    }
  };
  
  // Toggle Select All
  const toggleSelectAll = (filterType) => {
    let setter, current, allItems;
    switch (filterType) {
      case 'project':
        setter = setSelectedProjects;
        current = selectedProjects;
        allItems = allProjects;
        break;
      case 'member':
        setter = setSelectedMembers;
        current = selectedMembers;
        allItems = allMembers;
        break;
      case 'client':
        setter = setSelectedClients;
        current = selectedClients;
        allItems = allClients;
        break;
      default:
        return;
    }
    
    if (current.length === allItems.length) {
      setter([]);
    } else {
      setter([...allItems]);
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-800 dark:text-white mb-2">
            Time Reports
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Track and analyze time spent across projects and tasks
          </p>
        </div>
        <Button
          onClick={exportReport}
          className="bg-blue-600 hover:bg-blue-700 text-white"
        >
          <Download className="w-4 h-4 mr-2" />
          Export Report
        </Button>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
        <Card className="bg-gradient-to-br from-indigo-50 to-indigo-100 dark:from-indigo-900/20 dark:to-indigo-800/20 border-indigo-200 dark:border-indigo-800">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-indigo-600 dark:text-indigo-400 font-semibold mb-1">TEAM MEMBERS</p>
                <p className="text-4xl font-bold text-indigo-700 dark:text-indigo-300">
                  {filteredReportData?.totalMembers || 0}
                </p>
              </div>
              <Users className="w-12 h-12 text-indigo-500 opacity-40" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 border-blue-200 dark:border-blue-800">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-blue-600 dark:text-blue-400 font-semibold mb-1">TOTAL PROJECTS</p>
                <p className="text-4xl font-bold text-blue-700 dark:text-blue-300">
                  {filteredReportData?.totalProjects || 0}
                </p>
              </div>
              <FolderKanban className="w-12 h-12 text-blue-500 opacity-40" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20 border-purple-200 dark:border-purple-800">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-purple-600 dark:text-purple-400 font-semibold mb-1">TOTAL HOURS</p>
                <p className="text-4xl font-bold text-purple-700 dark:text-purple-300">
                  {filteredReportData ? formatSeconds(filteredReportData.totalHours) : '0h 0m'}
                </p>
              </div>
              <Clock className="w-12 h-12 text-purple-500 opacity-40" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20 border-green-200 dark:border-green-800">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-green-600 dark:text-green-400 font-semibold mb-1">TOTAL TASKS</p>
                <p className="text-4xl font-bold text-green-700 dark:text-green-300">
                  {filteredReportData?.totalTasks || 0}
                </p>
              </div>
              <Activity className="w-12 h-12 text-green-500 opacity-40" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-900/20 dark:to-orange-800/20 border-orange-200 dark:border-orange-800">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-orange-600 dark:text-orange-400 font-semibold mb-1">TOTAL CLIENTS</p>
                <p className="text-4xl font-bold text-orange-700 dark:text-orange-300">
                  {filteredReportData?.totalClients || 0}
                </p>
              </div>
              <Users className="w-12 h-12 text-orange-500 opacity-40" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters Section */}
      <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
        <CardContent className="pt-6 space-y-4">
          {/* Date Range Filter */}
          <div>
            <label className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 flex items-center">
              <Calendar className="w-4 h-4 mr-2" />
              Date Range
            </label>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant={dateRange === 'today' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setDateRange('today')}
              >
                Today
              </Button>
              <Button
                variant={dateRange === 'week' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setDateRange('week')}
              >
                Last Week
              </Button>
              <Button
                variant={dateRange === 'month' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setDateRange('month')}
              >
                Last Month
              </Button>
              <Button
                variant={dateRange === 'custom' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setDateRange('custom')}
              >
                Custom
              </Button>
              
              {dateRange === 'custom' && (
                <div className="flex items-center gap-2 ml-4">
                  <input
                    type="date"
                    value={customStartDate}
                    onChange={(e) => setCustomStartDate(e.target.value)}
                    className="px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-800 dark:text-white"
                  />
                  <span className="text-gray-500">to</span>
                  <input
                    type="date"
                    value={customEndDate}
                    onChange={(e) => setCustomEndDate(e.target.value)}
                    className="px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-800 dark:text-white"
                  />
                </div>
              )}
              
              <div className="ml-4 px-4 py-1 bg-gray-100 dark:bg-gray-700 rounded text-sm text-gray-700 dark:text-gray-300">
                {formatDate(weekStart)} - {formatDate(weekEnd)}
              </div>
            </div>
          </div>

          {/* Dropdown Multi-select Filters */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
            {/* Project Dropdown Filter */}
            <div className="relative" ref={projectDropdownRef}>
              <label className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 flex items-center">
                <FolderKanban className="w-4 h-4 mr-2" />
                Projects
              </label>
              <button
                onClick={() => setShowProjectDropdown(!showProjectDropdown)}
                className="w-full px-4 py-2 text-left bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 flex items-center justify-between"
              >
                <span className="text-sm text-gray-700 dark:text-gray-300">
                  {selectedProjects.length > 0 
                    ? `${selectedProjects.length} selected` 
                    : 'Select projects'}
                </span>
                <ChevronDown className="w-4 h-4 text-gray-500" />
              </button>
              
              {showProjectDropdown && (
                <div className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                  {/* Select All Option */}
                  <label className="flex items-center space-x-2 px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-600 cursor-pointer border-b border-gray-200 dark:border-gray-600">
                    <input
                      type="checkbox"
                      checked={allProjects.length > 0 && selectedProjects.length === allProjects.length}
                      onChange={() => toggleSelectAll('project')}
                      className="form-checkbox h-4 w-4 text-blue-600"
                    />
                    <span className="text-sm font-semibold text-gray-800 dark:text-white">Select All</span>
                  </label>
                  
                  {allProjects.length === 0 ? (
                    <p className="text-xs text-gray-500 px-4 py-3">No projects available</p>
                  ) : (
                    allProjects.map(project => (
                      <label key={project} className="flex items-center space-x-2 px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-600 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={selectedProjects.includes(project)}
                          onChange={() => toggleFilter('project', project)}
                          className="form-checkbox h-4 w-4 text-blue-600"
                        />
                        <span className="text-sm text-gray-700 dark:text-gray-300">{project}</span>
                      </label>
                    ))
                  )}
                </div>
              )}
            </div>

            {/* Team Member Dropdown Filter */}
            <div className="relative" ref={memberDropdownRef}>
              <label className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 flex items-center">
                <Users className="w-4 h-4 mr-2" />
                Team Members
              </label>
              <button
                onClick={() => setShowMemberDropdown(!showMemberDropdown)}
                className="w-full px-4 py-2 text-left bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 flex items-center justify-between"
              >
                <span className="text-sm text-gray-700 dark:text-gray-300">
                  {selectedMembers.length > 0 
                    ? `${selectedMembers.length} selected` 
                    : 'Select team members'}
                </span>
                <ChevronDown className="w-4 h-4 text-gray-500" />
              </button>
              
              {showMemberDropdown && (
                <div className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                  {/* Select All Option */}
                  <label className="flex items-center space-x-2 px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-600 cursor-pointer border-b border-gray-200 dark:border-gray-600">
                    <input
                      type="checkbox"
                      checked={allMembers.length > 0 && selectedMembers.length === allMembers.length}
                      onChange={() => toggleSelectAll('member')}
                      className="form-checkbox h-4 w-4 text-blue-600"
                    />
                    <span className="text-sm font-semibold text-gray-800 dark:text-white">Select All</span>
                  </label>
                  
                  {allMembers.length === 0 ? (
                    <p className="text-xs text-gray-500 px-4 py-3">No team members available</p>
                  ) : (
                    allMembers.map(member => (
                      <label key={member} className="flex items-center space-x-2 px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-600 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={selectedMembers.includes(member)}
                          onChange={() => toggleFilter('member', member)}
                          className="form-checkbox h-4 w-4 text-blue-600"
                        />
                        <span className="text-sm text-gray-700 dark:text-gray-300">{member}</span>
                      </label>
                    ))
                  )}
                </div>
              )}
            </div>

            {/* Client Dropdown Filter */}
            <div className="relative" ref={clientDropdownRef}>
              <label className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 flex items-center">
                <Users className="w-4 h-4 mr-2" />
                Clients
              </label>
              <button
                onClick={() => setShowClientDropdown(!showClientDropdown)}
                className="w-full px-4 py-2 text-left bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 flex items-center justify-between"
              >
                <span className="text-sm text-gray-700 dark:text-gray-300">
                  {selectedClients.length > 0 
                    ? `${selectedClients.length} selected` 
                    : 'Select clients'}
                </span>
                <ChevronDown className="w-4 h-4 text-gray-500" />
              </button>
              
              {showClientDropdown && (
                <div className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                  {/* Select All Option */}
                  <label className="flex items-center space-x-2 px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-600 cursor-pointer border-b border-gray-200 dark:border-gray-600">
                    <input
                      type="checkbox"
                      checked={allClients.length > 0 && selectedClients.length === allClients.length}
                      onChange={() => toggleSelectAll('client')}
                      className="form-checkbox h-4 w-4 text-blue-600"
                    />
                    <span className="text-sm font-semibold text-gray-800 dark:text-white">Select All</span>
                  </label>
                  
                  {allClients.length === 0 ? (
                    <p className="text-xs text-gray-500 px-4 py-3">No clients available</p>
                  ) : (
                    allClients.map(client => (
                      <label key={client} className="flex items-center space-x-2 px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-600 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={selectedClients.includes(client)}
                          onChange={() => toggleFilter('client', client)}
                          className="form-checkbox h-4 w-4 text-blue-600"
                        />
                        <span className="text-sm text-gray-700 dark:text-gray-300">{client}</span>
                      </label>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Clear Filters Button */}
          {(selectedProjects.length > 0 || selectedMembers.length > 0 || selectedClients.length > 0 || dateRange !== 'month') && (
            <div className="pt-2 flex justify-end">
              <Button
                variant="outline"
                size="sm"
                onClick={clearAllFilters}
                className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
              >
                <X className="w-4 h-4 mr-2" />
                Clear All Filters
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Filter Tabs */}
      <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
        <CardContent className="pt-6">
          <div className="flex items-center space-x-2 border-b border-gray-200 dark:border-gray-700 pb-3">
            <span className="text-sm font-medium text-gray-600 dark:text-gray-400 mr-2">View by:</span>
            <Button
              variant={filterBy === 'member' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilterBy('member')}
            >
              <Users className="w-4 h-4 mr-2" />
              Team Members
            </Button>
            <Button
              variant={filterBy === 'project' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilterBy('project')}
            >
              <FolderKanban className="w-4 h-4 mr-2" />
              Projects
            </Button>
            <Button
              variant={filterBy === 'task' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilterBy('task')}
            >
              <Activity className="w-4 h-4 mr-2" />
              Tasks
            </Button>
            <Button
              variant={filterBy === 'client' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilterBy('client')}
            >
              <Users className="w-4 h-4 mr-2" />
              Clients
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Breakdown Table with Expandable Rows */}
      <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
        <CardHeader>
          <CardTitle className="text-gray-800 dark:text-white capitalize">
            Hours by {filterBy}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-12 text-gray-500 dark:text-gray-400">
              Loading...
            </div>
          ) : breakdownData.length === 0 ? (
            <div className="text-center py-12 text-gray-500 dark:text-gray-400">
              No data available for this period
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b-2 border-gray-200 dark:border-gray-700">
                    <th className="text-left py-4 px-6 text-sm font-semibold text-gray-700 dark:text-gray-300 w-12">
                      
                    </th>
                    <th className="text-left py-4 px-6 text-sm font-semibold text-gray-700 dark:text-gray-300">
                      {filterBy === 'member' ? 'Team Member' : 
                       filterBy === 'project' ? 'Project' :
                       filterBy === 'task' ? 'Task' : 'Client'}
                    </th>
                    <th className="text-right py-4 px-6 text-sm font-semibold text-gray-700 dark:text-gray-300">
                      Hours
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {breakdownData.map((item, index) => {
                    const isExpanded = expandedRows.has(item.name);
                    const details = getRowDetails(item.name);
                    
                    return (
                      <React.Fragment key={index}>
                        {/* Main Row */}
                        <tr 
                          className="border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors cursor-pointer"
                          onClick={() => toggleRow(item.name)}
                        >
                          <td className="py-4 px-6">
                            {isExpanded ? (
                              <ChevronUp className="w-5 h-5 text-gray-500" />
                            ) : (
                              <ChevronDown className="w-5 h-5 text-gray-500" />
                            )}
                          </td>
                          <td className="py-4 px-6">
                            <p className="text-base font-medium text-gray-800 dark:text-white">
                              {item.name}
                            </p>
                          </td>
                          <td className="text-right py-4 px-6">
                            <p className="text-lg font-semibold text-gray-800 dark:text-white">
                              {formatSeconds(item.seconds)}
                            </p>
                          </td>
                        </tr>
                        
                        {/* Expanded Details */}
                        {isExpanded && details && (
                          <tr className="bg-gray-50 dark:bg-gray-700/30">
                            <td colSpan="3" className="py-4 px-6">
                              <div className="ml-8 space-y-4">
                                {/* Show breakdown based on filter type */}
                                {filterBy === 'member' && (
                                  <>
                                    {/* Projects for this member */}
                                    {Object.keys(details.projects).length > 0 && (
                                      <div>
                                        <h4 className="text-sm font-semibold text-gray-600 dark:text-gray-400 mb-2">
                                          Projects:
                                        </h4>
                                        <div className="space-y-1">
                                          {Object.entries(details.projects)
                                            .sort((a, b) => b[1] - a[1])
                                            .map(([project, seconds]) => (
                                              <div key={project} className="flex justify-between items-center py-1 px-3 bg-white dark:bg-gray-800 rounded">
                                                <span className="text-sm text-gray-700 dark:text-gray-300">{project}</span>
                                                <span className="text-sm font-medium text-gray-800 dark:text-white">
                                                  {formatSeconds(seconds)}
                                                </span>
                                              </div>
                                            ))
                                          }
                                        </div>
                                      </div>
                                    )}
                                    
                                    {/* Tasks for this member */}
                                    {Object.keys(details.tasks).length > 0 && (
                                      <div>
                                        <h4 className="text-sm font-semibold text-gray-600 dark:text-gray-400 mb-2">
                                          Tasks:
                                        </h4>
                                        <div className="space-y-1">
                                          {Object.entries(details.tasks)
                                            .sort((a, b) => b[1] - a[1])
                                            .map(([task, seconds]) => (
                                              <div key={task} className="flex justify-between items-center py-1 px-3 bg-white dark:bg-gray-800 rounded">
                                                <span className="text-sm text-gray-700 dark:text-gray-300">{task}</span>
                                                <span className="text-sm font-medium text-gray-800 dark:text-white">
                                                  {formatSeconds(seconds)}
                                                </span>
                                              </div>
                                            ))
                                          }
                                        </div>
                                      </div>
                                    )}
                                  </>
                                )}
                                
                                {filterBy === 'project' && (
                                  <>
                                    {/* Members for this project */}
                                    {Object.keys(details.members).length > 0 && (
                                      <div>
                                        <h4 className="text-sm font-semibold text-gray-600 dark:text-gray-400 mb-2">
                                          Team Members:
                                        </h4>
                                        <div className="space-y-1">
                                          {Object.entries(details.members)
                                            .sort((a, b) => b[1] - a[1])
                                            .map(([member, seconds]) => (
                                              <div key={member} className="flex justify-between items-center py-1 px-3 bg-white dark:bg-gray-800 rounded">
                                                <span className="text-sm text-gray-700 dark:text-gray-300">{member}</span>
                                                <span className="text-sm font-medium text-gray-800 dark:text-white">
                                                  {formatSeconds(seconds)}
                                                </span>
                                              </div>
                                            ))
                                          }
                                        </div>
                                      </div>
                                    )}
                                    
                                    {/* Tasks for this project */}
                                    {Object.keys(details.tasks).length > 0 && (
                                      <div>
                                        <h4 className="text-sm font-semibold text-gray-600 dark:text-gray-400 mb-2">
                                          Tasks:
                                        </h4>
                                        <div className="space-y-1">
                                          {Object.entries(details.tasks)
                                            .sort((a, b) => b[1] - a[1])
                                            .map(([task, seconds]) => (
                                              <div key={task} className="flex justify-between items-center py-1 px-3 bg-white dark:bg-gray-800 rounded">
                                                <span className="text-sm text-gray-700 dark:text-gray-300">{task}</span>
                                                <span className="text-sm font-medium text-gray-800 dark:text-white">
                                                  {formatSeconds(seconds)}
                                                </span>
                                              </div>
                                            ))
                                          }
                                        </div>
                                      </div>
                                    )}
                                  </>
                                )}
                                
                                {filterBy === 'task' && (
                                  <>
                                    {/* Members for this task */}
                                    {Object.keys(details.members).length > 0 && (
                                      <div>
                                        <h4 className="text-sm font-semibold text-gray-600 dark:text-gray-400 mb-2">
                                          Team Members:
                                        </h4>
                                        <div className="space-y-1">
                                          {Object.entries(details.members)
                                            .sort((a, b) => b[1] - a[1])
                                            .map(([member, seconds]) => (
                                              <div key={member} className="flex justify-between items-center py-1 px-3 bg-white dark:bg-gray-800 rounded">
                                                <span className="text-sm text-gray-700 dark:text-gray-300">{member}</span>
                                                <span className="text-sm font-medium text-gray-800 dark:text-white">
                                                  {formatSeconds(seconds)}
                                                </span>
                                              </div>
                                            ))
                                          }
                                        </div>
                                      </div>
                                    )}
                                    
                                    {/* Projects for this task */}
                                    {Object.keys(details.projects).length > 0 && (
                                      <div>
                                        <h4 className="text-sm font-semibold text-gray-600 dark:text-gray-400 mb-2">
                                          Projects:
                                        </h4>
                                        <div className="space-y-1">
                                          {Object.entries(details.projects)
                                            .sort((a, b) => b[1] - a[1])
                                            .map(([project, seconds]) => (
                                              <div key={project} className="flex justify-between items-center py-1 px-3 bg-white dark:bg-gray-800 rounded">
                                                <span className="text-sm text-gray-700 dark:text-gray-300">{project}</span>
                                                <span className="text-sm font-medium text-gray-800 dark:text-white">
                                                  {formatSeconds(seconds)}
                                                </span>
                                              </div>
                                            ))
                                          }
                                        </div>
                                      </div>
                                    )}
                                  </>
                                )}
                                
                                {filterBy === 'client' && (
                                  <>
                                    {/* Projects for this client */}
                                    {Object.keys(details.projects).length > 0 && (
                                      <div>
                                        <h4 className="text-sm font-semibold text-gray-600 dark:text-gray-400 mb-2">
                                          Projects:
                                        </h4>
                                        <div className="space-y-1">
                                          {Object.entries(details.projects)
                                            .sort((a, b) => b[1] - a[1])
                                            .map(([project, seconds]) => (
                                              <div key={project} className="flex justify-between items-center py-1 px-3 bg-white dark:bg-gray-800 rounded">
                                                <span className="text-sm text-gray-700 dark:text-gray-300">{project}</span>
                                                <span className="text-sm font-medium text-gray-800 dark:text-white">
                                                  {formatSeconds(seconds)}
                                                </span>
                                              </div>
                                            ))
                                          }
                                        </div>
                                      </div>
                                    )}
                                    
                                    {/* Members for this client */}
                                    {Object.keys(details.members).length > 0 && (
                                      <div>
                                        <h4 className="text-sm font-semibold text-gray-600 dark:text-gray-400 mb-2">
                                          Team Members:
                                        </h4>
                                        <div className="space-y-1">
                                          {Object.entries(details.members)
                                            .sort((a, b) => b[1] - a[1])
                                            .map(([member, seconds]) => (
                                              <div key={member} className="flex justify-between items-center py-1 px-3 bg-white dark:bg-gray-800 rounded">
                                                <span className="text-sm text-gray-700 dark:text-gray-300">{member}</span>
                                                <span className="text-sm font-medium text-gray-800 dark:text-white">
                                                  {formatSeconds(seconds)}
                                                </span>
                                              </div>
                                            ))
                                          }
                                        </div>
                                      </div>
                                    )}
                                  </>
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                  
                  {/* Total Row */}
                  <tr className="bg-gray-50 dark:bg-gray-700/30 font-bold">
                    <td className="py-4 px-6"></td>
                    <td className="py-4 px-6 text-gray-800 dark:text-white">
                      TOTAL
                    </td>
                    <td className="text-right py-4 px-6 text-lg text-gray-800 dark:text-white">
                      {formatSeconds(breakdownData.reduce((sum, item) => sum + item.seconds, 0))}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Reports;
