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

const cache = new Map();

const CACHE_TIME = 10 * 60 * 1000;


/*
========================================
BZZOIRO API HELPER
========================================
*/

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
            time: Date.now(),
            data
        }
    );

    return data;

}


/*
========================================
GET TODAY'S FIXTURES
========================================
*/

app.get(
    "/api/fixtures",
    async (req, res) => {

        try {

            let date = req.query.date;

            /*
            Use today's date in Nigeria
            if no date is supplied.
            */

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

            /*
            Bzzoiro expects:
            date_from=YYYY-MM-DD
            date_to=YYYY-MM-DD
            */

            const endpoint =
                `/events/?date_from=${date}&date_to=${date}&limit=200`;

            const data =
                await bzzoiroAPI(
                    endpoint
                );

            /*
            Convert Bzzoiro's response
            into the structure our
            frontend already understands.
            */

            const fixtures =
                (data.results || [])
                    .map(item => {

                        const homeTeam =
                            item.home_team || {};

                        const awayTeam =
                            item.away_team || {};

                        const league =
                            item.league || {};

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
                                "upcoming",

                            league: {

                                id:
                                    league.id ||
                                    item.league_id ||
                                    null,

                                name:
                                    league.name ||
                                    "Unknown League",

                                country:
                                    league.country ||
                                    null,

                                logo:
                                    league.id
                                        ? `${BZZOIRO_URL.replace(
                                            "/api/v2",
                                            ""
                                          )}/img/league/${league.id}/`
                                        : null

                            },

                            home: {

                                id:
                                    homeTeam.id ||
                                    item.home_team_id ||
                                    null,

                                name:
                                    homeTeam.name ||
                                    "Home Team",

                                logo:
                                    homeTeam.id
                                        ? `${BZZOIRO_URL.replace(
                                            "/api/v2",
                                            ""
                                          )}/img/team/${homeTeam.id}/`
                                        : null

                            },

                            away: {

                                id:
                                    awayTeam.id ||
                                    item.away_team_id ||
                                    null,

                                name:
                                    awayTeam.name ||
                                    "Away Team",

                                logo:
                                    awayTeam.id
                                        ? `${BZZOIRO_URL.replace(
                                            "/api/v2",
                                            ""
                                          )}/img/team/${awayTeam.id}/`
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

                    });

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


/*
========================================
BZZOIRO CONNECTION TEST
========================================
*/

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


/*
========================================
HEALTH CHECK
========================================
*/

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


/*
========================================
FRONTEND
========================================
*/

app.get("*", (req, res) => {

    res.sendFile(
        path.join(
            __dirname,
            "public",
            "index.html"
        )
    );

});


/*
========================================
START SERVER
========================================
*/

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
