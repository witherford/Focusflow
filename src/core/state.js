// Core state + utilities — extracted from focusflow_v10.html lines 1324-1353
export let S = {
  profile: { name:'', weight:'', wake:'06:30', bed:'22:30', sleepNow:7, sleepTarget:8, trainRoutines:[], posHabits:[], negHabits:[], posCustom:'', negCustom:'', goals:'', diet:'balanced', allergies:'', meals:3 },
  habits:[], habitLog:{}, chores:[], choreLog:{}, choreDayOpen:{},
  projects:[], tasks:[], goals:[],
  deepwork: { target:4, sessions:[], presets:[
    {id:'p1',label:'Pomodoro',mins:25,icon:'🍅'},
    {id:'p2',label:'Deep dive',mins:50,icon:'🎯'},
    {id:'p3',label:'Power hour',mins:60,icon:'⚡'},
    {id:'p4',label:'Quick focus',mins:15,icon:'🔥'},
    {id:'p5',label:'Flow state',mins:90,icon:'🌊'},
  ]},
  meditation: { target:10, sessions:[], savedTimers:[], breathPresets:[] },
  shopping:[], journal:[],
  customCats: { shop:[], proj:[], goal:[] },
  settings: { theme:'dark', aiEnabled:true },
};

export const today = () => new Date().toISOString().split('T')[0];
export const year = () => new Date().getFullYear();
export const uid = () => Math.random().toString(36).slice(2, 9);
export const f2 = n => String(Math.floor(n)).padStart(2, '0');
export const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
export const weekKey = () => {
  const d = new Date(), dy = d.getDay(), diff = d.getDate() - dy + (dy === 0 ? -6 : 1);
  return new Date(new Date(d).setDate(diff)).toISOString().split('T')[0];
};

export function haptic(style = 'light') {
  if (window.navigator?.vibrate) {
    style === 'light' ? navigator.vibrate(8) : style === 'medium' ? navigator.vibrate(15) : navigator.vibrate([10, 5, 10]);
  }
}

// Expose everything to window for inline onclick handlers
window.S = S;
window.today = today;
window.year = year;
window.uid = uid;
window.f2 = f2;
window.clamp = clamp;
window.weekKey = weekKey;
window.haptic = haptic;
