import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { ShieldCheck, Plus, Trash2, Crown, Pencil, Check, X } from 'lucide-react';
import { useDataStore } from '../store/dataStore';

export function AdminPage() {
  const { currentUser, allowedUsers, addAllowedUser, updateAllowedUser, removeAllowedUser } = useDataStore();
  const [newEmail, setNewEmail] = useState('');
  const [newName, setNewName] = useState('');
  const [newIsAdmin, setNewIsAdmin] = useState(false);
  const [error, setError] = useState('');
  // ドライブへの書き込み中はボタンを無効化する
  const [saving, setSaving] = useState(false);
  // 表示名のインライン編集
  const [editingEmail, setEditingEmail] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

  if (!currentUser?.isAdmin) {
    return <Navigate to="/" replace />;
  }

  const SAVE_FAILED = 'ドライブへの保存に失敗しました。通信環境を確認してもう一度お試しください';

  const handleAdd = async () => {
    if (!newEmail.trim() || saving) return;
    if (allowedUsers.find(u => u.email === newEmail.trim())) {
      setError('このメールアドレスはすでに登録されています');
      return;
    }
    setSaving(true);
    setError('');
    const ok = await addAllowedUser({
      email: newEmail.trim(),
      name: newName.trim() || newEmail.trim(),
      addedAt: new Date().toISOString(),
      isAdmin: newIsAdmin,
    });
    setSaving(false);
    if (!ok) {
      setError(SAVE_FAILED);
      return;
    }
    setNewEmail('');
    setNewName('');
    setNewIsAdmin(false);
  };

  const handleToggleAdmin = async (email: string, currentIsAdmin: boolean) => {
    if (saving) return;
    setSaving(true);
    setError('');
    const ok = await updateAllowedUser(email, { isAdmin: !currentIsAdmin });
    setSaving(false);
    if (!ok) setError(SAVE_FAILED);
  };

  const handleRemove = async (email: string) => {
    if (saving) return;
    if (!confirm(`${email} を削除しますか？\nこのアドレスではログインできなくなります。`)) return;
    setSaving(true);
    setError('');
    const ok = await removeAllowedUser(email);
    setSaving(false);
    if (!ok) setError(SAVE_FAILED);
  };

  const startEditName = (email: string, name: string) => {
    setEditingEmail(email);
    setEditName(name);
  };

  const saveEditName = async () => {
    if (saving) return;
    if (editingEmail && editName.trim()) {
      setSaving(true);
      setError('');
      const ok = await updateAllowedUser(editingEmail, { name: editName.trim() });
      setSaving(false);
      if (!ok) {
        setError(SAVE_FAILED);
        return; // 編集状態を維持して再試行できるようにする
      }
    }
    setEditingEmail(null);
    setEditName('');
  };

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center">
          <ShieldCheck size={20} className="text-purple-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">管理者設定</h1>
          <p className="text-xs text-gray-500">ログイン許可アドレスの管理・権限設定</p>
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
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={newIsAdmin}
                onChange={e => setNewIsAdmin(e.target.checked)}
                className="w-4 h-4 rounded accent-purple-500 cursor-pointer"
              />
              <span className="text-sm text-gray-700">管理者権限を付与する</span>
              <span className="text-xs text-gray-400">（ユーザー追加・権限変更が可能になります）</span>
            </label>
            {error && <p className="text-xs text-red-500">{error}</p>}
            <button
              onClick={handleAdd}
              disabled={!newEmail.trim() || saving}
              className="flex items-center gap-2 px-4 py-2 bg-purple-500 text-white rounded-lg text-sm font-medium hover:bg-purple-600 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Plus size={16} /> {saving ? '保存中...' : '追加する'}
            </button>
          </div>
        </div>

        {/* User list */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-900">許可ユーザー一覧 ({allowedUsers.length}件)</h2>
            {saving && <span className="text-xs text-purple-500">ドライブに保存中...</span>}
          </div>
          {error && (
            <div className="px-6 py-2.5 bg-red-50 border-b border-red-100 text-xs text-red-600">{error}</div>
          )}
          <div className="divide-y divide-gray-100">
            {allowedUsers.map(user => {
              const isSelf = user.email === currentUser.email;
              return (
                <div key={user.email} className="flex items-center gap-3 px-6 py-3">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-100 to-pink-100 flex items-center justify-center text-xs font-bold text-purple-600 flex-shrink-0">
                    {user.name[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      {editingEmail === user.email ? (
                        <>
                          <input
                            value={editName}
                            onChange={e => setEditName(e.target.value)}
                            onKeyDown={e => {
                              if (e.key === 'Enter') saveEditName();
                              if (e.key === 'Escape') { setEditingEmail(null); setEditName(''); }
                            }}
                            autoFocus
                            className="border border-purple-300 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300 min-w-0 flex-1 max-w-[200px]"
                          />
                          <button
                            onClick={saveEditName}
                            disabled={!editName.trim() || saving}
                            className="p-1.5 text-green-600 hover:bg-green-50 rounded cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                            title="保存"
                          >
                            <Check size={14} />
                          </button>
                          <button
                            onClick={() => { setEditingEmail(null); setEditName(''); }}
                            className="p-1.5 text-gray-400 hover:bg-gray-100 rounded cursor-pointer transition-colors"
                            title="キャンセル"
                          >
                            <X size={14} />
                          </button>
                        </>
                      ) : (
                        <>
                          <p className="text-sm font-medium text-gray-900 truncate">{user.name}</p>
                          <button
                            onClick={() => startEditName(user.email, user.name)}
                            className="p-1 text-gray-300 hover:text-purple-500 hover:bg-purple-50 rounded cursor-pointer transition-colors flex-shrink-0"
                            title="表示名を変更"
                          >
                            <Pencil size={12} />
                          </button>
                          {user.isAdmin && (
                            <span className="flex items-center gap-1 text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full">
                              <Crown size={10} /> 管理者
                            </span>
                          )}
                          {isSelf && (
                            <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">自分</span>
                          )}
                        </>
                      )}
                    </div>
                    <p className="text-xs text-gray-400 truncate">{user.email}</p>
                  </div>

                  {/* Admin toggle */}
                  <button
                    onClick={() => handleToggleAdmin(user.email, user.isAdmin)}
                    disabled={isSelf || saving}
                    title={isSelf ? '自分の権限は変更できません' : user.isAdmin ? '管理者権限を解除' : '管理者権限を付与'}
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-colors disabled:opacity-30 disabled:cursor-not-allowed ${
                      user.isAdmin
                        ? 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200'
                        : 'bg-gray-100 text-gray-500 hover:bg-purple-100 hover:text-purple-700'
                    }`}
                  >
                    <Crown size={12} />
                    {user.isAdmin ? '解除' : '付与'}
                  </button>

                  <button
                    onClick={() => handleRemove(user.email)}
                    disabled={isSelf || saving}
                    className="p-1.5 text-gray-400 hover:text-red-500 cursor-pointer hover:bg-red-50 rounded disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    title={isSelf ? '自分自身は削除できません' : '削除'}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
