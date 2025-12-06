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
            .select('id, username, email, is_admin, is_active, permissions, role, preferred_upload_mode, current_zone, client_id, is_client_admin, has_order_entry_access, has_rate_quote_access, has_address_book_access')
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
              email: userData.email || undefined,
              isAdmin: userData.is_admin,
              isActive: userData.is_active,
              role: userData.role || (userData.is_admin ? 'admin' : 'user'),
              permissions: userData.permissions ? JSON.parse(userData.permissions) : getDefaultPermissions(userData.is_admin),
              preferredUploadMode: userData.preferred_upload_mode || 'manual',
              currentZone: userData.current_zone || '',
              clientId: userData.client_id || undefined,
              isClientAdmin: userData.is_client_admin || false,
              hasOrderEntryAccess: userData.has_order_entry_access || false,
              hasRateQuoteAccess: userData.has_rate_quote_access || false,
              hasAddressBookAccess: userData.has_address_book_access || false
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
          .select('id, username, email, is_admin, is_active, permissions, role, preferred_upload_mode, current_zone, client_id, is_client_admin, has_order_entry_access, has_rate_quote_access, has_address_book_access')
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
          email: userData.email || undefined,
          isAdmin: userData.is_admin,
          isActive: userData.is_active,
          role: userData.role || (userData.is_admin ? 'admin' : 'user'),
          permissions: userPermissions,
          preferredUploadMode: userData.preferred_upload_mode || 'manual',
          currentZone: userData.current_zone || '',
          clientId: userData.client_id || undefined,
          isClientAdmin: userData.is_client_admin || false,
          hasOrderEntryAccess: userData.has_order_entry_access || false,
          hasRateQuoteAccess: userData.has_rate_quote_access || false,
          hasAddressBookAccess: userData.has_address_book_access || false
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

  const createUser = async (username: string, password: string, isAdmin: boolean = false, role: 'admin' | 'user' | 'vendor' = 'user', email?: string): Promise<{ success: boolean; message: string }> => {
    try {
      console.log('Creating user with role:', role);
      
      // First create the user with the RPC function
      const { data: rpcData, error: rpcError } = await supabase.rpc('create_user', {
        username_input: username,
        password_input: password,
        is_admin_input: isAdmin,
        email_input: email || null
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
        .select('id, username, email, is_admin, is_active, permissions, preferred_upload_mode, role, current_zone, client_id, is_client_admin, has_order_entry_access, has_rate_quote_access, has_address_book_access')
        .order('created_at', { ascending: false });

      if (error) {
        throw error;
      }

      return (data || []).map(user => ({
        id: user.id,
        username: user.username,
        email: user.email || undefined,
        isAdmin: user.is_admin,
        isActive: user.is_active,
        role: user.role || 'user',
        permissions: user.permissions ? JSON.parse(user.permissions) : getDefaultPermissions(user.is_admin),
        preferredUploadMode: user.preferred_upload_mode || 'manual',
        currentZone: user.current_zone || '',
        clientId: user.client_id || undefined,
        isClientAdmin: user.is_client_admin || false,
        hasOrderEntryAccess: user.has_order_entry_access || false,
        hasRateQuoteAccess: user.has_rate_quote_access || false,
        hasAddressBookAccess: user.has_address_book_access || false
      }));
    } catch (error) {
      console.error('Get users error:', error);
      return [];
    }
  };

  const updateUser = async (userId: string, updates: { isAdmin?: boolean; isActive?: boolean; permissions?: UserPermissions; preferredUploadMode?: 'manual' | 'auto'; role?: 'admin' | 'user' | 'vendor' | 'client'; currentZone?: string; email?: string; clientId?: string; isClientAdmin?: boolean; hasOrderEntryAccess?: boolean; hasRateQuoteAccess?: boolean; hasAddressBookAccess?: boolean }): Promise<{ success: boolean; message: string }> => {
    try {
      const updateData: any = {};
      if (updates.isAdmin !== undefined) updateData.is_admin = updates.isAdmin;
      if (updates.isActive !== undefined) updateData.is_active = updates.isActive;
      if (updates.permissions !== undefined) updateData.permissions = JSON.stringify(updates.permissions);
      if (updates.preferredUploadMode !== undefined) updateData.preferred_upload_mode = updates.preferredUploadMode;
      if (updates.role !== undefined) updateData.role = updates.role;
      if (updates.currentZone !== undefined) updateData.current_zone = updates.currentZone;
      if (updates.email !== undefined) updateData.email = updates.email;
      if (updates.clientId !== undefined) updateData.client_id = updates.clientId;
      if (updates.isClientAdmin !== undefined) updateData.is_client_admin = updates.isClientAdmin;
      if (updates.hasOrderEntryAccess !== undefined) updateData.has_order_entry_access = updates.hasOrderEntryAccess;
      if (updates.hasRateQuoteAccess !== undefined) updateData.has_rate_quote_access = updates.hasRateQuoteAccess;
      if (updates.hasAddressBookAccess !== undefined) updateData.has_address_book_access = updates.hasAddressBookAccess;
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

  const updateUserPassword = async (userId: string, newPassword: string): Promise<{ success: boolean; message: string }> => {
    try {
      const newPasswordHash = await supabase.rpc('hash_password', { password: newPassword });

      if (newPasswordHash.error) {
        throw newPasswordHash.error;
      }

      const { error } = await supabase
        .from('users')
        .update({
          password_hash: newPasswordHash.data,
          updated_at: new Date().toISOString()
        })
        .eq('id', userId);

      if (error) {
        throw error;
      }

      return {
        success: true,
        message: 'Password updated successfully'
      };
    } catch (error) {
      console.error('Update password error:', error);
      return {
        success: false,
        message: 'Failed to update password. Please try again.'
      };
    }
  };

  const getUserExtractionTypes = async (userId: string): Promise<string[]> => {
    try {
      const { data, error } = await supabase
        .from('user_extraction_types')
        .select('extraction_type_id')
        .eq('user_id', userId);

      if (error) throw error;

      return (data || []).map(item => item.extraction_type_id);
    } catch (error) {
      console.error('Get user extraction types error:', error);
      return [];
    }
  };

  const updateUserExtractionTypes = async (userId: string, extractionTypeIds: string[]): Promise<{ success: boolean; message: string }> => {
    try {
      // First, delete all existing mappings for this user
      const { error: deleteError } = await supabase
        .from('user_extraction_types')
        .delete()
        .eq('user_id', userId);

      if (deleteError) throw deleteError;

      // Then insert the new mappings
      if (extractionTypeIds.length > 0) {
        const mappings = extractionTypeIds.map(typeId => ({
          user_id: userId,
          extraction_type_id: typeId
        }));

        const { error: insertError } = await supabase
          .from('user_extraction_types')
          .insert(mappings);

        if (insertError) throw insertError;
      }

      return {
        success: true,
        message: 'Extraction type permissions updated successfully'
      };
    } catch (error) {
      console.error('Update user extraction types error:', error);
      return {
        success: false,
        message: 'Failed to update extraction type permissions'
      };
    }
  };

  const getUserTransformationTypes = async (userId: string): Promise<string[]> => {
    try {
      const { data, error } = await supabase
        .from('user_transformation_types')
        .select('transformation_type_id')
        .eq('user_id', userId);

      if (error) throw error;

      return (data || []).map(item => item.transformation_type_id);
    } catch (error) {
      console.error('Get user transformation types error:', error);
      return [];
    }
  };

  const updateUserTransformationTypes = async (userId: string, transformationTypeIds: string[]): Promise<{ success: boolean; message: string }> => {
    try {
      const { error: deleteError } = await supabase
        .from('user_transformation_types')
        .delete()
        .eq('user_id', userId);

      if (deleteError) throw deleteError;

      if (transformationTypeIds.length > 0) {
        const mappings = transformationTypeIds.map(typeId => ({
          user_id: userId,
          transformation_type_id: typeId
        }));

        const { error: insertError } = await supabase
          .from('user_transformation_types')
          .insert(mappings);

        if (insertError) throw insertError;
      }

      return {
        success: true,
        message: 'Transformation type permissions updated successfully'
      };
    } catch (error) {
      console.error('Update user transformation types error:', error);
      return {
        success: false,
        message: 'Failed to update transformation type permissions'
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
    deleteUser,
    updateUserPassword,
    getUserExtractionTypes,
    updateUserExtractionTypes,
    getUserTransformationTypes,
    updateUserTransformationTypes
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