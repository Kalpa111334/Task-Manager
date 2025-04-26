import React from 'react';
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../../components/Layout';
import { supabase } from '../../lib/supabase';
import { User } from '../../types';
import toast from 'react-hot-toast';
import { formatCurrency } from '../../utils/currency';
import { CurrencyDollarIcon } from '@heroicons/react/outline';

export default function CreateTask() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [employees, setEmployees] = useState<User[]>([]);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    priority: 'Medium' as 'High' | 'Medium' | 'Low',
    assigned_to: '',
    estimated_time: 0,
    due_date: '',
    price: 0,
  });
  const [useCustomPrice, setUseCustomPrice] = useState(false);

  useEffect(() => {
    fetchEmployees();
  }, []);

  async function fetchEmployees() {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('role', 'employee');

      if (error) throw error;
      setEmployees(data || []);
    } catch (error) {
      console.error('Error fetching employees:', error);
      toast.error('Failed to fetch employees');
    }
  }

  // AI-powered price calculation based on priority and estimated time
  function calculateTaskPrice(priority: string, estimatedTime: number): number {
    const baseRate = 20; // Base hourly rate
    const priorityMultiplier = {
      High: 1.5,
      Medium: 1.2,
      Low: 1.0,
    }[priority] || 1.0;

    return Math.round(baseRate * estimatedTime * priorityMultiplier);
  }

  // Update price when priority or estimated time changes
  useEffect(() => {
    if (!useCustomPrice) {
      const calculatedPrice = calculateTaskPrice(formData.priority, formData.estimated_time);
      setFormData(prev => ({ ...prev, price: calculatedPrice }));
    }
  }, [formData.priority, formData.estimated_time, useCustomPrice]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    try {
      const { error } = await supabase.from('tasks').insert([
        {
          ...formData,
          status: 'Not Started',
          created_by: (await supabase.auth.getUser()).data.user?.id,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ]);

      if (error) throw error;

      toast.success('Task created successfully');
      navigate('/admin/tasks');
    } catch (error: any) {
      toast.error(error.message || 'Failed to create task');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Layout>
      <div className="py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8">
          <h1 className="text-2xl font-semibold text-gray-900">Create New Task</h1>
        </div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8">
          <div className="mt-8">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="bg-white shadow px-4 py-5 sm:rounded-lg sm:p-6">
                <div className="md:grid md:grid-cols-3 md:gap-6">
                  <div className="md:col-span-1">
                    <h3 className="text-lg font-medium leading-6 text-gray-900">Task Details</h3>
                    <p className="mt-1 text-sm text-gray-500">
                      Provide the details for the new task.
                    </p>
                  </div>
                  <div className="mt-5 md:mt-0 md:col-span-2">
                    <div className="grid grid-cols-6 gap-6">
                      <div className="col-span-6">
                        <label htmlFor="title" className="block text-sm font-medium text-gray-700">
                          Title
                        </label>
                        <input
                          type="text"
                          name="title"
                          id="title"
                          required
                          className="mt-1 focus:ring-indigo-500 focus:border-indigo-500 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md"
                          value={formData.title}
                          onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                        />
                      </div>

                      <div className="col-span-6">
                        <label
                          htmlFor="description"
                          className="block text-sm font-medium text-gray-700"
                        >
                          Description
                        </label>
                        <textarea
                          id="description"
                          name="description"
                          rows={3}
                          required
                          className="mt-1 focus:ring-indigo-500 focus:border-indigo-500 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md"
                          value={formData.description}
                          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                        />
                      </div>

                      <div className="col-span-6 sm:col-span-3">
                        <label htmlFor="priority" className="block text-sm font-medium text-gray-700">
                          Priority
                        </label>
                        <select
                          id="priority"
                          name="priority"
                          required
                          className="mt-1 block w-full py-2 px-3 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                          value={formData.priority}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              priority: e.target.value as 'High' | 'Medium' | 'Low',
                            })
                          }
                        >
                          <option value="High">High</option>
                          <option value="Medium">Medium</option>
                          <option value="Low">Low</option>
                        </select>
                      </div>

                      <div className="col-span-6 sm:col-span-3">
                        <label
                          htmlFor="assigned_to"
                          className="block text-sm font-medium text-gray-700"
                        >
                          Assign To
                        </label>
                        <select
                          id="assigned_to"
                          name="assigned_to"
                          required
                          className="mt-1 block w-full py-2 px-3 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                          value={formData.assigned_to}
                          onChange={(e) => setFormData({ ...formData, assigned_to: e.target.value })}
                        >
                          <option value="">Select an employee</option>
                          {employees.map((employee) => (
                            <option key={employee.id} value={employee.id}>
                              {employee.full_name}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="col-span-6 sm:col-span-3">
                        <label
                          htmlFor="estimated_time"
                          className="block text-sm font-medium text-gray-700"
                        >
                          Estimated Time (hours)
                        </label>
                        <input
                          type="number"
                          name="estimated_time"
                          id="estimated_time"
                          min="0"
                          step="0.5"
                          required
                          className="mt-1 focus:ring-indigo-500 focus:border-indigo-500 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md"
                          value={formData.estimated_time}
                          onChange={(e) =>
                            setFormData({ ...formData, estimated_time: parseFloat(e.target.value) })
                          }
                        />
                      </div>

                      <div className="col-span-6 sm:col-span-3">
                        <label htmlFor="due_date" className="block text-sm font-medium text-gray-700">
                          Due Date
                        </label>
                        <input
                          type="date"
                          name="due_date"
                          id="due_date"
                          required
                          className="mt-1 focus:ring-indigo-500 focus:border-indigo-500 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md"
                          value={formData.due_date}
                          onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                        />
                      </div>

                      <div className="col-span-6">
                        <div className="flex items-center justify-between">
                          <label htmlFor="price" className="block text-sm font-medium text-gray-700">
                            Price (LKR)
                          </label>
                          <div className="flex items-center">
                            <input
                              type="checkbox"
                              id="use-custom-price"
                              checked={useCustomPrice}
                              onChange={(e) => setUseCustomPrice(e.target.checked)}
                              className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                            />
                            <label htmlFor="use-custom-price" className="ml-2 text-sm text-gray-600">
                              Use custom price
                            </label>
                          </div>
                        </div>
                        <div className="mt-1 relative rounded-md shadow-sm">
                          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <CurrencyDollarIcon className="h-5 w-5 text-gray-400" />
                          </div>
                          <input
                            type="number"
                            name="price"
                            id="price"
                            min="0"
                            step="1"
                            required
                            disabled={!useCustomPrice}
                            className={`mt-1 pl-10 focus:ring-indigo-500 focus:border-indigo-500 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md ${
                              !useCustomPrice ? 'bg-gray-100' : ''
                            }`}
                            value={formData.price}
                            onChange={(e) =>
                              setFormData({ ...formData, price: parseInt(e.target.value) })
                            }
                          />
                        </div>
                        {!useCustomPrice && (
                          <p className="mt-1 text-sm text-gray-500">
                            Suggested price based on priority and estimated time: {formatCurrency(formData.price)}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  type="button"
                  className="bg-white py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                  onClick={() => navigate('/admin/tasks')}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="ml-3 inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                >
                  {loading ? 'Creating...' : 'Create Task'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </Layout>
  );
} 