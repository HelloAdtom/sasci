import { useEffect, useState } from 'react';
import {
  BarChart,
  Bar,
  ComposedChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { api, formatCurrency } from '../api/client';
import EmptyState from '../components/EmptyState';

interface AllocationRow {
  scheme: string;
  ceiling: number;
  allocated: number;
  released: number;
  utilised: number;
  balance: number;
}

interface PendingRow {
  stage: string;
  count: number;
  avgDaysStuck: number;
  oldestItem: string | null;
}

interface ProjectRow {
  project: string;
  scheme: string;
  district: string;
  status: string;
  percentComplete: number;
}

const STATUS_COLORS: Record<string, string> = {
  draft: '#5a6472',
  pending_sanction: '#b8762e',
  sanctioned: '#2c5f8a',
  in_execution: '#c9a227',
  completed: '#2f7d5c',
};

export default function ReportsPage() {
  const [allocation, setAllocation] = useState<AllocationRow[]>([]);
  const [pending, setPending] = useState<PendingRow[]>([]);
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    Promise.all([
      api<AllocationRow[]>('/reports/scheme-allocation').then(setAllocation),
      api<PendingRow[]>('/reports/pending-approvals').then(setPending),
      api<ProjectRow[]>('/reports/project-status').then(setProjects),
    ])
      .then(() => setLoaded(true))
      .catch(console.error);
  }, []);

  const statusCounts = Object.entries(
    projects.reduce<Record<string, number>>((acc, p) => {
      acc[p.status] = (acc[p.status] || 0) + 1;
      return acc;
    }, {})
  ).map(([status, value]) => ({ name: status.replace(/_/g, ' '), status, value }));

  return (
    <>
      <h1 className="page-title">Reports & Analytics</h1>
      <p className="page-subtitle">Scheme allocation, pending approvals, and project status</p>

      <div className="two-col">
        <div className="card">
          <div className="card-title">Scheme Allocation vs Utilisation</div>
          {!loaded ? null : allocation.length === 0 ? (
            <EmptyState title="No schemes yet" message="Create a scheme to see allocation vs utilisation." />
          ) : (
            <div className="chart-wrap">
              <ResponsiveContainer>
                <BarChart data={allocation}>
                  <XAxis dataKey="scheme" tick={{ fontSize: 10 }} interval={0} angle={-15} textAnchor="end" height={50} />
                  <YAxis tickFormatter={(v) => `${(v / 1e7).toFixed(0)}Cr`} />
                  <Tooltip formatter={(v: number) => formatCurrency(v)} />
                  <Legend />
                  <Bar dataKey="allocated" name="Allocated" fill="#13315c" />
                  <Bar dataKey="released" name="Released" fill="#c9a227" />
                  <Bar dataKey="utilised" name="Utilised" fill="#2f7d5c" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        <div className="card">
          <div className="card-title">Project Status Distribution</div>
          <p className="page-subtitle" style={{ fontSize: '0.8rem', marginBottom: 8 }}>
            How many projects are at each stage of their lifecycle (draft → sanctioned → in execution → completed).
          </p>
          {!loaded ? null : statusCounts.length === 0 ? (
            <EmptyState title="No projects yet" message="Sanction a project to see status distribution." />
          ) : (
            <div className="chart-wrap">
              <ResponsiveContainer>
                <PieChart>
                  <Pie data={statusCounts} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={45} outerRadius={90}>
                    {statusCounts.map((s, i) => (
                      <Cell key={i} fill={STATUS_COLORS[s.status] || '#5a6472'} />
                    ))}
                  </Pie>
                  <Legend />
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      <div className="card">
        <div className="card-title">Pending Approvals — Bottleneck by Stage</div>
        {!loaded ? null : pending.every((p) => p.count === 0) ? (
          <EmptyState title="No pending approvals" message="Every fund demand has moved past every stage — nothing is stuck." icon="✓" />
        ) : (
          <div className="chart-wrap">
            <ResponsiveContainer>
              <ComposedChart data={pending}>
                <XAxis dataKey="stage" tick={{ fontSize: 11 }} />
                <YAxis yAxisId="left" allowDecimals={false} label={{ value: 'Pending count', angle: -90, position: 'insideLeft', fontSize: 11 }} />
                <YAxis yAxisId="right" orientation="right" label={{ value: 'Avg days stuck', angle: 90, position: 'insideRight', fontSize: 11 }} />
                <Tooltip />
                <Legend />
                <Bar yAxisId="left" dataKey="count" name="Pending count" fill="#2c5f8a" />
                <Line yAxisId="right" dataKey="avgDaysStuck" name="Avg days stuck" stroke="#a23e3e" strokeWidth={2} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      <div className="card">
        <div className="card-title">Scheme Allocation vs Utilisation (detail)</div>
        {allocation.length === 0 ? (
          <EmptyState title="No data" message="Nothing to report yet." />
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Scheme</th>
                <th>Ceiling</th>
                <th>Allocated</th>
                <th>Released</th>
                <th>Utilised</th>
                <th>Balance</th>
              </tr>
            </thead>
            <tbody>
              {allocation.map((r, i) => (
                <tr key={i}>
                  <td>{r.scheme}</td>
                  <td>{formatCurrency(r.ceiling)}</td>
                  <td>{formatCurrency(r.allocated)}</td>
                  <td>{formatCurrency(r.released)}</td>
                  <td>{formatCurrency(r.utilised)}</td>
                  <td>{formatCurrency(r.balance)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="card">
        <div className="card-title">Pending Approvals (detail)</div>
        {pending.every((p) => p.count === 0) ? (
          <EmptyState title="No pending approvals" message="Nothing stuck at any stage right now." icon="✓" />
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Stage</th>
                <th>Pending</th>
                <th>Avg Days Stuck</th>
                <th>Oldest Item</th>
              </tr>
            </thead>
            <tbody>
              {pending.map((r, i) => (
                <tr key={i}>
                  <td className="mono">{r.stage}</td>
                  <td>{r.count}</td>
                  <td>{r.avgDaysStuck}</td>
                  <td className="mono">{r.oldestItem || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="card">
        <div className="card-title">Project Status Report</div>
        {projects.length === 0 ? (
          <EmptyState title="No projects yet" message="Sanction a project to see it here." />
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Project</th>
                <th>Scheme</th>
                <th>District</th>
                <th>Status</th>
                <th>% Complete</th>
              </tr>
            </thead>
            <tbody>
              {projects.map((r, i) => (
                <tr key={i}>
                  <td>{r.project}</td>
                  <td>{r.scheme}</td>
                  <td>{r.district}</td>
                  <td><span className="pill blue">{r.status}</span></td>
                  <td>{r.percentComplete}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
