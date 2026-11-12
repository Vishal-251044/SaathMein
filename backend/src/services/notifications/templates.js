/**
 * Notification texts per type and language (en / hi / mr). Stored in the user's language
 * when the notification is created. No emoji (CLAUDE.md §11).
 */
const { NOTIFICATION_TYPE: T } = require('../../constants/enums');

/** @type {Record<string, Record<string, (data: Object) => { title: string, body: string }>>} */
const TEMPLATES = {
  // Day 12: disputes (TRU-4)
  [T.DEALER_DISPUTE_OPENED]: {
    en: (d) => ({
      title: 'A buyer opened a dispute',
      body: `${d.productName}: please answer on the Disputes page within ${d.hours} hours.`,
    }),
    hi: (d) => ({
      title: 'एक खरीदार ने शिकायत दर्ज की',
      body: `${d.productName}: कृपया ${d.hours} घंटे के अंदर Disputes पेज पर जवाब दें।`,
    }),
    mr: (d) => ({
      title: 'एका खरेदीदाराने तक्रार नोंदवली',
      body: `${d.productName}: कृपया ${d.hours} तासांत Disputes पेजवर उत्तर द्या.`,
    }),
  },
  [T.DISPUTE_UPDATE]: {
    en: (d) => ({
      title:
        d.status === 'resolved' ? 'Your dispute is decided' : 'The dealer answered your dispute',
      body:
        d.status === 'resolved'
          ? 'Open the app to see the decision.'
          : 'SaathMein Support will now review it.',
    }),
    hi: (d) => ({
      title:
        d.status === 'resolved'
          ? 'आपकी शिकायत पर फैसला हो गया'
          : 'डीलर ने आपकी शिकायत का जवाब दिया',
      body:
        d.status === 'resolved'
          ? 'फैसला देखने के लिए ऐप खोलें।'
          : 'अब SaathMein सपोर्ट इसकी जाँच करेगा।',
    }),
    mr: (d) => ({
      title:
        d.status === 'resolved'
          ? 'तुमच्या तक्रारीवर निर्णय झाला'
          : 'डीलरने तुमच्या तक्रारीला उत्तर दिले',
      body:
        d.status === 'resolved'
          ? 'निर्णय पाहण्यासाठी अ‍ॅप उघडा.'
          : 'आता SaathMein सपोर्ट याची तपासणी करेल.',
    }),
  },
  // Day 10: purchases (PUR-1 to PUR-4)
  [T.DEAL_CODE_EXPIRING]: {
    en: (d) => ({
      title: 'Your price ends soon',
      body: `${d.productName}: your deal code works until ${d.date}. Visit the dealer before then.`,
    }),
    hi: (d) => ({
      title: 'आपकी कीमत जल्द खत्म होगी',
      body: `${d.productName}: आपका डील कोड ${d.date} तक चलेगा। उससे पहले डीलर के पास जाएँ।`,
    }),
    mr: (d) => ({
      title: 'तुमची किंमत लवकरच संपेल',
      body: `${d.productName}: तुमचा डील कोड ${d.date} पर्यंत चालेल. त्याआधी डीलरकडे जा.`,
    }),
  },
  [T.DEAL_CODE_EXPIRED]: {
    en: (d) => ({
      title: 'Your deal code expired',
      body: `${d.productName}: the dealer's price ended before you bought. Your token is being refunded minus the back-out fee.`,
    }),
    hi: (d) => ({
      title: 'आपका डील कोड खत्म हो गया',
      body: `${d.productName}: खरीदने से पहले डीलर की कीमत की अवधि खत्म हो गई। बैक-आउट फीस काटकर आपका टोकन वापस किया जा रहा है।`,
    }),
    mr: (d) => ({
      title: 'तुमचा डील कोड संपला',
      body: `${d.productName}: खरेदीपूर्वी डीलरच्या किमतीची मुदत संपली. बॅक-आउट फी वजा करून तुमचे टोकन परत केले जात आहे.`,
    }),
  },
  [T.PURCHASE_COMPLETED]: {
    en: (d) => ({
      title: `You saved ${d.saved}`,
      body: `${d.productName}: purchase complete. Rate the dealer and share your saving.`,
    }),
    hi: (d) => ({
      title: `आपने ${d.saved} बचाए`,
      body: `${d.productName}: खरीद पूरी हुई। डीलर को रेटिंग दें और अपनी बचत शेयर करें।`,
    }),
    mr: (d) => ({
      title: `तुम्ही ${d.saved} वाचवले`,
      body: `${d.productName}: खरेदी पूर्ण झाली. डीलरला रेटिंग द्या आणि तुमची बचत शेअर करा.`,
    }),
  },
  [T.DEALER_INVOICE_UPLOADED]: {
    en: (d) => ({
      title: 'A buyer uploaded an invoice',
      body: `${d.productName}: the purchase completes in ${d.hours} hours unless you object on the Purchases page.`,
    }),
    hi: (d) => ({
      title: 'एक खरीदार ने बिल अपलोड किया',
      body: `${d.productName}: अगर आप Purchases पेज पर आपत्ति नहीं करते, तो ${d.hours} घंटे में खरीद पूरी हो जाएगी।`,
    }),
    mr: (d) => ({
      title: 'एका खरेदीदाराने बिल अपलोड केले',
      body: `${d.productName}: तुम्ही Purchases पेजवर आक्षेप घेतला नाही, तर ${d.hours} तासांत खरेदी पूर्ण होईल.`,
    }),
  },
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

  /* ---------------------------- Live auction (Day 9) ---------------------------- */

  [T.NEW_LOWEST_PRICE]: {
    en: (d) => ({
      title: `New lowest price: ${d.price}`,
      body: `${d.productName}: dealers are competing. You save ${d.saved} so far.`,
    }),
    hi: (d) => ({
      title: `नई सबसे कम कीमत: ${d.price}`,
      body: `${d.productName}: डीलर मुकाबला कर रहे हैं। अब तक ${d.saved} की बचत।`,
    }),
    mr: (d) => ({
      title: `नवी सर्वात कमी किंमत: ${d.price}`,
      body: `${d.productName}: डीलर स्पर्धा करत आहेत. आतापर्यंत ${d.saved} ची बचत.`,
    }),
  },
  [T.AUCTION_WON]: {
    en: (d) => ({
      title: `Winning price: ${d.price}`,
      body: `${d.productName}: ${d.dealerName} won. Your deal code is ready. You can still exit within 24 hours.`,
    }),
    hi: (d) => ({
      title: `जीतने वाली कीमत: ${d.price}`,
      body: `${d.productName}: ${d.dealerName} जीते। आपका डील कोड तैयार है। 24 घंटे में अभी भी निकल सकते हैं।`,
    }),
    mr: (d) => ({
      title: `जिंकलेली किंमत: ${d.price}`,
      body: `${d.productName}: ${d.dealerName} जिंकले. तुमचा डील कोड तयार आहे. 24 तासांत अजूनही बाहेर पडू शकता.`,
    }),
  },
  [T.SINGLE_BID_DECISION]: {
    en: (d) => ({
      title: 'Only one dealer bid',
      body: `${d.productName}: one dealer offered ${d.price}. Accept it or cancel with full refunds within 24 hours.`,
    }),
    hi: (d) => ({
      title: 'सिर्फ एक डीलर ने बोली लगाई',
      body: `${d.productName}: एक डीलर ने ${d.price} दिया। 24 घंटे में स्वीकार करें या पूरे रिफ़ंड के साथ रद्द करें।`,
    }),
    mr: (d) => ({
      title: 'फक्त एका डीलरने बोली लावली',
      body: `${d.productName}: एका डीलरने ${d.price} दिले. 24 तासांत स्वीकारा किंवा पूर्ण रिफंडसह रद्द करा.`,
    }),
  },
  [T.TIER_UNLOCKED]: {
    en: (d) => ({
      title: `Price dropped to ${d.price}`,
      body: `${d.productName}: ${d.memberCount} joined, a new discount tier is unlocked for everyone.`,
    }),
    hi: (d) => ({
      title: `कीमत घटकर ${d.price}`,
      body: `${d.productName}: ${d.memberCount} जुड़े, सबके लिए नया डिस्काउंट स्तर खुला।`,
    }),
    mr: (d) => ({
      title: `किंमत कमी होऊन ${d.price}`,
      body: `${d.productName}: ${d.memberCount} सामील, सर्वांसाठी नवा सवलत स्तर खुला.`,
    }),
  },
  [T.DEALER_AUCTION_OPEN]: {
    en: (d) => ({
      title: 'New group auction',
      body: `${d.memberCount} buyers want ${d.productName}. Join and bid.`,
    }),
    hi: (d) => ({
      title: 'नई ग्रुप नीलामी',
      body: `${d.memberCount} खरीदार ${d.productName} चाहते हैं। जुड़ें और बोली लगाएं।`,
    }),
    mr: (d) => ({
      title: 'नवा ग्रुप लिलाव',
      body: `${d.memberCount} खरेदीदारांना ${d.productName} हवा आहे. सामील व्हा आणि बोली लावा.`,
    }),
  },
  [T.DEALER_OUTBID]: {
    en: (d) => ({
      title: 'You have been outbid',
      body: `${d.productName}: the lowest price is now ${d.price}.`,
    }),
    hi: (d) => ({
      title: 'आपसे कम बोली लगी',
      body: `${d.productName}: अब सबसे कम कीमत ${d.price} है।`,
    }),
    mr: (d) => ({
      title: 'तुमच्यापेक्षा कमी बोली लागली',
      body: `${d.productName}: आता सर्वात कमी किंमत ${d.price} आहे.`,
    }),
  },
  [T.DEALER_RESULT]: {
    en: (d) =>
      d.won
        ? {
            title: 'You won the group',
            body: `${d.productName}: ${d.memberCount} buyers at ${d.price}.`,
          }
        : { title: 'Auction closed', body: `${d.productName} closed at ${d.price}.` },
    hi: (d) =>
      d.won
        ? {
            title: 'आप ग्रुप जीत गए',
            body: `${d.productName}: ${d.price} पर ${d.memberCount} खरीदार।`,
          }
        : { title: 'नीलामी बंद', body: `${d.productName} ${d.price} पर बंद हुई।` },
    mr: (d) =>
      d.won
        ? {
            title: 'तुम्ही ग्रुप जिंकला',
            body: `${d.productName}: ${d.price} ला ${d.memberCount} खरेदीदार.`,
          }
        : { title: 'लिलाव बंद', body: `${d.productName} ${d.price} ला बंद झाला.` },
  },
  [T.RUNNER_UP_OFFER]: {
    en: (d) => ({
      title: 'The group is offered to you',
      body: `${d.productName}: the winner backed out. Take it at your price ${d.price}.`,
    }),
    hi: (d) => ({
      title: 'ग्रुप आपको दिया जा रहा है',
      body: `${d.productName}: विजेता पीछे हट गया। अपनी कीमत ${d.price} पर लें।`,
    }),
    mr: (d) => ({
      title: 'ग्रुप तुम्हाला दिला जात आहे',
      body: `${d.productName}: विजेता मागे हटला. तुमच्या ${d.price} किमतीत घ्या.`,
    }),
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
