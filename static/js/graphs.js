// graph.js
// Global variables
let currentView1 = 'quarter';
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
    
    loadData();
});

function switchView(view) {
    currentView1 = view;
    document.getElementById('quarterView').classList.toggle('active', view === 'quarter');
    document.getElementById('yearView').classList.toggle('active', view === 'year');
    if (metricsData.length > 0) {
        updateGraphs();
    }
}

function loadData() {
    // First, fetch metric groups
    fetch('/get_metric_groups')
        .then(response => response.json())
        .then(groups => {
            metricGroups = groups || {};
            
            // Then fetch metrics data
            return fetch('/get_metrics_data');
        })
        .catch(error => {
            console.error('Error loading metric groups:', error);
            metricGroups = {}; // Initialize as empty if fetch fails
            return fetch('/get_metrics_data');
        })
        .then(response => response.json())
        .then(data => {
            if (!data || data.length === 0) {
                displayNoDataMessage();
                return;
            }
            metricsData = data;
            
            // If metric groups are empty, create default grouping
            if (Object.keys(metricGroups).length === 0) {
                const metrics = [...new Set(data.map(d => d.metric))];
                metrics.forEach(metric => {
                    metricGroups[metric] = "Default";
                });
            }
            const years = [...new Set(data.map(d => d.fiscal_year))].sort();
            setupYearSelector(years);
            updateGraphs();
            updateMetricCards(data);
            setupMetricCardListeners();
        })
        .catch(error => {
            console.error('Error loading data:', error);
            displayNoDataMessage();
        });
}

function setupYearSelector(years) {
    const yearSelect = document.getElementById('fiscalYearSelect');
    if (!yearSelect) return;
    
    yearSelect.innerHTML = years.map(year => 
        `<option value="${year}">AY ${year}-${parseInt(year)+1}</option>`
    ).join('');
    yearSelect.value = years[years.length - 1];
    yearSelect.addEventListener('change', function() {
        updateGraphs();
        updateMetricCards(metricsData);
    });
}

