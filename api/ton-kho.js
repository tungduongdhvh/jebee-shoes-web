// /api/ton-kho - Ban TEST dau noi Pancake POS.
// Chi tra ve cau truc (ten field, so luong) de xac nhan ket noi.
export default async function handler(req, res) {
  const key = process.env.POS_API_KEY;
  const shop = process.env.POS_SHOP_ID;
  if (!key || !shop) {
    return res.status(500).json({ error: "Thieu POS_API_KEY hoac POS_SHOP_ID" });
  }
  const bases = ["https://pos.pages.fm/api/v1", "https://pos.pancake.vn/api/v1"];
  let lastStatus = null, lastRaw = null;
  for (const base of bases) {
    try {
      const url = base + "/shops/" + shop + "/products?api_key=" + encodeURIComponent(key) + "&page=1&page_size=50";
      const r = await fetch(url);
      lastStatus = r.status;
      const text = await r.text();
      let j = null;
      try { j = JSON.parse(text); } catch (e) { j = null; }
      if (!j) { lastRaw = text.slice(0, 200); continue; }
      const list = j.data || j.products || j.entries || [];
      const first = (Array.isArray(list) && list[0]) || {};
      const variations = first.variations || first.product_variations || first.variants || [];
      const v0 = (Array.isArray(variations) && variations[0]) || {};
      return res.status(200).json({
        ket_noi: "OK",
        base_dung: base,
        http_status: r.status,
        top_keys: Object.keys(j),
        so_san_pham: Array.isArray(list) ? list.length : 0,
        product_keys: Object.keys(first),
        variation_keys: Object.keys(v0),
        ma_san_pham_dau: first.display_id || first.custom_id || first.id || null
      });
    } catch (e) {
      lastRaw = String((e && e.message) || e);
    }
  }
  return res.status(502).json({ ket_noi: "LOI", http_status: lastStatus, chi_tiet: lastRaw });
}
