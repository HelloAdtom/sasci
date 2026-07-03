import { useEffect, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ROLE_LABELS, getDemoUsers, demoLogin, setAuth, DemoUser } from '../api/client';

const NAV_BY_ROLE: Record<string, { to: string; label: string }[]> = {
  STATE_PMU: [
    { to: '/dashboard', label: 'Executive Dashboard' },
    { to: '/schemes', label: 'Schemes' },
    { to: '/departments', label: 'Departments' },
    { to: '/projects', label: 'Projects' },
    { to: '/wallet', label: 'Wallet Ledger' },
    { to: '/fund-workflow', label: 'Fund Workflow' },
    { to: '/reports', label: 'Reports' },
    { to: '/audit', label: 'Audit Trail' },
  ],
  DEPARTMENT_OFFICER: [
    { to: '/projects', label: 'Projects' },
    { to: '/work', label: 'Work Items' },
    { to: '/vendors', label: 'Vendors' },
    { to: '/team', label: 'My Team' },
  ],
  FIELD_OFFICER: [
    { to: '/work', label: 'Work Management' },
    { to: '/progress', label: 'Progress Submission' },
    { to: '/fund-workflow', label: 'Fund Demands' },
  ],
  CHECKER: [{ to: '/fund-workflow', label: 'Checker Queue' }],
  FINANCE_OFFICER: [{ to: '/fund-workflow', label: 'Finance Queue' }],
  APPROVER: [{ to: '/fund-workflow', label: 'Approver Queue' }],
  AUDITOR: [
    { to: '/audit', label: 'Audit Trail' },
    { to: '/reports', label: 'Reports' },
    { to: '/wallet', label: 'Wallet Ledger' },
  ],
  SYSTEM_ADMIN: [{ to: '/users', label: 'User Management' }],
};

export default function Layout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const links = user ? NAV_BY_ROLE[user.role] || [] : [];
  const [demoUsers, setDemoUsers] = useState<DemoUser[]>([]);
  const [switching, setSwitching] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    getDemoUsers().then(setDemoUsers).catch(() => {});
  }, []);

  const switchRole = async (employeeCode: string) => {
    if (!employeeCode) return;
    setSwitching(true);
    try {
      const data = await demoLogin(employeeCode);
      setAuth(data.token, data.user);
      // Full reload (not client-side navigate) on purpose: swapping identity
      // mid-session would otherwise race with ProtectedRoute's own reactive
      // redirect (it watches user.role and can fire a competing navigation
      // while the old route is still mounted), thrashing between routes.
      // A hard navigation boots AuthContext fresh from the localStorage we
      // just wrote, so there's nothing to race.
      window.location.href = data.landingPage || '/dashboard';
    } catch {
      // demo account unavailable — silently ignore, user stays on current session
      setSwitching(false);
    }
  };

  return (
    <div className="layout">
      <nav className="topnav">
        <button
          className="menu-toggle"
          aria-label="Open navigation menu"
          onClick={() => setDrawerOpen(true)}
        >
          <span />
          <span />
          <span />
        </button>
        <div className="topnav-brand">SASCI — Fund Governance</div>
        <div className="topnav-links">
          {links.map((l) => (
            <NavLink key={l.to} to={l.to} className={({ isActive }) => (isActive ? 'active' : '')}>
              {l.label}
            </NavLink>
          ))}
        </div>
        <div className="demo-switcher">
          <label htmlFor="demo-role-select">Switch Demo Role</label>
          <select
            id="demo-role-select"
            value=""
            disabled={switching}
            onChange={(e) => switchRole(e.target.value)}
          >
            <option value="">{switching ? 'Switching…' : 'Become…'}</option>
            {demoUsers.map((d) => (
              <option key={d.employeeCode} value={d.employeeCode} disabled={d.employeeCode === user?.employeeCode}>
                {ROLE_LABELS[d.role] || d.role} — {d.name}
                {d.employeeCode === user?.employeeCode ? ' (current)' : ''}
              </option>
            ))}
          </select>
        </div>
        <div className="topnav-user">
          <span className="mono">{user?.employeeCode}</span>
          <br />
          {user && ROLE_LABELS[user.role]}
          <button onClick={() => { logout(); navigate('/login'); }}>Logout</button>
        </div>
      </nav>

      {drawerOpen && (
        <>
          <div className="nav-drawer-overlay" onClick={() => setDrawerOpen(false)} />
          <nav className="nav-drawer">
            <div className="nav-drawer-header">
              <span>Menu</span>
              <button className="nav-drawer-close" aria-label="Close navigation menu" onClick={() => setDrawerOpen(false)}>
                ×
              </button>
            </div>
            {links.map((l) => (
              <NavLink
                key={l.to}
                to={l.to}
                className={({ isActive }) => (isActive ? 'active' : '')}
                onClick={() => setDrawerOpen(false)}
              >
                {l.label}
              </NavLink>
            ))}
          </nav>
        </>
      )}

      <main className="main">{children}</main>
    </div>
  );
}
