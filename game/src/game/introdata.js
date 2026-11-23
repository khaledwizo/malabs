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
  { card: 'بغداد... ليلة شتوية باردة', shot: 'out', hold: 3.4 },
  { card: 'مضيف الشيخ فاتح الرفاعي', shot: 'wide', hold: 3.2 },
  { shot: 'wide2', hold: 2.0 },
  { who: 'mohammed', shot: 'mohammed', text: 'سمعتوا الأخبار؟ قوات الغزاة وصلت أطراف تكريت.' },
  { who: 'ibrahim', shot: 'ibrahim', text: 'أهلي هناك يا محمد... أمّي وخواتي. البارحة حچيت وياهم، وصوت الطيارات فوق راسهم.', hold: 0.5 },
  { who: 'khaled', shot: 'khaled', text: 'وبعد تكريت؟ يگولون عينهم على بغداد.' },
  { who: 'saif', shot: 'saif', text: 'تكريت بوابة بغداد. إذا وگعت البوابة... إحنا التالين.', hold: 0.5 },
  { who: 'mohammed', shot: 'mohammed2', text: 'وشنسوّي؟ نگعد نسمع الأخبار ونشرب شاي؟!' },
  { who: 'ibrahim', shot: 'ibrahim2', text: 'آني تكريتي، صارلي عشرين سنة ببغداد... بس والله گلبي هناك.', hold: 0.6 },
  { who: 'khaled', shot: 'khaled2', text: 'اصبروا يا جماعة. الشيخ فاتح هسّه يوصل، وهو يعرف شنو الصح.', hold: 0.6 },
  { shot: 'door', act: 'door', hold: 2.6 },
  { who: 'sheikh', shot: 'door', text: 'السلام عليكم ورحمة الله وبركاته.' },
  { who: 'khaled', shot: 'wideStand', act: 'stand', text: 'وعليكم السلام ورحمة الله... تفضّل شيخنا، نوّرت المضيف.' },
  { who: 'sheikh', shot: 'sheikh', act: 'sheikhSeat', text: 'اگعدوا يا أولادي، اگعدوا. أعرف ليش وجوهكم هيچ.' },
  { who: 'sheikh', shot: 'sheikh2', text: 'الغزاة دخلوا أرضنا بلا حق. يريدون تكريت... وبعدها بغداد.', hold: 0.5 },
  { who: 'ibrahim', shot: 'ibrahim', text: 'شيخنا، أهلي بتكريت. شنو واجبنا؟' },
  { shot: 'plaque', act: 'drone', hold: 3.0 },
  { who: 'sheikh', shot: 'sheikhClose', text: 'اسمعوني زين. اللي يعتدي على الأرض والعرض والمال... اسمه بالشرع صائل.' },
  { who: 'sheikh', shot: 'sheikhClose', act: 'sheikhHand', loud: true, text: 'ورد الصائل واجب شرعاً. الدفاع عن تكريت وبغداد وأهلها فرض على كل قادر.', hold: 0.8 },
  { who: 'sheikh', shot: 'sheikh2', text: 'بس احفظوا وصيتي: لا تعتدون على بريء، ولا تأذون أسير، ولا تفرّقكم الدنيا.', hold: 0.6 },
  { who: 'mohammed', shot: 'mohammed', text: 'سمعاً وطاعة شيخنا.' },
  { who: 'saif', shot: 'saif2', text: 'على راسنا. والله ما نخلّي شبر من أرضنا للغزاة.', hold: 0.5 },
  { who: 'sheikh', shot: 'sheikh', act: 'calm', text: 'يلّا يا أولادي، سمّوا بالله... الأكل يبرد.' },
  { shot: 'hands', act: 'eat', hold: 3.2 },
  { who: 'khaled', shot: 'khaled', text: 'بسم الله... الله يخلّيك إلنا يا شيخ.', hold: 0.4 },
  // الباب ينفتح بهدوء... ملثّم مدسوس من الغزاة، وبإيده بندقية
  { shot: 'door2', act: 'stranger', hold: 2.4 },
  { shot: 'doorHand', act: 'aim', hold: 1.3 },
  { shot: 'sheikhClose', act: 'shots3', hold: 2.2 },
  { shot: 'wideLow', act: 'flee', hold: 1.8 },
  { who: 'mohammed', shot: 'afterM', act: 'aftermath', loud: true, text: 'الشيخ!! الشيخ انصاب!' },
  { who: 'khaled', shot: 'afterK', loud: true, text: 'خائن!! لحگوه... طلع من الباب!' },
  { who: 'saif', shot: 'afterS2', loud: true, text: 'ملثّم مدسوس من الغزاة... جاي على فتوى الشيخ!' },
  { who: 'sheikh', shot: 'dying', act: 'dying', text: 'لا... لا تتفرّقون يا أولادي... ردّوا الصائل...', hold: 1.2 },
  { who: 'ibrahim', shot: 'afterI', text: 'إنّا لله وإنّا إليه راجعون...', hold: 1.4 },
  { shot: 'black', hold: 1.6 },
  { card: 'بالفجر... حملوا الشيخ للمقبرة القديمة، للمرقد اللي چان فارغ من سنين.', shot: 'black', act: 'burialSet', hold: 4.4 },
  { shot: 'grave', hold: 3.0 },
  { who: 'khaled', shot: 'graveK', text: 'المرقد اللي چان فارغ... صار بيه أطهر واحد بينا.' },
  { shot: 'graveTurban', act: 'turban', hold: 3.4 },
  { who: 'mohammed', shot: 'graveM', text: 'عمامتك البيضاء تبقى هنا يا شيخ... تذكّرنا بفتواك.' },
  { who: 'saif', shot: 'vow', text: 'نعاهدك... ما نرجع إلا وتكريت وبغداد حرّة.' },
  { who: 'ibrahim', shot: 'vow', text: 'ونعاهدك ما نعتدي على بريء، مثل ما وصّيتنا.', hold: 0.8 },
  { card: 'وبعد أشهر... سيّجوا القبر وبنوا عليه مرقداً بقبّة خضراء.', shot: 'shrineBuilt', act: 'build', hold: 4.6 },
  { shot: 'shrineBuilt2', hold: 2.6 },
  { card: 'ومن ذيچ الليلة... انطلقت جبهة الرافدين.', shot: 'black', hold: 3.8 },
  { title: true, shot: 'black', hold: 3.2 },
];
