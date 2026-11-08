/**
 * Group chat (LIV-5): members only, abusive words masked, polls by the leader with one
 * vote per member, pins by the leader (max 3), a message reported by 3 members is
 * hidden, every change is sent live to the room.
 */
jest.mock('../../../src/models/group.model', () => ({ findById: jest.fn() }));
jest.mock('../../../src/models/groupMember.model', () => ({ exists: jest.fn() }));
jest.mock('../../../src/models/message.model', () => ({
  create: jest.fn(),
  findOne: jest.fn(),
  find: jest.fn(),
  updateOne: jest.fn(),
  findOneAndUpdate: jest.fn(),
  countDocuments: jest.fn(async () => 0),
}));
jest.mock('../../../src/models/user.model', () => ({ find: jest.fn() }));
jest.mock('../../../src/services/rateLimit.service', () => ({ assertWithinLimit: jest.fn() }));
jest.mock('../../../src/sockets/emitter', () => ({ emitToGroup: jest.fn() }));

const { Types } = require('mongoose');
const Group = require('../../../src/models/group.model');
const GroupMember = require('../../../src/models/groupMember.model');
const Message = require('../../../src/models/message.model');
const User = require('../../../src/models/user.model');
const { assertWithinLimit } = require('../../../src/services/rateLimit.service');
const { emitToGroup } = require('../../../src/sockets/emitter');
const chat = require('../../../src/services/chat/chat.service');
const { filterProfanity } = require('../../../src/services/chat/profanity');

const groupId = new Types.ObjectId().toString();
const leaderId = new Types.ObjectId().toString();
const memberId = new Types.ObjectId().toString();
const lean = (value) => ({ select: () => ({ lean: async () => value }), lean: async () => value });

/** Message document with toObject/save. */
const doc = (fields) => {
  const message = {
    _id: new Types.ObjectId(),
    groupId,
    createdAt: new Date(),
    reports: [],
    ...fields,
  };
  message.toObject = () => ({ ...message });
  message.save = jest.fn(async () => message);
  return message;
};

beforeEach(() => {
  jest.clearAllMocks();
  Group.findById.mockReturnValue(lean({ _id: groupId, leaderId, status: 'open' }));
  GroupMember.exists.mockResolvedValue(true);
  User.find.mockReturnValue(lean([{ _id: memberId, name: 'Asha Kulkarni' }]));
});

describe('profanity filter', () => {
  it('masks whole words in English, romanised and Devanagari Hindi / Marathi', () => {
    expect(filterProfanity('What a SHIT deal').text).toBe('What a S*** deal');
    expect(filterProfanity('fuuuck this').text).toBe('f***** this');
    expect(filterProfanity('tu chutiya hai').text).toBe('tu c****** hai');
    expect(filterProfanity('तू हरामी है').text).toBe('तू ह**** है');
    expect(filterProfanity('Scunthorpe shitake, good price bhai')).toEqual({
      text: 'Scunthorpe shitake, good price bhai',
      flagged: false,
    });
  });
});

