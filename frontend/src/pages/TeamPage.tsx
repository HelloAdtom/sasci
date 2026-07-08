import { Fragment, useEffect, useState } from 'react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import EmptyState from '../components/EmptyState';

interface TeamMember {
  id: string;
  employeeCode: string;
  name: string;
  email: string;
  status: string;
}

interface WorkItemSummary {
  id: string;
  workCode: string;
  workName: string;
  status: string;
  projectName: string;
  schemeName: string;
  progressPercent: number;
}

interface Profile {
  user: TeamMember;
  assignedProjects: string[];
  assignedWorkItems: WorkItemSummary[];
  currentTasks: WorkItemSummary[];
  completedTasks: WorkItemSummary[];
  averageProgress: number;
}

export default function TeamPage() {
  const { user } = useAuth();
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [profileId, setProfileId] = useState<string | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [form, setForm] = useState({ employeeCode: '', name: '', email: '' });
  const [editForm, setEditForm] = useState({ name: '', status: 'active' });

  const load = () => api<TeamMember[]>('/users').then((d) => { setTeam(d); setLoaded(true); }).catch(console.error);
  useEffect(() => { load(); }, []);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      // This page always creates Field Officers under the acting user's own
      // department — send both explicitly rather than relying on the backend's
      // DEPARTMENT_OFFICER-only auto-fill, since any role can hit this now.
      await api('/users', {
        method: 'POST',
        body: JSON.stringify({ ...form, role: 'FIELD_OFFICER', departmentId: user?.departmentId }),
      });
      setSuccess('Team member created — password123 / OTP 123456');
      setShowForm(false);
      setForm({ employeeCode: '', name: '', email: '' });
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
    }
  };

  const startEdit = (m: TeamMember) => {
    setEditingId(m.id);
    setEditForm({ name: m.name, status: m.status });
  };

  const saveEdit = async (id: string) => {
    setError('');
    try {
      await api(`/users/${id}`, { method: 'PATCH', body: JSON.stringify(editForm) });
      setEditingId(null);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Update failed');
    }
  };

  const remove = async (m: TeamMember) => {
    setError('');
    setSuccess('');
    try {
      const result = await api<{ deleted: boolean; message?: string }>(`/users/${m.id}`, { method: 'DELETE' });
      setSuccess(result.deleted ? `${m.name} removed` : result.message || `${m.name} deactivated`);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
    }
  };

  const viewProfile = async (id: string) => {
    if (profileId === id) {
      setProfileId(null);
      setProfile(null);
      return;
    }
    setProfileId(id);
    const data = await api<Profile>(`/users/${id}/profile`).catch(() => null);
    setProfile(data);
  };

  return (
    <>
      <h1 className="page-title">My Team</h1>
      <p className="page-subtitle">Department staff, their assignments, and current workload</p>
      {error && <div className="alert error">{error}</div>}
      {success && <div className="alert success">{success}</div>}

      <div style={{ marginBottom: 16 }}>
        <button className="btn btn-primary" onClick={() => setShowForm(!showForm)}>
          {showForm ? 'Cancel' : '+ Add Team Member'}
        </button>
      </div>

      {showForm && (
        <div className="card">
          <div className="card-title">New Department User</div>
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
            <div className="form-group full">
              <button type="submit" className="btn btn-gold">Create (password123 / OTP 123456)</button>
            </div>
          </form>
        </div>
      )}

      <div className="card">
        {loaded && team.length === 0 ? (
          <EmptyState title="No team members yet" message="Add one above — they'll be assignable to work items right away." />
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Code</th>
                <th>Name</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {team.map((m) => (
                <Fragment key={m.id}>
                  <tr>
                    <td className="mono">{m.employeeCode}</td>
                    <td>{editingId === m.id ? <input value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} /> : m.name}</td>
                    <td>
                      {editingId === m.id ? (
                        <select value={editForm.status} onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}>
                          <option value="active">Active</option>
                          <option value="inactive">Inactive</option>
                        </select>
                      ) : (
                        <span className={`pill ${m.status === 'active' ? 'green' : 'red'}`}>{m.status}</span>
                      )}
                    </td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      {editingId === m.id ? (
                        <>
                          <button className="btn btn-gold" style={{ marginRight: 6 }} onClick={() => saveEdit(m.id)}>Save</button>
                          <button className="btn btn-outline" onClick={() => setEditingId(null)}>Cancel</button>
                        </>
                      ) : (
                        <>
                          <button className="btn btn-outline" style={{ marginRight: 6 }} onClick={() => viewProfile(m.id)}>
                            {profileId === m.id ? 'Hide Profile' : 'View Profile'}
                          </button>
                          <button className="btn btn-outline" style={{ marginRight: 6 }} onClick={() => startEdit(m)}>Edit</button>
                          <button className="btn btn-danger" onClick={() => remove(m)}>Delete</button>
                        </>
                      )}
                    </td>
                  </tr>
                  {profileId === m.id && (
                    <tr>
                      <td colSpan={4} style={{ background: 'var(--form-bg)' }}>
                        {!profile ? (
                          <p className="mono" style={{ padding: '8px 0' }}>Loading…</p>
                        ) : (
                          <div style={{ padding: '12px 0' }}>
                            <div className="kpi-grid" style={{ marginBottom: 12 }}>
                              <div className="kpi-card">
                                <div className="kpi-label">Assigned Projects</div>
                                <div className="kpi-value" style={{ fontSize: '1.2rem' }}>{profile.assignedProjects.length}</div>
                              </div>
                              <div className="kpi-card">
                                <div className="kpi-label">Assigned Work Items</div>
                                <div className="kpi-value" style={{ fontSize: '1.2rem' }}>{profile.assignedWorkItems.length}</div>
                              </div>
                              <div className="kpi-card amber">
                                <div className="kpi-label">Current Tasks</div>
                                <div className="kpi-value" style={{ fontSize: '1.2rem' }}>{profile.currentTasks.length}</div>
                              </div>
                              <div className="kpi-card green">
                                <div className="kpi-label">Completed Tasks</div>
                                <div className="kpi-value" style={{ fontSize: '1.2rem' }}>{profile.completedTasks.length}</div>
                              </div>
                              <div className="kpi-card">
                                <div className="kpi-label">Avg. Progress</div>
                                <div className="kpi-value" style={{ fontSize: '1.2rem' }}>{profile.averageProgress}%</div>
                              </div>
                            </div>
                            {profile.assignedWorkItems.length === 0 ? (
                              <EmptyState title="No assignments yet" icon="○" />
                            ) : (
                              <table className="data-table">
                                <thead>
                                  <tr><th>Work Item</th><th>Project</th><th>Scheme</th><th>Status</th><th>Progress</th></tr>
                                </thead>
                                <tbody>
                                  {profile.assignedWorkItems.map((w) => (
                                    <tr key={w.id}>
                                      <td className="mono">{w.workCode}<div style={{ fontFamily: 'var(--font-sans)' }}>{w.workName}</div></td>
                                      <td>{w.projectName}</td>
                                      <td>{w.schemeName}</td>
                                      <td><span className="pill blue">{w.status.replace(/_/g, ' ')}</span></td>
                                      <td>{w.progressPercent}%</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
