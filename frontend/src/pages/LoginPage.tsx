import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, setAuth } from '../api/client';
import { useAuth } from '../context/AuthContext';

export default function LoginPage() {
  const [employeeCode, setEmployeeCode] = useState('PMU-MH-00001');
  const [password, setPassword] = useState('password123');
  const [otp, setOtp] = useState('123456');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { setUser } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = await api<{ token: string; user: Record<string, unknown>; landingPage: string }>(
        '/auth/login',
        { method: 'POST', body: JSON.stringify({ employeeCode, password, otp }) }
      );
      setAuth(data.token, data.user as Parameters<typeof setAuth>[1]);
      setUser(data.user as Parameters<typeof setAuth>[1]);
      navigate(data.landingPage || '/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <h1>SASCI Portal</h1>
        <p className="subtitle">Scheme-to-Release Financial Governance Lifecycle</p>
        {error && <div className="alert error">{error}</div>}
        <form onSubmit={handleSubmit}>
          <div className="form-group" style={{ marginBottom: 16 }}>
            <label>Employee Code</label>
            <input value={employeeCode} onChange={(e) => setEmployeeCode(e.target.value)} required />
          </div>
          <div className="form-group" style={{ marginBottom: 16 }}>
            <label>Password</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>
          <div className="form-group" style={{ marginBottom: 24 }}>
            <label>OTP (2FA)</label>
            <input value={otp} onChange={(e) => setOtp(e.target.value)} placeholder="123456 for demo" required />
          </div>
          <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={loading}>
            {loading ? 'Signing in…' : 'Sign In'}
          </button>
        </form>
        <div className="demo-hint">
          <div className="demo-hint-title">Demo accounts — password123, OTP 123456</div>
          <table className="demo-hint-table">
            <tbody>
              <tr><td>State PMU Admin</td><td className="mono">PMU-MH-00001</td></tr>
              <tr><td>Department Officer</td><td className="mono">DOE-MH-04471</td></tr>
              <tr><td>Field Officer</td><td className="mono">FO-MH-10234</td></tr>
              <tr><td>Checker</td><td className="mono">CHK-MH-20001</td></tr>
              <tr><td>Finance Officer</td><td className="mono">FIN-MH-30001</td></tr>
              <tr><td>Approver</td><td className="mono">APP-MH-40001</td></tr>
              <tr><td>Auditor</td><td className="mono">AUD-MH-50001</td></tr>
              <tr><td>System Admin</td><td className="mono">ADM-MH-90001</td></tr>
            </tbody>
          </table>
          <div className="demo-hint-footer">
            Once signed in, use <strong>Switch Demo Role</strong> in the top navigation to jump between roles instantly.
          </div>
        </div>
      </div>
    </div>
  );
}
