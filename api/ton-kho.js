// /api/ton-kho — Danh sach san pham giay + ton kho tu Pancake POS.
// AN TOAN: chi tra field cong khai (ma, ten, anh, mau, size, sku, gia ban, ton, id bien the).
// KHONG bao gio tra gia nhap / gia von.
export default async function handler(req, res) {
  const key = process.env.POS_API_KEY;
  const shop = process.env.POS_SHOP_ID;
  if (!key || !shop) return res.status(500).json({ error: "Thieu POS_API_KEY hoac POS_SHOP_ID" });
  const base = "https://pos.pancake.vn/api/v1/shops/" + shop;
  const debug = req.query && req.query.debug;

  const imgUrl = function (im) {
    if (!im) return null;
    if (typeof im === "string") return im;
    return im.url || im.image_url || im.src || null;
  };
  const cleanName = function (name) {
    let n = " " + (name || "") + " ";
    n = n.replace(/\[[^\]]*\]/g, " ");            // bo [HANG MOI], [Tang ...]
    n = n.replace(/\bJB[0-9][0-9A-Za-z\-]*/g, " "); // bo ma JB5359...
    n = n.replace(/ch[íi]nh h[ãa]ng/gi, " ");
    n = n.replace(/[\-–|]\s*$/g, " ");
    n = n.replace(/\s{2,}/g, " ").trim();
    n = n.replace(/^[\-–|,\s]+/, "").replace(/[\-–|,\s]+$/, "").trim();
    return n || (name || "").trim();
  };

  try {
    let all = [], page = 1, guard = 0;
    while (guard++ < 30) {
      const url = base + "/products?api_key=" + encodeURIComponent(key) + "&page=" + page + "&page_size=100";
      const r = await fetch(url);
      if (!r.ok) return res.status(r.status).json({ error: "POS tra ve " + r.status });
      const j = await r.json();
      const list = (j && (j.data || j.products || j.entries)) || [];
      all = all.concat(list);
      const totalPages = j && (j.total_pages || (j.paging && j.paging.total_pages));
      if (list.length < 100 || (totalPages && page >= totalPages)) break;
      page++;
    }

    if (debug) {
      const cats = {};
      all.forEach(function (p) { (p.categories || []).forEach(function (c) { const k = c.name || c.id; cats[k] = (cats[k] || 0) + 1; }); });
      return res.status(200).json({ tong: all.length, danh_muc: cats });
    }

    // debug tam: xem POS co truong "da ban" khong. Chi in ten truong + gia tri cac truong lien quan so luong ban (KHONG in gia/gia von).
    if (req.query && req.query.fields) {
      const p0 = all.find(function (p) { const cats = (p.categories || []).map(function (c) { return (c.name || "").toLowerCase(); }).join(" "); return /gi[aà]y|dep|dép/.test(cats); }) || all[0] || {};
      const v0 = (p0.variations || [])[0] || {};
      const bad = /price|import|von|cost|gia|capital|profit|loi_nhuan|nhap/i;
      const good = /sold|sell|ban|order|purchas|quantit|remain|total|count/i;
      const pick = function (o) { const r = {}; Object.keys(o || {}).forEach(function (k) { if (good.test(k) && !bad.test(k) && (typeof o[k] === "number" || typeof o[k] === "string")) r[k] = o[k]; }); return r; };
      return res.status(200).json({
        product_keys: Object.keys(p0),
        variation_keys: Object.keys(v0),
        product_sold_like: pick(p0),
        variation_sold_like: pick(v0)
      });
    }

    const inShoeCat = function (p) {
      const cats = (p.categories || []).map(function (c) { return (c.name || "").toLowerCase(); }).join(" ");
      return /gi[aà]y|dep|dép/.test(cats);
    };

    const out = [];
    all.forEach(function (p) {
      if (!inShoeCat(p)) return;
      const ten = cleanName(p.name);
      const low = ten.toLowerCase();
      if (/t[aấ]t|v[oớ]|^l[oó]t\b|thanh l[íy]/.test(low)) return; // bo tat/vo/lot/thanh ly

      const vimgs = [];
      let giaMin = null, giaGoc = null;
      const vars = (p.variations || []).filter(function (v) { return !v.is_removed && !v.is_hidden; }).map(function (v) {
        const f = v.fields || [];
        const get = function (n) { const x = f.find(function (a) { return (a.name || "").toLowerCase().indexOf(n) >= 0; }); return x ? x.value : null; };
        const va = (v.images || []).map(imgUrl).filter(Boolean);
        va.forEach(function (u) { if (vimgs.indexOf(u) < 0) vimgs.push(u); });
        const gia = v.retail_price_after_discount || v.retail_price || 0;
        const goc = v.retail_price || 0;
        if (gia > 0 && (giaMin === null || gia < giaMin)) giaMin = gia;
        if (goc > giaGoc) giaGoc = goc;
        return {
          id: v.id,
          sku: v.barcode || String(v.display_id || ""),
          mau: get("màu") || get("mau") || get("color") || null,
          size: get("size") || v.size || null,
          gia: gia,
          ton: v.remain_quantity || 0,
          anh: va[0] || null
        };
      });
      if (giaMin === null) return; // khong co bien the ban duoc

      const pimg = imgUrl(p.image);
      const images = [];
      if (pimg) images.push(pimg);
      vimgs.forEach(function (u) { if (images.indexOf(u) < 0) images.push(u); });

      out.push({
        ma: p.custom_id || String(p.display_id),
        ten: ten,
        ten_goc: p.name,
        anh: pimg || vimgs[0] || null,
        images: images,
        gia: giaMin,
        gia_goc: giaGoc > giaMin ? giaGoc : null,
        variations: vars
      });
    });

    res.setHeader("Cache-Control", "s-maxage=60, stale-while-revalidate=300");
    return res.status(200).json({ tong: out.length, san_pham: out });
  } catch (e) {
    return res.status(500).json({ error: String((e && e.message) || e) });
  }
}
