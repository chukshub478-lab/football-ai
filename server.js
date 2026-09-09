                "Bzzoiro test error:",
                error
            );

            res.status(500).json({

                success: false,

                provider: "Bzzoiro Sports Data",

                message: error.message

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

            success: true,

            message: "Football AI backend is running",

            bzzoiroConfigured:
                Boolean(BZZOIRO_API_KEY)

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
