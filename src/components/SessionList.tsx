"use client";

import { useState } from "react";
import type { Session } from "@/lib/storage";

type Props = {
  sessions: Session[];
  onDelete: (slot: number) => void;
};

export function SessionList({ sessions, onDelete }: Props) {
  const [confirmSlot, setConfirmSlot] = useState<number | null>(null);

  if (sessions.length === 0) {
    return (
      <p className="text-gray-400 text-sm text-center py-4">
        まだ記録がありません
      </p>
    );
  }

  const handleDeleteRequest = (slot: number) => {
    setConfirmSlot(slot);
  };

  const handleDeleteConfirm = (slot: number) => {
    setConfirmSlot(null);
    onDelete(slot);
  };

  const handleDeleteCancel = () => {
    setConfirmSlot(null);
  };

  return (
    <div className="w-full flex flex-col gap-2">
      <h2 className="text-sm font-semibold text-gray-500 text-center">
        📋 今日の記録 ({sessions.length} / 6)
      </h2>
      <ul className="flex flex-col gap-2">
        {sessions.map((s) => (
          <li
            key={s.slot}
            className="flex items-center justify-between bg-purple-50 rounded-2xl px-4 py-3"
          >
            <div className="flex items-center gap-3">
              <span className="text-lg">🐾</span>
              <div>
                <p className="text-xs text-gray-400">{s.time}</p>
                <p className="text-lg font-bold text-purple-600 tabular-nums">
                  {s.steps}
                  <span className="text-xs font-normal text-gray-400 ml-1">
                    歩
                  </span>
                </p>
              </div>
            </div>
            {confirmSlot === s.slot ? (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleDeleteConfirm(s.slot)}
                  className="px-3 py-1 rounded-xl bg-red-400 text-white text-xs font-bold active:scale-95 transition-transform"
                >
                  消す
                </button>
                <button
                  type="button"
                  onClick={handleDeleteCancel}
                  className="px-3 py-1 rounded-xl bg-gray-200 text-gray-600 text-xs font-medium active:scale-95 transition-transform"
                >
                  やめる
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => handleDeleteRequest(s.slot)}
                className="p-2 text-red-300 hover:text-red-400 active:scale-90 transition-transform rounded-xl"
                aria-label={`第${s.slot}回を削除`}
              >
                🗑️
              </button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
