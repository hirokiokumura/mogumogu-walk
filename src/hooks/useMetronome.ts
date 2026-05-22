"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const BPM = 120;
const CLICK_DURATION = 0.09;
const SCHEDULE_INTERVAL_MS = 50;
const LOOKAHEAD_SEC = 0.1;

type AudioContextConstructor = new () => AudioContext;

function playClick(ctx: AudioContext, masterGain: GainNode, time: number) {
  const oscillator = ctx.createOscillator();
  const gain = ctx.createGain();
  oscillator.connect(gain);
  gain.connect(masterGain);
  oscillator.type = "square";
  oscillator.frequency.setValueAtTime(1200, time);
  gain.gain.setValueAtTime(0.0001, time);
  gain.gain.exponentialRampToValueAtTime(0.35, time + 0.005);
  gain.gain.exponentialRampToValueAtTime(0.0001, time + CLICK_DURATION);
  oscillator.start(time);
  oscillator.stop(time + CLICK_DURATION);
}

function getAudioContextConstructor(): AudioContextConstructor | undefined {
  return (
    window.AudioContext ??
    (window as typeof window & { webkitAudioContext?: AudioContextConstructor })
      .webkitAudioContext
  );
}

// iOS 12以下向け: click ハンドラの同期コンテキストで silent buffer を再生して AudioContext を unlock する
function unlockWithSilentBuffer(ctx: AudioContext) {
  const buffer = ctx.createBuffer(1, 1, 22050);
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  source.connect(ctx.destination);
  source.start(0);
}

export function useMetronome() {
  const [isOn, setIsOn] = useState(false);
  const ctxRef = useRef<AudioContext | null>(null);
  const masterGainRef = useRef<GainNode | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const nextBeatTimeRef = useRef(0);
  const startRequestRef = useRef(0);

  const stop = useCallback(() => {
    startRequestRef.current += 1;
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    // スケジュール済みの音を即座にミュートして stop 後の残響を防ぐ
    if (masterGainRef.current && ctxRef.current) {
      masterGainRef.current.gain.setValueAtTime(0, ctxRef.current.currentTime);
      masterGainRef.current.disconnect();
      masterGainRef.current = null;
    }
    setIsOn(false);
  }, []);

  const start = useCallback(async () => {
    const requestId = startRequestRef.current + 1;
    startRequestRef.current = requestId;

    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    // iOS Safari: AudioContext はユーザー操作後に生成する
    if (!ctxRef.current) {
      const AudioContextClass = getAudioContextConstructor();
      if (!AudioContextClass) return;
      ctxRef.current = new AudioContextClass();
    }
    const ctx = ctxRef.current;

    if (ctx.state !== "running") {
      // suspended のときのみ silent buffer で unlock（interrupted 状態では unlock 不要）
      if (ctx.state === "suspended") {
        unlockWithSilentBuffer(ctx);
      }
      try {
        await ctx.resume();
      } catch (e) {
        console.warn("[useMetronome] AudioContext.resume() failed:", e);
        return;
      }
      // resume 後も running でなければ再生しない（非running状態を明示列挙して narrowing を回避）
      if (
        ctx.state === "suspended" ||
        ctx.state === "interrupted" ||
        ctx.state === "closed"
      ) {
        console.warn(
          "[useMetronome] AudioContext state is not running after resume:",
          ctx.state,
        );
        return;
      }
    }

    if (startRequestRef.current !== requestId) return;

    // master gain node を新規作成（stop 時の即座ミュートに使用）
    const masterGain = ctx.createGain();
    masterGain.connect(ctx.destination);
    masterGainRef.current = masterGain;

    // Web Audio Scheduler: AudioContext.currentTime ベースでビートをスケジュールし
    // setInterval の drift に関係なく正確なタイミングを保証する
    const intervalSec = 60 / BPM;
    nextBeatTimeRef.current = ctx.currentTime;

    // ctxRef / masterGainRef を介してアクセスすることでクロージャが ctx を強参照しない
    const schedule = () => {
      const currentCtx = ctxRef.current;
      const currentMasterGain = masterGainRef.current;
      if (!currentCtx || !currentMasterGain) return;
      while (nextBeatTimeRef.current < currentCtx.currentTime + LOOKAHEAD_SEC) {
        playClick(currentCtx, currentMasterGain, nextBeatTimeRef.current);
        nextBeatTimeRef.current += intervalSec;
      }
    };

    schedule();
    intervalRef.current = setInterval(schedule, SCHEDULE_INTERVAL_MS);
    setIsOn(true);
  }, []);

  const toggle = useCallback(async () => {
    if (isOn) {
      stop();
    } else {
      await start();
    }
  }, [isOn, stop, start]);

  // アンマウント時にクリーンアップ
  useEffect(() => {
    return () => {
      startRequestRef.current += 1;
      if (intervalRef.current !== null) {
        clearInterval(intervalRef.current);
      }
      masterGainRef.current?.disconnect();
      ctxRef.current?.close();
    };
  }, []);

  return { isOn, start, toggle, stop };
}
