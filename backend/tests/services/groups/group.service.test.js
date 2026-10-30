/**
 * Group service rules (GRP-1, GRP-5, GRP-6): create uses category rules (sizes, deadline,
 * token snapshot — never client values), city required, spam limit, invite code retry;
 * leader extend once / capped; start early; cancel only when nobody paid; community
 * groups hidden from people without the code.
 */
jest.mock('../../../src/services/groups/groupEffects', () => ({ runGroupEffects: jest.fn() }));
jest.mock('../../../src/services/demandSignal.service', () => ({ recordSignal: jest.fn() }));
jest.mock('../../../src/services/settings.service', () => ({
  getGroupSettings: jest.fn(async () => ({
    earlyStartThresholdBps: 7000,
    leaderDecisionHours: 48,
    extensionDays: 7,
    maxOpenGroupsPerLeader: 5,
  })),
}));

const { Types } = require('mongoose');
const Group = require('../../../src/models/group.model');
const GroupMember = require('../../../src/models/groupMember.model');
const Product = require('../../../src/models/product.model');
const Category = require('../../../src/models/category.model');
const User = require('../../../src/models/user.model');
const groupService = require('../../../src/services/groups/group.service');
const { GROUP_STATUS: S, GROUP_TYPE } = require('../../../src/constants/enums');

const DAY = 86_400_000;
const userId = new Types.ObjectId().toString();
const cityId = new Types.ObjectId();
const product = {
  _id: new Types.ObjectId(),
  brand: 'Honda',
  model: 'Activa 6G',
  categoryId: new Types.ObjectId(),
  variants: [{ key: 'std', name: 'Standard' }],
  priceByCity: [],
  images: [],
};
const category = {
  _id: product.categoryId,
  rules: { minSize: 10, maxSize: 25, tokenAmountPaise: 100000, deadlineDays: { min: 3, max: 30 } },
};

/** Lean query chain. */
const chain = (value) => ({
  select: () => chain(value),
  populate: () => chain(value),
  sort: () => chain(value),
  limit: () => chain(value),
  lean: async () => value,
  then: (resolve, reject) => Promise.resolve(value).then(resolve, reject),
});

const input = (overrides = {}) => ({
  productId: String(product._id),
  variantKey: 'std',
  targetSize: 15,
  deadlineDays: 10,
  visibility: 'public',
  ...overrides,
});

beforeEach(() => {
  jest.restoreAllMocks();
  jest
    .spyOn(User, 'findById')
    .mockReturnValue(chain({ _id: userId, name: 'Asha Kulkarni', cityId }));
  jest.spyOn(Product, 'findOne').mockReturnValue(chain(product));
  jest.spyOn(Category, 'findOne').mockReturnValue(chain(category));
  jest.spyOn(Group, 'countDocuments').mockResolvedValue(0);
});

describe('createGroup', () => {
  it('needs the buyer to have a city', async () => {
    User.findById.mockReturnValue(chain({ _id: userId, cityId: null }));
    await expect(groupService.createGroup(userId, input())).rejects.toMatchObject({
      code: 'CITY_REQUIRED',
    });
  });

  it.each([
    [{ targetSize: 9 }, 'INVALID_SIZE'],
    [{ targetSize: 26 }, 'INVALID_SIZE'],
    [{ deadlineDays: 2 }, 'INVALID_DEADLINE'],
    [{ deadlineDays: 31 }, 'INVALID_DEADLINE'],
    [{ variantKey: 'sports' }, 'INVALID_VARIANT'],
  ])('enforces category rules %o', async (overrides, code) => {
    await expect(groupService.createGroup(userId, input(overrides))).rejects.toMatchObject({
      statusCode: 422,
      code,
    });
  });

  it('limits open groups per leader', async () => {
    Group.countDocuments.mockResolvedValue(5);
    await expect(groupService.createGroup(userId, input())).rejects.toMatchObject({
      statusCode: 429,
      code: 'TOO_MANY_GROUPS',
    });
  });

  it('creates an open buyer-led group with the token from the category and 0 members', async () => {
    const create = jest
      .spyOn(Group, 'create')
      .mockImplementation(async (doc) => ({ _id: new Types.ObjectId(), ...doc }));
    jest.spyOn(Group, 'findById').mockReturnValue(chain(null)); // getGroup after create
    await groupService
      .createGroup(userId, input({ visibility: 'community', requiresApproval: true }))
      .catch(() => {});

    const doc = create.mock.calls[0][0];
    expect(doc).toMatchObject({
      type: GROUP_TYPE.BUYER_LED,
      visibility: 'community',
      requiresApproval: true,
      cityId,
      leaderId: userId,
      targetSize: 15,
      maxSize: 15,
      tokenAmountPaise: 100000,
      variantKey: 'std',
    });
    expect(doc.memberCount).toBeUndefined(); // starts at 0; the leader pays on Day 7
    expect(doc.inviteCode).toMatch(/^[A-HJ-NP-Z2-9]{8}$/);
    expect(doc.deadline.getTime()).toBeGreaterThan(Date.now() + 10 * DAY - 5000);
  });

  it('retries a duplicate invite code', async () => {
    const duplicate = Object.assign(new Error('dup'), {
      code: 11000,
      keyPattern: { inviteCode: 1 },
    });
    const create = jest
      .spyOn(Group, 'create')
      .mockRejectedValueOnce(duplicate)
      .mockImplementation(async (doc) => ({ _id: new Types.ObjectId(), ...doc }));
    jest.spyOn(Group, 'findById').mockReturnValue(chain(null));
    await groupService.createGroup(userId, input()).catch(() => {});
    expect(create).toHaveBeenCalledTimes(2);
  });
});

