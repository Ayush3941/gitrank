"use client";

import { animate, motion, useMotionValue, useReducedMotion } from "motion/react";
import { useEffect, useState } from "react";

export function AnimatedNumber({
  value,
  prefix = "",
}: {
  value: number;
  prefix?: string;
}) {
  const reducedMotion = useReducedMotion();
  const motionValue = useMotionValue(value);
  const [display, setDisplay] = useState(value);
  const shownValue = reducedMotion ? value : display;

  useEffect(() => {
    if (reducedMotion) {
      return;
    }

    const controls = animate(motionValue, value, {
      duration: 0.8,
      ease: "easeOut",
      onUpdate: (latest) => setDisplay(Math.round(latest)),
    });

    return () => controls.stop();
  }, [motionValue, reducedMotion, value]);

  return <motion.span>{prefix}{shownValue.toLocaleString("en-US")}</motion.span>;
}
