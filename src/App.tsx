import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './contexts/AuthContext';
import SplashScreen from './components/SplashScreen';
import ErrorBoundary from './components/ErrorBoundary';
import PrivateRoute from './components/PrivateRoute';
import GoogleMapsLoader from './components/GoogleMapsLoader';
import AppRoutes from './routes.tsx';

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

  return (
    <ErrorBoundary>
      <Router>
        <AuthProvider>
          {showSplash ? (
            <SplashScreen onFinish={() => setShowSplash(false)} />
          ) : (
            <GoogleMapsLoader>
              <AppRoutes />
              <Toaster position="top-right" />
            </GoogleMapsLoader>
          )}
        </AuthProvider>
      </Router>
    </ErrorBoundary>
  );
}