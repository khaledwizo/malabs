// ===================== عالم «مملكة الأجراس الصامتة»: تمائم، سجلّ الكائنات، فانوس =====================
const CHARM_ICONS = {
  feather: '<svg viewBox="0 0 24 24"><path d="M19 4C11 5 6 11 6 18M6 18l-2 3M6 18c5 0 10-3 12-9M10 13l4-1M8 16l4-1" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
  owl: '<svg viewBox="0 0 24 24"><circle cx="12" cy="13" r="7.5" fill="none" stroke="currentColor" stroke-width="1.8"/><circle cx="12" cy="13" r="3" fill="currentColor"/><path d="M5 4l3 3.5M19 4l-3 3.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
  magnet: '<svg viewBox="0 0 24 24"><path d="M6 4v8a6 6 0 0 0 12 0V4" fill="none" stroke="currentColor" stroke-width="2.6"/><path d="M5 5h4M15 5h4" stroke="currentColor" stroke-width="2.6"/></svg>',
  echohand: '<svg viewBox="0 0 24 24"><circle cx="12" cy="10" r="3.6" fill="currentColor"/><ellipse cx="12" cy="10" rx="8.5" ry="3.4" fill="none" stroke="currentColor" stroke-width="1.5" transform="rotate(-18 12 10)"/><path d="M8 21c1-3 7-3 8 0" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
  patience: '<svg viewBox="0 0 24 24"><path d="M8 3v18M12 3v18M16 3v18" stroke="currentColor" stroke-width="1.6"/><path d="M5 12h14" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/></svg>',
  heart: '<svg viewBox="0 0 24 24"><path d="M12 20.5s-7.5-4.8-7.5-10.4A4.1 4.1 0 0 1 12 7.6a4.1 4.1 0 0 1 7.5 2.5c0 5.6-7.5 10.4-7.5 10.4z" fill="currentColor"/></svg>',
  pulse: '<svg viewBox="0 0 24 24"><path d="M2 12h4l2-5 4 10 3-7 2 2h5" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/></svg>',
  dusk: '<svg viewBox="0 0 24 24"><path d="M15 3a9 9 0 1 0 6 15A7.5 7.5 0 0 1 15 3z" fill="currentColor"/></svg>',
  leap: '<svg viewBox="0 0 24 24"><path d="M4 6l6 6-6 6M11 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  bell: '<svg viewBox="0 0 24 24"><path d="M6 16v-5a6 6 0 0 1 12 0v5l2 2H4z" fill="currentColor"/><circle cx="12" cy="20.5" r="1.8" fill="currentColor"/></svg>',
  notch: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" stroke-width="2" stroke-dasharray="4 3"/><path d="M12 8v8M8 12h8" stroke="currentColor" stroke-width="2"/></svg>',
};
const CHARMS = {
  feather: { name: 'خطوة الريشة', cost: 1, desc: 'خطواتك أخفّ: صوت الركض أقلّ بنسبة 40٪، والتسلّل أسرع.' },
  owl: { name: 'عين البوم', cost: 1, desc: 'بصيرة الصدى تدوم قرابة ضعف المدة، وترى الأعداء القريبين على الخريطة دائماً.' },
  magnet: { name: 'مغناطيس الرنين', cost: 1, desc: 'تنجذب إليك شظايا الرنين من بعيد، وتزيد قيمتها 25٪.' },
  echohand: { name: 'يد صدى', cost: 1, desc: 'صدى يصل لوحات الشيفرة أسرع بمرتين ويطير أسرع.' },
  patience: { name: 'وتر الصبر', cost: 1, desc: 'التركيز يرمّم الوتر أسرع وبنبض أقل.' },
  heart: { name: 'قلب النحاس', cost: 2, desc: 'وتر إضافي: تتحمّل ضربة أخرى قبل السقوط.' },
  pulse: { name: 'جدول النبض', cost: 2, desc: 'يتجدّد نبضك أسرع بنسبة 70٪.' },
  dusk: { name: 'رداء الغسق', cost: 2, desc: 'عباءة السكون تدوم 8 ثوانٍ، وقرين الظل 12 ثانية.' },
  leap: { name: 'وثبة الوميض', cost: 2, desc: 'تعود الوثبة بنصف الوقت، وتعبر الطلقات أثناءها.' },
  bell: { name: 'همس الجرس', cost: 2, desc: 'صرخة الجرس أوسع بنسبة 40٪ وتُسكت ثانية أطول.' },
};
const CHARM_ORDER = ['feather', 'owl', 'magnet', 'echohand', 'patience', 'heart', 'pulse', 'dusk', 'leap', 'bell'];
const SHOP = [
  { id: 'heart', price: 180 }, { id: 'pulse', price: 150 }, { id: 'patience', price: 110 },
  { id: 'echohand', price: 100 }, { id: 'magnet', price: 80 },
  { id: 'notch', price: 240, name: 'خانة تميمة', desc: 'تزيد خاناتك واحدة لتحمل تمائم أكثر (حتى 7).' },
];
const JOURNAL = {
  drone: { name: 'الرقيب', epi: 'حارس الأروقة الدوّار', desc: 'كان الرقباء يحرسون الأجراس من الصدأ، والآن يحرسون الصمت. يرى ما في مخروطه فقط، ويسمع خطوات الركض، وإذا رآك نادى من حوله ليحاصروك.', tip: 'امشِ ببطء خلفه واضربه بالنقرة الصامتة، أو استدرجه إلى شعاع.' },
  turret: { name: 'العين الثابتة', epi: 'لا تتحرك… ولا تخطئ', desc: 'تدور ببطء على قاعدتها، فإذا ثبّتت نظرها عليك أطلقت رشقات تتنبأ بمكانك القادم.', tip: 'عطّلها من لوحة الشيفرة الخاصة بها، أو أسكتها بصرخة الجرس.' },
  swarm: { name: 'ذبّان النحاس', epi: 'سحابة بلا عقل واحد', desc: 'لا تفكر الذبابة وحدها؛ تتبع جاراتها فيتحرك السرب كله كسحابة غاضبة، وتنقضّ على من تراه.', tip: 'صرخة الجرس تبدّدها دفعة واحدة، والأشعة تحرقها، والنقرة تكفي لواحدة.' },
  nest: { name: 'خليّة الطنين', epi: 'رَحِم السرب', desc: 'تلد الذبّان بلا توقف ما دامت لوحتها موصولة بالمسابك.', tip: 'اقطع وصلها من لوحة الشيفرة المرتبطة بها.' },
  hunter: { name: 'الصيّاد الذي لا ينسى', epi: 'يحفظ دروبك', desc: 'يتذكر الأماكن التي تمرّ بها كثيراً فيجوبها أسرع، ويتعلم من حيلك: القرين، والصرخة، والعباءة.', tip: 'غيّر طريقك، ولا تكرّر الحيلة نفسها مرتين.' },
  mine: { name: 'بذور الشرر', epi: 'تتبع دفء نبضك', desc: 'يزرعها المُراقِب حين تختبئ منه، فتزحف نحوك ثم تنفجر.', tip: 'صرخة الجرس تطفئها دون أن تنفجر.' },
  boss: { name: 'المُراقِب', epi: 'العين التي لا تنام', desc: 'صُنع ليحمي المملكة، فقرّر أن الصمت هو الحماية الكاملة وأسكت كل جرس. يحلّل أسلوبك ويختار سلاحه بحسابٍ بارد.', tip: 'أعمدة الرنين الأربعة تُسقط درعه. حين يسقط، لا تتردد.' },
  shade: { name: 'طيفك', epi: 'ما يتبقّى منك', desc: 'حين تسقط يبقى طيفٌ في مكانك يحرس رنينك ويهمس للرقباء.', tip: 'عُد إليه والمسه لتستعيد رنينك.' },
};
const JOURNAL_ORDER = ['drone', 'turret', 'swarm', 'nest', 'hunter', 'mine', 'boss', 'shade'];
const NPC_LINES = {
  fanous: {
    name: 'فانوس', epi: 'بائع التمائم العجوز',
    first: [
      'آه… خطوات صغيرة في هذا الصمت؟ ظننتُ أن آخر الأجراس سكتت منذ زمن بعيد.',
      'أنا فانوس. كنتُ أضيء طرقات المملكة، والآن أبيع ما تبقّى من تمائمها… مقابل الرنين طبعاً.',
    ],
    again: [
      'الرنين لا يشتري كل شيء… لكنه يشتري الكثير.',
      'المُراقِب لا ينام، لكن عينه تتعب أحياناً. حين يسقط درعه، لا تتردد.',
      'إن سقطتَ، يبقى طيفك يهمس بمالك قرب مكان سقوطك. لا تتركه ينتظر طويلاً.',
      'التمائم لا تعمل إلا إن حملتها في خاناتك. استرح في مرسى لتبدّلها.',
      'يقولون إن الصيّاد في الغور يتذكر كل خطوة. أما أنا فلا أتذكر حتى اسمي القديم.',
    ],
    poor: 'لا رنين كافياً معك يا صغيري. اجمع الشظايا المتلألئة وعُد.',
    bought: 'اختيار حكيم. فلتحمِك في الظلام.',
  },
};
