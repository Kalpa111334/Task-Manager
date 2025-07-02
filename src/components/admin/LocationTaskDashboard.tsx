import React, { useState, useEffect, useCallback, useRef } from 'react';
import { GoogleMap, Marker, InfoWindow, Circle, Polygon } from '@react-google-maps/api';
import { EnhancedLocationService } from '../../services/EnhancedLocationService';
import { GeofencingService, Geofence, LocationAlert } from '../../services/GeofencingService';
import { supabase } from '../../lib/supabase';
import { Task, User } from '../../types/index';
import { formatCurrency } from '../../utils/currency';
import { useGoogleMaps } from '../GoogleMapsLoader';
import {
  LocationMarkerIcon,
  ExclamationIcon,
  CheckCircleIcon,
  ClockIcon,
  UserGroupIcon,
  MapIcon,
  BellIcon,
} from '@heroicons/react/outline';
import toast from 'react-hot-toast';

const mapContainerStyle = {
  width: '100%',
  height: '70vh',
};

const center = {
  lat: 7.8731,
  lng: 80.7718, // Center of Sri Lanka
};

const mapOptions = {
  disableDefaultUI: false,
  zoomControl: true,
  streetViewControl: false,
  mapTypeControl: true,
  fullscreenControl: true,
  styles: [
    {
      featureType: "poi",
      elementType: "labels",
      stylers: [{ visibility: "off" }],
    },
  ],
};

interface EmployeeLocation {
  id: string;
  latitude: number;
  longitude: number;
  user_id: string;
  timestamp: string;
  battery_level?: number;
  connection_status?: string;
  task_id?: string;
  location_accuracy?: number;
  users: {
    full_name: string;
    avatar_url: string;
  };
}

interface TaskWithLocation extends Task {
  location_latitude?: number;
  location_longitude?: number;
  location_radius_meters?: number;
  geofences?: Geofence[];
}

