/**
 * seed-cities — creates or updates launch cities and their areas (npm run seed:cities).
 * Safe to run again: cities match by slug, areas by slug. Areas added in the admin console
 * are kept, and an admin's on/off switch is never overwritten.
 */
const City = require('../models/city.model');
const { slugify } = require('../helpers/genericFunctions');
const { runScript } = require('./runScript');
const cities = require('./data/cities.data');

/**
 * Merge seed areas into a city's existing areas.
 * @param {Object[]} existingAreas - Areas already in the database
 * @param {Object[]} seedAreas - Areas from the seed file
 * @returns {Object[]} Merged areas
 */
const mergeAreas = (existingAreas, seedAreas) => {
  const bySlug = new Map(existingAreas.map((area) => [area.slug, area]));
  seedAreas.forEach(({ name, hi, mr, pincodes }) => {
    const slug = slugify(name);
    const current = bySlug.get(slug);
    bySlug.set(slug, {
      ...(current?.toObject ? current.toObject() : current),
      name,
      slug,
      nameTranslations: { hi, mr },
      pincodes: [...new Set([...(current?.pincodes || []), ...pincodes])],
      active: current ? current.active : true,
    });
  });
  return [...bySlug.values()];
};

runScript('SeedCities', async (log) => {
  for (const seed of cities) {
    const existing = await City.findOne({ slug: seed.slug });
    const areas = mergeAreas(existing?.areas || [], seed.areas);

    if (existing) {
      existing.set({
        name: seed.name,
        state: seed.state,
        nameTranslations: seed.nameTranslations,
        location: seed.location,
        areas,
      });
      await existing.save();
      log.info(`Updated ${seed.name}: ${areas.length} areas`);
    } else {
      await City.create({ ...seed, areas, active: true });
      log.info(`Created ${seed.name}: ${areas.length} areas`);
    }
  }
  return 0;
});
