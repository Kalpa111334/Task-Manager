# TaskVision - Modern Task Management System

TaskVision is a full-stack task management application built with React, TypeScript, and Supabase. It features role-based authentication, real-time updates, and AI-powered task allocation.

## Features

### Authentication & Authorization
- Secure role-based login/registration (admin/employee)
- Protected route handling based on user roles
- Supabase Auth integration

### Admin Features
- Task creation with priority settings (High/Medium/Low)
- AI-powered employee task allocation
- Real-time task approval/rejection workflow
- Performance analytics and custom report generation
- Team management
- Real-time chat with employees

### Employee Features
- Personalized task board with priority visualization
- Task proof submission with image upload
- Built-in time tracker for task duration
- Productivity score gamification
- Real-time chat with admin and team members

### Real-time Features
- Live chat system between admin/employees
- Real-time task status updates
- Live activity feed with timestamps
- Instant notifications for task updates

### Analytics & Reporting
- Task completion rates
- Employee performance metrics
- Time tracking analytics
- Earnings reports

## Tech Stack

- Frontend:
  - React with TypeScript
  - Tailwind CSS for styling
  - Chart.js for analytics
  - React Router for navigation
  - React Hot Toast for notifications

- Backend:
  - Supabase for database and authentication
  - Real-time subscriptions
  - Row Level Security (RLS) policies
  - Storage for task proofs

## Getting Started

1. Clone the repository:
\`\`\`bash
git clone https://github.com/yourusername/taskvision.git
cd taskvision
\`\`\`

2. Install dependencies:
\`\`\`bash
npm install
\`\`\`

3. Create a Supabase project and get your credentials:
   - Go to https://supabase.com
   - Create a new project
   - Get your Project URL and anon key
   - Copy the SQL from `supabase/schema.sql` and run it in the Supabase SQL editor

4. Create a `.env` file in the root directory:
\`\`\`env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
\`\`\`

5. Start the development server:
\`\`\`bash
npm run dev
\`\`\`

6. Open http://localhost:5173 in your browser

## Project Structure

\`\`\`
src/
├── components/        # Reusable UI components
├── contexts/         # React contexts (auth, etc.)
├── lib/             # Utility functions and configurations
├── pages/           # Page components
│   ├── admin/       # Admin-specific pages
│   └── employee/    # Employee-specific pages
├── types/           # TypeScript type definitions
└── App.tsx          # Main application component
\`\`\`

## Contributing

1. Fork the repository
2. Create your feature branch: `git checkout -b feature/my-new-feature`
3. Commit your changes: `git commit -am 'Add some feature'`
4. Push to the branch: `git push origin feature/my-new-feature`
5. Submit a pull request

## License

This project is licensed under the MIT License - see the LICENSE file for details. 