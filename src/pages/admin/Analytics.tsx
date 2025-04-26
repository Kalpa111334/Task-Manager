import React, { useState, useEffect } from 'react';
import Layout from '../../components/Layout';
import { supabase } from '../../lib/supabase';
import { Task, User } from '../../types';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
} from 'chart.js';
import { Bar, Pie } from 'react-chartjs-2';
import {
  ChartBarIcon,
  CurrencyDollarIcon,
  ClockIcon,
  UserGroupIcon,
  CalendarIcon
} from '@heroicons/react/outline';
import { formatCurrency } from '../../utils/currency';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { ResponsiveCard, ResponsiveGrid, StatCard } from '../../components/ui/ResponsiveComponents';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement
);

export default function Analytics() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    try {
      // Fetch tasks
      const { data: tasksData, error: tasksError } = await supabase.from('tasks').select('*');
      if (tasksError) throw tasksError;

      // Fetch users
      const { data: usersData, error: usersError } = await supabase
        .from('users')
        .select('*')
        .eq('role', 'employee');
      if (usersError) throw usersError;

      setTasks(tasksData || []);
      setUsers(usersData || []);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  }

  // Task Status Distribution
  const statusData = {
    labels: ['Not Started', 'In Progress', 'Paused', 'Completed'],
    datasets: [
      {
        data: [
          tasks.filter((t) => t.status === 'Not Started').length,
          tasks.filter((t) => t.status === 'In Progress').length,
          tasks.filter((t) => t.status === 'Paused').length,
          tasks.filter((t) => t.status === 'Completed').length,
        ],
        backgroundColor: ['#EF4444', '#F59E0B', '#3B82F6', '#10B981'],
      },
    ],
  };

  // Employee Performance
  const employeeData = {
    labels: users.map((u) => u.full_name),
    datasets: [
      {
        label: 'Completed Tasks',
        data: users.map(
          (u) => tasks.filter((t) => t.assigned_to === u.id && t.status === 'Completed').length
        ),
        backgroundColor: '#3B82F6',
      },
      {
        label: 'Total Tasks',
        data: users.map((u) => tasks.filter((t) => t.assigned_to === u.id).length),
        backgroundColor: '#F59E0B',
      },
    ],
  };

  // Task Priority Distribution
  const priorityData = {
    labels: ['High', 'Medium', 'Low'],
    datasets: [
      {
        data: [
          tasks.filter((t) => t.priority === 'High').length,
          tasks.filter((t) => t.priority === 'Medium').length,
          tasks.filter((t) => t.priority === 'Low').length,
        ],
        backgroundColor: ['#EF4444', '#F59E0B', '#10B981'],
      },
    ],
  };

  // Calculate total earnings
  const totalEarnings = tasks
    .filter((t) => t.status === 'Completed')
    .reduce((sum, task) => sum + (task.price || 0), 0);

  // Calculate average completion time (in hours)
  const completedTasks = tasks.filter((t) => t.status === 'Completed' && t.actual_time);
  const avgCompletionTime =
    completedTasks.reduce((sum, task) => sum + (task.actual_time || 0), 0) / completedTasks.length;

  if (loading) {
    return (
      <Layout>
        <div>Loading analytics...</div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8">
          <h1 className="text-2xl font-semibold text-gray-900">Analytics</h1>
        </div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8">
          {/* Summary Cards */}
          <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0"></div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">Total Tasks</dt>
                      <dd className="text-2xl font-semibold text-gray-900">{tasks.length}</dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0"></div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">Total Earnings</dt>
                      <dd className="text-2xl font-semibold text-gray-900">
                        <div className="flex items-center">
                          <span className="text-gray-500 mr-1">LKR</span>
                          {totalEarnings.toLocaleString('en-LK')}
                        </div>
                      </dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0"></div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">
                        Avg. Completion Time
                      </dt>
                      <dd className="text-2xl font-semibold text-gray-900">
                        {avgCompletionTime.toFixed(1)}h
                      </dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Charts */}
          <div className="mt-8 grid grid-cols-1 gap-5 lg:grid-cols-2">
            <div className="bg-white p-6 rounded-lg shadow">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Task Status Distribution</h3>
              <div className="h-64">
                <Pie
                  data={statusData}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                  }}
                />
              </div>
            </div>

            <div className="bg-white p-6 rounded-lg shadow">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Task Priority Distribution</h3>
              <div className="h-64">
                <Pie
                  data={priorityData}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                  }}
                />
              </div>
            </div>

            <div className="bg-white p-6 rounded-lg shadow lg:col-span-2">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Employee Performance</h3>
              <div className="h-96">
                <Bar
                  data={employeeData}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                      y: {
                        beginAtZero: true,
                      },
                    },
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
} 