// @ts-check
// stores/stores.js — in-browser object & log stores (behind the seam, DEC-39).
//
// Object store: immutable, content-addressed (DEC-35). PUT is idempotent —
// re-PUT of identical content is a no-op returning the same id. Log store:
// append-only per mission (DEC-25/26). v1 forms are in-memory mocks; the seam
// contract is what survives (seam §A).

import { contentId, canonicalJSON, deepFreeze } from '../shapes/canonical.js';

export class ObjectStore {
  constructor() {
    /** @type {Map<string, {type: string, body: any, bytes: number}>} */
    this.map = new Map();
  }

  /**
   * Store an immutable object. Identity covers {type, body}.
   * @param {string} type  e.g. 'Requirement' | 'Baseline' | 'Plan' | …
   * @param {any} body
   * @returns {Promise<{id: string, existed: boolean}>}
   */
  async put(type, body) {
    const id = await contentId({ type, body });
    if (this.map.has(id)) return { id, existed: true };
    this.map.set(id, deepFreeze({ type, body, bytes: canonicalJSON(body).length }));
    return { id, existed: false };
  }

  /** @param {string} id */
  get(id) {
    return this.map.get(id);
  }

  /** @param {string[]} ids */
  exists(ids) {
    /** @type {{present: string[], missing: string[]}} */
    const out = { present: [], missing: [] };
    for (const id of ids) (this.map.has(id) ? out.present : out.missing).push(id);
    return out;
  }

  /**
   * Hash-linked version chain, newest first (data-model rule 1).
   * @param {string} id
   * @returns {string[]}
   */
  lineage(id) {
    const chain = [];
    let cur = id;
    while (cur && this.map.has(cur) && chain.length < 32) {
      chain.push(cur);
      cur = this.map.get(cur)?.body?.lineage?.previous_version;
    }
    return chain;
  }

  list() {
    return [...this.map.entries()].map(([id, o]) => ({ id, type: o.type, bytes: o.bytes }));
  }
}

export class LogStore {
  constructor() {
    /** @type {Map<string, any[]>} */
    this.logs = new Map();
  }

  /**
   * Append-only: entries are never edited or removed.
   * @param {string} missionId
   * @param {any} entry  — Alert | Observation | Waiver | Replan (data-model §8)
   */
  append(missionId, entry) {
    const list = this.logs.get(missionId) ?? [];
    list.push(deepFreeze({ seq: list.length, ...entry }));
    this.logs.set(missionId, list);
    return { ok: true };
  }

  /**
   * @param {string} missionId
   * @param {number} [after]  — return entries with at > after (sim minutes)
   */
  get(missionId, after) {
    const list = this.logs.get(missionId) ?? [];
    return after === undefined ? [...list] : list.filter((e) => e.at > after);
  }
}
