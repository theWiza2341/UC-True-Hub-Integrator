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
    } catch (error) {
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
    // Key: "season:channel" (e.g. "s3:aggro-red")
    // -----------------------------------------------
    const existingByChannel = new Map();
    const existingByMessage = new Set();

    for (const deck of existingDecks) {
        if (deck.season && deck.channel) {
            const key = `${deck.season}:${deck.channel}`;
            existingByChannel.set(key, deck);
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
            .filter(value => value !== null);

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
    // Fetch all channels and filter to season text channels
    // Includes: any season >= latestSeason (catches new seasons too)
    // If no existing data: scan everything
    // -----------------------------------------------
    const channels = await guild.channels.fetch();

    const relevantChannels = [];

    channels.forEach(channel => {
        if (!channel) return;

        const parentName = channel.parent?.name ?? "";
        const isText = channel.type === ChannelType.GuildText;
        const match = parentName.match(/^s(\d+)$/i);

        if (!isText || !match) return;

        const seasonNumber = Number(match[1]);

        // Always include if no prior data exists,
        // or if the season is >= the latest known season.
        // This naturally picks up brand-new seasons.
        if (latestSeason === null || seasonNumber >= latestSeason) {
            relevantChannels.push(channel);
        }
    });

    console.log(`Scanning ${relevantChannels.length} channel(s)...`);

    let added = 0;
    let updated = 0;

    // -----------------------------------------------
    // Process channels
    // -----------------------------------------------
    for (const channel of relevantChannels) {

        console.log(`\nScanning #${channel.name}`);

        try {

            const messages = await channel.messages.fetch({ limit: 100 });

            if (messages.size === 0) {
                console.log("No messages.");
                continue;
            }

            const sorted = [...messages.values()]
                .sort((a, b) => a.createdTimestamp - b.createdTimestamp);

            // Skip channels where every message is already known
            const unseen = sorted.filter(msg => !existingByMessage.has(msg.id));

            if (unseen.length === 0) {
                console.log("No new messages — skipping.");
                continue;
            }

            // -------------------------
            // Find deck message (search unseen messages only)
            // -------------------------
            let deckMessage = null;
            let deckCode = null;

            for (const msg of unseen) {
                const code = extractDeckCode(msg.content);
                if (code) {
                    deckMessage = msg;
                    deckCode = code;
                    break;
                }
            }

            if (!deckMessage) {
                console.log("No deck found.");
                continue;
            }

            // -------------------------
            // Context window
            // Uses full sorted history so surrounding context
            // (even already-known messages) can inform the deck
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

            // -------------------------
            // New channel — add deck
            // -------------------------
            if (!existing) {
                existingDecks.push(deckData);
                existingByChannel.set(channelKey, deckData);
                existingByMessage.add(deckMessage.id);
                added++;
                console.log("✔ Added");
                continue;
            }

            // -------------------------
            // Known channel — update if deck code changed
            // -------------------------
            if (existing.deckCode !== normalizedCode) {
                const index = existingDecks.findIndex(
                    deck => deck.messageId === existing.messageId
                );

                if (index !== -1) {
                    existingDecks[index] = deckData;
                } else {
                    // Fallback: push if somehow not found by messageId
                    existingDecks.push(deckData);
                }

                existingByChannel.set(channelKey, deckData);
                existingByMessage.add(deckMessage.id);
                updated++;
                console.log("✔ Updated");
            } else {
                console.log("No changes.");
            }

        } catch (error) {
            console.error(`Failed #${channel.name}:`, error.message);
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
