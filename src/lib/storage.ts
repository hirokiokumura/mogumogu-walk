export type Session = {
  slot: number;
  steps: number;
  time: string; // "HH:MM"
};

export type TrainingData = {
  date: string; // "YYYY-MM-DD"
  sessions: Session[];
};

const STORAGE_KEY = "mogumogu-walk-training";
const MAX_SESSIONS = 6;

function today(): string {
  return new Date().toLocaleDateString("sv-SE"); // "YYYY-MM-DD"
}

function currentTime(): string {
  return new Date().toLocaleTimeString("ja-JP", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function isValidSession(s: unknown): s is Session {
  return (
    typeof s === "object" &&
    s !== null &&
    typeof (s as Session).slot === "number" &&
    typeof (s as Session).steps === "number" &&
    typeof (s as Session).time === "string"
  );
}

function isValidData(data: unknown): data is TrainingData {
  return (
    typeof data === "object" &&
    data !== null &&
    typeof (data as TrainingData).date === "string" &&
    Array.isArray((data as TrainingData).sessions) &&
    (data as TrainingData).sessions.every(isValidSession)
  );
}

function load(): TrainingData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { date: today(), sessions: [] };
    const parsed: unknown = JSON.parse(raw);
    if (!isValidData(parsed)) return { date: today(), sessions: [] };
    // 日付が変わっていたらリセットして localStorage にも書き戻す
    if (parsed.date !== today()) {
      const reset = { date: today(), sessions: [] };
      save(reset);
      return reset;
    }
    return parsed;
  } catch {
    return { date: today(), sessions: [] };
  }
}

function save(data: TrainingData): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // 容量超過・ストレージ無効（Safari プライベートモード等）は無視
  }
}

/** 今日のトレーニングデータを取得する */
export function loadTrainingData(): TrainingData {
  return load();
}

/** セッションを追加して保存する。6回上限を超える場合は保存しない */
export function addSession(steps: number): TrainingData | null {
  if (!Number.isFinite(steps) || steps < 0) return null;
  const safeSteps = Math.floor(steps);
  const data = load();
  if (data.sessions.length >= MAX_SESSIONS) return null;
  const newSession: Session = {
    slot: data.sessions.length + 1,
    steps: safeSteps,
    time: currentTime(),
  };
  const updated: TrainingData = {
    ...data,
    sessions: [...data.sessions, newSession],
  };
  save(updated);
  return updated;
}

/** 指定 slot のセッションを削除し、slot を 1 から詰め直す */
export function deleteSession(slot: number): TrainingData {
  const data = load();
  const filtered = data.sessions.filter((s) => s.slot !== slot);
  const renumbered = filtered.map((s, i) => ({ ...s, slot: i + 1 }));
  const updated: TrainingData = { ...data, sessions: renumbered };
  save(updated);
  return updated;
}

/** 今日の全記録を削除する */
export function resetToday(): TrainingData {
  const updated: TrainingData = { date: today(), sessions: [] };
  save(updated);
  return updated;
}