function updateGraphs() {
    if (!metricsData.length) return;
    
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
                    groupContainer.className = 'metric-group-container col-md-6 mb-4';
                    
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
                    if (currentView1 === 'year') {
                        createYearlyGraph(graphContainer.id, processYearlyData(groupData));
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
    
    if (!data || !Array.isArray(data)) {
        return result;
    }
    
    data.forEach(d => {
        if (!d || !d.metric) return; // Skip invalid data entries
        
        const metric = d.metric;
        // Get the group for this metric, or use "Other" if not found
        const group = metricGroups[metric] || "Other";

        if (group == "Other") {
            //console.log(metric);
            //console.log(metricGroups[metric]);
            //console.log(metricGroups);
        }        
        if (!result[group]) {
            result[group] = [];
        }
        
        result[group].push(d);
    });
    
    return result;
}


function processYearlyData(data) {
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

function processQuarterlyData(data, selectedYear) {
    if (!data || !Array.isArray(data)) return { metrics: [] };
    
    const metrics = [...new Set(data.map(d => d.metric))];
    const quarters = ['Q1', 'Q2', 'Q3', 'Q4'];
    
    return {
        metrics: metrics.map(metric => {
            // Process current year data with cumulative totals
            let currentYearCumulative = 0;
            const currentYear = quarters.filter(quarter => {
                const match = data.find(d => 
                    d.fiscal_year === selectedYear && 
                    d.metric === metric && 
                    d.quarter === quarter
                );
                return match !== undefined;
            }).map(quarter => {
                const match = data.find(d => 
                    d.fiscal_year === selectedYear && 
                    d.metric === metric && 
                    d.quarter === quarter
                );
                const quarterValue = match ? parseFloat(match.value) : 0;
                currentYearCumulative += quarterValue;
                
                return {
                    quarter,
                    value: currentYearCumulative,
                    quarterValue: quarterValue, // Store individual quarter value for tooltips
                    target: match?.target ? parseFloat(match.target) : 0
                };
            });
            
            // Process previous year data with cumulative totals
            let previousYearCumulative = 0;
            const previousYear = quarters.filter(quarter => {
                const match = data.find(d => 
                    d.fiscal_year === String(parseInt(selectedYear) - 1) && 
                    d.metric === metric && 
                    d.quarter === quarter
                );
                return match !== undefined;
            }).map(quarter => {
                const match = data.find(d => 
                    d.fiscal_year === String(parseInt(selectedYear) - 1) && 
                    d.metric === metric && 
                    d.quarter === quarter
                );
                const quarterValue = match ? parseFloat(match.value) : 0;
                previousYearCumulative += quarterValue;
                
                return {
                    quarter,
                    value: previousYearCumulative,
                    quarterValue: quarterValue // Store individual quarter value for tooltips
                };
            });
            
            return {
                metric,
                currentYear,
                previousYear
            };
        })
    };
}


function createQuarterlyGraph(containerId, data) {
    if (!data?.metrics?.length) return;

    const container = document.getElementById(containerId);
    if (!container) return;
    
    container.innerHTML = '';
    
    // Make the graph responsive
    const containerWidth = container.clientWidth;
    const margin = { top: 20, right: 80, bottom: 90, left: 60 };
    const width = Math.max(300, containerWidth - margin.left - margin.right);
    const height = 300 - margin.top - margin.bottom;

    const svg = d3.select(`#${containerId}`)
        .append('svg')
        .attr('width', '100%')
        .attr('height', height + margin.top + margin.bottom)
        .attr('viewBox', `0 0 ${width + margin.left + margin.right} ${height + margin.top + margin.bottom}`)
        .attr('preserveAspectRatio', 'xMidYMid meet')
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
            m.previousYear.map(d => d.value),
            m.currentYear.map(d => d.target || 0)
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
        .attr('class', 'y axis')
        .call(d3.axisLeft(y));

    // Create line generator
    const line = d3.line()
        .x(d => x(d.quarter))
        .y(d => y(d.value))
        .curve(d3.curveMonotoneX);
        
    const targetLine = d3.line()
        .x(d => x(d.quarter))
        .y(d => y(d.target || 0))
        .curve(d3.curveMonotoneX);

    const color = d3.scaleOrdinal(d3.schemeCategory10);

    // Draw graphs for each metric
    data.metrics.forEach((metricData, i) => {
        const metricGroup = svg.append('g')
            .attr('class', `metric-group-${i}`);

        // Draw line for previous year (dashed)
        metricGroup.append('path')
            .datum(metricData.previousYear)
            .attr('class', 'previous-line')
            .attr('d', line)
            .style('stroke', color(i))
            .style('stroke-dasharray', '5,5')
            .style('fill', 'none')
            .style('stroke-width', 1.5);

        // Draw line for current year (solid)
        metricGroup.append('path')
            .datum(metricData.currentYear)
            .attr('class', 'line')
            .attr('d', line)
            .style('stroke', color(i))
            .style('fill', 'none')
            .style('stroke-width', 2);

        // Draw target line if available
        if (metricData.currentYear.some(d => d.target > 0)) {
            metricGroup.append('path')
                .datum(metricData.currentYear)
                .attr('class', 'target-line')
                //.attr('d', targetLine)
                .style('stroke', color(i))
                .style('stroke-dasharray', '3,3')
                .style('fill', 'none')
                .style('stroke-width', 1.5);
        }

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
                    value: d.value,
                    quarterValue: d.quarterValue,
                    cumulative: true,
                    target: d.target
                });
            })
            .on('mouseout', function() {
                d3.select(this)
                    .attr('r', 4);
                hideTooltip();
            });
            
        // Add points for previous year (smaller and hollow)
        metricGroup.selectAll('.prev-point')
            .data(metricData.previousYear)
            .enter()
            .append('circle')
            .attr('class', 'prev-point')
            .attr('cx', d => x(d.quarter))
            .attr('cy', d => y(d.value))
            .attr('r', 3)
            .style('fill', '#fff')
            .style('stroke', color(i))
            .style('stroke-width', 1.5)
            .on('mouseover', function(event, d) {
                d3.select(this)
                    .attr('r', 5)
                    .style('transition', 'r 0.2s');
                showTooltip(event, {
                    metric: metricData.metric,
                    quarter: d.quarter,
                    value: d.value,
                    quarterValue: d.quarterValue,
                    cumulative: true,
                    previousYear: true
                });
            })
            .on('mouseout', function() {
                d3.select(this)
                    .attr('r', 3);
                hideTooltip();
            });
    });

    // Add legend below the graph with improved layout
    const legendHeight = 20;
    const legendWidth = Math.min(120, width / 2);
    const legendsPerRow = Math.max(1, Math.floor(width / legendWidth));
    
    const legend = svg.append('g')
        .attr('class', 'legend')
        .attr('transform', `translate(0, ${height + 20})`);

    // Add legend for line types first
    const lineTypeLegend = svg.append('g')
        .attr('class', 'line-type-legend')
        .attr('transform', `translate(${width - 200}, ${-margin.top/2})`);
        
    // Current year line
    lineTypeLegend.append('line')
        .attr('x1', 0)
        .attr('y1', 0)
        .attr('x2', 20)
        .attr('y2', 0)
        .style('stroke', '#666')
        .style('stroke-width', 2);
        
    lineTypeLegend.append('text')
        .attr('x', 25)
        .attr('y', 4)
        .text('Current Year')
        .style('font-size', '9px');
        
    // Previous year line
    lineTypeLegend.append('line')
        .attr('x1', 90)
        .attr('y1', 0)
        .attr('x2', 110)
        .attr('y2', 0)
        .style('stroke', '#666')
        .style('stroke-dasharray', '5,5')
        .style('stroke-width', 1.5);
        
    lineTypeLegend.append('text')
        .attr('x', 115)
        .attr('y', 4)
        .text('Previous Year')
        .style('font-size', '9px');

