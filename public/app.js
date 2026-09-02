async function analyzeMatch() {

    const fixtureId =
        document.getElementById("fixtureId").value;

    const loading =
        document.getElementById("loading");

    const result =
        document.getElementById("result");

    const error =
        document.getElementById("error");

    result.classList.add("hidden");
    error.classList.add("hidden");

    if (!fixtureId) {

        error.textContent =
            "Enter a fixture ID.";

        error.classList.remove("hidden");

        return;
    }

    loading.classList.remove("hidden");

    try {

        const response =
            await fetch(`/api/fixture/${fixtureId}`);

        const data =
            await response.json();

        if (!data.success) {
            throw new Error(data.message);
        }

        document.getElementById("matchName").textContent =
            `${data.match.home} vs ${data.match.away}`;

        document.getElementById("prediction").textContent =
            `Model Prediction: ${data.model.prediction}`;

        document.getElementById("confidence").textContent =
            data.model.confidence;

        document.getElementById("xg").textContent =
            `${data.model.expectedGoals.home} - ${data.model.expectedGoals.away}`;

        document.getElementById(
            "resultProbabilities"
        ).textContent =
            `Home ${data.model.resultProbabilities.homeWin} | ` +
            `Draw ${data.model.resultProbabilities.draw} | ` +
            `Away ${data.model.resultProbabilities.awayWin}`;

        const scores =
            document.getElementById("scores");

        scores.innerHTML = "";

        data.model.topCorrectScores.forEach(item => {

            const row =
                document.createElement("div");

            row.className = "score-row";

            row.innerHTML = `
                <strong>${item.score}</strong>
                <span>${item.probability}</span>
            `;

            scores.appendChild(row);

        });

        result.classList.remove("hidden");

    } catch (err) {

        error.textContent =
            err.message || "Something went wrong.";

        error.classList.remove("hidden");

    } finally {

        loading.classList.add("hidden");

    }
}
