export interface User {
  id: string;
  email: string;
  full_name: string;
  avatar_url?: string;
  role: 'admin' | 'employee';
  skills?: string[];
  created_at: string;
}

export interface Task {
  id: string;
  title: string;
  description: string;
  status: 'Not Started' | 'In Progress' | 'Paused' | 'Completed';
  priority: 'High' | 'Medium' | 'Low';
  assigned_to?: string;
  price: number;
  due_date: string;
  created_at: string;
  started_at?: string;
  completed_at?: string;
  actual_time?: number;
  last_pause_at?: string;
  total_pause_duration?: number;
}

export interface TaskProof {
  id: string;
  task_id: string;
  image_url: string;
  description: string;
  submitted_by: string;
  created_at: string;
}

export interface ChatMessage {
  id: number;
  content: string;
  sender_id: string;
  created_at: string;
}

export interface Notification {
  id: string;
  user_id: string;
  title: string;
  message: string;
  type: 'task' | 'chat' | 'system';
  read: boolean;
  created_at: string;
}

export interface TimeLog {
  id: string;
  task_id: string;
  user_id: string;
  start_time: string;
  end_time?: string;
  duration?: number;
  created_at: string;
} 