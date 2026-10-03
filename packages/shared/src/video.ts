/**
 * Turning a pasted video link into an embed, in one place.
 *
 * The API validates what an editor saves and the site decides what to render,
 * and the two have to agree. When they did not, a link the API accepted but
 * the player could not parse — a channel page, a playlist, a /live/ URL —
 * saved without complaint and then rendered nothing at all, with no error
 * anywhere. Silence is the worst possible answer to "why is my video not
 * showing".
 *
 * So the rule lives here: the API refuses anything this cannot parse, which
 * means anything saved is something the player can show.
 *
 * The embed URL is always rebuilt from the extracted id and never from the
 * string that was pasted. That is what keeps an arbitrary origin out of an
 * iframe on the public site.
 */

export interface VideoEmbed {
  /** Ready to use as an iframe src. */
  src: string;
  /** For the iframe's accessible name. */
  title: string;
  provider: 'youtube' | 'vimeo';
  id: string;
}

/** Standard YouTube ids are 11 characters; the range allows for change. */
const YOUTUBE_ID = /^[\w-]{6,20}$/;
const VIMEO_ID = /^\d{6,12}$/;

export function parseVideoEmbed(
  url: string | null | undefined,
  options: { autoplay?: boolean } = {},
): VideoEmbed | null {
  if (!url?.trim()) return null;

  let parsed: URL;
  try {
    parsed = new URL(url.trim());
  } catch {
    return null;
  }
  // http:// would make the embed mixed content on an https site, which
  // browsers block outright.
  if (parsed.protocol !== 'https:') return null;

  const host = parsed.hostname.replace(/^(www|m)\./, '');
  const segments = parsed.pathname.split('/').filter(Boolean);
  const autoplay = options.autoplay ? '1' : '0';

  if (host === 'youtu.be' || host === 'youtube.com' || host === 'youtube-nocookie.com') {
    const id =
      host === 'youtu.be'
        ? segments[0]
        : (parsed.searchParams.get('v') ??
          (['embed', 'shorts', 'live', 'v'].includes(segments[0] ?? '') ? segments[1] : undefined));

    if (!id || !YOUTUBE_ID.test(id)) return null;
    return {
      // nocookie: no tracking cookie is set until the visitor presses play.
      src: `https://www.youtube-nocookie.com/embed/${id}?autoplay=${autoplay}&rel=0&modestbranding=1`,
      title: 'YouTube video',
      provider: 'youtube',
      id,
    };
  }

  if (host === 'vimeo.com' || host === 'player.vimeo.com') {
    // player.vimeo.com/video/<id> and vimeo.com/<id> both end in the id.
    const id = segments[segments.length - 1];
    if (!id || !VIMEO_ID.test(id)) return null;
    return {
      src: `https://player.vimeo.com/video/${id}?autoplay=${autoplay}`,
      title: 'Vimeo video',
      provider: 'vimeo',
      id,
    };
  }

  return null;
}

/** What to tell an editor whose link was refused. */
export const VIDEO_URL_HELP =
  'Nije prepoznat link ka snimku. Nalepite adresu pojedinačnog videa sa ' +
  'YouTube-a ili Vimea — na primer https://www.youtube.com/watch?v=XXXXXXXXXXX ' +
  'ili https://vimeo.com/123456789. Linkovi ka kanalu ili plejlisti ne rade.';
