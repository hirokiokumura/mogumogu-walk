import { expect, test } from "@playwright/test";

declare global {
  interface Window {
    __audioEvents: string[];
    __resolveAudioResume: (() => void) | undefined;
  }
}

async function installAudioContextMock(page: import("@playwright/test").Page) {
  await page.addInitScript(() => {
    const events: string[] = [];

    class MockAudioContext {
      currentTime = 10;
      sampleRate = 44_100;
      state: AudioContextState = "suspended";
      destination = {};

      createBuffer(_channels: number, length: number) {
        events.push("createBuffer");
        return {
          getChannelData: () => new Float32Array(length),
        };
      }

      createBufferSource() {
        events.push("createBufferSource");
        return {
          set buffer(_buffer: unknown) {},
          connect: () => {
            events.push("source.connect");
          },
          start: (when?: number) => {
            events.push(`source.start:${when ?? "now"}`);
          },
        };
      }

      createGain() {
        events.push("createGain");
        return {
          gain: {
            setValueAtTime: (value: number, time: number) => {
              events.push(`gain.setValueAtTime:${value}:${time}`);
            },
          },
          connect: () => {
            events.push("gain.connect");
          },
          disconnect: () => {
            events.push("gain.disconnect");
          },
        };
      }

      resume() {
        events.push("resume");
        return new Promise<void>((resolve) => {
          window.__resolveAudioResume = () => {
            this.state = "running";
            events.push("resume.resolved");
            resolve();
          };
        });
      }

      close() {
        events.push("close");
        return Promise.resolve();
      }
    }

    window.__audioEvents = events;
    window.__resolveAudioResume = undefined;
    window.AudioContext =
      MockAudioContext as unknown as typeof window.AudioContext;
    window.webkitAudioContext =
      MockAudioContext as unknown as typeof window.AudioContext;
  });
}

test("メトロノームON時にresume完了後へ初回クリック予約順序を固定する", async ({
  page,
}) => {
  await installAudioContextMock(page);

  await page.goto("/mogumogu-walk");
  await page.getByRole("button", { name: /OFF/ }).tap();

  await expect
    .poll(() => page.evaluate(() => window.__audioEvents))
    .toContain("resume");
  await expect
    .poll(() =>
      page.evaluate(() =>
        window.__audioEvents.some((event) => event.startsWith("source.start")),
      ),
    )
    .toBe(false);

  await page.evaluate(() => window.__resolveAudioResume?.());

  const events = await page.waitForFunction(() => {
    const audioEvents = window.__audioEvents ?? [];
    return audioEvents.some((event) => event.startsWith("source.start"))
      ? audioEvents
      : undefined;
  });
  const audioEvents = await events.jsonValue();

  const firstStartIndex = audioEvents.findIndex((event) =>
    event.startsWith("source.start"),
  );
  const resumeResolvedIndex = audioEvents.indexOf("resume.resolved");

  expect(firstStartIndex).toBeGreaterThanOrEqual(0);
  expect(resumeResolvedIndex).toBeGreaterThanOrEqual(0);
  expect(firstStartIndex).toBeGreaterThan(resumeResolvedIndex);
  await expect(page.getByRole("button", { name: /ON/ })).toBeVisible();
});

test("resume完了後もメトロノームON状態を維持できる", async ({ page }) => {
  await installAudioContextMock(page);

  await page.goto("/mogumogu-walk");
  await page.getByRole("button", { name: /OFF/ }).tap();

  await page.evaluate(() => window.__resolveAudioResume?.());

  await expect(page.getByRole("button", { name: /ON/ })).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => window.__audioEvents))
    .toContain("resume.resolved");
});
