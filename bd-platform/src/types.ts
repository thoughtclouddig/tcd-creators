// Shared contract every agent reads/writes through. Agents never call each other directly —
// they read prior agents' rows from the DB and write their own.

export interface Creator {
  id: number;
  name: string;
  brand: string | null;
  website: string | null;
  youtube_channel_id: string | null;
  youtube_handle: string | null;
  spotify_show_id: string | null;
  substack_url: string | null;
  x_handle: string | null;
  platform_links_json: string;
  topics_json: string;
  political_alignment: string | null;
  followers: number | null;
  subscribers: number | null;
  avg_views: number | null;
  growth_pct: number | null;
  source: string;
  // pg returns TIMESTAMPTZ columns as Date objects, not strings.
  discovered_at: Date | string;
  updated_at: Date | string;
}

export interface CreatorSeed {
  name: string;
  brand?: string;
  website?: string;
  youtube_channel_id?: string;
  youtube_handle?: string;
  spotify_show_id?: string;
  substack_url?: string;
  x_handle?: string;
  topics?: string[];
  political_alignment?: string;
}

export type AuditAgent =
  | "website"
  | "ownership"
  | "merch"
  | "monetization"
  | "community"
  | "ai_opportunity"
  | "topfan";

export interface AuditFinding {
  label: string;
  detail: string;
}

export interface AuditRecommendation {
  title: string;
  detail: string;
  estimated_impact?: string;
}

export interface AuditResult {
  agent: AuditAgent;
  score: number; // 0-100
  grade?: string; // A-F, website only
  summary: string;
  findings: AuditFinding[];
  recommendations: AuditRecommendation[];
  estimated_value_usd?: number;
  raw?: Record<string, unknown>;
}

export interface OpportunityBreakdown {
  audience_size: number;
  growth: number;
  audience_loyalty: number;
  infrastructure_quality: number;
  merch: number;
  ownership: number;
  community: number;
  website: number;
  ai_opportunity: number;
  topfan_fit: number;
}

export interface WebsiteContext {
  html: string | null;
  fetch_error?: string;
  finalUrl?: string;
}
