// Init svg
var svg = d3.select("svg"),
    width = +svg.attr("width"),
    height = +svg.attr("height");

var color = ''; // todo: make this an actual color or handle with css

// simulation actually renders the graph and handles force animations
var simulation = d3.forceSimulation()
	.force("link", d3.forceLink().id(function(d) { return d.id; }))
    .force("charge", d3.forceManyBody())
    .force("center", d3.forceCenter(width / 2, height / 2));


// async ajax call baked into d3 to grab data
d3.json("/data/gdelt_weblinks.json", function (error, graph) {
 	if (error) throw error;
 	window.globalGraph = new GlobalGraph(graph);
});

// GlobalGraph object to initialize and render the global news network graph
// graph {} : json formated data retrieved by d3.json()
// graph.nodes [] : array of node objects
// graph.edges [] : array of edge objects
function GlobalGraph (graph) {

	// d3 selection containing all edge lines
	var link = svg.append("g") // todo: change this var name to edge?
		.attr("class", "links")
		.selectAll("line")
		.data(graph.edges)
		.enter().append("line");
		.attr("stroke-width", function(d) { return Math.sqrt(d.value); });

	// d3 selection containing all node circles
	var node = svg.append("g")
		.attr("class", "nodes")
		.selectAll("circle")
		.data(graph.nodes)
		.enter().append("circle")
		.attr("r", 5)
		.call(d3.drag()
			.on("start", dragStarted)
			.on("drag", dragged)
			.on("end", dragEnded));

	// should enable browswer default tooltip on over
	node.append("title")
		.text(function (d) { return d.id });

	// simulation driving the animation via tick callback
	simulation
		.nodes(graph.nodes)
		.on("tick", ticked);

	// not sure I quite understand this yet...
	simulation.force("link")
		.links(graph.edges);

	// call back function for simulation tick, re-renders all nodes and edges
	function ticked () {
		link
			.attr("x1", function (d) { return d.source.x; })
			.attr("y1", function (d) { return d.source.y; })
			.attr("x2", function (d) { return d.target.x; })
			.attr("y2", function (d) { return d.target.x; });

		node
			.attr("cx", function (d) { return d.x; })
			.attr("cy", function (d) { return d.y; });
	}
}

// drag start event handler on nodes
function dragStarted (d) {
	if (!d3.event.active) simulation.alphaTarget(0.3).restart();
	d.fx = d.x;
	d.fy = d.y;
}

// drag event handler on nodes
function dragged (d) {
	d.fx = d3.event.x;
	d.fy = d3.event.y;
}

// drag end event handler on nodes
function dragEnded (d) {
	if (!d3.event.active) simulation.alphaTarget(0);
	d.fx = null;
	d.fy = null;
}