// ============================================================
//  controllers/features/triviaController.js
//  Porting dari BOT-WA-1-main/commands/trivia.js (single source of truth)
// ============================================================

const db = require('../../config/database');
const { getUserGameData } = require('../userController');
const { fmt } = require('../../utils/helpers');

// ─── BANK SOAL TRIVIA (copied 1:1) ───────────────────────────
const SOAL_TRIVIA = {
    umum: [
        { q: 'Apa ibu kota Australia?', a: 'canberra', hint: 'Bukan Sydney atau Melbourne!' },
        { q: 'Berapa jumlah planet di tata surya kita?', a: '8', hint: 'Pluto sudah tidak dihitung' },
        { q: 'Siapa penemu lampu pijar?', a: 'thomas edison', hint: 'Orang Amerika yang terkenal' },
        { q: 'Apa nama gunung tertinggi di dunia?', a: 'everest', hint: 'Ada di perbatasan Nepal-Tibet' },
        { q: 'Berapa sisi yang dimiliki segi enam?', a: '6', hint: 'Segi enam = hex' },
        { q: 'Apa unsur kimia dengan simbol Au?', a: 'emas', hint: 'Logam mulia berwarna kuning' },
        { q: 'Negara mana yang memiliki populasi terbanyak di dunia?', a: 'india', hint: 'Melewati China di 2023' },
        { q: 'Apa nama organ yang memompa darah ke seluruh tubuh?', a: 'jantung', hint: 'Ada di dada sebelah kiri' },
        { q: 'Hewan darat tercepat di dunia adalah?', a: 'cheetah', hint: 'Kucing besar bercorak tutul' },
        { q: 'Apa nama benua terbesar di dunia?', a: 'asia', hint: 'Tempat negara kita berada' },
        { q: 'Mata uang resmi negara Jepang adalah?', a: 'yen', hint: 'Terdiri dari 3 huruf' },
        { q: 'Campuran warna merah dan kuning akan menghasilkan warna?', a: 'oranye', hint: 'Sama dengan warna buah jeruk' },
        { q: 'Samudra terluas di dunia adalah Samudra?', a: 'pasifik', hint: 'Membentang di antara Asia dan Amerika' },
        { q: 'Apa nama bahasa internasional yang paling banyak digunakan di dunia?', a: 'inggris', hint: 'Bahasa dari Britania Raya' }
    ],
    indonesia: [
        { q: 'Siapa presiden pertama Indonesia?', a: 'soekarno', hint: 'Proklamator kemerdekaan' },
        { q: 'Apa nama danau terbesar di Indonesia?', a: 'danau toba', hint: 'Ada di Sumatera Utara' },
        { q: 'Indonesia merdeka pada tanggal berapa?', a: '17 agustus 1945', hint: 'Sudah ada di lagu nasional' },
        { q: 'Apa nama gunung berapi paling aktif di Indonesia?', a: 'merapi', hint: 'Ada di Jawa Tengah' },
        { q: 'Suku apa yang menghuni pulau Kalimantan?', a: 'dayak', hint: 'Suku asli Borneo' },
        { q: 'Apa nama alat musik tradisional Jawa yang terbuat dari logam?', a: 'gamelan', hint: 'Dimainkan dipukul' },
        { q: 'Siapa pahlawan nasional yang dijuluki "Singa Podium"?', a: 'bung tomo', hint: 'Pemimpin pertempuran Surabaya 10 Nov' },
        { q: 'Candi Buddha terbesar di dunia yang terletak di Magelang adalah?', a: 'borobudur', hint: 'Dibangun pada masa Wangsa Syailendra' },
        { q: 'Siapa pencipta lagu kebangsaan Indonesia Raya?', a: 'wage rudolf soepratman', hint: 'Sering disingkat W.R. ...' },
        { q: 'Peristiwa sejarah yang menandai akhir dari masa Orde Lama dan awal transisi menuju Orde Baru?', a: 'g30s pki', hint: 'Terjadi pada akhir September 1965' },
        { q: 'Tari Kecak berasal dari provinsi mana?', a: 'bali', hint: 'Pulau Dewata' },
        { q: 'Semboyan negara Indonesia adalah?', a: 'bhinneka tunggal ika', hint: 'Berbeda-beda tetapi tetap satu jua' }
    ],
    sains: [
        { q: 'Apa rumus kimia air?', a: 'h2o', hint: '2 Hidrogen + 1 Oksigen' },
        { q: 'Berapa kecepatan cahaya dalam km/s?', a: '300000', hint: '3 x 10^5 km/s' },
        { q: 'Apa nama proses tanaman membuat makanan menggunakan cahaya matahari?', a: 'fotosintesis', hint: 'Foto = cahaya' },
        { q: 'Apa nama planet terdekat dari matahari?', a: 'merkurius', hint: 'Planet paling kecil di tata surya' },
        { q: 'Berapa derajat titik didih air pada tekanan normal?', a: '100', hint: 'Dalam satuan Celsius' },
        { q: 'Apa nama ilmuwan yang menemukan gravitasi saat melihat apel jatuh?', a: 'newton', hint: 'Sir Isaac ...' },
        { q: 'Dalam fisika, perubahan kecepatan per satuan waktu disebut?', a: 'percepatan', hint: 'Dalam rumus kinematika disimbolkan dengan huruf "a"' },
        { q: 'Skala yang digunakan untuk mengukur tingkat keasaman atau kebasaan suatu larutan disebut?', a: 'ph', hint: 'Nilainya berkisar dari 0 sampai 14' },
        { q: 'Benda langit yang mengorbit sebuah planet disebut?', a: 'satelit', hint: 'Bulan adalah contoh alaminya' },
        { q: 'Sebutan untuk reaksi kimia yang melepaskan panas ke lingkungan adalah?', a: 'eksoterm', hint: 'Kebalikan dari endoterm' },
        { q: 'Ilmu yang mempelajari tentang makhluk hidup adalah?', a: 'biologi', hint: 'Mencakup botani dan zoologi' }
    ],
    sepakbola: [
        { q: 'Siapa pencetak gol terbanyak sepanjang masa di Piala Dunia?', a: 'miroslav klose', hint: 'Pemain Jerman' },
        { q: 'Negara mana yang paling sering juara Piala Dunia?', a: 'brasil', hint: '5 kali juara' },
        { q: 'Apa nama stadion milik Arsenal?', a: 'emirates', hint: 'Disponsori maskapai Timur Tengah' },
        { q: 'Siapa top skor Piala Dunia 2022?', a: 'kylian mbappe', hint: 'Pemain muda Prancis' },
        { q: 'Club apa yang dijuluki "The Red Devils"?', a: 'manchester united', hint: 'Berbasis di Manchester, Inggris' },
        { q: 'Pemain dengan gelar Ballon d\'Or terbanyak sepanjang masa?', a: 'lionel messi', hint: 'Dijuluki La Pulga' },
        { q: 'Siapa pencetak gol terbanyak sepanjang masa di Piala Dunia?', a: 'miroslav klose', hint: 'Pemain Jerman' },
        { q: 'Negara mana yang paling sering juara Piala Dunia?', a: 'brasil', hint: '5 kali juara' },
        { q: 'Apa nama stadion milik Arsenal?', a: 'emirates', hint: 'Disponsori maskapai Timur Tengah' },
        { q: 'Siapa top skor Piala Dunia 2022?', a: 'kylian mbappe', hint: 'Pemain muda Prancis' },
        { q: 'Club apa yang dijuluki "The Red Devils"?', a: 'manchester united', hint: 'Berbasis di Manchester, Inggris' },
        { q: 'Pemain dengan gelar Ballon d\'Or terbanyak sepanjang masa?', a: 'lionel messi', hint: 'Dijuluki La Pulga' },
        { q: 'Klub mana yang memiliki trofi Liga Champions terbanyak?', a: 'real madrid', hint: 'Klub asal ibukota Spanyol, dijuluki Los Blancos' },
        { q: 'Negara mana yang memenangkan kompetisi Euro 2024?', a: 'spanyol', hint: 'Mengalahkan Inggris di laga final' },
        { q: 'Warna kartu yang diberikan wasit untuk mengusir pemain dari lapangan?', a: 'merah', hint: 'Warnanya mencolok' },
        { q: 'Berapa jumlah pemain dalam satu tim sepak bola yang berada di lapangan?', a: '11', hint: 'Sering disebut kesebelasan' },
        { q: 'Siapa pemain sepak bola dunia yang identik dengan julukan CR7?', a: 'cristiano ronaldo', hint: 'Berasal dari Portugal' },
        { q: 'Negara mana yang berhasil menjadi juara Piala Dunia 2022 di Qatar?', a: 'argentina', hint: 'Tim yang dikapteni Lionel Messi' },
        { q: 'Klub sepak bola asal Surabaya yang memiliki julukan Bajul Ijo adalah?', a: 'persebaya', hint: 'Klub kebanggaan Bonek' },
        { q: 'Apa nama stadion yang menjadi markas utama Timnas Indonesia?', a: 'gelora bung karno', hint: 'Terletak di Senayan, Jakarta' },
        { q: 'Istilah untuk pemain yang berhasil mencetak 3 gol dalam satu pertandingan adalah?', a: 'hattrick', hint: 'Tiga gol' },
        { q: 'Klub Italia mana yang memiliki julukan La Vecchia Signora atau Nyonya Tua?', a: 'juventus', hint: 'Jersey utamanya bergaris hitam putih' },
        { q: 'Siapa pelatih asal Korea Selatan yang menangani Timnas Indonesia sejak 2019?', a: 'shin tae yong', hint: 'Sering dipanggil STY' },
        { q: 'Apa nama penghargaan individu tahunan tertinggi berupa Bola Emas untuk pemain sepak bola?', a: 'ballon dor', hint: 'Bahasa Prancis dari Bola Emas' },
        { q: 'Negara mana yang menjadi tuan rumah Piala Eropa (Euro) 2024?', a: 'jerman', hint: 'Negara yang dijuluki Der Panzer' },
        { q: 'Klub asal Jerman yang bermarkas di Allianz Arena dan dijuluki Die Roten?', a: 'bayern munchen', hint: 'Rival abadi Borussia Dortmund' },
        { q: 'Klub mana yang memiliki trofi Liga Champions terbanyak?', a: 'real madrid', hint: 'Klub asal ibukota Spanyol, dijuluki Los Blancos' },
        { q: 'Negara mana yang memenangkan kompetisi Euro 2024?', a: 'spanyol', hint: 'Mengalahkan Inggris di laga final' },
        { q: 'Warna kartu yang diberikan wasit untuk mengusir pemain dari lapangan?', a: 'merah', hint: 'Warnanya mencolok' },
        { q: 'Berapa jumlah pemain dalam satu tim sepak bola yang berada di lapangan?', a: '11', hint: 'Sering disebut kesebelasan' }
    ],
    teknologi: [
        { q: 'Siapa pendiri Microsoft?', a: 'bill gates', hint: 'Orang terkaya di dunia beberapa tahun' },
        { q: 'Apa kepanjangan dari CPU?', a: 'central processing unit', hint: 'Otak dari komputer' },
        { q: 'Bahasa pemrograman apa yang digunakan untuk membuat WhatsApp pertama kali?', a: 'erlang', hint: 'Bukan Java, bukan Python' },
        { q: 'Siapa yang mendirikan Tesla Inc?', a: 'elon musk', hint: 'Juga punya SpaceX' },
        { q: 'Apa nama OS yang dikembangkan oleh Google untuk smartphone?', a: 'android', hint: 'Robot hijau sebagai logonya' },
        { q: 'Bahasa pemrograman populer yang memiliki nama dan logo seekor ular berbisa?', a: 'python', hint: 'Sering dipakai untuk AI dan Data Science' },
        { q: 'Perusahaan teknologi yang menciptakan iPhone dan Mac?', a: 'apple', hint: 'Logonya buah yang digigit' },
        { q: 'Library JavaScript populer yang sering digunakan untuk membangun bot WhatsApp?', a: 'baileys', hint: 'Sering dipasangkan dengan WASocket' },
        { q: 'Software yang digunakan untuk menjelajahi internet disebut?', a: 'browser', hint: 'Contohnya Chrome, Edge, Firefox' },
        { q: 'Platform berbagi video terbesar di dunia milik Google?', a: 'youtube', hint: 'Ikonnya tombol play berwarna merah' }
    ]
};

