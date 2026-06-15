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
    // Normalize URL-safe base64 to standard base64
    code = code.replace(/-/g, "+").replace(/_/g, "/");
    // Pad to multiple of 4 if needed
    while (code.length % 4 !== 0) code += "=";
    return code;
}

function extractDeckCode(text) {
    if (!text) return null;

    // Split into lines, strip whitespace, filter empty
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

    // 17-3 / 17 - 3 / unicode dashes
    match = cleaned.match(/(\d{1,3})\s*[-–—]\s*(\d{1,3})/);
    if (match) return { wins: Number(match[1]), losses: Number(match[2]) };

    // 17/3
    match = cleaned.match(/(\d{1,3})\s*\/\s*(\d{1,3})/);
    if (match) return { wins: Number(match[1]), losses: Number(match[2]) };

    // 17 to 3
    match = cleaned.match(/(\d{1,3})\s+to\s+(\d{1,3})/);
    if (match) return { wins: Number(match[1]), losses: Number(match[2]) };

    // 17 wins 3 losses
    match = cleaned.match(/(\d{1,3})\s+wins?\s+(\d{1,3})\s+loss(?:es)?/);
    if (match) return { wins: Number(match[1]), losses: Number(match[2]) };

    // 17W 3L
    match = cleaned.match(/(\d{1,3})\s*w\s*(\d{1,3})\s*l\b/);
    if (match) return { wins: Number(match[1]), losses: Number(match[2]) };

    return null;
}


// =====================================================
// CREATOR DETECTION
// =====================================================

