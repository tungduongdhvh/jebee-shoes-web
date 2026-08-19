// /api/dat-hang — Tao don hang vao Pancake POS.
// GET  ?peek=1 : doc cau truc 1 don gan nhat (AN TOAN: chi tra TEN field, khong tra gia tri PII).
// POST body: { khach:{ten,sdt,diachi,ghichu}, thanhtoan:"cod"|"ck", items:[{variation_id,ma,ten,mau,size,gia,qty}], tong }
export default async function handler(req, res) {
  const key = process.env.POS_API_KEY, shop = process.env.POS_SHOP_ID;
  if (!key || !shop) return res.status(500).json({ ok: false, error: "Thieu cau hinh POS" });
  const base = "https://pos.pancake.vn/api/v1/shops/" + shop;

  // ----- GET: doc thu cau truc don (an toan) -----
  if (req.method === "GET") {
    try {
      const r = await fetch(base + "/orders?api_key=" + encodeURIComponent(key) + "&page_size=1&page=1");
      const text = await r.text();
      let j = null; try { j = JSON.parse(text); } catch (e) {}
      const list = (j && (j.data || j.orders || j.entries)) || [];
      const src = {};
      list.forEach(function (o) { var n = (o.order_sources_name || o.order_sources || "?"); src[n] = (src[n] || 0) + 1; });
      const o = list[0] || {};
      const it = (o.items || o.order_items || o.products || [])[0] || {};
      const vi = it.variation_info || {};
      return res.status(200).json({
        http_status: r.status,
        nguon_don_gan_day: src,
        don0: {
          order_sources: o.order_sources, order_sources_name: o.order_sources_name,
          warehouse_id: o.warehouse_id, total_price: o.total_price, cod: o.cod, status: o.status,
          bill_full_name: o.bill_full_name ? "(co)" : null
        },
        item0: {
          variation_id: it.variation_id, quantity: it.quantity,
          discount_each_product: it.discount_each_product, total_discount: it.total_discount,
          is_discount_percent: it.is_discount_percent,
          variation_info_keys: Object.keys(vi),
          vi_retail_price: vi.retail_price, vi_price: vi.price
        },
        raw: j ? undefined : text.slice(0, 200)
      });
    } catch (e) { return res.status(500).json({ ok: false, error: String((e && e.message) || e) }); }
  }

  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "Method not allowed" });

  // ----- POST: tao don -----
  try {
    const b = req.body || {};
    const k = b.khach || {};
    if (!k.ten || !k.sdt || !k.diachi) return res.status(400).json({ ok: false, error: "Thieu thong tin khach" });
    const items = (b.items || []).filter(function (x) { return x.variation_id; }).map(function (x) {
      // ep GIA WEB vao tung dong hang (retail_price) de COD = gia bang gia, khong lay gia POS
      return { variation_id: x.variation_id, quantity: x.qty || 1, retail_price: x.gia || 0 };
    });
    if (!items.length) return res.status(400).json({ ok: false, error: "Gio hang trong hoac thieu ma bien the" });

    const pay = b.thanhtoan === "ck" ? "Chuyen khoan (QR)" : "COD";
    const dong = (b.items || []).map(function (x) { return (x.ma || "") + " " + (x.mau || "") + " sz" + (x.size || "") + " x" + x.qty; }).join("; ");
    const note = "[WEB jebeeshoes.vn] TT:" + pay + " | " + k.ten + " | " + k.sdt + " | " + k.diachi
      + (k.ghichu ? " | Ghi chu: " + k.ghichu : "") + " | " + dong + " | Tong ~" + (b.tong || 0);

    const payload = {
      items: items,
      note: note,
      status: 0,
      order_sources: -3,          // nguon don = Website/API
      is_free_shipping: true,
      shipping_address: { full_name: k.ten, phone_number: k.sdt, address: k.diachi },
      bill_full_name: k.ten,
      bill_phone_number: k.sdt,
      customer: { name: k.ten, phone_number: k.sdt }
    };

    const r = await fetch(base + "/orders?api_key=" + encodeURIComponent(key), {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload)
    });
    const text = await r.text();
    let j = null; try { j = JSON.parse(text); } catch (e) {}
    if (!r.ok || (j && j.success === false)) {
      return res.status(200).json({ ok: false, error: (j && (j.message || j.error)) || ("POS " + r.status), raw: (j ? undefined : text.slice(0, 300)) });
    }
    const od = (j && (j.data || j.order || j)) || {};
    return res.status(200).json({ ok: true, madon: od.display_id || od.system_id || od.id || "", status: od.status });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String((e && e.message) || e) });
  }
}
