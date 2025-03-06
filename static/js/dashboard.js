// Global variables
let currentView = 'quarter';
let metricsData = [];
let metricGroups = {};

document.addEventListener('DOMContentLoaded', function() {
    // Add toggle button listeners
    const quarterBtn = document.getElementById('quarterView');
    const yearBtn = document.getElementById('yearView');
    
    if (quarterBtn && yearBtn) {
        quarterBtn.addEventListener('click', () => switchView('quarter'));
        yearBtn.addEventListener('click', () => switchView('year'));
    }
    
    // Load data
    fetch('/get_metrics_data')
        .then(response => response.json())
        .then(data => {
            if (!data || data.length === 0) {
                displayNoDataMessage();
                return;
            }
            
            // Store data globally
            metricsData = data;
            
            // Extract metric groups from data
            extractMetricGroups(data);
            
            // Setup year selector
            const years = [...new Set(data.map(d => d.fiscal_year))].sort();
            setupYearSelector(years);
            
            // Create initial graphs
            updateGraphs();
        })
        .catch(error => {
            console.error('Error loading data:', error);
            displayNoDataMessage();
        });
});

function switchView(view) {
    currentView = view;
    document.getElementById('quarterView').classList.toggle('active', view === 'quarter');
    document.getElementById('yearView').classList.toggle('active', view === 'year');
    updateGraphs();
}

function extractMetricGroups(data) {
    // Fetch metric groups from the server
    fetch('/get_metric_groups')
        .then(response => response.json())
        .then(groups => {
            metricGroups = groups;
            updateGraphs();
        })
        .catch(error => {
            console.error('Error loading metric groups:', error);
            // If we can't get groups from server, create default grouping
            const metrics = [...new Set(data.map(d => d.metric))];
            metrics.forEach(metric => {
                // Default grouping - each metric is its own group
                metricGroups[metric] = metric;
            });
            updateGraphs();
        });
}

function setupYearSelector(years) {
    const yearSelect = document.getElementById('fiscalYearSelect');
    if (!yearSelect) return;
    
    // Clear existing options
    yearSelect.innerHTML = '';
    
    // Add new options
    years.forEach(year => {
        const option = document.createElement('option');
        option.value = year;
        option.textContent = `FY ${year}-${parseInt(year)+1}`;
        yearSelect.appendChild(option);
    });
    
    // Select the most recent year by default
    yearSelect.value = years[years.length - 1];
    
    // Add change event listener
    yearSelect.addEventListener('change', updateGraphs);
}

function updateGraphs() {
    if (!metricsData.length || Object.keys(metricGroups).length === 0) return;
    
    const selectedYear = document.getElementById('fiscalYearSelect')?.value || 
                         [...new Set(metricsData.map(d => d.fiscal_year))].sort().pop();
    
    const categories = [...new Set(metricsData.map(d => d.category))];
    
    categories.forEach(category => {
        const categoryData = metricsData.filter(d => d.category === category);
        if (categoryData.length > 0) {
            // Get the container for this category
            const containerId = `graph-${category.toLowerCase().replace(/\s+/g, '-')}`;
            const container = document.getElementById(containerId);
            
            if (container) {
                // Clear the container
                container.innerHTML = '';
                
                // Group data by MetricGroup
                const groupedByMetricGroup = groupDataByMetricGroup(categoryData);
                
                // Create a graph for each metric group
                Object.entries(groupedByMetricGroup).forEach(([group, groupData]) => {
                    // Create a container for this group
                    const groupContainer = document.createElement('div');
                    groupContainer.className = 'metric-group-container mb-4';
                    
                    // Add a title for the group
                    const groupTitle = document.createElement('h6');
                    groupTitle.className = 'metric-group-title';
                    groupTitle.textContent = group;
                    groupContainer.appendChild(groupTitle);
                    
                    // Create a container for the graph
                    const graphContainer = document.createElement('div');
                    graphContainer.id = `${containerId}-${group.toLowerCase().replace(/\s+/g, '-')}`;
                    graphContainer.className = 'graph-container';
                    groupContainer.appendChild(graphContainer);
                    
                    // Add the group container to the category container
                    container.appendChild(groupContainer);
                    
                    // Create the graph
                    if (currentView === 'year') {
                        createYearlyGraph(graphContainer.id, processYearlyData(groupData, selectedYear));
                    } else {
                        createQuarterlyGraph(graphContainer.id, processQuarterlyData(groupData, selectedYear));
                    }
                });
            }
        }
    });
}

