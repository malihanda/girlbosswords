// Filter system for calendar visualization

/**
 * Defines the categories used for filtering records.
 * Each object contains an id (used internally and for CSS classes/selectors)
 * and a label (for display in the UI).
 */
const FILTER_CATEGORIES = [
    { id: "publication", label: "Publication" },
    { id: "size", label: "Size" },
    { id: "collaborator", label: "Collaborator" },
    { id: "type", label: "Puzzle type" },
];

/**
 * Manages the state of active filters and provides methods to filter data
 * and calculate filter statistics.
 */
class FilterSystem {
    /**
     * Initializes the FilterSystem with raw data.
     * @param {object} data - The raw data object, typically structured by year, then date, then records.
     */
    constructor(data) {
        this.data = data;
        /** @type {Object.<string, Set<string>>} */
        this.activeFilters = {
            publication: new Set(),
            size: new Set(),
            collaborator: new Set(),
            type: new Set(),
        };
        // filterStats will store maps of: value -> { count: number, mostRecentDate: Date }
        this.filterStats = this.calculateAllStats();
    }

    /**
     * Calculates initial statistics for all filterable values across all records.
     * For each value in each category, it counts occurrences and tracks the most recent date.
     * @returns {Object.<string, Map<string, {count: number, mostRecentDate: Date}>>}
     *          An object where keys are category IDs and values are Maps.
     *          Each Map stores filter values as keys and an object with `count` and `mostRecentDate` as values.
     */
    calculateAllStats() {
        const initialStats = {
            publication: new Map(),
            size: new Map(),
            collaborator: new Map(),
            type: new Map(),
        };

        this.processAllRecords((record, dateObj) => {
            const recordDate = new Date(dateObj.date);

            /**
             * Helper to update stats for a given category and value.
             * @param {string} category - The category ID (e.g., "publication").
             * @param {string} value - The value to update stats for (e.g., "New York Times").
             */
            const updateCategoryStats = (category, value) => {
                if (!value) return;
                const currentEntry = initialStats[category].get(value) || {
                    count: 0,
                    mostRecentDate: new Date(0), // Ensure a valid date for comparison
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
                updateCategoryStats("type", record.style); // 'type' filter category maps to 'style' field in record
            }
            updateCategoryStats("collaborator", record.collaborator);
        });
        return initialStats;
    }

    /**
     * Iterates over all records in the dataset and applies a callback function.
     * @param {function(object, object): void} callback - A function to call for each record.
     *        It receives the record object and its parent date object (which includes the date string).
     */
    processAllRecords(callback) {
        Object.values(this.data).forEach((yearData) => {
            if (!Array.isArray(yearData)) return;
            yearData.forEach((dateObj) => {
                if (!dateObj || !dateObj.records) return;
                dateObj.records.forEach((record) => callback(record, dateObj));
            });
        });
    }

    /**
     * Calculates the current counts for each filter option, considering active filters from other categories.
     * This is used to display how many records would match if a given filter option were selected.
     * @returns {Object.<string, Map<string, number>>} An object where keys are category IDs
     *          and values are Maps of filter values to their calculated counts.
     */
    getFilterCounts() {
        const counts = {
            publication: new Map(),
            size: new Map(),
            collaborator: new Map(),
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
                        dateString: dateObj.date, // Keep date context if needed later
                    })
                );
            });
        });

        // For each category, temporarily deactivate its own filters,
        // then count items that pass all *other* active filters.
        for (const category of Object.keys(this.activeFilters)) {
            const originalCategoryFilters = new Set(
                this.activeFilters[category]
            );
            this.activeFilters[category].clear(); // Temporarily clear filters for the category being counted

            for (const record of allRecordsWithDate) {
                if (this.recordPassesFilters(record)) {
                    // Determine the correct field in the record for the current category
                    let valueToCount = record[this.getRecordFieldForCategory(category)];
                    
                    if (valueToCount) {
                        // Size and type filters/counts only apply to puzzle records
                        if (
                            (category === "size" || category === "type") &&
                            record.category !== "puzzle"
                        ) {
                            // Skip counting non-puzzle records for size/type filters
                        } else {
                            counts[category].set(
                                valueToCount,
                                (counts[category].get(valueToCount) || 0) + 1
                            );
                        }
                    }
                }
            }
            this.activeFilters[category] = originalCategoryFilters; // Restore original filters
        }
        return counts;
    }

    /**
     * Maps a filter category ID to the corresponding field name in a record object.
     * @param {string} category - The filter category ID (e.g., "type").
     * @returns {string} The corresponding record field name (e.g., "style").
     */
    getRecordFieldForCategory(category) {
        switch (category) {
            case "publication":
                return "publication";
            case "size":
                return "size";
            case "collaborator":
                return "collaborator";
            case "type": // The 'type' filter category corresponds to the 'style' field in records
                return "style";
            default:
                return category;
        }
    }

    /**
     * Checks if a single record passes all currently active filters.
     * @param {object} record - The record object to check.
     * @returns {boolean} True if the record passes all filters, false otherwise.
     */
    recordPassesFilters(record) {
        // Publication filter
        if (
            this.activeFilters.publication.size > 0 &&
            !this.activeFilters.publication.has(record.publication)
        ) {
            return false;
        }

        // Size filter: if active, non-puzzle records or non-matching puzzles are excluded
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
            this.activeFilters.collaborator.size > 0 &&
            (!record.collaborator ||
                !this.activeFilters.collaborator.has(record.collaborator))
        ) {
            return false;
        }

        // Type filter: if active, non-puzzle records or non-matching puzzles are excluded
        if (this.activeFilters.type.size > 0) {
            if (
                record.category !== "puzzle" ||
                !this.activeFilters.type.has(record.style) // 'type' filter uses 'style' field
            ) {
                return false;
            }
        }
        return true;
    }

    /**
     * Filters the entire dataset based on the current active filters.
     * @returns {object} A new data object where each date object has a `filtered` property
     *          (true if the date should be visually deemphasized, false otherwise).
     */
    getFilteredData() {
        const filteredData = {};
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

                if (!hasAnyActiveFilters) {
                    return { ...date, filtered: false }; // No filters active, nothing is filtered
                }

                // A date is considered "filtered out" if none of its records pass the active filters.
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

    /**
     * Sets the active filter values for a specific category.
     * @param {string} category - The category ID to update.
     * @param {string[]} values - An array of values to set as active for the category.
     */
    setFilter(category, values) {
        this.activeFilters[category] = new Set(values);
    }

    /**
     * Clears all active filters for a specific category.
     * @param {string} category - The category ID to clear.
     */
    clearFilter(category) {
        this.activeFilters[category].clear();
    }

    /**
     * Clears all active filters across all categories.
     */
    clearAllFilters() {
        Object.keys(this.activeFilters).forEach((category) => {
            this.activeFilters[category].clear();
        });
    }
}

