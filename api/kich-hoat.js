// /api/kich-hoat — Kich hoat bao hanh JEBEE + sinh J-Point. Luu Upstash Redis (KV) san co.
// POST  body {sdt, nguon, ma, size, dob, hp}  -> tao/lay phieu bao hanh + J-Point (dedup theo sdt+ma)
// GET   ?code=JB-XXXXX&t=<token>              -> mo lai phieu (an toan: che bot SDT)
// GET   ?check=JP-XXXXX                        -> kiem tra nhanh J-Point (dat-hang moi la noi xac thuc that)
// GET   ?admin=<KH_ADMIN_KEY>&csv=1            -> xuat CSV toan bo khach da kich hoat
// AN TOAN: khong bao gio tra gia von; phieu che bot so dien thoai.
const KURL = process.env.KV_REST_API_URL, KTOK = process.env.KV_REST_API_TOKEN;

// ---- Upstash REST helpers ----
async function rcmd(args) {
  const r = await fetch(KURL, { method: "POST", headers: { Authorization: "Bearer " + KTOK, "Content-Type": "application/json" }, body: JSON.stringify(args) });
  const j = await r.json().catch(function () { return {}; });
  return j && Object.prototype.hasOwnProperty.call(j, "result") ? j.result : null;
}
async function rpipe(cmds) {
  const r = await fetch(KURL + "/pipeline", { method: "POST", headers: { Authorization: "Bearer " + KTOK, "Content-Type": "application/json" }, body: JSON.stringify(cmds) });
  const j = await r.json().catch(function () { return []; });
  return Array.isArray(j) ? j.map(function (x) { return x && Object.prototype.hasOwnProperty.call(x, "result") ? x.result : null; }) : [];
}

// ---- Utils ----
const ALPHA = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ"; // bo 0/O/1/I de khong nham
function rand5() { let s = ""; for (let i = 0; i < 5; i++) s += ALPHA[Math.floor(Math.random() * ALPHA.length)]; return s; }
const DAY = 86400000;
function normMa(s) { return (s || "").toString().toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 16); }
function maskPhone(p) { // 0987654321 -> 09xx xxx 321
  const d = (p || "").replace(/\D/g, "");
  if (d.length < 7) return d;
  return d.slice(0, 2) + "xx xxx " + d.slice(-3);
}
function clientIp(req) {
  const xf = (req.headers["x-forwarded-for"] || "").split(",")[0].trim();
  return xf || (req.socket && req.socket.remoteAddress) || "0.0.0.0";
}
function fmtDate(ms) {
  const d = new Date(ms);
  const p = function (n) { return (n < 10 ? "0" : "") + n; };
  return p(d.getDate()) + "/" + p(d.getMonth() + 1) + "/" + d.getFullYear();
}

async function buildPhieu(rec) {
  return {
    code: rec.code,
    token: rec.token,
    ma: rec.ma,
    size: rec.size || "",
    sdt_che: maskPhone(rec.sdt),
    ts: rec.ts,
    bh_keo_ms: rec.ts + 180 * DAY,
    bh_de_ms: rec.ts + 365 * DAY,
    bh_keo: fmtDate(rec.ts + 180 * DAY),
    bh_de: fmtDate(rec.ts + 365 * DAY),
    jpoint: rec.jcode ? { code: rec.jcode, amount: 100000, exp_ms: rec.ts + 30 * DAY, exp: fmtDate(rec.ts + 30 * DAY) } : null
  };
}

