require("dotenv").config();

const express = require("express");
const cors = require("cors");
const path = require("path");

/*
===========================================================
FOOTBALL AI ANALYST
Backend Server
Provider: Bzzoiro Sports Data
Platform: Render
Runtime: Node.js
===========================================================
*/


/*
===========================================================
1. EXPRESS CONFIGURATION
===========================================================
*/

const app = express();

app.use(cors());

app.use(express.json());

app.use(express.urlencoded({
    extended: true
}));

app.use(
    express.static(
        path.join(__dirname, "public")
    )
);


/*
===========================================================
2. ENVIRONMENT CONFIGURATION
===========================================================
*/

const PORT =
    Number(process.env.PORT) ||
    10000;

const BZZOIRO_API_KEY =
    process.env.BZZOIRO_API_KEY;

const BZZOIRO_BASE_URL =
    "https://sports.bzzoiro.com/api/v2";

const BZZOIRO_IMAGE_URL =
    "https://sports.bzzoiro.com/img";


/*
===========================================================
3. APPLICATION CACHE
===========================================================
*/

const cache = new Map();

const CACHE_DURATION =
    10 * 60 * 1000;


/*
===========================================================
4. BASIC UTILITY FUNCTIONS
===========================================================
*/

function isObject(value) {

    return (
        value !== null &&
        typeof value === "object"
    );
}


function toNumber(value) {

    if (
        value === null ||
        value === undefined ||
        value === ""
    ) {
        return null;
    }

    const number =
        Number(value);

    if (
        Number.isFinite(number)
    ) {
        return number;
    }

    return null;
}


function round(
    value,
    decimals = 2
) {

    const number =
        toNumber(value);

    if (number === null) {
        return null;
    }

    return Number(
        number.toFixed(decimals)
    );
}


function clamp(
    value,
    minimum,
    maximum
) {

    return Math.max(
        minimum,
        Math.min(
            maximum,
            value
        )
    );
}


function percentage(
    value,
    decimals = 1
) {

    const number =
        toNumber(value);

    if (number === null) {
        return "0%";
    }

    return (
        number * 100
    ).toFixed(decimals) + "%";
}


function normalizeProbability(
    value
) {

    const number =
        toNumber(value);

    if (number === null) {
        return null;
    }

    if (
        number >= 0 &&
        number <= 1
    ) {
        return number;
    }

    if (
        number > 1 &&
        number <= 100
    ) {
        return number / 100;
    }

    return null;
}


/*
===========================================================
5. NIGERIA DATE FUNCTIONS
===========================================================
*/

function getNigeriaDate() {

    return new Intl.DateTimeFormat(
        "en-CA",
        {
            timeZone: "Africa/Lagos",
            year: "numeric",
            month: "2-digit",
            day: "2-digit"
        }
    ).format(
        new Date()
    );
}


function getNigeriaDateTime(
    value
) {

    if (!value) {
        return null;
    }

    const date =
        new Date(value);

    if (
        Number.isNaN(
            date.getTime()
        )
    ) {
        return null;
    }

    return new Intl.DateTimeFormat(
        "en-NG",
        {
            timeZone: "Africa/Lagos",
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
            hour12: false
        }
    ).format(date);
}


function getNigeriaDateOnly(
    value
) {

    if (!value) {
        return null;
    }

    const date =
        new Date(value);

    if (
        Number.isNaN(
            date.getTime()
        )
    ) {
        return null;
    }

    return new Intl.DateTimeFormat(
        "en-CA",
        {
            timeZone: "Africa/Lagos",
            year: "numeric",
            month: "2-digit",
            day: "2-digit"
        }
    ).format(date);
}


/*
===========================================================
6. BZZOIRO API CLIENT
===========================================================
*/

async function bzzoiroRequest(
    endpoint
) {

    if (
        !BZZOIRO_API_KEY
    ) {

        throw new Error(
            "BZZOIRO_API_KEY is missing."
        );
    }


    const cached =
        cache.get(endpoint);


    if (
        cached &&
        Date.now() -
        cached.timestamp <
        CACHE_DURATION
    ) {

        return cached.data;
    }


    const response =
        await fetch(
            BZZOIRO_BASE_URL +
            endpoint,
            {
                method: "GET",

                headers: {
                    "Authorization":
                        `Token ${BZZOIRO_API_KEY}`,

                    "Accept":
                        "application/json"
                }
            }
        );


    let data;


    try {

        data =
            await response.json();

    } catch {

        throw new Error(
            `Bzzoiro returned an invalid response. HTTP ${response.status}`
        );
    }


    if (
        !response.ok
    ) {

        throw new Error(
            `Bzzoiro API error ${response.status}: ${JSON.stringify(data)}`
        );
    }


    cache.set(
        endpoint,
        {
            timestamp:
                Date.now(),

            data:
                data
        }
    );


    return data;
}


/*
===========================================================
7. SAFE BZZOIRO REQUEST
===========================================================
*/

async function safeRequest(
    endpoint
) {

    try {

        return await bzzoiroRequest(
            endpoint
        );

    } catch (error) {

        console.error(
            "Bzzoiro request failed:",
            endpoint,
            error.message
        );

        return null;
    }
}


/*
===========================================================
8. DATA EXTRACTION HELPERS
===========================================================
*/

function getId(
    value
) {

    if (
        isObject(value)
    ) {

        return (
            value.id ??
            value.pk ??
            null
        );
    }


    const number =
        toNumber(value);


    return number;
}


function getName(
    value,
    fallback = null
) {

    if (
        typeof value ===
        "string"
    ) {

        return value;
    }


    if (
        isObject(value)
    ) {

        return (
            value.name ||
            value.title ||
            value.display_name ||
            fallback
        );
    }


    return fallback;
}


function getFirstObject(
    value
) {

    if (
        Array.isArray(value)
    ) {

        return value.length
            ? value[0]
            : null;
    }


    return isObject(value)
        ? value
        : null;
}


/*
===========================================================
9. RECURSIVE NUMBER SEARCH
===========================================================
*/

function findNumber(
    data,
    keys,
    depth = 0
) {

    if (
        !isObject(data) ||
        depth > 8
    ) {

        return null;
    }


    const normalizedKeys =
        keys.map(
            key =>
                String(key)
                    .toLowerCase()
        );


    for (
        const key of Object.keys(data)
    ) {

        const lowerKey =
            key.toLowerCase();


        if (
            normalizedKeys.includes(
                lowerKey
            )
        ) {

            const number =
                toNumber(
                    data[key]
                );


            if (
                number !== null
            ) {

                return number;
            }
        }
    }


    for (
        const value of Object.values(data)
    ) {

        if (
            isObject(value)
        ) {

            const result =
                findNumber(
                    value,
                    keys,
                    depth + 1
                );


            if (
                result !== null
            ) {

                return result;
            }
        }
    }


    return null;
}


/*
===========================================================
10. RECURSIVE PROBABILITY SEARCH
===========================================================
*/

