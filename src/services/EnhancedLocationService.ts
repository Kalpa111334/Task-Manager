import { supabase } from '../lib/supabase';
import { GeofencingService, MovementHistory } from './GeofencingService';

export interface LocationData {
  latitude: number;
  longitude: number;
  altitude?: number;
  speed?: number;
  heading?: number;
  accuracy?: number;
  battery_level?: number;
  connection_status?: string;
  task_id?: string;
  timestamp?: string;
}

export interface LocationOptions {
  enableHighAccuracy?: boolean;
  timeout?: number;
  maximumAge?: number;
  trackMovement?: boolean;
  geofenceMonitoring?: boolean;
}

export class EnhancedLocationService {
  private static watchId: number | null = null;
  private static isTracking = false;
  private static retryCount = 0;
  private static maxRetries = 3;
  private static retryTimeout: NodeJS.Timeout | null = null;
  private static lastKnownLocation: LocationData | null = null;
  private static movementThreshold = 10; // meters
  private static trackingOptions: LocationOptions = {
    enableHighAccuracy: true,
    timeout: 15000,
    maximumAge: 30000,
    trackMovement: true,
    geofenceMonitoring: true,
  };

  static async startTracking(
    userId: string,
    taskId?: string,
    options: LocationOptions = {}
  ) {
    if (!navigator.geolocation) {
      throw new Error('Geolocation is not supported by your browser');
    }

    if (this.isTracking) {
      return;
    }

    this.isTracking = true;
    this.retryCount = 0;
    this.trackingOptions = { ...this.trackingOptions, ...options };

    const positionOptions: PositionOptions = {
      enableHighAccuracy: this.trackingOptions.enableHighAccuracy,
      timeout: this.trackingOptions.timeout,
      maximumAge: this.trackingOptions.maximumAge,
    };

    try {
      // Request permission first
      const permission = await this.requestLocationPermission();
      if (!permission) {
        throw new Error('Location permission denied');
      }

      this.watchId = navigator.geolocation.watchPosition(
        async (position) => {
          try {
            this.retryCount = 0;
            
            const locationData: LocationData = {
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
              altitude: position.coords.altitude || undefined,
              speed: position.coords.speed || undefined,
              heading: position.coords.heading || undefined,
              accuracy: position.coords.accuracy,
              task_id: taskId,
              timestamp: new Date().toISOString(),
            };

            // Add battery information if available
            if ('getBattery' in navigator) {
              try {
                const battery: any = await (navigator as any).getBattery();
                locationData.battery_level = Math.round(battery.level * 100);
              } catch (e) {
                // Battery API not available
              }
            }

            // Add connection status
            locationData.connection_status = navigator.onLine ? 'online' : 'offline';

            // Store location in employee_locations table
            await this.storeLocation(userId, locationData);

            // Store detailed movement history if enabled
            if (this.trackingOptions.trackMovement) {
              await this.storeMovementHistory(userId, locationData);
            }

            // Check geofences if enabled
            if (this.trackingOptions.geofenceMonitoring) {
              await this.checkGeofences(userId, locationData);
            }

            this.lastKnownLocation = locationData;
          } catch (error) {
            console.error('Error in location tracking:', error);
            this.handleError(error, userId, taskId);
          }
        },
        (error) => {
          console.error('Error getting location:', error);
          this.handleError(error, userId, taskId);
        },
        positionOptions
      );

      // Add online/offline event listeners
      window.addEventListener('online', () => this.handleConnectivityChange(true, userId));
      window.addEventListener('offline', () => this.handleConnectivityChange(false, userId));

      // Start background sync for offline data
      this.startBackgroundSync();

    } catch (error) {
      console.error('Error starting location tracking:', error);
      this.handleError(error, userId, taskId);
    }
  }

  private static async storeLocation(userId: string, locationData: LocationData) {
    try {
      const { error } = await supabase
        .from('employee_locations')
        .insert([{
          user_id: userId,
          ...locationData
        }]);

      if (error) throw error;
    } catch (error) {
      console.error('Error storing location:', error);
      // Store in local storage for offline sync
      this.storeOfflineLocation(userId, locationData);
    }
  }

