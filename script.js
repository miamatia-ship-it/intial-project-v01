/* =========================================================
   1. CONFIGURATION AND RULE ASSUMPTIONS
========================================================= */

const CONFIG = {
    targetScore: 2100,
    initialHandSize: 11,
    stashSize: 11,
    numberOfDecks: 2,
    jokersPerDeck: 2,
    minimumBuracoSize: 7,

    wildRanks: ["2"],

    // Discard pickup requires immediate use of the top card.
    requireImmediateDiscardUse: true,

    // Take stash immediately after emptying the initial hand.
    automaticStash: true,

    // Ending requires a completed Buraco and an empty hand and stash.
    requireBuracoToEnd: true,

    // Scoring assumptions.
    cleanBuracoBonus: 500,
    dirtyBuracoBonus: 300,
    goingOutBonus: 0,

    // Aces are high only: 10-J-Q-K-A.
    aceHighOnly: true,

    // Maximum one wild card per two natural cards.
    wildRatio: 2,

    // A player unable to draw or legally pick up the discard pile
    // passes. Two consecutive blocked turns end the round.
    blockedTurnsToEnd: 2,

    cardValues: {
        "3": 5, "4": 5, "5": 5, "6": 5, "7": 5,
        "8": 10, "9": 10, "10": 10,
        "J": 10, "Q": 10, "K": 10,
        "A": 20, "2": 20, "JOKER": 50
    }
};


/* =========================================================
   2. CONSTANTS AND HELPERS
========================================================= */

const SUITS = ["hearts", "diamonds", "clubs", "spades"];

const SUIT_SYMBOLS = {
    hearts: "♥",
    diamonds: "♦",
    clubs: "♣",
    spades: "♠"
};

const RANKS = [
    "3", "4", "5", "6", "7", "8",
    "9", "10", "J", "Q", "K", "A", "2"
];

const RANK_VALUES = {
    "3": 3, "4": 4, "5": 5, "6": 6,
    "7": 7, "8": 8, "9": 9, "10": 10,
    "J": 11, "Q": 12, "K": 13, "A": 14,
    "2": 15
};

const $ = id => document.getElementById(id);

const shuffle = array => {
    const result = [...array];

    for (let i = result.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [result[i], result[j]] = [result[j], result[i]];
    }

    return result;
};

const cardValue = card => CONFIG.cardValues[card.rank] || 0;

const isWild = card =>
    card.type === "joker" || CONFIG.wildRanks.includes(card.rank);

const playerName = index => `Player ${index + 1}`;

const otherPlayer = index => 1 - index;

const clone = value => structuredClone(value);

const setMessage = (message, type = "status") => {
    const status = $("status-message");
    const error = $("error-message");
    const success = $("success-message");

    error.hidden = true;
    success.hidden = true;

    if (type === "error") {
        error.textContent = message;
        error.hidden = false;
    } else if (type === "success") {
        success.textContent = message;
        success.hidden = false;
    } else {
        status.textContent = message;
    }
};

const clearMessages = () => {
    $("error-message").hidden = true;
    $("success-message").hidden = true;
};

const showOverlay = id => {
    $(id).hidden = false;
};

const hideOverlay = id => {
    $(id).hidden = true;
};

const announce = message => {
    $("status-message").textContent = message;
};


/* =========================================================
   3. CENTRALIZED GAME STATE
========================================================= */

const game = {
    players: [
        {
            name: "Player 1",
            hand: [],
            stash: [],
            stashTaken: false,
            melds: [],
            score: 0
        },
        {
            name: "Player 2",
            hand: [],
            stash: [],
            stashTaken: false,
            melds: [],
            score: 0
        }
    ],

    drawPile: [],
    discardPile: [],

    currentPlayer: 0,
    round: 1,

    phase: "idle",
    hasDrawn: false,

    selectedCards: [],
    selectedMeld: null,

    blockedTurns: 0,

    roundStatus: "not-started",
    gameStatus: "not-started",

    roundResults: null
};


/* =========================================================
   4. DECK CREATION AND SHUFFLING
========================================================= */

function createDeck() {
    const deck = [];
    let id = 0;

    for (let d = 0; d < CONFIG.numberOfDecks; d++) {

        for (const suit of SUITS) {
            for (const rank of RANKS) {

                deck.push({
                    id: `card-${id++}`,
                    deck: d,
                    rank,
                    suit,
                    type: "standard",
                    wild: CONFIG.wildRanks.includes(rank)
                });

            }
        }

        for (let j = 0; j < CONFIG.jokersPerDeck; j++) {
            deck.push({
                id: `card-${id++}`,
                deck: d,
                rank: "JOKER",
                suit: null,
                type: "joker",
                wild: true
            });
        }
    }

    return shuffle(deck);
}