function findProbability(
    data,
    keys,
    depth = 0
) {

    const number =
        findNumber(
            data,
            keys,
            depth
        );


    if (
        number === null
    ) {

        return null;
    }


    return normalizeProbability(
        number
    );
}


/*
===========================================================
11. FIND STRING VALUE
===========================================================
*/

function findString(
    data,
    keys,
    depth = 0
) {

    if (
        !isObject(data) ||
        depth > 8
    ) {

        return null;
    }


    const normalizedKeys =
        keys.map(
            key =>
                String(key)
                    .toLowerCase()
        );


    for (
        const [key, value]
        of Object.entries(data)
    ) {

        if (
            normalizedKeys.includes(
                key.toLowerCase()
            )
        ) {

            if (
                typeof value ===
                "string"
            ) {

                return value;
            }
        }
    }


    for (
        const value
        of Object.values(data)
    ) {

        if (
            isObject(value)
        ) {

            const result =
                findString(
                    value,
                    keys,
                    depth + 1
                );


            if (
                result !== null
            ) {

                return result;
            }
        }
    }


    return null;
}


/*
===========================================================
12. API RESOURCE FUNCTIONS
===========================================================
*/

async function getEvent(
    eventId
) {

    if (!eventId) {
        return null;
    }

    return safeRequest(
        `/events/${eventId}/`
    );
}


async function getTeam(
    teamId
) {

    if (!teamId) {
        return null;
    }

    return safeRequest(
        `/teams/${teamId}/`
    );
}


async function getLeague(
    leagueId
) {

    if (!leagueId) {
        return null;
    }

    return safeRequest(
        `/leagues/${leagueId}/`
    );
}


async function getStats(
    eventId
) {

    return safeRequest(
        `/events/${eventId}/stats/`
    );
}


async function getH2H(
    eventId
) {

    return safeRequest(
        `/events/${eventId}/h2h/`
    );
}


async function getOdds(
    eventId
) {

    return safeRequest(
        `/events/${eventId}/odds/`
    );
}


async function getPrediction(
    eventId
) {

    return safeRequest(
        `/events/${eventId}/prediction/`
    );
}


async function getLineups(
    eventId
) {

    return safeRequest(
        `/events/${eventId}/lineups/`
    );
}


async function getIncidents(
    eventId
) {

    return safeRequest(
        `/events/${eventId}/incidents/`
    );
}


/*
===========================================================
13. ODDS EXTRACTION
===========================================================
*/

function findOddsValue(
    data,
    keys,
    depth = 0
) {

    if (
        !isObject(data) ||
        depth > 8
    ) {

        return null;
    }


    for (
        const [key, value]
        of Object.entries(data)
    ) {

        const lowerKey =
            key.toLowerCase();


        if (
            keys.includes(
                lowerKey
            )
        ) {

            const number =
                toNumber(value);


            if (
                number !== null &&
                number > 1
            ) {

                return number;
            }
        }
    }


    for (
        const value
        of Object.values(data)
    ) {

        if (
            isObject(value)
        ) {

            const result =
                findOddsValue(
                    value,
                    keys,
                    depth + 1
                );


            if (
                result !== null
            ) {

                return result;
            }
        }
    }


    return null;
}


function extractOdds(
    odds
) {

    if (!odds) {

        return {

            homeWin: null,

            draw: null,

            awayWin: null,

            over25: null,

            under25: null,

            bttsYes: null,

            bttsNo: null
        };
    }


    return {

        homeWin:
            findOddsValue(
                odds,
                [
                    "home",
                    "home_win",
                    "home_odds",
                    "1"
                ]
            ),

        draw:
            findOddsValue(
                odds,
                [
                    "draw",
                    "draw_odds",
                    "x"
                ]
            ),

        awayWin:
            findOddsValue(
                odds,
                [
                    "away",
                    "away_win",
                    "away_odds",
                    "2"
                ]
            ),

        over25:
            findOddsValue(
                odds,
                [
                    "over_2_5",
                    "over25",
                    "over_2.5"
                ]
            ),

        under25:
            findOddsValue(
                odds,
                [
                    "under_2_5",
                    "under25",
                    "under_2.5"
                ]
            ),

        bttsYes:
            findOddsValue(
                odds,
                [
                    "btts_yes",
                    "both_teams_to_score_yes"
                ]
            ),

        bttsNo:
            findOddsValue(
                odds,
                [
                    "btts_no",
                    "both_teams_to_score_no"
                ]
            )
    };
}


/*
===========================================================
14. MARKET PROBABILITY FROM ODDS
===========================================================
*/

function probabilityFromOdds(
    odds
) {

    if (
        !odds ||
        odds <= 1
    ) {

        return null;
    }


    return 1 / odds;
}


function normalizeMarkets(
    home,
    draw,
    away
) {

    if (
        !home ||
        !draw ||
        !away
    ) {

        return null;
    }


    const h =
        probabilityFromOdds(
            home
        );

    const d =
        probabilityFromOdds(
            draw
        );

    const a =
        probabilityFromOdds(
            away
        );


    if (
        h === null ||
        d === null ||
        a === null
    ) {

        return null;
    }


    const total =
        h + d + a;


    return {

        home:
            h / total,

        draw:
            d / total,

        away:
            a / total
    };
}


/*
===========================================================
15. POISSON DISTRIBUTION
===========================================================
*/

function factorial(
    number
) {

    if (
        number <= 1
    ) {

        return 1;
    }


    let result = 1;


    for (
        let i = 2;
        i <= number;
        i++
    ) {

        result *= i;
    }


    return result;
}


function poissonProbability(
    lambda,
    goals
) {

    if (
        lambda <= 0
    ) {

        return goals === 0
            ? 1
            : 0;
    }


    return (
        Math.exp(-lambda) *
        Math.pow(lambda, goals)
    ) /
    factorial(goals);
}


/*
===========================================================
16. SCORE MATRIX
===========================================================
*/

function generateScoreMatrix(
    homeXG,
    awayXG,
    maximumGoals = 8
) {

    const scores = [];


    for (
        let home = 0;
        home <= maximumGoals;
        home++
    ) {

        for (
            let away = 0;
            away <= maximumGoals;
            away++
        ) {

            const probability =
                poissonProbability(
                    homeXG,
                    home
                ) *
                poissonProbability(
                    awayXG,
                    away
                );


            scores.push({

                home,

                away,

                probability
            });
        }
    }


    return scores;
}


/*
===========================================================
17. NORMALIZE SCORE MATRIX
===========================================================
*/

function normalizeScores(
    scores
) {

    const total =
        scores.reduce(
            (
                sum,
                item
            ) =>
                sum +
                item.probability,
            0
        );


    if (
        total <= 0
    ) {

        return scores;
    }


    return scores.map(
        item => ({

            ...item,

            probability:
                item.probability /
                total
        })
    );
}


