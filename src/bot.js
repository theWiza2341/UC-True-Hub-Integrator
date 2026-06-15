if (process.env.NODE_ENV !== "production") {
    require("dotenv").config();
}

const {
    Client,
    GatewayIntentBits,
    ChannelType
} = require("discord.js");

const path = require("path");
const fs = require("fs");

const OUTPUT_PATH = path.join(__dirname, "..", "decks.json");

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});


// =====================================================
// HELPERS
// =====================================================

// FIXED: multi-message safe deck extraction
function extractDeckCodeFromWindow(messages) {

    const buffer = [];

    // scan oldest -> newest for reconstruction stability
    for (const msg of messages) {

        const content = (msg.content || "").trim();

        if (!content) continue;

        buffer.push(content);

        // keep buffer small
        if (buffer.length > 5) buffer.shift();

        // try reconstruct full joined text
        const joined = buffer.join("\n");

        const match = joined.match(/eyJ[A-Za-z0-9+/=\-_]+/);
        if (match) {
            return {
                code: match[0],
                message: msg
            };
        }
    }

    return null;
}


// fallback single-line extraction (still used for safety)
function extractDeckCode(text) {
    if (!text) return null;

    const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);

    for (const line of lines) {
        const match = line.match(/eyJ[A-Za-z0-9+/=\-_]+/);
        if (match) return match[0];
    }

    return null;
}


function extractRecord(text) {
    if (!text) return null;

    const cleaned = text.toLowerCase();
    let match;

    match = cleaned.match(/(\d{1,3})\s*[-–—]\s*(\d{1,3})/);
    if (match) return { wins: +match[1], losses: +match[2] };

    match = cleaned.match(/(\d{1,3})\s*\/\s*(\d{1,3})/);
    if (match) return { wins: +match[1], losses: +match[2] };

    match = cleaned.match(/(\d{1,3})\s+to\s+(\d{1,3})/);
    if (match) return { wins: +match[1], losses: +match[2] };

    match = cleaned.match(/(\d{1,3})\s+wins?\s+(\d{1,3})\s+loss(?:es)?/);
    if (match) return { wins: +match[1], losses: +match[2] };

    match = cleaned.match(/(\d{1,3})\s*w\s*(\d{1,3})\s*l\b/);
    if (match) return { wins: +match[1], losses: +match[2] };

    return null;
}


// =====================================================
// CREATOR DETECTION
// =====================================================

function extractCreator(text) {
    if (!text) return null;

    const lower = text.toLowerCase();
    if (!lower.includes("creator")) return null;

    let match = text.match(/<@!?(\d+)>/);
    if (match) return { type: "id", value: match[1] };

    match = text.match(/creator[:\s]+@?([\w\-]+)/i);
    if (match) return { type: "name", value: match[1] };

    return null;
}


// =====================================================
// USER RESOLVER
// =====================================================

async function resolveUser(client, creator) {
    try {
        if (creator.type === "id") {
            const user = await client.users.fetch(creator.value);
            return user.username;
        }
        return creator.value;
    } catch {
        return null;
    }
}


// =====================================================
// EXPORT
// =====================================================

function exportDecksToFile(decks) {
    fs.writeFileSync(
        OUTPUT_PATH,
        JSON.stringify({ decks }, null, 2),
        "utf-8"
    );

    console.log("\n✔ decks.json updated");
}


// =====================================================
// MAIN PIPELINE
// =====================================================

client.once("clientReady", async () => {

    console.log(`Logged in as ${client.user.tag}`);

    const guild = client.guilds.cache.first();

    if (!guild) {
        console.log("No guilds found.");
        client.destroy();
        return;
    }

    const channels = await guild.channels.fetch();

    const relevantChannels = [];

    channels.forEach(channel => {

        if (!channel) return;

        const parentName = channel.parent?.name ?? "";
        const isText = channel.type === ChannelType.GuildText;

        if (isText && /^s\d+$/.test(parentName)) {
            relevantChannels.push(channel);
        }
    });

    console.log(`Found ${relevantChannels.length} relevant channels\n`);

    const finalDecks = [];

    // =================================================
    // PROCESS CHANNELS
    // =================================================
    for (const channel of relevantChannels) {

        console.log(`Scanning #${channel.name}`);

        try {

            const messages = await channel.messages.fetch({ limit: 100 });

            if (messages.size === 0) continue;

            // IMPORTANT: newest → oldest scan
            const sorted = [...messages.values()]
                .sort((a, b) => b.createdTimestamp - a.createdTimestamp);

            // =================================================
            // FIX #1: scan backwards so long threads don't hide deck
            // =================================================
            let found = null;

            for (let i = 0; i < sorted.length; i++) {

                const windowSlice = sorted.slice(i, i + 5);

                const result = extractDeckCodeFromWindow(windowSlice);

                if (result) {
                    found = {
                        deckMessage: result.message,
                        deckCode: result.code
                    };
                    break;
                }
            }

            if (!found) {
                console.log("  No deck found.");
                continue;
            }

            const deckMessage = found.deckMessage;
            const deckCode = found.deckCode;

            // =================================================
            // CONTEXT WINDOW (around discovered message)
            // =================================================
            const idx = sorted.findIndex(m => m.id === deckMessage.id);

            const window = sorted.slice(
                Math.max(0, idx - 5),
                Math.min(sorted.length, idx + 3)
            );

            let record = null;
            let authorName = deckMessage.author.username;

            for (const msg of window) {

                if (!record) {
                    record = extractRecord(msg.content);
                }

                const creator = extractCreator(msg.content);
                if (creator) {
                    const resolved = await resolveUser(client, creator);
                    if (resolved) authorName = resolved;
                }
            }

            const cleanedNotes = window
                .map(m => m.content)
                .join("\n\n")
                .replace(deckCode, "")
                .trim();

            const deckData = {
                messageId: deckMessage.id,
                season: channel.parent?.name,
                channel: channel.name,
                author: authorName,
                deckCode,
                record,
                notes: cleanedNotes,
                publishedAt: deckMessage.createdAt.toISOString()
            };

            finalDecks.push(deckData);

            console.log("  ✔ Parsed deck");

        } catch (err) {
            console.error(`  Failed #${channel.name}:`, err.message);
        }
    }

    exportDecksToFile(finalDecks);

    console.log("\n======================");
    console.log(`TOTAL DECKS FOUND: ${finalDecks.length}`);
    console.log("======================\n");

    client.destroy();
});

client.login(process.env.BOT_TOKEN);