/* =========================================================
   5. DEALING AND ROUND INITIALIZATION
========================================================= */

function initializeRound(preserveScores = true) {

    const scores = preserveScores
        ? game.players.map(player => player.score)
        : [0, 0];

    game.players = [
        {
            name: "Player 1",
            hand: [],
            stash: [],
            stashTaken: false,
            melds: [],
            score: scores[0]
        },
        {
            name: "Player 2",
            hand: [],
            stash: [],
            stashTaken: false,
            melds: [],
            score: scores[1]
        }
    ];

    game.drawPile = createDeck();
    game.discardPile = [];

    game.currentPlayer = 0;
    game.hasDrawn = false;
    game.selectedCards = [];
    game.selectedMeld = null;
    game.blockedTurns = 0;

    game.roundStatus = "playing";
    game.gameStatus = "playing";
    game.roundResults = null;

    // Deal 11 cards to each player.
    for (let i = 0; i < CONFIG.initialHandSize; i++) {
        game.players[0].hand.push(game.drawPile.pop());
        game.players[1].hand.push(game.drawPile.pop());
    }

    // Prepare separate hidden stashes.
    for (let i = 0; i < CONFIG.stashSize; i++) {
        game.players[0].stash.push(game.drawPile.pop());
        game.players[1].stash.push(game.drawPile.pop());
    }

    // Initial discard.
    game.discardPile.push(game.drawPile.pop());

    // Player 1 must explicitly reveal their hand.
    game.phase = "handoff";

    renderAll();
    hidePrivateInformation();
    showPassScreen();

    setMessage("A new round is ready.");
}


/* =========================================================
   6. CARD VALIDATION HELPERS
========================================================= */

function countWild(cards) {
    return cards.filter(isWild).length;
}

function countNatural(cards) {
    return cards.length - countWild(cards);
}

function validateWildRatio(cards) {
    const natural = countNatural(cards);
    const wild = countWild(cards);

    return wild === 0 || (
        natural >= 2 &&
        wild <= Math.floor(natural / CONFIG.wildRatio)
    );
}

function validateUniqueCards(cards) {
    return new Set(cards.map(card => card.id)).size === cards.length;
}

function canUseCards(player, cards) {
    return cards.length > 0 &&
        cards.every(card =>
            player.hand.some(handCard => handCard.id === card.id)
        ) &&
        validateUniqueCards(cards);
}


/* =========================================================
   7. MELD VALIDATION
========================================================= */

function validateSequence(cards) {

    if (cards.length < 3) {
        return {
            valid: false,
            reason: "A sequence needs at least three cards."
        };
    }

    const natural = cards.filter(card => !isWild(card));

    if (natural.length < 2) {
        return {
            valid: false,
            reason: "A sequence needs at least two natural cards."
        };
    }

    if (!validateWildRatio(cards)) {
        return {
            valid: false,
            reason: "Too many wild cards. Maximum one wild per two natural cards."
        };
    }

    const suit = natural[0].suit;

    if (natural.some(card => card.suit !== suit)) {
        return {
            valid: false,
            reason: "All natural cards in a sequence must have the same suit."
        };
    }

    const values = natural.map(card => RANK_VALUES[card.rank]).sort((a, b) => a - b);

    if (new Set(values).size !== values.length) {
        return {
            valid: false,
            reason: "A sequence cannot contain duplicate natural ranks."
        };
    }

    // Wild cards fill missing positions in the sequence.
    const gaps = values[values.length - 1] - values[0] + 1 - values.length;

    if (gaps > countWild(cards)) {
        return {
            valid: false,
            reason: "There are not enough wild cards to fill the sequence gaps."
        };
    }

    // No wild card may be used beyond the sequence's natural boundaries.
    const totalSpan = values[values.length - 1] - values[0] + 1;

    if (totalSpan !== cards.length && gaps < countWild(cards)) {
        return {
            valid: false,
            reason: "Wild cards must fill missing positions between natural cards."
        };
    }

    return { valid: true };
}


