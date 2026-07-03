#!/usr/bin/env node
/** Quick smoke test for the 8-step demo flow — run after `npm run dev` */
const API = 'http://localhost:3001/api';

async function login(code) {
  const res = await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ employeeCode: code, password: 'password123', otp: '123456' }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error);
  return data.token;
}

async function main() {
  const fo = await login('FO-MH-10233');
  const items = await fetch(`${API}/work-items`, { headers: { Authorization: `Bearer ${fo}` } }).then((r) => r.json());
  const workId = items[0].id;

  const eligible = await fetch(`${API}/work-items/${workId}/eligible-demand`, {
    headers: { Authorization: `Bearer ${fo}` },
  }).then((r) => r.json());
  console.log('Eligible demand:', eligible.eligibleDemandAmount);

  const demand = await fetch(`${API}/fund-demands`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${fo}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ workItemId: workId, demandAmount: 5000000 }),
  }).then((r) => r.json());
  if (demand.error) throw new Error(demand.error);
  console.log('Demand created:', demand.demandCode, 'status:', demand.status);

  for (const [code, stage] of [
    ['CHK-MH-20001', 'checker'],
    ['FIN-MH-30001', 'finance'],
    ['APP-MH-40001', 'approver'],
  ]) {
    const token = await login(code);
    const updated = await fetch(`${API}/fund-demands/${demand.id}/action`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'approve', remarks: `${stage} approved` }),
    }).then((r) => r.json());
    if (updated.error) throw new Error(`${stage}: ${updated.error}`);
    console.log(`${stage} →`, updated.status);
  }

  const pmu = await login('PMU-MH-00001');
  const ledger = await fetch(`${API}/dashboard/wallet-ledger`, {
    headers: { Authorization: `Bearer ${pmu}` },
  }).then((r) => r.json());
  const rural = ledger.find((l) => l.schemeCode === 'GSY-2026');
  console.log('Wallet released (Gram Sadak Yojna):', rural?.released);

  const auditor = await login('AUD-MH-50001');
  const audit = await fetch(`${API}/audit?entityType=FundDemand`, {
    headers: { Authorization: `Bearer ${auditor}` },
  }).then((r) => r.json());
  console.log('Audit entries for FundDemand:', audit.length);
  console.log('Demo flow: PASS');
}

main().catch((e) => {
  console.error('Demo flow: FAIL —', e.message);
  process.exit(1);
});