// ─── State sesi (mirroring WA: chatId -> sesi) ────────────────
// Web mapping: 1 user = 1 sesi (keyed by username)
const sesiTrivia = new Map(); // username -> { soal, jawaban, hint, kategori, pot, timeout, mulai }
const lastTriviaEvent = new Map(); // username -> { message, ts }

async function saveU(username, u, source) {
    const data = db.getData();
    if (source === 'wa') {
        const waId = db.getWebUsers()[username]?.waId;
        if (waId) data.users[waId] = u;
    } else {
        if (!data.webGameData) data.webGameData = {};
        data.webGameData[username] = u;
    }
    await db.saveData(data);
}

function cleanupLastEvent(username) {
    const e = lastTriviaEvent.get(username);
    if (!e) return null;
    if (Date.now() - e.ts > 60_000) { lastTriviaEvent.delete(username); return null; }
    return e.message;
}

function normalizeAnswer(textMessage) {
    const raw = String(textMessage || '').toLowerCase().trim();
    // WA logic: remove 1 leading non-word char so "!soekarno" becomes "soekarno"
    return raw.replace(/^[^\w\s]/, '').trim();
}

// GET /api/features/trivia/status
async function status(req, res) {
    const { username } = req.user;
    const e = cleanupLastEvent(username);
    if (!sesiTrivia.has(username)) return res.json({ success: true, active: false, lastEvent: e || null });
    const s = sesiTrivia.get(username);
    return res.json({
        success: true,
        active: true,
        kategori: s.kategori,
        soal: s.soal,
        pot: s.pot,
        mulai: s.mulai,
        timeoutAt: s.mulai + 30_000,
        lastEvent: e || null,
    });
}

