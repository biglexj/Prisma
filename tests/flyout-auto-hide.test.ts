import { describe, expect, test } from "bun:test";
import { createFlyoutAutoHide } from "../src/features/playback/services/flyoutAutoHide";

function fixture() {
  let now = 0;
  let sequence = 0;
  let held = false;
  let hidden = 0;
  const timers = new Map<number, { at: number; callback: () => void }>();
  const flyout = createFlyoutAutoHide({
    duration: () => 1000,
    isHeld: () => held,
    hide: () => { hidden++; },
    schedule: (callback, delay) => {
      const id = ++sequence;
      timers.set(id, { at: now + delay, callback });
      return id;
    },
    cancel: (id) => { timers.delete(id); },
  });
  const advance = (duration: number) => {
    const end = now + duration;
    while (true) {
      const next = [...timers.entries()].sort((a, b) => a[1].at - b[1].at)[0];
      if (!next || next[1].at > end) break;
      now = next[1].at;
      timers.delete(next[0]);
      next[1].callback();
    }
    now = end;
  };
  return { flyout, advance, hold: (value: boolean) => { held = value; }, hidden: () => hidden };
}

describe("flyout auto hide", () => {
  test("hides exactly one second after presentation", () => {
    const f = fixture();
    f.flyout.shown();
    f.advance(999);
    expect(f.hidden()).toBe(0);
    f.advance(1);
    expect(f.hidden()).toBe(1);
    f.advance(3000);
    expect(f.hidden()).toBe(1);
  });

  test("new volume key activity gets a fresh second", () => {
    const f = fixture();
    f.flyout.shown();
    f.advance(800);
    f.flyout.shown();
    f.advance(999);
    expect(f.hidden()).toBe(0);
    f.advance(1);
    expect(f.hidden()).toBe(1);
  });

  test("interacting with controls extends the deadline", () => {
    const f = fixture();
    f.flyout.shown();
    f.advance(800);
    f.flyout.activity();
    f.advance(999);
    expect(f.hidden()).toBe(0);
    f.advance(1);
    expect(f.hidden()).toBe(1);
  });

  test("rechecks hover or pin at expiry and recovers even without a leave event", () => {
    const f = fixture();
    f.flyout.shown();
    f.hold(true);
    f.advance(2500);
    expect(f.hidden()).toBe(0);
    f.hold(false);
    f.advance(500);
    expect(f.hidden()).toBe(1);
  });

  test("leaving the panel waits one second before hiding", () => {
    const f = fixture();
    f.flyout.shown();
    f.hold(true);
    f.advance(2000);
    f.hold(false);
    f.flyout.activity();
    f.advance(999);
    expect(f.hidden()).toBe(0);
    f.advance(1);
    expect(f.hidden()).toBe(1);
  });

  test("hidden windows cancel the deadline and only reopen on presentation", () => {
    const f = fixture();
    f.flyout.shown();
    f.advance(800);
    f.flyout.hidden();
    f.flyout.activity();
    f.advance(2000);
    expect(f.hidden()).toBe(0);
    f.flyout.shown();
    f.advance(1000);
    expect(f.hidden()).toBe(1);
  });
});
