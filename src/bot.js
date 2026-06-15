if (process.env.NODE_ENV !== "production") {
    require("dotenv").config();
}

const {
    Client,
    GatewayIntentBits,
    ChannelType
} = require("discord.js");

const fs = require("fs");
const path = require("path");

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

function extractDeckCode(text) {
    if (!text) return null;

    const match = text.match(/eyJ[A-Za-z0-9+/=\-_]+/);
    return match?.[0] ?? null;
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
// MULTI-MESSAGE DECK DETECTION (CRITICAL FIX)
// =====================================================

function findDeckInMessages(sorted) {

    // scan newest → oldest
    for (let i = 0; i < sorted.length; i++) {

        let buffer = "";

        // build context window (captures split codes)
        for (let j = i; j < Math.min(i + 6, sorted.length); j++) {
            buffer += "\n" + (sorted[j].content || "");
        }

        const code = extractDeckCode(buffer);

        if (code) {
            return {
                index: i,
                code
            };
        }
    }

    return null;
}

// =====================================================
// MAIN
// =====================================================

client.once("clientReady", async () => {

    console.log(`Logged in as ${client.user.tag}`);

    const guild = client.guilds.cache.first();
    if (!guild) return client.destroy();

    const channels = await guild.channels.fetch();

    const relevantChannels = [];

    channels.forEach(c => {
        if (!c) return;

        const isText = c.type === ChannelType.GuildText;
        const isSeason = /^s\d+$/.test(c.parent?.name ?? "");

        if (isText && isSeason) {
            relevantChannels.push(c);
        }
    });

    const finalDecks = [];

    for (const channel of relevantChannels) {

        console.log(`Scanning #${channel.name}`);

        try {

            const messages = await channel.messages.fetch({ limit: 100 });

            const sorted = [...messages.values()]
                .sort((a, b) => b.createdTimestamp - a.createdTimestamp);

            const found = findDeckInMessages(sorted);

            if (!found) {
                console.log("  No deck found.");
                continue;
            }

            const deckMessage = sorted[found.index];
            const deckCode = found.code;

            const context = sorted.slice(found.index, found.index + 5);

            let record = null;
            let author = deckMessage.author.username;

            for (const msg of context) {
                if (!record) record = extractRecord(msg.content);
            }

            const notes = context
                .map(m => m.content)
                .join("\n\n")
                .replace(deckCode, "")
                .trim();

            finalDecks.push({
                messageId: deckMessage.id,
                season: channel.parent?.name,
                channel: channel.name,
                author,
                deckCode,
                record,
                notes,
                publishedAt: deckMessage.createdAt.toISOString()
            });

            console.log("  ✔ Parsed deck");

        } catch (e) {
            console.error(`  Failed #${channel.name}:`, e.message);
        }
    }

    fs.writeFileSync(
        OUTPUT_PATH,
        JSON.stringify({ decks: finalDecks }, null, 2),
        "utf8"
    );

    console.log("\n======================");
    console.log(`TOTAL DECKS FOUND: ${finalDecks.length}`);
    console.log("======================\n");

    client.destroy();
});

client.login(process.env.BOT_TOKEN);