function validateSet(cards) {

    if (cards.length < 3) {
        return {
            valid: false,
            reason: "A set needs at least three cards."
        };
    }

    const natural = cards.filter(card => !isWild(card));

    if (natural.length < 2) {
        return {
            valid: false,
            reason: "A set needs at least two natural cards."
        };
    }

    if (!validateWildRatio(cards)) {
        return {
            valid: false,
            reason: "Too many wild cards. Maximum one wild per two natural cards."
        };
    }

    if (natural.some(card => card.rank !== natural[0].rank)) {
        return {
            valid: false,
            reason: "All natural cards in a set must have the same rank."
        };
    }

    if (natural.length > 4) {
        return {
            valid: false,
            reason: "A set cannot contain more than four natural cards."
        };
    }

    // Each physical deck has only one copy of a particular
    // rank and suit. Repeated suits across different decks are valid.
    const physicalCards = natural.map(card => `${card.deck}-${card.suit}-${card.rank}`);

    if (new Set(physicalCards).size !== physicalCards.length) {
        return {
            valid: false,
            reason: "Duplicate natural cards from the same deck are not allowed."
        };
    }

    return { valid: true };
}


function validateMeld(cards) {

    if (!validateUniqueCards(cards)) {
        return {
            valid: false,
            reason: "The same card cannot appear twice."
        };
    }

    const sequence = validateSequence(cards);
    const set = validateSet(cards);

    if (sequence.valid) return { ...sequence, type: "sequence" };
    if (set.valid) return { ...set, type: "set" };

    return {
        valid: false,
        reason: "These cards do not form a valid sequence or set."
    };
}


/* =========================================================
   8. MELD CREATION AND EXTENSION
========================================================= */

function createMeld(cards) {

    if (!requirePlayingTurn()) return;

    const player = game.players[game.currentPlayer];

    if (!game.hasDrawn) {
        setMessage("Draw before creating a meld.", "error");
        return;
    }

    if (!canUseCards(player, cards)) {
        setMessage("Selected cards are not available.", "error");
        return;
    }

    const validation = validateMeld(cards);

    if (!validation.valid) {
        setMessage(validation.reason, "error");
        return;
    }

    const meld = {
        id: `meld-${Date.now()}-${Math.random()}`,
        type: validation.type,
        cards: [...cards],
        completed: false,
        bonusAwarded: false,
        bonus: 0
    };

    // Commit only after validation.
    player.hand = player.hand.filter(
        card => !cards.some(selected => selected.id === card.id)
    );

    player.melds.push(meld);

    game.selectedCards = [];
    game.selectedMeld = null;

    updateBuraco(meld);
    checkAutomaticStash();

    setMessage("Meld created successfully.", "success");

    renderAll();
}


function extendMeld(cards, meldId) {

    if (!requirePlayingTurn()) return;

    const player = game.players[game.currentPlayer];
    const meld = player.melds.find(item => item.id === meldId);

    if (!meld) {
        setMessage("Meld not found.", "error");
        return;
    }

    if (!game.hasDrawn) {
        setMessage("Draw before extending a meld.", "error");
        return;
    }

    if (!canUseCards(player, cards)) {
        setMessage("Selected cards are not available.", "error");
        return;
    }

    const combined = [...meld.cards, ...cards];

    const validation = meld.type === "sequence"
        ? validateSequence(combined)
        : validateSet(combined);

    if (!validation.valid) {
        setMessage(validation.reason, "error");
        return;
    }

    // Commit after validation.
    meld.cards = combined;

    player.hand = player.hand.filter(
        card => !cards.some(selected => selected.id === card.id)
    );

    game.selectedCards = [];
    game.selectedMeld = null;

    updateBuraco(meld);
    checkAutomaticStash();

    setMessage("Meld extended successfully.", "success");

    renderAll();
}


function updateBuraco(meld) {

    if (
        meld.cards.length >= CONFIG.minimumBuracoSize &&
        !meld.bonusAwarded
    ) {
        meld.completed = true;
        meld.bonusAwarded = true;

        const dirty = meld.cards.some(isWild);

        meld.bonus = dirty
            ? CONFIG.dirtyBuracoBonus
            : CONFIG.cleanBuracoBonus;
    }
}


/* =========================================================
   9. TURN VALIDATION AND CARD SELECTION
========================================================= */

function requirePlayingTurn() {

    if (
        game.gameStatus !== "playing" ||
        game.roundStatus !== "playing" ||
        game.phase !== "playing"
    ) {
        setMessage("This action is not available now.", "error");
        return false;
    }

    return true;
}


function toggleCardSelection(cardId) {

    if (!requirePlayingTurn()) return;

    const player = game.players[game.currentPlayer];

    const card = player.hand.find(item => item.id === cardId);

    if (!card) return;

    const selected = game.selectedCards.some(
        item => item.id === cardId
    );

    if (selected) {
        game.selectedCards = game.selectedCards.filter(
            item => item.id !== cardId
        );
    } else {
        game.selectedCards.push(card);
    }

    renderHand();
    renderActions();
}


