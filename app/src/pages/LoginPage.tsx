import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Car, AlertCircle } from 'lucide-react';
import { useDataStore } from '../store/dataStore';

// Demo login for development - in production this would use Firebase Auth
const DEMO_USERS = [
  { email: 'junnosuke.honda@lightsign.jp', name: 'JUNOS（管理者）' },
  { email: 'staff1@coplus-step.jp', name: 'スタッフ1' },
];

export function LoginPage() {
  const [loadingEmail, setLoadingEmail] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useDataStore();
  const navigate = useNavigate();

  const handleLogin = async (email: string, name: string) => {
    setLoadingEmail(email);
    setLoading(true);
    setError('');
    // Simulate async
    await new Promise(r => setTimeout(r, 600));
    const success = login({ email, name, isAdmin: false });
    if (success) {
      navigate('/');
    } else {
      setError('このメールアドレスはアクセスが許可されていません。管理者にお問い合わせください。');
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 via-white to-blue-50 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex w-16 h-16 rounded-2xl bg-pink-500 items-center justify-center shadow-lg mb-4">
            <Car size={32} className="text-white" />
          </div>
          <h1 className="text-xl font-bold text-gray-900">コプラスステップ</h1>
          <p className="text-sm text-gray-500 mt-1">送迎表管理システム</p>
        </div>

        {/* Login Card */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6">
          <p className="text-sm text-gray-600 mb-4 text-center">
            Googleアカウントでログインしてください
          </p>

          {error && (
            <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg mb-4 text-sm text-red-700">
              <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
              <p>{error}</p>
            </div>
          )}

          {/* Demo login buttons */}
          <div className="space-y-3">
            {DEMO_USERS.map(user => (
              <button
                key={user.email}
                onClick={() => handleLogin(user.email, user.name)}
                disabled={loading}
                className="w-full flex items-center gap-3 p-3 border border-gray-200 rounded-xl hover:bg-gray-50 hover:border-gray-300 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed group"
              >
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-pink-400 to-blue-500 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                  {user.name[0]}
                </div>
                <div className="text-left flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{user.name}</p>
                  <p className="text-xs text-gray-400 truncate">{user.email}</p>
                </div>
                {loading && loadingEmail === user.email && (
                  <div className="w-4 h-4 border-2 border-pink-400 border-t-transparent rounded-full animate-spin" />
                )}
              </button>
            ))}
          </div>

          <div className="mt-4 pt-4 border-t border-gray-100">
            <p className="text-xs text-gray-400 text-center">
              ※ 現在はデモモードです。本番環境ではGoogle OAuth認証が使用されます。
            </p>
          </div>
        </div>

        <p className="text-xs text-gray-400 text-center mt-6">
          コプラスステップ 昭和島教室
        </p>
      </div>
    </div>
  );
}
