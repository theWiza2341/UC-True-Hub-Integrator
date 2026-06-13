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

function normalizeDeckCode(code) {
    if (!code) return null;
    return code.endsWith("=") ? code : code + "=";
}

function extractDeckCode(text) {
    if (!text) return null;
    return text.match(/eyJ[A-Za-z0-9+/=]+/)?.[0] ?? null;
}

function extractRecord(text) {
    if (!text) return null;

    const cleaned = text.toLowerCase();
    let match;

    // 17-3 / 17 - 3 / unicode dashes
    match = cleaned.match(/(\d{1,3})\s*[-–—]\s*(\d{1,3})/);
    if (match) return { wins: +match[1], losses: +match[2] };

    // 17/3
    match = cleaned.match(/(\d{1,3})\s*\/\s*(\d{1,3})/);
    if (match) return { wins: +match[1], losses: +match[2] };

    // 17 to 3
    match = cleaned.match(/(\d{1,3})\s+to\s+(\d{1,3})/);
    if (match) return { wins: +match[1], losses: +match[2] };

    // 17 wins 3 losses
    match = cleaned.match(/(\d{1,3})\s+wins?\s+(\d{1,3})\s+loss(?:es)?/);
    if (match) return { wins: +match[1], losses: +match[2] };

    // 17W 3L
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
    if (match) {
        return { type: "id", value: match[1] };
    }

    match = text.match(/creator[:\s]+@?([\w\-]+)/i);
    if (match) {
        return { type: "name", value: match[1] };
    }

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
    const output = { decks };

    fs.writeFileSync(
        OUTPUT_PATH,
        JSON.stringify(output, null, 2),
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

    console.log(`\nScanning "${guild.name}"...`);

    const channels = await guild.channels.fetch();

    const relevantChannels = [];

    // only s### text channels
    channels.forEach(channel => {
        if (!channel) return;

        const parentName = channel.parent?.name ?? "";
        const isText = channel.type === ChannelType.GuildText;
        const isSeason = /^s\d+$/.test(parentName);

        if (isText && isSeason) {
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

            const sorted = [...messages.values()]
                .sort((a, b) => a.createdTimestamp - b.createdTimestamp);

            // ---------------------------------------------
            // FIND DECK MESSAGE
            // ---------------------------------------------
            let deckIndex = -1;
            let deckMessage = null;
            let deckCode = null;

            for (let i = 0; i < sorted.length; i++) {
                const msg = sorted[i];
                const code = extractDeckCode(msg.content);

                if (code) {
                    deckIndex = i;
                    deckMessage = msg;
                    deckCode = code;
                    break;
                }
            }

            if (!deckMessage) {
                console.log("No deck found");
                continue;
            }

            // ---------------------------------------------
            // CONTEXT WINDOW (IMPORTANT FIX)
            // ---------------------------------------------
            const window = sorted.slice(
                Math.max(0, deckIndex - 5),
                Math.min(sorted.length, deckIndex + 3)
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

            // ---------------------------------------------
            // NOTES FROM CONTEXT WINDOW
            // ---------------------------------------------
            const cleanedNotes = window
                .map(m => m.content)
                .join("\n\n")
                .replace(deckCode, "")
                .trim();

            // ---------------------------------------------
            // BUILD DECK
            // ---------------------------------------------
            const deckData = {
                messageId: deckMessage.id,
                season: channel.parent?.name,
                channel: channel.name,
                author: authorName,
                deckCode: normalizeDeckCode(deckCode),
                record,
                notes: cleanedNotes,
                publishedAt: deckMessage.createdAt.toISOString()
            };

            finalDecks.push(deckData);

            console.log("✔ Parsed deck");

        } catch (error) {
            console.error(`Failed #${channel.name}:`, error.message);
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
