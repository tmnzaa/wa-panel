// ==================================================
// WA GUARD BOT
// BOT.JS
// Prefix: #
// ==================================================

const BOT_NAME = "WA GUARD BOT";
const PREFIX = "#";
const startedAt = Date.now();


// ==================================================
// MESSAGE TEXT
// ==================================================

function getMessageText(msg) {
    if (!msg || !msg.message) {
        return "";
    }

    return (
        msg.message.conversation ||
        msg.message.extendedTextMessage?.text ||
        msg.message.imageMessage?.caption ||
        msg.message.videoMessage?.caption ||
        ""
    ).trim();
}


// ==================================================
// GROUP CHECK
// ==================================================

function isGroup(jid) {
    return Boolean(
        jid && jid.endsWith("@g.us")
    );
}


// ==================================================
// GET SENDER
// ==================================================

function getSender(msg, jid) {
    return (
        msg.key?.participant ||
        msg.participant ||
        jid
    );
}


// ==================================================
// FORMAT NUMBER
// ==================================================

function formatNumber(jid) {
    if (!jid) {
        return "-";
    }

    return jid
        .split("@")[0]
        .replace(/:\d+$/, "");
}


// ==================================================
// FORMAT RUNTIME
// ==================================================

function formatRuntime(ms) {
    let seconds = Math.floor(ms / 1000);

    const days = Math.floor(seconds / 86400);
    seconds %= 86400;

    const hours = Math.floor(seconds / 3600);
    seconds %= 3600;

    const minutes = Math.floor(seconds / 60);
    seconds %= 60;

    const result = [];

    if (days) {
        result.push(`${days} hari`);
    }

    if (hours) {
        result.push(`${hours} jam`);
    }

    if (minutes) {
        result.push(`${minutes} menit`);
    }

    result.push(`${seconds} detik`);

    return result.join(", ");
}


// ==================================================
// GET ADMINS
// ==================================================

function getAdmins(metadata) {
    if (
        !metadata ||
        !Array.isArray(metadata.participants)
    ) {
        return [];
    }

    return metadata.participants.filter(
        participant =>
            participant.admin ||
            participant.isAdmin ||
            participant.isSuperAdmin
    );
}


// ==================================================
// CHECK ADMIN
// ==================================================

function isAdmin(metadata, jid) {
    if (
        !metadata ||
        !Array.isArray(metadata.participants)
    ) {
        return false;
    }

    const participant =
        metadata.participants.find(
            item =>
                item.id === jid ||
                item.jid === jid
        );

    if (!participant) {
        return false;
    }

    return Boolean(
        participant.admin ||
        participant.isAdmin ||
        participant.isSuperAdmin
    );
}


// ==================================================
// SEND TEXT
// ==================================================

async function sendText(
    sock,
    jid,
    text,
    options = {}
) {
    return sock.sendMessage(
        jid,
        {
            text,
            ...options
        }
    );
}


// ==================================================
// MENU
// ==================================================

function getMenu(currentNumber) {
    return `
╭━━━━━━━━━━━━━━━━━━━━╮
┃ 🤖 *WA GUARD BOT*
╰━━━━━━━━━━━━━━━━━━━━╯

👋 Bot siap digunakan.

📱 *Nomor Bot*
${currentNumber || "-"}

╭─「 📋 GENERAL 」
│
│ 🏓 #ping
│ 📊 #status
│ ⏱️ #runtime
│ 📖 #rules
│ 📋 #menu
│
╰────────────────────

╭─「 👥 GROUP 」
│
│ ℹ️ #groupinfo
│ 👑 #admin
│ 📢 #tagall
│ 🔔 #hidetag
│
╰────────────────────

🛡️ *${BOT_NAME}*
⚡ Protection System
`;
}


// ==================================================
// HANDLE MESSAGE
// ==================================================

