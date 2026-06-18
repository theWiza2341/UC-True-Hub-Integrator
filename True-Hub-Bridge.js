// ==UserScript==
// @name         True Hub Bridge - Underscript Plugin
// @namespace    truehubbridge
// @version      1.0
// @description  True Hub overlay for Undercards Hub
// @match        https://undercards.net/*Hub*
// @grant        GM_xmlhttpRequest
// @connect      raw.githubusercontent.com
// ==/UserScript==

(function () {
    'use strict';

    const PLUGIN_NAME = "True Hub Bridge";
    const PLUGIN_VERSION = "1.0";
    let thPlugin = null;
    let thSettings = null;


    function getUnderScriptApi() {
        if (
            typeof underscript !== "undefined" &&
            underscript &&
            typeof underscript.plugin === "function"
        ) {
            return underscript;
        }

        if (
            window.underscript &&
            typeof window.underscript.plugin === "function"
        ) {
            return window.underscript;
        }

        return null;
    }

    function registerSettings() {
        if (!thPlugin) return;

        try {
            thSettings = thPlugin.settings();
            console.log("[TrueHub] UnderScript settings initialized.");
        }
        catch (err) {
            console.error("[TrueHub] Settings init failed:", err);
        }
    }

    function startTrueHub() {
        loadDecks(init);
    }

    function registerUnderScriptPlugin() {

        const us = getUnderScriptApi();

        if (!us) {
            console.log("[TrueHub] Waiting for UnderScript...");
            setTimeout(registerUnderScriptPlugin, 500);
            return;
        }

        try {

            thPlugin = us.plugin(
                PLUGIN_NAME,
                PLUGIN_VERSION
            );

            console.log(
                "[TrueHub] Connected to UnderScript."
            );

            registerSettings();

        }
        catch (err) {
            console.error(
                "[TrueHub] UnderScript registration failed:",
                err
            );
        }

        startTrueHub();
    }

    const DECKS_URL =
        "https://raw.githubusercontent.com/theWiza2341/UC-True-Hub-Integrator/refs/heads/main/decks.json";

    const DECKS_PER_PAGE = 10;

    const CHANNEL_OVERRIDES = {

        // Totem
        "Totem"        : "Totem",

        // Powerhouse
        "phouse"          : "Powerhouse",
        "powerhouse"       : "Powerhouse",
        "ph"              : "Powerhouse",

        // Soulless Kris
        "skris"      : "Soulless_Kris",

        // Overgrowth
        "og"         : "Overgrowth",
        "overgrowth" : "Overgrowth",

        // Traffic Lights
        "light"           : "Traffic_Light",
        "lights"          : "Traffic_Light",

        // Ball Dancer
        "balldancer"      : "Ball_Dancer",

        // Royal Papyrus
        "rpaps"           : "Royal_Papyrus",
        "royal-paps"      : "Royal_Papyrus",
        "royal-p"         : "Royal_Papyrus",

        // Tsunderplane
        "plane"           : "Tsunderplane",
        "tsunder"         : "Tsunderplane",

        // Lab Sign
        "lab-sign"        : "Lab_Sign",

        // Great Door
        "door"            : "Great_Door",

        // Librarian
        "librarian"       : "Librarian",
        "lib"             : "Librarian",

        // Mad Dragon
        "obama"           : "Mad_Dragon",

        // Ponman Statue
        "pieces"          : "Ponman_Statue",

        // Mercenary Hire
        "merc-hire"       : "Mercenary_Hire",
        "merchire"        : "Mercenary_Hire",

        // Kris
        "kris"            : "Kris",

        // Caged Jester
        "cjester"         : "Caged_Jester",
        "cj"              : "Caged_Jester",
        "caged-jester"    : "Caged_Jester",
        "jester"          : "Caged_Jester",
        "jailed-clown"    : "Caged_Jester",

        // Maus Cage
        "mauscage"        : "Maus_Cage",
        "maus-cage"       : "Maus_Cage",
        "cage"            : "Maus_Cage",

        // Maus
        "maus"            : "Maus",
        "rat"             : "Maus",
        "maice"           : "Maus",

        // Politician Bear
        "pol-bear"        : "Politician_Bear",
        "politician-bear" : "Politician_Bear",

        // Teacher Alphys
        "talph"           : "Teacher_Alphys",
        "talphys"         : "Teacher_Alphys",
        "talphy"          : "Teacher_Alphys",

        // Giga Queen
        "gq"              : "GIGA_Queen",
        "giga-queen"      : "GIGA_Queen",
        "giga"            : "GIGA_Queen",

        // Forest Worm
        "forest-worm"     : "Forest_Worm",
        "fworm"           : "Forest_Worm",

        // Large Chest
        "large-chest"     : "Large_Chest",

        // Big Bomb
        "big-bomb"        : "Big_Bomb",

        // Instant Noodles
        "instant-noodles" : "Instant_Noodles",
        "noodle"          : "Instant_Noodles",
        "noodles"         : "Instant_Noodles",

        // Green Flower
        "green-flower"    : "Green_Flower",
        "g-flower"        : "Green_Flower",

        // So Sorry
        "so-sorry"        : "So_Sorry",
        "sorry"           : "So_Sorry",

        // Ultimathrash
        "ultimathrash"    : "Ultimathrash",
        "ultima-thrash"   : "Ultimathrash",
        "ultima"          : "Ultimathrash",

        // Thrashing Machine
        "collection"      : "Thrashing_M",
        "t-machine"       : "Thrashing_M",
        "thrashing"       : "Thrashing_M",

        // Clover
        "clover"          : "Clover",

        // Ball Person
        "ball"            : "Ball_Person",

        // Ambyu-Lance
        "maso"            : "Ambyu-Lance",

        // Gemstone
        "gems"            : "Gemstone",
        "gem"             : "Gemstone",

        // Fortune Teller
        "fortune-teller"  : "Fortune_Teller",
        "fteller"         : "Fortune_Teller",
        "f-teller"        : "Fortune_Teller",

        // Pile of Dust
        "pile-of-dust"    : "Pile_of_Dust",
        "pod"             : "Pile_of_Dust",

        // Migospel
        "migospel"        : "Migospel",

        // Nice Cream Guy
        "nice-cream-guy"  : "Nice_Cream_Guy",
        "ncg"             : "Nice_Cream_Guy",

        // Omega Flowey
        "omega-flowey"    : "Omega_Flowey",
        "of"              : "Omega_Flowey",

        // Cyberdly
        "cyberdly"        : "Cyberdly",

        // Berdly Statue
        "berdly-statue"   : "Berdly_Statue",
        "statue"          : "Berdly_Statue",

        // Zenith Martlet
        "zenith-martlet"  : "Zenith_Martlet",
        "zenith"          : "Zenith_Martlet",
        "zmart"           : "Zenith_Martlet",
        "zartlet"         : "Zenith_Martlet",

        // Chujin Tombstone
        "chujin-tombstone": "Chujin_Tombstone",
        "chutomb"         : "Chujin_Tombstone",
        "chtomb"          : "Chujin_Tombstone",

        // Top Chef
        "top-chef"        : "Top_Chef",

        // Clam Girl
        "clam-girl"       : "Clam_Girl",
        "clamgirl"        : "Clam_Girl",

        // C-Round
        "c-round"         : "C-Round",

        // Bookshelf
        "bookshelf"       : "Bookshelf",
        "shelf"           : "Bookshelf",

        // Giga Froggit
        "giga-froggit"    : "Giga_Froggit",

        // Snoring Monsters
        "snoring-monster" : "Snoring_Monsters",
        "snoring"         : "Snoring_Monsters",

        // The Original
        "first-starwalker": "The_Original",
        "f-walker"        : "The_Original",
        "fwalker"         : "The_Original",
        "fwakler"         : "The_Original",

        // Knight's Shield
        "knight's-shield" : "Knights_Shield",
        "knights-shield"  : "Knights_Shield",

        // Bounty
        "bounty"          : "Bounty",

        // Temmie Egg
        "temmie-egg"      : "Temmie_Egg",
        "egg"             : "Temmie_Egg",

        // Sandstorm
        "sandstorm"       : "Sandstorm",

        // Oasis
        "oasis"           : "Oasis",

        // Feast
        "feast"           : "Feast",

        // Frostermit
        "frostermit"      : "Frostermit",

        // Hyperlinks
        "hlb"             : "Hyperlink_Blocked",
        "hyperlink"       : "Hyperlink_Blocked",

        // Spider
        "spider"          : "Spider",

        // Red Flower
        "seedlings"       : "Red_Flower",
        "seedling"        : "Red_Flower",

        // Casual Undyne
        "casual-undyne"  : "Casual_Undyne",
        "casdyne"        : "Casual_Undyne",

        // Mines
        "mines"          : "Mine",
        "mine"           : "Mine",

        // Coffin
        "coffin"         : "Coffin",

        // Berdly
        "berdly"         : "Berdly",

        // Contamination
        "contamination"  : "Contamination",
        "contam"         : "Contamination",

        // Shambling Mass
        "shambling-mass" : "Shambling_Mass",
        "shambles"       : "Shambling_Mass",
        "shamble"        : "Shambling_Mass",

        // Moldsmal
        "moldsmal"       : "Moldsmal",
        "mold"           : "Moldsmal",

        // Cyber Trash
        "cyber-trash"    : "Cyber_Trash",
        "ctrash"         : "Cyber_Trash",
        "trash"          : "Cyber_Trash",

        // Bryan
        "bryan"          : "Bryan",

        // Gift
        "gift"           : "Gift",

        // Cactus
        "cactus"         : "Cactus",

        // Abstract Art
        "abstract-art"   : "Abstract_Art",
        "abs-art"        : "Abstract_Art",
        "absart"         : "Abstract_Art",

        // Seam
        "seam"           : "Seam",

        // Pipis
        "pipis"          : "Pipis",

        // Assault
        "assault"        : "Assault",

        // Angie
        "angie"          : "Angie",

        // Werewerewire
        "werewerewire"   : "Werewerewire",
        "plug"           : "Werewerewire",

        // Gerson Tombstone
        "gerson-tombstone" : "Gerson_Tombstone",
        "gertomb"        : "Gerson_Tombstone",

        // Ceroba Ketsukane
        "ceroba-ketsukane" : "Ceroba_Ketsukane",
        "ketsukane"      : "Ceroba_Ketsukane",
        "ketsu"          : "Ceroba_Ketsukane",

        // Tasque Singer
        "tasque-singer"  : "Tasque_Singer",
        "singer"         : "Tasque_Singer",

        // Cyber Balloon
        "cyber-balloon"  : "Cyber_Balloon",
        "balloon"        : "Cyber_Balloon",

        // Burning Snail
        "burning-snail"  : "Burning_Snail",
        "snail"          : "Burning_Snail",

        // Tnt Man
        "tnt-man"        : "TNT_Man",
        "tnt"            : "TNT_Man",

        // Gardener Asgore
        "gardener-asgore": "Gardener_Asgore",
        "gardengore"     : "Gardener_Asgore",
        "garden"         : "Gardener_Asgore",

        // Jigsawry
        "jigsawry"       : "Jigsawry",
        "jig"            : "Jigsawry",

        // Pillar
        "pillar"         : "Pillar",

        // Library Loox
        "library-loox"   : "Library_Loox",
        "lib-loox"       : "Library_Loox",
        "libloox"        : "Library_Loox",

        // Overlord Migosp
        "overlord-migosp": "Overlord_Migosp",
        "overlord"       : "Overlord_Migosp",

        // Angel of Death
        "angel-of-death" : "Angel_of_Death",
        "aod"            : "Angel_of_Death",

        // Shield
        "soliditdy"      : "Shield",

        // The Barrier
        "barrier"        : "The_Barrier",

        // Undyne
        "undyne"         : "Undyne",

        // Eye
        "Amalgamate"     : "Eye",

        // Devil Doll
        "devil-doll"     : "Devil_Doll",

        // Icemeter
        "icemeter"       : "Icemeter",

        // Dalv's Wardrobe
        "dalvs-wardrobe" : "Dalvs_Wardrobe",
        "wardrobe"       : "Dalvs_Wardrobe",

        // Defrosting
        "defrosting"     : "Defrosting",

        // Memory Keeper
        "memory-keeper"  : "Memory_Keeper",
        "meme-keeper"    : "Memory_Keeper",
        "keeper"         : "Memory_Keeper",

        // Ribbick
        "ribbick"        : "Ribbick",

        // Rockstar Kris
        "rockstar-kris"  : "Rockstar_Kris",

        // Mo
        "mo"             : "Mo",

        // Gacha Ball
        "gachapon"       : "Gacha_Ball",

        // Arcade Machine
        "arcade-machine" : "Arcade_Machine",
        "arc-mac"        : "Arcade_Machine",
        "arcmac"         : "Arcade_Machine",

        // White Cloak
        "white-cloak"    : "White_Cloak",
        "cloak"          : "White_Cloak",

        // Whimsalot
        "whimsalot"      : "Whimsalot",
        "whimsa"         : "Whimsalot",

        // Rockstar Ralsei
        "rockstar-ralsei": "Rockstar_Ralsei",

        // Royal Loox
        "royal-loox"     : "Royal_Loox",
        "rloox"          : "Royal_Loox",

        // Hanging Spider
        "hanging-spider" : "Hanging_Spider",
        "hang"           : "Hanging_Spider",

        // Titan Fuzzy
        "titan-fuzzy"    : "Titan_Fuzzy",
        "fuzzy"          : "Titan_Fuzzy",

        // Titan
        "titan"          : "Titan",

        // Shrine Mascot
        "shrine-mascot"  : "Deflated_Mascot",
        "mascot"         : "Deflated_Mascot",

        // Pumpkin Head
        "jackenstein"    : "Pumpkin_Head",
        "dark-zone"      : "Pumpkin_Head",
        "darkzone"       : "Pumpkin_Head",

        // Food Enjoyer
        "food-enjoyer"   : "Food_Enjoyer",

        // Wicabel
        "wicabel"        : "Wicabel",
        "wica"           : "Wicabel",

        // Gaster Blaster
        "gaster-blaster" : "Gaster_Blaster",
        "science"        : "Gaster_Blaster",

        // Fire Chimney
        "fire-chimney"   : "Fire_Chimney",
        "chimney"        : "Fire_Chimney"

    };

    const ORDERED_CHANNEL_OVERRIDES =
        Object.entries(CHANNEL_OVERRIDES)
        .sort(([a], [b]) => b.length - a.length);

    // -------------------------------------------------
    // STATE
    // -------------------------------------------------

    let allDecks      = [];
    let filteredDecks = [];
    let currentPage   = 1;
    let mode          = "classic";

    // Card filter state
    // Each entry: { id, name }
    let includeCards  = [];   // green — deck MUST contain these
    let excludeCards  = [];   // red   — deck MUST NOT contain these

    // DOM refs
    let originalDecks  = null;
    let template       = null;
    let trueHubWrapper = null;
    let trueHubList    = null;
    let trueHubNavEl   = null;

    let selectPage    = null;
    let currentPageEl = null;
    let maxPageEl     = null;
    let btnPrevious   = null;
    let btnNext       = null;

    let ucNavRow = null;

    let classicState     = null;
    let activeSoulFilter = null;
    let activeSearch     = "";

    const SOUL_COLORS = {
        DETERMINATION : "red",
        PATIENCE      : "#41fcff",
        BRAVERY       : "#fca500",
        INTEGRITY     : "#0064ff",
        PERSEVERANCE  : "#d535d9",
        KINDNESS      : "#00c000",
        JUSTICE       : "#ffff00"
    };

    // -------------------------------------------------
    // LOAD JSON
    // -------------------------------------------------

    function loadDecks(onReady) {
        GM_xmlhttpRequest({
            method: "GET",
            url: DECKS_URL,
            onload(res) {
                try {
                    const raw = JSON.parse(res.responseText);
                    allDecks = Array.isArray(raw) ? raw : (raw.decks || []);
                    allDecks.sort((a, b) =>
                        new Date(b.publishedAt || 0) - new Date(a.publishedAt || 0)
                    );
                    filteredDecks = [...allDecks];
                    console.log("[TrueHub] Loaded", allDecks.length, "decks.");
                    onReady();
                } catch (e) {
                    console.error("[TrueHub] JSON parse error:", e);
                }
            },
            onerror(err) {
                console.error("[TrueHub] Fetch failed:", err);
            }
        });
    }

    // -------------------------------------------------
    // DECODE DECK
    // -------------------------------------------------

    function decodeDeck(deckCode) {
        try {
            return JSON.parse(atob(deckCode));
        } catch (err) {
            console.error("[TrueHub] Failed to decode deck:", err, deckCode);
            return null;
        }
    }

    // -------------------------------------------------
    // FIND DECK IMAGE CANDIDATE
    // -------------------------------------------------

    function determineImageFromDeck(deckCode) {
        const decoded = decodeDeck(deckCode);
        if (!decoded || !decoded.cardIds) return null;

        const counts = new Map();

        decoded.cardIds.forEach(cardId => {
            const card = getCard(cardId);
            if (!card || card.typeCard !== 0) return;
            counts.set(cardId, (counts.get(cardId) || 0) + 1);
        });

        let winner = null;
        let highestCount = 0;

        decoded.cardIds.forEach(cardId => {
            const card = getCard(cardId);
            if (!card || card.typeCard !== 0) return;
            const count = counts.get(cardId);
            if (count >= highestCount) {
                highestCount = count;
                winner = card;
            }
        });

        return winner?.image || null;
    }

    // -------------------------------------------------
    // WAIT FOR HUB
    // -------------------------------------------------

    function waitForHub(cb) {
        const check = () => {
            const hub  = document.getElementById("hubDecks");
            const tmpl = hub?.querySelector(".hubDeck");
            if (hub && tmpl) {
                cb(hub, tmpl);
            } else {
                setTimeout(check, 200);
            }
        };
        check();
    }

    // -------------------------------------------------
    // GET PLAYABLE CARDS from allCards (exclude STORY and TOKEN)
    // -------------------------------------------------

    function getPlayableCards() {
        try {
            const src =
                (typeof unsafeWindow !== "undefined" ? unsafeWindow : window).allCards;

            if (!Array.isArray(src)) return [];

            return src.filter(c =>
                c.rarity !== "STORY" && c.rarity !== "TOKEN"
            );
        } catch (e) {
            console.error("[TrueHub] Could not read allCards:", e);
            return [];
        }
    }

    // -------------------------------------------------
    // CARD FILTER HELPERS
    // -------------------------------------------------

    function isCardInList(list, id) {
        return list.some(c => c.id === id);
    }

    function removeCardFromList(list, id) {
        const idx = list.findIndex(c => c.id === id);
        if (idx !== -1) list.splice(idx, 1);
    }

    // Adds card to include or exclude list, removing from the other if present.
    function addCardToFilter(targetList, otherList, card) {
        if (isCardInList(targetList, card.id)) return; // already there
        removeCardFromList(otherList, card.id);
        targetList.push({ id: card.id, name: card.name });
        applyFilters();
        renderCardFilterTags();
    }

    function removeCardFromFilter(list, id) {
        removeCardFromList(list, id);
        applyFilters();
        renderCardFilterTags();
    }

    // -------------------------------------------------
    // FILTERS
    // -------------------------------------------------

    function applyFilters() {
        if (!trueHubList) return;

        const term = activeSearch.trim().toLowerCase();

        filteredDecks = allDecks.filter(deck => {

            // Soul filter
            if (activeSoulFilter) {
                const decoded = decodeDeck(deck.deckCode);
                if (!decoded) return false;
                const soul = decoded.soul || decoded.classe;
                if (soul !== activeSoulFilter) return false;
            }

            // Text search
            if (term) {
                const name   = (deck.channel || "").toLowerCase().replace(/-/g, " ");
                const author = (deck.author  || "").toLowerCase();
                const season = (deck.season  || "").toLowerCase();

                if (
                    !name.includes(term)   &&
                    !author.includes(term) &&
                    !season.includes(term)
                ) {
                    return false;
                }
            }

            // Card include / exclude filter
            if (includeCards.length > 0 || excludeCards.length > 0) {
                const decoded = decodeDeck(deck.deckCode);
                if (!decoded || !Array.isArray(decoded.cardIds)) return false;

                const idSet = new Set(decoded.cardIds);

                // Every included card must appear at least once
                for (const c of includeCards) {
                    if (!idSet.has(c.id)) return false;
                }

                // No excluded card may appear
                for (const c of excludeCards) {
                    if (idSet.has(c.id)) return false;
                }
            }

            return true;
        });

        currentPage = 1;
        renderPage();
    }

    // -------------------------------------------------
    // BUILD ONE CARD
    // -------------------------------------------------

    function buildCard(deck) {
        const clone = template.cloneNode(true);

        // --- Name ---
        const nameEl = clone.querySelector(".hubDeckName div");
        if (nameEl) {
            const decoded = decodeDeck(deck.deckCode);
            nameEl.textContent = (deck.channel || "Unknown")
                .replace(/-/g, " ")
                .replace(/\b\w/g, l => l.toUpperCase());

            if (decoded?.soul && SOUL_COLORS[decoded.soul]) {
                nameEl.style.color = SOUL_COLORS[decoded.soul];
            }
        }

        // --- Author ---
        const ownerEl = clone.querySelector(".hubDeckOwner");
        if (ownerEl) {
            const img = ownerEl.querySelector("img");
            if (img) img.remove();
            ownerEl.textContent = deck.author || "Unknown";
            ownerEl.style.textAlign = "center";
        }

        // --- Deck Image ---
        const imageEl = clone.querySelector(".hubDeckImage img");
        if (imageEl) {
            const channel = (deck.channel || "").toLowerCase();
            let imageName = null;

            for (const [term, card] of ORDERED_CHANNEL_OVERRIDES) {
                if (channel.includes(term.toLowerCase())) {
                    imageName = card;
                    break;
                }
            }

            if (!imageName) {
                imageName = determineImageFromDeck(deck.deckCode);
            }

            if (imageName) {
                imageEl.src = `images/cards/${imageName}.png`;
            }
        }

        // --- Artifacts ---
        const artifactContainer = clone.querySelector(".hubDeckArtifacts");
        if (artifactContainer) {
            artifactContainer.innerHTML = "";
            try {
                const decoded   = JSON.parse(atob(deck.deckCode));
                const artifacts = (decoded.artifactIds || [])
                    .map(id => getArtifact(id))
                    .filter(Boolean);

                artifacts.forEach((artifact, index) => {
                    const img = document.createElement("img");
                    img.src   = `images/artifacts/${artifact.image}.png`;
                    img.title = artifact.name;
                    artifactContainer.appendChild(img);
                    if (index < artifacts.length - 1) {
                        artifactContainer.append(" ");
                    }
                });
            } catch (err) {
                console.error("[TrueHub] Artifact decode failed:", err, deck);
            }
        }

        // --- Season ---
        const archetypeEl = clone.querySelector(".hubDeckArchetype div");
        if (archetypeEl) archetypeEl.textContent = deck.season || "s??";

        // --- Wins ---
        const likesEl = clone.querySelector(".hubDeckLikes");
        if (likesEl) {
            const wins = deck.record?.wins ?? "-";
            likesEl.innerHTML = `<span style="color:#0dd000">${wins}</span>`;
        }

        // --- Losses ---
        const starEl = clone.querySelector(".hubDeckStar");
        if (starEl) {
            const losses = deck.record?.losses ?? "-";
            starEl.innerHTML = `<span style="color:#f0003c">${losses}</span>`;
        }

        // --- Info button ---
        const diffEl = clone.querySelector(".hubDeckDifficulty");
        if (diffEl) {
            diffEl.innerHTML = "";
            const btn = document.createElement("button");
            btn.textContent = "Info";
            Object.assign(btn.style, {
                background : "#7a0000",
                border     : "1px solid #f0003c",
                color      : "white",
                padding    : "3px 8px",
                cursor     : "pointer",
                opacity    : "0.85"
            });
            btn.onclick = (e) => {
                e.stopPropagation();
                showInfo(deck);
            };
            diffEl.appendChild(btn);
        }

        // --- Preview button ---
        const previewButton = clone.querySelector(".show-button");
        if (previewButton) {
            previewButton.removeAttribute("onclick");
            previewButton.onclick = (e) => {
                e.preventDefault();
                e.stopPropagation();

                const code      = deck.deckCode;
                const published = deck.publishedAt || new Date().toISOString();

                const script = document.createElement("script");
                script.textContent = `
                    try {
                        if (typeof showDeckLoadHub === "function") {
                            showDeckLoadHub(
                                ${JSON.stringify(code)},
                                ${JSON.stringify(published)}
                            );
                        } else {
                            console.error("[TrueHub] showDeckLoadHub unavailable.");
                        }
                    } catch (err) {
                        console.error("[TrueHub] Preview failed:", err);
                    }
                `;
                document.documentElement.appendChild(script);
                script.remove();
            };
        }

        return clone;
    }

    // -------------------------------------------------
    // RENDER CURRENT PAGE
    // -------------------------------------------------

    function renderPage() {
        trueHubList.innerHTML = "";

        const start   = (currentPage - 1) * DECKS_PER_PAGE;
        const visible = filteredDecks.slice(start, start + DECKS_PER_PAGE);

        visible.forEach(deck => {
            trueHubList.appendChild(buildCard(deck));
        });

        syncNav();
    }

    // -------------------------------------------------
    // CARD FILTER PANEL — DOM
    // -------------------------------------------------

    let cardFilterPanel   = null;
    let cardSearchInput   = null;
    let cardDropdown      = null;
    let cardTagsContainer = null;

    function buildCardFilterPanel() {
        // Outer panel — hidden by default, stretches to match deck grid width
        cardFilterPanel = document.createElement("div");
        cardFilterPanel.id = "th-card-filter-panel";
        Object.assign(cardFilterPanel.style, {
            display      : "none",
            width        : "100%",
            boxSizing    : "border-box",
            margin       : "0 0 6px 0",
            padding      : "10px 12px",
            background   : "#1a1a1a",
            border       : "1px solid #444",
            borderRadius : "4px"
        });

        // Search row
        const searchRow = document.createElement("div");
        Object.assign(searchRow.style, {
            display    : "flex",
            alignItems : "center",
            gap        : "8px",
            marginBottom: "8px"
        });

        cardSearchInput = document.createElement("input");
        cardSearchInput.type        = "text";
        cardSearchInput.placeholder = "Search cards to filter...";
        cardSearchInput.className   = "form-control";
        Object.assign(cardSearchInput.style, {
            width     : "100%",
            boxSizing : "border-box",
            fontSize  : "13px"
        });

        searchRow.appendChild(cardSearchInput);
        cardFilterPanel.appendChild(searchRow);

        // Dropdown results list — 3-column grid (panel is now full deck-grid width)
        cardDropdown = document.createElement("div");
        cardDropdown.id = "th-card-dropdown";
        Object.assign(cardDropdown.style, {
            background          : "#222",
            border              : "1px solid #555",
            borderRadius        : "4px",
            maxHeight           : "150px",
            overflowY           : "auto",
            marginBottom        : "8px",
            gridTemplateColumns : "1fr 1fr 1fr",
            gap                 : "0"
        });
        cardDropdown.style.display = "none";
        cardFilterPanel.appendChild(cardDropdown);

        // Tags display area
        cardTagsContainer = document.createElement("div");
        cardTagsContainer.id = "th-card-tags";
        Object.assign(cardTagsContainer.style, {
            display   : "flex",
            flexWrap  : "wrap",
            gap       : "6px",
            minHeight : "24px"
        });
        cardFilterPanel.appendChild(cardTagsContainer);

        // Wire search input
        cardSearchInput.addEventListener("input", () => {
            const term = cardSearchInput.value.trim().toLowerCase();
            if (!term) {
                cardDropdown.style.display = "none";
                cardDropdown.innerHTML = "";
                return;
            }

            const playable = getPlayableCards();
            const matches  = playable
                .filter(c => c.name && c.name.toLowerCase().includes(term))
                .slice(0, 30);

            cardDropdown.innerHTML = "";

            if (matches.length === 0) {
                cardDropdown.style.display = "none";
                return;
            }

            cardDropdown.style.display = "grid";

            matches.forEach(card => {
                const row = document.createElement("div");
                Object.assign(row.style, {
                    display      : "flex",
                    alignItems   : "center",
                    gap          : "5px",
                    padding      : "4px 8px",
                    fontSize     : "12px",
                    color        : "#eee",
                    borderBottom : "1px solid #2a2a2a",
                    borderRight  : "1px solid #2a2a2a",
                    overflow     : "hidden"
                });

                // Highlight already-tagged cards
                const inInclude = isCardInList(includeCards, card.id);
                const inExclude = isCardInList(excludeCards, card.id);

                // Name label — truncates if too long
                const nameSpan = document.createElement("span");
                nameSpan.textContent = card.name;
                Object.assign(nameSpan.style, {
                    flex         : "1",
                    minWidth     : "0",
                    overflow     : "hidden",
                    textOverflow : "ellipsis",
                    whiteSpace   : "nowrap",
                    color        : inInclude ? "#4ade80" : inExclude ? "#f87171" : "#eee"
                });

                // Button group — always right-aligned, never wraps
                const btnGroup = document.createElement("div");
                Object.assign(btnGroup.style, {
                    display    : "flex",
                    gap        : "4px",
                    flexShrink : "0"
                });

                const btnInclude = document.createElement("button");
                btnInclude.textContent = "+ Inc";
                Object.assign(btnInclude.style, {
                    background  : "#14532d",
                    border      : "1px solid #4ade80",
                    color       : "#4ade80",
                    padding     : "1px 5px",
                    cursor      : "pointer",
                    fontSize    : "10px",
                    borderRadius: "3px",
                    whiteSpace  : "nowrap"
                });
                btnInclude.onclick = (e) => {
                    e.stopPropagation();
                    addCardToFilter(includeCards, excludeCards, card);
                    cardSearchInput.value = "";
                    cardDropdown.style.display = "none";
                    cardDropdown.innerHTML = "";
                };

                const btnExclude = document.createElement("button");
                btnExclude.textContent = "− Exc";
                Object.assign(btnExclude.style, {
                    background  : "#450a0a",
                    border      : "1px solid #f87171",
                    color       : "#f87171",
                    padding     : "1px 5px",
                    cursor      : "pointer",
                    fontSize    : "10px",
                    borderRadius: "3px",
                    whiteSpace  : "nowrap"
                });
                btnExclude.onclick = (e) => {
                    e.stopPropagation();
                    addCardToFilter(excludeCards, includeCards, card);
                    cardSearchInput.value = "";
                    cardDropdown.style.display = "none";
                    cardDropdown.innerHTML = "";
                };

                btnGroup.appendChild(btnInclude);
                btnGroup.appendChild(btnExclude);
                row.appendChild(nameSpan);
                row.appendChild(btnGroup);

                cardDropdown.appendChild(row);
            });
        });

        // Close dropdown when clicking outside the panel
        document.addEventListener("click", (e) => {
            if (!cardFilterPanel.contains(e.target)) {
                cardDropdown.style.display = "none";
            }
        });

        return cardFilterPanel;
    }

    function renderCardFilterTags() {
        if (!cardTagsContainer) return;
        cardTagsContainer.innerHTML = "";

        const makeTag = (card, color, borderColor, list) => {
            const tag = document.createElement("span");
            Object.assign(tag.style, {
                display      : "inline-flex",
                alignItems   : "center",
                gap          : "5px",
                padding      : "2px 8px",
                background   : color,
                border       : `1px solid ${borderColor}`,
                borderRadius : "3px",
                fontSize     : "12px",
                color        : "#fff",
                whiteSpace   : "nowrap"
            });
            tag.textContent = card.name;

            const x = document.createElement("span");
            x.textContent = "×";
            Object.assign(x.style, {
                cursor     : "pointer",
                fontWeight : "bold",
                marginLeft : "2px",
                lineHeight : "1"
            });
            x.onclick = () => removeCardFromFilter(list, card.id);
            tag.appendChild(x);

            return tag;
        };

        includeCards.forEach(c =>
            cardTagsContainer.appendChild(
                makeTag(c, "#14532d", "#4ade80", includeCards)
            )
        );

        excludeCards.forEach(c =>
            cardTagsContainer.appendChild(
                makeTag(c, "#450a0a", "#f87171", excludeCards)
            )
        );

        // Show a hint if no tags yet
        if (includeCards.length === 0 && excludeCards.length === 0) {
            const hint = document.createElement("span");
            hint.textContent = "No card filters active.";
            hint.style.cssText = "font-size:12px; color:#777; font-style:italic;";
            cardTagsContainer.appendChild(hint);
        }
    }

    // -------------------------------------------------
    // TRUE HUB NAV
    // -------------------------------------------------

    function buildTrueHubNav() {
        ucNavRow = btnPrevious?.closest("tr, nav, .row, thead")
            || btnPrevious?.parentElement;

        const nav = document.createElement("div");
        nav.id = "truehub-nav";
        Object.assign(nav.style, {
            display    : "none",
            margin     : "8px 0",
            fontFamily : "inherit",
            boxSizing  : "border-box",
            width      : "100%"
        });

        // ── Main toolbar ────────────────────────────────────
        // Stretches edge-to-edge using the deck grid's own width.
        // Controls are evenly spaced with justify-content: space-between.
        const toolbar = document.createElement("div");
        toolbar.id = "th-toolbar";
        Object.assign(toolbar.style, {
            display        : "flex",
            alignItems     : "center",
            justifyContent : "space-between",
            width          : "100%",
            boxSizing      : "border-box",
            padding        : "0",
            margin         : "0 0 6px 0"
        });

        // ── LEFT group: [Search] [Soul] ─────────────────────
        const leftControls = document.createElement("div");
        Object.assign(leftControls.style, {
            display    : "flex",
            alignItems : "center",
            gap        : "10px"
        });

        const searchBox = document.createElement("input");
        searchBox.id          = "th-search";
        searchBox.type        = "text";
        searchBox.placeholder = "Search decks...";
        searchBox.className   = "form-control";
        Object.assign(searchBox.style, {
            width   : "180px",
            padding : "4px 8px"
        });
        leftControls.appendChild(searchBox);

        // Soul select — cloned from UC's original
        const originalSoulSelect = document.getElementById("selectSouls");
        if (originalSoulSelect) {
            const soulSelect = originalSoulSelect.cloneNode(true);
            soulSelect.id = "th-select-souls";

            const noneOption = soulSelect.querySelector('option[value=""]');
            if (noneOption) {
                noneOption.textContent = "Filter: Soul";
                noneOption.selected = true;
            }

            function updateSoulClass() {
                Object.keys(SOUL_COLORS).forEach(soul => {
                    soulSelect.classList.remove(soul);
                });
                if (soulSelect.value) soulSelect.classList.add(soulSelect.value);
            }

            soulSelect.addEventListener("change", () => {
                updateSoulClass();
                activeSoulFilter = soulSelect.value || null;
                applyFilters();
            });

            leftControls.appendChild(soulSelect);
        }

        toolbar.appendChild(leftControls);

        // ── MIDDLE: Card Filter button ──────────────────────
        const cardFilterBtn = document.createElement("button");
        cardFilterBtn.id          = "th-card-filter-btn";
        cardFilterBtn.textContent = "Card Filter";
        cardFilterBtn.className   = "btn btn-default";
        Object.assign(cardFilterBtn.style, {
            padding    : "4px 16px",
            whiteSpace : "nowrap",
            background : "#0e1a30",
            border     : "1px solid #1e3a60",
            color      : "#4a7aaa"
        });

        cardFilterBtn.onclick = () => {
            const isOpen = cardFilterPanel.style.display !== "none";
            cardFilterPanel.style.display = isOpen ? "none" : "block";
            if (!isOpen) {
                cardSearchInput.focus();
                renderCardFilterTags();
            }
        };

        toolbar.appendChild(cardFilterBtn);

        // ── RIGHT group: [◀] [page select] [/] [max] [▶] ───
        const pagerGroup = document.createElement("div");
        Object.assign(pagerGroup.style, {
            display    : "flex",
            alignItems : "center",
            gap        : "6px"
        });

        const btnPrev = document.createElement("button");
        btnPrev.id        = "th-btn-prev";
        btnPrev.className = "btn btn-primary";
        btnPrev.disabled  = true;
        btnPrev.innerHTML = "&#10094;";

        const pageSelect = document.createElement("select");
        pageSelect.id = "th-select-page";

        const slash = document.createElement("span");
        slash.textContent = "/";

        const maxPage = document.createElement("span");
        maxPage.id          = "th-max-page";
        maxPage.textContent = "1";

        const btnNext2 = document.createElement("button");
        btnNext2.id        = "th-btn-next";
        btnNext2.className = "btn btn-primary";
        btnNext2.innerHTML = "&#10095;";

        pagerGroup.appendChild(btnPrev);
        pagerGroup.appendChild(pageSelect);
        pagerGroup.appendChild(slash);
        pagerGroup.appendChild(maxPage);
        pagerGroup.appendChild(btnNext2);

        toolbar.appendChild(pagerGroup);
        nav.appendChild(toolbar);

        // ── Card filter panel (below toolbar, same width) ───
        nav.appendChild(buildCardFilterPanel());

        // Insert into DOM
        if (ucNavRow) {
            ucNavRow.insertAdjacentElement("afterend", nav);
        } else {
            originalDecks.insertAdjacentElement("beforebegin", nav);
        }

        // Wire search
        searchBox.addEventListener("input", () => {
            activeSearch = searchBox.value;
            applyFilters();
        });

        // Wire pager buttons
        btnPrev.onclick = () => {
            if (currentPage <= 1) return;
            currentPage--;
            renderPage();
        };

        btnNext2.onclick = () => {
            const total = Math.ceil(filteredDecks.length / DECKS_PER_PAGE);
            if (currentPage >= total) return;
            currentPage++;
            renderPage();
        };

        pageSelect.onchange = (e) => {
            currentPage = Number(e.target.value) + 1;
            renderPage();
        };

        trueHubNavEl = nav;
    }

    // -------------------------------------------------
    // SYNC OUR NAV UI
    // -------------------------------------------------

    function syncNav() {
        const total = Math.max(
            1,
            Math.ceil(filteredDecks.length / DECKS_PER_PAGE)
        );

        const thSelect = document.getElementById("th-select-page");
        const thMax    = document.getElementById("th-max-page");
        const thPrev   = document.getElementById("th-btn-prev");
        const thNext   = document.getElementById("th-btn-next");

        if (!thSelect || !thMax || !thPrev || !thNext) return;

        thSelect.innerHTML = "";
        for (let i = 1; i <= total; i++) {
            const opt = document.createElement("option");
            opt.value       = i - 1;
            opt.textContent = i;
            if (i === currentPage) opt.selected = true;
            thSelect.appendChild(opt);
        }

        thMax.textContent = total;
        thPrev.disabled   = (currentPage <= 1);
        thNext.disabled   = (currentPage >= total);
    }

    // -------------------------------------------------
    // ENABLE / RESTORE NAV
    // -------------------------------------------------

    function enableTrueHubNav() {
        if (ucNavRow) ucNavRow.style.display = "none";
        if (trueHubNavEl) {
            // Match the nav and card filter panel exactly to the deck grid width
            const gridWidth = trueHubWrapper.offsetWidth || originalDecks.offsetWidth;
            if (gridWidth > 0) {
                trueHubNavEl.style.width      = gridWidth + "px";
                trueHubNavEl.style.maxWidth   = gridWidth + "px";
                if (cardFilterPanel) {
                    cardFilterPanel.style.width    = "100%";
                    cardFilterPanel.style.maxWidth = "100%";
                }
            }
            trueHubNavEl.style.display = "";
        }
    }

    function restoreClassicNav() {
        if (trueHubNavEl) trueHubNavEl.style.display = "none";
        if (ucNavRow) ucNavRow.style.display = "";

        if (!classicState) return;

        const liveSelect = document.getElementById("selectPage");
        const livePrev   = document.getElementById("btnPrevious");
        const liveNext   = document.getElementById("btnNext");
        const liveCur    = document.getElementById("currentPage");
        const liveMax    = document.getElementById("maxPage");

        if (liveSelect) liveSelect.innerHTML     = classicState.selectHTML;
        if (liveCur)    liveCur.textContent      = classicState.currentPage;
        if (liveMax)    liveMax.textContent      = classicState.maxPage;
        if (livePrev)   livePrev.disabled        = classicState.prevDisabled;
        if (liveNext)   liveNext.disabled        = classicState.nextDisabled;
    }

    // -------------------------------------------------
    // CLEAN INFO
    // -------------------------------------------------

    function cleanNotes(notes) {
        if (!notes) return "No description available.";

        return notes
            .replace(/\\n/g, "\n")
            .replace(/<[^>]+>/g, "")
            .replace(/ {2,}/g, " ")
            .split("\n")
            .filter(line => !line.trim().toLowerCase().startsWith("creator"))
            .filter(line => !/https?:\/\//i.test(line))
            .join("\n")
            .replace(/\n{3,}/g, "\n\n")
            .trim();
    }

    // -------------------------------------------------
    // INFO POPUP
    // -------------------------------------------------

    function showInfo(deck) {
        const msg = cleanNotes(deck.notes);

        const BootstrapDialog =
            window.BootstrapDialog
            ?? (typeof unsafeWindow !== "undefined"
                ? unsafeWindow?.BootstrapDialog
                : null);

        if (BootstrapDialog?.alert) {
            BootstrapDialog.alert({
                title  : deck.channel || "Deck Info",
                message: msg
            });
        } else {
            alert(msg);
        }
    }

    // -------------------------------------------------
    // TOGGLE
    // -------------------------------------------------

    function buildToggle() {
        const wrap = document.createElement("div");
        wrap.style.cssText = "text-align:center; margin:20px 0;";
        wrap.innerHTML = `
            <button id="truehub-switch" class="btn btn-primary">
                Switch to True Hub
            </button>
        `;

        trueHubWrapper.insertAdjacentElement("afterend", wrap);

        document.getElementById("truehub-switch").onclick = () => {
            const btn = document.getElementById("truehub-switch");

            if (mode === "classic") {
                if (!classicState) {
                    classicState = {
                        selectHTML  : selectPage.innerHTML,
                        currentPage : currentPageEl.textContent,
                        maxPage     : maxPageEl.textContent,
                        prevDisabled: btnPrevious.disabled,
                        nextDisabled: btnNext.disabled
                    };
                }

                originalDecks.style.display  = "none";
                trueHubWrapper.style.display  = "";

                currentPage = 1;
                enableTrueHubNav();
                renderPage();

                btn.textContent = "Switch to Classic Hub";
                mode = "true";

            } else {
                trueHubWrapper.style.display  = "none";
                originalDecks.style.display   = "";

                restoreClassicNav();

                btn.textContent = "Switch to True Hub";
                mode = "classic";
            }
        };
    }

    // -------------------------------------------------
    // INIT
    // -------------------------------------------------

    function init() {
        waitForHub((hub, tmpl) => {
            originalDecks = hub;
            template      = tmpl;

            selectPage    = document.getElementById("selectPage");
            currentPageEl = document.getElementById("currentPage");
            maxPageEl     = document.getElementById("maxPage");
            btnPrevious   = document.getElementById("btnPrevious");
            btnNext       = document.getElementById("btnNext");

            if (!selectPage || !btnPrevious || !btnNext) {
                console.error("[TrueHub] Could not find nav elements.");
                return;
            }

            const style = document.createElement("style");
            style.textContent = `
                #truehub-list .hubDeck {
                    margin-right: 10px;
                    margin-bottom: 10px;
                }
                #th-card-dropdown::-webkit-scrollbar {
                    width: 6px;
                }
                #th-card-dropdown::-webkit-scrollbar-thumb {
                    background: #555;
                    border-radius: 3px;
                }
            `;
            document.head.appendChild(style);

            trueHubWrapper = document.createElement("div");
            trueHubWrapper.id           = "truehub-wrapper";
            trueHubWrapper.style.display = "none";

            trueHubList    = originalDecks.cloneNode(false);
            trueHubList.id = "truehub-list";

            trueHubList.addEventListener("wheel", (e) => {
                if (mode !== "true") return;
                e.preventDefault();

                const totalPages = Math.max(
                    1,
                    Math.ceil(filteredDecks.length / DECKS_PER_PAGE)
                );

                if (e.deltaY > 0) {
                    if (currentPage < totalPages) { currentPage++; renderPage(); }
                } else if (e.deltaY < 0) {
                    if (currentPage > 1) { currentPage--; renderPage(); }
                }
            }, { passive: false });

            trueHubWrapper.appendChild(trueHubList);
            originalDecks.insertAdjacentElement("afterend", trueHubWrapper);

            buildTrueHubNav();
            buildToggle();

            console.log("[TrueHub] Ready. Decks loaded:", allDecks.length);
        });
    }

    registerUnderScriptPlugin();

})();