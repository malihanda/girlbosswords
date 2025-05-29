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

// Click handling for details panel
export function handleOutsideClick(e) {
    const panel = document.getElementById("details-panel");
    if (
        panel.classList.contains("visible") &&
        !panel.contains(e.target) &&
        !e.target.closest(".contains-data-cell")
    ) {
        hideDetailsPanel();
    }
} 