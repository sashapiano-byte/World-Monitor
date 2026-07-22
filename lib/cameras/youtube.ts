/**
 * YouTube-Live helpers for the camera layer.
 *
 * ToS posture (see docs/camera-tos-review.md): we ONLY ever surface public
 * YouTube-Live streams through YouTube's own official iframe player embed. We
 * never proxy, re-host, download, or scrape the video — the bytes are served by
 * YouTube to the viewer exactly as they would be on youtube.com, so YouTube's
 * ads/branding/attribution are preserved. That is the sanctioned embedding path
 * and is why `provider = 'youtube'` rows are public-visible without a separate
 * ToS review, unlike `provider = 'other'` sources.
 *
 * Two id shapes are supported:
 *   - a specific live VIDEO id (rotates whenever the operator restarts a stream)
 *   - a CHANNEL id, embedded via `.../embed/live_stream?channel=<id>`, which
 *     always resolves to whatever that channel is currently live-streaming. The
 *     channel form is preferred for 24/7 webcam operators because it survives
 *     video-id rotation.
 */

const WATCH_BASE = 'https://www.youtube.com/watch';
const EMBED_BASE = 'https://www.youtube.com/embed';
const CHANNEL_BASE = 'https://www.youtube.com/channel';
const OEMBED_BASE = 'https://www.youtube.com/oembed';

export type YouTubeIdType = 'video' | 'channel';

export interface YouTubeIdRef {
  type: YouTubeIdType;
  id: string;
}

export interface YouTubeEmbedOptions {
  /** Autoplay on load (muted is forced when autoplay is on — browser policy). */
  autoplay?: boolean;
  /** Start muted. Defaults to true so autoplay is allowed by browsers. */
  mute?: boolean;
  /** Origin for the postMessage security check (embedding page origin). */
  origin?: string;
}

/** Public watch URL for a specific live video. */
export function buildYouTubeWatchUrl(videoId: string): string {
  return `${WATCH_BASE}?v=${encodeURIComponent(videoId)}`;
}

/** Player iframe src for a specific live video. */
export function buildYouTubeEmbedUrl(
  videoId: string,
  opts: YouTubeEmbedOptions = {},
): string {
  return `${EMBED_BASE}/${encodeURIComponent(videoId)}${embedQuery(opts)}`;
}

/** Channel "/live" URL — redirects to the channel's current live stream. */
export function buildYouTubeChannelLiveUrl(channelId: string): string {
  return `${CHANNEL_BASE}/${encodeURIComponent(channelId)}/live`;
}

/**
 * Player iframe src that follows a channel's *current* live stream, immune to
 * video-id rotation. This is the preferred embed for always-on webcams.
 */
export function buildYouTubeChannelLiveEmbedUrl(
  channelId: string,
  opts: YouTubeEmbedOptions = {},
): string {
  const sep = '&';
  return `${EMBED_BASE}/live_stream?channel=${encodeURIComponent(channelId)}${embedQuery(opts, sep)}`;
}

/** Build a URL/embed pair from an id ref (used by seeding + verification). */
export function buildYouTubeUrls(
  ref: YouTubeIdRef,
  opts?: YouTubeEmbedOptions,
): { url: string; embedUrl: string } {
  return ref.type === 'channel'
    ? {
        url: buildYouTubeChannelLiveUrl(ref.id),
        embedUrl: buildYouTubeChannelLiveEmbedUrl(ref.id, opts),
      }
    : {
        url: buildYouTubeWatchUrl(ref.id),
        embedUrl: buildYouTubeEmbedUrl(ref.id, opts),
      };
}

function embedQuery(opts: YouTubeEmbedOptions, leading = '?'): string {
  const params: string[] = [];
  const mute = opts.mute ?? true;
  if (opts.autoplay) params.push('autoplay=1');
  if (mute) params.push('mute=1');
  params.push('rel=0');
  params.push('playsinline=1');
  if (opts.origin) params.push(`origin=${encodeURIComponent(opts.origin)}`);
  if (params.length === 0) return '';
  return `${leading}${params.join('&')}`;
}

const VIDEO_ID_RE = /^[A-Za-z0-9_-]{11}$/;
const CHANNEL_ID_RE = /^UC[A-Za-z0-9_-]{22}$/;

/**
 * Best-effort id extraction from a YouTube URL (watch, youtu.be, /embed/,
 * /channel/, /embed/live_stream?channel=). Returns null for handle URLs
 * (`/@handle`) since those cannot be resolved to a channel id without a network
 * lookup — that is the verifier's job.
 */
