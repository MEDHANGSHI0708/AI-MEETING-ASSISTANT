"use client";

import { useEffect, useRef, useState } from "react";

const DEFAULT_MAX_HEIGHT_PX = 200;

// Shared engine behind every pill<->rounded-rectangle composer in the app.
// See meeting-input-bar.tsx's original history for why each step exists —
// in short: height and border-radius must be driven by real, matching-unit
// pixel values set together in one synchronous write, or the shape visibly
// desyncs from the size (grows, then remembers to un-pill itself).
export function useAutoGrowComposer(maxHeightPx: number = DEFAULT_MAX_HEIGHT_PX) {
  const [expanded, setExpanded] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const singleLineHeight = useRef(0);
  const rectRadiusPx = useRef(18);

  useEffect(() => {
    const el = textareaRef.current;
    const form = formRef.current;
    if (!el || !form) return;
    singleLineHeight.current = el.scrollHeight;

    // Resolve --radius-2xl to a real pixel number on a throwaway, transition-free
    // element — reading the real form here would race its own active transition
    // and catch a mid-flight value instead of the resolved target.
    const probe = document.createElement("div");
    probe.style.position = "fixed";
    probe.style.visibility = "hidden";
    probe.style.borderRadius = "var(--radius-2xl)";
    document.body.appendChild(probe);
    rectRadiusPx.current = parseFloat(getComputedStyle(probe).borderRadius) || 18;
    document.body.removeChild(probe);

    form.style.borderRadius = `${singleLineHeight.current / 2}px`;
  }, []);

  function applySize(heightPx: number) {
    const el = textareaRef.current;
    const form = formRef.current;
    if (!el || !form) return;
    const isExpanded = heightPx > singleLineHeight.current + 1;
    const clampedHeight = Math.min(heightPx, maxHeightPx);
    el.style.overflowY = heightPx >= maxHeightPx ? "auto" : "hidden";
    el.style.height = `${clampedHeight}px`;
    form.style.borderRadius = isExpanded
      ? `${rectRadiusPx.current}px`
      : `${clampedHeight / 2}px`;
    setExpanded(isExpanded);
  }

  function resize() {
    const el = textareaRef.current;
    if (!el) return;
    const oldHeight = el.getBoundingClientRect().height;
    const prevTransition = el.style.transition;
    el.style.transition = "none";
    el.style.height = "auto";
    const natural = el.scrollHeight;
    el.style.height = `${oldHeight}px`;
    el.getBoundingClientRect(); // force commit of oldHeight before re-enabling the transition
    el.style.transition = prevTransition;
    applySize(natural);
  }

  // Animate back to the resting single-line size, e.g. after a message sends.
  function collapse() {
    requestAnimationFrame(() => applySize(singleLineHeight.current));
  }

  return { formRef, textareaRef, expanded, resize, collapse, maxHeightPx };
}
