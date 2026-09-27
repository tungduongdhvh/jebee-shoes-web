// /api/anh — Kho anh danh gia cua khach (luu tren Upstash Redis, khong can dich vu ngoai).
// POST { img: "<base64 JPEG khong co tien to>" } -> luu, tra { ok, url:"/api/anh?id=<id>" }
// GET  ?id=<id> -> tra ve anh (image/jpeg), cache lau.
const KURL = process.env.KV_REST_API_URL, KTOK = process.env.KV_REST_API_TOKEN;
async function redis(cmd) {
  const r = await fetch(KURL, { method: "POST", headers: { Authorization: "Bearer " + KTOK, "Content-Type": "application/json" }, body: JSON.stringify(cmd) });
  const j = await r.json();
  return j.result;
}
function genId() {
  try { return (globalThis.crypto && crypto.randomUUID) ? crypto.randomUUID().replace(/-/g, "") : null; } catch (e) {}
  return (Date.now().toString(36) + Math.random().toString(36).slice(2, 12));
}

export default async function handler(req, res) {
  if (!KURL || !KTOK) return res.status(500).json({ ok: false, error: "Thieu cau hinh KV" });
  try {
    if (req.method === "GET") {
      const id = ((req.query && req.query.id) || "").toString().replace(/[^A-Za-z0-9]/g, "");
      if (!id) return res.status(400).json({ ok: false, error: "Thieu id" });
      const b64 = await redis(["GET", "img:" + id]);
      if (!b64) return res.status(404).json({ ok: false, error: "Khong tim thay anh" });
      const buf = Buffer.from(b64, "base64");
      res.setHeader("Content-Type", "image/jpeg");
      res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
      return res.status(200).send(buf);
    }
    if (req.method === "POST") {
      const b = req.body || {};
      let img = (b.img || "").toString();
      const m = img.match(/^data:image\/[a-z]+;base64,(.*)$/i);
      if (m) img = m[1];
      img = img.replace(/\s/g, "");
      if (!/^[A-Za-z0-9+/=]+$/.test(img) || img.length < 100) return res.status(400).json({ ok: false, error: "Anh khong hop le" });
      if (img.length > 700000) return res.status(413).json({ ok: false, error: "Anh qua lon" }); // ~500KB
      const id = genId();
      await redis(["SET", "img:" + id, img]);
      return res.status(200).json({ ok: true, url: "/api/anh?id=" + id });
    }
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String((e && e.message) || e) });
  }
}
