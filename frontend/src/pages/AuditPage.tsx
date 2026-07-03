import { useEffect, useState } from 'react';
import { api, formatCurrency } from '../api/client';
import EmptyState from '../components/EmptyState';

interface AuditEntry {
  id: string;
  action: string;
  entityType?: string;
  entityId?: string;
  roleAtTime?: string;
  result: string;
  timestamp: string;
  user?: { name: string; employeeCode: string };
}

interface DemandAction {
  stage: string;
  action: string;
  timestamp: string;
  remarks?: string;
  officer: { name: string; role: string };
}

interface DocumentItem {
  id: string;
  fileUrl: string;
  fileName: string;
  documentType: string;
}

interface ProgressEntry {
  id: string;
  progressPercent: number;
  verified: boolean;
  photoUrls: string;
  documents: DocumentItem[];
}

interface Demand {
  id: string;
  demandCode: string;
  demandAmount: number;
  status: string;
  createdAt: string;
  workItem: {
    workCode: string;
    progress: ProgressEntry[];
    project: { scheme: { schemeName: string }; district: { name: string } };
  };
  raisedBy: { name: string; employeeCode: string };
  actions: DemandAction[];
  documents: DocumentItem[];
}

const DOC_TYPE_LABELS: Record<string, string> = {
  bill_invoice: 'Bill / Invoice',
  completion_certificate: 'Completion Certificate',
  other: 'Other',
};

function isImageExtension(name: string) {
  return /\.(jpe?g|png|gif|webp)$/i.test(name);
}

function photoList(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function PhotoThumbs({ urls }: { urls: string[] }) {
  if (urls.length === 0) return null;
  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', margin: '8px 0' }}>
      {urls.map((url, i) => (
        <a key={i} href={url} target="_blank" rel="noreferrer">
          <img src={url} alt="Geo-tagged progress evidence" style={{ width: 72, height: 56, objectFit: 'cover', border: '1px solid var(--line)', borderRadius: 2 }} />
        </a>
      ))}
    </div>
  );
}

