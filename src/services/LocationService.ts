import { supabase } from '../lib/supabase';

export interface LocationData {
  latitude: number;
  longitude: number;
  battery_level?: number;
  connection_status?: string;
  task_id?: string;
  location_accuracy?: number;
  timestamp?: string;
}

export class LocationService {
  private static watchId: number | null = null;
  private static isTracking = false;
  private static retryCount = 0;
  private static maxRetries = 3;
  private static retryTimeout: NodeJS.Timeout | null = null;

  static async startTracking(userId: string, taskId?: string) {
    if (!navigator.geolocation) {
      throw new Error('Geolocation is not supported by your browser');
    }

    if (this.isTracking) {
      return;
    }

    this.isTracking = true;
    this.retryCount = 0;

    const options = {
      enableHighAccuracy: true,
      timeout: 10000, // Increased timeout for better accuracy
      maximumAge: 0
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
            // Reset retry count on successful position
            this.retryCount = 0;
            
            const locationData: LocationData = {
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
              location_accuracy: position.coords.accuracy,
              task_id: taskId,
              timestamp: new Date().toISOString(),
            };

            // Add battery information if available
            if ('getBattery' in navigator) {
              const battery: any = await (navigator as any).getBattery();
              locationData.battery_level = Math.round(battery.level * 100);
            }

            // Add connection status
            locationData.connection_status = navigator.onLine ? 'online' : 'offline';

            // Store location in Supabase
            const { error } = await supabase
              .from('employee_locations')
              .insert([{
                user_id: userId,
                ...locationData
              }]);

            if (error) {
              console.error('Error storing location:', error);
              this.handleError(error, userId, taskId);
            }
          } catch (error) {
            console.error('Error in location tracking:', error);
            this.handleError(error, userId, taskId);
          }
        },
        (error) => {
          console.error('Error getting location:', error);
          this.handleError(error, userId, taskId);
        },
        options
      );

      // Add online/offline event listeners
      window.addEventListener('online', () => this.handleConnectivityChange(true, userId));
      window.addEventListener('offline', () => this.handleConnectivityChange(false, userId));

    } catch (error) {
      console.error('Error starting location tracking:', error);
      this.handleError(error, userId, taskId);
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
      
      // Clear existing retry timeout if any
      if (this.retryTimeout) {
        clearTimeout(this.retryTimeout);
      }

      // Exponential backoff for retries
      const retryDelay = Math.min(1000 * Math.pow(2, this.retryCount - 1), 30000);
      this.retryTimeout = setTimeout(() => {
        this.stopTracking();
        this.startTracking(userId, taskId);
      }, retryDelay);
    } else {
      console.error('Max retry attempts reached. Location tracking failed.');
      this.stopTracking();
    }
  }

  private static async handleConnectivityChange(isOnline: boolean, userId: string) {
    try {
      const { error } = await supabase
        .from('employee_locations')
        .update({ connection_status: isOnline ? 'online' : 'offline' })
        .eq('user_id', userId)
        .order('timestamp', { ascending: false })
        .limit(1);

      if (error) {
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
      
      // Clear retry timeout if any
      if (this.retryTimeout) {
        clearTimeout(this.retryTimeout);
        this.retryTimeout = null;
      }

      // Remove event listeners
      window.removeEventListener('online', () => {});
      window.removeEventListener('offline', () => {});
    }
  }

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

    if (error) {
      throw error;
    }

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

  static async getEmployeeLatestLocation(userId: string) {
    const { data, error } = await supabase
      .from('employee_locations')
      .select('*')
      .eq('user_id', userId)
      .order('timestamp', { ascending: false })
      .limit(1)
      .single();

    if (error) {
      throw error;
    }

    return data;
  }
} 