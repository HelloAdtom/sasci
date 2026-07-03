import { useEffect, useState } from 'react';
import { api } from '../api/client';

interface WorkItem {
  id: string;
  workCode: string;
  workName: string;
  workCost: number;
  eligibleDemandAmount: number;
  progress?: { progressPercent: number }[];
}

export default function ProgressPage() {
  const [items, setItems] = useState<WorkItem[]>([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [form, setForm] = useState({
    workItemId: '',
    progressPercent: '',
    geoLat: '',
    geoLong: '',
    milestoneNote: '',
  });
  const [photo, setPhoto] = useState<File | null>(null);
  const [documents, setDocuments] = useState<FileList | null>(null);
  const [documentType, setDocumentType] = useState('bill_invoice');

  useEffect(() => {
    api<WorkItem[]>('/work-items').then(setItems).catch(console.error);
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition((pos) => {
        setForm((f) => ({
          ...f,
          geoLat: pos.coords.latitude.toFixed(6),
          geoLong: pos.coords.longitude.toFixed(6),
        }));
      });
    }
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    const fd = new FormData();
    fd.append('workItemId', form.workItemId);
    fd.append('progressPercent', form.progressPercent);
    fd.append('geoLat', form.geoLat);
    fd.append('geoLong', form.geoLong);
    fd.append('milestoneNote', form.milestoneNote);
    if (photo) fd.append('photos', photo);
    else {
      setError('At least one photo is required');
      return;
    }
    if (documents?.length) {
      Array.from(documents).forEach((f) => fd.append('documents', f));
      fd.append('documentType', documentType);
    }

    try {
      await api('/progress', { method: 'POST', body: fd });
      setSuccess('Progress submitted. Awaiting checker verification.');
      setForm({ ...form, progressPercent: '', milestoneNote: '' });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
    }
  };

  const selected = items.find((i) => i.id === form.workItemId);
  const physicalPct = parseFloat(form.progressPercent) || 0;
  const financialPct = selected ? (selected.eligibleDemandAmount / selected.workCost) * 100 : 0;

  return (
    <>
      <h1 className="page-title">Progress Submission</h1>
      <p className="page-subtitle">Geo-tagged photo evidence with milestone reporting</p>
      {error && <div className="alert error">{error}</div>}
      {success && <div className="alert success">{success}</div>}

      <div className="two-col">
        <div className="card">
          <div className="card-title">Submit Progress</div>
          <form onSubmit={submit}>
            <div className="form-group" style={{ marginBottom: 16 }}>
              <label>Work Item</label>
              <select value={form.workItemId} onChange={(e) => setForm({ ...form, workItemId: e.target.value })} required>
                <option value="">Select assigned work…</option>
                {items.map((w) => (
                  <option key={w.id} value={w.id}>{w.workCode} — {w.workName}</option>
                ))}
              </select>
            </div>
            <div className="form-group" style={{ marginBottom: 16 }}>
              <label>Progress %</label>
              <input type="number" min="0" max="100" value={form.progressPercent} onChange={(e) => setForm({ ...form, progressPercent: e.target.value })} required />
            </div>
            <div className="form-grid" style={{ marginBottom: 16 }}>
              <div className="form-group">
                <label>Latitude</label>
                <input value={form.geoLat} onChange={(e) => setForm({ ...form, geoLat: e.target.value })} required />
              </div>
              <div className="form-group">
                <label>Longitude</label>
                <input value={form.geoLong} onChange={(e) => setForm({ ...form, geoLong: e.target.value })} required />
              </div>
            </div>
            <div className="form-group" style={{ marginBottom: 16 }}>
              <label>Photo Evidence</label>
              <input type="file" accept="image/*" onChange={(e) => setPhoto(e.target.files?.[0] || null)} required />
            </div>
            <div className="form-grid" style={{ marginBottom: 16 }}>
              <div className="form-group">
                <label>Supporting Documents (optional)</label>
                <input type="file" accept="image/*,application/pdf" multiple onChange={(e) => setDocuments(e.target.files)} />
              </div>
              <div className="form-group">
                <label>Document Type</label>
                <select value={documentType} onChange={(e) => setDocumentType(e.target.value)}>
                  <option value="bill_invoice">Bill / Invoice</option>
                  <option value="completion_certificate">Completion Certificate</option>
                  <option value="other">Other</option>
                </select>
              </div>
            </div>
            <div className="form-group" style={{ marginBottom: 16 }}>
              <label>Milestone Note</label>
              <textarea rows={3} value={form.milestoneNote} onChange={(e) => setForm({ ...form, milestoneNote: e.target.value })} />
            </div>
            <button type="submit" className="btn btn-gold">Submit Progress</button>
          </form>
        </div>

        <div className="card">
          <div className="card-title">Physical vs Financial Progress</div>
          <div style={{ marginTop: 24 }}>
            <div style={{ marginBottom: 20 }}>
              <div className="mono" style={{ marginBottom: 6 }}>Physical Progress</div>
              <div style={{ background: 'var(--line)', height: 24, borderRadius: 2 }}>
                <div style={{ background: 'var(--blue)', width: `${physicalPct}%`, height: '100%', borderRadius: 2 }} />
              </div>
              <div className="mono" style={{ marginTop: 4 }}>{physicalPct}%</div>
            </div>
            <div>
              <div className="mono" style={{ marginBottom: 6 }}>Financial Eligibility</div>
              <div style={{ background: 'var(--line)', height: 24, borderRadius: 2 }}>
                <div style={{ background: 'var(--green)', width: `${Math.min(financialPct, 100)}%`, height: '100%', borderRadius: 2 }} />
              </div>
              <div className="mono" style={{ marginTop: 4 }}>{financialPct.toFixed(1)}%</div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
