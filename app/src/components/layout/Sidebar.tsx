import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Calendar, CalendarDays, Map, Users,
  UserCog, LogOut, ShieldCheck, Car
} from 'lucide-react';
import { useDataStore } from '../../store/dataStore';

const NAV_ITEMS = [
  { to: '/', icon: LayoutDashboard, label: 'ダッシュボード', exact: true },
  { to: '/daily', icon: Calendar, label: '週次送迎表' },
  { to: '/monthly', icon: CalendarDays, label: '月別シフト' },
  { to: '/routes', icon: Map, label: 'ルートマスタ' },
  { to: '/members', icon: Users, label: '利用者マスタ' },
  { to: '/staff', icon: UserCog, label: 'スタッフ・車両' },
];

export function Sidebar() {
  const { currentUser, logout } = useDataStore();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <aside className="sidebar fixed left-0 top-0 h-full w-16 bg-white border-r border-gray-200 shadow-sm flex flex-col z-30">
      {/* Logo */}
      <div className="flex items-center justify-center py-4 border-b border-gray-100 min-h-[64px]">
        <div className="w-8 h-8 rounded-lg bg-pink-500 flex items-center justify-center flex-shrink-0">
          <Car size={16} className="text-white" />
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 py-2">
        {NAV_ITEMS.map(({ to, icon: Icon, label, exact }) => (
          <div key={to} className="relative group mx-1 my-0.5">
            <NavLink
              to={to}
              end={exact}
              className={({ isActive }) =>
                `flex items-center justify-center w-full py-2.5 rounded-lg transition-colors cursor-pointer ${
                  isActive
                    ? 'bg-pink-50 text-pink-700'
                    : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'
                }`
              }
            >
              <Icon size={20} />
            </NavLink>
            {/* Tooltip */}
            <div className="pointer-events-none absolute left-full top-1/2 -translate-y-1/2 ml-3 px-2.5 py-1.5 bg-gray-800 text-white text-xs font-medium rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-150 z-50">
              {label}
              <div className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-gray-800" />
            </div>
          </div>
        ))}

        {currentUser?.isAdmin && (
          <div className="relative group mx-1 my-0.5">
            <NavLink
              to="/admin"
              className={({ isActive }) =>
                `flex items-center justify-center w-full py-2.5 rounded-lg transition-colors cursor-pointer ${
                  isActive
                    ? 'bg-purple-50 text-purple-700'
                    : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'
                }`
              }
            >
              <ShieldCheck size={20} />
            </NavLink>
            <div className="pointer-events-none absolute left-full top-1/2 -translate-y-1/2 ml-3 px-2.5 py-1.5 bg-gray-800 text-white text-xs font-medium rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-150 z-50">
              管理者設定
              <div className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-gray-800" />
            </div>
          </div>
        )}
      </nav>

      {/* Logout */}
      <div className="border-t border-gray-100 p-2">
        <div className="relative group">
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center py-2.5 rounded-lg text-gray-500 hover:bg-red-50 hover:text-red-600 transition-colors cursor-pointer"
          >
            <LogOut size={20} />
          </button>
          <div className="pointer-events-none absolute left-full top-1/2 -translate-y-1/2 ml-3 px-2.5 py-1.5 bg-gray-800 text-white text-xs font-medium rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-150 z-50">
            ログアウト
            <div className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-gray-800" />
          </div>
        </div>
      </div>
    </aside>
  );
}
