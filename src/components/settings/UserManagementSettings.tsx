import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Save, Users, Shield, User as UserIcon, Eye, EyeOff, Settings, FileText, Server, Key, Mail, Filter, Database, GitBranch, Brain, RefreshCw } from 'lucide-react';
import type { User } from '../../types';

interface UserManagementSettingsProps {
  currentUser: User;
  getAllUsers: () => Promise<User[]>;
  createUser: (username: string, password: string, isAdmin: boolean) => Promise<{ success: boolean; message: string }>;
  updateUser: (userId: string, updates: { isAdmin?: boolean; isActive?: boolean; permissions?: any }) => Promise<{ success: boolean; message: string }>;
  deleteUser: (userId: string) => Promise<{ success: boolean; message: string }>;
}

export default function UserManagementSettings({ 
  currentUser,
  getAllUsers,
  createUser,
  updateUser,
  deleteUser
}: UserManagementSettingsProps) {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showPermissionsModal, setShowPermissionsModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [newUser, setNewUser] = useState({
    username: '',
    password: '',
    isAdmin: false,
    role: 'user' as 'admin' | 'user' | 'vendor'
  });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [isUpdatingPermissions, setIsUpdatingPermissions] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [userToDelete, setUserToDelete] = useState<User | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showUploadModeModal, setShowUploadModeModal] = useState(false);
  const [userForUploadMode, setUserForUploadMode] = useState<User | null>(null);
  const [isUpdatingUploadMode, setIsUpdatingUploadMode] = useState(false);
  const [showCurrentZoneModal, setShowCurrentZoneModal] = useState(false);
  const [userForCurrentZone, setUserForCurrentZone] = useState<User | null>(null);
  const [isUpdatingCurrentZone, setIsUpdatingCurrentZone] = useState(false);
  const [newCurrentZone, setNewCurrentZone] = useState('');

  const permissionOptions = [
    { key: 'extractionTypes', label: 'Extraction Types', icon: FileText, description: 'Manage PDF extraction templates and configurations' },
    { key: 'transformationTypes', label: 'Transformation Types', icon: RefreshCw, description: 'Manage PDF transformation and renaming templates' },
    { key: 'sftp', label: 'SFTP Settings', icon: Server, description: 'Configure SFTP server connection settings' },
    { key: 'api', label: 'API Settings', icon: Key, description: 'Manage API keys and endpoint configurations' },
    { key: 'emailMonitoring', label: 'Email Monitoring', icon: Mail, description: 'Configure Office 365 email monitoring' },
    { key: 'emailRules', label: 'Email Rules', icon: Filter, description: 'Manage email processing rules' },
    { key: 'processedEmails', label: 'Processed Emails', icon: Database, description: 'View processed email history' },
    { key: 'extractionLogs', label: 'Extraction Logs', icon: FileText, description: 'View PDF extraction activity logs' },
    { key: 'userManagement', label: 'User Management', icon: Users, description: 'Manage users and permissions' },
    { key: 'workflowManagement', label: 'Workflow Management', icon: GitBranch, description: 'Create and manage multi-step extraction workflows' }
  ];

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    setLoading(true);
    try {
      const userList = await getAllUsers();
      setUsers(userList);
    } catch (error) {
      console.error('Failed to load users:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddUser = async () => {
    if (!newUser.username.trim() || !newUser.password.trim()) {
      setError('Username and password are required');
      return;
    }

    setIsCreating(true);
    setError('');
    setSuccess('');

    try {
      const result = await createUser(newUser.username.trim(), newUser.password, newUser.isAdmin, newUser.role);
      
      if (result.success) {
        setSuccess(result.message);
        setShowAddModal(false);
        setNewUser({ username: '', password: '', isAdmin: false, role: 'user' });
        await loadUsers(); // Refresh the user list
        setTimeout(() => setSuccess(''), 3000);
      } else {
        setError(result.message);
      }
    } catch (error) {
      setError('Failed to create user. Please try again.');
    } finally {
      setIsCreating(false);
    }
  };

  const handleToggleAdmin = async (user: User) => {
    // Prevent removing admin from the current user or the default admin user
    if ((user.id === currentUser.id && user.isAdmin) || (user.username === 'admin' && user.isAdmin)) {
      const message = user.username === 'admin' 
        ? 'You cannot remove admin privileges from the default admin account'
        : 'You cannot remove admin privileges from your own account';
      setError(message);
      setTimeout(() => setError(''), 3000);
      return;
    }

    try {
      const newRole = !user.isAdmin ? 'admin' : 'user';
      const result = await updateUser(user.id, { 
        isAdmin: !user.isAdmin,
        role: newRole
      });
      
      if (result.success) {
        setSuccess(result.message);
        await loadUsers(); // Refresh the user list
        setTimeout(() => setSuccess(''), 3000);
      } else {
        setError(result.message);
        setTimeout(() => setError(''), 3000);
      }
    } catch (error) {
      setError('Failed to update user. Please try again.');
      setTimeout(() => setError(''), 3000);
    }
  };

  const handleToggleActive = async (user: User) => {
    // Prevent deactivating the current user or the default admin user
    if (user.id === currentUser.id) {
      setError('You cannot deactivate your own account');
      setTimeout(() => setError(''), 3000);
      return;
    }

    if (user.username === 'admin') {
      setError('You cannot deactivate the default admin account');
      setTimeout(() => setError(''), 3000);
      return;
    }

    try {
      const result = await updateUser(user.id, { isActive: !user.isActive });
      
      if (result.success) {
        setSuccess(result.message);
        await loadUsers(); // Refresh the user list
        setTimeout(() => setSuccess(''), 3000);
      } else {
        setError(result.message);
        setTimeout(() => setError(''), 3000);
      }
    } catch (error) {
      setError('Failed to update user. Please try again.');
      setTimeout(() => setError(''), 3000);
    }
  };

  const handleDeleteUser = (user: User) => {
    // Prevent deleting the current user or the default admin user
    if (user.id === currentUser.id) {
      setError('You cannot delete your own account');
      setTimeout(() => setError(''), 3000);
      return;
    }

    if (user.username === 'admin') {
      setError('You cannot delete the default admin account');
      setTimeout(() => setError(''), 3000);
      return;
    }

    setUserToDelete(user);
    setShowDeleteModal(true);
  };

  const confirmDeleteUser = async () => {
    if (!userToDelete) return;

    setIsDeleting(true);
    setError('');
    setSuccess('');

    try {
      const result = await deleteUser(userToDelete.id);
      
      if (result.success) {
        setSuccess(`User "${userToDelete.username}" has been deleted successfully`);
        setShowDeleteModal(false);
        setUserToDelete(null);
        await loadUsers(); // Refresh the user list
        setTimeout(() => setSuccess(''), 3000);
      } else {
        setError(result.message);
        setTimeout(() => setError(''), 3000);
      }
    } catch (error) {
      setError('Failed to delete user. Please try again.');
      setTimeout(() => setError(''), 3000);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleManagePermissions = (user: User) => {
    setSelectedUser(user);
    setShowPermissionsModal(true);
  };

  const handleUpdatePermissions = async () => {
    if (!selectedUser) return;

    setIsUpdatingPermissions(true);
    setError('');
    setSuccess('');

    try {
      const result = await updateUser(selectedUser.id, { 
        permissions: selectedUser.permissions 
      });
      
      if (result.success) {
        setSuccess('Permissions updated successfully');
        setShowPermissionsModal(false);
        setSelectedUser(null);
        await loadUsers(); // Refresh the user list
        setTimeout(() => setSuccess(''), 3000);
      } else {
        setError(result.message);
        setTimeout(() => setError(''), 3000);
      }
    } catch (error) {
      setError('Failed to update permissions. Please try again.');
      setTimeout(() => setError(''), 3000);
    } finally {
      setIsUpdatingPermissions(false);
    }
  };

  const handleManageUploadMode = (user: User) => {
    setUserForUploadMode(user);
    setShowUploadModeModal(true);
  };

  const handleUpdateUploadMode = async (uploadMode: 'manual' | 'auto') => {
    if (!userForUploadMode) return;

    setIsUpdatingUploadMode(true);
    setError('');
    setSuccess('');

    try {
      const result = await updateUser(userForUploadMode.id, { 
        preferredUploadMode: uploadMode 
      });
      
      if (result.success) {
        setSuccess(`Upload mode updated to ${uploadMode === 'manual' ? 'Manual Selection' : 'AI Auto-Detect'}`);
        setShowUploadModeModal(false);
        setUserForUploadMode(null);
        await loadUsers(); // Refresh the user list
        setTimeout(() => setSuccess(''), 3000);
      } else {
        setError(result.message);
        setTimeout(() => setError(''), 3000);
      }
    } catch (error) {
      setError('Failed to update upload mode. Please try again.');
      setTimeout(() => setError(''), 3000);
    } finally {
      setIsUpdatingUploadMode(false);
    }
  };

  const handleManageCurrentZone = (user: User) => {
    setUserForCurrentZone(user);
    setNewCurrentZone(user.currentZone || '');
    setShowCurrentZoneModal(true);
  };

  const handleUpdateCurrentZone = async () => {
    if (!userForCurrentZone) return;

    setIsUpdatingCurrentZone(true);
    setError('');
    setSuccess('');

    try {
      const result = await updateUser(userForCurrentZone.id, { 
        currentZone: newCurrentZone.trim() 
      });
      
      if (result.success) {
        setSuccess(`Current zone updated to "${newCurrentZone.trim() || 'None'}"`);
        setShowCurrentZoneModal(false);
        setUserForCurrentZone(null);
        setNewCurrentZone('');
        await loadUsers(); // Refresh the user list
        setTimeout(() => setSuccess(''), 3000);
      } else {
        setError(result.message);
        setTimeout(() => setError(''), 3000);
      }
    } catch (error) {
      setError('Failed to update current zone. Please try again.');
      setTimeout(() => setError(''), 3000);
    } finally {
      setIsUpdatingCurrentZone(false);
    }
  };
  const togglePermission = (permissionKey: string) => {
    if (!selectedUser) return;
    
    setSelectedUser({
      ...selectedUser,
      permissions: {
        ...selectedUser.permissions,
        [permissionKey]: !selectedUser.permissions[permissionKey as keyof typeof selectedUser.permissions]
      }
    });
  };

  const getPermissionCount = (user: User) => {
    return Object.values(user.permissions).filter(Boolean).length;
  };
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
        <span className="ml-3 text-gray-600">Loading users...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Current Zone Modal */}
      {showCurrentZoneModal && userForCurrentZone && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-8 max-w-md w-full mx-4 shadow-2xl">
            <div className="text-center mb-6">
              <div className="bg-purple-100 dark:bg-purple-900/50 p-3 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                <Settings className="h-8 w-8 text-purple-600 dark:text-purple-400" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">Current Zone Settings</h3>
              <p className="text-gray-600 dark:text-gray-400">Configure current zone for <strong>{userForCurrentZone.username}</strong></p>
            </div>
            
            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Current Zone
                </label>
                <input
                  type="text"
                  value={newCurrentZone}
                  onChange={(e) => setNewCurrentZone(e.target.value)}
                  placeholder="e.g., AT GARDEN, DOCK 5, ZONE A"
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  This zone will be used to filter orders in the Orders dashboard
                </p>
              </div>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
                <p className="text-red-700 text-sm">{error}</p>
              </div>
            )}
            
            <div className="flex space-x-3">
              <button
                onClick={handleUpdateCurrentZone}
                disabled={isUpdatingCurrentZone}
                className="flex-1 px-4 py-3 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-400 text-white font-semibold rounded-lg transition-colors duration-200"
              >
                {isUpdatingCurrentZone ? 'Updating...' : 'Update Zone'}
              </button>
              <button
                onClick={() => {
                  setShowCurrentZoneModal(false);
                  setUserForCurrentZone(null);
                  setNewCurrentZone('');
                  setError('');
                }}
                className="flex-1 px-4 py-3 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 font-semibold rounded-lg transition-colors duration-200"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Upload Mode Modal */}
      {showUploadModeModal && userForUploadMode && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-8 max-w-md w-full mx-4 shadow-2xl">
            <div className="text-center mb-6">
              <div className="bg-indigo-100 dark:bg-indigo-900/50 p-3 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                <Brain className="h-8 w-8 text-indigo-600 dark:text-indigo-400" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">Upload Mode Settings</h3>
              <p className="text-gray-600 dark:text-gray-400">Configure upload mode for <strong>{userForUploadMode.username}</strong></p>
            </div>
            
            <div className="space-y-4 mb-6">
              <div
                onClick={() => handleUpdateUploadMode('manual')}
                className="p-4 rounded-lg border-2 cursor-pointer transition-all duration-200 border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 hover:border-gray-300 dark:hover:border-gray-500"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="bg-gray-100 dark:bg-gray-600 p-2 rounded-lg">
                      <Settings className="h-5 w-5 text-gray-500 dark:text-gray-400" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-gray-700 dark:text-gray-200">Manual Selection</h4>
                      <p className="text-sm text-gray-500 dark:text-gray-400">User manually selects extraction type for each PDF</p>
                    </div>
                  </div>
                  <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                    userForUploadMode?.preferredUploadMode === 'manual'
                      ? 'border-purple-500 bg-purple-500'
                      : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700'
                  }`}>
                    {userForUploadMode?.preferredUploadMode === 'manual' && (
                      <div className="w-2 h-2 bg-white rounded-full"></div>
                    )}
                  </div>
                </div>
              </div>
              
              <div
                onClick={() => handleUpdateUploadMode('auto')}
                className="p-4 rounded-lg border-2 cursor-pointer transition-all duration-200 border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 hover:border-gray-300 dark:hover:border-gray-500"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="bg-gray-100 dark:bg-gray-600 p-2 rounded-lg">
                      <Brain className="h-5 w-5 text-gray-500 dark:text-gray-400" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-gray-700 dark:text-gray-200">AI Auto-Detect</h4>
                      <p className="text-sm text-gray-500 dark:text-gray-400">AI automatically detects and selects the best extraction type</p>
                    </div>
                  </div>
                  <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                    userForUploadMode?.preferredUploadMode === 'auto'
                      ? 'border-purple-500 bg-purple-500'
                      : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700'
                  }`}>
                    {userForUploadMode?.preferredUploadMode === 'auto' && (
                      <div className="w-2 h-2 bg-white rounded-full"></div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
                <p className="text-red-700 text-sm">{error}</p>
              </div>
            )}
            
            <div className="flex space-x-3">
              <button
                onClick={() => {
                  setShowUploadModeModal(false);
                  setUserForUploadMode(null);
                  setError('');
                }}
                className="flex-1 px-4 py-3 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 font-semibold rounded-lg transition-colors duration-200"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete User Modal */}
      {showDeleteModal && userToDelete && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-8 max-w-md w-full mx-4 shadow-2xl">
            <div className="text-center mb-6">
              <div className="bg-red-100 p-3 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                <Trash2 className="h-8 w-8 text-red-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">Delete User</h3>
              <p className="text-gray-600">
                Are you sure you want to permanently delete the user <strong>"{userToDelete.username}"</strong>?
              </p>
            </div>
            
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
              <div className="flex items-center space-x-2 mb-2">
                <div className="w-4 h-4 bg-red-500 rounded-full"></div>
                <span className="font-semibold text-red-800">Warning</span>
              </div>
              <p className="text-red-700 text-sm">
                This action cannot be undone. All user data and permissions will be permanently removed.
              </p>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
                <p className="text-red-700 text-sm">{error}</p>
              </div>
            )}
            
            <div className="flex space-x-3">
              <button
                onClick={confirmDeleteUser}
                disabled={isDeleting}
                className="flex-1 px-4 py-3 bg-red-600 hover:bg-red-700 disabled:bg-gray-400 text-white font-semibold rounded-lg transition-colors duration-200"
              >
                {isDeleting ? 'Deleting...' : 'Delete User'}
              </button>
              <button
                onClick={() => {
                  setShowDeleteModal(false);
                  setUserToDelete(null);
                  setError('');
                }}
                className="flex-1 px-4 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-lg transition-colors duration-200"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Permissions Modal */}
      {showPermissionsModal && selectedUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-8 max-w-2xl w-full mx-4 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="text-center mb-6">
              <div className="bg-purple-100 dark:bg-purple-900/50 p-3 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                <Settings className="h-8 w-8 text-purple-600 dark:text-purple-400" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">Manage Permissions</h3>
              <p className="text-gray-600 dark:text-gray-400">Configure access permissions for <strong>{selectedUser.username}</strong></p>
            </div>
            
            <div className="space-y-4 mb-6">
              {permissionOptions.map((option) => {
                const Icon = option.icon;
                const isEnabled = selectedUser.permissions[option.key as keyof typeof selectedUser.permissions];
                
                return (
                  <div
                    key={option.key}
                    className={`p-4 rounded-lg border-2 cursor-pointer transition-all duration-200 ${
                      isEnabled
                        ? 'border-purple-300 dark:border-purple-600 bg-purple-50 dark:bg-purple-900/20'
                        : 'border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 hover:border-gray-300 dark:hover:border-gray-500'
                    }`}
                    onClick={() => togglePermission(option.key)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className={`p-2 rounded-lg ${
                          isEnabled ? 'bg-purple-100 dark:bg-purple-800' : 'bg-gray-100 dark:bg-gray-600'
                        }`}>
                          <Icon className={`h-5 w-5 ${
                            isEnabled ? 'text-purple-600 dark:text-purple-400' : 'text-gray-500 dark:text-gray-400'
                          }`} />
                        </div>
                        <div>
                          <h4 className={`font-semibold ${
                            isEnabled ? 'text-purple-900 dark:text-purple-200' : 'text-gray-700 dark:text-gray-200'
                          }`}>
                            {option.label}
                          </h4>
                          <p className={`text-sm ${
                            isEnabled ? 'text-purple-600 dark:text-purple-300' : 'text-gray-500 dark:text-gray-400'
                          }`}>
                            {option.description}
                          </p>
                        </div>
                      </div>
                      <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                        isEnabled
                          ? 'border-purple-500 bg-purple-500'
                          : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700'
                      }`}>
                        {isEnabled && (
                          <div className="w-2 h-2 bg-white rounded-full"></div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {error && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-lg p-3 mb-4">
                <p className="text-red-700 dark:text-red-400 text-sm">{error}</p>
              </div>
            )}
            
            <div className="flex space-x-3">
              <button
                onClick={handleUpdatePermissions}
                disabled={isUpdatingPermissions}
                className="flex-1 px-4 py-3 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-400 text-white font-semibold rounded-lg transition-colors duration-200"
              >
                {isUpdatingPermissions ? 'Updating...' : 'Update Permissions'}
              </button>
              <button
                onClick={() => {
                  setShowPermissionsModal(false);
                  setSelectedUser(null);
                  setError('');
                }}
                className="flex-1 px-4 py-3 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 font-semibold rounded-lg transition-colors duration-200"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add User Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-8 max-w-md w-full mx-4 shadow-2xl">
            <div className="text-center mb-6">
              <div className="bg-purple-100 dark:bg-purple-900/50 p-3 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                <Plus className="h-8 w-8 text-purple-600 dark:text-purple-400" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">Add New User</h3>
              <p className="text-gray-600 dark:text-gray-400">Create a new user account</p>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Username
                </label>
                <input
                  type="text"
                  value={newUser.username}
                  onChange={(e) => setNewUser(prev => ({ ...prev, username: e.target.value }))}
                  placeholder="Enter username"
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Role
                </label>
                <select
                  value={newUser.role}
                  onChange={(e) => setNewUser(prev => ({ 
                    ...prev, 
                    role: e.target.value as 'admin' | 'user' | 'vendor',
                    isAdmin: e.target.value === 'admin'
                  }))}
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                >
                  <option value="user">User</option>
                  <option value="vendor">Vendor</option>
                  <option value="admin">Administrator</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Password
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={newUser.password}
                    onChange={(e) => setNewUser(prev => ({ ...prev, password: e.target.value }))}
                    placeholder="Enter password"
                    className="w-full px-4 py-3 pr-12 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center"
                  >
                    {showPassword ? (
                      <EyeOff className="h-5 w-5 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300" />
                    ) : (
                      <Eye className="h-5 w-5 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300" />
                    )}
                  </button>
                </div>
              </div>

              <div className="flex items-center space-x-3">
                <input
                  type="checkbox"
                  id="isAdmin"
                  checked={newUser.isAdmin}
                  onChange={(e) => setNewUser(prev => ({ 
                    ...prev, 
                    isAdmin: e.target.checked,
                    role: e.target.checked ? 'admin' : 'user'
                  }))}
                  disabled={newUser.role === 'vendor'}
                  className="w-4 h-4 text-purple-600 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 rounded focus:ring-purple-500"
                />
                <label htmlFor="isAdmin" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Administrator (default permissions for all settings) {newUser.role === 'vendor' && '(Not available for vendors)'}
                </label>
              </div>
              
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg p-3">
                <p className="text-blue-700 dark:text-blue-400 text-sm">
                  <strong>Note:</strong> {newUser.role === 'vendor' 
                    ? 'Vendors have limited access to upload and process PDFs only.' 
                    : 'You can customize specific permissions after creating the user.'
                  }
                </p>
              </div>

              {error && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-lg p-3">
                  <p className="text-red-700 dark:text-red-400 text-sm">{error}</p>
                </div>
              )}
              
              <div className="flex space-x-3">
                <button
                  onClick={handleAddUser}
                  disabled={isCreating}
                  className="flex-1 px-4 py-3 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-400 text-white font-semibold rounded-lg transition-colors duration-200"
                >
                  {isCreating ? 'Creating...' : 'Create User'}
                </button>
                <button
                  onClick={() => {
                    setShowAddModal(false);
                    setNewUser({ username: '', password: '', isAdmin: false, role: 'user' });
                    setError('');
                  }}
                  className="flex-1 px-4 py-3 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 font-semibold rounded-lg transition-colors duration-200"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100">User Management</h3>
          <p className="text-gray-600 dark:text-gray-400 mt-1">Manage user accounts and permissions</p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-lg transition-colors duration-200 flex items-center space-x-2"
        >
          <Plus className="h-4 w-4" />
          <span>Add User</span>
        </button>
      </div>

      {success && (
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded-lg p-4">
          <div className="flex items-center space-x-2">
            <div className="w-4 h-4 bg-green-500 rounded-full"></div>
            <span className="font-semibold text-green-800 dark:text-green-300">Success!</span>
          </div>
          <p className="text-green-700 dark:text-green-400 text-sm mt-1">{success}</p>
        </div>
      )}

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-lg p-4">
          <div className="flex items-center space-x-2">
            <div className="w-4 h-4 bg-red-500 rounded-full"></div>
            <span className="font-semibold text-red-800 dark:text-red-300">Error</span>
          </div>
          <p className="text-red-700 dark:text-red-400 text-sm mt-1">{error}</p>
        </div>
      )}

      <div className="space-y-4">
        {users.map((user) => (
          <div key={user.id} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <div className={`p-3 rounded-full ${
                  user.isAdmin ? 'bg-purple-100 dark:bg-purple-900/50' : 'bg-gray-100 dark:bg-gray-700'
                }`}>
                  {user.isAdmin ? (
                    <Shield className="h-6 w-6 text-purple-600 dark:text-purple-400" />
                  ) : (
                    <UserIcon className="h-6 w-6 text-gray-600 dark:text-gray-400" />
                  )}
                </div>
                <div>
                  <div className="flex items-center space-x-2">
                    <h4 className="font-semibold text-gray-900 dark:text-gray-100">{user.username}</h4>
                    {user.id === currentUser.id && (
                      <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs font-medium rounded-full">
                        You
                      </span>
                    )}
                  </div>
                  <div className="flex items-center space-x-4 mt-1">
                    <span className={`text-sm ${
                      user.role === 'admin' ? 'text-purple-600 dark:text-purple-400 font-medium' : 
                      user.role === 'vendor' ? 'text-orange-600 dark:text-orange-400 font-medium' :
                      'text-gray-500 dark:text-gray-400'
                    }`}>
                      {user.role === 'admin' ? 'Administrator' : 
                       user.role === 'vendor' ? 'Vendor' : 'User'}
                    </span>
                    <span className={`text-sm ${
                      user.isActive ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                    }`}>
                      {user.isActive ? 'Active' : 'Inactive'}
                    </span>
                    <span className="text-sm text-blue-600 dark:text-blue-400">
                      {getPermissionCount(user)} permissions
                    </span>
                    <span className={`text-sm font-medium ${
                      user.preferredUploadMode === 'auto' ? 'text-orange-600 dark:text-orange-400' : 'text-gray-600 dark:text-gray-400'
                    }`}>
                      {user.preferredUploadMode === 'auto' ? 'AI Auto-Detect' : 'Manual Selection'}
                    </span>
                    {user.role === 'vendor' && (
                      <span className="text-sm text-purple-600 dark:text-purple-400">
                        Zone: {user.currentZone || 'Not Set'}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                {user.role === 'vendor' && (
                  <button
                    onClick={() => handleManageCurrentZone(user)}
                    className="px-3 py-1 text-xs font-medium rounded-full bg-purple-100 text-purple-800 hover:bg-purple-200 transition-colors duration-200 flex items-center space-x-1"
                  >
                    <Settings className="h-3 w-3" />
                    <span>Zone</span>
                  </button>
                )}
                <button
                  onClick={() => handleManageUploadMode(user)}
                  className="px-3 py-1 text-xs font-medium rounded-full bg-indigo-100 text-indigo-800 hover:bg-indigo-200 transition-colors duration-200 flex items-center space-x-1"
                >
                  <Settings className="h-3 w-3" />
                  <span>Upload Mode</span>
                </button>
                <button
                  onClick={() => handleManagePermissions(user)}
                  className="px-3 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-800 hover:bg-blue-200 transition-colors duration-200 flex items-center space-x-1"
                >
                  <Settings className="h-3 w-3" />
                  <span>Permissions</span>
                </button>
                <button
                  onClick={() => handleToggleAdmin(user)}
                  disabled={(user.id === currentUser.id && user.isAdmin) || (user.username === 'admin' && user.isAdmin)}
                  className={`px-3 py-1 text-xs font-medium rounded-full transition-colors duration-200 ${
                    user.isAdmin
                      ? 'bg-purple-100 text-purple-800 hover:bg-purple-200'
                      : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
                  } ${((user.id === currentUser.id && user.isAdmin) || (user.username === 'admin' && user.isAdmin)) ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  {user.isAdmin ? 'Remove Admin' : 'Make Admin'}
                </button>
                <button
                  onClick={() => handleToggleActive(user)}
                  disabled={user.id === currentUser.id || user.username === 'admin'}
                  className={`px-3 py-1 text-xs font-medium rounded-full transition-colors duration-200 ${
                    user.isActive
                      ? 'bg-red-100 text-red-800 hover:bg-red-200'
                      : 'bg-green-100 text-green-800 hover:bg-green-200'
                  } ${(user.id === currentUser.id || user.username === 'admin') ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  {user.isActive ? 'Deactivate' : 'Activate'}
                </button>
                {!user.isActive && (
                  <button
                    onClick={() => handleDeleteUser(user)}
                    disabled={user.id === currentUser.id || user.username === 'admin'}
                    className={`px-3 py-1 text-xs font-medium rounded-full transition-colors duration-200 bg-red-100 text-red-800 hover:bg-red-200 ${
                      (user.id === currentUser.id || user.username === 'admin') ? 'opacity-50 cursor-not-allowed' : ''
                    }`}
                  >
                    Delete
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {users.length === 0 && (
        <div className="text-center py-12">
          <Users className="h-12 w-12 text-gray-400 dark:text-gray-500 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">No Users Found</h3>
          <p className="text-gray-600 dark:text-gray-400">There are no users in the system.</p>
        </div>
      )}

      {/* Information */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg p-4">
        <h4 className="font-semibold text-blue-800 dark:text-blue-300 mb-2">User Management Information</h4>
        <ul className="text-sm text-blue-700 dark:text-blue-400 space-y-1">
          <li>• Users can only access settings sections they have permissions for</li>
          <li>• Admin status provides default access to all settings (can be customized)</li>
          <li>• Regular users start with no settings access (can be granted specific permissions)</li>
          <li>• You cannot remove admin privileges from your own account</li>
          <li>• The default admin account (admin) cannot have admin privileges removed</li>
          <li>• You cannot deactivate your own account</li>
          <li>• The default admin account (admin) cannot be deactivated</li>
          <li>• The default admin account (admin/J@ckjohn1) is always available and protected</li>
          <li>• Click "Permissions" to customize which settings each user can access</li>
        </ul>
      </div>
    </div>
  );
}