import React, { useState, useEffect } from 'react';
import Layout from '../../components/Layout';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Task } from '../../types/index';
import TaskSubmissionWithProof from '../../components/TaskSubmissionWithProof';
import TaskCountdown from '../../components/TaskCountdown';
import DeleteTaskModal from '../../components/DeleteTaskModal';
import toast from 'react-hot-toast';
import { formatCurrency } from '../../utils/currency';
import {
  CheckIcon,
  PauseIcon,
  PlayIcon,
  ClockIcon,
  CurrencyDollarIcon,
  CalendarIcon,
  PhotographIcon,
  CheckCircleIcon,
  TrashIcon
} from '@heroicons/react/outline';

export default function Tasks() {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'active' | 'completed'>('all');
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [showSubmissionForm, setShowSubmissionForm] = useState(false);
  const [taskToDelete, setTaskToDelete] = useState<Task | null>(null);

  useEffect(() => {
    fetchTasks();
  }, [user]);

  async function fetchTasks() {
    try {
      const { data, error } = await supabase
        .from('tasks')
        .select('*, task_proofs(status)')
        .eq('assigned_to', user?.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      const processedTasks = (data || []).map(task => ({
        ...task,
        hasApprovedProof: task.task_proofs?.some((proof: any) => proof.status === 'Approved')
      }));
      
      setTasks(processedTasks);
    } catch (error) {
      console.error('Error fetching tasks:', error);
      toast.error('Failed to fetch tasks');
    } finally {
      setLoading(false);
    }
  }

  async function updateTaskStatus(taskId: string, newStatus: Task['status']) {
    try {
      const now = new Date().toISOString();
      const task = tasks.find(t => t.id === taskId);
      if (!task) {
        toast.error('Task not found');
        return;
      }

      // Check if the task is assigned to the current user
      if (task.assigned_to !== user?.id) {
        toast.error('You are not authorized to update this task');
        return;
      }

      let updates: any = {
        status: newStatus,
        updated_at: now
      };

      // Handle timing updates
      if (newStatus === 'In Progress') {
        if (!task.started_at) {
          updates.started_at = now;
        } else if (task.last_pause_at) {
          // Calculate additional pause duration if resuming
          const pauseDuration = Math.max(0, new Date(now).getTime() - new Date(task.last_pause_at).getTime());
          updates.total_pause_duration = Math.floor((task.total_pause_duration || 0) + pauseDuration);
          updates.last_pause_at = null;
        }
      } else if (newStatus === 'Paused') {
        updates.last_pause_at = now;
      }

      const { error } = await supabase
        .from('tasks')
        .update(updates)
        .eq('id', taskId)
        .eq('assigned_to', user?.id); // Additional security check

      if (error) {
        console.error('Supabase update error:', error);
        toast.error(error.message || 'Failed to update task status');
        return;
      }

      setTasks(prev =>
        prev.map(t => (t.id === taskId ? { ...t, ...updates } : t))
      );

      toast.success(`Task ${newStatus.toLowerCase()}`);
    } catch (error) {
      console.error('Error updating task:', error);
      toast.error('Failed to update task status');
    }
  }

  const handleCompleteClick = (task: Task) => {
    setSelectedTask(task);
    setShowSubmissionForm(true);
  };

  const handleSubmitProof = async (data: { taskId: string; proofPhoto: string; notes: string }) => {
    try {
      // First, create the task proof
      const { error: proofError } = await supabase
        .from('task_proofs')
        .insert([
          {
            task_id: data.taskId,
            photo_url: data.proofPhoto,
            notes: data.notes,
            submitted_by: user?.id,
            status: 'Pending'
          }
        ]);

      if (proofError) throw proofError;

      // Then update the task status
      const now = new Date().toISOString();
      const task = tasks.find(t => t.id === data.taskId);
      
      if (task) {
        type TaskUpdate = Partial<Task> & { updated_at: string };
        const updates: TaskUpdate = {
          status: 'Completed',
          completed_at: now,
          updated_at: now
        };

        if (task.last_pause_at) {
          const pauseDuration = new Date(now).getTime() - new Date(task.last_pause_at).getTime();
          updates.total_pause_duration = (task.total_pause_duration || 0) + pauseDuration;
        }

        const { error: taskError } = await supabase
          .from('tasks')
          .update(updates)
          .eq('id', data.taskId);

        if (taskError) throw taskError;
      }

      toast.success('Task proof submitted successfully');
      setShowSubmissionForm(false);
      fetchTasks();
    } catch (error) {
      console.error('Error submitting task proof:', error);
      toast.error('Failed to submit task proof');
    }
  };

  const handleDeleteTask = async () => {
    if (!taskToDelete) return;

    try {
      const { error } = await supabase
        .from('tasks')
        .delete()
        .eq('id', taskToDelete.id);

      if (error) throw error;

      setTasks(prev => prev.filter(task => task.id !== taskToDelete.id));
      toast.success('Task deleted successfully');
      setTaskToDelete(null);
    } catch (error) {
      console.error('Error deleting task:', error);
      toast.error('Failed to delete task');
    }
  };

  const filteredTasks = tasks.filter(task => {
    if (filter === 'active') return task.status !== 'Completed' || !task.hasApprovedProof;
    if (filter === 'completed') return task.status === 'Completed' && task.hasApprovedProof;
    return true;
  });

  const getStatusColor = (status: string, hasApprovedProof: boolean | undefined) => {
    if (status === 'Completed' && hasApprovedProof) {
      return 'bg-green-100 text-green-800';
    }
    switch (status) {
      case 'Not Started':
        return 'bg-gray-100 text-gray-800';
      case 'In Progress':
        return 'bg-blue-100 text-blue-800';
      case 'Paused':
        return 'bg-yellow-100 text-yellow-800';
      case 'Completed':
        return 'bg-yellow-100 text-yellow-800'; // Pending approval
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusText = (status: string, hasApprovedProof: boolean | undefined) => {
    if (status === 'Completed') {
      return hasApprovedProof ? 'Completed' : 'Pending Approval';
    }
    return status;
  };

  return (
    <Layout>
      <div className="px-4 sm:px-6 lg:px-8">
        <div className="sm:flex sm:items-center">
          <div className="sm:flex-auto">
            <h1 className="text-3xl font-semibold text-gray-900">My Tasks</h1>
            <p className="mt-2 text-sm text-gray-700">
              A list of all your assigned tasks and their current status.
            </p>
          </div>
        </div>

        <div className="mt-6 bg-white rounded-lg shadow">
          <div className="p-4 border-b border-gray-200">
            <div className="flex space-x-4">
              <button
                onClick={() => setFilter('all')}
                className={`px-4 py-2 text-sm font-medium rounded-md ${
                  filter === 'all'
                    ? 'bg-pink-100 text-pink-700'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                All Tasks
              </button>
              <button
                onClick={() => setFilter('active')}
                className={`px-4 py-2 text-sm font-medium rounded-md ${
                  filter === 'active'
                    ? 'bg-pink-100 text-pink-700'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                Active
              </button>
              <button
                onClick={() => setFilter('completed')}
                className={`px-4 py-2 text-sm font-medium rounded-md ${
                  filter === 'completed'
                    ? 'bg-pink-100 text-pink-700'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                Completed
              </button>
            </div>
          </div>

          {loading ? (
            <div className="flex justify-center items-center h-64">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-pink-500"></div>
            </div>
          ) : filteredTasks.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-500">No tasks found</p>
            </div>
          ) : (
            <div className="overflow-hidden">
              <ul role="list" className="divide-y divide-gray-200">
                {filteredTasks.map((task) => (
                  <li key={task.id} className="p-4 sm:p-6">
                    <div className="flex items-center justify-between flex-wrap gap-4">
                      <div className="flex-1 min-w-0">
                        <h3 className="text-lg font-medium text-gray-900">{task.title}</h3>
                        <p className="mt-1 text-sm text-gray-500">{task.description}</p>
                        <div className="mt-2 flex flex-wrap gap-4">
                          <div className="flex items-center text-sm text-gray-500">
                            <CalendarIcon className="mr-1.5 h-5 w-5 flex-shrink-0 text-gray-400" />
                            Due: {new Date(task.due_date).toLocaleDateString()}
                          </div>
                          <div className="flex items-center text-sm text-gray-500">
                            <CurrencyDollarIcon className="mr-1.5 h-5 w-5 flex-shrink-0 text-gray-400" />
                            {formatCurrency(task.price)}
                          </div>
                          <div className="flex items-center">
                            <TaskCountdown dueDate={task.due_date} status={task.status} />
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-col sm:flex-row gap-2 items-end sm:items-center">
                        <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(task.status, task.hasApprovedProof)}`}>
                          {getStatusText(task.status, task.hasApprovedProof)}
                        </span>
                        <div className="flex gap-2">
                          {task.status !== 'Completed' && (
                            <>
                              {task.status === 'In Progress' ? (
                                <button
                                  onClick={() => updateTaskStatus(task.id, 'Paused')}
                                  className="inline-flex items-center px-3 py-1.5 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-yellow-600 hover:bg-yellow-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-500"
                                >
                                  <PauseIcon className="h-4 w-4 mr-1" />
                                  Pause
                                </button>
                              ) : (
                                <button
                                  onClick={() => updateTaskStatus(task.id, 'In Progress')}
                                  className="inline-flex items-center px-3 py-1.5 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                                >
                                  <PlayIcon className="h-4 w-4 mr-1" />
                                  {task.status === 'Paused' ? 'Resume' : 'Start'}
                                </button>
                              )}
                              {task.status !== 'Not Started' && (
                                <button
                                  onClick={() => handleCompleteClick(task)}
                                  className="inline-flex items-center px-3 py-1.5 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                                >
                                  <CheckIcon className="h-4 w-4 mr-1" />
                                  Complete
                                </button>
                              )}
                            </>
                          )}
                          <button
                            onClick={() => setTaskToDelete(task)}
                            className="inline-flex items-center px-2 py-1.5 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                            aria-label="Delete task"
                          >
                            <TrashIcon className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      {/* Task Submission Form */}
      {showSubmissionForm && selectedTask && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" />
            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
              <TaskSubmissionWithProof
                taskId={selectedTask.id}
                onSubmit={handleSubmitProof}
                onCancel={() => setShowSubmissionForm(false)}
              />
            </div>
          </div>
        </div>
      )}

      {/* Delete Task Modal */}
      {taskToDelete && (
        <DeleteTaskModal
          isOpen={!!taskToDelete}
          onClose={() => setTaskToDelete(null)}
          onConfirm={handleDeleteTask}
          taskTitle={taskToDelete.title}
        />
      )}
    </Layout>
  );
} 