/*
===========================================================
18. RESULT PROBABILITIES
===========================================================
*/

function calculateResultProbabilities(
    scores
) {

    let home = 0;

    let draw = 0;

    let away = 0;


    for (
        const score of scores
    ) {

        if (
            score.home >
            score.away
        ) {

            home +=
                score.probability;

        } else if (
            score.home ===
            score.away
        ) {

            draw +=
                score.probability;

        } else {

            away +=
                score.probability;
        }
    }


    return {

        home,

        draw,

        away
    };
}


/*
===========================================================
19. TOTAL GOALS PROBABILITIES
===========================================================
*/

function calculateGoalsProbability(
    scores,
    minimumGoals
) {

    return scores
        .filter(
            score =>
                score.home +
                score.away >=
                minimumGoals
        )
        .reduce(
            (
                sum,
                score
            ) =>
                sum +
                score.probability,
            0
        );
}


/*
===========================================================
20. BTTS PROBABILITY
===========================================================
*/

function calculateBTTS(
    scores
) {

    return scores
        .filter(
            score =>
                score.home > 0 &&
                score.away > 0
        )
        .reduce(
            (
                sum,
                score
            ) =>
                sum +
                score.probability,
            0
        );
}


/*
===========================================================
21. CORRECT SCORE RANKING
===========================================================
*/

function getTopCorrectScores(
    scores,
    limit = 10
) {

    return scores
        .slice()
        .sort(
            (
                a,
                b
            ) =>
                b.probability -
                a.probability
        )
        .slice(
            0,
            limit
        )
        .map(
            score => ({

                score:
                    `${score.home}-${score.away}`,

                homeGoals:
                    score.home,
awayGoals:
                    score.away,

                probability:
                    percentage(
                        score.probability
                    ),

                decimalProbability:
                    round(
                        score.probability,
                        4
                    )
            })
        );
}


/*
===========================================================
22. MOST LIKELY WINNER
===========================================================
*/

function getWinner(
    probabilities,
    homeName,
    awayName
) {

    if (
        probabilities.home >=
        probabilities.draw &&
        probabilities.home >=
        probabilities.away
    ) {

        return homeName;
    }


    if (
        probabilities.away >=
        probabilities.draw &&
        probabilities.away >=
        probabilities.home
    ) {

        return awayName;
    }


    return "Draw";
}


/*
===========================================================
23. MODEL CONFIDENCE
===========================================================
*/

function calculateConfidence(
    probabilities
) {

    const highest =
        Math.max(
            probabilities.home,
            probabilities.draw,
            probabilities.away
        );


    let level =
        "Low";


    if (
        highest >= 0.60
    ) {

        level =
            "High";

    } else if (
        highest >= 0.45
    ) {

        level =
            "Medium";
    }


    return {

        percentage:
            percentage(
                highest
            ),

        level,

        value:
            round(
                highest,
                4
            )
    };
}


/*
===========================================================
24. EXPECTED GOALS ESTIMATION
===========================================================
*/

function estimateExpectedGoals(
    prediction,
    stats,
    odds
) {

    let homeXG =
        findNumber(
            stats,
            [
                "home_xg",
                "home_expected_goals",
                "expected_goals_home",
                "xg_home",
                "home_xg_value"
            ]
        );


    let awayXG =
        findNumber(
            stats,
            [
                "away_xg",
                "away_expected_goals",
                "expected_goals_away",
                "xg_away",
                "away_xg_value"
            ]
        );


    /*
    -------------------------------------------------------
    Use Bzzoiro prediction xG when available
    -------------------------------------------------------
    */

    if (
        homeXG === null
    ) {

        homeXG =
            findNumber(
                prediction,
                [
                    "home_xg",
                    "home_expected_goals",
                    "expected_goals_home",
                    "xg_home"
                ]
            );
    }


    if (
        awayXG === null
    ) {

        awayXG =
            findNumber(
                prediction,
                [
                    "away_xg",
                    "away_expected_goals",
                    "expected_goals_away",
                    "xg_away"
                ]
            );
    }


    /*
    -------------------------------------------------------
    Market probabilities
    -------------------------------------------------------
    */

    const markets =
        normalizeMarkets(
            odds.homeWin,
            odds.draw,
            odds.awayWin
        );


    /*
    -------------------------------------------------------
    Estimate from market if needed
    -------------------------------------------------------
    */

    if (
        homeXG === null ||
        awayXG === null
    ) {

        if (
            markets
        ) {

            homeXG =
                1.15 +
                (
                    markets.home -
                    markets.away
                ) * 2.2;


            awayXG =
                1.05 +
                (
                    markets.away -
                    markets.home
                ) * 1.8;

        } else {

            homeXG =
                1.35;

            awayXG =
                1.10;
        }
    }


    /*
    -------------------------------------------------------
    Ensure sensible values
    -------------------------------------------------------
    */

    homeXG =
        clamp(
            homeXG,
            0.20,
            4.50
        );


    awayXG =
        clamp(
            awayXG,
            0.15,
            4.00
        );


    return {

        home:
            round(
                homeXG,
                2
            ),

        away:
            round(
                awayXG,
                2
            )
    };
}


/*
===========================================================
25. FULL PREDICTION ENGINE
===========================================================
*/

