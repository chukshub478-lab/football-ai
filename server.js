require("dotenv").config();

const express = require("express");
const cors = require("cors");
const path = require("path");

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

const PORT = Number(process.env.PORT) || 10000;
const KEY = process.env.BZZOIRO_API_KEY;

const API = "https://sports.bzzoiro.com/api/v2";
const IMG = "https://sports.bzzoiro.com/img";

const cache = new Map();
const CACHE_TIME = 10 * 60 * 1000;

async function api(endpoint) {
    if (!KEY) {
        throw new Error("BZZOIRO_API_KEY is missing.");
    }
    const cached = cache.get(endpoint);
    if (cached && Date.now() - cached.time < CACHE_TIME) {
        return cached.data;
    }
    const response = await fetch(API + endpoint, {
        headers: {
            Authorization: `Token ${KEY}`,
            Accept: "application/json"
        }
    });
    let data;
    try {
        data = await response.json();
    } catch {
        throw new Error(`Invalid Bzzoiro response. HTTP ${response.status}`);
    }
    if (!response.ok) {
        throw new Error(`Bzzoiro API ${response.status}: ${JSON.stringify(data)}`);
    }
    cache.set(endpoint, { time: Date.now(), data });
    return data;
}

async function safe(endpoint) {
    try {
        return await api(endpoint);
    } catch (error) {
        console.error(endpoint, error.message);
        return null;
    }
}

function num(value) {
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
}

function probability(value) {
    const number = num(value);
    if (number === null) return null;
    if (number > 1 && number <= 100) return number / 100;
    if (number >= 0 && number <= 1) return number;
    return null;
}

function findValue(object, keys, depth = 0) {
    if (!object || typeof object !== "object" || depth > 6) return null;
    for (const key of keys) {
        if (Object.prototype.hasOwnProperty.call(object, key)) {
            const value = probability(object[key]);
            if (value !== null) return value;
        }
    }
    for (const value of Object.values(object)) {
        if (value && typeof value === "object") {
            const found = findValue(value, keys, depth + 1);
            if (found !== null) return found;
        }
    }
    return null;
}

function nigeriaDate() {
    return new Intl.DateTimeFormat("en-CA", {
        timeZone: "Africa/Lagos",
        year: "numeric",
        month: "2-digit",
        day: "2-digit"
    }).format(new Date());
}

function localDate(value) {
    if (!value) return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    return new Intl.DateTimeFormat("en-CA", {
        timeZone: "Africa/Lagos",
        year: "numeric",
        month: "2-digit",
        day: "2-digit"
    }).format(date);
}

async function getEvent(id) {
    return safe(`/events/${id}/`);
}

async function getTeam(id) {
    if (!id) return null;
    return safe(`/teams/${id}/`);
}

async function getLeague(id) {
    if (!id) return null;
    return safe(`/leagues/${id}/`);
}

// ASSUMPTION: paths guessed to match Bzzoiro's /events/:id/ pattern.
// Tell me if your plan uses different endpoint names for these.
async function getPrediction(id) {
    return safe(`/events/${id}/prediction/`);
}

async function getOdds(id) {
    return safe(`/events/${id}/odds/`);
}

async function getStats(id) {
    return safe(`/events/${id}/statistics/`);
}

function poisson(lambda, goals) {
    let factorial = 1;
    for (let i = 2; i <= goals; i++) {
        factorial *= i;
    }
    return (Math.exp(-lambda) * Math.pow(lambda, goals)) / factorial;
}

function makeScores(homeXG, awayXG) {
    const scores = [];
    for (let home = 0; home <= 7; home++) {
        for (let away = 0; away <= 7; away++) {
            scores.push({
                home,
                away,
                probability: poisson(homeXG, home) * poisson(awayXG, away)
            });
        }
    }
    return scores.sort((a, b) => b.probability - a.probability);
}

function getResultProbabilities(scores) {
    let home = 0;
    let draw = 0;
    let away = 0;
    for (const score of scores) {
        if (score.home > score.away) {
            home += score.probability;
        } else if (score.home === score.away) {
            draw += score.probability;
        } else {
            away += score.probability;
        }
    }
    const total = home + draw + away;
    if (!total) {
        return { home: 0.33, draw: 0.34, away: 0.33 };
    }
    return { home: home / total, draw: draw / total, away: away / total };
}

function pct(value) {
    return (value * 100).toFixed(1) + "%";
}

