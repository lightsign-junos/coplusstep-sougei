import { NavLink, useNavigate } from 'react-router-dom';
import {
  Calendar, LayoutDashboard, Users,
  UserCog, LogOut, ShieldCheck, Car, CalendarDays
} from 'lucide-react';
import { useDataStore } from '../../store/dataStore';

const NAV_ITEMS = [
  { to: '/', icon: Calendar, label: '送迎表作成', exact: true },
  { to: '/dashboard', icon: LayoutDashboard, label: '当日確認' },
  { to: '/shift', icon: CalendarDays, label: '利用者シフト' },
];

const MASTER_ITEMS = [
  { to: '/members', icon: Users, label: '利用者' },
  { to: '/staff', icon: UserCog, label: 'スタッフ・車両' },
];

export function Sidebar() {
  const { currentUser, logout } = useDataStore();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const linkClass = (isActive: boolean) =>
    `flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors cursor-pointer w-full text-left ${
      isActive
        ? 'bg-pink-50 text-pink-700 font-semibold'
        : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'
    }`;

  return (
    <aside className="sidebar fixed left-0 top-0 h-full w-52 bg-white border-r border-gray-200 shadow-sm flex flex-col z-30">
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-4 py-4 border-b border-gray-100 min-h-[64px]">
        <div className="w-8 h-8 rounded-lg bg-pink-500 flex items-center justify-center flex-shrink-0">
          <Car size={16} className="text-white" />
        </div>
        <div>
          <p className="text-xs font-bold text-gray-800 leading-tight">コプラスステップ</p>
          <p className="text-[10px] text-gray-400 leading-tight">送迎表作成システム</p>
        </div>
      </div>

      {/* Main nav */}
      <nav className="flex-1 py-3 px-2 overflow-y-auto">
        <div className="space-y-0.5 mb-4">
          {NAV_ITEMS.map(({ to, icon: Icon, label, exact }) => (
            <NavLink
              key={to}
              to={to}
              end={exact}
              className={({ isActive }) => linkClass(isActive)}
            >
              <Icon size={18} className="flex-shrink-0" />
              <span className="text-sm">{label}</span>
            </NavLink>
          ))}
        </div>

        {/* Masters group */}
        <div className="pt-3 border-t border-gray-100">
          <p className="px-3 pb-1.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
            マスタ管理
          </p>
          <div className="space-y-0.5">
            {MASTER_ITEMS.map(({ to, icon: Icon, label }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) => linkClass(isActive)}
              >
                <Icon size={18} className="flex-shrink-0" />
                <span className="text-sm">{label}</span>
              </NavLink>
            ))}

            {currentUser?.isAdmin && (
              <NavLink
                to="/admin"
                className={({ isActive }) => linkClass(isActive)}
              >
                <ShieldCheck size={18} className="flex-shrink-0" />
                <span className="text-sm">管理者設定</span>
              </NavLink>
            )}
          </div>
        </div>
      </nav>

      {/* User + Logout */}
      <div className="border-t border-gray-100 px-2 py-3 space-y-1">
        {currentUser && (
          <p className="px-3 text-xs text-gray-400 truncate">{currentUser.name}</p>
        )}
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl w-full text-gray-500 hover:bg-red-50 hover:text-red-600 transition-colors cursor-pointer"
        >
          <LogOut size={18} className="flex-shrink-0" />
          <span className="text-sm">ログアウト</span>
        </button>
      </div>
    </aside>
  );
}
