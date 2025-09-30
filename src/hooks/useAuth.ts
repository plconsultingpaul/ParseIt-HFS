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
            .select('id, username, is_admin, is_active, permissions, role, preferred_upload_mode, current_zone')
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
              role: userData.role || (userData.is_admin ? 'admin' : 'user'),
              permissions: userData.permissions ? JSON.parse(userData.permissions) : getDefaultPermissions(userData.is_admin),
              preferredUploadMode: userData.preferred_upload_mode || 'manual',
              currentZone: userData.current_zone || ''
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
      // First verify the password using the RPC function
      const { data: rpcData, error: rpcError } = await supabase.rpc('verify_password', {
        username_input: username,
        password_input: password
      });

      if (rpcError) {
        throw rpcError;
      }

      if (rpcData.success) {
        // Get the complete user data directly from the users table to ensure we have all fields
        const { data: userData, error: userError } = await supabase
          .from('users')
          .select('id, username, is_admin, is_active, permissions, role, preferred_upload_mode, current_zone')
          .eq('username', username)
          .eq('is_active', true)
          .single();

        if (userError || !userData) {
          console.error('Failed to fetch complete user data:', userError);
          return { success: false, message: 'Failed to load user data' };
        }

        console.log('Complete user data from database:', userData);

        // Parse permissions from database or use defaults
        let userPermissions: UserPermissions;
        try {
          userPermissions = userData.permissions ? JSON.parse(userData.permissions) : getDefaultPermissions(userData.is_admin);
        } catch (parseError) {
          console.warn('Failed to parse user permissions, using defaults:', parseError);
          userPermissions = getDefaultPermissions(userData.is_admin);
        }

        const user: User = {
          id: userData.id,
          username: userData.username,
          isAdmin: userData.is_admin,
          isActive: userData.is_active,
          role: userData.role || (userData.is_admin ? 'admin' : 'user'),
          permissions: userPermissions,
          preferredUploadMode: userData.preferred_upload_mode || 'manual',
          currentZone: userData.current_zone || ''
        };

        console.log('Final user object created during login:', user);

        setAuthState({
          isAuthenticated: true,
          user
        });

        // Save to localStorage
        localStorage.setItem('parseit_user', JSON.stringify(user));

        return { success: true };
      } else {
        return { success: false, message: rpcData.message };
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

  const createUser = async (username: string, password: string, isAdmin: boolean = false, role: 'admin' | 'user' | 'vendor' = 'user'): Promise<{ success: boolean; message: string }> => {
    try {
      console.log('Creating user with role:', role);
      
      // First create the user with the RPC function
      const { data: rpcData, error: rpcError } = await supabase.rpc('create_user', {
        username_input: username,
        password_input: password,
        is_admin_input: isAdmin
      });

      if (rpcError) {
        throw rpcError;
      }

      if (!rpcData.success) {
        return {
          success: false,
          message: rpcData.message
        };
      }

      // Always update the role after user creation to ensure it's set correctly
      console.log('Updating user role to:', role);
      try {
        const { error: updateError } = await supabase
          .from('users')
          .update({ 
            role: role,
            updated_at: new Date().toISOString()
          })
          .eq('username', username);

        if (updateError) {
          console.error('Failed to update user role after creation:', updateError);
          return {
            success: false,
            message: `User created but failed to set role: ${updateError.message}`
          };
        }
        
        console.log('User role updated successfully to:', role);
      } catch (roleUpdateError) {
        console.error('Error updating user role:', roleUpdateError);
        return {
          success: false,
          message: 'User created but failed to set role properly'
        };
      }

      return {
        success: rpcData.success,
        message: rpcData.message
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
        .select('id, username, is_admin, is_active, permissions, preferred_upload_mode, role, current_zone')
        .order('created_at', { ascending: false });

      if (error) {
        throw error;
      }

      return (data || []).map(user => ({
        id: user.id,
        username: user.username,
        isAdmin: user.is_admin,
        isActive: user.is_active,
        role: user.role || 'user',
        permissions: user.permissions ? JSON.parse(user.permissions) : getDefaultPermissions(user.is_admin),
        preferredUploadMode: user.preferred_upload_mode || 'manual',
        currentZone: user.current_zone || ''
      }));
    } catch (error) {
      console.error('Get users error:', error);
      return [];
    }
  };

  const updateUser = async (userId: string, updates: { isAdmin?: boolean; isActive?: boolean; permissions?: UserPermissions; preferredUploadMode?: 'manual' | 'auto'; role?: 'admin' | 'user' | 'vendor'; currentZone?: string }): Promise<{ success: boolean; message: string }> => {
    try {
      const updateData: any = {};
      if (updates.isAdmin !== undefined) updateData.is_admin = updates.isAdmin;
      if (updates.isActive !== undefined) updateData.is_active = updates.isActive;
      if (updates.permissions !== undefined) updateData.permissions = JSON.stringify(updates.permissions);
      if (updates.preferredUploadMode !== undefined) updateData.preferred_upload_mode = updates.preferredUploadMode;
      if (updates.role !== undefined) updateData.role = updates.role;
      if (updates.currentZone !== undefined) updateData.current_zone = updates.currentZone;
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
      transformationTypes: true,
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
    transformationTypes: false,
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