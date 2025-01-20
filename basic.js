const { makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const pino = require('pino');
const chalk = require('chalk');

let loggedNumber = ''; // Nomor yang sudah login
const targetNumber = '6285766960431'; // Nomor WhatsApp target yang ingin dikirimkan pairing code (ganti sesuai nomor yang diinginkan)

async function connectToWhatsApp() {
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
                console.log(chalk.red('Gagal mengirim pairing code:', error));
            }
        }, 5000); // Masukin berapa detik, 5 detik = 5000
    }

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === 'close') {
            const shouldReconnect = lastDisconnect.error?.output?.statusCode !== DisconnectReason.loggedOut;
            if (shouldReconnect) {
                console.log(chalk.yellow('Mencoba menghubungkan ulang ke WhatsApp...'));
                connectToWhatsApp();
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

async function start() {
    connectToWhatsApp().catch(console.error);
}

start();
