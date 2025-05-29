/**
 * filter-system.js
 * Manages the new filter system logic and UI generation.
 */

const ANY_FILTER_VALUE = "__ANY__";

class FilterSystem {
    /**
     * @param {Array<Object>} allRecordsData - The complete dataset of records.
     * @param {Array<{id: string, label: string, includeAny?: boolean}>} filterConfig - Configuration for filters.
     */
    constructor(allRecordsData, filterConfig) {
        this.allRecordsData = allRecordsData;
        this.filterConfig = filterConfig;
        this.activeFilters = []; // Array of { categoryId: string, value: any }
        this.uniqueFilterValues = this.extractUniqueValues();
    }

    extractUniqueValues() {
        // Return arrays of unique category values sorted by frequency and recency
        const allValues = {}; // Changed back to allValues

        this.allRecordsData.sort((a, b) => new Date(b.date) - new Date(a.date));
        console.log(this.allRecordsData.slice(0, 10));
        this.filterConfig.forEach((cat) => {
            const categoryId = cat.id;
            let catValuesArray = [
                ...new Set(this.allRecordsData.map((r) => r[categoryId])),
            ].filter((r) => r);
            catValuesArray.sort(
                (a, b) =>
                    this.allRecordsData.filter((r) => r[categoryId] === b)
                        .length -
                    this.allRecordsData.filter((r) => r[categoryId] === a)
                        .length
            );
            allValues[categoryId] = catValuesArray;
        });

        return allValues;
    }

    addFilter(categoryId, value) {
        // Prevent duplicate filters
        if (
            !this.activeFilters.some(
                (f) => f.categoryId === categoryId && f.value === value
            )
        ) {
            this.activeFilters.push({ categoryId, value });
        }
    }

    removeFilter(categoryId, value) {
        this.activeFilters = this.activeFilters.filter(
            (f) => !(f.categoryId === categoryId && f.value === value)
        );
    }

    clearAllFilters() {
        this.activeFilters = [];
    }

    /**
     * Applies current filters to all .date-cell elements on the page.
     */
    applyFilters() {
        const dateCells = document.querySelectorAll(".date-cell");

        dateCells.forEach((cell) => {
            const cellRecords = JSON.parse(cell.dataset.records);

            if (this.activeFilters.length === 0) {
                cell.classList.remove("filtered");
                return;
            }

            const cellHasPassingRecord = cellRecords.some((record) =>
                this.recordPassesAllActiveFilters(record)
            );
            cell.classList.toggle("filtered", !cellHasPassingRecord);
        });
    }

    recordPassesAllActiveFilters(record) {
        // Group active filters by categoryId
        const groupedFilters = this.activeFilters.reduce((acc, f) => {
            if (!acc[f.categoryId]) {
                acc[f.categoryId] = [];
            }
            acc[f.categoryId].push(f.value);
            return acc;
        }, {});

        // Check if the record passes all active filter categories
        for (const categoryId in groupedFilters) {
            if (
                !this.recordPassesCategoryFilters(
                    record,
                    categoryId,
                    groupedFilters[categoryId]
                )
            ) {
                return false; // Fails if it doesn't pass any one of the active categories
            }
        }
        return true; // Passes all category checks
    }

    recordPassesCategoryFilters(record, categoryId, activeValuesForCategory) {
        const recordValue = record[categoryId];

        return activeValuesForCategory.some((filterValue) => {
            if (filterValue === ANY_FILTER_VALUE) {
                return !!recordValue; // Truthy check for recordValue
            }
            return recordValue === filterValue;
        });
    }
}

/**
 * Populates the filter UI controls.
 * @param {HTMLElement} containerElement - The DOM element to append the filter UI to.
 * @param {FilterSystem} filterSystem - The initialized FilterSystem instance.
 */
