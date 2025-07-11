'use client';

import { useEffect, useState, useRef } from 'react';
import { fetchMessages, sendMessage, subscribeToMessages } from '@/lib/api';
import { ChatMessage } from '@/types';
import { useSession } from '@/lib/useSession';

export default function Chat() {
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [newMessage, setNewMessage] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const { session } = useSession();

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        const loadMessages = async () => {
            const { data, error } = await fetchMessages();
            if (!error && data) {
                setMessages(data);
                scrollToBottom();
            }
        };

        loadMessages();

        // Subscribe to new messages
        const subscription = subscribeToMessages((message) => {
            setMessages((prev) => [...prev, message]);
            scrollToBottom();
        });

        return () => {
            subscription.unsubscribe();
        };
    }, []);

    const handleSendMessage = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newMessage.trim() || isLoading) return;

        setIsLoading(true);
        const { error } = await sendMessage(newMessage);
        if (!error) {
            setNewMessage('');
        }
        setIsLoading(false);
    };

    return (
        <div className="flex flex-col h-[calc(100vh-4rem)] max-w-3xl mx-auto p-4">
            <div className="flex-1 overflow-y-auto mb-4 space-y-4">
                {messages.map((message) => (
                    <div
                        key={message.id}
                        className={`flex ${
                            message.sender_id === session?.user?.id
                                ? 'justify-end'
                                : 'justify-start'
                        }`}
                    >
                        <div
                            className={`max-w-[70%] rounded-lg p-3 ${
                                message.sender_id === session?.user?.id
                                    ? 'bg-blue-500 text-white'
                                    : 'bg-gray-200'
                            }`}
                        >
                            <p className="break-words">{message.content}</p>
                            <p className="text-xs mt-1 opacity-70">
                                {new Date(message.created_at).toLocaleTimeString()}
                            </p>
                        </div>
                    </div>
                ))}
                <div ref={messagesEndRef} />
            </div>
            <form onSubmit={handleSendMessage} className="flex gap-2">
                <input
                    type="text"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder="Type a message..."
                    className="flex-1 rounded-lg border p-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    disabled={isLoading}
                />
                <button
                    type="submit"
                    disabled={isLoading}
                    className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                >
                    Send
                </button>
            </form>
        </div>
    );
} 