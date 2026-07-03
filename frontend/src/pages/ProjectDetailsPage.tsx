import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { api, formatCurrency } from '../api/client';
import EmptyState from '../components/EmptyState';

interface WorkItemDetail {
  id: string;
  workCode: string;
  workName: string;
  workCost: number;
  status: string;
  active: boolean;
  progressPercent: number;
  eligibleDemandAmount: number;
  vendor?: { id: string; name: string };
  assignedOfficer?: { name: string } | null;
}

interface ProjectDetail {
  id: string;
  projectCode: string;
  projectName: string;
  approvedCost: number;
  status: string;
  active: boolean;
  scheme: { schemeName: string };
  district: { name: string };
  department: { name: string };
  vendor?: { name: string };
  departmentBalance: { allocated: number; committed: number; remaining: number };
  workItems: WorkItemDetail[];
}

interface Vendor {
  id: string;
  name: string;
}

interface Officer {
  id: string;
  name: string;
}

export default function ProjectDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [officers, setOfficers] = useState<Officer[]>([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ workCode: '', workName: '', workCost: '', vendorId: '' });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ workName: '', workCost: '', vendorId: '' });
  const [assigningId, setAssigningId] = useState<string | null>(null);
  const [assignOfficerId, setAssignOfficerId] = useState('');

  const load = () => api<ProjectDetail>(`/projects/${id}`).then(setProject).catch(console.error);

  useEffect(() => {
    load();
    api<Vendor[]>('/vendors').then(setVendors).catch(() => {});
    api<Officer[]>('/work-items/field-officers').then(setOfficers).catch(() => {});
  }, [id]);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      await api('/work-items', { method: 'POST', body: JSON.stringify({ ...form, projectId: id }) });
      setShowCreate(false);
      setForm({ workCode: '', workName: '', workCost: '', vendorId: '' });
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Blocked by validation');
    }
  };

  const startEdit = (w: WorkItemDetail) => {
    setEditingId(w.id);
    setEditForm({ workName: w.workName, workCost: String(w.workCost), vendorId: w.vendor?.id || '' });
  };

  const saveEdit = async (workItemId: string) => {
    setError('');
    try {
      await api(`/work-items/${workItemId}`, { method: 'PATCH', body: JSON.stringify(editForm) });
      setEditingId(null);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Update blocked by validation');
    }
  };

  const assign = async (workItemId: string) => {
    setError('');
    try {
      await api(`/work-items/${workItemId}/assign`, { method: 'POST', body: JSON.stringify({ assignedOfficerId: assignOfficerId }) });
      setAssigningId(null);
      setAssignOfficerId('');
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
    }
  };

  const remove = async (w: WorkItemDetail) => {
    setError('');
    setSuccess('');
    try {
      const result = await api<{ deleted: boolean; message?: string }>(`/work-items/${w.id}`, { method: 'DELETE' });
      setSuccess(result.deleted ? `${w.workCode} deleted` : result.message || `${w.workCode} deactivated`);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
    }
  };

  if (!project) return null;

  return (
    <>
      <button className="btn btn-outline" style={{ marginBottom: 16 }} onClick={() => navigate('/projects')}>← Back to Projects</button>
      <h1 className="page-title">{project.projectName}</h1>
      <p className="page-subtitle">
        <span className="mono">{project.projectCode}</span> · {project.scheme.schemeName} · {project.district.name} · {project.department.name}
        {!project.active && <span className="pill red" style={{ marginLeft: 8 }}>Inactive</span>}
      </p>
      {error && <div className="alert error">{error}</div>}
      {success && <div className="alert success">{success}</div>}

      <div className="kpi-grid">
        <div className="kpi-card">
          <div className="kpi-label">Approved Cost</div>
          <div className="kpi-value">{formatCurrency(project.approvedCost)}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Project Vendor</div>
          <div className="kpi-value" style={{ fontSize: '1.1rem' }}>{project.vendor?.name || '—'}</div>
        </div>
        <div className="kpi-card green">
          <div className="kpi-label">Department Remaining</div>
          <div className="kpi-value">{formatCurrency(project.departmentBalance.remaining)}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Status</div>
          <div className="kpi-value" style={{ fontSize: '1.1rem' }}>{project.status.replace(/_/g, ' ')}</div>
        </div>
      </div>

      <div style={{ marginBottom: 16 }}>
        <button className="btn btn-primary" onClick={() => setShowCreate(!showCreate)}>
          {showCreate ? 'Cancel' : '+ Create Work Item'}
        </button>
      </div>

      {showCreate && (
        <div className="card">
          <div className="card-title">New Work Item</div>
          <form className="form-grid" onSubmit={create}>
            <div className="form-group">
              <label>Work Code</label>
              <input value={form.workCode} onChange={(e) => setForm({ ...form, workCode: e.target.value })} required />
            </div>
            <div className="form-group">
              <label>Work Name</label>
              <input value={form.workName} onChange={(e) => setForm({ ...form, workName: e.target.value })} required />
            </div>
            <div className="form-group">
              <label>Work Cost (₹)</label>
              <input type="number" value={form.workCost} onChange={(e) => setForm({ ...form, workCost: e.target.value })} required />
            </div>
            <div className="form-group">
              <label>Vendor</label>
              <select value={form.vendorId} onChange={(e) => setForm({ ...form, vendorId: e.target.value })}>
                <option value="">Unassigned</option>
                {vendors.map((v) => (
                  <option key={v.id} value={v.id}>{v.name}</option>
                ))}
              </select>
            </div>
            <div className="form-group full">
              <button type="submit" className="btn btn-gold">Create (validates against project cost)</button>
            </div>
          </form>
        </div>
      )}

      <div className="card">
        <div className="card-title">Work Items</div>
        {project.workItems.length === 0 ? (
          <EmptyState title="No work items yet" message="Create one above to start tracking this project's execution." />
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Work Item</th>
                <th>Vendor</th>
                <th>Assigned To</th>
                <th>Progress</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {project.workItems.map((w) => (
                <tr key={w.id}>
                  <td>
                    <div className="mono">{w.workCode}</div>
                    {editingId === w.id ? (
                      <input value={editForm.workName} onChange={(e) => setEditForm({ ...editForm, workName: e.target.value })} style={{ marginTop: 4 }} />
                    ) : (
                      <div>{w.workName}</div>
                    )}
                    <div className="mono" style={{ fontSize: '0.75rem', color: 'var(--ink-soft)' }}>{formatCurrency(w.workCost)}</div>
                  </td>
                  <td>
                    {editingId === w.id ? (
                      <select value={editForm.vendorId} onChange={(e) => setEditForm({ ...editForm, vendorId: e.target.value })}>
                        <option value="">Unassigned</option>
                        {vendors.map((v) => (
                          <option key={v.id} value={v.id}>{v.name}</option>
                        ))}
                      </select>
                    ) : (
                      w.vendor?.name || '—'
                    )}
                  </td>
                  <td>
                    {assigningId === w.id ? (
                      <div style={{ display: 'flex', gap: 6 }}>
                        <select value={assignOfficerId} onChange={(e) => setAssignOfficerId(e.target.value)}>
                          <option value="">Select…</option>
                          {officers.map((o) => (
                            <option key={o.id} value={o.id}>{o.name}</option>
                          ))}
                        </select>
                        <button className="btn btn-gold" onClick={() => assign(w.id)}>Save</button>
                        <button className="btn btn-outline" onClick={() => setAssigningId(null)}>Cancel</button>
                      </div>
                    ) : (
                      <>
                        {w.assignedOfficer ? w.assignedOfficer.name : '—'}
                        <button className="btn btn-outline" style={{ marginLeft: 6, padding: '2px 8px', fontSize: '0.7rem' }} onClick={() => { setAssigningId(w.id); setAssignOfficerId(''); }}>
                          {w.assignedOfficer ? 'Reassign' : 'Assign'}
                        </button>
                      </>
                    )}
                  </td>
                  <td>{w.progressPercent}%</td>
                  <td>
                    <span className="pill blue">{w.status.replace(/_/g, ' ')}</span>
                    {!w.active && <span className="pill red" style={{ marginLeft: 4 }}>Inactive</span>}
                  </td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    {editingId === w.id ? (
                      <>
                        <button className="btn btn-gold" style={{ marginRight: 6 }} onClick={() => saveEdit(w.id)}>Save</button>
                        <button className="btn btn-outline" onClick={() => setEditingId(null)}>Cancel</button>
                      </>
                    ) : (
                      <>
                        <button className="btn btn-outline" style={{ marginRight: 6 }} onClick={() => startEdit(w)}>Edit</button>
                        <button className="btn btn-danger" onClick={() => remove(w)}>Delete</button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <p className="mono" style={{ fontSize: '0.75rem', color: 'var(--ink-soft)' }}>
        Need the cross-project view instead? <Link to="/work">Work Items</Link>
      </p>
    </>
  );
}