function populateFilterControls(containerElement, filterSystem) {
    containerElement.innerHTML = ""; // Clear previous controls

    const filterWrapper = document.createElement("div");
    filterWrapper.className = "filter-wrapper"; // Assumes CSS for .filter-wrapper exists

    // --- Clear All Filters Link ---
    const clearAllContainer = document.createElement("div");
    clearAllContainer.className = "clear-all-container";
    const clearAllLink = document.createElement("a");
    clearAllLink.className = "clear-all-link";
    clearAllLink.href = "#";
    clearAllLink.textContent = "Clear all filters";
    clearAllLink.addEventListener("click", (e) => {
        e.preventDefault();
        filterSystem.clearAllFilters();
        filterSystem.applyFilters();
        // Uncheck all checkboxes and update dropdown buttons
        const allCheckboxes = filterWrapper.querySelectorAll(
            'input[type="checkbox"]'
        );
        allCheckboxes.forEach((cb) => (cb.checked = false));
        filterSystem.filterConfig.forEach((catConfig) => {
            const button = filterWrapper.querySelector(
                `#dropdown-button-${catConfig.id}`
            );
            if (button) {
                updateDropdownButtonText(button, catConfig, filterSystem);
            }
        });
    });
    clearAllContainer.appendChild(clearAllLink);
    filterWrapper.appendChild(clearAllContainer);

    // --- Filter Dropdowns ---
    const filterControls = document.createElement("div");
    filterControls.className = "filter-controls"; // Assumes CSS for .filter-controls exists

    filterSystem.filterConfig.forEach((categoryConfig) => {
        const filterColumn = createFilterDropdown(
            categoryConfig,
            filterSystem,
            filterWrapper
        );
        filterControls.appendChild(filterColumn);
    });
    filterWrapper.appendChild(filterControls);
    containerElement.appendChild(filterWrapper);

    // --- Document Click Listener for Closing Dropdowns (reusing previous robust logic) ---
    if (populateFilterControls.clickOutsideListener) {
        document.removeEventListener(
            "click",
            populateFilterControls.clickOutsideListener
        );
    }
    populateFilterControls.clickOutsideListener = (event) => {
        const openDropdownContents = filterWrapper.querySelectorAll(
            ".dropdown-content.show"
        );
        openDropdownContents.forEach((dropdownContent) => {
            const dropdownContainer = dropdownContent.closest(
                ".dropdown-container"
            );
            if (
                dropdownContainer &&
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

/**
 * Creates a single filter dropdown.
 * @param {{id: string, label: string, includeAny?: boolean}} categoryConfig - Config for the category.
 * @param {FilterSystem} filterSystem - The FilterSystem instance.
 * @param {HTMLElement} filterWrapper - The top-level wrapper for all filters (used to find elements).
 * @returns {HTMLElement} The created filter column element.
 */
function createFilterDropdown(categoryConfig, filterSystem, filterWrapper) {
    const column = document.createElement("div");
    column.className = "filter-column"; // Assumes CSS

    const heading = document.createElement("h2");
    heading.textContent = categoryConfig.label;
    column.appendChild(heading);

    const dropdownContainer = document.createElement("div");
    dropdownContainer.className = "dropdown-container";

    const dropdownButton = document.createElement("button");
    dropdownButton.className = "dropdown-button";
    dropdownButton.id = `dropdown-button-${categoryConfig.id}`; // For updating text
    updateDropdownButtonText(dropdownButton, categoryConfig, filterSystem); // Initial text

    dropdownButton.addEventListener("click", (e) => {
        e.stopPropagation();
        const currentDropdownContent =
            dropdownContainer.querySelector(".dropdown-content");
        filterWrapper
            .querySelectorAll(".dropdown-content.show")
            .forEach((otherContent) => {
                if (otherContent !== currentDropdownContent) {
                    otherContent.classList.remove("show");
                }
            });
        if (currentDropdownContent) {
            currentDropdownContent.classList.toggle("show");
        }
    });
    dropdownContainer.appendChild(dropdownButton);

    const dropdownContent = document.createElement("div");
    dropdownContent.className = "dropdown-content";

    // "Any" option
    if (categoryConfig.includeAny) {
        const anyOptionDiv = createCheckboxOption(
            ANY_FILTER_VALUE,
            `Any ${categoryConfig.label.toLowerCase()}`,
            categoryConfig,
            filterSystem,
            dropdownButton,
            dropdownContent // Pass dropdownContent
        );
        dropdownContent.appendChild(anyOptionDiv);
    }

    // Unique value options
    const values = filterSystem.uniqueFilterValues[categoryConfig.id]
    values.forEach((value) => {
        const optionDiv = createCheckboxOption(
            value,
            String(value), // Label for the option
            categoryConfig,
            filterSystem,
            dropdownButton,
            dropdownContent // Pass dropdownContent
        );
        dropdownContent.appendChild(optionDiv);
    });

    dropdownContainer.appendChild(dropdownContent);
    column.appendChild(dropdownContainer);
    return column;
}

/**
 * Helper to create a checkbox option for a dropdown.
 * @param {*} value - The value for this checkbox.
 * @param {string} labelText - The display text for the label.
 * @param {object} categoryConfig - The configuration object for the category.
 * @param {FilterSystem} filterSystem - The FilterSystem instance.
 * @param {HTMLButtonElement} dropdownButton - The button for this dropdown (to update its text).
 * @param {HTMLElement} dropdownContentElement - The content element of this dropdown (to find sibling checkboxes).
 */
function createCheckboxOption(
    value,
    labelText,
    categoryConfig,
    filterSystem,
    dropdownButton,
    dropdownContentElement
) {
    const optionDiv = document.createElement("div");
    optionDiv.className = "dropdown-option";

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.value = value;
    checkbox.id = `filter-${categoryConfig.id}-${String(value)
        .replace(/\s+/g, "-")
        .replace(/[^a-zA-Z0-9-]/g, "")}`;
    checkbox.checked = filterSystem.activeFilters.some(
        (f) => f.categoryId === categoryConfig.id && f.value === value
    );

    const label = document.createElement("label");
    label.htmlFor = checkbox.id;
    label.textContent = labelText;

    checkbox.addEventListener("change", () => {
        const categoryId = categoryConfig.id;
        const isThisAnyCheckbox = value === ANY_FILTER_VALUE;

        if (checkbox.checked) {
            if (isThisAnyCheckbox) {
                // Uncheck all other specific checkboxes in this dropdown
                dropdownContentElement
                    .querySelectorAll('input[type="checkbox"]')
                    .forEach((cb) => {
                        if (cb !== checkbox) {
                            cb.checked = false;
                        }
                    });
                // Remove all existing filters for this category first
                filterSystem.activeFilters = filterSystem.activeFilters.filter(
                    (f) => f.categoryId !== categoryId
                );
                // Add the "Any" filter
                filterSystem.addFilter(categoryId, ANY_FILTER_VALUE);
            } else {
                // This is a specific value checkbox being checked
                // Uncheck the "Any" checkbox in this dropdown if it exists and is checked
                if (categoryConfig.includeAny) {
                    const anyCheckbox = dropdownContentElement.querySelector(
                        `input[type="checkbox"][value="${ANY_FILTER_VALUE}"]`
                    );
                    if (anyCheckbox && anyCheckbox.checked) {
                        anyCheckbox.checked = false;
                        filterSystem.removeFilter(categoryId, ANY_FILTER_VALUE); // Remove "Any" from active filters
                    }
                }
                filterSystem.addFilter(categoryId, value); // Add the specific filter
            }
        } else {
            // Checkbox is being unchecked, just remove its filter
            filterSystem.removeFilter(categoryId, value);
        }

        filterSystem.applyFilters();
        updateDropdownButtonText(dropdownButton, categoryConfig, filterSystem);
    });

    optionDiv.appendChild(checkbox);
    optionDiv.appendChild(label);
    return optionDiv;
}

/**
 * Updates the text of a dropdown button based on active filters for its category.
 */
function updateDropdownButtonText(button, categoryConfig, filterSystem) {
    const activeCategoryFilters = filterSystem.activeFilters.filter(
        (f) => f.categoryId === categoryConfig.id
    );

    if (activeCategoryFilters.length === 0) {
        button.textContent = "Showing all";
    } else {
        const hasAnyFilter = activeCategoryFilters.some(
            (f) => f.value === ANY_FILTER_VALUE
        );
        const singularLabel = categoryConfig.label.toLowerCase();
        const pluralLabel = singularLabel + "s";

        if (hasAnyFilter) {
            button.textContent = `Showing any ${singularLabel}`;
        } else {
            button.textContent = `Showing ${activeCategoryFilters.length} ${
                activeCategoryFilters.length === 1 ? singularLabel : pluralLabel
            }`;
        }
    }
}

export { FilterSystem, populateFilterControls };