function clearSelection() {
    game.selectedCards = [];
    game.selectedMeld = null;

    renderHand();
    renderActions();
}


/* =========================================================
   10. DRAWING CARDS
========================================================= */

function drawFromPile() {

    if (!requirePlayingTurn()) return;

    if (game.hasDrawn) {
        setMessage("You have already drawn this turn.", "error");
        return;
    }

    if (game.drawPile.length === 0) {
        setMessage("The draw pile is empty.", "error");
        return;
    }

    const player = game.players[game.currentPlayer];

    player.hand.push(game.drawPile.pop());

    game.hasDrawn = true;
    game.blockedTurns = 0;

    setMessage("Card drawn. Select cards to play.", "success");

    renderAll();
}


/* =========================================================
   11. DISCARD-PILE OPERATIONS
========================================================= */

function canUseTopDiscard(player) {

    if (game.discardPile.length === 0) return false;

    const top = game.discardPile[game.discardPile.length - 1];

    // Check whether the top card can extend an existing meld.
    for (const meld of player.melds) {

        const validation = meld.type === "sequence"
            ? validateSequence([...meld.cards, top])
            : validateSet([...meld.cards, top]);

        if (validation.valid) return true;
    }

    // Check whether the top card can form a new meld with two
    // cards from the player's hand.
    for (let i = 0; i < player.hand.length; i++) {
        for (let j = i + 1; j < player.hand.length; j++) {

            const combination = [
                top,
                player.hand[i],
                player.hand[j]
            ];

            if (validateMeld(combination).valid) return true;
        }
    }

    return false;
}


function takeDiscardPile() {

    if (!requirePlayingTurn()) return;

    if (game.hasDrawn) {
        setMessage("You have already drawn this turn.", "error");
        return;
    }

    const player = game.players[game.currentPlayer];

    if (game.discardPile.length === 0) {
        setMessage("The discard pile is empty.", "error");
        return;
    }

    if (
        CONFIG.requireImmediateDiscardUse &&
        !canUseTopDiscard(player)
    ) {
        setMessage(
            "You must be able to use the top discard card immediately.",
            "error"
        );
        return;
    }

    // Entire discard pile moves into the hand.
    player.hand.push(...game.discardPile);

    game.discardPile = [];
    game.hasDrawn = true;
    game.blockedTurns = 0;

    setMessage("Discard pile collected.", "success");

    renderAll();
}


/* =========================================================
   12. STASH OPERATIONS
========================================================= */

function checkAutomaticStash() {

    if (!CONFIG.automaticStash) return;

    const player = game.players[game.currentPlayer];

    if (
        player.hand.length === 0 &&
        !player.stashTaken &&
        player.stash.length > 0
    ) {
        takeStash();
    }
}


function takeStash() {

    if (!requirePlayingTurn()) return;

    const player = game.players[game.currentPlayer];

    if (player.stashTaken) {
        setMessage("You have already taken your stash.", "error");
        return;
    }

    if (player.hand.length !== 0) {
        setMessage("Your hand must be empty before taking the stash.", "error");
        return;
    }

    if (player.stash.length === 0) {
        setMessage("No stash is available.", "error");
        return;
    }

    player.hand.push(...player.stash);

    player.stash = [];
    player.stashTaken = true;

    game.selectedCards = [];

    setMessage("Your stash has been added to your hand.", "success");

    renderAll();
}


/* =========================================================
   13. DISCARDING AND TURN COMPLETION
========================================================= */

function discardSelectedCard() {

    if (!requirePlayingTurn()) return;

    if (!game.hasDrawn) {
        setMessage("You must draw before discarding.", "error");
        return;
    }

    if (game.selectedCards.length !== 1) {
        setMessage("Select exactly one card to discard.", "error");
        return;
    }

    const player = game.players[game.currentPlayer];
    const card = game.selectedCards[0];

    if (!player.hand.some(item => item.id === card.id)) {
        setMessage("That card is no longer in your hand.", "error");
        return;
    }

    player.hand = player.hand.filter(
        item => item.id !== card.id
    );

    game.discardPile.push(card);
    game.selectedCards = [];

    // If the player empties their initial hand by discarding,
    // the stash is collected automatically.
    if (
        player.hand.length === 0 &&
        !player.stashTaken &&
        player.stash.length > 0
    ) {
        takeStashAfterDiscard(player);
    }

    if (checkRoundEnd()) return;

    finishTurn();
}


