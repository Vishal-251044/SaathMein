/**
 * Email service — transactional emails through Resend's HTTPS API (no SDK needed).
 * Without RESEND_API_KEY (development), emails are written to the server log instead, so
 * flows like dealer email verification still work locally.
 * Sending never throws: a failed email is logged and reported as `{ sent: false }`.
 */
const config = require('../config/env');
const { createLogger } = require('../utils/logger');

const log = createLogger('EmailService');
const RESEND_URL = 'https://api.resend.com/emails';
const TIMEOUT_MS = 10000;

/**
 * Escape text for safe use inside HTML emails.
 * @param {string} text - Plain text
 * @returns {string} HTML-escaped text
 */
const escapeHtml = (text = '') =>
  String(text).replace(
    /[&<>"']/g,
    (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char],
  );

/**
 * Wrap plain paragraphs in the simple SaathMein email layout.
 * @param {string[]} paragraphs - Plain-text paragraphs (escaped here)
 * @param {{ label: string, url: string }} [button] - Optional call to action
 * @returns {string} HTML body
 */
const layout = (
  paragraphs,
  button,
) => `<!doctype html><html><body style="margin:0;background:#F7F5F1;font-family:Arial,sans-serif;color:#12131F">
<div style="max-width:520px;margin:0 auto;padding:24px">
<p style="font-size:20px;font-weight:800;margin:0 0 16px">saathmein</p>
<div style="background:#fff;border-radius:16px;padding:24px;line-height:1.55;font-size:15px">
${paragraphs.map((p) => `<p style="margin:0 0 12px">${escapeHtml(p)}</p>`).join('')}
${button ? `<p style="margin:20px 0 0"><a href="${escapeHtml(button.url)}" style="background:#FF5A3C;color:#fff;text-decoration:none;padding:12px 20px;border-radius:12px;font-weight:700;display:inline-block">${escapeHtml(button.label)}</a></p>` : ''}
</div>
<p style="font-size:12px;color:#6B7085;margin:16px 0 0">Buy together. Save together. You get this email because of your SaathMein account.</p>
</div></body></html>`;

/**
 * Send one email.
 * @param {{ to: string|string[], subject: string, text: string, html: string }} message
 * @returns {Promise<{ sent: boolean, id?: string, devLogged?: boolean }>}
 */
const sendEmail = async ({ to, subject, text, html }) => {
  const recipients = Array.isArray(to) ? to : [to];

  if (!config.email.isConfigured) {
    // Development: show the email in the log (never in production logs — no key means not production-ready)
    log.warn({ to: recipients, subject, text }, 'RESEND_API_KEY not set — email logged, not sent');
    return { sent: false, devLogged: true };
  }

  try {
    const response = await fetch(RESEND_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.email.resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from: config.email.from, to: recipients, subject, text, html }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      log.error(
        { status: response.status, error: body?.message, subject },
        'Email rejected by Resend',
      );
      return { sent: false };
    }
    return { sent: true, id: body.id };
  } catch (err) {
    log.error({ err: err.message, subject }, 'Email send failed');
    return { sent: false };
  }
};

/* -------------------------------- Templates -------------------------------- */

/** @param {{ to: string, name?: string, code: string }} params */
const sendEmailVerificationCode = ({ to, name, code }) =>
  sendEmail({
    to,
    subject: `${code} is your SaathMein verification code`,
    text: `Hi ${name || 'there'},\n\nYour SaathMein verification code is ${code}. It expires in 15 minutes.\n\nIf you did not ask for it, ignore this email.`,
    html: layout([
      `Hi ${name || 'there'},`,
      `Your SaathMein verification code is ${code}. It expires in 15 minutes.`,
      'If you did not ask for it, you can ignore this email.',
    ]),
  });

/** @param {{ to: string, businessName: string }} params */
const sendKycSubmitted = ({ to, businessName }) =>
  sendEmail({
    to,
    subject: 'We received your SaathMein KYC',
    text: `Thank you. We received the KYC for ${businessName}. Our team reviews it within 2 working days and emails you the result.`,
    html: layout([
      `Thank you. We received the KYC for ${businessName}.`,
      'Our team reviews it within 2 working days and emails you the result.',
    ]),
  });

/** @param {{ to: string, businessName: string }} params */
const sendKycApproved = ({ to, businessName }) =>
  sendEmail({
    to,
    subject: `${businessName} is verified on SaathMein`,
    text: `Good news: ${businessName} is now a verified SaathMein dealer. You can join group auctions in your cities and categories.\n\n${config.sellerWebUrl}`,
    html: layout(
      [
        `Good news: ${businessName} is now a verified SaathMein dealer.`,
        'You can now join group auctions in your cities and categories.',
      ],
      { label: 'Open dealer dashboard', url: config.sellerWebUrl },
    ),
  });

/** @param {{ to: string, businessName: string, reason: string }} params */
const sendKycRejected = ({ to, businessName, reason }) =>
  sendEmail({
    to,
    subject: `Action needed: ${businessName} KYC`,
    text: `We could not verify the KYC for ${businessName}.\n\nReason: ${reason}\n\nPlease fix this and submit again: ${config.sellerWebUrl}/kyc`,
    html: layout(
      [
        `We could not verify the KYC for ${businessName}.`,
        `Reason: ${reason}`,
        'Please fix this and submit again.',
      ],
      { label: 'Update KYC', url: `${config.sellerWebUrl}/kyc` },
    ),
  });

/** @param {{ to: string, businessName: string, inviterName: string, url: string }} params */
const sendTeamInvite = ({ to, businessName, inviterName, url }) =>
  sendEmail({
    to,
    subject: `Join ${businessName} on SaathMein`,
    text: `${inviterName} invited you to the ${businessName} team on SaathMein. Accept within 7 days: ${url}`,
    html: layout(
      [
        `${inviterName} invited you to the ${businessName} team on SaathMein.`,
        'The invitation is valid for 7 days.',
      ],
      { label: 'Accept invitation', url },
    ),
  });

