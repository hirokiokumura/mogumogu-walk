"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const BPM = 120;
const SCHEDULE_INTERVAL_MS = 50;
const LOOKAHEAD_SEC = 0.1;
const FIRST_BEAT_DELAY = 0.02;

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

function playClick(
  ctx: AudioContext,
  destination: AudioNode,
  buffer: AudioBuffer,
  when: number,
) {
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  source.connect(destination);
  source.start(when);
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

  const start = useCallback(() => {
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
      clickBufferRef.current = null;
    }
    const ctx = ctxRef.current;

    // クリック音バッファを初回のみ生成（AudioContextと同じ生存期間）
    if (!clickBufferRef.current) {
      clickBufferRef.current = createClickBuffer(ctx);
    }
    const clickBuffer = clickBufferRef.current;

    const masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(0.8, ctx.currentTime);
    masterGain.connect(ctx.destination);
    masterGainRef.current = masterGain;

    const intervalSec = 60 / BPM;
    const firstBeatTime = ctx.currentTime + FIRST_BEAT_DELAY;

    // iPhone Safariでは、初回の実音をタップ処理の同期範囲で予約することが重要。
    // resume() の完了を待ってから音源を作ると、無音のままになる端末がある。
    playClick(ctx, masterGain, clickBuffer, firstBeatTime);
    nextBeatTimeRef.current = firstBeatTime + intervalSec;

    if (ctx.state !== "running") {
      const resumePromise = ctx.resume();

      void resumePromise
        .then(() => {
          if (startRequestRef.current !== requestId) return;
          if (
            ctx.state === "suspended" ||
            ctx.state === "interrupted" ||
            ctx.state === "closed"
          ) {
            console.warn(
              "[useMetronome] AudioContext not running after resume:",
              ctx.state,
            );
            stop();
          }
        })
        .catch((e) => {
          if (startRequestRef.current !== requestId) return;
          console.warn("[useMetronome] AudioContext.resume() failed:", e);
          stop();
        });
    }

    if (startRequestRef.current !== requestId) return;

    const schedule = () => {
      const currentCtx = ctxRef.current;
      const currentMasterGain = masterGainRef.current;
      const currentBuffer = clickBufferRef.current;
      if (!currentCtx || !currentMasterGain || !currentBuffer) return;
      if (nextBeatTimeRef.current < currentCtx.currentTime - LOOKAHEAD_SEC) {
        nextBeatTimeRef.current = currentCtx.currentTime + FIRST_BEAT_DELAY;
      }
      while (nextBeatTimeRef.current < currentCtx.currentTime + LOOKAHEAD_SEC) {
        playClick(
          currentCtx,
          currentMasterGain,
          currentBuffer,
          nextBeatTimeRef.current,
        );
        nextBeatTimeRef.current += intervalSec;
      }
    };

    schedule();
    intervalRef.current = setInterval(schedule, SCHEDULE_INTERVAL_MS);
    setIsOn(true);
  }, [stop]);

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
