/**
 * Admin Console Team (ADL-1): Owner-only invites by email with a role (never Owner), one
 * account per invite link, and the Owner account can never be changed or disabled.
 */
jest.mock('../../../src/services/email.service', () => ({ sendStaffInvite: jest.fn() }));
jest.mock('../../../src/services/auth/session.service', () => ({ revokeUserSessions: jest.fn() }));
jest.mock('../../../src/services/auth/staffAuth.service', () => ({
  hashPassword: jest.fn(async () => 'hash'),
}));

const { Types } = require('mongoose');
const User = require('../../../src/models/user.model');
const StaffInvite = require('../../../src/models/staffInvite.model');
const { sendStaffInvite } = require('../../../src/services/email.service');
const { revokeUserSessions } = require('../../../src/services/auth/session.service');
const team = require('../../../src/services/admin/staffTeam.service');

const ownerId = String(new Types.ObjectId());
const lean = (value) => ({ lean: async () => value });

afterEach(() => {
  jest.restoreAllMocks();
  jest.clearAllMocks();
});

describe('invites', () => {
  it('emails a 72 h link and stores only the token hash', async () => {
    jest.spyOn(User, 'exists').mockResolvedValue(null);
    jest.spyOn(User, 'findById').mockReturnValue({ select: () => lean({ name: 'Vishal' }) });
    jest.spyOn(StaffInvite, 'updateMany').mockResolvedValue({});
    const create = jest
      .spyOn(StaffInvite, 'create')
      .mockImplementation(async (doc) => ({ _id: 'i1', ...doc }));

    await team.inviteStaff(ownerId, { email: 'new@x.in', role: 'support' });

    const doc = create.mock.calls[0][0];
    const url = sendStaffInvite.mock.calls[0][0].url;
    const token = url.split('/admin/invite/')[1];
    expect(doc.tokenHash).toBe(team.hashStaffInviteToken(token));
    expect(doc.tokenHash).not.toContain(token);
    expect(doc.expiresAt.getTime() - Date.now()).toBeGreaterThan(71 * 3600_000);
    expect(sendStaffInvite.mock.calls[0][0].roleLabel).toBe('Support');
  });

  it('never invites an Owner or an email that already has an account', async () => {
    await expect(
      team.inviteStaff(ownerId, { email: 'a@x.in', role: 'owner' }),
    ).rejects.toMatchObject({ statusCode: 403 });
    jest.spyOn(User, 'exists').mockResolvedValue({ _id: 'u' });
    await expect(
      team.inviteStaff(ownerId, { email: 'a@x.in', role: 'admin' }),
    ).rejects.toMatchObject({ code: 'EMAIL_TAKEN' });
  });

  it('accepting creates one staff account with the invited role', async () => {
    jest
      .spyOn(StaffInvite, 'findOne')
      .mockReturnValue(lean({ _id: 'i1', email: 'new@x.in', role: 'finance' }));
    jest.spyOn(User, 'exists').mockResolvedValue(null);
    jest.spyOn(StaffInvite, 'findOneAndUpdate').mockResolvedValue({ _id: 'i1' });
    jest.spyOn(StaffInvite, 'updateOne').mockResolvedValue({});
    const create = jest.spyOn(User, 'create').mockResolvedValue({ _id: 'u1' });

    await team.acceptInvite('t'.repeat(43), { name: 'Asha', password: 'secret12345' });
    expect(create.mock.calls[0][0]).toMatchObject({
      email: 'new@x.in',
      staffRole: 'finance',
      passwordHash: 'hash',
      twoFactorEnabled: false,
    });
  });

  it('a used link cannot create a second account', async () => {
    jest
      .spyOn(StaffInvite, 'findOne')
      .mockReturnValue(lean({ _id: 'i1', email: 'new@x.in', role: 'finance' }));
    jest.spyOn(User, 'exists').mockResolvedValue(null);
    jest.spyOn(StaffInvite, 'findOneAndUpdate').mockResolvedValue(null); // claimed by the other request
    const create = jest.spyOn(User, 'create');
    await expect(
      team.acceptInvite('t'.repeat(43), { name: 'Asha', password: 'secret12345' }),
    ).rejects.toMatchObject({
      statusCode: 404,
    });
    expect(create).not.toHaveBeenCalled();
  });
});

describe('members', () => {
  const member = (doc) => jest.spyOn(User, 'findOne').mockReturnValue({ select: () => lean(doc) });

  it('the Owner account cannot be changed or disabled', async () => {
    member({ staffRole: 'owner', status: 'active' });
    await expect(team.changeRole('u1', 'admin', ownerId)).rejects.toMatchObject({
      statusCode: 403,
    });
    await expect(team.setMemberActive('u1', false, ownerId)).rejects.toMatchObject({
      statusCode: 403,
    });
  });

  it('disabling a staff member ends their sessions', async () => {
    member({ staffRole: 'support', status: 'active' });
    jest.spyOn(User, 'updateOne').mockResolvedValue({});
    const result = await team.setMemberActive('u1', false, ownerId);
    expect(result.after).toEqual({ status: 'suspended' });
    expect(revokeUserSessions).toHaveBeenCalledWith('u1', 'staff_disabled');
  });

  it('changing a role never makes a second Owner', async () => {
    await expect(team.changeRole('u1', 'owner', ownerId)).rejects.toMatchObject({
      statusCode: 403,
    });
  });
});
