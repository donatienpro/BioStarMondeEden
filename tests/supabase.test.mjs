// Test du stockage Supabase avec un faux serveur PostgREST (aucun accès réseau).
import assert from 'node:assert/strict';
import { createSupabaseStore } from '../server/supabase-store.js';

const tables = {};
const calls = [];
function fakeFetch(url, init) {
  const u = new URL(url);
  const table = u.pathname.replace('/rest/v1/', '');
  calls.push({ method: init.method, table, auth: init.headers.Authorization, apikey: init.headers.apikey });
  tables[table] ||= [];
  const rows = tables[table];
  const filters = [...u.searchParams].filter(([k]) => !['order', 'limit', 'select'].includes(k)).map(([k, v]) => [k, v.replace(/^eq\./, '')]);
  const match = (r) => filters.every(([k, v]) => String(r[k]) === v);
  const reply = (status, body, headers = {}) => Promise.resolve(new Response(status === 204 || body === undefined ? null : JSON.stringify(body), { status, headers }));
  if (init.method === 'GET') {
    const out = rows.filter(match);
    return reply(200, out.slice(0, Number(u.searchParams.get('limit') || 1000)), { 'content-range': `0-0/${out.length}` });
  }
  if (init.method === 'POST') {
    const row = JSON.parse(init.body);
    if (rows.some((r) => r.id === row.id || (row.payment_id && r.payment_id === row.payment_id))) return reply(409, { code: '23505', message: 'duplicate key' });
    rows.push(row);
    return reply(201);
  }
  if (init.method === 'PATCH') {
    const patch = JSON.parse(init.body);
    rows.filter(match).forEach((r) => Object.assign(r, patch));
    return reply(204);
  }
  return reply(405, {});
}

const store = createSupabaseStore({ url: 'https://x.supabase.co/', serviceKey: 'service-secret', fetchImpl: fakeFetch });
const ok = (name) => console.log('OK  ', name);

await store.insertOrder({ id: 'o1', username: 'alice', product_id: 'p1', amount: 0.2, memo: 'Test', payment_id: 'pay1', status: 'approved', created_at: '2026-11-14T00:00:00.000Z' });
assert.equal(calls.at(-1).table, 'bsme_orders'); ok('préfixe de table bsme_');
assert.equal(calls.at(-1).auth, 'Bearer service-secret'); ok('clé service envoyée côté serveur');
assert.equal((await store.getOrder('pay1')).username, 'alice'); ok('lecture par payment_id');
await assert.rejects(() => store.insertOrder({ id: 'o2', username: 'bob', product_id: 'p1', amount: 0.2, memo: 'T', payment_id: 'pay1', status: 'approved', created_at: 'x' }), (e) => e.duplicate === true); ok('doublon signalé');
await store.completeOrder('pay1', 'tx9');
const done = await store.getOrder('pay1');
assert.equal(done.status, 'completed'); assert.equal(done.txid, 'tx9'); ok('finalisation');
await store.cancelOrder('pay1');
assert.equal((await store.getOrder('pay1')).status, 'completed'); ok('une commande finalisée ne s’annule pas');
assert.equal((await store.listOrders({ username: 'alice' })).length, 1);
assert.equal((await store.listOrders({ username: 'bob' })).length, 0); ok('liste filtrée par compte');
assert.equal(await store.count('orders'), 1); ok('comptage');
await store.insert('farms', { id: 'f1', owner: 'alice', name: 'Ferme', country: 'BF', region: 'Centre', area_ha: 2, show_training: true, created_at: 'a', updated_at: 'a' });
const farm = await store.get('farms', 'f1');
assert.equal(farm.show_training, true); assert.equal(farm.locality, null); ok('exploitation : booléens et valeurs vides');
await store.update('farms', 'f1', { locality: null, name: 'Ferme 2' });
assert.equal((await store.get('farms', 'f1')).name, 'Ferme 2'); ok('mise à jour');
assert.equal(await store.get('farms', 'absent'), null); ok('ligne absente : null');
await assert.rejects(() => store.find('orders', { nope: 1 })); ok('filtre inconnu refusé');
await assert.rejects(() => store.find('inconnue')); ok('table inconnue refusée');
await assert.rejects(() => createSupabaseStore({ url: '', serviceKey: '' }).count('orders'), /non configuré/); ok('configuration manquante expliquée');
assert.throws(() => createSupabaseStore({ url: 'u', serviceKey: 'k', tablePrefix: 'Bad Prefix!' })); ok('préfixe invalide refusé');
console.log('Tous les tests Supabase sont passés');
