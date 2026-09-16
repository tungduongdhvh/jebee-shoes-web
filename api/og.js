// /api/og — Chen the Open Graph (anh + ten + gia) theo tung ma san pham khi share link ?sp=MA.
// Bot Facebook/Zalo khong chay JS nen doc the meta tinh -> ham nay tra ve index.html da thay the the OG.
// Link web chinh (khong co ?sp) van giu OG mac dinh = logo.
// Du lieu (ten/gia/anh) nhung tinh -> chay nhanh, cache tot, khong phu thuoc POS luc chay.

const PRICE = {
  JB25:648000, JB597:874000, JB572:670000, JB17:518000, JB5536:734000, JB1320:670000,
  JB606:694000, JB27:626000, JB598:678000, JB286:734000, JB552:702000, JB182:260000,
  JB569:670000, JB1317:624000, JB2632:678000, JB20:670000, JB5359:750000, JB393:632000,
  JB707:726000, JB139:670000, JB111A:899000, JB18:518000, JB08LOT:200000, JB02:170000
};

// MA -> Google Drive file id (anh banner chinh cua mau)
const IMG = {
  JB27:"1qYJZPKzdm8qVJoF28EqP0zY10bL4rAsI", JB5359:"1BKbpExDZ7OwYCPwvUA4meF-E5WB1EwFe",
  JB5536:"1-8TYA4Pmv9U9LX2hUankmWjzliKHVLf2", JB286:"15VSLuyIY-EzCwaR7dwVcPqPjJkk4lrsy",
  JB606:"1zDcWpaCKReXr6951eVjxLUWqc5fUewDh", JB393:"14dJ7ojWbrsRKpGNEW1PXRdDHhJbM-BAJ",
  JB598:"1rud41bLJwygd9523z9QP7wmpCuJytGJt", JB1320:"1P_FHSjlrYS40wX7XjJUd_I5iWoodrN4p",
  JB552:"1Vb0CHfZFVRDR6xaXS_yMbs1I04jrOKVy", JB2632:"1-Sxnc10b-T0V3S6M8CYoQEU9gnkbGKGa",
  JB572:"1Ro43KVZEAcjYzVfPNzo5iKqiqnKyNLJL", JB18:"11uiSutIACZRg_iU0AG2lDzbamJwp69RS",
  JB20:"13yJIIHQtPPo1h_-A8Y2sb281jVTTtk1y", JB182:"1wj5ColowsUAGZzpvTpos7y0kzd7NTYmd",
  JB597:"1m9vVKDAurk31hJDdhszo6ilzgsQQjxsE", JB707:"1B_eawhGWGn50P8dK2zprb_THEQN6OZhe",
  JB25:"1KhrCSCrmms5VQyauvEo4jBuVP0Ah-sgK", JB02:"1IYp5ZyjlGMLB_rRwZ1aw9cedXpJWUaxk",
  JB111A:"1H4K5YSBhe6GOC-O7S1dltRUP527vL0VX", JB569:"1SydAJ_yqxeWTcl7jEeeE-LNq_1TVU6E6",
  JB08LOT:"1kkU09LrPpRGS1Qmh5n8oQbBWCTEqQVQa", JB139:"1eLDigyIDKC6CLsl0Nyqz2x1YYGcdpa92",
  JB17:"1G0tDqYIv2JEqxHtwRh2DltO6HVMxBWaI", JB1317:"1Hdun1A4gOTphTjibbsPu6h_UWs_8wrUQ"
};

