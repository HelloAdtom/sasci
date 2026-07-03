import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { api, formatCurrency } from '../api/client';
import { useAuth } from '../context/AuthContext';
import EmptyState from '../components/EmptyState';

interface DeptBalance {
  schemeId: string;
  schemeName: string;
  allocated: number;
  committed: number;
  remaining: number;
}

interface SchemeLedgerRow {
  schemeId: string;
  schemeCode: string;
  schemeName: string;
  allocated: number;
  released: number;
  departments: { departmentId: string }[];
}

interface ProjectStatusRow {
  projectId: string;
  project: string;
  scheme: string;
  status: string;
  percentComplete: number;
  departmentId: string;
}

interface Project {
  id: string;
  projectCode: string;
  projectName: string;
  approvedCost: number;
  status: string;
  active: boolean;
  costOverrun?: boolean;
  scheme: { schemeName: string };
  district: { name: string };
  vendor?: { name: string };
  departmentBalance?: { remaining: number };
}

interface Scheme {
  id: string;
  schemeName: string;
  parts: { id: string; partName: string }[];
}

interface District {
  id: string;
  name: string;
}

export default function ProjectsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [projects, setProjects] = useState<Project[]>([]);
  const [schemes, setSchemes] = useState<Scheme[]>([]);
  const [districts, setDistricts] = useState<District[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ projectName: '', approvedCost: '' });
  const [deptBalances, setDeptBalances] = useState<DeptBalance[]>([]);
  const [deptLedger, setDeptLedger] = useState<SchemeLedgerRow[]>([]);
  const [deptProjectStatus, setDeptProjectStatus] = useState<ProjectStatusRow[]>([]);
  const [form, setForm] = useState({
    projectCode: '',
    projectName: '',
    schemeId: '',
    schemePartId: '',
    districtId: '',
    approvedCost: '',
    geoLat: '19.9975',
    geoLong: '73.7898',
  });

  const load = () => api<Project[]>('/projects').then((d) => { setProjects(d); setLoaded(true); }).catch(console.error);

  useEffect(() => {
    load();
    api<Scheme[]>('/schemes').then(setSchemes).catch(console.error);
    api<{ districts: District[] }[]>('/departments/states')
      .then((states) => setDistricts(states[0]?.districts || []))
      .catch(console.error);
  }, []);

  useEffect(() => {
    if (user?.role !== 'DEPARTMENT_OFFICER' || !user.departmentId) return;
    api<{ id: string; balances: DeptBalance[] }[]>('/departments')
      .then((depts) => setDeptBalances(depts.find((d) => d.id === user.departmentId)?.balances || []))
      .catch(console.error);
    api<SchemeLedgerRow[]>('/dashboard/wallet-ledger')
      .then((ledger) => setDeptLedger(ledger.filter((l) => l.departments.some((d) => d.departmentId === user.departmentId))))
      .catch(console.error);
    api<ProjectStatusRow[]>('/reports/project-status')
      .then((rows) => setDeptProjectStatus(rows.filter((r) => r.departmentId === user.departmentId)))
      .catch(console.error);
  }, [user]);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      await api('/projects', { method: 'POST', body: JSON.stringify(form) });
      setShowForm(false);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
    }
  };

  const startEdit = (p: Project) => {
    setEditingId(p.id);
    setEditForm({ projectName: p.projectName, approvedCost: String(p.approvedCost) });
  };

  const saveEdit = async (id: string) => {
    setError('');
    try {
      await api(`/projects/${id}`, { method: 'PATCH', body: JSON.stringify(editForm) });
      setEditingId(null);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Update failed');
    }
  };

  const toggleActive = async (p: Project) => {
    setError('');
    try {
      await api(`/projects/${p.id}`, { method: 'PATCH', body: JSON.stringify({ active: !p.active }) });
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
    }
  };

  return (
    <>
      <h1 className="page-title">Project Management</h1>
      <p className="page-subtitle">Project sanction with department balance validation</p>
      {error && <div className="alert error">{error}</div>}

      {user?.role === 'DEPARTMENT_OFFICER' && (
        <>
          <div className="kpi-grid">
            {deptBalances.map((b) => (
              <div key={b.schemeId} className="kpi-card">
                <div className="kpi-label">{b.schemeName}</div>
                <div className="kpi-value">{formatCurrency(b.remaining)}</div>
                <p className="mono" style={{ fontSize: '0.7rem', color: 'var(--ink-soft)', marginTop: 4 }}>
                  remaining of {formatCurrency(b.allocated)} allocated
                </p>
              </div>
            ))}
          </div>

          <div className="two-col">
            <div className="card">
              <div className="card-title">Fund Flow — Your Schemes</div>
              {deptLedger.length === 0 ? (
                <EmptyState title="No scheme allocations yet" icon="○" />
              ) : (
                <div className="chart-wrap">
                  <ResponsiveContainer>
                    <BarChart data={deptLedger}>
                      <XAxis dataKey="schemeCode" tick={{ fontSize: 11 }} />
                      <YAxis tickFormatter={(v) => `${(v / 1e7).toFixed(0)}Cr`} />
                      <Tooltip formatter={(v: number) => formatCurrency(v)} />
                      <Legend />
                      <Bar dataKey="allocated" name="Allocated" fill="#13315c" />
                      <Bar dataKey="released" name="Released" fill="#c9a227" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
            <div className="card">
              <div className="card-title">Your Projects' Progress</div>
              {deptProjectStatus.length === 0 ? (
                <EmptyState title="No projects yet" icon="○" />
              ) : (
                <table className="data-table">
                  <thead><tr><th>Project</th><th>Status</th><th>% Complete</th></tr></thead>
                  <tbody>
                    {deptProjectStatus.map((p, i) => (
                      <tr key={i}>
                        <td><Link to={`/work?projectId=${p.projectId}`}>{p.project}</Link></td>
                        <td><span className="pill blue">{p.status.replace(/_/g, ' ')}</span></td>
                        <td>{p.percentComplete}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </>
      )}

      <div style={{ marginBottom: 16 }}>
        <button className="btn btn-primary" onClick={() => setShowForm(!showForm)}>
          {showForm ? 'Cancel' : '+ Sanction Project'}
        </button>
      </div>

      {showForm && (
        <div className="card">
          <div className="card-title">Project Sanction Form</div>
          <form className="form-grid" onSubmit={create}>
            <div className="form-group">
              <label>Project Code</label>
              <input value={form.projectCode} onChange={(e) => setForm({ ...form, projectCode: e.target.value })} required />
            </div>
            <div className="form-group">
              <label>Project Name</label>
              <input value={form.projectName} onChange={(e) => setForm({ ...form, projectName: e.target.value })} required />
            </div>
            <div className="form-group">
              <label>Scheme</label>
              <select value={form.schemeId} onChange={(e) => setForm({ ...form, schemeId: e.target.value, schemePartId: '' })} required>
                <option value="">Select…</option>
                {schemes.map((s) => (
                  <option key={s.id} value={s.id}>{s.schemeName}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>Scheme Part</label>
              <select value={form.schemePartId} onChange={(e) => setForm({ ...form, schemePartId: e.target.value })}>
                <option value="">Select…</option>
                {schemes.find((s) => s.id === form.schemeId)?.parts.map((p) => (
                  <option key={p.id} value={p.id}>{p.partName}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>District</label>
              <select value={form.districtId} onChange={(e) => setForm({ ...form, districtId: e.target.value })} required>
                <option value="">Select…</option>
                {districts.map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>Approved Cost (₹)</label>
              <input type="number" value={form.approvedCost} onChange={(e) => setForm({ ...form, approvedCost: e.target.value })} required />
            </div>
            <div className="form-group full">
              <button type="submit" className="btn btn-gold">Submit for Sanction</button>
            </div>
          </form>
        </div>
      )}

      <div className="card">
        {loaded && projects.length === 0 ? (
          <EmptyState title="No projects yet" message="Sanction a project above to see it listed here." />
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Code</th>
                <th>Name</th>
                <th>Scheme</th>
                <th>District</th>
                <th>Approved Cost</th>
                <th>Vendor</th>
                <th>Status</th>
                <th>Flag</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {projects.map((p) => (
                <tr key={p.id}>
                  <td className="mono">{p.projectCode}</td>
                  <td>{editingId === p.id ? <input value={editForm.projectName} onChange={(e) => setEditForm({ ...editForm, projectName: e.target.value })} /> : p.projectName}</td>
                  <td>{p.scheme.schemeName}</td>
                  <td>{p.district.name}</td>
                  <td>
                    {editingId === p.id ? (
                      <input type="number" value={editForm.approvedCost} onChange={(e) => setEditForm({ ...editForm, approvedCost: e.target.value })} style={{ width: 110 }} />
                    ) : (
                      formatCurrency(p.approvedCost)
                    )}
                  </td>
                  <td>{p.vendor?.name || '—'}</td>
                  <td>
                    <span className="pill blue">{p.status.replace(/_/g, ' ')}</span>
                    {!p.active && <span className="pill red" style={{ marginLeft: 4 }}>Inactive</span>}
                  </td>
                  <td>{p.costOverrun ? <span className="pill red">Overrun</span> : <span className="pill green">OK</span>}</td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    {editingId === p.id ? (
                      <>
                        <button className="btn btn-gold" style={{ marginRight: 6 }} onClick={() => saveEdit(p.id)}>Save</button>
                        <button className="btn btn-outline" onClick={() => setEditingId(null)}>Cancel</button>
                      </>
                    ) : (
                      <>
                        <button className="btn btn-outline" style={{ marginRight: 6 }} onClick={() => navigate(`/projects/${p.id}`)}>View</button>
                        <button className="btn btn-outline" style={{ marginRight: 6 }} onClick={() => startEdit(p)}>Edit</button>
                        <button className="btn btn-danger" onClick={() => toggleActive(p)}>{p.active ? 'Deactivate' : 'Reactivate'}</button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
