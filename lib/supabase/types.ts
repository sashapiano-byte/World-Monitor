/**
 * Hand-authored Database types mirroring supabase/migrations/*.sql.
 * Regenerate with `supabase gen types typescript` once the project is linked;
 * kept manual here so the scaffold typechecks before a live project exists.
 */
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface ConflictRow {
  id: string;
  slug: string;
  name: string;
  summary: string | null;
  status: 'active' | 'frozen' | 'monitoring' | 'archived';
  start_date: string | null;
  center_lng: number;
  center_lat: number;
  default_zoom: number;
  bbox: number[] | null;
  region: string | null;
  display_order: number;
  is_featured: boolean;
  metadata: Json;
  created_at: string;
  updated_at: string;
}

export interface ConflictLayerRow {
  id: string;
  conflict_id: string;
  key: string;
  name: string;
  description: string | null;
  adapter_key: string;
  layer_type:
    | 'geojson' | 'point' | 'heatmap' | 'line' | 'fill' | 'raster' | 'vector' | 'symbol';
  source_name: string;
  source_url: string | null;
  attribution: string;
  license: string;
  license_url: string | null;
  style: Json;
  config: Json;
  refresh_interval_seconds: number;
  z_index: number;
  enabled: boolean;
  default_visible: boolean;
  last_ingested_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface LayerFeatureRow {
  id: string;
  layer_id: string;
  external_id: string;
  geom: Json;
  event_date: string | null;
  title: string | null;
  properties: Json;
  ingested_at: string;
}

export interface CameraRow {
  id: string;
  conflict_id: string | null;
  title: string;
  description: string | null;
  provider: 'youtube' | 'other';
  stream_type: 'youtube_live' | 'hls' | 'mjpeg' | 'rtsp' | 'webpage';
  external_id: string | null;
  url: string;
  embed_url: string | null;
  lng: number;
  lat: number;
  geom: Json;
  location_name: string | null;
  city: string | null;
  country: string | null;
  tags: string[];
  is_live: boolean;
  status: 'active' | 'offline' | 'unverified' | 'removed';
  tos_reviewed: boolean;
  last_checked_at: string | null;
  metadata: Json;
  created_at: string;
  updated_at: string;
}

export interface MarketRow {
  id: string;
  conflict_id: string | null;
  provider: 'polymarket' | 'kalshi';
  external_id: string;
  question: string;
  url: string | null;
  status: 'open' | 'closed' | 'resolved';
  metadata: Json;
  created_at: string;
  updated_at: string;
}

export interface MarketSnapshotRow {
  id: string;
  market_id: string;
  outcome: string;
  probability: number;
  volume: number | null;
  captured_at: string;
}

type Table<Row> = {
  Row: Row;
  Insert: Partial<Row>;
  Update: Partial<Row>;
  Relationships: [];
};

export interface Database {
  public: {
    Tables: {
      conflicts: Table<ConflictRow>;
      conflict_layers: Table<ConflictLayerRow>;
      layer_features: Table<LayerFeatureRow>;
      cameras: Table<CameraRow>;
      markets: Table<MarketRow>;
      market_snapshots: Table<MarketSnapshotRow>;
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
