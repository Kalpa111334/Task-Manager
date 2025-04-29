import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './contexts/AuthContext';
import SplashScreen from './components/SplashScreen';
import ErrorBoundary from './components/ErrorBoundary';
import PrivateRoute from './components/PrivateRoute';

// Admin Pages
import AdminDashboard from './pages/admin/Dashboard';
import AdminTasks from './pages/admin/Tasks';
import TaskView from './pages/admin/TaskView';
import CreateTask from './pages/admin/CreateTask';
import Analytics from './pages/admin/Analytics';
import Team from './pages/admin/Team';
import Chat from './pages/Chat';
import Reports from './pages/admin/Reports';
import TaskPool from './pages/admin/TaskPool';

// Employee Pages
import EmployeeDashboard from './pages/employee/Dashboard';
import EmployeeTasks from './pages/employee/Tasks';
import EmployeeChat from './pages/employee/Chat';

// Auth Pages
import Login from './pages/Login';
import Register from './pages/Register';

export default function App() {
  const [showSplash, setShowSplash] = useState(true);

  if (showSplash) {
    return <SplashScreen onComplete={() => setShowSplash(false)} />;
  }

  return (
    <ErrorBoundary>
      <Router>
        <AuthProvider>
          <Toaster position="top-right" />
          <Routes>
            {/* Public routes */}
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />

            {/* Admin routes */}
            <Route path="/admin/*" element={
              <PrivateRoute allowedRoles={['admin']}>
                <Routes>
                  <Route path="dashboard" element={<AdminDashboard />} />
                  <Route path="tasks" element={<AdminTasks />} />
                  <Route path="tasks/pool" element={<TaskPool />} />
                  <Route path="tasks/create" element={<CreateTask />} />
                  <Route path="tasks/:taskId" element={<TaskView />} />
                  <Route path="reports" element={<Reports />} />
                  <Route path="analytics" element={<Analytics />} />
                  <Route path="team" element={<Team />} />
                  <Route path="chat" element={<Chat />} />
                  <Route index element={<Navigate to="/admin/dashboard" replace />} />
                </Routes>
              </PrivateRoute>
            } />

            {/* Employee routes */}
            <Route path="/employee/*" element={
              <PrivateRoute allowedRoles={['employee']}>
                <Routes>
                  <Route index element={<EmployeeDashboard />} />
                  <Route path="tasks" element={<EmployeeTasks />} />
                  <Route path="chat" element={<Chat />} />
                </Routes>
              </PrivateRoute>
            } />

            {/* Default redirect */}
            <Route path="/" element={<Navigate to="/login" replace />} />
          </Routes>
        </AuthProvider>
      </Router>
    </ErrorBoundary>
  );
} 