// POST /api/features/trivia/start  body: { kategori? }
async function start(req, res) {
    const { username } = req.user;
    if (sesiTrivia.has(username)) {
        const s = sesiTrivia.get(username);
        return res.status(400).json({ success: false, message: `⚠️ Masih ada soal aktif!\n\n❓ ${s.soal}\n\nGunakan tombol STOP untuk skip.` });
    }

    const KATEGORI = Object.keys(SOAL_TRIVIA);
    let kategori = String(req.body.kategori || '').toLowerCase().trim();
    if (!kategori || !SOAL_TRIVIA[kategori]) {
        kategori = KATEGORI[Math.floor(Math.random() * KATEGORI.length)];
    }

    const bankSoal = SOAL_TRIVIA[kategori];
    const soalData = bankSoal[Math.floor(Math.random() * bankSoal.length)];

    // Mirror WA bot exactly:
    // const hadiah = Math.floor(Math.random() * 50000001) + 60000000;
    const hadiah = Math.floor(Math.random() * 50000001) + 60000000;
    const WAKTU = 30;
    const now = Date.now();

    const timeout = setTimeout(() => {
        if (sesiTrivia.has(username)) {
            sesiTrivia.delete(username);
            lastTriviaEvent.set(username, {
                ts: Date.now(),
                message: `⏰ WAKTU HABIS! Jawaban yang benar: ${soalData.a}`,
            });
        }
    }, WAKTU * 1000);

    sesiTrivia.set(username, {
        soal: soalData.q,
        jawaban: soalData.a,
        hint: soalData.hint,
        kategori,
        pot: hadiah,
        timeout,
        mulai: now,
    });

    return res.json({
        success: true,
        message: `🧠 TRIVIA BATTLE!\nKategori: ${kategori.toUpperCase()}\nHadiah: ${hadiah.toLocaleString('id-ID')} koin\nWaktu: ${WAKTU} detik\n\n❓ ${soalData.q}`,
        kategori,
        soal: soalData.q,
        pot: hadiah,
        mulai: now,
        timeoutAt: now + WAKTU * 1000,
    });
}

