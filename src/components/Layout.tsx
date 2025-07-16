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
  LocationMarkerIcon,
  MapIcon,
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
        { name: 'Employee Tracking', href: '/admin/tracking', icon: LocationMarkerIcon },
        { name: 'Location Management', href: '/admin/location', icon: MapIcon },
        { name: 'Reports', href: '/admin/reports', icon: DocumentReportIcon },
        { name: 'Analytics', href: '/admin/analytics', icon: ChartBarIcon },
        { name: 'Team', href: '/admin/team', icon: UserGroupIcon },
        { name: 'Chat', href: '/admin/chat', icon: ChatIcon },
      ]
    : [
        { name: 'Dashboard', href: '/employee', icon: HomeIcon },
        { name: 'My Tasks', href: '/employee/tasks', icon: ClipboardListIcon },
        { name: 'Location Tasks', href: '/employee/location-tasks', icon: LocationMarkerIcon },
        { name: 'Chat', href: '/employee/chat', icon: ChatIcon },
      ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-gray-100 to-gray-200">
      {/* Mobile header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-20 bg-indigo-800 px-3 py-2 safe-top flex items-center justify-between shadow-lg">
        <div className="flex items-center">
          <button
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="text-white p-3 -ml-2 rounded-lg hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-white touch-manipulation"
            aria-label="Toggle menu"
          >
            {isSidebarOpen ? (
              <CloseIcon className="h-6 w-6" />
            ) : (
              <MenuIcon className="h-6 w-6" />
            )}
          </button>
          <div className="flex items-center ml-2">
            <img src="/Midiz.png" alt="MIDIZ Logo" className="h-8 w-8 object-contain" />
          <h1 className="ml-2 text-lg font-bold text-white">TaskVision</h1>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={signOut}
            className="p-3 text-white hover:bg-indigo-700 rounded-lg touch-manipulation"
            aria-label="Sign out"
          >
            <LogoutIcon className="h-6 w-6" />
          </button>
          <img
            className="h-8 w-8 rounded-lg border-2 border-white"
            src={(user as User)?.avatar_url || 'https://ui-avatars.com/api/?name=' + user?.full_name}
            alt={user?.full_name}
          />
        </div>
      </div>

      {/* Sidebar */}
      <div
        className={`fixed inset-y-0 left-0 z-30 w-[280px] bg-gradient-to-b from-indigo-600 via-indigo-700 to-indigo-800 transform transition-transform duration-300 ease-in-out lg:translate-x-0 ${
          isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
        } ${isMobile ? 'shadow-xl' : ''}`}
      >
        <div className="flex flex-col h-full">
          {/* Logo - hidden on mobile */}
          <div className="hidden lg:flex items-center justify-center h-24 bg-indigo-800 bg-opacity-40">
            <div className="flex flex-col items-center">
              <img src="/Midiz.png" alt="MIDIZ Logo" className="h-12 w-12 object-contain mb-2" />
            <h1 className="text-2xl font-bold text-white">TaskVision</h1>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-3 py-6 space-y-1 mt-16 lg:mt-0 overflow-y-auto">
            {navigation.map((item) => {
              const isActive = location.pathname === item.href;
              return (
                <Link
                  key={item.name}
                  to={item.href}
                  onClick={() => isMobile && setIsSidebarOpen(false)}
                  className={`flex items-center px-4 py-3 text-base font-medium rounded-lg transition-colors duration-150 touch-manipulation ${
                    isActive
                      ? 'bg-white bg-opacity-10 text-white'
                      : 'text-indigo-100 hover:bg-white hover:bg-opacity-10'
                  }`}
                >
                  <item.icon className="w-6 h-6 mr-3 flex-shrink-0" />
                  <span className="truncate">{item.name}</span>
                </Link>
              );
            })}
          </nav>

          {/* User Profile & Logout - Desktop only */}
          <div className="hidden lg:block p-4 border-t border-indigo-500">
            <div className="flex items-center px-4 py-3 text-sm font-medium text-indigo-100">
              <div className="flex-shrink-0">
                <img
                  className="h-10 w-10 rounded-lg"
                  src={(user as User)?.avatar_url || 'https://ui-avatars.com/api/?name=' + user?.full_name}
                  alt={user?.full_name}
                />
              </div>
              <div className="ml-3 min-w-0">
                <p className="text-sm font-medium truncate">{user?.full_name}</p>
                <p className="text-xs text-indigo-300 capitalize truncate">{user?.role}</p>
              </div>
            </div>
            <button
              onClick={signOut}
              className="mt-2 flex items-center w-full px-4 py-3 text-base font-medium text-indigo-100 rounded-lg hover:bg-white hover:bg-opacity-10 transition-colors duration-150 touch-manipulation"
            >
              <LogoutIcon className="w-6 h-6 mr-3" />
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
      <div className={`lg:pl-[280px] ${isMobile ? 'pt-[60px]' : ''}`}>
        <main className="min-h-screen">
          <div className="max-w-7xl mx-auto p-3 sm:p-4 md:p-6 lg:p-8 safe-bottom">
            {/* Content area with glass effect */}
            <div className="bg-white bg-opacity-90 backdrop-filter backdrop-blur-lg rounded-lg shadow-lg p-3 sm:p-4 md:p-6">
              {children}
            </div>
            {/* Powered by MIDIZ slogan */}
            <div className="mt-4 text-center">
              <p className="text-sm text-gray-500 font-medium tracking-wider">
                POWERED BY <span className="text-indigo-600 font-bold">MIDIZ</span>
              </p>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}