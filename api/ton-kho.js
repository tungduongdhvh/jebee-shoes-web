// /api/ton-kho - CHAN DOAN AN TOAN (khong lo khoa/gia).
export default async function handler(req, res) {
  const key = process.env.POS_API_KEY || "";
  const shop = process.env.POS_SHOP_ID || "";
  const shopSafe = /^[0-9]{1,12}$/.test(shop) ? shop : ("NON_NUMERIC_len" + shop.length);
  const diag = { key_len: key.length, key_hex32: /^[0-9a-f]{32}$/i.test(key), key_ws: key.length !== key.trim().length, shop: shopSafe };
  if (!key || !shop) return res.status(500).json({ error: "Thieu env", diag });
  try {
    const url = "https://pos.pancake.vn/api/v1/shops/" + shop + "/products?api_key=" + encodeURIComponent(key) + "&page=1&page_size=3";
    const r = await fetch(url);
    const text = await r.text();
    let j = null; try { j = JSON.parse(text); } catch (e) {}
    const list = (j && (j.data || j.products || j.entries)) || [];
    return res.status(200).json({ diag, http_status: r.status, pos_message: (j && (j.message || j.error || j.detail)) || (j ? null : text.slice(0, 150)), so_san_pham: Array.isArray(list) ? list.length : 0 });
  } catch (e) { return res.status(500).json({ diag, error: String((e && e.message) || e) }); }
}
