// /api/dat-hang — Tao don hang vao Pancake POS.
// GET  ?peek=1 : doc cau truc 1 don gan nhat (AN TOAN: chi tra TEN field, khong tra gia tri PII).
// POST body: { khach:{ten,sdt,diachi,ghichu}, thanhtoan:"cod"|"ck", items:[{variation_id,ma,ten,mau,size,gia,qty}], tong }
export default async function handler(req, res) {
  const key = process.env.POS_API_KEY, shop = process.env.POS_SHOP_ID;
  if (!key || !shop) return res.status(500).json({ ok: false, error: "Thieu cau hinh POS" });
  const base = "https://pos.pancake.vn/api/v1/shops/" + shop;
  const KURL = process.env.KV_REST_API_URL, KTOK = process.env.KV_REST_API_TOKEN;
  const normMa = function (s) { return (s || "").toString().toUpperCase().replace(/[^A-Z0-9]/g, ""); };

  // ----- GET: doc thu cau truc don (an toan) -----
  if (req.method === "GET") {
    // debug tam: liet ke nhan vien (de map nv-> user_id)
    if (req.query && req.query.users) {
      try {
        const r = await fetch(base + "/users?api_key=" + encodeURIComponent(key));
        const t = await r.text(); let j = null; try { j = JSON.parse(t); } catch (e) {}
        const list = (j && (j.data || j.users || j.entries)) || [];
        const nm = function (u) { const x = u.user || u; return x.name || x.full_name || x.display_name || x.fb_name || x.username || x.email || (x.user_id && x.user_id.name) || ""; };
        return res.status(200).json({ http: r.status, n: list.length, sample_keys: Object.keys(list[0] || {}), users: list.map(function (u) { return { id: u.id || (u.user && u.user.id), name: nm(u) }; }), raw: (j ? undefined : t.slice(0, 200)) });
      } catch (e) { return res.status(500).json({ error: String((e && e.message) || e) }); }
    }
    // debug tam: xem truong "phan cong" tren 1 don gan nhat
    if (req.query && req.query.assignkeys) {
      try {
        const r = await fetch(base + "/orders?api_key=" + encodeURIComponent(key) + "&page_size=1&page=1");
        const t = await r.text(); let j = null; try { j = JSON.parse(t); } catch (e) {}
        const o = ((j && (j.data || j.orders || j.entries)) || [])[0] || {};
        const asg = {};
        Object.keys(o).forEach(function (k) { if (/assign|seller|assignee|marketer|staff|creator|handler/i.test(k)) asg[k] = o[k]; });
        return res.status(200).json({ http: r.status, assign_fields: asg, all_keys: Object.keys(o) });
      } catch (e) { return res.status(500).json({ error: String((e && e.message) || e) }); }
    }
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
    // Pancake tinh gia dong hang = gia goc bien the (POS), chi cho GIAM (discount_each_product) hoac PHU THU (surcharge).
    // -> Neu gia web THAP hon POS: giam moi dong. Neu gia web CAO hon POS: cong phu thu don hang. => Tong = gia bang gia web.
    let surcharge = 0;
    const items = (b.items || []).filter(function (x) { return x.variation_id; }).map(function (x) {
      const web = x.gia || 0, pos = x.gia_pos || 0, qty = x.qty || 1;
      const disc = pos > web ? (pos - web) : 0;          // giam moi san pham khi web < POS
      if (web > pos && pos > 0) surcharge += (web - pos) * qty; // phu thu khi web > POS
      return { variation_id: x.variation_id, quantity: qty, discount_each_product: disc, is_discount_percent: false };
    });
    if (!items.length) return res.status(400).json({ ok: false, error: "Gio hang trong hoac thieu ma bien the" });

    const pay = b.thanhtoan === "ck" ? "Chuyen khoan (QR)" : "COD";
    const dong = (b.items || []).map(function (x) { return (x.ma || "") + " " + (x.mau || "") + " sz" + (x.size || "") + " x" + x.qty; }).join("; ");
    // NGUON don (nhan vien / page fb / chien dich) tu link quang cao
    var ngLine = " | NGUON: truc tiep/khong ro";
    try {
      const ng = b.nguon || {};
      const parts = [];
      ["nv", "page", "pg", "utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "fbclid"].forEach(function (kk) {
        if (ng[kk]) parts.push(kk + "=" + String(ng[kk]).replace(/[|]/g, "/").slice(0, 80));
      });
      if (parts.length) ngLine = " | NGUON: " + parts.join("; ");
    } catch (e) {}
    const note = "[WEB jebeeshoes.vn] TT:" + pay + " | " + k.ten + " | " + k.sdt + " | " + k.diachi
      + (k.ghichu ? " | Ghi chu: " + k.ghichu : "") + " | " + dong + " | Tong ~" + (b.tong || 0) + ngLine;

    const payload = {
      items: items,
      note: note,
      status: 0,
      tags: [46],                 // the "Website" (id 46) — danh dau don tu web
      surcharge: surcharge,       // phu thu de tong = gia web (khi web > POS)
      is_free_shipping: true,
      shipping_address: { full_name: k.ten, phone_number: k.sdt, address: k.diachi },
      bill_full_name: k.ten,
      bill_phone_number: k.sdt,
      customer: { name: k.ten, phone_number: k.sdt }
    };

    const url = base + "/orders?api_key=" + encodeURIComponent(key);
    const post = async function (pl) {
      const rr = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(pl) });
      const tt = await rr.text();
      let jj = null; try { jj = JSON.parse(tt); } catch (e) {}
      return { rr: rr, tt: tt, jj: jj };
    };
    let { rr: r, tt: text, jj: j } = await post(payload);
    // Neu that bai va co the -> tao lai KHONG the (thang the la best-effort, khong pha vo don)
    if ((!r.ok || (j && j.success === false)) && payload.tags) {
      const pl2 = Object.assign({}, payload); delete pl2.tags;
      ({ rr: r, tt: text, jj: j } = await post(pl2));
    }
    if (!r.ok || (j && j.success === false)) {
      return res.status(200).json({ ok: false, error: (j && (j.message || j.error)) || ("POS " + r.status), raw: (j ? undefined : text.slice(0, 300)) });
    }
    // Cong don "da ban" tu WEB (theo don that) vao Redis — best-effort, KHONG pha vo don neu loi.
    try {
      if (KURL && KTOK) {
        const cmds = [];
        (b.items || []).forEach(function (x) { const m = normMa(x.ma); const q = parseInt(x.qty, 10) || 0; if (m && q > 0) cmds.push(["INCRBY", "bd:" + m, String(q)]); });
        if (cmds.length) await fetch(KURL + "/pipeline", { method: "POST", headers: { Authorization: "Bearer " + KTOK, "Content-Type": "application/json" }, body: JSON.stringify(cmds) });
      }
    } catch (e) {}

    const od = (j && (j.data || j.order || j)) || {};
    return res.status(200).json({ ok: true, madon: od.display_id || od.system_id || od.id || "", status: od.status });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String((e && e.message) || e) });
  }
}
