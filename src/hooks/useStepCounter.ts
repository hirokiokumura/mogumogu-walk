"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type StepCounterState = "idle" | "requesting" | "counting" | "denied";

const THRESHOLD = 1.5;
const MIN_INTERVAL_MS = 300;

async function requestMotionPermission(): Promise<boolean> {
  if (
    typeof DeviceMotionEvent !== "undefined" &&
    typeof (
      DeviceMotionEvent as unknown as {
        requestPermission?: () => Promise<string>;
      }
    ).requestPermission === "function"
  ) {
    const result = await (
      DeviceMotionEvent as unknown as {
        requestPermission: () => Promise<string>;
      }
    ).requestPermission();
    return result === "granted";
  }
  return true;
}

export function useStepCounter() {
  const [state, setState] = useState<StepCounterState>("idle");
  const [steps, setSteps] = useState(0);

  const lastStepTimeRef = useRef<number>(0);
  const lastMagnitudeRef = useRef<number | null>(null);
  const aboveThresholdRef = useRef<boolean>(false);

  const handleMotion = useCallback((event: DeviceMotionEvent) => {
    const acc = event.accelerationIncludingGravity;
    if (!acc || acc.x == null || acc.y == null || acc.z == null) return;

    const magnitude = Math.sqrt(acc.x ** 2 + acc.y ** 2 + acc.z ** 2);
    if (lastMagnitudeRef.current === null) {
      lastMagnitudeRef.current = magnitude;
      return;
    }
    const delta = Math.abs(magnitude - lastMagnitudeRef.current);
    lastMagnitudeRef.current = magnitude;

    const now = performance.now();
    if (delta > THRESHOLD && !aboveThresholdRef.current) {
      aboveThresholdRef.current = true;
      if (now - lastStepTimeRef.current >= MIN_INTERVAL_MS) {
        lastStepTimeRef.current = now;
        setSteps((s) => s + 1);
      }
    } else if (delta <= THRESHOLD) {
      aboveThresholdRef.current = false;
    }
  }, []);

  const start = useCallback(async () => {
    setState("requesting");
    let granted: boolean;
    try {
      granted = await requestMotionPermission();
    } catch {
      setState("denied");
      return;
    }
    if (!granted) {
      setState("denied");
      return;
    }
    setSteps(0);
    lastStepTimeRef.current = 0;
    lastMagnitudeRef.current = null;
    aboveThresholdRef.current = false;
    setState("counting");
  }, []);

  const stop = useCallback(() => {
    setState("idle");
  }, []);

  useEffect(() => {
    if (state === "counting") {
      window.addEventListener("devicemotion", handleMotion);
    }
    return () => {
      window.removeEventListener("devicemotion", handleMotion);
    };
  }, [state, handleMotion]);

  return { state, steps, start, stop };
}
