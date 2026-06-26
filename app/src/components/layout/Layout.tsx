import { Outlet, Navigate } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { useDataStore } from '../../store/dataStore';

export function Layout() {
  const { currentUser } = useDataStore();

  if (!currentUser) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="min-h-screen bg-gray-50 flex">
      <Sidebar />
      <main className="flex-1 min-w-0 ml-16">
        <div className="p-6">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
