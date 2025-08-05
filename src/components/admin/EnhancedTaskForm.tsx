import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { supabase } from '../../lib/supabase';
import { GeofencingService, Geofence } from '../../services/GeofencingService';
import { User } from '../../types/index';
import { formatCurrency, parseCurrencyInput } from '../../utils/currency';
import { MapIcon, LocationMarkerIcon, PlusIcon, TrashIcon } from '@heroicons/react/outline';
import MapLocationPicker from './MapLocationPicker';
import toast from 'react-hot-toast';

interface EnhancedTaskFormProps {
  onSubmit: (data: any) => void;
  initialData?: any;
  isEdit?: boolean;
}

interface TaskLocation {
  id?: string;
  geofence_id: string | null;
  latitude: number | null;
  longitude: number | null;
  radius_meters: number;
  arrival_required: boolean;
  departure_required: boolean;
}

interface FormInputs {
  title: string;
  description: string;
  priority: 'Low' | 'Medium' | 'High';
  assigned_to: string;
  due_date: string;
  price: string;
  location_required: boolean;
  locations: TaskLocation[];
}

export default function EnhancedTaskForm({ onSubmit, initialData, isEdit = false }: EnhancedTaskFormProps) {
  const [employees, setEmployees] = useState<User[]>([]);
  const [geofences, setGeofences] = useState<Geofence[]>([]);
  const [priceInput, setPriceInput] = useState(
    initialData?.price ? formatCurrency(initialData.price) : 'Rs. 0'
  );
  const [gettingLocation, setGettingLocation] = useState(false);
  const [locationMethods, setLocationMethods] = useState<('geofence' | 'coordinates')[]>([]);
  const [showMapPicker, setShowMapPicker] = useState(false);
  const [activeLocationIndex, setActiveLocationIndex] = useState<number | null>(null);

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
      locations: [],
      ...initialData,
    },
  });

  const locationRequired = watch('location_required');
  const locations = watch('locations') || [];

  useEffect(() => {
    fetchEmployees();
    fetchGeofences();
    if (initialData?.price) {
      setPriceInput(formatCurrency(initialData.price));
    }
    // Initialize locations from task_locations if editing
    if (isEdit && initialData?.id) {
      fetchTaskLocations(initialData.id);
    }
  }, [initialData]);

  const fetchTaskLocations = async (taskId: string) => {
    const { data, error } = await supabase.rpc('get_task_locations', { p_task_id: taskId });
    if (error) {
      console.error('Error fetching task locations:', error);
      return;
    }
    if (data) {
      setValue('locations', data);
      setLocationMethods(data.map((loc: { geofence_id: string | null }) => loc.geofence_id ? 'geofence' : 'coordinates'));
    }
  };

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

  const handleMapLocationSelect = (location: { lat: number; lng: number }) => {
    if (activeLocationIndex !== null) {
      const newLocations = [...locations];
      newLocations[activeLocationIndex] = {
        ...newLocations[activeLocationIndex],
        geofence_id: null, // Clear geofence when coordinates are selected
        latitude: location.lat,
        longitude: location.lng,
        radius_meters: newLocations[activeLocationIndex].radius_meters || 100,
        arrival_required: newLocations[activeLocationIndex].arrival_required || false,
        departure_required: newLocations[activeLocationIndex].departure_required || false,
      };
      setValue('locations', newLocations);
      setLocationMethods(methods => {
        const newMethods = [...methods];
        newMethods[activeLocationIndex] = 'coordinates';
        return newMethods;
      });
      // Hide map picker after location is selected
      setShowMapPicker(false);
    }
  };

  const handleGeofenceChange = (index: number, geofenceId: string) => {
    const newLocations = [...locations];
    if (geofenceId) {
      const geofence = geofences.find(g => g.id === geofenceId);
      if (geofence) {
        newLocations[index] = {
          ...newLocations[index],
          geofence_id: geofenceId,
          latitude: null,
          longitude: null,
          radius_meters: geofence.radius_meters,
        };
      }
    } else {
      newLocations[index] = {
        ...newLocations[index],
        geofence_id: null,
        radius_meters: 100,
      };
    }
    setValue('locations', newLocations);
    setLocationMethods(methods => {
      const newMethods = [...methods];
      newMethods[index] = 'geofence';
      return newMethods;
    });
  };

  const addLocation = () => {
    const newLocations = [...locations, {
      geofence_id: null,
      latitude: null,
      longitude: null,
      radius_meters: 100,
      arrival_required: true,
      departure_required: false,
    }];
    setValue('locations', newLocations);
    setLocationMethods([...locationMethods, 'coordinates']);
    // Automatically show map picker for the new location
    setActiveLocationIndex(locations.length);
    setShowMapPicker(true);
  };

  const removeLocation = (index: number) => {
    const newLocations = locations.filter((_, i) => i !== index);
    setValue('locations', newLocations);
    setLocationMethods(locationMethods.filter((_, i) => i !== index));
    if (activeLocationIndex === index) {
      setActiveLocationIndex(null);
      setShowMapPicker(false);
    }
  };

  const toggleLocationMethod = (index: number) => {
    const newMethods = [...locationMethods];
    newMethods[index] = newMethods[index] === 'geofence' ? 'coordinates' : 'geofence';
    setLocationMethods(newMethods);

    // Clear location data when switching methods
    const newLocations = [...locations];
    newLocations[index] = {
      ...newLocations[index],
      geofence_id: null,
      latitude: null,
      longitude: null,
      radius_meters: 100,
    };
    setValue('locations', newLocations);
    
    // If switching to coordinates, show map picker
    if (newMethods[index] === 'coordinates') {
      setActiveLocationIndex(index);
      setShowMapPicker(true);
    }
  };

  const handleFormSubmit = async (data: FormInputs) => {
    try {
      // Validate locations if required
      if (data.location_required && (!data.locations || data.locations.length === 0)) {
        throw new Error('At least one location is required');
      }

      if (data.location_required) {
        const invalidLocations = data.locations.filter(loc => {
          const hasGeofence = loc.geofence_id !== null;
          const hasCoordinates = loc.latitude !== null && loc.longitude !== null;
          return !hasGeofence && !hasCoordinates;
        });

        if (invalidLocations.length > 0) {
          throw new Error('Each location must have either a geofence or valid coordinates');
        }
      }

      const formattedData = {
        ...data,
        price: parseCurrencyInput(priceInput),
        locations: data.locations.map(loc => ({
          ...loc,
          radius_meters: loc.radius_meters || 100,
          arrival_required: loc.arrival_required || false,
          departure_required: loc.departure_required || false
        }))
      };

      onSubmit(formattedData);
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-6">
      {/* Basic Task Information */}
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
          Require employees to be at specific locations to work on this task
        </p>

        {locationRequired && (
          <div className="mt-4 space-y-4">
            {/* Map Picker */}
            {showMapPicker && (
              <div className="mb-4">
                <MapLocationPicker
                  onLocationSelect={handleMapLocationSelect}
                  existingLocations={locations
                    .filter(loc => typeof loc.latitude === 'number' && typeof loc.longitude === 'number')
                    .map(loc => ({
                      latitude: loc.latitude as number,
                      longitude: loc.longitude as number
                    }))
                  }
                  initialCenter={
                    activeLocationIndex !== null && locations[activeLocationIndex]?.latitude
                      ? {
                          lat: locations[activeLocationIndex].latitude!,
                          lng: locations[activeLocationIndex].longitude!,
                        }
                      : undefined
                  }
                />
              </div>
            )}

            {locations.map((location, index) => (
              <div key={index} className="p-4 bg-gray-50 rounded-lg space-y-4">
                <div className="flex justify-between items-center">
                  <h4 className="text-sm font-medium text-gray-900">Location {index + 1}</h4>
                  <div className="flex space-x-2">
                    {locationMethods[index] === 'coordinates' && (
                      <button
                        type="button"
                        onClick={() => {
                          setActiveLocationIndex(index);
                          setShowMapPicker(true);
                        }}
                        className="text-indigo-600 hover:text-indigo-800"
                        title="Open map picker"
                        aria-label="Open map picker for location"
                      >
                        <MapIcon className="h-5 w-5" />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => removeLocation(index)}
                      className="text-red-600 hover:text-red-800"
                      title="Remove location"
                      aria-label="Remove this location"
                    >
                      <TrashIcon className="h-5 w-5" />
                    </button>
                  </div>
                </div>

                <div>
                  <fieldset 
                    aria-label={`Location method selection for location ${index + 1}`}
                    title={`Location method selection for location ${index + 1}`}
                    role="group"
                  >
                    <legend 
                      id={`location_method_label_${index}`} 
                      className="block text-sm font-medium text-gray-700"
                      title="Location method selection"
                    >
                      Location Method
                    </legend>
                    <div 
                    className="mt-2 space-y-2" 
                    role="radiogroup" 
                    aria-label="Choose location method"
                    aria-labelledby={`location_method_label_${index}`}
                    title="Location method options"
                    id={`location_method_group_${index}`}
                    tabIndex={0}
                    aria-required="true"
                    aria-describedby={`location_method_description_${index}`}
                    data-testid={`location-method-group-${index}`}
                    aria-controls={`location_method_options_${index}`}
                    aria-expanded="true"
                    aria-orientation="vertical"
                    aria-atomic="true"
                    aria-live="polite"
                    aria-relevant="all"
                    data-selected={locationMethods[index] === 'geofence'}
                    data-form-group="location-method"
                  >
                    <div className="flex items-center">
                      <input
                        type="radio"
                        id={`use_geofence_${index}`}
                        name={`location_method_${index}`}
                        title="Use geofence"
                        aria-label={`Use geofence for location ${index + 1}`}
                        aria-labelledby={`geofence_label_${index}`}
                        checked={locationMethods[index] === 'geofence'}
                        onChange={() => toggleLocationMethod(index)}
                        className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300"
                        placeholder="Use geofence"
                      />
                      <label id={`geofence_label_${index}`} htmlFor={`use_geofence_${index}`} className="ml-2 block text-sm text-gray-700">
                        Use existing geofence
                      </label>
                    </div>
                    <div className="flex items-center">
                      <input
                        type="radio"
                        id={`use_coordinates_${index}`}
                        name={`location_method_${index}`}
                        title="Use coordinates"
                        aria-label={`Use coordinates for location ${index + 1}`}
                        aria-labelledby={`coordinates_label_${index}`}
                        checked={locationMethods[index] === 'coordinates'}
                        onChange={() => toggleLocationMethod(index)}
                        className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300"
                        placeholder="Use coordinates"
                      />
                      <label id={`coordinates_label_${index}`} htmlFor={`use_coordinates_${index}`} className="ml-2 block text-sm text-gray-700">
                        Use specific coordinates
                      </label>
                    </div>
                  </div>
                  </fieldset>
                </div>

                {locationMethods[index] === 'geofence' ? (
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Select Geofence
                    </label>
                    <select
                      id={`geofence_${index}`}
                      title="Select geofence"
                      aria-label="Select geofence"
                      value={location.geofence_id || ''}
                      onChange={(e) => handleGeofenceChange(index, e.target.value)}
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
                        value={location.latitude || ''}
                        onChange={(e) => {
                          const newLocations = [...locations];
                          newLocations[index] = {
                            ...newLocations[index],
                            latitude: parseFloat(e.target.value),
                          };
                          setValue('locations', newLocations);
                        }}
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
                        value={location.longitude || ''}
                        onChange={(e) => {
                          const newLocations = [...locations];
                          newLocations[index] = {
                            ...newLocations[index],
                            longitude: parseFloat(e.target.value),
                          };
                          setValue('locations', newLocations);
                        }}
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
                        title="Radius in meters (10-1000)"
                        placeholder="Enter radius"
                        value={location.radius_meters}
                        onChange={(e) => {
                          const newLocations = [...locations];
                          newLocations[index] = {
                            ...newLocations[index],
                            radius_meters: parseInt(e.target.value),
                          };
                          setValue('locations', newLocations);
                        }}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                      />
                    </div>
                  </div>
                )}

                <div className="flex items-center space-x-6">
                  <div className="flex items-center">
                                          <input
                        type="checkbox"
                        id={`arrival_required_${index}`}
                        title="Auto check-in"
                        checked={location.arrival_required}
                        onChange={(e) => {
                          const newLocations = [...locations];
                          newLocations[index] = {
                            ...newLocations[index],
                            arrival_required: e.target.checked,
                          };
                          setValue('locations', newLocations);
                        }}
                        className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                      />
                    <label className="ml-2 block text-sm text-gray-700">
                      Auto check-in when employee arrives
                    </label>
                  </div>
                  <div className="flex items-center">
                                          <input
                        type="checkbox"
                        id={`departure_required_${index}`}
                        title="Auto check-out"
                        checked={location.departure_required}
                        onChange={(e) => {
                          const newLocations = [...locations];
                          newLocations[index] = {
                            ...newLocations[index],
                            departure_required: e.target.checked,
                          };
                          setValue('locations', newLocations);
                        }}
                        className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                      />
                    <label className="ml-2 block text-sm text-gray-700">
                      Auto check-out when employee leaves
                    </label>
                  </div>
                </div>
              </div>
            ))}

            <button
              type="button"
              onClick={addLocation}
              className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              <PlusIcon className="h-5 w-5 mr-2" />
              Add Another Location
            </button>
          </div>
        )}
      </div>

      <div className="flex justify-end">
        <button
          type="submit"
          className="inline-flex justify-center rounded-md border border-transparent bg-indigo-600 py-2 px-4 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
        >
          {isEdit ? 'Update Task' : 'Create Task'}
        </button>
      </div>
    </form>
  );
}