import React from 'react';
import Layout from '../../components/Layout';
import LocationTaskInterface from '../../components/employee/LocationTaskInterface';

export default function LocationTasks() {
  return (
    <Layout>
      <div className="py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900">Location-Based Tasks</h1>
            <p className="mt-2 text-gray-600">
              Manage your location-based tasks and check-in/check-out functionality
            </p>
          </div>

          <LocationTaskInterface />
        </div>
      </div>
    </Layout>
  );
}