// POST /api/features/trivia/answer  body: { answer }
async function answer(req, res) {
    const { username } = req.user;
    if (!sesiTrivia.has(username)) return res.status(400).json({ success: false, message: '❌ Tidak ada sesi trivia aktif. Tekan MULAI untuk mulai!' });

    const { source, data: u } = getUserGameData(username);
    const s = sesiTrivia.get(username);
    const jawabanAsli = String(s.jawaban || '').toLowerCase().trim();
    const jawabanUser = normalizeAnswer(req.body.answer);

    if (!jawabanUser) return res.status(400).json({ success: false, message: '❌ Jawaban kosong.' });

    const cocok = jawabanUser === jawabanAsli
        || jawabanAsli.split(' ').some(w => w.length > 3 && jawabanUser.includes(w));

    if (!cocok) return res.json({ success: true, correct: false, message: '❌ Salah! Coba lagi.' });

    clearTimeout(s.timeout);
    sesiTrivia.delete(username);

    const hadiah = s.pot;
    u.balance = (u.balance || 0) + hadiah;
    if (!u.triviaSkor) u.triviaSkor = 0;
    u.triviaSkor += 1;
    await saveU(username, u, source);

    const elapsed = ((Date.now() - s.mulai) / 1000).toFixed(1);
    return res.json({
        success: true,
        correct: true,
        reward: hadiah,
        balance: u.balance,
        message: `🎉 BENAR!\n✅ Jawaban: ${s.jawaban}\n⏱️ Waktu: ${elapsed} detik\n💰 Hadiah: +${fmt(hadiah)} koin`,
    });
}

