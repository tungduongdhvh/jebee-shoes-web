export default async function handler(req, res) {
  const key = process.env.POS_API_KEY;
  if (!key) return res.status(500).json({ error: "Thieu POS_API_KEY" });
  const out = { shop_env: process.env.POS_SHOP_ID || null, key_len: key.length };
  const bases = ["https://pos.pancake.vn/api/v1", "https://pos.pages.fm/api/v1"];
  for (const base of bases) {
    try {
      const r = await fetch(base + "/shops?api_key=" + encodeURIComponent(key));
      const t = await r.text();
      let j = null; try { j = JSON.parse(t); } catch (e) {}
      const shops = (j && (j.data || j.shops)) || [];
      out[base] = {
        status: r.status,
        message: j && j.message,
        shops: Array.isArray(shops) ? shops.map(function(s){ return { id: s.id, name: s.name }; }) : shops
      };
    } catch (e) { out[base] = { error: String((e && e.message) || e) }; }
  }
  return res.status(200).json(out);
}
