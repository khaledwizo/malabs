// تعريف الشخصيات الأربع (ملابس وألوان ووجوه)
export const CHARS = {
  khaled: {
    name: 'خالد', full: 'خالد التكريتي', tag: 'الأنيق الهادئ',
    desc: 'سترة كاروهات رمادية وقميص أسود. هادئ تحت الضغط ودقيق في التصويب.',
    skin: '#d69670', hair: '#2a1b12', hairStyle: 'quiff', face: 'photo',
    jacket: { base: [104, 102, 98], plaid: { n: 6, c1: 'rgba(40,36,34,0.9)', c2: 'rgba(200,190,170,0.9)' } }, jacketOpen: true,
    shirt: '#151516', pants: '#2b2d33', shoes: '#1b1816', beard: null, brow: '#140d08',
    coat: 0.66, leather: '#3a2a1e', bracers: true,
  },
  ibrahim: {
    name: 'إبراهيم', full: 'إبراهيم', tag: 'المحارب المخضرم',
    desc: 'شماغ أحمر وعقال، سترة ميدانية وجعبة. خبرة السنين في كل خطوة.',
    skin: '#b98060', hair: '#1a1410', hairStyle: 'shemagh', faceOpt: { beard: '#2d2621', beardA: 0.92, mustache: '#231d18', brow: '#1d1612', eye: '#2c1c12', lip: '#8d5446' },
    jacket: { base: [168, 146, 108] }, vest: '#4f553a', shirt: '#6b6450', pants: '#7d6f55', shoes: '#3b2e22',
    coat: 0.5, cape: '#5a4a34', leather: '#4a3524', gloves: '#2a2520', bracers: true,
  },
  mohammed: {
    name: 'محمد', full: 'محمد', tag: 'الشاب السريع',
    desc: 'سترة زيتية وجينز وحذاء رياضي. سريع الحركة ويحب المواجهة القريبة.',
    skin: '#c48a64', hair: '#120c09', hairStyle: 'curly', faceOpt: { stubble: 'rgba(30,20,14,0.35)', mustache: '#1d140e', brow: '#120c08', eye: '#33200f', lip: '#9c5a4a' },
    jacket: { base: [84, 92, 58] }, shirt: '#e8e6e0', pants: '#33476a', shoes: '#ecebe6', jacketOpen: true,
    coat: 0.34, hood: true, leather: '#5a3d26',
  },
  saif: {
    name: 'سيف', full: 'سيف', tag: 'الرجل الغامض',
    desc: 'بدلة سوداء وربطة عنق عنابية ونظارة شمسية. لا يتكلم كثيراً.',
    skin: '#c99272', hair: '#0f0b09', hairStyle: 'buzz', faceOpt: { stubble: 'rgba(25,18,14,0.45)', brow: '#110b08', eye: '#2a1a0e', lip: '#94574a' },
    jacket: { base: [30, 31, 35], stripe: 'rgba(90,90,100,0.35)' }, shirt: '#ecebe8', tie: '#6e1a26', pants: '#25262b', shoes: '#0d0c0c', glasses: true,
    coat: 0.78, leather: '#1c1a1a', gloves: '#141414',
  },
};
export const CHAR_ORDER = ['khaled', 'ibrahim', 'mohammed', 'saif'];
