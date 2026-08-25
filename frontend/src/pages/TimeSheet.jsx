import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { ChevronLeft, ChevronRight, Clock, Calendar } from 'lucide-react';
import { API_URL } from '../config';

const API = API_URL;

const TimeSheet = ({ currentUser }) => {
  const [loading, setLoading] = useState(true);
  const [selectedUserFilter, setSelectedUserFilter] = useState('all');
  const [weekStart, setWeekStart] = useState(() => getMonday(new Date()));
  const [weekEnd, setWeekEnd] = useState(() => getSunday(new Date()));
  const [summaryData, setSummaryData] = useState(null);
  const [selectedUserDetail, setSelectedUserDetail] = useState(null);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [selectedTab, setSelectedTab] = useState('entries');

  // Fixed date functions to avoid mutation
  function getMonday(date) { 
    const d = new Date(date.getTime()); // Create new date to avoid mutation
    const day = d.getDay(); 
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); 
    d.setDate(diff);
    d.setHours(0, 0, 0, 0); // Set to start of day
    return d;
  }
  
  function getSunday(date) { 
    const monday = getMonday(date); 
    const sunday = new Date(monday.getTime()); // Create new date
    sunday.setDate(monday.getDate() + 6); 
    sunday.setHours(23, 59, 59, 999); // Set to end of day
    return sunday;
  }

  useEffect(() => { fetchWeeklySummary(); }, [weekStart, weekEnd]);
  // Keep this page in sync with tracker updates without manual refresh
  useEffect(() => {
    const handler = () => fetchWeeklySummary();
    window.addEventListener('time-tracker:updated', handler);
    return () => window.removeEventListener('time-tracker:updated', handler);
  }, []);


  const fetchWeeklySummary = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${API}/time-entries/weekly-summary`, { params: { start_date: weekStart.toISOString(), end_date: weekEnd.toISOString() } });
      setSummaryData(response.data);
    } catch (error) {
      console.error('Error fetching weekly summary:', error);
      toast.error('Failed to load time sheet data');
    } finally { setLoading(false); }
  };

  const handlePreviousWeek = () => { 
    const ns = new Date(weekStart.getTime()); 
    ns.setDate(ns.getDate() - 7); 
    const ne = new Date(weekEnd.getTime()); 
    ne.setDate(ne.getDate() - 7); 
    setWeekStart(ns); 
    setWeekEnd(ne); 
  };
  
  const handleNextWeek = () => { 
    const ns = new Date(weekStart.getTime()); 
    ns.setDate(ns.getDate() + 7); 
    const ne = new Date(weekEnd.getTime()); 
    ne.setDate(ne.getDate() + 7); 
    setWeekStart(ns); 
    setWeekEnd(ne); 
  };
  
  const handleThisWeek = () => { 
    const now = new Date();
    setWeekStart(getMonday(now)); 
    setWeekEnd(getSunday(now)); 
  };

  const handleDayClick = async (userId, date) => {
    try {
      const response = await axios.get(`${API}/time-entries/user-detail`, { params: { user_id: userId, date: new Date(date).toISOString() } });
      setSelectedUserDetail(response.data);
      setDetailDialogOpen(true);
      setSelectedTab('entries');
    } catch (error) {
      console.error('Error fetching user detail:', error);
      toast.error('Failed to load time entry details');
    }
  };

  const formatDate = (date) => new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const formatTime = (isoString) => new Date(isoString).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });

  const getDaysOfWeek = () => { const days = []; const current = new Date(weekStart); for (let i = 0; i < 7; i++) { days.push(new Date(current)); current.setDate(current.getDate() + 1); } return days; };
  const daysOfWeek = getDaysOfWeek();

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-800 dark:text-white mb-2">Time Sheet</h1>
        <p className="text-gray-600 dark:text-gray-400">Track team member hours</p>
      </div>

      <Card className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-xl border-gray-200 dark:border-gray-700">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Button variant="outline" size="sm" onClick={handlePreviousWeek} className="dark:bg-gray-700 dark:border-gray-600"><ChevronLeft className="w-4 h-4" /></Button>
              <div className="flex items-center space-x-2">
                <Calendar className="w-5 h-5 text-gray-500 dark:text-gray-400" />
                <span className="text-lg font-semibold text-gray-800 dark:text-white">{formatDate(weekStart)} - {formatDate(weekEnd)}</span>
              </div>
              <Button variant="outline" size="sm" onClick={handleNextWeek} className="dark:bg-gray-700 dark:border-gray-600"><ChevronRight className="w-4 h-4" /></Button>
            </div>
            <Button onClick={handleThisWeek} className="bg-blue-600 hover:bg-blue-700 text-white">This Week</Button>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-xl border-gray-200 dark:border-gray-700">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-gray-800 dark:text-white">Weekly Summary</CardTitle>
            {summaryData?.users && summaryData.users.length > 0 && (
              <div className="flex items-center space-x-2">
                <label className="text-sm text-gray-600 dark:text-gray-400">Filter:</label>
                <select 
                  value={selectedUserFilter}
                  onChange={(e) => setSelectedUserFilter(e.target.value)}
                  className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="all">All Team Members</option>
                  {summaryData.users.map(user => (
                    <option key={user.user_id} value={user.user_id}>{user.user_name}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">Loading...</div>
          ) : !summaryData?.users || summaryData.users.length === 0 ? (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">No time entries for this week</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full table-fixed">
                <colgroup>
                  <col style={{width: '25%'}} />
                  <col style={{width: '9%'}} />
                  <col style={{width: '9%'}} />
                  <col style={{width: '9%'}} />
                  <col style={{width: '9%'}} />
                  <col style={{width: '9%'}} />
                  <col style={{width: '9%'}} />
                  <col style={{width: '9%'}} />
                  <col style={{width: '12%'}} />
                </colgroup>
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700">
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700 dark:text-gray-300">Team Member</th>
                    {daysOfWeek.map((day, index) => (
                      <th key={index} className="text-center py-3 px-2 text-sm font-semibold text-gray-700 dark:text-gray-300">
                        <div>{day.toLocaleDateString('en-US', { weekday: 'short' })}</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">{day.getDate()}</div>
                      </th>
                    ))}
                    <th className="text-center py-3 px-4 text-sm font-semibold text-gray-700 dark:text-gray-300">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {summaryData.users
                    .filter(user => selectedUserFilter === 'all' || user.user_id === selectedUserFilter)
                    .map((user) => (
                    <tr key={user.user_id} className="border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                      <td className="py-4 px-4">
                        <div className="flex items-center space-x-3">
                          {user.profile_image_url ? (
                            <img src={user.profile_image_url} alt={user.user_name} className="w-10 h-10 rounded-full object-cover" />
                          ) : (
                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-semibold">
                              {(user.user_name || 'U').split(' ').map(w => w[0]).join('').slice(0,2).toUpperCase()}
                            </div>
                          )}
                          <div>
                            <p className="font-medium text-gray-800 dark:text-white">{user.user_name}</p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">{user.user_email}</p>
                          </div>
                        </div>
                      </td>
                      {daysOfWeek.map((day, index) => {
                        const dateKey = day.toISOString().split('T')[0];
                        const dayData = user.daily_hours[dateKey];
                        // Check if user has active entry today
                        const hasActiveToday = user.time_entries?.some(entry => 
                          entry.is_currently_active && entry.clock_in_time?.startsWith(dateKey)
                        );
                        return (
                          <td key={index} className="py-4 px-2 text-center align-middle">
                            {dayData ? (
                              <div className="inline-flex items-center justify-center gap-1">
                                <button onClick={() => handleDayClick(user.user_id, dateKey)} className="text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline">
                                  {dayData.formatted}
                                </button>
                                {hasActiveToday && <span className="inline-block w-2 h-2 bg-green-500 rounded-full animate-pulse" title="Currently active"></span>}
                              </div>
                            ) : (
                              <span className="text-sm text-gray-400 dark:text-gray-600">-</span>
                            )}
                          </td>
                        );
                      })}
                      <td className="text-center py-4 px-4"><span className="text-sm font-bold text-gray-800 dark:text-white">{user.total_formatted}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {selectedUserDetail?.user && (
                <div className="flex items-center space-x-3">
                  {selectedUserDetail.user.profile_image_url ? (
                    <img src={selectedUserDetail.user.profile_image_url} alt={selectedUserDetail.user.name} className="w-12 h-12 rounded-full object-cover" />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-semibold text-lg">
                      {(selectedUserDetail.user.name || 'U').split(' ').map(w => w[0]).join('').slice(0,2).toUpperCase()}
                    </div>
                  )}
                  <div>
                    <p className="text-xl font-bold">{selectedUserDetail.user.name}</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">{selectedUserDetail.date && formatDate(selectedUserDetail.date)}</p>
                  </div>
                </div>
              )}
            </DialogTitle>
          </DialogHeader>

          <Tabs value={selectedTab} onValueChange={setSelectedTab}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="entries">Time Entries</TabsTrigger>
              <TabsTrigger value="screenshots">Screenshots</TabsTrigger>
              <TabsTrigger value="activity">Activity</TabsTrigger>
            </TabsList>

            <TabsContent value="entries" className="space-y-4 mt-4">
              {selectedUserDetail?.time_entries && selectedUserDetail.time_entries.length > 0 ? (
                selectedUserDetail.time_entries.map((entry) => (
                  <Card key={entry.id} className="border-gray-200 dark:border-gray-700">
                    <CardContent className="pt-6">
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-3">
                            <Clock className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                            <div>
                              <p className="font-medium text-gray-800 dark:text-white">{entry.task?.title || 'Unknown Task'}</p>
                              <p className="text-sm text-gray-500 dark:text-gray-400">{entry.project?.name || 'Unknown Project'}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-lg font-bold text-gray-800 dark:text-white">{entry.duration_seconds ? `${Math.floor(entry.duration_seconds / 3600)}h ${Math.floor((entry.duration_seconds % 3600) / 60)}m` : 'In Progress'}</p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">{entry.is_currently_active || entry.is_active ? (<span className="text-green-600 dark:text-green-400">● Active</span>) : ('Completed')}</p>
                          </div>
                        </div>
                        <div className="flex items-center space-x-6 text-sm">
                          <div><span className="text-gray-500 dark:text-gray-400">Clock In: </span><span className="font-medium text-gray-800 dark:text-white">{formatTime(entry.clock_in_time)}</span></div>
                          {entry.clock_out_time && (<div><span className="text-gray-500 dark:text-gray-400">Clock Out: </span><span className="font-medium text-gray-800 dark:text-white">{formatTime(entry.clock_out_time)}</span></div>)}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              ) : (
                <div className="text-center py-8 text-gray-500 dark:text-gray-400">No time entries found</div>
              )}
            </TabsContent>

            <TabsContent value="screenshots" className="mt-6">
              <div className="text-center py-16 border rounded-lg bg-gray-50 dark:bg-gray-800/40 text-gray-600 dark:text-gray-300">
                Screenshots (Coming soon via desktop app)
              </div>
            </TabsContent>

            <TabsContent value="activity" className="mt-6">
              <div className="text-center py-16 border rounded-lg bg-gray-50 dark:bg-gray-800/40 text-gray-600 dark:text-gray-300">
                Activity (mouse/keyboard) coming soon via desktop app
              </div>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default TimeSheet;
