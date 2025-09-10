import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import type { User, AuthState, UserPermissions } from '../types';

export function useAuth() {
  const [authState, setAuthState] = useState<AuthState>({
    isAuthenticated: false,
    user: null
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const validateUserFromStorage = async () => {
      // Check if user is already logged in (from localStorage)
      const savedUser = localStorage.getItem('parseit_user');
      if (savedUser) {
        try {
          const user = JSON.parse(savedUser);
          
          // Verify the user still exists and is active in the database
          const { data, error } = await supabase
            .from('users')
            .select('id, username, is_admin, is_active, permissions')
            .eq('id', user.id)
            .eq('is_active', true);

          if (error || !data || data.length === 0) {
            // User not found or inactive, clear localStorage
            localStorage.removeItem('parseit_user');
            setAuthState({
              isAuthenticated: false,
              user: null
            });
          } else {
            // User exists and is active, update with latest data from database
            const userData = data[0];
            const validatedUser: User = {
              id: userData.id,
              username: userData.username,
              isAdmin: userData.is_admin,
              isActive: userData.is_active,
              permissions: userData.permissions ? JSON.parse(userData.permissions) : getDefaultPermissions(userData.is_admin)
            };

            setAuthState({
              isAuthenticated: true,
              user: validatedUser
            });

            // Update localStorage with validated data
            localStorage.setItem('parseit_user', JSON.stringify(validatedUser));
          }
        } catch (error) {
          // Error parsing JSON or database error, clear localStorage
          localStorage.removeItem('parseit_user');
          setAuthState({
            isAuthenticated: false,
            user: null
          });
        }
      }
      setLoading(false);
    };

    validateUserFromStorage();
  }, []);

  const login = async (username: string, password: string): Promise<{ success: boolean; message?: string }> => {
    try {
      const { data, error } = await supabase.rpc('verify_password', {
        username_input: username,
        password_input: password
      });

      if (error) {
        throw error;
      }

      if (data.success) {
        // Parse permissions from database or use defaults
        let userPermissions: UserPermissions;
        try {
          userPermissions = data.user.permissions ? JSON.parse(data.user.permissions) : getDefaultPermissions(data.user.is_admin);
        } catch (parseError) {
          console.warn('Failed to parse user permissions, using defaults:', parseError);
          userPermissions = getDefaultPermissions(data.user.is_admin);
        }

        const user: User = {
          id: data.user.id,
          username: data.user.username,
          isAdmin: data.user.is_admin,
          isActive: data.user.is_active,
          permissions: userPermissions,
          preferredUploadMode: data.user.preferred_upload_mode || 'manual'
        };

        setAuthState({
          isAuthenticated: true,
          user
        });

        // Save to localStorage
        localStorage.setItem('parseit_user', JSON.stringify(user));

        return { success: true };
      } else {
        return { success: false, message: data.message };
      }
    } catch (error) {
      console.error('Login error:', error);
      return { success: false, message: 'Login failed. Please try again.' };
    }
  };

  const logout = () => {
    setAuthState({
      isAuthenticated: false,
      user: null
    });
    localStorage.removeItem('parseit_user');
  };

  const createUser = async (username: string, password: string, isAdmin: boolean = false): Promise<{ success: boolean; message: string }> => {
    try {
      const { data, error } = await supabase.rpc('create_user', {
        username_input: username,
        password_input: password,
        is_admin_input: isAdmin
      });

      if (error) {
        throw error;
      }

      return {
        success: data.success,
        message: data.message
      };
    } catch (error) {
      console.error('Create user error:', error);
      return {
        success: false,
        message: 'Failed to create user. Please try again.'
      };
    }
  };

  const getAllUsers = async (): Promise<User[]> => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('id, username, is_admin, is_active, permissions, preferred_upload_mode')
        .order('created_at', { ascending: false });

      if (error) {
        throw error;
      }

      return (data || []).map(user => ({
        id: user.id,
        username: user.username,
        isAdmin: user.is_admin,
        isActive: user.is_active,
        permissions: user.permissions ? JSON.parse(user.permissions) : getDefaultPermissions(user.is_admin),
        preferredUploadMode: user.preferred_upload_mode || 'manual'
      }));
    } catch (error) {
      console.error('Get users error:', error);
      return [];
    }
  };

  const updateUser = async (userId: string, updates: { isAdmin?: boolean; isActive?: boolean; permissions?: UserPermissions; preferredUploadMode?: 'manual' | 'auto' }): Promise<{ success: boolean; message: string }> => {
    try {
      const updateData: any = {};
      if (updates.isAdmin !== undefined) updateData.is_admin = updates.isAdmin;
      if (updates.isActive !== undefined) updateData.is_active = updates.isActive;
      if (updates.permissions !== undefined) updateData.permissions = JSON.stringify(updates.permissions);
      if (updates.preferredUploadMode !== undefined) updateData.preferred_upload_mode = updates.preferredUploadMode;
      updateData.updated_at = new Date().toISOString();

      const { error } = await supabase
        .from('users')
        .update(updateData)
        .eq('id', userId);

      if (error) {
        throw error;
      }

      return {
        success: true,
        message: 'User updated successfully'
      };
    } catch (error) {
      console.error('Update user error:', error);
      return {
        success: false,
        message: 'Failed to update user. Please try again.'
      };
    }
  };

  const deleteUser = async (userId: string): Promise<{ success: boolean; message: string }> => {
    try {
      const { error } = await supabase
        .from('users')
        .delete()
        .eq('id', userId);

      if (error) {
        throw error;
      }

      return {
        success: true,
        message: 'User deleted successfully'
      };
    } catch (error) {
      console.error('Delete user error:', error);
      return {
        success: false,
        message: 'Failed to delete user. Please try again.'
      };
    }
  };

  return {
    ...authState,
    loading,
    login,
    logout,
    createUser,
    getAllUsers,
    updateUser,
    deleteUser
  };
}

function getDefaultPermissions(isAdmin: boolean): UserPermissions {
  if (isAdmin) {
    return {
      extractionTypes: true,
      sftp: true,
      api: true,
      emailMonitoring: true,
      emailRules: true,
      processedEmails: true,
      extractionLogs: true,
      userManagement: true,
      workflowManagement: true
    };
  }
  
  return {
    extractionTypes: false,
    sftp: false,
    api: false,
    emailMonitoring: false,
    emailRules: false,
    processedEmails: false,
    extractionLogs: false,
    userManagement: false,
    workflowManagement: false
  };
}