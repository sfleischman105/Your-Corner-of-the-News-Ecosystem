// async ajax call baked into d3 to grab data
// proto_ck_1a	gdelt_weblinks  gdelt_50_52
d3.json("reddit_data_test.json", function (error, graph) {
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

	this.doSelectNode = true;
	this.doShowSteps = true;
	this.stepCount = 5;

	this.width = $('#graphContainer').innerWidth();
	this.height = this.width * .5;

	this.svg = svg = d3.select("svg")
    	.attr("viewBox", "0 0 " + this.width  + " " + this.height)
    	.attr("preserveAspectRatio", "xMidYMid meet");

    this.graph.nodes.forEach( function(d) {
        d.links = [];
        d.distance = 0;
        d.visited = false;
    });

	// d3 selection containing all edge lines
	this.link = svg.append("g")
        .attr("class", "link")
		.selectAll(".link")
		.data(graph.edges);

    //helper function for getting counts for each node.
    self._counts = function () {
        var counts = [];
        for (var i = 0; i < self.graph.edges.length; i++) {
            counts[i] = (parseInt(self.graph.edges[i].count));
        }
        return counts;
    };

	//getting link means, stdevs
	var link_counts = self._counts();
	self.link_mean = d3.mean(link_counts);
	self.link_stdev = d3.deviation(link_counts);

	// d3 selection containing all node circles
	this.node = svg.append("g")
        .attr("class", "node")
		.selectAll(".node")
		.data(self.graph.nodes);
		//.on("mouseover", tip.show)
		//.on("mouseout", tip.hide);

	//svg.call(tip);
	

	// simulation actually renders the graph and handles force animations
	this.simulation = d3.forceSimulation()
		.force("link", d3.forceLink().distance(function (d) {
            var shift = (parseInt(d.count) - self.link_mean) / (0.01 * self.link_stdev);
            return Math.max(Math.min(50 - shift, 5), 100);
        }).strength(0.1).id(function(d) { return d.id; }))
	    .force("charge", d3.forceManyBody().strength([-250])) // default strength -30
	    .force("center", d3.forceCenter(this.width / 2, this.height / 2))
        //.force("x", d3.forceX(0).strength([0.4]))
        .force("x", d3.forceX(this.width / 2).strength([0.1]))
        //.force("y", d3.forceY(0).strength([0.4]))
		.force("y", d3.forceY(this.height / 2).strength([0.2]));


	// this is a list of sub-graphs and their simulations
	this.sub_graphs = [];
	this.sub_simulations = [];
	this.sub_graph_color_scale = d3.scaleOrdinal(d3.schemeCategory10); //support colors for up to 10 subgraphs


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
		for (var i = 0; i <self.sub_simulations.length; i++) {
			var sim = self.sub_simulations[i];
			sim.nodes([]);
			sim.stop();
		}
		self.sub_simulations = [];
        for (var i = 0; i <self.sub_graphs.length; i++) {
            var sg = self.sub_graphs[i];
            sg.clear(sg); // as a hack, have to pass itself as an argument
        }
		self.sub_graphs = [];
	};

	// Modular function for declaring what to do with nodes
	this.renderNodes = function () {
		self.node = self.node.enter()
			.append("circle")
			.attr("r", function (d) {
				if (d.count) return d.count * 8;
				return 8;
			})
			.attr("class", "node")
            .attr("id", function (d) {
                return d.uuid;
            })

            // handle dragging
			.call(d3.drag()
				.on("start", self.dragStarted)
				.on("drag", self.dragged)
				.on("end", self.dragEnded))

			// handle tooltip
			.on("mouseover", self.onNodeMouseOver)

			// Handle mouse out
			.on("mouseout", self.onNodeMouseOut)

			// handle click
			.on("click", self.onNodeClick)
			.merge(self.node);
	};


	// Eventhandler callback function for all node mouseover events
	this.onNodeMouseOver = function (d) {
		self.handleToolTipEvent(d);
	}

	this.onNodeMouseOut = function (d) {
		// d3.select('.toolTipDiv').transition().duration(200).style('opacity', 0); // hide tooltip
	}

	// Tool Tip Div Setup
	this.toolTipDiv = d3.select('#graphContainer') //select div containing svg
		.append('div')
		.attr('class', 'toolTipDiv');

	this.toolTipDiv.append('i') // add i element for close button
		.attr('class', 'close fa fa-close') // add classes for font awesome styling
		.on('click', function () { // lisent for click to hide tooltip
			d3.select('.toolTipDiv').transition().duration(200).style('opacity', 0);
		});

	this.toolTipDiv.append('h3') // h3 for title
		.attr('class', 'toolTipTitle')
			.append('a') // a within h3 for linking to domain
			.attr('target', '_blank');

	this.handleToolTipEvent = function (d) {
		// show tool tip
		d3.select('div.toolTipDiv')
			// .style('top', d.y) // not sure why these two weren't working
			// .style('left', d.x)
			.call(function(){ // so i just call ananoynous function 
				$('div.toolTipDiv').css('top', d.y).css('left',d.x); // to do it with jquery
			})
			.style('opacity', 1);

		d3.select('h3.toolTipTitle a') // Handle link url and text
			.attr('href', '//' + d.id)
			.text(d.id);
	
	}



	// Handler for node clicks; d = node datum; this = svg element
	this.onNodeClick = function (d) {
		// dijkstra!
		if (self.doShowSteps) self.dijkstra(d);
		self.toggleNodeIsActive(d, this);
	};

	// Selecting and Deselecting Nodes
	this.toggleNodeIsActive = function (d, ele) {
		if (typeof d.isActive === undefined) d.isActive = false; // saftey check

		d3.select(ele).transition().duration(200)
			.attr('r', function (d) { return d.isActive ? 8 : 15 })
			.style('fill', function (d) { return d.isActive ? 'black' : 'green' });

		d.isActive = !d.isActive; // update node state
	};

	// Modular function for declaring what to do with edges
	this.renderLinks = function () {
		self.link = self.link.enter()
			.append("line")
			.attr("stroke-width", 2)
			.attr("class", "link")
			.merge(self.link);
	};

    // Appends the list of links to each node to include links that have that node as the source
    // Called during initialization & during Reset
	this.addSources = function() {
        self.graph.edges.forEach( function(d) {
            var src = d.source;
            src.links.push(d);
        });
	};

	// Callback function for "tick" event (entropy occuring over time!)
	this.ticked = function () {
		self.link
			.attr("x1", function (d) { return d.source.x; })
			.attr("y1", function (d) { return d.source.y; })
			.attr("x2", function (d) { return d.target.x; })
			.attr("y2", function (d) { return d.target.y; });

        // Math.max and radius calculation allow us to bound the position of the nodes within a box
        // todo - convert this to using linear scales to keep nodes within box?
        self.node
        	.attr("cx", function(d) { return d.x = Math.max(self.radius, Math.min(self.width - self.radius, d.x)); })
            .attr("cy", function(d) { return d.y = Math.max(self.radius, Math.min(self.height - self.radius, d.y)); });
	};

	// Re-apply updated node and link to simulation
	this.runSimulation = function () {
		self.simulation.nodes(self.graph.nodes).on("tick", self.ticked);
		self.simulation.force("link").links(self.graph.edges);
        self.addSources();
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
                self.sub_simulations[i].alphaTarget(0);
            }
        }
		d.fx = null;
		d.fy = null;
	};



    // Color scale for the Dijkstra's
    // TODO: Fiddle around with this to Get it perfect
    // This is a PATCH color scale, just to show proof of concept
    function color(x) {
        if(x <= 0)  return "green";
        if(x <= 1)  return "lime";
        if(x <= 2)  return "gold";
        if(x <= 3)  return "orange";
        if(x <= 4)  return "salmon";
        if(x <= 5)  return "red";
        return "black";
    }

    this.firstStep = null;

    // Given a starting node, runs djikstras algorthm to determine the distances each node is from
    // the starting node. Also calls 'tick'() to change color corresponding to distance
    // Modifies the distance attribute of each node
	this.dijkstra = function(first) {
		if (typeof first === 'undefined') {
			first = self.firstStep;
			if (first === null) return false; // exit if no first
		}
		self.firstStep = first;

        // Function to change the color of each node.
        function tick() {
        	var dis;
            self.node.transition(200).style("fill", function(d) {
            	dis = d.distance;
                return color(d.distance);
            }).text(dis);
        }

        var unvisited = [];
        this.graph.nodes.forEach(function (d) {
            if (d != first) {
                d.distance = Infinity;
                unvisited.push(d);
                d.visited = false;
            }
        });

        var current = first;
        current.distance = 0;
        var done = false;
        var i = 0;

        function stepi() {
            current.visited = true;
            // current.total_distance = 0;
            current.links.forEach(function (link) {
                var tar = link.target;
                if (!tar.visited) {
                    // USE LINK.COUNT for Weights. Otherwise we use just 1 for degrees of seperation
                    // var dist = current.distance + link.count;
                    var dist = current.distance + 1;
                    tar.distance = Math.min(dist, tar.distance);
                }
            });
            tick();
            if ( i++ == self.stepCount || unvisited.length == 0 || current.distance == Infinity) {
                done = true;
                console.log('finally done?', i);
            }

            unvisited.sort(function (a, b) {
                return b.distance - a.distance
            });
            current = unvisited.pop();
        }

        // timer to update the color of the nodes evert x milliseconds
        var last = 0;
        var timer = d3.timer(function(elapsed) {
            var t = elapsed - last;
            last = elapsed;
            if(elapsed > 200) {
                if(!done) stepi();
                else  timer.stop();
            }
        });
    };

	this.highlightSubGraph = function (node_ids) {
		var subgraph_nodes = {};
		subgraph_nodes.nodes = [];
		for (var i=0; i < node_ids.length; i++) {
			var node_id = node_ids[i];
			var node = self.node_index[node_id];
			d3.select("#" + node.uuid)
				.style("fill",  self.sub_graph_color_scale(self.sub_graphs.length))
				.style("stroke-width", 3)
				.style("r", 8);
            subgraph_nodes.nodes.push(node);
		}
		subgraph_nodes.clear = function (self) {
            for (var i=0; i < self.nodes.length; i++) {
                var node = self.nodes[i];
                var elem = document.querySelector('.node');
                var style =getComputedStyle(elem);
                d3.select("#" + node.uuid)
					.style("fill", style.fill)
					.style("stroke-width", style.stroke_width)
					.style("r", style.r)
            }
		};
		this.sub_graphs.push(subgraph_nodes);
		this.sub_simulations.push(
			d3.forceSimulation()
				.force("charge", d3.forceManyBody().strength([10]))
                //.force("x", d3.forceX(self.width * 0.8).strength([0.08]))
				//.force("y", d3.forceY(self.height * 0.5).strength([0.08]))
                .nodes(subgraph_nodes.nodes)
				.on("tick", self.ticked));
    };

	// helper function for building an index of SVG elements by UUID
    function _index(objects) {
        var index = {};
        for (var i=0; i < objects.length; i++) {
            var n = objects[i];
            n.uuid = "a" + uuid();
            index[n.id] = n;
        }
        return index;
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
		this.buildStepsControl();
	},

	// Subscribe to button clicks
	this.addEventListeners = function () {
		$('#refreshGraph').on('click', this.onRefreshGraph);
		$('#addStubData').on('click', this.onAddStubData);
		$('#toggleNode').on('click', this.onToggleNode);
	},

	this.buildStepsControl = function () {
		self.stepsController = d3.select('#stepsControlContainer');

		self.stepsController.append('h3').text('Steps Control');

		self.stepsController.append('input').attr('class', 'stepsControlToggle')
			.attr('type', 'checkbox')
			.attr('checked', 'true')
			.attr('name', 'isStepsMode')
			.on('click', function (d) {
				window.globalGraph.doShowSteps = !window.globalGraph.doShowSteps;
				// console.log('self.doShowSteps', window.globalGraph.doShowSteps);
			});
		self.stepsController.append('span')
			.attr('class', 'onOff').text('on/off');


		self.stepsController.append('select')
			.attr('class', 'stepsControlSelect')
			;
		for (var i = 0; i < 30; i++) {
			self.stepsController.select('select')
				.append('option')
				.attr('value', i + 1)
				.text(i + 1);
		}

		self.stepsController.append('button')
			.attr('class', 'updateStepCount')
			.text('set steps')
			.on('click', function (d) {
				// update the state here
				window.globalGraph.stepCount = Number($('.stepsControlSelect option:selected').attr('value'));
				if (window.globalGraph.firstStep) window.globalGraph.dijkstra();
			});
	}

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
			var edges = [];

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

// generates UUID v4 identifiers. Math.random() isn't a perfect RNG, but should be more than fine for our purposes
function uuid(a) {
	return a ? (a^Math.random()*16>>a/4).toString(16):([1e7]+-1e3+-4e3+-8e3+-1e11).replace(/[018]/g,uuid)
}

window.protoApp = new ProtoApp(); // new it up!


