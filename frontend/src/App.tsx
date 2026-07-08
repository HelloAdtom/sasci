import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import SchemesPage from './pages/SchemesPage';
import DepartmentsPage from './pages/DepartmentsPage';
import ProjectsPage from './pages/ProjectsPage';
import ProjectDetailsPage from './pages/ProjectDetailsPage';
import VendorsPage from './pages/VendorsPage';
import TeamPage from './pages/TeamPage';
import WorkPage from './pages/WorkPage';
import ProgressPage from './pages/ProgressPage';
import WalletPage from './pages/WalletPage';
import FundWorkflowPage from './pages/FundWorkflowPage';
import ReportsPage from './pages/ReportsPage';
import AuditPage from './pages/AuditPage';
import UsersPage from './pages/UsersPage';

function HomeRedirect() {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  return <Navigate to={user.landingPage || '/dashboard'} replace />;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/" element={<HomeRedirect />} />

          <Route element={<ProtectedRoute roles={['STATE_PMU', 'SYSTEM_ADMIN']} />}>
            <Route path="/dashboard" element={<DashboardPage />} />
          </Route>

          <Route element={<ProtectedRoute />}>
            <Route path="/schemes" element={<SchemesPage />} />
          </Route>

          <Route element={<ProtectedRoute />}>
            <Route path="/departments" element={<DepartmentsPage />} />
          </Route>

          <Route element={<ProtectedRoute />}>
            <Route path="/projects" element={<ProjectsPage />} />
            <Route path="/projects/:id" element={<ProjectDetailsPage />} />
          </Route>

          <Route element={<ProtectedRoute />}>
            <Route path="/vendors" element={<VendorsPage />} />
            <Route path="/team" element={<TeamPage />} />
          </Route>

          <Route element={<ProtectedRoute />}>
            <Route path="/work" element={<WorkPage />} />
          </Route>

          <Route element={<ProtectedRoute />}>
            <Route path="/progress" element={<ProgressPage />} />
          </Route>

          <Route element={<ProtectedRoute />}>
            <Route path="/wallet" element={<WalletPage />} />
          </Route>

          <Route element={<ProtectedRoute />}>
            <Route path="/fund-workflow" element={<FundWorkflowPage />} />
          </Route>

          <Route element={<ProtectedRoute />}>
            <Route path="/reports" element={<ReportsPage />} />
          </Route>

          <Route element={<ProtectedRoute roles={['AUDITOR', 'STATE_PMU', 'SYSTEM_ADMIN']} />}>
            <Route path="/audit" element={<AuditPage />} />
          </Route>

          <Route element={<ProtectedRoute />}>
            <Route path="/users" element={<UsersPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
