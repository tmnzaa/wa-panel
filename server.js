const express = require("express");
const path = require("path");
const fs = require("fs");

const {
    default: makeWASocket,
    useMultiFileAuthState,
    fetchLatestWaWebVersion,
    Browsers,
    DisconnectReason
} = require("@whiskeysockets/baileys");

const pino = require("pino");
const { handleMessage } = require("./bot");

// ==================================================
// EXPRESS
// ==================================================

const app = express();

app.use(express.json());

app.use(
    express.static(
        path.join(__dirname, "public")
    )
);

// ==================================================
// PATH
// ==================================================

const DATA_DIR =
    path.join(__dirname, "data");

const CONFIG_FILE =
    path.join(DATA_DIR, "config.json");

const SESSIONS_DIR =
    path.join(__dirname, "sessions");

fs.mkdirSync(DATA_DIR, {
    recursive: true
});

fs.mkdirSync(SESSIONS_DIR, {
    recursive: true
});

// ==================================================
// GLOBAL STATE
// ==================================================

let sock = null;
let status = "OFFLINE";
let pairingCode = null;
let lastError = null;
let currentNumber = null;
let connecting = false;
let botActive = false;
let manualStop = false;

// ==================================================
// CONFIG
// ==================================================

function loadConfig() {
    try {
        if (!fs.existsSync(CONFIG_FILE)) {
            return {
                phone: null
            };
        }

        const data =
            fs.readFileSync(
                CONFIG_FILE,
                "utf8"
            );

        return JSON.parse(data);

    } catch (error) {
        console.error(
            "❌ Gagal membaca config:",
            error.message
        );

        return {
            phone: null
        };
    }
}

function saveConfig(phone) {
    try {
        const config = {
            phone
        };

        fs.writeFileSync(
            CONFIG_FILE,
            JSON.stringify(
                config,
                null,
                4
            )
        );

        console.log(
            "💾 Config nomor disimpan."
        );

    } catch (error) {
        console.error(
            "❌ Gagal menyimpan config:",
            error.message
        );
    }
}

// ==================================================
// CONNECT WHATSAPP
// ==================================================

