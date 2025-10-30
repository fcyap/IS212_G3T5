"use client";
import { useEffect, useMemo, useState } from "react";
import { TaskCard } from "@/components/task-card";
import { Button } from "@/components/ui/button"
import { ArrowLeft } from "lucide-react";
import Link from "next/link"
import { fetchWithCsrf } from "@/lib/csrf";
import { useAuth } from "@/hooks/useAuth";
import { userService } from "@/lib/api";
const API = process.env.NEXT_PUBLIC_API_URL ;

export default function ArchivePage() {
  const { user: currentUser } = useAuth();
  const [rawTasks, setRawTasks] = useState([]);
  const [usersById, setUsersById] = useState({});

  useEffect(() => {
    (async () => {
      try {
        const res = await fetchWithCsrf(`${API}/tasks?archived=true`);
        if (!res.ok) {
          if (res.status === 401) {
            console.warn('[ArchivePage] Unauthorized when fetching archived tasks.');
            setTasks([]);
            return;
          }
          throw new Error(`GET /tasks?archived=true ${res.status}`);
        }
        const rows = await res.json();
        const normalized = Array.isArray(rows)
          ? rows
          : Array.isArray(rows?.tasks)
            ? rows.tasks
            : [];
        setRawTasks(normalized);
      } catch (err) {
        console.error('[ArchivePage] Failed to load archived tasks:', err);
        setRawTasks([]);
      }
    })();
  }, []);

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
        console.error('[ArchivePage] Failed to load users for RBAC filtering:', err);
        setUsersById({});
      }
    })();

    return () => {
      active = false;
    };
  }, [currentUser?.id, currentUser?.role]);

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

    const extractAssigneeIds = (task) =>
      (task?.assignees || [])
        .map((assignee) => Number(assignee?.id))
        .filter(Number.isFinite);

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

    return rawTasks.filter((task) => {
      const assigneeIds = extractAssigneeIds(task);
      return assigneeIds.includes(currentUserId);
    });
  }, [rawTasks, currentUserId, normalizedRole, usersById, hasUserDirectory, managerDivision, managerHierarchy]);

  async function handleUnarchive(id) {
    const res = await fetchWithCsrf(`${API}/tasks/${id}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ archived: false }),
    });
    if (!res.ok) {
      const { error } = await res.json().catch(() => ({}));
      alert(error || "Failed to unarchive");
      return;
    }

    setRawTasks((prev) => prev.filter((t) => t.id !== id));
  }

  return (
    <div className="flex-1 bg-[#1a1a1d] p-6">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-white text-xl font-semibold">Archived Tasks</h1>

        <Button asChild className="bg-gray-700 hover:bg-gray-600 text-white flex-shrink-0">
          <Link href="/">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Return to Home
          </Link>
        </Button>
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {visibleTasks.map((t) => (
          <TaskCard
            key={t.id}
            id={t.id}
            title={t.title}
            description={t.description}
            priority={t.priority}
            assignees={t.assignees}
            deadline={t.deadline}
            tags={Array.isArray(t.tags) ? t.tags : []}
            onUnarchive={() => handleUnarchive(t.id)}
          />
        ))}
      </div>
    </div>
  );
}
