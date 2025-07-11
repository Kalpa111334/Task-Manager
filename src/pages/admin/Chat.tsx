import React from 'react';
import Layout from '../../components/Layout';
import Chat from '../../components/Chat';

export default function AdminChat() {
  return (
    <Layout>
      <div className="py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8">
          <h1 className="text-2xl font-semibold text-gray-900">Team Chat</h1>
        </div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8">
          <div className="mt-4">
            <Chat />
          </div>
        </div>
      </div>
    </Layout>
  );
} 