// Init svg
var svg = d3.select("svg"),
    width = document.getElementById('content').offsetWidth,
    height = document.getElementById('content').offsetWidth * .75;

var color = ''; // todo: make this an actual color or handle with css

// simulation actually renders the graph and handles force animations
var simulation = d3.forceSimulation()
	.force("link", d3.forceLink().id(function(d) { return d.id; }))
    .force("charge", d3.forceManyBody().strength([-250])) // default strength -30
    .force("center", d3.forceCenter(width / 2, height / 2));

// Linear Scales for node plotting, this is what is missing! https://github.com/d3/d3-scale/blob/master/README.md#_continuous
var x = d3.scaleLinear().range([0,width]);
var y = d3.scaleLinear().range([height,0]);


// async ajax call baked into d3 to grab data
// proto_ck_1a	gdelt_weblinks
d3.json("/data/proto_ck_1a.json", function (error, graph) {
 	if (error) throw error;
 	window.globalGraph = new GlobalGraph(graph);
});


// GlobalGraph object to initialize and render the global news network graph
// graph {} : json formated data retrieved by d3.json()
// graph.nodes [] : array of node objects
// graph.edges [] : array of edge objects
function GlobalGraph (graph) {
	var self = this;

	this.user = {};
	this.graph = graph;

	svg.on("click", function () {
		updateNodes(self.graph.nodes);
	});

	// d3 selection containing all edge lines
	this.link = svg.append("g") // todo: change this var name to edge?
		.attr("class", "links")
		.selectAll("line")
		.data(graph.edges)
		.enter().append("line")
		.attr("stroke-width", 2);
		// .attr("stroke-width", function(d) { return Math.sqrt(d.value); });

	// d3 selection containing all node circles
	updateNodes(self.graph.nodes)


	// should enable browswer default tooltip on over
	this.node.append("title")
		.text(function (d) { return d.id });

	// simulation driving the animation via tick callback
	simulation
		.nodes(graph.nodes)
		.on("tick", ticked);

	// not sure I quite understand this yet...
	simulation.force("link")
		.links(graph.edges);


	function updateNodes (nodes) {
		var _nodes = (self.user && self.user.history) ? updateNodeData(nodes, self.user.history) : nodes;
		console.log('updating nodes');
		self.node = svg.append("g")
			.attr("class", "nodes")
			.selectAll("circle")
			.data(_nodes)
			.enter()
			.append("circle")
			.attr("r", function (d) {
				if (d.count) return d.count;
				return 5;
			})
			.attr("fill", function (d) {
				return d.isActive ? "steelblue" : "black";
			})
			.call(d3.drag()
				.on("start", dragStarted)
				.on("drag", dragged)
				.on("end", dragEnded));


		// This seems so wrong.... whatever happened to Don't Repeat Yourself....?
		self.node.merge(self.node)
			.attr("r", function (d) {
				if (d.count) return d.count;
				return 5;
			})
			.attr("fill", function (d) {
				return d.isActive ? "steelblue" : "black";
			});

		// This doesn't seem to do anything...
		self.node.exit().remove();


	}

	function updateNodeData (gNodes, uNodes) {
		return gNodes;
	}

	// call back function for simulation tick, re-renders all nodes and edges
	function ticked () {
		self.link
			.attr("x1", function (d) { return d.source.x; })
			.attr("y1", function (d) { return d.source.y; })
			.attr("x2", function (d) { return d.target.x; })
			.attr("y2", function (d) { return d.target.y; });

		self.node
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


var userData = {
	"proflie"	: {
		"age"	: 	30,
		"gender": 	"male"
	},
	"history"	: [
		{
			"id"	: 	"nbcnews.com",
			"count"	: 	15
		},
		{
			"id"	:	"today.com",
			"count"	: 	5 
		},
		{
			"id" 	: 	"cnn.com",
			"count"	:	8
		},
		{
			"id"	: 	"bbc.co.uk",
			"count"	: 	12
		}
	]
};

