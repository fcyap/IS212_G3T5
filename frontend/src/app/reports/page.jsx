"use client";

import { useState, useEffect } from "react";
import { useSession } from "@/components/session-provider";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import toast from "react-hot-toast";
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
  ChevronDown,
  Timer,
  PieChart
} from "lucide-react";

export default function ReportsPage() {
  const { user, role, loading: sessionLoading } = useSession();
  const [reportData, setReportData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [csrfToken, setCsrfToken] = useState(null);
  const [openFilter, setOpenFilter] = useState(null);
  const [reportType, setReportType] = useState('tasks'); // 'tasks' or 'departments'
  
  const [filters, setFilters] = useState({
    startDate: '',
    endDate: '',
    projectIds: [],
    userIds: [],
    departments: [],
    interval: '', // 'week' or 'month' for departmental reports
    view: 'project' // 'project' or 'department' for manual time reports
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

  // Load available filter options (only load users for task reports)
  useEffect(() => {
    if (hasPermission) {
      loadFilterOptions();
    }
  }, [hasPermission, reportType]);

  const loadFilterOptions = async () => {
    try {
      const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
      
      // Always load projects and departments
      const promises = [
        fetch(`${API_URL}/api/reports/filters/projects`, { credentials: 'include' }),
        fetch(`${API_URL}/api/reports/filters/departments`, { credentials: 'include' })
      ];

      // Only load users for task reports
      if (reportType === 'tasks') {
        promises.push(fetch(`${API_URL}/api/reports/filters/users`, { credentials: 'include' }));
      }

      const responses = await Promise.all(promises);
      
      const projectsData = await responses[0].json();
      const deptsData = await responses[1].json();
      const usersData = reportType === 'tasks' && responses[2] ? await responses[2].json() : { data: [] };

      setAvailableFilters({
        projects: projectsData.data || [],
        users: usersData.data || [],
        departments: deptsData.data || []
      });
    } catch (err) {
      console.error('Error loading filter options:', err);
    }
  };

  const toggleProjectFilter = (projectId) => {
    const numericId = Number(projectId);
    if (!Number.isFinite(numericId)) {
      return;
    }

    setFilters(prev => {
      const normalized = (prev.projectIds || [])
        .map(value => Number(value))
        .filter(Number.isFinite);
      const exists = normalized.includes(numericId);
      const next = exists
        ? normalized.filter(id => id !== numericId)
        : [...normalized, numericId];

      return {
        ...prev,
        projectIds: next
      };
    });
  };

  const toggleUserFilter = (userId) => {
    const numericId = Number(userId);
    if (!Number.isFinite(numericId)) {
      return;
    }

    setFilters(prev => {
      const normalized = (prev.userIds || [])
        .map(value => Number(value))
        .filter(Number.isFinite);
      const exists = normalized.includes(numericId);
      const next = exists
        ? normalized.filter(id => id !== numericId)
        : [...normalized, numericId];

      return {
        ...prev,
        userIds: next
      };
    });
  };

  const clearFilters = () => {
    setFilters({
      startDate: '',
      endDate: '',
      projectIds: [],
      userIds: [],
      departments: [],
      interval: '',
      view: 'project'
    });
    setSearchTerms({
      project: '',
      user: '',
      department: ''
    });
    setReportData(null);
  };

  const filteredProjects = availableFilters.projects.filter(p => 
    p.name?.toLowerCase().includes(searchTerms.project.toLowerCase())
  );

  const filteredUsers = availableFilters.users.filter(u => 
    u.name?.toLowerCase().includes(searchTerms.user.toLowerCase()) ||
    u.email?.toLowerCase().includes(searchTerms.user.toLowerCase())
  );

  const filteredDepartments = availableFilters.departments.filter(d =>
    d.toLowerCase().includes(searchTerms.department.toLowerCase())
  );

  const toggleDepartmentFilter = (dept) => {
    setFilters(prev => ({
      ...prev,
      departments: prev.departments.includes(dept)
        ? prev.departments.filter(d => d !== dept)
        : [...prev.departments, dept]
    }));
  };

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
      console.log('[Reports] Report type:', reportType);
      console.log('[Reports] Filters:', filters);

      const endpoint = (() => {
        if (reportType === 'departments') {
          return `${API_URL}/api/reports/departments`;
        }
        if (reportType === 'manual-time') {
          return `${API_URL}/api/reports/time/manual`;
        }
        return `${API_URL}/api/reports/tasks`;
      })();

      const requestBody = (() => {
        if (reportType === 'departments') {
          const payload = {};
          if (filters.departments.length > 0) payload.departmentIds = filters.departments;
          if (filters.startDate) payload.startDate = filters.startDate;
          if (filters.endDate) payload.endDate = filters.endDate;
          if (filters.interval) payload.interval = filters.interval;
          if (filters.projectIds.length > 0) payload.projectIds = filters.projectIds;
          return payload;
        }
        if (reportType === 'manual-time') {
          const payload = {};
          if (filters.projectIds.length > 0) payload.projectIds = filters.projectIds;
          if (filters.departments.length > 0) payload.departments = filters.departments;
          if (filters.startDate) payload.startDate = filters.startDate;
          if (filters.endDate) payload.endDate = filters.endDate;
          payload.view = filters.view || 'project';
          return payload;
        }
        const payload = {};
        if (filters.projectIds.length > 0) payload.projectIds = filters.projectIds;
        if (filters.userIds.length > 0) payload.userIds = filters.userIds;
        if (filters.startDate) payload.startDate = filters.startDate;
        if (filters.endDate) payload.endDate = filters.endDate;
        if (filters.departments.length > 0) payload.departments = filters.departments;
        return payload;
      })();
      
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-csrf-token': freshToken
        },
        credentials: 'include',
        body: JSON.stringify(requestBody)
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to generate report');
      }

      const payload = data.data;
      setReportData(payload);
    } catch (err) {
      console.error('Error generating report:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const exportReport = async (format, options = {}) => {
    const { reportPayload, filenameOverride, silent = false } = options;
    const payload = reportPayload || reportData;

    if (!payload) {
      if (!silent) {
        alert('No report data available to export');
      }
      return;
    }

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

      const requestBody = { reportData: payload };
      if (format !== 'pdf') {
        requestBody.format = format === 'csv' ? 'csv' : 'xlsx';
      }

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-csrf-token': freshToken
        },
        credentials: 'include',
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        throw new Error('Export failed');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;

      // Extract filename from Content-Disposition header
      let filename;
      const contentDisposition = response.headers.get('Content-Disposition');
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename="?([^"]+)"?/);
        if (filenameMatch) {
          filename = filenameMatch[1];
        }
      }

      // Fallback to default naming if header not present
      const extension = format === 'xlsx' ? 'xlsx' : format;
      a.download = filename || filenameOverride || `report-${new Date().toISOString().split('T')[0]}.${extension}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      console.error('Error exporting report:', err);
      if (!silent) {
        alert('Failed to export report');
      }
      toast.error('Failed to export report');
    }
  };

  const formatHours = (hours) => {
    const numeric = Number(hours);
    if (!Number.isFinite(numeric)) {
      return '0.00';
    }
    return numeric.toFixed(2);
  };

  const formatDate = (value) => {
    if (!value) return 'N/A';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return value;
    }
    return date.toLocaleDateString();
  };

  const formatStatusLabel = (status) => {
    if (!status) return 'N/A';
    return status
      .toString()
      .split('_')
      .map(part => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');
  };

  const formatPriorityLabel = (priority) => {
    if (!priority) return 'N/A';
    const text = priority.toString();
    return text.charAt(0).toUpperCase() + text.slice(1);
  };

  const getStatusBadgeClasses = (status) => {
    const normalized = status ? status.toString().toLowerCase() : '';
    if (normalized === 'completed') return 'bg-green-900/50 text-green-300 border-green-700';
    if (normalized === 'in_progress') return 'bg-blue-900/50 text-blue-300 border-blue-700';
    if (normalized === 'blocked') return 'bg-red-900/50 text-red-300 border-red-700';
    return 'bg-yellow-900/50 text-yellow-300 border-yellow-700';
  };

  const getPriorityBadgeClasses = (priority) => {
    const normalized = priority ? priority.toString().toLowerCase() : '';
    if (normalized === 'high') return 'bg-red-900/40 text-red-300 border-red-700';
    if (normalized === 'medium') return 'bg-amber-900/40 text-amber-300 border-amber-700';
    if (normalized === 'low') return 'bg-green-900/40 text-green-300 border-green-700';
    return 'bg-gray-800 text-gray-300 border-gray-600';
  };

  const isManualTime = reportType === 'manual-time';
  const selectedManualView = filters.view || 'project';
  const activeManualView = reportData?.filters?.view || selectedManualView;
  const isManualDepartmentView = isManualTime && selectedManualView === 'department';
  const manualSummary = reportData?.summary;
  const topProject = manualSummary?.byProject?.[0];
  const topDepartment = manualSummary?.byDepartment?.[0];
  const manualEntries = reportData?.entries || [];
  const manualGroups = activeManualView === 'department'
    ? manualSummary?.byDepartment || []
    : manualSummary?.byProject || [];

  const headingTitle = (() => {
    if (reportType === 'manual-time') {
      return 'Logged Time Reports';
    }
    if (reportType === 'departments') {
      return 'Departmental Performance';
    }
    return 'Task & Progress Reports';
  })();

  const headingSubtitle = (() => {
    if (reportType === 'manual-time') {
      return 'Track logged hours by project or department for management reviews';
    }
    if (reportType === 'departments') {
      return 'Compare departmental productivity and completion rates across your organisation';
    }
    return 'Generate comprehensive analytics on task completion and team progress';
  })();

  // Show loading state while checking authentication (after all hooks)
  if (sessionLoading) {
    return (
      <div className="flex h-screen bg-[#1a1a1d] items-center justify-center">
        <div className="text-center">
          <div className="animate-spin w-12 h-12 border-4 border-white border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-gray-400">Loading...</p>
        </div>
      </div>
    )
  }

  // Return null if not authenticated (will be redirected by SessionProvider)
  if (!user) {
    return null
  }

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
                {headingTitle}
              </h1>
              <p className="text-sm sm:text-base text-gray-400 mt-1">{headingSubtitle}</p>
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
                {/* Report Type Selector */}
                <div className="space-y-3">
                  <label className="flex items-center gap-2 text-sm font-semibold text-gray-200">
                    <BarChart3 className="w-4 h-4 text-blue-400" />
                    Report Type
                  </label>
                  <select
                    value={reportType}
                    onChange={(e) => {
                      const nextType = e.target.value;
                      setReportType(nextType);
                      setReportData(null); // Clear existing report data
                      if (nextType === 'manual-time') {
                        setFilters((prev) => ({ ...prev, view: prev.view || 'project' }));
                      }
                    }}
                    className="w-full px-4 py-2.5 bg-[#1a1a1d] border border-gray-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  >
                    <option value="tasks">Task Report</option>
                    <option value="departments">Departmental Performance Report</option>
                    <option value="manual-time">Logged Time Report</option>
                  </select>
                </div>

                {/* Manual Time View Selector */}
                {reportType === 'manual-time' && (
                  <div className="space-y-3">
                    <label className="flex items-center gap-2 text-sm font-semibold text-gray-200">
                      <PieChart className="w-4 h-4 text-cyan-400" />
                      Group By
                    </label>
                    <select
                      value={filters.view}
                      onChange={(e) => {
                        const nextView = e.target.value;
                        setFilters(prev => ({
                          ...prev,
                          view: nextView,
                          projectIds: nextView === 'department' ? [] : prev.projectIds
                        }));
                      }}
                      className="w-full px-4 py-2.5 bg-[#1a1a1d] border border-gray-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                    >
                      <option value="project">Project</option>
                      <option value="department">Department</option>
                    </select>
                  </div>
                )}

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

                {/* Projects / Departments Filter */}
                <div className="space-y-3">
                  <button
                    onClick={() => setOpenFilter(openFilter === 'project' ? null : 'project')}
                    className="w-full flex items-center justify-between text-sm font-semibold text-gray-200"
                  >
                    <span className="flex items-center gap-2">
                      {isManualDepartmentView ? (
                        <PieChart className="w-4 h-4 text-cyan-400" />
                      ) : (
                        <FileText className="w-4 h-4 text-green-400" />
                      )}
                      {isManualDepartmentView ? 'Departments' : 'Projects'}
                    </span>
                    <div className="flex items-center gap-2">
                      {isManualDepartmentView
                        ? filters.departments.length > 0 && (
                            <span className="px-2 py-0.5 bg-cyan-500/20 text-cyan-400 text-xs font-bold rounded-full border border-cyan-500/30">
                              {filters.departments.length}
                            </span>
                          )
                        : filters.projectIds.length > 0 && (
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
                          value={isManualDepartmentView ? searchTerms.department : searchTerms.project}
                          onChange={(e) =>
                            setSearchTerms({
                              ...searchTerms,
                              ...(isManualDepartmentView
                                ? { department: e.target.value }
                                : { project: e.target.value })
                            })
                          }
                          placeholder={isManualDepartmentView ? 'Search departments...' : 'Search projects...'}
                          className="w-full pl-10 pr-4 py-2.5 bg-[#1a1a1d] border border-gray-600 rounded-lg text-white text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                        />
                      </div>
                      <div className="mt-2 max-h-52 overflow-y-auto space-y-1.5 pr-2 custom-scrollbar">
                        {isManualDepartmentView ? (
                          filteredDepartments.length === 0 ? (
                            <div className="text-center py-6">
                              <div className="w-12 h-12 bg-gray-700/30 rounded-full flex items-center justify-center mx-auto mb-2">
                                <PieChart className="w-6 h-6 text-gray-600" />
                              </div>
                              <p className="text-xs text-gray-500">No departments found</p>
                            </div>
                          ) : (
                            filteredDepartments.map((dept) => (
                              <label
                                key={dept}
                                className="flex items-center gap-3 p-2.5 hover:bg-[#1a1a1d] rounded-lg cursor-pointer transition-colors group"
                              >
                                <input
                                  type="checkbox"
                                  checked={filters.departments.includes(dept)}
                                  onChange={() => toggleDepartmentFilter(dept)}
                                  className="w-4 h-4 rounded border-2 border-gray-600 bg-[#1a1a1d] text-cyan-500 focus:ring-2 focus:ring-cyan-500 focus:ring-offset-0 cursor-pointer"
                                />
                                <span className="text-sm text-gray-300 truncate group-hover:text-white transition-colors flex-1">
                                  {dept}
                                </span>
                              </label>
                            ))
                          )
                        ) : filteredProjects.length === 0 ? (
                          <div className="text-center py-6">
                            <div className="w-12 h-12 bg-gray-700/30 rounded-full flex items-center justify-center mx-auto mb-2">
                              <FileText className="w-6 h-6 text-gray-600" />
                            </div>
                            <p className="text-xs text-gray-500">No projects found</p>
                          </div>
                        ) : (
                          filteredProjects.map((project) => (
                            <label
                              key={project.id}
                              className="flex items-center gap-3 p-2.5 hover:bg-[#1a1a1d] rounded-lg cursor-pointer transition-colors group"
                            >
                              <input
                                type="checkbox"
                                checked={filters.projectIds.includes(project.id)}
                                onChange={() => toggleProjectFilter(project.id)}
                                className="w-4 h-4 rounded border-2 border-gray-600 bg-[#1a1a1d] text-blue-600 focus:ring-2 focus:ring-blue-500 focus:ring-offset-0 cursor-pointer"
                              />
                              <span className="text-sm text-gray-300 truncate group-hover:text-white transition-colors flex-1">
                                {project.name}
                              </span>
                            </label>
                          ))
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Users Filter with Enhanced Styling (Only for Task Reports) */}
                {reportType === 'tasks' && (
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
                )}

                {/* Departments Filter (for Departmental Reports) */}
                {reportType === 'departments' && (
                  <div className="space-y-3">
                    <button onClick={() => setOpenFilter(openFilter === 'department' ? null : 'department')} className="w-full flex items-center justify-between text-sm font-semibold text-gray-200">
                      <span className="flex items-center gap-2">
                        <svg className="w-4 h-4 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                        </svg>
                        Departments
                      </span>
                      <div className="flex items-center gap-2">
                        {filters.departments.length > 0 && (
                          <span className="px-2 py-0.5 bg-orange-500/20 text-orange-400 text-xs font-bold rounded-full border border-orange-500/30">
                            {filters.departments.length}
                          </span>
                        )}
                        <ChevronDown className={`w-4 h-4 transition-transform ${openFilter === 'department' ? 'rotate-180' : ''}`} />
                      </div>
                    </button>
                    {openFilter === 'department' && (
                      <div className="pt-2">
                        <div className="relative">
                          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                          <input
                            type="text"
                            value={searchTerms.department}
                            onChange={(e) => setSearchTerms({ ...searchTerms, department: e.target.value })}
                            placeholder="Search departments..."
                            className="w-full pl-10 pr-4 py-2.5 bg-[#1a1a1d] border border-gray-600 rounded-lg text-white text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                          />
                        </div>
                        <div className="mt-2 max-h-52 overflow-y-auto space-y-1.5 pr-2 custom-scrollbar">
                          {filteredDepartments.length === 0 ? (
                            <div className="text-center py-6">
                              <div className="w-12 h-12 bg-gray-700/30 rounded-full flex items-center justify-center mx-auto mb-2">
                                <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                                </svg>
                              </div>
                              <p className="text-xs text-gray-500">No departments found</p>
                            </div>
                          ) : (
                            filteredDepartments.map(dept => (
                              <label key={dept} className="flex items-center gap-3 p-2.5 hover:bg-[#1a1a1d] rounded-lg cursor-pointer transition-colors group">
                                <input
                                  type="checkbox"
                                  checked={filters.departments.includes(dept)}
                                  onChange={() => toggleDepartmentFilter(dept)}
                                  className="w-4 h-4 rounded border-2 border-gray-600 bg-[#1a1a1d] text-orange-600 focus:ring-2 focus:ring-orange-500 focus:ring-offset-0 cursor-pointer"
                                />
                                <span className="text-sm text-gray-300 truncate group-hover:text-white transition-colors flex-1">{dept}</span>
                              </label>
                            ))
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Time Interval (for Departmental Reports) */}
                {reportType === 'departments' && (
                  <div className="space-y-3">
                    <label className="flex items-center gap-2 text-sm font-semibold text-gray-200">
                      <TrendingUp className="w-4 h-4 text-cyan-400" />
                      Time Interval (Optional)
                    </label>
                    <select
                      value={filters.interval}
                      onChange={(e) => setFilters({ ...filters, interval: e.target.value })}
                      className="w-full px-4 py-2.5 bg-[#1a1a1d] border border-gray-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                    >
                      <option value="">No trend analysis</option>
                      <option value="week">Weekly trends</option>
                      <option value="month">Monthly trends</option>
                    </select>
                    <p className="text-xs text-gray-500">Enable to see productivity trends over time</p>
                  </div>
                )}

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
                {/* Manual Time Summary */}
                {reportType === 'manual-time' && reportData.summary && (
                  <div className="bg-[#2a2a2e] border border-gray-700/50 rounded-xl p-6 shadow-lg">
                    <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-3">
                      <div className="p-2 bg-cyan-500/10 rounded-lg">
                        <Timer className="w-5 h-5 text-cyan-400" />
                      </div>
                      Logged Time Overview
                    </h2>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="bg-[#1a1a1d] p-4 rounded-lg border border-cyan-900/30">
                        <p className="text-gray-400 text-sm mb-1">Total Logged Hours</p>
                        <p className="text-3xl font-bold text-cyan-400">{formatHours(reportData.summary.totalHours)}</p>
                      </div>
                      <div className="bg-[#1a1a1d] p-4 rounded-lg border border-blue-900/30">
                        <p className="text-gray-400 text-sm mb-1">Top Project</p>
                        <p className="text-lg font-semibold text-white truncate">
                          {topProject ? topProject.projectName : 'No entries'}
                        </p>
                        <p className="text-sm text-blue-400 mt-1">
                          {topProject ? `${formatHours(topProject.totalHours)} hrs` : '—'}
                        </p>
                      </div>
                      <div className="bg-[#1a1a1d] p-4 rounded-lg border border-purple-900/30">
                        <p className="text-gray-400 text-sm mb-1">Top Department</p>
                        <p className="text-lg font-semibold text-white truncate">
                          {topDepartment ? topDepartment.department : 'No entries'}
                        </p>
                        <p className="text-sm text-purple-400 mt-1">
                          {topDepartment ? `${formatHours(topDepartment.totalHours)} hrs` : '—'}
                        </p>
                      </div>
                    </div>

                    <div className="mt-6 flex flex-wrap items-center gap-3 text-sm text-gray-400">
                      <span className="px-3 py-1 rounded-full border border-gray-600 bg-[#1a1a1d]">
                        View: <span className="text-white font-semibold capitalize ml-1">{activeManualView}</span>
                      </span>
                      {reportData.filters?.startDate && (
                        <span className="px-3 py-1 rounded-full border border-gray-600 bg-[#1a1a1d]">
                          From <span className="text-white font-semibold ml-1">{reportData.filters.startDate}</span>
                        </span>
                      )}
                      {reportData.filters?.endDate && (
                        <span className="px-3 py-1 rounded-full border border-gray-600 bg-[#1a1a1d]">
                          To <span className="text-white font-semibold ml-1">{reportData.filters.endDate}</span>
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {/* Manual Time Grouping */}
                {reportType === 'manual-time' && manualSummary && (
                  <div className="bg-[#2a2a2e] border border-gray-700/50 rounded-xl p-6 shadow-lg">
                    <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-3">
                      <div className="p-2 bg-blue-500/10 rounded-lg">
                        <PieChart className="w-5 h-5 text-blue-400" />
                      </div>
                      {activeManualView === 'department' ? 'Hours by Department' : 'Hours by Project'}
                    </h2>

                    {manualGroups.length === 0 ? (
                      <div className="text-center py-10 text-gray-400">
                        No manual time entries found for the selected filters.
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm min-w-[700px]">
                          <thead className="border-b border-gray-700">
                            <tr>
                              <th className="pb-3 pr-4 text-gray-300 font-medium">
                                {activeManualView === 'department' ? 'Department' : 'Project'}
                              </th>
                              <th className="pb-3 pr-4 text-gray-300 font-medium text-right">Total Hours</th>
                              <th className="pb-3 pr-4 text-gray-300 font-medium text-right">Users</th>
                              <th className="pb-3 text-gray-300 font-medium text-right">Avg Hours/User</th>
                            </tr>
                          </thead>
                          <tbody>
                            {manualGroups.map((group) => (
                              <tr key={activeManualView === 'department' ? group.department : group.projectId} className="border-b border-gray-800 hover:bg-[#1a1a1d]">
                                <td className="py-3 pr-4 text-white font-medium">
                                  {activeManualView === 'department' ? group.department : group.projectName}
                                </td>
                                <td className="py-3 pr-4 text-right text-cyan-400 font-semibold">
                                  {formatHours(group.totalHours)} hrs
                                </td>
                                <td className="py-3 pr-4 text-right text-purple-400">
                                  {group.userCount || 0}
                                </td>
                                <td className="py-3 text-right text-blue-400 font-semibold">
                                  {formatHours(group.avgHoursPerUser || 0)} hrs
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}

                {/* Manual Time Detailed Entries */}
                {reportType === 'manual-time' && manualEntries.length > 0 && (
                  <div className="bg-[#2a2a2e] border border-gray-700/50 rounded-xl p-6 shadow-lg">
                    <div className="flex items-center justify-between mb-6">
                      <h2 className="text-xl font-bold text-white flex items-center gap-3">
                        <div className="p-2 bg-indigo-500/10 rounded-lg">
                          <FileText className="w-5 h-5 text-indigo-400" />
                        </div>
                        Logged Entries
                      </h2>
                      <span className="text-sm text-gray-400">{manualEntries.length} records</span>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-sm min-w-[1020px]">
                        <thead className="border-b border-gray-700">
                          <tr>
                            <th className="pb-3 pr-4 text-gray-300 font-medium">Logged On</th>
                            <th className="pb-3 pr-4 text-gray-300 font-medium">Task ID</th>
                            <th className="pb-3 pr-4 text-gray-300 font-medium">Title</th>
                            <th className="pb-3 pr-4 text-gray-300 font-medium">Project</th>
                            <th className="pb-3 pr-4 text-gray-300 font-medium">Status</th>
                            <th className="pb-3 pr-4 text-gray-300 font-medium">Priority</th>
                            <th className="pb-3 pr-4 text-gray-300 font-medium">Department</th>
                            <th className="pb-3 pr-4 text-gray-300 font-medium">User</th>
                            <th className="pb-3 text-gray-300 font-medium text-right">Hours</th>
                          </tr>
                        </thead>
                        <tbody>
                          {manualEntries.map((entry, index) => (
                            <tr key={`${entry.taskId}-${entry.userId}-${index}`} className="border-b border-gray-800 hover:bg-[#1a1a1d]">
                              <td className="py-3 pr-4 text-white font-medium">{formatDate(entry.loggedAt)}</td>
                              <td className="py-3 pr-4 text-gray-300">{entry.taskId ?? '—'}</td>
                              <td className="py-3 pr-4 text-gray-300 truncate max-w-[180px]" title={entry.taskTitle || 'Untitled task'}>
                                {entry.taskTitle || 'Untitled task'}
                              </td>
                              <td className="py-3 pr-4 text-gray-300">{entry.projectName || 'N/A'}</td>
                              <td className="py-3 pr-4">
                                <span className={`px-2 py-1 rounded text-xs font-medium border ${getStatusBadgeClasses(entry.taskStatus)}`}>
                                  {formatStatusLabel(entry.taskStatus)}
                                </span>
                              </td>
                              <td className="py-3 pr-4">
                                <span className={`px-2 py-1 rounded text-xs font-medium border ${getPriorityBadgeClasses(entry.taskPriority)}`}>
                                  {formatPriorityLabel(entry.taskPriority)}
                                </span>
                              </td>
                              <td className="py-3 pr-4 text-gray-300">{entry.department || 'N/A'}</td>
                              <td className="py-3 pr-4 text-gray-300">{entry.userName || `User #${entry.userId}`}</td>
                              <td className="py-3 text-right text-cyan-400 font-semibold">{formatHours(entry.hours)} hrs</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Summary Section - Enhanced */}
                {reportData.summary && reportType === 'tasks' && (
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

                {/* Departmental Summary Section */}
                {reportData.summary && reportType === 'departments' && (
                  <div className="bg-[#2a2a2e] border border-gray-700/50 rounded-xl p-6 shadow-lg">
                    <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-3">
                      <div className="p-2 bg-green-500/10 rounded-lg">
                        <TrendingUp className="w-5 h-5 text-green-400" />
                      </div>
                      Departmental Performance Overview
                    </h2>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="bg-[#1a1a1d] p-4 rounded-lg border border-gray-700">
                        <p className="text-gray-400 text-sm mb-1">Total Departments</p>
                        <p className="text-3xl font-bold text-white">{reportData.summary.totalDepartments}</p>
                      </div>
                      <div className="bg-[#1a1a1d] p-4 rounded-lg border border-purple-900/30">
                        <p className="text-gray-400 text-sm mb-1">Total Members</p>
                        <p className="text-3xl font-bold text-purple-400">{reportData.summary.totalMembers}</p>
                      </div>
                      <div className="bg-[#1a1a1d] p-4 rounded-lg border border-blue-900/30">
                        <p className="text-gray-400 text-sm mb-1">Total Tasks</p>
                        <p className="text-3xl font-bold text-blue-400">{reportData.summary.totalTasks}</p>
                      </div>
                      <div className="bg-[#1a1a1d] p-4 rounded-lg border border-green-900/30">
                        <p className="text-gray-400 text-sm mb-1">Avg Completion</p>
                        <p className="text-3xl font-bold text-green-400">{reportData.summary.averageCompletionRate}%</p>
                      </div>
                    </div>

                    {/* Insights */}
                    {reportData.insights && (
                      <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="bg-[#1a1a1d] p-4 rounded-lg border border-green-900/30">
                          <p className="text-gray-400 text-xs mb-1">🏆 Most Productive</p>
                          <p className="text-green-400 font-semibold">{reportData.insights.mostProductiveDepartment || 'N/A'}</p>
                        </div>
                        <div className="bg-[#1a1a1d] p-4 rounded-lg border border-orange-900/30">
                          <p className="text-gray-400 text-xs mb-1">📊 Highest Workload</p>
                          <p className="text-orange-400 font-semibold">{reportData.insights.highestWorkloadDepartment || 'N/A'}</p>
                        </div>
                        <div className="bg-[#1a1a1d] p-4 rounded-lg border border-yellow-900/30">
                          <p className="text-gray-400 text-xs mb-1">⚠️ Needs Attention</p>
                          <p className="text-yellow-400 font-semibold">{reportData.insights.leastProductiveDepartment || 'N/A'}</p>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Department Comparison Table */}
                {reportType === 'departments' && reportData.departments && (
                  <div className="bg-[#2a2a2e] border border-gray-700/50 rounded-xl p-6 shadow-lg">
                    <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-3">
                      <div className="p-2 bg-orange-500/10 rounded-lg">
                        <svg className="w-5 h-5 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                        </svg>
                      </div>
                      Department Comparison
                    </h2>

                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-sm min-w-[800px]">
                        <thead className="border-b border-gray-700">
                          <tr>
                            <th className="pb-3 pr-4 text-gray-300 font-medium">Department</th>
                            <th className="pb-3 pr-4 text-gray-300 font-medium text-center">Members</th>
                            <th className="pb-3 pr-4 text-gray-300 font-medium text-center">Total Tasks</th>
                            <th className="pb-3 pr-4 text-gray-300 font-medium text-center">Completed</th>
                            <th className="pb-3 pr-4 text-gray-300 font-medium text-center">In Progress</th>
                            <th className="pb-3 pr-4 text-gray-300 font-medium text-center">Completion %</th>
                            <th className="pb-3 text-gray-300 font-medium text-center">Avg Tasks/Member</th>
                          </tr>
                        </thead>
                        <tbody>
                          {reportData.departments.map((dept) => (
                            <tr key={dept.department} className="border-b border-gray-800 hover:bg-[#1a1a1d]">
                              <td className="py-3 pr-4 text-white font-medium">{dept.department}</td>
                              <td className="py-3 pr-4 text-center text-purple-400">{dept.memberCount}</td>
                              <td className="py-3 pr-4 text-center text-blue-400">{dept.totalTasks}</td>
                              <td className="py-3 pr-4 text-center text-green-400">{dept.statusCounts.completed}</td>
                              <td className="py-3 pr-4 text-center text-yellow-400">{dept.statusCounts.in_progress}</td>
                              <td className="py-3 pr-4 text-center">
                                <span className={`px-2 py-1 rounded text-xs font-medium ${
                                  dept.completionRate >= 70 ? 'bg-green-900/50 text-green-300' :
                                  dept.completionRate >= 40 ? 'bg-yellow-900/50 text-yellow-300' :
                                  'bg-red-900/50 text-red-300'
                                }`}>
                                  {dept.completionRate}%
                                </span>
                              </td>
                              <td className="py-3 text-center text-gray-400">{dept.averageTasksPerMember}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Time Series Trends */}
                {reportType === 'departments' && reportData.timeSeries && reportData.timeSeries.length > 0 && (
                  <div className="bg-[#2a2a2e] border border-gray-700/50 rounded-xl p-6 shadow-lg">
                    <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-3">
                      <div className="p-2 bg-cyan-500/10 rounded-lg">
                        <TrendingUp className="w-5 h-5 text-cyan-400" />
                      </div>
                      Productivity Trends Over Time
                    </h2>

                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-sm min-w-[700px]">
                        <thead className="border-b border-gray-700">
                          <tr>
                            <th className="pb-3 pr-4 text-gray-300 font-medium">Period</th>
                            <th className="pb-3 pr-4 text-gray-300 font-medium text-center">Total Tasks</th>
                            <th className="pb-3 pr-4 text-gray-300 font-medium text-center">Completed</th>
                            <th className="pb-3 pr-4 text-gray-300 font-medium text-center">In Progress</th>
                            <th className="pb-3 pr-4 text-gray-300 font-medium text-center">Pending</th>
                            <th className="pb-3 text-gray-300 font-medium text-center">Completion %</th>
                          </tr>
                        </thead>
                        <tbody>
                          {reportData.timeSeries.map((period) => (
                            <tr key={period.period} className="border-b border-gray-800 hover:bg-[#1a1a1d]">
                              <td className="py-3 pr-4 text-white font-medium">{period.period}</td>
                              <td className="py-3 pr-4 text-center text-blue-400">{period.totalTasks}</td>
                              <td className="py-3 pr-4 text-center text-green-400">{period.statusCounts.completed}</td>
                              <td className="py-3 pr-4 text-center text-yellow-400">{period.statusCounts.in_progress}</td>
                              <td className="py-3 pr-4 text-center text-orange-400">{period.statusCounts.pending}</td>
                              <td className="py-3 text-center">
                                <span className={`px-2 py-1 rounded text-xs font-medium ${
                                  period.completionRate >= 70 ? 'bg-green-900/50 text-green-300' :
                                  period.completionRate >= 40 ? 'bg-yellow-900/50 text-yellow-300' :
                                  'bg-red-900/50 text-red-300'
                                }`}>
                                  {period.completionRate}%
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Detailed Data Table - Enhanced (for task reports only) */}
                {reportType === 'tasks' && (
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
                                  <span className={`px-2 py-1 rounded text-xs font-medium border ${getStatusBadgeClasses(task.status)}`}>
                                    {formatStatusLabel(task.status)}
                                  </span>
                                </td>
                                <td className="py-3 pr-4 w-20 hidden md:table-cell">
                                  <span className={`px-2 py-1 rounded text-xs font-medium border ${getPriorityBadgeClasses(task.priority)}`}>
                                    {formatPriorityLabel(task.priority)}
                                  </span>
                                </td>
                                <td className="py-3 text-gray-400 w-24 hidden lg:table-cell">{task.deadline || 'N/A'}</td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    )}
                  </div>
                </div>
                )}
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