function groupDataByMetricGroup(data) {
    const result = {};
    
    data.forEach(d => {
        const metric = d.metric;
        // Get the group for this metric, or use "Other" if not found
        const group = metricGroups[metric] || "Other";
        
        if (!result[group]) {
            result[group] = [];
        }
        
        result[group].push(d);
    });
    
    return result;
}

function processQuarterlyData(data, selectedYear) {
    if (!data || !Array.isArray(data)) return { metrics: [] };
    
    const metrics = [...new Set(data.map(d => d.metric))];
    const quarters = ['Q1', 'Q2', 'Q3', 'Q4'];
    
    return {
        metrics: metrics.map(metric => ({
            metric,
            currentYear: quarters.map(quarter => {
                const match = data.find(d => 
                    d.fiscal_year === selectedYear && 
                    d.metric === metric && 
                    d.quarter === quarter
                );
                return {
                    quarter,
                    value: match ? parseFloat(match.value) : 0
                };
            }),
            previousYear: quarters.map(quarter => {
                const match = data.find(d => 
                    d.fiscal_year === String(parseInt(selectedYear) - 1) && 
                    d.metric === metric && 
                    d.quarter === quarter
                );
                return {
                    quarter,
                    value: match ? parseFloat(match.value) : 0
                };
            })
        }))
    };
}

function processYearlyData(data, selectedYear) {
    if (!data || !Array.isArray(data)) return { metrics: [] };
    
    const metrics = [...new Set(data.map(d => d.metric))];
    const years = [...new Set(data.map(d => d.fiscal_year))].sort();
    
    return {
        metrics: metrics.map(metric => ({
            metric,
            values: years.map(year => ({
                year,
                value: data
                    .filter(d => d.fiscal_year === year && d.metric === metric)
                    .reduce((acc, d) => acc + (parseFloat(d.value) || 0), 0)
            }))
        }))
    };
}

