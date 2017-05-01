// Init svg
var width = $('#graphContainer').innerWidth(),
	height = width * .75,
    svg = d3.select("svg")
    .attr("viewBox", "0 0 " + width  + " " + height)
    .attr("preserveAspectRatio", "xMidYMid meet");

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
d3.json("/data/gdelt_50_52.json", function (error, graph) {
 	if (error) throw error;
 	window.protoApp.globalGraphData = $.extend(true, {}, graph);
 	window.globalGraph = new GlobalGraph(graph);
});


// GlobalGraph object to initialize and render the global news network graph
// graph {} : json formatted data retrieved by d3.json()
// graph.nodes [] : array of node objects
// graph.edges [] : array of edge objects
function GlobalGraph (graph) {
	var self = this;

	this.user = {}; // future user data
	this.graph = graph; // the data used by the simulation
	this.toggleNode = null; // for test purposes, this is a variable to contain removed node
	this.toggleNodeEdges = []; // for test purposes, this is an array to conatin removed edges


	// d3 selection containing all edge lines
	this.link = svg.append("g")
		.attr("class", "links")
		.selectAll("line")
		.data(graph.edges);

	// d3 selection containing all node circles
	this.node = svg.append("g")
		.attr("class", "nodes")
		.selectAll("circle")
		.data(self.graph.nodes);

	// simulation actually renders the graph and handles force animations
	this.simulation = d3.forceSimulation()
		.force("link", d3.forceLink().id(function(d) { return d.id; }))
	    .force("charge", d3.forceManyBody().strength([-200])) // default strength -30
	    .force("center", d3.forceCenter(width / 2, height / 2));

	// Call this function to apply manipulated data to the simulation
	this.resetSimulation = function () {
		self.node = self.node.data(self.graph.nodes); // apply data to node
		self.node.exit().remove(); // remove exit selection
		self.renderNodes(); // render the nodes

		self.link = self.link.data(self.graph.edges); // apply data to link
		self.link.exit().remove(); // remove exit selection
		self.renderLinks(); // render the edges

		self.runSimulation(); // re-define simulation
		self.simulation.alphaTarget(0.3).restart(); // reset simulation
	}

	// Modular function for declaring what to do with nodes
	this.renderNodes = function () {
		self.node = self.node.enter()
			.append("circle")
			.attr("r", function (d) {
				if (d.count) return d.count;
				return 5;
			})
			.attr("fill", function (d) {
				return d.isActive ? "steelblue" : "black";
			})
			.call(d3.drag()
				.on("start", self.dragStarted)
				.on("drag", self.dragged)
				.on("end", self.dragEnded))
			.merge(self.node);

		self.node.append("title")
			.text(function (d) { return d.id });
	}

	// Modular function for declaring what to do with edges
	this.renderLinks = function () {
		self.link = self.link.enter()
			.append("line")
			.attr("stroke-width", 2)
			.merge(self.link);
	}

	// Callback function for "tick" event (entropy occuring over time!)
	this.ticked = function () {
		self.link
			.attr("x1", function (d) { return d.source.x; })
			.attr("y1", function (d) { return d.source.y; })
			.attr("x2", function (d) { return d.target.x; })
			.attr("y2", function (d) { return d.target.y; });

		self.node
			.attr("cx", function (d) { return d.x; })
			.attr("cy", function (d) { return d.y; });
	}

	// Re-apply updated node and link to simulation
	this.runSimulation = function () {
		self.simulation.nodes(self.graph.nodes).on("tick", self.ticked);
		self.simulation.force("link").links(self.graph.edges);
	}

	// Drag Start Event Handler
	this.dragStarted = function (d) {
		if (!d3.event.active) self.simulation.alphaTarget(0.3).restart();
		d.fx = d.x;
		d.fy = d.y;
	}

	// Drag Event Handler
	this.dragged = function (d) {
		d.fx = d3.event.x;
		d.fy = d3.event.y;
	}

	// Drag End Event Handler
	this.dragEnded = function (d) {
		if (!d3.event.active) self.simulation.alphaTarget(0);
		d.fx = null;
		d.fy = null;
	}

	// Actually render the graph once everything is defined
	this.renderNodes();
	this.renderLinks();
	this.runSimulation();
}


// ProtoApp is the frontend app controllng the front-end and integrating D3 and user interactions
function ProtoApp () {

	var self = this;
	this.userData = {};
	this.globalGraphData = null;

	this.initialize = function () {
		this.addEventListeners();
	},

	// Subscribe to button clicks
	this.addEventListeners = function () {
		$('#refreshGraph').on('click', this.onRefreshGraph);
		$('#addStubData').on('click', this.onAddStubData);
		$('#toggleNode').on('click', this.onToggleNode);
	},

	// Handling Refresh Graph Button
	this.onRefreshGraph = function (e) {
		window.globalGraph.graph = $.extend(true, {}, self.globalGraphData);
		window.globalGraph.toggleNode = null;
		window.globalGraph.toggleNodeEdges.length = 0;
		window.globalGraph.resetSimulation();
	},

	// Handles button click and fetches stub data file based on selected option
	this.onAddStubData = function (e) {
		var filenameString = $('#stubDataSelect').find('option:selected').attr('value');
		var filePath = '/data/' + filenameString + '.json';

		$.ajax({
			method: "GET",
			url: filePath,
			dataType: 'json',
			error: function(req, status, exeption) { console.log(status + " " + exeption); },
			success: self.handleStubData
		});
	}

	// For testing purposes
	this.onToggleNode = function (e) {

		// If node is saved, restore it and unsave it
		if (window.globalGraph.toggleNode) {
			window.globalGraph.graph.nodes.push(window.globalGraph.toggleNode);
			window.globalGraph.graph.edges = window.globalGraph.graph.edges.concat(window.globalGraph.toggleNodeEdges);

			window.globalGraph.toggleNode = null;
			window.globalGraph.toggleNodeEdges.length = 0;

		// If no node is saved, save the node
		} else {
			window.globalGraph.toggleNode = window.globalGraph.graph.nodes.pop();
			var id = window.globalGraph.toggleNode.id;
			var edges = []

			window.globalGraph.graph.edges.forEach(function(d) {
				if (d.source.id === id || d.target.id === id) {
					window.globalGraph.toggleNodeEdges.push(d);
				} else {
					edges.push(d);
				}
			});

			window.globalGraph.graph.edges = edges;
		}

		// Rerun the simulation
		window.globalGraph.resetSimulation();
	}

	// Callback function for what to do when we graph data from external source
	this.handleStubData = function (data) {
		self.userData = data;
		console.log('ajax data', data);
		// do things with stub data
	}

	this.initialize(); // kick it off!
};

window.protoApp = new ProtoApp(); // new it up!


