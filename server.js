require("dotenv").config();

const express = require("express");
const cors = require("cors");
const path = require("path");

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

const PORT = process.env.PORT || 10000;
const API_KEY = process.env.API_FOOTBALL_KEY;

const API_URL = "https://v3.football.api-sports.io";

const cache = new Map();

const CACHE_TIME = 10 * 60 * 1000;


/*
========================================
FOOTBALL API HELPER
========================================
*/

async function footballAPI(endpoint) {

    if (!API_KEY) {
        throw new Error("API_FOOTBALL_KEY is missing.");
    }

    const cached = cache.get(endpoint);

    if (
        cached &&
        Date.now() - cached.time < CACHE_TIME
    ) {
        return cached.data;
    }

    const response = await fetch(
        `${API_URL}${endpoint}`,
        {
            headers: {
                "x-apisports-key": API_KEY,
                "Accept": "application/json"
            }
        }
    );

    const data = await response.json();

    if (!response.ok) {
        throw new Error(
            `Football API error: ${response.status}`
        );
    }

    if (
        data.errors &&
        Object.keys(data.errors).length > 0
    ) {
        throw new Error(
            JSON.stringify(data.errors)
        );
    }

    cache.set(endpoint, {
        time: Date.now(),
        data
    });

    return data;
}


/*
========================================
GET TODAY'S FIXTURES
========================================
*/

app.get("/api/fixtures", async (req, res) => {

    try {

        let date = req.query.date;

        if (!date) {

            const formatter =
                new Intl.DateTimeFormat(
                    "en-CA",
                    {
                        timeZone: "Africa/Lagos",
                        year: "numeric",
                        month: "2-digit",
                        day: "2-digit"
                    }
                );

            date = formatter.format(
                new Date()
            );
        }

        const endpoint =
            `/fixtures?date=${date}&timezone=Africa/Lagos`;

        const data =
            await footballAPI(endpoint);

        const fixtures =
            (data.response || []).map(item => ({

                id: item.fixture.id,

                date: item.fixture.date,

                status: item.fixture.status,

                league: {
                    id: item.league.id,
                    name: item.league.name,
                    country: item.league.country,
                    logo: item.league.logo
                },

                home: {
                    id: item.teams.home.id,
                    name: item.teams.home.name,
                    logo: item.teams.home.logo
                },

                away: {
                    id: item.teams.away.id,
                    name: item.teams.away.name,
                    logo: item.teams.away.logo
                }

            }));

        res.json({

            success: true,

            date,

            count: fixtures.length,

            fixtures

        });

    } catch (error) {

        console.error(error);

        res.status(500).json({

            success: false,

            message: error.message

        });

    }

});


/*
========================================
FORM HELPERS
========================================
*/


function getResultForTeam(
    fixture,
    teamId
) {

    const homeId =
        fixture.teams.home.id;

    const awayId =
        fixture.teams.away.id;

    const homeGoals =
        fixture.goals.home;

    const awayGoals =
        fixture.goals.away;

    if (
        homeGoals === null ||
        awayGoals === null
    ) {
        return null;
    }

    if (teamId === homeId) {

        if (homeGoals > awayGoals) {
            return "W";
        }

        if (homeGoals === awayGoals) {
            return "D";
        }

        return "L";
    }

    if (teamId === awayId) {

        if (awayGoals > homeGoals) {
            return "W";
        }

        if (awayGoals === homeGoals) {
            return "D";
        }

        return "L";
    }

    return null;
}


function calculateTeamForm(
    fixtures,
    teamId
) {

    let wins = 0;
    let draws = 0;
    let losses = 0;

    let goalsFor = 0;
    let goalsAgainst = 0;

    const matches = [];

    for (const fixture of fixtures) {

        const result =
            getResultForTeam(
                fixture,
                teamId
            );

        if (!result) {
            continue;
        }

        const isHome =
            fixture.teams.home.id === teamId;

        const scored =
            isHome
                ? fixture.goals.home
                : fixture.goals.away;

        const conceded =
            isHome
                ? fixture.goals.away
                : fixture.goals.home;

        goalsFor += scored;
        goalsAgainst += conceded;

        if (result === "W") {
            wins++;
        }

        if (result === "D") {
            draws++;
        }

        if (result === "L") {
            losses++;
        }

        matches.push({

            fixtureId:
                fixture.fixture.id,

            date:
                fixture.fixture.date,

            opponent:
                isHome
                    ? fixture.teams.away.name
                    : fixture.teams.home.name,

            venue:
                isHome
                    ? "Home"
                    : "Away",

            result,

            goalsFor: scored,

            goalsAgainst: conceded

        });
    }

    const played =
        matches.length;

    const averageGoalsFor =
        played
            ? goalsFor / played
            : 0;

    const averageGoalsAgainst =
        played
            ? goalsAgainst / played
            : 0;

    return {

        played,

        wins,

        draws,

        losses,

        goalsFor,

        goalsAgainst,

        averageGoalsFor:
            Number(
                averageGoalsFor.toFixed(2)
            ),

        averageGoalsAgainst:
            Number(
                averageGoalsAgainst.toFixed(2)
            ),

        form:
            matches
                .map(match => match.result)
                .join(""),

        matches

    };

}


