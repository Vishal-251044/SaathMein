/**
 * Unit tests for city location matching (onboarding auto-detect, ACC-2) and area rules.
 */
jest.mock('../../src/models/city.model', () => ({ find: jest.fn(), findById: jest.fn() }));

const { Types } = require('mongoose');
const City = require('../../src/models/city.model');
const cityService = require('../../src/services/city.service');

const area = (name, pincodes, active = true) => ({
  _id: new Types.ObjectId(),
  name,
  slug: name.toLowerCase().replace(/\s+/g, '-'),
  pincodes,
  active,
});

const pune = {
  _id: new Types.ObjectId(),
  name: 'Pune',
  slug: 'pune',
  state: 'Maharashtra',
  active: true,
  location: { type: 'Point', coordinates: [73.8567, 18.5204] },
  areas: [
    area('Kothrud', ['411038']),
    area('Kharadi', ['411014']),
    area('Viman Nagar', ['411014']),
    area('Old Area', ['411099'], false),
  ],
};

const citiesAre = (cities) => City.find.mockReturnValue({ lean: () => Promise.resolve(cities) });

describe('city.service.matchLocation', () => {
  beforeEach(() => citiesAre([pune]));

  it('matches a pincode that belongs to exactly one area', async () => {
    const { city, area: matched } = await cityService.matchLocation({ pincode: '411038' });
    expect(city.name).toBe('Pune');
    expect(matched.name).toBe('Kothrud');
  });

  it('returns only the city when a pincode is shared by several areas', async () => {
    const { city, area: matched } = await cityService.matchLocation({ pincode: '411014' });
    expect(city.name).toBe('Pune');
    expect(matched).toBeNull();
  });

  it('ignores inactive areas and hides them from the public city', async () => {
    const result = await cityService.matchLocation({ pincode: '411099' });
    expect(result).toEqual({ city: null, area: null });
    expect(cityService.toPublicCity(pune).areas.map((a) => a.name)).not.toContain('Old Area');
  });

  it('matches coordinates within 60 km of the city centre', async () => {
    // Hinjewadi is ~20 km from the centre
    const near = await cityService.matchLocation({ latitude: 18.5913, longitude: 73.7389 });
    expect(near.city.name).toBe('Pune');

    // Mumbai is ~120 km away
    const far = await cityService.matchLocation({ latitude: 19.076, longitude: 72.8777 });
    expect(far.city).toBeNull();
  });
});

describe('city.service areas', () => {
  it('rejects a duplicate area name but allows shared pincodes', async () => {
    const save = jest.fn();
    const areas = [...pune.areas];
    areas.id = (id) => areas.find((a) => String(a._id) === String(id));
    City.findById.mockResolvedValue({ ...pune, areas, save, toObject: () => pune });

    await expect(cityService.addArea(String(pune._id), { name: 'Kothrud' })).rejects.toMatchObject({
      statusCode: 409,
      code: 'AREA_EXISTS',
    });

    areas.push = jest.fn();
    await cityService
      .addArea(String(pune._id), { name: 'Lohegaon', pincodes: ['411014'] })
      .catch(() => {});
    expect(areas.push).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Lohegaon', slug: 'lohegaon', pincodes: ['411014'] }),
    );
  });
});
