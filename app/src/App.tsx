import { useEffect } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Layout } from './components/layout/Layout';
import { LoginPage } from './pages/LoginPage';
import { Dashboard } from './pages/Dashboard';
import { DailyRoute } from './pages/DailyRoute';
import { MonthlySchedule } from './pages/MonthlySchedule';
import { RouteMaster } from './pages/RouteMaster';
import { MemberMaster } from './pages/MemberMaster';
import { StaffVehicleMaster } from './pages/StaffVehicleMaster';
import { AdminPage } from './pages/AdminPage';
import { useDataStore } from './store/dataStore';
import { setupGasSync } from './lib/gasSync';

// Set up auto-sync subscription once at module level
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
          <Route path="/" element={<Dashboard />} />
          <Route path="/daily" element={<DailyRoute />} />
          <Route path="/monthly" element={<MonthlySchedule />} />
          <Route path="/routes" element={<RouteMaster />} />
          <Route path="/members" element={<MemberMaster />} />
          <Route path="/staff" element={<StaffVehicleMaster />} />
          <Route path="/admin" element={<AdminPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
