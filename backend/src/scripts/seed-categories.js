/**
 * seed-categories — creates the category tree with rules (npm run seed:categories).
 * Safe to run again: categories match by slug. Existing rules and the active switch are
 * NOT overwritten (admins may have changed them); pass --reset-rules to restore the
 * seed defaults on purpose.
 */
const Category = require('../models/category.model');
const { runScript } = require('./runScript');
const tree = require('./data/categories.data');

const shouldResetRules = process.argv.includes('--reset-rules');

/**
 * Create or update one category.
 * @param {Object} seed - Category from the seed file
 * @param {string|null} parentId - Parent category id
 * @returns {Promise<{ doc: Object, created: boolean }>}
 */
const upsertCategory = async (seed, parentId) => {
  const { children: _children, active = true, rules, ...fields } = seed;
  const existing = await Category.findOne({ slug: seed.slug });

  if (!existing) {
    const doc = await Category.create({ ...fields, parentId, active, rules });
    return { doc, created: true };
  }

  existing.set({ ...fields, parentId });
  if (shouldResetRules && rules) {
    existing.rules = rules;
    existing.active = active;
  }
  await existing.save();
  return { doc: existing, created: false };
};

runScript('SeedCategories', async (log) => {
  let created = 0;
  let updated = 0;

  for (const parentSeed of tree) {
    const parent = await upsertCategory(parentSeed, null);
    parent.created ? (created += 1) : (updated += 1);

    for (const childSeed of parentSeed.children || []) {
      const child = await upsertCategory(childSeed, parent.doc._id);
      child.created ? (created += 1) : (updated += 1);
    }
  }

  log.info(
    `Categories: ${created} created, ${updated} updated${shouldResetRules ? ' (rules reset)' : ''}`,
  );
  return 0;
});