/*
========================================
GET TEAM RECENT MATCHES
========================================
*/

async function getRecentMatches(
    teamId,
    number = 10
) {

    const endpoint =
        `/fixtures?team=${teamId}&last=${number}`;

    const data =
        await footballAPI(endpoint);

    return (
        data.response || []
    )
        .filter(fixture => {

            return [
                "FT",
                "AET",
                "PEN"
            ].includes(
                fixture.fixture.status.short
            );

        })
        .sort(
            (a, b) =>
                new Date(b.fixture.date) -
                new Date(a.fixture.date)
        );
}


/*
========================================
GET HOME/AWAY FORM
========================================
*/

function filterVenueMatches(
    fixtures,
    teamId,
    venue
) {

    return fixtures.filter(fixture => {

        if (venue === "home") {

            return (
                fixture.teams.home.id ===
                teamId
            );

        }

        if (venue === "away") {

            return (
                fixture.teams.away.id ===
                teamId
            );

        }

        return false;

    });

}


/*
========================================
POISSON MODEL
========================================
*/

function factorial(n) {

    if (n <= 1) {
        return 1;
    }

    let result = 1;

    for (
        let i = 2;
        i <= n;
        i++
    ) {

        result *= i;

    }

    return result;

}


function poisson(
    lambda,
    k
) {

    return (
        Math.exp(-lambda) *
        Math.pow(lambda, k) /
        factorial(k)
    );

}


