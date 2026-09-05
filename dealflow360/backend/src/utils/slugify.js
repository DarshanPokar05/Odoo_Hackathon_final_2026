'use strict';

/**
 * Convert a string to a URL-safe slug.
 * e.g. "Hello World!" → "hello-world"
 *
 * @param {string} str
 * @returns {string}
 */
function slugify(str) {
  return str
    .toString()
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, '-')       // spaces / underscores → hyphens
    .replace(/[^a-z0-9-]/g, '')    // strip non-alphanumeric (except hyphens)
    .replace(/-{2,}/g, '-')        // collapse consecutive hyphens
    .replace(/^-+|-+$/g, '');      // trim leading/trailing hyphens
}

module.exports = { slugify };
