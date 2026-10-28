/**
 * Seed data — launch city Pune (PRD Q1) with its main residential areas and pincodes.
 * Pimpri-Chinchwad areas are included because buyers there use the same Pune dealers.
 * Pincodes are the main post-office codes for each area; several areas can share one.
 * Refine them in Admin → Cities.
 */
module.exports = [
  {
    name: 'Pune',
    slug: 'pune',
    state: 'Maharashtra',
    nameTranslations: { hi: 'पुणे', mr: 'पुणे' },
    location: { type: 'Point', coordinates: [73.8567, 18.5204] },
    areas: [
      { name: 'Aundh', hi: 'औंध', mr: 'औंध', pincodes: ['411007'] },
      { name: 'Balewadi', hi: 'बालेवाडी', mr: 'बालेवाडी', pincodes: ['411045'] },
      { name: 'Baner', hi: 'बाणेर', mr: 'बाणेर', pincodes: ['411045'] },
      { name: 'Bavdhan', hi: 'बावधन', mr: 'बावधन', pincodes: ['411021'] },
      { name: 'Bhosari', hi: 'भोसरी', mr: 'भोसरी', pincodes: ['411026'] },
      { name: 'Bibwewadi', hi: 'बिबवेवाडी', mr: 'बिबवेवाडी', pincodes: ['411037'] },
      { name: 'Camp', hi: 'कैंप', mr: 'कॅम्प', pincodes: ['411001'] },
      { name: 'Chinchwad', hi: 'चिंचवड', mr: 'चिंचवड', pincodes: ['411019', '411033'] },
      { name: 'Deccan', hi: 'डेक्कन', mr: 'डेक्कन', pincodes: ['411004'] },
      { name: 'Dhanori', hi: 'धानोरी', mr: 'धानोरी', pincodes: ['411015'] },
      { name: 'Hadapsar', hi: 'हडपसर', mr: 'हडपसर', pincodes: ['411028'] },
      { name: 'Hinjewadi', hi: 'हिंजवडी', mr: 'हिंजवडी', pincodes: ['411057'] },
      { name: 'Kalyani Nagar', hi: 'कल्याणी नगर', mr: 'कल्याणीनगर', pincodes: ['411006'] },
      { name: 'Karve Nagar', hi: 'कर्वे नगर', mr: 'कर्वेनगर', pincodes: ['411052'] },
      { name: 'Katraj', hi: 'कात्रज', mr: 'कात्रज', pincodes: ['411046'] },
      { name: 'Kharadi', hi: 'खराडी', mr: 'खराडी', pincodes: ['411014'] },
      { name: 'Kondhwa', hi: 'कोंढवा', mr: 'कोंढवा', pincodes: ['411048'] },
      { name: 'Koregaon Park', hi: 'कोरेगांव पार्क', mr: 'कोरेगाव पार्क', pincodes: ['411001'] },
      { name: 'Kothrud', hi: 'कोथरूड', mr: 'कोथरूड', pincodes: ['411038'] },
      { name: 'Magarpatta', hi: 'मगरपट्टा', mr: 'मगरपट्टा', pincodes: ['411013'] },
      { name: 'Moshi', hi: 'मोशी', mr: 'मोशी', pincodes: ['412105'] },
      { name: 'Mundhwa', hi: 'मुंढवा', mr: 'मुंढवा', pincodes: ['411036'] },
      { name: 'Nigdi', hi: 'निगडी', mr: 'निगडी', pincodes: ['411044'] },
      { name: 'Pashan', hi: 'पाषाण', mr: 'पाषाण', pincodes: ['411021'] },
      { name: 'Pimple Saudagar', hi: 'पिंपले सौदागर', mr: 'पिंपळे सौदागर', pincodes: ['411027'] },
      { name: 'Pimpri', hi: 'पिंपरी', mr: 'पिंपरी', pincodes: ['411018'] },
      { name: 'Ravet', hi: 'रावेत', mr: 'रावेत', pincodes: ['412101'] },
      { name: 'Shivajinagar', hi: 'शिवाजीनगर', mr: 'शिवाजीनगर', pincodes: ['411005'] },
      { name: 'Sinhagad Road', hi: 'सिंहगढ़ रोड', mr: 'सिंहगड रोड', pincodes: ['411041'] },
      { name: 'Swargate', hi: 'स्वारगेट', mr: 'स्वारगेट', pincodes: ['411042'] },
      { name: 'Undri', hi: 'उंड्री', mr: 'उंड्री', pincodes: ['411060'] },
      { name: 'Viman Nagar', hi: 'विमान नगर', mr: 'विमाननगर', pincodes: ['411014'] },
      { name: 'Wagholi', hi: 'वाघोली', mr: 'वाघोली', pincodes: ['412207'] },
      { name: 'Wakad', hi: 'वाकड', mr: 'वाकड', pincodes: ['411057'] },
      { name: 'Wanowrie', hi: 'वानवडी', mr: 'वानवडी', pincodes: ['411040'] },
      { name: 'Warje', hi: 'वारजे', mr: 'वारजे', pincodes: ['411058'] },
      { name: 'Yerwada', hi: 'येरवडा', mr: 'येरवडा', pincodes: ['411006'] },
    ],
  },
];
