import React, { useState, useEffect } from 'react';
import Layout from '../../components/Layout';
import { supabase } from '../../lib/supabase';
import { User } from '../../types/index';
import toast from 'react-hot-toast';
import { ChatIcon, TrashIcon, ArchiveIcon } from '@heroicons/react/outline';
import DirectMessageModal from '../../components/DirectMessageModal';
import DeletedUsersModal from '../../components/DeletedUsersModal';

export default function Team() {
  const [team, setTeam] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [isMessageModalOpen, setIsMessageModalOpen] = useState(false);
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isDeletedUsersModalOpen, setIsDeletedUsersModalOpen] = useState(false);
  const [deletionReason, setDeletionReason] = useState('');

  useEffect(() => {
    fetchTeam();
  }, []);

  async function fetchTeam() {
    try {
      setLoading(true);
      // First check if the current user is an admin
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        throw new Error('No authenticated user found');
      }

      const { data: currentUser, error: currentUserError } = await supabase
        .from('users')
        .select('role')
        .eq('id', user.id)
        .single();

      if (currentUserError) {
        console.error('Error checking admin status:', currentUserError);
        throw new Error('Failed to verify admin status');
      }

      if (!currentUser || currentUser.role !== 'admin') {
        throw new Error('Only administrators can view team members');
      }

      // Fetch active users (not deleted)
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching team:', error);
        if (error.code === '42501') {
          throw new Error('You do not have permission to view team members');
        }
        throw error;
      }

      setTeam(data || []);
    } catch (error: any) {
      console.error('Error fetching team:', error);
      toast.error(error.message || 'Failed to fetch team members');
    } finally {
      setLoading(false);
    }
  }

  const handleMessageClick = (user: User) => {
    setSelectedUser(user);
    setIsMessageModalOpen(true);
  };

  const handleSelectUser = (userId: string) => {
    setSelectedUsers(prev => 
      prev.includes(userId) 
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

  const handleSelectAll = () => {
    if (selectedUsers.length === team.length) {
      setSelectedUsers([]);
    } else {
      setSelectedUsers(team.map(user => user.id));
    }
  };

  const handleDeleteSelected = async () => {
    try {
      if (!deletionReason.trim()) {
        toast.error('Please provide a reason for deletion');
        return;
      }

      // First check if the current user is an admin
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('No authenticated user found');
      }

      const { data: currentUser, error: currentUserError } = await supabase
        .from('users')
        .select('role')
        .eq('id', user.id)
        .single();

      if (currentUserError) {
        console.error('Error checking admin status:', currentUserError);
        throw new Error('Failed to verify admin status');
      }

      if (!currentUser || currentUser.role !== 'admin') {
        throw new Error('Only administrators can delete team members');
      }

      // First check if any users already exist in deleted_users
      const { data: existingDeleted, error: existingError } = await supabase
        .from('deleted_users')
        .select('id')
        .in('id', selectedUsers);

      if (existingError) {
        console.error('Error checking existing deleted users:', existingError);
        throw existingError;
      }

      const newUsersToDelete = selectedUsers.filter(
        userId => !existingDeleted?.some(deleted => deleted.id === userId)
      );

      console.log('Users to delete:', newUsersToDelete);

      if (newUsersToDelete.length > 0) {
        // Insert into deleted_users table first
        const { error: insertError } = await supabase
          .from('deleted_users')
          .insert(
            newUsersToDelete.map(userId => {
              const userToDelete = team.find(t => t.id === userId);
              if (!userToDelete) {
                throw new Error(`User ${userId} not found in team`);
              }
              return {
                id: userId,
                email: userToDelete.email,
                full_name: userToDelete.full_name,
                role: userToDelete.role,
                avatar_url: userToDelete.avatar_url,
                skills: userToDelete.skills,
                created_at: userToDelete.created_at,
                deleted_by: user.id,
                deletion_reason: deletionReason,
                deleted_at: new Date().toISOString()
              };
            })
          );

        if (insertError) {
          console.error('Error inserting into deleted_users:', insertError);
          throw insertError;
        }
      }

      // Then delete from users table
      const { error: deleteError } = await supabase
        .from('users')
        .delete()
        .in('id', selectedUsers);

      if (deleteError) {
        console.error('Error deleting users:', deleteError);
        if (deleteError.code === '42501') {
          throw new Error('You do not have permission to delete team members');
        }
        throw deleteError;
      }

      setSelectedUsers([]);
      setDeletionReason('');
      setIsDeleteModalOpen(false);
      
      toast.success('Selected team members have been permanently deleted');
      
      // Ensure we get fresh data after deletion
      await fetchTeam();
    } catch (error: any) {
      console.error('Error deleting team members:', error);
      toast.error(error.message || 'Failed to delete team members');
      setIsDeleteModalOpen(false);
    }
  };

  return (
    <Layout>
      <div className="px-4 sm:px-6 lg:px-8">
        <div className="sm:flex sm:items-center">
          <div className="sm:flex-auto">
            <h1 className="text-3xl font-semibold text-gray-900">Team</h1>
            <p className="mt-2 text-sm text-gray-700">
              A list of all active team members in your organization.
            </p>
          </div>
          <div className="mt-4 sm:mt-0 sm:ml-16 sm:flex-none space-x-4">
            <button
              onClick={() => setIsDeletedUsersModalOpen(true)}
              className="inline-flex items-center justify-center rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 sm:w-auto"
            >
              <ArchiveIcon className="h-4 w-4 mr-2" />
              View Deleted Members
            </button>
            {selectedUsers.length > 0 && (
              <button
                onClick={() => setIsDeleteModalOpen(true)}
                className="inline-flex items-center justify-center rounded-md border border-transparent bg-red-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 sm:w-auto"
              >
                <TrashIcon className="h-4 w-4 mr-2" />
                Delete Selected ({selectedUsers.length})
              </button>
            )}
          </div>
        </div>

        <div className="mt-8 flex flex-col">
          <div className="-my-2 -mx-4 overflow-x-auto sm:-mx-6 lg:-mx-8">
            <div className="inline-block min-w-full py-2 align-middle md:px-6 lg:px-8">
              <div className="overflow-hidden shadow ring-1 ring-black ring-opacity-5 md:rounded-lg">
                {loading ? (
                  <div className="flex justify-center items-center h-64">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500"></div>
                  </div>
                ) : (
                  <table className="min-w-full divide-y divide-gray-300">
                    <thead className="bg-gray-50">
                      <tr>
                        <th scope="col" className="relative w-12 px-6 sm:w-16 sm:px-8">
                          <input
                            type="checkbox"
                            className="absolute left-4 top-1/2 -mt-2 h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 sm:left-6"
                            checked={selectedUsers.length === team.length}
                            onChange={handleSelectAll}
                            aria-label="Select all team members"
                          />
                        </th>
                        <th scope="col" className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 sm:pl-6">
                          Name
                        </th>
                        <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                          Email
                        </th>
                        <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                          Role
                        </th>
                        <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                          Skills
                        </th>
                        <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                          Joined
                        </th>
                        <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 bg-white">
                      {team.map((member) => (
                        <tr key={member.id}>
                          <td className="relative w-12 px-6 sm:w-16 sm:px-8">
                            <input
                              type="checkbox"
                              className="absolute left-4 top-1/2 -mt-2 h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 sm:left-6"
                              checked={selectedUsers.includes(member.id)}
                              onChange={() => handleSelectUser(member.id)}
                              aria-label={`Select ${member.full_name}`}
                            />
                          </td>
                          <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm sm:pl-6">
                            <div className="flex items-center">
                              <div className="h-10 w-10 flex-shrink-0">
                                <img
                                  className="h-10 w-10 rounded-full"
                                  src={member.avatar_url || `https://ui-avatars.com/api/?name=${member.full_name}`}
                                  alt=""
                                />
                              </div>
                              <div className="ml-4">
                                <div className="font-medium text-gray-900">{member.full_name}</div>
                              </div>
                            </div>
                          </td>
                          <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">{member.email}</td>
                          <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500 capitalize">{member.role}</td>
                          <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                            <div className="flex flex-wrap gap-1">
                              {member.skills?.map((skill, index) => (
                                <span
                                  key={index}
                                  className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800"
                                >
                                  {skill}
                                </span>
                              ))}
                            </div>
                          </td>
                          <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                            {new Date(member.created_at).toLocaleDateString()}
                          </td>
                          <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                            <button
                              onClick={() => handleMessageClick(member)}
                              className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-full shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                            >
                              <ChatIcon className="h-4 w-4 mr-1" />
                              Message
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Direct Message Modal */}
      <DirectMessageModal
        isOpen={isMessageModalOpen}
        onClose={() => {
          setIsMessageModalOpen(false);
          setSelectedUser(null);
        }}
        recipient={selectedUser}
      />

      {/* Delete Confirmation Modal */}
      {isDeleteModalOpen && (
        <div className="fixed z-10 inset-0 overflow-y-auto">
          <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" />
            <span className="hidden sm:inline-block sm:align-middle sm:h-screen">&#8203;</span>
            <div className="inline-block align-bottom bg-white rounded-lg px-4 pt-5 pb-4 text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full sm:p-6">
              <div className="sm:flex sm:items-start">
                <div className="mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-red-100 sm:mx-0 sm:h-10 sm:w-10">
                  <TrashIcon className="h-6 w-6 text-red-600" />
                </div>
                <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left">
                  <h3 className="text-lg leading-6 font-medium text-gray-900">
                    Permanently Delete Team Members
                  </h3>
                  <div className="mt-2">
                    <p className="text-sm text-gray-500">
                      Are you sure you want to permanently delete {selectedUsers.length} selected team member{selectedUsers.length === 1 ? '' : 's'}? This action cannot be undone.
                    </p>
                    <div className="mt-4">
                      <label htmlFor="reason" className="block text-sm font-medium text-gray-700">
                        Deletion Reason
                      </label>
                      <textarea
                        id="reason"
                        name="reason"
                        rows={3}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                        value={deletionReason}
                        onChange={(e) => setDeletionReason(e.target.value)}
                        placeholder="Please provide a reason for deletion"
                      />
                    </div>
                  </div>
                </div>
              </div>
              <div className="mt-5 sm:mt-4 sm:flex sm:flex-row-reverse">
                <button
                  type="button"
                  className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-red-600 text-base font-medium text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 sm:ml-3 sm:w-auto sm:text-sm"
                  onClick={handleDeleteSelected}
                >
                  Delete Permanently
                </button>
                <button
                  type="button"
                  className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:w-auto sm:text-sm"
                  onClick={() => {
                    setIsDeleteModalOpen(false);
                    setDeletionReason('');
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Deleted Users Modal */}
      <DeletedUsersModal
        isOpen={isDeletedUsersModalOpen}
        onClose={() => setIsDeletedUsersModalOpen(false)}
      />
    </Layout>
  );
} 