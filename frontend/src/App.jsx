import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import './index.css';
import DashboardLayout from './components/Layout/DashboardLayout';
import NotFound from './components/Layout/NotFound';
import TokenManager from './components/TokenManager/TokenManager';
import RouteManager from './components/RouteManager/RouteManager';
import Stats from './components/Stats/Stats';
import UserManagement from './components/UserManagement/UserManagement';
import SignIn from './components/Auth/SignIn';
import SignUp from './components/Auth/SignUp';
import ProtectedRoute from './components/Auth/ProtectedRoute';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* 公開路由 */}
        <Route path="/sign-in/*" element={<SignIn />} />
        <Route path="/sign-up/*" element={<SignUp />} />
        
        {/* 受保護的路由 - 使用 Layout wrapper */}
        <Route
          element={
            <ProtectedRoute>
              <DashboardLayout />
            </ProtectedRoute>
          }
        >
          {/* 預設重導向到統計頁面 */}
          <Route index element={<Navigate to="/stats" replace />} />
          
          {/* 各個功能頁面 */}
          <Route path="stats" element={<Stats />} />
          <Route path="tokens" element={<TokenManager />} />
          <Route path="routes" element={<RouteManager />} />
          <Route path="users" element={<UserManagement />} />
          
          {/* 404 頁面 */}
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
