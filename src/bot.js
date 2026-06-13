if (process.env.NODE_ENV !== "production") {
    require("dotenv").config();
}

const {
    Client,
    GatewayIntentBits,
    ChannelType
} = require("discord.js");

const fs = require("fs");

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

    const match =
        text.match(/\b(\d{1,3})-(\d{1,3})\b/);

    if (!match) return null;

    return {
        wins: Number(match[1]),
        losses: Number(match[2])
    };
}


// =====================================================
// CREATOR DETECTION
// =====================================================

function extractCreator(text) {

    if (!text) return null;

    const lower =
        text.toLowerCase();

    if (!lower.includes("creator")) {
        return null;
    }

    // CASE 1: Discord mention <@id>
    let match =
        text.match(/<@!?(\d+)>/);

    if (match) {
        return {
            type: "id",
            value: match[1]
        };
    }

    // CASE 2: creator @name / creator name / creator: name
    match =
        text.match(/creator[:\s]+@?([\w\-]+)/i);

    if (match) {
        return {
            type: "name",
            value: match[1]
        };
    }

    return null;
}


// =====================================================
// USER RESOLVER
// =====================================================

async function resolveUser(client, creator) {

    try {

        if (creator.type === "id") {

            const user =
                await client.users.fetch(creator.value);

            return user.username;
        }

        return creator.value;

    } catch {
        return null;
    }
}


// =====================================================
// EXPORT FUNCTION
// =====================================================

function exportDecksToFile(decks) {

    const output = {
        decks
    };

    fs.writeFileSync(
        "decks.json",
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

    const guild =
        client.guilds.cache.first();

    if (!guild) {
        console.log("No guilds found.");
        client.destroy();
        return;
    }

    console.log(`\nScanning "${guild.name}"...`);

    const channels =
        await guild.channels.fetch();

    const relevantChannels = [];

    // -------------------------------------------------
    // FILTER: only s### text channels
    // -------------------------------------------------
    channels.forEach(channel => {

        if (!channel) return;

        const parentName =
            channel.parent?.name ?? "None";

        const isTextChannel =
            channel.type === ChannelType.GuildText;

        const isTrueHubCategory =
            /^s\d+$/.test(parentName);

        if (isTextChannel && isTrueHubCategory) {
            relevantChannels.push(channel);
        }
    });

    console.log(
        `Found ${relevantChannels.length} relevant channels:\n`
    );

    const finalDecks = [];

    // -------------------------------------------------
    // PROCESS EACH CHANNEL
    // -------------------------------------------------
    for (const channel of relevantChannels) {

        console.log(
            `\nScanning #${channel.name} (${channel.parent.name})`
        );

        try {

            const messages =
                await channel.messages.fetch({
                    limit: 100
                });

            if (messages.size === 0) {
                console.log("No messages found.");
                continue;
            }

            const sorted =
                [...messages.values()]
                    .sort((a, b) =>
                        a.createdTimestamp - b.createdTimestamp
                    );

            // -------------------------------------------------
            // FIND FIRST VALID DECK MESSAGE
            // -------------------------------------------------
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
                console.log("No valid deck message found.");
                continue;
            }

            // -------------------------------------------------
            // CREATOR WINDOW (deck + next 2 messages)
            // -------------------------------------------------
            const window =
                sorted.slice(deckIndex, deckIndex + 3);

            let authorName = null;

            for (const msg of window) {

                const creator =
                    extractCreator(msg.content);

                if (!creator) continue;

                const resolved =
                    await resolveUser(client, creator);

                if (resolved) {
                    authorName = resolved;
                    break;
                }
            }

            if (!authorName) {
                authorName =
                    deckMessage.author.username;
            }

            // -------------------------------------------------
            // BUILD DECK OBJECT
            // -------------------------------------------------
            const record =
                extractRecord(deckMessage.content);

            const cleanedNotes =
                deckMessage.content
                    .replace(deckCode, "")
                    .trim();

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

            console.log("\n✔ Parsed Deck:");
            console.log(deckData);

            finalDecks.push(deckData);

        }
        catch (error) {
            console.error(
                `Failed #${channel.name}:`,
                error.message
            );
        }
    }

    // -------------------------------------------------
    // EXPORT STEP
    // -------------------------------------------------
    exportDecksToFile(finalDecks);

    console.log("\n======================");
    console.log(`TOTAL DECKS FOUND: ${finalDecks.length}`);
    console.log("======================\n");

    client.destroy();
});

client.login(process.env.BOT_TOKEN);
