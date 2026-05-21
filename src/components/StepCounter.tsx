"use client";

import { useStepCounter } from "@/hooks/useStepCounter";
import { addSession } from "@/lib/storage";
import { useState } from "react";

export function StepCounter() {
  const { state, steps, start, stop } = useStepCounter();
  const [savedSteps, setSavedSteps] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleStop = () => {
    stop();
    const result = addSession(steps);
    if (result) {
      setSavedSteps(steps);
      setError(null);
    } else {
      setError("保存できませんでした");
    }
  };

  const handleStart = () => {
    setSavedSteps(null);
    setError(null);
    start();
  };

  return (
    <div className="flex flex-col items-center gap-6 w-full max-w-sm mx-auto px-4 py-8">
      <div className="text-6xl font-bold text-purple-600 tabular-nums min-w-[3ch] text-center">
        {steps}
      </div>
      <p className="text-gray-500 text-sm">歩</p>

      {state === "idle" && (
        <button
          onClick={handleStart}
          className="w-full py-4 rounded-3xl bg-green-400 text-white text-xl font-bold shadow-md active:scale-95 transition-transform"
        >
          🐾 はじめる
        </button>
      )}

      {state === "requesting" && (
        <p className="text-gray-500 text-sm">センサーの許可を確認中...</p>
      )}

      {state === "counting" && (
        <button
          onClick={handleStop}
          className="w-full py-4 rounded-3xl bg-red-400 text-white text-xl font-bold shadow-md active:scale-95 transition-transform"
        >
          ⏹ とめる
        </button>
      )}

      {state === "denied" && (
        <p className="text-red-400 text-sm text-center">
          センサーの使用が許可されませんでした。
          <br />
          設定アプリで「モーションと方向」を許可してください。
        </p>
      )}

      {savedSteps !== null && (
        <p className="text-green-600 text-sm font-medium">
          ✅ {savedSteps}歩を保存しました！
        </p>
      )}

      {error && <p className="text-red-400 text-sm">{error}</p>}
    </div>
  );
}
