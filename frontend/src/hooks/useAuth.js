"use client"
import { useState, useEffect, createContext, useContext } from 'react';
import { userService } from '@/lib/api';
import { useSession } from '@/components/session-provider';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const session = useSession?.() ?? null;
  const sessionUserId = session?.user?.id;

  const normalizeRole = (rawRole) => {
    if (!rawRole) return null;
    if (typeof rawRole === 'object' && rawRole.label) return String(rawRole.label);
    const label = String(rawRole).toLowerCase();
    switch (label) {
      case 'admin':
        return 'Admin';
      case 'manager':
        return 'Manager';
      case 'staff':
      default:
        return 'Staff';
    }
  };

  useEffect(() => {
    const resolveUser = async () => {
      if (session?.loading) {
        setLoading(true);
        return;
      }

      if (!sessionUserId) {
        setUser(null);
        setError('No authenticated user');
        setLoading(false);
        return;
      }

      const sessionRole = normalizeRole(session?.role);

      if (session?.user) {
        const merged = {
          ...session.user,
          role: sessionRole ?? normalizeRole(session?.user?.role),
        };
        setUser(merged);
        setError(null);
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const userData = await userService.getUserById(sessionUserId);
        const merged = {
          ...userData,
          role: sessionRole ?? normalizeRole(userData.role),
        };
        setUser(merged);
        setError(null);
      } catch (err) {
        console.error('Error fetching current user:', err);
        setError(err.message);
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    resolveUser();
  }, [session?.loading, session?.user, session?.role, sessionUserId]);

  const userRole = normalizeRole(user?.role) ?? normalizeRole(session?.role);

  const isManager = () => userRole === 'Manager';
  const canCreateProject = () => isManager();
  const canEditProject = (projectCreatorId) => user?.id === projectCreatorId;
  const canDeleteProject = (projectCreatorId) => user?.id === projectCreatorId;

  const value = {
    user,
    loading,
    error,
    currentUserId: sessionUserId ?? null,
    role: userRole,
    isManager,
    canCreateProject,
    canEditProject,
    canDeleteProject,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
