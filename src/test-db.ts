import { testConnection } from './lib/test-connection';

testConnection().then((success) => {
  if (!success) {
    console.error('Failed to connect to Supabase');
    process.exit(1);
  }
}); 