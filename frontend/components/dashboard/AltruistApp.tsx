"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import {
  LineChart, Line, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid,
} from "recharts";
import type { User } from "@supabase/supabase-js";
import { habitsApi, logsApi, plansApi, settingsApi } from "@/lib/api";
import type { Habit, DailyLog, Plan, Settings } from "@/lib/api";

// ── Extra local types ──────────────────────────────────────────
interface PlanForm { text: string; recurrence: string; startDate: string; endDate: string; weekdays: number[]; }
interface Quote    { text: string; author: string; source: string; }
interface Props    { user: User; onSignOut: () => void; }

// ── Quotes ─────────────────────────────────────────────────────
// TODO (Phase 3): Replace with Anthropic API — fetch daily quote from web
const QUOTES: Quote[] = [
  { text: "If you don't take risks, you can't create a future.", author: "Monkey D. Luffy", source: "One Piece" },
  { text: "Believe in yourself. Not in the you who believes in me — but in the you who believes in yourself.", author: "Kamina", source: "Gurren Lagann" },
  { text: "A lesson without pain is meaningless.", author: "Edward Elric", source: "Fullmetal Alchemist" },
  { text: "Fear is not evil. It tells you what your weakness is.", author: "Gildarts Clive", source: "Fairy Tail" },
  { text: "Push through the pain. Giving up hurts more.", author: "Vegeta", source: "Dragon Ball Z" },
  { text: "Hard work is worthless for those that don't believe in themselves.", author: "Naruto Uzumaki", source: "Naruto" },
  { text: "Be fearful when others are greedy, and greedy when others are fearful.", author: "Warren Buffett", source: "Berkshire Hathaway" },
  { text: "An investment in knowledge pays the best interest.", author: "Benjamin Franklin", source: "Poor Richard's Almanack" },
  { text: "Time in the market beats timing the market.", author: "Kenneth Fisher", source: "Fisher Investments" },
  { text: "You don't rise to the level of your goals. You fall to the level of your systems.", author: "James Clear", source: "Atomic Habits" },
  { text: "We are what we repeatedly do. Excellence, then, is not an act, but a habit.", author: "Aristotle", source: "Nicomachean Ethics" },
  { text: "The secret of getting ahead is getting started.", author: "Mark Twain", source: "attributed" },
  { text: "If you can't do something, then don't. Focus on what you can.", author: "Itachi Uchiha", source: "Naruto Shippuden" },
  { text: "A person grows up when he's able to overcome hardship.", author: "Pain", source: "Naruto Shippuden" },
  { text: "Compound interest is the eighth wonder of the world.", author: "Albert Einstein", source: "attributed" },
];

const getDailyQuote = (offset = 0): Quote => {
  const start = new Date(new Date().getFullYear(), 0, 0);
  const day   = Math.floor((Date.now() - start.getTime()) / 86400000);
  return QUOTES[(day + offset) % QUOTES.length];
};

