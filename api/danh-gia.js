// /api/danh-gia — Danh gia san pham (sao 1-5 + nhan xet + anh), luu tren Upstash Redis (REST API).
// GET ?ma=JB5359            -> danh sach danh gia + trung binh + so luong cho 1 SP.
// GET ?agg=JB5359,JB286,... -> { MA: {n, avg} } cho nhieu SP (dung cho luoi san pham).
// POST { ma, sao(1-5), ten, noidung, anh[], luc? } -> luu 1 danh gia.
// Key namespace: rv:<MA> (list), rvc:<MA> (count), rvs:<MA> (sum sao).
const KURL = process.env.KV_REST_API_URL;
const KTOK = process.env.KV_REST_API_TOKEN;

async function redis(cmd) {
  const r = await fetch(KURL, { method: "POST", headers: { Authorization: "Bearer " + KTOK, "Content-Type": "application/json" }, body: JSON.stringify(cmd) });
  const j = await r.json();
  return j.result;
}
async function pipeline(cmds) {
  const r = await fetch(KURL + "/pipeline", { method: "POST", headers: { Authorization: "Bearer " + KTOK, "Content-Type": "application/json" }, body: JSON.stringify(cmds) });
  return await r.json(); // [{result}|{error}, ...]
}
function norm(s) { return (s || "").toString().toUpperCase().replace(/[^A-Z0-9]/g, ""); }

export default async function handler(req, res) {
  if (!KURL || !KTOK) return res.status(500).json({ ok: false, error: "Thieu cau hinh KV" });
  try {
    if (req.method === "GET") {
      // ----- tong hop nhieu SP (luoi) -----
      const agg = req.query && req.query.agg;
      if (agg) {
        const mas = agg.split(",").map(norm).filter(Boolean).slice(0, 40);
        if (!mas.length) return res.status(200).json({ ok: true, agg: {} });
        const cmds = [];
        mas.forEach(function (m) { cmds.push(["GET", "rwc:" + m]); cmds.push(["GET", "rws:" + m]); cmds.push(["GET", "bd:" + m]); });
        const rr = await pipeline(cmds);
        const out = {};
        mas.forEach(function (m, i) {
          const n = parseInt((rr[i * 3] && rr[i * 3].result) || 0, 10);
          const s = parseInt((rr[i * 3 + 1] && rr[i * 3 + 1].result) || 0, 10);
          const ban = parseInt((rr[i * 3 + 2] && rr[i * 3 + 2].result) || 0, 10);   // so don ban tu WEB (cong don)
          const e = {};
          if (n > 0) { e.n = n; e.avg = Math.round((s / n) * 10) / 10; }
          if (ban > 0) e.ban = ban;
          if (n > 0 || ban > 0) out[m] = e;
        });
        res.setHeader("Cache-Control", "s-maxage=30, stale-while-revalidate=120");
        return res.status(200).json({ ok: true, agg: out });
      }
      // ----- chi tiet 1 SP (modal) -----
      const ma = norm(req.query && req.query.ma);
      if (!ma) return res.status(400).json({ ok: false, error: "Thieu ma" });
      const list = (await redis(["LRANGE", "rw:" + ma, "0", "49"])) || [];
      const items = list.map(function (s) { try { return JSON.parse(s); } catch (e) { return null; } }).filter(Boolean);
      const n = parseInt((await redis(["GET", "rwc:" + ma])) || items.length, 10);
      const s = parseInt((await redis(["GET", "rws:" + ma])) || 0, 10);
      const avg = n > 0 ? Math.round((s / n) * 10) / 10 : (items.length ? Math.round(items.reduce(function (a, b) { return a + (b.sao || 0); }, 0) / items.length * 10) / 10 : 0);
      res.setHeader("Cache-Control", "no-store");
      return res.status(200).json({ ok: true, ma: ma, n: n, avg: avg, danhgia: items });
    }

    if (req.method === "POST") {
      const b = req.body || {};
      // ----- replace (admin: gan anh vao review): thay toan bo danh gia 1 SP. Tam thoi, se go khi xong. -----
      if (b.op === "replace") {
        if (b.k !== "JB-RW-TMP-7q2f9x" || !Array.isArray(b.items)) return res.status(403).json({ ok: false, error: "Khong hop le" });
        const rma = norm(b.ma);
        if (!rma) return res.status(400).json({ ok: false, error: "Thieu ma" });
        const cmds = [["DEL", "rw:" + rma], ["DEL", "rwc:" + rma], ["DEL", "rws:" + rma]];
        let cnt = 0, sum = 0;
        for (const it of b.items) {
          const isao = Math.max(1, Math.min(5, parseInt(it.sao, 10) || 0));
          if (!it || !it.sao) continue;
          const iten = (it.ten || "Khách").toString().trim().slice(0, 40) || "Khách";
          const inoi = (it.noidung || "").toString().trim().slice(0, 500);
          const ianh = Array.isArray(it.anh) ? it.anh.filter(function (u) { return typeof u === "string" && /^https:\/\//.test(u); }).slice(0, 6) : [];
          let iluc = new Date().toISOString();
          if (it.luc) { const t = Date.parse(it.luc); const now = Date.now(); if (!isNaN(t) && t <= now && t >= now - 1200 * 864e5) iluc = new Date(t).toISOString(); }
          cmds.push(["RPUSH", "rw:" + rma, JSON.stringify({ sao: isao, ten: iten, noidung: inoi, anh: ianh, luc: iluc })]);
          cnt++; sum += isao;
        }
        cmds.push(["SET", "rwc:" + rma, String(cnt)], ["SET", "rws:" + rma, String(sum)]);
        await pipeline(cmds);
        return res.status(200).json({ ok: true, replaced: cnt });
      }
      const ma = norm(b.ma);
      const sao = Math.max(1, Math.min(5, parseInt(b.sao, 10) || 0));
      const ten = (b.ten || "Khách").toString().trim().slice(0, 40) || "Khách";
      const noidung = (b.noidung || "").toString().trim().slice(0, 500);
      const anh = Array.isArray(b.anh) ? b.anh.filter(function (u) { return typeof u === "string" && (/^https:\/\//.test(u) || /^\/api\/anh\?id=[A-Za-z0-9]+$/.test(u)); }).slice(0, 6) : [];
      // luc: cho phep set ngay (seed du lieu moi) neu la ISO hop le trong vong 1 nam qua & khong o tuong lai; nguoc lai dung now.
      let luc = new Date().toISOString();
      if (b.luc) { const t = Date.parse(b.luc); const now = Date.now(); if (!isNaN(t) && t <= now && t >= now - 1200 * 864e5) luc = new Date(t).toISOString(); }
      if (!ma || !sao) return res.status(400).json({ ok: false, error: "Thieu ma hoac so sao" });
      const rec = JSON.stringify({ sao: sao, ten: ten, noidung: noidung, anh: anh, luc: luc });
      await pipeline([["LPUSH", "rw:" + ma, rec], ["LTRIM", "rw:" + ma, "0", "199"], ["INCR", "rwc:" + ma], ["INCRBY", "rws:" + ma, String(sao)]]);
      return res.status(200).json({ ok: true });
    }

    return res.status(405).json({ ok: false, error: "Method not allowed" });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String((e && e.message) || e) });
  }
}
