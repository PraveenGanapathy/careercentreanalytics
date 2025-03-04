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
    
    loadData();
});

function switchView(view) {
    currentView = view;
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
        `<option value="${year}">FY ${year}-${parseInt(year)+1}</option>`
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
                    if (currentView === 'year') {
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

function createQuarterlyGraph(containerId, data) {
    if (!data?.metrics?.length) return;

    const margin = { top: 20, right: 80, bottom: 70, left: 60 };
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
        
    const targetLine = d3.line()
        .x(d => x(d.quarter))
        .y(d => y(d.target || 0))
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

        // Draw target line if available
        if (metricData.currentYear.some(d => d.target > 0)) {
            metricGroup.append('path')
                .datum(metricData.currentYear)
                .attr('class', 'target-line')
                .attr('d', targetLine)
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
                    target: d.target
                });
            })
            .on('mouseout', function() {
                d3.select(this)
                    .attr('r', 4);
                hideTooltip();
            });
    });

    // Add legend below the graph
    const legendHeight = 20;
    const legendWidth = 120;
    const legendsPerRow = Math.min(data.metrics.length, Math.floor(width / legendWidth));
    
    const legend = svg.append('g')
        .attr('class', 'legend')
        .attr('transform', `translate(0, ${height + 20})`);

    data.metrics.forEach((metricData, i) => {
        const row = Math.floor(i / legendsPerRow);
        const col = i % legendsPerRow;
        
        const legendItem = legend.append('g')
            .attr('transform', `translate(${col * legendWidth}, ${row * legendHeight})`)
            .style('cursor', 'pointer')
            .on('click', function() {
                // Show detailed modal when legend is clicked
                showMetricGroupDetails(metricData.metric);
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

    // Add a "View Details" button
    const detailsButton = document.createElement('button');
    detailsButton.className = 'btn btn-sm btn-outline-primary mt-2';
    detailsButton.textContent = 'View Details Table';
    detailsButton.onclick = function() {
        const groupName = containerId.split('-').pop().replace(/-/g, ' ');
        showMetricGroupDetailsTable(groupName, data.metrics);
    };
    container.appendChild(detailsButton);
}


function createYearlyGraph(containerId, data) {
    if (!data?.metrics?.length) return;

    const margin = { top: 20, right: 20, bottom: 80, left: 60 };
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
                if (!metricGroups[group]) {
                    metricGroups[group] = [];
                }
                metricGroups[group].push(d);
            });
            
            // Calculate scores for each group
            const groupScores = [];
            const groupCount = Object.keys(metricGroups).length;
            const weightPerGroup = 100 / groupCount; // Equal weight distribution
            
            Object.entries(metricGroups).forEach(([group, groupData]) => {
                const currentYearData = groupData.filter(d => d.fiscal_year === selectedYear);
                const previousYearData = groupData.filter(d => d.fiscal_year === previousYear);
                
                // Calculate achievement vs targets
                let totalAchievement = 0;
                currentYearData.forEach(d => {
                    const prevValue = previousYearData.find(p => p.metric === d.metric)?.value || 0;
                    const target = prevValue * 1.05; // Target is previous + 5%
                    const achievement = target > 0 ? (d.value / target) : 0;
                    totalAchievement += Math.min(achievement, 1); // Cap at 100%
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
            const currentValue = data.find(d => d.fiscal_year === selectedYear && d.metric === metric)?.value || 0;
            const previousValue = data.find(d => d.fiscal_year === previousYear && d.metric === metric)?.value ?? 0;

            // Calculate target as previous year + 5%
            const target = previousValue * 1.05;
            
            // Calculate achievement percentage
            const achievement = target > 0 ? (currentValue / target) * 100 : 0;
            
            
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
                <td>${target.toFixed(2)}</td>
                <td>${achievement.toFixed(1)}%</td>
                <td class="${trendClass}">${trendSymbol} ${Math.abs(((currentValue - previousValue) / (previousValue || 1) * 100)).toFixed(1)}%</td>
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
                    <div class="modal-body">
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
        
        
        return metrics.map(metric => {
            // Calculate current and previous year totals
            const currentTotal = metric.currentYear.reduce((sum, q) => sum + q.value, 0);
            const previousTotal = metric.previousYear.reduce((sum, q) => sum + q.value, 0);
            const targetTotal = previousTotal * 1.05;
            
            // Calculate achievement percentage
            const achievement = targetTotal > 0 ? (currentTotal / targetTotal) * 100 : 0;
            //const targetTotal = metric.currentYear.reduce((sum, q) => sum + (q.target || 0), 0);
            //console.log(metrics);
            // Calculate achievement percentage
            //const achievement = targetTotal > 0 ? (currentTotal / targetTotal) * 100 : 0;
            
            // Determine trend
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
            
            // Calculate percent change
            const percentChange = previousTotal > 0 ? 
                ((currentTotal - previousTotal) / previousTotal) * 100 : 0;
            
            return `
            <tr>
                <td>${metric.metric}</td>
                <td>${currentTotal.toFixed(2)}</td>
                <td>${previousTotal.toFixed(2)}</td>
                <td>${targetTotal.toFixed(2)}</td>
                <td>${achievement.toFixed(1)}%</td>
                <td class="${trendClass}">${trendSymbol} ${Math.abs(percentChange).toFixed(1)}%</td>
            </tr>
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