import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { supabase } from '../../lib/supabase';
import { GeofencingService, Geofence } from '../../services/GeofencingService';
import { User } from '../../types/index';
import { formatCurrency, parseCurrencyInput } from '../../utils/currency';
import { MapIcon, LocationMarkerIcon } from '@heroicons/react/outline';

interface EnhancedTaskFormProps {
  onSubmit: (data: any) => void;
  initialData?: any;
  isEdit?: boolean;
}

interface FormInputs {
  title: string;
  description: string;
  priority: 'Low' | 'Medium' | 'High';
  assigned_to: string;
  due_date: string;
  price: string;
  location_required: boolean;
  location_latitude?: number;
  location_longitude?: number;
  location_radius_meters: number;
  auto_check_in: boolean;
  auto_check_out: boolean;
  geofence_id?: string;
  location_data?: {
    geofence_id: string | null;
    required_latitude: number | null;
    required_longitude: number | null;
    required_radius_meters: number;
    arrival_required: boolean;
    departure_required: boolean;
  };
}

export default function EnhancedTaskForm({ onSubmit, initialData, isEdit = false }: EnhancedTaskFormProps) {
  const [employees, setEmployees] = useState<User[]>([]);
  const [geofences, setGeofences] = useState<Geofence[]>([]);
  const [priceInput, setPriceInput] = useState(
    initialData?.price ? formatCurrency(initialData.price) : 'Rs. 0'
  );
  const [useCurrentLocation, setUseCurrentLocation] = useState(false);
  const [gettingLocation, setGettingLocation] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
    getValues,
  } = useForm<FormInputs>({
    defaultValues: {
      priority: 'Medium',
      price: 'Rs. 0',
      location_required: false,
      location_radius_meters: 100,
      auto_check_in: false,
      auto_check_out: false,
      ...initialData,
    },
  });

  const locationRequired = watch('location_required');
  const selectedGeofence = watch('geofence_id');

  useEffect(() => {
    fetchEmployees();
    fetchGeofences();
    if (initialData?.price) {
      setPriceInput(formatCurrency(initialData.price));
    }
  }, [initialData]);

  const fetchEmployees = async () => {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('role', 'employee');

    if (error) {
      console.error('Error fetching employees:', error);
      return;
    }

    setEmployees(data || []);
  };

  const fetchGeofences = async () => {
    try {
      const data = await GeofencingService.getGeofences(true);
      setGeofences(data);
    } catch (error) {
      console.error('Error fetching geofences:', error);
    }
  };

  const handlePriceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    const numericValue = parseCurrencyInput(value);
    setPriceInput(formatCurrency(numericValue));
    setValue('price', String(numericValue));
  };

  const getCurrentLocation = async () => {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by this browser');
      return;
    }

    setGettingLocation(true);
    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 60000,
        });
      });

      setValue('location_latitude', position.coords.latitude);
      setValue('location_longitude', position.coords.longitude);
      setUseCurrentLocation(true);
    } catch (error) {
      console.error('Error getting location:', error);
      alert('Failed to get current location. Please enter coordinates manually.');
    } finally {
      setGettingLocation(false);
    }
  };

  const handleGeofenceChange = (geofenceId: string) => {
    if (geofenceId) {
      const geofence = geofences.find(g => g.id === geofenceId);
      if (geofence) {
        setValue('location_latitude', geofence.center_latitude);
        setValue('location_longitude', geofence.center_longitude);
        setValue('location_radius_meters', geofence.radius_meters);
      }
    }
  };

  const handleFormSubmit = async (data: FormInputs) => {
    const formattedData = {
      ...data,
      price: parseCurrencyInput(priceInput),
    };

    // Create task location if location is required
    if (data.location_required && (data.location_latitude || data.geofence_id)) {
      formattedData.location_data = {
        geofence_id: data.geofence_id || null,
        required_latitude: data.location_latitude || null,
        required_longitude: data.location_longitude || null,
        required_radius_meters: data.location_radius_meters,
        arrival_required: true,
        departure_required: data.auto_check_out,
      };
    }

    onSubmit(formattedData);
  };

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-6">
      <div>
        <label htmlFor="title" className="block text-sm font-medium text-gray-700">
          Title
        </label>
        <input
          type="text"
          id="title"
          {...register('title', { required: 'Title is required' })}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
        />
        {errors.title && (
          <p className="mt-1 text-sm text-red-600">{errors.title.message}</p>
        )}
      </div>

      <div>
        <label htmlFor="description" className="block text-sm font-medium text-gray-700">
          Description
        </label>
        <textarea
          id="description"
          rows={3}
          {...register('description', { required: 'Description is required' })}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
        />
        {errors.description && (
          <p className="mt-1 text-sm text-red-600">{errors.description.message}</p>
        )}
      </div>

      <div>
        <label htmlFor="price" className="block text-sm font-medium text-gray-700">
          Price (LKR)
        </label>
        <div className="mt-1 relative rounded-md shadow-sm">
          <input
            type="text"
            id="price"
            value={priceInput}
            onChange={handlePriceChange}
            className="block w-full rounded-md border-gray-300 pl-7 pr-12 focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            placeholder="Rs. 0"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label htmlFor="priority" className="block text-sm font-medium text-gray-700">
            Priority
          </label>
          <select
            id="priority"
            {...register('priority')}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
          >
            <option value="Low">Low</option>
            <option value="Medium">Medium</option>
            <option value="High">High</option>
          </select>
        </div>

        <div>
          <label htmlFor="assigned_to" className="block text-sm font-medium text-gray-700">
            Assign To
          </label>
          <select
            id="assigned_to"
            {...register('assigned_to', { required: 'Please assign the task to an employee' })}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
          >
            <option value="">Select Employee</option>
            {employees.map((employee) => (
              <option key={employee.id} value={employee.id}>
                {employee.full_name}
              </option>
            ))}
          </select>
          {errors.assigned_to && (
            <p className="mt-1 text-sm text-red-600">{errors.assigned_to.message}</p>
          )}
        </div>
      </div>

      <div>
        <label htmlFor="due_date" className="block text-sm font-medium text-gray-700">
          Due Date
        </label>
        <input
          type="date"
          id="due_date"
          {...register('due_date', { required: 'Due date is required' })}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
        />
        {errors.due_date && (
          <p className="mt-1 text-sm text-red-600">{errors.due_date.message}</p>
        )}
      </div>

      {/* Location Requirements */}
      <div className="border-t border-gray-200 pt-6">
        <div className="flex items-center">
          <input
            type="checkbox"
            id="location_required"
            {...register('location_required')}
            className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
          />
          <label htmlFor="location_required" className="ml-2 block text-sm font-medium text-gray-700">
            Location-based task
          </label>
        </div>
        <p className="mt-1 text-sm text-gray-500">
          Require employees to be at a specific location to work on this task
        </p>

        {locationRequired && (
          <div className="mt-4 space-y-4 p-4 bg-gray-50 rounded-lg">
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Location Method
              </label>
              <div className="mt-2 space-y-2">
                <div className="flex items-center">
                  <input
                    type="radio"
                    id="use_geofence"
                    name="location_method"
                    checked={!!selectedGeofence}
                    onChange={() => setValue('geofence_id', geofences[0]?.id || '')}
                    className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300"
                  />
                  <label htmlFor="use_geofence" className="ml-2 block text-sm text-gray-700">
                    Use existing geofence
                  </label>
                </div>
                <div className="flex items-center">
                  <input
                    type="radio"
                    id="use_coordinates"
                    name="location_method"
                    checked={!selectedGeofence}
                    onChange={() => setValue('geofence_id', '')}
                    className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300"
                  />
                  <label htmlFor="use_coordinates" className="ml-2 block text-sm text-gray-700">
                    Use specific coordinates
                  </label>
                </div>
              </div>
            </div>

            {selectedGeofence ? (
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Select Geofence
                </label>
                <select
                  {...register('geofence_id')}
                  onChange={(e) => handleGeofenceChange(e.target.value)}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                >
                  <option value="">Select a geofence</option>
                  {geofences.map((geofence) => (
                    <option key={geofence.id} value={geofence.id}>
                      {geofence.name} ({geofence.radius_meters}m radius)
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Latitude
                  </label>
                  <input
                    type="number"
                    step="any"
                    {...register('location_latitude', {
                      required: locationRequired && !selectedGeofence ? 'Latitude is required' : false,
                    })}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                    placeholder="0.000000"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Longitude
                  </label>
                  <input
                    type="number"
                    step="any"
                    {...register('location_longitude', {
                      required: locationRequired && !selectedGeofence ? 'Longitude is required' : false,
                    })}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                    placeholder="0.000000"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Radius (meters)
                  </label>
                  <input
                    type="number"
                    min="10"
                    max="1000"
                    {...register('location_radius_meters')}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                  />
                </div>
              </div>
            )}

            {!selectedGeofence && (
              <div>
                <button
                  type="button"
                  onClick={getCurrentLocation}
                  disabled={gettingLocation}
                  className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
                >
                  {gettingLocation ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-600 mr-2"></div>
                  ) : (
                    <LocationMarkerIcon className="h-4 w-4 mr-2" />
                  )}
                  {gettingLocation ? 'Getting Location...' : 'Use Current Location'}
                </button>
              </div>
            )}

            <div className="flex items-center space-x-6">
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="auto_check_in"
                  {...register('auto_check_in')}
                  className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                />
                <label htmlFor="auto_check_in" className="ml-2 block text-sm text-gray-700">
                  Auto check-in when employee arrives
                </label>
              </div>
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="auto_check_out"
                  {...register('auto_check_out')}
                  className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                />
                <label htmlFor="auto_check_out" className="ml-2 block text-sm text-gray-700">
                  Auto check-out when employee leaves
                </label>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="flex justify-end">
        <button
          type="submit"
          className="inline-flex justify-center rounded-md border border-transparent bg-indigo-600 py-2 px-4 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
        >
          {isEdit ? 'Update Task' : 'Create Task'}
        </button>
      </div>
    </form>
  );
}