import { Outlet, Navigate } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { useDataStore } from '../../store/dataStore';
import { Cloud, CloudOff, Loader } from 'lucide-react';

export function Layout() {
  const { currentUser, syncStatus } = useDataStore();

  if (!currentUser) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="min-h-screen bg-gray-50 flex">
      <Sidebar />
      <main className="flex-1 min-w-0 ml-52">
        <div className="p-6">
          <Outlet />
        </div>
      </main>

      {/* Sync status toast */}
      {syncStatus !== 'idle' && (
        <div className={`fixed bottom-6 right-6 flex items-center gap-2 px-4 py-2.5 rounded-xl shadow-lg text-sm font-medium transition-all z-50 ${
          syncStatus === 'saving' ? 'bg-gray-700 text-white' :
          syncStatus === 'saved'  ? 'bg-green-600 text-white' :
                                    'bg-red-500 text-white'
        }`}>
          {syncStatus === 'saving' && <Loader size={15} className="animate-spin" />}
          {syncStatus === 'saved'  && <Cloud size={15} />}
          {syncStatus === 'error'  && <CloudOff size={15} />}
          {syncStatus === 'saving' ? 'ドライブに保存中...' :
           syncStatus === 'saved'  ? 'ドライブに保存しました' :
                                     'ドライブへの保存に失敗'}
        </div>
      )}
    </div>
  );
}
