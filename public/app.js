let allFixtures = [];

const fixturesSection =
    document.getElementById("fixtures");

const loadingSection =
    document.getElementById("loading");

const emptySection =
    document.getElementById("empty");

const errorSection =
    document.getElementById("error");

const analysisSection =
    document.getElementById("analysis");

const leagueFilter =
    document.getElementById("leagueFilter");


/*
===========================================================
SPORTYBET DAILY PICKS
===========================================================
*/

let dailyPicksLoaded = false;


/*
===========================================================
LOAD FIXTURES
===========================================================
*/

async function loadFixtures() {

    try {

        loadingSection.style.display =
            "block";

        fixturesSection.innerHTML =
            "";

        emptySection.style.display =
            "none";

        errorSection.style.display =
            "none";


        const response =
            await fetch(
                "/api/fixtures"
            );


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


        /*
        ----------------------------------------------------
        Load SportyBet picks after fixtures
        ----------------------------------------------------
        */

        loadDailyPicks();


    } catch (error) {

        console.error(error);


        loadingSection.style.display =
            "none";


        errorSection.style.display =
            "block";


        errorSection.innerHTML = `
            <div class="error-box">

                <h3>
                    Unable to load matches
                </h3>

                <p>
                    ${escapeHTML(
                        error.message
                    )}
                </p>

                <button
                    onclick="loadFixtures()"
                >
                    Try Again
                </button>

            </div>
        `;
    }
}


/*
===========================================================
LOAD DAILY SPORTYBET PICKS
===========================================================
*/

async function loadDailyPicks() {

    const container =
        document.getElementById(
            "dailyPicks"
        );


    /*
    -------------------------------------------------------
    If the HTML section does not exist,
    do nothing.
    -------------------------------------------------------
    */

    if (!container) {

        return;
    }


    container.innerHTML = `
        <div class="daily-picks-loading">

            <h3>
                🔄 Building Today's Picks
            </h3>

            <p>
                Analyzing today's fixtures,
                markets and available odds...
            </p>

        </div>
    `;


    try {

        const response =
            await fetch(
                "/api/daily-picks"
            );


        const data =
            await response.json();


        if (!data.success) {

            throw new Error(
                data.message ||
                "Unable to generate daily picks."
            );
        }


        dailyPicksLoaded =
            true;


        renderDailyPicks(
            data
        );


    } catch (error) {

        console.error(
            "Daily picks error:",
            error
        );


        container.innerHTML = `
            <div class="daily-picks-error">

                <h3>
                    ⚠️ Daily Picks Unavailable
                </h3>

                <p>
                    ${escapeHTML(
                        error.message
                    )}
                </p>

                <button
                    onclick="loadDailyPicks()"
                >
                    Try Again
                </button>

            </div>
        `;
    }
}


/*
===========================================================
RENDER DAILY PICKS
===========================================================
*/

function renderDailyPicks(
    data
) {

    const container =
        document.getElementById(
            "dailyPicks"
        );


    if (!container) {

        return;
    }


    const safeSlip =
        data.slips?.safe || null;


    const balancedSlip =
        data.slips?.balanced || null;


    container.innerHTML = `

        <div class="daily-picks-header">

            <div>

                <span class="daily-picks-label">
                    ⚽ SPORTYBET
                </span>

                <h2>
                    🔥 Today's Daily Picks
                </h2>

                <p>
                    Statistical selections for
                    ${escapeHTML(
                        data.date || "today"
                    )}
                </p>

            </div>

        </div>


        <div class="daily-picks-disclaimer">

            <span>
                ℹ️
            </span>

            <p>
                These are statistical selections,
                not guaranteed wins. Always check
                the final odds before placing a bet.
            </p>

        </div>


        <div class="daily-slip-grid">

            ${renderSlipCard(
                safeSlip,
                "safe"
            )}

            ${renderSlipCard(
                balancedSlip,
                "balanced"
            )}

        </div>

    `;
}


/*
===========================================================
RENDER SINGLE SLIP
===========================================================
*/

