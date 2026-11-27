// المقدّمة السينمائية — القصة خيالية بالكامل (لا أسماء حقيقية ولا جهات حقيقية)
// بغداد، ليلة شتوية: أربعة أصحاب (ثلاثة بغداديين وإبراهيم التكريتي الساكن ببغداد) بمضيف الشيخ فاتح الرفاعي.
// الأخبار: قوات غازية تريد تحتل تكريت وبعدها بغداد. يدخل الشيخ بعمامته البيضاء ولحيته الطويلة، ويفتي:
// «رد الصائل واجب شرعاً». يبدون بالأكل... فيدخل ملثّم مدسوس من الغزاة ويرمي الشيخ بثلاث طلقات ويهرب.
// بالفجر يدفنونه بالمرقد الفارغ بالمقبرة القديمة، ويحطّون عمامته البيضاء على قبره، وبعد أشهر يسيّجونه ويبنون عليه قبّة.
// who: المتكلّم، shot: لقطة الكاميرا، act: حدث، hold: ثوانٍ إضافية، loud: صياح، weak: صوت واهن

export const CAST = {
  khaled: { name: 'خالد', v: 'b', p: -4, r: -3, char: 'khaled' },
  mohammed: { name: 'محمد', v: 'b', p: 8, r: 9, char: 'mohammed' },
  ibrahim: { name: 'إبراهيم التكريتي', v: 'b', p: -12, r: -5, char: 'ibrahim' },
  saif: { name: 'سيف', v: 'b', p: -9, r: -14, char: 'saif' },
  sheikh: { name: 'الشيخ فاتح الرفاعي', v: 'b', p: -20, r: -20 },
};

