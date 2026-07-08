import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api, formatCurrency } from '../api/client';
import EmptyState from '../components/EmptyState';

interface WorkItem {
  id: string;
  workCode: string;
  workName: string;
  workCost: number;
  projectApprovedCost: number;
  validationPass: boolean;
  eligibleDemandAmount: number;
  status: string;
  active: boolean;
  project: { projectName: string; id: string };
  assignedOfficer?: { name: string };
  vendor?: { id: string; name: string };
}

interface Project {
  id: string;
  projectName: string;
}

interface Officer {
  id: string;
  name: string;
}

interface Vendor {
  id: string;
  name: string;
}

export default function WorkPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [items, setItems] = useState<WorkItem[]>([]);
  const [projectFilter, setProjectFilter] = useState(searchParams.get('projectId') || '');
  const [projects, setProjects] = useState<Project[]>([]);
  const [officers, setOfficers] = useState<Officer[]>([]);
  const [selected, setSelected] = useState<WorkItem | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [form, setForm] = useState({ workCode: '', projectId: '', workName: '', workCost: '', vendorId: '' });
  const [assignForm, setAssignForm] = useState({ assignedOfficerId: '', targetCompletionDate: '' });
  const [editForm, setEditForm] = useState({ workName: '', workCost: '', vendorId: '' });

  const load = () => api<WorkItem[]>('/work-items').then((d) => { setItems(d); setLoaded(true); }).catch(console.error);

  useEffect(() => {
    load();
    api<Project[]>('/projects').then(setProjects).catch(console.error);
    api<Officer[]>('/work-items/field-officers').then(setOfficers).catch(() => {});
    api<Vendor[]>('/vendors').then(setVendors).catch(() => {});
  }, []);

  useEffect(() => {
    if (selected) setEditForm({ workName: selected.workName, workCost: String(selected.workCost), vendorId: selected.vendor?.id || '' });
  }, [selected]);

  const changeProjectFilter = (projectId: string) => {
    setProjectFilter(projectId);
    setSearchParams(projectId ? { projectId } : {});
  };

  const filteredItems = projectFilter ? items.filter((w) => w.project.id === projectFilter) : items;

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    try {
      await api('/work-items', { method: 'POST', body: JSON.stringify(form) });
      setSuccess(`${form.workCode} created`);
      setShowCreate(false);
      setForm({ workCode: '', projectId: '', workName: '', workCost: '', vendorId: '' });
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Blocked by validation');
    }
  };

  const assign = async (id: string) => {
    setError('');
    setSuccess('');
    try {
      await api(`/work-items/${id}/assign`, { method: 'POST', body: JSON.stringify(assignForm) });
      setSuccess('Officer assigned');
      setAssignForm({ assignedOfficerId: '', targetCompletionDate: '' });
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
    }
  };

  const saveEdit = async (id: string) => {
    setError('');
    setSuccess('');
    try {
      await api(`/work-items/${id}`, { method: 'PATCH', body: JSON.stringify(editForm) });
      setSuccess('Changes saved');
      setSelected(null);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Update blocked by validation');
    }
  };

  const toggleActive = async (item: WorkItem) => {
    setError('');
    setSuccess('');
    try {
      await api(`/work-items/${item.id}`, { method: 'PATCH', body: JSON.stringify({ active: !item.active }) });
      setSuccess(item.active ? `${item.workCode} deactivated` : `${item.workCode} reactivated`);
      setSelected(null);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
    }
  };

  return (
    <>
      <h1 className="page-title">Work Management</h1>
      <p className="page-subtitle">Work items with live cost validation and eligible demand calculation</p>
      {error && <div className="alert error">{error}</div>}
      {success && <div className="alert success">{success}</div>}

      <div style={{ marginBottom: 16, display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <button className="btn btn-primary" onClick={() => setShowCreate(!showCreate)}>+ Create Work Item</button>
        <div className="form-group" style={{ minWidth: 240 }}>
          <label>Filter by Project</label>
          <select value={projectFilter} onChange={(e) => changeProjectFilter(e.target.value)}>
            <option value="">All Projects</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>{p.projectName}</option>
            ))}
          </select>
        </div>
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
              <label>Project</label>
              <select value={form.projectId} onChange={(e) => setForm({ ...form, projectId: e.target.value })} required>
                <option value="">Select…</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>{p.projectName}</option>
                ))}
              </select>
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

      <div className="two-col">
        <div className="card">
          {loaded && filteredItems.length === 0 ? (
            <EmptyState
              title={projectFilter ? 'No work items in this project' : 'No work items yet'}
              message={projectFilter ? 'Create one above, or switch back to All Projects.' : 'Create a work item above to see it listed here.'}
            />
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Work ID</th>
                  <th>Project</th>
                  <th>Cost</th>
                  <th>Validation</th>
                  <th>Vendor</th>
                  <th>Officer</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.map((w) => (
                  <tr key={w.id} onClick={() => setSelected(w)} style={{ cursor: 'pointer' }}>
                    <td className="mono">{w.workCode}</td>
                    <td>{w.project.projectName}</td>
                    <td>{formatCurrency(w.workCost)}</td>
                    <td>
                      <span className={`pill ${w.validationPass ? 'green' : 'red'}`}>
                        {w.validationPass ? 'PASS' : 'FAIL'}
                      </span>
                    </td>
                    <td>{w.vendor?.name || '—'}</td>
                    <td>{w.assignedOfficer?.name || '—'}</td>
                    <td>
                      <span className="pill blue">{w.status}</span>
                      {!w.active && <span className="pill red" style={{ marginLeft: 4 }}>Inactive</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {selected && (
          <div className="card">
            <div className="card-title">Eligible Demand Panel</div>
            <p className="mono" style={{ marginBottom: 12, color: 'var(--ink-soft)' }}>
              {selected.workCode}
            </p>
            <div className="form-grid" style={{ marginBottom: 12 }}>
              <div className="form-group">
                <label>Work Name</label>
                <input value={editForm.workName} onChange={(e) => setEditForm({ ...editForm, workName: e.target.value })} />
              </div>
              <div className="form-group">
                <label>Work Cost (₹)</label>
                <input type="number" value={editForm.workCost} onChange={(e) => setEditForm({ ...editForm, workCost: e.target.value })} />
              </div>
              <div className="form-group">
                <label>Vendor</label>
                <select value={editForm.vendorId} onChange={(e) => setEditForm({ ...editForm, vendorId: e.target.value })}>
                  <option value="">Unassigned</option>
                  {vendors.map((v) => (
                    <option key={v.id} value={v.id}>{v.name}</option>
                  ))}
                </select>
              </div>
              <div className="form-group full" style={{ display: 'flex', gap: 8 }}>
                <button className="btn btn-gold" onClick={() => saveEdit(selected.id)}>Save Changes</button>
                <button className="btn btn-danger" onClick={() => toggleActive(selected)}>{selected.active ? 'Deactivate' : 'Reactivate'}</button>
              </div>
            </div>
            <p style={{ marginBottom: 8 }}>
              Project approved cost: <strong>{formatCurrency(selected.projectApprovedCost)}</strong>
            </p>
            <div className="alert info" style={{ marginTop: 16 }}>
              <strong className="mono">Eligible Demand Amount</strong>
              <div style={{ fontSize: '1.5rem', fontFamily: 'var(--font-serif)', marginTop: 8 }}>
                {formatCurrency(selected.eligibleDemandAmount)}
              </div>
              <p className="mono" style={{ fontSize: '0.75rem', marginTop: 8 }}>
                (verified progress% × work_cost) − previously released
              </p>
            </div>
            <div className="form-grid" style={{ marginTop: 16 }}>
              <div className="form-group">
                <label>Assign Field Officer</label>
                <select value={assignForm.assignedOfficerId} onChange={(e) => setAssignForm({ ...assignForm, assignedOfficerId: e.target.value })}>
                  <option value="">Select…</option>
                  {officers.map((o) => (
                    <option key={o.id} value={o.id}>{o.name}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>Target Date</label>
                <input type="date" value={assignForm.targetCompletionDate} onChange={(e) => setAssignForm({ ...assignForm, targetCompletionDate: e.target.value })} />
              </div>
              <div className="form-group full">
                <button className="btn btn-primary" onClick={() => assign(selected.id)}>Assign</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
