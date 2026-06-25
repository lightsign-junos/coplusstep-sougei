import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { ShieldCheck, Plus, Trash2, Crown } from 'lucide-react';
import { useDataStore } from '../store/dataStore';

export function AdminPage() {
  const { currentUser, allowedUsers, addAllowedUser, removeAllowedUser } = useDataStore();
  const [newEmail, setNewEmail] = useState('');
  const [newName, setNewName] = useState('');
  const [error, setError] = useState('');

  if (!currentUser?.isAdmin) {
    return <Navigate to="/" replace />;
  }

  const handleAdd = () => {
    if (!newEmail.trim()) return;
    if (allowedUsers.find(u => u.email === newEmail.trim())) {
      setError('このメールアドレスはすでに登録されています');
      return;
    }
    addAllowedUser({
      email: newEmail.trim(),
      name: newName.trim() || newEmail.trim(),
      addedAt: new Date().toISOString(),
      isAdmin: false,
    });
    setNewEmail('');
    setNewName('');
    setError('');
  };

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center">
          <ShieldCheck size={20} className="text-purple-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">管理者設定</h1>
          <p className="text-xs text-gray-500">ログイン許可アドレスの管理</p>
        </div>
      </div>

      <div className="max-w-2xl">
        {/* Add user */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 mb-6">
          <h2 className="text-sm font-semibold text-gray-900 mb-4">新規ユーザーを追加</h2>
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">メールアドレス *</label>
              <input
                value={newEmail}
                onChange={e => { setNewEmail(e.target.value); setError(''); }}
                type="email"
                placeholder="example@coplus-step.jp"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">表示名</label>
              <input
                value={newName}
                onChange={e => setNewName(e.target.value)}
                placeholder="例：スタッフ 花子"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300"
              />
            </div>
            {error && <p className="text-xs text-red-500">{error}</p>}
            <button
              onClick={handleAdd}
              disabled={!newEmail.trim()}
              className="flex items-center gap-2 px-4 py-2 bg-purple-500 text-white rounded-lg text-sm font-medium hover:bg-purple-600 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Plus size={16} /> 追加する
            </button>
          </div>
        </div>

        {/* User list */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="text-sm font-semibold text-gray-900">許可ユーザー一覧 ({allowedUsers.length}件)</h2>
          </div>
          <div className="divide-y divide-gray-100">
            {allowedUsers.map(user => (
              <div key={user.email} className="flex items-center gap-3 px-6 py-3">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-100 to-pink-100 flex items-center justify-center text-xs font-bold text-purple-600 flex-shrink-0">
                  {user.name[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-gray-900 truncate">{user.name}</p>
                    {user.isAdmin && (
                      <span className="flex items-center gap-1 text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full">
                        <Crown size={10} /> 管理者
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-400 truncate">{user.email}</p>
                </div>
                <button
                  onClick={() => removeAllowedUser(user.email)}
                  disabled={user.email === currentUser.email}
                  className="p-1.5 text-gray-400 hover:text-red-500 cursor-pointer hover:bg-red-50 rounded disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  title={user.email === currentUser.email ? '自分自身は削除できません' : '削除'}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