function takeStashAfterDiscard(player) {

    player.hand.push(...player.stash);
    player.stash = [];
    player.stashTaken = true;
}


function finishTurn() {

    game.currentPlayer = otherPlayer(game.currentPlayer);

    game.hasDrawn = false;
    game.selectedCards = [];
    game.selectedMeld = null;

    game.phase = "handoff";

    hidePrivateInformation();

    renderAll();
    showPassScreen();

    setMessage(
        `${playerName(game.currentPlayer)} should receive the device.`
    );
}


/* =========================================================
   14. BLOCKED TURNS AND EMPTY DRAW PILE
========================================================= */

function handleEmptyDrawPile() {

    if (game.drawPile.length > 0) return false;

    const player = game.players[game.currentPlayer];

    if (canUseTopDiscard(player)) {
        return false;
    }

    game.blockedTurns++;

    if (game.blockedTurns >= CONFIG.blockedTurnsToEnd) {
        endRound();
        return true;
    }

    // No legal draw or pickup: pass to the other player.
    setMessage("No legal draw is available. Turn passed.");

    finishTurn();

    return true;
}


/* =========================================================
   15. SCORING
========================================================= */

function calculatePlayerScore(player) {

    let meldPoints = 0;
    let bonusPoints = 0;
    let handPenalty = 0;
    let stashPenalty = 0;

    for (const meld of player.melds) {

        meldPoints += meld.cards.reduce(
            (sum, card) => sum + cardValue(card),
            0
        );

        // Bonus is stored once when the meld reaches seven cards.
        bonusPoints += meld.bonus || 0;
    }

    handPenalty = player.hand.reduce(
        (sum, card) => sum + cardValue(card),
        0
    );

    stashPenalty = player.stash.reduce(
        (sum, card) => sum + cardValue(card),
        0
    );

    return {
        meldPoints,
        bonusPoints,
        handPenalty,
        stashPenalty,
        total: meldPoints + bonusPoints - handPenalty - stashPenalty
    };
}


function calculateRoundResults() {

    const results = game.players.map(calculatePlayerScore);

    const winner = results[0].total === results[1].total
        ? null
        : results[0].total > results[1].total ? 0 : 1;

    return {
        players: results,
        winner
    };
}


/* =========================================================
   16. ROUND-END DETECTION
========================================================= */

function hasCompletedBuraco(player) {
    return player.melds.some(meld => meld.completed);
}


function checkRoundEnd() {

    const player = game.players[game.currentPlayer];

    const emptyHand = player.hand.length === 0;
    const emptyStash = player.stash.length === 0;

    const hasBuraco = hasCompletedBuraco(player);

    const canFinish =
        emptyHand &&
        emptyStash &&
        (!CONFIG.requireBuracoToEnd || hasBuraco);

    if (canFinish) {
        endRound();
        return true;
    }

    return false;
}


function endRound() {

    if (game.roundStatus !== "playing") return;

    game.roundStatus = "finished";
    game.phase = "round-end";

    game.selectedCards = [];
    game.selectedMeld = null;

    game.roundResults = calculateRoundResults();

    // Apply scores exactly once.
    game.players.forEach((player, index) => {
        player.score += game.roundResults.players[index].total;
    });

    const gameOver = game.players.some(
        player => player.score >= CONFIG.targetScore
    );

    game.gameStatus = gameOver ? "finished" : "playing";

    hidePrivateInformation();

    renderRoundResults();

    if (gameOver) {
        renderGameOver();
    } else {
        showOverlay("round-end-screen");
    }
}


/* =========================================================
   17. ROUND AND GAME MANAGEMENT
========================================================= */

function nextRound() {

    if (game.roundStatus !== "finished") return;

    game.round++;
    hideOverlay("round-end-screen");

    initializeRound(true);
}


function newGame() {

    if (
        game.roundStatus === "playing" &&
        game.gameStatus === "playing"
    ) {
        const confirmed = window.confirm(
            "Start a new game? Current scores will be lost."
        );

        if (!confirmed) return;
    }

    game.round = 1;

    hideOverlay("round-end-screen");
    hideOverlay("game-over-screen");
    hideOverlay("rules-screen");

    initializeRound(false);
}


/* =========================================================
   18. PASS-AND-PLAY PRIVACY
========================================================= */

function hidePrivateInformation() {

    // Remove all previously rendered private cards.
    $("player-hand").replaceChildren();

    $("selected-count").textContent = "0 selected";

    game.selectedCards = [];
    game.selectedMeld = null;
}


