import 'server-only';
import { createStore } from './factory';
import type { DataStore } from './types';

/** The process-wide data store. Server-side callers only. */
export function getStore(): DataStore {
  return createStore();
}

export type { DataStore } from './types';