// Track which metrics are visible
const visibleMetrics = new Set(data.metrics.map((_, i) => i));

// Add metric legends with toggle functionality
data.metrics.forEach((metricData, i) => {
    const row = Math.floor(i / legendsPerRow);
    const col = i % legendsPerRow;
    
    const legendItem = legend.append('g')
        .attr('transform', `translate(${col * legendWidth}, ${row * legendHeight})`)
        .style('cursor', 'pointer')
        .attr('class', 'legend-item')
        .attr('data-metric-index', i)
        .on('click', function(event) {
            // If shift key is pressed, show details modal
            if (event.shiftKey) {
                showMetricGroupDetails(metricData.metric);
                return;
            }
            
            // Toggle this metric's visibility
            const metricIndex = i;
            if (visibleMetrics.has(metricIndex)) {
                // If this is the only visible metric, don't hide it
                if (visibleMetrics.size > 1) {
                    visibleMetrics.delete(metricIndex);
                    d3.select(this).classed('legend-item-inactive', true);
                }
            } else {
                visibleMetrics.add(metricIndex);
                d3.select(this).classed('legend-item-inactive', false);
            }
            
            // Update graph based on visible metrics
            updateVisibleMetrics();
        })
        .on('dblclick', function() {
            // Double-click to show only this metric
            const metricIndex = i;
            visibleMetrics.clear();
            visibleMetrics.add(metricIndex);
            
            // Update legend items appearance
            d3.selectAll('.legend-item').classed('legend-item-inactive', true);
            d3.select(this).classed('legend-item-inactive', false);
            
            // Update graph
            updateVisibleMetrics();
        });

    // Add color box
    legendItem.append('rect')
        .attr('width', 10)
        .attr('height', 10)
        .style('fill', color(i));

    // Add metric name (truncated if too long)
    legendItem.append('text')
        .attr('x', 15)
        .attr('y', 9)
        .text(metricData.metric.length > 15 ? 
              metricData.metric.substring(0, 15) + '...' : 
              metricData.metric)
        .style('font-size', '10px');
});

// Add "Show All" button to legend
legend.append('g')
    .attr('transform', `translate(0, ${Math.ceil(data.metrics.length / legendsPerRow) * legendHeight + 5})`)
    .style('cursor', 'pointer')
    .on('click', function() {
        // Show all metrics
        visibleMetrics.clear();
        data.metrics.forEach((_, i) => visibleMetrics.add(i));
        
        // Update legend items appearance
        d3.selectAll('.legend-item').classed('legend-item-inactive', false);
        
        // Update graph
        updateVisibleMetrics();
    })
    .append('text')
    .attr('class', 'show-all-text')
    .text('Show All')
    .style('font-size', '10px')
    .style('font-weight', 'bold')
    .style('fill', '#007bff');