async function handleMessage(
    sock,
    msg,
    currentNumber
) {
    try {
        if (!msg || !msg.message) {
            return;
        }

        if (msg.key?.fromMe) {
            return;
        }

        const jid = msg.key?.remoteJid;

        if (!jid) {
            return;
        }

        if (jid === "status@broadcast") {
            return;
        }

        const text = getMessageText(msg);

        if (!text) {
            return;
        }

        const parts = text.split(/\s+/);
        const command = parts[0].toLowerCase();
        const args = parts.slice(1);

        const sender = getSender(msg, jid);

        console.log(
            `[MESSAGE] ${jid} -> ${text}`
        );


        // ==================================================
        // PING
        // ==================================================

        if (command === "#ping") {
            const start = Date.now();

            await sendText(
                sock,
                jid,
                `🏓 *PONG!*

🟢 Bot: ONLINE
⚡ Response: ${Date.now() - start} ms

🤖 ${BOT_NAME}`
            );

            return;
        }


        // ==================================================
        // STATUS
        // ==================================================

        if (command === "#status") {
            await sendText(
                sock,
                jid,
                `╭━━━━━━━━━━━━━━━━━━━━╮
┃ 🤖 *BOT STATUS*
╰━━━━━━━━━━━━━━━━━━━━╯

🟢 WhatsApp : ONLINE
🟢 Bot      : ACTIVE
🟢 System   : RUNNING

📱 Nomor:
${currentNumber || "-"}

🛡️ Protection:
READY

⚡ ${BOT_NAME}`
            );

            return;
        }


        // ==================================================
        // RUNTIME
        // ==================================================

        if (command === "#runtime") {
            await sendText(
                sock,
                jid,
                `⏱️ *BOT RUNTIME*

🤖 ${BOT_NAME}

🕐 Uptime:
${formatRuntime(Date.now() - startedAt)}

🟢 System berjalan normal.`
            );

            return;
        }


        // ==================================================
        // MENU
        // ==================================================

        if (
            command === "#menu" ||
            command === "#help"
        ) {
            await sendText(
                sock,
                jid,
                getMenu(currentNumber)
            );

            return;
        }


        // ==================================================
        // RULES
        // ==================================================

        if (command === "#rules") {
            await sendText(
                sock,
                jid,
                `╭━━━━━━━━━━━━━━━━━━━━╮
┃ 📖 *GROUP RULES*
╰━━━━━━━━━━━━━━━━━━━━╯

1️⃣ Hormati semua anggota.
2️⃣ Jangan spam.
3️⃣ Jangan mengganggu anggota lain.
4️⃣ Jangan kirim konten yang tidak sesuai.
5️⃣ Ikuti arahan admin.
6️⃣ Gunakan grup dengan baik.

🛡️ ${BOT_NAME}`
            );

            return;
        }


        // ==================================================
        // GROUP COMMANDS
        // ==================================================

        const groupCommands = [
            "#groupinfo",
            "#admin",
            "#tagall",
            "#hidetag"
        ];

        if (!groupCommands.includes(command)) {
            if (text.startsWith(PREFIX)) {
                await sendText(
                    sock,
                    jid,
                    `❌ *COMMAND TIDAK DITEMUKAN*

Command:
${command}

📋 Ketik *#menu* untuk melihat command.`
                );
            }

            return;
        }


        // ==================================================
        // GROUP CHECK
        // ==================================================

        if (!isGroup(jid)) {
            await sendText(
                sock,
                jid,
                `❌ Command *${command}* hanya bisa digunakan di grup.`
            );

            return;
        }


        // ==================================================
        // GET METADATA
        // ==================================================

        let metadata;

        try {
            metadata = await sock.groupMetadata(jid);
        } catch (error) {
            console.error(
                "Gagal mengambil metadata grup:",
                error.message
            );

            await sendText(
                sock,
                jid,
                "❌ Gagal mengambil informasi grup."
            );

            return;
        }


        // ==================================================
        // GROUP INFO
        // ==================================================

        if (command === "#groupinfo") {
            const admins = getAdmins(metadata);

            await sendText(
                sock,
                jid,
                `╭━━━━━━━━━━━━━━━━━━━━╮
┃ 👥 *GROUP INFO*
╰━━━━━━━━━━━━━━━━━━━━╯

📛 Nama:
${metadata.subject || "-"}

👥 Member:
${metadata.participants?.length || 0}

👑 Admin:
${admins.length}

🆔 Group ID:
${jid}

🛡️ Bot:
${BOT_NAME}

🟢 Status:
ACTIVE`
            );

            return;
        }


        // ==================================================
        // ADMIN LIST
        // ==================================================

        if (command === "#admin") {
            const admins = getAdmins(metadata);

            if (!admins.length) {
                await sendText(
                    sock,
                    jid,
                    "❌ Admin grup tidak ditemukan."
                );

                return;
            }

            const mentions = admins
                .map(admin => admin.id);

            let textAdmin =
`╭━━━━━━━━━━━━━━━━━━━━╮
┃ 👑 *GROUP ADMINS*
╰━━━━━━━━━━━━━━━━━━━━╯

`;

            admins.forEach(
                (admin, index) => {
                    textAdmin +=
                        `${index + 1}. @${formatNumber(admin.id)}\n`;
                }
            );

            textAdmin +=
`
👥 Total Admin: ${admins.length}

🛡️ ${BOT_NAME}`;

            await sendText(
                sock,
                jid,
                textAdmin,
                {
                    mentions
                }
            );

            return;
        }


        // ==================================================
        // ADMIN ONLY
        // ==================================================

        if (
            command === "#tagall" ||
            command === "#hidetag"
        ) {
            if (!isAdmin(metadata, sender)) {
                await sendText(
                    sock,
                    jid,
                    `❌ *ACCESS DENIED*

Command *${command}* hanya dapat digunakan oleh admin grup.`
                );

                return;
            }
        }


        // ==================================================
        // TAG ALL
        // ==================================================

        if (command === "#tagall") {
            const participants =
                metadata.participants || [];

            if (!participants.length) {
                return;
            }

            const mentions =
                participants.map(
                    participant => participant.id
                );

            const announcement =
                args.length
                    ? args.join(" ")
                    : "📢 Perhatian semua member grup!";

            let tagText =
`╭━━━━━━━━━━━━━━━━━━━━╮
┃ 📢 *GROUP ANNOUNCEMENT*
╰━━━━━━━━━━━━━━━━━━━━╯

${announcement}

`;

            participants.forEach(
                (participant, index) => {
                    tagText +=
                        `${index + 1}. @${formatNumber(participant.id)}\n`;
                }
            );

            tagText +=
`
🛡️ ${BOT_NAME}`;

            await sendText(
                sock,
                jid,
                tagText,
                {
                    mentions
                }
            );

            return;
        }


        // ==================================================
        // HIDETAG
        // ==================================================

        if (command === "#hidetag") {
            const participants =
                metadata.participants || [];

            if (!participants.length) {
                return;
            }

            const mentions =
                participants.map(
                    participant => participant.id
                );

            const announcement =
                args.length
                    ? args.join(" ")
                    : "📢 Perhatian semua anggota grup!";

            await sendText(
                sock,
                jid,
                `📢 *GROUP ANNOUNCEMENT*

${announcement}

🛡️ ${BOT_NAME}`,
                {
                    mentions
                }
            );

            return;
        }

    } catch (error) {
        console.error(
            "❌ BOT MESSAGE ERROR:",
            error
        );
    }
}


// ==================================================
// EXPORT
// ==================================================

module.exports = {
    handleMessage
};