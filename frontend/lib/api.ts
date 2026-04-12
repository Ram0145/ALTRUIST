import { createSupabaseClient } from "./supabase";

const BASE = process.env.NEXT_PUBLIC_API_URL!;

// ── Get JWT from Supabase session ─────────────────────────────
async function getToken(): Promise<string> {
  const supabase = createSupabaseClient();
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("Not authenticated");
  return token;
}

// ── Base fetch wrapper ─────────────────────────────────────────
async function apiFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = await getToken();
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...options.headers,
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || "API error");
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

// ── Types ──────────────────────────────────────────────────────
export type Habit = {
  id: string; name: string; icon: string; position: number; active: boolean;
};
export type HabitCheck = {
  habit_id: string; date: string; done: boolean; reason?: string;
};
export type DailyLog = {
  id?: string; date: string;
  mood?: number; energy?: number; productivity?: number;
  calories?: number; steps?: number; workout_mins?: number; screen_hours?: number;
  gratitude?: string[]; notes?: string;
};
export type Plan = {
  id: string; text: string;
  recurrence: "once" | "daily" | "weekly" | "daterange";
  start_date: string; end_date?: string;
  weekdays: number[]; done_dates: string[];
  completed_on_date?: string; deleted: boolean;
};
export type Settings = {
  calorie_goal: number; steps_goal: number; screen_time_limit: number;
};
export type Profile = { id: string; name?: string; email: string };

// ── Auth ───────────────────────────────────────────────────────
export const authApi = {
  me: ()                => apiFetch<Profile>("/auth/me"),
  updateMe: (name: string) => apiFetch<Profile>("/auth/me", {
    method: "PATCH", body: JSON.stringify({ name }),
  }),
};

// ── Habits ────────────────────────────────────────────────────
export const habitsApi = {
  list: ()                       => apiFetch<Habit[]>("/habits/"),
  create: (name: string, icon = "◎", position = 0) =>
    apiFetch<Habit>("/habits/", { method: "POST", body: JSON.stringify({ name, icon, position }) }),
  update: (id: string, data: Partial<Habit>) =>
    apiFetch<Habit>(`/habits/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  delete: (id: string) =>
    apiFetch<void>(`/habits/${id}`, { method: "DELETE" }),
};

// ── Daily logs ────────────────────────────────────────────────
export const logsApi = {
  list: (from?: string, to?: string) => {
    const params = new URLSearchParams();
    if (from) params.set("from_date", from);
    if (to)   params.set("to_date", to);
    return apiFetch<DailyLog[]>(`/logs/?${params}`);
  },
  get: (date: string)              => apiFetch<DailyLog>(`/logs/${date}`),
  upsert: (date: string, data: Partial<DailyLog>) =>
    apiFetch<DailyLog>(`/logs/${date}`, { method: "PUT", body: JSON.stringify(data) }),
  getHabitChecks: (date: string)   => apiFetch<HabitCheck[]>(`/logs/${date}/habits`),
  upsertHabitCheck: (date: string, data: HabitCheck) =>
    apiFetch<HabitCheck>(`/logs/${date}/habits`, { method: "PUT", body: JSON.stringify(data) }),
  weekly: ()                       => apiFetch<{ logs: DailyLog[]; habit_checks: HabitCheck[]; from: string; to: string }>("/logs/range/weekly"),
};

// ── Plans ─────────────────────────────────────────────────────
export const plansApi = {
  list: () => apiFetch<Plan[]>("/plans/"),
  create: (data: Omit<Plan, "id" | "done_dates" | "completed_on_date" | "deleted">) =>
    apiFetch<Plan>("/plans/", { method: "POST", body: JSON.stringify(data) }),
  update: (id: string, data: Partial<Pick<Plan, "done_dates" | "completed_on_date" | "deleted">>) =>
    apiFetch<Plan>(`/plans/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  delete: (id: string) =>
    apiFetch<void>(`/plans/${id}`, { method: "DELETE" }),
};

// ── Settings ──────────────────────────────────────────────────
export const settingsApi = {
  get: ()                 => apiFetch<Settings>("/settings/"),
  upsert: (data: Settings) => apiFetch<Settings>("/settings/", { method: "PUT", body: JSON.stringify(data) }),
};
