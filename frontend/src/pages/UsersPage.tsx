import { useEffect, useState } from 'react';
import { api, ROLE_LABELS } from '../api/client';

interface UserRow {
  id: string;
  employeeCode: string;
  name: string;
  email: string;
  role: string;
  status: string;
  department?: { name: string };
}

const ROLES = Object.keys(ROLE_LABELS);

export default function UsersPage() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    employeeCode: '',
    name: '',
    email: '',
    password: 'password123',
    role: 'FIELD_OFFICER',
  });

  const load = () => api<UserRow[]>('/users').then(setUsers).catch(console.error);
  useEffect(() => { load(); }, []);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    await api('/users', { method: 'POST', body: JSON.stringify(form) });
    setShowForm(false);
    load();
  };

  return (
    <>
      <h1 className="page-title">User & Role Management</h1>
      <p className="page-subtitle">System administration — role assignment and department mapping</p>

      <div style={{ marginBottom: 16 }}>
        <button className="btn btn-primary" onClick={() => setShowForm(!showForm)}>+ Create User</button>
      </div>

      {showForm && (
        <div className="card">
          <form className="form-grid" onSubmit={create}>
            <div className="form-group">
              <label>Employee Code</label>
              <input value={form.employeeCode} onChange={(e) => setForm({ ...form, employeeCode: e.target.value })} required />
            </div>
            <div className="form-group">
              <label>Name</label>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            </div>
            <div className="form-group">
              <label>Email</label>
              <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
            </div>
            <div className="form-group">
              <label>Role</label>
              <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                {ROLES.map((r) => (
                  <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                ))}
              </select>
            </div>
            <div className="form-group full">
              <button type="submit" className="btn btn-gold">Create User</button>
            </div>
          </form>
        </div>
      )}

      <div className="card">
        <table className="data-table">
          <thead>
            <tr>
              <th>Code</th>
              <th>Name</th>
              <th>Email</th>
              <th>Role</th>
              <th>Department</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td className="mono">{u.employeeCode}</td>
                <td>{u.name}</td>
                <td>{u.email}</td>
                <td>{ROLE_LABELS[u.role] || u.role}</td>
                <td>{u.department?.name || '—'}</td>
                <td><span className={`pill ${u.status === 'active' ? 'green' : 'red'}`}>{u.status}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
