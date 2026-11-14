// Stockage dans Supabase (Postgres) par l'API REST PostgREST : aucune dépendance à installer.
// Les tables (supabase/schema.sql, générées à partir de core/schema.js) portent le préfixe « bsme_ ».
// La clé « service_role » reste exclusivement côté serveur : les tables ont la sécurité par ligne activée, sans politique publique.
import { TABLES, columnKeys, booleanKeys } from '../core/schema.js';

export const DEFAULT_PREFIX = 'bsme_';
const PREFIX_RE = /^[a-z][a-z0-9_]{0,20}$/;

export function createSupabaseStore({ url, serviceKey, tablePrefix = DEFAULT_PREFIX, fetchImpl }) {
  const doFetch = (...args) => (fetchImpl || globalThis.fetch)(...args);
  const base = String(url || '').replace(/\/+$/, '');
  const prefix = tablePrefix === undefined || tablePrefix === null ? DEFAULT_PREFIX : String(tablePrefix);
  if (prefix && !PREFIX_RE.test(prefix)) throw new Error('SUPABASE_TABLE_PREFIX invalide : minuscules, chiffres ou souligné, par exemple bsme_.');
  const checkTable = (table) => { if (!TABLES[table]) throw new Error('Table inconnue : ' + table); };

  async function call(method, table, { query = '', body, headers = {} } = {}) {
    if (!base || !serviceKey) throw new Error('Supabase non configuré : SUPABASE_URL ou SUPABASE_SERVICE_KEY manquant.');
    const response = await doFetch(`${base}/rest/v1/${prefix}${table}${query}`, {
      method,
      headers: {
        apikey: serviceKey,
        Authorization: 'Bearer ' + serviceKey,
        'Content-Type': 'application/json',
        ...headers
      },
      body: body === undefined ? undefined : JSON.stringify(body)
    });
    const text = await response.text();
    let data = null;
    try { data = text ? JSON.parse(text) : null; } catch { data = null; }
    if (!response.ok) {
      const err = new Error(`Supabase ${method} ${prefix}${table} : HTTP ${response.status} ${(data && (data.message || data.error)) || ''}`.trim());
      err.code = response.status;
      err.pgCode = data && data.code;
      throw err;
    }
    return { data, headers: response.headers };
  }

  function fromRow(table, row) {
    if (!row) return null;
    const out = { id: row.id };
    for (const k of columnKeys(table)) out[k] = row[k] === undefined ? null : row[k];
    for (const k of booleanKeys(table)) out[k] = Boolean(out[k]);
    return out;
  }
  // Création : les valeurs vides sont omises. Mise à jour : null efface la valeur, undefined la laisse intacte.
  function pick(table, data, keepNull = false) {
    const out = {};
    for (const k of columnKeys(table)) if (data[k] !== undefined && (keepNull || data[k] !== null)) out[k] = data[k];
    return out;
  }

  async function find(table, where = {}, limit = 200) {
    checkTable(table);
    const keys = columnKeys(table);
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(where || {})) {
      if (!keys.includes(k)) throw new Error('Filtre inconnu : ' + k);
      params.append(k, 'eq.' + (typeof v === 'boolean' ? String(v) : String(v)));
    }
    params.set('order', 'created_at.desc');
    params.set('limit', String(Math.max(1, Math.min(Number(limit) || 200, 1000))));
    const { data } = await call('GET', table, { query: '?' + params.toString() });
    return (data || []).map((r) => fromRow(table, r));
  }
  async function get(table, id) {
    checkTable(table);
    const params = new URLSearchParams({ id: 'eq.' + id, limit: '1' });
    const { data } = await call('GET', table, { query: '?' + params.toString() });
    return fromRow(table, (data || [])[0]);
  }
  async function insert(table, row) {
    checkTable(table);
    try {
      await call('POST', table, { body: { id: row.id, ...pick(table, row) }, headers: { Prefer: 'return=minimal' } });
    } catch (e) {
      // 23505 : violation d'unicité (doublon), 409 : conflit.
      if (e.code === 409 || e.pgCode === '23505') { const err = new Error('Doublon'); err.duplicate = true; throw err; }
      throw e;
    }
  }
  async function update(table, id, data) {
    checkTable(table);
    const body = pick(table, data, true);
    if (!Object.keys(body).length) return;
    const params = new URLSearchParams({ id: 'eq.' + id });
    await call('PATCH', table, { query: '?' + params.toString(), body, headers: { Prefer: 'return=minimal' } });
  }
  async function count(table) {
    checkTable(table);
    const { headers } = await call('GET', table, { query: '?select=id&limit=1', headers: { Prefer: 'count=exact' } });
    const range = headers.get('content-range') || '';
    const total = Number(range.split('/')[1]);
    return Number.isFinite(total) ? total : 0;
  }

  const getOrder = async (paymentId) => (await find('orders', { payment_id: paymentId }, 1))[0] || null;

  return {
    kind: 'supabase',
    find, get, insert, update, count,
    getOrder,
    async listOrders({ username, limit = 200 } = {}) { return find('orders', username ? { username } : {}, limit); },
    async insertOrder(o) {
      await insert('orders', { id: o.id, username: o.username, product_id: o.product_id, amount: o.amount, memo: o.memo, payment_id: o.payment_id, status: o.status, created_at: o.created_at });
    },
    async completeOrder(paymentId, txid) {
      const order = await getOrder(paymentId);
      if (!order) throw new Error('Commande introuvable pour la finalisation.');
      await update('orders', order.id, { txid, status: 'completed' });
    },
    async cancelOrder(paymentId) {
      const order = await getOrder(paymentId);
      if (order && order.status !== 'completed') await update('orders', order.id, { status: 'cancelled' });
    }
  };
}
