// ════════════════════════════════════════════════════════════
//  VALIDATION HELPERS
// ════════════════════════════════════════════════════════════

/**
 * Validate email format
 */
exports.isValidEmail = (email) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

/**
 * Validate required fields exist and are non-empty
 * Returns array of missing field names
 */
exports.requireFields = (body, fields) =>
  fields.filter(f => !body[f] || !String(body[f]).trim());

/**
 * Sanitize a string — trim and limit length
 */
exports.sanitize = (str, maxLen = 5000) =>
  String(str || '').trim().slice(0, maxLen);
