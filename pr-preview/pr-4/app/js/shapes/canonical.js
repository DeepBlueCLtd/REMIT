// @ts-check
// shapes/canonical.js — canonical serialisation + content addressing (DEC-35).
//
// Identity is content: every immutable object's id = sha-256 of its canonical
// JSON. Canonical form: recursively key-sorted objects, no insignificant
// whitespace, finite numbers only. Identity-bearing fields lean integer/enum/
// string (DEC-57); derived floats stay out of stamped content.

/**
 * Canonical JSON: deterministic byte form of semantic content.
 * - Object keys sorted (UTF-16 code-unit order, applied recursively).
 * - Arrays keep their order (order is semantic).
 * - Numbers must be finite; undefined object values are dropped.
 * @param {unknown} value
 * @returns {string}
 */
export function canonicalJSON(value) {
  if (value === null) return 'null';
  switch (typeof value) {
    case 'string':
      return JSON.stringify(value);
    case 'boolean':
      return value ? 'true' : 'false';
    case 'number':
      if (!Number.isFinite(value)) throw new Error('canonicalJSON: non-finite number');
      return JSON.stringify(value);
    case 'object': {
      if (Array.isArray(value)) {
        return '[' + value.map((v) => {
          if (v === undefined) throw new Error('canonicalJSON: undefined in array');
          return canonicalJSON(v);
        }).join(',') + ']';
      }
      const obj = /** @type {Record<string, unknown>} */ (value);
      const keys = Object.keys(obj).filter((k) => obj[k] !== undefined).sort();
      return '{' + keys.map((k) => JSON.stringify(k) + ':' + canonicalJSON(obj[k])).join(',') + '}';
    }
    default:
      throw new Error(`canonicalJSON: unsupported type ${typeof value}`);
  }
}

/**
 * Content id of a value: 'sha256:<hex>' over its canonical JSON bytes.
 * @param {unknown} value
 * @returns {Promise<string>}
 */
export async function contentId(value) {
  const bytes = new TextEncoder().encode(canonicalJSON(value));
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  const hex = [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
  return 'sha256:' + hex;
}

/**
 * Display form of a content id: first 8 hex chars.
 * @param {string} id
 */
export function shortId(id) {
  return id.replace(/^sha256:/, '').slice(0, 8);
}

/**
 * Deep-freeze an object graph (stores hold immutable objects, rule 1).
 * @template T
 * @param {T} obj
 * @returns {T}
 */
export function deepFreeze(obj) {
  if (obj && typeof obj === 'object' && !Object.isFrozen(obj)) {
    Object.freeze(obj);
    for (const v of Object.values(obj)) deepFreeze(v);
  }
  return obj;
}
