// Export the main chart class/functionality
export class PuzzleChart {
    constructor(containerId, options = {}) {
        this.container = document.getElementById(containerId);
        this.tooltip = document.getElementById("tooltip");
        this.data = null;
        this.colorConditions = options.colorConditions || [];
        
        // Default tooltip template if none provided
        this.tooltipTemplate = options.tooltipTemplate || (date => 
            `<strong>${date.date}</strong>\n${
                date.records
                    .map(item => Object.entries(item)
                        .filter(([key, value]) => key !== 'date' && value !== '')
                        .map(([key, value]) => `${key}: ${value}`)
                        .join(', ')
                    )
                    .join('\n')
            }`
        );
    };


    async loadData(source) {
        try {
            let records;
            
            if (Array.isArray(source)) {
                records = source;
            } else if (typeof source === 'string') {
                const response = await fetch(source);
                const rawData = await response.json();
                console.log("Loaded data:", rawData);
                records = Array.isArray(rawData) ? rawData : rawData.records;
            } else {
                throw new Error("Invalid source: must be either a URL string or an array of records");
            }
            
            if (!records) {
                console.error("Data format error: Could not find records array in:", records);
                throw new Error("Invalid data format: missing records array");
            }
            
            window.chartData = { records }; // Store in consistent format
            this.data = this.processRecords(records);
            window.processedData = this.data;
            return this.data;
        } catch (error) {
            console.error("Error loading chart data:", error);
            console.error("Stack trace:", error.stack);
            return null;
        }
    };

    processRecords(records) {
        const data = {};
        const today = new Date();
        const currentYear = today.getFullYear();
        const todayString = today.toISOString().split("T")[0];
    
        function standardizeDate(dateStr) {
            if (dateStr.includes("/")) {
                const [month, day, year] = dateStr.split("/");
                return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
            }
            return dateStr;
        }
    
        records.forEach((record) => {
            const dateStr = standardizeDate(record["publish date"]);
            const year = parseInt(dateStr.split("-")[0]);
    
            if (!data[year]) {
                data[year] = {};
            }
    
            if (!data[year][dateStr]) {
                data[year][dateStr] = {
                    date: dateStr,
                    records: [],
                };
            }
    
            data[year][dateStr].records.push(record);
        });
    
        const years = new Set([...Object.keys(data), currentYear.toString()]);
        const calendarData = {};
    
        years.forEach((yearStr) => {
            const year = parseInt(yearStr);
            const dates = data[year] || {};
    
            if (Object.keys(dates).length > 0 || year === currentYear) {
                const firstDayOffset = new Date(year, 0, 1).getDay();
                calendarData[year] = Array(firstDayOffset).fill(null);
    
                for (let month = 0; month < 12; month++) {
                    const daysInMonth = new Date(year, month + 1, 0).getDate();
                    for (let day = 1; day <= daysInMonth; day++) {
                        const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                        if (year === currentYear && dateStr > todayString) {
                            break;
                        }
                        calendarData[year].push(dates[dateStr] || {
                            date: dateStr,
                            records: [],
                        });
                    }
                }
            }
        });
    
        return calendarData;
    };

    render() {
        if (!this.colorConditions || this.colorConditions.length === 0) {
            console.warn('No color conditions set. Cells will have no color classes.');
        }

        this.container.innerHTML = "";
    
        Object.keys(this.data)
            .sort((a, b) => b - a)
            .forEach(year => {
                const section = this.createYearSection(year, this.data[year]);
                this.container.appendChild(section);
            });
        
        // Add tooltip handling
        this.container.addEventListener("mouseleave", () => this.hideTooltip());
    };

    createYearSection(year, dates) {
        const section = document.createElement("div");
        section.className = "year-section";
        section.appendChild(this.createLabelElement(year, "h2"));
        section.appendChild(this.createYearGrid(year, dates));
        return section;
    };

