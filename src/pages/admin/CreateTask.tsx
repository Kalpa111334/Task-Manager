import React from 'react';
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../../components/Layout';
import EnhancedTaskForm from '../../components/admin/EnhancedTaskForm';
import { supabase } from '../../lib/supabase';
import { GeofencingService } from '../../services/GeofencingService';
import toast from 'react-hot-toast';

interface TaskLocation {
  geofence_id?: string;
  latitude?: number;
  longitude?: number;
  radius_meters: number;
  arrival_required: boolean;
  departure_required: boolean;
}

export default function CreateTask() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  async function handleSubmit(formData: any) {
    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      // Validate locations if required
      if (formData.location_required && (!formData.locations || formData.locations.length === 0)) {
        throw new Error('At least one location is required');
      }

      if (formData.location_required && formData.locations) {
        const invalidLocations = formData.locations.filter((loc: TaskLocation) => {
          if (!loc) return true;
          // Location must either have a geofence_id OR both latitude and longitude
          return !loc.geofence_id && (!loc.latitude || !loc.longitude);
        });

        if (invalidLocations.length > 0) {
          throw new Error('Each location must have either a geofence or valid coordinates');
        }
      }

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
            status: 'Not Started',
            created_by: user.id,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
        ])
        .select()
        .single();

      if (taskError) throw taskError;

      // Create task locations if location is required
      if (formData.location_required && formData.locations && task) {
        try {
          // First, prepare all location data
          const locationDataArray = formData.locations.map((location: any) => ({
            task_id: task.id,
            geofence_id: location.geofence_id || null,
            latitude: typeof location.latitude === 'number' ? location.latitude : null,
            longitude: typeof location.longitude === 'number' ? location.longitude : null,
            radius_meters: location.radius_meters || 100,
            arrival_required: !!location.arrival_required,
            departure_required: !!location.departure_required,
          }));

          // Insert all locations in a single transaction
          const { error: locationError } = await supabase
            .from('task_locations')
            .insert(locationDataArray);

          if (locationError) {
            // If location save fails, delete the task
            await supabase.from('tasks').delete().eq('id', task.id);
            throw locationError;
          }

          toast.success('Task created successfully with all locations');
        } catch (locationError: any) {
          // Clean up the task if location save failed
          await supabase.from('tasks').delete().eq('id', task.id);
          throw new Error(locationError.message || 'Failed to save location');
        }
      } else {
        toast.success('Task created successfully');
      }

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
                    Provide the details for the new task. You can add multiple locations where this task can be performed.
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