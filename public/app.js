let allFixtures = [];

const fixturesSection = document.getElementById("fixtures");
const loadingSection = document.getElementById("loading");
const emptySection = document.getElementById("empty");
const errorSection = document.getElementById("error");
const analysisSection = document.getElementById("analysis");
const leagueFilter = document.getElementById("leagueFilter");


async function loadFixtures() {

    try {

        loadingSection.style.display = "block";
        fixturesSection.innerHTML = "";
        emptySection.style.display = "none";
        errorSection.style.display = "none";

        const response =
            await fetch("/api/fixtures");

        const data =
            await response.json();

        if (!data.success) {

            throw new Error(
                data.message ||
                "Unable to load fixtures."
            );
        }

        allFixtures =
            data.fixtures || [];

        loadingSection.style.display =
            "none";

        setupLeagueFilter(
            allFixtures
        );

        displayFixtures(
            allFixtures
        );

    } catch (error) {

        console.error(error);

        loadingSection.style.display =
            "none";

        errorSection.style.display =
            "block";

        errorSection.innerHTML = `
            <div class="error-box">
                <h3>Unable to load matches</h3>
                <p>${escapeHTML(error.message)}</p>
                <button onclick="loadFixtures()">
                    Try Again
                </button>
            </div>
        `;
    }
}


/* =========================
   LEAGUE FILTER
========================= */

function setupLeagueFilter(fixtures) {

    if (!leagueFilter) {
        return;
    }

    const leagues = [];

    fixtures.forEach(
        fixture => {

            const name =
                fixture.league?.name;

            if (
                name &&
                !leagues.includes(name)
            ) {
                leagues.push(name);
            }
        }
    );

    leagues.sort();

    leagueFilter.innerHTML = `
        <option value="all">
            All Leagues
        </option>
    `;

    leagues.forEach(
        league => {

            const option =
                document.createElement(
                    "option"
                );

            option.value =
                league;

            option.textContent =
                league;

            leagueFilter.appendChild(
                option
            );
        }
    );
}


/* =========================
   FILTER CHANGE
========================= */

if (leagueFilter) {

    leagueFilter.addEventListener(
        "change",
        () => {

            const selected =
                leagueFilter.value;

            if (
                selected === "all"
            ) {

                displayFixtures(
                    allFixtures
                );

                return;
            }

            const filtered =
                allFixtures.filter(
                    fixture =>
                        fixture.league?.name ===
                        selected
                );

            displayFixtures(
                filtered
            );
        }
    );
}


/* =========================
   DISPLAY FIXTURES
========================= */

function displayFixtures(fixtures) {

    fixturesSection.innerHTML = "";

    /*
     * Only show matches that are
     * upcoming or currently live.
     */

    const availableFixtures =
        fixtures.filter(
            fixture => {

                const status =
                    String(
                        fixture.status ||
                        ""
                    ).toLowerCase();

                return (
                    status === "notstarted" ||
                    status === "upcoming" ||
                    status === "1st_half" ||
                    status === "2nd_half" ||
                    status === "halftime" ||
                    status === "extra_time" ||
                    status === "penalty"
                );
            }
        );


    if (
        availableFixtures.length === 0
    ) {

        emptySection.style.display =
            "block";

        emptySection.innerHTML = `
            <div class="empty-box">
                <h3>No available matches</h3>
                <p>
                    There are no upcoming or
                    live matches available.
                </p>
            </div>
        `;

        return;
    }


    emptySection.style.display =
        "none";


    availableFixtures.forEach(
        fixture => {

            const card =
                document.createElement(
                    "div"
                );

            card.className =
                "fixture-card";


            const status =
                String(
                    fixture.status ||
                    "notstarted"
                ).toLowerCase();


            const isLive =
                status !== "notstarted" &&
                status !== "upcoming";


            const time =
                formatMatchTime(
                    fixture.date
                );


            const statusHTML =
                isLive
                    ? `<span class="live-badge">
                        🔴 LIVE
                       </span>`
                    : `<span class="upcoming-badge">
                        🟢 UPCOMING
                       </span>`;


            card.innerHTML = `

                <div class="fixture-league">

                    ${
                        fixture.league?.logo
                            ? `
                                <img
                                    src="${escapeHTML(
                                        fixture.league.logo
                                    )}"
                                    alt=""
                                    class="league-logo"
                                    onerror="this.style.display='none'"
                                >
                              `
                            : ""
                    }

                    <span>
                        ${escapeHTML(
                            fixture.league?.name ||
                            "Unknown League"
                        )}
                    </span>

                    <span class="country">
                        ${
                            fixture.league?.country
                                ? escapeHTML(
                                    fixture.league.country
                                  )
                                : ""
                        }
                    </span>

                </div>


                <div class="fixture-status">
                    ${statusHTML}
                </div>


                <div class="fixture-teams">

                    <div class="team">

                        ${
                            fixture.home?.logo
                                ? `
                                    <img
                                        src="${escapeHTML(
                                            fixture.home.logo
                                        )}"
                                        alt=""
                                        class="team-logo"
                                        onerror="this.style.display='none'"
                                    >
                                  `
                                : ""
                        }

                        <span>
                            ${escapeHTML(
                                fixture.home?.name ||
                                "Home Team"
                            )}
                        </span>

                    </div>


                    <div class="match-info">

                        <span class="match-time">
                            ${time}
                        </span>

                        <span class="vs">
                            VS
                        </span>

                    </div>


                    <div class="team">

                        ${
                            fixture.away?.logo
                                ? `
                                    <img
                                        src="${escapeHTML(
                                            fixture.away.logo
                                        )}"
                                        alt=""
                                        class="team-logo"
                                        onerror="this.style.display='none'"
                                    >
                                  `
                                : ""
                        }

                        <span>
                            ${escapeHTML(
                                fixture.away?.name ||
                                "Away Team"
                            )}
                        </span>

                    </div>

                </div>


                ${
                    isLive
                        ? `
                            <div class="live-score">
                                Current Score:
                                <strong>
                                    ${fixture.score?.home ?? 0}
                                    -
                                    ${fixture.score?.away ?? 0}
                                </strong>
                            </div>
                          `
                        : `
                            <button
                                class="analyze-btn"
                                onclick="analyzeMatch(${fixture.id})"
                            >
                                🔍 Analyze Match
                            </button>
                          `
                }

            `;

            fixturesSection.appendChild(
                card
            );
        }
    );
}


