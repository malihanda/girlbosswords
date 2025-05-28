// Filter system for calendar visualization

class FilterSystem {
    constructor(data) {
        this.data = data;
        this.activeFilters = {
            publication: new Set(),
            size: new Set(),
            collaborators: new Set(),
            type: new Set(),
        };
        this.filterStats = this.calculateAllStats();
    }

    // Calculate total stats (count and recency) for all values
    calculateAllStats() {
        const initialStats = {
            publication: new Map(),
            size: new Map(),
            collaborators: new Map(),
            type: new Map(),
        };

        this.processAllRecords((record, dateObj) => {
            const recordDate = new Date(dateObj.date);

            const updateCategoryStats = (category, value) => {
                if (!value) return;
                const currentEntry = initialStats[category].get(value) || {
                    count: 0,
                    mostRecentDate: new Date(0),
                };
                initialStats[category].set(value, {
                    count: currentEntry.count + 1,
                    mostRecentDate:
                        recordDate > currentEntry.mostRecentDate
                            ? recordDate
                            : currentEntry.mostRecentDate,
                });
            };

            updateCategoryStats("publication", record.publication);
            if (record.category === "puzzle") {
                updateCategoryStats("size", record.size);
                updateCategoryStats("type", record.style);
            }
            updateCategoryStats("collaborators", record.collaborator);
        });
        return initialStats;
    }

    // Helper to process all records, passing the record and its date object
    processAllRecords(callback) {
        Object.values(this.data).forEach((yearData) => {
            if (!Array.isArray(yearData)) return;
            yearData.forEach((dateObj) => {
                // dateObj is the object like { date: "YYYY-MM-DD", records: [...] }
                if (!dateObj || !dateObj.records) return;
                dateObj.records.forEach((record) => callback(record, dateObj));
            });
        });
    }

    // Get current counts for all filter options
    getFilterCounts() {
        const counts = {
            publication: new Map(),
            size: new Map(),
            collaborators: new Map(),
            type: new Map(),
        };

        const allRecordsWithDate = [];
        Object.values(this.data).forEach((yearData) => {
            if (!Array.isArray(yearData)) return;
            yearData.forEach((dateObj) => {
                if (!dateObj || !dateObj.records) return;
                dateObj.records.forEach((record) =>
                    allRecordsWithDate.push({
                        ...record,
                        dateString: dateObj.date,
                    })
                );
            });
        });

        for (const category of Object.keys(this.activeFilters)) {
            const originalCategoryFilters = new Set(
                this.activeFilters[category]
            );
            this.activeFilters[category].clear(); // Temporarily clear filters for the category being counted

            for (const record of allRecordsWithDate) {
                if (this.recordPassesFilters(record)) {
                    let valueToCount =
                        record[this.getRecordFieldForCategory(category)];
                    if (category === "type") valueToCount = record.style; // Special handling for type/style

                    if (valueToCount) {
                        // Only count size and type for puzzle records
                        if (
                            (category === "size" || category === "type") &&
                            record.category !== "puzzle"
                        ) {
                            // Skip non-puzzle records for size/type counts
                        } else {
                            counts[category].set(
                                valueToCount,
                                (counts[category].get(valueToCount) || 0) + 1
                            );
                        }
                    }
                }
            }
            this.activeFilters[category] = originalCategoryFilters; // Restore original filters for the category
        }
        return counts;
    }

    getRecordFieldForCategory(category) {
        switch (category) {
            case "publication":
                return "publication";
            case "size":
                return "size";
            case "collaborators":
                return "collaborator";
            case "type":
                return "style"; // Matches record.style
            default:
                return category;
        }
    }

