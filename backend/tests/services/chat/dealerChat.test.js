/**
 * Winning dealer in the group chat (Day 13 carry-over): only the dealer who won, only from
 * the win until completion, posting as the business (never a staff member's own name).
 */
jest.mock('../../../src/sockets/emitter', () => ({ emitToGroup: jest.fn() }));
jest.mock('../../../src/services/rateLimit.service', () => ({ assertWithinLimit: jest.fn() }));

const { Types } = require('mongoose');
const Group = require('../../../src/models/group.model');
const Message = require('../../../src/models/message.model');
const Seller = require('../../../src/models/seller.model');
const User = require('../../../src/models/user.model');
const { emitToGroup } = require('../../../src/sockets/emitter');
const chat = require('../../../src/services/chat/chat.service');

const sellerId = String(new Types.ObjectId());
const userId = String(new Types.ObjectId());
const lean = (value) => ({ lean: async () => value });
const groupIs = (doc) => jest.spyOn(Group, 'findById').mockReturnValue({ select: () => lean(doc) });

afterEach(() => {
  jest.restoreAllMocks();
  jest.clearAllMocks();
});

it('only the winning dealer of a won / purchasing / completed group gets in', async () => {
  groupIs({ status: 'purchasing', sellerId });
  await expect(chat.loadDealerChatAccess('g', sellerId)).resolves.toBeTruthy();

  groupIs({ status: 'purchasing', sellerId: String(new Types.ObjectId()) });
  await expect(chat.loadDealerChatAccess('g', sellerId)).rejects.toMatchObject({ statusCode: 404 });

  groupIs({ status: 'auction_live', sellerId });
  await expect(chat.loadDealerChatAccess('g', sellerId)).rejects.toMatchObject({ statusCode: 404 });
});

it('dealer messages carry the business name and reach the group room', async () => {
  groupIs({ status: 'won', sellerId, leaderId: new Types.ObjectId() });
  jest
    .spyOn(Seller, 'findById')
    .mockReturnValue({ select: () => lean({ businessName: 'Pune Motors' }) });
  jest.spyOn(User, 'find').mockReturnValue({ select: () => lean([]) });
  const create = jest.spyOn(Message, 'create').mockImplementation(async (doc) => ({
    toObject: () => ({ _id: new Types.ObjectId(), ...doc, createdAt: new Date() }),
  }));

  const message = await chat.sendDealerMessage(
    'g',
    { sellerId, userId },
    { text: 'Bring your Aadhaar' },
  );

  expect(create.mock.calls[0][0]).toMatchObject({
    senderType: 'seller',
    senderLabel: 'Pune Motors',
  });
  expect(message.sender).toEqual({
    firstName: 'Pune Motors',
    avatarUrl: null,
    isLeader: false,
    isDealer: true,
  });
  expect(emitToGroup).toHaveBeenCalledWith('g', expect.any(String), expect.anything());
});
