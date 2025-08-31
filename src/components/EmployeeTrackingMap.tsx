import React, { useState, useEffect, useCallback, useRef } from 'react';
import { GoogleMap, Marker, InfoWindow, useLoadScript } from '@react-google-maps/api';
import { LocationService } from '../services/LocationService';
import { useNavigate } from 'react-router-dom';
import {
  UserGroupIcon,
  LocationMarkerIcon,
  AdjustmentsIcon,
  ExclamationIcon,
  ArrowLeftIcon,
} from '@heroicons/react/outline';
import toast from 'react-hot-toast';
import { supabase } from '../lib/supabase';

interface EmployeeLocation {
  id: string;
  user_id: string;
  latitude: number;
  longitude: number;
  recorded_at: string;
  battery_level?: number;
  connection_status?: string;
  location_accuracy?: number;
  task_id?: string;
  full_name: string;
  avatar_url?: string;
  email: string;
  task_title?: string;
  task_status?: string;
  task_due_date?: string;
  address?: string;
}

const mapContainerStyle = {
  width: '100%',
  height: 'calc(100vh - 16rem)', // Adjust height for mobile
  borderRadius: '0.5rem',
};

const defaultCenter = {
  lat: 7.8731,
  lng: 80.7718, // Center of Sri Lanka
};

const mapOptions = {
  disableDefaultUI: false,
  zoomControl: true,
  mapTypeControl: true,
  streetViewControl: false,
  fullscreenControl: true,
  styles: [
    {
      featureType: "poi",
      elementType: "labels",
      stylers: [{ visibility: "off" }],
    },
  ],
};