// Function to update graph based on visible metrics
function updateVisibleMetrics() {
    // Hide/show metric groups
    data.metrics.forEach((_, i) => {
        const isVisible = visibleMetrics.has(i);
        svg.select(`.metric-group-${i}`)
            .style('display', isVisible ? 'block' : 'none');
    });
    
    // Recalculate y-axis scale based on visible metrics
    const visibleValues = [];
    data.metrics.forEach((metric, i) => {
        if (visibleMetrics.has(i)) {
            visibleValues.push(
                ...metric.currentYear.map(d => d.value),
                ...metric.previousYear.map(d => d.value),
                ...metric.currentYear.map(d => d.target || 0)
            );
        }
    });
    
    // Update y-axis scale
    if (visibleValues.length > 0) {
        y.domain([0, Math.max(...visibleValues, 1) * 1.1]);
        
        // Animate transition
        svg.select('.grid')
            .transition()
            .duration(500)
            .call(d3.axisLeft(y)
                .tickSize(-width)
                .tickFormat('')
            );
            
        svg.selectAll('g.y.axis')
            .transition()
            .duration(500)
            .call(d3.axisLeft(y));
        
        // Update visible lines and points
        visibleMetrics.forEach(i => {
            const metricData = data.metrics[i];
            const metricGroup = svg.select(`.metric-group-${i}`);
            
            // Update current year line
            metricGroup.select('.line')
                .transition()
                .duration(500)
                .attr('d', line(metricData.currentYear));
                
            // Update previous year line
            metricGroup.select('.previous-line')
                .transition()
                .duration(500)
                .attr('d', line(metricData.previousYear));
                
            // Update target line if it exists
            if (metricData.currentYear.some(d => d.target > 0)) {
                metricGroup.select('.target-line')
                    .transition()
                    .duration(500)
                    //.attr('d', targetLine(metricData.currentYear));
            }
            
            // Update current year points
            metricGroup.selectAll('.point')
                .transition()
                .duration(500)
                .attr('cy', d => y(d.value));
                
            // Update previous year points
            metricGroup.selectAll('.prev-point')
                .transition()
                .duration(500)
                .attr('cy', d => y(d.value));
        });
    }
}

// Add CSS for legend items
const style = document.createElement('style');
style.textContent = `
    .legend-item-inactive rect {
        opacity: 0.3;
    }
    .legend-item-inactive text {
        opacity: 0.5;
    }
    .show-all-text:hover {
        text-decoration: underline;
    }
`;
document.head.appendChild(style);


    // Add a "View Details" button
    const detailsButton = document.createElement('button');
    detailsButton.className = 'btn btn-sm btn-outline-primary mt-2';
    detailsButton.textContent = 'View Details Table';
    detailsButton.onclick = function() {
        const groupName = containerId.split('-').pop().replace(/-/g, ' ');
        showMetricGroupDetailsTable(groupName, data.metrics);
    };
    container.appendChild(detailsButton);
    
    // Add resize handler for responsiveness
    const resizeGraph = function() {
        const newWidth = container.clientWidth;
        svg.attr('width', newWidth);
    };
    
    window.addEventListener('resize', resizeGraph);
}


