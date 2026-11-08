/**
 * Socket gateway and share links (LIV-1, LIV-4): only app tokens connect; a group room is
 * joined only by people who may see the group; assetlinks.json for App Links; the /g/:code
 * landing page escapes text, keeps community groups private and has WhatsApp preview tags.
 */
jest.mock('../../src/models/group.model', () => ({ findById: jest.fn(), findOne: jest.fn() }));
jest.mock('../../src/models/groupMember.model', () => ({ exists: jest.fn() }));
jest.mock('../../src/models/product.model', () => ({ findById: jest.fn() }));

const request = require('supertest');
const { Types } = require('mongoose');
const Group = require('../../src/models/group.model');
const GroupMember = require('../../src/models/groupMember.model');
const Product = require('../../src/models/product.model');
const config = require('../../src/config/env');
const app = require('../../src/app');
const { authenticate, canFollowGroup } = require('../../src/sockets/gateway');
const { signAccessToken } = require('../../src/services/auth/token.service');
const { TOKEN_AUDIENCE } = require('../../src/constants/enums');

const userId = new Types.ObjectId().toString();
const groupId = new Types.ObjectId().toString();
const lean = (value) => ({ select: () => ({ lean: async () => value }), lean: async () => value });
const token = (audience) =>
  signAccessToken({ userId, sessionId: new Types.ObjectId().toString(), audience, claims: {} })
    .token;

beforeEach(() => jest.clearAllMocks());

describe('socket auth', () => {
  const run = (auth) =>
    new Promise((resolve) => {
      const socket = { handshake: { auth }, data: {} };
      authenticate(socket, (err) => resolve({ err, socket }));
    });

  it('accepts an app token and remembers the user', async () => {
    const { err, socket } = await run({ token: token(TOKEN_AUDIENCE.APP) });
    expect(err).toBeUndefined();
    expect(socket.data.userId).toBe(userId);
  });

  it('refuses no token, bad tokens and staff tokens', async () => {
    expect((await run({})).err.message).toBe('UNAUTHORIZED');
    expect((await run({ token: 'nope' })).err.message).toBe('UNAUTHORIZED');
    expect((await run({ token: token(TOKEN_AUDIENCE.STAFF) })).err).toBeInstanceOf(Error);
  });
});

describe('who may follow a group live', () => {
  it('anyone for public groups; leader, members or the code for community groups', async () => {
    Group.findById.mockReturnValue(lean({ visibility: 'public' }));
    expect(await canFollowGroup(groupId, userId)).toBeTruthy();

    Group.findById.mockReturnValue(
      lean({ visibility: 'community', leaderId: 'other', inviteCode: 'K7M2QX9P' }),
    );
    GroupMember.exists.mockResolvedValue(null);
    expect(await canFollowGroup(groupId, userId)).toBeNull();
    expect(await canFollowGroup(groupId, userId, 'k7m2qx9p')).toBeTruthy();
    GroupMember.exists.mockResolvedValue({ _id: 'm' });
    expect(await canFollowGroup(groupId, userId)).toBeTruthy();
    expect(await canFollowGroup('not-an-id', userId)).toBeNull();
  });
});

describe('share links', () => {
  it('serves assetlinks.json only when fingerprints are set', async () => {
    expect((await request(app).get('/.well-known/assetlinks.json')).body).toEqual([]);
    config.appLinks.sha256Fingerprints = ['AA:BB'];
    const res = await request(app).get('/.well-known/assetlinks.json');
    expect(res.body[0].target).toEqual({
      namespace: 'android_app',
      package_name: 'com.saathmein.app',
      sha256_cert_fingerprints: ['AA:BB'],
    });
    config.appLinks.sha256Fingerprints = [];
  });

  it('shows a public group with preview tags, an app intent and the Play Store', async () => {
    Group.findOne.mockReturnValue(
      lean({ visibility: 'public', productId: 'p1', memberCount: 4, targetSize: 10 }),
    );
    Product.findById.mockReturnValue(
      lean({ brand: 'Honda', model: 'Activa <6G>', images: [{ url: 'https://img/a.jpg' }] }),
    );
    const res = await request(app).get('/g/k7m2qx9p');
    expect(res.status).toBe(200);
    expect(res.text).toContain(
      '<meta property="og:title" content="Honda Activa &lt;6G&gt; group">',
    );
    expect(res.text).toContain('4 of 10 people have joined');
    expect(res.text).toContain(
      'intent://g/K7M2QX9P#Intent;scheme=saathmein;package=com.saathmein.app',
    );
    expect(res.text).toContain('play.google.com');
    expect(res.text).not.toContain('<script');
  });

  it('keeps community groups private and rejects bad codes', async () => {
    Group.findOne.mockReturnValue(
      lean({ visibility: 'community', productId: 'p1', memberCount: 4, targetSize: 10 }),
    );
    const res = await request(app).get('/g/K7M2QX9P');
    expect(res.text).toContain('Join my group on SaathMein');
    expect(Product.findById).not.toHaveBeenCalled();
    expect((await request(app).get('/g/%3Cscript%3E')).status).toBe(404);
  });
});