export default function EmployeeTrackingMap() {
  const { isLoaded } = useLoadScript({
    googleMapsApiKey: "AIzaSyARSoKujCNX2odk8wachQyz0DIjBCqJNd4",
    libraries: ["places", "geometry"],
  });

  const navigate = useNavigate();
  const [locations, setLocations] = useState<EmployeeLocation[]>([]);
  const [selectedLocation, setSelectedLocation] = useState<EmployeeLocation | null>(null);
  const [showInactive, setShowInactive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mapRef = useRef<google.maps.Map>();
  const [addressCache, setAddressCache] = useState<Record<string, string>>({});

  const onMapLoad = useCallback((map: google.maps.Map) => {
    mapRef.current = map;
  }, []);

  const fetchAddress = useCallback(async (lat: number, lng: number): Promise<string> => {
    const cacheKey = `${lat},${lng}`;
    if (addressCache[cacheKey]) return addressCache[cacheKey];

    try {
      const geocoder = new google.maps.Geocoder();
      const result = await geocoder.geocode({ location: { lat, lng } });
      const address = result.results[0]?.formatted_address || 'Address unknown';
      setAddressCache(prev => ({ ...prev, [cacheKey]: address }));
      return address;
    } catch (error) {
      console.error('Geocoding error:', error);
      return 'Address lookup failed';
    }
  }, [addressCache]);

  const fetchLocations = useCallback(async (signal?: AbortSignal) => {
    if (!mapRef.current || signal?.aborted) return;
    try {
      // Check user authentication and role
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.error('No authenticated user');
        setError('User not authenticated');
        toast.error('Please log in to view employee locations');
        return;
      }

      // Verify user is an admin
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('role')
        .eq('id', user.id)
        .single();

      if (userError || !userData) {
        console.error('Failed to verify user role:', userError);
        setError('Failed to verify user role');
        toast.error('Unable to verify user role');
        return;
      }

      if (userData.role !== 'admin') {
        console.error('User is not an admin:', { role: userData.role });
        setError('Unauthorized access');
        toast.error('Only admins can view employee locations');
        return;
      }

      const data = await LocationService.getEmployeeLocations();
      if (!data || data.length === 0) {
        setError('No employee locations found');
        toast('No active employee locations available', { icon: 'ℹ️' });
        setLocations([]);
        return;
      }

      const locationsWithAddresses = await Promise.all(
        data.map(async (location: EmployeeLocation) => ({
          ...location,
          address: await fetchAddress(location.latitude, location.longitude),
        }))
      );

      setLocations(locationsWithAddresses);
      setError(null);

      if (locationsWithAddresses.length > 0 && mapRef.current) {
        const bounds = new google.maps.LatLngBounds();
        locationsWithAddresses.forEach((location) => {
          bounds.extend({ lat: location.latitude, lng: location.longitude });
        });
        mapRef.current.fitBounds(bounds);
        
        if (locationsWithAddresses.length === 1) {
          mapRef.current.setZoom(20);
        }
      }
    } catch (err) {
      console.error('Error fetching locations:', err);
      setError('Failed to fetch employee locations');
      toast.error('Unable to retrieve employee locations');
    }
  }, [mapRef, setError, fetchAddress]);

  useEffect(() => {
    const abortController = new AbortController();

    const updateLocations = async () => {
      if (!abortController.signal.aborted) {
        await fetchLocations(abortController.signal);
      }
    };

    updateLocations();
    const interval = setInterval(updateLocations, 30000);

    return () => {
      abortController.abort();
      clearInterval(interval);
    };
  }, [fetchLocations]);

  if (!isLoaded) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 p-4 rounded-md">
        <div className="flex">
          <ExclamationIcon className="h-5 w-5 text-red-400" aria-hidden="true" />
          <div className="ml-3">
            <h3 className="text-sm font-medium text-red-800">Error loading employee locations</h3>
            <p className="text-sm text-red-700 mt-2">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  const filteredLocations = locations.filter(
    location => showInactive || location.connection_status === 'online'
  );

  return (
    <div className="space-y-4 p-2 md:p-4">
      {/* Back Button and Controls */}
      <div className="flex flex-col space-y-3">
        <button
          onClick={() => navigate('/admin/dashboard')}
          className="flex items-center text-gray-600 hover:text-gray-800 transition-colors w-fit"
        >
          <ArrowLeftIcon className="h-5 w-5 mr-1" />
          <span className="text-sm font-medium">Back to Dashboard</span>
        </button>

        {/* Controls and Legend */}
        <div className="bg-white p-3 md:p-4 rounded-lg shadow">
          <div className="flex flex-col md:flex-row md:justify-between md:items-center space-y-3 md:space-y-0">
            <div className="flex flex-col md:flex-row md:items-center space-y-2 md:space-y-0 md:space-x-4">
              <h2 className="text-lg font-semibold flex items-center">
                <UserGroupIcon className="h-5 w-5 mr-2" />
                Employee Tracking
              </h2>
              <div className="flex items-center space-x-4 text-sm">
                <span className="inline-flex items-center">
                  <div className="w-3 h-3 rounded-full bg-green-500 mr-1"></div>
                  Active
                </span>
                <span className="inline-flex items-center">
                  <div className="w-3 h-3 rounded-full bg-red-500 mr-1"></div>
                  Inactive
                </span>
              </div>
            </div>
            
            <div className="flex items-center">
              <label className="inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={showInactive}
                  onChange={(e) => setShowInactive(e.target.checked)}
                  className="form-checkbox h-4 w-4 text-indigo-600"
                />
                <span className="ml-2 text-sm text-gray-700">Show Inactive</span>
              </label>
            </div>
          </div>
        </div>
      </div>

      {/* Map */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <GoogleMap
          mapContainerStyle={mapContainerStyle}
          zoom={18}
          center={defaultCenter}
          options={mapOptions}
          onLoad={onMapLoad}
        >
          {filteredLocations.map((location) => (
            <Marker
              key={location.id}
              position={{
                lat: location.latitude,
                lng: location.longitude,
              }}
              icon={{
                url: location.connection_status === 'online'
                  ? 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`
                      <svg width="36" height="36" viewBox="0 0 36 36" xmlns="http://www.w3.org/2000/svg">
                        <circle cx="18" cy="18" r="16" fill="#22c55e" stroke="white" stroke-width="2"/>
                        <circle cx="18" cy="18" r="8" fill="white"/>
                      </svg>
                    `)
                  : 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`
                      <svg width="36" height="36" viewBox="0 0 36 36" xmlns="http://www.w3.org/2000/svg">
                        <circle cx="18" cy="18" r="16" fill="#ef4444" stroke="white" stroke-width="2"/>
                        <circle cx="18" cy="18" r="8" fill="white"/>
                      </svg>
                    `),
                scaledSize: new google.maps.Size(36, 36),
                anchor: new google.maps.Point(18, 18),
              }}
              onClick={() => setSelectedLocation(location)}
            />
          ))}

          {selectedLocation && (
            <InfoWindow
              position={{
                lat: selectedLocation.latitude,
                lng: selectedLocation.longitude,
              }}
              onCloseClick={() => setSelectedLocation(null)}
            >
              <div className="p-2 max-w-[280px] md:max-w-xs">
                <div className="flex items-center mb-2">
                  <img
                    src={selectedLocation?.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(selectedLocation?.full_name || 'User')}`}
                    alt={selectedLocation?.full_name || 'User'}
                    className="w-8 h-8 md:w-10 md:h-10 rounded-full mr-2"
                  />
                  <div>
                    <h3 className="font-semibold text-sm md:text-base">{selectedLocation?.full_name || 'User'}</h3>
                    <p className="text-xs md:text-sm text-gray-600">{selectedLocation?.email || 'No email'}</p>
                  </div>
                </div>
                
                <div className="text-xs md:text-sm space-y-1">
                  <p className="font-medium">Location:</p>
                  <p className="text-gray-600 break-words">{selectedLocation.address}</p>
                  
                  <div className="flex justify-between items-center mt-2">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                      selectedLocation.connection_status === 'online'
                        ? 'bg-green-100 text-green-800'
                        : 'bg-red-100 text-red-800'
                    }`}>
                      {selectedLocation.connection_status === 'online' ? 'Active' : 'Inactive'}
                    </span>
                    <span className="text-gray-500 text-xs">
                      {new Date(selectedLocation.recorded_at).toLocaleTimeString()}
                    </span>
                  </div>

                  {selectedLocation.task_title && (
                    <div className="mt-2 p-2 bg-gray-50 rounded">
                      <p className="font-medium">Current Task:</p>
                      <p className="text-gray-800">{selectedLocation.task_title}</p>
                      <p className="text-xs text-gray-600">
                        Due: {new Date(selectedLocation.task_due_date || '').toLocaleDateString()}
                      </p>
                    </div>
                  )}

                  {selectedLocation.battery_level !== undefined && (
                    <p className="text-xs md:text-sm">
                      Battery: <span className="font-medium">{selectedLocation.battery_level}%</span>
                    </p>
                  )}
                  
                  {selectedLocation.location_accuracy && (
                    <p className="text-xs md:text-sm">
                      Accuracy: <span className="font-medium">{Math.round(selectedLocation.location_accuracy)}m</span>
                    </p>
                  )}
                </div>
              </div>
            </InfoWindow>
          )}
        </GoogleMap>
      </div>

      {/* Status Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 md:gap-4">
        <div className="bg-white rounded-lg shadow p-3 md:p-4">
          <div className="flex items-center">
            <UserGroupIcon className="h-5 w-5 md:h-6 md:w-6 text-indigo-600" />
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-500">Total Employees</p>
              <p className="text-lg md:text-xl font-semibold text-gray-900">{locations.length}</p>
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow p-3 md:p-4">
          <div className="flex items-center">
            <div className="rounded-full bg-green-100 p-2">
              <LocationMarkerIcon className="h-5 w-5 md:h-6 md:w-6 text-green-600" />
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-500">Active</p>
              <p className="text-lg md:text-xl font-semibold text-gray-900">
                {locations.filter(l => l.connection_status === 'online').length}
              </p>
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow p-3 md:p-4">
          <div className="flex items-center">
            <div className="rounded-full bg-red-100 p-2">
              <AdjustmentsIcon className="h-5 w-5 md:h-6 md:w-6 text-red-600" />
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-500">Inactive</p>
              <p className="text-lg md:text-xl font-semibold text-gray-900">
                {locations.filter(l => l.connection_status !== 'online').length}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}