// ── Utils ──────────────────────────────────────────────────────
const toLocalDateStr = (date: Date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};
const todayStr = () => toLocalDateStr(new Date());
const addDays  = (d: string, n: number) => { const x = new Date(d + "T00:00:00"); x.setDate(x.getDate() + n); return toLocalDateStr(x); };
const fmtDate  = (d: string)     => new Date(d + "T00:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
const safeAvg  = (arr: number[]) => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null;
const getDOW   = (d: string)     => new Date(d + "T00:00:00").getDay();
const WD_SHORT = ["Su","Mo","Tu","We","Th","Fr","Sa"];

// ── Plan helpers ───────────────────────────────────────────────
function planAppliesToDate(p: Plan, date: string): boolean {
  if (!p || p.deleted) return false;
  if (p.recurrence === "daterange") {
    if (p.completed_on_date) return date === p.completed_on_date;
    return date >= p.start_date && date <= (p.end_date ?? "");
  }
  if (date < p.start_date) return false;
  if (p.end_date && date > p.end_date) return false;
  if (p.recurrence === "once")   return date === p.start_date;
  if (p.recurrence === "daily")  return true;
  if (p.recurrence === "weekly") return (p.weekdays || []).includes(getDOW(date));
  return false;
}
function isDoneOnDate(p: Plan, date: string): boolean {
  if (p.recurrence === "daterange") return p.completed_on_date === date;
  return (p.done_dates || []).includes(date);
}
function recLabel(p: Plan): string | null {
  if (p.recurrence === "once") return null;
  if (p.recurrence === "daterange") return `Any day ${fmtDate(p.start_date)} → ${fmtDate(p.end_date!)} · completes once`;
  if (p.recurrence === "daily") return `Daily from ${fmtDate(p.start_date)}${p.end_date ? " → " + fmtDate(p.end_date) : " · ongoing"}`;
  if (p.recurrence === "weekly") {
    const days = (p.weekdays || []).sort().map((d: number) => WD_SHORT[d]).join(", ");
    return `${days} from ${fmtDate(p.start_date)}${p.end_date ? " → " + fmtDate(p.end_date) : " · ongoing"}`;
  }
  return null;
}

// ── Design tokens ──────────────────────────────────────────────
const C = {
  bg:"#080809", s0:"#0c0c0f", s1:"#101014", s2:"#161619",
  border:"#1c1c22", borderHi:"#28282f",
  text:"#e2ddd6", t2:"#6a6978", t3:"#35343d",
  gold:"#b87c2e", goldDim:"rgba(184,124,46,0.12)",
  green:"#2d8056", red:"#8a3530", purple:"#5a44a0", blue:"#2d5fa0",
};

const MOODS       = ["Awful","Bad","Okay","Good","Great"];
const MOOD_COLORS = ["#8a3530","#a06030","#7a7060","#2d6048","#2d8056"];

const DEFAULT_SETTINGS: Settings = { calorie_goal:2050, steps_goal:8000, screen_time_limit:3 };
const EMPTY_FORM = (): PlanForm  => ({ text:"", recurrence:"once", startDate:todayStr(), endDate:"", weekdays:[] });

// ── Local log state (one day at a time) ────────────────────────
interface LocalLog {
  habits:       Record<string, boolean>;
  habitReasons: Record<string, string>;
  mood:         number | null;
  energy:       number | null;
  productivity: number | null;
  calories:     string;
  steps:        string;
  workoutMins:  string;
  screenHours:  string;
  gratitude:    string[];
  notes:        string;
}
const EMPTY_LOCAL = (): LocalLog => ({
  habits:{}, habitReasons:{}, mood:null, energy:null, productivity:null,
  calories:"", steps:"", workoutMins:"", screenHours:"", gratitude:["","",""], notes:"",
});

// ── Small components ───────────────────────────────────────────
const Divider = ({ label }: { label: string }) => (
  <div style={{display:"flex",alignItems:"center",gap:14,margin:"28px 0 14px"}}>
    <div style={{width:3,height:13,background:C.gold,borderRadius:2,flexShrink:0}}/>
    <span style={{fontSize:10,fontWeight:700,color:C.t2,textTransform:"uppercase",letterSpacing:"2px"}}>{label}</span>
    <div style={{flex:1,height:1,background:C.border}}/>
  </div>
);

const Checkbox = ({ checked, onChange, color=C.gold, size=18 }: { checked:boolean; onChange:()=>void; color?:string; size?:number }) => (
  <button onClick={e=>{e.stopPropagation();onChange();}} style={{width:size,height:size,borderRadius:4,flexShrink:0,border:checked?"none":`1.5px solid ${C.borderHi}`,background:checked?color:"transparent",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",transition:"all .15s"}}>
    {checked&&<svg width="10" height="8" viewBox="0 0 10 8" fill="none"><path d="M1 4L3.5 6.5L9 1" stroke={C.bg} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>}
  </button>
);

const Pills = ({ value, onChange, count=10, color }: { value:number|null; onChange:(n:number|null)=>void; count?:number; color:string }) => (
  <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>
    {Array.from({length:count},(_,i)=>i+1).map(n=>{
      const sel=value===n;
      return <button key={n} onClick={()=>onChange(sel?null:n)} style={{width:34,height:32,borderRadius:6,border:sel?`1.5px solid ${color}`:`1px solid ${C.border}`,background:sel?color+"18":C.s2,color:sel?color:C.t2,fontFamily:"DM Mono,monospace",fontSize:12,fontWeight:sel?600:400,cursor:"pointer",transition:"all .12s"}}>{n}</button>;
    })}
  </div>
);

const GoalBar = ({ value, goal, color }: { value:string; goal:number; color:string }) => {
  const p = Math.min(100, goal ? Math.round(Number(value)/goal*100) : 0);
  return <div style={{marginTop:7}}><div style={{background:C.s2,borderRadius:2,height:3}}><div style={{width:`${p}%`,height:"100%",background:color,borderRadius:2,transition:"width .4s"}}/></div><div style={{fontSize:11,color:C.t3,marginTop:4}}>{p}% of {Number(goal).toLocaleString()}</div></div>;
};

const MetricCard = ({ label, value, unit, color=C.gold }: { label:string; value:number|string|null; unit?:string; color?:string }) => (
  <div style={{background:C.s1,border:`1px solid ${C.border}`,borderRadius:8,padding:"14px 16px",flex:"1 1 120px"}}>
    <div style={{fontSize:10,color:C.t2,textTransform:"uppercase",letterSpacing:"1.5px",marginBottom:8}}>{label}</div>
    <div style={{fontFamily:"DM Mono,monospace",fontSize:22,fontWeight:500,color,lineHeight:1}}>{value??'—'}</div>
    {unit&&<div style={{fontSize:11,color:C.t3,marginTop:5}}>{unit}</div>}
  </div>
);

const ChartTip = ({ active, payload, label }: any) => {
  if (!active||!payload?.length) return null;
  return <div style={{background:C.s2,border:`1px solid ${C.borderHi}`,borderRadius:6,padding:"10px 14px",fontSize:12,fontFamily:"DM Mono,monospace",color:C.text}}><div style={{color:C.t2,marginBottom:6}}>{label}</div>{payload.map((p:any,i:number)=>p.value!=null&&<div key={i} style={{color:p.stroke,marginBottom:2}}>{p.name}: {p.value}</div>)}</div>;
};

const RecBadge = ({ r }: { r:string }) => {
  if (r==="once") return null;
  const color = r==="daily" ? C.blue : r==="daterange" ? "#2d7a6a" : C.purple;
  return <span style={{fontSize:10,color,border:`1px solid ${color}40`,borderRadius:3,padding:"2px 7px",whiteSpace:"nowrap"}}>{r==="daterange"?"date range":r}</span>;
};

const NI = (val:string, cb:(v:string)=>void, unit:string) => (
  <div style={{display:"flex",alignItems:"center",background:C.s2,border:`1px solid ${C.border}`,borderRadius:6,overflow:"hidden"}}>
    <input type="number" value={val} onChange={e=>cb(e.target.value)} placeholder="0" style={{flex:1,background:"transparent",border:"none",color:C.text,fontFamily:"DM Mono,monospace",fontSize:15,padding:"9px 12px",outline:"none",minWidth:0}}/>
    <span style={{fontSize:11,color:C.t2,paddingRight:10,whiteSpace:"nowrap"}}>{unit}</span>
  </div>
);

// ══════════════════════════════════════════════════════════════
export default function AltruistApp({ user, onSignOut }: Props) {

  // ── Server state ─────────────────────────────────────────────
  const [habits,    setHabits]   = useState<Habit[]>([]);
  const [settings,  setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [plans,     setPlans]    = useState<Plan[]>([]);
  const [allLogs,   setAllLogs]  = useState<DailyLog[]>([]);   // for stats only
  const [loaded,    setLoaded]   = useState(false);
  const [apiError,  setApiError] = useState("");

  // ── Local day state ───────────────────────────────────────────
  const [date,      setDate]     = useState(todayStr());
  const [dayLocal,  setDayLocal] = useState<LocalLog>(EMPTY_LOCAL());
  const [dayLoaded, setDayLoaded]= useState(false);

  // ── UI state ──────────────────────────────────────────────────
  const [tab,       setTab]      = useState("daily");
  const [saved,     setSaved]    = useState(false);
  const [saving,    setSaving]   = useState(false);
  const [rOpen,     setROpen]    = useState<Record<string,boolean>>({});
  const [newHabit,  setNewHabit] = useState("");
  const [planForm,  setPlanForm] = useState<PlanForm>(EMPTY_FORM());
  const [planView,  setPlanView] = useState("active");
  const [qOffset,   setQOffset]  = useState(0);

  // ── Load habits, settings, plans on mount ─────────────────────
  useEffect(() => {
    (async () => {
      try {
        const [h, s, p, logs] = await Promise.all([
          habitsApi.list(),
          settingsApi.get(),
          plansApi.list(),
          logsApi.list(),
        ]);
        setHabits(h);
        setSettings(s);
        setPlans(p);
        setAllLogs(logs);
      } catch (e: any) {
        setApiError(e.message || "Failed to load data");
      } finally {
        setLoaded(true);
      }
    })();
  }, []);

  // ── Load day log + habit checks when date changes ─────────────
  useEffect(() => {
    if (!loaded) return;
    setDayLoaded(false);
    setDayLocal(EMPTY_LOCAL());
    (async () => {
      try {
        // Load daily log
        let log: DailyLog | null = null;
        try { log = await logsApi.get(date); } catch { /* 404 = no log yet */ }

        // Load habit checks for the day
        let checks: { habit_id:string; done:boolean; reason?:string }[] = [];
        try { checks = await logsApi.getHabitChecks(date); } catch {}

        const habitMap: Record<string,boolean>  = {};
        const reasonMap: Record<string,string>  = {};
        checks.forEach(c => {
          habitMap[c.habit_id]  = c.done;
          if (c.reason) reasonMap[c.habit_id] = c.reason;
        });

        setDayLocal({
          habits:       habitMap,
          habitReasons: reasonMap,
          mood:         log?.mood         ?? null,
          energy:       log?.energy       ?? null,
          productivity: log?.productivity ?? null,
          calories:     log?.calories     ? String(log.calories)     : "",
          steps:        log?.steps        ? String(log.steps)        : "",
          workoutMins:  log?.workout_mins ? String(log.workout_mins) : "",
          screenHours:  log?.screen_hours ? String(log.screen_hours) : "",
          gratitude:    log?.gratitude    ?? ["","",""],
          notes:        log?.notes        ?? "",
        });
      } catch (e: any) {
        setApiError(e.message);
      } finally {
        setDayLoaded(true);
      }
    })();
  }, [date, loaded]);

  // ── Patch local day state ─────────────────────────────────────
  const patch = useCallback((p: Partial<LocalLog>) =>
    setDayLocal(prev => ({ ...prev, ...p }))
  , []);

  // ── Toggle habit ──────────────────────────────────────────────
  const toggleHabit = async (id: string) => {
    const nowDone = !dayLocal.habits[id];
    patch({ habits: { ...dayLocal.habits, [id]: nowDone } });
    if (nowDone) setROpen(r => ({ ...r, [id]: false }));
    // Save habit check immediately
    try {
      await logsApi.upsertHabitCheck(date, { habit_id: id, date, done: nowDone, reason: dayLocal.habitReasons[id] });
    } catch (e: any) { setApiError(e.message); }
  };

  const setReason = async (id: string, text: string) => {
    patch({ habitReasons: { ...dayLocal.habitReasons, [id]: text } });
  };

  // ── Save full day log ─────────────────────────────────────────
  const saveDay = async () => {
    setSaving(true);
    try {
      // Upsert the daily log
      await logsApi.upsert(date, {
        date,
        mood:         dayLocal.mood         ?? undefined,
        energy:       dayLocal.energy       ?? undefined,
        productivity: dayLocal.productivity ?? undefined,
        calories:     dayLocal.calories ? Number(dayLocal.calories) : undefined,
        steps:        dayLocal.steps    ? Number(dayLocal.steps)    : undefined,
        workout_mins: dayLocal.workoutMins ? Number(dayLocal.workoutMins) : undefined,
        screen_hours: dayLocal.screenHours ? Number(dayLocal.screenHours) : undefined,
        gratitude:    dayLocal.gratitude,
        notes:        dayLocal.notes || undefined,
      });

      // Save habit reasons
      await Promise.all(
        Object.entries(dayLocal.habitReasons).map(([id, reason]) =>
          logsApi.upsertHabitCheck(date, { habit_id: id, date, done: dayLocal.habits[id] ?? false, reason })
        )
      );

      // Refresh all logs for stats
      const logs = await logsApi.list();
      setAllLogs(logs);

      setSaved(true);
      setTimeout(() => setSaved(false), 1800);
    } catch (e: any) {
      setApiError(e.message);
    } finally {
      setSaving(false);
    }
  };

  // ── Habit CRUD ────────────────────────────────────────────────
  const addHabit = async () => {
    if (!newHabit.trim()) return;
    try {
      const h = await habitsApi.create(newHabit.trim(), "◎", habits.length);
      setHabits(prev => [...prev, h]);
      setNewHabit("");
    } catch (e: any) { setApiError(e.message); }
  };

  const removeHabit = async (id: string) => {
    try {
      await habitsApi.delete(id);
      setHabits(prev => prev.filter(h => h.id !== id));
    } catch (e: any) { setApiError(e.message); }
  };

  // ── Plan CRUD ─────────────────────────────────────────────────
  const addPlan = async () => {
    if (!planForm.text.trim()) return;
    if (planForm.recurrence === "weekly" && !planForm.weekdays.length) return;
    if (planForm.recurrence === "daterange" && !planForm.endDate) return;
    try {
      const p = await plansApi.create({
        text:       planForm.text.trim(),
        recurrence: planForm.recurrence as Plan["recurrence"],
        start_date: planForm.startDate,
        end_date:   planForm.endDate || undefined,
        weekdays:   planForm.weekdays,
      });
      setPlans(prev => [...prev, p]);
      setPlanForm(EMPTY_FORM());
    } catch (e: any) { setApiError(e.message); }
  };

  const togglePlanDate = async (id: string, d: string) => {
    const plan = plans.find(p => p.id === id);
    if (!plan) return;

    let update: Partial<Pick<Plan,"done_dates"|"completed_on_date"|"deleted">>;
    if (plan.recurrence === "daterange") {
      update = { completed_on_date: plan.completed_on_date ? undefined : d };
    } else {
      const dd = plan.done_dates || [];
      update = { done_dates: dd.includes(d) ? dd.filter(x => x !== d) : [...dd, d] };
    }

    try {
      const updated = await plansApi.update(id, update);
      setPlans(prev => prev.map(p => p.id === id ? updated : p));
    } catch (e: any) { setApiError(e.message); }
  };

  const deletePlan = async (id: string) => {
    try {
      await plansApi.delete(id);
      setPlans(prev => prev.map(p => p.id === id ? { ...p, deleted: true } : p));
    } catch (e: any) { setApiError(e.message); }
  };

  const toggleWD = (dow: number) => {
    const w = planForm.weekdays.includes(dow) ? planForm.weekdays.filter(d => d !== dow) : [...planForm.weekdays, dow];
    setPlanForm(f => ({ ...f, weekdays: w }));
  };

  // ── Settings save ─────────────────────────────────────────────
  const saveSettings = async (s: Settings) => {
    setSettings(s);
    try { await settingsApi.upsert(s); } catch (e: any) { setApiError(e.message); }
  };

  // ── Derived state ─────────────────────────────────────────────
  const dayPlans    = plans.filter(p => planAppliesToDate(p, date));
  const pendingDay  = dayPlans.filter(p => !isDoneOnDate(p, date));
  const doneDay     = dayPlans.filter(p =>  isDoneOnDate(p, date));
  const upcomingNow = plans.filter(p => planAppliesToDate(p, todayStr()) && !isDoneOnDate(p, todayStr())).length;
  const isFuture    = date > todayStr();
  const checked     = Object.values(dayLocal.habits).filter(Boolean).length;

  // ── Stats helpers (from allLogs) ──────────────────────────────
  const logMap = allLogs.reduce((acc, l) => { acc[l.date as string] = l; return acc; }, {} as Record<string, DailyLog>);
  const allDates = Object.keys(logMap).sort();
  const last30   = Array.from({length:30}, (_,i) => addDays(todayStr(), i-29)).filter(d => logMap[d]);
  const last7    = Array.from({length:7},  (_,i) => addDays(todayStr(), i-6));

  const streak = (id: string) => {
    let s=0, d=todayStr();
    // Use habit checks from allLogs — simplified: check done_dates from logs API
    // For now use local state for current session
    return s;
  };
  const pct = (id: string) => allDates.length
    ? Math.round(allDates.filter(d => {
        // This will be populated once we have habit checks per day
        return false;
      }).length / allDates.length * 100) : 0;

  const wellData = last30.map(d => ({
    date: (d as string).slice(5),
    Mood:         logMap[d]?.mood         ?? null,
    Energy:       logMap[d]?.energy       ?? null,
    Productivity: logMap[d]?.productivity ?? null,
  })).filter(r => r.Mood || r.Energy || r.Productivity);

  const bAvg = {
    cal:    safeAvg(last30.map(d => Number(logMap[d]?.calories)).filter(Boolean)),
    steps:  safeAvg(last30.map(d => Number(logMap[d]?.steps)).filter(Boolean)),
    work:   safeAvg(last30.map(d => Number(logMap[d]?.workout_mins)).filter(Boolean)),
    screen: safeAvg(last30.map(d => Number(logMap[d]?.screen_hours)).filter(Boolean)),
  };

  const recurringP = plans.filter(p => !p.deleted && (p.recurrence==="daily"||p.recurrence==="weekly"));
  const daterangeP = plans.filter(p => !p.deleted && p.recurrence==="daterange");
  const onetimeP   = plans.filter(p => !p.deleted && p.recurrence==="once");
  const grouped    = onetimeP.reduce((acc: Record<string,Plan[]>, p) => { (acc[p.start_date]=acc[p.start_date]||[]).push(p); return acc; }, {});
  const groupDates = Object.keys(grouped).sort();
  const quote      = getDailyQuote(qOffset);

  // ── Loading ───────────────────────────────────────────────────
  if (!loaded) return (
    <div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",background:C.bg,fontFamily:"DM Sans,sans-serif",color:C.t2,fontSize:13,letterSpacing:"2px",textTransform:"uppercase"}}>
      Loading
    </div>
  );

  return (
    <div style={{minHeight:"100vh",background:C.bg,color:C.text,fontFamily:"DM Sans,sans-serif",paddingBottom:80}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Sans:wght@300;400;500&family=DM+Mono:wght@400;500&family=Lora:ital@0;1&display=swap');
        *{box-sizing:border-box;margin:0;padding:0;}
        ::-webkit-scrollbar{width:4px;} ::-webkit-scrollbar-thumb{background:${C.border};border-radius:2px;}
        textarea{resize:vertical;font-family:DM Sans,sans-serif;}
        input[type=time]::-webkit-calendar-picker-indicator,input[type=date]::-webkit-calendar-picker-indicator{filter:invert(40%);}
        input::placeholder,textarea::placeholder{color:${C.t3};}
        .nt{padding:12px 18px;border:none;background:transparent;color:${C.t2};font-family:DM Sans,sans-serif;font-size:13px;font-weight:500;cursor:pointer;border-bottom:1.5px solid transparent;transition:all .18s;letter-spacing:.5px;white-space:nowrap;}
        .nt:hover{color:${C.text};} .nt.on{color:${C.gold};border-bottom-color:${C.gold};}
        .hi{display:flex;flex-direction:column;border:1px solid ${C.border};border-radius:8px;overflow:hidden;transition:border-color .15s;}
        .hi:hover{border-color:${C.borderHi};} .hi.ck{border-color:rgba(184,124,46,0.22);background:rgba(184,124,46,0.025);}
        .hm{display:flex;align-items:center;gap:14px;padding:13px 16px;cursor:pointer;user-select:none;}
        .rf{border-top:1px solid ${C.border};padding:8px 16px;background:${C.bg};display:flex;align-items:center;gap:10px;}
        .sb{width:100%;background:${C.gold};border:none;color:${C.bg};font-family:DM Sans,sans-serif;font-size:14px;font-weight:600;padding:14px;border-radius:8px;cursor:pointer;letter-spacing:.5px;transition:all .18s;margin-top:12px;}
        .sb:hover{opacity:.9;transform:translateY(-1px);} .sb.ok{background:${C.green};color:#fff;}
        .fi{background:${C.s2};border:1px solid ${C.border};border-radius:6px;color:${C.text};font-family:DM Sans,sans-serif;font-size:14px;padding:9px 12px;outline:none;transition:border-color .15s;width:100%;}
        .fi:focus{border-color:${C.gold};} .fm{font-family:DM Mono,monospace!important;}
        .rb{padding:7px 16px;border-radius:6px;border:1px solid ${C.border};background:transparent;color:${C.t2};font-family:DM Sans,sans-serif;font-size:13px;cursor:pointer;transition:all .15s;}
        .rb.on{border-color:${C.gold};color:${C.gold};background:${C.goldDim};}
        .wb{width:34px;height:34px;border-radius:6px;border:1px solid ${C.border};background:transparent;color:${C.t2};font-family:DM Mono,monospace;font-size:12px;cursor:pointer;transition:all .15s;}
        .wb.on{border-color:${C.purple};color:${C.purple};background:rgba(90,68,160,.15);}
        .pr{display:flex;align-items:center;gap:12px;padding:11px 14px;border:1px solid ${C.border};border-radius:7px;background:${C.s1};transition:border-color .15s;}
        .pr:hover{border-color:${C.borderHi};}
        .sr{display:flex;align-items:center;gap:14px;padding:14px 0;border-bottom:1px solid ${C.border};}
        .sr:last-child{border-bottom:none;}
        .two{display:flex;gap:14px;} @media(max-width:500px){.two{flex-direction:column;}}
        .fbt{padding:5px 14px;border-radius:4px;border:1px solid ${C.border};background:transparent;color:${C.t2};font-family:DM Sans,sans-serif;font-size:12px;cursor:pointer;transition:all .15s;}
        .fbt.on{border-color:${C.gold};color:${C.gold};background:${C.goldDim};}
        @keyframes fadeIn{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:none}}
        .fade{animation:fadeIn .35s ease;}
      `}</style>

      {/* ── HEADER ───────────────────────────────────────────────── */}
      <div style={{background:C.s0,borderBottom:`1px solid ${C.border}`,padding:"0 20px",position:"sticky",top:0,zIndex:10}}>
        <div style={{maxWidth:740,margin:"0 auto"}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"16px 0 0"}}>
            <div style={{fontFamily:"Syne,sans-serif",fontSize:18,fontWeight:800,color:C.text,letterSpacing:"2px",textTransform:"uppercase"}}>ALTRU<span style={{color:C.gold}}>IST</span></div>
            <div style={{display:"flex",alignItems:"center",gap:10}}>
              {upcomingNow>0&&<button onClick={()=>setTab("planner")} style={{background:C.goldDim,border:`1px solid rgba(184,124,46,.3)`,borderRadius:4,padding:"3px 10px",fontSize:11,color:C.gold,cursor:"pointer"}}>{upcomingNow} due today</button>}
              <span style={{fontSize:11,color:C.t3,fontFamily:"DM Mono,monospace"}}>{allDates.length}d</span>
              <span style={{fontSize:11,color:C.t3,display:"none"}} className="hide-mobile">{user.email}</span>
              <button onClick={onSignOut} style={{background:"transparent",border:`1px solid ${C.border}`,borderRadius:5,color:C.t2,padding:"4px 10px",cursor:"pointer",fontSize:11,fontFamily:"DM Sans,sans-serif"}}>Sign out</button>
            </div>
          </div>

          {/* API error banner */}
          {apiError&&<div style={{background:"rgba(138,53,48,.15)",border:"1px solid rgba(138,53,48,.3)",borderRadius:6,padding:"8px 12px",margin:"8px 0",fontSize:12,color:"#c97070",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <span>API error: {apiError}</span>
            <button onClick={()=>setApiError("")} style={{background:"none",border:"none",color:"#c97070",cursor:"pointer",fontSize:16}}>×</button>
          </div>}

          <div style={{display:"flex",overflowX:"auto"}}>
            {[["daily","Daily Log"],["planner","Planner"],["stats","Stats"],["manage","Settings"]].map(([id,lbl])=>(
              <button key={id} className={`nt ${tab===id?"on":""}`} onClick={()=>setTab(id)}>{lbl}</button>
            ))}
          </div>
        </div>
      </div>

      <div style={{maxWidth:740,margin:"0 auto",padding:"20px 20px"}}>

        {/* ══ DAILY ═══════════════════════════════════════════════ */}
        {tab==="daily"&&<>
          {/* Date nav */}
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:4}}>
            <button onClick={()=>setDate(addDays(date,-1))} style={{background:C.s1,border:`1px solid ${C.border}`,color:C.t2,width:32,height:32,borderRadius:6,cursor:"pointer",fontSize:16,display:"flex",alignItems:"center",justifyContent:"center"}}>‹</button>
            <div style={{textAlign:"center"}}>
              <div style={{fontFamily:"Syne,sans-serif",fontSize:16,fontWeight:700,color:C.text,display:"flex",alignItems:"center",gap:8,justifyContent:"center"}}>
                {fmtDate(date)}
                {date===todayStr()&&<span style={{background:C.gold,color:C.bg,fontSize:9,fontWeight:700,padding:"2px 7px",borderRadius:3,letterSpacing:1,textTransform:"uppercase"}}>Today</span>}
              </div>
              <div style={{fontSize:11,color:C.t3,fontFamily:"DM Mono,monospace",marginTop:2}}>{date}</div>
            </div>
            <button onClick={()=>setDate(addDays(date,1))} style={{background:C.s1,border:`1px solid ${C.border}`,color:C.t2,width:32,height:32,borderRadius:6,cursor:"pointer",fontSize:16,display:"flex",alignItems:"center",justifyContent:"center"}}>›</button>
          </div>

          {/* Quote */}
          <div className="fade" style={{marginTop:14,background:C.s1,border:`1px solid ${C.border}`,borderLeft:`3px solid ${C.gold}`,borderRadius:8,padding:"16px 18px 14px"}}>
            <div style={{fontSize:10,color:C.gold,textTransform:"uppercase",letterSpacing:"1.5px",fontWeight:700,marginBottom:10}}>Quote of the day</div>
            <div style={{fontFamily:"Lora,serif",fontStyle:"italic",fontSize:15,color:C.text,lineHeight:1.75,marginBottom:10}}>"{quote.text}"</div>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
              <div><span style={{fontSize:12,color:C.t2,fontWeight:500}}>{quote.author}</span><span style={{fontSize:11,color:C.t3}}> · {quote.source}</span></div>
              <button onClick={()=>setQOffset(o=>(o+1)%QUOTES.length)} style={{background:"transparent",border:`1px solid ${C.border}`,borderRadius:5,color:C.t3,padding:"3px 10px",cursor:"pointer",fontSize:12}}>next ↻</button>
            </div>
          </div>

          {/* Plans for this day */}
          {dayPlans.length>0&&<div style={{marginTop:14,background:C.s1,border:`1px solid ${C.border}`,borderLeft:`3px solid ${C.blue}`,borderRadius:8,overflow:"hidden"}}>
            <div style={{padding:"10px 16px 8px",fontSize:10,color:C.blue,textTransform:"uppercase",letterSpacing:"1.5px",fontWeight:700,borderBottom:`1px solid ${C.border}`}}>
              Plans for {date===todayStr()?"today":fmtDate(date)} · {pendingDay.length} pending
            </div>
            {pendingDay.map(p=><div key={p.id} style={{display:"flex",alignItems:"flex-start",gap:12,padding:"10px 16px",borderBottom:`1px solid ${C.border}`}}>
              <Checkbox checked={false} onChange={()=>togglePlanDate(p.id,date)} size={16}/>
              <div style={{flex:1}}><div style={{fontSize:13,color:C.text}}>{p.text}</div>{p.recurrence!=="once"&&<div style={{fontSize:11,color:C.t3,marginTop:2}}>{recLabel(p)}</div>}</div>
              <RecBadge r={p.recurrence}/>
            </div>)}
            {doneDay.length>0&&<>
              <div style={{padding:"6px 16px 3px",fontSize:10,color:C.t3,textTransform:"uppercase",letterSpacing:"1px"}}>Completed</div>
              {doneDay.map(p=><div key={p.id} style={{display:"flex",alignItems:"center",gap:12,padding:"8px 16px",borderBottom:`1px solid ${C.border}`,opacity:.4}}>
                <Checkbox checked={true} onChange={()=>togglePlanDate(p.id,date)} size={16} color={C.green}/>
                <span style={{fontSize:13,color:C.t2,textDecoration:"line-through",flex:1}}>{p.text}</span>
                <RecBadge r={p.recurrence}/>
              </div>)}
            </>}
          </div>}

          {/* Future gate */}
          {isFuture ? (
            <div style={{marginTop:20,background:C.s1,border:`1px solid ${C.border}`,borderRadius:8,padding:"32px 20px",textAlign:"center"}}>
              <div style={{fontFamily:"DM Mono,monospace",fontSize:28,color:C.t3,marginBottom:10}}>—</div>
              <div style={{fontSize:13,color:C.t2,marginBottom:6}}>This is a future date.</div>
              <div style={{fontSize:12,color:C.t3}}>Logging is disabled — come back on {fmtDate(date)}.</div>
            </div>
          ) : !dayLoaded ? (
            <div style={{marginTop:20,textAlign:"center",color:C.t3,fontSize:13,padding:"40px 0"}}>Loading day…</div>
          ) : <>

            {/* Morning */}
            <Divider label="Morning"/>
            <div style={{background:C.s1,border:`1px solid ${C.border}`,borderRadius:8,padding:"18px 20px",display:"flex",flexDirection:"column",gap:20}}>
              <div>
                <div style={{fontSize:10,color:C.t2,textTransform:"uppercase",letterSpacing:"1.5px",marginBottom:10}}>Mood {dayLocal.mood!=null&&<span style={{color:MOOD_COLORS[dayLocal.mood-1]}}>— {MOODS[dayLocal.mood-1]}</span>}</div>
                <div style={{display:"flex",gap:6}}>{MOODS.map((m,i)=>{const sel=dayLocal.mood===i+1;return <button key={m} onClick={()=>patch({mood:sel?null:i+1})} style={{flex:1,padding:"8px 4px",borderRadius:6,border:sel?`1.5px solid ${MOOD_COLORS[i]}`:`1px solid ${C.border}`,background:sel?MOOD_COLORS[i]+"18":"transparent",fontSize:12,cursor:"pointer",color:sel?MOOD_COLORS[i]:C.t2,transition:"all .15s"}}>{m}</button>;})}</div>
              </div>
              <div style={{height:1,background:C.border}}/>
              <div>
                <div style={{fontSize:10,color:C.t2,textTransform:"uppercase",letterSpacing:"1.5px",marginBottom:10}}>Energy <span style={{color:C.green,fontFamily:"DM Mono,monospace"}}>{dayLocal.energy??'—'}</span><span style={{color:C.t3}}>/10</span></div>
                <Pills value={dayLocal.energy} onChange={v=>patch({energy:v})} color={C.green}/>
              </div>
            </div>

            {/* Habits */}
            <Divider label="Habits"/>
            <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:14}}>
              <div style={{flex:1,height:4,background:C.s2,borderRadius:2,overflow:"hidden"}}><div style={{width:`${habits.length?Math.round(checked/habits.length*100):0}%`,height:"100%",background:C.gold,borderRadius:2,transition:"width .4s"}}/></div>
              <span style={{fontFamily:"DM Mono,monospace",fontSize:12,color:C.t2,whiteSpace:"nowrap"}}>{checked} / {habits.length}</span>
            </div>
            <div style={{display:"flex",flexDirection:"column",gap:8}}>
              {habits.map(h=>{
                const done=!!dayLocal.habits[h.id];
                const reason=(dayLocal.habitReasons||{})[h.id]||"";
                const ro=rOpen[h.id];
                return <div key={h.id} className={`hi ${done?"ck":""}`}>
                  <div className="hm" onClick={()=>toggleHabit(h.id)}>
                    <Checkbox checked={done} onChange={()=>toggleHabit(h.id)}/>
                    <div style={{flex:1}}>
                      <div style={{fontSize:14,color:done?C.t2:C.text,textDecoration:done?"line-through":"none",textDecorationColor:C.t3}}>{h.name}</div>
                    </div>
                    {!done&&<button onClick={e=>{e.stopPropagation();setROpen(r=>({...r,[h.id]:!r[h.id]}));}} style={{background:reason?C.goldDim:"transparent",border:`1px solid ${reason?"rgba(184,124,46,.3)":C.border}`,borderRadius:5,padding:"3px 8px",cursor:"pointer",fontSize:11,color:reason?C.gold:C.t3,transition:"all .15s"}}>{reason?"note":ro?"×":"+ note"}</button>}
                  </div>
                  {!done&&(ro||reason)&&<div className="rf">
                    <span style={{fontSize:11,color:C.t3,flexShrink:0}}>Reason</span>
                    <input value={reason} onChange={e=>setReason(h.id,e.target.value)} onClick={e=>e.stopPropagation()} placeholder="Why did you skip?" style={{flex:1,background:"transparent",border:"none",color:C.t2,fontSize:13,outline:"none"}}/>
                    {reason&&<button onClick={()=>setReason(h.id,"")} style={{background:"none",border:"none",color:C.t3,cursor:"pointer",fontSize:14}}>×</button>}
                  </div>}
                </div>;
              })}
            </div>

            {/* Body */}
            <Divider label="Body & Movement"/>
            <div style={{background:C.s1,border:`1px solid ${C.border}`,borderRadius:8,padding:"18px 20px"}}>
              <div className="two" style={{marginBottom:16}}>
                <div style={{flex:1}}><div style={{fontSize:10,color:C.t2,textTransform:"uppercase",letterSpacing:"1.5px",marginBottom:8}}>Calories</div>{NI(dayLocal.calories,v=>patch({calories:v}),"kcal")}{dayLocal.calories&&<GoalBar value={dayLocal.calories} goal={settings.calorie_goal} color="#b87030"/>}</div>
                <div style={{flex:1}}><div style={{fontSize:10,color:C.t2,textTransform:"uppercase",letterSpacing:"1.5px",marginBottom:8}}>Steps</div>{NI(dayLocal.steps,v=>patch({steps:v}),"steps")}{dayLocal.steps&&<GoalBar value={dayLocal.steps} goal={settings.steps_goal} color={C.green}/>}</div>
              </div>
              <div className="two">
                <div style={{flex:1}}><div style={{fontSize:10,color:C.t2,textTransform:"uppercase",letterSpacing:"1.5px",marginBottom:8}}>Workout</div>{NI(dayLocal.workoutMins,v=>patch({workoutMins:v}),"min")}</div>
                <div style={{flex:1}}><div style={{fontSize:10,color:C.t2,textTransform:"uppercase",letterSpacing:"1.5px",marginBottom:8}}>Screen Time</div>{NI(dayLocal.screenHours,v=>patch({screenHours:v}),"hrs")}{dayLocal.screenHours&&<GoalBar value={dayLocal.screenHours} goal={settings.screen_time_limit} color={Number(dayLocal.screenHours)>settings.screen_time_limit?C.red:C.green}/>}</div>
              </div>
            </div>

            {/* Mind */}
            <Divider label="Mind & Reflection"/>
            <div style={{background:C.s1,border:`1px solid ${C.border}`,borderRadius:8,padding:"18px 20px",display:"flex",flexDirection:"column",gap:20}}>
              <div>
                <div style={{fontSize:10,color:C.t2,textTransform:"uppercase",letterSpacing:"1.5px",marginBottom:10}}>Productivity <span style={{color:C.purple,fontFamily:"DM Mono,monospace"}}>{dayLocal.productivity??'—'}</span><span style={{color:C.t3}}>/10</span></div>
                <Pills value={dayLocal.productivity} onChange={v=>patch({productivity:v})} color={C.purple}/>
              </div>
              <div style={{height:1,background:C.border}}/>
              <div>
                <div style={{fontSize:10,color:C.t2,textTransform:"uppercase",letterSpacing:"1.5px",marginBottom:12}}>Gratitude</div>
                {[0,1,2].map(i=><div key={i} style={{display:"flex",alignItems:"center",gap:10,marginBottom:8}}>
                  <span style={{fontFamily:"DM Mono,monospace",fontSize:11,color:C.t3,width:14,flexShrink:0}}>{i+1}</span>
                  <input value={(dayLocal.gratitude||["","",""])[i]||""} onChange={e=>{const g=[...(dayLocal.gratitude||["","",""])];g[i]=e.target.value;patch({gratitude:g});}} placeholder={["I'm grateful for…","Something that went well…","A person I appreciate…"][i]} style={{flex:1,background:C.s2,border:`1px solid ${C.border}`,borderRadius:6,color:C.text,padding:"9px 12px",fontSize:13,fontFamily:"inherit",outline:"none"}} onFocus={e=>(e.target.style.borderColor=C.gold)} onBlur={e=>(e.target.style.borderColor=C.border)}/>
                </div>)}
              </div>
              <div style={{height:1,background:C.border}}/>
              <div>
                <div style={{fontSize:10,color:C.t2,textTransform:"uppercase",letterSpacing:"1.5px",marginBottom:10}}>Notes</div>
                <textarea value={dayLocal.notes||""} onChange={e=>patch({notes:e.target.value})} placeholder="Reflections, wins, what you'd do differently…" rows={4} style={{width:"100%",background:C.s2,border:`1px solid ${C.border}`,borderRadius:6,color:C.text,padding:"10px 12px",fontSize:13,outline:"none",lineHeight:1.7}} onFocus={e=>(e.target.style.borderColor=C.gold)} onBlur={e=>(e.target.style.borderColor=C.border)}/>
              </div>
            </div>
            <button className={`sb ${saved?"ok":""}`} onClick={saveDay} disabled={saving}>
              {saving?"Saving…":saved?"Saved ✓":"Save Log"}
            </button>
          </>}
        </>}

        {/* ══ PLANNER ══════════════════════════════════════════════ */}
        {tab==="planner"&&<>
          <Divider label="New Plan"/>
          <div style={{background:C.s1,border:`1px solid ${C.border}`,borderRadius:8,padding:"20px",marginBottom:24}}>
            <input className="fi" value={planForm.text} onChange={e=>setPlanForm(f=>({...f,text:e.target.value}))} onKeyDown={e=>e.key==="Enter"&&addPlan()} placeholder="What do you want to plan or remember?" style={{marginBottom:16}}/>
            <div style={{marginBottom:16}}>
              <div style={{fontSize:10,color:C.t2,textTransform:"uppercase",letterSpacing:"1.5px",marginBottom:10}}>Repeat</div>
              <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                {[["once","Only this day"],["daily","Every day"],["weekly","Specific days"],["daterange","Date range"]].map(([v,l])=>(
                  <button key={v} className={`rb ${planForm.recurrence===v?"on":""}`} onClick={()=>setPlanForm(f=>({...f,recurrence:v,weekdays:[]}))}>{l}</button>
                ))}
              </div>
            </div>
            {planForm.recurrence==="daterange"&&<div style={{marginBottom:16,background:"rgba(45,122,106,0.08)",border:"1px solid rgba(45,122,106,0.25)",borderRadius:7,padding:"10px 14px"}}>
              <div style={{fontSize:12,color:"#2d9a8a",marginBottom:3,fontWeight:500}}>Appears on every day in the range.</div>
              <div style={{fontSize:11,color:C.t3}}>Check it off on any one day — done and removed from all others.</div>
            </div>}
            {planForm.recurrence==="weekly"&&<div style={{marginBottom:16}}>
              <div style={{fontSize:10,color:C.t2,textTransform:"uppercase",letterSpacing:"1.5px",marginBottom:10}}>Repeat on {!planForm.weekdays.length&&<span style={{color:C.red}}>— pick at least one</span>}</div>
              <div style={{display:"flex",gap:6}}>{WD_SHORT.map((lbl,dow)=><button key={dow} className={`wb ${planForm.weekdays.includes(dow)?"on":""}`} onClick={()=>toggleWD(dow)}>{lbl}</button>)}</div>
            </div>}
            <div className="two" style={{alignItems:"flex-end"}}>
              <div style={{flex:1}}>
                <div style={{fontSize:10,color:C.t2,textTransform:"uppercase",letterSpacing:"1.5px",marginBottom:8}}>{planForm.recurrence==="once"?"Date":"Start date"}</div>
                <input type="date" className="fi fm" value={planForm.startDate} min={todayStr()} onChange={e=>setPlanForm(f=>({...f,startDate:e.target.value}))}/>
              </div>
              {planForm.recurrence!=="once"&&<div style={{flex:1}}>
                <div style={{fontSize:10,color:C.t2,textTransform:"uppercase",letterSpacing:"1.5px",marginBottom:8}}>End date {planForm.recurrence==="daterange"?<span style={{color:C.red,marginLeft:2}}>required</span>:<span style={{color:C.t3}}>(optional)</span>}</div>
                <input type="date" className="fi fm" value={planForm.endDate} min={planForm.startDate||todayStr()} onChange={e=>setPlanForm(f=>({...f,endDate:e.target.value}))}/>
              </div>}
              <button onClick={addPlan} style={{background:C.gold,border:"none",color:C.bg,padding:"10px 22px",borderRadius:6,cursor:"pointer",fontWeight:600,fontSize:13,fontFamily:"DM Sans,sans-serif",whiteSpace:"nowrap",height:40}}>Add Plan</button>
            </div>
          </div>
          <div style={{display:"flex",gap:8,marginBottom:20}}>
            {[["active","Active"],["history","All one-time"]].map(([v,l])=><button key={v} className={`fbt ${planView===v?"on":""}`} onClick={()=>setPlanView(v)}>{l}</button>)}
          </div>
          {planView==="active"&&<>
            {recurringP.length>0&&<><div style={{fontSize:10,color:C.t2,textTransform:"uppercase",letterSpacing:"1.5px",marginBottom:10}}>Recurring</div>
              <div style={{display:"flex",flexDirection:"column",gap:8,marginBottom:24}}>{recurringP.map(p=><div key={p.id} className="pr"><div style={{flex:1}}><div style={{fontSize:14,color:C.text,marginBottom:3}}>{p.text}</div><div style={{fontSize:11,color:C.t3}}>{recLabel(p)}</div></div><RecBadge r={p.recurrence}/><button onClick={()=>deletePlan(p.id)} style={{background:"none",border:"none",color:C.t3,cursor:"pointer",fontSize:16,lineHeight:1}}>×</button></div>)}</div></>}
            {daterangeP.length>0&&<><div style={{fontSize:10,color:"#2d9a8a",textTransform:"uppercase",letterSpacing:"1.5px",marginBottom:10}}>Date range tasks</div>
              <div style={{display:"flex",flexDirection:"column",gap:8,marginBottom:24}}>{daterangeP.map(p=>{const done=!!p.completed_on_date;return <div key={p.id} className="pr" style={{opacity:done?.5:1}}><div style={{flex:1}}><div style={{fontSize:14,color:done?C.t2:C.text,textDecoration:done?"line-through":"none",marginBottom:3}}>{p.text}</div><div style={{fontSize:11,color:C.t3}}>{fmtDate(p.start_date)} → {fmtDate(p.end_date!)}{done?` · completed ${fmtDate(p.completed_on_date!)}`:""}</div></div><RecBadge r={p.recurrence}/><button onClick={()=>deletePlan(p.id)} style={{background:"none",border:"none",color:C.t3,cursor:"pointer",fontSize:16,lineHeight:1}}>×</button></div>;})}
              </div></>}
            {groupDates.length>0&&<><div style={{fontSize:10,color:C.t2,textTransform:"uppercase",letterSpacing:"1.5px",marginBottom:10}}>One-time</div>
              {groupDates.map(d=>{const isToday=d===todayStr(),isTomorrow=d===addDays(todayStr(),1),isPast=d<todayStr();const label=isToday?"Today":isTomorrow?"Tomorrow":fmtDate(d);const accent=isPast?C.red:isToday?C.gold:C.blue;return <div key={d} style={{marginBottom:16}}><div style={{display:"flex",alignItems:"center",gap:10,marginBottom:8}}><div style={{width:3,height:12,background:accent,borderRadius:2}}/><span style={{fontSize:12,fontWeight:600,color:accent}}>{label}</span><div style={{flex:1,height:1,background:C.border}}/><span style={{fontSize:10,color:C.t3,fontFamily:"DM Mono,monospace"}}>{d}</span></div><div style={{display:"flex",flexDirection:"column",gap:7}}>{grouped[d].map(p=>{const done=isDoneOnDate(p,d);return <div key={p.id} className="pr" style={{opacity:done?.4:1}}><Checkbox checked={done} onChange={()=>togglePlanDate(p.id,d)} size={16} color={C.green}/><span style={{flex:1,fontSize:14,color:done?C.t2:C.text,textDecoration:done?"line-through":"none"}}>{p.text}</span>{isPast&&!done&&<span style={{fontSize:10,color:C.red,border:`1px solid ${C.red}40`,borderRadius:3,padding:"2px 6px"}}>overdue</span>}<button onClick={()=>deletePlan(p.id)} style={{background:"none",border:"none",color:C.t3,cursor:"pointer",fontSize:16,lineHeight:1}}>×</button></div>;})} </div></div>;})}
            </>}
            {!recurringP.length&&!daterangeP.length&&!groupDates.length&&<div style={{textAlign:"center",padding:"60px 0",color:C.t3}}><div style={{fontFamily:"Syne,sans-serif",fontSize:28,marginBottom:10}}>—</div><div style={{fontSize:13}}>No active plans. Add one above.</div></div>}
          </>}
          {planView==="history"&&(plans.filter(p=>!p.deleted&&p.recurrence==="once").length===0?<div style={{textAlign:"center",padding:"60px 0",color:C.t3,fontSize:13}}>No one-time plans yet</div>:plans.filter(p=>!p.deleted&&p.recurrence==="once").sort((a,b)=>b.start_date.localeCompare(a.start_date)).map(p=>{const done=isDoneOnDate(p,p.start_date);return <div key={p.id} className="pr" style={{marginBottom:8,opacity:done?.5:1}}><span style={{fontFamily:"DM Mono,monospace",fontSize:11,color:C.t3,width:80,flexShrink:0}}>{p.start_date}</span><span style={{flex:1,fontSize:14,color:done?C.t2:C.text,textDecoration:done?"line-through":"none"}}>{p.text}</span>{done&&<span style={{fontSize:10,color:C.green,border:`1px solid ${C.green}40`,borderRadius:3,padding:"2px 6px"}}>done</span>}<button onClick={()=>deletePlan(p.id)} style={{background:"none",border:"none",color:C.t3,cursor:"pointer",fontSize:16}}>×</button></div>;}))}
        </>}

        {/* ══ STATS ════════════════════════════════════════════════ */}
        {tab==="stats"&&<>
          {allDates.length>0&&<div style={{display:"flex",flexWrap:"wrap",gap:10,marginBottom:8}}>
            <MetricCard label="Days Logged" value={allDates.length} unit="total"/>
            <MetricCard label="Avg Mood"    value={safeAvg(last30.map(d=>logMap[d]?.mood??0).filter(Boolean))?.toFixed(1)} unit="out of 5"  color="#8a6030"/>
            <MetricCard label="Avg Energy"  value={safeAvg(last30.map(d=>logMap[d]?.energy??0).filter(Boolean))?.toFixed(1)} unit="out of 10" color={C.green}/>
            <MetricCard label="Avg Prod."   value={safeAvg(last30.map(d=>logMap[d]?.productivity??0).filter(Boolean))?.toFixed(1)} unit="out of 10" color={C.purple}/>
          </div>}
          <Divider label="Wellness Trends"/>
          <div style={{background:C.s1,border:`1px solid ${C.border}`,borderRadius:8,padding:"18px 20px"}}>
            <div style={{display:"flex",gap:18,fontSize:11,color:C.t2,marginBottom:16}}><span><span style={{color:"#8a6030"}}>—</span> Mood</span><span><span style={{color:C.green}}>—</span> Energy</span><span><span style={{color:C.purple}}>—</span> Productivity</span></div>
            {wellData.length>=2?<ResponsiveContainer width="100%" height={180}><LineChart data={wellData}><CartesianGrid strokeDasharray="2 4" stroke={C.border}/><XAxis dataKey="date" tick={{fill:C.t3,fontSize:10}}/><YAxis domain={[0,10]} tick={{fill:C.t3,fontSize:10}}/><Tooltip content={<ChartTip/>}/><Line type="monotone" dataKey="Mood" stroke="#8a6030" strokeWidth={1.5} dot={false} connectNulls/><Line type="monotone" dataKey="Energy" stroke={C.green} strokeWidth={1.5} dot={false} connectNulls/><Line type="monotone" dataKey="Productivity" stroke={C.purple} strokeWidth={1.5} dot={false} connectNulls/></LineChart></ResponsiveContainer>:<div style={{color:C.t3,fontSize:13,textAlign:"center",padding:"40px 0"}}>Log mood & energy for 2+ days</div>}
          </div>
          <Divider label="Body Averages (30d)"/>
          <div style={{display:"flex",flexWrap:"wrap",gap:10,marginBottom:8}}>
            <MetricCard label="Calories"    value={bAvg.cal?Math.round(bAvg.cal):null}   unit="kcal/day"    color="#b87030"/>
            <MetricCard label="Steps"       value={bAvg.steps?Math.round(bAvg.steps):null} unit="steps/day" color={C.green}/>
            <MetricCard label="Workout"     value={bAvg.work?Math.round(bAvg.work):null}  unit="min/session" color={C.blue}/>
            <MetricCard label="Screen Time" value={bAvg.screen?bAvg.screen.toFixed(1):null} unit="hrs/day"  color={(bAvg.screen??0)>settings.screen_time_limit?C.red:C.green}/>
          </div>
          {allDates.length===0&&<div style={{color:C.t3,fontSize:13,textAlign:"center",padding:"40px 0"}}>No data yet — log your first day!</div>}
        </>}

        {/* ══ SETTINGS ═════════════════════════════════════════════ */}
        {tab==="manage"&&<>
          <Divider label="Habits"/>
          <div style={{background:C.s1,border:`1px solid ${C.border}`,borderRadius:8,marginBottom:16}}>
            {habits.length===0&&<div style={{padding:"16px 18px",fontSize:13,color:C.t3}}>No habits yet — add one below.</div>}
            {habits.map((h,i)=><div key={h.id} style={{display:"flex",alignItems:"center",gap:12,padding:"12px 18px",borderBottom:i<habits.length-1?`1px solid ${C.border}`:"none"}}>
              <span style={{fontSize:13,color:C.text,flex:1}}>{h.name}</span>
              <button onClick={()=>removeHabit(h.id)} style={{background:"transparent",border:`1px solid ${C.border}`,borderRadius:5,color:C.red,padding:"4px 10px",cursor:"pointer",fontSize:12}}>Remove</button>
            </div>)}
          </div>
          <div style={{display:"flex",gap:8,marginBottom:28}}>
            <input value={newHabit} onChange={e=>setNewHabit(e.target.value)} placeholder="New habit name" onKeyDown={e=>e.key==="Enter"&&addHabit()} style={{flex:1,background:C.s1,border:`1px solid ${C.border}`,borderRadius:6,color:C.text,padding:"9px 12px",fontSize:14,fontFamily:"inherit",outline:"none"}} onFocus={e=>(e.target.style.borderColor=C.gold)} onBlur={e=>(e.target.style.borderColor=C.border)}/>
            <button onClick={addHabit} style={{background:C.gold,border:"none",color:C.bg,padding:"9px 18px",borderRadius:6,cursor:"pointer",fontWeight:600,fontSize:13}}>Add</button>
          </div>
          <Divider label="Goals"/>
          <div style={{background:C.s1,border:`1px solid ${C.border}`,borderRadius:8,padding:"0 18px"}}>
            {([{label:"Daily calorie goal",key:"calorie_goal",unit:"kcal"},{label:"Daily steps goal",key:"steps_goal",unit:"steps"},{label:"Screen time limit",key:"screen_time_limit",unit:"hrs"}] as {label:string;key:keyof Settings;unit:string}[]).map(f=><div key={f.key} className="sr">
              <span style={{fontSize:13,color:C.t2,flex:1}}>{f.label}</span>
              <div style={{display:"flex",alignItems:"center",gap:8}}>
                <input type="number" value={settings[f.key]} onChange={e=>saveSettings({...settings,[f.key]:Number(e.target.value)})} style={{width:80,background:C.s2,border:`1px solid ${C.border}`,borderRadius:6,color:C.text,fontFamily:"DM Mono,monospace",fontSize:15,padding:"6px 10px",outline:"none",textAlign:"right"}}/>
                <span style={{fontSize:11,color:C.t3,width:36}}>{f.unit}</span>
              </div>
            </div>)}
          </div>
        </>}

      </div>
    </div>
  );
}
