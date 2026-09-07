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
   TODAY'S FIXTURES
========================= */

app.get(
    "/api/fixtures",
    async (req, res) => {

        try {

            let date =
                req.query.date;

            if (!date) {

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

                date =
                    formatter.format(
                        new Date()
                    );
            }


            /* Get fixtures for selected date */

            const endpoint =
                `/events/?date_from=${date}&date_to=${date}&limit=200`;

            const data =
                await bzzoiroAPI(
                    endpoint
                );

            const rawFixtures =
                data.results || [];


            /* Enrich fixtures */

            const fixtures =
                await Promise.all(

                    rawFixtures.map(
                        async (item) => {

                            let eventDetail =
                                null;

                            let homeTeam =
                                item.home_team || null;

                            let awayTeam =
                                item.away_team || null;

                            let league =
                                item.league || null;


                            /*
                             * If the list endpoint
                             * does not provide names,
                             * get the full event.
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
                             * If team names are
                             * still missing,
                             * get team details.
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
                             * If league name is
                             * still missing,
                             * get league details.
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


                            return {

                                id:
                                    item.id,

                                date:
                                    item.event_date ||
                                    item.start_time ||
                                    item.date ||
                                    null,

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


            res.json({

                success:
                    true,

                provider:
                    "Bzzoiro Sports Data",

                date,

                count:
                    fixtures.length,

                fixtures

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
