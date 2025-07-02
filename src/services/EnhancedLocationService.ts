import { supabase } from '../lib/supabase';
import { LocationService } from './LocationService';

export interface EnhancedLocationData {
  latitude: number;
  longitude: number;
  accuracy?: number;
  timestamp: string;
  battery_level?: number;
  connection_status?: 'online' | 'offline';
  task_id?: string;
  speed?: number;
  heading?: number;
  altitude?: number;
}

export class EnhancedLocationService extends LocationService {
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

  static async getLocationWithTaskInfo(userId: string): Promise<any | null> {
    const { data, error } = await supabase
      .from('employee_locations')
      .select(`
        *,
        users!user_id(full_name, avatar_url),
        tasks(id, title, status)
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

  static async getEmployeeLocationsByTask(taskId: string): Promise<any[]> {
    const { data, error } = await supabase
      .from('employee_locations')
      .select(`
        *,
        users!user_id(full_name, avatar_url)
      `)
      .eq('task_id', taskId)
      .order('timestamp', { ascending: false });

    if (error) {
      throw error;
    }

    return data || [];
  }

  static async updateLocationWithTask(userId: string, taskId: string | null): Promise<void> {
    // Get the latest location for the user
    const { data: latestLocation, error: fetchError } = await supabase
      .from('employee_locations')
      .select('*')
      .eq('user_id', userId)
      .order('timestamp', { ascending: false })
      .limit(1)
      .single();

    if (fetchError || !latestLocation) {
      console.warn('No location found to update with task info');
      return;
    }

    // Update the latest location with task information
    const { error: updateError } = await supabase
      .from('employee_locations')
      .update({ task_id: taskId })
      .eq('id', latestLocation.id);

    if (updateError) {
      throw updateError;
    }
  }

  static async getLocationAnalytics(userId?: string, days: number = 7): Promise<any> {
    const since = new Date();
    since.setDate(since.getDate() - days);

    let query = supabase
      .from('employee_locations')
      .select(`
        *,
        users!user_id(full_name)
      `)
      .gte('timestamp', since.toISOString());

    if (userId) {
      query = query.eq('user_id', userId);
    }

    const { data, error } = await query.order('timestamp', { ascending: true });

    if (error) {
      throw error;
    }

    // Process analytics data
    const analytics = {
      totalLocations: data?.length || 0,
      uniqueUsers: new Set(data?.map(l => l.user_id)).size,
      averageAccuracy: 0,
      locationsByDay: {} as Record<string, number>,
      userActivity: {} as Record<string, { name: string; count: number; lastSeen: string }>,
    };

    if (data && data.length > 0) {
      // Calculate average accuracy
      const accuracyValues = data.filter(l => l.location_accuracy).map(l => l.location_accuracy);
      if (accuracyValues.length > 0) {
        analytics.averageAccuracy = accuracyValues.reduce((sum, acc) => sum + acc, 0) / accuracyValues.length;
      }

      // Group by day
      data.forEach(location => {
        const day = new Date(location.timestamp).toDateString();
        analytics.locationsByDay[day] = (analytics.locationsByDay[day] || 0) + 1;
      });

      // User activity
      data.forEach(location => {
        const userId = location.user_id;
        if (!analytics.userActivity[userId]) {
          analytics.userActivity[userId] = {
            name: location.users?.full_name || 'Unknown',
            count: 0,
            lastSeen: location.timestamp,
          };
        }
        analytics.userActivity[userId].count++;
        if (new Date(location.timestamp) > new Date(analytics.userActivity[userId].lastSeen)) {
          analytics.userActivity[userId].lastSeen = location.timestamp;
        }
      });
    }

    return analytics;
  }
}