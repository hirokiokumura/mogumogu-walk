"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const BPM = 120;
const SCHEDULE_INTERVAL_MS = 50;
const LOOKAHEAD_SEC = 0.1;
const FIRST_BEAT_DELAY = 0.05;

type AudioContextConstructor = new () => AudioContext;

function getAudioContextConstructor(): AudioContextConstructor | undefined {
  return (
    window.AudioContext ??
    (window as typeof window & { webkitAudioContext?: AudioContextConstructor })
      .webkitAudioContext
  );
}

// クリック音をPCMデータとして生成する（OscillatorNodeのゲイン自動化はiOSで不安定なため）
function createClickBuffer(ctx: AudioContext): AudioBuffer {
  const { sampleRate } = ctx;
  const length = Math.floor(sampleRate * 0.05); // 50ms
  const buffer = ctx.createBuffer(1, length, sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) {
    const t = i / sampleRate;
    data[i] = Math.sin(2 * Math.PI * 1200 * t) * Math.exp(-t * 100) * 0.9;
  }
  return buffer;
}

export function useMetronome() {
  const [isOn, setIsOn] = useState(false);
  const ctxRef = useRef<AudioContext | null>(null);
  const masterGainRef = useRef<GainNode | null>(null);
  const clickBufferRef = useRef<AudioBuffer | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const nextBeatTimeRef = useRef(0);
  const startRequestRef = useRef(0);

  const stop = useCallback(() => {
    startRequestRef.current += 1;
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
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

    if (!ctxRef.current) {
      const AudioContextClass = getAudioContextConstructor();
      if (!AudioContextClass) return;
      ctxRef.current = new AudioContextClass();
    }
    const ctx = ctxRef.current;

    if (ctx.state !== "running") {
      // suspended/interrupted どちらの状態でも silent buffer + resume でアンロック
      const silentBuf = ctx.createBuffer(1, 1, ctx.sampleRate);
      const silentSrc = ctx.createBufferSource();
      silentSrc.buffer = silentBuf;
      silentSrc.connect(ctx.destination);
      silentSrc.start(0);

      try {
        await ctx.resume();
      } catch (e) {
        console.warn("[useMetronome] AudioContext.resume() failed:", e);
        return;
      }

      if (
        ctx.state === "suspended" ||
        ctx.state === "interrupted" ||
        ctx.state === "closed"
      ) {
        console.warn(
          "[useMetronome] AudioContext not running after resume:",
          ctx.state,
        );
        return;
      }
    }

    if (startRequestRef.current !== requestId) return;

    // クリック音バッファを初回のみ生成（AudioContextと同じ生存期間）
    if (!clickBufferRef.current) {
      clickBufferRef.current = createClickBuffer(ctx);
    }

    const masterGain = ctx.createGain();
    masterGain.connect(ctx.destination);
    masterGainRef.current = masterGain;

    const intervalSec = 60 / BPM;
    // 最初のビートを必ず未来時刻にスケジュールする（過去時刻だとiOSで無音になる場合がある）
    nextBeatTimeRef.current = ctx.currentTime + FIRST_BEAT_DELAY;

    const schedule = () => {
      const currentCtx = ctxRef.current;
      const currentMasterGain = masterGainRef.current;
      const currentBuffer = clickBufferRef.current;
      if (!currentCtx || !currentMasterGain || !currentBuffer) return;
      if (nextBeatTimeRef.current < currentCtx.currentTime - LOOKAHEAD_SEC) {
        nextBeatTimeRef.current = currentCtx.currentTime + FIRST_BEAT_DELAY;
      }
      while (nextBeatTimeRef.current < currentCtx.currentTime + LOOKAHEAD_SEC) {
        const source = currentCtx.createBufferSource();
        source.buffer = currentBuffer;
        source.connect(currentMasterGain);
        source.start(nextBeatTimeRef.current);
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

  useEffect(() => {
    return () => {
      startRequestRef.current += 1;
      if (intervalRef.current !== null) {
        clearInterval(intervalRef.current);
      }
      masterGainRef.current?.disconnect();
      ctxRef.current?.close();
      ctxRef.current = null;
      clickBufferRef.current = null;
    };
  }, []);

  return { isOn, start, toggle, stop };
}
