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

    // For channels in already-known seasons, skip if no new messages.
    // For channels in a NEW season, always do a full scan.
    if (!isNewSeason) {
        const unseen = sorted.filter(msg => !existingByMessage.has(msg.id));
        if (unseen.length === 0) {
            console.log("  No new messages — skipping.");
            return { result: "skip" };
        }
    }

    // -------------------------
    // Find deck message
    // Search all messages so we don't miss the deck code
    // if it was posted before the "unseen" window
    // -------------------------
    let deckMessage = null;
    let deckCode = null;

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
        return { result: "skip" };
    }

    // -------------------------
    // Context window
    // -------------------------
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
                // don't break — record may still be found later
            }
        }
    }

    // -------------------------
    // Build deck object
    // -------------------------
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
    //   - currentSeasonChannels: season === latestSeason (check for updates)
    //   - newSeasonChannels:     season >  latestSeason  (always full scan)
    // If no existing data, treat everything as new.
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
        // seasons below latestSeason are intentionally skipped
    });

    console.log(`New season channels to scan: ${newSeasonChannels.length}`);
    console.log(`Current season channels to check: ${currentSeasonChannels.length}`);

    if (newSeasonChannels.length > 0) {
        const newSeasonNums = [...new Set(
            newSeasonChannels.map(c => c.parent?.name)
        )].join(", ");
        console.log(`\n🆕 New season(s) discovered: ${newSeasonNums}`);
    }

    let added = 0;
    let updated = 0;

    const context = { existingDecks, existingByChannel, existingByMessage };

    // -----------------------------------------------
    // Process new season channels first (full scan, no skipping)
    // -----------------------------------------------
    if (newSeasonChannels.length > 0) {
        console.log("\n--- Scanning new season(s) ---");

        for (const channel of newSeasonChannels) {
            console.log(`\n#${channel.name} [${channel.parent?.name}]`);
            try {
                const { result } = await processChannel(channel, { ...context, isNewSeason: true });
                if (result === "added") added++;
                if (result === "updated") updated++;
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
                const { result } = await processChannel(channel, { ...context, isNewSeason: false });
                if (result === "added") added++;
                if (result === "updated") updated++;
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
