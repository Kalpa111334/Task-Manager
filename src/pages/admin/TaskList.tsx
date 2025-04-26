import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Task } from '../../types/index';
import { Link } from 'react-router-dom';
import { formatCurrency } from '../../utils/currency';
import {
  CurrencyDollarIcon,
  UserIcon,
  ClockIcon,
  CalendarIcon,
} from '@heroicons/react/outline';
import { toast } from 'react-hot-toast';

export default function TaskList() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTasks();
  }, []);

  async function fetchTasks() {
    try {
      const { data, error } = await supabase.from('tasks').select('*');
      if (error) throw error;
      setTasks(data || []);
    } catch (error) {
      console.error('Error fetching tasks:', error);
      toast.error('Failed to fetch tasks');
    } finally {
      setLoading(false);
    }
  }

  const handleStatusChange = async (taskId: string, newStatus: Task['status']) => {
    try {
      const { error } = await supabase
        .from('tasks')
        .update({ status: newStatus })
        .eq('id', taskId);

      if (error) throw error;

      setTasks(prevTasks => 
        prevTasks.map(t => t.id === taskId ? { ...t, status: newStatus } : t)
      );
      toast.success(`Task status updated to ${newStatus}`);
    } catch (error) {
      console.error('Error updating task status:', error);
      toast.error('Failed to update task status');
    }
  };

  if (loading) {
    return <div>Loading tasks...</div>;
  }

  return (
    <div className="space-y-4">
      {tasks.map(task => (
        <TaskListItem
          key={task.id}
          task={task}
          onStatusChange={handleStatusChange}
        />
      ))}
    </div>
  );
}

interface TaskListItemProps {
  task: Task;
  onStatusChange: (taskId: string, newStatus: Task['status']) => void;
}

function TaskListItem({ task, onStatusChange }: TaskListItemProps) {
  return (
    <div className="flex items-center justify-between p-4 border-b">
      <div className="flex items-center">
        <span className="text-lg font-medium">{task.title}</span>
        <span className="ml-4 text-gray-500">
          <span className="text-gray-500 mr-1">LKR</span>
          {formatCurrency(task.price)}
        </span>
      </div>
      <div className="flex items-center space-x-2">
        <button
          onClick={() => onStatusChange(task.id, task.status === 'In Progress' ? 'Paused' : 'In Progress')}
          className={`px-3 py-1 rounded ${
            task.status === 'In Progress' ? 'bg-yellow-500' : 'bg-green-500'
          } text-white`}
        >
          {task.status === 'In Progress' ? 'Pause' : 'Start'}
        </button>
      </div>
    </div>
  );
} 