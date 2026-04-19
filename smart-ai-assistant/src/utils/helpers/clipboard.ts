// ════════════════════════════════════════════════════════════
//  CLIPBOARD — Reusable copy-to-clipboard utility
//  Replaces duplicated copyToClipboard in 3+ files
// ════════════════════════════════════════════════════════════

/**
 * Copy text to clipboard with fallback for older browsers.
 * Returns true if successful, false otherwise.
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Fall through to fallback
  }

  // Fallback for browsers without clipboard API
  try {
    const el = document.createElement('textarea');
    el.value = text;
    el.setAttribute('readonly', '');
    el.style.position = 'absolute';
    el.style.left = '-9999px';
    document.body.appendChild(el);
    el.select();
    document.execCommand('copy');
    document.body.removeChild(el);
    return true;
  } catch {
    return false;
  }
}
