"use client"
import { useCallback, useEffect, useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { TaskCard } from "./task-card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { fetchWithCsrf, getCsrfToken } from "@/lib/csrf"
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from "@/components/ui/select"
import { Trash, Check, X, Plus } from "lucide-react"
import { useKanban } from "@/components/kanban-context"
import { Badge } from "@/components/ui/badge"
import { CommentSection } from "./task-comment/task-comment-section"
import { TaskAttachmentsDisplay } from "./task-attachments-display"
import { FileUploadInput } from "./file-upload-input"
import { useUserSearch } from "@/hooks/useUserSearch"
import { useAuth } from "@/hooks/useAuth"
import { projectService, userService } from "@/lib/api"
import toast from "react-hot-toast"

const priorityChipClasses = {
  Low: "bg-teal-200 text-teal-900",
  Medium: "bg-amber-300 text-amber-950",
  High: "bg-fuchsia-300 text-fuchsia-950",
}

const prettyStatus = (s) => {
  const key = String(s || "").toLowerCase();
  const map = {
    pending: "To do",
    in_progress: "Doing",
    completed: "Completed",
    blocked: "Blocked",
    cancelled: "Cancelled",
  };
  return map[key] ?? cap(key.replace("_", " "));
};

const API = process.env.NEXT_PUBLIC_API_URL
const cap = (s) => (s ? s.toString().charAt(0).toUpperCase() + s.toString().slice(1).toLowerCase() : "")

function rowToCard(r) {
  const workflow = String(r.status || 'pending').toLowerCase();
  const normalizedAssignees =
    Array.isArray(r.assignees) ? r.assignees
      : Array.isArray(r.assigned_to) ? r.assigned_to.map(id => ({ id }))
        : [];

  const recurrence =
    r.recurrence_freq
      ? { freq: r.recurrence_freq, interval: r.recurrence_interval || 1 }
      : null;

  return {
    id: r.id,
    title: r.title ?? '',
    description: r.description || '',
    priority: cap(r.priority) || 'Low',
    workflow,
    deadline: r.deadline || null,
    assignees: normalizedAssignees,  // <-- use this
    tags: Array.isArray(r.tags) ? r.tags : [],
    recurrence,
    projectId: r.project_id ?? null,
  };
}

// --- RecurrencePicker --------------------------------------------
function RecurrencePicker({ value, onChange, disabled = false }) {
  const freq = value?.freq ?? "none";
  const interval = value?.interval ?? 1;

  function setFreq(next) {
    if (next === "none") onChange(null);
    else onChange({ freq: next, interval: interval || 1 });
  }
  function setInterval(next) {
    const n = Math.max(1, Number(next) || 1);
    if (!value) onChange({ freq: "daily", interval: n });
    else onChange({ ...value, interval: n });
  }

  const label =
    freq === "none"
      ? "Does not repeat"
      : `Repeats every ${interval} ${freq === "daily" ? (interval > 1 ? "days" : "day")
        : freq === "weekly" ? (interval > 1 ? "weeks" : "week")
          : (interval > 1 ? "months" : "month")}`;

  return (
    <div className={disabled ? "opacity-60 pointer-events-none" : ""}>
      <label className="block text-xs text-gray-400 mb-1 mt-2">Repeat</label>
      <div className="grid grid-cols-2 gap-2">
        <Select
          value={freq}
          onValueChange={setFreq}
          disabled={disabled}
        >
          <SelectTrigger className="bg-transparent text-gray-100 border-gray-700">
            <SelectValue placeholder="Repeat" />
          </SelectTrigger>
          <SelectContent className="bg-white">
            <SelectItem value="none">None</SelectItem>
            <SelectItem value="daily">Daily</SelectItem>
            <SelectItem value="weekly">Weekly</SelectItem>
            <SelectItem value="monthly">Monthly</SelectItem>
          </SelectContent>
        </Select>

        <Input
          type="number"
          min={1}
          value={interval}
          onChange={(e) => setInterval(e.target.value)}
          className="bg-transparent text-gray-100 border-gray-700"
          disabled={disabled || freq === "none"}
          placeholder="Interval"
        />
      </div>
      <div className="mt-1 text-xs text-gray-400">{label}</div>
    </div>
  );
}
// ------------------------------------------------------------------


export function KanbanBoard({ projectId = null }) {
  const boardProjectId = projectId != null ? Number(projectId) : null;
  const { user: currentUser } = useAuth()
  const [activeProjects, setActiveProjects] = useState([]);
  const [projectLookup, setProjectLookup] = useState({});
  const [projectsLoading, setProjectsLoading] = useState(false);
  const [projectsError, setProjectsError] = useState(null);
  const [usersById, setUsersById] = useState({});

  useEffect(() => {
    let mounted = true;
    async function loadProjects() {
      setProjectsLoading(true);
      setProjectsError(null);
      try {
        const allProjects = await projectService.getAllProjects();
        if (!mounted) return;
        const normalizedProjects = Array.isArray(allProjects) ? allProjects : [];
        const active = normalizedProjects.filter((project) => String(project.status || '').toLowerCase() === 'active');
        const lookupEntries = normalizedProjects
          .map((project) => {
            const id = Number(project.id);
            return Number.isFinite(id) ? [id, project] : null;
          })
          .filter(Boolean);
        const lookup = Object.fromEntries(lookupEntries);
        setActiveProjects(active);
        setProjectLookup(lookup);
      } catch (err) {
        if (!mounted) return;
        console.error('[KanbanBoard] Failed to load projects:', err);
        setProjectsError(err);
        setActiveProjects([]);
        setProjectLookup({});
      } finally {
        if (mounted) setProjectsLoading(false);
      }
    }
    loadProjects();
    return () => {
      mounted = false;
    };
  }, []);

  const ensureProjectLookup = useCallback(async (projectId) => {
    const numericId = Number(projectId);
    if (!Number.isFinite(numericId)) {
      return null;
    }

    if (projectLookup[numericId]) {
      return projectLookup[numericId];
    }

    try {
      const data = await projectService.getProjectById(numericId);

      const projectPayload = data?.project ?? (data?.success === true ? data.project : null);
      const project =
        projectPayload && Number.isFinite(projectPayload?.id)
          ? projectPayload
          : (data && Number.isFinite(data?.id) ? data : null);

      if (project && Number.isFinite(project.id)) {
        setProjectLookup((prev) => ({
          ...prev,
          [project.id]: project
        }));
        return project;
      }
    } catch (err) {
      console.error('[KanbanBoard] Failed to fetch project for lookup:', err);
    }
    return null;
  }, [projectLookup]);
  useEffect(() => {
    if (!currentUser?.id) {
      setUsersById({});
      return;
    }

    const roleLabel = typeof currentUser?.role === 'string'
      ? currentUser.role.toLowerCase()
      : typeof currentUser?.role?.label === 'string'
        ? currentUser.role.label.toLowerCase()
        : '';

    // Only managers need the user directory to evaluate subordinate access
    if (roleLabel !== 'manager') {
      setUsersById({});
      return;
    }

    let active = true;
    (async () => {
      try {
        const users = await userService.getAllUsers();
        if (!active) return;
        const map = Array.isArray(users)
          ? users.reduce((acc, user) => {
              if (user?.id != null) {
                acc[user.id] = user;
              }
              return acc;
            }, {})
          : {};
        setUsersById(map);
      } catch (err) {
        if (!active) return;
        console.error('[KanbanBoard] Failed to load users for RBAC filtering:', err);
        setUsersById({});
      }
    })();
    return () => {
      active = false;
    };
  }, [currentUser?.id, currentUser?.role]);
  async function handleSaveNewTask({ title, description, dueDate, priority, tags, assignees, recurrence, projectId: selectedProjectId, attachments }) {
    if (!currentUser?.id) {
      console.error('[KanbanBoard] Cannot create task without an authenticated user')
      return
    }
    console.log('[KanbanBoard] handleSaveNewTask called', {
      title,
      description,
      dueDate,
      priority,
      tags,
      assignees,
      recurrence,
      selectedProjectId,
      boardProjectId,
      lane: editorLane,
      attachments: attachments?.length || 0
    });
    try {
      const resolvedProjectIdRaw =
        selectedProjectId != null
          ? selectedProjectId
          : boardProjectId;
      const resolvedProjectId =
        resolvedProjectIdRaw != null && Number.isFinite(Number(resolvedProjectIdRaw))
          ? Number(resolvedProjectIdRaw)
          : null;
      console.log('[KanbanBoard] Resolved project id:', { resolvedProjectIdRaw, resolvedProjectId });
      if (resolvedProjectId == null) {
        alert('Please select an active project before creating a task.');
        return;
      }
      const payload = {
        title,
        description: description || null,
        priority: (priority || "Low").toLowerCase(),
        status: editorLane,
        deadline: dueDate || null,
        project_id: resolvedProjectId,
        assigned_to: Array.isArray(assignees) && assignees.length > 0 ? assignees.map(a => a.id) : [currentUser.id],
        tags,
        recurrence: recurrence ?? null,
      };
      console.log('[KanbanBoard] POST /tasks payload:', payload);
      const res = await fetchWithCsrf(`${API}/tasks`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      })
      console.log('[KanbanBoard] POST /tasks status:', res.status);
      if (res.status === 401) {
        alert('Your session has expired. Please sign in again and retry.');
        return;
      }
      if (!res.ok) {
        const { error } = await res.json().catch(() => ({}))
        throw new Error(error || `POST /tasks ${res.status}`)
      }
      const row = await res.json()
      console.log('[KanbanBoard] Created task response:', row);
      
      // Upload attachments if any
      if (attachments && attachments.length > 0) {
        try {
          const formData = new FormData()
          attachments.forEach(file => {
            formData.append('files', file)
          })
          
          const uploadResponse = await fetchWithCsrf(`${API}/api/tasks/${row.id}/files`, {
            method: 'POST',
            body: formData
          })
          
          if (!uploadResponse.ok) {
            console.warn('Failed to upload some attachments')
          } else {
            const uploadResult = await uploadResponse.json()
            if (uploadResult.data?.errors && uploadResult.data.errors.length > 0) {
              console.warn('Some files failed:', uploadResult.data.errors)
            }
          }
        } catch (uploadError) {
          console.error('Error uploading attachments:', uploadError)
        }
      }
      
      const card = rowToCard(row)

      setRawTasks(prev =>
        editorPosition === "top" ? [card, ...prev] : [...prev, card]
      )
      setBanner("Task Successfully Created")
      cancelAddTask()
    } catch (err) {
      console.error("[save task]", err)
      alert(err.message || 'Failed to create task.');
    }
  }
  const [panelTask, setPanelTask] = useState(null)
  const openPanel = (task) => setPanelTask(task)
  const closePanel = () => setPanelTask(null)
  const [rawTasks, setRawTasks] = useState([])
  const [banner, setBanner] = useState("")

  useEffect(() => {
    if (!banner) return
    const t = setTimeout(() => setBanner(""), 2500)
    return () => clearTimeout(t)
  }, [banner])

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`${API}/tasks?archived=false&parent_id=null`, {
          credentials: 'include',
        })
        console.log('[KanbanBoard] GET /tasks status:', res.status);
        if (!res.ok) throw new Error(`GET /tasks ${res.status}`)
        const rows = await res.json()
        console.log('[KanbanBoard] Loaded tasks:', Array.isArray(rows) ? rows.length : 'unknown');
        setRawTasks(rows.map(rowToCard))
      } catch (err) {
        console.error("[load tasks]", err)
      }
    }
    load()
  }, [])

  const currentUserId = currentUser?.id != null ? Number(currentUser.id) : null;
  const rawRoleValue = currentUser?.role;
  const normalizedRole = typeof rawRoleValue === 'string'
    ? rawRoleValue.toLowerCase()
    : typeof rawRoleValue?.label === 'string'
      ? rawRoleValue.label.toLowerCase()
      : '';
  const managerDivision = currentUser?.division ? String(currentUser.division).toLowerCase() : null;
  const managerHierarchySource =
    currentUser?.hierarchy ??
    currentUser?.level ??
    currentUser?.hierarchy_level ??
    currentUser?.role_level ??
    null;
  const hierarchyAsNumber = Number(managerHierarchySource);
  const managerHierarchy = Number.isFinite(hierarchyAsNumber) ? hierarchyAsNumber : null;
  const hasUserDirectory = usersById && Object.keys(usersById).length > 0;
  const accessibleProjectIds = useMemo(
    () =>
      Object.keys(projectLookup || {})
        .map((key) => Number(key))
        .filter(Number.isFinite),
    [projectLookup]
  );

  const visibleTasks = useMemo(() => {
    if (!Array.isArray(rawTasks)) {
      return [];
    }
    if (!currentUserId || !normalizedRole) {
      return rawTasks;
    }
    if (normalizedRole === 'admin') {
      return rawTasks;
    }

    const extractAssigneeIds = (task) => {
      if (Array.isArray(task?.assignees) && task.assignees.length) {
        return task.assignees
          .map((assignee) => Number(
            typeof assignee === 'object' ? assignee?.id ?? assignee?.user_id : assignee
          ))
          .filter(Number.isFinite)
          .map((value) => Math.trunc(value));
      }

      const raw = Array.isArray(task?.assigned_to)
        ? task.assigned_to
        : task?.assigned_to != null
          ? [task.assigned_to]
          : [];

      return raw
        .map((value) => Number(value))
        .filter(Number.isFinite)
        .map((value) => Math.trunc(value));
    };

    if (normalizedRole === 'manager') {
      return rawTasks.filter((task) => {
        const assigneeIds = extractAssigneeIds(task);
        if (!assigneeIds.length) {
          return false;
        }

        if (assigneeIds.includes(currentUserId)) {
          return true;
        }

        if (!hasUserDirectory || !managerDivision) {
          return false;
        }

        return assigneeIds.some((assigneeId) => {
          const assignee = usersById[assigneeId];
          if (!assignee) return false;

          const subordinateDivision = assignee?.division ? String(assignee.division).toLowerCase() : null;
          if (!subordinateDivision || subordinateDivision !== managerDivision) {
            return false;
          }

          const subordinateHierarchySource =
            assignee?.hierarchy ??
            assignee?.level ??
            assignee?.hierarchy_level ??
            assignee?.role_level ??
            null;
          const subordinateHierarchy = Number(subordinateHierarchySource);
          const comparable =
            managerHierarchy != null &&
            Number.isFinite(managerHierarchy) &&
            Number.isFinite(subordinateHierarchy);

          return comparable ? subordinateHierarchy < managerHierarchy : true;
        });
      });
    }

    // Staff: show tasks they are assigned to or within accessible projects
    return rawTasks.filter((task) => {
      const assigneeIds = extractAssigneeIds(task);
      if (assigneeIds.includes(currentUserId)) {
        return true;
      }

      const projectId = Number(task.projectId ?? task.project_id);
      if (
        Number.isFinite(projectId) &&
        accessibleProjectIds.includes(projectId)
      ) {
        return true;
      }

      return false;
    });
  }, [rawTasks, currentUserId, normalizedRole, usersById, hasUserDirectory, managerDivision, managerHierarchy, accessibleProjectIds]);

  useEffect(() => {
    if (!panelTask) return;
    const isVisible = visibleTasks.some((task) => task.id === panelTask.id);
    if (!isVisible) {
      setPanelTask(null);
    }
  }, [panelTask, visibleTasks]);

  const { isAdding, editorPosition, startAddTask, cancelAddTask, editorLane } = useKanban()
  const todo = visibleTasks.filter(t => t.workflow === "pending")
  const doing = visibleTasks.filter(t => t.workflow === "in_progress")
  const done = visibleTasks.filter(t => t.workflow === "completed")
  const blocked = visibleTasks.filter(t => t.workflow === "blocked")

  return (
    <div className="flex-1 bg-[#1a1a1d] p-6">
      {banner && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50">
          <div className="rounded-md bg-emerald-600 px-4 py-2 text-white shadow-lg ring-1 ring-black/10">
            {banner}
          </div>
        </div>
      )}
      <div className="overflow-x-auto">
        <div className="flex gap-6 w-max flex-nowrap">

          {/* To do Column */}
          <div className="w-[360px] flex-none space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h2 className="text-white font-medium">To do</h2>
                <span className="bg-gray-600 text-gray-300 text-xs px-2 py-1 rounded-full">
                  {todo.length + (isAdding && editorLane === "pending" ? 1 : 0)}
                </span>

              </div>
            </div>

            <div className="space-y-3">
              {isAdding && editorLane === "pending" && editorPosition === "top" && (
                <EditableTaskCard
                  onCancel={cancelAddTask}
                  onSave={handleSaveNewTask}
                  defaultProjectId={boardProjectId}
                  projects={activeProjects}
                  projectsLoading={projectsLoading}
                  projectsError={projectsError}
                />
              )}

              {todo.map((t) => (
                <TaskCard
                  key={t.id ?? `${t.title}-${t.deadline}`}
                  taskId={t.id}
                  title={t.title}
                  description={t.description}
                  priority={t.priority}
                  assignees={t.assignees}
                  deadline={t.deadline}
                  tags={t.tags}
                  status={t.workflow}
                  onClick={() => openPanel(t)}
                />
              ))}

              {isAdding && editorLane === "pending" && editorPosition === "bottom" && (
                <EditableTaskCard
                  onCancel={cancelAddTask}
                  onSave={handleSaveNewTask}
                  defaultProjectId={boardProjectId}
                  projects={activeProjects}
                  projectsLoading={projectsLoading}
                  projectsError={projectsError}
                />
              )}

              {!isAdding && (
                <Button
                  onClick={() => startAddTask("bottom", "pending")}
                  variant="ghost"
                  className="w-full text-gray-400 hover:text-white hover:bg-gray-700 border-2 border-dashed border-gray-600 hover:border-gray-500 py-8"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add task
                </Button>
              )}
            </div>
          </div>

          {/* Doing Column */}
          <div className="w-[360px] flex-none space-y-4">
            <div className="flex items-center gap-2">
              <h2 className="text-white font-medium">Doing</h2>
              <span className="bg-gray-600 text-gray-300 text-xs px-2 py-1 rounded-full">
                {doing.length + (isAdding && editorLane === "in_progress" ? 1 : 0)}
              </span>

            </div>
            <div className="space-y-3">
              {isAdding && editorLane === "in_progress" && editorPosition === "top" && (
                <EditableTaskCard
                  onCancel={cancelAddTask}
                  onSave={handleSaveNewTask}
                  defaultProjectId={boardProjectId}
                  projects={activeProjects}
                  projectsLoading={projectsLoading}
                  projectsError={projectsError}
                />
              )}

              {doing.map((t) => (
                <TaskCard
                  key={t.id ?? `${t.title}-${t.deadline}`}
                  taskId={t.id}
                  title={t.title}
                  description={t.description}
                  priority={t.priority}
                  assignees={t.assignees}
                  deadline={t.deadline}
                  tags={t.tags}
                  status={t.workflow}
                  onClick={() => openPanel(t)}
                />
              ))}

              {isAdding && editorLane === "in_progress" && editorPosition === "bottom" && (
                <EditableTaskCard
                  onCancel={cancelAddTask}
                  onSave={handleSaveNewTask}
                  defaultProjectId={boardProjectId}
                  projects={activeProjects}
                  projectsLoading={projectsLoading}
                  projectsError={projectsError}
                />
              )}

              {!isAdding && (
                <Button
                  onClick={() => startAddTask("bottom", "in_progress")}
                  variant="ghost"
                  className="w-full text-gray-400 hover:text-white hover:bg-gray-700 border-2 border-dashed border-gray-600 hover:border-gray-500 py-8"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add task
                </Button>
              )}

            </div>
          </div>

          {/* Done Column */}
          <div className="w-[360px] flex-none space-y-4">
            <div className="flex items-center gap-2">
              <h2 className="text-white font-medium">Done</h2>
              <span className="bg-gray-600 text-gray-300 text-xs px-2 py-1 rounded-full">
                {done.length + (isAdding && editorLane === "completed" ? 1 : 0)}
              </span>
            </div>
            <div className="space-y-3">
              {isAdding && editorLane === "completed" && editorPosition === "top" && (
                <EditableTaskCard
                  onCancel={cancelAddTask}
                  onSave={handleSaveNewTask}
                  defaultProjectId={boardProjectId}
                  projects={activeProjects}
                  projectsLoading={projectsLoading}
                  projectsError={projectsError}
                />
              )}
              {done.map((t) => (
                <TaskCard
                  key={t.id ?? `${t.title}-${t.deadline}`}
                  taskId={t.id}
                  title={t.title}
                  description={t.description}
                  priority={t.priority}
                  assignees={t.assignees}
                  deadline={t.deadline}
                  tags={t.tags}
                  status={t.workflow}
                  onClick={() => openPanel(t)}
                />
              ))}
              {isAdding && editorLane === "completed" && editorPosition === "bottom" && (
                <EditableTaskCard
                  onCancel={cancelAddTask}
                  onSave={handleSaveNewTask}
                  defaultProjectId={boardProjectId}
                  projects={activeProjects}
                  projectsLoading={projectsLoading}
                  projectsError={projectsError}
                />
              )}

              {!isAdding && (
                <Button
                  onClick={() => startAddTask("bottom", "completed")}
                  variant="ghost"
                  className="w-full text-gray-400 hover:text-white hover:bg-gray-700 border-2 border-dashed border-gray-600 hover:border-gray-500 py-8"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add task
                </Button>
              )}

            </div>
          </div>
          {/* Blocked Column */}
          <div className="w-[360px] flex-none space-y-4">
            <div className="flex items-center gap-2">
              <h2 className="text-white font-medium">Blocked</h2>
              <span className="bg-gray-600 text-gray-300 text-xs px-2 py-1 rounded-full">
                {blocked.length + (isAdding && editorLane === "blocked" ? 1 : 0)}
              </span>
            </div>

            <div className="space-y-3">
              {isAdding && editorLane === "blocked" && editorPosition === "top" && (
                <EditableTaskCard
                  onCancel={cancelAddTask}
                  onSave={handleSaveNewTask}
                  defaultProjectId={boardProjectId}
                  projects={activeProjects}
                  projectsLoading={projectsLoading}
                  projectsError={projectsError}
                />
              )}

              {blocked.map((t) => (
                <TaskCard
                  key={t.id ?? `${t.title}-${t.deadline}`}
                  taskId={t.id}
                  title={t.title}
                  description={t.description}
                  priority={t.priority}
                  assignees={t.assignees}
                  deadline={t.deadline}
                  tags={t.tags}
                  status={t.workflow}
                  onClick={() => openPanel(t)}
                />
              ))}

              {isAdding && editorLane === "blocked" && editorPosition === "bottom" && (
                <EditableTaskCard
                  onCancel={cancelAddTask}
                  onSave={handleSaveNewTask}
                  defaultProjectId={boardProjectId}
                  projects={activeProjects}
                  projectsLoading={projectsLoading}
                  projectsError={projectsError}
                />
              )}

              {/* {!isAdding && (
      <Button
        onClick={() => startAddTask("bottom", "blocked")}
        variant="ghost"
        className="w-full text-gray-400 hover:text-white hover:bg-gray-700 border-2 border-dashed border-gray-600 hover:border-gray-500 py-8"
      >
        <Plus className="w-4 h-4 mr-2" />
        Add task
      </Button>
    )} */}
            </div>
          </div>

        </div></div>
      {panelTask && (
        <TaskSidePanel
          task={panelTask}
          projectLookup={projectLookup}
          projectsLoading={projectsLoading}
          projectsError={projectsError}
          ensureProject={ensureProjectLookup}
          onClose={closePanel}
          onSave={async (patch) => {
            try {
              // Convert assignees (array of user objects) to assigned_to (array of user IDs)
              const assigned_to = Array.isArray(patch.assignees)
                ? Array.from(
                    new Set(
                      patch.assignees
                        .map((assignee) => {
                          const raw =
                            assignee && typeof assignee === 'object'
                              ? assignee.id ?? assignee.user_id ?? assignee.userId ?? null
                              : assignee;
                          const numeric = Number(raw);
                          return Number.isFinite(numeric) ? Math.trunc(numeric) : null;
                        })
                        .filter((value) => value !== null)
                    )
                  )
                : [];
              const payload = {
                title: patch.title,
                description: patch.description || null,
                priority: patch.priority,
                status: patch.status,
                deadline: patch.deadline || null,
                tags: patch.tags || [],
                assigned_to,
                recurrence: patch.recurrence ?? null,
              };
              console.log('[KanbanBoard] Sending payload to backend:', payload);
              const res = await fetchWithCsrf(`${API}/tasks/${panelTask.id}`, {
                method: "PUT",
                headers: {
                  "Content-Type": "application/json",
                },
                body: JSON.stringify(payload),
              })
              if (!res.ok) {
                const { error } = await res.json().catch(() => ({}))
                throw new Error(error || `PUT /tasks/${panelTask.id} ${res.status}`)
              }
              const row = await res.json()
              console.log("[kanban board]", row);
              const updated = rowToCard(row)
              setRawTasks((prev) => prev.map((t) => (t.id === updated.id ? updated : t)))
              closePanel()
            } catch (e) {
              console.error("[update task]", e)
              alert(e.message)
            }
          }}
          onDeleted={(id) => {
            setRawTasks((prev) => prev.filter((t) => t.id !== id))
            closePanel()
          }}
        />
      )}
    </div>
  )
}


