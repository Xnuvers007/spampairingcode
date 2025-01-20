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
        }, 3000); // Mengirim pairing code setiap 5 detik (5000 ms)
    }

    sock.ev.on('creds.update', saveCreds);
}

async function start() {
    connectToWhatsApp().catch(console.error);
}

start();
