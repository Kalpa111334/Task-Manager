import React, { useState, useEffect } from 'react';
import { Task, User } from '../types/index';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import TaskCountdown from './TaskCountdown';
import {
  CheckIcon,
  PauseIcon,
  PlayIcon,
  XIcon,
  DocumentIcon,
  EyeIcon,
  ClockIcon,
  UserIcon,
  CalendarIcon
} from '@heroicons/react/outline';
import { formatCurrency } from '../utils/currency';
import { format } from 'date-fns';

interface TaskListProps {
  isAdmin?: boolean;
}

export default function TaskList({ isAdmin = false }: TaskListProps) {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [users, setUsers] = useState<{ [key: string]: User }>({});
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    fetchTasks();
    fetchUsers();
  }, [user]);

  async function fetchTasks() {
    try {
      let query = supabase.from('tasks').select('*');

      if (!isAdmin) {
        query = query.eq('assigned_to', user?.id);
      }

      const { data, error } = await query;
      if (error) throw error;

      setTasks(data || []);
    } catch (error) {
      console.error('Error fetching tasks:', error);
      toast.error('Failed to fetch tasks');
    } finally {
      setLoading(false);
    }
  }

  async function fetchUsers() {
    try {
      const { data, error } = await supabase.from('users').select('*');
      if (error) throw error;

      const usersMap = (data || []).reduce((acc, user) => {
        acc[user.id] = user;
        return acc;
      }, {} as { [key: string]: User });

      setUsers(usersMap);
    } catch (error) {
      console.error('Error fetching users:', error);
    }
  }

  async function updateTaskStatus(taskId: string, newStatus: Task['status']) {
    try {
      const now = new Date().toISOString();
      const task = tasks.find(t => t.id === taskId);
      if (!task) return;

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
          const pauseDuration = new Date(now).getTime() - new Date(task.last_pause_at).getTime();
          updates.total_pause_duration = (task.total_pause_duration || 0) + pauseDuration;
          updates.last_pause_at = null;
        }
      } else if (newStatus === 'Paused') {
        updates.last_pause_at = now;
      } else if (newStatus === 'Completed') {
        updates.completed_at = now;
        if (task.last_pause_at) {
          const pauseDuration = new Date(now).getTime() - new Date(task.last_pause_at).getTime();
          updates.total_pause_duration = (task.total_pause_duration || 0) + pauseDuration;
        }
      }

      const { error: taskError } = await supabase
        .from('tasks')
        .update(updates)
        .eq('id', taskId);

      if (taskError) throw taskError;

      // Log the action
      const { error: logError } = await supabase
        .from('time_logs')
        .insert({
          task_id: taskId,
          action: newStatus === 'In Progress' 
            ? task.started_at ? 'resume' : 'start'
            : newStatus.toLowerCase(),
          timestamp: now
        });

      if (logError) throw logError;

      setTasks((prev) =>
        prev.map((t) => (t.id === taskId ? { ...t, ...updates } : t))
      );

      toast.success(`Task ${newStatus.toLowerCase()}`);
    } catch (error) {
      console.error('Error updating task:', error);
      toast.error('Failed to update task');
    }
  }

  const calculateWorkingTime = (task: Task): string => {
    if (!task.started_at) return '0h';

    const start = new Date(task.started_at).getTime();
    const end = task.completed_at ? new Date(task.completed_at).getTime() : Date.now();
    const totalPauseDuration = task.total_pause_duration || 0;
    const currentPauseDuration = task.last_pause_at 
      ? Date.now() - new Date(task.last_pause_at).getTime()
      : 0;

    const workingTimeMs = end - start - totalPauseDuration - (task.status === 'Paused' ? currentPauseDuration : 0);
    const workingTimeHours = Math.round(workingTimeMs / (1000 * 60 * 60) * 10) / 10;

    return `${workingTimeHours}h`;
  };

  const filteredTasks = tasks.filter((task) => {
    if (filter === 'active') return task.status !== 'Completed';
    if (filter === 'completed') return task.status === 'Completed';
    return true;
  });

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-pink-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="bg-white shadow overflow-hidden sm:rounded-md">
        <ul role="list" className="divide-y divide-gray-200">
          {filteredTasks.map((task) => (
            <li key={task.id}>
              <div className="px-4 py-4 sm:px-6 hover:bg-gray-50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <p className="text-sm font-medium text-indigo-600 truncate">
                      {isAdmin ? (
                        <Link to={`/admin/tasks/${task.id}`} className="hover:underline">
                          {task.title}
                        </Link>
                      ) : (
                        task.title
                      )}
                    </p>
                    <div className="ml-2 flex-shrink-0 flex">
                      <p className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        task.priority === 'High'
                          ? 'bg-red-100 text-red-800'
                          : task.priority === 'Medium'
                          ? 'bg-yellow-100 text-yellow-800'
                          : 'bg-green-100 text-green-800'
                      }`}>
                        {task.priority}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-sm text-gray-700 font-medium flex items-center">
                      <span className="text-gray-500 mr-1">LKR</span>
                      {formatCurrency(task.price)}
                    </span>
                    {task.status !== 'Completed' && (
                      <button
                        onClick={() => updateTaskStatus(task.id, task.status === 'In Progress' ? 'Paused' : 'In Progress')}
                        className={`inline-flex items-center px-3 py-1 border border-transparent text-sm leading-4 font-medium rounded-md shadow-sm text-white ${
                          task.status === 'In Progress'
                            ? 'bg-yellow-600 hover:bg-yellow-700'
                            : 'bg-green-600 hover:bg-green-700'
                        } focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500`}
                      >
                        {task.status === 'In Progress' ? 'Pause' : 'Start'}
                      </button>
                    )}
                  </div>
                </div>
                <div className="mt-2 sm:flex sm:justify-between">
                  <div className="sm:flex">
                    <p className="flex items-center text-sm text-gray-500">
                      <UserIcon className="flex-shrink-0 mr-1.5 h-5 w-5 text-gray-400" />
                      {users[task.assigned_to || '']?.full_name || 'Unassigned'}
                    </p>
                    <p className="mt-2 flex items-center text-sm text-gray-500 sm:mt-0 sm:ml-6">
                      <CalendarIcon className="flex-shrink-0 mr-1.5 h-5 w-5 text-gray-400" />
                      Due {format(new Date(task.due_date), 'MMM dd, yyyy')}
                    </p>
                    <div className="mt-2 sm:mt-0 sm:ml-6">
                      <TaskCountdown dueDate={task.due_date} status={task.status} />
                    </div>
                  </div>
                  <div className="mt-2 flex items-center text-sm text-gray-500 sm:mt-0">
                    <ClockIcon className="flex-shrink-0 mr-1.5 h-5 w-5 text-gray-400" />
                    <p>
                      {task.started_at
                        ? `Started ${format(new Date(task.started_at), 'MMM dd, yyyy')}`
                        : 'Not started'}
                    </p>
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}