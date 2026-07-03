import { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { api, formatCurrency } from '../api/client';
import EmptyState from '../components/EmptyState';

interface SchemeLedger {
  schemeCode: string;
  ceiling: number;
  allocated: number;
  released: number;
  healthStatus: string;
}

interface ProjectStatusRow {
  project: string;
  scheme: string;
  district: string;
  status: string;
  percentComplete: number;
}

export default function DashboardPage() {
  const [stateName, setStateName] = useState('');
  const [kpis, setKpis] = useState<Record<string, number>>({});
  const [kpisLoaded, setKpisLoaded] = useState(false);
  const [deptData, setDeptData] = useState<{ name: string; allocated: number; released: number }[]>([]);
  const [schemeLedger, setSchemeLedger] = useState<SchemeLedger[]>([]);
  const [projectStatus, setProjectStatus] = useState<ProjectStatusRow[]>([]);
  const [projectStatusLoaded, setProjectStatusLoaded] = useState(false);

  useEffect(() => {
    api<{ name: string }[]>('/departments/states').then((s) => setStateName(s[0]?.name || '')).catch(console.error);
    api<Record<string, number>>('/dashboard/kpis').then((d) => { setKpis(d); setKpisLoaded(true); }).catch(console.error);
    api<{ name: string; allocated: number; released: number }[]>('/dashboard/department-utilisation').then(setDeptData).catch(console.error);
    api<SchemeLedger[]>('/dashboard/wallet-ledger').then(setSchemeLedger).catch(console.error);
    api<ProjectStatusRow[]>('/reports/project-status').then((d) => { setProjectStatus(d); setProjectStatusLoaded(true); }).catch(console.error);
  }, []);

  const statusPill = (status: string) => {
    const cls = status === 'completed' ? 'green' : status === 'in_execution' ? 'blue' : status === 'draft' ? 'navy' : 'amber';
    return <span className={`pill ${cls}`}>{status.replace(/_/g, ' ')}</span>;
  };

  return (
    <>
      <h1 className="page-title">{stateName ? `${stateName} — Executive Dashboard` : 'Executive Dashboard'}</h1>
      <p className="page-subtitle">State-level fund governance overview — FY 2026-27</p>

      <div className="kpi-grid">
        <div className="kpi-card gold">
          <div className="kpi-label">Total Scheme Fund</div>
          <div className="kpi-value">{kpisLoaded ? formatCurrency(kpis.totalSchemeFund || 0) : '···'}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Allocated</div>
          <div className="kpi-value">{kpisLoaded ? formatCurrency(kpis.allocated || 0) : '···'}</div>
        </div>
        <div className="kpi-card green">
          <div className="kpi-label">Released</div>
          <div className="kpi-value">{kpisLoaded ? formatCurrency(kpis.released || 0) : '···'}</div>
        </div>
        <div className="kpi-card amber">
          <div className="kpi-label">Remaining Balance</div>
          <div className="kpi-value">{kpisLoaded ? formatCurrency(kpis.remaining || 0) : '···'}</div>
        </div>
        <div className="kpi-card red">
          <div className="kpi-label">Pending Approvals</div>
          <div className="kpi-value">{kpisLoaded ? kpis.pendingApprovals ?? 0 : '···'}</div>
        </div>
      </div>

      <div className="card">
        <div className="card-title">Scheme-wise Ceiling Utilisation</div>
        <p className="page-subtitle" style={{ marginBottom: 16 }}>
          Where each scheme sits against its sanctioned ceiling — spot near-ceiling and under-utilised schemes at a glance.
        </p>
        {schemeLedger.length === 0 ? (
          <EmptyState title="No schemes yet" message="Create a scheme to see ceiling utilisation here." />
        ) : (
          <div className="chart-wrap" style={{ height: Math.max(220, schemeLedger.length * 56) }}>
            <ResponsiveContainer>
              <BarChart data={schemeLedger} layout="vertical" margin={{ left: 16 }}>
                <XAxis type="number" tickFormatter={(v) => `${(v / 1e7).toFixed(0)}Cr`} />
                <YAxis type="category" dataKey="schemeCode" tick={{ fontSize: 11 }} width={90} />
                <Tooltip formatter={(v: number) => formatCurrency(v)} />
                <Legend />
                <Bar dataKey="ceiling" name="Ceiling" fill="#d9d4c5" />
                <Bar dataKey="allocated" name="Allocated" fill="#13315c" />
                <Bar dataKey="released" name="Released" fill="#c9a227" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      <div className="two-col">
        <div className="card">
          <div className="card-title">Department-wise Fund Utilisation</div>
          <div className="chart-wrap">
            <ResponsiveContainer>
              <BarChart data={deptData}>
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tickFormatter={(v) => `${(v / 1e7).toFixed(0)}Cr`} />
                <Tooltip formatter={(v: number) => formatCurrency(v)} />
                <Legend />
                <Bar dataKey="allocated" fill="#13315c" name="Allocated" />
                <Bar dataKey="released" fill="#c9a227" name="Released" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="card">
          <div className="card-title">Work Progress by Project</div>
          {!projectStatusLoaded ? null : projectStatus.length === 0 ? (
            <EmptyState title="No projects yet" message="Sanction a project to see its progress here." />
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Project</th>
                  <th>Scheme</th>
                  <th>Status</th>
                  <th>% Complete</th>
                </tr>
              </thead>
              <tbody>
                {projectStatus.map((p, i) => (
                  <tr key={i}>
                    <td>{p.project}</td>
                    <td>{p.scheme}</td>
                    <td>{statusPill(p.status)}</td>
                    <td>{p.percentComplete}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </>
  );
}
