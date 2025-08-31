import { supabase } from '../lib/supabase';
import { EmployeeLocation } from '../types';

export interface RouteHistoryOptions {
  employeeId?: string;
  startDate?: string;
  endDate?: string;
  limit?: number;
}

export interface RouteStatistics {
  totalDistance: number;
  totalTime: number;
  averageSpeed: number;
  stops: number;
  startTime: string;
  endTime: string;
  locationCount: number;
}

export class RouteTrackingService {
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

  static async getEmployeeRouteHistory(options: RouteHistoryOptions = {}): Promise<EmployeeLocation[]> {
    try {
      // Verify user authentication and admin role
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('Not authenticated');
      }

      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('role')
        .eq('id', user.id)
        .single();

      if (userError || !userData || userData.role !== 'admin') {
        throw new Error('Unauthorized access');
      }

      let query = supabase
        .from('employee_locations')
        .select(`
          id,
          user_id,
          latitude,
          longitude,
          timestamp,
          battery_level,
          connection_status,
          location_accuracy,
          task_id,
          users!employee_locations_user_id_fkey (
            full_name,
            avatar_url,
            email
          ),
          tasks!employee_locations_task_id_fkey (
            title,
            status,
            due_date
          )
        `)
        .order('timestamp', { ascending: false });

      // Apply filters
      if (options.employeeId) {
        query = query.eq('user_id', options.employeeId);
      }

      if (options.startDate) {
        query = query.gte('timestamp', options.startDate);
      }

      if (options.endDate) {
        query = query.lte('timestamp', options.endDate);
      }

      if (options.limit) {
        query = query.limit(options.limit);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching route history:', error);
        throw error;
      }

      if (!data || data.length === 0) {
        return [];
      }

      // Transform the data
      const transformedData = data.map((location: any) => ({
        id: location.id,
        user_id: location.user_id,
        latitude: location.latitude,
        longitude: location.longitude,
        recorded_at: location.timestamp,
        last_updated: location.timestamp,
        battery_level: location.battery_level,
        connection_status: location.connection_status || 'offline',
        location_accuracy: location.location_accuracy || 10,
        accuracy: location.location_accuracy || 10,
        task_id: location.task_id,
        full_name: location.users?.full_name || 'Unknown User',
        avatar_url: location.users?.avatar_url,
        email: location.users?.email,
        task_title: location.tasks?.title,
        task_status: location.tasks?.status,
        task_due_date: location.tasks?.due_date
      }));

      return transformedData;
    } catch (error) {
      console.error('Error in getEmployeeRouteHistory:', error);
      throw error;
    }
  }

  static async getEmployeeRouteStatistics(
    employeeId: string,
    startDate?: string,
    endDate?: string
  ): Promise<RouteStatistics> {
    try {
      const locations = await this.getEmployeeRouteHistory({
        employeeId,
        startDate,
        endDate
      });

      if (locations.length < 2) {
        return {
          totalDistance: 0,
          totalTime: 0,
          averageSpeed: 0,
          stops: 0,
          startTime: locations[0]?.last_updated || locations[0]?.recorded_at || '',
          endTime: locations[0]?.last_updated || locations[0]?.recorded_at || '',
          locationCount: locations.length
        };
      }

      // Sort locations by timestamp
      const sortedLocations = [...locations].sort((a, b) => 
        new Date(a.last_updated || a.recorded_at || '').getTime() - 
        new Date(b.last_updated || b.recorded_at || '').getTime()
      );

      let totalDistance = 0;
      let stops = 0;
      const stopThreshold = 5; // meters
      const timeThreshold = 5 * 60 * 1000; // 5 minutes in milliseconds

      for (let i = 1; i < sortedLocations.length; i++) {
        const prev = sortedLocations[i - 1];
        const curr = sortedLocations[i];
        
        const distance = this.calculateDistance(
          prev.latitude, prev.longitude,
          curr.latitude, curr.longitude
        );
        
        totalDistance += distance;

        // Check for stops
        if (distance < stopThreshold) {
          const timeDiff = new Date(curr.last_updated || curr.recorded_at || '').getTime() - 
                          new Date(prev.last_updated || prev.recorded_at || '').getTime();
          if (timeDiff > timeThreshold) {
            stops++;
          }
        }
      }

      const startTime = new Date(sortedLocations[0].last_updated || sortedLocations[0].recorded_at || '');
      const endTime = new Date(sortedLocations[sortedLocations.length - 1].last_updated || sortedLocations[sortedLocations.length - 1].recorded_at || '');
      const totalTime = (endTime.getTime() - startTime.getTime()) / 1000; // in seconds
      const averageSpeed = totalTime > 0 ? (totalDistance / totalTime) * 3.6 : 0; // km/h

      return {
        totalDistance,
        totalTime,
        averageSpeed,
        stops,
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
        locationCount: locations.length
      };
    } catch (error) {
      console.error('Error calculating route statistics:', error);
      throw error;
    }
  }

  static async getAllEmployeesRouteHistory(
    startDate?: string,
    endDate?: string
  ): Promise<{ [employeeId: string]: EmployeeLocation[] }> {
    try {
      const allLocations = await this.getEmployeeRouteHistory({
        startDate,
        endDate
      });

      // Group locations by employee
      const groupedLocations: { [employeeId: string]: EmployeeLocation[] } = {};
      
      allLocations.forEach(location => {
        if (!groupedLocations[location.user_id]) {
          groupedLocations[location.user_id] = [];
        }
        groupedLocations[location.user_id].push(location);
      });

      return groupedLocations;
    } catch (error) {
      console.error('Error getting all employees route history:', error);
      throw error;
    }
  }

  static async getRouteHeatmapData(
    startDate?: string,
    endDate?: string
  ): Promise<Array<{ lat: number; lng: number; intensity: number }>> {
    try {
      const allLocations = await this.getEmployeeRouteHistory({
        startDate,
        endDate
      });

      // Group nearby locations and calculate intensity
      const heatmapData: { [key: string]: { lat: number; lng: number; count: number } } = {};
      const gridSize = 0.001; // Approximately 100m grid

      allLocations.forEach(location => {
        const gridLat = Math.round(location.latitude / gridSize) * gridSize;
        const gridLng = Math.round(location.longitude / gridSize) * gridSize;
        const key = `${gridLat},${gridLng}`;

        if (!heatmapData[key]) {
          heatmapData[key] = {
            lat: gridLat,
            lng: gridLng,
            count: 0
          };
        }
        heatmapData[key].count++;
      });

      // Convert to array and normalize intensity
      const maxCount = Math.max(...Object.values(heatmapData).map(d => d.count));
      
      return Object.values(heatmapData).map(data => ({
        lat: data.lat,
        lng: data.lng,
        intensity: data.count / maxCount
      }));
    } catch (error) {
      console.error('Error generating heatmap data:', error);
      throw error;
    }
  }

  static async getDailyRouteSummary(
    employeeId: string,
    date: string
  ): Promise<{
    date: string;
    totalDistance: number;
    totalTime: number;
    averageSpeed: number;
    stops: number;
    locationCount: number;
    routes: Array<{
      startTime: string;
      endTime: string;
      distance: number;
      duration: number;
    }>;
  }> {
    try {
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);
      
      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);

      const locations = await this.getEmployeeRouteHistory({
        employeeId,
        startDate: startOfDay.toISOString(),
        endDate: endOfDay.toISOString()
      });

      if (locations.length < 2) {
        return {
          date,
          totalDistance: 0,
          totalTime: 0,
          averageSpeed: 0,
          stops: 0,
          locationCount: locations.length,
          routes: []
        };
      }

      // Sort locations by timestamp
      const sortedLocations = [...locations].sort((a, b) => 
        new Date(a.last_updated || a.recorded_at || '').getTime() - 
        new Date(b.last_updated || b.recorded_at || '').getTime()
      );

      // Identify route segments (separated by long stops)
      const routes: Array<{
        startTime: string;
        endTime: string;
        distance: number;
        duration: number;
      }> = [];

      let currentRouteStart = 0;
      const routeBreakThreshold = 30 * 60 * 1000; // 30 minutes

      for (let i = 1; i < sortedLocations.length; i++) {
        const prev = sortedLocations[i - 1];
        const curr = sortedLocations[i];
        
        const timeDiff = new Date(curr.last_updated || curr.recorded_at || '').getTime() - 
                        new Date(prev.last_updated || prev.recorded_at || '').getTime();

        if (timeDiff > routeBreakThreshold) {
          // End current route and start new one
          if (i - currentRouteStart > 1) {
            const routeLocations = sortedLocations.slice(currentRouteStart, i);
            const routeDistance = this.calculateRouteDistance(routeLocations);
            const routeDuration = new Date(routeLocations[routeLocations.length - 1].last_updated || routeLocations[routeLocations.length - 1].recorded_at || '').getTime() - 
                                 new Date(routeLocations[0].last_updated || routeLocations[0].recorded_at || '').getTime();

            routes.push({
              startTime: routeLocations[0].last_updated || routeLocations[0].recorded_at || '',
              endTime: routeLocations[routeLocations.length - 1].last_updated || routeLocations[routeLocations.length - 1].recorded_at || '',
              distance: routeDistance,
              duration: routeDuration / 1000 // Convert to seconds
            });
          }
          currentRouteStart = i;
        }
      }

      // Add the last route
      if (sortedLocations.length - currentRouteStart > 1) {
        const routeLocations = sortedLocations.slice(currentRouteStart);
        const routeDistance = this.calculateRouteDistance(routeLocations);
        const routeDuration = new Date(routeLocations[routeLocations.length - 1].last_updated || routeLocations[routeLocations.length - 1].recorded_at || '').getTime() - 
                             new Date(routeLocations[0].last_updated || routeLocations[0].recorded_at || '').getTime();

        routes.push({
          startTime: routeLocations[0].last_updated || routeLocations[0].recorded_at || '',
          endTime: routeLocations[routeLocations.length - 1].last_updated || routeLocations[routeLocations.length - 1].recorded_at || '',
          distance: routeDistance,
          duration: routeDuration / 1000
        });
      }

      const totalDistance = routes.reduce((sum, route) => sum + route.distance, 0);
      const totalTime = routes.reduce((sum, route) => sum + route.duration, 0);
      const averageSpeed = totalTime > 0 ? (totalDistance / totalTime) * 3.6 : 0;

      return {
        date,
        totalDistance,
        totalTime,
        averageSpeed,
        stops: routes.length - 1, // Number of stops between routes
        locationCount: locations.length,
        routes
      };
    } catch (error) {
      console.error('Error generating daily route summary:', error);
      throw error;
    }
  }

  private static calculateRouteDistance(locations: EmployeeLocation[]): number {
    let totalDistance = 0;
    
    for (let i = 1; i < locations.length; i++) {
      const prev = locations[i - 1];
      const curr = locations[i];
      
      totalDistance += this.calculateDistance(
        prev.latitude, prev.longitude,
        curr.latitude, curr.longitude
      );
    }
    
    return totalDistance;
  }
}
