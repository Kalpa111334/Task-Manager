import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { User } from '../types';
import toast from 'react-hot-toast';
import { XIcon, TrashIcon } from '@heroicons/react/outline';

interface DeletedUser extends Omit<User, 'id'> {
  id: string;
  deleted_at: string;
  deleted_by: string;
  deletion_reason?: string;
}

interface DeletedUsersModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function DeletedUsersModal({ isOpen, onClose }: DeletedUsersModalProps) {
  const [deletedUsers, setDeletedUsers] = useState<DeletedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletedByUsers, setDeletedByUsers] = useState<{ [key: string]: string }>({});
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [isPermanentDeleteModalOpen, setIsPermanentDeleteModalOpen] = useState(false);

  useEffect(() => {
    if (isOpen) {
      fetchDeletedUsers();
    }
  }, [isOpen]);

  const fetchDeletedUsers = async () => {
    try {
      const { data: deletedData, error: deletedError } = await supabase
        .from('deleted_users')
        .select('*')
        .order('deleted_at', { ascending: false });

      if (deletedError) throw deletedError;

      // Fetch usernames of users who performed deletions
      const deletedByIds = [...new Set((deletedData || []).map(user => user.deleted_by))];
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('id, full_name')
        .in('id', deletedByIds);

      if (userError) throw userError;

      const userMap = (userData || []).reduce((acc, user) => {
        acc[user.id] = user.full_name;
        return acc;
      }, {} as { [key: string]: string });

      setDeletedByUsers(userMap);
      setDeletedUsers(deletedData || []);
    } catch (error: any) {
      console.error('Error fetching deleted users:', error);
      toast.error('Failed to fetch deleted users');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectUser = (userId: string) => {
    setSelectedUsers(prev =>
      prev.includes(userId)
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

  const handleSelectAll = () => {
    if (selectedUsers.length === deletedUsers.length) {
      setSelectedUsers([]);
    } else {
      setSelectedUsers(deletedUsers.map(user => user.id));
    }
  };

  const handlePermanentDelete = async () => {
    try {
      const { error } = await supabase
        .from('deleted_users')
        .delete()
        .in('id', selectedUsers);

      if (error) throw error;

      // Immediately update the UI by filtering out deleted users
      setDeletedUsers(prevUsers => prevUsers.filter(user => !selectedUsers.includes(user.id)));
      
      toast.success('Selected users have been permanently deleted');
      setSelectedUsers([]);
      setIsPermanentDeleteModalOpen(false);
      
      // Only fetch if there are no more users to show
      if (deletedUsers.length === selectedUsers.length) {
        fetchDeletedUsers();
      }
    } catch (error: any) {
      console.error('Error permanently deleting users:', error);
      toast.error('Failed to permanently delete users');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed z-10 inset-0 overflow-y-auto">
      <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" />
        <span className="hidden sm:inline-block sm:align-middle sm:h-screen">&#8203;</span>
        <div className="inline-block align-bottom bg-white rounded-lg px-4 pt-5 pb-4 text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-4xl sm:w-full sm:p-6">
          <div className="absolute top-0 right-0 pt-4 pr-4">
            <button
              type="button"
              className="bg-white rounded-md text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              onClick={onClose}
            >
              <span className="sr-only">Close</span>
              <XIcon className="h-6 w-6" />
            </button>
          </div>
          
          <div className="mt-3 text-center sm:mt-0 sm:text-left w-full">
            <div className="flex justify-between items-center">
              <h3 className="text-lg leading-6 font-medium text-gray-900">
                Deleted Team Members
              </h3>
              {selectedUsers.length > 0 && (
                <button
                  onClick={() => setIsPermanentDeleteModalOpen(true)}
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                >
                  <TrashIcon className="h-4 w-4 mr-2" />
                  Permanently Delete ({selectedUsers.length})
                </button>
              )}
            </div>
            <div className="mt-4">
              {loading ? (
                <div className="flex justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500" />
                </div>
              ) : deletedUsers.length === 0 ? (
                <p className="text-center text-gray-500 py-4">No deleted team members found</p>
              ) : (
                <div className="mt-8 flex flex-col">
                  <div className="-my-2 -mx-4 overflow-x-auto sm:-mx-6 lg:-mx-8">
                    <div className="inline-block min-w-full py-2 align-middle md:px-6 lg:px-8">
                      <div className="overflow-hidden shadow ring-1 ring-black ring-opacity-5 md:rounded-lg">
                        <table className="min-w-full divide-y divide-gray-300">
                          <thead className="bg-gray-50">
                            <tr>
                              <th scope="col" className="relative w-12 px-6 sm:w-16 sm:px-8">
                                <input
                                  type="checkbox"
                                  className="absolute left-4 top-1/2 -mt-2 h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 sm:left-6"
                                  checked={selectedUsers.length === deletedUsers.length}
                                  onChange={handleSelectAll}
                                  aria-label="Select all users"
                                />
                              </th>
                              <th scope="col" className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900">
                                Name
                              </th>
                              <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                                Email
                              </th>
                              <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                                Role
                              </th>
                              <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                                Deleted By
                              </th>
                              <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                                Deleted At
                              </th>
                              <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                                Reason
                              </th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-200 bg-white">
                            {deletedUsers.map((user) => (
                              <tr key={user.id} className={selectedUsers.includes(user.id) ? 'bg-gray-50' : undefined}>
                                <td className="relative w-12 px-6 sm:w-16 sm:px-8">
                                  <input
                                    type="checkbox"
                                    className="absolute left-4 top-1/2 -mt-2 h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 sm:left-6"
                                    checked={selectedUsers.includes(user.id)}
                                    onChange={() => handleSelectUser(user.id)}
                                    aria-label={`Select ${user.full_name}`}
                                  />
                                </td>
                                <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-gray-900">
                                  {user.full_name}
                                </td>
                                <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                                  {user.email}
                                </td>
                                <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500 capitalize">
                                  {user.role}
                                </td>
                                <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                                  {deletedByUsers[user.deleted_by] || 'Unknown'}
                                </td>
                                <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                                  {new Date(user.deleted_at).toLocaleString()}
                                </td>
                                <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                                  {user.deletion_reason || 'No reason provided'}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Permanent Delete Confirmation Modal */}
      {isPermanentDeleteModalOpen && (
        <div className="fixed z-20 inset-0 overflow-y-auto">
          <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" />
            <span className="hidden sm:inline-block sm:align-middle sm:h-screen">&#8203;</span>
            <div className="inline-block align-bottom bg-white rounded-lg px-4 pt-5 pb-4 text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full sm:p-6">
              <div className="sm:flex sm:items-start">
                <div className="mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-red-100 sm:mx-0 sm:h-10 sm:w-10">
                  <TrashIcon className="h-6 w-6 text-red-600" aria-hidden="true" />
                </div>
                <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left">
                  <h3 className="text-lg leading-6 font-medium text-gray-900">
                    Permanently Delete Users
                  </h3>
                  <div className="mt-2">
                    <p className="text-sm text-gray-500">
                      Are you sure you want to permanently delete {selectedUsers.length} selected user(s)? This action cannot be undone and all data will be permanently lost.
                    </p>
                  </div>
                </div>
              </div>
              <div className="mt-5 sm:mt-4 sm:flex sm:flex-row-reverse">
                <button
                  type="button"
                  className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-red-600 text-base font-medium text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 sm:ml-3 sm:w-auto sm:text-sm"
                  onClick={handlePermanentDelete}
                >
                  Permanently Delete
                </button>
                <button
                  type="button"
                  className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:w-auto sm:text-sm"
                  onClick={() => setIsPermanentDeleteModalOpen(false)}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 