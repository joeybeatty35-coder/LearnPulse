/**
 * LearnPulse — Privacy-First Client Tracking
 * File: /assets/js/track-client.js
 *
 * Sends minimal events to /api/track with:
 * - event type
 * - path
 * - title
 * - referrer (short)
 * - utm params (if present)
 *
 * Privacy-first:
 * - no cookies required
 * - no user PII
 * - uses localStorage only for a random anonymous session id (optional)
 *
 * How to use:
 * 1) Add this file to /assets/js/track-client.js
 * 2) Include on every page before </body>:
 *    <script src="/assets/js/track-client.js" defer></script>
 *
 * Optional:
 * - Add data-track="EVENT_NAME" to buttons/links to auto-track clicks.
 */

(function () {
  "use strict";

  const ENDPOINT = "/api/track";
  const STORAGE_KEY = "lp_sid"; // anonymous session id
  const MAX_REF_LEN = 180;

  // ----- Utilities -----
  function safeStr(x, max) {
    if (typeof x !== "string") return "";
    const s = x.trim();
    if (!s) return "";
    return s.length > max ? s.slice(0, max) : s;
  }

  function getUtm() {
    const p = new URLSearchParams(location.search);
    const utm = {
      source: safeStr(p.get("utm_source") || "", 80),
      medium: safeStr(p.get("utm_medium") || "", 80),
      campaign: safeStr(p.get("utm_campaign") || "", 120),
      content: safeStr(p.get("utm_content") || "", 120),
      term: safeStr(p.get("utm_term") || "", 120),
    };
    // drop empties
    Object.keys(utm).forEach(k => { if (!utm[k]) delete utm[k]; });
    return utm;
  }

  function getSessionId() {
    try {
      let sid = localStorage.getItem(STORAGE_KEY);
      if (!sid) {
        sid = "lp_" + Math.random().toString(16).slice(2) + "_" + Date.now().toString(16);
        localStorage.setItem(STORAGE_KEY, sid);
      }
      return sid;
    } catch {
      return "";
    }
  }

  function send(payload) {
    try {
      // Don’t block UI. If fetch fails, silently ignore.
      fetch(ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        keepalive: true,
        body: JSON.stringify(payload),
      }).catch(() => {});
    } catch {
      // ignore
    }
  }

  // ----- Core event wrapper -----
  function track(eventName, meta) {
    const payload = {
      event: safeStr(eventName || "event", 60),
      path: safeStr(location.pathname || "/", 200),
      title: safeStr(document.title || "", 140),
      ref: safeStr(document.referrer || "", MAX_REF_LEN),
      utm: getUtm(),
      meta: Object.assign(
        {},
        meta && typeof meta === "object" ? meta : {},
        // anonymous session id only (NOT personal identity)
        { sid: safeStr(getSessionId(), 80) }
      ),
      ts: Date.now(),
    };

    // Remove empty objects for cleanliness
    if (!payload.ref) delete payload.ref;
    if (!payload.utm || Object.keys(payload.utm).length === 0) delete payload.utm;
    if (!payload.meta || Object.keys(payload.meta).length === 0) delete payload.meta;

    send(payload);
  }

  // ----- Auto: pageview -----
  function pageview() {
    track("pageview", {
      // Minimal useful signals (no PII)
      vw: Math.round(window.innerWidth || 0),
      vh: Math.round(window.innerHeight || 0),
    });
  }

  // ----- Auto: click tracking via data-track -----
  function bindClicks() {
    document.addEventListener("click", function (e) {
      const el = e.target && e.target.closest ? e.target.closest("[data-track]") : null;
      if (!el) return;

      const name = safeStr(el.getAttribute("data-track") || "click", 60);
      const href = safeStr(el.getAttribute("href") || "", 200);
      const text = safeStr((el.textContent || "").replace(/\s+/g, " "), 80);

      track(name, {
        href: href || undefined,
        text: text || undefined,
      });
    }, { passive: true });
  }

  // ----- Auto: scroll depth (25/50/75/100) -----
  function bindScrollDepth() {
    let fired = { 25: false, 50: false, 75: false, 100: false };

    function getScrollPct() {
      const doc = document.documentElement;
      const scrollTop = (window.pageYOffset || doc.scrollTop || 0);
      const height = (doc.scrollHeight || 0) - (window.innerHeight || 0);
      if (height <= 0) return 100;
      return Math.min(100, Math.max(0, Math.round((scrollTop / height) * 100)));
    }

    function onScroll() {
      const pct = getScrollPct();
      const marks = [25, 50, 75, 100];
      for (const m of marks) {
        if (!fired[m] && pct >= m) {
          fired[m] = true;
          track("scroll_depth", { pct: m });
        }
      }
      // If fully fired, remove listener
      if (fired[25] && fired[50] && fired[75] && fired[100]) {
        window.removeEventListener("scroll", onScroll);
      }
    }

    window.addEventListener("scroll", onScroll, { passive: true });
  }

  // ----- Auto: outbound link click -----
  function bindOutbound() {
    document.addEventListener("click", function (e) {
      const a = e.target && e.target.closest ? e.target.closest("a[href]") : null;
      if (!a) return;

      const href = a.getAttribute("href") || "";
      if (!href) return;

      // Ignore same-page anchors
      if (href.startsWith("#")) return;

      // Detect outbound
      let url;
      try { url = new URL(href, location.href); } catch { return; }
      if (url.origin === location.origin) return;

      track("outbound_click", {
        to: safeStr(url.origin + url.pathname, 200),
      });
    }, { passive: true });
  }

  // ----- Run -----
  function init() {
    pageview();
    bindClicks();
    bindScrollDepth();
    bindOutbound();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  // Expose manual tracker if needed
  window.LearnPulseTrack = { track };
})();
```0