/** @param {{ to: string, roleLabel: string, inviterName: string, url: string }} params */
const sendStaffInvite = ({ to, roleLabel, inviterName, url }) =>
  sendEmail({
    to,
    subject: 'You are invited to the SaathMein Admin Console',
    text: `${inviterName} invited you to the SaathMein Admin Console as ${roleLabel}. Accept within 72 hours: ${url}. You will need an authenticator app for 2-step verification.`,
    html: layout(
      [
        `${inviterName} invited you to the SaathMein Admin Console as ${roleLabel}.`,
        'The invitation is valid for 72 hours. You will need an authenticator app for 2-step verification.',
      ],
      { label: 'Accept invitation', url },
    ),
  });

/**
 * Staff sign-in from a browser not used before on this account (ADL-4).
 * @param {{ to: string, name?: string, when: Date, ip?: string, device?: string }} params
 */
const sendStaffNewDevice = ({ to, name, when, ip, device }) => {
  const time = when.toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    dateStyle: 'medium',
    timeStyle: 'short',
  });
  const lines = [
    `Hi ${name || 'there'}, your SaathMein console account was just signed in from a new device.`,
    `Time: ${time} IST`,
    `IP address: ${ip || 'unknown'}`,
    `Device: ${(device || 'unknown').slice(0, 160)}`,
    'If this was not you, ask the Owner to disable your account in Team right away and change your password.',
  ];
  return sendEmail({
    to,
    subject: 'New sign-in to the SaathMein console',
    text: lines.join('\n'),
    html: layout(lines),
  });
};

/** @param {{ to: string[], businessName: string, adminUrl: string }} params */
const sendKycReviewNeeded = ({ to, businessName, adminUrl }) =>
  sendEmail({
    to,
    subject: `New dealer KYC to review: ${businessName}`,
    text: `${businessName} submitted KYC. Review it in the admin console: ${adminUrl}`,
    html: layout([`${businessName} submitted KYC and is waiting for review.`], {
      label: 'Review KYC',
      url: adminUrl,
    }),
  });

/**
 * New auction a dealer can bid in (AUC-1).
 * @param {{ to: string|string[], productName: string, cityName: string, groupSize: number, endsAt: Date, url: string }} params
 */
const sendAuctionOpen = ({ to, productName, cityName, groupSize, endsAt, url }) =>
  sendEmail({
    to,
    subject: `New group auction: ${groupSize} x ${productName} in ${cityName}`,
    text: `${groupSize} buyers in ${cityName} want ${productName}. Bid before ${endsAt.toUTCString()}: ${url}`,
    html: layout(
      [
        `${groupSize} confirmed buyers in ${cityName} want ${productName}.`,
        'Join the live auction and give your best all-inclusive price. The lowest price wins the whole group.',
        `Bidding ends ${endsAt.toUTCString()} (extended if someone bids in the last minutes).`,
      ],
      { label: 'Open the auction', url },
    ),
  });

/**
 * A dealer was outbid (AUC-6).
 * @param {{ to: string|string[], productName: string, lowestPrice: string, url: string }} params
 */
const sendOutbid = ({ to, productName, lowestPrice, url }) =>
  sendEmail({
    to,
    subject: `You have been outbid: ${productName}`,
    text: `Another dealer offered ${lowestPrice}. Bid lower to lead again: ${url}`,
    html: layout(
      [`Another dealer offered ${lowestPrice} for ${productName}.`, 'Bid lower to lead again.'],
      { label: 'Bid again', url },
    ),
  });

/**
 * Auction result for a dealer.
 * @param {{ to: string|string[], productName: string, won: boolean, price: string, members: number, url: string }} params
 */
const sendAuctionResult = ({ to, productName, won, price, members, url }) =>
  sendEmail({
    to,
    subject: won ? `You won: ${members} x ${productName}` : `Auction closed: ${productName}`,
    text: won
      ? `Your price ${price} won. ${members} buyers will come to buy at this price with their deal codes: ${url}`
      : `The auction for ${productName} closed at ${price}. Thank you for bidding.`,
    html: layout(
      won
        ? [
            `Your price ${price} won the group for ${productName}.`,
            `${members} buyers will visit with their deal codes. Please honour the price and delivery date you committed to.`,
          ]
        : [
            `The auction for ${productName} closed at ${price}.`,
            'Thank you for bidding. More groups are coming.',
          ],
      { label: won ? 'See the group' : 'See live auctions', url },
    ),
  });

/**
 * The runner-up gets the group because the winner backed out (PRD §10.5).
 * @param {{ to: string|string[], productName: string, price: string, hours: number, url: string }} params
 */
const sendRunnerUpOffer = ({ to, productName, price, hours, url }) =>
  sendEmail({
    to,
    subject: `The group is offered to you: ${productName}`,
    text: `The winning dealer backed out. Take the group at your last price ${price} within ${hours} hours: ${url}`,
    html: layout(
      [
        `The winning dealer backed out of the ${productName} group.`,
        `You can take the whole group at your last price, ${price}. Answer within ${hours} hours.`,
      ],
      { label: 'Accept or decline', url },
    ),
  });

module.exports = {
  sendAuctionOpen,
  sendOutbid,
  sendAuctionResult,
  sendRunnerUpOffer,
  sendEmail,
  escapeHtml,
  sendEmailVerificationCode,
  sendKycSubmitted,
  sendKycApproved,
  sendKycRejected,
  sendTeamInvite,
  sendStaffInvite,
  sendStaffNewDevice,
  sendKycReviewNeeded,
};