function TaskSidePanel({ task, projectLookup = {}, projectsLoading = false, projectsError = null, ensureProject = async () => null, onClose, onSave, onDeleted, nested = false }) {
  const [childPanelTask, setChildPanelTask] = useState(null);
  const { user: currentUser } = useAuth()
  const currentUserId = currentUser?.id
  console.log('[TaskSidePanel] opened for task:', task);
  const normalizedRole =
    typeof currentUser?.role === 'string'
      ? currentUser.role.toLowerCase()
      : typeof currentUser?.role?.label === 'string'
        ? currentUser.role.label.toLowerCase()
        : '';
  const isManager = normalizedRole === 'manager' || normalizedRole === 'admin';
  const isSelfAssignee =
    Array.isArray(task.assignees) &&
    currentUserId != null &&
    task.assignees.some((a) => a.id === currentUserId);
  const canEdit = isManager || isSelfAssignee;
  const isCreator = task.creator_id != null && currentUserId === task.creator_id;
  const canAddAssignees = canEdit;
  const canRemoveAssignees = isManager;
  const MAX_ASSIGNEES = 5
  const [title, setTitle] = useState(task.title || "");
  const [description, setDescription] = useState(task.description || "");
  const [priority, setPriority] = useState(task.priority || "Low");
  const [status, setStatus] = useState(task.workflow || "pending");
  const [deadline, setDeadline] = useState(task.deadline || "");
  const [tags, setTags] = useState(Array.isArray(task.tags) ? task.tags : []);
  const [tagInput, setTagInput] = useState("");
  const [assignees, setAssignees] = useState(Array.isArray(task.assignees) ? task.assignees : []);
  const [recurrence, setRecurrence] = useState(task.recurrence ?? null);
  const [attachments, setAttachments] = useState([]);
  const normalizedProjectId = Number.isFinite(Number(task.projectId)) ? Number(task.projectId) : null;
  const projectEntry = normalizedProjectId != null ? projectLookup[normalizedProjectId] : null;
  const [projectName, setProjectName] = useState(projectEntry?.name ?? null);

  // Subtasks
  const [subtasks, setSubtasks] = useState([]);
  const [isSubtaskOpen, setIsSubtaskOpen] = useState(false);

  useEffect(() => {
    if (projectEntry?.name) {
      setProjectName(projectEntry.name);
    }
  }, [projectEntry?.name]);

  useEffect(() => {
    if (projectEntry?.name) {
      return;
    }
    if (!normalizedProjectId) {
      return;
    }

    let active = true;
    ensureProject(normalizedProjectId)
      .then((project) => {
        if (!active) return;
        if (project?.name) {
          setProjectName(project.name);
        }
      })
      .catch((err) => {
        console.error('[TaskSidePanel] ensureProject failed:', err);
      });

    return () => {
      active = false;
    };
  }, [ensureProject, normalizedProjectId, projectEntry?.name]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await fetchWithCsrf(`${API}/tasks?archived=false&parent_id=${task.id}`);
        if (!res.ok) throw new Error(`GET /tasks ${res.status}`);
        const rows = await res.json();
        console.log('[TaskSidePanel] initial subtasks load status:', res.status, 'count:', Array.isArray(rows) ? rows.length : 'unknown');
        // rows already have assignees hydrated by backend; if you map, keep tags/assignees as you do elsewhere
        if (mounted) setSubtasks(rows.map(rowToCard));
      } catch (e) {
        console.error('[load subtasks]', e);
      }
    })();
    return () => { mounted = false; };
  }, [task.id]);

  async function loadSubtasks() {
    try {
      // Prefer backend filter: /tasks?parent_id=ID
      const res = await fetchWithCsrf(`${API}/tasks?parent_id=${task.id}`);
      if (!res.ok) throw new Error(`GET /tasks?parent_id=${task.id} ${res.status}`);
      const rows = await res.json();
      console.log('[TaskSidePanel] reload subtasks status:', res.status, 'count:', Array.isArray(rows) ? rows.length : 'unknown');
      setSubtasks(Array.isArray(rows) ? rows : []);
    } catch (err) {
      console.error("[load subtasks]", err);
      // Fallback: fetch all then filter if your backend doesn't support parent_id
      try {
        const resAll = await fetchWithCsrf(`${API}/tasks`);
        const rowsAll = await resAll.json();
        setSubtasks((rowsAll || []).filter((r) => r.parent_id === task.id));
      } catch (e) {
        console.error("[load subtasks fallback]", e);
        setSubtasks([]);
      }
    }
  }

  const {
    query: userSearch,
    results: userSearchResults,
    loading: loadingUsers,
    search: searchUsers,
    clear: clearUserSearch,
  } = useUserSearch({ canSearch: canAddAssignees, minQueryLength: 1 })

  function handleUserSearchInput(e) {
    if (!canAddAssignees || assignees.length >= MAX_ASSIGNEES) return;
    const value = e.target.value;
    console.log('[AssigneeSearch] (input onChange) value:', value);
    searchUsers(value);
  }

  const canSave = (canEdit || isManager) && title.trim().length > 0 && priority && assignees.length <= MAX_ASSIGNEES;
  function addTagFromInput() {
    if (!canEdit) return;
    const t = tagInput.trim();
    if (!t) return;
    if (!tags.includes(t)) setTags((prev) => [...prev, t]);
    setTagInput("");
  }

  function removeTagAt(idx) {
    if (!canEdit) return;
    setTags((prev) => prev.filter((_, i) => i !== idx));
  }

  function addAssignee(user) {
    if (!canAddAssignees) return;
    setAssignees((prev) => {
      if (prev.length >= MAX_ASSIGNEES || prev.some((a) => a.id === user.id)) return prev;
      return [...prev, user];
    });
    clearUserSearch();
  }

  function removeAssignee(userId) {
    if (!canRemoveAssignees) return;
    setAssignees((prev) => {
      if (prev.length <= 1) return prev;
      return prev.filter((a) => a.id !== userId);
    });
  }

  async function handleDelete() {
    try {
      const res = await fetchWithCsrf(`${API}/tasks/${task.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ archived: true }),
      });
      if (!res.ok) {
        const { error } = await res.json().catch(() => ({}));
        throw new Error(error || `PUT /tasks/${task.id} ${res.status}`);
      }
      onDeleted?.(task.id);
    } catch (e) {
      console.error("[archive task]", e);
      alert(e.message);
    }
  }

  return (
    <>
      {childPanelTask && (
        <TaskSidePanel
          task={childPanelTask}
          projectLookup={projectLookup}
          projectsLoading={projectsLoading}
          projectsError={projectsError}
          ensureProject={ensureProjectLookup}
          onClose={() => setChildPanelTask(null)}
          onSave={async (patch) => {
            const assigned_to = Array.isArray(patch.assignees)
              ? patch.assignees.map(a => a.id)
              : [];
            const payload = {
              title: patch.title,
              description: patch.description || null,
              priority: patch.priority,
              status: patch.status,
              deadline: patch.deadline || null,
              tags: patch.tags || [],
              assigned_to,
              recurrence: patch.recurrence ?? null,
            };
            try {
              const res = await fetchWithCsrf(`${API}/tasks/${childPanelTask.id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
              });
              if (!res.ok) {
                const { error } = await res.json().catch(() => ({}));
                throw new Error(error || `PUT /tasks/${childPanelTask.id} ${res.status}`);
              }
              const row = await res.json();
              setSubtasks(prev => prev.map(s => (s.id === row.id ? rowToCard(row) : s)));
              setChildPanelTask(null);
            } catch (e) {
              console.error("[update subtask]", e);
              alert(e.message);
            }
          }}
          onDeleted={(id) => {
            setSubtasks(prev => prev.filter(s => s.id !== id));
            setChildPanelTask(null);
          }}
          nested
        />
      )}
      <div className={nested ? "fixed inset-0 z-50" : "fixed inset-0 z-40"}>
        {/* Backdrop */}
        <div className="absolute inset-0 bg-black/40" onClick={onClose} />
        {/* Panel */}
        <div className="absolute right-0 top-0 h-full w-[420px] bg-[#1f2023] border-l border-gray-700 p-6 overflow-y-auto">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-white text-lg font-semibold">Edit task</h3>
            <button onClick={onClose} className="text-gray-300 hover:text-white text-xl leading-none">×</button>
          </div>

          <div className="mb-4">
            <label className="block text-xs text-gray-400 mb-1">Project</label>
            <div className="text-sm text-gray-100">
              {projectsLoading && <span>Loading project…</span>}
              {!projectsLoading && normalizedProjectId == null && (
                <span className="text-xs text-gray-500">No project assigned.</span>
              )}
              {!projectsLoading && normalizedProjectId != null && projectName && (
                <span className="font-medium">
                  {projectName}
                </span>
              )}
              {!projectsLoading && normalizedProjectId != null && !projectName && (
                <span className="text-xs text-red-400">
                  {projectsError ? 'Unable to load project details.' : 'Project not accessible.'}
                </span>
              )}
            </div>
          </div>

          {!canEdit && (
            <div className="mb-4 rounded-md border border-amber-600/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
              You can review this task but do not have edit permissions.
            </div>
          )}

          <div className="space-y-4">
            {/* Title */}
            <div>
              <label className="block text-xs text-gray-400 mb-1">Title</label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="bg-transparent text-gray-100 border-gray-700"
                disabled={!canEdit}
              />
            </div>

            {/* Description */}
            <div>
              <label className="block text-xs text-gray-400 mb-1">Description</label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
                className="bg-transparent text-gray-100 border-gray-700"
                disabled={!canEdit}
              />
            </div>

            {/* Attachments */}
            <TaskAttachmentsDisplay taskId={task.id} />

            {/* Priority */}
            <div>
              <label className="block text-xs text-gray-400 mb-1">Priority</label>
              <Select value={priority} onValueChange={setPriority} disabled={!canEdit}>
                <SelectTrigger className="bg-transparent text-gray-100 border-gray-700">
                  <SelectValue placeholder="Select priority" />
                </SelectTrigger>
                <SelectContent className="bg-white">
                  {["Low", "Medium", "High"].map((p) => (
                    <SelectItem key={p} value={p}>
                      <span className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ${priorityChipClasses[p]}`}>{p}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {/* Tags */}
            <div>
              <label className="block text-xs text-gray-400">Tags</label>

              {tags.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {tags.map((t, i) => (
                    <span
                      key={`${t}-${i}`}
                      className="inline-flex items-center rounded-md px-2 py-0.5 mb-1 text-xs font-medium bg-gray-700 text-gray-200"
                    >
                      {t}
                      <button
                        type="button"
                        className="ml-1 text-gray-300 hover:text-white disabled:opacity-50"
                        onClick={() => canEdit && removeTagAt(i)}
                        disabled={!canEdit}
                        aria-label={`Remove ${t}`}
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>

              )}

              <input
                className="mt-1 w-full bg-transparent text-gray-100 border border-gray-700 rounded-md px-2 py-1 text-sm placeholder:text-gray-500 focus:outline-none focus:ring-1 focus:ring-gray-500"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === ",") {
                    e.preventDefault()
                    addTagFromInput()
                  }
                  if (e.key === "Backspace" && tagInput === "" && tags.length) {
                    removeTagAt(tags.length - 1)
                  }
                }}
                disabled={!canEdit}
                placeholder="Type a tag and press Enter (or comma)"
              />
            </div>

            {/* Status */}
            <div>
              <label className="block text-xs text-gray-400 mb-1">Status</label>
              <Select value={status} onValueChange={setStatus} disabled={!canEdit}>
                <SelectTrigger className="bg-transparent text-gray-100 border-gray-700">
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent className="bg-white">
                  <SelectItem value="pending">To do</SelectItem>
                  <SelectItem value="in_progress">Doing</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="blocked">Blocked</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {/* Assignees */}
            <div>
              <label className="block text-xs text-gray-400 mb-1">Assignees</label>
              <div className="mb-2">
                <input
                  type="text"
                  className="w-full bg-transparent text-gray-100 border border-gray-700 rounded-md px-2 py-1 text-sm placeholder:text-gray-500 focus:outline-none focus:ring-1 focus:ring-gray-500 disabled:opacity-60"
                  placeholder="Search users by name or email..."
                  value={userSearch}
                  onChange={handleUserSearchInput}
                  aria-busy={loadingUsers ? 'true' : 'false'}
                  autoComplete="off"
                  disabled={!canAddAssignees || assignees.length >= MAX_ASSIGNEES}
                />
                {canAddAssignees && assignees.length < MAX_ASSIGNEES && userSearchResults.length > 0 && (
                  <div className="absolute z-50 bg-[#23232a] border border-gray-700 rounded-md mt-1 w-full max-h-48 overflow-y-auto shadow-lg">
                    {userSearchResults.map((u) => (
                      <div
                        key={u.id}
                        className="px-3 py-2 hover:bg-gray-700 cursor-pointer text-gray-100"
                        onClick={() => addAssignee(u)}
                      >
                        <span className="font-medium">{u.name}</span>
                        <span className="ml-2 text-xs text-gray-400">{u.email}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              {assignees.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {assignees.map((a) => (
                    <Badge
                      key={a.id}
                      className="px-2 py-0.5 text-xs font-medium bg-gray-700 text-gray-200 flex items-center"
                      title={a.name}
                    >
                      {a.name}
                      {canRemoveAssignees && (
                        <button
                          type="button"
                          className="ml-1 text-gray-300 hover:text-white disabled:opacity-60"
                          onClick={() => removeAssignee(a.id)}
                          aria-label={`Remove ${a.name}`}
                          disabled={assignees.length <= 1}
                        >
                          ×
                        </button>
                      )}
                    </Badge>
                  ))}
                </div>
              ) : (
                <span className="text-xs text-gray-500">No assignees</span>
              )}
              {canAddAssignees && assignees.length >= MAX_ASSIGNEES && (
                <p className="text-xs text-gray-500 mt-2">You can assign up to {MAX_ASSIGNEES} members.</p>
              )}
              {canRemoveAssignees && assignees.length === 1 && (
                <p className="text-xs text-amber-400 mt-2">At least one assignee is required. Add another member before removing the last one.</p>
              )}
            </div>
            {/* Subtasks */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-xs text-gray-400">Subtasks</label>
                <Button
                  type="button"
                  className="bg-gray-700 hover:bg-gray-600 text-white h-8 px-3"
                  onClick={() => setIsSubtaskOpen(true)}
                  disabled={!canEdit}
                >
                  + Add subtask
                </Button>
              </div>

              {/* Table: Name + Status */}
              {subtasks.length > 0 ? (
                <div className="overflow-hidden rounded-md border border-gray-700">
                  <table className="w-full text-sm">
                    <thead className="bg-[#222428] text-gray-300">
                      <tr>
                        <th className="text-left px-3 py-2 font-medium">Name</th>
                        <th className="text-left px-3 py-2 font-medium">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-700">
                      {subtasks.map((st) => (
                        <tr key={st.id} className="hover:bg-[#25272c]">
                          <td className="px-3 py-2">
                            <button
                              type="button"
                              className="text-left text-gray-100 hover:underline"
                              onClick={() => setChildPanelTask(st)}
                              title="Open subtask"
                            >
                              {st.title}
                            </button>
                          </td>                        <td className="px-3 py-2 text-gray-300">
                            {prettyStatus(st.workflow || st.status || "pending")}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-xs text-gray-500">No subtasks yet.</div>
              )}

              {/* Modal */}
              {isSubtaskOpen && (
                <SubtaskDialog
                  parentId={task.id}
                  parentDeadline={deadline}
                  onClose={() => setIsSubtaskOpen(false)}
                  onCreated={(row) => {
                    setSubtasks((prev) => [rowToCard(row), ...prev]);
                    setIsSubtaskOpen(false);
                  }}
                />
              )}
            </div>

            {/* Deadline */}
            <div>
              <label className="block text-xs text-gray-400 mb-1">Deadline</label>
              <Input
                type="date"
                value={deadline || ""}
                onChange={(e) => setDeadline(e.target.value)}
                className="bg-transparent text-gray-100 border-gray-700"
                disabled={!canEdit}
              />
            </div>

            {/* File Attachments */}
            <div>
              <label className="block text-xs text-gray-400 mb-1">Attachments</label>
              <FileUploadInput
                onFilesChange={setAttachments}
                disabled={!canEdit}
              />
              {attachments.length > 0 && (
                <Button
                  onClick={async () => {
                    try {
                      const formData = new FormData()
                      attachments.forEach((file) => {
                        formData.append('files', file)
                      })
                      
                      const response = await fetchWithCsrf(`${API}/api/tasks/${task.id}/files`, {
                        method: 'POST',
                        body: formData,
                      })
                      
                      if (!response.ok) {
                        throw new Error('Failed to upload files')
                      }
                      
                      toast.success('Files uploaded successfully')
                      setAttachments([])
                      window.location.reload()
                    } catch (error) {
                      console.error('Error uploading files:', error)
                      toast.error('Failed to upload files')
                    }
                  }}
                  disabled={!canEdit || attachments.length === 0}
                  className="mt-2 bg-white/90 text-black"
                >
                  Upload {attachments.length} File{attachments.length !== 1 ? 's' : ''}
                </Button>
              )}
            </div>

            <RecurrencePicker value={recurrence} onChange={setRecurrence} disabled={!canEdit} />


            {/* Actions */}
            <div className="mt-6 flex gap-2">
              <Button
                onClick={() => onSave({ title: title.trim(), description: description.trim(), priority, status, deadline, tags, assignees, recurrence })}
                disabled={!canSave}
                className="bg-white/90 text-black"
              >
                Save
              </Button>
              <Button variant="ghost" className="bg-white/10 text-gray-300 hover:text-white" onClick={onClose}>
                Cancel
              </Button>
              <Button
                onClick={handleDelete}
                className="bg-red-400 hover:bg-red-700 text-white ml-auto"
                type="button" disabled={!canEdit}>
                <Trash className="w-4 h-4 mr-1" /> Delete
              </Button>
            </div>

            {/* Comment Section */}
            <div className="mt-8">
              <CommentSection taskId={task.id} />
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
function EditableTaskCard({ onSave, onCancel, taskId, onDeleted, defaultProjectId = null, projects = [], projectsLoading = false, projectsError = null }) {
  const { user: currentUser } = useAuth()
  const normalizedDefaultProjectId = defaultProjectId != null ? Number(defaultProjectId) : null
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [dueDate, setDueDate] = useState("")
  const [priority, setPriority] = useState("")
  const [status, setStatus] = useState("pending")
  const [attachments, setAttachments] = useState([])
  const PRIORITIES = ["Low", "Medium", "High"]
  const STATUSES = [
    { value: "pending", label: "To do" },
    { value: "in_progress", label: "Doing" },
    { value: "completed", label: "Completed" },
    { value: "blocked", label: "Blocked" },
    { value: "cancelled", label: "Cancelled" }
  ];
  const canEdit = true
  const MAX_ASSIGNEES = 5
  const [tagInput, setTagInput] = useState("");
  const [tags, setTags] = useState([]);
  const [recurrence, setRecurrence] = useState(null);
  const [selectedProjectId, setSelectedProjectId] = useState(normalizedDefaultProjectId);

  const normalizedSelectedProjectId = Number.isFinite(Number(selectedProjectId))
    ? Number(selectedProjectId)
    : null;
  const selectedProjectEntry = normalizedSelectedProjectId != null
    ? projects.find((p) => Number(p.id) === normalizedSelectedProjectId)
    : null;
  const selectedProjectName = selectedProjectEntry?.name
    ?? (normalizedSelectedProjectId != null ? `Project #${normalizedSelectedProjectId}` : null);

  useEffect(() => {
    setSelectedProjectId((prev) => {
      if (normalizedDefaultProjectId != null && projects.some((p) => Number(p.id) === normalizedDefaultProjectId)) {
        return normalizedDefaultProjectId;
      }
      if (prev != null) return prev;
      if (projects.length === 1) {
        const soleId = Number(projects[0].id);
        return Number.isFinite(soleId) ? soleId : prev;
      }
      return prev;
    });
  }, [normalizedDefaultProjectId, projects]);

  // --- Assignees & user search (copied from TaskSidePanel, trimmed) ---
  const [assignees, setAssignees] = useState([]);
  const {
    query: userSearch,
    results: userSearchResults,
    loading: loadingUsers,
    search: searchUsers,
    clear: clearUserSearch,
  } = useUserSearch({ canSearch: true, minQueryLength: 1 })

  useEffect(() => {
    if (!currentUser?.id) return
    setAssignees(prev => {
      if (prev.some(a => a.id === currentUser.id)) return prev
      return [...prev, { id: currentUser.id, name: currentUser.name ?? 'You' }]
    })
  }, [currentUser])

  const hasTitle = title.trim().length > 0;
  const hasDescription = description.trim().length > 0;
  const hasPriority = !!priority;
  const hasStatus = !!status;
  const hasDueDate = !!dueDate;
  const hasAssignees = assignees.length > 0;
  const hasProject = selectedProjectId != null;
  const canSave = hasTitle && hasDescription && hasPriority && hasStatus && hasDueDate && hasAssignees && hasProject;

  function addAssignee(user) {
    setAssignees((prev) => {
      if (prev.length >= MAX_ASSIGNEES || prev.some((a) => a.id === user.id)) return prev
      return [...prev, user]
    });
    clearUserSearch();
  }

  function removeAssignee(userId) {
    setAssignees((prev) => {
      if (prev.length <= 1) return prev
      return prev.filter((a) => a.id !== userId)
    });
  }

  function handleUserSearchInput(e) {
    const value = e.target.value;
    if (assignees.length >= MAX_ASSIGNEES) return;
    searchUsers(value);
  }

  function addTagFromInput() {
    if (!canEdit) return;
    const v = tagInput.trim();
    if (!v) return;
    if (!tags.includes(v)) setTags((prev) => [...prev, v]);
    setTagInput("");
  }

  function removeTag(index) {
    if (!canEdit) return;
    setTags((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleDelete() {
    if (!canEdit) return;
    if (!taskId) {
      onCancel?.()
      return
    }
    try {
      const res = await fetchWithCsrf(`${API}/tasks/${taskId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ archived: true }),
      })
      if (!res.ok) {
        const { error } = await res.json().catch(() => ({}))
        throw new Error(error || `PUT /tasks/${taskId} ${res.status}`)
      }
      onDeleted?.(taskId)
      onCancel?.()
    } catch (e) {
      console.error("[archive task]", e)
      alert(e.message)
    }
  }

  return (
    <div className="rounded-xl border border-gray-700 bg-[#1f2023] p-4 shadow-sm">
      {/* Title */}
      <label className="block text-xs text-gray-400 mb-1">Title</label>
      <Input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Task title"
        className="mb-3 bg-transparent text-gray-100 border-gray-700 placeholder:text-gray-500"
      />

      {/* Description */}
      <label className="block text-xs text-gray-400 mb-1">Description</label>
      <Textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Add a short description…"
        className="mb-3 bg-transparent text-gray-100 border-gray-700 placeholder:text-gray-500"
        rows={3}
      />
      {/* Tags */}
      <label className="block text-xs text-gray-400 mb-1">Tags</label>
      <div className="flex flex-wrap gap-2 mb-2">
        {tags.map((t, i) => (
          <span
            key={`${t}-${i}`}
            className="inline-flex items-center rounded-md bg-gray-700 text-gray-100 px-2 py-1 text-xs"
          >
            {t}
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setTags(prev => prev.filter((_, idx) => idx !== i));
              }}
              className="ml-1 text-gray-300 hover:text-white"
              aria-label={`Remove tag ${t}`}
            >
              ×
            </button>

          </span>
        ))}
      </div>
      <Input
        value={tagInput}
        onChange={(e) => setTagInput(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === ",") {
            e.preventDefault();
            addTagFromInput();
          } else if (e.key === "Backspace" && tagInput === "" && tags.length) {
            e.preventDefault();
            setTags(prev => prev.slice(0, -1));
          }
        }}
        placeholder="Type a tag and press Enter (or comma)"
        className="bg-transparent text-gray-100 border-gray-700"
      />
      {/* Assignees */}
      <div className="mt-3 relative">
        <label className="block text-xs text-gray-400 mb-1">Assignees</label>
        <input
          type="text"
          className="w-full bg-transparent text-gray-100 border border-gray-700 rounded-md px-2 py-1 text-sm placeholder:text-gray-500 focus:outline-none focus:ring-1 focus:ring-gray-500 disabled:opacity-60"
          placeholder="Search users by name or email..."
          value={userSearch}
          onChange={handleUserSearchInput}
          aria-busy={loadingUsers ? 'true' : 'false'}
          autoComplete="off"
          disabled={assignees.length >= MAX_ASSIGNEES}
        />
        {assignees.length < MAX_ASSIGNEES && userSearchResults.length > 0 && (
          <div className="absolute z-50 bg-[#23232a] border border-gray-700 rounded-md mt-1 w-full max-h-48 overflow-y-auto shadow-lg">
            {userSearchResults.map((u) => (
              <div
                key={u.id}
                className="px-3 py-2 hover:bg-gray-700 cursor-pointer text-gray-100"
                onClick={() => addAssignee(u)}
              >
                <span className="font-medium">{u.name}</span>
                <span className="ml-2 text-xs text-gray-400">{u.email}</span>
              </div>
            ))}
          </div>
        )}

        {assignees.length > 0 ? (
          <div className="mt-2 flex flex-wrap gap-2">
            {assignees.map((a) => (
              <Badge
                key={a.id}
                className="px-2 py-0.5 text-xs font-medium bg-gray-700 text-gray-200 flex items-center"
                title={a.name}
              >
                {a.name}
                <button
                  type="button"
                  className="ml-1 text-gray-300 hover:text-white"
                  onClick={() => removeAssignee(a.id)}
                  aria-label={`Remove ${a.name}`}
                >
                  ×
                </button>
              </Badge>
            ))}
          </div>
        ) : (
          <span className="mt-1 block text-xs text-gray-500">No assignees</span>
        )}
        {assignees.length === 1 && (
          <p className="text-xs text-amber-400 mt-2">At least one assignee is required. Add another member before removing the last one.</p>
        )}
        {assignees.length > MAX_ASSIGNEES && (
          <p className="text-xs text-red-400 mt-2">You can assign up to {MAX_ASSIGNEES} members.</p>
        )}
      </div>

      <div className="mt-4">
        <label className="block text-xs text-gray-400 mb-1">Project</label>
        <Select
          value={selectedProjectId != null ? String(selectedProjectId) : ""}
          onValueChange={(value) => {
            const num = Number(value);
            const next = Number.isFinite(num) ? num : null;
            console.log('[EditableTaskCard] project selection changed:', { value, next });
            setSelectedProjectId(next);
          }}
          disabled={projectsLoading || projects.length === 0}
        >
          <SelectTrigger className="bg-transparent text-gray-100 border-gray-700">
            <SelectValue placeholder={projectsLoading ? "Loading projects..." : "Select project"} />
          </SelectTrigger>
          <SelectContent className="bg-white">
            {projects.map((project) => (
              <SelectItem key={project.id} value={String(project.id)}>
                {project.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {projectsLoading && (
          <p className="text-xs text-gray-500 mt-2">Loading active projects…</p>
        )}
        {!projectsLoading && projectsError && (
          <p className="text-xs text-red-400 mt-2">Failed to load projects.</p>
        )}
        {!projectsLoading && projects.length === 0 && (
          <p className="text-xs text-red-400 mt-2">
            No active projects available. Create or reactivate a project before adding tasks.
          </p>
        )}
        {!projectsLoading && projects.length > 0 && selectedProjectId == null && (
          <p className="text-xs text-amber-400 mt-2">
            Select a project to enable task creation.
          </p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        {/* Due date */}
        <div>
          <label className="block text-xs text-gray-400 mb-1">Deadline</label>
          <Input
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            className="bg-transparent text-gray-100 border-gray-700"
          />
        </div>

        {/* Priority dropdown */}
        <div>
          <label className="block text-xs text-gray-400 mb-1">Priority</label>
          <Select value={priority} onValueChange={(v) => setPriority(v)}>
            <SelectTrigger className="bg-transparent text-gray-100 border-gray-700">
              <SelectValue placeholder="Select priority" />
            </SelectTrigger>
            <SelectContent className="bg-white">
              {PRIORITIES.map((p) => (
                <SelectItem key={p} value={p}>
                  <span className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ${priorityChipClasses[p]}`}>
                    {p}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Status dropdown */}
        <div>
          <label className="block text-xs text-gray-400 mb-1">Status</label>
          <Select value={status} onValueChange={(v) => setStatus(v)}>
            <SelectTrigger className="bg-transparent text-gray-100 border-gray-700">
              <SelectValue placeholder="Select status" />
            </SelectTrigger>
            <SelectContent className="bg-white">
              {STATUSES.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="col-span-2 mt-1">
        <RecurrencePicker value={recurrence} onChange={setRecurrence} />
      </div>

      {/* File Attachments */}
      <div className="mt-3">
        <label className="block text-xs text-gray-400 mb-1">Attachments (optional)</label>
        <FileUploadInput
          onFilesChange={setAttachments}
          disabled={false}
        />
      </div>

      {/* Actions */}
      <div className="mt-4 flex items-center gap-2">
        {taskId && (
          <Button
            type="button"
            onClick={handleDelete}
            className="bg-red-600 hover:bg-red-700 text-white"
          >
            <Trash className="w-4 h-4 mr-1" /> Delete
          </Button>
        )}

        <Button
        onClick={() =>
            {
              const payload = {
                title: title.trim(),
                description: description.trim() || undefined,
                dueDate: dueDate || undefined,
                priority,
                status,
                tags,
                assignees,
                recurrence,
                projectId: selectedProjectId,
                attachments,
              };
              console.log('[EditableTaskCard] invoking onSave with payload:', payload);
              onSave(payload);
            }
        }
        disabled={!canSave || projectsLoading}
          className="bg-white/90 text-black hover:bg-white"
        >
          <Check className="w-4 h-4 mr-1" /> Save
        </Button>

        <Button variant="ghost" onClick={onCancel} className="text-gray-300 hover:text-white">
          <X className="w-4 h-4 mr-1" /> Cancel
        </Button>
      </div>
    </div>
  )
}
function SubtaskDialog({ parentId, parentDeadline, onClose, onCreated }) {
  const { user: currentUser } = useAuth()
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("Low");
  const [status, setStatus] = useState("pending");
  const [deadline, setDeadline] = useState("");
  const [tags, setTags] = useState([]);
  const [tagInput, setTagInput] = useState("");
  const [assignees, setAssignees] = useState([]);
  const [userSearch, setUserSearch] = useState("");
  const [userSearchResults, setUserSearchResults] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [debounce, setDebounce] = useState(null);
  const [attachments, setAttachments] = useState([]);

  const PRIORITIES = ["Low", "Medium", "High"];
  const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
  const ALLOWED_FILE_TYPES = [
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'image/png',
    'image/jpeg'
  ];

  const parentMax = parentDeadline
    ? String(parentDeadline).slice(0, 10)
    : null;


  const deadlineError =
    parentMax && deadline && deadline > parentMax
      ? `Deadline must be on or before ${parentMax}`
      : "";

  const canSave = title.trim().length > 0 && !deadlineError;

  function addTagFromInput() {
    const v = tagInput.trim();
    if (!v) return;
    if (!tags.includes(v)) setTags((prev) => [...prev, v]);
    setTagInput("");
  }
  function removeTagAt(i) {
    setTags((prev) => prev.filter((_, idx) => idx !== i));
  }

  function addAssignee(user) {
    if (!assignees.some((a) => a.id === user.id)) {
      setAssignees((prev) => [...prev, user]);
    }
    setUserSearch("");
    setUserSearchResults([]);
  }
  function removeAssignee(id) {
    setAssignees((prev) => prev.filter((a) => a.id !== id));
  }

  function handleFileChange(event) {
    const files = Array.from(event.target.files || []);
    const validFiles = [];
    const errors = [];

    files.forEach(file => {
      if (!ALLOWED_FILE_TYPES.includes(file.type)) {
        errors.push(`${file.name}: Invalid file type. Only PDF, DOCX, XLSX, PNG, and JPG are allowed.`);
        return;
      }
      if (file.size > MAX_FILE_SIZE) {
        errors.push(`${file.name}: File too large. Maximum size is 50MB.`);
        return;
      }
      validFiles.push(file);
    });

    if (errors.length > 0) {
      alert(errors.join('\n'));
    }

    setAttachments(prev => [...prev, ...validFiles]);
    event.target.value = '';
  }

  function removeAttachment(index) {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  }

  function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  }

  function handleUserSearchInput(e) {
    const value = e.target.value;
    setUserSearch(value);
    if (debounce) clearTimeout(debounce);
    if (!value.trim()) {
      setUserSearchResults([]);
      return;
    }
    setLoadingUsers(true);
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`${API}/users/search?q=${encodeURIComponent(value)}&limit=8`);
        const data = await res.json();
        setUserSearchResults(data.users || []);
      } catch {
        setUserSearchResults([]);
      } finally {
        setLoadingUsers(false);
      }
    }, 250);
    setDebounce(t);
  }

  async function handleCreate() {
    try {
      if (parentMax && deadline && deadline > parentMax) {
        alert(`Subtask deadline must be on or before ${parentMax}.`);
        return;
      }
      const assignedTo =
        assignees.length > 0 ? assignees.map(a => a.id) : [currentUser.id];
      const payload = {
        title: title.trim(),
        description: description.trim() || null,
        priority: priority.toLowerCase(),
        status,
        deadline: deadline || null,
        tags,
        parent_id: parentId,
        assigned_to: assignedTo,
      };

      const res = await fetchWithCsrf(`${API}/tasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const { error } = await res.json().catch(() => ({}));
        throw new Error(error || `POST /tasks ${res.status}`);
      }
      const row = await res.json();
      
      // Upload attachments if any
      if (attachments && attachments.length > 0) {
        try {
          const formData = new FormData();
          attachments.forEach(file => {
            formData.append('files', file);
          });
          
          const uploadRes = await fetchWithCsrf(`${API}/tasks/${row.id}/files`, {
            method: 'POST',
            body: formData
          });
          
          if (!uploadRes.ok) {
            console.warn('Failed to upload some attachments');
          } else {
            const uploadResult = await uploadRes.json();
            if (uploadResult.data?.errors && uploadResult.data.errors.length > 0) {
              console.warn('Some files failed:', uploadResult.data.errors);
            }
          }
        } catch (uploadError) {
          console.error('Error uploading attachments:', uploadError);
        }
      }
      
      onCreated?.(row); // push into list in parent
    } catch (e) {
      console.error("[create subtask]", e);
      alert(e.message);
    }
  }

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="absolute right-1/2 top-12 translate-x-1/2 w-full max-w-lg rounded-xl border border-gray-700 bg-[#1f2023] p-5 shadow-xl">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-white font-semibold">Add subtask</h4>
          <button onClick={onClose} className="text-gray-300 hover:text-white text-xl">×</button>
        </div>

        <div className="space-y-4">
          {/* Title */}
          <div>
            <label className="block text-xs text-gray-400 mb-1">Title</label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="bg-transparent text-gray-100 border-gray-700"
              placeholder="Subtask title"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs text-gray-400 mb-1">Description</label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="bg-transparent text-gray-100 border-gray-700"
            />
          </div>

          {/* Priority & Status */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-400 mb-1">Priority</label>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger className="bg-transparent text-gray-100 border-gray-700">
                  <SelectValue placeholder="Select priority" />
                </SelectTrigger>
                <SelectContent className="bg-white">
                  {PRIORITIES.map((p) => (
                    <SelectItem key={p} value={p}>{p}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Status</label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger className="bg-transparent text-gray-100 border-gray-700">
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent className="bg-white">
                  <SelectItem value="pending">To do</SelectItem>
                  <SelectItem value="in_progress">In progress</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="blocked">Blocked</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Deadline */}
          <div>
            <label className="block text-xs text-gray-400 mb-1">Deadline</label>
            <Input
              type="date"
              value={deadline || ""}
              onChange={(e) => setDeadline(e.target.value)}
              className="bg-transparent text-gray-100 border-gray-700"
              max={parentMax || undefined}
            />
            {deadlineError && (
              <div className="mt-1 text-xs text-red-400">{deadlineError}</div>
            )}
          </div>

          {/* Tags */}
          <div>
            <label className="block text-xs text-gray-400">Tags</label>
            {tags.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {tags.map((t, i) => (
                  <span key={`${t}-${i}`} className="inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium bg-gray-700 text-gray-200">
                    {t}
                    <button className="ml-1 text-gray-300 hover:text-white" onClick={() => removeTagAt(i)}>×</button>
                  </span>
                ))}
              </div>
            )}
            <input
              className="mt-1 w-full bg-transparent text-gray-100 border border-gray-700 rounded-md px-2 py-1 text-sm placeholder:text-gray-500 focus:outline-none focus:ring-1 focus:ring-gray-500"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === ",") {
                  e.preventDefault();
                  addTagFromInput();
                }
                if (e.key === "Backspace" && tagInput === "" && tags.length) {
                  removeTagAt(tags.length - 1);
                }
              }}
              placeholder="Type a tag and press Enter (or comma)"
            />
          </div>

          {/* Assignees */}
          <div>
            <label className="block text-xs text-gray-400 mb-1">Assignees</label>
            <div className="mb-2 relative">
              <input
                type="text"
                className="w-full bg-transparent text-gray-100 border border-gray-700 rounded-md px-2 py-1 text-sm placeholder:text-gray-500 focus:outline-none focus:ring-1 focus:ring-gray-500"
                placeholder="Search users…"
                value={userSearch}
                onChange={handleUserSearchInput}
                aria-busy={loadingUsers ? "true" : "false"}
                autoComplete="off"
              />
              {userSearchResults.length > 0 && (
                <div className="absolute z-50 bg-[#23232a] border border-gray-700 rounded-md mt-1 w-full max-h-48 overflow-y-auto shadow-lg">
                  {userSearchResults.map((u) => (
                    <div
                      key={u.id}
                      className="px-3 py-2 hover:bg-gray-700 cursor-pointer text-gray-100"
                      onClick={() => addAssignee(u)}
                    >
                      <span className="font-medium">{u.name}</span>
                      <span className="ml-2 text-xs text-gray-400">{u.email}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {assignees.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {assignees.map((a) => (
                  <span
                    key={a.id}
                    className="inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium bg-gray-700 text-gray-200"
                    title={a.name}
                  >
                    {a.name}
                    <button className="ml-1 text-gray-300 hover:text-white" onClick={() => removeAssignee(a.id)}>
                      ×
                    </button>
                  </span>
                ))}
              </div>
            ) : (
              <span className="text-xs text-gray-500">No assignees</span>
            )}
          </div>

          {/* File Attachments */}
          <div>
            <label className="block text-xs text-gray-400 mb-1">Attachments</label>
            <div className="border-2 border-dashed border-gray-700 rounded-md p-3 hover:border-gray-600 transition-colors">
              <input
                type="file"
                id="subtask-file-input"
                multiple
                accept=".pdf,.docx,.xlsx,.png,.jpg,.jpeg"
                onChange={handleFileChange}
                className="hidden"
              />
              <label
                htmlFor="subtask-file-input"
                className="flex flex-col items-center cursor-pointer"
              >
                <svg className="w-6 h-6 text-gray-500 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
                <span className="text-xs text-gray-400">Click to upload</span>
                <span className="text-xs text-gray-500 mt-0.5">PDF, DOCX, XLSX, PNG, JPG (Max 50MB)</span>
              </label>
            </div>
            
            {attachments.length > 0 && (
              <div className="mt-2 space-y-1">
                {attachments.map((file, index) => (
                  <div key={index} className="flex items-center justify-between bg-gray-800/50 rounded px-2 py-1.5">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <svg className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                      </svg>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-gray-300 truncate">{file.name}</p>
                        <p className="text-xs text-gray-500">{formatFileSize(file.size)}</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeAttachment(index)}
                      className="text-gray-400 hover:text-red-400 ml-2 text-sm"
                      aria-label={`Remove ${file.name}`}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" className="text-gray-300 hover:text-white" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={!canSave} className="bg-white/90 text-black hover:bg-white" onClick={handleCreate}>
            Create subtask
          </Button>
        </div>
      </div>
    </div>
  );
}