  private static async storeMovementHistory(userId: string, locationData: LocationData) {
    // Only store if movement is significant
    if (this.lastKnownLocation) {
      const distance = GeofencingService.calculateDistance(
        this.lastKnownLocation.latitude,
        this.lastKnownLocation.longitude,
        locationData.latitude,
        locationData.longitude
      );

      if (distance < this.movementThreshold) {
        return; // Skip storing if movement is too small
      }
    }

    try {
      const movementData: Omit<MovementHistory, 'id'> = {
        user_id: userId,
        latitude: locationData.latitude,
        longitude: locationData.longitude,
        altitude: locationData.altitude,
        speed: locationData.speed,
        heading: locationData.heading,
        accuracy: locationData.accuracy,
        timestamp: locationData.timestamp || new Date().toISOString(),
        task_id: locationData.task_id,
        location_source: 'gps',
        battery_level: locationData.battery_level,
        is_mock_location: false,
      };

      await GeofencingService.recordMovement(movementData);
    } catch (error) {
      console.error('Error storing movement history:', error);
    }
  }

  private static async checkGeofences(userId: string, locationData: LocationData) {
    try {
      const geofences = await GeofencingService.getGeofences(true);
      
      for (const geofence of geofences) {
        const isWithin = GeofencingService.isWithinGeofence(
          locationData.latitude,
          locationData.longitude,
          geofence
        );

        if (isWithin) {
          // Check if this is a new entry
          const recentEvents = await GeofencingService.getTaskLocationEvents(locationData.task_id || '');
          const recentEntry = recentEvents.find(
            event => 
              event.geofence_id === geofence.id &&
              event.event_type === 'arrival' &&
              new Date(event.timestamp).getTime() > Date.now() - 300000 // 5 minutes
          );

          if (!recentEntry && locationData.task_id) {
            await GeofencingService.recordLocationEvent({
              task_id: locationData.task_id,
              user_id: userId,
              event_type: 'arrival',
              latitude: locationData.latitude,
              longitude: locationData.longitude,
              geofence_id: geofence.id,
              timestamp: locationData.timestamp || new Date().toISOString(),
            });
          }
        }
      }
    } catch (error) {
      console.error('Error checking geofences:', error);
    }
  }

  private static storeOfflineLocation(userId: string, locationData: LocationData) {
    try {
      const offlineData = localStorage.getItem('offline_locations') || '[]';
      const locations = JSON.parse(offlineData);
      locations.push({ userId, ...locationData });
      localStorage.setItem('offline_locations', JSON.stringify(locations));
    } catch (error) {
      console.error('Error storing offline location:', error);
    }
  }

  private static startBackgroundSync() {
    // Sync offline data when connection is restored
    if ('serviceWorker' in navigator && 'sync' in window.ServiceWorkerRegistration.prototype) {
      navigator.serviceWorker.ready.then(registration => {
        return registration.sync.register('background-sync-locations');
      });
    }

    // Fallback: periodic sync
    setInterval(() => {
      if (navigator.onLine) {
        this.syncOfflineData();
      }
    }, 60000); // Every minute
  }

  private static async syncOfflineData() {
    try {
      const offlineData = localStorage.getItem('offline_locations');
      if (!offlineData) return;

      const locations = JSON.parse(offlineData);
      if (locations.length === 0) return;

      for (const location of locations) {
        try {
          await this.storeLocation(location.userId, location);
        } catch (error) {
          console.error('Error syncing offline location:', error);
          return; // Stop syncing if there's an error
        }
      }

      // Clear synced data
      localStorage.removeItem('offline_locations');
      console.log(`Synced ${locations.length} offline locations`);
    } catch (error) {
      console.error('Error syncing offline data:', error);
    }
  }

  private static async requestLocationPermission(): Promise<boolean> {
    try {
      const result = await navigator.permissions.query({ name: 'geolocation' });
      return result.state === 'granted' || result.state === 'prompt';
    } catch (error) {
      console.error('Error checking location permission:', error);
      return false;
    }
  }

  private static handleError(error: any, userId: string, taskId?: string) {
    if (this.retryCount < this.maxRetries) {
      this.retryCount++;
      console.log(`Retrying location tracking (attempt ${this.retryCount}/${this.maxRetries})...`);
      
      if (this.retryTimeout) {
        clearTimeout(this.retryTimeout);
      }

      const retryDelay = Math.min(1000 * Math.pow(2, this.retryCount - 1), 30000);
      this.retryTimeout = setTimeout(() => {
        this.stopTracking();
        this.startTracking(userId, taskId, this.trackingOptions);
      }, retryDelay);
    } else {
      console.error('Max retry attempts reached. Location tracking failed.');
      this.stopTracking();
    }
  }

