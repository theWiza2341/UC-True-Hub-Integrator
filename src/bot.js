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

// FIXED: supports multi-line deck codes safely
function extractDeckCode(text) {
    if (!text) return null;

    // normalize all whitespace into single spaces
    const normalized = text.replace(/\r/g, "");
    const lines = normalized.split("\n");

    let buffer = "";

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();

        if (!line) continue;

        // If line contains base64 start, begin capture
        if (line.includes("eyJ")) {
            buffer = line;

            // also absorb next lines if they look like continuation
            for (let j = i + 1; j < lines.length; j++) {
                const next = lines[j].trim();

                // stop if we hit obvious non-code content
                if (
                    next.includes("creator") ||
                    next.includes("wins") ||
                    next.includes("loss") ||
                    next.length > 200
                ) break;

                buffer += next;
            }

            const match = buffer.match(/eyJ[A-Za-z0-9+/=\-_]+/);
            if (match) return match[0];
        }
    }

    return null;
}


// unchanged but safe
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
// MAIN
// =====================================================

client.once("clientReady", async () => {

    console.log(`Logged in as ${client.user.tag}`);

    const guild = client.guilds.cache.first();
    if (!guild) return client.destroy();

    console.log(`Scanning "${guild.name}"...`);

    const channels = await guild.channels.fetch();

    const relevantChannels = [];

    channels.forEach(channel => {
        if (!channel) return;

        const parentName = channel.parent?.name ?? "";
        const isText = channel.type === ChannelType.GuildText;
        const isSeason = /^s\d+$/.test(parentName);

        if (isText && isSeason) {
            relevantChannels.push(channel);
        }
    });

    console.log(`Found ${relevantChannels.length} channels\n`);

    const finalDecks = [];

    // =================================================
    // PROCESS CHANNELS
    // =================================================
    for (const channel of relevantChannels) {

        console.log(`Scanning #${channel.name}`);

        try {

            // IMPORTANT CHANGE:
            // fetch MORE messages so we don't miss deep threads
            const messages = await channel.messages.fetch({ limit: 100 });

            if (!messages.size) continue;

            // =================================================
            // FIX #2: SEARCH BACKWARDS (newest → oldest)
            // =================================================
            const sorted = [...messages.values()]
                .sort((a, b) => b.createdTimestamp - a.createdTimestamp);

            let deckMessage = null;
            let deckCode = null;

            // BACKWARD scan prevents missing buried decks
            for (const msg of sorted) {

                const code = extractDeckCode(msg.content);

                if (code) {
                    deckMessage = msg;
                    deckCode = code;
                    break;
                }
            }

            if (!deckMessage) {
                console.log("  No deck found.");
                continue;
            }

            // =================================================
            // FIXED CONTEXT WINDOW (relative to actual position)
            // =================================================
            const fullSorted = [...messages.values()]
                .sort((a, b) => a.createdTimestamp - b.createdTimestamp);

            const actualIndex = fullSorted.findIndex(m => m.id === deckMessage.id);

            const window = fullSorted.slice(
                Math.max(0, actualIndex - 5),
                Math.min(fullSorted.length, actualIndex + 3)
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

            // =================================================
            // NOTES
            // =================================================
            const cleanedNotes = window
                .map(m => m.content)
                .join("\n\n")
                .replace(deckCode, "")
                .trim();

            // =================================================
            // BUILD OBJECT
            // =================================================
            finalDecks.push({
                messageId: deckMessage.id,
                season: channel.parent?.name,
                channel: channel.name,
                author: authorName,
                deckCode,
                record,
                notes: cleanedNotes,
                publishedAt: deckMessage.createdAt.toISOString()
            });

            console.log("  ✔ Parsed deck");

        } catch (err) {
            console.error(`  Failed #${channel.name}:`, err.message);
        }
    }

    // =================================================
    // EXPORT
    // =================================================
    exportDecksToFile(finalDecks);

    console.log("\n======================");
    console.log(`TOTAL DECKS FOUND: ${finalDecks.length}`);
    console.log("======================\n");

    client.destroy();
});

client.login(process.env.BOT_TOKEN);