async function connectWhatsApp(phoneNumber) {
    if (connecting) {
        console.log(
            "⚠️ Koneksi sedang diproses."
        );

        return;
    }

    connecting = true;
    manualStop = false;

    try {
        const cleanNumber =
            String(phoneNumber)
                .replace(/\D/g, "");

        if (!cleanNumber) {
            throw new Error(
                "Nomor WhatsApp tidak valid."
            );
        }

        currentNumber =
            cleanNumber;

        saveConfig(
            cleanNumber
        );

        status = "CONNECTING";
        pairingCode = null;
        lastError = null;
        botActive = false;

        console.log("");
        console.log(
            "========================================"
        );
        console.log(
            "📱 NOMOR:",
            cleanNumber
        );
        console.log(
            "========================================"
        );

        // ==================================================
        // SESSION
        // ==================================================

        const sessionPath =
            path.join(
                SESSIONS_DIR,
                cleanNumber
            );

        const {
            state,
            saveCreds
        } =
            await useMultiFileAuthState(
                sessionPath
            );

        // ==================================================
        // WHATSAPP WEB VERSION
        // ==================================================

        console.log(
            "🌐 Mengambil versi WhatsApp Web..."
        );

        const {
            version
        } =
            await fetchLatestWaWebVersion({});

        console.log(
            "WA Web version:",
            version
        );

        // ==================================================
        // SOCKET
        // ==================================================

        sock = makeWASocket({
            version,

            auth: state,

            browser:
                Browsers.ubuntu(
                    "Chrome"
                ),

            logger:
                pino({
                    level: "silent"
                }),

            printQRInTerminal: false,

            connectTimeoutMs: 60000,

            defaultQueryTimeoutMs: 60000,

            keepAliveIntervalMs: 30000
        });

        // ==================================================
        // SAVE CREDENTIALS
        // ==================================================

        sock.ev.on(
            "creds.update",
            saveCreds
        );

        // ==================================================
        // MESSAGE HANDLER
        // ==================================================

        sock.ev.on(
            "messages.upsert",
            async ({ messages }) => {
                for (const msg of messages) {
                    try {
                        await handleMessage(
                            sock,
                            msg,
                            currentNumber
                        );

                    } catch (error) {
                        console.error(
                            "❌ Bot error:",
                            error
                        );
                    }
                }
            }
        );

        // ==================================================
        // CONNECTION UPDATE
        // ==================================================

        sock.ev.on(
            "connection.update",
            async (update) => {
                const {
                    connection,
                    lastDisconnect
                } = update;

                console.log(
                    "Connection:",
                    connection
                );

                // ==================================================
                // ONLINE
                // ==================================================

                if (
                    connection === "open"
                ) {
                    status = "ONLINE";
                    pairingCode = null;
                    lastError = null;
                    connecting = false;
                    botActive = true;

                    console.log("");
                    console.log(
                        "========================================"
                    );
                    console.log(
                        "✅ WHATSAPP ONLINE"
                    );
                    console.log(
                        "🤖 BOT AKTIF"
                    );
                    console.log(
                        "📱 Nomor:",
                        currentNumber
                    );
                    console.log(
                        "========================================"
                    );
                    console.log("");
                }

                // ==================================================
                // CLOSED
                // ==================================================

                if (
                    connection === "close"
                ) {
                    const error =
                        lastDisconnect?.error;

                    const statusCode =
                        error?.output?.statusCode;

                    console.log("");
                    console.log(
                        "❌ WhatsApp terputus"
                    );
                    console.log(
                        "Status code:",
                        statusCode
                    );

                    if (error) {
                        console.log(
                            "Disconnect:",
                            error
                        );
                    }

                    sock = null;
                    pairingCode = null;
                    botActive = false;

                    // ==================================================
                    // MANUAL STOP
                    // ==================================================

                    if (manualStop) {
                        console.log(
                            "🛑 Disconnect karena bot dihentikan."
                        );

                        status = "OFFLINE";
                        connecting = false;

                        return;
                    }

                    // ==================================================
                    // STATUS 515
                    // ==================================================

                    if (
                        statusCode === 515
                    ) {
                        console.log("");
                        console.log(
                            "⚠️ WhatsApp meminta restart socket."
                        );
                        console.log(
                            "🔄 Reconnect dalam 3 detik..."
                        );

                        status =
                            "CONNECTING";

                        connecting = false;

                        setTimeout(
                            () => {
                                connectWhatsApp(
                                    cleanNumber
                                ).catch(
                                    error => {
                                        console.error(
                                            "❌ Reconnect error:",
                                            error.message
                                        );
                                    }
                                );
                            },
                            3000
                        );

                        return;
                    }

                    // ==================================================
                    // LOGGED OUT
                    // ==================================================

                    if (
                        statusCode ===
                        DisconnectReason.loggedOut
                    ) {
                        status = "OFFLINE";

                        lastError =
                            "WhatsApp logout. Session perlu dipairing ulang.";

                        connecting = false;
                        botActive = false;

                        console.log(
                            "⚠️ WhatsApp logout."
                        );

                        console.log(
                            "Session tidak lagi valid."
                        );

                        return;
                    }

                    // ==================================================
                    // DISCONNECT LAINNYA
                    // ==================================================

                    status = "OFFLINE";
                    connecting = false;
                    botActive = false;

                    setTimeout(
                        () => {
                            if (
                                currentNumber &&
                                !manualStop
                            ) {
                                console.log(
                                    "🔄 Mencoba reconnect otomatis..."
                                );

                                connectWhatsApp(
                                    currentNumber
                                ).catch(
                                    error => {
                                        console.error(
                                            "❌ Reconnect error:",
                                            error.message
                                        );
                                    }
                                );
                            }
                        },
                        5000
                    );
                }
            }
        );

        // ==================================================
        // PAIRING CODE
        // ==================================================

        if (
            !state.creds.registered
        ) {
            console.log("");
            console.log(
                "⏳ Session belum terdaftar."
            );

            console.log(
                "⏳ Menunggu socket..."
            );

            await new Promise(
                resolve =>
                    setTimeout(
                        resolve,
                        5000
                    )
            );

            if (!sock) {
                connecting = false;

                throw new Error(
                    "Socket WhatsApp tertutup sebelum pairing code dibuat."
                );
            }

            console.log(
                "🔑 Meminta pairing code..."
            );

            const code =
                await sock.requestPairingCode(
                    cleanNumber
                );

            pairingCode = code;

            console.log("");
            console.log(
                "========================================"
            );
            console.log(
                "🔑 PAIRING CODE:",
                code
            );
            console.log(
                "========================================"
            );
            console.log("");

        } else {
            console.log("");
            console.log(
                "♻️ Session ditemukan."
            );

            console.log(
                "🔄 Tidak perlu pairing ulang."
            );

            console.log("");
        }

    } catch (error) {
        connecting = false;
        status = "ERROR";
        botActive = false;
        pairingCode = null;
        lastError =
            error.message;

        console.log("");
        console.log(
            "========================================"
        );
        console.log(
            "❌ ERROR CONNECT"
        );
        console.error(error);
        console.log(
            "========================================"
        );
        console.log("");
    }
}

