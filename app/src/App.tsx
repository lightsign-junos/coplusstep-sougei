import { useEffect } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Layout } from './components/layout/Layout';
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
import { setupGasSync } from './lib/gasSync';

setupGasSync();

export default function App() {
  const initFromGAS = useDataStore(s => s.initFromGAS);

  useEffect(() => {
    initFromGAS();
  }, []);

  return (
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
  );
}