export const SCRIPT = [
  { card: 'بغداد... ليلةٌ شتويّةٌ باردة', shot: 'out', hold: 3.4 },
  { card: 'مضيف الشيخ فاتح الرفاعي', shot: 'wide', hold: 3.2 },
  { shot: 'wide2', hold: 2.0 },
  { who: 'mohammed', shot: 'mohammed', text: 'أسمعتمُ الأخبار؟ قوّاتُ الغزاةِ وصلَتْ أطرافَ تكريت.' },
  { who: 'ibrahim', shot: 'ibrahim', text: 'أهلي هناكَ يا محمّد... أمّي وأخواتي. البارحةَ كلَّمتُهم، وصوتُ الطائراتِ فوقَ رؤوسِهم.', hold: 0.5 },
  { who: 'khaled', shot: 'khaled', text: 'وبعدَ تكريت؟ يقولونَ إنَّ أعينَهم على بغداد.' },
  { who: 'saif', shot: 'saif', text: 'تكريتُ بوّابةُ بغداد. إذا سقطَتِ البوّابة... فنحنُ التالون.', hold: 0.5 },
  { who: 'mohammed', shot: 'mohammed2', text: 'وماذا نفعل؟ نجلسُ نسمعُ الأخبارَ ونشربُ الشاي؟!' },
  { who: 'ibrahim', shot: 'ibrahim2', text: 'أنا تكريتيّ، لي عشرونَ سنةً في بغداد... لكن واللهِ قلبي هناك.', hold: 0.6 },
  { who: 'khaled', shot: 'khaled2', text: 'اصبِروا يا جماعة. الشيخُ فاتحٌ يصلُ الآن، وهو يعرفُ ما الصواب.', hold: 0.6 },
  { shot: 'door', act: 'door', hold: 2.6 },
  { who: 'sheikh', shot: 'door', text: 'السلامُ عليكم ورحمةُ اللهِ وبركاتُه.' },
  { who: 'khaled', shot: 'wideStand', act: 'stand', text: 'وعليكمُ السلامُ ورحمةُ الله... تفضَّلْ يا شيخَنا، أنَرْتَ المضيف.' },
  { who: 'sheikh', shot: 'sheikh', act: 'sheikhSeat', text: 'اجلِسوا يا أبنائي، اجلِسوا. أعرفُ لماذا وجوهُكم هكذا.' },
  { who: 'sheikh', shot: 'sheikh2', text: 'دخلَ الغزاةُ أرضَنا بغيرِ حقّ. يريدونَ تكريت... وبعدَها بغداد.', hold: 0.5 },
  { who: 'ibrahim', shot: 'ibrahim', text: 'يا شيخَنا، أهلي في تكريت. ما واجبُنا؟' },
  { shot: 'plaque', act: 'drone', hold: 3.0 },
  { who: 'sheikh', shot: 'sheikhClose', text: 'اسمَعوني جيّداً. مَن يعتدي على الأرضِ والعِرضِ والمال... لا يُترَكُ يعبثُ بالناس.' },
  { who: 'sheikh', shot: 'sheikhClose', act: 'sheikhHand', loud: true, text: 'وحمايةُ أهلِنا شرفٌ لكلِّ قادر. تكريتُ وبغدادُ وأهلُهما أمانةٌ في أعناقِكم.', hold: 0.8 },
  { who: 'sheikh', shot: 'sheikh2', text: 'لكن احفَظوا وصيّتي: لا تعتدوا على بريء، ولا تؤذوا أسيراً، ولا تُفرِّقْكُمُ الدنيا.', hold: 0.6 },
  { who: 'mohammed', shot: 'mohammed', text: 'سمعاً وطاعةً يا شيخَنا.' },
  { who: 'saif', shot: 'saif2', text: 'على رؤوسِنا. واللهِ لا نتركُ شِبراً من أرضِنا للغزاة.', hold: 0.5 },
  { who: 'sheikh', shot: 'sheikh', act: 'calm', text: 'هيّا يا أبنائي، سمُّوا الله... الطعامُ يبرُد.' },
  { shot: 'hands', act: 'eat', hold: 3.2 },
  { who: 'khaled', shot: 'khaled', text: 'بسمِ الله... حفظَكَ اللهُ لنا يا شيخ.', hold: 0.4 },
  // الباب ينفتح بهدوء... ملثّم مدسوس من الغزاة، وبإيده بندقية
  { shot: 'door2', act: 'stranger', hold: 2.4 },
  { shot: 'doorHand', act: 'aim', hold: 1.3 },
  { shot: 'sheikhClose', act: 'shots3', hold: 2.2 },
  { shot: 'wideLow', act: 'flee', hold: 1.8 },
  { who: 'mohammed', shot: 'afterM', act: 'aftermath', loud: true, text: 'الشيخ!! أُصيبَ الشيخ!' },
  { who: 'khaled', shot: 'afterK', loud: true, text: 'خائن!! الحَقوه... خرجَ من الباب!' },
  { who: 'saif', shot: 'afterS2', loud: true, text: 'ملثَّمٌ مدسوسٌ من الغزاة... جاءَ ليُسكِتَ صوتَ الشيخ!' },
  { who: 'sheikh', shot: 'dying', act: 'dying', text: 'لا... لا تتفرَّقوا يا أبنائي... احموا الناس...', hold: 1.2 },
  { who: 'ibrahim', shot: 'afterI', text: 'إنّا للهِ وإنّا إليهِ راجعون...', hold: 1.4 },
  { shot: 'black', hold: 1.6 },
  { card: 'في الفجر... حملوا الشيخَ إلى المقبرةِ القديمة، إلى المرقدِ الذي كانَ فارغاً منذُ سنين.', shot: 'black', act: 'burialSet', hold: 4.4 },
  { shot: 'grave', hold: 3.0 },
  { who: 'khaled', shot: 'graveK', text: 'المرقدُ الذي كانَ فارغاً... صارَ فيهِ أطهرُ رجلٍ بيننا.' },
  { shot: 'graveTurban', act: 'turban', hold: 3.4 },
  { who: 'mohammed', shot: 'graveM', text: 'عِمامتُكَ البيضاءُ تبقى هنا يا شيخ... تُذكِّرُنا بوصيّتِك.' },
  { who: 'saif', shot: 'vow', text: 'نُعاهِدُك... لن نعودَ إلا وتكريتُ وبغدادُ حرّتان.' },
  { who: 'ibrahim', shot: 'vow', text: 'ونُعاهِدُكَ ألّا نعتديَ على بريء، كما أوصيتَنا.', hold: 0.8 },
  { card: 'وبعدَ أشهر... سيَّجوا القبرَ وبنَوا عليهِ مرقداً بقُبّةٍ خضراء.', shot: 'shrineBuilt', act: 'build', hold: 4.6 },
  { shot: 'shrineBuilt2', hold: 2.6 },
  { card: 'ومنذُ تلكَ الليلة... انطلقَتْ جبهةُ الرافدين.', shot: 'black', hold: 3.8 },
  { title: true, shot: 'black', hold: 3.2 },
];
