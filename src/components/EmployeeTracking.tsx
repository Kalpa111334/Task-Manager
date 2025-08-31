import React, { useEffect, useState, useCallback, useRef } from 'react';
import { GoogleMap, Marker, InfoWindow } from '@react-google-maps/api';
import { LocationService } from '../services/LocationService';
import { PDFReportService } from '../services/PDFReportService';
import { RouteTrackingService } from '../services/RouteTrackingService';
import { Map3DVisualization } from './Map3DVisualization';
import { useAuth } from '../contexts/AuthContext';
import { useGoogleMaps } from './GoogleMapsLoader';
import toast from 'react-hot-toast';
import { supabase } from '../lib/supabase';
// import { ArrowDownTrayIcon, CubeIcon, CalendarDaysIcon, ClockIcon } from '@heroicons/react/24/outline';

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
  const [selectedEmployee, setSelectedEmployee] = useState<string | null>(null);
  const [show3DView, setShow3DView] = useState(false);
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  const [dateRange, setDateRange] = useState({
    start: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 7 days ago
    end: new Date().toISOString().split('T')[0] // today
  });
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
        toast('No active employees found', { icon: 'ℹ️' });
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

  // Generate PDF report for selected employee
  const handleGeneratePDFReport = useCallback(async (employeeId: string, employeeName: string) => {
    setIsGeneratingReport(true);
    try {
      const routeHistory = await RouteTrackingService.getEmployeeRouteHistory({
        employeeId,
        startDate: dateRange.start,
        endDate: dateRange.end
      });

      if (routeHistory.length === 0) {
        toast.error('No location data found for the selected date range');
        return;
      }

      await PDFReportService.generateEmployeeRouteReport(
        employeeId,
        employeeName,
        routeHistory,
        {
          includeRoute: true,
          include3DVisualization: false,
          includeStatistics: true,
          includeTimeline: true
        }
      );

      toast.success('PDF report generated successfully!');
    } catch (error) {
      console.error('Error generating PDF report:', error);
      toast.error('Failed to generate PDF report');
    } finally {
      setIsGeneratingReport(false);
    }
  }, [dateRange]);

  // Generate PDF report for all employees
  const handleGenerateAllEmployeesReport = useCallback(async () => {
    setIsGeneratingReport(true);
    try {
      const allEmployeeData = await RouteTrackingService.getAllEmployeesRouteHistory(
        dateRange.start,
        dateRange.end
      );

      if (Object.keys(allEmployeeData).length === 0) {
        toast.error('No location data found for the selected date range');
        return;
      }

      await PDFReportService.generateAllEmployeesReport(allEmployeeData, {
        includeRoute: true,
        include3DVisualization: false,
        includeStatistics: true,
        includeTimeline: false
      });

      toast.success('All employees PDF report generated successfully!');
    } catch (error) {
      console.error('Error generating all employees PDF report:', error);
      toast.error('Failed to generate all employees PDF report');
    } finally {
      setIsGeneratingReport(false);
    }
  }, [dateRange]);

  // Show 3D visualization for selected employee
  const handleShow3DView = useCallback(async (employeeId: string) => {
    try {
      const routeHistory = await RouteTrackingService.getEmployeeRouteHistory({
        employeeId,
        startDate: dateRange.start,
        endDate: dateRange.end
      });

      if (routeHistory.length === 0) {
        toast.error('No location data found for 3D visualization');
        return;
      }

      setSelectedEmployee(employeeId);
      setShow3DView(true);
    } catch (error) {
      console.error('Error loading 3D visualization:', error);
      toast.error('Failed to load 3D visualization');
    }
  }, [dateRange]);

  // Get employee locations for 3D view
  const getEmployeeLocationsFor3D = useCallback(() => {
    if (!selectedEmployee) return [];
    return locations.filter(loc => loc.user_id === selectedEmployee);
  }, [selectedEmployee, locations]);

  if (loadError) {
    return <div className="text-red-500">Error loading maps</div>;
  }

  if (!isLoaded) {
    return <div className="flex justify-center items-center h-screen">Loading maps...</div>;
  }

  return (
    <div className="p-4">
      <div className="mb-4 flex flex-col lg:flex-row lg:justify-between lg:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold">Employee Tracking</h2>
          <p className="text-sm text-gray-600">
            Showing {locations.length} active employee{locations.length !== 1 ? 's' : ''} (last 15 minutes)
          </p>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-2">
          {/* Date Range Selector */}
          <div className="flex items-center gap-2">
            <span className="text-gray-500">📅</span>
            <input
              type="date"
              value={dateRange.start}
              onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
              className="px-3 py-1 border rounded text-sm"
              title="Start date for report generation"
              aria-label="Start date"
            />
            <span className="text-gray-500">to</span>
            <input
              type="date"
              value={dateRange.end}
              onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
              className="px-3 py-1 border rounded text-sm"
              title="End date for report generation"
              aria-label="End date"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2">
            <button
              onClick={handleGenerateAllEmployeesReport}
              disabled={isGeneratingReport}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
            >
              <span>📥</span>
              {isGeneratingReport ? 'Generating...' : 'All Reports'}
            </button>
            
            <button
              onClick={() => setIsTracking(!isTracking)}
              className={`px-4 py-2 rounded text-sm ${
                isTracking ? 'bg-green-500 hover:bg-green-600' : 'bg-gray-500 hover:bg-gray-600'
              } text-white`}
            >
              {isTracking ? 'Tracking Active' : 'Tracking Paused'}
            </button>
          </div>
        </div>
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

      {locations.length === 0 ? (
        <div className="mt-8 text-center">
          <div className="bg-gray-50 rounded-lg p-8">
            <div className="text-6xl mb-4">📍</div>
            <h3 className="text-lg font-semibold text-gray-700 mb-2">No Active Employees</h3>
            <p className="text-gray-500">
              No employees have reported their location in the last 15 minutes.
              <br />
              Employees need to be online with good battery levels to appear on the map.
            </p>
          </div>
        </div>
      ) : (
        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {locations.map((location) => (
          <div
            key={location.user_id}
            className="bg-white p-4 rounded-lg shadow hover:shadow-lg transition-shadow"
          >
            <div className="flex items-center mb-3">
              {location.avatar_url && (
                <img
                  src={location.avatar_url}
                  alt={location.full_name || 'Employee'}
                  className="w-10 h-10 rounded-full mr-3"
                />
              )}
              <div className="flex-1">
                <h3 className="font-bold text-lg">{location.full_name || 'Employee'}</h3>
                <p className="text-sm text-gray-500 flex items-center">
                  <span className="mr-1">🕐</span>
                  {location.last_updated
                    ? getTimeDifference(location.last_updated)
                    : 'Last update unknown'}
                </p>
              </div>
            </div>
            
            <div className="text-sm mb-3">
              <p className="mb-1">
                <strong>Coordinates:</strong> {location.latitude.toFixed(6)}, {location.longitude.toFixed(6)}
              </p>
              {location.accuracy && (
                <p className="text-gray-600">Accuracy: ±{location.accuracy.toFixed(1)}m</p>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2">
              <button
                onClick={() => handleMarkerClick(location)}
                className="flex-1 px-3 py-2 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors text-sm"
              >
                View on Map
              </button>
              <button
                onClick={() => handleGeneratePDFReport(location.user_id, location.full_name || 'Employee')}
                disabled={isGeneratingReport}
                className="flex items-center gap-1 px-3 py-2 bg-green-100 text-green-700 rounded hover:bg-green-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm"
              >
                <span>📥</span>
                PDF
              </button>
              <button
                onClick={() => handleShow3DView(location.user_id)}
                className="flex items-center gap-1 px-3 py-2 bg-purple-100 text-purple-700 rounded hover:bg-purple-200 transition-colors text-sm"
              >
                <span>🧊</span>
                3D
              </button>
            </div>
          </div>
        ))}
        </div>
      )}

      {/* 3D Visualization Modal */}
      {show3DView && (
        <Map3DVisualization
          locations={getEmployeeLocationsFor3D()}
          isVisible={show3DView}
          onClose={() => {
            setShow3DView(false);
            setSelectedEmployee(null);
          }}
        />
      )}
    </div>
  );
}