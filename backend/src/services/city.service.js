/**
 * City service — launch cities and areas (CAT-4): public lists, location matching for
 * onboarding (ACC-2 auto-detect), and admin management.
 */
const City = require('../models/city.model');
const ApiError = require('../utils/ApiError');
const { distanceKm, slugify } = require('../helpers/genericFunctions');

/** A detected location counts as "in the city" within this distance of its centre. */
const CITY_MATCH_RADIUS_KM = 60;

/**
 * Public shape of a city (active areas only).
 * @param {Object} city - City document
 * @returns {Object} City for the apps
 */
const toPublicCity = (city) => ({
  id: String(city._id),
  name: city.name,
  nameTranslations: city.nameTranslations || {},
  slug: city.slug,
  state: city.state,
  areas: (city.areas || [])
    .filter((area) => area.active)
    .map((area) => ({
      id: String(area._id),
      name: area.name,
      nameTranslations: area.nameTranslations || {},
      slug: area.slug,
      pincodes: area.pincodes || [],
    }))
    .sort((a, b) => a.name.localeCompare(b.name)),
});

/**
 * Admin shape of a city (all areas, with status).
 * @param {Object} city - City document
 * @returns {Object} City for the admin console
 */
const toAdminCity = (city) => ({
  id: String(city._id),
  name: city.name,
  nameTranslations: city.nameTranslations || {},
  slug: city.slug,
  state: city.state,
  location: city.location?.coordinates || null,
  active: city.active,
  areas: (city.areas || []).map((area) => ({
    id: String(area._id),
    name: area.name,
    nameTranslations: area.nameTranslations || {},
    slug: area.slug,
    pincodes: area.pincodes || [],
    active: area.active,
  })),
  updatedAt: city.updatedAt,
});

/** @returns {Promise<Object[]>} Active cities with active areas */
const listActiveCities = async () => {
  const cities = await City.find({ active: true }).sort({ name: 1 }).lean();
  return cities.map(toPublicCity);
};

/**
 * Find an active city and (optionally) one of its active areas.
 * @param {string} cityId - City id
 * @param {string} [areaName] - Area name to validate
 * @returns {Promise<{ city: Object, area: Object|null }>}
 * @throws {ApiError} 422 when the city or area is not available
 */
const getActiveCityAndArea = async (cityId, areaName) => {
  const city = await City.findOne({ _id: cityId, active: true }).lean();
  if (!city)
    throw new ApiError(422, 'This city is not available yet', { code: 'CITY_UNAVAILABLE' });

  if (!areaName) return { city, area: null };
  const area = city.areas.find((a) => a.active && a.name.toLowerCase() === areaName.toLowerCase());
  if (!area) throw new ApiError(422, 'Pick an area from the list', { code: 'AREA_UNAVAILABLE' });
  return { city, area };
};

/**
 * Match a detected location to a launch city and area (ACC-2 auto-detect).
 * Pincode match is exact; coordinates match the nearest city within 60 km.
 * @param {{ latitude?: number, longitude?: number, pincode?: string }} location
 * @returns {Promise<{ city: Object|null, area: Object|null }>} Public city and area, or nulls
 */
const matchLocation = async ({ latitude, longitude, pincode }) => {
  const cities = await City.find({ active: true }).lean();

  if (pincode) {
    for (const city of cities) {
      // One pincode often covers several areas: only pre-select an area when it is unambiguous
      const areas = city.areas.filter((a) => a.active && a.pincodes.includes(pincode));
      if (areas.length) {
        const publicCity = toPublicCity(city);
        const area =
          areas.length === 1 ? publicCity.areas.find((a) => a.id === String(areas[0]._id)) : null;
        return { city: publicCity, area };
      }
    }
  }

  if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
    const nearest = cities
      .filter((city) => city.location?.coordinates)
      .map((city) => ({ city, km: distanceKm([longitude, latitude], city.location.coordinates) }))
      .sort((a, b) => a.km - b.km)[0];
    if (nearest && nearest.km <= CITY_MATCH_RADIUS_KM) {
      return { city: toPublicCity(nearest.city), area: null };
    }
  }

  return { city: null, area: null };
};

/* ----------------------------- Admin ----------------------------- */

/** @returns {Promise<Object[]>} Every city (admin view) */
const listAllCities = async () => {
  const cities = await City.find().sort({ name: 1 }).lean();
  return cities.map(toAdminCity);
};

