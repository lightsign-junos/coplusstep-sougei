import { useState } from 'react';
import { Outlet, Navigate } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { useDataStore } from '../../store/dataStore';

export function Layout() {
  const [collapsed, setCollapsed] = useState(false);
  const { currentUser } = useDataStore();

  if (!currentUser) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="min-h-screen bg-gray-50 flex">
      <Sidebar collapsed={collapsed} onToggle={() => setCollapsed(c => !c)} />
      <main
        className={`flex-1 min-w-0 transition-all duration-300 ${collapsed ? 'ml-16' : 'ml-56'}`}
      >
        <div className="p-6 max-w-[1400px]">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