function renderSlipCard(
    slip,
    type
) {

    if (!slip) {

        return `
            <div class="daily-slip-card">

                <div class="slip-empty">

                    <h3>
                        No ${type === "safe"
                            ? "Safe"
                            : "Balanced"}
                        Slip Available
                    </h3>

                    <p>
                        There are not enough
                        suitable selections today.
                    </p>

                </div>

            </div>
        `;
    }


    const isSafe =
        type === "safe";


    const title =
        isSafe
            ? "🟢 Safe Slip"
            : "🔵 Balanced Slip";


    const target =
        isSafe
            ? "5.00 – 7.00 Odds"
            : "8.00 – 10.00 Odds";


    return `
        <div class="daily-slip-card">

            <div class="slip-header">

                <div>

                    <span class="slip-type">
                        ${title}
                    </span>

                    <h3>
                        SportyBet Daily Pick
                    </h3>

                </div>

                <div class="slip-target">
                    ${target}
                </div>

            </div>


            <div class="slip-summary">

                <div>
                    <span>
                        Selections
                    </span>

                    <strong>
                        ${slip.selections?.length || 0}
                    </strong>
                </div>


                <div>
                    <span>
                        Total Odds
                    </span>

                    <strong>
                        ${escapeHTML(
                            slip.totalOdds ||
                            "N/A"
                        )}
                    </strong>
                </div>

            </div>


            <div class="slip-selections">

                ${
                    (slip.selections || [])
                        .map(
                            (
                                selection,
                                index
                            ) =>
                                renderSelection(
                                    selection,
                                    index
                                )
                        )
                        .join("")
                }

            </div>


            <div class="slip-actions">

                <button
                    class="copy-slip-btn"
                    onclick='copySlip(${JSON.stringify(
                        slip
                    )})'
                >
                    📋 Copy Bet Slip
                </button>

            </div>


            <div class="slip-note">

                SportyBet booking code:
                <strong>
                    Generate from the final
                    SportyBet slip.
                </strong>

            </div>

        </div>
    `;
}


/*
===========================================================
RENDER SELECTION
===========================================================
*/

function renderSelection(
    selection,
    index
) {

    return `
        <div class="slip-selection">

            <div class="selection-number">
                ${index + 1}
            </div>


            <div class="selection-info">

                <strong>
                    ${escapeHTML(
                        selection.home ||
                        "Home"
                    )}

                    vs

                    ${escapeHTML(
                        selection.away ||
                        "Away"
                    )}
                </strong>


                <span>
                    ${escapeHTML(
                        selection.market ||
                        "Market"
                    )}
                </span>


                ${
                    selection.league
                        ? `
                            <small>
                                ${escapeHTML(
                                    selection.league
                                )}
                            </small>
                          `
                        : ""
                }

            </div>


            <div class="selection-odds">

                ${escapeHTML(
                    selection.odds ||
                    "N/A"
                )}

            </div>

        </div>
    `;
}


/*
===========================================================
COPY BET SLIP
===========================================================
*/

async function copySlip(
    slip
) {

    if (!slip) {

        return;
    }


    const selections =
        slip.selections || [];


    let text =
        "SPORTYBET DAILY PICK\n\n";


    selections.forEach(
        (
            selection,
            index
        ) => {

            text +=
                `${index + 1}. `;

            text +=
                `${selection.home} vs `;

            text +=
                `${selection.away}\n`;

            text +=
                `${selection.market}`;

            text +=
                ` @ ${selection.odds}\n\n`;
        }
    );


    text +=
        `TOTAL ODDS: ${slip.totalOdds}\n`;


    try {

        await navigator.clipboard.writeText(
            text
        );


        showCopyMessage(
            "Bet slip copied successfully."
        );


    } catch (error) {

        console.error(
            error
        );


        showCopyMessage(
            "Unable to copy automatically."
        );
    }
}


/*
===========================================================
COPY MESSAGE
===========================================================
*/

function showCopyMessage(
    message
) {

    const existing =
        document.querySelector(
            ".copy-message"
        );


    if (existing) {

        existing.remove();
    }


    const element =
        document.createElement(
            "div"
        );


    element.className =
        "copy-message";


    element.textContent =
        message;


    document.body.appendChild(
        element
    );


    setTimeout(
        () => {

            element.remove();

        },
        2500
    );
}


/*
===========================================================
LEAGUE FILTER
===========================================================
*/

function setupLeagueFilter(
    fixtures
) {

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
                !leagues.includes(
                    name
                )
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


/*
===========================================================
FILTER CHANGE
===========================================================
*/

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


/*
===========================================================
DISPLAY FIXTURES
===========================================================
*/

function displayFixtures(
    fixtures
) {

    fixturesSection.innerHTML =
        "";


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
                    status === "penalty" ||
                    status === "live"
                );
            }
        );


    if (
        availableFixtures.length ===
        0
    ) {

        emptySection.style.display =
            "block";


        emptySection.innerHTML = `
            <div class="empty-box">

                <h3>
                    No available matches
                </h3>

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
                status !==
                    "notstarted" &&
                status !==
                    "upcoming";


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
                   
