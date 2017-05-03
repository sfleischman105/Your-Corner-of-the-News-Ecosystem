// Init svg


var svg = d3.select("svg"),
    width = document.getElementById('graphContainer').offsetWidth,
	height = document.getElementById('graphContainer').offsetWidth * .75;

// svg.attr('width', width).attr('height', height);

var color = ''; // todo: make this an actual color or handle with css

// simulation actually renders the graph and handles force animations
var simulation = d3.forceSimulation()
	.force("link", d3.forceLink().id(function(d) { return d.id; }))
    .force("charge", d3.forceManyBody().strength([-250])) // default strength -30)
    .force("center", d3.forceCenter(width / 2, height / 2));


// async ajax call baked into d3 to grab data
d3.json("reddit_data_test.json", function (error, graph) {
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

	graph.nodes.forEach( function(d) {
		d.links = [];
	});

	// graph.edges.forEach( function(d) {
     //    var src = d.source;
     //    src.links.push(d);
	// });

	// d3 selection containing all node circles
	this.node = svg.append("g")
		.attr("class", "node")
		.selectAll(".node")
		.data(graph.nodes)
		.enter().append("circle")
		.on("click", function() {
			d3.select(this).attr("fill", "red")
        })
		.attr("r", function (d) {
			if (d.count) return d.count * 7;
			return 8;
		})
		.attr("fill", function (d) {
			return d.isActive ? "steelblue" : "black";
		})
		.call(d3.drag()
			.on("start", dragStarted)
			.on("drag", dragged)
			.on("end", dragEnded));


    // d3 selection containing all edge lines
    this.link = svg.append("g") // todo: change this var name to edge?
        .attr("class", "link")
        .selectAll(".link")
        .data(graph.edges)
        .enter().append("line")
        .attr("stroke-width", 2);
    // .attr("stroke-width", function(d) { return Math.sqrt(d.count); });

    // d3.selectAll(".link").call(update_node_src);
    //
    // function update_node_src() {
		// var src = self.source;
		// src.links.push(self);
    // }

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

	this.node.on("mouseover", function() {
		d3.select(this)
			.attr("r",10)
	});

    this.node.on("mouseout", function() {
        d3.select(this)
            .attr("r",7)
    });

    graph.edges.forEach( function(d) {
        var src = d.source;
        src.links.push(d);
    });


    var dijkstra = d3.dijkstra()
		.nodes(this.node)
		.edges(this.edges);


    var color = d3.scaleLinear()
        .domain([0, 1000, 2500])
        .range(["green", "yellow", "red"]);

    dijkstra.on("tick", function() {
        node.style("fill", function(d) { return color(d.distance); });
    });

    dijkstra.on("end", function() {
        console.log("Hello");
    });

    this.node.on("click", dijkstra.start);


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


// ProtoApp is the frontend app controllng the front-end and integrating D3 and user interactions
function ProtoApp (options) {
	options = arguments[0] || null;

	var self = this;
	this.userData = {};

	this.initialize = function () {
		this.addEventListeners();
	},

	this.addEventListeners = function () {
		$('#refreshGraph').on('click', this.onRefreshGraph);
		$('#addStubData').on('click', this.onAddStubData);
	},

	this.onRefreshGraph = function (e) {
		// tell D3 to do it's thing
	},

	this.onAddStubData = function (e) {
		var filenameString = $('#stubDataSelect').find('option:selected').attr('value');
		var filePath = '/data/' + filenameString + '.json';

		$.get(filePath);
	}

	this.handleStubData = function (data) {
		self.userData = data;
		// console.log(data);
		// do things with stub data
	}

	this.initialize();
};

var protoApp = new ProtoApp();