function createQuarterlyGraph(containerId, data) {
    if (!data?.metrics?.length) return;

    const margin = { top: 20, right: 80, bottom: 50, left: 60 };
    const width = 500 - margin.left - margin.right;
    const height = 250 - margin.top - margin.bottom;

    const container = document.getElementById(containerId);
    if (!container) return;
    
    container.innerHTML = '';

    const svg = d3.select(`#${containerId}`)
        .append('svg')
        .attr('width', width + margin.left + margin.right)
        .attr('height', height + margin.top + margin.bottom)
        .append('g')
        .attr('transform', `translate(${margin.left},${margin.top})`);

    // Create scales
    const x = d3.scalePoint()
        .domain(['Q1', 'Q2', 'Q3', 'Q4'])
        .range([0, width])
        .padding(0.5);

    const allValues = data.metrics.reduce((acc, m) => {
        return acc.concat(
            m.currentYear.map(d => d.value),
            m.previousYear.map(d => d.value)
        );
    }, []);

    const y = d3.scaleLinear()
        .domain([0, Math.max(...allValues, 1) * 1.1])
        .range([height, 0]);

    // Add grid
    svg.append('g')
        .attr('class', 'grid')
        .call(d3.axisLeft(y)
            .tickSize(-width)
            .tickFormat('')
        );

    // Add axes
    svg.append('g')
        .attr('transform', `translate(0,${height})`)
        .call(d3.axisBottom(x));

    svg.append('g')
        .call(d3.axisLeft(y));

    // Create generators
    const area = d3.area()
        .x(d => x(d.quarter))
        .y0(height)
        .y1(d => y(d.value))
        .curve(d3.curveMonotoneX);

    const line = d3.line()
        .x(d => x(d.quarter))
        .y(d => y(d.value))
        .curve(d3.curveMonotoneX);

    const color = d3.scaleOrdinal(d3.schemeCategory10);

    // Draw graphs for each metric
    data.metrics.forEach((metricData, i) => {
        const metricGroup = svg.append('g')
            .attr('class', `metric-group-${i}`);

        // Draw area for previous year
        metricGroup.append('path')
            .datum(metricData.previousYear)
            .attr('class', 'area')
            .attr('d', area)
            .style('fill', color(i))
            .style('opacity', 0.2)
            .on('mouseover', function(event) {
                d3.select(this)
                    .style('opacity', 0.4)
                    .style('transition', 'opacity 0.2s');
                showTooltip(event, {
                    metric: metricData.metric,
                    year: 'Previous Year',
                    data: metricData.previousYear
                });
            })
            .on('mouseout', function() {
                d3.select(this)
                    .style('opacity', 0.2);
                hideTooltip();
            });

        // Draw line for current year
        metricGroup.append('path')
            .datum(metricData.currentYear)
            .attr('class', 'line')
            .attr('d', line)
            .style('stroke', color(i))
            .style('fill', 'none')
            .style('stroke-width', 2);

        // Add points for current year
        metricGroup.selectAll('.point')
            .data(metricData.currentYear)
            .enter()
            .append('circle')
            .attr('class', 'point')
            .attr('cx', d => x(d.quarter))
            .attr('cy', d => y(d.value))
            .attr('r', 4)
            .style('fill', color(i))
            .style('stroke', '#fff')
            .style('stroke-width', 1.5)
            .on('mouseover', function(event, d) {
                d3.select(this)
                    .attr('r', 6)
                    .style('transition', 'r 0.2s');
                showTooltip(event, {
                    metric: metricData.metric,
                    quarter: d.quarter,
                    value: d.value
                });
            })
            .on('mouseout', function() {
                d3.select(this)
                    .attr('r', 4);
                hideTooltip();
            });
    });
}

function createYearlyGraph(containerId, data) {
    if (!data?.metrics?.length) return;

    const margin = { top: 20, right: 80, bottom: 50, left: 60 };
    const width = 500 - margin.left - margin.right;
    const height = 250 - margin.top - margin.bottom;

    const container = document.getElementById(containerId);
    if (!container) return;
    
    container.innerHTML = '';

    const svg = d3.select(`#${containerId}`)
        .append('svg')
        .attr('width', width + margin.left + margin.right)
        .attr('height', height + margin.top + margin.bottom)
        .append('g')
        .attr('transform', `translate(${margin.left},${margin.top})`);

    const years = [...new Set(data.metrics.flatMap(m => m.values.map(v => v.year)))].sort();
    
    const x = d3.scaleBand()
        .domain(years)
        .range([0, width])
        .padding(0.1);

    const y = d3.scaleLinear()
        .domain([0, d3.max(data.metrics, m => d3.max(m.values, v => v.value)) * 1.1])
        .range([height, 0]);

    // Add axes
    svg.append('g')
        .attr('transform', `translate(0,${height})`)
        .call(d3.axisBottom(x));

    svg.append('g')
        .call(d3.axisLeft(y));

    const color = d3.scaleOrdinal(d3.schemeCategory10);

    // Group bars by year
    years.forEach((year, yearIndex) => {
        const yearData = data.metrics.map(m => ({
            metric: m.metric,
            value: m.values.find(v => v.year === year)?.value || 0
        }));

        // Calculate bar width based on number of metrics
        const barWidth = x.bandwidth() / yearData.length;

        // Create bars for each metric in this year
        yearData.forEach((d, i) => {
            svg.append('rect')
                .attr('x', x(year) + i * barWidth)
                .attr('y', y(d.value))
                .attr('width', barWidth)
                .attr('height', height - y(d.value))
                .style('fill', color(i))
                .on('mouseover', function(event) {
                    d3.select(this)
                        .style('opacity', 0.8)
                        .style('transition', 'opacity 0.2s');
                    showTooltip(event, {
                        metric: d.metric,
                        year: year,
                        value: d.value
                    });
                })
                .on('mouseout', function() {
                    d3.select(this)
                        .style('opacity', 1);
                    hideTooltip();
                });
        });
    });

    // Add legend
    const legend = svg.append('g')
        .attr('class', 'legend')
        .attr('transform', `translate(${width + 10}, 0)`);


data.metrics.forEach((metricData, i) => {
    const legendItem = legend.append('g')
        .attr('transform', `translate(0, ${i * 20})`);

    legendItem.append('rect')
        .attr('width', 10)
        .attr('height', 10)
        .style('fill', color(i));

    legendItem.append('text')
        .attr('x', 15)
        .attr('y', 9)
        .text(metricData.metric)
        .style('font-size', '10px');
});
}

