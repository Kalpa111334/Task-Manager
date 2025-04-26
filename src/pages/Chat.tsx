import React, { useState } from 'react';
import Layout from '../components/Layout';
import ChatList from '../components/ChatList';
import ChatWindow from '../components/ChatWindow';
import { User } from '../types/index';

export default function Chat() {
  const [selectedUser, setSelectedUser] = useState<User | null>(null);

  return (
    <Layout>
      <div className="h-[calc(100vh-64px)] flex">
        {/* Chat List Sidebar */}
        <div className="w-80 border-r bg-white">
          <div className="h-full flex flex-col">
            <div className="p-4 border-b">
              <h2 className="text-lg font-medium text-gray-900">Chats</h2>
            </div>
            <div className="flex-1 overflow-y-auto">
              <ChatList
                onSelectChat={setSelectedUser}
                selectedUserId={selectedUser?.id}
              />
            </div>
          </div>
        </div>

        {/* Chat Window */}
        <div className="flex-1 bg-white">
          {selectedUser ? (
            <div className="h-full flex flex-col">
              <div className="p-4 border-b">
                <div className="flex items-center">
                  <img
                    className="h-10 w-10 rounded-full"
                    src={selectedUser.avatar_url || `https://ui-avatars.com/api/?name=${selectedUser.full_name}`}
                    alt={selectedUser.full_name}
                  />
                  <div className="ml-3">
                    <h2 className="text-lg font-medium text-gray-900">
                      {selectedUser.full_name}
                    </h2>
                    <p className="text-sm text-gray-500 capitalize">
                      {selectedUser.role}
                    </p>
                  </div>
                </div>
              </div>
              <div className="flex-1">
                <ChatWindow chatPartner={selectedUser} />
              </div>
            </div>
          ) : (
            <div className="h-full flex items-center justify-center text-gray-500">
              Select a chat to start messaging
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
} 