/* =========================
   MATCH TIME
========================= */

function formatMatchTime(dateString) {

    if (!dateString) {
        return "Time unavailable";
    }

    const date =
        new Date(dateString);

    return new Intl.DateTimeFormat(
        "en-NG",
        {
            timeZone:
                "Africa/Lagos",

            hour:
                "2-digit",

            minute:
                "2-digit",

            hour12:
                true
        }
    ).format(date);
}


/* =========================
   ANALYZE MATCH
========================= */

async function analyzeMatch(
    fixtureId
) {

    try {

        analysisSection.style.display =
            "block";

        analysisSection.innerHTML = `
            <div class="analysis-loading">
                <h3>Analyzing Match...</h3>
                <p>
                    Collecting team data and
                    calculating prediction.
                </p>
            </div>
        `;

        const response =
            await fetch(
                `/api/fixture/${fixtureId}`
            );

        const data =
            await response.json();

        if (!data.success) {

            throw new Error(
                data.message ||
                "Analysis failed."
            );
        }

        renderAnalysis(
            data
        );

        analysisSection.scrollIntoView({
            behavior: "smooth"
        });

    } catch (error) {

        console.error(error);

        analysisSection.innerHTML = `
            <div class="error-box">

                <h3>
                    Analysis failed
                </h3>

                <p>
                    ${escapeHTML(
                        error.message
                    )}
                </p>

                <button
                    onclick="closeAnalysis()"
                >
                    Go Back
                </button>

            </div>
        `;
    }
}


/* =========================
   RENDER ANALYSIS
========================= */

function renderAnalysis(data) {

    const model =
        data.model || {};

    const match =
        data.match || {};

    const topScores =
        model.topCorrectScores || [];


    analysisSection.innerHTML = `

        <button
            class="back-btn"
            onclick="closeAnalysis()"
        >
            ← Back to Matches
        </button>


        <div class="analysis-header">

            <h2>
                ${escapeHTML(
                    match.home ||
                    "Home"
                )}

                vs

                ${escapeHTML(
                    match.away ||
                    "Away"
                )}
            </h2>

            <p>
                ${escapeHTML(
                    match.league ||
                    ""
                )}
            </p>

        </div>


        <div class="prediction-main">

            <span>
                Predicted Correct Score
            </span>

            <strong>
                ${escapeHTML(
                    model.prediction ||
                    "N/A"
                )}
            </strong>

            <small>
                Model confidence:
                ${escapeHTML(
                    model.confidence ||
                    "N/A"
                )}
            </small>

        </div>


        <div class="analysis-grid">

            <div class="stat-card">

                <span>
                    Expected Goals
                </span>

                <strong>
                    ${
                        model.expectedGoals?.home ??
                        "-"
                    }
                    -
                    ${
                        model.expectedGoals?.away ??
                        "-"
                    }
                </strong>

            </div>


            <div class="stat-card">

                <span>
                    Predicted Winner
                </span>

                <strong>
                    ${escapeHTML(
                        model.predictedWinner ||
                        "N/A"
                    )}
                </strong>

            </div>

        </div>


        <div class="probability-box">

            <h3>
                Result Probabilities
            </h3>

            <div>
                Home:
                ${
                    model.resultProbabilities?.homeWin ||
                    "N/A"
                }
            </div>

            <div>
                Draw:
                ${
                    model.resultProbabilities?.draw ||
                    "N/A"
                }
            </div>

            <div>
                Away:
                ${
                    model.resultProbabilities?.awayWin ||
                    "N/A"
                }
            </div>

        </div>


        <div class="scores-box">

            <h3>
                Top Correct Scores
            </h3>

            ${
                topScores.length
                    ? topScores.map(
                        score => `
                            <div class="score-row">

                                <span>
                                    ${escapeHTML(
                                        score.score
                                    )}
                                </span>

                                <strong>
                                    ${escapeHTML(
                                        score.probability
                                    )}
                                </strong>

                            </div>
                        `
                      ).join("")
                    : `
                        <p>
                            No score predictions
                            available.
                        </p>
                      `
            }

        </div>

    `;
}


/* =========================
   CLOSE ANALYSIS
========================= */

function closeAnalysis() {

    analysisSection.style.display =
        "none";

    window.scrollTo({
        top: 0,
        behavior: "smooth"
    });
}


/* =========================
   REFRESH
========================= */

function refreshFixtures() {

    loadFixtures();
}


/* =========================
   SECURITY
========================= */

function escapeHTML(value) {

    return String(
        value ?? ""
    )
    .replace(
        /&/g,
        "&amp;"
    )
    .replace(
        /</g,
        "&lt;"
    )
    .replace(
        />/g,
        "&gt;"
    )
    .replace(
        /"/g,
        "&quot;"
    )
    .replace(
        /'/g,
        "&#039;"
    );
}


/* =========================
   START APP
========================= */

loadFixtures();