// ==================================================
// STOP WHATSAPP
// ==================================================

function stopWhatsApp() {
    console.log("");
    console.log(
        "🛑 Menghentikan bot..."
    );

    manualStop = true;
    connecting = false;
    botActive = false;

    if (sock) {
        try {
            sock.end(
                undefined
            );

        } catch (error) {
            console.log(
                "Gagal menutup socket:",
                error.message
            );
        }
    }

    sock = null;
    status = "OFFLINE";
    pairingCode = null;

    console.log(
        "✅ Bot berhenti."
    );

    console.log(
        "💾 Session tetap disimpan."
    );
}

// ==================================================
// API STATUS
// ==================================================

app.get(
    "/api/status",
    (req, res) => {
        res.json({
            status,
            pairingCode,
            error: lastError,
            phone: currentNumber,
            botActive
        });
    }
);

// ==================================================
// API CONNECT
// ==================================================

app.post(
    "/api/connect",
    async (req, res) => {
        try {
            const {
                phone
            } = req.body;

            if (!phone) {
                return res.status(400).json({
                    success: false,
                    error:
                        "Nomor WhatsApp belum diisi."
                });
            }

            if (
                status === "ONLINE" ||
                status === "CONNECTING"
            ) {
                return res.json({
                    success: true,
                    message:
                        "WhatsApp sedang diproses."
                });
            }

            connectWhatsApp(
                phone
            );

            res.json({
                success: true,
                message:
                    "Proses koneksi dimulai."
            });

        } catch (error) {
            res.status(500).json({
                success: false,
                error:
                    error.message
            });
        }
    }
);

// ==================================================
// API STOP
// ==================================================

app.post(
    "/api/stop",
    (req, res) => {
        stopWhatsApp();

        res.json({
            success: true,
            message:
                "Bot dihentikan."
        });
    }
);

// ==================================================
// AUTO START
// ==================================================

async function autoStart() {
    const config =
        loadConfig();

    if (!config.phone) {
        console.log("");
        console.log(
            "ℹ️ Belum ada nomor tersimpan."
        );

        console.log(
            "Silakan connect dari panel."
        );

        console.log("");

        return;
    }

    currentNumber =
        config.phone;

    console.log("");
    console.log(
        "========================================"
    );

    console.log(
        "♻️ SESSION OTOMATIS"
    );

    console.log(
        "📱 Nomor:",
        currentNumber
    );

    console.log(
        "🔄 Mencoba reconnect..."
    );

    console.log(
        "========================================"
    );

    console.log("");

    await connectWhatsApp(
        currentNumber
    );
}

// ==================================================
// START SERVER
// ==================================================

const PORT =
    process.env.PORT || 3000;

const HOST =
    "0.0.0.0";

app.listen(
    PORT,
    HOST,
    () => {
        console.log("");
        console.log(
            "========================================"
        );

        console.log(
            "🤖 WA GUARD BOT PANEL"
        );

        console.log(
            "========================================"
        );

        console.log(
            `🌐 Port: ${PORT}`
        );

        console.log(
            `🌐 Host: ${HOST}`
        );

        console.log(
            "========================================"
        );

        console.log("");

        autoStart();
    }
);