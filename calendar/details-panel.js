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
    constructor(panelId) {
        this.panelElement = document.getElementById(panelId);
        if (!this.panelElement) {
            console.error(
                `DetailsPanel: Element with ID '${panelId}' not found.`
            );
            return; // Prevent errors if panel doesn't exist
        }
        this.headerElement = document.createElement("div");
        this.headerElement.className = "details-panel-header";
        this.panelElement.appendChild(this.headerElement);
        this.contentElement = document.createElement("div");
        this.contentElement.className = "details-panel-content";
        this.panelElement.appendChild(this.contentElement);

        // Bind methods to ensure 'this' context is correct when used as event handlers
        this._handleUrlHash = this._handleUrlHash.bind(this);
        this._handleOutsideClick = this._handleOutsideClick.bind(this);
        this.showDetails = this.showDetails.bind(this);
        this.hideDetails = this.hideDetails.bind(this);
        this.makeNarrowIfNecessary = this.makeNarrowIfNecessary.bind(this);
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
        window.addEventListener("hashchange", this._handleUrlHash);

        // Event listener for clicks outside the panel
        document.addEventListener("click", this._handleOutsideClick);

        this.makeNarrowIfNecessary();
        window.addEventListener("resize", this.makeNarrowIfNecessary);

        // Check hash on initial load
        this._handleUrlHash();
    }

    makeNarrowIfNecessary() {
        if (!this.panelElement) return;
        const chartContainer = document.getElementById("chart-container");
        if (!chartContainer) return;
        const chartContainerRightBound =
            chartContainer.getBoundingClientRect().right;
        const shouldBeNarrow =
            chartContainerRightBound > window.innerWidth - 300;
        this.panelElement.classList.toggle("narrow", shouldBeNarrow);
        if (shouldBeNarrow && this.panelElement.classList.contains("visible")) {
            const panelHeight =
                this.panelElement.getBoundingClientRect().height;
            chartContainer.style.paddingBottom = `${panelHeight}px`;
        } else {
            chartContainer.style.paddingBottom = "0";
        }
    };

    showDetails(date, records) {
        if (!this.panelElement || !this.headerElement || !this.contentElement) return;

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

        // Only set padding if panel is visible and narrow
        const chartContainer = document.getElementById("chart-container");
        if (this.panelElement.classList.contains("narrow")) {
            const panelHeight =
                this.panelElement.getBoundingClientRect().height;
            chartContainer.style.paddingBottom = `${panelHeight}px`;
        } else {
            chartContainer.style.paddingBottom = "0";
        }
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
        // Use the global processedData variable
        const yearData =
            window.processedData && window.processedData[year]
                ? window.processedData[year]
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
