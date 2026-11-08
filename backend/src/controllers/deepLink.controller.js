/**
 * Share links (LIV-4): https://<domain>/g/<code>.
 * - With Android App Links verified (assetlinks.json), Android opens the app directly.
 * - Otherwise this small page shows the group (WhatsApp preview tags too) with "Open in
 *   the app" (intent link that falls back to the Play Store) and "Get the app".
 * No scripts on the page (CSP-friendly); all text is HTML-escaped.
 */
const config = require('../config/env');
const Group = require('../models/group.model');
const Product = require('../models/product.model');
const { createLogger } = require('../utils/logger');
const { escapeHtml } = require('../services/email.service');
const { GROUP_VISIBILITY } = require('../constants/enums');

const log = createLogger('DeepLink');
const CODE = /^[A-Z0-9]{6,12}$/;

/** GET /.well-known/assetlinks.json — Android App Links verification */
const assetLinks = (req, res) => {
  const { androidPackage, sha256Fingerprints } = config.appLinks;
  res.setHeader('Cache-Control', 'public, max-age=3600');
  if (!sha256Fingerprints.length) return res.json([]); // not set up yet
  return res.json([
    {
      relation: ['delegate_permission/common.handle_all_urls'],
      target: {
        namespace: 'android_app',
        package_name: androidPackage,
        sha256_cert_fingerprints: sha256Fingerprints,
      },
    },
  ]);
};

/**
 * Page HTML.
 * @param {{ code: string, title: string, description: string, imageUrl?: string|null }} view
 * @returns {string}
 */
const renderPage = ({ code, title, description, imageUrl }) => {
  const { androidPackage, playStoreUrl, baseUrl } = config.appLinks;
  const intentUrl =
    `intent://g/${code}#Intent;scheme=saathmein;package=${androidPackage};` +
    `S.browser_fallback_url=${encodeURIComponent(playStoreUrl)};end`;
  const safeTitle = escapeHtml(title);
  const safeDescription = escapeHtml(description);
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${safeTitle} · SaathMein</title>
<meta name="description" content="${safeDescription}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="SaathMein">
<meta property="og:title" content="${safeTitle}">
<meta property="og:description" content="${safeDescription}">
<meta property="og:url" content="${escapeHtml(`${baseUrl}/g/${code}`)}">
${imageUrl ? `<meta property="og:image" content="${escapeHtml(imageUrl)}">` : ''}
<style>
  body{margin:0;font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;background:#F7F5F1;color:#12131F}
  main{max-width:420px;margin:0 auto;padding:40px 20px}
  .card{background:#fff;border-radius:20px;padding:24px;box-shadow:0 8px 24px rgba(18,19,31,.06)}
  h1{font-size:22px;margin:0 0 8px} p{color:#6B7085;line-height:1.5;margin:0 0 20px}
  .code{font-family:ui-monospace,Menlo,monospace;font-size:20px;letter-spacing:.15em;background:#F7F5F1;border-radius:14px;padding:12px;text-align:center;margin-bottom:20px}
  a.btn{display:block;text-align:center;text-decoration:none;font-weight:700;border-radius:14px;padding:14px;margin-top:12px;min-height:20px}
  a.primary{background:linear-gradient(135deg,#FF8A1F,#FF4D5E 52%,#B43CF5);color:#fff}
  a.secondary{border:1px solid #E9E6E1;color:#12131F}
  .brand{font-weight:800;font-size:18px;margin-bottom:20px}
</style>
</head>
<body><main>
<div class="brand">saathmein</div>
<div class="card">
<h1>${safeTitle}</h1>
<p>${safeDescription}</p>
<div class="code" aria-label="Invite code">${escapeHtml(code)}</div>
<a class="btn primary" href="${escapeHtml(intentUrl)}">Open in the SaathMein app</a>
<a class="btn secondary" href="${escapeHtml(playStoreUrl)}">Get the app on Google Play</a>
</div>
</main></body></html>`;
};

/** GET /g/:code — group share link landing page */
const groupLink = async (req, res) => {
  const code = String(req.params.code || '').toUpperCase();
  res.setHeader('Cache-Control', 'public, max-age=60');
  if (!CODE.test(code)) {
    return res
      .status(404)
      .type('html')
      .send(
        renderPage({
          code: '------',
          title: 'Link not valid',
          description: 'This SaathMein invite link is not valid.',
        }),
      );
  }
  let view = {
    code,
    title: 'Join my group on SaathMein',
    description:
      'Buy together, save together. Verified dealers compete and the lowest price wins for everyone.',
  };
  try {
    const group = await Group.findOne({ inviteCode: code })
      .select('visibility productId memberCount targetSize')
      .lean();
    // Community groups stay private: no product or numbers on the public page
    if (group && group.visibility === GROUP_VISIBILITY.PUBLIC) {
      const product = await Product.findById(group.productId).select('brand model images').lean();
      if (product) {
        view = {
          code,
          title: `${product.brand} ${product.model} group`,
          description: `${group.memberCount} of ${group.targetSize} people have joined. Join with a refundable token and save together.`,
          imageUrl: product.images?.[0]?.url || null,
        };
      }
    }
  } catch (err) {
    log.warn({ err: err.message, code }, 'Could not load group for share page');
  }
  return res.type('html').send(renderPage(view));
};

module.exports = { assetLinks, groupLink, renderPage };
