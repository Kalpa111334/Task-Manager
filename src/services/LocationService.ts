import { supabase } from '../lib/supabase';

// Add battery interface at the top
interface Battery {
  level: number;
  addEventListener: (type: string, listener: () => void) => void;
  removeEventListener: (type: string, listener: () => void) => void;
}

interface NavigatorWithBattery extends Navigator {
  getBattery?: () => Promise<Battery>;
}

export interface LocationData {
  latitude: number;
  longitude: number;
  accuracy?: number;
  timestamp: string;
  battery_level?: number;
  connection_status?: 'online' | 'offline';
  task_id?: string;
}

export class LocationService {
  private static trackingInterval: NodeJS.Timeout | null = null;
  private static lastLocation: { latitude: number; longitude: number } | null = null;
  private static minimumDistanceThreshold = 10; // meters
  private static batteryManager: Battery | null = null;

  static async getEmployeeLocations() {
    try {
      const { data, error } = await supabase
        .rpc('get_latest_employee_locations');

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching employee locations:', error);
      throw error;
    }
  }

  private static async updateLocation(userId: string, position: GeolocationPosition) {
    try {
      // Get battery information if available
      let batteryLevel = null;
      if ((navigator as NavigatorWithBattery).getBattery) {
        const battery = await (navigator as NavigatorWithBattery).getBattery?.();
        if (battery) {
          batteryLevel = Math.round(battery.level * 100);
        }
      }

      // Check if we should update based on distance threshold
      if (this.lastLocation) {
        const distance = this.calculateDistance(
          this.lastLocation.latitude,
          this.lastLocation.longitude,
          position.coords.latitude,
          position.coords.longitude
        );
        
        if (distance < this.minimumDistanceThreshold) {
          return; // Skip update if movement is below threshold
        }
      }

      const { error } = await supabase
        .from('employee_locations')
        .insert({
          user_id: userId,
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          timestamp: new Date().toISOString(),
          battery_level: batteryLevel,
          connection_status: navigator.onLine ? 'online' : 'offline',
          location_accuracy: position.coords.accuracy,
        });

      if (error) throw error;

      this.lastLocation = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      };
    } catch (error) {
      console.error('Error updating location:', error);
      throw error;
    }
  }

  private static calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371e3; // Earth's radius in meters
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;

    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

    return R * c;
  }

  static startTracking(userId: string) {
    if (!navigator.geolocation) {
      throw new Error('Geolocation is not supported by this browser');
    }

    // Set up online/offline status monitoring
    window.addEventListener('online', () => this.handleConnectivityChange(userId, true));
    window.addEventListener('offline', () => this.handleConnectivityChange(userId, false));

    // Set up battery monitoring if available
    if ((navigator as NavigatorWithBattery).getBattery) {
      (navigator as NavigatorWithBattery).getBattery?.().then(battery => {
        if (battery) {
          this.batteryManager = battery;
          battery.addEventListener('levelchange', () => this.handleBatteryChange(userId));
        }
      });
    }

    // Start location tracking
    const watchId = navigator.geolocation.watchPosition(
      (position) => this.updateLocation(userId, position),
      (error) => {
        console.error('Error getting location:', error);
        throw error;
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 10000,
      }
    );

    // Store watch ID for cleanup
    return watchId;
  }

  static stopTracking() {
    if (this.trackingInterval) {
      clearInterval(this.trackingInterval);
      this.trackingInterval = null;
    }

    // Remove event listeners
    window.removeEventListener('online', () => {});
    window.removeEventListener('offline', () => {});

    if (this.batteryManager) {
      this.batteryManager.removeEventListener('levelchange', () => {});
      this.batteryManager = null;
    }

    this.lastLocation = null;
  }

  private static async handleConnectivityChange(userId: string, isOnline: boolean) {
    try {
      const { error } = await supabase
        .from('employee_locations')
        .update({ connection_status: isOnline ? 'online' : 'offline' })
        .eq('user_id', userId)
        .order('timestamp', { ascending: false })
        .limit(1);

      if (error) throw error;
    } catch (error) {
      console.error('Error updating connectivity status:', error);
    }
  }

  private static async handleBatteryChange(userId: string) {
    if (!this.batteryManager) return;

    try {
      const { error } = await supabase
        .from('employee_locations')
        .update({ battery_level: Math.round(this.batteryManager.level * 100) })
        .eq('user_id', userId)
        .order('timestamp', { ascending: false })
        .limit(1);

      if (error) throw error;
    } catch (error) {
      console.error('Error updating battery level:', error);
    }
  }

  static async getBatteryLevel(): Promise<number | null> {
    try {
      if ((navigator as NavigatorWithBattery).getBattery) {
        const battery = await (navigator as NavigatorWithBattery).getBattery?.();
        return battery ? Math.round(battery.level * 100) : null;
      }
      return null;
    } catch (error) {
      console.error('Error getting battery level:', error);
      return null;
    }
  }

  static async saveLocation(userId: string, location: { latitude: number; longitude: number }): Promise<void> {
    try {
      const batteryLevel = await this.getBatteryLevel();
      await supabase
        .from('employee_locations')
        .insert({
          user_id: userId,
          latitude: location.latitude,
          longitude: location.longitude,
          timestamp: new Date().toISOString(),
          battery_level: batteryLevel,
          connection_status: navigator.onLine ? 'online' : 'offline',
        });
    } catch (error) {
      console.error('Error saving location:', error);
      throw error;
    }
  }
}