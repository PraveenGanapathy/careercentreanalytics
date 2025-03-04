function createGraph(category, data) {
    const margin = {top: 20, right: 30, bottom: 30, left: 60};
    const width = 500 - margin.left - margin.right;
    const height = 300 - margin.top - margin.bottom;

    d3.select(`#graph-${category.toLowerCase().replace(/\s+/g, '-')}`).html('');

    const svg = d3.select(`#graph-${category.toLowerCase().replace(/\s+/g, '-')}`)
        .append('svg')
        .attr('width', width + margin.left + margin.right)
        .attr('height', height + margin.top + margin.bottom)
        .append('g')
        .attr('transform', `translate(${margin.left},${margin.top})`);

    const x = d3.scaleTime()
        .domain(d3.extent(data, d => d.date))
        .range([0, width]);

    const y = d3.scaleLinear()
        .domain([0, d3.max(data, d => d.value)])
        .range([height, 0]);

    const line = d3.line()
        .x(d => x(d.date))
        .y(d => y(d.value));

    svg.append('path')
        .datum(data)
        .attr('class', d => {
            const isDecline = d.some((val, i) => 
                i > 0 && val.value < d[i-1].value
            );
            return `line ${isDecline ? 'line-decline' : 'line-normal'}`;
        })
        .attr('d', line);

    svg.append('g')
        .attr('transform', `translate(0,${height})`)
        .call(d3.axisBottom(x));

    svg.append('g')
        .call(d3.axisLeft(y));
}
