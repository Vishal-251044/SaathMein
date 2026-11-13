/**
 * Security review (Day 14): every route that takes input — URL params or a body — runs Zod
 * validation (`validateRequest`). New routes fail this test until they add a schema.
 * The allow-list holds routes with no client input (or raw-body handlers that verify a
 * signature instead).
 */
const app = require('../../src/app');

// "METHOD path" entries that are allowed without a Zod schema, with the reason
const NO_INPUT = new Set([
  'POST /api/payments/webhook', // raw body, HMAC signature checked
  'GET /g/:code', // regex-checked and HTML-escaped in the controller
  'GET /r/:code', // same
  'DELETE /me',
  'POST /me/avatar/upload-params',
  'DELETE /me/avatar',
  'POST /refresh', // cookie-only (staff), XHR header required
  'POST /logout',
  'POST /auth/refresh', // cookie-only (dealer)
  'POST /auth/logout',
  'POST /auth/email/send-code',
  'POST /curation/banner-upload-params',
  'POST /disputes/evidence-upload-params',
  'POST /evidence-upload-params',
]);

/** Flatten the Express router into [method, path, middleware names]. */
const collectRoutes = (stack, prefix = '', out = []) => {
  for (const layer of stack) {
    if (layer.route) {
      const names = layer.route.stack.map((item) => item.name);
      Object.keys(layer.route.methods).forEach((method) =>
        out.push([method.toUpperCase(), prefix + layer.route.path, names]),
      );
    } else if (layer.handle?.stack) {
      collectRoutes(layer.handle.stack, prefix + (layer.path ?? ''), out);
    }
  }
  return out;
};

it('every route with params or a body is validated with Zod', () => {
  const routes = collectRoutes(app.router.stack);
  expect(routes.length).toBeGreaterThan(100);
  const missing = routes
    .filter(([method, path]) => method !== 'GET' || path.includes(':'))
    .filter(([, , names]) => !names.includes('validateRequest'))
    .map(([method, path]) => `${method} ${path}`)
    .filter((route) => !NO_INPUT.has(route));
  expect(missing).toEqual([]);
});
