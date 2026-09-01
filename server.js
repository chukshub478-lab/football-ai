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

async function footballAPI(endpoint) {
    const cached = cache.get(endpoint);

    if (cached && Date.now() - cached.time < 10 * 60 * 1000) {
        return cached.data;
    }

    const response = await fetch(`${API_URL}${endpoint}`, {
        headers: {
            "x-apisports-key": API_KEY
        }
    });

    if (!response.ok) {
        throw new Error(`Football API error: ${response.status}`);
    }

    const data = await response.json();

    cache.set(endpoint, {
        time: Date.now(),
        data
    });

    return data;
}

function poisson(lambda, k) {
    return (
        Math.exp(-lambda) *
        Math.pow(lambda, k) /
        factorial(k)
    );
}

function factorial(n) {
    if (n <= 1) return 1;

    let result = 1;

    for (let i = 2; i <= n; i++) {
        result *= i;
    }

    return result;
}

function generateScoreMatrix(homeGoals, awayGoals) {
    const scores = [];

    for (let home = 0; home <= 6; home++) {
        for (let away = 0; away <= 6; away++) {

            const probability =
                poisson(homeGoals, home) *
                poisson(awayGoals, away);

            scores.push({
                home,
                away,
                probability
            });
        }
    }

    scores.sort((a, b) => b.probability - a.probability);

    return scores;
}

function percentage(value) {
    return `${(value * 100).toFixed(1)}%`;
}

app.get("/api/health", (req, res) => {
    res.json({
        success: true,
        message: "Football AI backend is running"
    });
});

app.get("/api/fixture/:id", async (req, res) => {

    try {

        const fixtureId = req.params.id;

        const fixtureData = await footballAPI(
            `/fixtures?id=${fixtureId}`
        );

        if (!fixtureData.response?.length) {
            return res.status(404).json({
                success: false,
                message: "Fixture not found"
            });
        }

        const fixture = fixtureData.response[0];

        const homeTeam = fixture.teams.home;
        const awayTeam = fixture.teams.away;

        const predictionData = await footballAPI(
            `/predictions?fixture=${fixtureId}`
        );

        const apiPrediction =
            predictionData.response?.[0] || null;

        let homeExpectedGoals = 1.35;
        let awayExpectedGoals = 1.05;

        if (apiPrediction?.predictions?.goals) {

            const home =
                parseFloat(apiPrediction.predictions.goals.home);

            const away =
                parseFloat(apiPrediction.predictions.goals.away);

            if (!isNaN(home)) {
                homeExpectedGoals = home;
            }

            if (!isNaN(away)) {
                awayExpectedGoals = away;
            }
        }

        const scoreMatrix =
            generateScoreMatrix(
                homeExpectedGoals,
                awayExpectedGoals
            );

        const topScores = scoreMatrix
            .slice(0, 5)
            .map(score => ({
                score: `${score.home}-${score.away}`,
                probability: percentage(score.probability)
            }));

        let homeWin = 0;
        let draw = 0;
        let awayWin = 0;

        scoreMatrix.forEach(score => {

            if (score.home > score.away) {
                homeWin += score.probability;
            }

            if (score.home === score.away) {
                draw += score.probability;
            }

            if (score.home < score.away) {
                awayWin += score.probability;
            }

        });

        const bestScore = scoreMatrix[0];

        let winner = "Draw";

        if (homeWin > draw && homeWin > awayWin) {
            winner = homeTeam.name;
        }

        if (awayWin > homeWin && awayWin > draw) {
            winner = awayTeam.name;
        }

        const confidence =
            Math.max(homeWin, draw, awayWin);

        res.json({

            success: true,

            match: {
                id: fixture.fixture.id,
                date: fixture.fixture.date,
                home: homeTeam.name,
                away: awayTeam.name
            },

            model: {

                prediction:
                    `${bestScore.home}-${bestScore.away}`,

                predictedWinner:
                    winner,

                confidence:
                    percentage(confidence),

                expectedGoals: {
                    home: homeExpectedGoals,
                    away: awayExpectedGoals
                },

                resultProbabilities: {
                    homeWin: percentage(homeWin),
                    draw: percentage(draw),
                    awayWin: percentage(awayWin)
                },

                topCorrectScores:
                    topScores
            },

            apiPrediction:
                apiPrediction?.predictions || null
        });

    } catch (error) {

        console.error(error);

        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

app.get("*", (req, res) => {
    res.sendFile(
        path.join(__dirname, "public", "index.html")
    );
});

app.listen(PORT, "0.0.0.0", () => {

    console.log(
        `Football AI running on port ${PORT}`
    );

});