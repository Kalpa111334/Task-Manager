import React, { useState, useEffect } from 'react';
import { GeofencingService, Geofence } from '../../services/GeofencingService';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import {
  MapIcon,
  PlusIcon,
  PencilIcon,
  TrashIcon,
  EyeIcon,
  EyeOffIcon,
} from '@heroicons/react/outline';
import toast from 'react-hot-toast';

interface GeofenceManagerProps {
  onGeofenceSelect?: (geofence: Geofence) => void;
  selectedGeofenceId?: string;
}

export default function GeofenceManager({ onGeofenceSelect, selectedGeofenceId }: GeofenceManagerProps) {
  const { user } = useAuth();
  const [geofences, setGeofences] = useState<Geofence[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [editingGeofence, setEditingGeofence] = useState<Geofence | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    center_latitude: 0,
    center_longitude: 0,
    radius_meters: 100,
  });

  useEffect(() => {
    fetchGeofences();
  }, []);

  const fetchGeofences = async () => {
    try {
      const data = await GeofencingService.getGeofences(false); // Include inactive
      setGeofences(data);
    } catch (error) {
      console.error('Error fetching geofences:', error);
      toast.error('Failed to fetch geofences');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user) {
      toast.error('User not authenticated');
      return;
    }

    try {
      if (editingGeofence) {
        await GeofencingService.updateGeofence(editingGeofence.id, formData);
        toast.success('Geofence updated successfully');
      } else {
        await GeofencingService.createGeofence({
          ...formData,
          created_by: user.id,
          is_active: true,
        });
        toast.success('Geofence created successfully');
      }
      
      resetForm();
      fetchGeofences();
    } catch (error) {
      console.error('Error saving geofence:', error);
      toast.error('Failed to save geofence');
    }
  };

  const handleEdit = (geofence: Geofence) => {
    setEditingGeofence(geofence);
    setFormData({
      name: geofence.name,
      description: geofence.description || '',
      center_latitude: geofence.center_latitude,
      center_longitude: geofence.center_longitude,
      radius_meters: geofence.radius_meters,
    });
    setIsCreating(true);
  };

  const handleDelete = async (geofence: Geofence) => {
    if (!confirm(`Are you sure you want to delete the geofence "${geofence.name}"?`)) {
      return;
    }

    try {
      await GeofencingService.deleteGeofence(geofence.id);
      toast.success('Geofence deleted successfully');
      fetchGeofences();
    } catch (error) {
      console.error('Error deleting geofence:', error);
      toast.error('Failed to delete geofence');
    }
  };

  const toggleActive = async (geofence: Geofence) => {
    try {
      await GeofencingService.updateGeofence(geofence.id, {
        is_active: !geofence.is_active,
      });
      toast.success(`Geofence ${geofence.is_active ? 'deactivated' : 'activated'}`);
      fetchGeofences();
    } catch (error) {
      console.error('Error toggling geofence status:', error);
      toast.error('Failed to update geofence status');
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      center_latitude: 0,
      center_longitude: 0,
      radius_meters: 100,
    });
    setIsCreating(false);
    setEditingGeofence(null);
  };

  const getCurrentLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setFormData(prev => ({
            ...prev,
            center_latitude: position.coords.latitude,
            center_longitude: position.coords.longitude,
          }));
          toast.success('Current location set');
        },
        (error) => {
          console.error('Error getting location:', error);
          toast.error('Failed to get current location');
        }
      );
    } else {
      toast.error('Geolocation is not supported by this browser');
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">Geofence Management</h2>
        <button
          onClick={() => setIsCreating(true)}
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
        >
          <PlusIcon className="h-5 w-5 mr-2" />
          Create Geofence
        </button>
      </div>

      {/* Create/Edit Form */}
      {isCreating && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">
            {editingGeofence ? 'Edit Geofence' : 'Create New Geofence'}
          </h3>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Name</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                  placeholder="Geofence name"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700">Radius (meters)</label>
                <input
                  type="number"
                  required
                  min="10"
                  max="10000"
                  value={formData.radius_meters}
                  onChange={(e) => setFormData(prev => ({ ...prev, radius_meters: parseInt(e.target.value) }))}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700">Latitude</label>
                <input
                  type="number"
                  required
                  step="any"
                  value={formData.center_latitude}
                  onChange={(e) => setFormData(prev => ({ ...prev, center_latitude: parseFloat(e.target.value) }))}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                  placeholder="0.000000"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700">Longitude</label>
                <div className="mt-1 flex rounded-md shadow-sm">
                  <input
                    type="number"
                    required
                    step="any"
                    value={formData.center_longitude}
                    onChange={(e) => setFormData(prev => ({ ...prev, center_longitude: parseFloat(e.target.value) }))}
                    className="flex-1 rounded-none rounded-l-md border-gray-300 focus:border-indigo-500 focus:ring-indigo-500"
                    placeholder="0.000000"
                  />
                  <button
                    type="button"
                    onClick={getCurrentLocation}
                    className="inline-flex items-center px-3 py-2 border border-l-0 border-gray-300 rounded-r-md bg-gray-50 text-gray-500 text-sm hover:bg-gray-100"
                  >
                    <MapIcon className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700">Description</label>
              <textarea
                rows={3}
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                placeholder="Optional description"
              />
            </div>
            
            <div className="flex justify-end space-x-3">
              <button
                type="button"
                onClick={resetForm}
                className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                {editingGeofence ? 'Update' : 'Create'} Geofence
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Geofences List */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">Existing Geofences</h3>
        </div>
        
        {geofences.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <MapIcon className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">No geofences</h3>
            <p className="mt-1 text-sm text-gray-500">Get started by creating a new geofence.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {geofences.map((geofence) => (
              <div
                key={geofence.id}
                className={`px-6 py-4 hover:bg-gray-50 cursor-pointer ${
                  selectedGeofenceId === geofence.id ? 'bg-indigo-50' : ''
                }`}
                onClick={() => onGeofenceSelect?.(geofence)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center">
                      <h4 className="text-lg font-medium text-gray-900">{geofence.name}</h4>
                      <div className="ml-2 flex items-center space-x-2">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          geofence.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                        }`}>
                          {geofence.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                    </div>
                    {geofence.description && (
                      <p className="text-sm text-gray-600 mt-1">{geofence.description}</p>
                    )}
                    <div className="mt-2 flex items-center space-x-4 text-sm text-gray-500">
                      <span>Radius: {geofence.radius_meters}m</span>
                      <span>
                        Location: {geofence.center_latitude.toFixed(6)}, {geofence.center_longitude.toFixed(6)}
                      </span>
                      <span>Created: {new Date(geofence.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                  
                  <div className="ml-6 flex items-center space-x-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleActive(geofence);
                      }}
                      className={`inline-flex items-center p-2 border border-transparent rounded-md shadow-sm text-white ${
                        geofence.is_active ? 'bg-gray-600 hover:bg-gray-700' : 'bg-green-600 hover:bg-green-700'
                      } focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500`}
                      title={geofence.is_active ? 'Deactivate' : 'Activate'}
                    >
                      {geofence.is_active ? (
                        <EyeOffIcon className="h-4 w-4" />
                      ) : (
                        <EyeIcon className="h-4 w-4" />
                      )}
                    </button>
                    
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEdit(geofence);
                      }}
                      className="inline-flex items-center p-2 border border-transparent rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                      title="Edit"
                    >
                      <PencilIcon className="h-4 w-4" />
                    </button>
                    
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(geofence);
                      }}
                      className="inline-flex items-center p-2 border border-transparent rounded-md shadow-sm text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                      title="Delete"
                    >
                      <TrashIcon className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}