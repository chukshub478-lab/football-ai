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
   EVENT DATA HELPERS
========================= */

/*
 * These endpoints are requested separately.
 *
 * If one particular endpoint is unavailable
 * for a fixture, the analysis still continues.
 */

async function getEventResource(
    eventId,
    resource
) {

    try {

        return await bzzoiroAPI(
            `/events/${eventId}/${resource}/`
        );

    } catch (error) {

        console.error(
            `Event ${eventId} ${resource} error:`,
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
                        async (item) => {

                            let eventDetail = null;

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
                                        null
                                }

                            };

                        }
                    )

                );


            const filteredFixtures =
                fixtures.filter(
                    (fixture) =>
                        fixture.nigeriaDate ===
                        nigeriaDate
                );


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
   MATCH ANALYSIS
========================= */

app.get(
    "/api/fixture/:id",
    async (req, res) => {

        try {

            const fixtureId =
                Number(
                    req.params.id
                );

            if (
                !Number.isInteger(
                    fixtureId
                )
            ) {

                return res.status(400).json({

                    success:
                        false,

                    message:
                        "Invalid fixture ID."

                });

            }


            /*
             * Main match information
             */

            const event =
                await getEvent(
                    fixtureId
                );


            if (!event) {

                return res.status(404).json({

                    success:
                        false,

                    message:
                        "Match not found."

                });

            }


            /*
             * Get additional match resources.
             *
             * Promise.all allows the requests
             * to run at the same time.
             */

            const [
                stats,
                h2h,
                odds,
                prediction,
                lineups,
                incidents,
                shotmap
            ] = await Promise.all([

                getEventResource(
                    fixtureId,
                    "stats"
                ),

                getEventResource(
                    fixtureId,
                    "h2h"
                ),

                getEventResource(
                    fixtureId,
                    "odds"
                ),

                getEventResource(
                    fixtureId,
                    "prediction"
                ),

                getEventResource(
                    fixtureId,
                    "lineups"
                ),

                getEventResource(
                    fixtureId,
                    "incidents"
                ),

                getEventResource(
                    fixtureId,
                    "shotmap"
                )

            ]);


            /*
             * Extract teams.
             */

            const homeTeam =
                event.home_team ||
                null;

            const awayTeam =
                event.away_team ||
                null;


            /*
             * Team fixture history.
             */

            let homeFixtures = null;

            let awayFixtures = null;


            if (
                homeTeam?.id
            ) {

                homeFixtures =
                    await getTeamFixtures(
                        homeTeam.id
                    );

            }


            if (
                awayTeam?.id
            ) {

                awayFixtures =
                    await getTeamFixtures(
                        awayTeam.id
                    );

            }


            /*
             * Build a clean response.
             */

            res.json({

                success:
                    true,

                provider:
                    "Bzzoiro Sports Data",

                fixture: {

                    id:
                        event.id,

                    date:
                        event.event_date ||
                        null,

                    status:
                        event.status ||
                        null,

                    league:
                        event.league ||
                        null,

                    home:
                        homeTeam,

                    away:
                        awayTeam,

                    score: {

                        home:
                            event.home_score ??
                            null,

                        away:
                            event.away_score ??
                            null

                    }

                },

                statistics:
                    stats,

                h2h:
                    h2h,

                odds:
                    odds,

                prediction:
                    prediction,

                lineups:
                    lineups,

                incidents:
                    incidents,

                shotmap:
                    shotmap,

                team_form: {

                    home:
                        homeFixtures,

                    away:
                        awayFixtures

                }

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
                    error.message

            });

        }

    }
);


/* =========================
   TEAM FIXTURES
========================= */

async function getTeamFixtures(
    teamId
) {

    if (!teamId) {
        return null;
    }

    try {

        return await bzzoiroAPI(
            `/teams/${teamId}/fixtures/`
        );

    } catch (error) {

        console.error(
            `Team fixtures ${teamId} error:`,
            error.message
        );

        return null;
    }

}


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
                "Bzzoir