    // Check if a record passes all current filters
    recordPassesFilters(record) {
        // Publication filter
        if (
            this.activeFilters.publication.size > 0 &&
            !this.activeFilters.publication.has(record.publication)
        ) {
            return false;
        }

        // Size filter - active size filters mean non-puzzles are excluded
        if (this.activeFilters.size.size > 0) {
            if (
                record.category !== "puzzle" ||
                !this.activeFilters.size.has(record.size)
            ) {
                return false;
            }
        }

        // Collaborator filter
        if (
            this.activeFilters.collaborators.size > 0 &&
            (!record.collaborator ||
                !this.activeFilters.collaborators.has(record.collaborator))
        ) {
            return false;
        }

        // Type filter - active type filters mean non-puzzles are excluded
        if (this.activeFilters.type.size > 0) {
            if (
                record.category !== "puzzle" ||
                !this.activeFilters.type.has(record.style)
            ) {
                return false;
            }
        }
        return true;
    }

    // Get filtered data
    getFilteredData() {
        const filteredData = {};
        // Check if any filter set in activeFilters has one or more selected values
        const hasAnyActiveFilters = Object.values(this.activeFilters).some(
            (filterSet) => filterSet.size > 0
        );

        Object.entries(this.data).forEach(([year, yearData]) => {
            if (!Array.isArray(yearData)) {
                filteredData[year] = yearData; // Preserve non-array year data (e.g., metadata)
                return;
            }

            filteredData[year] = yearData.map((date) => {
                if (!date || !date.records) return date; // Preserve dates without records

                // If no filters are active, all dates are effectively unfiltered
                if (!hasAnyActiveFilters) {
                    return { ...date, filtered: false };
                }

                // A date is considered filtered if none of its records pass the active filters
                const hasPassingRecords = date.records.some((record) =>
                    this.recordPassesFilters(record)
                );

                return {
                    ...date,
                    filtered: !hasPassingRecords,
                };
            });
        });
        return filteredData;
    }

    // Update filters for a category
    setFilter(category, values) {
        this.activeFilters[category] = new Set(values);
    }

    // Clear filters for a category
    clearFilter(category) {
        this.activeFilters[category].clear();
    }

    // Clear all filters
    clearAllFilters() {
        Object.keys(this.activeFilters).forEach((category) => {
            this.activeFilters[category].clear();
        });
    }
}

// Add styles for the filter system
const style = document.createElement("style");
style.textContent = `
.filter-wrapper {
    padding: 1rem;
    width: 1022px;
    box-sizing: border-box;
}

.clear-all-container {
    margin-bottom: 1rem;
    text-align: right;
}

.clear-all-link {
    color: #666;
    text-decoration: none;
    font-size: 0.9rem;
}

.clear-all-link:hover {
    text-decoration: underline;
}

.filter-controls {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 16px;
    margin-bottom: 20px;
    box-sizing: border-box;
    flex-shrink: 0;
    width: 100%;
}
`;
document.head.appendChild(style);

// Function to create and populate filter controls
function populateFilterControls(container, filterSystem, onFilterChange) {
    // Remove any existing controls and old document listener if any
    container.querySelectorAll(".filter-wrapper").forEach((el) => el.remove());
    if (populateFilterControls.clickOutsideListener) {
        document.removeEventListener(
            "click",
            populateFilterControls.clickOutsideListener
        );
        populateFilterControls.clickOutsideListener = null; // Clear the reference
    }

    const filterWrapper = document.createElement("div");
    filterWrapper.className = "filter-wrapper";

    // Clear All link creation remains the same
    const clearAllContainer = document.createElement("div");
    clearAllContainer.className = "clear-all-container";
    const clearAllLink = document.createElement("a");
    clearAllLink.className = "clear-all-link";
    clearAllLink.href = "#";
    clearAllLink.textContent = "Clear all filters";
    clearAllLink.addEventListener("click", (e) => {
        e.preventDefault();
        filterWrapper
            .querySelectorAll('input[type="checkbox"]')
            .forEach((checkbox) => {
                checkbox.checked = false;
            });
        filterWrapper.querySelectorAll(".dropdown-button").forEach((button) => {
            button.textContent = "Showing all";
        });
        filterSystem.clearAllFilters();
        onFilterChange(); // Reverted: Call the passed onFilterChange directly
    });
    clearAllContainer.appendChild(clearAllLink);
    filterWrapper.appendChild(clearAllContainer);

    const filterControls = document.createElement("div");
    filterControls.className = "filter-controls";

    const categories = [
        { id: "publication", label: "Publication" },
        { id: "size", label: "Size" },
        { id: "collaborators", label: "Collaborators" },
        { id: "type", label: "Puzzle type" },
    ];

    categories.forEach((category) => {
        // Pass the original onFilterChange to createFilterDropdown
        const filterColumn = createFilterDropdown(
            category,
            filterSystem,
            onFilterChange,
            filterControls
        );
        filterControls.appendChild(filterColumn);
    });

    filterWrapper.appendChild(filterControls);
    container.insertBefore(filterWrapper, container.firstChild);

    // Single document-level listener to close dropdowns when clicking outside
    populateFilterControls.clickOutsideListener = (event) => {
        const allDropdownContainers = filterControls.querySelectorAll(
            ".dropdown-container"
        );
        allDropdownContainers.forEach((dropdownContainer) => {
            const dropdownContent =
                dropdownContainer.querySelector(".dropdown-content");
            if (
                dropdownContent &&
                dropdownContent.classList.contains("show") &&
                !dropdownContainer.contains(event.target)
            ) {
                dropdownContent.classList.remove("show");
            }
        });
    };
    document.addEventListener(
        "click",
        populateFilterControls.clickOutsideListener
    );
}

