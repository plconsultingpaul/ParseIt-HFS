import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Edit, Building2, CheckCircle, XCircle, FileText, DollarSign, BookUser } from 'lucide-react';
import type { User, Client } from '../../types';
import { supabase } from '../../lib/supabase';

interface ClientManagementSettingsProps {
  currentUser: User;
  getAllUsers: () => Promise<User[]>;
}

export default function ClientManagementSettings({
  currentUser,
  getAllUsers
}: ClientManagementSettingsProps) {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddClientModal, setShowAddClientModal] = useState(false);
  const [showEditClientModal, setShowEditClientModal] = useState(false);
  const [showDeleteClientModal, setShowDeleteClientModal] = useState(false);
  const [clientToEdit, setClientToEdit] = useState<Client | null>(null);
  const [clientToDelete, setClientToDelete] = useState<Client | null>(null);
  const [newClient, setNewClient] = useState({
    clientName: '',
    clientId: '',
    isActive: true,
    hasOrderEntryAccess: false,
    hasRateQuoteAccess: false,
    hasAddressBookAccess: false
  });
  const [editClient, setEditClient] = useState({
    clientName: '',
    clientId: '',
    isActive: true,
    hasOrderEntryAccess: false,
    hasRateQuoteAccess: false,
    hasAddressBookAccess: false
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [clientUserCounts, setClientUserCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    loadClients();
  }, []);

  const loadClients = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('clients')
        .select('*')
        .order('client_name', { ascending: true });

      if (error) throw error;

      const clientsData: Client[] = (data || []).map(client => ({
        id: client.id,
        clientName: client.client_name,
        clientId: client.client_id,
        isActive: client.is_active,
        hasOrderEntryAccess: client.has_order_entry_access,
        hasRateQuoteAccess: client.has_rate_quote_access,
        hasAddressBookAccess: client.has_address_book_access || false,
        createdAt: client.created_at,
        updatedAt: client.updated_at
      }));

      setClients(clientsData);

      const allUsers = await getAllUsers();
      const counts: Record<string, number> = {};
      clientsData.forEach(client => {
        counts[client.id] = allUsers.filter(u => u.clientId === client.id).length;
      });
      setClientUserCounts(counts);
    } catch (error) {
      console.error('Failed to load clients:', error);
      setError('Failed to load clients. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleAddClient = async () => {
    if (!newClient.clientName.trim() || !newClient.clientId.trim()) {
      setError('Client name and client ID are required');
      return;
    }

    setIsCreating(true);
    setError('');
    setSuccess('');

    try {
      const { data, error } = await supabase
        .from('clients')
        .insert([{
          client_name: newClient.clientName.trim(),
          client_id: newClient.clientId.trim(),
          is_active: newClient.isActive,
          has_order_entry_access: newClient.hasOrderEntryAccess,
          has_rate_quote_access: newClient.hasRateQuoteAccess,
          has_address_book_access: newClient.hasAddressBookAccess
        }])
        .select();

      if (error) {
        if (error.code === '23505') {
          setError('A client with this Client ID already exists');
        } else {
          throw error;
        }
        return;
      }

      setSuccess('Client created successfully');
      setShowAddClientModal(false);
      setNewClient({
        clientName: '',
        clientId: '',
        isActive: true,
        hasOrderEntryAccess: false,
        hasRateQuoteAccess: false,
        hasAddressBookAccess: false
      });
      await loadClients();
      setTimeout(() => setSuccess(''), 3000);
    } catch (error) {
      console.error('Failed to create client:', error);
      setError('Failed to create client. Please try again.');
    } finally {
      setIsCreating(false);
    }
  };

  const handleEditClient = (client: Client) => {
    setClientToEdit(client);
    setEditClient({
      clientName: client.clientName,
      clientId: client.clientId,
      isActive: client.isActive,
      hasOrderEntryAccess: client.hasOrderEntryAccess,
      hasRateQuoteAccess: client.hasRateQuoteAccess,
      hasAddressBookAccess: client.hasAddressBookAccess
    });
    setShowEditClientModal(true);
    setError('');
  };

  const handleUpdateClient = async () => {
    if (!clientToEdit) return;

    if (!editClient.clientName.trim() || !editClient.clientId.trim()) {
      setError('Client name and client ID are required');
      return;
    }

    setIsSaving(true);
    setError('');
    setSuccess('');

    try {
      const { error } = await supabase
        .from('clients')
        .update({
          client_name: editClient.clientName.trim(),
          client_id: editClient.clientId.trim(),
          is_active: editClient.isActive,
          has_order_entry_access: editClient.hasOrderEntryAccess,
          has_rate_quote_access: editClient.hasRateQuoteAccess,
          has_address_book_access: editClient.hasAddressBookAccess,
          updated_at: new Date().toISOString()
        })
        .eq('id', clientToEdit.id);

      if (error) {
        if (error.code === '23505') {
          setError('A client with this Client ID already exists');
        } else {
          throw error;
        }
        return;
      }

      setSuccess(`Client "${editClient.clientName}" updated successfully`);
      setShowEditClientModal(false);
      setClientToEdit(null);
      await loadClients();
      setTimeout(() => setSuccess(''), 3000);
    } catch (error) {
      console.error('Failed to update client:', error);
      setError('Failed to update client. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteClient = (client: Client) => {
    setClientToDelete(client);
    setShowDeleteClientModal(true);
  };

  const confirmDeleteClient = async () => {
    if (!clientToDelete) return;

    setIsDeleting(true);
    setError('');
    setSuccess('');

    try {
      const { error } = await supabase
        .from('clients')
        .delete()
        .eq('id', clientToDelete.id);

      if (error) throw error;

      setSuccess(`Client "${clientToDelete.clientName}" deleted successfully`);
      setShowDeleteClientModal(false);
      setClientToDelete(null);
      await loadClients();
      setTimeout(() => setSuccess(''), 3000);
    } catch (error) {
      console.error('Failed to delete client:', error);
      setError('Failed to delete client. Please try again.');
    } finally {
      setIsDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
        <span className="ml-3 text-gray-600">Loading clients...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {showAddClientModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-start justify-center z-50 pt-20">
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-8 max-w-md w-full mx-4 shadow-2xl">
            <div className="text-center mb-6">
              <div className="bg-purple-100 dark:bg-purple-900/50 p-3 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                <Plus className="h-8 w-8 text-purple-600 dark:text-purple-400" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">Add New Client</h3>
              <p className="text-gray-600 dark:text-gray-400">Create a new client company with custom access permissions</p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Client Name
                </label>
                <input
                  type="text"
                  value={newClient.clientName}
                  onChange={(e) => setNewClient(prev => ({ ...prev, clientName: e.target.value }))}
                  placeholder="Enter client name"
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Client ID
                </label>
                <input
                  type="text"
                  value={newClient.clientId}
                  onChange={(e) => setNewClient(prev => ({ ...prev, clientId: e.target.value }))}
                  placeholder="Enter unique client ID"
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>

              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="newClientActive"
                  checked={newClient.isActive}
                  onChange={(e) => setNewClient(prev => ({ ...prev, isActive: e.target.checked }))}
                  className="w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
                />
                <label htmlFor="newClientActive" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Active
                </label>
              </div>

              <div className="border-t border-gray-200 dark:border-gray-600 pt-4">
                <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">Feature Access</h4>

                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="newClientOrderEntry"
                      checked={newClient.hasOrderEntryAccess}
                      onChange={(e) => setNewClient(prev => ({ ...prev, hasOrderEntryAccess: e.target.checked }))}
                      className="w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
                    />
                    <label htmlFor="newClientOrderEntry" className="text-sm text-gray-700 dark:text-gray-300 flex items-center space-x-2">
                      <FileText className="h-4 w-4 text-purple-600" />
                      <span>Order Entry Access</span>
                    </label>
                  </div>

                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="newClientRateQuote"
                      checked={newClient.hasRateQuoteAccess}
                      onChange={(e) => setNewClient(prev => ({ ...prev, hasRateQuoteAccess: e.target.checked }))}
                      className="w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
                    />
                    <label htmlFor="newClientRateQuote" className="text-sm text-gray-700 dark:text-gray-300 flex items-center space-x-2">
                      <DollarSign className="h-4 w-4 text-purple-600" />
                      <span>Rate Quote Access</span>
                    </label>
                  </div>

                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="newClientAddressBook"
                      checked={newClient.hasAddressBookAccess}
                      onChange={(e) => setNewClient(prev => ({ ...prev, hasAddressBookAccess: e.target.checked }))}
                      className="w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
                    />
                    <label htmlFor="newClientAddressBook" className="text-sm text-gray-700 dark:text-gray-300 flex items-center space-x-2">
                      <BookUser className="h-4 w-4 text-purple-600" />
                      <span>Address Book Access</span>
                    </label>
                  </div>
                </div>
              </div>

              {error && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-lg p-3">
                  <p className="text-red-700 dark:text-red-400 text-sm">{error}</p>
                </div>
              )}

              <div className="flex space-x-3">
                <button
                  onClick={handleAddClient}
                  disabled={isCreating}
                  className="flex-1 px-4 py-3 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-400 text-white font-semibold rounded-lg transition-colors duration-200"
                >
                  {isCreating ? 'Creating...' : 'Create Client'}
                </button>
                <button
                  onClick={() => {
                    setShowAddClientModal(false);
                    setNewClient({
                      clientName: '',
                      clientId: '',
                      isActive: true,
                      hasOrderEntryAccess: false,
                      hasRateQuoteAccess: false,
                      hasAddressBookAccess: false
                    });
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

      {showEditClientModal && clientToEdit && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-start justify-center z-50 pt-20">
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-8 max-w-md w-full mx-4 shadow-2xl">
            <div className="text-center mb-6">
              <div className="bg-blue-100 dark:bg-blue-900/50 p-3 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                <Edit className="h-8 w-8 text-blue-600 dark:text-blue-400" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">Edit Client</h3>
              <p className="text-gray-600 dark:text-gray-400">Update client details and access permissions</p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Client Name
                </label>
                <input
                  type="text"
                  value={editClient.clientName}
                  onChange={(e) => setEditClient(prev => ({ ...prev, clientName: e.target.value }))}
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Client ID
                </label>
                <input
                  type="text"
                  value={editClient.clientId}
                  onChange={(e) => setEditClient(prev => ({ ...prev, clientId: e.target.value }))}
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="editClientActive"
                  checked={editClient.isActive}
                  onChange={(e) => setEditClient(prev => ({ ...prev, isActive: e.target.checked }))}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <label htmlFor="editClientActive" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Active
                </label>
              </div>

              <div className="border-t border-gray-200 dark:border-gray-600 pt-4">
                <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">Feature Access</h4>

                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="editClientOrderEntry"
                      checked={editClient.hasOrderEntryAccess}
                      onChange={(e) => setEditClient(prev => ({ ...prev, hasOrderEntryAccess: e.target.checked }))}
                      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <label htmlFor="editClientOrderEntry" className="text-sm text-gray-700 dark:text-gray-300 flex items-center space-x-2">
                      <FileText className="h-4 w-4 text-blue-600" />
                      <span>Order Entry Access</span>
                    </label>
                  </div>

                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="editClientRateQuote"
                      checked={editClient.hasRateQuoteAccess}
                      onChange={(e) => setEditClient(prev => ({ ...prev, hasRateQuoteAccess: e.target.checked }))}
                      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <label htmlFor="editClientRateQuote" className="text-sm text-gray-700 dark:text-gray-300 flex items-center space-x-2">
                      <DollarSign className="h-4 w-4 text-blue-600" />
                      <span>Rate Quote Access</span>
                    </label>
                  </div>

                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="editClientAddressBook"
                      checked={editClient.hasAddressBookAccess}
                      onChange={(e) => setEditClient(prev => ({ ...prev, hasAddressBookAccess: e.target.checked }))}
                      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <label htmlFor="editClientAddressBook" className="text-sm text-gray-700 dark:text-gray-300 flex items-center space-x-2">
                      <BookUser className="h-4 w-4 text-blue-600" />
                      <span>Address Book Access</span>
                    </label>
                  </div>
                </div>
              </div>

              {error && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-lg p-3">
                  <p className="text-red-700 dark:text-red-400 text-sm">{error}</p>
                </div>
              )}

              <div className="flex space-x-3">
                <button
                  onClick={handleUpdateClient}
                  disabled={isSaving}
                  className="flex-1 px-4 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-semibold rounded-lg transition-colors duration-200"
                >
                  {isSaving ? 'Updating...' : 'Update Client'}
                </button>
                <button
                  onClick={() => {
                    setShowEditClientModal(false);
                    setClientToEdit(null);
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

      {showDeleteClientModal && clientToDelete && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-start justify-center z-50 pt-20">
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-8 max-w-md w-full mx-4 shadow-2xl">
            <div className="text-center mb-6">
              <div className="bg-red-100 dark:bg-red-900/50 p-3 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                <Trash2 className="h-8 w-8 text-red-600 dark:text-red-400" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">Delete Client</h3>
              <p className="text-gray-600 dark:text-gray-400">
                Are you sure you want to delete client <strong>"{clientToDelete.clientName}"</strong>?
              </p>
            </div>

            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-lg p-4 mb-6">
              <div className="flex items-center space-x-2 mb-2">
                <div className="w-4 h-4 bg-red-500 rounded-full"></div>
                <span className="font-semibold text-red-800 dark:text-red-300">Warning</span>
              </div>
              <ul className="text-red-700 dark:text-red-400 text-sm space-y-1">
                <li>• This action cannot be undone</li>
                <li>• All users under this client will be disassociated</li>
                <li>• {clientUserCounts[clientToDelete.id] || 0} user(s) will be affected</li>
              </ul>
            </div>

            <div className="flex space-x-3">
              <button
                onClick={confirmDeleteClient}
                disabled={isDeleting}
                className="flex-1 px-4 py-3 bg-red-600 hover:bg-red-700 disabled:bg-gray-400 text-white font-semibold rounded-lg transition-colors duration-200"
              >
                {isDeleting ? 'Deleting...' : 'Delete Client'}
              </button>
              <button
                onClick={() => {
                  setShowDeleteClientModal(false);
                  setClientToDelete(null);
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

      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100">Client Management</h3>
          <p className="text-gray-600 dark:text-gray-400 mt-1">Manage client companies and their feature access permissions</p>
        </div>
        <button
          onClick={() => setShowAddClientModal(true)}
          className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-lg transition-colors duration-200 flex items-center space-x-2"
        >
          <Plus className="h-4 w-4" />
          <span>Add Client</span>
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

      {error && !showAddClientModal && !showEditClientModal && !showDeleteClientModal && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-lg p-4">
          <div className="flex items-center space-x-2">
            <div className="w-4 h-4 bg-red-500 rounded-full"></div>
            <span className="font-semibold text-red-800 dark:text-red-300">Error</span>
          </div>
          <p className="text-red-700 dark:text-red-400 text-sm mt-1">{error}</p>
        </div>
      )}

      {clients.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 dark:bg-gray-700 rounded-xl">
          <Building2 className="h-12 w-12 text-gray-400 dark:text-gray-500 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">No Clients Yet</h3>
          <p className="text-gray-600 dark:text-gray-400 mb-4">Get started by creating your first client company.</p>
          <button
            onClick={() => setShowAddClientModal(true)}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-lg transition-colors duration-200 flex items-center space-x-2 mx-auto"
          >
            <Plus className="h-4 w-4" />
            <span>Add First Client</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {clients.map((client) => (
            <div
              key={client.id}
              className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-5 hover:shadow-lg transition-shadow duration-200"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center space-x-3">
                  <div className="bg-purple-100 dark:bg-purple-900/50 p-2 rounded-lg">
                    <Building2 className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-gray-900 dark:text-gray-100">{client.clientName}</h4>
                    <p className="text-sm text-gray-500 dark:text-gray-400">ID: {client.clientId}</p>
                  </div>
                </div>
                <div className="flex items-center space-x-1">
                  <button
                    onClick={() => handleEditClient(client)}
                    className="p-1 text-blue-500 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors duration-200"
                    title="Edit client"
                  >
                    <Edit className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleDeleteClient(client)}
                    className="p-1 text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors duration-200"
                    title="Delete client"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600 dark:text-gray-400">Status</span>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    client.isActive
                      ? 'bg-green-100 text-green-800 dark:bg-green-800 dark:text-green-200'
                      : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                  }`}>
                    {client.isActive ? 'Active' : 'Inactive'}
                  </span>
                </div>

                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600 dark:text-gray-400">Users</span>
                  <span className="font-medium text-gray-900 dark:text-gray-100">
                    {clientUserCounts[client.id] || 0}
                  </span>
                </div>

                <div className="border-t border-gray-200 dark:border-gray-700 pt-3">
                  <p className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">Feature Access</p>
                  <div className="flex flex-wrap gap-2">
                    {client.hasOrderEntryAccess ? (
                      <span className="flex items-center space-x-1 px-2 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300 text-xs rounded-full">
                        <CheckCircle className="h-3 w-3" />
                        <span>Order Entry</span>
                      </span>
                    ) : (
                      <span className="flex items-center space-x-1 px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 text-xs rounded-full">
                        <XCircle className="h-3 w-3" />
                        <span>Order Entry</span>
                      </span>
                    )}
                    {client.hasRateQuoteAccess ? (
                      <span className="flex items-center space-x-1 px-2 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300 text-xs rounded-full">
                        <CheckCircle className="h-3 w-3" />
                        <span>Rate Quote</span>
                      </span>
                    ) : (
                      <span className="flex items-center space-x-1 px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 text-xs rounded-full">
                        <XCircle className="h-3 w-3" />
                        <span>Rate Quote</span>
                      </span>
                    )}
                    {client.hasAddressBookAccess ? (
                      <span className="flex items-center space-x-1 px-2 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300 text-xs rounded-full">
                        <CheckCircle className="h-3 w-3" />
                        <span>Address Book</span>
                      </span>
                    ) : (
                      <span className="flex items-center space-x-1 px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 text-xs rounded-full">
                        <XCircle className="h-3 w-3" />
                        <span>Address Book</span>
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-700 rounded-lg p-4">
        <h4 className="font-semibold text-purple-800 dark:text-purple-300 mb-2">Client Management Information</h4>
        <ul className="text-sm text-purple-700 dark:text-purple-400 space-y-1">
          <li>• Each client company can have multiple users with individual credentials</li>
          <li>• Enable Order Entry or Rate Quote access at the client level to make these features available to users</li>
          <li>• Client admins can manage users within their organization</li>
          <li>• Users can only be granted access to features that are enabled for their client</li>
        </ul>
      </div>
    </div>
  );
}
