// Constants
const MONTHS = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
];

const WEEKDAYS = [
    "Sunday", "Monday", "Tuesday", "Wednesday",
    "Thursday", "Friday", "Saturday"
];

// Details Panel Functions
export function showDetailsPanel(date, records) {
    const panel = document.getElementById("details-panel");
    const header = panel.querySelector(".details-panel-header");
    const content = panel.querySelector(".details-panel-content");

    if (window.location.hash !== `#${date}`) {
        window.history.pushState(null, "", `#${date}`);
    }

    const [year, month, day] = date.split("-").map((num) => parseInt(num, 10));
    const utcDate = new Date(Date.UTC(year, month - 1, day));
    const weekday = WEEKDAYS[utcDate.getUTCDay()];
    const formattedDate = `${weekday}, ${MONTHS[month - 1]} ${day}, ${year}`;

    header.textContent = formattedDate;
    content.innerHTML = "";

    // Sort records by category (misc first) and then by publication
    const sortedRecords = [...records].sort((a, b) => {
        if (a.category !== b.category) {
            return a.category === 'misc' ? -1 : 1;
        }
        return a.publication.localeCompare(b.publication);
    });

    if (sortedRecords.length > 0) {
        sortedRecords.forEach((record) => {
            const itemDiv = document.createElement("div");
            itemDiv.className = "publication-item";

            if (record.category === 'misc') {
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
                    ${record.collaborator ? `with ${record.collaborator}<br>` : ""}
                    <div class="publication-meta">
                        <em>${record.size}, ${record.style}</em>
                    </div>
                `;
            }
            content.appendChild(itemDiv);
        });
    } else {
        content.innerHTML = "<p>No content on this date.</p>";
    }

    panel.classList.add("visible");
}

export function hideDetailsPanel() {
    const panel = document.getElementById("details-panel");
    panel.classList.remove("visible");

    if (window.location.hash) {
        window.history.pushState(null, "", window.location.pathname);
    }
}

export function handleUrlHash(data) {
    const hash = window.location.hash.slice(1);
    if (!hash || !/^\d{4}-\d{2}-\d{2}$/.test(hash)) {
        hideDetailsPanel();
        return;
    }

    const year = hash.slice(0, 4);
    const yearData = data[year];

    if (!yearData || !Array.isArray(yearData)) {
        hideDetailsPanel();
        return;
    }

    const dayData = yearData.find((d) => d && d.date === hash);
    if (dayData && dayData.records.length > 0) {
        showDetailsPanel(dayData.date, dayData.records);
    } else {
        hideDetailsPanel();
    }
}

// Filter Functions
export function gatherPublicationStats(data) {
    const stats = new Map();

    Object.values(data).forEach(yearDates => {
        yearDates.forEach(date => {
            if (!date) return;
            
            date.records.forEach(record => {
                if (!stats.has(record.publication)) {
                    stats.set(record.publication, {puzzles: 0, misc: 0});
                }
                const counts = stats.get(record.publication);
                if (record.category === 'puzzle') {
                    counts.puzzles++;
                } else {
                    counts.misc++;
                }
            });
        });
    });

    return Array.from(stats.entries())
        .map(([pub, counts]) => ({
            name: pub,
            total: counts.puzzles + counts.misc,
            ...counts
        }))
        .sort((a, b) => b.total - a.total);
}

export function createPublicationButton(publication) {
    const button = document.createElement("button");
    button.className = "pub-filter-button active";
    button.dataset.publication = publication.name;
    
    const nameSpan = document.createElement("span");
    nameSpan.className = "pub-name";
    nameSpan.textContent = `${publication.name} (${publication.total})`;
    
    const divider = document.createElement("span");
    divider.className = "pub-divider";
    divider.textContent = "|";
    
    const toggle = document.createElement("span");
    toggle.className = "pub-toggle";
    toggle.textContent = "×";
    
    button.append(nameSpan, divider, toggle);
    
    button.addEventListener("click", () => {
        button.classList.toggle("active");
        toggle.textContent = button.classList.contains("active") ? "×" : "+";
        
        if (button.classList.contains("active")) {
            button.parentElement.prepend(button);
        } else {
            button.parentElement.appendChild(button);
        }
        applyPublicationFilters();
    });
    
    return button;
}

export function applyPublicationFilters() {
    const activePublications = new Set(
        Array.from(document.querySelectorAll(".pub-filter-button.active"))
            .map(button => button.dataset.publication)
    );

    document.querySelectorAll(".date-cell").forEach(cell => {
        if (!cell.dataset.records) return;

        const records = JSON.parse(cell.dataset.records || "[]");
        const hasActivePublication = records.some(r => activePublications.has(r.publication));
        const shouldShow = activePublications.size === 0 || hasActivePublication;
        cell.classList.toggle("filtered", !shouldShow);
    });
}

export function createFilterControls() {
    const filters = [
        {
            label: "NYT",
            condition: (date) => {
                return date.records.some(r => r.publication === "New York Times");
            },
        },
        {
            label: "Indie",
            condition: (date) => {
                return date.records.some(
                    (r) =>
                        r.category === 'puzzle' &&
                        ![
                            "Vulture",
                            "New York Times",
                            "Puzzmo",
                            "Los Angeles Times",
                            "The Defector",
                            "The Modern Crossword",
                            "USA Today",
                            "Apple News+",
                            "Universal",
                            "Matt Gaffney's Weekly Crossword Contest",
                            "The Atlantic",
                        ].includes(r.publication)
                );
            },
        },
        {
            label: "Collabs",
            condition: (date) => {
                return date.records.some(
                    (r) => r.category === 'puzzle' && (r.hasCollaborator || r.collaborator)
                );
            },
        },
    ];

    const controls = document.createElement("div");
    controls.className = "filter-controls";

    const buttons = document.createElement("div");
    buttons.className = "filter-buttons";

    filters.forEach((filter) => {
        const button = document.createElement("button");
        button.className = "filter-button";
        button.textContent = filter.label;
        button.addEventListener("click", () =>
            handleFilterClick(button, filter, buttons)
        );
        buttons.appendChild(button);
    });

    controls.append(createLabelElement("Show only:", "filter-label"), buttons);

    return controls;
}

export function handleFilterClick(button, filter, buttonGroup) {
    button.classList.toggle("active");

    if (button.classList.contains("active")) {
        buttonGroup
            .querySelectorAll(".filter-button")
            .forEach((btn) => btn !== button && btn.classList.remove("active"));
    }

    applyFilter(filter, button.classList.contains("active"));
}

export function resetFilters() {
    document.querySelectorAll(".filter-button").forEach((button) => {
        button.classList.remove("active");
    });

    document.querySelectorAll(".date-cell").forEach((cell) => {
        cell.classList.remove("filtered");
    });
}

export function applyFilter(filter, isActive) {
    document.querySelectorAll(".date-cell").forEach((cell) => {
        if (!cell.dataset.records) return;

        const records = JSON.parse(cell.dataset.records || "[]");
        const date = { records };

        if (isActive) {
            cell.classList.toggle("filtered", !filter.condition(date));
        } else {
            cell.classList.remove("filtered");
        }
    });
}

// Helper Functions
export function createLabelElement(text, className) {
    const element = className === "h2" ? document.createElement("h2") : document.createElement("div");
    element.className = className;
    element.textContent = text;
    return element;
}

export function handleOutsideClick(e) {
    const detailsPanel = document.getElementById("details-panel");
    const isClickOnDataCell = e.target.classList.contains("contains-data-cell");
    const isClickInsidePanel = detailsPanel.contains(e.target);

    if (!isClickOnDataCell && !isClickInsidePanel) {
        hideDetailsPanel();
        window.history.pushState(null, "", window.location.pathname);
    }
} 