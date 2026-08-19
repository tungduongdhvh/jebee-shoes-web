// /api/tra-cuu?sdt=09xxxxxxxx — Tra cuu don hang theo SO DIEN THOAI (lay trang thai + van don tu POS).
// AN TOAN: chi tra don KHOP DUNG SDT nhap vao; khong tra ten/dia chi day du.
export default async function handler(req, res) {
  const key = process.env.POS_API_KEY, shop = process.env.POS_SHOP_ID;
  if (!key || !shop) return res.status(500).json({ ok: false, error: "Thieu cau hinh POS" });
  const raw = ((req.query && req.query.sdt) || (req.body && req.body.sdt) || "").toString();
  const sdt = raw.replace(/\D/g, "");
  if (!/^0\d{8,10}$/.test(sdt)) return res.status(400).json({ ok: false, error: "So dien thoai chua dung" });
  const base = "https://pos.pancake.vn/api/v1/shops/" + shop;
  const norm = function (s) { return (s || "").toString().replace(/\D/g, ""); };
  const imgUrl = function (im) { if (!im) return null; if (typeof im === "string") return im; return im.url || im.image_url || null; };

  try {
    // Pancake ho tro tim theo tu khoa (SDT) qua ?search=
    const url = base + "/orders?api_key=" + encodeURIComponent(key) + "&page_size=30&page=1&search=" + encodeURIComponent(sdt);
    const r = await fetch(url);
    if (!r.ok) return res.status(r.status).json({ ok: false, error: "POS " + r.status });
    const j = await r.json();
    let list = (j && (j.data || j.orders || j.entries)) || [];

    // Loc chinh xac theo SDT (an toan)
    list = list.filter(function (o) {
      return norm(o.bill_phone_number) === sdt
        || (o.shipping_address && norm(o.shipping_address.phone_number) === sdt)
        || (o.customer && norm(o.customer.phone_number) === sdt);
    });

    // Moi nhat len truoc
    list.sort(function (a, b) { return new Date(b.inserted_at || 0) - new Date(a.inserted_at || 0); });

    const don = list.slice(0, 20).map(function (o) {
      const p = o.partner || {};
      const items = (o.items || o.order_items || []).map(function (it) {
        const vi = it.variation_info || {};
        return { ten: vi.name || vi.product_name || vi.product_display_id || "Sản phẩm", sl: it.quantity || 1, anh: imgUrl(vi.image || (vi.images && vi.images[0])) };
      });
      // hanh trinh (status_history) neu co
      let hanh_trinh = [];
      if (Array.isArray(o.status_history)) {
        hanh_trinh = o.status_history.map(function (h) {
          return { trang_thai: h.status_name || h.name || ("#" + h.status), luc: h.updated_at || h.inserted_at || h.time || null };
        }).filter(function (h) { return h.luc; });
      }
      return {
        madon: o.system_id || o.display_id || o.id,
        ngay: o.inserted_at,
        trang_thai: o.status_name || ("#" + o.status),
        status: o.status,
        tong: o.total_price || o.money_to_collect || o.cod || 0,
        cod: o.cod,
        thanh_toan: (o.cod > 0 ? "COD" : (o.prepaid > 0 || o.transfer_money > 0 ? "Đã/đang chuyển khoản" : "")),
        doi_tac_vc: p.partner_name || p.name || null,
        ma_van_don: o.extend_code || p.extend_code || null,
        tracking_link: o.tracking_link || null,
        du_kien_giao: o.estimate_delivery_date || null,
        so_luong: o.total_quantity || items.reduce(function (s, i) { return s + (i.sl || 0); }, 0),
        items: items,
        hanh_trinh: hanh_trinh
      };
    });

    res.setHeader("Cache-Control", "no-store");
    return res.status(200).json({ ok: true, so_don: don.length, don: don });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String((e && e.message) || e) });
  }
}
