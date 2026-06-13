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

    return text.match(
        /eyJ[A-Za-z0-9+/=]+/
    )?.[0] ?? null;
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

    // creator: <@123>
    let match =
        text.match(/<@!?(\d+)>/);

    if (match) {
        return {
            type: "id",
            value: match[1]
        };
    }

    // creator: username
    match =
        text.match(
            /creator[:\s]+@?([\w\-]+)/i
        );

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
                await client.users.fetch(
                    creator.value
                );

            return user.username;
        }

        return creator.value;

    }
    catch {

        return null;

    }
}


// =====================================================
// JSON HELPERS
// =====================================================

function loadExistingDecks() {

    if (!fs.existsSync("decks.json")) {

        console.log(
            "No decks.json found."
        );

        return [];

    }

    try {

        const raw =
            fs.readFileSync(
                "decks.json",
                "utf8"
            );

        const parsed =
            JSON.parse(raw);

        return parsed.decks ?? [];

    }
    catch (error) {

        console.log(
            "Failed to read decks.json."
        );

        return [];

    }
}


function saveDecks(decks) {

    fs.writeFileSync(
        "decks.json",
        JSON.stringify(
            { decks },
            null,
            2
        ),
        "utf8"
    );

    console.log(
        "\n✔ decks.json updated"
    );
}


// =====================================================
// MAIN
// =====================================================

client.once(
    "clientReady",
    async () => {

        console.log(
            `Logged in as ${client.user.tag}`
        );

        const guild =
            client.guilds.cache.first();

        if (!guild) {

            console.log(
                "No guilds found."
            );

            client.destroy();

            return;

        }

        // -----------------------------
        // Load existing data
        // -----------------------------
        const existingDecks =
            loadExistingDecks();

        console.log(
            `Loaded ${existingDecks.length} existing deck(s).`
        );

        // -----------------------------
        // Determine latest season
        // -----------------------------
        let latestSeason = null;

        if (
            existingDecks.length > 0
        ) {

            latestSeason =
                existingDecks
                    .map(deck => {

                        const match =
                            String(
                                deck.season
                            ).match(
                                /^s(\d+)$/i
                            );

                        return match
                            ? Number(
                                match[1]
                            )
                            : null;

                    })
                    .filter(
                        value =>
                            value !== null
                    )
                    .sort(
                        (a, b) =>
                            b - a
                    )[0];

        }

        console.log(
            latestSeason !== null
                ? `Latest known season: s${latestSeason}`
                : "No previous season detected."
        );

        // -----------------------------
        // Fetch channels
        // -----------------------------
        const channels =
            await guild.channels.fetch();

        const relevantChannels = [];

        channels.forEach(channel => {

            if (!channel) return;

            const parentName =
                channel.parent?.name ??
                "";

            const isText =
                channel.type ===
                ChannelType.GuildText;

            const match =
                parentName.match(
                    /^s(\d+)$/i
                );

            if (
                !isText ||
                !match
            ) {

                return;

            }

            const seasonNumber =
                Number(match[1]);

            // If no existing decks,
            // fall back to full scan
            if (
                latestSeason === null ||
                seasonNumber === latestSeason
            ) {

                relevantChannels.push(
                    channel
                );

            }

        });

        console.log(
            `Scanning ${relevantChannels.length} channel(s)...`
        );

        // -----------------------------
        // Track channels already known
        // -----------------------------
        const existingByChannel =
            new Map(
                existingDecks.map(
                    deck => [
                        deck.channel,
                        deck
                    ]
                )
            );

        let added = 0;
        let updated = 0;

        // -----------------------------
        // Process channels
        // -----------------------------
        for (
            const channel of
            relevantChannels
        ) {

            console.log(
                `\nScanning #${channel.name}`
            );

            try {

                const messages =
                    await channel.messages.fetch(
                        {
                            limit: 100
                        }
                    );

                if (
                    messages.size === 0
                ) {

                    console.log(
                        "No messages."
                    );

                    continue;

                }

                const sorted =
                    [...messages.values()]
                        .sort(
                            (a, b) =>
                                a.createdTimestamp -
                                b.createdTimestamp
                        );

                let deckIndex =
                    -1;

                let deckMessage =
                    null;

                let deckCode =
                    null;

                // -------------------------
                // Find deck message
                // -------------------------
                for (
                    let i = 0;
                    i < sorted.length;
                    i++
                ) {

                    const msg =
                        sorted[i];

                    const code =
                        extractDeckCode(
                            msg.content
                        );

                    if (code) {

                        deckIndex =
                            i;

                        deckMessage =
                            msg;

                        deckCode =
                            code;

                        break;

                    }

                }

                if (
                    !deckMessage
                ) {

                    console.log(
                        "No deck found."
                    );

                    continue;

                }

                // -------------------------
                // Creator detection
                // -------------------------
                const window =
                    sorted.slice(
                        deckIndex,
                        deckIndex + 3
                    );

                let author =
                    deckMessage.author
                        .username;

                for (
                    const msg of window
                ) {

                    const creator =
                        extractCreator(
                            msg.content
                        );

                    if (
                        !creator
                    ) {

                        continue;

                    }

                    const resolved =
                        await resolveUser(
                            client,
                            creator
                        );

                    if (
                        resolved
                    ) {

                        author =
                            resolved;

                        break;

                    }

                }

                // -------------------------
                // Build deck object
                // -------------------------
                const normalizedCode =
                    normalizeDeckCode(
                        deckCode
                    );

                const deckData = {

                    messageId:
                        deckMessage.id,

                    season:
                        channel.parent
                            ?.name,

                    channel:
                        channel.name,

                    author,

                    deckCode:
                        normalizedCode,

                    record:
                        extractRecord(
                            deckMessage.content
                        ),

                    notes:
                        deckMessage.content
                            .replace(
                                deckCode,
                                ""
                            )
                            .trim(),

                    publishedAt:
                        deckMessage.createdAt.toISOString()

                };

                const existing =
                    existingByChannel.get(
                        channel.name
                    );

                // -------------------------
                // New deck
                // -------------------------
                if (
                    !existing
                ) {

                    existingDecks.push(
                        deckData
                    );

                    existingByChannel.set(
                        channel.name,
                        deckData
                    );

                    added++;

                    console.log(
                        "✔ Added"
                    );

                    continue;

                }

                // -------------------------
                // Updated deck
                // -------------------------
                if (
                    existing.deckCode !==
                    normalizedCode
                ) {

                    const index =
                        existingDecks.findIndex(
                            deck =>
                                deck.channel ===
                                channel.name
                        );

                    existingDecks[
                        index
                    ] =
                        deckData;

                    existingByChannel.set(
                        channel.name,
                        deckData
                    );

                    updated++;

                    console.log(
                        "✔ Updated"
                    );

                }
                else {

                    console.log(
                        "No changes."
                    );

                }

            }
            catch (error) {

                console.error(
                    `Failed #${channel.name}:`,
                    error.message
                );

            }

        }

        // -----------------------------
        // Save results
        // -----------------------------
        saveDecks(
            existingDecks
        );

        console.log(
            "\n======================"
        );

        console.log(
            `Added: ${added}`
        );

        console.log(
            `Updated: ${updated}`
        );

        console.log(
            `Total: ${existingDecks.length}`
        );

        console.log(
            "======================"
        );

        client.destroy();

    }
);

client.login(
    process.env.BOT_TOKEN
);