function showPassScreen() {

    $("pass-message").textContent =
        `Give the device to ${playerName(game.currentPlayer)}.`;

    showOverlay("pass-screen");
}


function revealNextHand() {

    if (game.phase !== "handoff") return;

    hideOverlay("pass-screen");

    game.phase = "playing";

    game.hasDrawn = false;
    game.selectedCards = [];

    renderAll();

    setMessage(
        `${playerName(game.currentPlayer)}: draw a card to begin your turn.`
    );

    $("draw-button").focus();
}


/* =========================================================
   19. RENDERING: PLAYING CARDS
========================================================= */

function createCardElement(card, selectable = false) {

    const element = document.createElement(
        selectable ? "button" : "div"
    );

    element.className = "card";

    if (card.suit) {
        element.classList.add(card.suit);
    }

    if (isWild(card)) {
        element.classList.add("wild");
    }

    if (card.type === "joker") {
        element.classList.add("joker");
    }

    element.dataset.cardId = card.id;

    if (selectable) {

        element.type = "button";

        element.setAttribute(
            "aria-label",
            card.type === "joker"
                ? "Printed joker"
                : `${card.rank} of ${card.suit}`
        );

        const selected = game.selectedCards.some(
            item => item.id === card.id
        );

        if (selected) {
            element.classList.add("selected");
            element.setAttribute("aria-pressed", "true");
        } else {
            element.setAttribute("aria-pressed", "false");
        }

        element.addEventListener("click", () => {
            toggleCardSelection(card.id);
        });

        element.addEventListener("keydown", event => {
            if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                toggleCardSelection(card.id);
            }
        });
    }

    if (card.type === "joker") {

        element.innerHTML = `
            <span class="card-rank">JOKER</span>
            <span class="card-center">★</span>
            <span class="card-suit">★</span>
        `;

    } else {

        element.innerHTML = `
            <span class="card-rank">${card.rank}</span>
            <span class="card-center">${SUIT_SYMBOLS[card.suit]}</span>
            <span class="card-suit">${SUIT_SYMBOLS[card.suit]}</span>
        `;
    }

    return element;
}


/* =========================================================
   20. RENDERING: PLAYER HAND
========================================================= */

function renderHand() {

    const container = $("player-hand");
    container.replaceChildren();

    if (
        game.phase !== "playing" ||
        game.gameStatus !== "playing"
    ) {
        return;
    }

    const player = game.players[game.currentPlayer];

    player.hand.forEach(card => {
        container.appendChild(createCardElement(card, true));
    });

    $("active-player-hand-count").textContent =
        `${player.hand.length} cards`;

    $("selected-count").textContent =
        `${game.selectedCards.length} selected`;
}


/* =========================================================
   21. RENDERING: MELDS
========================================================= */

function renderMelds(player, containerId) {

    const container = $(containerId);
    container.replaceChildren();

    player.melds.forEach(meld => {

        const wrapper = document.createElement("div");

        wrapper.className = "meld";
        wrapper.classList.add(meld.type);

        if (meld.completed) {
            wrapper.classList.add("completed", "buraco");
        }

        if (meld.completed) {
            wrapper.classList.add(
                meld.cards.some(isWild) ? "dirty" : "clean"
            );
        }

        wrapper.dataset.meldId = meld.id;
        wrapper.tabIndex = 0;
        wrapper.setAttribute("role", "button");

        wrapper.setAttribute(
            "aria-label",
            `${meld.type}, ${meld.cards.length} cards. Select to extend.`
        );

        meld.cards.forEach(card => {
            wrapper.appendChild(createCardElement(card));
        });

        wrapper.addEventListener("click", () => {

            if (!requirePlayingTurn()) return;

            game.selectedMeld = meld.id;

            if (game.selectedCards.length > 0) {
                extendMeld(game.selectedCards, meld.id);
            } else {
                setMessage(
                    "Meld selected. Choose cards from your hand to extend it."
                );

                renderMelds(
                    game.players[game.currentPlayer],
                    "active-meld-list"
                );
            }
        });

        wrapper.addEventListener("keydown", event => {
            if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                wrapper.click();
            }
        });

        if (game.selectedMeld === meld.id) {
            wrapper.style.outline = "2px solid #dfc47e";
        }

        container.appendChild(wrapper);
    });
}


/* =========================================================
   22. RENDERING: PILES
========================================================= */

