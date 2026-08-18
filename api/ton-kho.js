export default async function handler(req, res) {
  const key = process.env.POS_API_KEY;
  const shop = process.env.POS_SHOP_ID;
  if (!key || !shop) return res.status(500).json({ error: "Thieu POS_API_KEY hoac POS_SHOP_ID" });
  const bases = ["https://pos.pancake.vn/api/v1", "https://pos.pages.fm/api/v1"];
  const attempts = [];
  for (const base of bases) {
    try {
      const url = base + "/shops/" + shop + "/products?api_key=" + encodeURIComponent(key) + "&page=1&page_size=50";
      const r = await fetch(url);
      const text = await r.text();
      let j = null; try { j = JSON.parse(text); } catch (e) {}
      const list = (j && (j.data || j.products || j.entries)) || [];
      if (r.ok && Array.isArray(list) && list.length) {
        const first = list[0] || {};
        const variations = first.variations || first.product_variations || first.variants || [];
        const v0 = variations[0] || {};
        return res.status(200).json({
          ket_noi: "OK", base_dung: base, so_san_pham: list.length,
          product_keys: Object.keys(first), variation_keys: Object.keys(v0),
          ma_san_pham_dau: first.display_id || first.custom_id || first.id || null
        });
      }
      attempts.push({ base: base, status: r.status, message: (j && j.message) || text.slice(0, 150), keys: j ? Object.keys(j) : null });
    } catch (e) {
      attempts.push({ base: base, error: String((e && e.message) || e) });
    }
  }
  return res.status(200).json({ ket_noi: "CHUA_DUOC", attempts: attempts });
}
