// @ts-check
// seam/seam.js — THE SEAM: stable REST contract + v1 in-browser mock (DEC-39/41/42).
//
// Everything heavy or persistent sits behind these routes; in v1 they are
// served synchronously in-browser, but the client speaks only the contract
// (method + path + body), so networked services can swap in with no client
// change. Every planning response carries kernel_version + schema_version.
// Async-capable shape: endpoints may return {job_id}; the v1 mock answers
// directly but uses the same envelope.

export const SCHEMA_VERSION = 'v1-skeleton';

/**
 * The in-browser mock service. Routes mirror remit-seam-contract.md §A/§B.
 * @param {{objects: import('../stores/stores.js').ObjectStore,
 *          logs: import('../stores/stores.js').LogStore,
 *          planHandful: (body: any) => Promise<any>}} deps
 */
export function createSeamServer({ objects, logs, planHandful }) {
  /**
   * @param {string} method
   * @param {string} path
   * @param {any} [body]
   */
  return async function route(method, path, body) {
    const err = (code, message) => ({ error: { code, message } });

    let m;
    if (method === 'PUT' && path === '/objects') {
      const { id } = await objects.put(body.type, body.body);
      return { id };
    }
    if (method === 'POST' && path === '/objects/exists') {
      return objects.exists(body.ids);
    }
    if ((m = path.match(/^\/objects\/([^/]+)\/lineage$/)) && method === 'GET') {
      return { chain: objects.lineage(m[1]) };
    }
    if ((m = path.match(/^\/objects\/([^/]+)$/)) && method === 'GET') {
      const found = objects.get(m[1]);
      return found ? { type: found.type, body: found.body } : err('not_found', `no object ${m[1]}`);
    }
    if (method === 'POST' && path === '/plan/handful') {
      const out = await planHandful(body);
      return { ...out, schema_version: SCHEMA_VERSION };
    }
    if ((m = path.match(/^\/logs\/([^/]+)\/append$/)) && method === 'POST') {
      return logs.append(m[1], body);
    }
    if ((m = path.match(/^\/logs\/([^/]+)$/)) && method === 'GET') {
      return logs.get(m[1]);
    }
    return err('not_found', `${method} ${path} is not a seam route`);
  };
}

/**
 * Seam client — the only way the client half talks to services (architecture §5).
 * Logs every call so the seam is visible in the demo.
 */
export class SeamClient {
  /** @param {(method: string, path: string, body?: any) => Promise<any>} route */
  constructor(route) {
    this.route = route;
    /** @type {{n: number, method: string, path: string, note: string}[]} */
    this.traffic = [];
    /** @type {((t: SeamClient['traffic']) => void)[]} */
    this.listeners = [];
  }

  /** @param {(t: SeamClient['traffic']) => void} fn */
  onTraffic(fn) {
    this.listeners.push(fn);
  }

  /**
   * @param {string} method
   * @param {string} path
   * @param {any} [body]
   */
  async call(method, path, body) {
    const res = await this.route(method, path, body);
    const note = res?.error ? `error: ${res.error.code}`
      : res?.id ? `→ ${res.id.slice(7, 15)}`
      : res?.plans ? `→ ${res.plans.length} plans`
      : Array.isArray(res) ? `→ ${res.length} entries`
      : '→ ok';
    this.traffic.push({ n: this.traffic.length + 1, method, path, note });
    for (const fn of this.listeners) fn(this.traffic);
    if (res?.error) throw new Error(`${res.error.code}: ${res.error.message}`);
    return res;
  }

  putObject(type, body) { return this.call('PUT', '/objects', { type, body }); }
  getObject(id) { return this.call('GET', `/objects/${id}`); }
  planHandful(body) { return this.call('POST', '/plan/handful', body); }
  appendLog(missionId, entry) { return this.call('POST', `/logs/${missionId}/append`, entry); }
  getLog(missionId) { return this.call('GET', `/logs/${missionId}`); }
}
