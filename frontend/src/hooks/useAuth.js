"use client"
import { useState, useEffect, createContext, useContext } from 'react';
import { userService } from '@/lib/api';

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

  // Get current user ID from environment variable (simulated auth)
  const currentUserId = process.env.NEXT_PUBLIC_CURRENT_USER_ID;

  useEffect(() => {
    const fetchCurrentUser = async () => {
      if (!currentUserId) {
        setError('No user ID configured');
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const userData = await userService.getUserById(currentUserId);
        setUser(userData);
        setError(null);
      } catch (err) {
        console.error('Error fetching current user:', err);
        setError(err.message);
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    fetchCurrentUser();
  }, [currentUserId]);

  // Helper functions to check permissions
  const isManager = () => {
    return user?.role === 'manager';
  };

  const canCreateProject = () => {
    return isManager();
  };

  const canEditProject = (projectCreatorId) => {
    return user?.id === projectCreatorId;
  };

  const canDeleteProject = (projectCreatorId) => {
    return user?.id === projectCreatorId;
  };

  const value = {
    user,
    loading,
    error,
    currentUserId: currentUserId ? parseInt(currentUserId) : null,
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
