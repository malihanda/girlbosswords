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

    /**
     * Calculates the counts for all filter options.
     * For each category, counts are based on items that pass
     * all *other* active filters (i.e., filters from other categories).
     */
    getFilterCounts() {
        const allCategoryCounts = {};

        this.filterConfig.forEach((categoryConfig) => {
            const currentCategoryId = categoryConfig.id;
            const countsForThisCategory = {};
            const recordsContributingToAny = new Set(); // To count unique records for "Any"

            const activeFiltersExcludingCurrentCategory =
                this.activeFilters.filter(
                    (f) => f.categoryId !== currentCategoryId
                );

            this.allRecordsData.forEach((record) => {
                let passesOtherFilters = true;
                if (activeFiltersExcludingCurrentCategory.length > 0) {
                    const groupedOtherFilters =
                        activeFiltersExcludingCurrentCategory.reduce(
                            (acc, f) => {
                                if (!acc[f.categoryId]) {
                                    acc[f.categoryId] = [];
                                }
                                acc[f.categoryId].push(f.value);
                                return acc;
                            },
                            {}
                        );
                    for (const otherCatId in groupedOtherFilters) {
                        if (
                            !this.recordPassesCategoryFilters(
                                record,
                                otherCatId,
                                groupedOtherFilters[otherCatId]
                            )
                        ) {
                            passesOtherFilters = false;
                            break;
                        }
                    }
                }

                if (passesOtherFilters) {
                    const recordValue = record[currentCategoryId];
                    if (recordValue) {
                        countsForThisCategory[recordValue] =
                            (countsForThisCategory[recordValue] || 0) + 1;
                        // If this record has a value for the current category, it contributes to "Any"
                        recordsContributingToAny.add(record);
                    }
                }
            });

            // Store the count for the "Any" option if the category includes it
            if (categoryConfig.includeAny) {
                countsForThisCategory[ANY_FILTER_VALUE] =
                    recordsContributingToAny.size;
            }

            allCategoryCounts[currentCategoryId] = countsForThisCategory;
        });
        return allCategoryCounts;
    }
}

/**
 * Populates the filter UI controls.
 * @param {HTMLElement} containerElement - The DOM element to append the filter UI to.
 * @param {FilterSystem} filterSystem - The initialized FilterSystem instance.
 */
function populateFilterControls(containerElementId, filterSystem) {
    const containerElement = document.getElementById(containerElementId);
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
        filterSystem.applyFilters(); // Apply filters first
        updateFilterOptionCounts(filterSystem, filterWrapper); // Then update counts for all
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

    // Initial count update after all controls are populated
    updateFilterOptionCounts(filterSystem, filterWrapper);
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
    const values = filterSystem.uniqueFilterValues[categoryConfig.id];
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

    // Store the original label text without count for reconstruction
    checkbox.dataset.originalLabelText = labelText;

    const label = document.createElement("label");
    label.htmlFor = checkbox.id;
    // Initial label text set here (will be updated with counts by updateFilterOptionCounts)
    label.textContent = labelText;

    checkbox.addEventListener("change", () => {
        const categoryId = categoryConfig.id;
        const isThisAnyCheckbox = value === ANY_FILTER_VALUE;

        if (checkbox.checked) {
            if (isThisAnyCheckbox) {
                dropdownContentElement
                    .querySelectorAll('input[type="checkbox"]')
                    .forEach((cb) => {
                        if (cb !== checkbox) {
                            cb.checked = false;
                        }
                    });
                filterSystem.activeFilters = filterSystem.activeFilters.filter(
                    (f) => f.categoryId !== categoryId
                );
                filterSystem.addFilter(categoryId, ANY_FILTER_VALUE);
            } else {
                if (categoryConfig.includeAny) {
                    const anyCheckbox = dropdownContentElement.querySelector(
                        `input[type="checkbox"][value="${ANY_FILTER_VALUE}"]`
                    );
                    if (anyCheckbox && anyCheckbox.checked) {
                        anyCheckbox.checked = false;
                        filterSystem.removeFilter(categoryId, ANY_FILTER_VALUE);
                    }
                }
                filterSystem.addFilter(categoryId, value);
            }
        } else {
            filterSystem.removeFilter(categoryId, value);
        }

        filterSystem.applyFilters(); // Apply filters to the calendar/DOM
        updateDropdownButtonText(dropdownButton, categoryConfig, filterSystem); // Update the main button text
        // Update counts for all categories. Pass the main filterWrapper.
        updateFilterOptionCounts(
            filterSystem,
            dropdownContentElement.closest(".filter-wrapper")
        );
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

/**
 * Updates the count display on all filter option labels.
 * @param {FilterSystem} filterSystem
 * @param {HTMLElement} filterWrapperElement - The top-level element containing all filter controls.
 */
function updateFilterOptionCounts(filterSystem, filterWrapperElement) {
    const allCounts = filterSystem.getFilterCounts();

    filterSystem.filterConfig.forEach((categoryConfig) => {
        const categoryId = categoryConfig.id;
        const countsForThisCategory = allCounts[categoryId] || {};

        // Find the specific dropdown content for this category
        const dropdownButton = filterWrapperElement.querySelector(
            `#dropdown-button-${categoryId}`
        );
        const dropdownContentElement = dropdownButton
            ?.closest(".dropdown-container")
            ?.querySelector(".dropdown-content");

        if (!dropdownContentElement) return;

        dropdownContentElement
            .querySelectorAll(".dropdown-option")
            .forEach((optionDiv) => {
                const checkbox = optionDiv.querySelector(
                    'input[type="checkbox"]'
                );
                const label = optionDiv.querySelector("label");
                if (!checkbox || !label) return;

                const value = checkbox.value;
                const count = countsForThisCategory[value] || 0;

                // Use the stored original label text
                const originalLabelText =
                    checkbox.dataset.originalLabelText ||
                    (value === ANY_FILTER_VALUE
                        ? `Any ${categoryConfig.label.toLowerCase()}`
                        : String(value));

                label.textContent = `${originalLabelText} (${count})`;
                // Disable if count is 0 and not currently checked (to allow unchecking)
                optionDiv.classList.toggle(
                    "disabled",
                    count === 0 && !checkbox.checked
                );
            });
    });
}

export { FilterSystem, populateFilterControls };
