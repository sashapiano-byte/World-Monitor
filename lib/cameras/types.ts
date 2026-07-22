/**
 * Camera types for the Frontline live-camera layer.
 *
 * `CameraRow` mirrors the `cameras` table in supabase/migrations/0001_core_schema.sql
 * (re-exported from the generated DB types so there is a single source of truth).
 * `ClientCamera` is the camelCased, view-model shape the UI consumes.
 */
import type { CameraRow } from '@/lib/supabase/types';

export type { CameraRow };

export type CameraProvider = CameraRow['provider']; // 'youtube' | 'other'
export type CameraStreamType = CameraRow['stream_type'];
export type CameraStatus = CameraRow['status'];

/** How a camera relates to the map: tied to a conflict, or a standalone city cam. */
export type CameraCategory = 'conflict' | 'city';

/**
 * Client-facing camera view-model. Every field the UI needs, camelCased, with a
 * couple of derived conveniences (`category`, `canEmbed`).
 */
export interface ClientCamera {
  id: string;
  conflictId: string | null;
  title: string;
  description: string | null;
  provider: CameraProvider;
  streamType: CameraStreamType;
  externalId: string | null;
  url: string;
  embedUrl: string | null;
  lng: number;
  lat: number;
  locationName: string | null;
  city: string | null;
  country: string | null;
  tags: string[];
  isLive: boolean;
  status: CameraStatus;
  tosReviewed: boolean;
  /** Derived: conflict-linked vs standalone city camera. */
  category: CameraCategory;
  /** Derived: whether we can safely drop this into an <iframe> right now. */
  canEmbed: boolean;
}

/** Minimal GeoJSON Feature shape for the map/API surface (no @types dependency). */
export interface CameraFeature {
  type: 'Feature';
  id: string;
  geometry: { type: 'Point'; coordinates: [number, number] };
  properties: Omit<ClientCamera, 'lng' | 'lat'>;
}

export interface CameraFeatureCollection {
  type: 'FeatureCollection';
  features: CameraFeature[];
}
