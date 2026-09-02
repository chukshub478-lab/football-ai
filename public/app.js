let allFixtures = [];


async function loadFixtures() {

    const fixturesContainer =
        document.getElementById(
            "fixtures"
        );

    const loading =
        document.getElementById(
            "loading"
        );

    const empty =
        document.getElementById(
            "empty"
        );

    const error =
        document.getElementById(
            "error"
        );

    const analysis =
        document.getElementById(
            "analysis"
        );


    analysis.classList.add(
        "hidden"
    );

    error.classList.add(
        "hidden"
    );

    empty.classList.add(
        "hidden"
    );

    loading.classList.remove(
        "hidden"
    );


    try {

        const response =
            await fetch(
                "/api/fixtures"
            );

        const data =
            await response.json();


        if (!data.success) {

            throw new Error(
                data.message
            );

        }


        allFixtures =
            data.fixtures;


        createLeagueFilter();

        displayFixtures(
            allFixtures
        );


        if (
            allFixtures.length === 0
        ) {

            empty.classList.remove(
                "hidden"
            );

        }

    } catch (err) {

        error.textContent =
            err.message ||
            "Unable to load fixtures.";

        error.classList.remove(
            "hidden"
        );

    } finally {

        loading.classList.add(
            "hidden"
        );

    }

}


function createLeagueFilter() {

    const filter =
        document.getElementById(
            "leagueFilter"
        );


    const leagues = [];


    allFixtures.forEach(
        fixture => {

            const exists =
                leagues.find(
                    league =>
                        league.id ===
                        fixture.league.id
                );


            if (!exists) {

                leagues.push(
                    fixture.league
                );

            }

        }
    );


    filter.innerHTML = `

        <option value="all">
            All Leagues
        </option>

    `;


    leagues
        .sort(
            (a, b) =>
                a.name.localeCompare(
                    b.name
                )
        )
        .forEach(
            league => {

                const option =
                    document.createElement(
                        "option"
                    );

                option.value =
                    league.id;

                option.textContent =
                    league.name;

                filter.appendChild(
                    option
                );

            }
        );

}


document
    .getElementById(
        "leagueFilter"
    )
    .addEventListener(
        "change",
        function () {

            const selected =
                this.value;


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
                        String(
                            fixture.league.id
                        ) ===
                        String(selected)
                );


            displayFixtures(
                filtered
            );

        }
    );


function displayFixtures(
    fixtures
) {

    const container =
        document.getElementById(
            "fixtures"
        );


    container.innerHTML = "";


    fixtures.forEach(
        fixture => {

            const card =
                document.createElement(
                    "div"
                );


            card.className =
                "fixture-card";


            const date =
                new Date(
                    fixture.date
                );


            const time =
                date.toLocaleTimeString(
                    "en-NG",
                    {
                        hour: "2-digit",
                        minute: "2-digit"
                    }
                );


            card.innerHTML = `

                <div class="league-name">

                    ${escapeHTML(
                        fixture.league.name
                    )}

                </div>


                <div class="teams">

                    <div class="team">

                        ${escapeHTML(
                            fixture.home.name
                        )}

                    </div>


                    <div class="vs">
                        VS
                    </div>


                    <div class="team">

                        ${escapeHTML(
                            fixture.away.name
                        )}

                    </div>

                </div>


                <div class="match-time">

                    ${time}

                </div>


                <button
                    class="analyze-btn"
                    onclick="analyzeMatch(
                        ${fixture.id}
                    )"
                >

                    Analyze Match

                </button>

            `;


            container.appendChild(
                card
            );

        }
    );

}


async function analyzeMatch(
    fixtureId
) {

    const fixtures =
        document.getElementById(
            "fixtures"
        );

    const analysis =
        document.getElementById(
            "analysis"
        );

    const error =
        document.getElementById(
            "error"
        );


    error.classList.add(
        "hidden"
    );


    fixtures.classList.add(
        "hidden"
    );


    analysis.classList.remove(
        "hidden"
    );


    document.getElementById(
        "correctScore"
    ).textContent =
        "Analyzing...";


    try {

        const response =
            await fetch(
                `/api/fixture/${fixtureId}`
            );


        const data =
            await response.json();


        if (!data.success) {

            throw new Error(
                data.message
            );

        }


        document.getElementById(
            "analysisMatch"
        ).textContent =
            `${data.match.home} vs ${data.match.away}`;


        document.getElementById(
            "analysisLeague"
        ).textContent =
            data.match.league;


        document.getElementById(
            "correctScore"
        ).textContent =
            data.model.prediction;


        document.getElementById(
            "confidence"
        ).textContent =
            data.model.confidence;


        document.getElementById(
            "expectedGoals"
        ).textContent =
            `${data.model.expectedGoals.home} - ${data.model.expectedGoals.away}`;


        document.getElementById(
            "resultProbabilities"
        ).innerHTML = `

            <div>
                Home:
                ${data.model.resultProbabilities.homeWin}
            </div>

            <div>
                Draw:
                ${data.model.resultProbabilities.draw}
            </div>

            <div>
                Away:
                ${data.model.resultProbabilities.awayWin}
            </div>

        `;


        const scores =
            document.getElementById(
                "scores"
            );


        scores.innerHTML = "";


        data.model.topCorrectScores
            .forEach(
                item => {

                    const row =
                        document.createElement(
                            "div"
                        );


                    row.className =
                        "score-row";


                    row.innerHTML = `

                        <strong>
                            ${item.score}
                        </strong>

                        <span>
                            ${item.probability}
                        </span>

                    `;


                    scores.appendChild(
                        row
                    );

                }
            );


    } catch (err) {

        analysis.classList.add(
            "hidden"
        );

        fixtures.classList.remove(
            "hidden"
        );


        error.textContent =
            err.message ||
            "Unable to analyze match.";

        error.classList.remove(
            "hidden"
        );

    }

}


function closeAnalysis() {

    document.getElementById(
        "analysis"
    ).classList.add(
        "hidden"
    );


    document.getElementById(
        "fixtures"
    ).classList.remove(
        "hidden"
    );

}


function escapeHTML(
    value
) {

    return String(value)
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


loadFixtures();
