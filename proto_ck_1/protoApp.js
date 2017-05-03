// async ajax call baked into d3 to grab data
// proto_ck_1a	gdelt_weblinks  gdelt_50_52
d3.json("/data/proto_ck_1a.json", function (error, graph) {
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
	this.radius = 5; //number of pixels to preserve between the SVG border and any node. Keeps nodes bounded in the space.

	this.node_index = _index(self.graph.nodes); // a lookup-index for fast operations on individual or clusters of nodes
	this.edge_index = _index(self.graph.edges); // a lookup-index for fast operations on individual or clusters of edges

	this.width = $('#graphContainer').innerWidth();
	this.height = this.width * .5;

	this.svg = svg = d3.select("svg")
    	.attr("viewBox", "0 0 " + this.width  + " " + this.height)
    	.attr("preserveAspectRatio", "xMidYMid meet");

	// d3 selection containing all edge lines
	this.link = svg.append("g")
		.selectAll("line")
		.data(graph.edges);

	// d3 selection containing all node circles
	this.node = svg.append("g")
		.selectAll("circle")
		.data(self.graph.nodes);

	// simulation actually renders the graph and handles force animations
	this.simulation = d3.forceSimulation()
		.force("link", d3.forceLink().id(function(d) { return d.id; }))
	    .force("charge", d3.forceManyBody().strength([-200])) // default strength -30
	    .force("center", d3.forceCenter(this.width / 2, this.height / 2))
		.force("x", d3.forceX(this.width / 2).strength([0.1]))
    	.force("y", d3.forceY(this.height / 2).strength([0.1]));

	// this is a list of sub-graphs and their simulations
	this.sub_graphs = [];
	this.sub_simulations = [];


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
	};

	// Modular function for declaring what to do with nodes
	this.renderNodes = function () {
		self.node = self.node.enter()
			.append("circle")
			.attr("r", function (d) {
				if (d.count) return d.count;
				return 5;
			})
            .attr("id", function (d) {
                return d.uuid;
            })
			.call(d3.drag()
				.on("start", self.dragStarted)
				.on("drag", self.dragged)
				.on("end", self.dragEnded))

			.on("click", self.onNodeClick)
			.merge(self.node);

		self.node.append("title")
			.text(function (d) { return d.label });
	};

	// Handler for node clicks; d = node datum; this = 
	this.onNodeClick = function (d) { 

		// Do all the things 
		self.toggleNodeIsActive(d);
		// self.doOtherThings(d)
		// self.doEvenMoreThings(d)
	};

	// Selecting and Deselecting Nodes
	this.toggleNodeIsActive = function (d) {
		if (typeof d.isActive === undefined) d.isActive = false; // saftey check

		d3.select(this).transition()
			.attr('r', function (d) { return d.isActive ? 5 : 15 })
			.style('fill', function (d) { return d.isActive ? 'black' : 'green' });

		d.isActive = !d.isActive; // update node state
	};

	// Modular function for declaring what to do with edges
	this.renderLinks = function () {
		self.link = self.link.enter()
			.append("line")
			.attr("stroke-width", 2)
			.merge(self.link);
	};

	// Callback function for "tick" event (entropy occuring over time!)
	this.ticked = function () {
		self.link
			.attr("x1", function (d) { return d.source.x; })
			.attr("y1", function (d) { return d.source.y; })
			.attr("x2", function (d) { return d.target.x; })
			.attr("y2", function (d) { return d.target.y; });

        // Math.max and radius calculation allow us to bound the position of the nodes within a box
        self.node
        	.attr("cx", function(d) { return d.x = Math.max(self.radius, Math.min(self.width - self.radius, d.x)); })
            .attr("cy", function(d) { return d.y = Math.max(self.radius, Math.min(self.height - self.radius, d.y)); });
	};

	// Re-apply updated node and link to simulation
	this.runSimulation = function () {
		self.simulation.nodes(self.graph.nodes).on("tick", self.ticked);
		self.simulation.force("link").links(self.graph.edges);
	};

	// Drag Start Event Handler
	this.dragStarted = function (d) {
		if (!d3.event.active) {
			self.simulation.alphaTarget(0.3).restart();
			for (i = 0; i < self.sub_simulations.length; i++) {
				self.sub_simulations[i].alphaTarget(0.3).restart();
			}
        }
		d.fx = d.x;
		d.fy = d.y;
	};

	// Drag Event Handler
	this.dragged = function (d) {
		d.fx = d3.event.x;
		d.fy = d3.event.y;
	};

	// Drag End Event Handler
	this.dragEnded = function (d) {
		if (!d3.event.active) {
			self.simulation.alphaTarget(0);
            for (i = 0; i < self.sub_simulations.length; i++) {
                self.sub_simulations[i].alphaTarget(0).restart();
            }
        }
		d.fx = null;
		d.fy = null;
	};

	this.highlightSubGraph = function (node_ids) {
		var subgraph_nodes = [];
		for (var i=0; i < node_ids.length; i++) {
			var node_id = node_ids[i];
			var node = self.node_index[node_id];
			document.getElementById(node.uuid).setAttribute("class", "selected_node");
            subgraph_nodes.push(node);
		}
		this.sub_graphs.push(subgraph_nodes);
		this.sub_simulations.push(
			d3.forceSimulation()
				.force("charge", d3.forceManyBody().strength([-15]))
                .force("x", d3.forceX(self.width * 0.8).strength([0.08]))
				.force("y", d3.forceY(self.height * 0.5).strength([0.08]))
                .nodes(subgraph_nodes)
				.on("tick", self.ticked));
    };

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
		// do things with stub data
		window.globalGraph.highlightSubGraph(data.nodes.map(function (d) { return d.id }));
	};

	this.initialize(); // kick it off!
};

function _index(objects) {
   var index = {};
   for (var i=0; i < objects.length; i++) {
	   var n = objects[i];
	   n.uuid = uuid();
	   index[n.id] = n;
   }
   return index;
}

// generates UUID v4 identifiers. Math.random() isn't a perfect RNG, but should be more than fine for our purposes
function uuid(a) {
	return a ? (a^Math.random()*16>>a/4).toString(16):([1e7]+-1e3+-4e3+-8e3+-1e11).replace(/[018]/g,uuid)
}

window.protoApp = new ProtoApp(); // new it up!