function buildPredictionModel(
    match,
    predictionData,
    statsData,
    oddsData
) {

    const homeName =
        match.home ||
        "Home Team";


    const awayName =
        match.away ||
        "Away Team";


    /*
    -------------------------------------------------------
    Extract Bzzoiro probabilities
    -------------------------------------------------------
    */

    let homeProbability =
        findProbability(
            predictionData,
            [
                "home_win_probability",
                "home_win_prob",
                "home_probability",
                "probability_home",
                "home"
            ]
        );


    let drawProbability =
        findProbability(
            predictionData,
            [
                "draw_probability",
                "draw_prob",
                "probability_draw",
                "draw"
            ]
        );


    let awayProbability =
        findProbability(
            predictionData,
            [
                "away_win_probability",
                "away_win_prob",
                "away_probability",
                "probability_away",
                "away"
            ]
        );


    /*
    -------------------------------------------------------
    Extract odds
    -------------------------------------------------------
    */

    const odds =
        extractOdds(
            oddsData
        );


    /*
    -------------------------------------------------------
    Odds fallback
    -------------------------------------------------------
    */

    const market =
        normalizeMarkets(
            odds.homeWin,
            odds.draw,
            odds.awayWin
        );


    if (
        (
            homeProbability ===
            null
        ) ||
        (
            drawProbability ===
            null
        ) ||
        (
            awayProbability ===
            null
        )
    ) {

        if (
            market
        ) {

            homeProbability =
                market.home;

            drawProbability =
                market.draw;

            awayProbability =
                market.away;
        }
    }


    /*
    -------------------------------------------------------
    Final fallback
    -------------------------------------------------------
    */

    if (
        homeProbability ===
        null
    ) {

        homeProbability =
            0.45;
    }


    if (
        drawProbability ===
        null
    ) {

        drawProbability =
            0.28;
    }


    if (
        awayProbability ===
        null
    ) {

        awayProbability =
            0.27;
    }


    /*
    -------------------------------------------------------
    Normalize probabilities
    -------------------------------------------------------
    */

    const probabilityTotal =
        homeProbability +
        drawProbability +
        awayProbability;


    homeProbability /=
        probabilityTotal;


    drawProbability /=
        probabilityTotal;


    awayProbability /=
        probabilityTotal;


    /*
    -------------------------------------------------------
    Expected goals
    -------------------------------------------------------
    */

    const xG =
        estimateExpectedGoals(
            predictionData,
            statsData,
            odds
        );


    /*
    -------------------------------------------------------
    Generate score matrix
    -------------------------------------------------------
    */

    let scores =
        generateScoreMatrix(
            xG.home,
            xG.away,
            8
        );


    scores =
        normalizeScores(
            scores
        );


    /*
    -------------------------------------------------------
    Result probabilities
    -------------------------------------------------------
    */

    const poissonResults =
        calculateResultProbabilities(
            scores
        );


    /*
    -------------------------------------------------------
    Blend API probabilities
    with Poisson probabilities
    -------------------------------------------------------
    */

    const blendedHome =
        (
            homeProbability * 0.60
        ) +
        (
            poissonResults.home *
            0.40
        );


    const blendedDraw =
        (
            drawProbability * 0.60
        ) +
        (
            poissonResults.draw *
            0.40
        );


    const blendedAway =
        (
            awayProbability * 0.60
        ) +
        (
            poissonResults.away *
            0.40
        );


    const blendedTotal =
        blendedHome +
        blendedDraw +
        blendedAway;


    const finalResults = {

        home:
            blendedHome /
            blendedTotal,

        draw:
            blendedDraw /
            blendedTotal,

        away:
            blendedAway /
            blendedTotal
    };


    /*
    -------------------------------------------------------
    Correct scores
    -------------------------------------------------------
    */

    const topScores =
        getTopCorrectScores(
            scores,
            10
        );


    /*
    -------------------------------------------------------
    Goals markets
    -------------------------------------------------------
    */

    const over05 =
        calculateGoalsProbability(
            scores,
            1
        );


    const over15 =
        calculateGoalsProbability(
            scores,
            2
        );


    const over25 =
        calculateGoalsProbability(
            scores,
            3
        );


    const over35 =
        calculateGoalsProbability(
            scores,
            4
        );


    const under15 =
        1 -
        over15;


    const under25 =
        1 -
        over25;


    const under35 =
        1 -
        over35;


    const btts =
        calculateBTTS(
            scores
        );


    /*
    -------------------------------------------------------
    Winner
    -------------------------------------------------------
    */

    const winner =
        getWinner(
            finalResults,
            homeName,
            awayName
        );


    /*
    -------------------------------------------------------
    Confidence
    -------------------------------------------------------
    */

    const confidence =
        calculateConfidence(
            finalResults
        );


    /*
    -------------------------------------------------------
    Recommended markets
    -------------------------------------------------------
    */

    let recommendedMarkets = [];


    if (
        finalResults.home >=
        0.55
    ) {

        recommendedMarkets.push({
            market: "Home Win",
            probability:
                percentage(
                    finalResults.home
                )
        });
    }


    if (
        finalResults.away >=
        0.55
    ) {

        recommendedMarkets.push({
            market: "Away Win",
            probability:
                percentage(
                    finalResults.away
                )
        });
    }


    if (
        over25 >=
        0.55
    ) {

        recommendedMarkets.push({
            market: "Over 2.5 Goals",
            probability:
                percentage(
                    over25
                )
        });
    }


    if (
        under25 >=
        0.55
    ) {

        recommendedMarkets.push({
            market: "Under 2.5 Goals",
            probability:
                percentage(
                    under25
                )
        });
    }


    if (
        btts >=
        0.55
    ) {

        recommendedMarkets.push({
            market: "BTTS Yes",
            probability:
                percentage(
                    btts
                )
        });
    }


    if (
        btts <=
        0.45
    ) {

        recommendedMarkets.push({
            market: "BTTS No",
            probability:
                percentage(
                    1 - btts
                )
        });
    }


    /*
    -------------------------------------------------------
    Primary prediction
    -------------------------------------------------------
    */

    const primaryScore =
        topScores.length
            ? topScores[0]
            : null;


    /*
    -------------------------------------------------------
    Return model
    -------------------------------------------------------
    */

    return {

        prediction:
            primaryScore
                ? primaryScore.score
                : "N/A",

        predictedWinner:
            winner,

        confidence:
            confidence.percentage,

        confidenceLevel:
            confidence.level,

        expectedGoals: {

            home:
                xG.home,

            away:
                xG.away
        },

        resultProbabilities: {

            homeWin:
                percentage(
                    finalResults.home
                ),

            draw:
                percentage(
                    finalResults.draw
                ),

            awayWin:
                percentage(
                    finalResults.away
                )
        },

        resultProbabilitiesDecimal: {

            homeWin:
                round(
                    finalResults.home,
                    4
                ),

            draw:
                round(
                    finalResults.draw,
                    4
                ),

            awayWin:
                round(
                    finalResults.away,
                    4
                )
        },

        goalsMarkets: {

            over05:
                percentage(
                    over05
                ),

            over15:
                percentage(
                    over15
                ),

            over25:
                percentage(
                    over25
                ),

            over35:
                percentage(
                    over35
                ),

            under15:
                percentage(
                    under15
                ),

            under25:
                percentage(
                    under25
                ),

            under35:
                percentage(
                    under35
                )
        },

        bothTeamsToScore: {

            yes:
                percentage(
                    btts
                ),

            no:
                percentage(
                    1 - btts
                )
        },

        topCorrectScores:
            topScores,

        recommendedMarkets,

        odds
    };
}
/*
===========================================================
26. FORMAT FIXTURE
===========================================================
*/

