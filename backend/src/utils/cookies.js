/**
 * Cookie helpers. Express can set cookies on its own; this adds a tiny parser for the
 * Cookie header so we do not need an extra dependency for one cookie.
 */

/**
 * Parse the request's Cookie header into an object.
 * @param {import('express').Request} req - Express request
 * @returns {Record<string, string>} Cookie name → value
 */
const parseCookies = (req) => {
  const header = req.headers.cookie;
  if (!header) return {};

  return header.split(';').reduce((cookies, part) => {
    const index = part.indexOf('=');
    if (index === -1) return cookies;
    const name = part.slice(0, index).trim();
    const value = part.slice(index + 1).trim();
    try {
      cookies[name] = decodeURIComponent(value);
    } catch {
      cookies[name] = value; // keep malformed values as-is instead of throwing
    }
    return cookies;
  }, {});
};

module.exports = { parseCookies };
