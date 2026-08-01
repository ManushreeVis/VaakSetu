"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Animated number counter that eases from 0 → target on mount and when the
 * target changes. Uses requestAnimationFrame with an ease-out cubic curve.
 *
 * Lint-clean: the only setState call inside the effect is the rAF-driven tick
 * (an event handler, not a direct call), and the "reset to 0" branch is done
 * via the derived initial state + a guard in the tick instead of setState(0).
 */
export const useCountUp = (target: number, durationMs = 900): number => {
  const [value, setValue] = useState(target);
  const prevTargetRef = useRef(target);

  useEffect(() => {
    if (target === prevTargetRef.current) return;
    prevTargetRef.current = target;
    if (target <= 0) return; // nothing to animate; render stays at last value until next change

    let raf = 0;
    const start = performance.now();
    const from = 0;
    const tick = (now: number) => {
      const elapsed = now - start;
      const t = Math.min(1, elapsed / durationMs);
      // ease-out cubic
      const eased = 1 - Math.pow(1 - t, 3);
      setValue(Math.round(from + (target - from) * eased));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, durationMs]);

  return target <= 0 ? 0 : value;
};
