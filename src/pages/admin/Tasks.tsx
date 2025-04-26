import { Link } from 'react-router-dom';
import Layout from '../../components/Layout';
import TaskList from '../../components/TaskList';
import { PlusIcon } from '@heroicons/react/outline';

export default function AdminTasks() {
  return (
    <Layout>
      <div className="py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8">
          <div className="flex justify-between items-center">
            <h1 className="text-2xl font-semibold text-gray-900">Tasks</h1>
            <Link
              to="/admin/tasks/create"
              className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              <PlusIcon className="h-5 w-5 mr-2" />
              Create Task
            </Link>
          </div>
        </div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8">
          <div className="mt-4">
            <TaskList isAdmin={true} />
          </div>
        </div>
      </div>
    </Layout>
  );
} 