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

    // diag tam thoi: liet ke tung san pham + ly do bi loc (KHONG tra gia von). Chi bat khi ?diag=1.
    if (req.query && req.query.diag) {
      const q = String(req.query.diag);
      const shoeRe = /gi[aà]y|dep|dép/;
      const nameBlockRe = /t[aấ]t|v[oớ]|^l[oó]t\b|thanh l[íy]/;
      const rows = all.map(function (p) {
        const cats = (p.categories || []).map(function (c) { return (c.name || "").toLowerCase(); }).join(" ");
        const ten = cleanName(p.name);
        const vars = (p.variations || []).filter(function (v) { return !v.is_removed && !v.is_hidden; });
        let giaMin = null;
        vars.forEach(function (v) { const g = v.retail_price_after_discount || v.retail_price || 0; if (g > 0 && (giaMin === null || g < giaMin)) giaMin = g; });
        const inShoe = shoeRe.test(cats);
        const nameBlocked = nameBlockRe.test(ten.toLowerCase());
        const shown = inShoe && !nameBlocked && giaMin !== null;
        let ly_do = "HIEN";
        if (!shown) {
          if (!inShoe) ly_do = "KHONG thuoc danh muc giay/dep (cat=" + cats + ")";
          else if (nameBlocked) ly_do = "Ten bi chan (tat/vo/lot/thanh ly)";
          else if (giaMin === null) ly_do = "KHONG co bien the ban duoc (0 bien the co gia>0, " + (p.variations || []).length + " bien the tong)";
        }
        return {
          ma: p.custom_id || null,
          display_id: p.display_id,
          ten_goc: p.name,
          so_bien_the: (p.variations || []).length,
          bien_the_ban_duoc: giaMin !== null,
          trong_danh_muc_giay: inShoe,
          hien_tren_web: shown,
          ly_do: ly_do
        };
      });
      let filtered = rows;
      if (q !== "1" && q !== "all") {
        const codes = q.toUpperCase().split(/[,\s]+/).filter(Boolean);
        filtered = rows.filter(function (r) {
          const hay = ((r.ma || "") + " " + (r.ten_goc || "")).toUpperCase();
          return codes.some(function (c) { return hay.indexOf(c) >= 0; });
        });
      }
      return res.status(200).json({ tong_tho: all.length, tim_thay: filtered.length, san_pham: filtered });
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

    // Sap xep best-seller: 5 mau moi luon len dau, con lai theo SO DA BAN giam dan.
    // So da ban = product_count (da tru tra/doi) tu analytics/sale. KHONG lo so ban ra client (chi dung de sort).
    const NEW5 = ["JB708", "JB619", "JB622", "JB367", "JB5502"];
    let soldMap = null;
    try {
      const since = "2024-01-01T00:00:00Z";
      const until = new Date().toISOString();
      const sUrl = base + "/analytics/sale?api_key=" + encodeURIComponent(key)
        + "&since=" + encodeURIComponent(since) + "&until=" + encodeURIComponent(until)
        + "&split_by[]=" + encodeURIComponent("Variation.product_id");
      const sr = await fetch(sUrl);
      if (sr.ok) {
        const sj = await sr.json();
        soldMap = {};
        ((sj && sj.data) || []).forEach(function (d) {
          const cid = d.product && d.product.custom_id;
          const sold = d.success && typeof d.success.product_count === "number" ? d.success.product_count : 0;
          if (cid) soldMap[String(cid).toUpperCase()] = sold;
        });
      }
    } catch (e) { soldMap = null; }

    out.forEach(function (p) { p._sold = (soldMap && soldMap[(p.ma || "").toUpperCase()]) || 0; });
    out.sort(function (a, b) {
      const na = NEW5.indexOf((a.ma || "").toUpperCase());
      const nb = NEW5.indexOf((b.ma || "").toUpperCase());
      if (na >= 0 && nb >= 0) return na - nb;  // giu thu tu NEW5
      if (na >= 0) return -1;
      if (nb >= 0) return 1;
      return b._sold - a._sold;                 // ban nhieu len truoc
    });
    out.forEach(function (p) { delete p._sold; });

    res.setHeader("Cache-Control", "s-maxage=60, stale-while-revalidate=300");
    return res.status(200).json({ tong: out.length, san_pham: out });
  } catch (e) {
    return res.status(500).json({ error: String((e && e.message) || e) });
  }
}
