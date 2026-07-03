export interface User {
  id: string;
  employeeCode: string;
  name: string;
  email?: string;
  role: string;
  departmentId?: string | null;
  departmentName?: string;
  landingPage?: string;
}

const API = '/api';

export function getToken() {
  return localStorage.getItem('sasci_token');
}

export function setAuth(token: string, user: User) {
  localStorage.setItem('sasci_token', token);
  localStorage.setItem('sasci_user', JSON.stringify(user));
}

export function getUser(): User | null {
  const raw = localStorage.getItem('sasci_user');
  return raw ? JSON.parse(raw) : null;
}

export function clearAuth() {
  localStorage.removeItem('sasci_token');
  localStorage.removeItem('sasci_user');
}

export interface DemoUser {
  employeeCode: string;
  name: string;
  role: string;
  departmentName?: string;
}

export function getDemoUsers() {
  return api<DemoUser[]>('/auth/demo-users');
}

export function demoLogin(employeeCode: string) {
  return api<{ token: string; user: User; landingPage: string }>('/auth/demo-login', {
    method: 'POST',
    body: JSON.stringify({ employeeCode }),
  });
}

export async function api<T = unknown>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>),
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (!(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }

  const res = await fetch(`${API}${path}`, { ...options, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || data.error || `Request failed (${res.status})`);
  return data as T;
}

export function formatCurrency(n: number) {
  if (n >= 1e7) return `₹${(n / 1e7).toFixed(2)} Cr`;
  if (n >= 1e5) return `₹${(n / 1e5).toFixed(2)} L`;
  return `₹${n.toLocaleString('en-IN')}`;
}

export const ROLE_LABELS: Record<string, string> = {
  STATE_PMU: 'State PMU',
  DEPARTMENT_OFFICER: 'Department Officer',
  FIELD_OFFICER: 'Field Officer (Maker)',
  CHECKER: 'Checker',
  FINANCE_OFFICER: 'Finance Officer',
  APPROVER: 'Approver',
  AUDITOR: 'Auditor',
  SYSTEM_ADMIN: 'System Admin',
};
