require("dotenv").config();

const express = require("express");
const cors = require("cors");
const path = require("path");

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

const PORT = Number(process.env.PORT) || 10000;

const BZZOIRO_API_KEY = process.env.BZZOIRO_API_KEY;

const BZZOIRO_URL = "https://sports.bzzoiro.com/api/v2";

const IMAGE_URL = "https://sports.bzzoiro.com/img";

const cache = new Map();

const CACHE_TIME = 10 * 60 * 1000;


/* =========================
   BZZOIRO API HELPER
========================= */

async function bzzoiroAPI(endpoint) {

    if (!BZZOIRO_API_KEY) {
        throw new Error("BZZOIRO_API_KEY is missing.");
    }

    const cached = cache.get(endpoint);

    if (
        cached &&
        Date.now() - cached.time < CACHE_TIME
    ) {
        return cached.data;
    }

    const response = await fetch(
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

        data = await response.json();

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
            time: Date.now(),
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

        const data =
            await bzzoiroAPI(
                `/teams/${teamId}/`
            );

        return data;

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

        const data =
            await bzzoiroAPI(
                `/leagues/${leagueId}/`
            );

        return data;

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

        const data =
            await bzzoiroAPI(
                `/events/${eventId}/`
            );

        return data;

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

function getNigeriaMatchDate(matchDate) {

    if (!matchDate) {
        return null;
    }

    const dateObject =
        new Date(matchDate);

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
   TODAY'S FIXTURES
========================= */

app.get(
    "/api/fixtures",
    async (req, res) => {

        try {

            /*
             * Use the requested date if supplied.
             * Otherwise use today's date in Nigeria.
             */

            const nigeriaDate =
                req.query.date ||
                getNigeriaDate();


            /*
             * Nigeria is UTC+1.
             *
             * We request both the UTC date that
             * contains the beginning of the Nigerian
             * day and the following UTC date.
             *
             * This prevents matches around midnight
             * from being missed.
             */

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


            /*
             * Request the UTC date range from Bzzoiro.
             */

            const endpoint =
                `/events/?date_from=${utcFrom}&date_to=${utcTo}&limit=200`;

            const data =
                await bzzoiroAPI(
                    endpoint
                );

            const rawFixtures =
                data.results || [];


            /*
             * Enrich fixtures.
             */

            const fixtures =
                await Promise.all(

                    rawFixtures.map(
                        async (item) => {

                            let eventDetail =
                                null;

                            let homeTeam =
                                typeof item.home_team === "object"
                                    ? item.home_team
                                    : null;

                            let awayTeam =
                                typeof item.away_team === "object"
                                    ? item.away_team
                                    : null;

                            let league =
                                typeof item.league === "object"
                                    ? item.league
                                    : null;


                            /*
                             * Some Bzzoiro responses
                             * return only IDs or strings.
                             *
                             * Get the full event when
                             * required.
                             */

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


                            /*
                             * Get home team details
                             * if the name is still missing.
                             */

                            if (
                                !homeTeam?.name &&
                                item.home_team_id
                            ) {

                                homeTeam =
                                    await getTeam(
                                        item.home_team_id
                                    );
                            }


                            /*
                             * Get away team details
                             * if the name is still missing.
                             */

                            if (
                                !awayTeam?.name &&
                                item.away_team_id
                            ) {

                                awayTeam =
                                    await getTeam(
                                        item.away_team_id
                                    );
                            }


                            /*
                             * Get league details
                             * if the name is still missing.
                             */

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


                            /*
                             * Convert match time to
                             * the Nigerian calendar date.
                             */

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
                                        null
                                }

                            };

                        }
                    )

                );


            /*
             * Only keep matches that belong
             * to the selected Nigerian date.
             */

            const filteredFixtures =
                fixtures.filter(
                    (fixture) =>
                        fixture.nigeriaDate ===
                        nigeriaDate
                );


            /*
             * Sort matches by kickoff time.
             */

            filteredFixtures.sort(
                (a, b) => {

                    const dateA =
                        new Date(
                            a.date || 0
                        );

                    const dateB =
                        new Date(
                            b.date || 0
                        );

                    return (
                        dateA.getTime() -
                        dateB.getTime()
                    );

                }
            );


            res.json({

                success:
                    true,

                provider:
                    "Bzzoiro Sports Data",

                date:
                    nigeriaDate,

                timezone:
                    "Africa/Lagos",

                count:
                    filteredFixtures.length,

                fixtures:
                    filteredFixtures

            });

        } catch (error) {

            console.error(
                "Fixtures error:",
                error
            );

            res.status(500).json({

                success:
                    false,

                message:
                    error.message

            });

        }

    }
);


/* =========================
   BZZOIRO CONNECTION TEST
========================= */

app.get(
    "/api/bzzoiro-test",
    async (req, res) => {

        try {

            const data =
                await bzzoiroAPI(
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
                    data.count ?? 0,

                results:
                    data.results ?? []

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


/* =========================
   HEALTH CHECK
========================= */

app.get(
    "/api/health",
    (req, res) => {

        res.json({

            success:
                true,

            message:
                "Football AI backend is running",

            bzzoiroConfigured:
                Boolean(
                    BZZOIRO_API_KEY
                )

        });

    }
);


/* =========================
   FRONTEND
========================= */

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


/* =========================
   START SERVER
========================= */

app.listen(
    PORT,
    "0.0.0.0",
    () => {

        console.log(
            "================================"
        );

        console.log(
            "Football AI server started"
        );

        console.log(
            `PORT: ${PORT}`
        );

        console.log(
            `BZZOIRO API KEY: ${
                BZZOIRO_API_KEY
                    ? "Configured"
                    : "Missing"
            }`
        );

        console.log(
            "================================"
        );

    }
);