// POST /api/features/trivia/hint
async function hint(req, res) {
    const { username } = req.user;
    if (!sesiTrivia.has(username)) return res.status(400).json({ success: false, message: '❌ Tidak ada sesi trivia aktif.' });
    const s = sesiTrivia.get(username);
    return res.json({ success: true, hint: s.hint, message: `💡 HINT:\n${s.hint}` });
}

// POST /api/features/trivia/stop
async function stop(req, res) {
    const { username } = req.user;
    if (!sesiTrivia.has(username)) return res.status(400).json({ success: false, message: '❌ Tidak ada sesi trivia aktif.' });
    const s = sesiTrivia.get(username);
    clearTimeout(s.timeout);
    sesiTrivia.delete(username);
    return res.json({ success: true, message: `🛑 Trivia dihentikan.\nJawaban yang benar: ${s.jawaban}` });
}

// GET /api/features/trivia/leaderboard
async function leaderboard(req, res) {
    const allUsers = Object.entries(db.getUsers() || {})
        .filter(([, u]) => u.triviaSkor && u.triviaSkor > 0)
        .sort(([, a], [, b]) => (b.triviaSkor || 0) - (a.triviaSkor || 0))
        .slice(0, 10)
        .map(([id, u]) => ({
            id,
            name: u.name || u.pushName || String(id).replace('@s.whatsapp.net', ''),
            triviaSkor: u.triviaSkor || 0,
        }));

    const { username } = req.user;
    const { data: me } = getUserGameData(username);

    return res.json({
        success: true,
        leaderboard: allUsers,
        me: { triviaSkor: me.triviaSkor || 0 },
    });
}

module.exports = { status, start, answer, hint, stop, leaderboard };

