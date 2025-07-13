import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { EnhancedLocationService } from '../../services/EnhancedLocationService';
import { GeofencingService, LocationAlert, TaskLocationEvent } from '../../services/GeofencingService';
import { supabase } from '../../lib/supabase';
import { Task } from '../../types/index';
import { formatCurrency } from '../../utils/currency';
import {
  LocationMarkerIcon,
  CheckCircleIcon,
  ClockIcon,
  ExclamationIcon,
  MapIcon,
  BellIcon,
  PlayIcon,
  PauseIcon,
} from '@heroicons/react/outline';
import toast from 'react-hot-toast';
import { LocationService } from '../../services/LocationService';

interface TaskWithLocation extends Task {
  location_required: boolean;
  location_latitude?: number;
  location_longitude?: number;
  location_radius_meters?: number;
  auto_check_in: boolean;
  auto_check_out: boolean;
  distance_to_location?: number;
  is_at_location?: boolean;
}

export default function LocationTaskInterface() {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<TaskWithLocation[]>([]);
  const [alerts, setAlerts] = useState<LocationAlert[]>([]);
  const [currentLocation, setCurrentLocation] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const [isLocationEnabled, setIsLocationEnabled] = useState(true);
  const [locationError, setLocationError] = useState<string>('');
  const [checkingIn, setCheckingIn] = useState<string | null>(null);
  const [checkingOut, setCheckingOut] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      fetchTasks();
      fetchAlerts();
      initializeLocation();
      
      // Always start tracking
      LocationService.startTracking(user.id);
      
      // Subscribe to location alerts
      const alertSubscription = GeofencingService.subscribeToLocationAlerts(
        user.id,
        (alert) => {
          setAlerts(prev => [alert, ...prev]);
          
          // Show toast notification
          const toastOptions = {
            duration: 5000,
            icon: alert.priority === 'critical' ? '🚨' : 
                  alert.priority === 'high' ? '⚠️' : 
                  alert.alert_type === 'arrival' ? '📍' : '🔔',
          };
          
          if (alert.priority === 'critical') {
            toast.error(alert.message, toastOptions);
          } else if (alert.priority === 'high') {
            toast.error(alert.message, toastOptions);
          } else {
            toast.success(alert.message, toastOptions);
          }
        }
      );

      return () => {
        alertSubscription.unsubscribe();
        LocationService.stopTracking();
      };
    }
  }, [user]);

  const fetchTasks = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('tasks')
        .select(`
          *,
          task_locations (
            required_latitude,
            required_longitude,
            required_radius_meters,
            arrival_required,
            departure_required
          )
        `)
        .eq('assigned_to', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const tasksWithLocation = (data || []).map(task => ({
        ...task,
        location_required: task.location_required || (task.task_locations && task.task_locations.length > 0),
        location_latitude: task.location_latitude || task.task_locations?.[0]?.required_latitude,
        location_longitude: task.location_longitude || task.task_locations?.[0]?.required_longitude,
        location_radius_meters: task.location_radius_meters || task.task_locations?.[0]?.required_radius_meters || 100,
        auto_check_in: task.auto_check_in || false,
        auto_check_out: task.auto_check_out || false,
      }));

      setTasks(tasksWithLocation);
      
      // Calculate distances if current location is available
      if (currentLocation) {
        updateTaskDistances(tasksWithLocation);
      }
    } catch (error) {
      console.error('Error fetching tasks:', error);
      toast.error('Failed to fetch tasks');
    }
  };

  const fetchAlerts = async () => {
    if (!user) return;

    try {
      const alerts = await GeofencingService.getLocationAlerts(user.id);
      setAlerts(alerts);
    } catch (error) {
      console.error('Error fetching alerts:', error);
      toast.error('Failed to fetch location alerts');
    }
  };

  const initializeLocation = async () => {
    try {
      setLocationError('');
      
      // First check if geolocation is available
      if (!navigator.geolocation) {
        throw new Error('Geolocation is not supported by your browser');
      }

      // Request permission first
      const permission = await navigator.permissions.query({ name: 'geolocation' });
      if (permission.state === 'denied') {
        throw new Error('Location permission denied. Please enable location access in your browser settings.');
      }

      // Start tracking first to ensure we have permissions
      await EnhancedLocationService.startTracking(user!.id);
      
      // Get current location from browser
      return new Promise<void>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(
          async (position) => {
            try {
              // Save the browser-obtained location
              await LocationService.saveLocation(user!.id, {
                latitude: position.coords.latitude,
                longitude: position.coords.longitude,
                accuracy: position.coords.accuracy,
                timestamp: new Date().toISOString(),
                battery_level: await LocationService.getBatteryLevel(),
                connection_status: navigator.onLine ? 'online' : 'offline'
              });

              // Set current location
              setCurrentLocation({
                latitude: position.coords.latitude,
                longitude: position.coords.longitude,
              });
              
              setIsLocationEnabled(true);
              toast.success('Location tracking initialized');
              resolve();
            } catch (saveError) {
              console.error('Error saving location:', saveError);
              reject(saveError);
            }
          },
          (error) => {
            console.error('Geolocation error:', error);
            reject(new Error(`Location retrieval failed: ${error.message}`));
          },
          {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 0
          }
        );
      });
    } catch (error: any) {
      console.error('Detailed location initialization error:', {
        message: error.message,
        code: error.code,
        stack: error.stack
      });

      const errorMessage = error.message || 'Failed to enable location tracking';
      setLocationError(errorMessage);
      setIsLocationEnabled(false);
      toast.error(errorMessage, {
        duration: 5000,
        icon: '🚨'
      });
      
      // Attempt to stop tracking to clean up
      try {
        EnhancedLocationService.stopTracking();
      } catch (stopError) {
        console.error('Error stopping location tracking:', stopError);
      }
    }
  };

  const updateTaskDistances = (taskList: TaskWithLocation[]) => {
    if (!currentLocation) return;

    const updatedTasks = taskList.map(task => {
      if (task.location_latitude && task.location_longitude && task.location_radius_meters) {
        const distance = GeofencingService.calculateDistance(
          currentLocation.latitude,
          currentLocation.longitude,
          task.location_latitude,
          task.location_longitude
        );
        
        const radius = task.location_radius_meters || 100; // Default to 100m if undefined
        
        return {
          ...task,
          distance_to_location: distance,
          is_at_location: distance <= radius,
        };
      }
      return task;
    });

    setTasks(updatedTasks);
  };

  const handleCheckIn = async (task: TaskWithLocation) => {
    if (!user) return;

    setCheckingIn(task.id);
    try {
      // Record task check-in event
      const { error } = await supabase
        .from('task_events')
        .insert({
          task_id: task.id,
          user_id: user.id,
          event_type: 'check_in',
          timestamp: new Date().toISOString()
        });

      if (error) throw error;
      
      toast.success('Checked in successfully');
      
      // Update task status if not already in progress
      if (task.status === 'Not Started') {
        await supabase
          .from('tasks')
          .update({ status: 'In Progress' })
          .eq('id', task.id);
      }
      
      fetchTasks();
    } catch (error) {
      console.error('Error checking in:', error);
      toast.error('Failed to check in');
    } finally {
      setCheckingIn(null);
    }
  };

  const handleCheckOut = async (task: TaskWithLocation) => {
    if (!user) {
      toast.error('User not authenticated');
      return;
    }

    // Validate task status and assignment
    if (task.status !== 'In Progress') {
      toast.error('Only tasks in progress can be checked out');
      return;
    }

    if (task.assigned_to !== user.id) {
      toast.error('You are not authorized to check out this task');
      return;
    }

    setCheckingOut(task.id);
    try {
      const now = new Date().toISOString();

      // Use a transaction to ensure both operations succeed or fail together
      const { data, error } = await supabase.rpc('check_out_task', {
        p_task_id: task.id,
        p_user_id: user.id,
        p_timestamp: now
      });

      if (error) {
        console.error('Error in check-out transaction:', error);
        toast.error(error.message || 'Failed to record check-out event');
        return;
      }

      toast.success('Checked out successfully');
      fetchTasks();
    } catch (error) {
      console.error('Error checking out:', error);
      toast.error('Failed to check out');
    } finally {
      setCheckingOut(null);
    }
  };

  const markAlertAsRead = async (alertId: string) => {
    try {
      await GeofencingService.markAlertAsRead(alertId);
      setAlerts(prev => prev.map(alert => 
        alert.id === alertId ? { ...alert, is_read: true } : alert
      ));
    } catch (error) {
      console.error('Error marking alert as read:', error);
    }
  };

  const getDistanceText = (distance: number) => {
    if (distance < 1000) {
      return `${Math.round(distance)}m away`;
    }
    return `${(distance / 1000).toFixed(1)}km away`;
  };

  const getLocationStatusIcon = (task: TaskWithLocation) => {
    if (!task.location_required) return null;
    
    if (task.is_at_location) {
      return <CheckCircleIcon className="h-5 w-5 text-green-600" />;
    }
    
    if (task.distance_to_location !== undefined) {
      return <LocationMarkerIcon className="h-5 w-5 text-orange-600" />;
    }
    
    return <MapIcon className="h-5 w-5 text-gray-400" />;
  };

  const unreadAlerts = alerts.filter(alert => !alert.is_read);
  const activeTasks = tasks.filter(task => task.status !== 'Completed');
  const locationRequiredTasks = activeTasks.filter(task => task.location_required);

  return (
    <div className="space-y-6">
      {/* Location Status */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-medium text-gray-900">Location Status</h2>
            <p className="text-sm text-gray-600">
              Location tracking is active
            </p>
          </div>
          <div className="flex items-center">
            <div className="flex items-center text-green-600">
              <div className="w-3 h-3 bg-green-600 rounded-full mr-2 animate-pulse"></div>
              <span className="text-sm font-medium">Active</span>
            </div>
          </div>
        </div>
        
        {locationError && (
          <div className="mt-4 p-4 bg-red-50 rounded-lg">
            <div className="flex">
              <ExclamationIcon className="h-5 w-5 text-red-400" />
              <div className="ml-3">
                <p className="text-sm text-red-800">{locationError}</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Alerts */}
      {unreadAlerts.length > 0 && (
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-medium text-gray-900 flex items-center">
              <BellIcon className="h-5 w-5 mr-2" />
              Alerts ({unreadAlerts.length})
            </h3>
          </div>
          <div className="divide-y divide-gray-200">
            {unreadAlerts.slice(0, 3).map((alert) => (
              <div key={alert.id} className="px-6 py-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900">{alert.title}</p>
                    <p className="text-sm text-gray-600">{alert.message}</p>
                    <p className="text-xs text-gray-500 mt-1">
                      {new Date(alert.created_at).toLocaleString()}
                    </p>
                  </div>
                  <div className="ml-4 flex items-center space-x-2">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      alert.priority === 'critical' ? 'bg-red-100 text-red-800' :
                      alert.priority === 'high' ? 'bg-orange-100 text-orange-800' :
                      alert.priority === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {alert.priority}
                    </span>
                    <button
                      onClick={() => markAlertAsRead(alert.id)}
                      className="text-indigo-600 hover:text-indigo-900 text-sm"
                    >
                      Mark as read
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Location-Required Tasks */}
      {locationRequiredTasks.length > 0 && (
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-medium text-gray-900 flex items-center">
              <MapIcon className="h-5 w-5 mr-2" />
              Location-Based Tasks
            </h3>
          </div>
          <div className="divide-y divide-gray-200">
            {locationRequiredTasks.map((task) => (
              <div key={task.id} className="px-6 py-4">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center">
                      <h4 className="text-lg font-medium text-gray-900">{task.title}</h4>
                      <div className="ml-2 flex items-center space-x-2">
                        {getLocationStatusIcon(task)}
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          task.status === 'Not Started' ? 'bg-gray-100 text-gray-800' :
                          task.status === 'In Progress' ? 'bg-blue-100 text-blue-800' :
                          task.status === 'Paused' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-green-100 text-green-800'
                        }`}>
                          {task.status}
                        </span>
                      </div>
                    </div>
                    <p className="text-sm text-gray-600 mt-1">{task.description}</p>
                    <div className="mt-2 flex items-center space-x-4 text-sm text-gray-500">
                      <span className="flex items-center">
                        <ClockIcon className="h-4 w-4 mr-1" />
                        Due: {new Date(task.due_date).toLocaleDateString()}
                      </span>
                      <span>Price: {formatCurrency(task.price)}</span>
                      {task.distance_to_location !== undefined && (
                        <span className={`flex items-center ${task.is_at_location ? 'text-green-600' : 'text-orange-600'}`}>
                          <LocationMarkerIcon className="h-4 w-4 mr-1" />
                          {task.is_at_location ? 'At location' : getDistanceText(task.distance_to_location)}
                        </span>
                      )}
                    </div>
                  </div>
                  
                  <div className="ml-6 flex items-center space-x-2">
                    {task.location_required && (
                      <>
                        <button
                          onClick={() => handleCheckIn(task)}
                          disabled={checkingIn === task.id || !task.is_at_location}
                          className="inline-flex items-center px-3 py-1.5 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {checkingIn === task.id ? (
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                          ) : (
                            <PlayIcon className="h-4 w-4 mr-1" />
                          )}
                          Check In
                        </button>
                        
                        <button
                          onClick={() => handleCheckOut(task)}
                          disabled={checkingOut === task.id || task.status !== 'In Progress'}
                          className="inline-flex items-center px-3 py-1.5 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-orange-600 hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {checkingOut === task.id ? (
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                          ) : (
                            <PauseIcon className="h-4 w-4 mr-1" />
                          )}
                          Check Out
                        </button>
                      </>
                    )}
                  </div>
                </div>
                
                {!task.is_at_location && task.location_required && (
                  <div className="mt-3 p-3 bg-orange-50 rounded-lg">
                    <p className="text-sm text-orange-800">
                      You need to be within {task.location_radius_meters}m of the task location to check in.
                      {task.distance_to_location && ` You are currently ${getDistanceText(task.distance_to_location)}.`}
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Regular Tasks */}
      {activeTasks.filter(task => !task.location_required).length > 0 && (
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-medium text-gray-900">Other Active Tasks</h3>
          </div>
          <div className="divide-y divide-gray-200">
            {activeTasks.filter(task => !task.location_required).map((task) => (
              <div key={task.id} className="px-6 py-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-lg font-medium text-gray-900">{task.title}</h4>
                    <p className="text-sm text-gray-600">{task.description}</p>
                    <div className="mt-2 flex items-center space-x-4 text-sm text-gray-500">
                      <span className="flex items-center">
                        <ClockIcon className="h-4 w-4 mr-1" />
                        Due: {new Date(task.due_date).toLocaleDateString()}
                      </span>
                      <span>Price: {formatCurrency(task.price)}</span>
                    </div>
                  </div>
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    task.status === 'Not Started' ? 'bg-gray-100 text-gray-800' :
                    task.status === 'In Progress' ? 'bg-blue-100 text-blue-800' :
                    task.status === 'Paused' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-green-100 text-green-800'
                  }`}>
                    {task.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}