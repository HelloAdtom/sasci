import { useEffect, useState } from 'react';
import { api, formatCurrency } from '../api/client';
import { useAuth } from '../context/AuthContext';
import EmptyState from '../components/EmptyState';

interface DocumentItem {
  id: string;
  fileUrl: string;
  fileName: string;
  documentType: string;
  uploadedAt: string;
  uploadedBy: { name: string; employeeCode: string };
}

interface ProgressEntry {
  id: string;
  progressPercent: number;
  geoLat: number;
  geoLong: number;
  photoUrls: string;
  milestoneNote?: string;
  verified: boolean;
  submittedAt: string;
  submittedBy: { name: string; employeeCode: string };
  documents: DocumentItem[];
}

const DOC_TYPE_LABELS: Record<string, string> = {
  bill_invoice: 'Bill / Invoice',
  completion_certificate: 'Completion Certificate',
  other: 'Other',
};

interface Action {
  stage: string;
  action: string;
  timestamp: string;
  remarks?: string;
  officer: { name: string; role: string };
}

interface Demand {
  id: string;
  demandCode: string;
  demandAmount: number;
  eligibleDemandAmount: number;
  status: string;
  createdAt: string;
  workItem: {
    workCode: string;
    workName: string;
    progress: ProgressEntry[];
    project: { scheme: { schemeName: string }; district: { name: string } };
  };
  raisedBy: { id: string; name: string; employeeCode: string };
  actions: Action[];
  documents: DocumentItem[];
}

interface WorkItem {
  id: string;
  workCode: string;
  workName: string;
  eligibleDemandAmount: number;
}

interface BottleneckStat {
  stage: string;
  count: number;
  avgDaysStuck: number;
  oldestItem: string | null;
}

const STAGE_INFO: Record<string, { title: string; who: string; description: string }> = {
  checker: { title: 'Checker', who: 'Checker', description: 'Independently validates the demand against progress and rules.' },
  finance: { title: 'Finance', who: 'Finance Officer', description: 'Confirms budget availability and financial compliance.' },
  approver: { title: 'Approver', who: 'Approver', description: 'Gives final sign-off and triggers the fund release.' },
};

