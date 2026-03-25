const BASE = '/api';

export async function getConnections() {
  const res = await fetch(`${BASE}/connections`);
  if (!res.ok) throw new Error('Failed to fetch connections');
  return res.json();
}

export async function getConnection(id) {
  const res = await fetch(`${BASE}/connections/${id}`);
  if (!res.ok) throw new Error('Failed to fetch connection');
  return res.json();
}

export async function createConnection(data) {
  const res = await fetch(`${BASE}/connections`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to create connection');
  return res.json();
}

export async function updateConnection(id, data) {
  const res = await fetch(`${BASE}/connections/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to update connection');
  return res.json();
}

export async function deleteConnection(id) {
  const res = await fetch(`${BASE}/connections/${id}`, {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error('Failed to delete connection');
  return res.json();
}

export async function testConnection(data) {
  const res = await fetch(`${BASE}/connections/test`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return res.json();
}
