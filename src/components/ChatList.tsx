import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { User } from '../types/index';
import { useAuth } from '../contexts/AuthContext';
import { ChatIcon } from '@heroicons/react/outline';

interface ChatListProps {
  onSelectChat: (user: User) => void;
  selectedUserId?: string;
}

interface LastMessage {
  content: string;
  created_at: string;
  unread_count: number;
}

interface UserWithLastMessage extends User {
  lastMessage?: LastMessage;
}

export default function ChatList({ onSelectChat, selectedUserId }: ChatListProps) {
  const [users, setUsers] = useState<UserWithLastMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    fetchChatUsers();
    const subscription = subscribeToNewMessages();
    return () => {
      subscription.unsubscribe();
    };
  }, [user]);

  const fetchChatUsers = async () => {
    if (!user) return;

    try {
      // Fetch users
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('*')
        .in('role', user.role === 'admin' ? ['employee'] : ['admin']);

      if (userError) throw userError;

      // Fetch last messages and unread counts for each user
      const usersWithMessages = await Promise.all(
        (userData || []).map(async (chatUser) => {
          const { data: messageData } = await supabase
            .from('direct_messages')
            .select('content, created_at')
            .or(
              `and(sender_id.eq.${user.id},recipient_id.eq.${chatUser.id}),` +
              `and(sender_id.eq.${chatUser.id},recipient_id.eq.${user.id})`
            )
            .order('created_at', { ascending: false })
            .limit(1);

          const { count: unreadCount } = await supabase
            .from('direct_messages')
            .select('*', { count: 'exact', head: true })
            .eq('sender_id', chatUser.id)
            .eq('recipient_id', user.id)
            .is('read_at', null);

          return {
            ...chatUser,
            lastMessage: messageData?.[0]
              ? {
                  content: messageData[0].content,
                  created_at: messageData[0].created_at,
                  unread_count: unreadCount || 0,
                }
              : undefined,
          };
        })
      );

      setUsers(usersWithMessages);
    } catch (error) {
      console.error('Error fetching users:', error);
    } finally {
      setLoading(false);
    }
  };

  const subscribeToNewMessages = () => {
    return supabase
      .channel('direct_messages')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'direct_messages',
        },
        () => {
          fetchChatUsers(); // Refresh the list when new messages arrive
        }
      )
      .subscribe();
  };

  const formatLastMessageTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days === 0) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (days === 1) {
      return 'Yesterday';
    } else if (days < 7) {
      return date.toLocaleDateString([], { weekday: 'short' });
    } else {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-32">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500"></div>
      </div>
    );
  }

  return (
    <div className="divide-y divide-gray-200">
      {users.map((chatUser) => (
        <button
          key={chatUser.id}
          onClick={() => onSelectChat(chatUser)}
          className={`w-full px-4 py-3 flex items-center hover:bg-gray-50 transition-colors duration-150 ${
            selectedUserId === chatUser.id ? 'bg-indigo-50' : ''
          }`}
        >
          <div className="flex-shrink-0 relative">
            <img
              className="h-10 w-10 rounded-full"
              src={chatUser.avatar_url || `https://ui-avatars.com/api/?name=${chatUser.full_name}`}
              alt={chatUser.full_name}
            />
            {(chatUser.lastMessage?.unread_count ?? 0) > 0 && (
              <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-red-500 text-white text-xs flex items-center justify-center">
                {chatUser.lastMessage?.unread_count}
              </span>
            )}
          </div>
          <div className="ml-3 flex-1 text-left">
            <div className="flex justify-between items-baseline">
              <p className="text-sm font-medium text-gray-900">{chatUser.full_name}</p>
              {chatUser.lastMessage?.created_at && (
                <p className="text-xs text-gray-500">
                  {formatLastMessageTime(chatUser.lastMessage.created_at)}
                </p>
              )}
            </div>
            {chatUser.lastMessage?.content && (
              <p className="text-xs text-gray-500 truncate">
                {chatUser.lastMessage.content}
              </p>
            )}
          </div>
        </button>
      ))}
      {users.length === 0 && (
        <div className="px-4 py-8 text-center text-sm text-gray-500">
          No {user?.role === 'admin' ? 'employees' : 'admins'} available to chat with.
        </div>
      )}
    </div>
  );
} 