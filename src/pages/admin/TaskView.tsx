import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Layout from '../../components/Layout';
import TaskProofView from '../../components/TaskProofView';
import { supabase } from '../../lib/supabase';
import { Task, User } from '../../types/index';
import { ArrowLeftIcon, PhotographIcon } from '@heroicons/react/outline';
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

export default function TaskView() {
  const { taskId } = useParams<{ taskId: string }>();
  const navigate = useNavigate();
  const [task, setTask] = useState<Task | null>(null);
  const [assignedUser, setAssignedUser] = useState<User | null>(null);
  const [proofs, setProofs] = useState<TaskProof[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProof, setSelectedProof] = useState<TaskProof | null>(null);
  const [isProofModalOpen, setIsProofModalOpen] = useState(false);

  useEffect(() => {
    if (taskId) {
      fetchTaskDetails();
    }
  }, [taskId]);

  async function fetchTaskDetails() {
    try {
      // Fetch task details
      const { data: taskData, error: taskError } = await supabase
        .from('tasks')
        .select('*')
        .eq('id', taskId)
        .single();

      if (taskError) throw taskError;
      setTask(taskData);

      if (taskData.assigned_to) {
        // Fetch assigned user details
        const { data: userData, error: userError } = await supabase
          .from('users')
          .select('*')
          .eq('id', taskData.assigned_to)
          .single();

        if (userError) throw userError;
        setAssignedUser(userData);
      }

      // Fetch task proofs
      const { data: proofsData, error: proofsError } = await supabase
        .from('task_proofs')
        .select('*')
        .eq('task_id', taskId)
        .order('created_at', { ascending: false });

      if (proofsError) throw proofsError;
      setProofs(proofsData || []);
    } catch (error) {
      console.error('Error fetching task details:', error);
      toast.error('Failed to fetch task details');
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

  if (!task) {
    return (
      <Layout>
        <div className="text-center py-12">
          <p className="text-gray-500">Task not found</p>
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