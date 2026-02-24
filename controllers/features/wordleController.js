// ============================================================
//  controllers/features/wordleController.js
//  Porting dari BOT-WA-1-main/commands/wordle.js (single source of truth)
// ============================================================

const db = require('../../config/database');
const { getUserGameData } = require('../userController');

// ─── Bank kata (copied 1:1 from WA bot) ──────────────────────
const KATA_WORDLE = [
    'apung','basmi','bukit','damai','datar','debut','delta',
    'elang','emosi','fajar','fakta','fiber','gajah','galau',
    'games','hasil','hutan','indah','ingin','janji','jarak',
    'kapal','karma','kilat','laris','layar','lemah','mandi',
    'manis','media','mewah','modal','mogok','mulia','nabak',
    'nakal','namun','nyata','obati','ojek','padat','paham',
    'pakta','pamer','pecah','peluk','pesan','pilih','pokok',
    'pulau','putar','ramai','ramai','rezki','ribet','rinci',
    'rindu','risau','robot','rusak','sabun','sadar','salah',
    'saraf','saran','sasar','sebab','sehat','sejuk','senam',
    'sendu','setan','siaga','sigap','sikap','sinyal','situs',
    'slang','solusi','sopan','suara','subuh','sulit','surya',
    'tagih','taraf','tatap','tawar','tebal','tegas','tekad',
    'tekun','teman','teras','terus','tiket','timur','tiruan',
    'tobat','tokoh','total','tulus','turun','tutor','ujian',
    'ukuran','ulang','ummat','unggu','unik','usaha','utama',
    'wadah','wajib','warna','wisma','yakin','zaman','zebra',
    'angan','ancam','angin','angka','anjur','antri','antre',
    'aroma','aspal','asrama','atasi','atlas','audit','avant',
    'babak','bahas','bakso','balik','bandu','bantu','bayar',
    'benci','benih','berat','beras','bibir','bidan','bisik',
    'blokir','bocah','bohon','bokep','bolak','bonus','bosan',
    'bunga','cakap','candu','catat','cerah','ceria','cicil',
    'cipta','covid','cuaca','cubit','daftar','dahak','dapur',
    'dekat','detik','dewas','dixit','donat','donor','drama',
    'dunia','durian','dunia','eBook','edisi','efisi','ejaan',
    'eksis','ekspo','email','empal','empat','empuk','energi',
    'error','esain','etika','fabel','faham','fajar','faksi',
    'famil','fobia','fokus','forum','foyer','franc','frasa',
    'gabah','gabung','gadai','gadis','gairah','galak','galeri',
    'galon','gamis','gatal','gaung','gebuk','gelap','gelar',
    'gerak','gigit','gitar','glokal','gobar','gosip','gurun',
    'habis','hadas','hamba','hantu','hapus','harga','harum',
    'hemat','hewani','hidup','hisab','hobby','honor','horor',
    'hujan','humor','huruf','ikhlas','imbal','imobil','induk',
    'infus','insan','intro','irama','ironi','iuran','jajan',
    'jalur','janji','jatuh','jenis','jepang','jerih','jodoh',
    'joget','juara','jumbo','jumlah','jurus','kadang','kaget',
    'kait','kalah','kaldu','kamus','karir','kasih','kejar',
    'keras','kerja','kinal','kiper','kirim','kocak','koran',
    'kotor','kritis','kunci','kuota','kurang','kursi','label',
    'lapar','lapas','laser','latih','lekas','lelah','lemak',
    'lewat','lihai','lirik','logis','longsor','lower','loyal',
    'lumut','lurus','macam','makan','makna','malam','maleh',
    'mana','mandek','masih','masuk','matang','mudah','mulai',
    'murni','musik','mutus','nafsu','nakal','napas','naskah',
    'nazar','ngeri','niaga','nikah','nikmat','norma','oasis',
    'obral','oknum','omong','orasi','orang','otak','pacuan',
    'palas','panas','panel','panen','papan','pasar','pasif',
    'pasok','paten','patuh','pawal','pecah','pelik','perlu',
    'pikir','pintar','piket','pindah','pinta','polis','polri',
    'ponsel','positif','potret','praja','premi','prosa','publik',
    'puisi','pupuk','purna','pusara','pusing','rawat','rebut',
    'rehat','rejeki','rekam','rekap','rekan','rekor','rehat',
    'rencana','rentan','retas','riset','ritual','royak','ruhut',
    'sadap','sahur','sakit','saksi','salat','sambal','santu',
    'sarjana','sayang','selalu','selang','selat','senjata','senyum',
    'setara','simak','simpan','sindir','sitir','skala','skema',
    'solat','somasi','sosial','sosmed','speedy','standar','strategi',
    'studi','subyek','sukses','sumber','syarat','tacit','tahan',
    'tahap','tajam','tambah','tampil','tanah','tangkap','target',
    'taruh','teman','tempat','tengah','tenang','terima','ternak',
    'tidak','tidur','tilang','tipu','topik','tradisi','transfer',
    'tumbuh','tunai','tugas','ungkap','upsert','uraian','usaha',
    'utang','utara','utara','vaksin','valid','video','viral',
    'visum','voters','wajah','walau','wanita','waras','warung',
    'wasit','water','waktu','weleh','wewenang','wirausaha','zakat',
];