async function formatFixture(
    item
) {

    let home =
        isObject(
            item.home_team
        )
            ? item.home_team
            : null;


    let away =
        isObject(
            item.away_team
        )
            ? item.away_team
            : null;


    let league =
        isObject(
            item.league
        )
            ? item.league
            : null;


    /*
    -------------------------------------------------------
    Get detailed event if needed
    -------------------------------------------------------
    */

    if (
        !home?.name ||
        !away?.name ||
        !league?.name
    ) {

        const details =
            await getEvent(
                item.id
            );


        if (details) {

            home =
                details.home_team ||
                home;


            away =
                details.away_team ||
                away;


            league =
                details.league ||
                league;
        }
    }


    /*
    -------------------------------------------------------
    Team fallbacks
    -------------------------------------------------------
    */

    if (
        !home?.name &&
        item.home_team_id
    ) {

        home =
            await getTeam(
                item.home_team_id
            ) ||
            home;
    }


    if (
        !away?.name &&
        item.away_team_id
    ) {

        away =
            await getTeam(
                item.away_team_id
            ) ||
            away;
    }


    if (
        !league?.name &&
        item.league_id
    ) {

        league =
            await getLeague(
                item.league_id
            ) ||
            league;
    }


    const homeId =
        getId(home) ||
        item.home_team_id ||
        null;


    const awayId =
        getId(away) ||
        item.away_team_id ||
        null;


    const leagueId =
        getId(league) ||
        item.league_id ||
        null;


    const date =
        item.event_date ||
        item.start_time ||
        item.date ||
        null;


    return {

        id:
            item.id,

        date:
            date,

        nigeriaDate:
            getNigeriaDateOnly(
                date
            ),

        nigeriaDateTime:
            getNigeriaDateTime(
                date
            ),

        status:
            item.status ||
            "notstarted",

        league: {

            id:
                leagueId,

            name:
                getName(
                    league,
                    "Unknown League"
                ),

            country:
                league?.country ||
                league?.country_name ||
                null,

            logo:
                leagueId
                    ? `${BZZOIRO_IMAGE_URL}/league/${leagueId}/`
                    : null
        },

        home: {

            id:
                homeId,

            name:
                getName(
                    home,
                    "Home Team"
                ),

            logo:
                homeId
                    ? `${BZZOIRO_IMAGE_URL}/team/${homeId}/`
                    : null
        },

        away: {

            id:
                awayId,

            name:
                getName(
                    away,
                    "Away Team"
                ),

            logo:
                awayId
                    ? `${BZZOIRO_IMAGE_URL}/team/${awayId}/`
                    : null
        },

        score: {

            home:
                item.home_score ??
                item.home_goals ??
                null,

            away:
                item.away_score ??
                item.away_goals ??
                null
        }
    };
}


/*
===========================================================
27. HEALTH ENDPOINT
===========================================================
*/

app.get(
    "/api/health",
    (req, res) => {

        res.json({

            success:
                true,

            service:
                "Football AI",

            status:
                "running",

            provider:
                "Bzzoiro Sports Data",

            bzzoiroConfigured:
                Boolean(
                    BZZOIRO_API_KEY
                ),

            port:
                PORT,

            time:
                new Date().toISOString()
        });
    }
);
/*
===========================================================
DAILY BETTING PICKS
===========================================================
*/

