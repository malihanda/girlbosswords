async function loadChartData() {
    try {
        const response = await fetch('data.json');
        const publications = await response.json();
        const data = processPublications(publications);
        renderChart(data);
    } catch (error) {
        console.error('Error loading chart data:', error);
    }
}

function processPublications(publications) {
    const data = {};
    const today = new Date();
    const currentYear = today.getFullYear();
    const todayString = today.toISOString().split('T')[0];
    
    // Group publications by year and date
    publications.forEach(pub => {
        const dateStr = pub['publish date'];
        const year = parseInt(dateStr.split('-')[0]);
        
        if (!data[year]) {
            data[year] = {};
        }
        
        if (!data[year][dateStr]) {
            data[year][dateStr] = {
                date: dateStr,
                publications: [],
                colorway: 1 // default color
            };
        }
        
        data[year][dateStr].publications.push(pub);
        // Set color based on publication size
        const hasFullSize = data[year][dateStr].publications.some(p => p.size === 'full-size');
        data[year][dateStr].colorway = hasFullSize ? 3 : data[year][dateStr].publications.length > 0 ? 2 : 1;
    });
    
    // Get unique years from publications and ensure current year is included
    const years = new Set([...Object.keys(data), currentYear.toString()]);
    
    // Convert to calendar format with placeholders
    const calendarData = {};
    years.forEach(yearStr => {
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
                    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                    
                    // Skip dates after today for current year
                    if (year === currentYear && dateStr > todayString) {
                        break;
                    }
                    
                    calendarData[year].push(dates[dateStr] || {
                        date: dateStr,
                        publications: [],
                        colorway: 1
                    });
                }
            }
        }
    });
    
    return calendarData;
}

function renderChart(data) {
    const container = document.getElementById('chart-container');
    container.innerHTML = ''; // Clear any existing content
    
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const dayLabels = ['Su', 'M', 'T', 'W', 'Th', 'F', 'S'];
    const today = new Date();
    const currentYear = today.getFullYear();
    const todayString = today.toISOString().split('T')[0];
    
    // Sort years in descending order, only including years with data and current year
    const yearsWithData = Object.keys(data).filter(year => {
        // Include if it has any non-empty dates or if it's the current year and has any dates
        const hasData = data[year].some(date => date !== null && date.publications.length > 0);
        return hasData || (parseInt(year) === currentYear && data[year].some(date => date !== null));
    });
    const sortedYears = yearsWithData.sort((a, b) => b - a);
    
    // Create a section for each year
    sortedYears.forEach(year => {
        const dates = data[year];
        const yearSection = document.createElement('div');
        yearSection.className = 'year-section';
        
        // Add year label
        const yearLabel = document.createElement('h2');
        yearLabel.textContent = year;
        yearSection.appendChild(yearLabel);
        
        // Create grid for this year
        const grid = document.createElement('div');
        grid.className = 'publication-grid';
        
        // Add day labels in first column
        dayLabels.forEach((day, i) => {
            const labelCell = document.createElement('div');
            labelCell.className = 'label-cell';
            labelCell.textContent = day;
            labelCell.style.gridRow = (i + 2).toString();
            labelCell.style.gridColumn = '1';
            grid.appendChild(labelCell);
        });
        
        // Calculate month label positions
        const monthPositions = new Map();
        let dayCount = 0; // Count of days including the offset
        const firstDayOffset = new Date(year, 0, 1).getDay();
        dayCount = firstDayOffset;
        
        for (let month = 0; month < 12; month++) {
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-01`;
            // Skip months after today for current year
            if (parseInt(year) === currentYear && dateStr > todayString) {
                continue;
            }
            
            // Calculate column based on accumulated days
            const columnIndex = Math.floor(dayCount / 7) + 2; // +2 for day labels column
            monthPositions.set(month, columnIndex);
            
            // Add days in this month to the count
            const daysInMonth = new Date(year, month + 1, 0).getDate();
            dayCount += daysInMonth;
        }
        
        // Add month labels
        monthPositions.forEach((col, month) => {
            const monthLabel = document.createElement('div');
            monthLabel.className = 'month-label';
            monthLabel.textContent = monthNames[month];
            monthLabel.style.gridColumn = col.toString();
            grid.appendChild(monthLabel);
        });
        
        // Add date cells
        dates.forEach((date, index) => {
            const col = Math.floor(index / 7) + 2; // +2 for day labels column
            const row = (index % 7) + 2; // +2 for month labels row
            
            const cell = document.createElement('div');
            if (date === null) {
                cell.className = 'placeholder-cell';
            } else {
                cell.className = `date-cell ${date.publications.length > 0 ? 'publication-cell' : ''} color-${date.colorway}`;
                
                // Create tooltip content with publication details
                if (date.publications.length > 0) {
                    const tooltipContent = date.publications.map(pub => 
                        `${pub.publication}: ${pub.title} (${pub.size})`
                    ).join('\n');
                    cell.title = `${date.date}\n${tooltipContent}`;
                } else {
                    cell.title = date.date;
                }
            }
            
            cell.style.gridRow = row.toString();
            cell.style.gridColumn = col.toString();
            grid.appendChild(cell);
        });
        
        yearSection.appendChild(grid);
        container.appendChild(yearSection);
    });
}

// Load the chart when the page loads
document.addEventListener('DOMContentLoaded', loadChartData); 