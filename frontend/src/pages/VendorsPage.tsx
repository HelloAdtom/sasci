import { useEffect, useState } from 'react';
import { api } from '../api/client';
import EmptyState from '../components/EmptyState';

interface Vendor {
  id: string;
  name: string;
  registrationNumber?: string;
  contactDetails?: string;
  active: boolean;
  _count: { projects: number; workItems: number };
}

export default function VendorsPage() {
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [form, setForm] = useState({ name: '', registrationNumber: '', contactDetails: '' });
  const [editForm, setEditForm] = useState({ name: '', registrationNumber: '', contactDetails: '' });

  const load = () => api<Vendor[]>('/vendors').then((d) => { setVendors(d); setLoaded(true); }).catch(console.error);
  useEffect(() => { load(); }, []);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      await api('/vendors', { method: 'POST', body: JSON.stringify(form) });
      setSuccess('Vendor created');
      setShowForm(false);
      setForm({ name: '', registrationNumber: '', contactDetails: '' });
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
    }
  };

  const startEdit = (v: Vendor) => {
    setEditingId(v.id);
    setEditForm({ name: v.name, registrationNumber: v.registrationNumber || '', contactDetails: v.contactDetails || '' });
  };

  const saveEdit = async (id: string) => {
    setError('');
    try {
      await api(`/vendors/${id}`, { method: 'PATCH', body: JSON.stringify(editForm) });
      setEditingId(null);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Update failed');
    }
  };

  const toggleActive = async (v: Vendor) => {
    setError('');
    try {
      await api(`/vendors/${v.id}`, { method: 'PATCH', body: JSON.stringify({ active: !v.active }) });
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
    }
  };

  const remove = async (v: Vendor) => {
    setError('');
    setSuccess('');
    try {
      const result = await api<{ deleted: boolean; message?: string }>(`/vendors/${v.id}`, { method: 'DELETE' });
      setSuccess(result.deleted ? 'Vendor deleted' : result.message || 'Vendor deactivated');
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
    }
  };

  return (
    <>
      <h1 className="page-title">Vendor Management</h1>
      <p className="page-subtitle">Contractors and suppliers assignable to projects and work items</p>
      {error && <div className="alert error">{error}</div>}
      {success && <div className="alert success">{success}</div>}

      <div style={{ marginBottom: 16 }}>
        <button className="btn btn-primary" onClick={() => setShowForm(!showForm)}>
          {showForm ? 'Cancel' : '+ Create Vendor'}
        </button>
      </div>

      {showForm && (
        <div className="card">
          <div className="card-title">New Vendor</div>
          <form className="form-grid" onSubmit={create}>
            <div className="form-group">
              <label>Vendor Name</label>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            </div>
            <div className="form-group">
              <label>Registration Number</label>
              <input value={form.registrationNumber} onChange={(e) => setForm({ ...form, registrationNumber: e.target.value })} />
            </div>
            <div className="form-group full">
              <label>Contact Details</label>
              <input value={form.contactDetails} onChange={(e) => setForm({ ...form, contactDetails: e.target.value })} />
            </div>
            <div className="form-group full">
              <button type="submit" className="btn btn-gold">Create Vendor</button>
            </div>
          </form>
        </div>
      )}

      <div className="card">
        {loaded && vendors.length === 0 ? (
          <EmptyState title="No vendors yet" message="Create a vendor above to assign them to projects and work items." />
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Registration No.</th>
                <th>Contact</th>
                <th>Projects</th>
                <th>Work Items</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {vendors.map((v) => (
                <tr key={v.id}>
                  <td>{editingId === v.id ? <input value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} /> : v.name}</td>
                  <td className="mono">
                    {editingId === v.id ? (
                      <input value={editForm.registrationNumber} onChange={(e) => setEditForm({ ...editForm, registrationNumber: e.target.value })} style={{ width: 130 }} />
                    ) : (
                      v.registrationNumber || '—'
                    )}
                  </td>
                  <td>
                    {editingId === v.id ? (
                      <input value={editForm.contactDetails} onChange={(e) => setEditForm({ ...editForm, contactDetails: e.target.value })} />
                    ) : (
                      v.contactDetails || '—'
                    )}
                  </td>
                  <td>{v._count.projects}</td>
                  <td>{v._count.workItems}</td>
                  <td><span className={`pill ${v.active ? 'green' : 'red'}`}>{v.active ? 'Active' : 'Inactive'}</span></td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    {editingId === v.id ? (
                      <>
                        <button className="btn btn-gold" style={{ marginRight: 6 }} onClick={() => saveEdit(v.id)}>Save</button>
                        <button className="btn btn-outline" onClick={() => setEditingId(null)}>Cancel</button>
                      </>
                    ) : (
                      <>
                        <button className="btn btn-outline" style={{ marginRight: 6 }} onClick={() => startEdit(v)}>Edit</button>
                        {v.active && (
                          <button className="btn btn-outline" style={{ marginRight: 6 }} onClick={() => toggleActive(v)}>Deactivate</button>
                        )}
                        <button className="btn btn-danger" onClick={() => remove(v)}>Delete</button>
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
