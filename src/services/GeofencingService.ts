import { supabase } from '../lib/supabase';

export interface Geofence {
  id: string;
  name: string;
  description?: string;
  center_latitude: number;
  center_longitude: number;
  radius_meters: number;
  created_by?: string;
  created_at: string;
  updated_at: string;
  is_active: boolean;
}

export interface TaskLocation {
  id: string;
  task_id: string;
  geofence_id?: string;
  required_latitude?: number;
  required_longitude?: number;
  required_radius_meters: number;
  arrival_required: boolean;
  departure_required: boolean;
  created_at: string;
}

export interface LocationAlert {
  id: string;
  user_id: string;
  task_id?: string;
  alert_type: 'task_completion' | 'arrival' | 'departure' | 'out_of_bounds' | 'deadline_reminder' | 'emergency';
  title: string;
  message: string;
  latitude?: number;
  longitude?: number;
  is_read: boolean;
  is_acknowledged: boolean;
  priority: 'low' | 'medium' | 'high' | 'critical';
  created_at: string;
  acknowledged_at?: string;
}

export interface MovementHistory {
  id: string;
  user_id: string;
  latitude: number;
  longitude: number;
  altitude?: number;
  speed?: number;
  heading?: number;
  accuracy?: number;
  timestamp: string;
  task_id?: string;
  location_source: 'gps' | 'network' | 'passive';
  battery_level?: number;
  is_mock_location: boolean;
}

export interface TaskLocationEvent {
  id: string;
  task_id: string;
  user_id: string;
  event_type: 'check_in' | 'check_out' | 'arrival' | 'departure' | 'boundary_violation';
  latitude: number;
  longitude: number;
  geofence_id?: string;
  notes?: string;
  timestamp: string;
  created_at: string;
}

export class GeofencingService {
  // Geofence Management
  static async createGeofence(geofence: Omit<Geofence, 'id' | 'created_at' | 'updated_at'>): Promise<Geofence> {
    const { data, error } = await supabase
      .from('geofences')
      .insert([geofence])
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  static async getGeofences(activeOnly: boolean = true): Promise<Geofence[]> {
    let query = supabase.from('geofences').select('*');
    
    if (activeOnly) {
      query = query.eq('is_active', true);
    }

    const { data, error } = await query.order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  }

  static async updateGeofence(id: string, updates: Partial<Geofence>): Promise<Geofence> {
    const { data, error } = await supabase
      .from('geofences')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  static async deleteGeofence(id: string): Promise<void> {
    const { error } = await supabase
      .from('geofences')
      .update({ is_active: false })
      .eq('id', id);

    if (error) throw error;
  }

  // Task Location Management
  static async createTaskLocation(taskLocation: Omit<TaskLocation, 'id' | 'created_at'>): Promise<TaskLocation> {
    const { data, error } = await supabase
      .from('task_locations')
      .insert([taskLocation])
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  static async getTaskLocations(taskId?: string): Promise<TaskLocation[]> {
    let query = supabase.from('task_locations').select('*');
    
    if (taskId) {
      query = query.eq('task_id', taskId);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  }

  // Location Alerts
  static async getLocationAlerts(userId: string, unreadOnly: boolean = false): Promise<LocationAlert[]> {
    let query = supabase
      .from('location_alerts')
      .select('*')
      .eq('user_id', userId);

    if (unreadOnly) {
      query = query.eq('is_read', false);
    }

    const { data, error } = await query.order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  }

  static async markAlertAsRead(alertId: string): Promise<void> {
    const { error } = await supabase
      .from('location_alerts')
      .update({ is_read: true })
      .eq('id', alertId);

    if (error) throw error;
  }

  static async acknowledgeAlert(alertId: string): Promise<void> {
    const { error } = await supabase
      .from('location_alerts')
      .update({ 
        is_acknowledged: true,
        acknowledged_at: new Date().toISOString()
      })
      .eq('id', alertId);

    if (error) throw error;
  }

  // Movement History
  static async recordMovement(movement: Omit<MovementHistory, 'id'>): Promise<MovementHistory> {
    const { data, error } = await supabase
      .from('employee_movement_history')
      .insert([movement])
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  static async getMovementHistory(
    userId: string,
    startDate?: Date,
    endDate?: Date,
    taskId?: string
  ): Promise<MovementHistory[]> {
    let query = supabase
      .from('employee_movement_history')
      .select('*')
      .eq('user_id', userId);

    if (startDate) {
      query = query.gte('timestamp', startDate.toISOString());
    }

    if (endDate) {
      query = query.lte('timestamp', endDate.toISOString());
    }

    if (taskId) {
      query = query.eq('task_id', taskId);
    }

    const { data, error } = await query.order('timestamp', { ascending: false });
    if (error) throw error;
    return data || [];
  }

  // Task Location Events
  static async recordLocationEvent(event: Omit<TaskLocationEvent, 'id' | 'created_at'>): Promise<TaskLocationEvent> {
    const { data, error } = await supabase
      .from('task_location_events')
      .insert([event])
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  static async getTaskLocationEvents(taskId: string): Promise<TaskLocationEvent[]> {
    const { data, error } = await supabase
      .from('task_location_events')
      .select('*')
      .eq('task_id', taskId)
      .order('timestamp', { ascending: false });

    if (error) throw error;
    return data || [];
  }

  // Utility Functions
  static calculateDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
  ): number {
    const R = 6371000; // Earth's radius in meters
    const dLat = this.toRadians(lat2 - lat1);
    const dLon = this.toRadians(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRadians(lat1)) *
        Math.cos(this.toRadians(lat2)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  static isWithinGeofence(
    latitude: number,
    longitude: number,
    geofence: Geofence
  ): boolean {
    const distance = this.calculateDistance(
      latitude,
      longitude,
      geofence.center_latitude,
      geofence.center_longitude
    );
    return distance <= geofence.radius_meters;
  }

  private static toRadians(degrees: number): number {
    return degrees * (Math.PI / 180);
  }

  // Real-time subscriptions
  static subscribeToLocationAlerts(
    userId: string,
    callback: (alert: LocationAlert) => void
  ) {
    return supabase
      .channel('location_alerts')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'location_alerts',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          callback(payload.new as LocationAlert);
        }
      )
      .subscribe();
  }

  static subscribeToTaskLocationEvents(
    taskId: string,
    callback: (event: TaskLocationEvent) => void
  ) {
    return supabase
      .channel('task_location_events')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'task_location_events',
          filter: `task_id=eq.${taskId}`,
        },
        (payload) => {
          callback(payload.new as TaskLocationEvent);
        }
      )
      .subscribe();
  }
}