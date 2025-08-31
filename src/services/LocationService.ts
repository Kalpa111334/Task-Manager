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

  private static async createTestLocations() {
    try {
      // Get all employees
      const { data: employees, error: employeesError } = await supabase
        .from('users')
        .select('id, full_name, email')
        .eq('role', 'employee');

      if (employeesError || !employees || employees.length === 0) {
        console.error('No employees found:', employeesError);
        return null;
      }

      console.log('Found employees:', {
        count: employees.length,
        employees: employees.map(e => ({ id: e.id, name: e.full_name }))
      });

      // Create test locations for each employee
      const locations = employees.map((employee, index) => ({
        user_id: employee.id,
        latitude: 7.8731 + (index * 0.001), // Slightly offset each employee's location
        longitude: 80.7718 + (index * 0.001),
        timestamp: new Date().toISOString(),
        battery_level: Math.floor(Math.random() * 30) + 70, // Random battery level between 70-100
        connection_status: 'online',
        location_accuracy: 10
      }));

      // Insert all locations
      const { data, error } = await supabase
        .from('employee_locations')
        .insert(locations)
        .select();

      if (error) {
        console.error('Error creating test locations:', {
          error,
          locationCount: locations.length
        });
        return null;
      }

      console.log('Test locations created:', {
        count: data.length,
        locations: data.map(loc => ({
          id: loc.id,
          userId: loc.user_id,
          coords: [loc.latitude, loc.longitude]
        }))
      });

      // Return the test data with employee information
      const testDataWithNames = data.map((location, index) => ({
        ...location,
        full_name: employees[index]?.full_name || 'Test Employee',
        avatar_url: employees[index]?.avatar_url || null,
        email: employees[index]?.email
      }));

      return testDataWithNames;
    } catch (error) {
      console.error('Error in createTestLocations:', error);
      return null;
    }
  }

  static async getEmployeeLocations(showAllEmployees = true) {
    try {
      // First verify the user's role
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('Not authenticated');
      }

      // Check if user is admin
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('role')
        .eq('id', user.id)
        .single();

      if (userError) {
        console.error('Error fetching user role:', userError);
        throw new Error('Failed to verify user role');
      }

      if (!userData || userData.role !== 'admin') {
        console.error('User is not an admin:', { userId: user.id, role: userData?.role });
        throw new Error('Unauthorized access');
      }

      // First get all employees
      const { data: employees, error: employeesError } = await supabase
        .from('users')
        .select('id')
        .eq('role', 'employee');

      if (employeesError) {
        console.error('Error fetching employees:', employeesError);
        throw employeesError;
      }

      if (!employees || employees.length === 0) {
        console.log('No employees found');
        return [];
      }

      // Get the latest location for each employee (extended time window to capture all employees)
      const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      
      const { data, error } = await supabase
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
        .in('user_id', employees.map(emp => emp.id))
        .gt('timestamp', oneWeekAgo)
        .order('timestamp', { ascending: false });

      if (error) {
        console.error('Error fetching employee locations:', {
          error,
          message: error.message,
          details: error.details
        });
        throw error;
      }

      if (!data || data.length === 0) {
        console.log('No employee locations found in the last week');
        return [];
      }

      // Filter to keep only the latest location per employee
      const latestLocations = data?.reduce((acc: any, curr: any) => {
        if (!acc[curr.user_id] || new Date(curr.timestamp) > new Date(acc[curr.user_id].timestamp)) {
          acc[curr.user_id] = curr;
        }
        return acc;
      }, {});

      const filteredData = latestLocations ? Object.values(latestLocations) : [];

      // Transform the data to match the expected format - show ALL employees with valid coordinates
      const transformedData = filteredData
        .filter((location: any) => {
          // Only filter out employees with invalid coordinates or extremely poor accuracy
          const hasValidCoords = location.latitude && location.longitude && 
                                !isNaN(location.latitude) && !isNaN(location.longitude);
          const hasReasonableAccuracy = !location.location_accuracy || location.location_accuracy < 1000; // Allow up to 1km accuracy
          
          if (!hasValidCoords) {
            console.log(`Employee ${location.user_id} filtered out (invalid coordinates):`, {
              latitude: location.latitude,
              longitude: location.longitude
            });
            return false;
          }
          
          if (!hasReasonableAccuracy) {
            console.log(`Employee ${location.user_id} filtered out (poor accuracy):`, {
              accuracy: location.location_accuracy
            });
            return false;
          }
          
          // Show all employees with valid data - activity status will be determined in the UI
          return true;
        })
        .map((location: any) => ({
          id: location.id,
          user_id: location.user_id,
          latitude: location.latitude,
          longitude: location.longitude,
          recorded_at: location.timestamp,
          last_updated: location.timestamp,
          battery_level: location.battery_level,
          connection_status: location.connection_status || 'online',
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

      console.log('Transformed locations data:', {
        count: transformedData.length,
        firstLocation: transformedData[0]
      });

      return transformedData;
    } catch (error) {
      console.error('Error in getEmployeeLocations:', {
        error,
        message: (error as Error).message,
        stack: (error as Error).stack
      });
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
      // First verify the user exists
      const { data: user, error: userError } = await supabase
        .from('users')
        .select('id, role')
        .eq('id', userId)
        .single();

      if (userError || !user) {
        console.error('Error verifying user:', {
          userError,
          userId
        });
        throw new Error('User not found');
      }

      const batteryLevel = await this.getBatteryLevel();
      const timestamp = new Date().toISOString();

      const { data, error } = await supabase
        .from('employee_locations')
        .insert({
          user_id: userId,
          latitude: location.latitude,
          longitude: location.longitude,
          timestamp: timestamp,
          battery_level: batteryLevel,
          connection_status: navigator.onLine ? 'online' : 'offline',
          location_accuracy: 10, // Default accuracy for test data
        })
        .select()
        .single();

      if (error) {
        console.error('Error saving location:', {
          error,
          userId,
          location,
          timestamp
        });
        throw error;
      }

      console.log('Location saved successfully:', {
        locationId: data.id,
        userId,
        timestamp
      });
    } catch (error) {
      console.error('Error in saveLocation:', {
        error,
        message: (error as Error).message,
        userId,
        location
      });
      throw error;
    }
  }
}