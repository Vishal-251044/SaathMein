/**
 * Notification texts per type and language (en / hi / mr). Stored in the user's language
 * when the notification is created. No emoji (CLAUDE.md §11).
 */
const { NOTIFICATION_TYPE: T } = require('../../constants/enums');

/** @type {Record<string, Record<string, (data: Object) => { title: string, body: string }>>} */
const TEMPLATES = {
  [T.GROUP_FULL]: {
    en: (d) => ({
      title: 'Your group is full',
      body: `${d.productName}: all ${d.targetSize} seats are taken. Dealers will now compete for your price.`,
    }),
    hi: (d) => ({
      title: 'आपका ग्रुप पूरा हो गया',
      body: `${d.productName}: सभी ${d.targetSize} सीटें भर गईं। अब डीलर आपकी कीमत के लिए मुकाबला करेंगे।`,
    }),
    mr: (d) => ({
      title: 'तुमचा ग्रुप पूर्ण झाला',
      body: `${d.productName}: सर्व ${d.targetSize} जागा भरल्या. आता डीलर तुमच्या किमतीसाठी स्पर्धा करतील.`,
    }),
  },
  [T.DEADLINE_SOON]: {
    en: (d) => ({
      title: '24 hours left',
      body: `${d.productName}: ${d.memberCount} of ${d.targetSize} joined. Share the group to fill it in time.`,
    }),
    hi: (d) => ({
      title: '24 घंटे बाकी',
      body: `${d.productName}: ${d.targetSize} में से ${d.memberCount} जुड़े। समय पर भरने के लिए ग्रुप शेयर करें।`,
    }),
    mr: (d) => ({
      title: '24 तास बाकी',
      body: `${d.productName}: ${d.targetSize} पैकी ${d.memberCount} सामील. वेळेत भरण्यासाठी ग्रुप शेअर करा.`,
    }),
  },
  [T.LEADER_DECISION]: {
    en: (d) => ({
      title: 'Your group needs a decision',
      body: `${d.productName} reached ${d.memberCount} of ${d.targetSize}. Extend once or start the dealer auction now.`,
    }),
    hi: (d) => ({
      title: 'आपके ग्रुप के लिए निर्णय चाहिए',
      body: `${d.productName}: ${d.targetSize} में से ${d.memberCount} जुड़े। एक बार समय बढ़ाएं या अभी नीलामी शुरू करें।`,
    }),
    mr: (d) => ({
      title: 'तुमच्या ग्रुपसाठी निर्णय हवा',
      body: `${d.productName}: ${d.targetSize} पैकी ${d.memberCount} सामील. एकदा मुदत वाढवा किंवा आता लिलाव सुरू करा.`,
    }),
  },
  [T.GROUP_ENDED]: {
    en: (d) => ({
      title: 'Group closed',
      body: `${d.productName}: the group ended without a deal. Your full token is being refunded.`,
    }),
    hi: (d) => ({
      title: 'ग्रुप बंद हुआ',
      body: `${d.productName}: ग्रुप बिना डील के खत्म हुआ। आपका पूरा टोकन वापस किया जा रहा है।`,
    }),
    mr: (d) => ({
      title: 'ग्रुप बंद झाला',
      body: `${d.productName}: ग्रुप डीलशिवाय संपला. तुमचे पूर्ण टोकन परत केले जात आहे.`,
    }),
  },
  [T.AUCTION_STARTED]: {
    en: (d) => ({
      title: 'Dealers are bidding',
      body: `${d.productName}: the live auction has started. Watch the price fall.`,
    }),
    hi: (d) => ({
      title: 'डीलर बोली लगा रहे हैं',
      body: `${d.productName}: लाइव नीलामी शुरू हो गई है। कीमत गिरती देखें।`,
    }),
    mr: (d) => ({
      title: 'डीलर बोली लावत आहेत',
      body: `${d.productName}: लाइव्ह लिलाव सुरू झाला आहे. किंमत कमी होताना पहा.`,
    }),
  },
  [T.REFUND_DONE]: {
    en: (d) => ({
      title: 'Refund done',
      body: `${d.amount} is on its way to your account. It can take 5–7 working days to show.`,
    }),
    hi: (d) => ({
      title: 'रिफ़ंड हो गया',
      body: `${d.amount} आपके खाते में भेजा गया है। दिखने में 5–7 कार्य दिवस लग सकते हैं।`,
    }),
    mr: (d) => ({
      title: 'रिफंड झाला',
      body: `${d.amount} तुमच्या खात्यात पाठवले आहेत. दिसायला 5–7 कामकाजाचे दिवस लागू शकतात.`,
    }),
  },
  [T.SEAT_OFFER]: {
    en: (d) => ({
      title: 'A seat is free for you',
      body: `${d.productName}: a seat opened up. Pay the token within 2 hours to take it.`,
    }),
    hi: (d) => ({
      title: 'आपके लिए एक सीट खाली है',
      body: `${d.productName}: एक सीट खाली हुई। लेने के लिए 2 घंटे में टोकन चुकाएं।`,
    }),
    mr: (d) => ({
      title: 'तुमच्यासाठी एक जागा मोकळी आहे',
      body: `${d.productName}: एक जागा मोकळी झाली. घेण्यासाठी 2 तासांत टोकन भरा.`,
    }),
  },
  [T.JOIN_REQUEST]: {
    en: (d) => ({
      title: 'New request to join',
      body: `${d.firstName} wants to join your ${d.productName} group.`,
    }),
    hi: (d) => ({
      title: 'जुड़ने का नया अनुरोध',
      body: `${d.firstName} आपके ${d.productName} ग्रुप से जुड़ना चाहते हैं।`,
    }),
    mr: (d) => ({
      title: 'सामील होण्याची नवी विनंती',
      body: `${d.firstName} तुमच्या ${d.productName} ग्रुपमध्ये सामील होऊ इच्छितात.`,
    }),
  },
  [T.REQUEST_DECIDED]: {
    en: (d) =>
      d.approved
        ? { title: 'You are approved', body: `${d.productName}: pay the token to take your seat.` }
        : {
            title: 'Request declined',
            body: `${d.productName}: the group leader declined your request.`,
          },
    hi: (d) =>
      d.approved
        ? { title: 'आपको मंज़ूरी मिल गई', body: `${d.productName}: सीट लेने के लिए टोकन चुकाएं।` }
        : {
            title: 'अनुरोध अस्वीकार',
            body: `${d.productName}: ग्रुप लीडर ने आपका अनुरोध अस्वीकार किया।`,
          },
    mr: (d) =>
      d.approved
        ? { title: 'तुम्हाला मंजुरी मिळाली', body: `${d.productName}: जागा घेण्यासाठी टोकन भरा.` }
        : { title: 'विनंती नाकारली', body: `${d.productName}: ग्रुप लीडरने तुमची विनंती नाकारली.` },
  },
};

/**
 * @param {string} type - NOTIFICATION_TYPE
 * @param {string} language - en / hi / mr
 * @param {Object} data - Values for the text
 * @returns {{ title: string, body: string }}
 */
const renderNotification = (type, language, data) => {
  const byLanguage = TEMPLATES[type];
  if (!byLanguage) throw new Error(`[Notifications] no template for ${type}`);
  return (byLanguage[language] || byLanguage.en)(data);
};

module.exports = { TEMPLATES, renderNotification };
