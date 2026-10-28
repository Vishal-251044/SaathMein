/**
 * Sanity checks for seed data: money in integer paise, valid commission rules, unique
 * slugs, translations present, and the launch decisions (groceries off, car fee ₹5,000).
 */
const Category = require('../../src/models/category.model');
const City = require('../../src/models/city.model');
const categories = require('../../src/scripts/data/categories.data');
const cities = require('../../src/scripts/data/cities.data');
const { slugify } = require('../../src/helpers/genericFunctions');

const leaves = categories.flatMap((parent) => parent.children);

describe('category seed data', () => {
  it('has unique slugs and Hindi + Marathi names everywhere', () => {
    const all = [...categories, ...leaves];
    expect(new Set(all.map((c) => c.slug)).size).toBe(all.length);
    all.forEach((category) => {
      expect(category.nameTranslations.hi).toBeTruthy();
      expect(category.nameTranslations.mr).toBeTruthy();
    });
  });

  it('passes model validation (integer paise, enums) for every leaf', async () => {
    for (const leaf of leaves) {
      const doc = new Category({ name: leaf.name, slug: leaf.slug, rules: leaf.rules });
      await expect(doc.validate()).resolves.toBeUndefined();
      expect(Number.isSafeInteger(leaf.rules.tokenAmountPaise)).toBe(true);
      expect(leaf.rules.minSize).toBeLessThanOrEqual(leaf.rules.maxSize);
    }
  });

  it('records the launch decisions', () => {
    const bySlug = Object.fromEntries(leaves.map((leaf) => [leaf.slug, leaf]));
    expect(bySlug['cars-evs'].rules.commission).toEqual({ type: 'flat', value: 500000 });
    expect(bySlug['two-wheelers'].rules.tokenAmountPaise).toBe(100000);
    expect(bySlug.groceries.active).toBe(false);
    leaves
      .filter((leaf) => leaf.slug !== 'groceries')
      .forEach((leaf) => expect(leaf.active).not.toBe(false));
  });
});

describe('city seed data', () => {
  it('has valid, unique areas with 6-digit pincodes', async () => {
    for (const city of cities) {
      const slugs = city.areas.map((area) => slugify(area.name));
      expect(new Set(slugs).size).toBe(slugs.length);

      const doc = new City({
        ...city,
        areas: city.areas.map(({ name, hi, mr, pincodes }) => ({
          name,
          slug: slugify(name),
          nameTranslations: { hi, mr },
          pincodes,
        })),
      });
      await expect(doc.validate()).resolves.toBeUndefined();
      city.areas.forEach((area) => {
        expect(area.hi && area.mr).toBeTruthy();
        area.pincodes.forEach((pin) => expect(pin).toMatch(/^[1-9]\d{5}$/));
      });
    }
  });
});
