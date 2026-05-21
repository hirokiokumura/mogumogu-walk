"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const BPM = 120;
const CLICK_DURATION = 0.05;

function playClick(ctx: AudioContext) {
  const oscillator = ctx.createOscillator();
  const gain = ctx.createGain();
  oscillator.connect(gain);
  gain.connect(ctx.destination);
  oscillator.frequency.value = 1000;
  gain.gain.setValueAtTime(1, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(
    0.001,
    ctx.currentTime + CLICK_DURATION,
  );
  oscillator.start(ctx.currentTime);
  oscillator.stop(ctx.currentTime + CLICK_DURATION);
}

export function useMetronome() {
  const [isOn, setIsOn] = useState(false);
  const ctxRef = useRef<AudioContext | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stop = useCallback(() => {
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setIsOn(false);
  }, []);

  const toggle = useCallback(() => {
    if (isOn) {
      stop();
      return;
    }

    // iOS Safari: AudioContext はユーザー操作後に生成する
    if (!ctxRef.current) {
      ctxRef.current = new AudioContext();
    }
    const ctx = ctxRef.current;
    if (ctx.state === "suspended") {
      ctx.resume();
    }

    const intervalMs = (60 / BPM) * 1000;
    playClick(ctx);
    intervalRef.current = setInterval(() => playClick(ctx), intervalMs);
    setIsOn(true);
  }, [isOn, stop]);

  // アンマウント時にクリーンアップ
  useEffect(() => {
    return () => {
      if (intervalRef.current !== null) {
        clearInterval(intervalRef.current);
      }
      ctxRef.current?.close();
    };
  }, []);

  return { isOn, toggle, stop };
}
