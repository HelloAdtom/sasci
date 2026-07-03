import { Fragment, useEffect, useState } from 'react';
import { api, formatCurrency } from '../api/client';
import EmptyState from '../components/EmptyState';

interface Scheme {
  id: string;
  schemeCode: string;
  schemeName: string;
  financialYear: string;
  schemeCeilingAmount: number;
  status: string;
  totalAllocated?: number;
  statusIndicator?: string;
  parts: { id: string; partName: string }[];
}

interface Department {
  id: string;
  name: string;
}

interface SchemeProject {
  id: string;
  projectCode: string;
  projectName: string;
  approvedCost: number;
  status: string;
  department: { name: string };
  district: { name: string };
}

export default function SchemesPage() {
  const [schemes, setSchemes] = useState<Scheme[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [showAlloc, setShowAlloc] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [schemeProjects, setSchemeProjects] = useState<Record<string, SchemeProject[]>>({});
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [form, setForm] = useState({
    schemeCode: '',
    schemeName: '',
    financialYear: '2026-27',
    schemeCeilingAmount: '',
    partName: 'Part A',
  });
  const [editForm, setEditForm] = useState({ schemeName: '', schemeCeilingAmount: '' });
  const [allocForm, setAllocForm] = useState({ departmentId: '', allocatedAmount: '' });

  const load = () => api<Scheme[]>('/schemes').then(setSchemes).catch(console.error);
  useEffect(() => {
    load();
    api<Department[]>('/departments').then((d) => setDepartments(d.map(({ id, name }) => ({ id, name })))).catch(console.error);
  }, []);

  const createScheme = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      await api('/schemes', {
        method: 'POST',
        body: JSON.stringify({ ...form, parts: [{ partName: form.partName }] }),
      });
      setSuccess('Scheme created');
      setShowForm(false);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
    }
  };

  const createAllocation = async (schemeId: string) => {
    setError('');
    try {
      await api(`/schemes/${schemeId}/allocations`, {
        method: 'POST',
        body: JSON.stringify({ ...allocForm, financialYear: '2026-27' }),
      });
      setSuccess('Allocation created');
      setShowAlloc(null);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Allocation blocked');
    }
  };

  const startEdit = (s: Scheme) => {
    setEditingId(s.id);
    setEditForm({ schemeName: s.schemeName, schemeCeilingAmount: String(s.schemeCeilingAmount) });
  };

  const saveEdit = async (schemeId: string) => {
    setError('');
    try {
      await api(`/schemes/${schemeId}`, { method: 'PUT', body: JSON.stringify(editForm) });
      setSuccess('Scheme updated');
      setEditingId(null);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Update failed');
    }
  };

  const toggleActive = async (s: Scheme) => {
    setError('');
    try {
      await api(`/schemes/${s.id}`, { method: 'PUT', body: JSON.stringify({ status: s.status === 'closed' ? 'active' : 'closed' }) });
      setSuccess(s.status === 'closed' ? 'Scheme reactivated' : 'Scheme deactivated');
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
    }
  };

  const toggleProjects = async (schemeId: string) => {
    if (expandedId === schemeId) {
      setExpandedId(null);
      return;
    }
    setExpandedId(schemeId);
    if (!schemeProjects[schemeId]) {
      const projects = await api<SchemeProject[]>(`/projects?schemeId=${schemeId}`).catch(() => []);
      setSchemeProjects((prev) => ({ ...prev, [schemeId]: projects }));
    }
  };

  const statusPill = (s: string) => {
    const cls = s === 'Ceiling Reached' ? 'red' : s === 'Near Ceiling' ? 'amber' : 'green';
    return <span className={`pill ${cls}`}>{s}</span>;
  };

  return (
    <>
      <h1 className="page-title">Scheme & Parts Master</h1>
      <p className="page-subtitle">FY-wise budget registry with ceiling validation</p>
      {error && <div className="alert error">{error}</div>}
      {success && <div className="alert success">{success}</div>}

      <div style={{ marginBottom: 16 }}>
        <button className="btn btn-primary" onClick={() => setShowForm(!showForm)}>
          {showForm ? 'Cancel' : '+ Create Scheme'}
        </button>
      </div>

      {showForm && (
        <div className="card">
          <div className="card-title">New Scheme</div>
          <form className="form-grid" onSubmit={createScheme}>
            <div className="form-group">
              <label>Scheme Code</label>
              <input value={form.schemeCode} onChange={(e) => setForm({ ...form, schemeCode: e.target.value })} required />
            </div>
            <div className="form-group">
              <label>Scheme Name</label>
              <input value={form.schemeName} onChange={(e) => setForm({ ...form, schemeName: e.target.value })} required />
            </div>
            <div className="form-group">
              <label>Financial Year</label>
              <input value={form.financialYear} onChange={(e) => setForm({ ...form, financialYear: e.target.value })} />
            </div>
            <div className="form-group">
              <label>Ceiling Amount (₹)</label>
              <input type="number" value={form.schemeCeilingAmount} onChange={(e) => setForm({ ...form, schemeCeilingAmount: e.target.value })} required />
            </div>
            <div className="form-group full">
              <button type="submit" className="btn btn-gold">Create Scheme</button>
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
              <th>FY</th>
              <th>Ceiling</th>
              <th>Allocated</th>
              <th>Parts</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {schemes.map((s) => (
              <Fragment key={s.id}>
                <tr>
                  <td className="mono">{s.schemeCode}</td>
                  <td>
                    {editingId === s.id ? (
                      <input value={editForm.schemeName} onChange={(e) => setEditForm({ ...editForm, schemeName: e.target.value })} />
                    ) : (
                      s.schemeName
                    )}
                  </td>
                  <td className="mono">{s.financialYear}</td>
                  <td>
                    {editingId === s.id ? (
                      <input type="number" value={editForm.schemeCeilingAmount} onChange={(e) => setEditForm({ ...editForm, schemeCeilingAmount: e.target.value })} style={{ width: 120 }} />
                    ) : (
                      formatCurrency(s.schemeCeilingAmount)
                    )}
                  </td>
                  <td>{formatCurrency(s.totalAllocated || 0)}</td>
                  <td>{s.parts?.length ?? 0}</td>
                  <td>
                    {s.status === 'closed' ? <span className="pill red">Closed</span> : statusPill(s.statusIndicator || 'Active')}
                  </td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    {editingId === s.id ? (
                      <>
                        <button className="btn btn-gold" style={{ marginRight: 6 }} onClick={() => saveEdit(s.id)}>Save</button>
                        <button className="btn btn-outline" onClick={() => setEditingId(null)}>Cancel</button>
                      </>
                    ) : (
                      <>
                        <button className="btn btn-outline" style={{ marginRight: 6 }} onClick={() => toggleProjects(s.id)}>
                          {expandedId === s.id ? 'Hide Projects' : 'Projects'}
                        </button>
                        <button className="btn btn-outline" style={{ marginRight: 6 }} onClick={() => startEdit(s)}>Edit</button>
                        <button className="btn btn-outline" style={{ marginRight: 6 }} onClick={() => setShowAlloc(showAlloc === s.id ? null : s.id)}>Allocate</button>
                        <button className="btn btn-danger" onClick={() => toggleActive(s)}>{s.status === 'closed' ? 'Reactivate' : 'Deactivate'}</button>
                      </>
                    )}
                  </td>
                </tr>
                {expandedId === s.id && (
                  <tr key={`${s.id}-projects`}>
                    <td colSpan={8} style={{ background: 'var(--form-bg)' }}>
                      {!schemeProjects[s.id] ? (
                        <p className="mono" style={{ padding: '8px 0' }}>Loading…</p>
                      ) : schemeProjects[s.id].length === 0 ? (
                        <div style={{ padding: '8px 0' }}>
                          <EmptyState title="No projects under this scheme yet" icon="○" />
                        </div>
                      ) : (
                        <table className="data-table" style={{ margin: '4px 0' }}>
                          <thead>
                            <tr>
                              <th>Project</th>
                              <th>Department</th>
                              <th>District</th>
                              <th>Approved Cost</th>
                              <th>Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {schemeProjects[s.id].map((p) => (
                              <tr key={p.id}>
                                <td className="mono">{p.projectCode}</td>
                                <td>{p.department.name}</td>
                                <td>{p.district.name}</td>
                                <td>{formatCurrency(p.approvedCost)}</td>
                                <td><span className="pill blue">{p.status.replace(/_/g, ' ')}</span></td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>

      {showAlloc && (
        <div className="card">
          <div className="card-title">Department Allocation</div>
          <div className="form-grid">
            <div className="form-group">
              <label>Department</label>
              <select value={allocForm.departmentId} onChange={(e) => setAllocForm({ ...allocForm, departmentId: e.target.value })}>
                <option value="">Select…</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>Amount (₹)</label>
              <input type="number" value={allocForm.allocatedAmount} onChange={(e) => setAllocForm({ ...allocForm, allocatedAmount: e.target.value })} />
            </div>
            <div className="form-group full">
              <button className="btn btn-primary" onClick={() => createAllocation(showAlloc)}>Submit Allocation</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