function createYearlyGraph(containerId, data) {
    if (!data?.metrics?.length) return;

    const container = document.getElementById(containerId);
    if (!container) return;
    
    container.innerHTML = '';
    
    // Make the graph responsive
    const containerWidth = container.clientWidth;
    const margin = { top: 20, right: 20, bottom: 90, left: 60 };
    const width = Math.max(300, containerWidth - margin.left - margin.right);
    const height = 250 - margin.top - margin.bottom;

    const svg = d3.select(`#${containerId}`)
        .append('svg')
        .attr('width', '100%')
        .attr('height', height + margin.top + margin.bottom)
        .attr('viewBox', `0 0 ${width + margin.left + margin.right} ${height + margin.top + margin.bottom}`)
        .attr('preserveAspectRatio', 'xMidYMid meet')
        .append('g')
        .attr('transform', `translate(${margin.left},${margin.top})`);

    const years = [...new Set(data.metrics.flatMap(m => m.values.map(v => v.year)))].sort();
    
    const x = d3.scaleBand()
        .domain(years)
        .range([0, width])
        .padding(0.2);

    const y = d3.scaleLinear()
        .domain([0, d3.max(data.metrics, m => d3.max(m.values, v => v.value)) * 1.1])
        .range([height, 0]);

    // Add grid lines
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
            // Create bar group
            const barGroup = svg.append('g')
                .attr('class', 'bar-group');
            
            // Add bar
            barGroup.append('rect')
                .attr('x', x(year) + i * barWidth)
                .attr('y', y(d.value))
                .attr('width', barWidth - 2) // Small gap between bars
                .attr('height', height - y(d.value))
                .attr('rx', 3) // Rounded corners
                .attr('ry', 3)
                .style('fill', color(i))
                .style('filter', 'drop-shadow(0px 2px 2px rgba(0,0,0,0.1))')
                .on('mouseover', function(event) {
                    d3.select(this)
                        .style('opacity', 0.8)
                        .style('transition', 'all 0.2s')
                        .attr('transform', 'scale(1.05)');
                    showTooltip(event, {
                        metric: d.metric,
                        year: year,
                        value: d.value
                    });
                })
                .on('mouseout', function() {
                    d3.select(this)
                        .style('opacity', 1)
                        .attr('transform', 'scale(1)');
                    hideTooltip();
                });
                
            // Add value label on top of bar if value is significant
            if (d.value > y.domain()[1] * 0.05) {
                barGroup.append('text')
                    .attr('x', x(year) + i * barWidth + (barWidth - 2) / 2)
                    .attr('y', y(d.value) - 5)
                    .attr('text-anchor', 'middle')
                    .style('font-size', '9px')
                    .style('fill', '#333')
                    .text(d.value.toFixed(0));
            }
            
        });
    });

    // Add legend below the graph
    const legend = svg.append('g')
        .attr('class', 'legend')
        .attr('transform', `translate(0, ${height + 30})`);

    // Create legend with wrapping for long metric names
    const legendItemWidth = 120;
    const legendItemsPerRow = Math.floor(width / legendItemWidth);
    
    data.metrics.forEach((metricData, i) => {
        const row = Math.floor(i / legendItemsPerRow);
        const col = i % legendItemsPerRow;
        
        const legendItem = legend.append('g')
            .attr('transform', `translate(${col * legendItemWidth}, ${row * 20})`);

        legendItem.append('rect')
            .attr('width', 10)
            .attr('height', 10)
            .style('fill', color(i));

        legendItem.append('text')
            .attr('x', 15)
            .attr('y', 9)
            .text(metricData.metric.length > 15 ? 
                  metricData.metric.substring(0, 15) + '...' : 
                  metricData.metric)
            .style('font-size', '9px');
    });
    const resizeGraph = function() {
        const newWidth = container.clientWidth;
        svg.attr('width', newWidth);
    };
    
    window.addEventListener('resize', resizeGraph);
}

    
    function showTooltip(event, data) {
    const tooltip = d3.select('body').append('div')
    .attr('class', 'tooltip')
    .style('opacity', 0);
    
    
    let content = '';
    
    if (data.quarter) {
        // Quarterly data point
        const selectedYear = document.getElementById('fiscalYearSelect').value;
        const yearLabel = data.previousYear ? 
            `Previous Year (${String(parseInt(selectedYear) - 1)})` : 
            `Current Year (${selectedYear})`;
        
            content = `
            <strong>${data.metric}</strong><br/>
            ${yearLabel}, ${data.quarter}<br/>
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
    
    
    function updateMetricCards(data) {
        const categories = [...new Set(data.map(d => d.category))];
        const selectedYear = document.getElementById('fiscalYearSelect').value;
        const previousYear = String(parseInt(selectedYear) - 1);
        
        categories.forEach(category => {
            const categoryData = data.filter(d => d.category === category);
            
            // Group by metric groups
            const metricGroups = {};
            
            categoryData.forEach(d => {
                const group = metricGroups[d.metric] || "Default";
                //console.log(group);
                if (!metricGroups[group]) {
                    metricGroups[group] = [];
                }
                metricGroups[group].push(d);
            });
            
            // Calculate scores for each group
            const groupScores = [];
            //console.log(metricGroups,Object.keys(metricGroups));
            const groupCount = Object.keys(metricGroups).length;
            const weightPerGroup = 100 / groupCount; // Equal weight distribution
            
            Object.entries(metricGroups).forEach(([group, groupData]) => {
                const currentYearData = groupData.filter(d => d.fiscal_year === selectedYear);
                const previousYearData = groupData.filter(d => d.fiscal_year === previousYear);
                
                // Calculate achievement vs targets
                let totalAchievement = 0;
                currentYearData.forEach(d => {
                    const prevValue = previousYearData.find(p => p.metric === d.metric)?.value || 0;
                    const target = prevValue>0?prevValue * 1.05:0.05;
                    // Target is previous + 5%
                    const achievement = target > 0 ? (d.value / target) : 0;
                    totalAchievement += Math.min(achievement, 1); // Cap at 100%
                    //console.log(d.metric, d.value, prevValue, target, achievement, totalAchievement,currentYearData.length,weightPerGroup);
                });
                
                // Calculate group score
                const groupScore = currentYearData.length > 0 ? 
                    (totalAchievement / currentYearData.length) * weightPerGroup : 0;
                
                groupScores.push(groupScore);
            });
            
            // Calculate total score
            const totalScore = Math.round(groupScores.reduce((sum, score) => sum + score, 0));
            
            // Calculate trend
            const currentTotal = categoryData.filter(d => d.fiscal_year === selectedYear)
                .reduce((sum, d) => sum + d.value, 0);
            const previousTotal = categoryData.filter(d => d.fiscal_year === previousYear)
                .reduce((sum, d) => sum + d.value, 0);
            
            let trendPercent = 0;
            let trendSymbol = '';
            let trendClass = '';
            
            if (previousTotal > 0) {
                trendPercent = Math.round(((currentTotal - previousTotal) / previousTotal) * 100);
                
                if (trendPercent > 0) {
                    trendSymbol = '▲';
                    trendClass = 'trend-up';
                } else if (trendPercent < 0) {
                    trendSymbol = '▼';
                    trendClass = 'trend-down';
                } else {
                    trendSymbol = '►';
                    trendClass = 'trend-constant';
                }
            }
            
            // Update DOM elements
            const valueElement = document.getElementById(`value-${category.toLowerCase().replace(/\s+/g, '-')}`);
            const trendElement = document.getElementById(`trend-${category.toLowerCase().replace(/\s+/g, '-')}`);
            
            if (valueElement) valueElement.textContent = totalScore;
            if (trendElement) {
                trendElement.textContent = `${trendSymbol} ${trendPercent}%`;
                trendElement.className = `metric-trend ${trendClass}`;
            }
        });
    }
    
    
    function setupMetricCardListeners() {
    const metricCards = document.querySelectorAll('.metric-card');
    metricCards.forEach(card => {
    card.addEventListener('click', function() {
    const category = this.querySelector('.metric-header').textContent;
    showMetricDetails(category);
    });
    });
    }
    
    function showMetricDetails(category) {
        
    const selectedYear = document.getElementById('fiscalYearSelect').value;
    const previousYear = String(parseInt(selectedYear) - 1);
    const categoryData = metricsData.filter(d => d.category === category);
    //console.log(categoryData,"-----");
    
//modal html
    const modalHtml = `
    <div class="modal fade" id="metricDetailModal" tabindex="-1" aria-hidden="true">
        <div class="modal-dialog modal-lg">
            <div class="modal-content">
                <div class="modal-header">
                    <h5 class="modal-title">${category} Details</h5>
                    <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                </div>
                <div class="table-responsive modal-body ">
                    <table class="table">
                        <thead>
                            <tr>
                                <th>Metric</th>
                                    <th>Current Value (${selectedYear})</th>
                                    <th>Previous Value (${previousYear})</th>
                                <th>Target (Prev+5%)</th>
                                <th>Achievement</th>
                                <th>Trend</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${generateMetricTableRows(categoryData, selectedYear)}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    </div>
    `;
    
    
    // Add modal to DOM and show it
    const modalContainer = document.createElement('div');
    modalContainer.innerHTML = modalHtml;
    document.body.appendChild(modalContainer);
    
    const modal = new bootstrap.Modal(document.getElementById('metricDetailModal'));
    modal.show();
    
    // Clean up when modal is hidden
    document.getElementById('metricDetailModal').addEventListener('hidden.bs.modal', function() {
        document.body.removeChild(modalContainer);
    });
    }
    
    function generateMetricTableRows(data, selectedYear) {
        const previousYear = String(parseInt(selectedYear) - 1);
        const metrics = [...new Set(data.map(d => d.metric))];
        
        return metrics.map(metric => {
            // Get all entries for this metric in the selected year and previous year
            const currentYearEntries = data.filter(d => d.fiscal_year === selectedYear && d.metric === metric);
            const previousYearEntries = data.filter(d => d.fiscal_year === previousYear && d.metric === metric);
            
            // Sum up values across all quarters for each year
            const currentValue = currentYearEntries.reduce((sum, entry) => sum + (parseFloat(entry.value) || 0), 0);
            const previousValue = previousYearEntries.reduce((sum, entry) => sum + (parseFloat(entry.value) || 0), 0);
            
            // Calculate target as previous year + 5%
            const target = previousValue>0?previousValue * 1.05:0.05;
            
            
            // Calculate achievement percentage
            const achievement = target > 0 ? (currentValue / target) * 100 : 0;
            
            // Determine trend
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
            
            // Calculate percent change, handling division by zero
            const percentChange = previousValue !== 0 ? 
                ((currentValue - previousValue) / previousValue) * 100 : 
                (currentValue > 0 ? 100 : 0);
            
            return `
            <tr>
                <td>${metric}</td>
                <td>${currentValue.toFixed(2)}</td>
                <td>${previousValue.toFixed(2)}</td>
                <td>${target.toFixed(2)}</td>
                <td>${achievement.toFixed(1)}%</td>
                <td class="${trendClass}">${trendSymbol} ${Math.abs(percentChange).toFixed(1)}%</td>
            </tr>
            `;
        }).join('');
    }
    
    function showMetricGroupDetailsTable(groupName, metrics) {
        
        const selectedYear = document.getElementById('fiscalYearSelect').value;
        const previousYear = String(parseInt(selectedYear) - 1);
        // Create modal HTML
        const modalHtml = `
<div class="modal fade" id="metricGroupDetailModal" tabindex="-1" aria-hidden="true">
    <div class="modal-dialog modal-lg">
        <div class="modal-content">
            <div class="modal-header">
                <h5 class="modal-title">${groupName} Details</h5>
                <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
            </div>
            <div class="table-responsive modal-body">
                <table class=" table">
                    <thead>
                        <tr>
                            <th>Metric</th>
                            <th>Current Value (${selectedYear})</th>
                            <th>Previous Value (${previousYear})</th>
                            <th>Target (Prev+5%)</th>
                            <th>Achievement</th>
                            <th>Trend</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${generateMetricGroupTableRows(metrics, selectedYear)}
                    </tbody>
                </table>
            </div>
        </div>
    </div>
</div>
`;

        
        // Add modal to DOM and show it
        const modalContainer = document.createElement('div');
        modalContainer.innerHTML = modalHtml;
        document.body.appendChild(modalContainer);
        
        const modal = new bootstrap.Modal(document.getElementById('metricGroupDetailModal'));
        modal.show();
        
        // Clean up when modal is hidden
        document.getElementById('metricGroupDetailModal').addEventListener('hidden.bs.modal', function() {
            document.body.removeChild(modalContainer);
        });
    }
    
    function generateMetricGroupTableRows(metrics, selectedYear) {
        const previousYear = String(parseInt(selectedYear) - 1);
        const quarters = ['Q1', 'Q2', 'Q3', 'Q4'];
        
        return metrics.map(metric => {
            // Calculate current and previous year totals
            const currentYear = metric.currentYear.filter(d => d.quarterValue > 0);
            const previousYear = metric.previousYear.filter(d => d.quarterValue > 0);
            // Calculate current and previous year totals
            const currentTotal = metric.currentYear.reduce((sum, q) => sum + (parseFloat(q.value) || 0), 0);
            const previousTotal = metric.previousYear.reduce((sum, q) => sum + (parseFloat(q.value) || 0), 0);

            const targetTotal = previousTotal > 0 ? previousTotal * 1.05 : 0.05;
            //console.log(currentTotal,previousTotal,targetTotal);
            
            // Calculate achievement percentage
            const achievement = targetTotal > 0 ? (currentTotal / targetTotal) * 100 : 0;
            
            // Determine trend for total
            let trendSymbol = '';
            let trendClass = '';
            
            if (currentTotal > previousTotal) {
                trendSymbol = '▲';
                trendClass = 'trend-up';
            } else if (currentTotal < previousTotal) {
                trendSymbol = '▼';
                trendClass = 'trend-down';
            } else {
                trendSymbol = '►';
                trendClass = 'trend-constant';
            }
            
            // Calculate percent change for total
            const percentChange = previousTotal > 0 ? 
                ((currentTotal - previousTotal) / previousTotal) * 100 : (currentTotal > 0 ? 100 : 0);
                
            // Create quarterly breakdown rows
        // Create quarterly breakdown rows
        let quarterRows = '';
        currentYear.forEach((quarterData) => {
            const previousQuarterValue = previousYear.find(d => d.quarter === quarterData.quarter)?.quarterValue || 0;
            
            // Calculate target for this quarter (previous quarter value + 5%)
            //const quarterTarget = previousQuarterValue * 1.05;
            const quarterTarget = previousQuarterValue>0?previousQuarterValue * 1.05:0.05;
            
            // Calculate achievement for this quarter
            const quarterAchievement = quarterTarget > 0 ? 
                (quarterData.quarterValue / quarterTarget) * 100 : 0;
            
            // Determine trend for this quarter
            let quarterTrendSymbol = '';
            let quarterTrendClass = '';
            
            if (quarterData.quarterValue > previousQuarterValue) {
                quarterTrendSymbol = '▲';
                quarterTrendClass = 'trend-up';
            } else if (quarterData.quarterValue < previousQuarterValue) {
                quarterTrendSymbol = '▼';
                quarterTrendClass = 'trend-down';
            } else {
                quarterTrendSymbol = '►';
                quarterTrendClass = 'trend-constant';
            }
            
            // Calculate percent change for this quarter
            const quarterPercentChange = previousQuarterValue > 0 ? 
                ((quarterData.quarterValue - previousQuarterValue) / previousQuarterValue) * 100 : 
                (quarterData.quarterValue > 0 ? 100 : 0);
            
            quarterRows += `
            <tr class="quarter-row">
                <td class="ps-4"><em>${quarterData.quarter}</em></td>
                <td>${quarterData.quarterValue.toFixed(2)}</td>
                <td>${previousQuarterValue.toFixed(2)}</td>
                <td>${quarterTarget.toFixed(2)}</td>
                <td>${quarterAchievement.toFixed(1)}%</td>
                <td class="${quarterTrendClass}">${quarterTrendSymbol} ${Math.abs(quarterPercentChange).toFixed(1)}%</td>
            </tr>
            `;
        });
        
        // Main row with totals
        return `
        <tr class="metric-main-row">
            <td><strong>${metric.metric}</strong></td>
            <td><strong>${currentYear.reduce((sum, d) => sum + d.quarterValue, 0).toFixed(2)}</strong></td>
            <td><strong>${previousYear.reduce((sum, d) => sum + d.quarterValue, 0).toFixed(2)}</strong></td>
            <td><strong>${(previousYear.reduce((sum, d) => sum + d.quarterValue, 0) > 0 ? (previousYear.reduce((sum, d) => sum + d.quarterValue, 0) * 1.05).toFixed(2) : 0.05.toFixed(2))}</strong></td>
            <td><strong>${((currentYear.reduce((sum, d) => sum + d.quarterValue, 0) / Math.max(previousYear.reduce((sum, d) => sum + d.quarterValue, 0) * 1.05, 0.05)) * 100).toFixed(1)}</strong></td>
            <td class="${trendClass}"><strong>${trendSymbol} ${Math.abs(percentChange).toFixed(1)}%</strong></td>
        </tr>
        ${quarterRows}
        `;
    }).join('');
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