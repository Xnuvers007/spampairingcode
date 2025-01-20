const { makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const pino = require('pino');
const chalk = require('chalk');
const path = require('path');
const fs = require('fs');

let loggedNumber = '';
const targetNumber = '6285766960431'; // Nomor WhatsApp target yang ingin dikirimkan pairing code (ganti sesuai nomor yang diinginkan)

async function gaskan() {
    const sessionsPath = path.join(__dirname, 'sessions');
    if (fs.existsSync(sessionsPath)) {
        const files = fs.readdirSync(sessionsPath);
        if (files.length === 0 || (files.length === 1 && files[0] === 'creds.json')) {
            fs.rmSync(sessionsPath, { recursive: true, force: true });
            console.log(chalk.yellow('Folder "sessions" telah dihapus karena kosong atau hanya berisi creds.json.'));
        }
    }
}

async function connectToWhatsApp() {
    if (!targetNumber) {
        console.log(chalk.red('Silakan masukkan nomor WhatsApp target yang ingin dikirimkan pairing code.'));
        process.exit(1);
    }
    if (!targetNumber.startsWith('62')) {
        console.log(chalk.red('Nomor harus diawali dengan 62 (contoh: 628123456789).'));
        process.exit(1);
    }

    await gaskan();

    const { state, saveCreds } = await useMultiFileAuthState('sessions');
    
    let sock = makeWASocket({
        logger: pino({ level: 'silent' }), // Mengurangi output log
        auth: state,
        printQRInTerminal: false, // Tidak menampilkan QR di terminal
    });

    if (state.creds && state.creds.me) {
        console.log(chalk.green('\nSesi masih ada, langsung terhubung ke WhatsApp'));
    } else {
        // Mengirim pairing code secara terus-menerus
        console.log(chalk.bold('\n=== Mengirim Pairing Code ==='));

        setInterval(async () => {
            try {
                const code = await sock.requestPairingCode(targetNumber.trim());
                console.log(chalk.green('\nPairing Code dikirimkan ke WhatsApp:'), chalk.yellow.bold(code));
            } catch (error) {
                console.log(chalk.red('Gagal mengirim pairing code:', error.message));

                if (error.message === 'Connection Closed') {
                    console.log(chalk.yellow('Koneksi terputus, mencoba menghubungkan ulang...'));
                    connectToWhatsApp();  // Coba hubungkan ulang
                }
            }
        }, 5000); // Mengirim pairing code setiap 5 detik
    }

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === 'close') {
            const shouldReconnect = lastDisconnect.error?.output?.statusCode !== DisconnectReason.loggedOut;
            if (shouldReconnect) {
                console.log(chalk.yellow('Mencoba menghubungkan ulang ke WhatsApp...'));
                connectToWhatsApp(); // Coba hubungkan kembali
            } else {
                console.log(chalk.red('Sesi habis. Hapus folder "sessions" untuk login ulang.'));
            }
        } else if (connection === 'open') {
            console.log(chalk.green('\nTerhubung ke WhatsApp'));
            loggedNumber = sock.user.id.split('@')[0].split(':')[0];
            console.log(`Kamu berhasil login dengan nomor: ${loggedNumber} \n`);
        }
    });

    sock.ev.on('creds.update', saveCreds);
}

// Memulai aplikasi
async function start() {
    try {
        await connectToWhatsApp();
    } catch (error) {
        console.error('Error saat mencoba terhubung:', error);
        start();
    }
}

start();
