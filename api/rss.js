// api/rss.js  (Vercel Serverless Function)
export default async function handler(req, res) {
  try {
    const url = req.query.url;
    if (!url) return res.status(400).json({ error: "Missing ?url=" });

    const r = await fetch(url, { headers: { "User-Agent": "LearnPulse/1.0" } });
    if (!r.ok) return res.status(400).json({ error: "Fetch failed", status: r.status });

    const xml = await r.text();

    // Minimal RSS item parser (enough for most feeds)
    const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].slice(0, 10).map(m => m[1]);
    const out = items.map(it => ({
      title: (it.match(/<title><!\[CDATA\[([\s\S]*?)\]\]><\/title>/) || it.match(/<title>([\s\S]*?)<\/title>/) || [,""])[1]?.trim(),
      link:  (it.match(/<link>([\s\S]*?)<\/link>/) || [,""])[1]?.trim(),
      pubDate:(it.match(/<pubDate>([\s\S]*?)<\/pubDate>/) || [,""])[1]?.trim(),
      desc:  (it.match(/<description><!\[CDATA\[([\s\S]*?)\]\]><\/description>/) || it.match(/<description>([\s\S]*?)<\/description>/) || [,""])[1]
              ?.replace(/<[^>]+>/g,"").trim()
    })).filter(x => x.title && x.link);

    res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=600");
    return res.status(200).json({ items: out });
  } catch (e) {
    return res.status(500).json({ error: "Server error", detail: String(e) });
  }
}