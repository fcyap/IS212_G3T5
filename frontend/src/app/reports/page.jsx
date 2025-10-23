"use client";

import { useState, useEffect } from "react";
import { useSession } from "@/components/session-provider";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  BarChart3, 
  FileText,
  Download, 
  Filter,
  Calendar,
  TrendingUp,
  Search,
  X,
  RefreshCw,
  ChevronDown
} from "lucide-react";

export default function ReportsPage() {
  const { user, role } = useSession();
  const [reportData, setReportData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [csrfToken, setCsrfToken] = useState(null);
  const [openFilter, setOpenFilter] = useState(null);
  
  const [filters, setFilters] = useState({
    startDate: '',
    endDate: '',
    projectIds: [],
    userIds: [],
    departments: []
  });

  const [searchTerms, setSearchTerms] = useState({
    project: '',
    user: '',
    department: ''
  });

  const [availableFilters, setAvailableFilters] = useState({
    projects: [],
    users: [],
    departments: []
  });

  // Check if user has permission
  const hasPermission = user?.role === 'hr' || user?.role === 'admin';

  // Fetch CSRF token on mount
  useEffect(() => {
    const fetchCsrfToken = async () => {
      try {
        const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
        const response = await fetch(`${API_URL}/csrf-token`, {
          credentials: 'include'
        });
        const data = await response.json();
        console.log('[Reports] CSRF token fetched:', data.csrfToken);
        setCsrfToken(data.csrfToken);
      } catch (err) {
        console.error('Error fetching CSRF token:', err);
      }
    };
    fetchCsrfToken();
  }, []);

  // Refetch CSRF token when user changes (e.g., after login)
  useEffect(() => {
    if (user && !csrfToken) {
      const fetchCsrfToken = async () => {
        try {
          const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
          const response = await fetch(`${API_URL}/csrf-token`, {
            credentials: 'include'
          });
          const data = await response.json();
          console.log('[Reports] CSRF token refetched for user:', data.csrfToken);
          setCsrfToken(data.csrfToken);
        } catch (err) {
          console.error('Error refetching CSRF token:', err);
        }
      };
      fetchCsrfToken();
    }
  }, [user]);

  // Load available filter options
  useEffect(() => {
    if (hasPermission) {
      loadFilterOptions();
    }
  }, [hasPermission]);

  const loadFilterOptions = async () => {
    try {
      const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
      const [projectsRes, usersRes, deptsRes] = await Promise.all([
        fetch(`${API_URL}/api/reports/filters/projects`, { credentials: 'include' }),
        fetch(`${API_URL}/api/reports/filters/users`, { credentials: 'include' }),
        fetch(`${API_URL}/api/reports/filters/departments`, { credentials: 'include' })
      ]);

      const [projects, users, departments] = await Promise.all([
        projectsRes.json(),
        usersRes.json(),
        deptsRes.json()
      ]);

      setAvailableFilters({
        projects: projects.data || [],
        users: users.data || [],
        departments: departments.data || []
      });
    } catch (err) {
      console.error('Error loading filter options:', err);
    }
  };

  const toggleProjectFilter = (projectId) => {
    setFilters(prev => ({
      ...prev,
      projectIds: prev.projectIds.includes(projectId)
        ? prev.projectIds.filter(id => id !== projectId)
        : [...prev.projectIds, projectId]
    }));
  };

  const toggleUserFilter = (userId) => {
    setFilters(prev => ({
      ...prev,
      userIds: prev.userIds.includes(userId)
        ? prev.userIds.filter(id => id !== userId)
        : [...prev.userIds, userId]
    }));
  };

  const clearFilters = () => {
    setFilters({
      startDate: '',
      endDate: '',
      projectIds: [],
      userIds: [],
      departments: []
    });
    setSearchTerms({
      project: '',
      user: '',
      department: ''
    });
  };

  const filteredProjects = availableFilters.projects.filter(p => 
    p.name?.toLowerCase().includes(searchTerms.project.toLowerCase())
  );

  const filteredUsers = availableFilters.users.filter(u => 
    u.name?.toLowerCase().includes(searchTerms.user.toLowerCase()) ||
    u.email?.toLowerCase().includes(searchTerms.user.toLowerCase())
  );

  const generateReport = async () => {
    setLoading(true);
    setError(null);

    try {
      const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
      
      // Fetch fresh CSRF token before generating report
      const csrfResponse = await fetch(`${API_URL}/csrf-token`, {
        credentials: 'include'
      });
      const csrfData = await csrfResponse.json();
      const freshToken = csrfData.csrfToken;
      
      console.log('[Reports] Generating report with fresh CSRF token:', freshToken);
      console.log('[Reports] Filters:', filters);
      
      const response = await fetch(`${API_URL}/api/reports/tasks`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-csrf-token': freshToken
        },
        credentials: 'include',
        body: JSON.stringify(filters)
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to generate report');
      }

      setReportData(data.data);
    } catch (err) {
      console.error('Error generating report:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const exportReport = async (format) => {
    if (!reportData) return;

    try {
      const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
      
      // Fetch fresh CSRF token before export
      const csrfResponse = await fetch(`${API_URL}/csrf-token`, {
        credentials: 'include'
      });
      const csrfData = await csrfResponse.json();
      const freshToken = csrfData.csrfToken;
      
      console.log('[Reports] Fresh CSRF token for export:', freshToken);
      
      const endpoint = format === 'pdf' 
        ? `${API_URL}/api/reports/export/pdf`
        : `${API_URL}/api/reports/export/spreadsheet`;

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-csrf-token': freshToken
        },
        credentials: 'include',
        body: JSON.stringify({ 
          reportData,
          format: format === 'csv' ? 'csv' : 'xlsx'
        })
      });

      if (!response.ok) {
        throw new Error('Export failed');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `report-${new Date().toISOString().split('T')[0]}.${format}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      console.error('Error exporting report:', err);
      alert('Failed to export report');
    }
  };

  if (!hasPermission) {
    return (
      <div className="min-h-screen bg-[#1a1a1d] flex items-center justify-center p-6">
        <Card className="p-8 max-w-md text-center bg-[#2a2a2e] border-gray-700">
          <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <X className="w-8 h-8 text-red-500" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">Access Denied</h2>
          <p className="text-gray-400 mb-4">
            Only HR and Admin staff can access the reports feature.
          </p>
          <p className="text-sm text-gray-500">
            Current role: {user?.role || 'Unknown'}
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-full bg-gradient-to-br from-[#0f0f12] via-[#1a1a1d] to-[#1a1a1d] overflow-y-auto">
      <div className="max-w-[1600px] mx-auto p-3 sm:p-6">
        {/* Header with Gradient */}
        <div className="mb-6 sm:mb-8">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4 mb-3">
            <div className="p-2.5 sm:p-3 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl shadow-lg shadow-blue-500/20">
              <BarChart3 className="w-6 h-6 sm:w-7 sm:h-7 text-white" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent">
                Task & Progress Reports
              </h1>
              <p className="text-sm sm:text-base text-gray-400 mt-1">Generate comprehensive analytics on task completion and team progress</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-4 gap-4 sm:gap-6">
          {/* Enhanced Filters Sidebar */}
          <div className="xl:col-span-1">
            <div className="bg-[#2a2a2e] border border-gray-700/50 rounded-xl shadow-xl xl:sticky xl:top-6 overflow-hidden">
              {/* Filter Header */}
              <div className="bg-gradient-to-r from-gray-800 to-gray-900 p-3 sm:p-4 border-b border-gray-700">
                <div className="flex items-center justify-between">
                  <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                    <Filter className="w-5 h-5 text-blue-400" />
                    Filters
                  </h2>
                  <Button
                    onClick={clearFilters}
                    variant="ghost"
                    size="sm"
                    className="text-gray-400 hover:text-white hover:bg-gray-700/50 transition-colors"
                  >
                    <RefreshCw className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              <div className="p-5 space-y-6">
                {/* Date Range with Enhanced Styling */}
                <div className="space-y-3">
                  <label className="flex items-center gap-2 text-sm font-semibold text-gray-200">
                    <Calendar className="w-4 h-4 text-blue-400" />
                    Date Range
                  </label>
                  <div className="space-y-2">
                    <div className="relative">
                      <input
                        type="date"
                        value={filters.startDate}
                        onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
                        className="w-full px-4 py-2.5 bg-[#1a1a1d] border border-gray-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                        placeholder="Start Date"
                      />
                    </div>
                    <div className="relative">
                      <input
                        type="date"
                        value={filters.endDate}
                        onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
                        className="w-full px-4 py-2.5 bg-[#1a1a1d] border border-gray-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                        placeholder="End Date"
                      />
                    </div>
                  </div>
                </div>

                {/* Projects Filter with Badge */}
                <div className="space-y-3">
                  <button onClick={() => setOpenFilter(openFilter === 'project' ? null : 'project')} className="w-full flex items-center justify-between text-sm font-semibold text-gray-200">
                    <span className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-green-400" />
                      Projects
                    </span>
                    <div className="flex items-center gap-2">
                      {filters.projectIds.length > 0 && (
                        <span className="px-2 py-0.5 bg-blue-500/20 text-blue-400 text-xs font-bold rounded-full border border-blue-500/30">
                          {filters.projectIds.length}
                        </span>
                      )}
                      <ChevronDown className={`w-4 h-4 transition-transform ${openFilter === 'project' ? 'rotate-180' : ''}`} />
                    </div>
                  </button>
                  {openFilter === 'project' && (
                    <div className="pt-2">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                        <input
                          type="text"
                          value={searchTerms.project}
                          onChange={(e) => setSearchTerms({ ...searchTerms, project: e.target.value })}
                          placeholder="Search projects..."
                          className="w-full pl-10 pr-4 py-2.5 bg-[#1a1a1d] border border-gray-600 rounded-lg text-white text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                        />
                      </div>
                      <div className="mt-2 max-h-52 overflow-y-auto space-y-1.5 pr-2 custom-scrollbar">
                        {filteredProjects.length === 0 ? (
                          <div className="text-center py-6">
                            <div className="w-12 h-12 bg-gray-700/30 rounded-full flex items-center justify-center mx-auto mb-2">
                              <FileText className="w-6 h-6 text-gray-600" />
                            </div>
                            <p className="text-xs text-gray-500">No projects found</p>
                          </div>
                        ) : (
                          filteredProjects.map(project => (
                            <label key={project.id} className="flex items-center gap-3 p-2.5 hover:bg-[#1a1a1d] rounded-lg cursor-pointer transition-colors group">
                              <input
                                type="checkbox"
                                checked={filters.projectIds.includes(project.id)}
                                onChange={() => toggleProjectFilter(project.id)}
                                className="w-4 h-4 rounded border-2 border-gray-600 bg-[#1a1a1d] text-blue-600 focus:ring-2 focus:ring-blue-500 focus:ring-offset-0 cursor-pointer"
                              />
                              <span className="text-sm text-gray-300 truncate group-hover:text-white transition-colors flex-1">{project.name}</span>
                            </label>
                          ))
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Users Filter with Enhanced Styling */}
                <div className="space-y-3">
                  <button onClick={() => setOpenFilter(openFilter === 'user' ? null : 'user')} className="w-full flex items-center justify-between text-sm font-semibold text-gray-200">
                    <span className="flex items-center gap-2">
                      <svg className="w-4 h-4 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                      </svg>
                      Users
                    </span>
                    <div className="flex items-center gap-2">
                      {filters.userIds.length > 0 && (
                        <span className="px-2 py-0.5 bg-purple-500/20 text-purple-400 text-xs font-bold rounded-full border border-purple-500/30">
                          {filters.userIds.length}
                        </span>
                      )}
                      <ChevronDown className={`w-4 h-4 transition-transform ${openFilter === 'user' ? 'rotate-180' : ''}`} />
                    </div>
                  </button>
                  {openFilter === 'user' && (
                    <div className="pt-2">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                        <input
                          type="text"
                          value={searchTerms.user}
                          onChange={(e) => setSearchTerms({ ...searchTerms, user: e.target.value })}
                          placeholder="Search users..."
                          className="w-full pl-10 pr-4 py-2.5 bg-[#1a1a1d] border border-gray-600 rounded-lg text-white text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                        />
                      </div>
                      <div className="mt-2 max-h-52 overflow-y-auto space-y-1.5 pr-2 custom-scrollbar">
                        {filteredUsers.length === 0 ? (
                          <div className="text-center py-6">
                            <div className="w-12 h-12 bg-gray-700/30 rounded-full flex items-center justify-center mx-auto mb-2">
                              <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                              </svg>
                            </div>
                            <p className="text-xs text-gray-500">No users found</p>
                          </div>
                        ) : (
                          filteredUsers.map(user => (
                            <label key={user.id} className="flex items-center gap-3 p-2.5 hover:bg-[#1a1a1d] rounded-lg cursor-pointer transition-colors group">
                              <input
                                type="checkbox"
                                checked={filters.userIds.includes(user.id)}
                                onChange={() => toggleUserFilter(user.id)}
                                className="w-4 h-4 rounded border-2 border-gray-600 bg-[#1a1a1d] text-purple-600 focus:ring-2 focus:ring-purple-500 focus:ring-offset-0 cursor-pointer"
                              />
                              <div className="flex-1 truncate">
                                <p className="text-sm text-gray-300 truncate group-hover:text-white transition-colors">{user.name}</p>
                                <p className="text-xs text-gray-500 truncate group-hover:text-gray-400 transition-colors">{user.email}</p>
                              </div>
                            </label>
                          ))
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Generate Button with Enhanced Styling */}
                <div className="pt-4 border-t border-gray-700/50">
                  <Button
                    onClick={generateReport}
                    disabled={loading}
                    className="w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-semibold py-3 rounded-lg shadow-lg shadow-blue-500/20 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loading ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2"></div>
                        Generating Report...
                      </>
                    ) : (
                      <>
                        <BarChart3 className="w-5 h-5 mr-2" />
                        Generate Report
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>
          </div>

          {/* Main Content Area - Enhanced & Responsive */}
          <div className="xl:col-span-3 space-y-6">
            {/* Export Buttons - Enhanced */}
            {reportData && (
              <div className="bg-[#2a2a2e] border border-gray-700/50 rounded-xl p-5 shadow-lg">
                <div className="flex flex-wrap items-center gap-4">
                  <div className="flex items-center gap-2 text-gray-300 font-semibold">
                    <Download className="w-5 h-5 text-blue-400" />
                    <span>Export Report:</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      onClick={() => exportReport('pdf')}
                      className="bg-red-600/10 border border-red-600/30 text-red-400 hover:bg-red-600/20 hover:border-red-600/50 transition-all"
                      size="sm"
                    >
                      <Download className="w-4 h-4 mr-2" />
                      PDF
                    </Button>
                    <Button
                      onClick={() => exportReport('xlsx')}
                      className="bg-green-600/10 border border-green-600/30 text-green-400 hover:bg-green-600/20 hover:border-green-600/50 transition-all"
                      size="sm"
                    >
                      <Download className="w-4 h-4 mr-2" />
                      Excel
                    </Button>
                    <Button
                      onClick={() => exportReport('csv')}
                      className="bg-blue-600/10 border border-blue-600/30 text-blue-400 hover:bg-blue-600/20 hover:border-blue-600/50 transition-all"
                      size="sm"
                    >
                      <Download className="w-4 h-4 mr-2" />
                      CSV
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* Error Message - Enhanced */}
            {error && (
              <div className="bg-red-900/20 border border-red-700/50 rounded-xl p-5 shadow-lg">
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-red-500/20 rounded-lg flex-shrink-0">
                    <X className="w-5 h-5 text-red-400" />
                  </div>
                  <div>
                    <h3 className="text-red-400 font-semibold mb-1">Error Generating Report</h3>
                    <p className="text-red-300/80 text-sm">{error}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Empty State - Enhanced */}
            {!reportData && !error && !loading && (
              <div className="bg-[#2a2a2e] border border-gray-700/50 rounded-xl p-16 text-center shadow-lg">
                <div className="max-w-md mx-auto">
                  <div className="w-20 h-20 bg-gradient-to-br from-blue-500/10 to-purple-500/10 rounded-2xl flex items-center justify-center mx-auto mb-6 border border-blue-500/20">
                    <BarChart3 className="w-10 h-10 text-blue-400" />
                  </div>
                  <h3 className="text-2xl font-bold text-white mb-3">No Report Generated Yet</h3>
                  <p className="text-gray-400 mb-6 leading-relaxed">
                    Configure your filters and click the "Generate Report" button to view comprehensive task analytics and insights.
                  </p>
                  <div className="inline-flex items-center gap-2 text-sm text-blue-400 bg-blue-500/10 px-4 py-2 rounded-lg border border-blue-500/20">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span>Filter by projects, users, and date ranges for detailed insights</span>
                  </div>
                </div>
              </div>
            )}

            {/* Report Results - Enhanced */}
            {reportData && (
              <>
                {/* Summary Section - Enhanced */}
                {reportData.summary && (
                  <div className="bg-[#2a2a2e] border border-gray-700/50 rounded-xl p-6 shadow-lg">
                    <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-3">
                      <div className="p-2 bg-green-500/10 rounded-lg">
                        <TrendingUp className="w-5 h-5 text-green-400" />
                      </div>
                      Summary Statistics
                    </h2>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="bg-[#1a1a1d] p-4 rounded-lg border border-gray-700">
                        <p className="text-gray-400 text-sm mb-1">Total Tasks</p>
                        <p className="text-3xl font-bold text-white">{reportData.summary.totalTasks}</p>
                      </div>
                      <div className="bg-[#1a1a1d] p-4 rounded-lg border border-green-900/30">
                        <p className="text-gray-400 text-sm mb-1">Completed</p>
                        <p className="text-3xl font-bold text-green-500">{reportData.summary.byStatus?.completed || 0}</p>
                      </div>
                      <div className="bg-[#1a1a1d] p-4 rounded-lg border border-blue-900/30">
                        <p className="text-gray-400 text-sm mb-1">In Progress</p>
                        <p className="text-3xl font-bold text-blue-500">{reportData.summary.byStatus?.in_progress || 0}</p>
                      </div>
                      <div className="bg-[#1a1a1d] p-4 rounded-lg border border-yellow-900/30">
                        <p className="text-gray-400 text-sm mb-1">Pending</p>
                        <p className="text-3xl font-bold text-yellow-500">{reportData.summary.byStatus?.pending || 0}</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Detailed Data Table - Enhanced */}
                <div className="bg-[#2a2a2e] border border-gray-700/50 rounded-xl p-6 shadow-lg">
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xl font-bold text-white flex items-center gap-3">
                      <div className="p-2 bg-purple-500/10 rounded-lg">
                        <FileText className="w-5 h-5 text-purple-400" />
                      </div>
                      Task Details
                    </h2>
                    <span className="text-sm text-gray-400">
                      {reportData.tasks?.length || 0} tasks
                    </span>
                  </div>

                  <div className="overflow-x-auto">
                    {reportData.tasks && (
                      <table className="w-full text-left text-sm min-w-[600px]">
                        <thead className="border-b border-gray-700">
                          <tr>
                            <th className="pb-3 pr-4 text-gray-300 font-medium w-16">ID</th>
                            <th className="pb-3 pr-4 text-gray-300 font-medium">Title</th>
                            <th className="pb-3 pr-4 text-gray-300 font-medium">Project</th>
                            <th className="pb-3 pr-4 text-gray-300 font-medium w-24">Status</th>
                            <th className="pb-3 pr-4 text-gray-300 font-medium w-20 hidden md:table-cell">Priority</th>
                            <th className="pb-3 text-gray-300 font-medium w-24 hidden lg:table-cell">Deadline</th>
                          </tr>
                        </thead>
                        <tbody>
                          {reportData.tasks.length === 0 ? (
                            <tr>
                              <td colSpan="4" className="py-8 text-center text-gray-500">
                                No tasks found matching your filters
                              </td>
                            </tr>
                          ) : (
                            reportData.tasks.map((task) => (
                              <tr key={task.id} className="border-b border-gray-800 hover:bg-[#1a1a1d]">
                                <td className="py-3 pr-4 text-gray-400 w-16">#{task.id}</td>
                                <td className="py-3 pr-4 text-white font-medium max-w-0 truncate" title={task.title}>{task.title}</td>
                                <td className="py-3 pr-4 text-gray-400 truncate max-w-32" title={task.project_name || 'N/A'}>{task.project_name || 'N/A'}</td>
                                <td className="py-3 pr-4 w-24">
                                  <span className={`px-2 py-1 rounded text-xs font-medium ${
                                    task.status === 'completed' ? 'bg-green-900/50 text-green-300 border border-green-700' :
                                    task.status === 'in_progress' ? 'bg-blue-900/50 text-blue-300 border border-blue-700' :
                                    task.status === 'blocked' ? 'bg-red-900/50 text-red-300 border border-red-700' :
                                    'bg-yellow-900/50 text-yellow-300 border border-yellow-700'
                                  }`}>
                                    {task.status?.replace('_', ' ')}
                                  </span>
                                </td>
                                <td className="py-3 pr-4 text-gray-400 capitalize w-20 hidden md:table-cell">{task.priority || 'N/A'}</td>
                                <td className="py-3 text-gray-400 w-24 hidden lg:table-cell">{task.deadline || 'N/A'}</td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Custom Scrollbar Styles */}
      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: #1a1a1d;
          border-radius: 3px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #4a4a4e;
          border-radius: 3px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #5a5a5e;
        }
      `}</style>
    </div>
  );
}
