require("dotenv").config();

const express = require("express");
const cors = require("cors");
const path = require("path");

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

const PORT = Number(process.env.PORT) || 10000;

const BZZOIRO_API_KEY =
    process.env.BZZOIRO_API_KEY;

const BZZOIRO_URL =
    "https://sports.bzzoiro.com/api/v2";

const IMAGE_URL =
    "https://sports.bzzoiro.com/img";

const cache =
    new Map();

const CACHE_TIME =
    10 * 60 * 1000;


/* =========================
   BZZOIRO API HELPER
========================= */

async function bzzoiroAPI(endpoint) {

    if (!BZZOIRO_API_KEY) {

        throw new Error(
            "BZZOIRO_API_KEY is missing."
        );

    }

    const cached =
        cache.get(endpoint);

    if (
        cached &&
        Date.now() - cached.time <
        CACHE_TIME
    ) {

        return cached.data;

    }

    const response =
        await fetch(
            `${BZZOIRO_URL}${endpoint}`,
            {
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


    if (!response.ok) {

        throw new Error(
            `Bzzoiro API error: ${response.status} ${JSON.stringify(data)}`
        );

    }


    cache.set(
        endpoint,
        {
            time:
                Date.now(),

            data:
                data
        }
    );


    return data;

}


/* =========================
   TEAM DETAILS
========================= */

async function getTeam(teamId) {

    if (!teamId) {

        return null;

    }

    try {

        return await bzzoiroAPI(
            `/teams/${teamId}/`
        );

    } catch (error) {

        console.error(
            `Team ${teamId} error:`,
            error.message
        );

        return null;

    }

}


/* =========================
   LEAGUE DETAILS
========================= */

async function getLeague(leagueId) {

    if (!leagueId) {

        return null;

    }

    try {

        return await bzzoiroAPI(
            `/leagues/${leagueId}/`
        );

    } catch (error) {

        console.error(
            `League ${leagueId} error:`,
            error.message
        );

        return null;

    }

}


/* =========================
   EVENT DETAILS
========================= */

async function getEvent(eventId) {

    if (!eventId) {

        return null;

    }

    try {

        return await bzzoiroAPI(
            `/events/${eventId}/`
        );

    } catch (error) {

        console.error(
            `Event ${eventId} error:`,
            error.message
        );

        return null;

    }

}


/* =========================
   NIGERIA DATE HELPER
========================= */

function getNigeriaDate() {

    const formatter =
        new Intl.DateTimeFormat(
            "en-CA",
            {

                timeZone:
                    "Africa/Lagos",

                year:
                    "numeric",

                month:
                    "2-digit",

                day:
                    "2-digit"

            }
        );


    return formatter.format(
        new Date()
    );

}


/* =========================
   CONVERT UTC TO NIGERIA DATE
========================= */

function getNigeriaMatchDate(
    matchDate
) {

    if (!matchDate) {

        return null;

    }


    const dateObject =
        new Date(matchDate);


    if (
        Number.isNaN(
            dateObject.getTime()
        )
    ) {

        return null;

    }


    const formatter =
        new Intl.DateTimeFormat(
            "en-CA",
            {

                timeZone:
                    "Africa/Lagos",

                year:
                    "numeric",

                month:
                    "2-digit",

                day:
                    "2-digit"

            }
        );


    return formatter.format(
        dateObject
    );

}


/* =========================
   PREDICTION ENGINE HELPERS
========================= */


/*
 * Convert a value into a number.
 */

function toNumber(value) {

    const number =
        Number(value);


    return Number.isFinite(number)
        ? number
        : null;

}


/*
 * Find probability values from
 * different possible API structures.
 */

function findProbability(
    object,
    keys
) {

    if (
        !object ||
        typeof object !== "object"
    ) {

        return null;

    }


    for (
        const key of keys
    ) {

        const value =
            object[key];


        const number =
            toNumber(value);


        if (
            number !== null &&
            number >= 0 &&
            number <= 1
        ) {

            return number;

        }


        /*
         * Also support percentages
         * such as 72 instead of 0.72.
         */

        if (
            number !== null &&
            number > 1 &&
            number <= 100
        ) {

            return number / 100;

        }

    }


    return null;

}


/*
 * Poisson probability.
 *
 * P(X = k)
 *
 * =
 *
 * (e^-lambda × lambda^k) / k!
 */

function poissonProbability(
    lambda,
    goals
) {

    if (
        !Number.isFinite(lambda) ||
        lambda < 0
    ) {

        return 0;

    }


    let factorial =
        1;


    for (
        let i = 2;
        i <= goals;
        i++
    ) {

        factorial *= i;

    }


    return (
        Math.exp(-lambda) *
        Math.pow(lambda, goals)
    ) / factorial;

}


/*
 * Calculate all possible
 * correct-score probabilities.
 */

function calculateScoreProbabilities(
    homeXG,
    awayXG
) {

    const scores = [];


    for (
        let homeGoals = 0;
        homeGoals <= 6;
        homeGoals++
    ) {

        for (
            let awayGoals = 0;
            awayGoals <= 6;
            awayGoals++
        ) {

            const homeProbability =
                poissonProbability(
                    homeXG,
                    homeGoals
                );


            const awayProbability =
                poissonProbability(
                    awayXG,
                    awayGoals
                );


            const probability =
                homeProbability *
                awayProbability;


            scores.push({

                home:
                    homeGoals,

                away:
                    awayGoals,

                probability:
                    probability

            });

        }

    }


    scores.sort(
        (a, b) =>
            b.probability -
            a.probability
    );


    return scores;

}


/*
 * Convert probability to percentage.
 */

function percentage(value) {

    if (
        !Number.isFinite(value)
    ) {

        return "N/A";

    }


    return (
        value * 100
    ).toFixed(1) + "%";

}


/*
 * Calculate Home/Draw/Away
 * probabilities from score matrix.
 */

function calculateResultProbabilities(
    scores
) {

    let homeWin =
        0;

    let draw =
        0;

    let awayWin =
        0;


    scores.forEach(
        score => {

            if (
                score.home >
                score.away
            ) {

                homeWin +=
                    score.probability;

            }

            else if (
                score.home ===
                score.away
            ) {

                draw +=
                    score.probability;

            }

            else {

                awayWin +=
                    score.probability;

            }

        }
    );


    const total =
        homeWin +
        draw +
        awayWin;


    if (
        total <= 0
    ) {

        return {

            homeWin:
                0,

            draw:
                0,

            awayWin:
                0

        };

    }


    return {

        homeWin:
            homeWin / total,

        draw:
            draw / total,

        awayWin:
            awayWin / total

    };

}


/*
 * Extract Home/Draw/Away
 * probabilities.
 */

function extractPredictionProbability(
    prediction,
    type
) {

    if (!prediction) {

        return null;

    }


    const sources = [

        prediction,

        prediction.prediction,

        prediction.result,

        prediction.probabilities,

        prediction.result_probabilities,

        prediction.markets

    ];


    let keys = [];


    if (
        type === "home"
    ) {

        keys = [

            "home_win_prob",

            "home_win_probability",

            "home_probability",

            "probability_home",

            "home"

        ];

    }


    if (
        type === "draw"
    ) {

        keys = [

            "draw_prob",

            "draw_probability",

            "probability_draw",

            "draw"

        ];

    }


    if (
        type === "away"
    ) {

        keys = [

            "away_win_prob",

            "away_win_probability",

            "away_probability",

            "probability_away",

            "away"

        ];

    }


    for (
        const source of sources
    ) {

        const result =
            findProbability(
                source,
                keys
            );


        if (
            result !== null
        ) {

            return result;

        }

    }


    return null;

}


/*
 * Extract expected goals.
 */

function extractXG(
    stats,
    prediction,
    side
) {

    const sources = [

        stats,

        stats?.stats,

        stats?.statistics,

        prediction,

        prediction?.prediction,

        prediction?.xg,

        prediction?.expected_goals

    ];


    const keys =
        side === "home"

            ? [

                "home_xg",

                "home_expected_goals",

                "expected_goals_home",

                "xg_home",

                "home"

            ]

            : [

                "away_xg",

                "away_expected_goals",

                "expected_goals_away",

                "xg_away",

                "away"

            ];


    for (
        const source of sources
    ) {

        if (
            !source ||
            typeof source !== "object"
        ) {

            continue;

        }


        const result =
            findProbability(
                source,
                keys
            );


        if (
            result !== null &&
            result > 0
        ) {

            return result;

        }

    }


    return null;

}


/*
 * Estimate expected goals when
 * direct xG is unavailable.
 */

function estimateExpectedGoals(
    homeProbability,
    drawProbability,
    awayProbability
) {

    const home =
        Number(
            homeProbability
        );


    const draw =
        Number(
            drawProbability
        );


    const away =
        Number(
            awayProbability
        );


    if (
        !Number.isFinite(home) ||
        !Number.isFinite(draw) ||
        !Number.isFinite(away)
    ) {

        return {

            home:
                1.50,

            away:
                1.10

        };

    }


    let homeXG =
        1.10 +
        (
            home -
            away
        ) * 1.80;


    const totalXG =
        2.20 -
        (
            draw -
            0.25
        ) * 1.50;


    let awayXG =
        totalXG -
        homeXG;


    homeXG =
        Math.max(
            0.20,
            Math.min(
                homeXG,
                4.50
            )
        );


    awayXG =
        Math.max(
            0.15,
            Math.min(
                awayXG,
                4.00
            )
        );


    return {

        home:
            homeXG,

        away:
            awayXG

    };

}


/* =========================
   TODAY'S FIXTURES
========================= */

app.get(
    "/api/fixtures",
    async (req, res) => {

        try {

            const nigeriaDate =
                req.query.date ||
                getNigeriaDate();


            const selectedDate =
                new Date(
                    `${nigeriaDate}T00:00:00+01:00`
                );


            const nextDate =
                new Date(
                    selectedDate.getTime() +
                    24 * 60 * 60 * 1000
                );


            const utcFrom =
                selectedDate
                    .toISOString()
                    .slice(0, 10);


            const utcTo =
                nextDate
                    .toISOString()
                    .slice(0, 10);


            const endpoint =
                `/events/?date_from=${utcFrom}&date_to=${utcTo}&limit=200`;


            const data =
                await bzzoiroAPI(
                    endpoint
                );


            const rawFixtures =
                data.results || [];


            const fixtures =
                await Promise.all(

                    rawFixtures.map(
                        async item => {

                            let eventDetail =
                                null;


                            let homeTeam =
                                typeof item.home_team ===
                                "object"

                                    ? item.home_team

                                    : null;


                            let awayTeam =
                                typeof item.away_team ===
                                "object"

                                    ? item.away_team

                                    : null;


                            let league =
                                typeof item.league ===
                                "object"

                                    ? item.league

                                    : null;


                            if (
                                !homeTeam?.name ||
                                !awayTeam?.name ||
                                !league?.name
                            ) {

                                eventDetail =
                                    await getEvent(
                                        item.id
                                    );


                                if (
                                    eventDetail
                                ) {

                                    homeTeam =
                                        eventDetail.home_team ||
                                        homeTeam;


                                    awayTeam =
                                        eventDetail.away_team ||
                                        awayTeam;


                                    league =
                                        eventDetail.league ||
                                        league;

                                }

                            }


                            if (
                                !homeTeam?.name &&
                                item.home_team_id
                            ) {

                                homeTeam =
                                    await getTeam(
                                        item.home_team_id
                                    );

                            }


                            if (
                                !awayTeam?.name &&
                                item.away_team_id
                            ) {

                                awayTeam =
                                    await getTeam(
                                        item.away_team_id
                                    );

                            }


                            if (
                                !league?.name &&
                                item.league_id
                            ) {

                                league =
                                    await getLeague(
                                        item.league_id
                                    );

                            }


                            const homeId =
                                homeTeam?.id ||
                                item.home_team_id ||
                                null;


                            const awayId =
                                awayTeam?.id ||
                                item.away_team_id ||
                                null;


                            const leagueId =
                                league?.id ||
                                item.league_id ||
                                null;


                            const matchDate =
                                item.event_date ||
                                item.start_time ||
                                item.date ||
                                null;


                            const nigeriaMatchDate =
                                getNigeriaMatchDate(
                                    matchDate
                                );


                            return {

                                id:
                                    item.id,

                                date:
                                    matchDate,

                                nigeriaDate:
                                    nigeriaMatchDate,

                                status:
                                    item.status ||
                                    "notstarted",


                                league: {

                                    id:
                                        leagueId,

                                    name:
                                        league?.name ||
                                        "Unknown League",

                                    country:
                                        league?.country ||
                                        league?.country_name ||
                                        null,

                                    logo:
                                        leagueId
                                            ? `${IMAGE_URL}/league/${leagueId}/`
                                            : null

                                },


                                home: {

                                    id:
                                        homeId,

                                    name:
                                        homeTeam?.name ||
                                        "Home Team",

                                    logo:
                                        homeId
                                            ? `${IMAGE_URL}/team/${homeId}/`
                                            : null

                                },


                                away: {

                                    id:
                                        awayId,

                                    name:
                                        awayTeam?.name ||
                                        "Away Team",

                                    logo:
                                        awayId
                                            ? `${IMAGE_URL}/team/${awayId}/`
                                            : null

                                },


                                score: {

                                    home:
                                        item.home_score ??
                                        null,

                                    away:
                                        item.away_score ??
            