function photoList(entry: ProgressEntry): string[] {
  try {
    const parsed = JSON.parse(entry.photoUrls);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function isImageExtension(name: string) {
  return /\.(jpe?g|png|gif|webp)$/i.test(name);
}

function PhotoGallery({ urls }: { urls: string[] }) {
  if (urls.length === 0) return <p className="mono" style={{ fontSize: '0.75rem', color: 'var(--ink-soft)' }}>No photos attached.</p>;
  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', margin: '8px 0' }}>
      {urls.map((url, i) => (
        <a key={i} href={url} target="_blank" rel="noreferrer">
          <img src={url} alt="Geo-tagged progress evidence" style={{ width: 84, height: 64, objectFit: 'cover', border: '1px solid var(--line)', borderRadius: 2 }} />
        </a>
      ))}
    </div>
  );
}

function DocumentList({ docs }: { docs: DocumentItem[] }) {
  if (docs.length === 0) return <p className="mono" style={{ fontSize: '0.75rem', color: 'var(--ink-soft)' }}>No documents attached.</p>;
  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', margin: '8px 0' }}>
      {docs.map((d) => (
        <a key={d.id} href={d.fileUrl} target="_blank" rel="noreferrer" style={{ textDecoration: 'none', textAlign: 'center' }}>
          {isImageExtension(d.fileName) ? (
            <img src={d.fileUrl} alt={d.fileName} style={{ width: 84, height: 64, objectFit: 'cover', border: '1px solid var(--line)', borderRadius: 2, display: 'block' }} />
          ) : (
            <div style={{ width: 84, height: 64, border: '1px solid var(--line)', borderRadius: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--form-bg)' }}>
              <span className="mono" style={{ fontSize: '0.65rem' }}>FILE</span>
            </div>
          )}
          <div className="mono" style={{ fontSize: '0.65rem', marginTop: 2, maxWidth: 84, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {DOC_TYPE_LABELS[d.documentType] || d.documentType}
          </div>
        </a>
      ))}
    </div>
  );
}

function lastActionOfType(demand: Demand, action: string) {
  return [...demand.actions].reverse().find((a) => a.action === action);
}

export default function FundWorkflowPage() {
  const { user } = useAuth();
  const [demands, setDemands] = useState<Demand[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [workItems, setWorkItems] = useState<WorkItem[]>([]);
  const [bottlenecks, setBottlenecks] = useState<BottleneckStat[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [selfApproval, setSelfApproval] = useState(false);
  const [success, setSuccess] = useState('');
  const [remarks, setRemarks] = useState('');
  const [raiseForm, setRaiseForm] = useState({ workItemId: '', demandAmount: '' });
  const [raiseDocuments, setRaiseDocuments] = useState<FileList | null>(null);
  const [raiseDocumentType, setRaiseDocumentType] = useState('bill_invoice');
  const [resubmitAmount, setResubmitAmount] = useState('');

  const load = () => api<Demand[]>('/fund-demands').then((d) => { setDemands(d); setLoaded(true); }).catch(console.error);

  useEffect(() => {
    load();
    if (user?.role === 'STATE_PMU') {
      api<BottleneckStat[]>('/reports/pending-approvals').then(setBottlenecks).catch(() => {});
    }
    if (user?.role === 'FIELD_OFFICER') {
      api<WorkItem[]>('/work-items').then(setWorkItems).catch(console.error);
    }
  }, [user]);

  const selected = demands.find((d) => d.id === selectedId) || null;

  const clearAlerts = () => { setError(''); setSelfApproval(false); };

  const raiseDemand = async (e: React.FormEvent) => {
    e.preventDefault();
    clearAlerts();
    try {
      if (raiseDocuments?.length) {
        const fd = new FormData();
        fd.append('workItemId', raiseForm.workItemId);
        fd.append('demandAmount', raiseForm.demandAmount);
        fd.append('documentType', raiseDocumentType);
        Array.from(raiseDocuments).forEach((f) => fd.append('documents', f));
        await api('/fund-demands', { method: 'POST', body: fd });
      } else {
        await api('/fund-demands', { method: 'POST', body: JSON.stringify(raiseForm) });
      }
      setSuccess('Fund demand raised — awaiting Checker');
      setRaiseForm({ workItemId: '', demandAmount: '' });
      setRaiseDocuments(null);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
    }
  };

  const act = async (id: string, action: 'approve' | 'query' | 'rejected') => {
    clearAlerts();
    try {
      const updated = await api<Demand>(`/fund-demands/${id}/action`, { method: 'POST', body: JSON.stringify({ action, remarks }) });
      setSuccess(
        updated.status === 'released' ? 'Demand RELEASED' :
        updated.status === 'queried' ? 'Query sent back to the Maker' :
        updated.status === 'rejected' ? 'Demand rejected' :
        `Advanced to ${updated.status}`
      );
      setRemarks('');
      load();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Action blocked';
      if (message.toLowerCase().includes('self-approval')) setSelfApproval(true);
      else setError(message);
    }
  };

  const resubmit = async (id: string) => {
    clearAlerts();
    try {
      await api(`/fund-demands/${id}/resubmit`, {
        method: 'POST',
        body: JSON.stringify({ demandAmount: resubmitAmount || undefined, remarks }),
      });
      setSuccess('Resubmitted — back with the reviewer who raised the query');
      setRemarks('');
      setResubmitAmount('');
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Resubmit failed');
    }
  };

  const verifyProgress = async (progressId: string) => {
    clearAlerts();
    try {
      await api(`/progress/${progressId}/verify`, { method: 'PATCH' });
      setSuccess('Progress entry verified');
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Verification failed');
    }
  };

  if (!user) return null;

  const Alerts = (
    <>
      {error && <div className="alert error">{error}</div>}
      {selfApproval && (
        <div className="alert error">
          <strong>Self-approval prevention:</strong> you already acted on this demand at an earlier stage, or you
          raised it yourself. A different officer has to act here — use <strong>Switch Demo Role</strong> in the
          top navigation.
        </div>
      )}
      {success && <div className="alert success">{success}</div>}
    </>
  );

  const ProgressEvidence = ({ entries }: { entries: ProgressEntry[] }) => (
    <div style={{ marginTop: 12 }}>
      <div className="card-title" style={{ fontSize: '0.95rem' }}>Progress Evidence</div>
      {entries.length === 0 ? (
        <EmptyState title="No progress submitted yet" icon="○" />
      ) : (
        entries.map((p) => (
          <div key={p.id} style={{ borderBottom: '1px solid var(--line)', padding: '10px 0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <strong>{p.progressPercent}% complete</strong>
              <span className={`pill ${p.verified ? 'green' : 'amber'}`}>{p.verified ? 'Verified' : 'Unverified'}</span>
            </div>
            <p className="mono" style={{ fontSize: '0.75rem', color: 'var(--ink-soft)', margin: '4px 0' }}>
              {p.submittedBy.name} ({p.submittedBy.employeeCode}) · {new Date(p.submittedAt).toLocaleDateString()} · geo {p.geoLat.toFixed(4)}, {p.geoLong.toFixed(4)}
            </p>
            {p.milestoneNote && <p style={{ fontSize: '0.85rem', marginBottom: 4 }}>{p.milestoneNote}</p>}
            <PhotoGallery urls={photoList(p)} />
            {p.documents.length > 0 && <DocumentList docs={p.documents} />}
            {!p.verified && user.role === 'CHECKER' && (
              <button className="btn btn-outline" style={{ marginTop: 6 }} onClick={() => verifyProgress(p.id)}>
                Verify this entry
              </button>
            )}
          </div>
        ))
      )}
    </div>
  );

  const ApprovalTrail = ({ demand }: { demand: Demand }) => (
    <table className="data-table" style={{ marginTop: 12 }}>
      <thead>
        <tr><th>Stage</th><th>Officer</th><th>Action</th><th>Timestamp</th><th>Remarks</th></tr>
      </thead>
      <tbody>
        {demand.actions.map((a, i) => (
          <tr key={i}>
            <td className="mono">{a.stage}</td>
            <td>{a.officer.name}</td>
            <td><span className="pill blue">{a.action}</span></td>
            <td className="mono">{new Date(a.timestamp).toLocaleString()}</td>
            <td>{a.remarks || '—'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );

  // ---------- FIELD OFFICER ----------
  if (user.role === 'FIELD_OFFICER') {
    const needsResponse = demands.filter((d) => d.status === 'queried');
    const others = demands.filter((d) => d.status !== 'queried');

    return (
      <>
        <h1 className="page-title">My Fund Demands</h1>
        <p className="page-subtitle">Raise demands against verified progress and track them through to release</p>
        {Alerts}

        <div className="card">
          <div className="card-title">Raise Fund Demand</div>
          <form className="form-grid" onSubmit={raiseDemand}>
            <div className="form-group">
              <label>Work Item</label>
              <select value={raiseForm.workItemId} onChange={(e) => setRaiseForm({ ...raiseForm, workItemId: e.target.value })} required>
                <option value="">Select…</option>
                {workItems.map((w) => (
                  <option key={w.id} value={w.id}>{w.workCode} — eligible {formatCurrency(w.eligibleDemandAmount)}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>Demand Amount (₹)</label>
              <input type="number" value={raiseForm.demandAmount} onChange={(e) => setRaiseForm({ ...raiseForm, demandAmount: e.target.value })} required />
            </div>
            <div className="form-group">
              <label>Bill / Document (optional)</label>
              <input type="file" accept="image/*,application/pdf" multiple onChange={(e) => setRaiseDocuments(e.target.files)} />
            </div>
            <div className="form-group">
              <label>Document Type</label>
              <select value={raiseDocumentType} onChange={(e) => setRaiseDocumentType(e.target.value)}>
                <option value="bill_invoice">Bill / Invoice</option>
                <option value="completion_certificate">Completion Certificate</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div className="form-group full">
              <button type="submit" className="btn btn-gold">Raise Demand</button>
            </div>
          </form>
        </div>

        {needsResponse.length > 0 && (
          <div className="card" style={{ borderLeft: '4px solid var(--amber)' }}>
            <div className="card-title">Needs Your Response</div>
            {needsResponse.map((d) => {
              const query = lastActionOfType(d, 'queried');
              return (
                <div key={d.id} style={{ borderBottom: '1px solid var(--line)', padding: '12px 0' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <strong className="mono">{d.demandCode}</strong>
                    <span>{formatCurrency(d.demandAmount)}</span>
                  </div>
                  <p style={{ fontSize: '0.85rem', color: 'var(--ink-soft)' }}>{d.workItem.project.scheme.schemeName} — {d.workItem.project.district.name}</p>
                  {query && (
                    <div className="alert info" style={{ margin: '8px 0' }}>
                      <strong className="mono">{query.officer.role.replace('_', ' ')} asked:</strong> {query.remarks}
                    </div>
                  )}
                  <div className="form-grid">
                    <div className="form-group">
                      <label>Revised Amount (optional, ₹)</label>
                      <input type="number" placeholder={String(d.demandAmount)} value={selectedId === d.id ? resubmitAmount : ''} onChange={(e) => { setSelectedId(d.id); setResubmitAmount(e.target.value); }} />
                    </div>
                    <div className="form-group">
                      <label>Response / Remarks</label>
                      <input value={selectedId === d.id ? remarks : ''} onChange={(e) => { setSelectedId(d.id); setRemarks(e.target.value); }} />
                    </div>
                    <div className="form-group full">
                      <button className="btn btn-gold" onClick={() => { setSelectedId(d.id); resubmit(d.id); }}>Resubmit</button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="card">
          <div className="card-title">All My Demands</div>
          {loaded && others.length === 0 && needsResponse.length === 0 ? (
            <EmptyState title="No fund demands yet" message="Raise a demand above once you have verified progress on a work item." />
          ) : (
            <table className="data-table">
              <thead><tr><th>Code</th><th>Scheme</th><th>District</th><th>Amount</th><th>Status</th></tr></thead>
              <tbody>
                {others.map((d) => (
                  <tr key={d.id} style={{ cursor: 'pointer' }} onClick={() => setSelectedId(selectedId === d.id ? null : d.id)}>
                    <td className="mono">{d.demandCode}</td>
                    <td>{d.workItem.project.scheme.schemeName}</td>
                    <td>{d.workItem.project.district.name}</td>
                    <td>{formatCurrency(d.demandAmount)}</td>
                    <td><span className="pill blue">{d.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {selected && others.some((d) => d.id === selected.id) && (
          <div className="card">
            <div className="card-title">Approval Trail — {selected.demandCode}</div>
            <ApprovalTrail demand={selected} />
          </div>
        )}
      </>
    );
  }

  // ---------- CHECKER / FINANCE / APPROVER ----------
  if (user.role === 'CHECKER' || user.role === 'FINANCE_OFFICER' || user.role === 'APPROVER') {
    const stage = user.role === 'CHECKER' ? 'checker' : user.role === 'FINANCE_OFFICER' ? 'finance' : 'approver';
    const info = STAGE_INFO[stage];
    const queue = demands.filter((d) => d.status === stage);

    return (
      <>
        <h1 className="page-title">{info.title} Queue</h1>
        <p className="page-subtitle">{info.description}</p>
        {Alerts}

        {loaded && queue.length === 0 ? (
          <div className="card">
            <EmptyState title="Queue is clear" message={`No demands are currently awaiting ${info.title.toLowerCase()} review.`} icon="✓" />
          </div>
        ) : (
          <div className="two-col">
            <div className="card">
              <div className="card-title">Awaiting Your Review ({queue.length})</div>
              {queue.map((d) => (
                <div
                  key={d.id}
                  className="kanban-card"
                  style={{ borderLeftColor: selectedId === d.id ? 'var(--navy)' : undefined, marginBottom: 10 }}
                  onClick={() => setSelectedId(d.id)}
                >
                  <div className="mono">{d.demandCode}</div>
                  <div>{d.workItem.project.scheme.schemeName} — {d.workItem.project.district.name}</div>
                  <strong>{formatCurrency(d.demandAmount)}</strong>
                </div>
              ))}
            </div>

            {selected && (
              <div className="card">
                <div className="card-title">{selected.demandCode}</div>
                <p style={{ marginBottom: 4 }}>{selected.workItem.workCode} — {selected.workItem.workName}</p>
                <p style={{ marginBottom: 8 }}>
                  Requested <strong>{formatCurrency(selected.demandAmount)}</strong> of eligible {formatCurrency(selected.eligibleDemandAmount)}
                </p>

                <div className="card-title" style={{ fontSize: '0.95rem', marginTop: 12 }}>Bill / Document (attached with this demand)</div>
                <DocumentList docs={selected.documents} />

                <ProgressEvidence entries={selected.workItem.progress} />

                <div className="form-group" style={{ marginTop: 16 }}>
                  <label>Remarks</label>
                  <input value={remarks} onChange={(e) => setRemarks(e.target.value)} placeholder="Optional — required for query/reject" />
                </div>
                <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                  <button className="btn btn-gold" onClick={() => act(selected.id, 'approve')}>Approve</button>
                  <button className="btn btn-outline" onClick={() => act(selected.id, 'query')}>Raise Query</button>
                  <button className="btn btn-danger" onClick={() => act(selected.id, 'rejected')}>Reject</button>
                </div>

                <ApprovalTrail demand={selected} />
              </div>
            )}
          </div>
        )}
      </>
    );
  }

  // ---------- STATE_PMU: compact oversight board ----------
  const columns = ['checker', 'finance', 'approver', 'queried', 'released'] as const;
  const columnEmptyCopy: Record<string, string> = {
    checker: 'Nothing awaiting Checker.',
    finance: 'Nothing awaiting Finance.',
    approver: 'Nothing awaiting Approver.',
    queried: 'Nothing queried right now.',
    released: 'Nothing released yet.',
  };

  return (
    <>
      <h1 className="page-title">Fund Workflow — Oversight</h1>
      <p className="page-subtitle">State-wide view across every stage. Maker → Checker → Finance → Approver — no bypass, no self-approval.</p>
      {Alerts}

      {bottlenecks.length > 0 && (
        <div className="bottleneck-strip">
          {bottlenecks.map((b) => (
            <div key={b.stage} className="bottleneck-item">
              <div className="mono bottleneck-stage">{b.stage}</div>
              <div className="bottleneck-count">{b.count}</div>
              <div className="bottleneck-days">{b.count > 0 ? `avg ${b.avgDaysStuck}d stuck` : 'clear'}</div>
            </div>
          ))}
        </div>
      )}

      <div className="kanban" style={{ gridTemplateColumns: 'repeat(5, 1fr)', marginBottom: 24 }}>
        {columns.map((col) => {
          const cards = demands.filter((d) => d.status === col);
          return (
            <div key={col} className="kanban-col">
              <div className="kanban-col-header">{col}</div>
              <div className="kanban-cards">
                {cards.length === 0 && loaded ? (
                  <div className="kanban-empty">
                    <EmptyState title="Nothing here" message={columnEmptyCopy[col]} icon="○" />
                  </div>
                ) : (
                  cards.map((d) => (
                    <div key={d.id} className="kanban-card" onClick={() => setSelectedId(d.id)}>
                      <div className="mono">{d.demandCode}</div>
                      <div>{d.workItem.project.scheme.schemeName}</div>
                      <div>{d.workItem.project.district.name}</div>
                      <strong>{formatCurrency(d.demandAmount)}</strong>
                    </div>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>

      {selected && (
        <div className="card">
          <div className="card-title">{selected.demandCode}</div>
          <p style={{ marginBottom: 8 }}>{selected.workItem.workCode} — {selected.workItem.workName} · {formatCurrency(selected.demandAmount)}</p>

          <div className="card-title" style={{ fontSize: '0.95rem' }}>Bill / Document (attached with this demand)</div>
          <DocumentList docs={selected.documents} />
          <ProgressEvidence entries={selected.workItem.progress} />

          {['checker', 'finance', 'approver'].includes(selected.status) && (
            <>
              <div className="form-group" style={{ marginBottom: 8 }}>
                <label>Remarks</label>
                <input value={remarks} onChange={(e) => setRemarks(e.target.value)} />
              </div>
              <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                <button className="btn btn-gold" onClick={() => act(selected.id, 'approve')}>Approve</button>
                <button className="btn btn-outline" onClick={() => act(selected.id, 'query')}>Raise Query</button>
                <button className="btn btn-danger" onClick={() => act(selected.id, 'rejected')}>Reject</button>
              </div>
            </>
          )}
          <ApprovalTrail demand={selected} />
        </div>
      )}
    </>
  );
}
