import React, { useState, useEffect } from 'react';
import Layout from '../../components/Layout';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Task } from '../../types';
import { formatCurrency } from '../../utils/currency';
import {
  ClockIcon,
  CurrencyDollarIcon,
  CheckCircleIcon,
  ChartBarIcon,
} from '@heroicons/react/outline';
import { ResponsiveCard, ResponsiveGrid, StatCard } from '../../components/ui/ResponsiveComponents';

export default function EmployeeDashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState({
    totalEarnings: 0,
    completedTasks: 0,
    activeTask: null as Task | null,
    averageCompletionTime: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchEmployeeStats();
    }
  }, [user]);

  const fetchEmployeeStats = async () => {
    try {
      // Fetch all tasks for the employee
      const { data: tasks, error } = await supabase
        .from('tasks')
        .select('*')
        .eq('assigned_to', user?.id);

      if (error) throw error;

      if (tasks) {
        const completedTasks = tasks.filter(task => task.status === 'Completed');
        const activeTask = tasks.find(task => task.status === 'In Progress');
        const totalEarnings = completedTasks.reduce((sum, task) => sum + (task.price || 0), 0);
        
        // Calculate average completion time
        const completionTimes = completedTasks
          .filter(task => task.started_at && task.completed_at)
          .map(task => {
            const start = new Date(task.started_at!).getTime();
            const end = new Date(task.completed_at!).getTime();
            const pauseDuration = task.total_pause_duration || 0;
            return (end - start - pauseDuration) / (1000 * 60 * 60); // Convert to hours
          });

        const averageTime = completionTimes.length > 0
          ? completionTimes.reduce((sum, time) => sum + time, 0) / completionTimes.length
          : 0;

      setStats({
          totalEarnings,
        completedTasks: completedTasks.length,
          activeTask,
          averageCompletionTime: Math.round(averageTime * 10) / 10,
        });
      }
    } catch (error) {
      console.error('Error fetching employee stats:', error);
    } finally {
      setLoading(false);
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

  return (
    <Layout>
      <div className="py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h1 className="text-2xl font-semibold text-gray-900 mb-6">Welcome, {user?.full_name}</h1>

          <ResponsiveGrid cols={{ default: 1, sm: 2, lg: 4 }} gap={4}>
            <StatCard
              icon={<CurrencyDollarIcon className="h-8 w-8" />}
              title="Total Earnings"
              value={formatCurrency(stats.totalEarnings)}
              color="green"
            />
            <StatCard
              icon={<CheckCircleIcon className="h-8 w-8" />}
              title="Completed Tasks"
              value={stats.completedTasks}
              color="indigo"
            />
            <StatCard
              icon={<ClockIcon className="h-8 w-8" />}
              title="Avg. Completion Time"
              value={`${stats.averageCompletionTime}h`}
              color="blue"
            />
            <StatCard
              icon={<ChartBarIcon className="h-8 w-8" />}
              title="Current Status"
              value={stats.activeTask ? 'Active Task' : 'No Active Task'}
              color="purple"
            />
          </ResponsiveGrid>

          {stats.activeTask && (
            <ResponsiveCard className="mt-6">
              <h2 className="text-lg font-medium text-gray-900 mb-4">Current Active Task</h2>
              <div className="bg-white rounded-lg border border-gray-200 p-4">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="text-lg font-medium text-indigo-600">{stats.activeTask.title}</h3>
                    <p className="mt-1 text-sm text-gray-500">{stats.activeTask.description}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-gray-900">{formatCurrency(stats.activeTask.price)}</p>
                    <p className="mt-1 text-sm text-gray-500">
                      Due: {new Date(stats.activeTask.due_date).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              </div>
            </ResponsiveCard>
          )}
        </div>
      </div>
    </Layout>
  );
} 