app.get("/api/daily-picks", async (req, res) => {

    try {

        const today = nigeriaDate();

        /*
        ---------------------------------------------------
        1. GET TODAY'S FIXTURES
        ---------------------------------------------------
        */

        const fixtureData = await api(
            `/events/?date_from=${today}&date_to=${today}&limit=200`
        );

        const events = Array.isArray(fixtureData?.results)
            ? fixtureData.results
            : [];

        if (!events.length) {

            return res.json({
                success: true,
                date: today,
                message: "No fixtures found for today.",
                slips: {
                    safe: null,
                    balanced: null
                }
            });
        }


        /*
        ---------------------------------------------------
        2. HELPER FOR FINDING ODDS
        ---------------------------------------------------
        */

        function findDecimalOdds(obj, keys, depth = 0) {

            if (
                !obj ||
                typeof obj !== "object" ||
                depth > 8
            ) {
                return null;
            }

            for (const key of keys) {

                if (
                    Object.prototype.hasOwnProperty.call(
                        obj,
                        key
                    )
                ) {

                    const value = Number(obj[key]);

                    if (
                        Number.isFinite(value) &&
                        value > 1
                    ) {
                        return value;
                    }
                }
            }

            for (const value of Object.values(obj)) {

                if (
                    value &&
                    typeof value === "object"
                ) {

                    const found =
                        findDecimalOdds(
                            value,
                            keys,
                            depth + 1
                        );

                    if (found !== null) {
                        return found;
                    }
                }
            }

            return null;
        }


        /*
        ---------------------------------------------------
        3. EXTRACT COMMON BETTING ODDS
        ---------------------------------------------------
        */

        function extractDailyOdds(odds) {

            return {

                home:
                    findDecimalOdds(
                        odds,
                        [
                            "home_win",
                            "home",
                            "home_odds",
                            "home_price",
                            "home_price_decimal"
                        ]
                    ),

                draw:
                    findDecimalOdds(
                        odds,
                        [
                            "draw",
                            "draw_odds",
                            "draw_price",
                            "draw_price_decimal"
                        ]
                    ),

                away:
                    findDecimalOdds(
                        odds,
                        [
                            "away_win",
                            "away",
                            "away_odds",
                            "away_price",
                            "away_price_decimal"
                        ]
                    ),

                over25:
                    findDecimalOdds(
                        odds,
                        [
                            "over_2_5",
                            "over25",
                            "over_2_5_odds",
                            "over25_odds"
                        ]
                    ),

                under25:
                    findDecimalOdds(
                        odds,
                        [
                            "under_2_5",
                            "under25",
                            "under_2_5_odds",
                            "under25_odds"
                        ]
                    ),

                bttsYes:
                    findDecimalOdds(
                        odds,
                        [
                            "btts_yes",
                            "btts_yes_odds",
                            "both_teams_to_score_yes"
                        ]
                    )
            };
        }


        /*
        ---------------------------------------------------
        4. BUILD CANDIDATE PICKS
        ---------------------------------------------------
        */

        const candidates = [];


        for (
            const event of events.slice(0, 50)
        ) {

            const status =
                String(
                    event.status || ""
                ).toLowerCase();


            if (
                status === "finished" ||
                status === "live" ||
                status === "cancelled" ||
                status === "postponed"
            ) {
                continue;
            }


            const eventId =
                event.id;


            if (!eventId) {
                continue;
            }


            const [
                details,
                prediction,
                odds
            ] = await Promise.all([

                getEvent(eventId),

                safe(
                    `/events/${eventId}/prediction/`
                ),

                safe(
                    `/events/${eventId}/odds/`
                )

            ]);


            if (!details) {
                continue;
            }


            const home =
                typeof details.home_team === "object"
                    ? details.home_team.name
                    : details.home_team;


            const away =
                typeof details.away_team === "object"
                    ? details.away_team.name
                    : details.away_team;


            const league =
                typeof details.league === "object"
                    ? details.league.name
                    : details.league;


            if (!home || !away) {
                continue;
            }


            const model =
                buildModel(
                    prediction,
                    odds,
                    null
                );


            const marketOdds =
                extractDailyOdds(
                    odds
                );


            /*
            -----------------------------------------------
            HOME WIN
            -----------------------------------------------
            */

            if (
                marketOdds.home !== null &&
                model.resultProbabilities.homeWin >= 0.60
            ) {

                candidates.push({

                    eventId,

                    home,

                    away,

                    league:
                        league || "Unknown League",

                    date:
                        details.event_date ||
                        details.start_time ||
                        details.date ||
                        null,

                    market:
                        "Home Win",

                    selection:
                        home,

                    odds:
                        Number(
                            marketOdds.home.toFixed(2)
                        ),

                    probability:
                        model.resultProbabilities.homeWin

                });
            }


            /*
            -----------------------------------------------
            DRAW
            -----------------------------------------------
            */

            if (
                marketOdds.draw !== null &&
                model.resultProbabilities.draw >= 0.38
            ) {

                candidates.push({

                    eventId,

                    home,

                    away,

                    league:
                        league || "Unknown League",

                    date:
                        details.event_date ||
                        details.start_time ||
                        details.date ||
                        null,

                    market:
                        "Draw",

                    selection:
                        "Draw",

                    odds:
                        Number(
                            marketOdds.draw.toFixed(2)
                        ),

                    probability:
                        model.resultProbabilities.draw

                });
            }


            /*
            -----------------------------------------------
            AWAY WIN
            -----------------------------------------------
            */

            if (
                marketOdds.away !== null &&
                model.resultProbabilities.awayWin >= 0.60
            ) {

                candidates.push({

                    eventId,

                    home,

                    away,

                    league:
                        league || "Unknown League",

                    date:
                        details.event_date ||
                        details.start_time ||
                        details.date ||
                        null,

                    market:
                        "Away Win",

                    selection:
                        away,

                    odds:
                        Number(
                            marketOdds.away.toFixed(2)
                        ),

                    probability:
                        model.resultProbabilities.awayWin

                });
            }


            /*
            -----------------------------------------------
            OVER 2.5
            -----------------------------------------------
            */

            if (
                marketOdds.over25 !== null
            ) {

                const expectedGoals =
                    model.expectedGoals.home +
                    model.expectedGoals.away;


                if (expectedGoals >= 2.6) {

                    candidates.push({

                        eventId,

                        home,

                        away,

                        league:
                            league || "Unknown League",

                        date:
                            details.event_date ||
                            details.start_time ||
                            details.date ||
                            null,

                        market:
                            "Over 2.5 Goals",

                        selection:
                            "Over 2.5",

                        odds:
                            Number(
                                marketOdds.over25.toFixed(2)
                            ),

                        probability:
                            0.60

                    });
                }
            }


            /*
            -----------------------------------------------
            BTTS
            -----------------------------------------------
            */

            if (
                marketOdds.bttsYes !== null
            ) {

                const expectedGoals =
                    model.expectedGoals.home +
                    model.expectedGoals.away;


                if (
                    expectedGoals >= 2.5 &&
                    model.resultProbabilities.homeWin < 0.75 &&
                    model.resultProbabilities.awayWin < 0.75
                ) {

                    candidates.push({

                        eventId,

                        home,

                        away,

                        league:
                            league || "Unknown League",

                        date:
                            details.event_date ||
                            details.start_time ||
                            details.date ||
                            null,

                        market:
                            "BTTS - Yes",

                        selection:
                            "Both Teams To Score",

                        odds:
                            Number(
                                marketOdds.bttsYes.toFixed(2)
                            ),

                        probability:
                            0.60

                    });
                }
            }

        }


        /*
        ---------------------------------------------------
        5. REMOVE DUPLICATES
        ---------------------------------------------------
        */

        const uniqueCandidates = [];

        const seen = new Set();


        for (
            const pick of candidates
        ) {

            const key =
                `${pick.eventId}-${pick.market}`;


            if (seen.has(key)) {
                continue;
            }


            seen.add(key);

            uniqueCandidates.push(
                pick
            );
        }


        /*
        ---------------------------------------------------
        6. SORT BY MODEL CONFIDENCE
        ---------------------------------------------------
        */

        uniqueCandidates.sort(
            (a, b) =>
                b.probability -
                a.probability
        );


        /*
        ---------------------------------------------------
        7. BUILD ODDS SLIP
        ---------------------------------------------------
        */

        function createSlip(
            minimumOdds,
            maximumOdds,
            maximumSelections
        ) {

            const selected = [];

            const usedEvents =
                new Set();

            const usedLeagues =
                new Set();

            let totalOdds = 1;


            for (
                const pick
                of uniqueCandidates
            ) {

                if (
                    usedEvents.has(
                        pick.eventId
                    )
                ) {
                    continue;
                }


                if (
                    selected.length >=
                    maximumSelections
                ) {
                    break;
                }


                /*
                Prefer different leagues.
                */

                if (
                    usedLeagues.has(
                        pick.league
                    ) &&
                    usedLeagues.size < 3
                ) {
                    continue;
                }


                const newTotal =
                    totalOdds *
                    pick.odds;


                if (
                    newTotal >
                    maximumOdds
                ) {
                    continue;
                }


                selected.push(
                    pick
                );


                totalOdds =
                    newTotal;


                usedEvents.add(
                    pick.eventId
                );


                usedLeagues.add(
                    pick.league
                );


                if (
                    totalOdds >=
                    minimumOdds
                ) {
                    break;
                }
            }


            /*
            Second pass if league diversity
            prevented the target.
            */

            if (
                totalOdds <
                minimumOdds
            ) {

                for (
                    const pick
                    of uniqueCandidates
                ) {

                    if (
                        usedEvents.has(
                            pick.eventId
                        )
                    ) {
                        continue;
                    }


                    if (
                        selected.length >=
                        maximumSelections
                    ) {
                        break;
                    }


                    const newTotal =
                        totalOdds *
                        pick.odds;


                    if (
                        newTotal >
                        maximumOdds
                    ) {
                        continue;
                    }


                    selected.push(
                        pick
                    );


                    totalOdds =
                        newTotal;


                    usedEvents.add(
                        pick.eventId
                    );


                    if (
                        totalOdds >=
                        minimumOdds
                    ) {
                        break;
                    }
                }
            }


            if (
                totalOdds <
                minimumOdds
            ) {
                return null;
            }


            return {

                selections:
                    selected.map(
                        pick => ({

                            eventId:
                                pick.eventId,

                            home:
                                pick.home,

                            away:
                                pick.away,

                            league:
                                pick.league,

                            kickoff:
                                pick.date,

                            market:
                                pick.market,

                            selection:
                                pick.selection,

                            odds:
                                pick.odds,

                            probability:
                                `${(
                                    pick.probability *
                                    100
                                ).toFixed(1)}%`

                        })
                    ),

                totalOdds:
                    Number(
                        totalOdds.toFixed(2)
                    ),

                selectionCount:
                    selected.length,

                bookingCode:
                    null,

                bookingStatus:
                    "Pending SportyBet booking"

            };
        }


        /*
        ---------------------------------------------------
        8. CREATE TWO DAILY SLIPS
        ---------------------------------------------------
        */

        const safe =
            createSlip(
                5,
                7,
                6
            );


        const balanced =
            createSlip(
                7,
                10,
                7
            );


        /*
        ---------------------------------------------------
        9. SEND RESPONSE
        ---------------------------------------------------
        */

        res.json({

            success: true,

            provider:
                "Bzzoiro Sports Data",

            date:
                today,

            slips: {

                safe,

                balanced

            },

            disclaimer:
                "These are statistical model selections, not guaranteed wins. Odds change before kickoff. SportyBet booking codes must come from an actual SportyBet bet slip."

        });


    } catch (error) {

        console.error(
            "Daily picks error:",
            error
        );


        res.status(500).json({

            success: false,

            message:
                error.message ||
                "Unable to generate daily picks."

        });

    }

});

