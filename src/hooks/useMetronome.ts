"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const BPM = 120;
const CLICK_DURATION = 0.09;

type AudioContextConstructor = new () => AudioContext;

function playClick(ctx: AudioContext) {
  const now = ctx.currentTime;
  const oscillator = ctx.createOscillator();
  const gain = ctx.createGain();
  oscillator.connect(gain);
  gain.connect(ctx.destination);
  oscillator.type = "square";
  oscillator.frequency.setValueAtTime(1200, now);
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.35, now + 0.005);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + CLICK_DURATION);
  oscillator.start(now);
  oscillator.stop(now + CLICK_DURATION);
}

function getAudioContextConstructor(): AudioContextConstructor | undefined {
  return (
    window.AudioContext ??
    (window as typeof window & { webkitAudioContext?: AudioContextConstructor })
      .webkitAudioContext
  );
}

export function useMetronome() {
  const [isOn, setIsOn] = useState(false);
  const ctxRef = useRef<AudioContext | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startRequestRef = useRef(0);

  const stop = useCallback(() => {
    startRequestRef.current += 1;
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
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
    if (ctx.state === "suspended") {
      try {
        await ctx.resume();
      } catch {
        return;
      }
    }
    if (startRequestRef.current !== requestId) return;
    if (ctx.state !== "running") return;

    const intervalMs = (60 / BPM) * 1000;
    playClick(ctx);
    intervalRef.current = setInterval(() => playClick(ctx), intervalMs);
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
      ctxRef.current?.close();
    };
  }, []);

  return { isOn, start, toggle, stop };
}
