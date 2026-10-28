/**
 * Seed data — category tree with business rules (PRD §10.2 launch categories, §5 revenue).
 * All amounts are integer paise; percentages are basis points (300 = 3%).
 *
 * Decisions (28 Oct 2026, Vishal): every category active except groceries (needs delivery,
 * PRD Q10); car commission flat ₹5,000 (PRD Q4). Other commissions use the middle of the
 * PRD ranges. Everything here is editable later in the admin console.
 */
const rupees = (amount) => Math.round(amount * 100);

/** Defaults shared by every leaf category (PRD §10.5 auction rules). */
const BASE_RULES = {
  deadlineDays: { min: 3, max: 30 },
  auction: {
    durationHours: 24,
    minDurationHours: 6,
    maxDurationHours: 72,
    minStepPaise: rupees(200),
    minStepBps: 25,
    antiSnipeMinutes: 5,
    maxExtensions: 6,
    minDealers: 2,
    priceValidityDays: 7,
  },
  backoutFeePaise: rupees(99),
};

/**
 * Build leaf rules on top of the shared defaults.
 * @param {Object} overrides - Size, token and commission for one category
 * @returns {Object} Full rules object
 */
const rules = ({ minSize, maxSize, tokenRupees, commission, backoutFeeRupees }) => ({
  ...BASE_RULES,
  minSize,
  maxSize,
  tokenAmountPaise: rupees(tokenRupees),
  commission,
  ...(backoutFeeRupees !== undefined ? { backoutFeePaise: rupees(backoutFeeRupees) } : {}),
});

const flat = (amountRupees) => ({ type: 'flat', value: rupees(amountRupees) });
const percent = (bps) => ({ type: 'percent', value: bps });

module.exports = [
  {
    name: 'Vehicles',
    slug: 'vehicles',
    icon: 'car',
    order: 1,
    nameTranslations: { hi: 'वाहन', mr: 'वाहने' },
    children: [
      {
        name: 'Cars and EVs',
        slug: 'cars-evs',
        icon: 'car',
        order: 1,
        nameTranslations: { hi: 'कार और EV', mr: 'कार आणि EV' },
        featuredBrands: [
          'Tata',
          'Mahindra',
          'Maruti Suzuki',
          'Hyundai',
          'Kia',
          'Toyota',
          'MG',
          'Honda',
        ],
        rules: rules({ minSize: 5, maxSize: 20, tokenRupees: 2000, commission: flat(5000) }),
      },
      {
        name: 'Two-wheelers',
        slug: 'two-wheelers',
        icon: 'bike',
        order: 2,
        nameTranslations: { hi: 'दोपहिया', mr: 'दुचाकी' },
        featuredBrands: [
          'Honda',
          'Hero',
          'TVS',
          'Bajaj',
          'Royal Enfield',
          'Suzuki',
          'Yamaha',
          'Ather',
          'Ola Electric',
        ],
        rules: rules({ minSize: 10, maxSize: 25, tokenRupees: 1000, commission: flat(1000) }),
      },
    ],
  },
  {
    name: 'Electronics',
    slug: 'electronics',
    icon: 'smartphone',
    order: 2,
    nameTranslations: { hi: 'इलेक्ट्रॉनिक्स', mr: 'इलेक्ट्रॉनिक्स' },
    children: [
      {
        name: 'Mobiles and laptops',
        slug: 'mobiles-laptops',
        icon: 'smartphone',
        order: 1,
        nameTranslations: { hi: 'मोबाइल और लैपटॉप', mr: 'मोबाइल आणि लॅपटॉप' },
        featuredBrands: [
          'Apple',
          'Samsung',
          'OnePlus',
          'Xiaomi',
          'Vivo',
          'Oppo',
          'Realme',
          'Google',
          'HP',
          'Dell',
          'Lenovo',
          'Asus',
        ],
        rules: rules({ minSize: 10, maxSize: 30, tokenRupees: 500, commission: percent(300) }),
      },
      {
        name: 'ACs, TVs and appliances',
        slug: 'appliances',
        icon: 'air-vent',
        order: 2,
        nameTranslations: { hi: 'AC, TV और उपकरण', mr: 'AC, TV आणि उपकरणे' },
        featuredBrands: [
          'LG',
          'Samsung',
          'Voltas',
          'Daikin',
          'Blue Star',
          'Sony',
          'Whirlpool',
          'Godrej',
        ],
        rules: rules({ minSize: 10, maxSize: 25, tokenRupees: 500, commission: percent(300) }),
      },
    ],
  },
  {
    name: 'Home',
    slug: 'home',
    icon: 'house',
    order: 3,
    nameTranslations: { hi: 'घर', mr: 'घर' },
    children: [
      {
        name: 'Rooftop solar',
        slug: 'rooftop-solar',
        icon: 'sun',
        order: 1,
        nameTranslations: { hi: 'रूफटॉप सोलर', mr: 'छतावरील सोलर' },
        featuredBrands: ['Tata Power Solar', 'Waaree', 'Adani Solar', 'Loom Solar'],
        rules: rules({ minSize: 10, maxSize: 100, tokenRupees: 1000, commission: percent(250) }),
      },
      {
        name: 'Home interiors and kitchens',
        slug: 'home-interiors',
        icon: 'sofa',
        order: 2,
        nameTranslations: { hi: 'होम इंटीरियर और किचन', mr: 'होम इंटिरियर आणि किचन' },
        featuredBrands: [],
        rules: rules({ minSize: 10, maxSize: 100, tokenRupees: 1000, commission: percent(250) }),
      },
    ],
  },
  {
    name: 'Daily needs',
    slug: 'daily-needs',
    icon: 'shopping-basket',
    order: 4,
    nameTranslations: { hi: 'रोज़मर्रा की ज़रूरतें', mr: 'दैनंदिन गरजा' },
    active: false, // only child is groceries (later, PRD Q10)
    children: [
      {
        name: 'Groceries and staples',
        slug: 'groceries',
        icon: 'shopping-basket',
        order: 1,
        active: false,
        nameTranslations: { hi: 'किराना और राशन', mr: 'किराणा आणि धान्य' },
        featuredBrands: [],
        // Groceries are a prepaid order, not a token (PRD §10.2), so no back-out fee
        rules: rules({
          minSize: 20,
          maxSize: 200,
          tokenRupees: 0,
          commission: percent(450),
          backoutFeeRupees: 0,
        }),
      },
    ],
  },
  {
    name: 'Services',
    slug: 'services',
    icon: 'graduation-cap',
    order: 5,
    nameTranslations: { hi: 'सेवाएँ', mr: 'सेवा' },
    children: [
      {
        name: 'Gym, coaching and courses',
        slug: 'gym-courses',
        icon: 'dumbbell',
        order: 1,
        nameTranslations: { hi: 'जिम, कोचिंग और कोर्स', mr: 'जिम, कोचिंग आणि कोर्स' },
        featuredBrands: [],
        rules: rules({ minSize: 10, maxSize: 50, tokenRupees: 200, commission: percent(500) }),
      },
    ],
  },
];
