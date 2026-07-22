'use client';

import type { Conflict } from '@/lib/data/conflicts';

/**
 * Phase 1C mount point — live camera layer (map markers + search/filter UI).
 * Scaffold stub; the camera subagent replaces this with the real component
 * that reads `cameras` (filtered by conflict / bbox) and renders YouTube-Live
 * embeds. Non-YouTube sources stay hidden until `tos_reviewed = true`.
 */
export default function CameraLayer(_props: { conflict: Conflict }) {
  return null;
}