describe('sending', () => {
  it('only lets members and the leader chat', async () => {
    GroupMember.exists.mockResolvedValue(null);
    await expect(chat.sendMessage(groupId, memberId, { text: 'hi' })).rejects.toMatchObject({
      code: 'CHAT_MEMBERS_ONLY',
    });
    expect(Message.create).not.toHaveBeenCalled();
  });

  it('masks abuse, rate-limits and sends the message live', async () => {
    Message.create.mockImplementation(async (fields) => doc(fields));
    const message = await chat.sendMessage(groupId, memberId, { text: 'this dealer is a bastard' });
    expect(Message.create).toHaveBeenCalledWith(
      expect.objectContaining({ text: 'this dealer is a b******', senderId: memberId }),
    );
    expect(assertWithinLimit).toHaveBeenCalledWith(
      expect.objectContaining({ key: `chat:${groupId}:${memberId}`, limit: 10 }),
    );
    expect(emitToGroup).toHaveBeenCalledWith(groupId, 'chat:message', {
      message: expect.objectContaining({ text: 'this dealer is a b******' }),
    });
    expect(message).toMatchObject({ isMine: true, sender: { firstName: 'Asha', isLeader: false } });
  });

  it('refuses empty messages and polls from non-leaders', async () => {
    await expect(chat.sendMessage(groupId, memberId, {})).rejects.toMatchObject({
      code: 'EMPTY_MESSAGE',
    });
    await expect(
      chat.sendMessage(groupId, memberId, {
        poll: { question: 'Colour?', options: ['Red', 'Blue'] },
      }),
    ).rejects.toMatchObject({ code: 'POLL_LEADER_ONLY' });
  });

  it('lets the leader start a poll', async () => {
    Message.create.mockImplementation(async (fields) => doc(fields));
    const message = await chat.sendMessage(groupId, leaderId, {
      poll: { question: 'Colour?', options: ['Red', 'Blue'] },
    });
    expect(message.poll).toEqual({
      question: 'Colour?',
      closed: false,
      options: [
        { text: 'Red', votes: 0 },
        { text: 'Blue', votes: 0 },
      ],
      myVote: -1,
    });
  });
});

describe('polls, pins and reports', () => {
  const poll = () =>
    doc({
      senderId: leaderId,
      poll: {
        question: 'Colour?',
        closed: false,
        options: [
          { text: 'Red', votes: [] },
          { text: 'Blue', votes: [] },
        ],
      },
    });

  it('moves my vote instead of adding a second one', async () => {
    const message = poll();
    Message.findOne.mockResolvedValue(message);
    Message.findOneAndUpdate.mockResolvedValue(
      doc({
        ...message,
        poll: {
          ...message.poll,
          options: [
            { text: 'Red', votes: [] },
            { text: 'Blue', votes: [memberId] },
          ],
        },
      }),
    );
    const result = await chat.votePoll(groupId, memberId, String(message._id), 1);
    expect(Message.updateOne).toHaveBeenCalledWith(
      { _id: String(message._id) },
      { $pull: { 'poll.options.0.votes': memberId, 'poll.options.1.votes': memberId } },
    );
    expect(Message.findOneAndUpdate.mock.calls[0][1]).toEqual({
      $addToSet: { 'poll.options.1.votes': memberId },
    });
    expect(result.poll.myVote).toBe(1);
    expect(emitToGroup).toHaveBeenCalledWith(groupId, 'chat:update', expect.any(Object));
  });

  it('pins only for the leader, at most 3', async () => {
    Message.findOne.mockResolvedValue(doc({ senderId: memberId, text: 'Meet at 6' }));
    await expect(chat.setPinned(groupId, memberId, 'm1', true)).rejects.toMatchObject({
      statusCode: 403,
    });
    Message.countDocuments.mockResolvedValueOnce(3);
    await expect(chat.setPinned(groupId, leaderId, 'm1', true)).rejects.toMatchObject({
      code: 'TOO_MANY_PINNED',
    });
    expect((await chat.setPinned(groupId, leaderId, 'm1', true)).pinned).toBe(true);
  });

  it('hides a message after 3 reports and never lets me report my own', async () => {
    Message.findOne.mockResolvedValue(doc({ senderId: memberId, text: 'spam' }));
    await expect(chat.reportMessage(groupId, memberId, 'm1')).rejects.toMatchObject({
      code: 'OWN_MESSAGE',
    });

    const reported = doc({
      senderId: leaderId,
      text: 'spam',
      reports: [{ userId: 'a' }, { userId: 'b' }, { userId: memberId }],
    });
    Message.findOne.mockResolvedValue(doc({ senderId: leaderId, text: 'spam' }));
    Message.findOneAndUpdate.mockResolvedValue(reported);
    const result = await chat.reportMessage(groupId, memberId, 'm1', 'spam');
    expect(reported.hidden).toBe(true);
    expect(result).toMatchObject({ hidden: true, text: null, reportedByMe: true });
  });
});