function EvidenceThumbs({ docs }: { docs: DocumentItem[] }) {
  if (docs.length === 0) return null;
  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', margin: '8px 0' }}>
      {docs.map((d) => (
        <a key={d.id} href={d.fileUrl} target="_blank" rel="noreferrer" style={{ textDecoration: 'none', textAlign: 'center' }}>
          {isImageExtension(d.fileName) ? (
            <img src={d.fileUrl} alt={d.fileName} style={{ width: 72, height: 56, objectFit: 'cover', border: '1px solid var(--line)', borderRadius: 2, display: 'block' }} />
          ) : (
            <div style={{ width: 72, height: 56, border: '1px solid var(--line)', borderRadius: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--form-bg)' }}>
              <span className="mono" style={{ fontSize: '0.6rem' }}>FILE</span>
            </div>
          )}
          <div className="mono" style={{ fontSize: '0.6rem', marginTop: 2, maxWidth: 72, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {DOC_TYPE_LABELS[d.documentType] || d.documentType}
          </div>
        </a>
      ))}
    </div>
  );
}

export default function AuditPage() {
  const [logs, setLogs] = useState<AuditEntry[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [filters, setFilters] = useState({ role: '', entityType: '', result: '' });
  const [demands, setDemands] = useState<Demand[]>([]);
  const [demandsLoaded, setDemandsLoaded] = useState(false);
  const [demandStatusFilter, setDemandStatusFilter] = useState('');
  const [expandedDemandId, setExpandedDemandId] = useState<string | null>(null);

  const load = () => {
    const params = new URLSearchParams();
    if (filters.role) params.set('role', filters.role);
    if (filters.entityType) params.set('entityType', filters.entityType);
    if (filters.result) params.set('result', filters.result);
    api<AuditEntry[]>(`/audit?${params}`).then((d) => { setLogs(d); setLoaded(true); }).catch(console.error);
  };

  useEffect(() => { load(); }, [filters]);
  useEffect(() => {
    api<Demand[]>('/fund-demands').then((d) => { setDemands(d); setDemandsLoaded(true); }).catch(console.error);
  }, []);

  const resultPill = (r: string) => {
    const cls = r === 'success' ? 'green' : r === 'fail' ? 'red' : 'amber';
    return <span className={`pill ${cls}`}>{r}</span>;
  };

  const statusPill = (s: string) => {
    const cls = s === 'released' ? 'green' : s === 'rejected' ? 'red' : s === 'queried' ? 'amber' : 'blue';
    return <span className={`pill ${cls}`}>{s}</span>;
  };

  const filteredDemands = demandStatusFilter ? demands.filter((d) => d.status === demandStatusFilter) : demands;
  const expandedDemand = demands.find((d) => d.id === expandedDemandId) || null;

  return (
    <>
      <h1 className="page-title">Audit Trail</h1>
      <p className="page-subtitle">Immutable, append-only activity log — CAG-ready</p>

      <div className="card">
        <div className="card-title">Fund Demand Oversight</div>
        <p className="page-subtitle" style={{ fontSize: '0.82rem', marginBottom: 12 }}>
          Every fund demand, its current stage, and its full approval trail — read-only. This view exists so the
          Auditor can see exactly what's pending or resolved on any project without needing action authority on it,
          which would compromise independent verification.
        </p>
        <div className="form-group" style={{ marginBottom: 16, maxWidth: 260 }}>
          <label>Filter by Status</label>
          <select value={demandStatusFilter} onChange={(e) => setDemandStatusFilter(e.target.value)}>
            <option value="">All</option>
            {['checker', 'finance', 'approver', 'queried', 'released', 'rejected'].map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>

        {demandsLoaded && filteredDemands.length === 0 ? (
          <EmptyState title="No matching fund demands" message="Try a different status filter." />
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Code</th>
                <th>Scheme</th>
                <th>District</th>
                <th>Raised By</th>
                <th>Amount</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {filteredDemands.map((d) => (
                <tr key={d.id} style={{ cursor: 'pointer' }} onClick={() => setExpandedDemandId(expandedDemandId === d.id ? null : d.id)}>
                  <td className="mono">{d.demandCode}</td>
                  <td>{d.workItem.project.scheme.schemeName}</td>
                  <td>{d.workItem.project.district.name}</td>
                  <td>{d.raisedBy.name}</td>
                  <td>{formatCurrency(d.demandAmount)}</td>
                  <td>{statusPill(d.status)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {expandedDemand && (
          <div style={{ marginTop: 16 }}>
            <div className="card-title" style={{ fontSize: '0.95rem' }}>Bill / Document — {expandedDemand.demandCode}</div>
            <EvidenceThumbs docs={expandedDemand.documents} />
            {expandedDemand.documents.length === 0 && (
              <p className="mono" style={{ fontSize: '0.75rem', color: 'var(--ink-soft)' }}>No documents attached to this demand.</p>
            )}

            {expandedDemand.workItem.progress.map((p) => (
              <div key={p.id} style={{ margin: '8px 0' }}>
                <p className="mono" style={{ fontSize: '0.75rem', color: 'var(--ink-soft)' }}>
                  Progress evidence ({p.progressPercent}% — {p.verified ? 'verified' : 'unverified'})
                </p>
                <PhotoThumbs urls={photoList(p.photoUrls)} />
                <EvidenceThumbs docs={p.documents} />
              </div>
            ))}

            <div className="card-title" style={{ fontSize: '0.95rem' }}>Approval Trail — {expandedDemand.demandCode}</div>
            <table className="data-table">
              <thead>
                <tr><th>Stage</th><th>Officer</th><th>Action</th><th>Timestamp</th><th>Remarks</th></tr>
              </thead>
              <tbody>
                {expandedDemand.actions.map((a, i) => (
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
          </div>
        )}
      </div>

      <div className="card">
        <div className="card-title">System Activity Log</div>
        <div className="form-grid" style={{ marginBottom: 16 }}>
          <div className="form-group">
            <label>Role</label>
            <select value={filters.role} onChange={(e) => setFilters({ ...filters, role: e.target.value })}>
              <option value="">All</option>
              {['STATE_PMU', 'FIELD_OFFICER', 'CHECKER', 'FINANCE_OFFICER', 'APPROVER', 'AUDITOR'].map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label>Entity Type</label>
            <select value={filters.entityType} onChange={(e) => setFilters({ ...filters, entityType: e.target.value })}>
              <option value="">All</option>
              {['FundDemand', 'Project', 'Scheme', 'ProgressEntry', 'User'].map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label>Result</label>
            <select value={filters.result} onChange={(e) => setFilters({ ...filters, result: e.target.value })}>
              <option value="">All</option>
              <option value="success">Success</option>
              <option value="fail">Fail</option>
              <option value="flagged">Flagged</option>
            </select>
          </div>
        </div>

        {loaded && logs.length === 0 ? (
          <EmptyState title="No matching audit entries" message="Try widening or clearing the filters above." />
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>Officer</th>
                <th>Role</th>
                <th>Action</th>
                <th>Entity</th>
                <th>Result</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((l) => (
                <tr key={l.id}>
                  <td className="mono">{new Date(l.timestamp).toLocaleString()}</td>
                  <td>{l.user?.name || '—'} <span className="mono">{l.user?.employeeCode}</span></td>
                  <td className="mono">{l.roleAtTime || '—'}</td>
                  <td>{l.action}</td>
                  <td className="mono">{l.entityType} {l.entityId?.slice(0, 8)}</td>
                  <td>{resultPill(l.result)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