export default async function handler(req, res) {
  if (!KURL || !KTOK) return res.status(500).json({ ok: false, error: "Thieu cau hinh KV" });

  // ================= GET =================
  if (req.method === "GET") {
    const q = req.query || {};

    // --- Admin CSV ---
    if (q.admin != null || q.csv != null) {
      const KEY = process.env.KH_ADMIN_KEY || "";
      if (!KEY || String(q.admin) !== KEY) return res.status(403).json({ ok: false, error: "Sai ma admin" });
      try {
        const members = await rcmd(["ZRANGE", "kh:index", "0", "-1"]); // theo thoi gian tang dan
        const list = Array.isArray(members) ? members : [];
        const rows = [["Ngay kich hoat", "So dien thoai", "Mau", "Size", "Nguon mua", "Ma bao hanh", "BH keo den", "BH de den", "Ma J-Point", "J-Point da dung", "Sinh nhat"]];
        for (let i = 0; i < list.length; i++) {
          const raw = await rcmd(["GET", "kh:rec:" + list[i]]);
          if (!raw) continue;
          let r; try { r = JSON.parse(raw); } catch (e) { continue; }
          let jused = "";
          if (r.jcode) { const u = await rcmd(["GET", "jp:used:" + r.jcode]); jused = u ? "Roi" : "Chua"; }
          rows.push([fmtDate(r.ts) + " " + new Date(r.ts).toLocaleTimeString("vi-VN"), r.sdt, r.ma, r.size || "", r.nguon || "", r.code, fmtDate(r.ts + 180 * DAY), fmtDate(r.ts + 365 * DAY), r.jcode || "", jused, r.dob || ""]);
        }
        const csv = "﻿" + rows.map(function (row) { return row.map(function (c) { const s = String(c == null ? "" : c); return /[",\n;]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }).join(","); }).join("\r\n");
        res.setHeader("Content-Type", "text/csv; charset=utf-8");
        res.setHeader("Content-Disposition", 'attachment; filename="kich-hoat-jebee.csv"');
        return res.status(200).send(csv);
      } catch (e) { return res.status(500).json({ ok: false, error: String((e && e.message) || e) }); }
    }

    // --- Kiem tra nhanh J-Point (hien thi phia khach; dat-hang moi xac thuc that) ---
    if (q.check) {
      const jcode = String(q.check).toUpperCase().replace(/[^A-Z0-9\-]/g, "");
      const raw = await rcmd(["GET", "jp:code:" + jcode]);
      if (!raw) return res.status(200).json({ ok: true, valid: false, ly_do: "Ma khong ton tai" });
      let jp; try { jp = JSON.parse(raw); } catch (e) { return res.status(200).json({ ok: true, valid: false, ly_do: "Ma loi" }); }
      const used = await rcmd(["GET", "jp:used:" + jcode]);
      if (used) return res.status(200).json({ ok: true, valid: false, ly_do: "Ma da duoc su dung" });
      if (Date.now() > jp.exp) return res.status(200).json({ ok: true, valid: false, ly_do: "Ma da het han" });
      return res.status(200).json({ ok: true, valid: true, giam: 100000 });
    }

    // --- Mo lai phieu bao hanh ---
    if (q.code) {
      const code = String(q.code).toUpperCase().replace(/[^A-Z0-9\-]/g, "");
      const ptr = await rcmd(["GET", "kh:code:" + code]);
      if (!ptr) return res.status(404).json({ ok: false, error: "Khong tim thay phieu" });
      const raw = await rcmd(["GET", "kh:rec:" + ptr]);
      if (!raw) return res.status(404).json({ ok: false, error: "Khong tim thay phieu" });
      let rec; try { rec = JSON.parse(raw); } catch (e) { return res.status(500).json({ ok: false, error: "Phieu loi" }); }
      if (!q.t || String(q.t) !== rec.token) return res.status(403).json({ ok: false, error: "Link phieu khong hop le" });
      res.setHeader("Cache-Control", "no-store");
      return res.status(200).json({ ok: true, phieu: await buildPhieu(rec) });
    }

    return res.status(400).json({ ok: false, error: "Thieu tham so" });
  }

  // ================= POST: kich hoat =================
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "Method not allowed" });
  try {
    const b = req.body || {};
    if (b.hp) return res.status(200).json({ ok: false, error: "spam" }); // honeypot

    const sdt = (b.sdt || "").toString().replace(/\D/g, "");
    if (!/^0\d{9}$/.test(sdt)) return res.status(400).json({ ok: false, error: "So dien thoai chua dung (10 so, bat dau bang 0)" });
    const ma = b.ma === "KHAC" ? "KHAC" : normMa(b.ma);
    if (!ma) return res.status(400).json({ ok: false, error: "Chua chon mau da mua" });
    const nguon = ["shopee", "tiktok", "web", "fb"].indexOf((b.nguon || "").toString()) >= 0 ? b.nguon : "";
    if (!nguon) return res.status(400).json({ ok: false, error: "Chua chon noi mua" });
    const size = (b.size || "").toString().slice(0, 12);
    if (!size) return res.status(400).json({ ok: false, error: "Chua chon size" });
    const dob = (b.dob || "").toString().slice(0, 10);

    // Chong spam theo IP: toi da 20 lan / gio
    const ip = clientIp(req);
    try {
      const rl = await rpipe([["INCR", "rl:kh:" + ip], ["EXPIRE", "rl:kh:" + ip, "3600", "NX"]]);
      const cnt = parseInt(rl[0], 10) || 1;
      if (cnt > 20) return res.status(429).json({ ok: false, error: "Ban thao tac hoi nhanh, thu lai sau it phut nhe" });
    } catch (e) {}

    // Dedup: cung SDT + cung mau -> tra lai phieu cu, KHONG tao J-Point moi
    const recKey = sdt + ":" + ma;
    const exist = await rcmd(["GET", "kh:rec:" + recKey]);
    if (exist) {
      let rec; try { rec = JSON.parse(exist); } catch (e) { rec = null; }
      if (rec) return res.status(200).json({ ok: true, da_kich_hoat: true, phieu: await buildPhieu(rec) });
    }

    const ts = Date.now();
    const ua = (req.headers["user-agent"] || "").slice(0, 180);

    // Sinh ma bao hanh JB-XXXXX duy nhat
    let code = "", tries = 0;
    while (tries++ < 8) {
      const cand = "JB-" + rand5();
      const okset = await rcmd(["SET", "kh:code:" + cand, recKey, "NX"]);
      if (okset === "OK") { code = cand; break; }
    }
    if (!code) return res.status(500).json({ ok: false, error: "Khong sinh duoc ma, thu lai nhe" });

    // Sinh ma J-Point JP-XXXXX duy nhat (100.000d, 1 lan, han 30 ngay)
    let jcode = "", jt = 0;
    while (jt++ < 8) {
      const cand = "JP-" + rand5();
      const okset = await rcmd(["SET", "jp:code:" + cand, JSON.stringify({ phone: sdt, amount: 100000, exp: ts + 30 * DAY, ma: ma }), "NX", "EX", String(31 * 24 * 3600)]);
      if (okset === "OK") { jcode = cand; break; }
    }

    const token = rand5().toLowerCase() + Math.random().toString(36).slice(2, 10);
    const rec = { code: code, token: token, sdt: sdt, ma: ma, size: size, nguon: nguon, dob: dob, ts: ts, jcode: jcode, ua: ua };

    await rpipe([
      ["SET", "kh:rec:" + recKey, JSON.stringify(rec)],
      ["ZADD", "kh:index", String(ts), recKey]
    ]);

    res.setHeader("Cache-Control", "no-store");
    return res.status(200).json({ ok: true, da_kich_hoat: false, phieu: await buildPhieu(rec) });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String((e && e.message) || e) });
  }
}
