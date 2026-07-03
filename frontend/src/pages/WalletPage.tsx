import { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { api, formatCurrency } from '../api/client';
import EmptyState from '../components/EmptyState';

interface LedgerEntry {
  schemeCode: string;
  schemeName: string;
  ceiling: number;
  allocated: number;
  demanded: number;
  approved: number;
  released: number;
  utilised: number;
  remaining: number;
  healthStatus: string;
}

const STAGE_COLORS = { allocated: '#13315c', demanded: '#2c5f8a', approved: '#b8762e', released: '#c9a227', utilised: '#2f7d5c' };

export default function WalletPage() {
  const [ledger, setLedger] = useState<LedgerEntry[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    api<LedgerEntry[]>('/dashboard/wallet-ledger').then((d) => { setLedger(d); setLoaded(true); }).catch(console.error);
  }, []);

  const healthPill = (s: string) => {
    const cls = s.includes('Ceiling') ? 'red' : s.includes('Near') ? 'amber' : s.includes('Under') ? 'blue' : 'green';
    return <span className={`pill ${cls}`}>{s}</span>;
  };

  return (
    <>
      <h1 className="page-title">Wallet Ledger</h1>
      <p className="page-subtitle">Scheme-wise fund flow governance</p>

      {!loaded ? null : ledger.length === 0 ? (
        <div className="card">
          <EmptyState title="No schemes yet" message="Create a scheme and allocate funds to departments to see the wallet ledger." />
        </div>
      ) : (
        <div className="card">
          <div className="card-title">Fund Flow by Scheme</div>
          <div className="chart-wrap" style={{ height: 340 }}>
            <ResponsiveContainer>
              <BarChart data={ledger} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
                <XAxis dataKey="schemeCode" tick={{ fontSize: 11 }} />
                <YAxis tickFormatter={(v) => `${(v / 1e7).toFixed(0)}Cr`} />
                <Tooltip formatter={(v: number) => formatCurrency(v)} />
                <Legend />
                <Bar dataKey="allocated" name="Allocated" fill={STAGE_COLORS.allocated} />
                <Bar dataKey="demanded" name="Demanded" fill={STAGE_COLORS.demanded} />
                <Bar dataKey="approved" name="Approved" fill={STAGE_COLORS.approved} />
                <Bar dataKey="released" name="Released" fill={STAGE_COLORS.released} />
                <Bar dataKey="utilised" name="Utilised" fill={STAGE_COLORS.utilised} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      <div className="card">
        <div className="card-title">Scheme Ledger</div>
        <p className="page-subtitle" style={{ marginBottom: 16, fontSize: '0.82rem' }}>
          <strong>Health</strong> flags scheme-level risk at a glance:{' '}
          <span className="pill green">Healthy</span> normal pace ·{' '}
          <span className="pill amber">Near Ceiling</span> allocated ≥90% of ceiling ·{' '}
          <span className="pill red">Ceiling Reached</span> fully allocated, no headroom left ·{' '}
          <span className="pill blue">Under-utilised</span> released &lt;30% of what's allocated.
        </p>
        <table className="data-table">
          <thead>
            <tr>
              <th>Scheme</th>
              <th>Ceiling</th>
              <th>Allocated</th>
              <th>Demanded</th>
              <th>Approved</th>
              <th>Released</th>
              <th>Utilised</th>
              <th>Health</th>
            </tr>
          </thead>
          <tbody>
            {ledger.map((l) => (
              <tr key={l.schemeCode}>
                <td>
                  <div className="mono">{l.schemeCode}</div>
                  <div>{l.schemeName}</div>
                </td>
                <td>{formatCurrency(l.ceiling)}</td>
                <td>{formatCurrency(l.allocated)}</td>
                <td>{formatCurrency(l.demanded)}</td>
                <td>{formatCurrency(l.approved)}</td>
                <td>{formatCurrency(l.released)}</td>
                <td>{formatCurrency(l.utilised)}</td>
                <td>{healthPill(l.healthStatus)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
