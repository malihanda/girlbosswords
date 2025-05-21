function showDetailsPanel(date, publications) {
    const panel = document.getElementById("details-panel");
    const header = panel.querySelector(".details-panel-header");
    const content = panel.querySelector(".details-panel-content");

    // Only update URL if it's different from current hash
    if (window.location.hash !== `#${date}`) {
        window.history.pushState(null, "", `#${date}`);
    }

    // Parse the date string (YYYY-MM-DD) into components
    const [year, month, day] = date.split("-").map((num) => parseInt(num, 10));

    // Create date parts for display (using 0-based months)
    const months = [
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
    const weekdays = [
        "Sunday",
        "Monday",
        "Tuesday",
        "Wednesday",
        "Thursday",
        "Friday",
        "Saturday",
    ];

    // Calculate day of week (use UTC to avoid timezone shifts)
    const utcDate = new Date(Date.UTC(year, month - 1, day));
    const weekday = weekdays[utcDate.getUTCDay()];

    // Format date string
    const formattedDate = `${weekday}, ${months[month - 1]} ${day}, ${year}`;

    // Update header
    header.textContent = formattedDate;

    // Clear existing content
    content.innerHTML = "";

    // Add publication details
    if (publications && publications.length > 0) {
        publications.forEach((pub) => {
            const pubDiv = document.createElement("div");
            pubDiv.className = "publication-item";

            // Create title element (as link if URL exists)
            const titleHtml = pub.url
                ? `<a href="${pub.url}" target="_blank">${pub.title}</a>`
                : pub.title;

            // Build the HTML content
            let contentHtml = `
                <strong>${pub.publication}</strong><br>
                ${titleHtml}
                ${pub.collaborator ? `with ${pub.collaborator}<br>` : ""}
                <div class="publication-meta">
                    <em>${pub.size}, ${pub.style}</em>
                </div>
            `;
            pubDiv.innerHTML = contentHtml;
            content.appendChild(pubDiv);
        });
    } else {
        content.innerHTML = "<p>No publications on this date.</p>";
    }

    panel.classList.add("visible");
}

function hideDetailsPanel() {
    const panel = document.getElementById("details-panel");
    panel.classList.remove("visible");

    // Remove hash if it exists
    if (window.location.hash) {
        window.history.pushState(null, "", window.location.pathname);
    }
}

function handleUrlHash(data) {
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
    if (dayData && dayData.publications) {
        showDetailsPanel(dayData.date, dayData.publications);
    } else {
        hideDetailsPanel();
    }
}

async function loadChartData() {
    try {
        const response = await fetch("data.json");
        const publications = await response.json();

        // Process the data and store globally
        const data = processPublications(publications);
        window.chartData = data;

        renderChart(data);

        // Set up hash change handling
        window.addEventListener("popstate", () => handleUrlHash(data));

        // Check hash on initial load
        handleUrlHash(data);
    } catch (error) {
        console.error("Error loading chart data:", error);
    }
}

function processPublications(publications) {
    const data = {};
    const today = new Date();
    const currentYear = today.getFullYear();
    const todayString = today.toISOString().split("T")[0];

    // Group publications by year and date
    publications.forEach((pub) => {
        const dateStr = pub["publish date"];
        const year = parseInt(dateStr.split("-")[0]);

        if (!data[year]) {
            data[year] = {};
        }

        if (!data[year][dateStr]) {
            data[year][dateStr] = {
                date: dateStr,
                publications: [],
                colorway: 1, // default color
            };
        }

        data[year][dateStr].publications.push(pub);
        // Set color based on publication size
        const hasFullSize = data[year][dateStr].publications.some(
            (p) => p.size === "full-size" || p.size === "oversized"
        );
        data[year][dateStr].colorway = hasFullSize
            ? 3
            : data[year][dateStr].publications.length > 0
            ? 2
            : 1;
    });

    // Get unique years from publications and ensure current year is included
    const years = new Set([...Object.keys(data), currentYear.toString()]);

    // Convert to calendar format with placeholders
    const calendarData = {};
    years.forEach((yearStr) => {
        const year = parseInt(yearStr);
        const dates = data[year] || {};

        // Only create entry if there's data or it's the current year
        if (Object.keys(dates).length > 0 || year === currentYear) {
            // Calculate first day offset using a Date object (timezone doesn't matter for day of week)
            const firstDayOffset = new Date(year, 0, 1).getDay();
            calendarData[year] = Array(firstDayOffset).fill(null);

            // Fill in all dates up to end of year or today
            for (let month = 0; month < 12; month++) {
                const daysInMonth = new Date(year, month + 1, 0).getDate();
                for (let day = 1; day <= daysInMonth; day++) {
                    const dateStr = `${year}-${String(month + 1).padStart(
                        2,
                        "0"
                    )}-${String(day).padStart(2, "0")}`;

                    // Skip dates after today for current year
                    if (year === currentYear && dateStr > todayString) {
                        break;
                    }

                    calendarData[year].push(
                        dates[dateStr] || {
                            date: dateStr,
                            publications: [],
                            colorway: 1,
                        }
                    );
                }
            }
        }
    });

    return calendarData;
}

function renderChart(data) {
    const container = document.getElementById("chart-container");
    const tooltip = document.getElementById("tooltip");
    container.innerHTML = "";

    // Create and add filter controls
    container.appendChild(createFilterControls(data));

    // Sort years in descending order and create year sections
    Object.keys(data)
        .sort((a, b) => b - a)
        .forEach((year) =>
            container.appendChild(createYearSection(year, data[year]))
        );

    // Global event handlers
    container.addEventListener("mouseleave", hideTooltip);
    document.addEventListener("click", handleOutsideClick);
}

function createFilterControls(data) {
    const filters = [
        {
            label: "NYT",
            condition: (pub) => pub.publication === "New York Times",
        },
        {
            label: "Vulture",
            condition: (pub) => pub.publication === "Vulture",
        },
        {
            label: "Collaborations",
            condition: (pub) => pub.hasCollaborator,
        },
        {
            label: "Multiple publications",
            condition: (pub, cell) => parseInt(cell.dataset.pubCount) > 1,
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

function handleFilterClick(button, filter, buttonGroup) {
    button.classList.toggle("active");

    if (button.classList.contains("active")) {
        buttonGroup
            .querySelectorAll(".filter-button")
            .forEach((btn) => btn !== button && btn.classList.remove("active"));
    }

    applyFilter(filter, button.classList.contains("active"));
}

function applyFilter(filter, isActive) {
    document.querySelectorAll(".date-cell").forEach((cell) => {
        if (!cell.dataset.publications) return;

        const pubs = JSON.parse(cell.dataset.publications);
        if (isActive) {
            const matches =
                filter.label === "Multiple publications"
                    ? filter.condition(null, cell)
                    : pubs.some((pub) => filter.condition(pub));
            cell.classList.toggle("filtered", !matches);
        } else {
            cell.classList.remove("filtered");
        }
    });
}

function createYearSection(year, dates) {
    const section = document.createElement("div");
    section.className = "year-section";
    section.appendChild(createLabelElement(year, "h2"));
    section.appendChild(createYearGrid(year, dates));
    return section;
}

function createYearGrid(year, dates) {
    const grid = document.createElement("div");
    grid.className = "publication-grid";

    // Add day labels
    ["Su", "M", "T", "W", "Th", "F", "S"].forEach((day, i) => {
        const label = createLabelElement(day, "label-cell");
        label.style.gridRow = (i + 2).toString();
        label.style.gridColumn = "1";
        grid.appendChild(label);
    });

    // Add month labels and calculate positions
    const monthPositions = calculateMonthPositions(year, dates);
    monthPositions.forEach((col, month) => {
        const label = createLabelElement(
            [
                "Jan",
                "Feb",
                "Mar",
                "Apr",
                "May",
                "Jun",
                "Jul",
                "Aug",
                "Sep",
                "Oct",
                "Nov",
                "Dec",
            ][month],
            "month-label"
        );
        label.style.gridColumn = col.toString();
        grid.appendChild(label);
    });

    // Add date cells
    dates.forEach((date, index) => {
        const cell = createDateCell(date, index);
        grid.appendChild(cell);
    });

    return grid;
}

function createDateCell(date, index) {
    const cell = document.createElement("div");
    const col = Math.floor(index / 7) + 2;
    const row = (index % 7) + 2;

    if (date === null) {
        cell.className = "placeholder-cell";
    } else {
        cell.className = `date-cell ${
            date.publications.length > 0 ? "publication-cell" : ""
        } color-${date.colorway}`;
        setDateCellData(cell, date);

        if (date.publications.length > 0) {
            addDateCellEventListeners(cell, date);
        }
    }

    cell.style.gridRow = row.toString();
    cell.style.gridColumn = col.toString();
    return cell;
}

function setDateCellData(cell, date) {
    cell.dataset.date = date.date;
    cell.dataset.pubCount = date.publications.length;
    cell.dataset.publications = JSON.stringify(
        date.publications.map((p) => ({
            publication: p.publication,
            size: p.size,
            hasCollaborator: !!p.collaborator,
        }))
    );
}

function addDateCellEventListeners(cell, date) {
    const tooltipContent = createTooltipContent(date);
    cell.addEventListener("mouseover", (e) => showTooltip(e, tooltipContent));
    cell.addEventListener("mouseout", hideTooltip);
    cell.addEventListener("click", () =>
        showDetailsPanel(date.date, date.publications)
    );
}

function createTooltipContent(date) {
    return `<strong>${date.date}</strong>\n${date.publications
        .map(
            (pub) =>
                `<strong>${pub.publication}</strong>: ${pub.title}${
                    pub.collaborator ? ` with ${pub.collaborator}` : ""
                } (${pub.size}, ${pub.style})`
        )
        .join("\n")}`;
}

function createLabelElement(text, className) {
    const element =
        className === "h2"
            ? document.createElement("h2")
            : document.createElement("div");
    element.className = className;
    element.textContent = text;
    return element;
}

function calculateMonthPositions(year, dates) {
    const monthPositions = new Map();
    let dayCount = new Date(year, 0, 1).getDay(); // First day offset
    const today = new Date().toISOString().split("T")[0];

    for (let month = 0; month < 12; month++) {
        const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-01`;
        if (dateStr > today) break;

        monthPositions.set(month, Math.floor(dayCount / 7) + 2);
        dayCount += new Date(year, month + 1, 0).getDate();
    }

    return monthPositions;
}

function handleOutsideClick(e) {
    const panel = document.getElementById("details-panel");
    const isClickInside = panel.contains(e.target);
    const isClickOnPublicationCell =
        e.target.classList.contains("publication-cell");

    if (!isClickInside && !isClickOnPublicationCell) {
        hideDetailsPanel();
    }
}

// Tooltip handling functions
function showTooltip(event, content) {
    const tooltip = document.getElementById("tooltip");
    const rect = event.target.getBoundingClientRect();
    const scrollTop = window.scrollY || document.documentElement.scrollTop;
    const scrollLeft = window.scrollX || document.documentElement.scrollLeft;

    tooltip.innerHTML = content;
    tooltip.style.visibility = "visible";

    // Position tooltip
    const tooltipRect = tooltip.getBoundingClientRect();
    let top = rect.top + scrollTop - tooltipRect.height - 10;
    let left = rect.left + scrollLeft + rect.width / 2;

    // Adjust if tooltip would go off screen
    if (top < scrollTop) {
        top = rect.bottom + scrollTop + 10;
    }
    if (left + tooltipRect.width > window.innerWidth) {
        left = window.innerWidth - tooltipRect.width - 10;
    }

    tooltip.style.top = `${top}px`;
    tooltip.style.left = `${left}px`;
}

function hideTooltip() {
    const tooltip = document.getElementById("tooltip");
    tooltip.style.visibility = "hidden";
}

// Load the chart when the page loads
document.addEventListener("DOMContentLoaded", loadChartData);
