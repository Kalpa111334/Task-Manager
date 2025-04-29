import { supabase } from './supabase';

export async function testConnection() {
  try {
    const { data, error } = await supabase.from('users').select('count').single();
    
    if (error) {
      console.error('Connection error:', error.message);
      return false;
    }
    
    console.log('Successfully connected to Supabase!');
    return true;
  } catch (err) {
    console.error('Unexpected error:', err);
    return false;
  }
} 