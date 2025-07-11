import { supabase } from '../lib/supabase';

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
  private static watchId: number | null = null;
  private static isTracking = false;
  private static currentUserId: string | null = null;

  static async startTracking(userId: string): Promise<void> {
    if (this.isTracking) {
      console.log('Location tracking already active');
      return;
    }

    this.currentUserId = userId;
    this.isTracking = true;

    if (!navigator.geolocation) {
      throw new Error('Geolocation is not supported by this browser');
    }

    const options = {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 60000, // 1 minute
    };

    this.watchId = navigator.geolocation.watchPosition(
      (position) => this.handleLocationUpdate(position),
      (error) => this.handleLocationError(error),
      options
    );

    // Also send initial location
    navigator.geolocation.getCurrentPosition(
      (position) => this.handleLocationUpdate(position),
      (error) => console.warn('Initial location failed:', error),
      options
    );

    console.log('Location tracking started for user:', userId);
  }

  static stopTracking(): void {
    if (this.watchId !== null) {
      navigator.geolocation.clearWatch(this.watchId);
      this.watchId = null;
    }
    this.isTracking = false;
    this.currentUserId = null;
    console.log('Location tracking stopped');
  }

  private static async handleLocationUpdate(position: GeolocationPosition): Promise<void> {
    if (!this.currentUserId) return;

    const locationData: LocationData = {
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
      accuracy: position.coords.accuracy,
      timestamp: new Date().toISOString(),
      battery_level: await this.getBatteryLevel(),
      connection_status: navigator.onLine ? 'online' : 'offline',
    };

    try {
      await this.saveLocation(this.currentUserId, locationData);
    } catch (error) {
      console.error('Failed to save location:', error);
    }
  }

  private static handleLocationError(error: GeolocationPositionError): void {
    console.error('Location error:', error.message);
    
    switch (error.code) {
      case error.PERMISSION_DENIED:
        console.error('Location access denied by user');
        break;
      case error.POSITION_UNAVAILABLE:
        console.error('Location information unavailable');
        break;
      case error.TIMEOUT:
        console.error('Location request timed out');
        break;
    }
  }

  static async getBatteryLevel(): Promise<number | undefined> {
    try {
      // Check if Battery Status API is supported
      if ('getBattery' in navigator) {
        const battery = await (navigator as any).getBattery();
        return Math.round(battery.level * 100);
      }
      return undefined;
    } catch (error) {
      console.warn('Could not retrieve battery level:', error);
      return undefined;
    }
  }

  static async saveLocation(userId: string, locationData: LocationData): Promise<void> {
    const { error } = await supabase
      .from('employee_locations')
      .insert({
        user_id: userId,
        latitude: locationData.latitude,
        longitude: locationData.longitude,
        timestamp: locationData.timestamp,
        battery_level: locationData.battery_level,
        connection_status: locationData.connection_status,
        location_accuracy: locationData.accuracy,
        task_id: locationData.task_id,
      });

    if (error) {
      throw error;
    }
  }

  static async getEmployeeLocations(): Promise<any[]> {
    try {
      // First, get all employee locations
      const { data: locations, error: locationsError } = await supabase
        .from('employee_locations')
        .select('*')
        .order('timestamp', { ascending: false });

      if (locationsError) {
        throw locationsError;
      }

      if (!locations || locations.length === 0) {
        return [];
      }

      // Get unique user IDs
      const userIds = [...new Set(locations.map(loc => loc.user_id))];

      // Fetch user data separately
      const { data: users, error: usersError } = await supabase
        .from('users')
        .select('id, full_name, avatar_url')
        .in('id', userIds);

      if (usersError) {
        throw usersError;
      }

      // Create a map of users for quick lookup
      const userMap = new Map(users?.map(user => [user.id, user]) || []);

      // Get the latest location for each user and attach user data
      const latestLocations = new Map();
      locations.forEach((location) => {
        if (!latestLocations.has(location.user_id) || 
            new Date(location.timestamp) > new Date(latestLocations.get(location.user_id).timestamp)) {
          const userData = userMap.get(location.user_id);
          latestLocations.set(location.user_id, {
            ...location,
            users: userData || { full_name: 'Unknown User', avatar_url: null }
          });
        }
      });

      return Array.from(latestLocations.values());
    } catch (error) {
      console.error('Error in getEmployeeLocations:', error);
      throw error;
    }
  }

  static async getUserLocation(userId: string): Promise<any | null> {
    try {
      // Get the latest location for the user
      const { data: location, error: locationError } = await supabase
        .from('employee_locations')
        .select('*')
        .eq('user_id', userId)
        .order('timestamp', { ascending: false })
        .limit(1)
        .single();

      // Log detailed error information
      if (locationError) {
        console.error('Location retrieval error:', {
          code: locationError.code,
          message: locationError.message,
          details: locationError.details
        });

        // Only throw if it's not a "no rows" error
        if (locationError.code !== 'PGRST116') {
          throw locationError;
        }
      }

      if (!location) {
        console.warn(`No location found for user ${userId}`);
        return null;
      }

      // Get user data separately
      const { data: user, error: userError } = await supabase
        .from('users')
        .select('id, full_name, avatar_url')
        .eq('id', userId)
        .single();

      if (userError) {
        console.error('User retrieval error:', {
          code: userError.code,
          message: userError.message,
          details: userError.details
        });
        throw userError;
      }

      return {
        ...location,
        users: user || { full_name: 'Unknown User', avatar_url: null }
      };
    } catch (error) {
      console.error('Comprehensive error in getUserLocation:', {
        userId,
        errorMessage: error instanceof Error ? error.message : String(error),
        errorStack: error instanceof Error ? error.stack : 'No stack trace'
      });
      throw error;
    }
  }

  static async getLocationHistory(userId: string, hours: number = 24): Promise<any[]> {
    const since = new Date();
    since.setHours(since.getHours() - hours);

    const { data, error } = await supabase
      .from('employee_locations')
      .select('*')
      .eq('user_id', userId)
      .gte('timestamp', since.toISOString())
      .order('timestamp', { ascending: true });

    if (error) {
      throw error;
    }

    return data || [];
  }
}