// MA -> ten hien thi (da lam sach)
const NAME = {
  JB25:"Giày độn đế thời trang phong cách Hàn Quốc",
  JB597:"Giày thể thao nữ 8cm 2025, chất da bò tách và vật liệu cao cấp siêu nhẹ",
  JB572:"Giày Nữ 10cm Đế Bánh Mì - Da Lộn Cao Cấp, Siêu Nhẹ, Thanh Lịch, Dễ Phối Đồ",
  JB17:"Giày thể thao nữ đế bố cao 12cm siêu nhẹ, hack dáng tự nhiên",
  JB5536:"Giày thể thao nữ độn đế 9cm lưới thoáng khí, siêu nhẹ, đi êm chân",
  JB1320:"Giày nữ thời trang da bò tách lớp phong cách thể thao cao 8cm",
  JB606:"Giày thời trang nữ xuân hè da bò tách lớp tăng chiều cao 8cm",
  JB27:"Giày thể thao độn đế, phong cách Hàn Quốc",
  JB598:"Giày thể thao nữ thoáng khí da bò đế êm nhẹ - tăng chiều cao 9cm",
  JB286:"Giày thể thao lưới thoáng khí tăng chiều cao 9cm",
  JB552:"Đế siêu nhẹ Tăng Chiều Cao 8cm - Da bò tách lớp, phong cách Old Skool",
  JB182:"Dép sandal nữ mùa hè hottrend chất da mềm kết hợp lưới thoáng khí",
  JB569:"Giày thể thao nữ da bò tách đôi hack chiều cao 8cm, siêu nhẹ và êm ái",
  JB1317:"Giày nữ slip-on đế xuồng 8cm, da bò hoặc lưới cao cấp siêu nhẹ",
  JB2632:"Boot Nữ Cao 9cm - Đế Xuồng, Chống Trơn Trượt, Da Bò Tách Cao Cấp",
  JB20:"Bốt cổ cao da trơn cao cấp đế polyurethane siêu nhẹ cao 7cm",
  JB5359:"Giày thể thao cá tính cao 9cm, da bò tách lớp cao cấp",
  JB393:"Giày thể thao đế xuồng cao 9cm da bò thật hàng QC L1 cao cấp siêu nhẹ",
  JB707:"Giày nữ 13cm phối đồ dễ dàng, hàng L1 QC da bò đế siêu nhẹ",
  JB139:"Giày thể thao nữ đế bằng tăng chiều cao 10cm chất liệu da bò cao cấp",
  JB111A:"Giày thể thao lông cừu Mông Cổ thật, giữ ấm chân, đế siêu mềm cao 5cm",
  JB18:"Bốt cổ len tăng chiều cao 8cm phong cách Hàn Quốc",
  JB08LOT:"Dép Sandal nữ đế xuồng hở mũi 6,5cm EVA cao cấp phong cách dễ thương",
  JB02:"Dép Sandal nữ đế xuồng EVA cao cấp hottrend Triệu Lộ Tư"
};

function attrEsc(s){
  return String(s).replace(/&/g,"&amp;").replace(/"/g,"&quot;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
}
function fmtVND(n){
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ".") + "đ";
}
// Thay content cua the meta <meta property|name="KEY" content="..."> ; neu chua co thi chen truoc </head>
function setMeta(html, attr, key, val){
  const esc = attrEsc(val);
  const re = new RegExp('(<meta\\s+' + attr + '="' + key.replace(/[.*+?^${}()|[\]\\]/g,'\\$&') + '"\\s+content=")[^"]*(")', 'i');
  if(re.test(html)) return html.replace(re, function(_,a,b){ return a + esc + b; });
  return html.replace('</head>', '<meta ' + attr + '="' + key + '" content="' + esc + '">\n</head>');
}

export default async function handler(req, res){
  const proto = (req.headers['x-forwarded-proto'] || 'https').split(',')[0];
  const host = req.headers['x-forwarded-host'] || req.headers.host || 'jebeeshoes.vn';
  const base = proto + '://' + host;

  // Lay HTML goc (file tinh). Khong kem ?sp nen khong bi rewrite lai vao ham nay.
  let html = '';
  try {
    const r = await fetch(base + '/index.html');
    html = await r.text();
  } catch(e){ html = ''; }
  if(!html){ res.statusCode = 302; res.setHeader('Location', '/'); return res.end(); }

  let spRaw = (req.query && req.query.sp) || '';
  if(!spRaw && req.url){ try { spRaw = new URL(req.url, base).searchParams.get('sp') || ''; } catch(e){} }
  const ma = String(spRaw).toUpperCase().replace(/[^A-Z0-9]/g, '');

  if(ma && NAME[ma] && IMG[ma] && PRICE[ma]){
    const name  = NAME[ma];
    const price = fmtVND(PRICE[ma]);
    const title = name + ' · ' + price + ' | Jebee Shoes';
    const desc  = name + '. Giá ' + price + ', freeship toàn quốc, đổi size 15 ngày, bảo hành đế 12 tháng. Đặt ngay tại Jebee Shoes.';
    const img   = 'https://lh3.googleusercontent.com/d/' + IMG[ma] + '=w1200';
    const url   = base + '/?sp=' + ma;

    html = setMeta(html, 'property', 'og:type', 'product');
    html = setMeta(html, 'property', 'og:url', url);
    html = setMeta(html, 'property', 'og:title', title);
    html = setMeta(html, 'property', 'og:description', desc);
    html = setMeta(html, 'property', 'og:image', img);
    html = setMeta(html, 'name', 'twitter:card', 'summary_large_image');
    html = setMeta(html, 'name', 'twitter:title', title);
    html = setMeta(html, 'name', 'twitter:description', desc);
    html = setMeta(html, 'name', 'twitter:image', img);
    html = html.replace(/<title>[\s\S]*?<\/title>/i, '<title>' + attrEsc(title) + '</title>');
  }

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'public, s-maxage=1800, stale-while-revalidate=86400');
  res.statusCode = 200;
  return res.end(html);
}
