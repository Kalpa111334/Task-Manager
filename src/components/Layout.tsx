import React, { ReactNode, useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Link, useLocation } from 'react-router-dom';
import { User } from '../types/index';
import {
  HomeIcon,
  ClipboardListIcon,
  ChartBarIcon,
  UserGroupIcon,
  ChatIcon,
  DocumentReportIcon,
  LogoutIcon,
  MenuIcon,
  XIcon as CloseIcon,
  ViewGridIcon,
  ViewListIcon,
  InboxIcon,
} from '@heroicons/react/outline';

interface LayoutProps {
  children: ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const { user, signOut } = useAuth();
  const location = useLocation();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 1024);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 1024);
      if (window.innerWidth >= 1024) {
        setIsSidebarOpen(false);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Close sidebar when route changes on mobile
  useEffect(() => {
    if (isMobile) {
      setIsSidebarOpen(false);
    }
  }, [location.pathname, isMobile]);

  const isAdmin = user?.role === 'admin';
  const navigation = isAdmin
    ? [
        { name: 'Dashboard', href: '/admin/dashboard', icon: ViewGridIcon },
        { name: 'Tasks', href: '/admin/tasks', icon: ViewListIcon },
        { name: 'Task Pool', href: '/admin/tasks/pool', icon: InboxIcon },
        { name: 'Reports', href: '/admin/reports', icon: DocumentReportIcon },
        { name: 'Analytics', href: '/admin/analytics', icon: ChartBarIcon },
        { name: 'Team', href: '/admin/team', icon: UserGroupIcon },
        { name: 'Chat', href: '/admin/chat', icon: ChatIcon },
      ]
    : [
        { name: 'Dashboard', href: '/employee', icon: HomeIcon },
        { name: 'My Tasks', href: '/employee/tasks', icon: ClipboardListIcon },
        { name: 'Chat', href: '/employee/chat', icon: ChatIcon },
      ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-gray-100 to-gray-200">
      {/* Mobile header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-20 bg-indigo-800 px-4 py-3 flex items-center justify-between shadow-lg">
        <div className="flex items-center">
          <button
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="text-white p-2 rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-white"
            aria-label="Toggle menu"
          >
            {isSidebarOpen ? (
              <CloseIcon className="h-6 w-6" />
            ) : (
              <MenuIcon className="h-6 w-6" />
            )}
          </button>
          <h1 className="ml-3 text-xl font-bold text-white">TaskVision</h1>
        </div>
        <div className="flex items-center">
          <img
            className="h-8 w-8 rounded-full border-2 border-white"
            src={(user as User)?.avatar_url || 'https://ui-avatars.com/api/?name=' + user?.full_name}
            alt={user?.full_name}
          />
        </div>
      </div>

      {/* Sidebar */}
      <div
        className={`fixed inset-y-0 left-0 z-30 w-64 bg-gradient-to-b from-indigo-600 via-indigo-700 to-indigo-800 transform transition-transform duration-300 ease-in-out lg:translate-x-0 ${
          isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
        } ${isMobile ? 'shadow-xl' : ''}`}
      >
        <div className="flex flex-col h-full">
          {/* Logo - hidden on mobile */}
          <div className="hidden lg:flex items-center justify-center h-16 bg-indigo-800 bg-opacity-40">
            <h1 className="text-2xl font-bold text-white">TaskVision</h1>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-4 py-6 space-y-2 mt-16 lg:mt-0 overflow-y-auto">
            {navigation.map((item) => {
              const isActive = location.pathname === item.href;
              return (
                <Link
                  key={item.name}
                  to={item.href}
                  onClick={() => isMobile && setIsSidebarOpen(false)}
                  className={`flex items-center px-4 py-3 text-sm font-medium rounded-lg transition-colors duration-150 ${
                    isActive
                      ? 'bg-white bg-opacity-10 text-white'
                      : 'text-indigo-100 hover:bg-white hover:bg-opacity-10'
                  }`}
                >
                  <item.icon className="w-5 h-5 mr-3" />
                  {item.name}
                </Link>
              );
            })}
          </nav>

          {/* User Profile & Logout */}
          <div className="p-4 border-t border-indigo-500">
            <div className="hidden lg:flex items-center px-4 py-3 text-sm font-medium text-indigo-100">
              <div className="flex-shrink-0">
                <img
                  className="h-8 w-8 rounded-full"
                  src={(user as User)?.avatar_url || 'https://ui-avatars.com/api/?name=' + user?.full_name}
                  alt={user?.full_name}
                />
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium">{user?.full_name}</p>
                <p className="text-xs text-indigo-300 capitalize">{user?.role}</p>
              </div>
            </div>
            <button
              onClick={signOut}
              className="mt-2 flex items-center w-full px-4 py-3 text-sm font-medium text-indigo-100 rounded-lg hover:bg-white hover:bg-opacity-10 transition-colors duration-150"
            >
              <LogoutIcon className="w-5 h-5 mr-3" />
              Sign Out
            </button>
          </div>
        </div>
      </div>

      {/* Overlay */}
      {isSidebarOpen && isMobile && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-20 lg:hidden transition-opacity"
          onClick={() => setIsSidebarOpen(false)}
        ></div>
      )}

      {/* Main Content */}
      <div className={`lg:pl-64 ${isMobile ? 'pt-16' : ''}`}>
        <main className="min-h-screen">
          <div className="max-w-7xl mx-auto p-4 sm:px-6 lg:px-8">
            {/* Content area with glass effect */}
            <div className="bg-white bg-opacity-90 backdrop-filter backdrop-blur-lg rounded-lg shadow-lg p-4 sm:p-6">
              {children}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
} 