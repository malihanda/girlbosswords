// Constants
const MONTHS = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
];

const WEEKDAYS = [
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
];

export class DetailsPanel {
    constructor(panelId, initialChartData) {
        this.panelElement = document.getElementById(panelId);
        if (!this.panelElement) {
            console.error(
                `DetailsPanel: Element with ID '${panelId}' not found.`
            );
            return; // Prevent errors if panel doesn't exist
        }
        this.headerElement = this.panelElement.querySelector(
            ".details-panel-header"
        );
        this.contentElement = this.panelElement.querySelector(
            ".details-panel-content"
        );
        this.chartData = initialChartData; // Store initial chart data, might be updated or fetched again by chart

        // Bind methods to ensure 'this' context is correct when used as event handlers
        this._handleUrlHash = this._handleUrlHash.bind(this);
        this._handleOutsideClick = this._handleOutsideClick.bind(this);
        this.showDetails = this.showDetails.bind(this); // Renaming showDetailsPanel for instance method clarity
        this.hideDetails = this.hideDetails.bind(this); // Renaming hideDetailsPanel
    }

    // chartInstance is the instance of CalendarChart
    init(chartInstance) {
        if (!this.panelElement) return;

        // Event listener for cell clicks to show the panel
        if (chartInstance && chartInstance.container) {
            chartInstance.container.addEventListener("cellClick", (e) => {
                const { date, records } = e.detail;
                this.showDetails(date, records);
            });
        }

        // Event listener for hash changes
        window.addEventListener("popstate", this._handleUrlHash);

        // Event listener for clicks outside the panel
        document.addEventListener("click", this._handleOutsideClick);

        // Check hash on initial load
        this._handleUrlHash(); // Uses this.chartData
    }

    // Call this if the chart data changes after initialization if _handleUrlHash needs updated data
    updateChartData(newData) {
        this.chartData = newData;
    }

    showDetails(date, records) {
        if (!this.panelElement || !this.headerElement || !this.contentElement)
            return;

        if (window.location.hash !== `#${date}`) {
            window.history.pushState(null, "", `#${date}`);
        }

        const [year, month, day] = date
            .split("-")
            .map((num) => parseInt(num, 10));
        const utcDate = new Date(Date.UTC(year, month - 1, day));
        const weekday = WEEKDAYS[utcDate.getUTCDay()];
        const formattedDate = `${weekday}, ${
            MONTHS[month - 1]
        } ${day}, ${year}`;

        this.headerElement.textContent = formattedDate;
        this.contentElement.innerHTML = "";

        const sortedRecords = [...records].sort((a, b) => {
            if (a.category !== b.category) {
                return a.category === "misc" ? -1 : 1;
            }
            return a.publication.localeCompare(b.publication);
        });

        if (sortedRecords.length > 0) {
            sortedRecords.forEach((record) => {
                const itemDiv = document.createElement("div");
                itemDiv.className = "publication-item";
                if (record.category === "misc") {
                    itemDiv.innerHTML = `
                        <strong>${record.publication}</strong><br>
                        <a href="${record.url}" target="_blank">${record.title}</a>
                        <div class="publication-meta">
                            <em>${record.type}</em>
                        </div>
                    `;
                } else {
                    const titleHtml = record.url
                        ? `<a href="${record.url}" target="_blank">${record.title}</a>`
                        : record.title;
                    itemDiv.innerHTML = `
                        <strong>${record.publication}</strong><br>
                        ${titleHtml}
                        ${
                            record.collaborator
                                ? `with ${record.collaborator}<br>`
                                : ""
                        }
                        <div class="publication-meta">
                            <em>${record.size}, ${record.type}</em>
                        </div>
                    `;
                    if (record.puz || record.pdf) {
                        itemDiv.innerHTML += `
                            <div class="download-links">
                                Download: ${
                                    record.puz
                                        ? `<a href="${record.puz}" target="_blank">puz</a>`
                                        : ""
                                }
                                ${
                                    record.pdf
                                        ? `<a href="${record.pdf}" target="_blank">pdf</a>`
                                        : ""
                                }
                            </div>
                        `;
                    }
                }
                this.contentElement.appendChild(itemDiv);
            });
        } else {
            this.contentElement.innerHTML = "<p>No content on this date.</p>";
        }
        this.panelElement.classList.add("visible");
    }

    hideDetails() {
        if (!this.panelElement) return;
        this.panelElement.classList.remove("visible");
        if (window.location.hash) {
            window.history.pushState(null, "", window.location.pathname);
        }
    }

    _handleUrlHash() {
        if (!this.panelElement) return;
        const hash = window.location.hash.slice(1);
        if (!hash || !/^\d{4}-\d{2}-\d{2}$/.test(hash)) {
            this.hideDetails();
            return;
        }

        const year = hash.slice(0, 4);
        // Ensure this.chartData is in the format { year: [dateEntry, ...] }
        const yearData =
            this.chartData && this.chartData[year]
                ? this.chartData[year]
                : null;

        if (!yearData || !Array.isArray(yearData)) {
            this.hideDetails();
            return;
        }

        const dayData = yearData.find((d) => d && d.date === hash);
        if (dayData && dayData.records && dayData.records.length > 0) {
            this.showDetails(dayData.date, dayData.records);
        } else {
            this.hideDetails();
        }
    }

    _handleOutsideClick(e) {
        if (!this.panelElement) return;
        if (
            this.panelElement.classList.contains("visible") &&
            !this.panelElement.contains(e.target) &&
            !e.target.closest(".contains-data-cell") && // Assumes your calendar cells have this class or similar
            !e.target.closest("#details-panel") // Double check if panel.contains is enough
        ) {
            this.hideDetails();
        }
    }
}