function renderPiles() {

    $("draw-pile-count").textContent =
        `${game.drawPile.length} cards`;

    $("discard-pile-count").textContent =
        `${game.discardPile.length} cards`;

    const top = game.discardPile.at(-1);
    const container = $("discard-top-card");

    container.replaceChildren();

    if (top) {
        container.appendChild(createCardElement(top));
    } else {
        container.textContent = "Empty";
    }

    $("opponent-hand-count").textContent =
        `${game.players[otherPlayer(game.currentPlayer)].hand.length}`;

}


/* =========================================================
   23. RENDERING: SCORES AND GAME INFORMATION
========================================================= */

function renderScores() {

    $("player1-total").textContent = game.players[0].score;
    $("player2-total").textContent = game.players[1].score;

    $("player1-score").setAttribute(
        "aria-label",
        `Player 1 score: ${game.players[0].score}`
    );

    $("player2-score").setAttribute(
        "aria-label",
        `Player 2 score: ${game.players[1].score}`
    );
}


function renderGameInformation() {

    const player = game.players[game.currentPlayer];

    $("round-indicator").textContent = `Round ${game.round}`;
    $("current-round").textContent = game.round;

    $("current-player").textContent =
        playerName(game.currentPlayer);

    $("active-player-name").textContent = player.name;

    $("opponent-name").textContent =
        playerName(otherPlayer(game.currentPlayer));

    $("draw-status").textContent =
        game.hasDrawn ? "Drawn" : "Not drawn";

    $("stash-status").textContent =
        player.stashTaken ? "Taken" : "Available";

    $("opponent-stash-status").textContent =
        game.players[otherPlayer(game.currentPlayer)].stashTaken
            ? "Taken"
            : "Available";

    $("stash-description").textContent =
        player.stashTaken
            ? "Your stash has been collected."
            : "An 11-card stash is available.";
}


/* =========================================================
   24. RENDERING: ACTION AVAILABILITY
========================================================= */

function renderActions() {

    const playing = game.phase === "playing" &&
        game.gameStatus === "playing";

    const player = game.players[game.currentPlayer];

    const selected = game.selectedCards.length;

    $("draw-button").disabled =
        !playing || game.hasDrawn || game.drawPile.length === 0;

    $("draw-pile-button").disabled =
        !playing || game.hasDrawn || game.drawPile.length === 0;

    $("take-discard-button").disabled =
        !playing ||
        game.hasDrawn ||
        !canUseTopDiscard(player);

    $("create-meld-button").disabled =
        !playing || !game.hasDrawn || selected < 3;

    $("extend-meld-button").disabled =
        !playing ||
        !game.hasDrawn ||
        selected < 1 ||
        !game.selectedMeld;

    $("discard-button").disabled =
        !playing || !game.hasDrawn || selected !== 1;

    $("clear-selection-button").disabled =
        !playing || selected === 0;

    $("take-stash-button").disabled =
        !playing ||
        player.stashTaken ||
        player.hand.length !== 0 ||
        player.stash.length === 0;

    $("take-stash-button").textContent =
        player.stashTaken ? "Stash Taken" : "Take Stash";
}


/* =========================================================
   25. CENTRAL RENDERING SYSTEM
========================================================= */

function renderAll() {

    renderScores();
    renderGameInformation();
    renderPiles();

    const player = game.players[game.currentPlayer];
    const opponent = game.players[otherPlayer(game.currentPlayer)];

    renderMelds(player, "active-meld-list");
    renderMelds(opponent, "opponent-meld-list");

    if (game.phase === "playing") {
        renderHand();
    } else {
        hidePrivateInformation();
    }

    renderActions();
}


/* =========================================================
   26. ROUND-END RENDERING
========================================================= */

function renderRoundResults() {

    const results = game.roundResults;

    if (!results) return;

    const winner = results.winner;

    $("round-winner").textContent =
        winner === null
            ? "The round is tied."
            : `${playerName(winner)} wins the round!`;

    $("player1-round-points").textContent =
        results.players[0].total;

    $("player2-round-points").textContent =
        results.players[1].total;

    $("player1-updated-score").textContent =
        game.players[0].score;

    $("player2-updated-score").textContent =
        game.players[1].score;

    const breakdown = $("scoring-breakdown");
    breakdown.replaceChildren();

    results.players.forEach((result, index) => {

        const heading = document.createElement("h3");
        heading.textContent = playerName(index);
        breakdown.appendChild(heading);

        const rows = [
            ["Melded cards", result.meldPoints],
            ["Buraco bonuses", result.bonusPoints],
            ["Hand penalties", -result.handPenalty],
            ["Stash penalties", -result.stashPenalty],
            ["Round total", result.total]
        ];

        rows.forEach(([label, value]) => {

            const row = document.createElement("p");

            const name = document.createElement("span");
            name.textContent = label;

            const points = document.createElement("strong");
            points.textContent = value > 0 ? `+${value}` : value;

            row.append(name, points);
            breakdown.appendChild(row);
        });
    });
}