    createYearGrid(year, dates) {
        const grid = document.createElement("div");
        grid.className = "publication-grid";
    
        ["Su", "M", "T", "W", "Th", "F", "S"].forEach((day, i) => {
            const label = this.createLabelElement(day, "label-cell");
            label.style.gridRow = (i + 2).toString();
            label.style.gridColumn = "1";
            grid.appendChild(label);
        });
    
        const monthPositions = this.calculateMonthPositions(year);
        monthPositions.forEach((col, month) => {
            const label = this.createLabelElement(
                ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][month],
                "month-label"
            );
            label.style.gridColumn = col.toString();
            grid.appendChild(label);
        });
    
        dates.forEach((date, index) => {
            const cell = this.createDateCell(date, index);
            grid.appendChild(cell);
        });
    
        return grid;
    };

    createDateCell(date, index) {
        const cell = document.createElement("div");
        const col = Math.floor(index / 7) + 2;
        const row = (index % 7) + 2;
    
        if (date === null) {
            cell.className = "placeholder-cell";
        } else {
            const hasContent = date.records.length > 0;
            let colorClass = '';
            
            // Evaluate color conditions in order (for all cells, not just ones with content)
            if (this.colorConditions) {
                for (const { condition, colorClass: cls } of this.colorConditions) {
                    if (condition(date)) {
                        colorClass = cls;
                        break;
                    }
                }
            }

            cell.className = `date-cell ${hasContent ? "publication-cell" : ""} ${colorClass}`;
            this.setDateCellData(cell, date);
    
            if (hasContent) {
                this.addDateCellEventListeners(cell, date);
            }
        }
    
        cell.style.gridRow = row.toString();
        cell.style.gridColumn = col.toString();
        return cell;
    };

    setDateCellData(cell, date) {
        cell.dataset.date = date.date;
        cell.dataset.recordCount = date.records.length;
        cell.dataset.records = JSON.stringify(
            date.records.map((r) => ({
                publication: r.publication,
                category: r.category,
                size: r.size,
                hasCollaborator: !!r.collaborator,
                type: r.type,
                title: r.title,
                url: r.url
            }))
        );
    };

    addDateCellEventListeners(cell, date) {
        const tooltipContent = this.createTooltipContent(date);
        cell.addEventListener("mouseover", (e) => this.showTooltip(e, tooltipContent));
        cell.addEventListener("mouseout", () => this.hideTooltip());
        
        // Emit a custom event when a cell is clicked
        cell.addEventListener("click", () => {
            const event = new CustomEvent('cellClick', { 
                detail: { date: date.date, records: date.records }
            });
            this.container.dispatchEvent(event);
        });
    };

    createTooltipContent(date) {
        return this.tooltipTemplate(date);
    };

    showTooltip(event, content) {
        const rect = event.target.getBoundingClientRect();
        const scrollTop = window.scrollY || document.documentElement.scrollTop;
        const scrollLeft = window.scrollX || document.documentElement.scrollLeft;
    
        this.tooltip.innerHTML = content;
        this.tooltip.style.visibility = "visible";
    
        const tooltipRect = this.tooltip.getBoundingClientRect();
        let top = rect.top + scrollTop - tooltipRect.height - 10;
        let left = rect.left + scrollLeft + rect.width / 2;
    
        if (top < scrollTop) {
            top = rect.bottom + scrollTop + 10;
        }
        if (left + tooltipRect.width > window.innerWidth) {
            left = window.innerWidth - tooltipRect.width - 10;
        }
    
        this.tooltip.style.top = `${top}px`;
        this.tooltip.style.left = `${left}px`;
    };

    hideTooltip() {
        this.tooltip.style.visibility = "hidden";
    };

    createLabelElement(text, className) {
        const element = className === "h2" ? document.createElement("h2") : document.createElement("div");
        element.className = className;
        element.textContent = text;
        return element;
    };

    calculateMonthPositions(year) {
        const monthPositions = new Map();
        let dayCount = new Date(year, 0, 1).getDay();
        const today = new Date().toISOString().split("T")[0];
    
        for (let month = 0; month < 12; month++) {
            const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-01`;
            if (dateStr > today) break;
    
            monthPositions.set(month, Math.floor(dayCount / 7) + 2);
            dayCount += new Date(year, month + 1, 0).getDate();
        }
    
        return monthPositions;
    };
}