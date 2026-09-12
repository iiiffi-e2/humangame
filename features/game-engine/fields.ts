'use client';

import dynamic from 'next/dynamic';
import type { AnyGameComponent } from './EventShell';

/**
 * Play fields, one per family, loaded on demand.
 *
 * A run only ever needs five of the fifteen, and never more than one at a
 * time, so each family is its own chunk. The shell is already on screen while
 * the next field loads, which keeps the transition from feeling like a page
 * change.
 */
export const GAME_FIELDS: Readonly<Record<string, AnyGameComponent>> = {
  'nerve.dead-stop': dynamic(
    () => import('@/features/games/nerve/fields').then((module) => module.DeadStopField),
    { ssr: false },
  ),
  'nerve.crosshair': dynamic(
    () => import('@/features/games/nerve/fields').then((module) => module.CrosshairField),
    { ssr: false },
  ),
  'nerve.grow': dynamic(
    () => import('@/features/games/nerve/fields').then((module) => module.GrowField),
    { ssr: false },
  ),
  'eye.half': dynamic(
    () => import('@/features/games/eye/fields').then((module) => module.HalfField),
    { ssr: false },
  ),
  'eye.percent': dynamic(
    () => import('@/features/games/eye/fields').then((module) => module.PercentField),
    { ssr: false },
  ),
  'eye.angle': dynamic(
    () => import('@/features/games/eye/fields').then((module) => module.AngleField),
    { ssr: false },
  ),
  'memory.flash-grid': dynamic(
    () => import('@/features/games/memory/fields').then((module) => module.FlashGridField),
    { ssr: false },
  ),
  'memory.what-moved': dynamic(
    () => import('@/features/games/memory/fields').then((module) => module.WhatMovedField),
    { ssr: false },
  ),
  'memory.sequence': dynamic(
    () => import('@/features/games/memory/fields').then((module) => module.SequenceField),
    { ssr: false },
  ),
  'brain.order': dynamic(
    () => import('@/features/games/brain/fields').then((module) => module.OrderField),
    { ssr: false },
  ),
  'brain.next': dynamic(
    () => import('@/features/games/brain/fields').then((module) => module.NextField),
    { ssr: false },
  ),
  'brain.rotate': dynamic(
    () => import('@/features/games/brain/fields').then((module) => module.RotateField),
    { ssr: false },
  ),
  'crowd.majority': dynamic(
    () => import('@/features/games/crowd/fields').then((module) => module.MajorityField),
    { ssr: false },
  ),
  'crowd.split': dynamic(
    () => import('@/features/games/crowd/fields').then((module) => module.SplitField),
    { ssr: false },
  ),
  'crowd.avoid': dynamic(
    () => import('@/features/games/crowd/fields').then((module) => module.AvoidField),
    { ssr: false },
  ),
};
