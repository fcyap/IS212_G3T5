"use client"
import { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { CommentSection } from '../task-comment/task-comment-section';
import { TaskAttachmentsDisplay } from '../task-attachments-display';
import { FileUploadInput } from '../file-upload-input';
import { TaskTimeTracking } from '../task-time-tracking';
import { useAuth } from '@/hooks/useAuth';
import { useUserSearch } from '@/hooks/useUserSearch';
import { fetchWithCsrf } from '@/lib/csrf';
import { extractUserHours, normalizeTimeSummary } from '@/lib/time-tracking';
import toast from 'react-hot-toast';
import { Trash, Check, X } from 'lucide-react';
import { RecurrencePicker } from './recurrence-picker';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SubtaskDialog } from './subtask-dialog';
const API = process.env.NEXT_PUBLIC_API_URL;
const priorityChipClasses = {
  Low: 'bg-teal-200 text-teal-900',
  Medium: 'bg-amber-300 text-amber-950',
  High: 'bg-fuchsia-300 text-fuchsia-950',
};
const prettyStatus = (status) => {
    const map = {
      pending: 'To do',
      in_progress: 'Doing',
      completed: 'Completed',
      blocked: 'Blocked',
      cancelled: 'Cancelled',
    };
    const key = String(status || '').toLowerCase();
    return map[key] ?? key.charAt(0).toUpperCase() + key.slice(1);
};