// Styles will be moved to calendar-styles.css
// const style = document.createElement("style");
// style.textContent = \` ... \`; // Styles removed from here
// document.head.appendChild(style);

/**
 * Creates and populates the filter UI controls within a given container.
 * @param {HTMLElement} container - The HTML element to append the filter controls to.
 * @param {FilterSystem} filterSystem - An instance of the FilterSystem.
 * @param {function(): void} onFilterChange - Callback function to execute when filter selections change.
 */
function populateFilterControls(container, filterSystem, onFilterChange) {
    // Remove any existing controls and the global click listener to prevent duplicates
    // if this function is called multiple times.
    container.querySelectorAll(".filter-wrapper").forEach((el) => el.remove());
    if (populateFilterControls.clickOutsideListener) {
        document.removeEventListener(
            "click",
            populateFilterControls.clickOutsideListener
        );
        populateFilterControls.clickOutsideListener = null; // Clear the stored listener
    }

    const filterWrapper = document.createElement("div");
    filterWrapper.className = "filter-wrapper";

    const clearAllContainer = document.createElement("div");
    clearAllContainer.className = "clear-all-container";
    const clearAllLink = document.createElement("a");
    clearAllLink.className = "clear-all-link";
    clearAllLink.href = "#";
    clearAllLink.textContent = "Clear all filters";
    clearAllLink.addEventListener("click", (e) => {
        e.preventDefault();
        // Uncheck all checkboxes within this filter UI instance
        filterWrapper
            .querySelectorAll('input[type="checkbox"]')
            .forEach((checkbox) => {
                checkbox.checked = false;
            });
        // Reset all dropdown button texts
        filterWrapper.querySelectorAll(".dropdown-button").forEach((button) => {
            button.textContent = "Showing all";
        });
        filterSystem.clearAllFilters();
        onFilterChange(); // Notify that filters have changed
    });
    clearAllContainer.appendChild(clearAllLink);
    filterWrapper.appendChild(clearAllContainer);

    const filterControls = document.createElement("div");
    filterControls.className = "filter-controls";

    // Use the module-level constant for categories
    FILTER_CATEGORIES.forEach((category) => {
        const filterColumn = createFilterDropdown(
            category,
            filterSystem,
            onFilterChange,
            filterControls // Pass filterControls for inter-dropdown communication
        );
        filterControls.appendChild(filterColumn);
    });
    
    filterWrapper.appendChild(filterControls);
    container.insertBefore(filterWrapper, container.firstChild);

    // Setup a single document-level click listener to handle closing dropdowns
    // when a click occurs outside of any active dropdown managed by this instance.
    // This listener is stored on the function itself to allow removal if
    // populateFilterControls is called again.
    populateFilterControls.clickOutsideListener = (event) => {
        const allDropdownContainers = filterControls.querySelectorAll(
            ".dropdown-container" // Query within the current filterControls instance
        );
        allDropdownContainers.forEach((dropdownContainer) => {
            const dropdownContent =
                dropdownContainer.querySelector(".dropdown-content");
            if (
                dropdownContent &&
                dropdownContent.classList.contains("show") &&
                !dropdownContainer.contains(event.target) // Click was outside this specific dropdown
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

/**
 * Creates a single filter dropdown column for a given category.
 * @param {{id: string, label: string}} category - The category object (from FILTER_CATEGORIES).
 * @param {FilterSystem} filterSystem - The FilterSystem instance.
 * @param {function(): void} onFilterChange - Callback for when a filter selection changes.
 * @param {HTMLElement} filterControls - The parent element containing all filter dropdowns,
 *                                       used for closing other dropdowns when one is opened.
 * @returns {HTMLElement} The created filter column element.
 */
function createFilterDropdown(
    category,
    filterSystem,
    onFilterChange,
    filterControls // Used to find sibling dropdowns
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
        // Sort entries first by count (descending), then by most recent date (descending)
        const sortedEntries = Array.from(categoryStats.entries()).sort(
            ([, statsA], [, statsB]) => {
                const countDiff = statsB.count - statsA.count;
                if (countDiff !== 0) return countDiff;
                return statsB.mostRecentDate - statsA.mostRecentDate;
            }
        );

        sortedEntries.forEach(([value, { count }]) => {
            if (!value) return; // Skip if value is null or empty

            const option = document.createElement("div");
            option.className = "dropdown-option";

            const checkbox = document.createElement("input");
            checkbox.type = "checkbox";
            checkbox.id = `${category.id}-${value}`; // Ensure unique ID
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
                if (checkbox.checked) {
                    currentFilters.add(value);
                } else {
                    currentFilters.delete(value);
                }
                updateDropdownButton(
                    dropdownButton,
                    category.id,
                    currentFilters
                );
                onFilterChange(); // Notify that filters have changed
            });
        });
    }

    dropdownContainer.appendChild(dropdownContent);
    column.appendChild(dropdownContainer);

    // Event listener for the dropdown button to toggle its content visibility
    dropdownButton.addEventListener("click", (e) => {
        e.stopPropagation(); // Prevent the document click listener from immediately closing it
        
        // Close other open dropdowns within this filter UI instance
        filterControls
            .querySelectorAll(".dropdown-content.show")
            .forEach((content) => {
                if (content !== dropdownContent) { // Don't close the current one
                    content.classList.remove("show");
                }
            });
        // Toggle the current dropdown
        dropdownContent.classList.toggle("show");
    });
    return column;
}

/**
 * Updates the text of a dropdown button based on the active filters for its category.
 * @param {HTMLButtonElement} button - The dropdown button element to update.
 * @param {string} categoryId - The ID of the filter category.
 * @param {Set<string>} activeFilters - The Set of active filter values for this category.
 */
function updateDropdownButton(button, categoryId, activeFilters) {
    if (activeFilters.size === 0) {
        button.textContent = "Showing all";
    } else {
        // Display selected items, potentially truncating if too long (CSS would handle truncation)
        button.textContent = `Showing ${activeFilters.size} ${activeFilters.size === 1 ? categoryId : categoryId + "s"}`;
    }
}

export { FilterSystem, populateFilterControls };