function showTooltip(event, data) {
const tooltip = d3.select('body').append('div')
.attr('class', 'tooltip')
.style('opacity', 0);


let content = '';

if (data.quarter) {
    // Quarterly data point
    content = `
        <strong>${data.metric}</strong><br/>
        Quarter: ${data.quarter}<br/>
        Value: ${data.value.toFixed(2)}
    `;
} else if (data.year && data.data) {
    // Previous year area
    const totalValue = data.data.reduce((sum, d) => sum + d.value, 0);
    content = `
        <strong>${data.metric}</strong><br/>
        ${data.year}<br/>
        Total: ${totalValue.toFixed(2)}
    `;
} else {
    // Yearly bar
    content = `
        <strong>${data.metric}</strong><br/>
        Year: ${data.year}<br/>
        Value: ${data.value.toFixed(2)}
    `;
}

tooltip.html(content)
    .style('left', (event.pageX + 10) + 'px')
    .style('top', (event.pageY - 28) + 'px')
    .transition()
    .duration(200)
    .style('opacity', 0.9);
}

function hideTooltip() {
d3.selectAll('.tooltip')
.transition()
.duration(200)
.style('opacity', 0)
.remove();
}

function displayNoDataMessage() {
    const containers = document.querySelectorAll('.graph-container');
    containers.forEach(container => {
        container.innerHTML = `<div class="no-data-message"><h4>No Data Available</h4><p>Please add metrics data to view the graph</p></div>`;
    });
}


function getQuarterMonth(quarter) {
const quarterMap = {
'Q1': 7, // August
'Q2': 10, // November
'Q3': 1, // February
'Q4': 4 // May
};
return quarterMap[quarter] || 0;
}



// Generate table rows for metric details
function generateMetricTableRows(data, selectedYear) {
    const previousYear = String(parseInt(selectedYear) - 1);
    const metrics = [...new Set(data.map(d => d.metric))];
    
    return metrics.map(metric => {
        const currentValue = data.find(d => d.fiscal_year === selectedYear && d.metric === metric)?.value || 0;
        const previousValue = data.find(d => d.fiscal_year === previousYear && d.metric === metric)?.value || 0;
        
        let trendSymbol = '';
        let trendClass = '';
        
        if (currentValue > previousValue) {
            trendSymbol = '▲';
            trendClass = 'trend-up';
        } else if (currentValue < previousValue) {
            trendSymbol = '▼';
            trendClass = 'trend-down';
        } else {
            trendSymbol = '►';
            trendClass = 'trend-constant';
        }
        
        return `
        <tr>
            <td>${metric}</td>
            <td>${currentValue.toFixed(2)}</td>
            <td>${previousValue.toFixed(2)}</td>
            <td class="${trendClass}">${trendSymbol} ${Math.abs(((currentValue - previousValue) / (previousValue || 1) * 100)).toFixed(1)}%</td>
        </tr>
        `;
    }).join('');
}