// Filter hanya 5 huruf
const KATA_5 = [...new Set(KATA_WORDLE.filter(k => k.length === 5))];

// ─── Sesi game (mirroring WA: per user) ───────────────────────
const sesiWordle = new Map(); // username -> { kata, attempts, maxAttempts, startTime }

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

function renderBoard(attempts, kata) {
    if (attempts.length === 0) return '_(Belum ada tebakan)_';
    let board = '';
    for (const tebak of attempts) {
        let baris = '';
        let hasil = '';
        for (let i = 0; i < 5; i++) {
            const c = tebak[i].toUpperCase();
            if (c === kata[i].toUpperCase()) {
                baris += '🟩';
                hasil += c;
            } else if (kata.toUpperCase().includes(c)) {
                baris += '🟨';
                hasil += c;
            } else {
                baris += '⬜';
                hasil += c;
            }
        }
        board += `${baris} *${hasil}*\n`;
    }
    return board;
}

function renderKeyboard(attempts, kata) {
    const hurufBenar = new Set();
    const hurufAda = new Set();
    const hurufSalah = new Set();
    for (const tebak of attempts) {
        for (let i = 0; i < 5; i++) {
            const c = tebak[i].toUpperCase();
            if (c === kata[i].toUpperCase()) hurufBenar.add(c);
            else if (kata.toUpperCase().includes(c)) hurufAda.add(c);
            else hurufSalah.add(c);
        }
    }
    const abc = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    let key = '';
    for (const c of abc) {
        if (hurufBenar.has(c)) key += '✅';
        else if (hurufAda.has(c)) key += '🟨';
        else if (hurufSalah.has(c)) key += '❌';
        else key += c;
    }
    return key;
}

function ensureStat(u) {
    if (!u.wordleStat) u.wordleStat = { menang: 0, kalah: 0, streak: 0, bestStreak: 0, gamesPlayed: 0 };
}

// GET /api/features/wordle/status
async function status(req, res) {
    const { username } = req.user;
    if (!sesiWordle.has(username)) return res.json({ success: true, active: false });
    const s = sesiWordle.get(username);
    return res.json({
        success: true,
        active: true,
        attempts: s.attempts,
        maxAttempts: s.maxAttempts,
        board: renderBoard(s.attempts, s.kata),
        keyboard: renderKeyboard(s.attempts, s.kata),
        remaining: s.maxAttempts - s.attempts.length,
    });
}

// POST /api/features/wordle/start
async function start(req, res) {
    const { username } = req.user;
    if (sesiWordle.has(username)) {
        const s = sesiWordle.get(username);
        return res.status(400).json({
            success: false,
            message: `🟩 WORDLE AKTIF\nSisa percobaan: ${s.maxAttempts - s.attempts.length}/${s.maxAttempts}`,
            board: renderBoard(s.attempts, s.kata),
        });
    }
    const kata = KATA_5[Math.floor(Math.random() * KATA_5.length)];
    sesiWordle.set(username, { kata, attempts: [], maxAttempts: 6, startTime: Date.now() });
    return res.json({
        success: true,
        message: '🟩 WORDLE INDONESIA dimulai! Tebak kata 5 huruf dalam 6 kesempatan.',
    });
}

