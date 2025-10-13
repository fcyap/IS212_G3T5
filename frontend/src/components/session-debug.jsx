"use client";

import { useSession } from "@/components/session-provider";
import { useState } from "react";

export function SessionDebug() {
  const sessionData = useSession();
  const [isMinimized, setIsMinimized] = useState(false);

  if (!sessionData || sessionData.loading) {
    return (
      <div className="fixed bottom-4 right-4 bg-black/80 text-white p-3 rounded-lg text-xs font-mono z-50 border border-gray-600">
        <div className="flex items-center justify-between mb-2">
          <span className="text-yellow-400">Session Debug</span>
          <button 
            onClick={() => setIsMinimized(!isMinimized)}
            className="text-gray-400 hover:text-white"
          >
            {isMinimized ? '▲' : '▼'}
          </button>
        </div>
        {!isMinimized && (
          <div className="space-y-1">
            <div>Status: <span className="text-yellow-400">Loading...</span></div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 bg-black/90 text-white p-3 rounded-lg text-xs font-mono z-50 border border-gray-600 max-w-sm">
      <div className="flex items-center justify-between mb-2">
        <span className="text-green-400 font-bold">Session Debug</span>
        <button 
          onClick={() => setIsMinimized(!isMinimized)}
          className="text-gray-400 hover:text-white"
        >
          {isMinimized ? '▲' : '▼'}
        </button>
      </div>
      
      {!isMinimized && (
        <div className="space-y-1">
          <div>
            <span className="text-blue-400">User:</span> {sessionData.user?.name || 'N/A'}
          </div>
          <div>
            <span className="text-blue-400">Email:</span> {sessionData.user?.email || 'N/A'}
          </div>
          <div>
            <span className="text-blue-400">ID:</span> {sessionData.user?.id || 'N/A'}
          </div>
          <div>
            <span className="text-purple-400">Role:</span> {sessionData.role?.label || 'N/A'}
          </div>
          <div>
            <span className="text-purple-400">Level:</span> {sessionData.role?.level || 'N/A'}
          </div>
          <div>
            <span className="text-orange-400">Division:</span> {sessionData.role?.division || 'N/A'}
          </div>
          <div>
            <span className="text-orange-400">Hierarchy:</span> {sessionData.role?.hierarchy || 'N/A'}
          </div>
          <div>
            <span className="text-orange-400">Department:</span> {sessionData.role?.department || 'N/A'}
          </div>
          <div className="mt-2 pt-2 border-t border-gray-600">
            <span className="text-gray-400">Session Status:</span> 
            <span className="text-green-400 ml-1">Active</span>
          </div>
        </div>
      )}
    </div>
  );
}