/*
===========================================================
28. BZZOIRO TEST ENDPOINT
===========================================================
*/

app.get(
    "/api/bzzoiro-test",
    async (req, res) => {

        try {

            const data =
                await bzzoiroRequest(
                    "/events/?limit=5"
                );


            res.json({

                success:
                    true,

                provider:
                    "Bzzoiro Sports Data",

                message:
                    "Bzzoiro API connection is working.",

                count:
                    data.count ??
                    0,

                results:
                    data.results ??
                    []
            });


        } catch (error) {

            console.error(
                "Bzzoiro test error:",
                error
            );


            res.status(500).json({

                success:
                    false,

                provider:
                    "Bzzoiro Sports Data",

                message:
                    error.message
            });
        }
    }
);


/*
===========================================================
29. FIXTURES ENDPOINT
===========================================================
*/

app.get(
    "/api/fixtures",
    async (req, res) => {

        try {

            const requestedDate =
                req.query.date ||
                getNigeriaDate();


            const nigeriaStart =
                new Date(
                    `${requestedDate}T00:00:00+01:00`
                );


            const nigeriaEnd =
                new Date(
                    nigeriaStart.getTime() +
                    24 * 60 * 60 * 1000
                );


            const dateFrom =
                nigeriaStart
                    .toISOString()
                    .slice(0, 10);


            const dateTo =
                nigeriaEnd
                    .toISOString()
                    .slice(0, 10);


            const endpoint =
                `/events/?date_from=${dateFrom}&date_to=${dateTo}&limit=200`;


            const data =
                await bzzoiroRequest(
                    endpoint
                );


            const rawFixtures =
                Array.isArray(
                    data.results
                )
                    ? data.results
                    : [];


            const formatted =
                await Promise.all(
                    rawFixtures.map(
                        item =>
                            formatFixture(
                                item
                            )
                    )
                );


            const fixtures =
                formatted
                    .filter(
                        fixture =>
                            fixture.nigeriaDate ===
                            requestedDate
                    )
                    .sort(
                        (
                            a,
                            b
                        ) =>
                            new Date(
                                a.date || 0
                            ) -
                            new Date(
                                b.date || 0
                            )
                    );


            res.json({

                success:
                    true,

                provider:
                    "Bzzoiro Sports Data",

                date:
                    requestedDate,

                timezone:
                    "Africa/Lagos",

                count:
                    fixtures.length,

                fixtures:
                    fixtures
            });


        } catch (error) {

            console.error(
                "Fixtures endpoint error:",
                error
            );


            res.status(500).json({

                success:
                    false,

                message:
                    error.message,

                fixtures:
                    []
            });
        }
    }
);


/*
===========================================================
30. SINGLE MATCH ANALYSIS
===========================================================
*/

app.get(
    "/api/fixture/:id",
    async (req, res) => {

        try {

            const eventId =
                req.params.id;


            if (!eventId) {

                return res
                    .status(400)
                    .json({

                        success:
                            false,

                        message:
                            "Fixture ID is required."
                    });
            }


            /*
            ------------------------------------------------
            Get event
            ------------------------------------------------
            */

            const match =
                await getEvent(
                    eventId
                );


            if (!match) {

                return res
                    .status(404)
                    .json({

                        success:
                            false,

                        message:
                            "Match not found."
                    });
            }


            /*
            ------------------------------------------------
            Get all available match data
            ------------------------------------------------
            */

            const [
                stats,
                h2h,
                oddsData,
                prediction,
                lineups,
                incidents
            ] =
                await Promise.all([

                    getStats(
                        eventId
                    ),

                    getH2H(
                        eventId
                    ),

                    getOdds(
                        eventId
                    ),

                    getPrediction(
                        eventId
                    ),

                    getLineups(
                        eventId
                    ),

                    getIncidents(
                        eventId
                    )
                ]);


            /*
            ------------------------------------------------
            Resolve teams
            ------------------------------------------------
            */

            let home =
                isObject(
                    match.home_team
                )
                    ? match.home_team
                    : {

                        id:
                            match.home_team_id,

                        name:
                            typeof match.home_team ===
                            "string"
                                ? match.home_team
                                : "Home Team"
                    };


            let away =
                isObject(
                    match.away_team
                )
                    ? match.away_team
                    : {

                        id:
                            match.away_team_id,

                        name:
                            typeof match.away_team ===
                            "string"
                                ? match.away_team
                                : "Away Team"
                    };


            let league =
                isObject(
                    match.league
                )
                    ? match.league
                    : {

                        id:
                            match.league_id,

                        name:
                            typeof match.league ===
                            "string"
                                ? match.league
                                : "Unknown League"
                    };


            /*
            ------------------------------------------------
            Team fallback
            ------------------------------------------------
            */

            if (
                !home.name &&
                match.home_team_id
            ) {

                home =
                    await getTeam(
                        match.home_team_id
                    ) ||
                    home;
            }


            if (
                !away.name &&
                match.away_team_id
            ) {

                away =
                    await getTeam(
                        match.away_team_id
                    ) ||
                    away;
            }


            if (
                !league.name &&
                match.league_id
            ) {

                league =
                    await getLeague(
                        match.league_id
                    ) ||
                    league;
            }


            /*
            ------------------------------------------------
            Build match object
            ------------------------------------------------
            */

            const matchInfo = {

                id:
                    match.id ||
                    eventId,

                home:
                    getName(
                        home,
                        "Home Team"
                    ),

                away:
                    getName(
                        away,
                        "Away Team"
                    ),

                homeId:
                    getId(home) ||
                    match.home_team_id ||
                    null,

                awayId:
                    getId(away) ||
                    match.away_team_id ||
                    null,

                league:
                    getName(
                        league,
                        "Unknown League"
                    ),

                leagueId:
                    getId(league) ||
                    match.league_id ||
                    null,

                date:
                    match.event_date ||
                    match.start_time ||
                    match.date ||
                    null,

                nigeriaDateTime:
                    getNigeriaDateTime(
                        match.event_date ||
                        match.start_time ||
                        match.date
                    ),

                status:
                    match.status ||
                    "unknown",

                score: {

                    home:
                        match.home_score ??
                        match.home_goals ??
                        null,

                    away:
                        match.away_score ??
                        match.away_goals ??
                        null
                }
            };


            /*
            ------------------------------------------------
            Build prediction model
            ------------------------------------------------
            */

            const model =
                buildPredictionModel(
                    matchInfo,
                    prediction,
                    stats,
                    oddsData
                );


            /*
            ------------------------------------------------
            Return complete analysis
            ------------------------------------------------
            */

            res.json({

                success:
                    true,

                provider:
                    "Bzzoiro Sports Data",

                match:
                    matchInfo,

                model:
                    model,

                data: {

                    stats:
                        stats,

                    h2h:
                        h2h,

                    odds:
                        oddsData,

                    prediction:
                        prediction,

                    lineups:
                        lineups,

                    incidents:
                        incidents
                },

                generatedAt:
                    new Date()
                        .toISOString()
            });


        } catch (error) {

            console.error(
                "Match analysis error:",
                error
            );


            res.status(500).json({

                success:
                    false,

                message:
                    error.message ||
                    "Unable to analyze match."
            });
        }
    }
);


