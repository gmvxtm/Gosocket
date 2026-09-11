import { Navigate, Route, Routes } from 'react-router-dom';
import { AppLayout } from './layout/AppLayout';
import { RequireAuth } from './session/RequireAuth';
import { LoginPage } from './pages/LoginPage';
import { StatusPage } from './pages/StatusPage';
import { CreateRequestPage } from './pages/CreateRequestPage';
import { RequestsPage } from './pages/RequestsPage';
import { GroupsPage } from './pages/GroupsPage';

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      <Route element={<RequireAuth><AppLayout /></RequireAuth>}>
        <Route path="/status" element={<StatusPage />} />
        <Route path="/requests/new" element={<CreateRequestPage />} />
        <Route path="/requests" element={<RequestsPage />} />
        <Route path="/requests/:id" element={<RequestsPage />} />
        <Route path="/groups" element={<GroupsPage />} />
      </Route>

      <Route path="*" element={<Navigate to="/status" replace />} />
    </Routes>
  );
}
