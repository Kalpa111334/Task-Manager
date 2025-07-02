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

  private static async getBatteryLevel(): Promise<number | undefined> {
    try {
      // @ts-ignore - Battery API is experimental
      if ('getBattery' in navigator) {
        // @ts-ignore
        const battery = await navigator.getBattery();
        return Math.round(battery.level * 100);
      }
    } catch (error) {
      // Battery API not supported or failed
    }
    return undefined;
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
    const { data, error } = await supabase
      .from('employee_locations')
      .select(`
        *,
        users!user_id(full_name, avatar_url)
      `)
      .order('timestamp', { ascending: false });

    if (error) {
      throw error;
    }

    // Get the latest location for each user
    const latestLocations = new Map();
    data?.forEach((location) => {
      if (!latestLocations.has(location.user_id) || 
          new Date(location.timestamp) > new Date(latestLocations.get(location.user_id).timestamp)) {
        latestLocations.set(location.user_id, location);
      }
    });

    return Array.from(latestLocations.values());
  }

  static async getUserLocation(userId: string): Promise<any | null> {
    const { data, error } = await supabase
      .from('employee_locations')
      .select(`
        *,
        users!user_id(full_name, avatar_url)
      `)
      .eq('user_id', userId)
      .order('timestamp', { ascending: false })
      .limit(1)
      .single();

    if (error && error.code !== 'PGRST116') {
      throw error;
    }

    return data;
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