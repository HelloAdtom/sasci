import { Fragment, useEffect, useState } from 'react';
import { api, formatCurrency } from '../api/client';
import EmptyState from '../components/EmptyState';

interface DeptProject {
  id: string;
  projectCode: string;
  projectName: string;
  approvedCost: number;
  status: string;
}

interface Balance {
  schemeId: string;
  schemeName: string;
  allocated: number;
  committed: number;
  remaining: number;
  projects: DeptProject[];
}

interface Dept {
  id: string;
  name: string;
  reportingStructure?: string;
  active: boolean;
  balances: Balance[];
}

export default function DepartmentsPage() {
  const [departments, setDepartments] = useState<Dept[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [form, setForm] = useState({ name: '', reportingStructure: '' });
  const [editForm, setEditForm] = useState({ name: '', reportingStructure: '' });

  const load = () => api<Dept[]>('/departments').then(setDepartments).catch(console.error);
  useEffect(() => { load(); }, []);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      await api('/departments', { method: 'POST', body: JSON.stringify(form) });
      setSuccess('Department created');
      setShowForm(false);
      setForm({ name: '', reportingStructure: '' });
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
    }
  };

  const startEdit = (d: Dept) => {
    setEditingId(d.id);
    setEditForm({ name: d.name, reportingStructure: d.reportingStructure || '' });
  };

  const saveEdit = async (id: string) => {
    setError('');
    try {
      await api(`/departments/${id}`, { method: 'PATCH', body: JSON.stringify(editForm) });
      setSuccess('Department updated');
      setEditingId(null);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Update failed');
    }
  };

  const toggleActive = async (d: Dept) => {
    setError('');
    try {
      await api(`/departments/${d.id}`, { method: 'PATCH', body: JSON.stringify({ active: !d.active }) });
      setSuccess(d.active ? 'Department deactivated' : 'Department reactivated');
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
    }
  };

  return (
    <>
      <h1 className="page-title">Department Master</h1>
      <p className="page-subtitle">Which department runs which scheme, and the projects under it</p>
      {error && <div className="alert error">{error}</div>}
      {success && <div className="alert success">{success}</div>}

      <div style={{ marginBottom: 16 }}>
        <button className="btn btn-primary" onClick={() => setShowForm(!showForm)}>
          {showForm ? 'Cancel' : '+ Create Department'}
        </button>
      </div>

      {showForm && (
        <div className="card">
          <div className="card-title">New Department</div>
          <form className="form-grid" onSubmit={create}>
            <div className="form-group">
              <label>Department Name</label>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            </div>
            <div className="form-group">
              <label>Reporting Structure</label>
              <input value={form.reportingStructure} onChange={(e) => setForm({ ...form, reportingStructure: e.target.value })} placeholder="e.g. State Level" />
            </div>
            <div className="form-group full">
              <button type="submit" className="btn btn-gold">Create Department</button>
            </div>
          </form>
        </div>
      )}

      <div className="card">
        <table className="data-table">
          <thead>
            <tr>
              <th>Department</th>
              <th>Reporting Structure</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {departments.map((d) => (
              <Fragment key={d.id}>
                <tr>
                  <td>{editingId === d.id ? <input value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} /> : d.name}</td>
                  <td>
                    {editingId === d.id ? (
                      <input value={editForm.reportingStructure} onChange={(e) => setEditForm({ ...editForm, reportingStructure: e.target.value })} />
                    ) : (
                      d.reportingStructure || '—'
                    )}
                  </td>
                  <td><span className={`pill ${d.active ? 'green' : 'red'}`}>{d.active ? 'Active' : 'Inactive'}</span></td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    {editingId === d.id ? (
                      <>
                        <button className="btn btn-gold" style={{ marginRight: 6 }} onClick={() => saveEdit(d.id)}>Save</button>
                        <button className="btn btn-outline" onClick={() => setEditingId(null)}>Cancel</button>
                      </>
                    ) : (
                      <>
                        <button className="btn btn-outline" style={{ marginRight: 6 }} onClick={() => setExpandedId(expandedId === d.id ? null : d.id)}>
                          {expandedId === d.id ? 'Hide Schemes' : 'Schemes & Projects'}
                        </button>
                        <button className="btn btn-outline" style={{ marginRight: 6 }} onClick={() => startEdit(d)}>Edit</button>
                        <button className="btn btn-danger" onClick={() => toggleActive(d)}>{d.active ? 'Deactivate' : 'Reactivate'}</button>
                      </>
                    )}
                  </td>
                </tr>
                {expandedId === d.id && (
                  <tr>
                    <td colSpan={4} style={{ background: 'var(--form-bg)' }}>
                      {d.balances.length === 0 ? (
                        <div style={{ padding: '8px 0' }}>
                          <EmptyState title="No scheme allocations yet" message="This department has no fund allocation under any scheme." icon="○" />
                        </div>
                      ) : (
                        d.balances.map((b) => (
                          <div key={b.schemeId} style={{ margin: '12px 0' }}>
                            <div style={{ display: 'flex', gap: 16, alignItems: 'baseline', marginBottom: 6 }}>
                              <strong>{b.schemeName}</strong>
                              <span className="mono" style={{ color: 'var(--ink-soft)' }}>
                                Allocated {formatCurrency(b.allocated)} · Committed {formatCurrency(b.committed)} · Remaining {formatCurrency(b.remaining)}
                              </span>
                            </div>
                            {b.projects.length === 0 ? (
                              <p className="mono" style={{ color: 'var(--ink-soft)', fontSize: '0.8rem' }}>No projects yet under this scheme.</p>
                            ) : (
                              <table className="data-table">
                                <thead>
                                  <tr>
                                    <th>Project</th>
                                    <th>Approved Cost</th>
                                    <th>Status</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {b.projects.map((p) => (
                                    <tr key={p.id}>
                                      <td className="mono">{p.projectCode}</td>
                                      <td>{formatCurrency(p.approvedCost)}</td>
                                      <td><span className="pill blue">{p.status.replace(/_/g, ' ')}</span></td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            )}
                          </div>
                        ))
                      )}
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
