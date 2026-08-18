// /api/ton-kho — Danh sach san pham giay + ton kho tu Pancake POS.
// AN TOAN: chi tra field cong khai (ma, ten, anh, mau, size, sku, gia ban, ton). KHONG bao gio tra gia nhap.
export default async function handler(req, res) {
  const key = process.env.POS_API_KEY;
  const shop = process.env.POS_SHOP_ID;
  if (!key || !shop) return res.status(500).json({ error: "Thieu POS_API_KEY hoac POS_SHOP_ID" });
  const base = "https://pos.pancake.vn/api/v1/shops/" + shop;
  const debug = req.query && req.query.debug;

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
      all.forEach(function (p) {
        (p.categories || []).forEach(function (c) { const k = c.name || c.id; cats[k] = (cats[k] || 0) + 1; });
      });
      const sample = all.slice(0, 4).map(function (p) {
        const v0 = (p.variations || [])[0] || null;
        return {
          ma: p.custom_id || p.display_id, ten: p.name,
          cat: (p.categories || []).map(function (c) { return c.name; }),
          image_type: typeof p.image, image_sample: p.image,
          v0: v0 ? { barcode: v0.barcode, fields: v0.fields, images_sample: v0.images } : null
        };
      });
      return res.status(200).json({ tong: all.length, danh_muc: cats, sample: sample });
    }

    const isShoe = function (p) {
      const cats = (p.categories || []).map(function (c) { return (c.name || "").toLowerCase(); }).join(" ");
      const nm = (p.name || "").toLowerCase();
      const cid = (p.custom_id || "");
      return /gi[aà]y|dep|dép/.test(cats) || /gi[aà]y/.test(nm) || /jb\d/i.test(cid) || /jb\d/i.test(nm);
    };
    const imgUrl = function (im) {
      if (!im) return null;
      if (typeof im === "string") return im;
      return im.url || im.image_url || im.src || null;
    };

    const out = all.filter(isShoe).map(function (p) {
      const vimgs = [];
      const vars = (p.variations || []).filter(function (v) { return !v.is_removed && !v.is_hidden; }).map(function (v) {
        const f = v.fields || [];
        const get = function (n) { const x = f.find(function (a) { return (a.name || "").toLowerCase().indexOf(n) >= 0; }); return x ? x.value : null; };
        const va = (v.images || []).map(imgUrl).filter(Boolean);
        va.forEach(function (u) { if (vimgs.indexOf(u) < 0) vimgs.push(u); });
        return {
          sku: v.barcode || String(v.display_id || ""),
          mau: get("màu") || get("mau") || get("color") || null,
          size: get("size") || v.size || null,
          gia: v.retail_price_after_discount || v.retail_price || 0,
          ton: v.remain_quantity || 0,
          anh: va[0] || null
        };
      });
      const pimg = imgUrl(p.image);
      const images = [];
      if (pimg) images.push(pimg);
      vimgs.forEach(function (u) { if (images.indexOf(u) < 0) images.push(u); });
      return {
        ma: p.custom_id || String(p.display_id),
        ten: p.name,
        anh: pimg || vimgs[0] || null,
        images: images,
        variations: vars
      };
    });

    res.setHeader("Cache-Control", "s-maxage=60, stale-while-revalidate=300");
    return res.status(200).json({ tong: out.length, san_pham: out });
  } catch (e) {
    return res.status(500).json({ error: String((e && e.message) || e) });
  }
}