export default function LocationTaskDashboard() {
  const { isLoaded, loadError } = useGoogleMaps();

  const [locations, setLocations] = useState<EmployeeLocation[]>([]);
  const [tasks, setTasks] = useState<TaskWithLocation[]>([]);
  const [geofences, setGeofences] = useState<Geofence[]>([]);
  const [alerts, setAlerts] = useState<LocationAlert[]>([]);
  const [selectedLocation, setSelectedLocation] = useState<EmployeeLocation | null>(null);
  const [selectedTask, setSelectedTask] = useState<TaskWithLocation | null>(null);
  const [showGeofences, setShowGeofences] = useState(true);
  const [showTaskLocations, setShowTaskLocations] = useState(true);
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'completed'>('active');
  const [isCreatingGeofence, setIsCreatingGeofence] = useState(false);
  const [newGeofence, setNewGeofence] = useState<{
    center: google.maps.LatLng | null;
    radius: number;
    name: string;
    description: string;
  }>({
    center: null,
    radius: 100,
    name: '',
    description: '',
  });

  const mapRef = useRef<google.maps.Map>();

  const onMapLoad = useCallback((map: google.maps.Map) => {
    mapRef.current = map;
  }, []);

  const fetchData = useCallback(async () => {
    try {
      // Fetch employee locations
      const locationData = await EnhancedLocationService.getEmployeeLocations();
      setLocations(locationData);

      // Fetch tasks with location data
      const { data: taskData, error: taskError } = await supabase
        .from('tasks')
        .select(`
          *,
          task_locations (
            geofence_id,
            required_latitude,
            required_longitude,
            required_radius_meters
          )
        `)
        .order('created_at', { ascending: false });

      if (taskError) throw taskError;

      // Fetch geofences
      const geofenceData = await GeofencingService.getGeofences(true);
      setGeofences(geofenceData);

      // Process tasks with geofence data
      const tasksWithGeofences = await Promise.all(
        (taskData || []).map(async (task) => {
          const taskGeofences: Geofence[] = [];
          
          if (task.task_locations) {
            for (const taskLocation of task.task_locations) {
              if (taskLocation.geofence_id) {
                const geofence = geofenceData.find(g => g.id === taskLocation.geofence_id);
                if (geofence) {
                  taskGeofences.push(geofence);
                }
              }
            }
          }

          return {
            ...task,
            geofences: taskGeofences,
          };
        })
      );

      setTasks(tasksWithGeofences);

      // Fit map bounds to include all markers
      if (locationData.length > 0 && mapRef.current) {
        const bounds = new window.google.maps.LatLngBounds();
        locationData.forEach((location) => {
          bounds.extend({ lat: location.latitude, lng: location.longitude });
        });
        
        // Include task locations in bounds
        tasksWithGeofences.forEach((task) => {
          if (task.location_latitude && task.location_longitude) {
            bounds.extend({ lat: task.location_latitude, lng: task.location_longitude });
          }
          task.geofences?.forEach((geofence) => {
            bounds.extend({ lat: geofence.center_latitude, lng: geofence.center_longitude });
          });
        });

        mapRef.current.fitBounds(bounds);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Failed to fetch location data');
    }
  }, []);

  const fetchAlerts = useCallback(async () => {
    try {
      // Fetch recent alerts for all users (admin view)
      const { data, error } = await supabase
        .from('location_alerts')
        .select(`
          *,
          users:user_id (
            full_name
          )
        `)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      setAlerts(data || []);
    } catch (error) {
      console.error('Error fetching alerts:', error);
    }
  }, []);

  useEffect(() => {
    fetchData();
    fetchAlerts();
    
    // Set up real-time updates
    const interval = setInterval(fetchData, 30000); // Update every 30 seconds

    // Subscribe to location alerts
    const alertSubscription = supabase
      .channel('location_alerts_admin')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'location_alerts',
        },
        () => {
          fetchAlerts();
        }
      )
      .subscribe();

    return () => {
      clearInterval(interval);
      alertSubscription.unsubscribe();
    };
  }, [fetchData, fetchAlerts]);

  const handleMapClick = useCallback((event: google.maps.MapMouseEvent) => {
    if (isCreatingGeofence && event.latLng) {
      setNewGeofence(prev => ({
        ...prev,
        center: event.latLng,
      }));
    }
  }, [isCreatingGeofence]);

  const createGeofence = async () => {
    if (!newGeofence.center || !newGeofence.name.trim()) {
      toast.error('Please select a location and provide a name for the geofence');
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      await GeofencingService.createGeofence({
        name: newGeofence.name,
        description: newGeofence.description,
        center_latitude: newGeofence.center.lat(),
        center_longitude: newGeofence.center.lng(),
        radius_meters: newGeofence.radius,
        created_by: user.id,
        is_active: true,
      });

      toast.success('Geofence created successfully');
      setIsCreatingGeofence(false);
      setNewGeofence({
        center: null,
        radius: 100,
        name: '',
        description: '',
      });
      fetchData();
    } catch (error) {
      console.error('Error creating geofence:', error);
      toast.error('Failed to create geofence');
    }
  };

  const getEmployeeStatusColor = (location: EmployeeLocation) => {
    const timeDiff = Date.now() - new Date(location.timestamp).getTime();
    const minutesAgo = timeDiff / (1000 * 60);

    if (minutesAgo > 30) return '#EF4444'; // Red - offline/stale
    if (location.connection_status === 'offline') return '#F59E0B'; // Orange - offline but recent
    return '#10B981'; // Green - online and recent
  };

  const getTaskStatusColor = (task: TaskWithLocation) => {
    switch (task.status) {
      case 'Not Started': return '#6B7280';
      case 'In Progress': return '#3B82F6';
      case 'Paused': return '#F59E0B';
      case 'Completed': return '#10B981';
      default: return '#6B7280';
    }
  };

  const filteredTasks = tasks.filter(task => {
    if (filterStatus === 'active') return task.status !== 'Completed';
    if (filterStatus === 'completed') return task.status === 'Completed';
    return true;
  });

  const unreadAlerts = alerts.filter(alert => !alert.is_read);

  if (loadError) return <div className="p-4 text-red-600">Error loading maps</div>;
  if (!isLoaded) return <div className="p-4">Loading maps...</div>;

  return (
    <div className="space-y-6">
      {/* Header with Controls */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Location Task Dashboard</h2>
            <p className="text-gray-600">Monitor employee locations and task progress in real-time</p>
          </div>
          
          <div className="flex flex-wrap gap-4">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="show-geofences"
                checked={showGeofences}
                onChange={(e) => setShowGeofences(e.target.checked)}
                className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
              />
              <label htmlFor="show-geofences" className="text-sm font-medium text-gray-700">
                Show Geofences
              </label>
            </div>
            
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="show-task-locations"
                checked={showTaskLocations}
                onChange={(e) => setShowTaskLocations(e.target.checked)}
                className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
              />
              <label htmlFor="show-task-locations" className="text-sm font-medium text-gray-700">
                Show Task Locations
              </label>
            </div>

            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as any)}
              className="rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
            >
              <option value="all">All Tasks</option>
              <option value="active">Active Tasks</option>
              <option value="completed">Completed Tasks</option>
            </select>

            <button
              onClick={() => setIsCreatingGeofence(!isCreatingGeofence)}
              className={`inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white ${
                isCreatingGeofence ? 'bg-red-600 hover:bg-red-700' : 'bg-indigo-600 hover:bg-indigo-700'
              } focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500`}
            >
              <MapIcon className="h-5 w-5 mr-2" />
              {isCreatingGeofence ? 'Cancel' : 'Create Geofence'}
            </button>
          </div>
        </div>

        {/* Geofence Creation Form */}
        {isCreatingGeofence && (
          <div className="mt-4 p-4 bg-gray-50 rounded-lg">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Create New Geofence</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Name</label>
                <input
                  type="text"
                  value={newGeofence.name}
                  onChange={(e) => setNewGeofence(prev => ({ ...prev, name: e.target.value }))}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                  placeholder="Geofence name"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Radius (meters)</label>
                <input
                  type="number"
                  value={newGeofence.radius}
                  onChange={(e) => setNewGeofence(prev => ({ ...prev, radius: parseInt(e.target.value) }))}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                  min="10"
                  max="5000"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Description</label>
                <input
                  type="text"
                  value={newGeofence.description}
                  onChange={(e) => setNewGeofence(prev => ({ ...prev, description: e.target.value }))}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                  placeholder="Optional description"
                />
              </div>
            </div>
            <div className="mt-4 flex gap-2">
              <button
                onClick={createGeofence}
                disabled={!newGeofence.center || !newGeofence.name.trim()}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50"
              >
                Create Geofence
              </button>
              <p className="text-sm text-gray-600 flex items-center">
                {newGeofence.center ? 'Geofence location selected' : 'Click on the map to select location'}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <UserGroupIcon className="h-8 w-8 text-blue-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Active Employees</p>
              <p className="text-2xl font-semibold text-gray-900">{locations.length}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <ClockIcon className="h-8 w-8 text-yellow-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Active Tasks</p>
              <p className="text-2xl font-semibold text-gray-900">
                {tasks.filter(t => t.status !== 'Completed').length}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <CheckCircleIcon className="h-8 w-8 text-green-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Completed Today</p>
              <p className="text-2xl font-semibold text-gray-900">
                {tasks.filter(t => 
                  t.status === 'Completed' && 
                  t.completed_at && 
                  new Date(t.completed_at).toDateString() === new Date().toDateString()
                ).length}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <BellIcon className="h-8 w-8 text-red-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Unread Alerts</p>
              <p className="text-2xl font-semibold text-gray-900">{unreadAlerts.length}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Map */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <GoogleMap
          mapContainerStyle={mapContainerStyle}
          zoom={10}
          center={center}
          options={mapOptions}
          onLoad={onMapLoad}
          onClick={handleMapClick}
        >
          {/* Employee Location Markers */}
          {locations.map((location) => (
            <Marker
              key={location.id}
              position={{
                lat: location.latitude,
                lng: location.longitude,
              }}
              icon={{
                url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`
                  <svg width="40" height="40" viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg">
                    <circle cx="20" cy="20" r="18" fill="${getEmployeeStatusColor(location)}" stroke="white" stroke-width="3"/>
                    <circle cx="20" cy="20" r="8" fill="white"/>
                  </svg>
                `)}`,
                scaledSize: new window.google.maps.Size(40, 40),
                anchor: new window.google.maps.Point(20, 20),
              }}
              onClick={() => setSelectedLocation(location)}
            />
          ))}

          {/* Task Location Markers */}
          {showTaskLocations && filteredTasks.map((task) => {
            if (task.location_latitude && task.location_longitude) {
              return (
                <Marker
                  key={`task-${task.id}`}
                  position={{
                    lat: task.location_latitude,
                    lng: task.location_longitude,
                  }}
                  icon={{
                    url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`
                      <svg width="30" height="30" viewBox="0 0 30 30" xmlns="http://www.w3.org/2000/svg">
                        <rect x="5" y="5" width="20" height="20" fill="${getTaskStatusColor(task)}" stroke="white" stroke-width="2" rx="3"/>
                        <text x="15" y="18" text-anchor="middle" fill="white" font-size="12" font-weight="bold">T</text>
                      </svg>
                    `)}`,
                    scaledSize: new window.google.maps.Size(30, 30),
                    anchor: new window.google.maps.Point(15, 15),
                  }}
                  onClick={() => setSelectedTask(task)}
                />
              );
            }
            return null;
          })}

          {/* Geofence Circles */}
          {showGeofences && geofences.map((geofence) => (
            <Circle
              key={geofence.id}
              center={{
                lat: geofence.center_latitude,
                lng: geofence.center_longitude,
              }}
              radius={geofence.radius_meters}
              options={{
                fillColor: '#3B82F6',
                fillOpacity: 0.1,
                strokeColor: '#3B82F6',
                strokeOpacity: 0.8,
                strokeWeight: 2,
              }}
            />
          ))}

          {/* New Geofence Preview */}
          {isCreatingGeofence && newGeofence.center && (
            <Circle
              center={{
                lat: newGeofence.center.lat(),
                lng: newGeofence.center.lng(),
              }}
              radius={newGeofence.radius}
              options={{
                fillColor: '#10B981',
                fillOpacity: 0.2,
                strokeColor: '#10B981',
                strokeOpacity: 1,
                strokeWeight: 3,
                strokeDashArray: '10,5',
              }}
            />
          )}

          {/* Employee Location Info Window */}
          {selectedLocation && (
            <InfoWindow
              position={{
                lat: selectedLocation.latitude,
                lng: selectedLocation.longitude,
              }}
              onCloseClick={() => setSelectedLocation(null)}
            >
              <div className="p-2 max-w-xs">
                <div className="flex items-center mb-2">
                  <img
                    src={selectedLocation.users.avatar_url || `https://ui-avatars.com/api/?name=${selectedLocation.users.full_name}`}
                    alt={selectedLocation.users.full_name}
                    className="w-10 h-10 rounded-full mr-2"
                  />
                  <div>
                    <h3 className="font-semibold">{selectedLocation.users.full_name}</h3>
                    <p className="text-sm text-gray-600">
                      {new Date(selectedLocation.timestamp).toLocaleString()}
                    </p>
                  </div>
                </div>
                <div className="text-sm space-y-1">
                  <p>
                    Status: <span className={`font-semibold ${
                      selectedLocation.connection_status === 'online' ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {selectedLocation.connection_status}
                    </span>
                  </p>
                  {selectedLocation.battery_level && (
                    <p>Battery: <span className="font-semibold">{selectedLocation.battery_level}%</span></p>
                  )}
                  {selectedLocation.location_accuracy && (
                    <p>Accuracy: <span className="font-semibold">{Math.round(selectedLocation.location_accuracy)}m</span></p>
                  )}
                  {selectedLocation.task_id && (
                    <p className="text-blue-600">Currently on task</p>
                  )}
                </div>
              </div>
            </InfoWindow>
          )}

          {/* Task Info Window */}
          {selectedTask && (
            <InfoWindow
              position={{
                lat: selectedTask.location_latitude!,
                lng: selectedTask.location_longitude!,
              }}
              onCloseClick={() => setSelectedTask(null)}
            >
              <div className="p-2 max-w-xs">
                <h3 className="font-semibold text-lg">{selectedTask.title}</h3>
                <p className="text-sm text-gray-600 mb-2">{selectedTask.description}</p>
                <div className="text-sm space-y-1">
                  <p>
                    Status: <span className={`font-semibold`} style={{ color: getTaskStatusColor(selectedTask) }}>
                      {selectedTask.status}
                    </span>
                  </p>
                  <p>Priority: <span className="font-semibold">{selectedTask.priority}</span></p>
                  <p>Price: <span className="font-semibold">{formatCurrency(selectedTask.price)}</span></p>
                  <p>Due: <span className="font-semibold">{new Date(selectedTask.due_date).toLocaleDateString()}</span></p>
                  {selectedTask.geofences && selectedTask.geofences.length > 0 && (
                    <p className="text-blue-600">Has geofence requirements</p>
                  )}
                </div>
              </div>
            </InfoWindow>
          )}
        </GoogleMap>
      </div>

      {/* Recent Alerts */}
      {unreadAlerts.length > 0 && (
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-medium text-gray-900">Recent Alerts</h3>
          </div>
          <div className="divide-y divide-gray-200">
            {unreadAlerts.slice(0, 5).map((alert) => (
              <div key={alert.id} className="px-6 py-4">
                <div className="flex items-start">
                  <div className="flex-shrink-0">
                    {alert.alert_type === 'emergency' && (
                      <ExclamationIcon className="h-6 w-6 text-red-600" />
                    )}
                    {alert.alert_type === 'arrival' && (
                      <LocationMarkerIcon className="h-6 w-6 text-green-600" />
                    )}
                    {alert.alert_type === 'task_completion' && (
                      <CheckCircleIcon className="h-6 w-6 text-blue-600" />
                    )}
                    {!['emergency', 'arrival', 'task_completion'].includes(alert.alert_type) && (
                      <BellIcon className="h-6 w-6 text-yellow-600" />
                    )}
                  </div>
                  <div className="ml-3 flex-1">
                    <p className="text-sm font-medium text-gray-900">{alert.title}</p>
                    <p className="text-sm text-gray-600">{alert.message}</p>
                    <p className="text-xs text-gray-500 mt-1">
                      {new Date(alert.created_at).toLocaleString()}
                    </p>
                  </div>
                  <div className="ml-3">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      alert.priority === 'critical' ? 'bg-red-100 text-red-800' :
                      alert.priority === 'high' ? 'bg-orange-100 text-orange-800' :
                      alert.priority === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {alert.priority}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}