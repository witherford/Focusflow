// Schema versioning + storage keys for Phase 2
export const SCHEMA_VERSION = 2;

export const KEY_LEGACY  = 'ff7';
export const KEY_BACKUP  = 'ff7.bak';
export const KEY_CORE    = 'ff:v2:core';

// IDB bucket keys (large / append-only data)
export const IDB_HABIT_LOG     = 'ff:v2:habitLog';
export const IDB_CHORE_LOG     = 'ff:v2:choreLog';
export const IDB_DW_SESSIONS   = 'ff:v2:dwSessions';
export const IDB_MED_SESSIONS  = 'ff:v2:medSessions';
export const IDB_FIT_SESSIONS  = 'ff:v2:fitSessions';
export const IDB_JOURNAL       = 'ff:v2:journal';

export function defaultState() {
  return {
    meta: { schemaVersion: SCHEMA_VERSION, createdAt: new Date().toISOString(), lastMigrationAt: null },
    profile: { name:'', weight:'', wake:'06:30', bed:'22:30', sleepNow:7, sleepTarget:8, trainRoutines:[], posHabits:[], negHabits:[], posCustom:'', negCustom:'', goals:'', diet:'balanced', allergies:'', meals:3 },
    habits: [], habitLog: {}, badHabitLog: {}, sleepHabitLog: {}, chores: [], choreLog: {}, choreDayOpen: {},
    projects: [], tasks: [], goals: [],
    deepwork: { target:4, sessions:[], presets:[
      {id:'p1',label:'Pomodoro',mins:25,icon:'🍅'},
      {id:'p2',label:'Deep dive',mins:50,icon:'🎯'},
      {id:'p3',label:'Power hour',mins:60,icon:'⚡'},
      {id:'p4',label:'Quick focus',mins:15,icon:'🔥'},
      {id:'p5',label:'Flow state',mins:90,icon:'🌊'},
    ]},
    meditation: { target:10, sessions:[], savedTimers:[], breathPresets:[] },
    fitness: { modalities: [], sessions: [], prs: [] },
    shopping: [], journal: [],
    customCats: { shop:[], proj:[], goal:[] },
    settings: { theme:'dark', aiEnabled:true, incrementalHabits:false, passcodeHash:null, passcodeSalt:null },
  };
}