/**
 * Load a city document for editing.
 * @param {string} cityId - City id
 * @returns {Promise<Object>} City document
 * @throws {ApiError} 404
 */
const findCityOrThrow = async (cityId) => {
  const city = await City.findById(cityId);
  if (!city) throw ApiError.notFound(`City not found with id: ${cityId}`);
  return city;
};

/**
 * One city in the admin shape (also the "before" snapshot for the audit log).
 * @param {string} cityId - City id
 * @returns {Promise<Object>} Admin city
 * @throws {ApiError} 404
 */
const getAdminCity = async (cityId) => toAdminCity(await findCityOrThrow(cityId));

/**
 * Throw if another area in the city already has this name. (Pincodes may be shared:
 * one Indian pincode often covers several neighbourhoods.)
 * @param {Object} city - City document
 * @param {{ slug: string }} candidate - New or edited area
 * @param {string} [ignoreAreaId] - Area being edited
 */
const assertAreaIsUnique = (city, candidate, ignoreAreaId) => {
  const duplicate = city.areas.find(
    (area) => String(area._id) !== String(ignoreAreaId) && area.slug === candidate.slug,
  );
  if (duplicate) {
    throw ApiError.conflict(`An area named "${duplicate.name}" already exists in ${city.name}`, {
      code: 'AREA_EXISTS',
    });
  }
};

/**
 * Create a city.
 * @param {{ name: string, state: string, nameTranslations?: Object, location?: number[], active?: boolean }} input
 * @returns {Promise<Object>} Admin city
 */
const createCity = async ({ name, state, nameTranslations, location, active = true }) => {
  const city = await City.create({
    name,
    slug: slugify(name),
    state,
    nameTranslations,
    location: location ? { type: 'Point', coordinates: location } : undefined,
    active,
    areas: [],
  });
  return toAdminCity(city);
};

/**
 * Update a city's details or status.
 * @param {string} cityId - City id
 * @param {Object} changes - Allowed fields (validated by the route)
 * @returns {Promise<Object>} Admin city
 */
const updateCity = async (cityId, changes) => {
  const city = await findCityOrThrow(cityId);
  if (changes.name) {
    city.name = changes.name;
    city.slug = slugify(changes.name);
  }
  if (changes.state) city.state = changes.state;
  if (changes.nameTranslations) city.nameTranslations = changes.nameTranslations;
  if (changes.location) city.location = { type: 'Point', coordinates: changes.location };
  if (typeof changes.active === 'boolean') city.active = changes.active;
  await city.save();
  return toAdminCity(city);
};

/**
 * Add an area to a city.
 * @param {string} cityId - City id
 * @param {{ name: string, pincodes: string[], nameTranslations?: Object }} input
 * @returns {Promise<Object>} Admin city
 */
const addArea = async (cityId, { name, pincodes = [], nameTranslations }) => {
  const city = await findCityOrThrow(cityId);
  const area = { name, slug: slugify(name), pincodes: [...new Set(pincodes)], nameTranslations };
  assertAreaIsUnique(city, area);
  city.areas.push(area);
  await city.save();
  return toAdminCity(city);
};

/**
 * Edit an area (rename, pincodes, translations, enable/disable).
 * @param {string} cityId - City id
 * @param {string} areaId - Area id
 * @param {Object} changes - Allowed fields
 * @returns {Promise<Object>} Admin city
 */
const updateArea = async (cityId, areaId, changes) => {
  const city = await findCityOrThrow(cityId);
  const area = city.areas.id(areaId);
  if (!area) throw ApiError.notFound(`Area not found with id: ${areaId}`);

  const next = {
    slug: changes.name ? slugify(changes.name) : area.slug,
    pincodes: changes.pincodes ? [...new Set(changes.pincodes)] : area.pincodes,
  };
  assertAreaIsUnique(city, next, areaId);

  if (changes.name) {
    area.name = changes.name;
    area.slug = next.slug;
  }
  if (changes.pincodes) area.pincodes = next.pincodes;
  if (changes.nameTranslations) area.nameTranslations = changes.nameTranslations;
  if (typeof changes.active === 'boolean') area.active = changes.active;
  await city.save();
  return toAdminCity(city);
};

module.exports = {
  CITY_MATCH_RADIUS_KM,
  toPublicCity,
  listActiveCities,
  getActiveCityAndArea,
  matchLocation,
  listAllCities,
  getAdminCity,
  createCity,
  updateCity,
  addArea,
  updateArea,
};
