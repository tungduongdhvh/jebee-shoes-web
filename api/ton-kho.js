// /api/ton-kho - doc san pham + ton kho tu POS (AN TOAN: khong in khoa/gia nhap).
export default async function handler(req, res) {
  const key = process.env.POS_API_KEY;
  const shop = process.env.POS_SHOP_ID;
  if (!key || !shop) return res.status(500).json({ error: "Thieu POS_API_KEY hoac POS_SHOP_ID" });
  try {
    const url = "https://pos.pancake.vn/api/v1/shops/" + shop + "/products?api_key=" + encodeURIComponent(key) + "&page=1&page_size=5";
    const r = await fetch(url);
    const j = await r.json();
    const list = (j && (j.data || j.products || j.entries)) || [];
    const first = list[0] || {};
    const vs = first.variations || first.product_variations || first.variants || [];
    const v0 = vs[0] || {};
    return res.status(200).json({
      status: r.status,
      so_san_pham: Array.isArray(list) ? list.length : 0,
      product_keys: Object.keys(first),
      variation_keys: Object.keys(v0),
      v0_fields: v0.fields || v0.variation_fields || v0.product_attributes || null,
      mau: list.slice(0, 5).map(function(p){
        return { ma: p.display_id || p.custom_id || p.id, ten: p.name, so_bien_the: (p.variations || p.product_variations || p.variants || []).length };
      })
    });
  } catch (e) {
    return res.status(500).json({ error: String((e && e.message) || e) });
  }
}
