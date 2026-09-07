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
BZZOIRO TEST
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

                success: true,

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

                success: false,

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

            success: true,

            message:
                "Football AI backend is running",

            bzzoiroConfigured:
                Boolean(BZZOIRO_API_KEY)

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
