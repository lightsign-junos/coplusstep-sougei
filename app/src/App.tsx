import { useEffect } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Layout } from './components/layout/Layout';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import { LoginPage } from './pages/LoginPage';
import { Dashboard } from './pages/Dashboard';
import { MemberShift } from './pages/MemberShift';
import { WeeklySchedule } from './pages/WeeklySchedule';
import { MonthlySchedule } from './pages/MonthlySchedule';
import { RouteMaster } from './pages/RouteMaster';
import { MemberMaster } from './pages/MemberMaster';
import { StaffVehicleMaster } from './pages/StaffVehicleMaster';
import { AdminPage } from './pages/AdminPage';
import { useDataStore } from './store/dataStore';
// GAS自動保存は dataStore 内の subscribe に一本化（二重保存防止）

export default function App() {
  const initFromGAS = useDataStore(s => s.initFromGAS);
  const refreshFromGAS = useDataStore(s => s.refreshFromGAS);

  useEffect(() => {
    initFromGAS();
    // 他の人の変更を取り込む: タブに戻ってきたとき + 60秒ごとにドライブを再読込
    // （編集・保存中はrefreshFromGAS側でスキップされるので手元の変更は消えない）
    const onFocus = () => { refreshFromGAS(); };
    const onVisibility = () => { if (!document.hidden) refreshFromGAS(); };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibility);
    const timer = setInterval(() => { refreshFromGAS(); }, 60_000);
    return () => {
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisibility);
      clearInterval(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <ErrorBoundary>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route element={<Layout />}>
            {/* 送迎スケジュール編集がメインページ */}
            <Route path="/" element={<WeeklySchedule />} />
            {/* ダッシュボードは当日確認用サブページ */}
            <Route path="/dashboard" element={<Dashboard />} />
            {/* 利用者シフト（利用日ベースの曜日別一覧） */}
            <Route path="/shift" element={<MemberShift />} />
            {/* マスタ管理（補助機能） */}
            <Route path="/members" element={<MemberMaster />} />
            <Route path="/staff" element={<StaffVehicleMaster />} />
            <Route path="/admin" element={<AdminPage />} />
            {/* Phase 2（ナビには表示しないが URL は維持） */}
            <Route path="/monthly" element={<MonthlySchedule />} />
            <Route path="/routes" element={<RouteMaster />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </ErrorBoundary>
  );
}