/*
===========================================================
31. TEAM INFORMATION
===========================================================
*/

app.get(
    "/api/team/:id",
    async (req, res) => {

        try {

            const teamId =
                req.params.id;


            if (!teamId) {

                return res
                    .status(400)
                    .json({

                        success:
                            false,

                        message:
                            "Team ID is required."
                    });
            }


            const team =
                await getTeam(
                    teamId
                );


            if (!team) {

                return res
                    .status(404)
                    .json({

                        success:
                            false,

                        message:
                            "Team not found."
                    });
            }


            res.json({

                success:
                    true,

                provider:
                    "Bzzoiro Sports Data",

                team:
                    team
            });


        } catch (error) {

            res.status(500).json({

                success:
                    false,

                message:
                    error.message
            });
        }
    }
);


/*
===========================================================
32. TEAM FIXTURES
===========================================================
*/

app.get(
    "/api/team/:id/fixtures",
    async (req, res) => {

        try {

            const teamId =
                req.params.id;


            const data =
                await safeRequest(
                    `/teams/${teamId}/fixtures/`
                );


            if (!data) {

                return res
                    .status(404)
                    .json({

                        success:
                            false,

                        message:
                            "Team fixtures not found."
                    });
            }


            res.json({

                success:
                    true,

                provider:
                    "Bzzoiro Sports Data",

                teamId:
                    teamId,

                data:
                    data
            });


        } catch (error) {

            res.status(500).json({

                success:
                    false,

                message:
                    error.message
            });
        }
    }
);


/*
===========================================================
33. H2H ENDPOINT
===========================================================
*/

app.get(
    "/api/fixture/:id/h2h",
    async (req, res) => {

        try {

            const id =
                req.params.id;


            const data =
                await getH2H(
                    id
                );


            res.json({

                success:
                    true,

                provider:
                    "Bzzoiro Sports Data",

                fixtureId:
                    id,

                h2h:
                    data
            });


        } catch (error) {

            res.status(500).json({

                success:
                    false,

                message:
                    error.message
            });
        }
    }
);


/*
===========================================================
34. ODDS ENDPOINT
===========================================================
*/

app.get(
    "/api/fixture/:id/odds",
    async (req, res) => {

        try {

            const id =
                req.params.id;


            const data =
                await getOdds(
                    id
                );


            res.json({

                success:
                    true,

                provider:
                    "Bzzoiro Sports Data",

                fixtureId:
                    id,

                odds:
                    data
            });


        } catch (error) {

            res.status(500).json({

                success:
                    false,

                message:
                    error.message
            });
        }
    }
);


/*
===========================================================
35. STATS ENDPOINT
===========================================================
*/

app.get(
    "/api/fixture/:id/stats",
    async (req, res) => {

        try {

            const id =
                req.params.id;


            const data =
                await getStats(
                    id
                );


            res.json({

                success:
                    true,

                provider:
                    "Bzzoiro Sports Data",

                fixtureId:
                    id,

                stats:
                    data
            });


        } catch (error) {

            res.status(500).json({

                success:
                    false,

                message:
                    error.message
            });
        }
    }
);


/*
===========================================================
36. PREDICTION DATA ENDPOINT
===========================================================
*/

app.get(
    "/api/fixture/:id/prediction",
    async (req, res) => {

        try {

            const id =
                req.params.id;


            const data =
                await getPrediction(
                    id
                );


            res.json({

                success:
                    true,

                provider:
                    "Bzzoiro Sports Data",

                fixtureId:
                    id,

                prediction:
                    data
            });


        } catch (error) {

            res.status(500).json({

                success:
                    false,

                message:
                    error.message
            });
        }
    }
);


/*
===========================================================
37. CACHE STATUS
===========================================================
*/

app.get(
    "/api/cache",
    (req, res) => {

        res.json({

            success:
                true,

            entries:
                cache.size,

            cacheDuration:
                CACHE_DURATION,

            timestamp:
                new Date()
                    .toISOString()
        });
    }
);


/*
===========================================================
38. CLEAR CACHE
===========================================================
*/

app.post(
    "/api/cache/clear",
    (req, res) => {

        cache.clear();


        res.json({

            success:
                true,

            message:
                "Cache cleared successfully."
        });
    }
);


/*
===========================================================
39. API INFORMATION
===========================================================
*/

app.get(
    "/api",
    (req, res) => {

        res.json({

            success:
                true,

            name:
                "Football AI Analyst API",

            version:
                "1.0.0",

            provider:
                "Bzzoiro Sports Data",

            endpoints: {

                health:
                    "/api/health",

                fixtures:
                    "/api/fixtures",

                fixture:
                    "/api/fixture/:id",

                team:
                    "/api/team/:id",

                teamFixtures:
                    "/api/team/:id/fixtures",

                h2h:
                    "/api/fixture/:id/h2h",

                odds:
                    "/api/fixture/:id/odds",

                stats:
                    "/api/fixture/:id/stats",

                prediction:
                    "/api/fixture/:id/prediction",

                bzzoiroTest:
                    "/api/bzzoiro-test"
            }
        });
    }
);


/*
===========================================================
40. FRONTEND FALLBACK
===========================================================
*/

app.get(
    "*",
    (req, res) => {

        res.sendFile(
            path.join(
                __dirname,
                "public",
                "index.html"
            )
        );
    }
);


/*
===========================================================
41. SERVER START
===========================================================
*/

app.listen(
    PORT,
    "0.0.0.0",
    () => {

        console.log(
            "================================================"
        );

        console.log(
            "FOOTBALL AI ANALYST SERVER"
        );

        console.log(
            "================================================"
        );

        console.log(
            `PORT: ${PORT}`
        );

        console.log(
            `BZZOIRO API KEY: ${
                BZZOIRO_API_KEY
                    ? "CONFIGURED"
                    : "MISSING"
            }`
        );

        console.log(
            `BZZOIRO API: ${BZZOIRO_BASE_URL}`
        );

        console.log(
            "Server is ready."
        );

        console.log(
            "================================================"
        );
    }
);
            
