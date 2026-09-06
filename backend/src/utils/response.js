'use strict';

/**
 * Wrap a successful response payload.
 * @param {*} data
 * @returns {{ success: true, data: * }}
 */
function success(data) {
  return { success: true, data };
}

/**
 * Wrap an error response.
 * @param {string} message
 * @param {string} [code='ERROR']
 * @param {*} [details]
 * @returns {{ success: false, error: { code, message, details? } }}
 */
function fail(message, code = 'ERROR', details) {
  const error = { code, message };
  if (details !== undefined) error.details = details;
  return { success: false, error };
}

module.exports = { success, fail };
