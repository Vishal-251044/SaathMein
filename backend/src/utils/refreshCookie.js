/**
 * httpOnly refresh-token cookie helper for web dashboards (dealer, and the same pattern as
 * the admin console). JavaScript in the page can never read the cookie; it is only sent to
 * the matching /api/.../auth path.
 */
const config = require('../config/env');
const { parseCookies } = require('./cookies');

/**
 * @param {{ name: string, path: string, maxAgeMs: number }} options
 * @returns {{ set: Function, clear: Function, read: Function }} Cookie helpers
 */
const createRefreshCookie = ({ name, path, maxAgeMs }) => {
  const base = { httpOnly: true, secure: config.isProduction, sameSite: 'strict', path };
  return {
    /** @param {import('express').Response} res @param {string} token */
    set: (res, token) => res.cookie(name, token, { ...base, maxAge: maxAgeMs }),
    /** @param {import('express').Response} res */
    clear: (res) => res.clearCookie(name, base),
    /** @param {import('express').Request} req @returns {string|undefined} */
    read: (req) => parseCookies(req)[name],
  };
};

module.exports = { createRefreshCookie };
