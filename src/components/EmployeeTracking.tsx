import React, { useEffect, useState, useCallback, useRef } from 'react';
import { GoogleMap, Marker, InfoWindow } from '@react-google-maps/api';
import { LocationService } from '../services/LocationService';
import { useAuth } from '../contexts/AuthContext';
import { useGoogleMaps } from './GoogleMapsLoader';

interface Location {
  latitude: number;
  longitude: number;
}

const mapContainerStyle = {
  width: '100%',
  height: '70vh',
};

const center = {
  lat: 7.8731,
  lng: 80.7718, // Center of Sri Lanka
};

const options = {
  disableDefaultUI: false,
  zoomControl: true,
  styles: [
    {
      featureType: "all",
      elementType: "labels",
      stylers: [{ visibility: "on" }],
    }
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

export default function EmployeeTracking() {
  const { isLoaded, loadError } = useGoogleMaps();
  const [locations, setLocations] = useState<EmployeeLocation[]>([]);
  const [selectedLocation, setSelectedLocation] = useState<EmployeeLocation | null>(null);
  const { user } = useAuth();
  const mapRef = useRef<google.maps.Map>();

  const onMapLoad = useCallback((map: google.maps.Map) => {
    mapRef.current = map;
  }, []);

  const fetchLocations = useCallback(async () => {
    try {
      const data = await LocationService.getEmployeeLocations();
      setLocations(data);

      // If we have locations, fit the map bounds to include all markers
      if (data.length > 0 && mapRef.current) {
        const bounds = new window.google.maps.LatLngBounds();
        data.forEach((location: Location) => {
          bounds.extend({ lat: location.latitude, lng: location.longitude });
        });
        mapRef.current.fitBounds(bounds);
      }
    } catch (error) {
      console.error('Error fetching locations:', error);
    }
  }, []);

  const handleLocationUpdate = (location: { latitude: number; longitude: number }) => {
    // This function is not used in the current code, but it's part of the edit hint.
    // If it were used, it would likely involve updating the 'locations' state
    // with the new location, and potentially re-fitting the map bounds.
  };

  useEffect(() => {
    // Start tracking current user's location if they are an employee
    if (user && user.role === 'employee') {
      const watchId = LocationService.startTracking(user.id);

      const handleLocationUpdate = (position: GeolocationPosition) => {
        const location = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude
        };
        // Handle location update
      };

      return () => {
        LocationService.stopTracking();
        if (watchId) {
          navigator.geolocation.clearWatch(watchId);
        }
      };
    }
  }, [user]);

  useEffect(() => {
    // Fetch locations initially and then every 30 seconds
    fetchLocations();
    const interval = setInterval(fetchLocations, 30000);

    return () => clearInterval(interval);
  }, [fetchLocations]);

  if (loadError) return <div className="p-4 text-red-600">Error loading maps</div>;
  if (!isLoaded) return <div className="p-4">Loading maps...</div>;

  return (
    <div className="p-4">
      <h2 className="text-2xl font-bold mb-4">Field Employee Tracking</h2>
      <div className="mb-4">
        <div className="flex space-x-4">
          <div className="flex items-center">
            <div className="w-3 h-3 rounded-full bg-green-500 mr-2"></div>
            <span>Online</span>
          </div>
          <div className="flex items-center">
            <div className="w-3 h-3 rounded-full bg-red-500 mr-2"></div>
            <span>Offline</span>
          </div>
        </div>
      </div>
      
      <div className="rounded-lg overflow-hidden border border-gray-200">
        <GoogleMap
          mapContainerStyle={mapContainerStyle}
          zoom={17}
          center={center}
          options={options}
          onLoad={onMapLoad}
        >
          {locations.map((location) => (
            <Marker
              key={location.id}
              position={{
                lat: location.latitude,
                lng: location.longitude,
              }}
              icon={{
                url: location.connection_status === 'online' 
                  ? 'https://maps.google.com/mapfiles/ms/icons/green-dot.png'
                  : 'https://maps.google.com/mapfiles/ms/icons/red-dot.png',
                scaledSize: new window.google.maps.Size(40, 40),
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
                <div className="text-sm">
                  <p className="mb-1">
                    Status: <span className={`font-semibold ${selectedLocation.connection_status === 'online' ? 'text-green-600' : 'text-red-600'}`}>
                      {selectedLocation.connection_status}
                    </span>
                  </p>
                  {selectedLocation.battery_level && (
                    <p className="mb-1">
                      Battery: <span className="font-semibold">{selectedLocation.battery_level}%</span>
                    </p>
                  )}
                  {selectedLocation.location_accuracy && (
                    <p className="mb-1">
                      Accuracy: <span className="font-semibold">{Math.round(selectedLocation.location_accuracy)}m</span>
                    </p>
                  )}
                </div>
              </div>
            </InfoWindow>
          )}
        </GoogleMap>
      </div>
    </div>
  );
}