"use client"
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/hooks/useAuth';
import { useUserSearch } from '@/hooks/useUserSearch';
import { fetchWithCsrf } from '@/lib/csrf';
import { FileUploadInput } from '../file-upload-input';
import { RecurrencePicker } from './recurrence-picker';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Trash, Check, X } from 'lucide-react';
const API = process.env.NEXT_PUBLIC_API_URL;
const priorityChipClasses = {
  Low: 'bg-teal-200 text-teal-900',
  Medium: 'bg-amber-300 text-amber-950',
  High: 'bg-fuchsia-300 text-fuchsia-950',
};

export function EditableTaskCard({ onSave, onCancel, taskId, onDeleted, defaultProjectId = null, projects = [], projectsLoading = false, projectsError = null }) {
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
