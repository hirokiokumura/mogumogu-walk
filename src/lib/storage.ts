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

function load(): TrainingData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { date: today(), sessions: [] };
    const data = JSON.parse(raw) as TrainingData;
    // 日付が変わっていたらリセット
    if (data.date !== today()) {
      return { date: today(), sessions: [] };
    }
    return data;
  } catch {
    return { date: today(), sessions: [] };
  }
}

function save(data: TrainingData): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

/** 今日のトレーニングデータを取得する */
export function loadTrainingData(): TrainingData {
  return load();
}

/** セッションを追加して保存する。6回上限を超える場合は保存しない */
export function addSession(steps: number): TrainingData | null {
  const data = load();
  if (data.sessions.length >= MAX_SESSIONS) return null;
  const newSession: Session = {
    slot: data.sessions.length + 1,
    steps,
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