  private static async handleConnectivityChange(isOnline: boolean, userId: string) {
    try {
      if (isOnline) {
        // Sync offline data when coming back online
        await this.syncOfflineData();
      }

      // Update connection status in the latest location record
      const { error } = await supabase
        .from('employee_locations')
        .update({ connection_status: isOnline ? 'online' : 'offline' })
        .eq('user_id', userId)
        .order('timestamp', { ascending: false })
        .limit(1);

      if (error && isOnline) {
        console.error('Error updating connection status:', error);
      }
    } catch (error) {
      console.error('Error handling connectivity change:', error);
    }
  }

  static stopTracking() {
    if (this.watchId !== null) {
      navigator.geolocation.clearWatch(this.watchId);
      this.watchId = null;
      this.isTracking = false;
      
      if (this.retryTimeout) {
        clearTimeout(this.retryTimeout);
        this.retryTimeout = null;
      }

      window.removeEventListener('online', () => {});
      window.removeEventListener('offline', () => {});
    }
  }

  // Get current location once
  static async getCurrentLocation(options: LocationOptions = {}): Promise<LocationData> {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocation is not supported'));
        return;
      }

      const positionOptions: PositionOptions = {
        enableHighAccuracy: options.enableHighAccuracy ?? true,
        timeout: options.timeout ?? 10000,
        maximumAge: options.maximumAge ?? 60000,
      };

      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const locationData: LocationData = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            altitude: position.coords.altitude || undefined,
            speed: position.coords.speed || undefined,
            heading: position.coords.heading || undefined,
            accuracy: position.coords.accuracy,
            timestamp: new Date().toISOString(),
          };

          // Add battery information if available
          if ('getBattery' in navigator) {
            try {
              const battery: any = await (navigator as any).getBattery();
              locationData.battery_level = Math.round(battery.level * 100);
            } catch (e) {
              // Battery API not available
            }
          }

          locationData.connection_status = navigator.onLine ? 'online' : 'offline';
          resolve(locationData);
        },
        (error) => reject(error),
        positionOptions
      );
    });
  }

  // Get employee locations for admin dashboard
  static async getEmployeeLocations() {
    const { data, error } = await supabase
      .from('employee_locations')
      .select(`
        *,
        users:user_id (
          full_name,
          avatar_url
        )
      `)
      .order('timestamp', { ascending: false });

    if (error) throw error;

    // Group by user_id and get latest location for each user
    const latestLocations = data.reduce((acc: any[], location) => {
      const existingLocation = acc.find(l => l.user_id === location.user_id);
      if (!existingLocation) {
        acc.push(location);
      }
      return acc;
    }, []);

    return latestLocations;
  }

  // Check if user is at required location for task
  static async checkTaskLocation(taskId: string, userLocation: LocationData): Promise<boolean> {
    try {
      const taskLocations = await GeofencingService.getTaskLocations(taskId);
      
      for (const taskLocation of taskLocations) {
        if (taskLocation.geofence_id) {
          const geofences = await GeofencingService.getGeofences(true);
          const geofence = geofences.find(g => g.id === taskLocation.geofence_id);
          
          if (geofence && GeofencingService.isWithinGeofence(
            userLocation.latitude,
            userLocation.longitude,
            geofence
          )) {
            return true;
          }
        }

        if (taskLocation.required_latitude && taskLocation.required_longitude) {
          const distance = GeofencingService.calculateDistance(
            userLocation.latitude,
            userLocation.longitude,
            taskLocation.required_latitude,
            taskLocation.required_longitude
          );

          if (distance <= taskLocation.required_radius_meters) {
            return true;
          }
        }
      }

      return false;
    } catch (error) {
      console.error('Error checking task location:', error);
      return false;
    }
  }

  // Manual check-in/check-out
  static async checkIn(taskId: string, userId: string, notes?: string): Promise<void> {
    try {
      const location = await this.getCurrentLocation();
      
      await GeofencingService.recordLocationEvent({
        task_id: taskId,
        user_id: userId,
        event_type: 'check_in',
        latitude: location.latitude,
        longitude: location.longitude,
        notes,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Error checking in:', error);
      throw error;
    }
  }

  static async checkOut(taskId: string, userId: string, notes?: string): Promise<void> {
    try {
      const location = await this.getCurrentLocation();
      
      await GeofencingService.recordLocationEvent({
        task_id: taskId,
        user_id: userId,
        event_type: 'check_out',
        latitude: location.latitude,
        longitude: location.longitude,
        notes,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Error checking out:', error);
      throw error;
    }
  }
}