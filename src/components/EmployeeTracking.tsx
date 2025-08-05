import React, { useEffect, useState, useCallback, useRef } from 'react';
import { GoogleMap, Marker, InfoWindow } from '@react-google-maps/api';
import { LocationService } from '../services/LocationService';
import { useAuth } from '../contexts/AuthContext';
import { useGoogleMaps } from './GoogleMapsLoader';
import toast from 'react-hot-toast';
import { supabase } from '../lib/supabase';

interface Location {
  latitude: number;
  longitude: number;
  timestamp?: string;
  user_id?: string;
  accuracy?: number;
  speed?: number;
  heading?: number;
}

interface EmployeeLocation extends Location {
  user_id: string;
  full_name?: string;
  avatar_url?: string;
  last_updated?: string;
}

const mapContainerStyle = {
  width: '100%',
  height: '70vh',
};

const defaultCenter = {
  lat: 0,
  lng: 0,
};

const defaultZoom = 15;

export default function EmployeeTracking() {
  const { isLoaded, loadError } = useGoogleMaps();
  const [locations, setLocations] = useState<EmployeeLocation[]>([]);
  const [selectedLocation, setSelectedLocation] = useState<EmployeeLocation | null>(null);
  const { user } = useAuth();
  const mapRef = useRef<google.maps.Map>();
  const markersRef = useRef<{ [key: string]: google.maps.Marker }>({});
  const [isTracking, setIsTracking] = useState(true);

  // Function to format timestamp to local time
  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString();
  };

  // Function to calculate time difference
  const getTimeDifference = (timestamp: string | undefined | null) => {
    if (!timestamp) return 'No update yet';
    
    try {
      const date = new Date(timestamp);
      if (isNaN(date.getTime())) return 'Invalid timestamp';

      const diff = Date.now() - date.getTime();
      const minutes = Math.floor(diff / 60000);
      
      if (minutes < 1) return 'Just now';
      if (minutes === 1) return '1 minute ago';
      if (minutes < 60) return `${minutes} minutes ago`;
      
      const hours = Math.floor(minutes / 60);
      if (hours === 1) return '1 hour ago';
      if (hours < 24) return `${hours} hours ago`;
      
      const days = Math.floor(hours / 24);
      if (days === 1) return 'Yesterday';
      if (days < 7) return `${days} days ago`;
      
      return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
    } catch (error) {
      console.error('Error formatting timestamp:', error);
      return 'Invalid date format';
    }
  };

  const onMapLoad = useCallback((map: google.maps.Map) => {
    mapRef.current = map;
  }, []);

  // Enhanced location fetching with real-time updates
  const fetchLocations = useCallback(async () => {
    try {
      // Check if user is authenticated
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error('Not authenticated');
        return;
      }

      // Check if user is an admin
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('role')
        .eq('id', user.id)
        .single();

      if (userError || !userData || userData.role !== 'admin') {
        toast.error('Access denied: Admin only');
        return;
      }

      const data = await LocationService.getEmployeeLocations();
      
      // Add timestamp if not present
      const locationsWithTimestamp = data.map((location: EmployeeLocation) => ({
        ...location,
        last_updated: location.last_updated || new Date().toISOString()
      }));
      setLocations(locationsWithTimestamp);

      if (locationsWithTimestamp.length > 0) {
        // Update or create markers for each location
        locationsWithTimestamp.forEach((location: EmployeeLocation) => {
          const position = { lat: location.latitude, lng: location.longitude };
          
          if (markersRef.current[location.user_id]) {
            // Update existing marker position with animation
            markersRef.current[location.user_id].setPosition(position);
          } else {
            // Create new marker
            const marker = new google.maps.Marker({
              position,
              map: mapRef.current,
              title: location.full_name || 'Employee',
              animation: google.maps.Animation.DROP
            });
            markersRef.current[location.user_id] = marker;
          }
        });

        // Remove markers for employees no longer in the data
        Object.keys(markersRef.current).forEach(userId => {
          if (!locationsWithTimestamp.find((loc: EmployeeLocation) => loc.user_id === userId)) {
            markersRef.current[userId].setMap(null);
            delete markersRef.current[userId];
          }
        });

        // Auto-zoom to fit all markers if tracking is enabled
        if (isTracking && mapRef.current) {
          const bounds = new google.maps.LatLngBounds();
          data.forEach((location: Location) => {
            bounds.extend({ lat: location.latitude, lng: location.longitude });
          });
          mapRef.current.fitBounds(bounds);
          
          // If only one location, zoom in closer
          if (data.length === 1) {
            mapRef.current.setZoom(18);
          }
        }
      } else {
        toast.error('No employee locations found');
      }
    } catch (error) {
      console.error('Error fetching locations:', error);
      toast.error('Failed to fetch employee locations');
    }
  }, [isTracking]);

  // Set up real-time updates
  useEffect(() => {
    fetchLocations();
    const interval = setInterval(fetchLocations, 10000); // Update every 10 seconds

    return () => {
      clearInterval(interval);
      // Clean up markers
      Object.values(markersRef.current).forEach(marker => marker.setMap(null));
      markersRef.current = {};
    };
  }, [fetchLocations]);

  // Handle marker click
  const handleMarkerClick = useCallback((location: EmployeeLocation) => {
    setSelectedLocation(location);
    if (mapRef.current) {
      mapRef.current.panTo({ lat: location.latitude, lng: location.longitude });
      mapRef.current.setZoom(19); // Zoom in closer to show detail
    }
  }, []);

  if (loadError) {
    return <div className="text-red-500">Error loading maps</div>;
  }

  if (!isLoaded) {
    return <div className="flex justify-center items-center h-screen">Loading maps...</div>;
  }

  return (
    <div className="p-4">
      <div className="mb-4 flex justify-between items-center">
        <h2 className="text-2xl font-bold">Employee Tracking</h2>
        <button
          onClick={() => setIsTracking(!isTracking)}
          className={`px-4 py-2 rounded ${
            isTracking ? 'bg-green-500' : 'bg-gray-500'
          } text-white`}
        >
          {isTracking ? 'Tracking Active' : 'Tracking Paused'}
        </button>
      </div>

      <div className="relative">
        <GoogleMap
          mapContainerStyle={mapContainerStyle}
          center={defaultCenter}
          zoom={defaultZoom}
          onLoad={onMapLoad}
          options={{
            zoomControl: true,
            streetViewControl: false,
            mapTypeControl: true,
            fullscreenControl: true,
          }}
        >
          {locations.map((location) => (
            <Marker
              key={location.user_id}
              position={{
                lat: location.latitude,
                lng: location.longitude,
              }}
              onClick={() => handleMarkerClick(location)}
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
              <div className="p-2 max-w-xs">
                <h3 className="font-bold mb-2">{selectedLocation.full_name || 'Employee'}</h3>
                <div className="text-sm">
                  <p className="mb-1">
                    <strong>Last Updated:</strong>{' '}
                    {getTimeDifference(selectedLocation.last_updated)}
                  </p>
                  <p className="mb-1">
                    <strong>Exact Time:</strong>{' '}
                    {selectedLocation.last_updated 
                      ? new Date(selectedLocation.last_updated).toLocaleString()
                      : 'No update time available'}
                  </p>
                  <p className="mb-1">
                    <strong>Coordinates:</strong>{' '}
                    {selectedLocation.latitude.toFixed(6)}, {selectedLocation.longitude.toFixed(6)}
                  </p>
                  {selectedLocation.accuracy && (
                    <p className="mb-1">
                      <strong>Accuracy:</strong> ±{selectedLocation.accuracy.toFixed(1)}m
                    </p>
                  )}
                  {selectedLocation.speed && (
                    <p className="mb-1">
                      <strong>Speed:</strong> {(selectedLocation.speed * 3.6).toFixed(1)} km/h
                    </p>
                  )}
                  {selectedLocation.heading && (
                    <p>
                      <strong>Heading:</strong> {selectedLocation.heading.toFixed(0)}°
                    </p>
                  )}
                </div>
              </div>
            </InfoWindow>
          )}
        </GoogleMap>
      </div>

      <div className="mt-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {locations.map((location) => (
          <div
            key={location.user_id}
            className="bg-white p-4 rounded-lg shadow cursor-pointer hover:bg-gray-50"
            onClick={() => handleMarkerClick(location)}
          >
            <div className="flex items-center mb-2">
              {location.avatar_url && (
                <img
                  src={location.avatar_url}
                  alt={location.full_name || 'Employee'}
                  className="w-10 h-10 rounded-full mr-3"
                />
              )}
              <div>
                <h3 className="font-bold">{location.full_name || 'Employee'}</h3>
                <p className="text-sm text-gray-500">
                  {location.last_updated
                    ? getTimeDifference(location.last_updated)
                    : 'Last update unknown'}
                </p>
              </div>
            </div>
            <div className="text-sm">
              <p className="mb-1">
                Lat: {location.latitude.toFixed(6)}, Lng: {location.longitude.toFixed(6)}
              </p>
              {location.accuracy && (
                <p className="text-gray-600">Accuracy: ±{location.accuracy.toFixed(1)}m</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}