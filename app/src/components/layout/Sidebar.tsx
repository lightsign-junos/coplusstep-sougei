import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Calendar, CalendarDays, Map, Users,
  UserCog, LogOut, ShieldCheck, ChevronLeft, ChevronRight, Car
} from 'lucide-react';
import { useDataStore } from '../../store/dataStore';

const NAV_ITEMS = [
  { to: '/', icon: LayoutDashboard, label: 'ダッシュボード', exact: true },
  { to: '/daily', icon: Calendar, label: '日別送迎表' },
  { to: '/monthly', icon: CalendarDays, label: '月別シフト' },
  { to: '/routes', icon: Map, label: 'ルートマスタ' },
  { to: '/members', icon: Users, label: '利用者マスタ' },
  { to: '/staff', icon: UserCog, label: 'スタッフ・車両' },
];

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

export function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const { currentUser, logout } = useDataStore();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <aside
      className={`sidebar fixed left-0 top-0 h-full bg-white border-r border-gray-200 shadow-sm flex flex-col transition-all duration-300 z-30 ${collapsed ? 'w-16' : 'w-56'}`}
    >
      {/* Logo */}
      <div className={`flex items-center gap-3 px-4 py-4 border-b border-gray-100 min-h-[64px] ${collapsed ? 'justify-center px-0' : ''}`}>
        <div className="w-8 h-8 rounded-lg bg-pink-500 flex items-center justify-center flex-shrink-0">
          <Car size={16} className="text-white" />
        </div>
        {!collapsed && (
          <div className="overflow-hidden">
            <p className="text-xs font-bold text-gray-900 leading-tight">コプラスステップ</p>
            <p className="text-xs text-gray-500 leading-tight">送迎管理</p>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 py-2 overflow-y-auto">
        {NAV_ITEMS.map(({ to, icon: Icon, label, exact }) => (
          <NavLink
            key={to}
            to={to}
            end={exact}
            className={({ isActive }) =>
              `flex items-center gap-3 px-4 py-2.5 mx-2 my-0.5 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
                isActive
                  ? 'bg-pink-50 text-pink-700'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              } ${collapsed ? 'justify-center px-0 mx-1' : ''}`
            }
            title={collapsed ? label : undefined}
          >
            <Icon size={18} className="flex-shrink-0" />
            {!collapsed && <span className="truncate">{label}</span>}
          </NavLink>
        ))}

        {currentUser?.isAdmin && (
          <NavLink
            to="/admin"
            className={({ isActive }) =>
              `flex items-center gap-3 px-4 py-2.5 mx-2 my-0.5 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
                isActive
                  ? 'bg-purple-50 text-purple-700'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              } ${collapsed ? 'justify-center px-0 mx-1' : ''}`
            }
            title={collapsed ? '管理者設定' : undefined}
          >
            <ShieldCheck size={18} className="flex-shrink-0" />
            {!collapsed && <span className="truncate">管理者設定</span>}
          </NavLink>
        )}
      </nav>

      {/* User + Logout */}
      <div className="border-t border-gray-100 p-2">
        {!collapsed && currentUser && (
          <div className="px-2 py-2 mb-1">
            <p className="text-xs font-medium text-gray-800 truncate">{currentUser.name}</p>
            <p className="text-xs text-gray-400 truncate">{currentUser.email}</p>
          </div>
        )}
        <button
          onClick={handleLogout}
          className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium text-gray-600 hover:bg-red-50 hover:text-red-600 transition-colors cursor-pointer ${collapsed ? 'justify-center px-0' : ''}`}
          title={collapsed ? 'ログアウト' : undefined}
        >
          <LogOut size={18} className="flex-shrink-0" />
          {!collapsed && <span>ログアウト</span>}
        </button>
      </div>

      {/* Collapse toggle */}
      <button
        onClick={onToggle}
        className="absolute -right-3 top-20 w-6 h-6 bg-white border border-gray-200 rounded-full flex items-center justify-center shadow-sm hover:bg-gray-50 cursor-pointer z-40"
      >
        {collapsed ? <ChevronRight size={12} /> : <ChevronLeft size={12} />}
      </button>
    </aside>
  );
}