function extractCreator(text) {
    if (!text) return null;

    const lower = text.toLowerCase();
    if (!lower.includes("creator")) return null;

    // creator: <@123>
    let match = text.match(/<@!?(\d+)>/);
    if (match) return { type: "id", value: match[1] };

    // creator: username
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
// JSON HELPERS
// =====================================================

function loadExistingDecks() {
    if (!fs.existsSync(OUTPUT_PATH)) {
        console.log("No decks.json found — will do a full scan.");
        return [];
    }

    try {
        const raw = fs.readFileSync(OUTPUT_PATH, "utf8");
        const parsed = JSON.parse(raw);
        return parsed.decks ?? [];
    } catch {
        console.log("Failed to read decks.json — will do a full scan.");
        return [];
    }
}

function saveDecks(decks) {
    fs.writeFileSync(
        OUTPUT_PATH,
        JSON.stringify({ decks }, null, 2),
        "utf8"
    );
    console.log("\n✔ decks.json updated");
}


// =====================================================
// CHANNEL PROCESSOR
// =====================================================

async function processChannel(channel, { existingDecks, existingByChannel, existingByMessage, isNewSeason }) {

    const messages = await channel.messages.fetch({ limit: 100 });

    if (messages.size === 0) {
        console.log("  No messages.");
        return { result: "skip" };
    }

    const sorted = [...messages.values()]
        .sort((a, b) => a.createdTimestamp - b.createdTimestamp);

    // For known-season channels, skip if no new messages.
    // For new-season channels, always do a full scan.
    if (!isNewSeason) {
        const unseen = sorted.filter(msg => !existingByMessage.has(msg.id));
        if (unseen.length === 0) {
            console.log("  No new messages — skipping.");
            return { result: "skip" };
        }
    }

    // -----------------------------------------------
    // Search ALL messages for deck code.
    // The code may be posted later than the record/notes,
    // so we can't limit to just the first few messages.
    // -----------------------------------------------
    let deckMessage = null;
    let deckCode = null;

    for (const msg of sorted) {
        const code = extractDeckCode(msg.content);
        if (code) {
            deckMessage = msg;
            deckCode = code;
            console.log(`  Found deck code in message ${msg.id} (position ${sorted.indexOf(msg) + 1}/${sorted.length})`);
            break;
        }
    }

    if (!deckMessage) {
        // Log each message's first 60 chars to help debug
        console.log("  No deck found. Message previews:");
        sorted.slice(0, 10).forEach((msg, i) => {
            console.log(`    [${i + 1}] ${msg.content.slice(0, 80).replace(/\n/g, " ")}`);
        });
        return { result: "skip" };
    }

    // -----------------------------------------------
    // Context window: 5 messages before + 3 after deck code.
    // This captures record/notes posted before the code,
    // and any clarifications posted just after.
    // -----------------------------------------------
    const actualIndex = sorted.findIndex(msg => msg.id === deckMessage.id);

    const contextWindow = sorted.slice(
        Math.max(0, actualIndex - 5),
        Math.min(sorted.length, actualIndex + 3)
    );

    let record = null;
    let author = deckMessage.author.username;

    for (const msg of contextWindow) {
        if (!record) {
            record = extractRecord(msg.content);
        }

        const creator = extractCreator(msg.content);
        if (creator) {
            const resolved = await resolveUser(client, creator);
            if (resolved) {
                author = resolved;
                // don't break — record may still appear later in window
            }
        }
    }

    // -----------------------------------------------
    // Build deck object
    // -----------------------------------------------
    const normalizedCode = normalizeDeckCode(deckCode);
    const channelKey = `${channel.parent?.name}:${channel.name}`;

    const deckData = {
        messageId: deckMessage.id,
        season: channel.parent?.name,
        channel: channel.name,
        author,
        deckCode: normalizedCode,
        record,
        notes: contextWindow
            .map(msg => msg.content)
            .join("\n\n")
            .replace(deckCode, "")
            .trim(),
        publishedAt: deckMessage.createdAt.toISOString()
    };

    const existing = existingByChannel.get(channelKey);

    // New channel — add deck
    if (!existing) {
        existingDecks.push(deckData);
        existingByChannel.set(channelKey, deckData);
        existingByMessage.add(deckMessage.id);
        added++;
        console.log("  ✔ Added");
        return { result: "added" };
    }

    // Known channel — update if deck code changed
    if (existing.deckCode !== normalizedCode) {
        const index = existingDecks.findIndex(
            deck => deck.messageId === existing.messageId
        );

        if (index !== -1) {
            existingDecks[index] = deckData;
        } else {
            existingDecks.push(deckData);
        }

        existingByChannel.set(channelKey, deckData);
        existingByMessage.add(deckMessage.id);
        console.log("  ✔ Updated");
        return { result: "updated" };
    }

    console.log("  No changes.");
    return { result: "unchanged" };
}


// =====================================================
// MAIN
// =====================================================

let added = 0;
let updated = 0;

client.once("clientReady", async () => {

    console.log(`Logged in as ${client.user.tag}`);

    const guild = client.guilds.cache.first();

    if (!guild) {
        console.log("No guilds found.");
        client.destroy();
        return;
    }

    console.log(`\nScanning "${guild.name}"...`);

    // -----------------------------------------------
    // Load existing data
    // -----------------------------------------------
    const existingDecks = loadExistingDecks();
    console.log(`Loaded ${existingDecks.length} existing deck(s).`);

    // -----------------------------------------------
    // Build lookup maps from existing decks
    // Key format: "s118:skt-evil-kindness"
    // -----------------------------------------------
    const existingByChannel = new Map();
    const existingByMessage = new Set();

    for (const deck of existingDecks) {
        if (deck.season && deck.channel) {
            existingByChannel.set(`${deck.season}:${deck.channel}`, deck);
        }
        if (deck.messageId) {
            existingByMessage.add(deck.messageId);
        }
    }

    // -----------------------------------------------
    // Determine latest known season number
    // -----------------------------------------------
    let latestSeason = null;

    if (existingDecks.length > 0) {
        const seasonNumbers = existingDecks
            .map(deck => {
                const match = String(deck.season).match(/^s(\d+)$/i);
                return match ? Number(match[1]) : null;
            })
            .filter(n => n !== null);

        if (seasonNumbers.length > 0) {
            latestSeason = Math.max(...seasonNumbers);
        }
    }

    console.log(
        latestSeason !== null
            ? `Latest known season: s${latestSeason}`
            : "No previous season detected — scanning all seasons."
    );

    // -----------------------------------------------
    // Fetch all channels and sort into two buckets:
    //   - newSeasonChannels:     season >  latestSeason (always full scan)
    //   - currentSeasonChannels: season == latestSeason (check for updates)
    // Seasons below latestSeason are skipped (full-sync handles those).
    // -----------------------------------------------
    const channels = await guild.channels.fetch();

    const currentSeasonChannels = [];
    const newSeasonChannels = [];

    channels.forEach(channel => {
        if (!channel) return;

        const parentName = channel.parent?.name ?? "";
        const isText = channel.type === ChannelType.GuildText;
        const match = parentName.match(/^s(\d+)$/i);

        if (!isText || !match) return;

        const seasonNumber = Number(match[1]);

        if (latestSeason === null || seasonNumber > latestSeason) {
            newSeasonChannels.push(channel);
        } else if (seasonNumber === latestSeason) {
            currentSeasonChannels.push(channel);
        }
    });

    console.log(`New season channels to scan: ${newSeasonChannels.length}`);
    console.log(`Current season channels to check: ${currentSeasonChannels.length}`);

    if (newSeasonChannels.length > 0) {
        const newSeasonNames = [...new Set(
            newSeasonChannels.map(c => c.parent?.name)
        )].join(", ");
        console.log(`\n🆕 New season(s) discovered: ${newSeasonNames}`);
    }

    const context = { existingDecks, existingByChannel, existingByMessage };

    // -----------------------------------------------
    // Process new season channels first (always full scan)
    // -----------------------------------------------
    if (newSeasonChannels.length > 0) {
        console.log("\n--- Scanning new season(s) ---");

        for (const channel of newSeasonChannels) {
            console.log(`\n#${channel.name} [${channel.parent?.name}]`);
            try {
                await processChannel(channel, { ...context, isNewSeason: true });
            } catch (error) {
                console.error(`  Failed:`, error.message);
            }
        }
    }

    // -----------------------------------------------
    // Process current season channels (skip if no new messages)
    // -----------------------------------------------
    if (currentSeasonChannels.length > 0) {
        console.log("\n--- Checking current season for updates ---");

        for (const channel of currentSeasonChannels) {
            console.log(`\n#${channel.name} [${channel.parent?.name}]`);
            try {
                await processChannel(channel, { ...context, isNewSeason: false });
            } catch (error) {
                console.error(`  Failed:`, error.message);
            }
        }
    }

    // -----------------------------------------------
    // Save results
    // -----------------------------------------------
    saveDecks(existingDecks);

    console.log("\n======================");
    console.log(`Added:   ${added}`);
    console.log(`Updated: ${updated}`);
    console.log(`Total:   ${existingDecks.length}`);
    console.log("======================\n");

    client.destroy();
});

client.login(process.env.BOT_TOKEN);
