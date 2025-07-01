import React from 'react';
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../../components/Layout';
import EnhancedTaskForm from '../../components/admin/EnhancedTaskForm';
import { supabase } from '../../lib/supabase';
import { GeofencingService } from '../../services/GeofencingService';
import toast from 'react-hot-toast';

export default function CreateTask() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  async function handleSubmit(formData: any) {
    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      // Create the task
      const { data: task, error: taskError } = await supabase
        .from('tasks')
        .insert([
          {
            title: formData.title,
            description: formData.description,
            priority: formData.priority,
            assigned_to: formData.assigned_to,
            due_date: formData.due_date,
            price: formData.price,
            location_required: formData.location_required,
            location_latitude: formData.location_latitude,
            location_longitude: formData.location_longitude,
            location_radius_meters: formData.location_radius_meters,
            auto_check_in: formData.auto_check_in,
            auto_check_out: formData.auto_check_out,
            status: 'Not Started',
            created_by: user.id,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
        ])
        .select()
        .single();

      if (taskError) throw taskError;

      // Create task location if location data is provided
      if (formData.location_data && task) {
        const { error: locationError } = await supabase
          .from('task_locations')
          .insert([
            {
              task_id: task.id,
              ...formData.location_data,
            },
          ]);

        if (locationError) {
          console.error('Error creating task location:', locationError);
          // Don't fail the entire operation for this
        }
      }

      toast.success('Task created successfully');
      navigate('/admin/tasks');
    } catch (error: any) {
      console.error('Error creating task:', error);
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
            <div className="bg-white shadow px-4 py-5 sm:rounded-lg sm:p-6">
              <div className="md:grid md:grid-cols-3 md:gap-6">
                <div className="md:col-span-1">
                  <h3 className="text-lg font-medium leading-6 text-gray-900">Task Details</h3>
                  <p className="mt-1 text-sm text-gray-500">
                    Provide the details for the new task, including location requirements if needed.
                  </p>
                </div>
                <div className="mt-5 md:mt-0 md:col-span-2">
                  <EnhancedTaskForm onSubmit={handleSubmit} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}