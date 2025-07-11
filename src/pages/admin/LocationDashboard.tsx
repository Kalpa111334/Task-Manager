import React, { useState } from 'react';
import Layout from '../../components/Layout';
import LocationTaskDashboard from '../../components/admin/LocationTaskDashboard';
import GeofenceManager from '../../components/admin/GeofenceManager';
import { Geofence } from '../../services/GeofencingService';
import {
  MapIcon,
  CogIcon,
} from '@heroicons/react/outline';

export default function LocationDashboard() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'geofences'>('dashboard');
  const [selectedGeofence, setSelectedGeofence] = useState<Geofence | null>(null);

  const tabs = [
    {
      id: 'dashboard' as const,
      name: 'Location Dashboard',
      icon: MapIcon,
      description: 'Monitor employee locations and task progress',
    },
    {
      id: 'geofences' as const,
      name: 'Geofence Management',
      icon: CogIcon,
      description: 'Create and manage geographical boundaries',
    },
  ];

  return (
    <Layout>
      <div className="py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900">Location Management</h1>
            <p className="mt-2 text-gray-600">
              Comprehensive location-based task monitoring and geofencing system
            </p>
          </div>

          {/* Tab Navigation */}
          <div className="border-b border-gray-200 mb-8">
            <nav className="-mb-px flex space-x-8">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`group inline-flex items-center py-4 px-1 border-b-2 font-medium text-sm ${
                    activeTab === tab.id
                      ? 'border-indigo-500 text-indigo-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <tab.icon
                    className={`mr-2 h-5 w-5 ${
                      activeTab === tab.id ? 'text-indigo-500' : 'text-gray-400 group-hover:text-gray-500'
                    }`}
                  />
                  <div className="text-left">
                    <div>{tab.name}</div>
                    <div className="text-xs text-gray-500">{tab.description}</div>
                  </div>
                </button>
              ))}
            </nav>
          </div>

          {/* Tab Content */}
          <div className="mt-8">
            {activeTab === 'dashboard' && (
              <LocationTaskDashboard />
            )}
            
            {activeTab === 'geofences' && (
              <GeofenceManager
                onGeofenceSelect={setSelectedGeofence}
                selectedGeofenceId={selectedGeofence?.id}
              />
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}