// POST /api/features/wordle/guess  body: { guess }
async function guess(req, res) {
    const { username } = req.user;
    if (!sesiWordle.has(username)) return res.status(400).json({ success: false, message: '❌ Belum ada game aktif! Tekan MULAI untuk mulai.' });

    const tebakan = String(req.body.guess || '').toLowerCase().trim();
    if (tebakan.length !== 5) return res.status(400).json({ success: false, message: '❌ Kata harus 5 huruf! Coba lagi.' });
    if (!/^[a-z]+$/.test(tebakan)) return res.status(400).json({ success: false, message: '❌ Hanya huruf A-Z yang diperbolehkan!' });

    const session = sesiWordle.get(username);
    if (session.attempts.includes(tebakan)) return res.status(400).json({ success: false, message: `⚠️ Kata "${tebakan.toUpperCase()}" sudah pernah ditebak!` });

    session.attempts.push(tebakan);
    const isWin = tebakan === session.kata;
    const isGameOver = session.attempts.length >= session.maxAttempts;

    const board = renderBoard(session.attempts, session.kata);
    const keyboard = renderKeyboard(session.attempts, session.kata);
    const remaining = session.maxAttempts - session.attempts.length;

    const { source, data: u } = getUserGameData(username);
    ensureStat(u);

    if (isWin) {
        sesiWordle.delete(username);
        const elapsed = Math.floor((Date.now() - session.startTime) / 1000);
        u.wordleStat.menang++;
        u.wordleStat.streak++;
        u.wordleStat.gamesPlayed++;
        if (u.wordleStat.streak > u.wordleStat.bestStreak) u.wordleStat.bestStreak = u.wordleStat.streak;

        // Mirror WA reward formula exactly
        const hadiahMaksimal = 200000000;
        const penguranganPerSalah = 30000000;
        const hadiah = Math.max(hadiahMaksimal - (session.attempts.length - 1) * penguranganPerSalah, 50000000);
        u.balance = (u.balance || 0) + hadiah;
        await saveU(username, u, source);

        return res.json({
            success: true,
            done: true,
            won: true,
            word: session.kata.toUpperCase(),
            reward: hadiah,
            balance: u.balance,
            board,
            keyboard,
            message: `🎉 HEBAT! BENAR!\n✅ Kata: ${session.kata.toUpperCase()}\n🎯 Percobaan ke-${session.attempts.length}\n⏱️ Waktu: ${elapsed} detik\n💰 Hadiah: +${hadiah} koin\n🔥 Streak: ${u.wordleStat.streak}`,
        });
    }

    if (isGameOver) {
        sesiWordle.delete(username);
        u.wordleStat.kalah++;
        u.wordleStat.streak = 0;
        u.wordleStat.gamesPlayed++;
        await saveU(username, u, source);

        return res.json({
            success: true,
            done: true,
            won: false,
            word: session.kata.toUpperCase(),
            board,
            keyboard,
            message: `💀 GAME OVER!\n❌ Kata yang benar: ${session.kata.toUpperCase()}\n💀 Streak rusak.`,
        });
    }

    return res.json({
        success: true,
        done: false,
        remaining,
        board,
        keyboard,
        message: `🟩 WORDLE — Sisa: ${remaining} percobaan lagi`,
    });
}

// POST /api/features/wordle/stop
async function stop(req, res) {
    const { username } = req.user;
    if (!sesiWordle.has(username)) return res.status(400).json({ success: false, message: '❌ Tidak ada game aktif.' });
    const session = sesiWordle.get(username);
    sesiWordle.delete(username);

    const { source, data: u } = getUserGameData(username);
    ensureStat(u);
    u.wordleStat.kalah++;
    u.wordleStat.streak = 0;
    u.wordleStat.gamesPlayed++;
    await saveU(username, u, source);

    return res.json({ success: true, word: session.kata.toUpperCase(), message: `🏳️ Game dihentikan.\nJawaban: ${session.kata.toUpperCase()}` });
}

// GET /api/features/wordle/stats
async function stats(req, res) {
    const { username } = req.user;
    const { data: u } = getUserGameData(username);
    ensureStat(u);
    const s = u.wordleStat;
    const winRate = s.gamesPlayed > 0 ? Number(((s.menang / s.gamesPlayed) * 100).toFixed(0)) : 0;
    return res.json({ success: true, stats: { ...s, winRate } });
}

module.exports = { status, start, guess, stop, stats };