/* =========================================================
   27. GAME-OVER RENDERING
========================================================= */

function renderGameOver() {

    const scores = game.players.map(player => player.score);

    const winner = scores[0] === scores[1]
        ? null
        : scores[0] > scores[1] ? 0 : 1;

    $("game-winner").textContent =
        winner === null
            ? "The game is tied!"
            : `${playerName(winner)} wins the game!`;

    $("player1-final-score").textContent = scores[0];
    $("player2-final-score").textContent = scores[1];

    hideOverlay("round-end-screen");
    showOverlay("game-over-screen");
}


/* =========================================================
   28. HOW TO PLAY
========================================================= */

function openRules() {
    showOverlay("rules-screen");
    $("close-rules-button").focus();
}


function closeRules() {
    hideOverlay("rules-screen");
    $("rules-button").focus();
}


function renderRules() {

    const values = $("card-values-table");

    values.innerHTML = `
        <p>3–7: 5 points</p>
        <p>8–K: 10 points</p>
        <p>Aces: 20 points</p>
        <p>Twos: 20 points</p>
        <p>Printed jokers: 50 points</p>
    `;

    const settings = $("game-rules-settings");

    settings.innerHTML = `
        <p>Target score: ${CONFIG.targetScore}</p>
        <p>Initial hand: ${CONFIG.initialHandSize} cards</p>
        <p>Stash: ${CONFIG.stashSize} cards</p>
        <p>Decks: ${CONFIG.numberOfDecks}</p>
        <p>Printed jokers per deck: ${CONFIG.jokersPerDeck}</p>
        <p>Minimum Buraco: ${CONFIG.minimumBuracoSize} cards</p>
        <p>Clean Buraco bonus: ${CONFIG.cleanBuracoBonus}</p>
        <p>Dirty Buraco bonus: ${CONFIG.dirtyBuracoBonus}</p>
        <p>Going-out bonus: ${CONFIG.goingOutBonus}</p>
        <p>Discard pickup requires immediate use of its top card.</p>
        <p>Aces are high only in sequences.</p>
        <p>Twos and printed jokers are wild cards.</p>
        <p>Wild cards are limited to one per two natural cards.</p>
        <p>A player must complete a Buraco and empty their hand and stash to go out.</p>
    `;
}


/* =========================================================
   29. EVENT LISTENERS
========================================================= */

// Draw actions.
$("draw-button").addEventListener("click", drawFromPile);
$("draw-pile-button").addEventListener("click", drawFromPile);

// Discard pile.
$("take-discard-button").addEventListener("click", takeDiscardPile);

// Meld actions.
$("create-meld-button").addEventListener("click", () => {
    createMeld([...game.selectedCards]);
});

$("extend-meld-button").addEventListener("click", () => {

    if (!game.selectedMeld) {
        setMessage("Select a meld first.", "error");
        return;
    }

    extendMeld(
        [...game.selectedCards],
        game.selectedMeld
    );
});

// Discard.
$("discard-button").addEventListener("click", discardSelectedCard);

// Selection.
$("clear-selection-button").addEventListener("click", clearSelection);

// Stash.
$("take-stash-button").addEventListener("click", takeStash);

// Pass-and-play.
$("reveal-hand-button").addEventListener("click", revealNextHand);

// Rules.
$("rules-button").addEventListener("click", openRules);
$("close-rules-button").addEventListener("click", closeRules);
$("close-rules-footer-button").addEventListener("click", closeRules);

// Round management.
$("next-round-button").addEventListener("click", nextRound);

// New game.
$("new-game-button").addEventListener("click", newGame);
$("restart-game-button").addEventListener("click", newGame);


/* =========================================================
   30. INITIALIZATION
========================================================= */

function initializeGame() {

    renderRules();

    // The initial game begins with a new-game prompt.
    game.phase = "idle";
    game.gameStatus = "not-started";
    game.roundStatus = "not-started";

    setMessage("Press New Game to begin.");

    renderScores();
    renderActions();
    renderPiles();

    $("current-player").textContent = "Not started";
    $("active-player-name").textContent = "Player 1";

    hidePrivateInformation();

    hideOverlay("pass-screen");
    hideOverlay("round-end-screen");
    hideOverlay("game-over-screen");
    hideOverlay("rules-screen");
}

// Start the application.
initializeGame();