export function extractYouTubeId(input: string): YouTubeIdRef | null {
  if (!input) return null;

  // Bare id?
  if (CHANNEL_ID_RE.test(input)) return { type: 'channel', id: input };
  if (VIDEO_ID_RE.test(input)) return { type: 'video', id: input };

  let u: URL;
  try {
    u = new URL(input);
  } catch {
    return null;
  }
  const host = u.hostname.replace(/^www\./, '');
  if (host === 'youtu.be') {
    const id = u.pathname.slice(1);
    return VIDEO_ID_RE.test(id) ? { type: 'video', id } : null;
  }
  if (host !== 'youtube.com' && host !== 'm.youtube.com') return null;

  const channelParam = u.searchParams.get('channel');
  if (channelParam && CHANNEL_ID_RE.test(channelParam)) {
    return { type: 'channel', id: channelParam };
  }
  const v = u.searchParams.get('v');
  if (v && VIDEO_ID_RE.test(v)) return { type: 'video', id: v };

  const parts = u.pathname.split('/').filter(Boolean);
  const channelIdx = parts.indexOf('channel');
  if (channelIdx >= 0 && parts[channelIdx + 1] && CHANNEL_ID_RE.test(parts[channelIdx + 1])) {
    return { type: 'channel', id: parts[channelIdx + 1] };
  }
  const embedIdx = parts.indexOf('embed');
  if (embedIdx >= 0 && parts[embedIdx + 1] && parts[embedIdx + 1] !== 'live_stream') {
    const id = parts[embedIdx + 1];
    return VIDEO_ID_RE.test(id) ? { type: 'video', id } : null;
  }
  return null;
}

export function isYouTubeUrl(input: string): boolean {
  try {
    const host = new URL(input).hostname.replace(/^www\./, '');
    return host === 'youtube.com' || host === 'm.youtube.com' || host === 'youtu.be';
  } catch {
    return false;
  }
}

/** Result of a liveness probe; feeds `is_live` / `status` / `last_checked_at`. */
export interface LivenessResult {
  isLive: boolean;
  /** Suggested value for the row's `status` column. */
  status: CameraStatusSuggestion;
  checkedAt: string;
  /** Human-readable reason, for logs / audit. */
  reason: string;
}

export type CameraStatusSuggestion = 'active' | 'offline' | 'unverified' | 'removed';

/**
 * STUB — mark a camera's liveness. Intentionally performs NO network I/O so the
 * build/test environment stays hermetic; it returns `unverified`. A real
 * implementation (run from a trusted server cron with outbound access) would:
 *
 *   1. YouTube oEmbed check — GET
 *        https://www.youtube.com/oembed?url=<watchUrl>&format=json
 *      A 200 with JSON means the video exists and is embeddable. A 401/404
 *      means removed/private → status 'removed' or 'offline'.
 *
 *   2. For channel-form cameras, resolve the current live video first by
 *      fetching the channel `/live` URL (follow redirect to `watch?v=<id>`),
 *      persist that video id, then oEmbed-check it. Absence of a live redirect
 *      means the channel is not currently streaming → status 'offline'.
 *
 *   3. Optionally a lightweight scrape of the watch page for the
 *      `"isLiveNow":true` / `"liveBroadcastDetails"` marker to distinguish a
 *      live broadcast from an on-demand upload → sets `is_live`.
 *
 * On success it would UPDATE cameras SET is_live, status='active',
 * last_checked_at=now() (service-role, bypassing RLS) so the row becomes
 * public-visible. This is the pass that flips the seeded 'unverified' catalog
 * into live cameras.
 *
 * @param _fetchImpl optional injected fetch, for the real implementation/tests.
 */
export async function verifyCameraLiveness(
  camera: { url: string; embedUrl: string | null; externalId: string | null; provider: string },
  _fetchImpl?: typeof fetch,
): Promise<LivenessResult> {
  const checkedAt = new Date().toISOString();
  // Non-YouTube sources are out of scope for this probe (they gate on manual
  // ToS review, not automated liveness).
  if (camera.provider !== 'youtube') {
    return {
      isLive: false,
      status: 'unverified',
      checkedAt,
      reason: 'non-youtube source — requires manual ToS review, not auto-probe',
    };
  }
  // No network in this environment: report unverified rather than guessing.
  return {
    isLive: false,
    status: 'unverified',
    checkedAt,
    reason: 'stub: oEmbed/liveness probe not executed (no outbound network in this context)',
  };
}
