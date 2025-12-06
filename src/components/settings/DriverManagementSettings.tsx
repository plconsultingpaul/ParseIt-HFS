import React, { useState, useEffect } from 'react';
import { Edit2, Trash2, Save, X, Search, Loader2, Users, AlertCircle, Download } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import type { DriverCheckin } from '../../types';

export default function DriverManagementSettings() {
  const [drivers, setDrivers] = useState<DriverCheckin[]>([]);
  const [filteredDrivers, setFilteredDrivers] = useState<DriverCheckin[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ name: '', company: '' });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    loadDrivers();
  }, []);

  useEffect(() => {
    filterDrivers();
  }, [searchTerm, drivers]);

  const loadDrivers = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('driver_checkins')
        .select('*')
        .order('updated_at', { ascending: false });

      if (error) throw error;

      const driversData: DriverCheckin[] = (data || []).map((item: any) => ({
        id: item.id,
        phoneNumber: item.phone_number,
        name: item.name,
        company: item.company,
        createdAt: item.created_at,
        updatedAt: item.updated_at
      }));

      setDrivers(driversData);
    } catch (err) {
      console.error('Error loading drivers:', err);
      setError('Failed to load drivers');
    } finally {
      setLoading(false);
    }
  };

  const filterDrivers = () => {
    if (!searchTerm.trim()) {
      setFilteredDrivers(drivers);
      return;
    }

    const term = searchTerm.toLowerCase();
    const filtered = drivers.filter(driver =>
      driver.phoneNumber.toLowerCase().includes(term) ||
      driver.name.toLowerCase().includes(term) ||
      driver.company.toLowerCase().includes(term)
    );

    setFilteredDrivers(filtered);
  };

  const startEdit = (driver: DriverCheckin) => {
    setEditingId(driver.id);
    setEditForm({ name: driver.name, company: driver.company });
    setError('');
    setSuccess('');
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditForm({ name: '', company: '' });
  };

  const saveEdit = async (driverId: string) => {
    if (!editForm.name.trim() || !editForm.company.trim()) {
      setError('Name and company are required');
      return;
    }

    try {
      const { error } = await supabase
        .from('driver_checkins')
        .update({
          name: editForm.name,
          company: editForm.company,
          updated_at: new Date().toISOString()
        })
        .eq('id', driverId);

      if (error) throw error;

      setSuccess('Driver information updated successfully');
      setEditingId(null);
      await loadDrivers();

      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      console.error('Error updating driver:', err);
      setError('Failed to update driver information');
    }
  };

  const deleteDriver = async (driverId: string, phoneNumber: string) => {
    if (!confirm(`Are you sure you want to delete driver ${phoneNumber}? This will also remove all associated check-in records and documents.`)) {
      return;
    }

    try {
      const { error } = await supabase
        .from('driver_checkins')
        .delete()
        .eq('id', driverId);

      if (error) throw error;

      setSuccess('Driver deleted successfully');
      await loadDrivers();

      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      console.error('Error deleting driver:', err);
      setError('Failed to delete driver');
    }
  };

  const exportDrivers = () => {
    const csvContent = [
      ['Phone Number', 'Name', 'Company', 'Created At', 'Updated At'],
      ...drivers.map(driver => [
        driver.phoneNumber,
        driver.name,
        driver.company,
        new Date(driver.createdAt).toLocaleString(),
        new Date(driver.updatedAt).toLocaleString()
      ])
    ].map(row => row.join(',')).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `drivers-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-3">
          <div className="bg-blue-100 dark:bg-blue-900/50 p-3 rounded-lg">
            <Users className="h-6 w-6 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Driver Management</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              View and manage driver information
            </p>
          </div>
        </div>
        <button
          onClick={exportDrivers}
          disabled={drivers.length === 0}
          className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center space-x-2"
        >
          <Download className="h-4 w-4" />
          <span>Export CSV</span>
        </button>
      </div>

      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-lg flex items-start space-x-3">
          <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
          <p className="text-red-800 dark:text-red-400 text-sm">{error}</p>
        </div>
      )}

      {success && (
        <div className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded-lg flex items-start space-x-3">
          <AlertCircle className="h-5 w-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
          <p className="text-green-800 dark:text-green-400 text-sm">{success}</p>
        </div>
      )}

      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
        <div className="flex items-center space-x-2 mb-4">
          <Search className="h-5 w-5 text-gray-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by phone, name, or company..."
            className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all hover:border-blue-400 dark:hover:border-blue-500"
          />
        </div>

        <div className="text-sm text-gray-600 dark:text-gray-400 mb-4">
          Showing {filteredDrivers.length} of {drivers.length} driver(s)
        </div>

        {filteredDrivers.length === 0 ? (
          <div className="text-center py-12">
            <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600 dark:text-gray-400">
              {drivers.length === 0 ? 'No drivers found' : 'No drivers match your search'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                    Phone Number
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                    Name
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                    Company
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                    Last Updated
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {filteredDrivers.map((driver) => (
                  <tr key={driver.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                    <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100 font-medium">
                      {driver.phoneNumber}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {editingId === driver.id ? (
                        <input
                          type="text"
                          value={editForm.name}
                          onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                          className="w-full px-2 py-1 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          autoFocus
                        />
                      ) : (
                        <span className="text-gray-900 dark:text-gray-100">{driver.name}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {editingId === driver.id ? (
                        <input
                          type="text"
                          value={editForm.company}
                          onChange={(e) => setEditForm({ ...editForm, company: e.target.value })}
                          className="w-full px-2 py-1 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                      ) : (
                        <span className="text-gray-900 dark:text-gray-100">{driver.company}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                      {new Date(driver.updatedAt).toLocaleDateString()} {new Date(driver.updatedAt).toLocaleTimeString()}
                    </td>
                    <td className="px-4 py-3 text-sm text-right">
                      {editingId === driver.id ? (
                        <div className="flex items-center justify-end space-x-2">
                          <button
                            onClick={() => saveEdit(driver.id)}
                            className="p-1 text-green-600 hover:bg-green-50 rounded transition-colors"
                            title="Save"
                          >
                            <Save className="h-4 w-4" />
                          </button>
                          <button
                            onClick={cancelEdit}
                            className="p-1 text-gray-600 hover:bg-gray-100 rounded transition-colors"
                            title="Cancel"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-end space-x-2">
                          <button
                            onClick={() => startEdit(driver)}
                            className="p-1 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                            title="Edit"
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => deleteDriver(driver.id, driver.phoneNumber)}
                            className="p-1 text-red-600 hover:bg-red-50 rounded transition-colors"
                            title="Delete"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
