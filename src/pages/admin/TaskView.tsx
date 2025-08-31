import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Layout from '../../components/Layout';
import TaskProofView from '../../components/TaskProofView';
import { supabase } from '../../lib/supabase';
import { Task, User } from '../../types/index';
import { ArrowLeftIcon, PhotographIcon, LocationMarkerIcon } from '@heroicons/react/outline';
import toast from 'react-hot-toast';
import { formatCurrency } from '../../utils/currency';

interface TaskProof {
  id: number;
  task_id: string;
  image_url: string;
  description: string;
  submitted_by: string;
  created_at: string;
  status: 'Pending' | 'Approved' | 'Rejected';
  rejection_reason?: string;
}

interface TaskLocation {
  id: string;
  task_id: string;
  geofence_id: string | null;
  geofence_name: string | null;
  latitude: number | null;
  longitude: number | null;
  radius_meters: number;
  arrival_required: boolean;
  departure_required: boolean;
}

export default function TaskView() {
  const { taskId } = useParams<{ taskId: string }>();
  const navigate = useNavigate();
  const [task, setTask] = useState<Task | null>(null);
  const [assignedUser, setAssignedUser] = useState<User | null>(null);
  const [proofs, setProofs] = useState<TaskProof[]>([]);
  const [locations, setLocations] = useState<TaskLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedProof, setSelectedProof] = useState<TaskProof | null>(null);
  const [isProofModalOpen, setIsProofModalOpen] = useState(false);

  useEffect(() => {
    if (taskId) {
      fetchTaskDetails();
    }
  }, [taskId]);

  async function fetchTaskDetails() {
    setLoading(true);
    setError(null);

    try {
      // Check if user is authenticated
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('Not authenticated');
      }

      // Fetch task details
      const { data: taskData, error: taskError } = await supabase
        .from('tasks')
        .select('*')
        .eq('id', taskId)
        .single();

      if (taskError) {
        if (taskError.code === 'PGRST116') {
          throw new Error('Task not found');
        }
        throw taskError;
      }

      if (!taskData) {
        throw new Error('Task not found');
      }

      setTask(taskData);

      // Fetch assigned user details if task is assigned
      if (taskData.assigned_to) {
        const { data: userData, error: userError } = await supabase
          .from('users')
          .select('*')
          .eq('id', taskData.assigned_to)
          .single();

        if (userError) {
          console.error('Error fetching user details:', userError);
          // Don't throw here, just log the error and continue
        } else {
          setAssignedUser(userData);
        }
      }

      // Fetch task locations if task is location-based
      if (taskData.location_required) {
        const { data: locationsData, error: locationsError } = await supabase
          .rpc('get_task_locations', { p_task_id: taskId });

        if (locationsError) {
          console.error('Error fetching locations:', locationsError);
          // Don't throw here, just log the error and continue
        } else {
          setLocations(locationsData || []);
        }
      }

      // Fetch task proofs
      const { data: proofsData, error: proofsError } = await supabase
        .from('task_proofs')
        .select('*')
        .eq('task_id', taskId)
        .order('created_at', { ascending: false });

      if (proofsError) {
        console.error('Error fetching proofs:', proofsError);
        // Don't throw here, just log the error and continue
      } else {
        setProofs(proofsData || []);
      }

    } catch (error: any) {
      console.error('Error fetching task details:', error);
      setError(error.message || 'Failed to fetch task details');
      toast.error(error.message || 'Failed to fetch task details');
    } finally {
      setLoading(false);
    }
  }

  const handleProofClick = (proof: TaskProof) => {
    setSelectedProof(proof);
    setIsProofModalOpen(true);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Not Started':
        return 'bg-gray-100 text-gray-800';
      case 'In Progress':
        return 'bg-blue-100 text-blue-800';
      case 'Paused':
        return 'bg-yellow-100 text-yellow-800';
      case 'Completed':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-pink-500"></div>
        </div>
      </Layout>
    );
  }

  if (error || !task) {
    return (
      <Layout>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mb-6">
            <button
              onClick={() => navigate('/admin/tasks')}
              className="inline-flex items-center text-gray-600 hover:text-gray-900"
            >
              <ArrowLeftIcon className="h-5 w-5 mr-2" />
              Back to Tasks
            </button>
          </div>
          <div className="text-center py-12">
            <p className="text-red-500">{error || 'Task not found'}</p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-6">
          <button
            onClick={() => navigate('/admin/tasks')}
            className="inline-flex items-center text-gray-600 hover:text-gray-900"
          >
            <ArrowLeftIcon className="h-5 w-5 mr-2" />
            Back to Tasks
          </button>
        </div>

        <div className="bg-white shadow overflow-hidden sm:rounded-lg">
          <div className="px-4 py-5 sm:px-6">
            <div className="flex justify-between items-center">
              <h3 className="text-lg leading-6 font-medium text-gray-900">
                Task Details
              </h3>
              <span
                className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(
                  task.status
                )}`}
              >
                {task.status}
              </span>
            </div>
          </div>
          <div className="border-t border-gray-200 px-4 py-5 sm:px-6">
            <dl className="grid grid-cols-1 gap-x-4 gap-y-8 sm:grid-cols-2">
              <div className="sm:col-span-1">
                <dt className="text-sm font-medium text-gray-500">Title</dt>
                <dd className="mt-1 text-sm text-gray-900">{task.title}</dd>
              </div>
              <div className="sm:col-span-1">
                <dt className="text-sm font-medium text-gray-500">Assigned To</dt>
                <dd className="mt-1 text-sm text-gray-900">
                  {assignedUser?.full_name || 'Unassigned'}
                </dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-sm font-medium text-gray-500">Description</dt>
                <dd className="mt-1 text-sm text-gray-900">{task.description}</dd>
              </div>
              <div className="sm:col-span-1">
                <dt className="text-sm font-medium text-gray-500">Due Date</dt>
                <dd className="mt-1 text-sm text-gray-900">
                  {new Date(task.due_date).toLocaleDateString()}
                </dd>
              </div>
              <div className="sm:col-span-1">
                <dt className="text-sm font-medium text-gray-500">Price</dt>
                <dd className="mt-1 text-sm text-gray-900">
                  {formatCurrency(task.price)}
                </dd>
              </div>
            </dl>
          </div>
        </div>

        {task.location_required && locations.length > 0 && (
          <div className="mt-8">
            <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
              Task Locations
            </h3>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {locations.map((location) => (
                <div
                  key={location.id}
                  className="bg-white rounded-lg shadow overflow-hidden"
                >
                  <div className="p-4">
                    <div className="flex items-center mb-4">
                      <LocationMarkerIcon className="h-5 w-5 text-gray-400 mr-2" />
                      <h4 className="text-sm font-medium text-gray-900">
                        {location.geofence_name || 'Custom Location'}
                      </h4>
                    </div>
                    <dl className="grid grid-cols-1 gap-x-4 gap-y-2">
                      {location.geofence_name ? (
                        <div className="col-span-1">
                          <dt className="text-sm font-medium text-gray-500">Geofence</dt>
                          <dd className="mt-1 text-sm text-gray-900">{location.geofence_name}</dd>
                        </div>
                      ) : (
                        <>
                          <div className="col-span-1">
                            <dt className="text-sm font-medium text-gray-500">Coordinates</dt>
                            <dd className="mt-1 text-sm text-gray-900">
                              {location.latitude?.toFixed(6)}, {location.longitude?.toFixed(6)}
                            </dd>
                          </div>
                        </>
                      )}
                      <div className="col-span-1">
                        <dt className="text-sm font-medium text-gray-500">Radius</dt>
                        <dd className="mt-1 text-sm text-gray-900">{location.radius_meters}m</dd>
                      </div>
                      <div className="col-span-1">
                        <dt className="text-sm font-medium text-gray-500">Check-in/out</dt>
                        <dd className="mt-1 text-sm text-gray-900">
                          {location.arrival_required ? 'Auto check-in' : 'Manual check-in'}
                          {location.departure_required ? ', Auto check-out' : ', Manual check-out'}
                        </dd>
                      </div>
                    </dl>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="mt-8">
          <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
            Task Proofs
          </h3>
          {proofs.length === 0 ? (
            <p className="text-gray-500">No proofs submitted yet</p>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {proofs.map((proof) => (
                <div
                  key={proof.id}
                  className="relative bg-white rounded-lg shadow overflow-hidden cursor-pointer hover:shadow-md transition-shadow"
                  onClick={() => handleProofClick(proof)}
                >
                  <div className="aspect-w-16 aspect-h-9">
                    <img
                      src={proof.image_url}
                      alt="Task proof"
                      className="object-cover"
                    />
                  </div>
                  <div className="p-4">
                    <div className="flex items-center justify-between">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          proof.status === 'Approved'
                            ? 'bg-green-100 text-green-800'
                            : proof.status === 'Rejected'
                            ? 'bg-red-100 text-red-800'
                            : 'bg-yellow-100 text-yellow-800'
                        }`}
                      >
                        {proof.status}
                      </span>
                      <PhotographIcon className="h-5 w-5 text-gray-400" />
                    </div>
                    <p className="mt-2 text-sm text-gray-500 line-clamp-2">
                      {proof.description}
                    </p>
                    <p className="mt-2 text-xs text-gray-400">
                      {new Date(proof.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {selectedProof && (
          <TaskProofView
            isOpen={isProofModalOpen}
            onClose={() => {
              setIsProofModalOpen(false);
              setSelectedProof(null);
            }}
            proof={selectedProof}
            isAdmin={true}
            onStatusUpdate={fetchTaskDetails}
          />
        )}
      </div>
    </Layout>
  );
}