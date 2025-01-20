const { makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const pino = require('pino');
const chalk = require('chalk');
const path = require('path');
const fs = require('fs');
const readline = require('readline');

let loggedNumber = ''; 
let targetNumber = '' // 6285766960431 6285841093710
let timeinterval = ''

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

    console.log(chalk.bold('\n=== Mengirim Pairing Code ke Nomor WhatsApp ==='));
    console.log(chalk.cyan('Nomor WhatsApp target:'), chalk.yellow(targetNumber));
    console.log(chalk.cyan('Interval pengiriman pairing code:'), chalk.yellow(timeinterval + ' detik'));
    console.log(chalk.cyan('Interval pengiriman pairing code:'), chalk.yellow(timeinterval / 1000 + ' detik'));
    

    await gaskan();

    const { state, saveCreds } = await useMultiFileAuthState('sessions');
    
    let sock = makeWASocket({
        logger: pino({ level: 'silent' }),
        auth: state,
        printQRInTerminal: false,
    });

    if (state.creds && state.creds.me) {
        console.log(chalk.green('\nSesi masih ada, langsung terhubung ke WhatsApp'));
    } else {
        console.log(chalk.bold('\n=== Mengirim Pairing Code ==='));

        setInterval(async () => {
            try {
                const code = await sock.requestPairingCode(targetNumber.trim());
                console.log(chalk.green('\nPairing Code dikirimkan ke WhatsApp:'), chalk.yellow.bold(code));
            } catch (error) {
                console.log(chalk.red('Gagal mengirim pairing code:', error.message));

                if (error.message === 'Connection Closed') {
                    console.log(chalk.yellow('Koneksi terputus, mencoba menghubungkan ulang...'));
                    connectToWhatsApp();
                }
            }
        }, timeinterval);
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
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });
    
    console.log(chalk.bold('\n=== Kirim Pairing Code ke Nomor WhatsApp ==='));
    rl.question(chalk.cyan('Masukkan nomor WhatsApp target (contoh: 628123456789): '), (answer) => {
        targetNumber = answer;
        if (!targetNumber) {
            console.log(chalk.red('Nomor WhatsApp target tidak boleh kosong.'));
            rl.close();
            start();
            return;
        } else if (!targetNumber.startsWith('62')) {
            console.log(chalk.red('Nomor harus diawali dengan 62 (contoh: 628123456789).'));
            rl.close();
            start();
            return;
        }
        rl.question(chalk.cyan('Masukkan interval pengiriman pairing code (dalam detik): '), (answer) => {
            if (!/^\d+$/.test(answer)) {
                console.log(chalk.red('Interval hanya boleh berisi angka.'));
                rl.close();
                start();
                return;
            } else if (!answer) {
                console.log(chalk.red('Interval pengiriman pairing code tidak boleh kosong.'));
                rl.close();
                start();
                return;
            }
            timeinterval = parseInt(answer) * 1000;
            try {
                connectToWhatsApp();
            } catch (error) {
                console.error('Error saat mencoba terhubung:', error);
                start();
            }
            rl.close();
        });
    });
}

start();
