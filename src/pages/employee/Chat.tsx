import React, { useState, useEffect, useRef } from 'react';
import Layout from '../../components/Layout';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { ChatMessage, User } from '../../types/index';
import { PaperAirplaneIcon } from '@heroicons/react/solid';
import toast from 'react-hot-toast';

export default function Chat() {
  const { user } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [users, setUsers] = useState<{ [key: string]: User }>({});
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchMessages();
    fetchUsers();
    const subscription = subscribeToMessages();
    return () => {
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  async function fetchMessages() {
    try {
      const { data, error } = await supabase
        .from('chat_messages')
        .select('*')
        .order('created_at', { ascending: true });

      if (error) throw error;
      setMessages(data || []);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching messages:', error);
      toast.error('Failed to load messages');
    }
  }

  async function fetchUsers() {
    try {
      const { data, error } = await supabase.from('users').select('*');
      if (error) throw error;

      const usersMap = (data || []).reduce((acc, user) => {
        acc[user.id] = user;
        return acc;
      }, {} as { [key: string]: User });

      setUsers(usersMap);
    } catch (error) {
      console.error('Error fetching users:', error);
      toast.error('Failed to load users');
    }
  }

  function subscribeToMessages() {
    return supabase
      .channel('chat_messages')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages',
        },
        (payload) => {
          const newMessage = payload.new as ChatMessage;
          setMessages((prev) => [...prev, newMessage]);
        }
      )
      .subscribe();
  }

  async function sendMessage(e: React.FormEvent) {
    e.preventDefault();
    if (!newMessage.trim() || !user) return;

    try {
      const { error } = await supabase.from('chat_messages').insert([
        {
          content: newMessage.trim(),
          sender_id: user.id,
        },
      ]);

      if (error) throw error;
      setNewMessage('');
    } catch (error) {
      console.error('Error sending message:', error);
      toast.error('Failed to send message');
    }
  }

  function formatMessageTime(timestamp: string) {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  return (
    <Layout>
      <div className="flex flex-col h-[calc(100vh-64px)]">
        <div className="flex-1 overflow-hidden">
          <div className="h-full flex flex-col bg-white shadow-xl rounded-lg">
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {loading ? (
                <div className="flex justify-center items-center h-full">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-pink-500"></div>
                </div>
              ) : messages.length === 0 ? (
                <div className="flex justify-center items-center h-full text-gray-500">
                  No messages yet
                </div>
              ) : (
                messages.map((message) => {
                  const isCurrentUser = message.sender_id === user?.id;
                  const sender = users[message.sender_id];
                  return (
                    <div
                      key={message.id}
                      className={`flex ${isCurrentUser ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`flex items-end space-x-2 max-w-[75%] ${
                          isCurrentUser ? 'flex-row-reverse space-x-reverse' : ''
                        }`}
                      >
                        <img
                          src={sender?.avatar_url || `https://ui-avatars.com/api/?name=${sender?.full_name || 'User'}`}
                          alt={sender?.full_name || 'User'}
                          className="h-8 w-8 rounded-full"
                        />
                        <div
                          className={`rounded-lg px-4 py-2 ${
                            isCurrentUser
                              ? 'bg-pink-500 text-white'
                              : 'bg-gray-100 text-gray-900'
                          }`}
                        >
                          <div className="text-sm">
                            <span className="font-medium">
                              {sender?.full_name || 'Unknown User'}
                            </span>
                            <span className="ml-2 text-xs opacity-75">
                              {formatMessageTime(message.created_at)}
                            </span>
                          </div>
                          <p className="mt-1">{message.content}</p>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            <div className="p-4 border-t">
              <form onSubmit={sendMessage} className="flex space-x-4">
                <input
                  type="text"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="Type your message..."
                  className="flex-1 rounded-lg border-gray-300 focus:border-pink-500 focus:ring-pink-500"
                />
                <button
                  type="submit"
                  title="Send message"
                  disabled={!newMessage.trim()}
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-pink-600 hover:bg-pink-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-pink-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <PaperAirplaneIcon className="h-5 w-5 rotate-90" />
                </button>
              </form>
        </div>
          </div>
        </div>
      </div>
    </Layout>
  );
} 