describe('leader actions', () => {
  /** Group document the leader owns. */
  const ledGroup = (overrides = {}) => ({
    _id: new Types.ObjectId(),
    leaderId: new Types.ObjectId(userId),
    type: GROUP_TYPE.BUYER_LED,
    status: S.OPEN,
    targetSize: 10,
    memberCount: 7,
    categoryId: category._id,
    createdAt: new Date(Date.now() - 10 * DAY),
    deadline: new Date(Date.now() - 1000),
    leaderDecisionDueAt: new Date(Date.now() + DAY),
    deadlineExtended: false,
    ...overrides,
  });

  const givenGroup = (group) => {
    jest
      .spyOn(Group, 'findById')
      .mockReturnValueOnce(Promise.resolve(group)) // loadLedGroup
      .mockReturnValue(chain(null)); // getGroup afterwards
    jest.spyOn(Category, 'findById').mockReturnValue(chain(category));
  };

  it('only the leader can act', async () => {
    givenGroup(ledGroup({ leaderId: new Types.ObjectId() }));
    await expect(groupService.extendDeadline('g', userId)).rejects.toMatchObject({
      statusCode: 403,
    });
  });

  it('extends once by 7 days and clears the decision window', async () => {
    givenGroup(ledGroup());
    const update = jest.spyOn(Group, 'updateOne').mockResolvedValue({ modifiedCount: 1 });
    await groupService.extendDeadline('g', userId).catch(() => {});
    const [filter, change] = update.mock.calls[0];
    expect(filter).toMatchObject({ deadlineExtended: false, status: S.OPEN });
    expect(change.$set.deadlineExtended).toBe(true);
    expect(change.$set.deadline.getTime()).toBeGreaterThan(Date.now() + 7 * DAY - 5000);
    expect(change.$unset).toEqual({ leaderDecisionDueAt: 1 });
  });

  it('refuses a second extension and an extension past the category maximum', async () => {
    givenGroup(ledGroup({ deadlineExtended: true }));
    await expect(groupService.extendDeadline('g', userId)).rejects.toMatchObject({
      code: 'ALREADY_EXTENDED',
    });

    givenGroup(ledGroup({ createdAt: new Date(Date.now() - 30 * DAY) }));
    await expect(groupService.extendDeadline('g', userId)).rejects.toMatchObject({
      code: 'EXTENSION_NOT_POSSIBLE',
    });
  });

  it('needs an open decision window', async () => {
    givenGroup(ledGroup({ leaderDecisionDueAt: undefined }));
    await expect(groupService.startAuctionEarly('g', userId)).rejects.toMatchObject({
      code: 'NO_DECISION_PENDING',
    });
  });

  it('starts the auction early at ≥70% with the category duration', async () => {
    givenGroup(ledGroup());
    const write = jest
      .spyOn(Group, 'findOneAndUpdate')
      .mockResolvedValue({ status: S.AUCTION_LIVE });
    await groupService.startAuctionEarly('g', userId).catch(() => {});
    const { $set, $unset, $push } = write.mock.calls[0][1];
    expect($set.status).toBe(S.AUCTION_LIVE);
    expect($set['auction.endsAt'] - $set['auction.startsAt']).toBe(24 * 3600_000);
    expect($unset).toEqual({ leaderDecisionDueAt: 1 });
    expect($push.statusHistory).toMatchObject({ reason: 'leader_started_early', byType: 'user' });
  });

  it('cancels only when nobody has paid', async () => {
    givenGroup(ledGroup({ memberCount: 1 }));
    await expect(groupService.cancelGroup('g', userId)).rejects.toMatchObject({
      code: 'GROUP_HAS_MEMBERS',
    });

    givenGroup(ledGroup({ memberCount: 0 }));
    const write = jest.spyOn(Group, 'findOneAndUpdate').mockResolvedValue({ status: S.CANCELLED });
    await groupService.cancelGroup('g', userId).catch(() => {});
    expect(write.mock.calls[0][1].$set.status).toBe(S.CANCELLED);
  });
});

describe('community visibility', () => {
  const community = {
    _id: new Types.ObjectId(),
    visibility: 'community',
    inviteCode: 'K7M2QX9P',
    leaderId: new Types.ObjectId(),
    productId: product,
    status: S.OPEN,
    targetSize: 10,
    memberCount: 0,
  };

  beforeEach(() => {
    jest.spyOn(Group, 'findById').mockReturnValue(chain(community));
    jest.spyOn(GroupMember, 'find').mockReturnValue(chain([]));
  });

  it('is hidden from people without the code', async () => {
    jest.spyOn(GroupMember, 'findOne').mockReturnValue(chain(null));
    await expect(groupService.getGroup(String(community._id), { userId })).rejects.toMatchObject({
      statusCode: 404,
    });
  });

  it('opens with the invite code but does not show the code to non-members', async () => {
    jest.spyOn(GroupMember, 'findOne').mockReturnValue(chain(null));
    User.findById.mockReturnValue(chain({ name: 'Ravi Patil' }));
    const group = await groupService.getGroup(String(community._id), { userId, code: 'k7m2qx9p' });
    expect(group.id).toBe(String(community._id));
    expect(group.inviteCode).toBeNull();
    expect(group.leader).toEqual({ firstName: 'Ravi' });
  });
});