// createFilterDropdown expects onFilterChange as the callback to execute when a filter is changed.
function createFilterDropdown(
    category,
    filterSystem,
    onFilterChange,
    filterControls
) {
    const column = document.createElement("div");
    column.className = "filter-column";
    const heading = document.createElement("h2");
    heading.textContent = category.label;
    column.appendChild(heading);

    const dropdownContainer = document.createElement("div");
    dropdownContainer.className = "dropdown-container";

    const dropdownButton = document.createElement("button");
    dropdownButton.className = "dropdown-button";
    dropdownButton.textContent = "Showing all";
    dropdownContainer.appendChild(dropdownButton);

    const dropdownContent = document.createElement("div");
    dropdownContent.className = "dropdown-content";

    const categoryStats = filterSystem.filterStats[category.id];
    if (categoryStats) {
        const sortedEntries = Array.from(categoryStats.entries()).sort(
            ([, statsA], [, statsB]) => {
                const countDiff = statsB.count - statsA.count;
                if (countDiff !== 0) return countDiff;
                return statsB.mostRecentDate - statsA.mostRecentDate;
            }
        );

        sortedEntries.forEach(([value, { count }]) => {
            if (!value) return;
            const option = document.createElement("div");
            option.className = "dropdown-option";
            const checkbox = document.createElement("input");
            checkbox.type = "checkbox";
            checkbox.id = `${category.id}-${value}`;
            checkbox.checked =
                filterSystem.activeFilters[category.id].has(value);
            const label = document.createElement("label");
            label.htmlFor = checkbox.id;
            label.textContent = `${value} (${count})`;
            option.appendChild(checkbox);
            option.appendChild(label);
            dropdownContent.appendChild(option);

            checkbox.addEventListener("change", () => {
                const currentFilters = filterSystem.activeFilters[category.id];
                if (checkbox.checked) currentFilters.add(value);
                else currentFilters.delete(value);
                updateDropdownButton(
                    dropdownButton,
                    category.id,
                    currentFilters
                );
                onFilterChange(); // Calls the callback passed from populateFilterControls
            });
        });
    }

    dropdownContainer.appendChild(dropdownContent);
    column.appendChild(dropdownContainer);

    dropdownButton.addEventListener("click", (e) => {
        e.stopPropagation();
        filterControls
            .querySelectorAll(".dropdown-content.show")
            .forEach((content) => {
                if (content !== dropdownContent) {
                    content.classList.remove("show");
                }
            });
        dropdownContent.classList.toggle("show");
    });
    return column;
}

function updateDropdownButton(button, categoryId, activeFilters) {
    if (activeFilters.size === 0) {
        button.textContent = "Showing all";
    } else {
        button.textContent = `Showing ${Array.from(activeFilters).join(", ")}`;
    }
}

export { FilterSystem, populateFilterControls };
