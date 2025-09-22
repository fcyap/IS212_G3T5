"use client";

import { useState } from "react";
import { SessionProvider, useSession } from "@/components/session-provider";
import { SidebarNavigation } from "@/components/sidebar-navigation";
import { ProjectHeader } from "@/components/project-header";
import { KanbanBoard } from "@/components/kanban-board";

function RoleBadge() {
  const { role } = useSession() || {};
  if (!role) return null;
  return (
    <span className="ml-auto text-xs px-2 py-1 rounded-full border border-white/10 bg-white/5">
      {role.label}
    </span>
  );
}

function ProtectedProjectTimelinePage() {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const toggleSidebar = () => setIsSidebarCollapsed(!isSidebarCollapsed);

  return (
    <div className="flex h-screen bg-[#1a1a1d] dark">
      <SidebarNavigation isCollapsed={isSidebarCollapsed} onToggleCollapse={toggleSidebar} />
      <div className={`flex-1 flex flex-col transition-all duration-300 ${isSidebarCollapsed ? "ml-0" : "ml-0"}`}>
        {/* If ProjectHeader supports children/right-slot, place RoleBadge there; else show here */}
        <div className="flex items-center">
          <ProjectHeader />
          <RoleBadge />
        </div>
        <KanbanBoard />
      </div>
    </div>
  );
}

export default function Page() {
  return (
    <SessionProvider>
      <ProtectedProjectTimelinePage />
    </SessionProvider>
  );
}