function generateScoreMatrix(
    homeGoals,
    awayGoals
) {

    const scores = [];

    for (
        let home = 0;
        home <= 6;
        home++
    ) {

        for (
            let away = 0;
            away <= 6;
            away++
        ) {

            const probability =
                poisson(
                    homeGoals,
                    home
                ) *
                poisson(
                    awayGoals,
                    away
                );

            scores.push({

                home,

                away,

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


function percentage(value) {

    return (
        value * 100
    ).toFixed(1) + "%";

}


/*
========================================
CALCULATE EXPECTED GOALS
========================================
*/

function calculateExpectedGoals(
    homeForm,
    awayForm,
    homeVenueForm,
    awayVenueForm
) {

    /*
    Home attacking strength
    */

    const homeAttack =
        homeVenueForm.averageGoalsFor ||
        homeForm.averageGoalsFor ||
        1.20;


    /*
    Home defensive weakness
    */

    const homeDefense =
        homeVenueForm.averageGoalsAgainst ||
        homeForm.averageGoalsAgainst ||
        1.20;


    /*
    Away attacking strength
    */

    const awayAttack =
        awayVenueForm.averageGoalsFor ||
        awayForm.averageGoalsFor ||
        1.00;


    /*
    Away defensive weakness
    */

    const awayDefense =
        awayVenueForm.averageGoalsAgainst ||
        awayForm.averageGoalsAgainst ||
        1.20;


    /*
    Base expected goals.

    We combine the team's attacking
    output with the opponent's
    defensive record.
    */

    let homeExpected =
        (
            homeAttack +
            awayDefense
        ) / 2;


    let awayExpected =
        (
            awayAttack +
            homeDefense
        ) / 2;


    /*
    Home advantage adjustment.
    */

    homeExpected *= 1.08;


    /*
    Form adjustment.

    Recent form gives a small
    influence on expected goals.
    */

    const homeFormPoints =
        (
            homeForm.wins * 3 +
            homeForm.draws
        ) /
        Math.max(
            homeForm.played * 3,
            1
        );


    const awayFormPoints =
        (
            awayForm.wins * 3 +
            awayForm.draws
        ) /
        Math.max(
            awayForm.played * 3,
            1
        );


    homeExpected *=
        0.90 +
        homeFormPoints * 0.20;


    awayExpected *=
        0.90 +
        awayFormPoints * 0.20;


    /*
    Prevent unrealistic values.
    */

    homeExpected =
        Math.max(
            0.20,
            Math.min(
                homeExpected,
                4.00
            )
        );


    awayExpected =
        Math.max(
            0.20,
            Math.min(
                awayExpected,
                4.00
            )
        );


    return {

        home:
            Number(
                homeExpected.toFixed(2)
            ),

        away:
            Number(
                awayExpected.toFixed(2)
            )

    };

}


/*
========================================
SINGLE FIXTURE ANALYSIS
========================================
*/

app.get(
    "/api/fixture/:id",
    async (req, res) => {

        try {

            const fixtureId =
                req.params.id;


            /*
            Get selected fixture.
            */

            const fixtureData =
                await footballAPI(
                    `/fixtures?id=${fixtureId}`
                );


            if (
                !fixtureData.response?.length
            ) {

                return res.status(404).json({

                    success: false,

                    message:
                        "Fixture not found."

                });

            }


            const fixture =
                fixtureData.response[0];


            const homeTeam =
                fixture.teams.home;


            const awayTeam =
                fixture.teams.away;


            /*
            ========================================
            RECENT FORM
            ========================================
            */

            const homeRecent =
                await getRecentMatches(
                    homeTeam.id,
                    10
                );


            const awayRecent =
                await getRecentMatches(
                    awayTeam.id,
                    10
                );


            const homeForm =
                calculateTeamForm(
                    homeRecent,
                    homeTeam.id
                );


            const awayForm =
                calculateTeamForm(
                    awayRecent,
                    awayTeam.id
                );


            /*
            ========================================
            HOME / AWAY FORM
            ========================================

            We retrieve 10 recent matches
            so we have enough matches to
            extract home and away records.
            */

            const homeVenueMatches =
                filterVenueMatches(
                    homeRecent,
                    homeTeam.id,
                    "home"
                );


            const awayVenueMatches =
                filterVenueMatches(
                    awayRecent,
                    awayTeam.id,
                    "away"
                );


            const homeVenueForm =
                calculateTeamForm(
                    homeVenueMatches,
                    homeTeam.id
                );


            const awayVenueForm =
                calculateTeamForm(
                    awayVenueMatches,
                    awayTeam.id
                );


            /*
            ========================================
            EXPECTED GOALS
            ========================================
            */

            const expectedGoals =
                calculateExpectedGoals(
                    homeForm,
                    awayForm,
                    homeVenueForm,
                    awayVenueForm
                );


            /*
            ========================================
            SCORE MATRIX
            ========================================
            */

            const scoreMatrix =
                generateScoreMatrix(
                    expectedGoals.home,
                    expectedGoals.away
                );


            const topScores =
                scoreMatrix
                    .slice(0, 5)
                    .map(score => ({

                        score:
                            `${score.home}-${score.away}`,

                        probability:
                            percentage(
                                score.probability
                            )

                    }));


            /*
            ========================================
            RESULT PROBABILITIES
            ========================================
            */

            let homeWin = 0;

            let draw = 0;

            let awayWin = 0;


            scoreMatrix.forEach(score => {

                if (
                    score.home >
                    score.away
                ) {

                    homeWin +=
                        score.probability;

                }


                if (
                    score.home ===
                    score.away
                ) {

                    draw +=
                        score.probability;

                }


                if (
                    score.home <
                    score.away
                ) {

                    awayWin +=
                        score.probability;

                }

            });


            const bestScore =
                scoreMatrix[0];


            let winner =
                "Draw";


            if (
                homeWin > draw &&
                homeWin > awayWin
            ) {

                winner =
                    homeTeam.name;

            }


            if (
                awayWin > homeWin &&
                awayWin > draw
            ) {

                winner =
                    awayTeam.name;

            }


            const confidence =
                Math.max(
                    homeWin,
                    draw,
                    awayWin
                );


            /*
            ========================================
            BTTS
            ========================================
            */

            let bttsYes = 0;


            scoreMatrix.forEach(score => {

                if (
                    score.home >= 1 &&
                    score.away >= 1
                ) {

                    bttsYes +=
                        score.probability;

                }

            });


            /*
            ========================================
            OVER 2.5
            ========================================
            */

            let over25 = 0;


            scoreMatrix.forEach(score => {

                if (
                    score.home +
                    score.away >= 3
                ) {

                    over25 +=
                        score.probability;

                }

            });


            /*
            ========================================
            RESPONSE
            ========================================
            */

            res.json({

                success: true,

                match: {

                    id:
                        fixture.fixture.id,

                    date:
                        fixture.fixture.date,

                    home:
                        homeTeam.name,

                    away:
                        awayTeam.name,

                    homeLogo:
                        homeTeam.logo,

                    awayLogo:
                        awayTeam.logo,

                    league:
                        fixture.league.name

                },


                form: {

                    home: {

                        team:
                            homeTeam.name,

                        recent:
                            homeForm,

                        homeVenue:
                            homeVenueForm

                    },

                    away: {

                        team:
                            awayTeam.name,

                        recent:
                            awayForm,

                        awayVenue:
                            awayVenueForm

                    }

                },


                model: {

                    prediction:
                        `${bestScore.home}-${bestScore.away}`,

                    predictedWinner:
                        winner,

                    confidence:
                        percentage(confidence),

                    expectedGoals: {

                        home:
                            expectedGoals.home,

                        away:
                            expectedGoals.away

                    },

                    resultProbabilities: {

                        homeWin:
                            percentage(homeWin),

                        draw:
                            percentage(draw),

                        awayWin:
                            percentage(awayWin)

                    },

                    markets: {

                        bttsYes:
                            percentage(bttsYes),

                   