function buildModel(prediction, odds, stats) {
    let home = findValue(prediction, [
        "home_win_probability", "home_win_prob", "home_probability", "probability_home", "home_win"
    ]);
    let draw = findValue(prediction, [
        "draw_probability", "draw_prob", "probability_draw", "draw"
    ]);
    let away = findValue(prediction, [
        "away_win_probability", "away_win_prob", "away_probability", "probability_away", "away_win"
    ]);

    if (home === null || draw === null || away === null) {
        const homeOdds = num(odds?.home_win);
        const drawOdds = num(odds?.draw);
        const awayOdds = num(odds?.away_win);
        if (homeOdds > 0 && drawOdds > 0 && awayOdds > 0) {
            const homeImplied = 1 / homeOdds;
            const drawImplied = 1 / drawOdds;
            const awayImplied = 1 / awayOdds;
            const total = homeImplied + drawImplied + awayImplied;
            home = homeImplied / total;
            draw = drawImplied / total;
            away = awayImplied / total;
        }
    }

    if (home === null) home = 0.45;
    if (draw === null) draw = 0.28;
    if (away === null) away = 0.27;

    const probabilityTotal = home + draw + away;
    home /= probabilityTotal;
    draw /= probabilityTotal;
    away /= probabilityTotal;

    let homeXG = findValue(stats, [
        "home_xg", "home_expected_goals", "expected_goals_home", "xg_home"
    ]);
    let awayXG = findValue(stats, [
        "away_xg", "away_expected_goals", "expected_goals_away", "xg_away"
    ]);

    if (homeXG === null || awayXG === null) {
        homeXG = 1.15 + (home - away) * 2;
        const totalGoals = 2.35 - (draw - 0.27) * 1.2;
        awayXG = totalGoals - homeXG;
        homeXG = Math.max(0.25, Math.min(4.2, homeXG));
        awayXG = Math.max(0.15, Math.min(3.8, awayXG));
    }

    const scores = makeScores(homeXG, awayXG);
    const results = getResultProbabilities(scores);

    const topScores = scores.slice(0, 5).map(score => ({
        score: `${score.home}-${score.away}`,
        probability: pct(score.probability)
    }));

    let winner = "Draw";
    if (results.home > results.draw && results.home > results.away) {
        winner = "Home Team";
    } else if (results.away > results.draw && results.away > results.home) {
        winner = "Away Team";
    }

    return {
        prediction: topScores[0]?.score || "N/A",
        confidence: pct(Math.max(results.home, results.draw, results.away)),
        expectedGoals: {
            home: Number(homeXG.toFixed(2)),
            away: Number(awayXG.toFixed(2))
        },
        predictedWinner: winner,
        resultProbabilities: {
            homeWin: pct(results.home),
            draw: pct(results.draw),
            awayWin: pct(results.away)
        },
        topCorrectScores: topScores
    };
}

app.get("/api/fixtures", async (req, res) => {
    try {
        const date = req.query.date || nigeriaDate();
        const start = new Date(`${date}T00:00:00+01:00`);
        const end = new Date(start.getTime() + 86400000);
        const from = start.toISOString().slice(0, 10);
        const to = end.toISOString().slice(0, 10);

        const data = await api(`/events/?date_from=${from}&date_to=${to}&limit=200`);
        const raw = data.results || [];

        const fixtures = await Promise.all(
            raw.map(async item => {
                let home = typeof item.home_team === "object" ? item.home_team : null;
                let away = typeof item.away_team === "object" ? item.away_team : null;
                let league = typeof item.league === "object" ? item.league : null;

                if (!home?.name || !away?.name || !league?.name) {
                    const details = await getEvent(item.id);
                    home = details?.home_team || home;
                    away = details?.away_team || away;
                    league = details?.league || league;
                }

                if (!home?.name) {
                    home = await getTeam(item.home_team_id) || home;
                }
                if (!away?.name) {
                    away = await getTeam(item.away_team_id) || away;
                }
                if (!league?.name) {
                    league = await getLeague(item.league_id) || league;
                }

                const dateValue = item.event_date || item.start_time || item.date || null;
                const homeId = home?.id || item.home_team_id || null;
                const awayId = away?.id || item.away_team_id || null;
                const leagueId = league?.id || item.league_id || null;

                return {
                    id: item.id,
                    date: dateValue,
                    nigeriaDate: localDate(dateValue),
                    status: item.status || "notstarted",
                    league: {
                        id: leagueId,
                        name: league?.name || "Unknown League",
                        country: league?.country || league?.country_name || null,
                        logo: leagueId ? `${IMG}/league/${leagueId}/` : null
                    },
                    home: {
                        id: homeId,
                        name: home?.name || "Home Team",
                        logo: homeId ? `${IMG}/team/${homeId}/` : null
                    },
                    away: {
                        id: awayId,
                        name: away?.name || "Away Team",
                        logo: awayId ? `${IMG}/team/${awayId}/` : null
                    },
                    score: {
                        home: item.home_score ?? null,
                        away: item.away_score ?? null
                    }
                };
            })
        );

        const filtered = fixtures
            .filter(item => item.nigeriaDate === date)
            .sort((a, b) => new Date(a.date) - new Date(b.date));

        res.json({
            date,
            count: filtered.length,
            fixtures: filtered
        });

    } catch (error) {
        console.error("/api/fixtures", error.message);
        res.status(500).json({
            error: "Failed to load fixtures.",
            detail: error.message
        });
    }
});

// ASSUMPTION: this route calls buildModel(). Adjust getPrediction/getOdds/getStats
// paths above if your Bzzoiro plan uses different URLs.
app.get("/api/predict/:id", async (req, res) => {
    try {
        const { id } = req.params;
        const [event, prediction, odds, stats] = await Promise.all([
            getEvent(id),
            getPrediction(id),
            getOdds(id),
            getStats(id)
        ]);

        if (!event) {
            return res.status(404).json({ error: "Event not found." });
        }

        const model = buildModel(prediction, odds, stats);

        res.json({
            event: {
                id: event.id,
                home: event.home_team?.name || null,
                away: event.away_team?.name || null,
                date: event.event_date || event.start_time || null
            },
            ...model
        });

    } catch (error) {
        console.error("/api/predict/:id", error.message);
        res.status(500).json({
            error: "Failed to build prediction.",
            detail: error.message
        });
    }
});

app.get("/api/bzzoiro-test", async (req, res) => {
    try {
        const data = await api("/events/?limit=1");
        res.json({ ok: true, sample: data });
    } catch (error) {
        res.status(500).json({ ok: false, error: error.message });
    }
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
