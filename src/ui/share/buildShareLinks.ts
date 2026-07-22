export type ShareContent = {
  /** Absolute URL of the page being shared. */
  url: string;
  /** Used as the email subject and (by the caller) the OS share-sheet title. */
  title: string;
  /** Share message body. Callers own D10 compliance for this string — see each call site's comment. */
  text: string;
};

export type ShareLinks = {
  whatsapp: string;
  telegram: string;
  linkedin: string;
  email: string;
};

/**
 * Builds plain share-intent URLs for the four supported networks (D10/task
 * brief: WhatsApp, Telegram, LinkedIn, email — X/Twitter deliberately
 * excluded). Pure and framework-free: no network request is made by this
 * function, no third-party script is involved — every value returned here
 * is just a string handed to a plain `<a href>`, so nothing fires until the
 * visitor clicks it.
 */
export function buildShareLinks({ url, title, text }: ShareContent): ShareLinks {
  const encodedUrl = encodeURIComponent(url);
  const encodedText = encodeURIComponent(text);
  const encodedTitle = encodeURIComponent(title);

  return {
    // wa.me's share intent has a single `text` param — WhatsApp itself
    // renders the trailing URL as the link preview, so text and url are
    // concatenated with a space rather than passed separately.
    whatsapp: `https://wa.me/?text=${encodeURIComponent(`${text} ${url}`)}`,
    telegram: `https://t.me/share/url?url=${encodedUrl}&text=${encodedText}`,
    // LinkedIn's current share-offsite endpoint only accepts `url` — any
    // summary/title param is ignored and LinkedIn derives its own preview
    // from the page's Open Graph tags instead.
    linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`,
    email: `mailto:?subject=${encodedTitle}&body=${encodeURIComponent(`${text}\n\n${url}`)}`,
  };
}