export function TaskSidePanel({
  task,
  projectLookup = {},
  projectsLoading = false,
  projectsError = null,
  ensureProject = async () => null,
  onClose,
  onSave,
  onDeleted,
  nested = false,
  toCard = (row) => row,
}) {
  const [childPanelTask, setChildPanelTask] = useState(null);
  const { user: currentUser } = useAuth()
  const currentUserId = currentUser?.id
  console.log('[TaskSidePanel] opened for task:', task);
  console.log('[TaskSidePanel] initial task.timeTracking', task.timeTracking);
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
  const [assigneeLookup, setAssigneeLookup] = useState(() => {
    const lookup = {};
    if (Array.isArray(task.assignees)) {
      task.assignees.forEach((entry) => {
        const rawId = entry?.id ?? entry?.user_id ?? entry?.userId;
        const numericId = Number(rawId);
        if (Number.isFinite(numericId)) {
          const truncated = Math.trunc(numericId);
          lookup[truncated] = entry?.name ?? entry?.email ?? `User ${truncated}`;
        }
      });
    }
    return lookup;
  });
  const [recurrence, setRecurrence] = useState(task.recurrence ?? null);
  const [attachments, setAttachments] = useState([]);
  const [timeTracking, setTimeTracking] = useState(() => normalizeTimeSummary(task.timeTracking));
  const [hoursSpent, setHoursSpent] = useState(() =>
    extractUserHours(normalizeTimeSummary(task.timeTracking), currentUserId)
  );
  const [saving, setSaving] = useState(false);
  const isMountedRef = useRef(true);
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
    if (!task.timeTracking) return;
    const summary = normalizeTimeSummary(task.timeTracking);
    console.log('[TaskSidePanel] normalised summary from task prop', summary);
    setTimeTracking(summary);
    const extracted = extractUserHours(summary, currentUserId);
    console.log('[TaskSidePanel] extracted hours from prop summary', { extracted, currentUserId });
    if (extracted !== "") {
      setHoursSpent(extracted);
    }
    setAssigneeLookup((prev) => {
      const next = { ...prev };
      summary.per_assignee.forEach(({ user_id }) => {
        const numericId = Number(user_id);
        if (Number.isFinite(numericId)) {
          const truncated = Math.trunc(numericId);
          if (next[truncated] == null) {
            next[truncated] = `User ${truncated}`;
          }
        }
      });
      return next;
    });
  }, [task.timeTracking, currentUserId]);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    async function loadTimeSummary() {
      try {
        const detailUrl = normalizedProjectId
          ? `${API}/api/projects/${normalizedProjectId}/tasks/${task.id}`
          : `${API}/api/tasks/${task.id}`;
        const res = await fetchWithCsrf(detailUrl, {
          method: "GET",
          cache: "no-store",
          headers: {
            "Cache-Control": "no-cache"
          }
        });
        if (!res.ok) return;
        const payload = await res.json().catch(() => null);
        const detail = payload?.task ?? payload;
        if (!detail || !active) return;
        const summary = normalizeTimeSummary(detail.time_tracking);
        console.log('[TaskSidePanel] fetched time summary', {
          taskId: task.id,
          raw: detail.time_tracking,
          summary,
          currentUserId
        });
        setTimeTracking(summary);
        const extracted = extractUserHours(summary, currentUserId);
        console.log('[TaskSidePanel] extracted hours from fetched summary', { extracted, currentUserId });
        if (extracted !== "") {
          setHoursSpent(extracted);
        }
        setAssigneeLookup((prev) => {
          const next = { ...prev };
          summary.per_assignee.forEach(({ user_id }) => {
            const numericId = Number(user_id);
            if (Number.isFinite(numericId)) {
              const truncated = Math.trunc(numericId);
              if (next[truncated] == null) {
                next[truncated] = `User ${truncated}`;
              }
            }
          });
          return next;
        });
      } catch (err) {
        console.error('[TaskSidePanel] Failed to load task hours:', err);
      }
    }
    loadTimeSummary();
    return () => { active = false; };
  }, [task.id, normalizedProjectId, currentUserId]);

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
        if (mounted) setSubtasks(rows.map(toCard));
      } catch (e) {
        console.error('[load subtasks]', e);
      }
    })();
    return () => { mounted = false; };
  }, [task.id, toCard]);

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

  const canUpdateHours = isSelfAssignee;
  const numericHours = Number(hoursSpent);
  const isHoursValid =
    hoursSpent === "" ||
    (Number.isFinite(numericHours) && numericHours >= 0);
  const canSave =
    (canEdit || isManager) &&
    title.trim().length > 0 &&
    priority &&
    assignees.length <= MAX_ASSIGNEES &&
    isHoursValid;

  const breakdownAssignees = useMemo(() => {
    const ids = new Set();
    if (Array.isArray(assignees)) {
      assignees.forEach((entry) => {
        const raw = entry?.id ?? entry?.user_id ?? entry?.userId;
        const numeric = Number(raw);
        if (Number.isFinite(numeric)) ids.add(Math.trunc(numeric));
      });
    }
    if (Array.isArray(timeTracking?.per_assignee)) {
      timeTracking.per_assignee.forEach((entry) => {
        const numeric = Number(entry?.user_id ?? entry?.id);
        if (Number.isFinite(numeric)) ids.add(Math.trunc(numeric));
      });
    }
    return Array.from(ids).map((id) => ({
      id,
      name: assigneeLookup[id] ?? `User ${id}`
    }));
  }, [assignees, timeTracking?.per_assignee, assigneeLookup]);
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
    if (user?.id != null) {
      const numericId = Number(user.id);
      if (Number.isFinite(numericId)) {
        const truncated = Math.trunc(numericId);
        setAssigneeLookup((prev) => ({
          ...prev,
          [truncated]: user.name ?? user.email ?? `User ${truncated}`
        }));
      }
    }
    clearUserSearch();
  }

  function removeAssignee(userId) {
    if (!canRemoveAssignees) return;
    setAssignees((prev) => {
      if (prev.length <= 1) return prev;
      return prev.filter((a) => a.id !== userId);
    });
  }

  function handleHoursInputChange(nextValue) {
    if (!canUpdateHours) return;
    if (nextValue === "" || nextValue === null) {
      setHoursSpent("");
      return;
    }
    const parsed = Number(nextValue);
    if (!Number.isNaN(parsed) && parsed >= 0) {
      setHoursSpent(nextValue);
    }
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

  async function handleSave() {
    if (!canSave || saving) return;
    const assigned_to = assignees.map((a) => Number(a.id)).filter(Number.isFinite);
    const sanitizedAssignees = assignees
      .map((assignee) => {
        if (!assignee) return null;
        const rawId = assignee.id ?? assignee.user_id ?? assignee.userId ?? null;
        if (rawId == null) return null;
        return {
          id: rawId,
          name: assignee.name ?? assignee.email ?? null,
        };
      })
      .filter(Boolean);
    const payload = {
      title: title.trim(),
      description: description.trim() || null,
      priority,
      status,
      deadline: deadline || null,
      tags,
      assigned_to,
      assignees: sanitizedAssignees,
      recurrence: recurrence ?? null,
    };
    if (canUpdateHours && hoursSpent !== "" && Number.isFinite(numericHours) && numericHours >= 0) {
      payload.hours = numericHours;
    }
    try {
      if (isMountedRef.current) setSaving(true);
      const updatedRow = await onSave?.(payload);
      if (updatedRow?.time_tracking && isMountedRef.current) {
        const summary = normalizeTimeSummary(updatedRow.time_tracking);
        setTimeTracking(summary);
        const extracted = extractUserHours(summary, currentUserId);
        if (extracted !== "") {
          setHoursSpent(extracted);
        }
      }
    } catch (error) {
      console.error('[TaskSidePanel] Failed to save task:', error);
      toast.error(error.message || 'Failed to update task');
    } finally {
      if (isMountedRef.current) setSaving(false);
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
            const rawAssigneeInputs =
              Array.isArray(patch.assignees) && patch.assignees.length
                ? patch.assignees
                : Array.isArray(patch.assigned_to)
                  ? patch.assigned_to
                  : [];
            const assigned_to = Array.from(
              new Set(
                rawAssigneeInputs
                  .map((entry) => {
                    if (entry == null) return null;
                    const raw =
                      typeof entry === 'object'
                        ? entry.id ?? entry.user_id ?? entry.userId ?? null
                        : entry;
                    const numeric = Number(raw);
                    return Number.isFinite(numeric) ? Math.trunc(numeric) : null;
                  })
                  .filter((value) => value !== null)
              )
            );
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
            if (patch.hours !== undefined) {
              payload.hours = patch.hours;
            }
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
              setSubtasks(prev => prev.map(s => (s.id === row.id ? toCard(row) : s)));
              setChildPanelTask(null);
              return row;
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

            <TaskTimeTracking
              value={hoursSpent}
              onChange={handleHoursInputChange}
              canEdit={canUpdateHours && canEdit}
              totalHours={timeTracking.total_hours}
              perAssignee={timeTracking.per_assignee}
              assignees={breakdownAssignees}
            />
            {!isHoursValid && (
              <p className="text-xs text-red-400">
                Please enter a non-negative number of hours.
              </p>
            )}
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
                    setSubtasks((prev) => [toCard(row), ...prev]);
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
                        const errorData = await response.json().catch(() => ({}))
                        throw new Error(errorData.message || 'Failed to upload files')
                      }
                      
                      const result = await response.json()
                      
                      // Check if there were any errors during upload
                      if (result.data?.errors && result.data.errors.length > 0) {
                        result.data.errors.forEach(error => {
                          toast.error(error, { duration: 5000 })
                        })
                      }
                      
                      if (result.data?.uploaded && result.data.uploaded.length > 0) {
                        toast.success(`${result.data.uploaded.length} file(s) uploaded successfully`)
                      }
                      
                      setAttachments([])
                      window.location.reload()
                    } catch (error) {
                      console.error('Error uploading files:', error)
                      toast.error(error.message || 'Failed to upload files', { duration: 5000 })
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
                onClick={handleSave}
                disabled={!canSave || saving}
                className="bg-white/90 text-black"
              >
                {saving ? "Saving…" : "Save"}
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

