// المقدّمة السينمائية — القصة خيالية بالكامل
// بعد انتخابات المدينة، جماعة «تجمّع التكارتة» تحالفت مع العصائب (ولهم تاريخ أسود بالمنطقة)، والتكارتة الأصليون
// من خارج التجمّع ناقمون عليهم. الشيخ إبراهيم الهاشمي يجمعهم على العشاء للصلح، فيدخل واحد من العصائب من الباب
// ويرمي رمّانة ليشعل الفتنة... فيظن جماعة التجمّع أن إخوتهم هم من رماها، وتبدأ الحرب.
// who: المتكلّم، shot: لقطة الكاميرا، act: حدث، hold: ثوانٍ إضافية، loud: صياح

export const CAST = {
  khaled: { name: 'خالد', v: 'b', p: -4, r: -3, char: 'khaled' },
  mohammed: { name: 'محمد', v: 'b', p: 8, r: 9, char: 'mohammed' },
  ibrahim: { name: 'إبراهيم', v: 'b', p: -12, r: -5, char: 'ibrahim' },
  saif: { name: 'سيف', v: 'b', p: -9, r: -14, char: 'saif' },
  sheikh: { name: 'الشيخ إبراهيم الهاشمي', v: 'b', p: -19, r: -18 },
};

export const SCRIPT = [
  { card: 'تكريت... بعد انتخابات المدينة بأسبوع', shot: 'out', hold: 3.4 },
  { card: 'مضيف الشيخ إبراهيم الهاشمي — عشاء صلح', shot: 'wide', hold: 3.4 },
  { shot: 'wide2', hold: 2.2 },
  { who: 'khaled', shot: 'khaled', text: 'يا جماعة، الأكل دايبرد... خلّونا نسمّي بالله ونبدي.' },
  { who: 'mohammed', shot: 'mohammed', text: 'شلون آكل خبز وملح ويّا ناس حطّوا إيدهم بإيد العصائب بالانتخابات؟' },
  { who: 'ibrahim', shot: 'ibrahim', text: 'الانتخابات سياسة يا محمد. تحالفنا حتى نجيب خدمات للمدينة، مو حتى نبيع دم أهلنا.' },
  { who: 'mohammed', shot: 'mohammed2', text: 'خدمات؟! من العصائب؟ اللي تاريخهم أسود بهالأرض، واللي چانوا يدگّون أبوابنا بنص الليل؟', hold: 0.5 },
  { who: 'saif', shot: 'saif', text: 'اللي راح راح... واللي يريد يبني المدينة، لازم يمد إيده لكل الأطراف.', hold: 0.5 },
  { who: 'khaled', shot: 'khaled2', text: 'يمد إيده؟ زين... بس مو للإيد اللي بعدها بيها دم ولد عمّي.', hold: 0.8 },
  { who: 'ibrahim', shot: 'ibrahim2', text: 'احنا تكارتة مثلكم، ودمّنا من دمّكم. لا تخوّنونا على ورقة انتخاب.' },
  { who: 'saif', shot: 'saif2', text: 'واللي يخوّن الناس بالمضايف... يتحمّل جوابه.', hold: 1.0 },
  { shot: 'door', act: 'door', hold: 2.4 },
  { who: 'sheikh', shot: 'door', text: 'السلام عليكم... شبيكم يا ولدي؟ أصواتكم واصلة للشارع!' },
  { who: 'khaled', shot: 'wideStand', act: 'stand', text: 'وعليكم السلام شيخنا، تفضّل... المجلس مجلسك.' },
  { who: 'sheikh', shot: 'sheikh', act: 'sheikhSeat', text: 'اگعدوا اگعدوا. آني لمّيتكم الليلة حتى نطوي صفحة الانتخابات... مو نفتح باب فتنة.' },
  { who: 'sheikh', shot: 'sheikh2', text: 'يا ولدي، الانتخابات تروح وتجي، وتكريت باقية. والعدو يفرح لمّن يشوفنا متفرّقين.', hold: 0.6 },
  { who: 'mohammed', shot: 'mohammed', text: 'شيخنا، احنا ما نريد دم... بس ما نقبل العصائب ترجع تحكمنا من باب الانتخابات.' },
  { who: 'sheikh', shot: 'sheikh', text: 'والزعل ما يرد حق يابا. الحق بالعدل، وبالصندوق الجاي، مو بالصياح.' },
  { who: 'ibrahim', shot: 'ibrahim', text: 'على راسي شيخنا. احنا جينا احتراماً إلك.' },
  { who: 'saif', shot: 'saif', text: 'بس ما نقبل أحد يسمّينا خونة بوجهنا.' },
  { who: 'mohammed', shot: 'mohammed2', loud: true, text: 'ولعد شنسمّي اللي يحالف قاتل أهله؟!' },
  { who: 'ibrahim', shot: 'ibrahim2', loud: true, text: 'انتبه لحچيك يا محمد! لا توصّلها للدم!' },
  { who: 'khaled', shot: 'khaled', loud: true, text: 'يا جماعة كافي! بوجه الشيخ؟!' },
  { who: 'sheikh', shot: 'sheikhClose', act: 'sheikhHand', loud: true, text: 'بسّ! والله ما يطلع واحد من هالمضيف... إلا وإيده بإيد أخوه.', hold: 0.6 },
  { shot: 'hands', act: 'handshake', hold: 3.0 },
  // الباب ينفتح بهدوء... غريب ملثّم من العصائب
  { shot: 'door2', act: 'stranger', hold: 2.4 },
  { shot: 'doorHand', act: 'pin', hold: 1.5 },
  { shot: 'grenade', act: 'grenade', hold: 2.0 },
  { who: 'sheikh', shot: 'sheikhClose', loud: true, text: 'رمّانة!!', hold: 0.1 },
  { who: 'khaled', shot: 'wideLow', loud: true, text: 'انبطحوا!!', hold: 0.2 },
  { shot: 'wideLow', act: 'boom', hold: 2.6 },
  { shot: 'black', hold: 1.6 },
  // الغبار... والاتهام
  { shot: 'after', act: 'aftermath', hold: 1.4 },
  { who: 'mohammed', shot: 'afterM', loud: true, text: 'الشيخ! الشيخ انصاب!' },
  { who: 'saif', shot: 'afterS', act: 'aim', loud: true, text: 'إنتو! إنتو رميتوها! جايبينا للعشا حتى تذبحونا!' },
  { who: 'khaled', shot: 'afterK', loud: true, text: 'شنو؟! احنا چنا گاعدين يمّكم! الرمّانة إجت من الباب!' },
  { who: 'ibrahim', shot: 'afterI', loud: true, text: 'كذّاب! محّد بهالمدينة يريد دمّنا غيركم!' },
  { who: 'khaled', shot: 'afterK2', text: 'إبراهيم، اسمعني... هذا مو شغلنا. هذا شغل اللي يريدنا نذبح بعض.' },
  { who: 'saif', shot: 'afterS2', act: 'cock', text: 'خلص... انتهى الحچي.', hold: 1.0 },
  { shot: 'black', act: 'shots', hold: 2.0 },
  { card: 'اللي رمى الرمّانة... واحد من العصائب، دخل من الباب حتى يشعل الفتنة بين أهل المدينة.', shot: 'black', hold: 4.6 },
  { card: 'بس جماعة التجمّع ما فهموا... واتّهموا إخوتهم.', shot: 'black', hold: 3.6 },
  { card: 'ومن ذيچ الليلة... اشتعلت الحرب بين أهل تكريت.', shot: 'black', hold: 3.8 },
  { title: true, shot: 'black', hold: 3.2 },
];
