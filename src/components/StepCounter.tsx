"use client";

import { useEffect, useState } from "react";
import { SessionList } from "@/components/SessionList";
import { useMetronome } from "@/hooks/useMetronome";
import { useStepCounter } from "@/hooks/useStepCounter";
import {
  addSession,
  deleteSession,
  loadTrainingData,
  type Session,
} from "@/lib/storage";

const MAX_SESSIONS = 6;

export function StepCounter() {
  const { state, steps, start, stop } = useStepCounter();
  const {
    isOn: metronomeOn,
    toggle: toggleMetronome,
    stop: stopMetronome,
  } = useMetronome();
  const [sessions, setSessions] = useState<Session[] | null>(null);
  const [savedSteps, setSavedSteps] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => {
    setSessions(loadTrainingData().sessions);
  }, []);

  const isLoaded = sessions !== null;
  const isFull = isLoaded && sessions.length >= MAX_SESSIONS;

  const handleStart = () => {
    setSavedSteps(null);
    setError(null);
    start();
  };

  const handleStop = () => {
    stop();
    stopMetronome();
    const result = addSession(steps);
    if (result) {
      setSavedSteps(steps);
      setSessions(result.sessions);
      setError(null);
    } else {
      setError("保存できませんでした");
    }
  };

  const handleDelete = (slot: number) => {
    const result = deleteSession(slot);
    if (result) {
      setSessions(result.sessions);
      setSavedSteps(null);
    } else {
      setError("削除できませんでした");
    }
  };

  return (
    <div className="flex flex-col items-center gap-6 w-full max-w-sm mx-auto px-4 py-8">
      <div className="text-6xl font-bold text-purple-600 tabular-nums min-w-[3ch] text-center">
        {steps}
      </div>
      <p className="text-gray-500 text-sm">歩</p>

      {state === "idle" &&
        (!isLoaded ? null : isFull ? (
          <p className="text-gray-400 text-sm text-center">
            本日の計測は6回完了しました 🎉
          </p>
        ) : (
          <button
            type="button"
            onClick={handleStart}
            className="w-full py-4 rounded-3xl bg-green-400 text-white text-xl font-bold shadow-md active:scale-95 transition-transform"
          >
            🐾 はじめる
          </button>
        ))}

      {state === "requesting" && (
        <p className="text-gray-500 text-sm">センサーの許可を確認中...</p>
      )}

      {state === "counting" && (
        <>
          <button
            type="button"
            onClick={handleStop}
            className="w-full py-4 rounded-3xl bg-red-400 text-white text-xl font-bold shadow-md active:scale-95 transition-transform"
          >
            ⏹ とめる
          </button>
          <button
            type="button"
            onClick={toggleMetronome}
            className={`w-full py-3 rounded-3xl text-white text-lg font-bold shadow-md active:scale-95 transition-transform ${
              metronomeOn ? "bg-orange-400" : "bg-blue-300"
            }`}
          >
            {metronomeOn ? "🔔 メトロノーム ON" : "🔕 メトロノーム OFF"}
          </button>
        </>
      )}

      {state === "denied" && (
        <div className="flex flex-col items-center gap-3">
          <p className="text-red-400 text-sm text-center">
            センサーの使用が許可されませんでした。
            <br />
            設定アプリで「モーションと方向」を許可してください。
          </p>
          <button
            type="button"
            onClick={stop}
            className="px-6 py-2 rounded-2xl bg-gray-200 text-gray-600 text-sm font-medium active:scale-95 transition-transform"
          >
            もう一度試す
          </button>
        </div>
      )}

      {savedSteps !== null && (
        <p className="text-green-600 text-sm font-medium">
          ✅ {savedSteps}歩を保存しました！
        </p>
      )}

      {error && <p className="text-red-400 text-sm">{error}</p>}

      {isLoaded && (
        <div className="w-full mt-2">
          <SessionList sessions={sessions} onDelete={handleDelete} />
        </div>
      )}
    </div>
  );
}
