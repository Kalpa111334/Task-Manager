import { ChatMessage } from '@/types';

type ApiResponse<T> = {
    data?: T;
    error?: Error;
};

export async function fetchMessages(): Promise<ApiResponse<ChatMessage[]>> {
    try {
        const response = await fetch('/api/messages');
        if (!response.ok) {
            throw new Error('Failed to fetch messages');
        }
        const data = await response.json();
        return { data };
    } catch (error) {
        return { error: error as Error };
    }
}

export async function sendMessage(content: string): Promise<ApiResponse<ChatMessage>> {
    try {
        const response = await fetch('/api/messages', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ content }),
        });
        
        if (!response.ok) {
            throw new Error('Failed to send message');
        }
        
        const data = await response.json();
        return { data };
    } catch (error) {
        return { error: error as Error };
    }
}

type MessageCallback = (message: ChatMessage) => void;

export function subscribeToMessages(callback: MessageCallback) {
    // Create a WebSocket connection
    const ws = new WebSocket(process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:3001');

    ws.onmessage = (event) => {
        try {
            const message = JSON.parse(event.data) as ChatMessage;
            callback(message);
        } catch (error) {
            console.error('Error parsing WebSocket message:', error);
        }
    };

    return {
        unsubscribe: () => {
            ws.close();
        },
    };
} 