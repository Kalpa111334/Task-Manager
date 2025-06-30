export interface User {
  id: string;
  email: string;
  full_name: string;
  avatar_url?: string;
  role: 'admin' | 'employee';
  skills?: string[];
  created_at: string;
}

export type ChatMessage = {
  id: number;
  content: string;
  sender_id: string;
  created_at: string;
}; 