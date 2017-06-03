// async ajax call baked into d3 to grab data
// proto_ck_1a	gdelt_weblinks  gdelt_50_52
d3.json("./scripts/gdelt_filtered.json", function (error, graph) {
 	if (error) throw error;
 	window.protoApp.globalGraphData = $.extend(true, {}, graph);
 	window.globalGraph = new GlobalGraph(graph);
 	window.protoApp.initialize();
});

/* ====== Constants ========= */

const DEFAULT_LINK_FORCE_STRENGTH = 4;
const DEFAULT_CHARGE_FORCE_STRENGTH = -30;
const DEFAULT_GRAVITY_FORCE_STRENGTH = 0.05;
const DEFAULT_COLLISION_FORCE_RADIUS = 3;
const DEFAULT_EDGE_CONNECTIONS = 0;
const DEFAULT_RADIUS = 9;

/* ========================== */

// {"nodes": [{"label": "lexpress.fr", "attributes": {"Modularity Class": "39", "PageRank": "6.239664438254604E-4"}, "id": "lexpress.fr"}, {} etc

// GlobalGraph object to initialize and render the global news network graph
// graph {} : json formatted data retrieved by d3.json()
// graph.nodes [] : array of node objects
// graph.edges [] : array of edge objects
function GlobalGraph (graph) {
	var self = this;


	this.graph = graph; // the data used by the simulation
	this.original_edges = this.graph.edges.slice();

	this.node_index = _index(self.graph.nodes); // a lookup-index for fast operations on individual or clusters of nodes
	this.edge_index = _index(self.graph.edges); // a lookup-index for fast operations on individual or clusters of edges

	/***** INITIAL DATA WRANGLING *****/
	// Adding fields for later filling!
    this.graph.nodes.forEach( function(d) {
        d.links = [];
        d.target_links = [];
        d.src_dst_links = [];
        d.distance = 0;
        d.visited = false;
    });

    //helper function for getting counts for each node.
    self._counts = function () {
        var counts = [];
        for (var i = 0; i < self.original_edges.length; i++) {
            counts[i] = (parseInt(self.original_edges[i].count));
        }
        return counts;
    };

    // Appends the list of links to each node to include links that have that node as the source
    // Called during initialization & during Reset
	// Also adds a combined list of src/dst nodes for djikstra's
	this.addSources = function() {
		// target_links
        self.graph.edges.forEach( function(d) {
            var src = d.source;
            src.links.push(d);
            var dst = d.target;
            dst.target_links.push(d);
        });
		self.graph.nodes.forEach( function(d) {
			d.links.forEach( function(k) {
				d.src_dst_links.push({count:(k.count), target:(k.target), source:d})
            });
			d.target_links.forEach( function(k) {
				var append = true;
				d.src_dst_links.forEach( function(m) {
					if (m.target.id == k.source.id) {
						append = false;
						m.count += k.count;
					}
				});
				if (append) {d.src_dst_links.push({count:(k.count), target:(k.source), source:d})}
			});
		});

		self.graph.nodes.forEach( function(d) {
			var arr_counts = [];
			d.src_dst_links.forEach( function(k) {
				arr_counts.push(k.count);
			});
			d.mean = d3.mean(arr_counts);
			d.st_dev = d3.deviation(arr_counts);
        });
	};

    // todo - move this to preprocessing!
	//getting link means, stdevs 
	window.link_counts = self._counts();
	self.link_mean = d3.mean(link_counts);
	self.link_stdev = d3.deviation(link_counts);


	// Global Properties
	this.width = $('#graphContainer').innerWidth();

	this.height = $('#graphControl').height(); // 30 = top and bottom padding of main.container 
	this.nodeBorderPadding = 8; //number of pixels to preserve between the SVG border and any node. Keeps nodes bounded in the space.
	

    // Simulation Master Control
	this.simulationStateControl = {
		"parameters" : {

			// Edge Parameters
			"linkForceStrength" : DEFAULT_LINK_FORCE_STRENGTH,
			"minimumEdgeCount"	: DEFAULT_EDGE_CONNECTIONS,

			// Node Parameters
			"chargeForceStrength" : DEFAULT_CHARGE_FORCE_STRENGTH,
			"collisionForceRadius": DEFAULT_COLLISION_FORCE_RADIUS,

			// Force Parameters
			"gravityForceStrength": DEFAULT_GRAVITY_FORCE_STRENGTH

		},


		// stateToStore - reference to place to stash from : self.simulationState
		// stateToApply - parameters to be applied to : self.simulationState
		switchStates : function (stateToStore, stateToApply) {
			for (param in stateToStore) {
				stateToStore[param] = self.simulationStateControl.parameters[param];
			}

			for (param in stateToApply) {
				self.simulationStateControl.parameters[param] = stateToApply[param];
			}
		}
	}


	// Final step of initailization
	this.runSimulation = function () {
        self.simulation.nodes(self.graph.nodes).on("tick", self.ticked);
		self.simulation.force("link").links(self.graph.edges);
        self.addSources();
	};

	// Restarts all Simulations
	this.restartAllSimulations = function (alpha) {
		if (typeof alpha === "undefined") alpha = 0;

		self.simulation.alphaTarget(alpha).restart();

		for (i = 0; i < self.sub_simulations.length; i++) {
			self.sub_simulations[i].alphaTarget(alpha).restart();
		}
	}


    /******  GRAVITY  ******/

	this.gravityState = {

		doGravity : false,
		activeGravityField : 'TLD',
		gravityFields : {
			'TLD': build_gravitational_field(self.graph.nodes, function (node) { return node.id.split(/\.(.+)/)[1] }, false, self.width, self.height)
		},
		previousParams : {
			"linkForceStrength" : DEFAULT_LINK_FORCE_STRENGTH,
			"chargeForceStrength" : DEFAULT_CHARGE_FORCE_STRENGTH,
			"gravityForceStrength": DEFAULT_GRAVITY_FORCE_STRENGTH
		}
	};

    this.getActiveGravityField = function () {
        return this.gravityState.gravityFields[this.gravityState.activeGravityField];
    };

    this.onToggleGravity = function (buttonEl) {

		self.gravityState.doGravity = !self.gravityState.doGravity;

        self.gravityWellLabels.attr("display", self.gravityState.doGravity ? "inline" : "none");
        var activeGravityFieldParams = self.getActiveGravityField().defaultParams;


		if ( self.gravityState.doGravity ) {
			self.simulationStateControl.switchStates(self.gravityState.previousParams, activeGravityFieldParams);

		} else {
			self.simulationStateControl.switchStates(activeGravityFieldParams, self.gravityState.previousParams);
		}

		window.protoApp.updateSliders(self.simulationStateControl.parameters);

		$(buttonEl).toggleClass('checked');
		$('span', buttonEl).text(self.gravityState.doGravity ? 'ON' : 'OFF');
		self.renderGravityWells();
		self.gravityForceUpdate();
		self.updateCenterForce();

	}

	// todo - add d3 colors for different sets of gravity wells
	this.renderGravityWells = function () {
		var data = self.gravityState.doGravity ? Object.values(self.getActiveGravityField().gravityWells) : [];
		self.gravity = svg.select("g").selectAll(".gravWell").data(data); // update selection
        self.gravity.exit().remove();
		self.gravity.enter().append("circle").attr("class", "gravWell")
            .attr("fill", "#3169ff")
            .attr("fill-opacity", 0.1)
			.attr("r", 50)
			.attr("cx", function (d) { return d.x; })
			.attr("cy", function (d) { return d.y; })
			.attr("id", function (d) { return d.id;})
            .call(d3.drag()
                .on("start", self.gravityDragStarted)
                .on("drag", self.gravityDragged)
                .on("end", self.gravityDragEnded))
            .merge(self.gravity);

        self.gravityWellLabels = svg.append("g")
            .attr("class", "gravityLabels")
            .selectAll("text")
            .data(data)
            .enter().append("text")
            .attr("class", "label")
            .text(function(d) { return d.id; })

            //handle dragging by text
            .call(d3.drag()
                .on("start", self.dragStarted)
                .on("drag", self.dragged)
                .on("end", self.dragEnded));

	};



	

	/******  DOM MANIPULATIONS  ******/

	this.svg = svg = d3.select("svg")
    	.attr("viewBox", "0 0 " + this.width  + " " + this.height)
    	.attr("preserveAspectRatio", "xMidYMid meet");

    this.gravity = svg.append("g")
		.attr("class", "gravWell")
		.selectAll('.gravWell')
		.data([]);

    // d3 selection containing all edge lines
	this.link = svg.append("g")
        .attr("class", "link")
		.selectAll(".link")
		.data(graph.edges);


	// d3 selection containing all node circles
	this.node = svg.append("g")
        .attr("class", "node")
		.selectAll(".node")
		.data(self.graph.nodes);
		//.on("mouseover", tip.show)
		//.on("mouseout", tip.hide);

	this.nodeSizeScale = d3.scaleLog()
		.domain([3720875,319284353])
		.range([0, 8])
		.clamp(true);


	// Modular function for declaring what to do with nodes
	this.renderNodes = function () {
		self.node = self.node.enter()
			.append("circle")
			.attr("r", function(d) {
				return self.nodeSizeScale(d.page_rank) + DEFAULT_RADIUS;
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

            .on("mouseover", function(d) {
            	// self.label.attr("display", self.doShowNodeLabels ? "inline" : "none");
                d3.select(this).transition(20).attr("r", function(d) {
                	return self.nodeSizeScale(d.page_rank) + DEFAULT_RADIUS + 7;
                });
                 d3.select(this).style("stroke","#575757");

				var ids = [];
				ids.push(d.id);
				self.link.filter(function(l) {
					return l.source == d || l.target == d
				}).transition(20).style("stroke-width", 7)
					.style("stroke", "rgba(0,0,0,.25)");

				self.node.filter(function(n) {
				    var highlight = false;
				    n.src_dst_links.forEach(function(l) { if (l.source == d || l.target == d) highlight = true;});
				    if(highlight){ids.push(n.label);}
				    if (n == d) highlight = false;
                    return highlight;
                }).style("stroke","grey").transition(20).attr("r", function(d) {
                	return self.nodeSizeScale(d.page_rank) + DEFAULT_RADIUS + 4;
                });
				self.label.attr("display", "none");
				self.label.filter(function(d) {
					for(var i = 0; i < ids.length; i++) {
						if(ids[i] == d.id) return true;
					}
					return false;
				 }).transition(100)
					.attr("display", "inline");
            })
            .on("mouseout", function(d) {
            	self.label.attr("display", self.doShowNodeLabels ? "inline" : "none")

                d3.select(this).transition(20).attr("r", function(d) {
                	return self.nodeSizeScale(d.page_rank) +DEFAULT_RADIUS
                });
                d3.select(this).style("stroke","white");

				self.link.filter(function(l) {
					return l.source == d || l.target == d
				}).transition(20)
					.style("stroke-width", 1)
					.style("stroke", "rgba(0,0,0,.1)");

				self.node.filter(function(n) {
				    var highlight = false;
				    n.src_dst_links.forEach(function(l) {
				        if (l.target == d || l.source == d) { highlight = true;}
                    });
                    if (n == d) {highlight = false}
                    return highlight;
                }).style("stroke","white").transition(20).attr("r", function(d) {
                	return self.nodeSizeScale(d.page_rank) + DEFAULT_RADIUS;
                });
            })
			// handle click
			.on("click", self.onNodeClick)
			.merge(self.node);

		self.label = svg.append("g")
            .attr("class", "labels")
            .selectAll("text")
            .data(self.graph.nodes)
            .enter().append("text")
            .attr("class", "label")
            .text(function(d) { return d.id; })
			.each(function(d,i) {
				d.thisWidth = this.getComputedTextLength();
			})

			//handle dragging by text
			.call(d3.drag()
                .on("start", self.dragStarted)
                .on("drag", self.dragged)
                .on("end", self.dragEnded))
			// handle click
            .on("click", self.onNodeClick)
            .merge(self.node);

	};


	// Modular function for declaring what to do with edges
	this.renderLinks = function () {
		self.link = self.link.enter()
			.append("line")
			.attr("stroke-width", 2)
			.attr("class", "link")

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
        // todo - convert this to using linear scales to keep nodes within box?
        self.node
        	.attr("cx", function(d) { return d.x = Math.max(self.nodeBorderPadding, Math.min(self.width - self.nodeBorderPadding, d.x)); })
            .attr("cy", function(d) { return d.y = Math.max(self.nodeBorderPadding, Math.min(self.height - self.nodeBorderPadding, d.y)); });

        self.label.attr("x", function(d) {
            	return d.x + self.nodeSizeScale(d.page_rank) + DEFAULT_RADIUS + 7;
            })
            .attr("y", function (d) {
            	return d.y + 4 ;
            })
            .style("font-size", "12px").style("fill", "#1727a5").style("font-weight", 550);


		    self.gravity
            .attr("cx", function(d) { return d.x = Math.max(self.nodeBorderPadding, Math.min(self.width - self.nodeBorderPadding, d.x)); })
            .attr("cy", function(d) { return d.y = Math.max(self.nodeBorderPadding, Math.min(self.height - self.nodeBorderPadding, d.y)); });

        self.gravityWellLabels
            .attr("x", function(d) { return d.x; })
            .attr("y", function (d) { return d.y; })
            .attr("font-size", "20px")
			      .attr("fill", "#6a0dc3")
	      		.attr("fill-opacity", 0.3);
    };





	/******  EVENT HANDLERS  ******/

	// Handler for node clicks; d = node datum; this = svg element
	this.onNodeClick = function (d) {
		// dijkstra!
		if (self.doShowSteps) self.dijkstra(d);
		// self.toggleNodeIsActive(d, this);
	};


	// Drag Start Event Handler
	this.dragStarted = function (d) {
		if (!d3.event.active) {
            self.restartAllSimulations(0.3);
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
			self.restartAllSimulations(0.3);
        }
		d.fx = null;
		d.fy = null;
	};

	// Gravity Draggers. Must be different because they are not a part of a simulation's nodes array
    // Gravity Drag Start Event Handler
    this.gravityDragStarted = function (d) {
        if (!d3.event.active) {
            self.restartAllSimulations(0.3);
        }
        d3.select(this).raise().classed("active", true);
    };

    // Gravity Drag Event Handler
    this.gravityDragged = function (d) {
        d3.select(this).attr("cx", d.x = d3.event.x).attr("cy", d.y = d3.event.y);
    };

    // Gravity Drag End Event Handler
    this.gravityDragEnded = function (d) {
        self.getActiveGravityField().updateGravityPosition(d);
        //update gravity positions
    	self.resetGravityForceX();
		self.resetGravityForceY();
    	d3.select(this).classed("active", false);
        if (!d3.event.active) {
            self.restartAllSimulations(1);
        }
    };

	this.log_edge_scale = d3.scaleLog()
    	.domain([d3.min(link_counts), d3.max(link_counts)])
    	.range([0, .01]);



	/******  FORCES  ******/

    // Saving a reference to each force applied to the graph as a variable to allow live adjustments:
    this.linkForceStrengthHandler = function (d) {
		return self.log_edge_scale(d.count) * self.simulationStateControl.parameters.linkForceStrength; 
	}
    // force for links. Saving reference for slider adjustment
    this.linkForce = d3.forceLink()
    		.distance(function (d) {
        		var shift = (parseInt(d.count) - self.link_mean) / (0.01 * self.link_stdev);
        		return Math.max(Math.min(50 - shift, 5), 100);
    		})
    		// .strength(DEFAULT_LINK_FORCE_STRENGTH)
    		.strength(this.linkForceStrengthHandler)
    		.id(function(d) { return d.id; });

     // todo - convert this to d3 log scale!
    //charge force
    this.chargeForce = d3.forceManyBody().strength([DEFAULT_CHARGE_FORCE_STRENGTH]);

    //centering force: on by default and switched off when gravity is used.
    this.centerForce = d3.forceCenter(this.width / 2, this.height / 2);

    // collision force to prevent overlap
    this.collisionForce = d3.forceCollide(DEFAULT_COLLISION_FORCE_RADIUS);

    // used to set gravity force x positions. Run on gravity toggle ON, gravity drag end, etc.
    this.resetGravityForceX = function() {
        this.gravityForceX.x(function (d) {
            var activeGravityField = self.getActiveGravityField();  // create temporary reference to the "active" gravity field
            if (d.well) return activeGravityField.gravityWells[d.well].x; // this forces single grav well limitation
            return activeGravityField.getGravityWellPosition(d).x;
        });
    };

    // used to set gravity force y positions. Run on gravity toggle ON, gravity drag end, etc.
    this.resetGravityForceY = function() {
        this.gravityForceY.y(function (d) {
            var activeGravityField = self.getActiveGravityField();
            if (d.well) return activeGravityField.gravityWells[d.well].y; // this forces single grav well limitation
            return activeGravityField.getGravityWellPosition(d).y;
        });
    };

    // forceX for active gravity field / wells
    this.gravityForceX = d3.forceX(function (d) {
        var activeGravityField = self.getActiveGravityField();  // create temporary reference to the "active" gravity field
        if (d.well) return activeGravityField.gravityWells[d.well].x; // this forces single grav well limitation
		return activeGravityField.getGravityWellPosition(d).x;
    }).strength([DEFAULT_GRAVITY_FORCE_STRENGTH]);


    // forceY for active gravity field / wells
    this.gravityForceY = d3.forceY(function (d) {
        var activeGravityField = self.getActiveGravityField();
        if (d.well) return activeGravityField.gravityWells[d.well].y; // this forces single grav well limitation
        return activeGravityField.getGravityWellPosition(d).y;
    }).strength([DEFAULT_GRAVITY_FORCE_STRENGTH]);


	// updating center force
	this.updateCenterForce = function () {
		this.simulation.force("center", this.gravityState.doGravity ? null : this.centerForce);
	}

	// adding methods for changing force parameters
    this.linkForceUpdate = function(value) {
    	if (!!value) self.simulationStateControl.parameters.linkForceStrength = value;
        this.linkForce.strength(self.linkForceStrengthHandler);
        self.simulation.alphaTarget(0.3).restart(); // reset simulation
    };
    this.chargeForceUpdate = function(value) {
    	if (!!value) self.simulationStateControl.parameters.chargeForceStrength = value;
        this.chargeForce.strength([value]);
        self.simulation.alphaTarget(0.3).restart(); // reset simulation
    };
    this.collisionForceUpdate = function(value) {
    	if (!!value) self.simulationStateControl.parameters.collisionForceRadius = value;
        this.collisionForce.strength(value);
        self.simulation.alphaTarget(0.3).restart(); // reset simulation
    };

    this.gravityForceUpdate = function(value) {
		if (!!value) self.simulationStateControl.parameters.gravityForceStrength = value;
        if (self.gravityState.doGravity) {
            this.gravityForceX.strength(self.simulationStateControl.parameters.gravityForceStrength);
            this.gravityForceY.strength(self.simulationStateControl.parameters.gravityForceStrength);
        }
        this.simulation.force("gravityForceX", this.gravityState.doGravity ? this.gravityForceX : null);
        this.simulation.force("gravityForceY", this.gravityState.doGravity ? this.gravityForceY : null);
        self.simulation.alphaTarget(0.3).restart();
    };

	// Todo - could use for pinning nodes?
	// Selecting and Deselecting Nodes
	this.toggleNodeIsActive = function (d, ele) {
		if (typeof d.isActive === undefined) d.isActive = false; // saftey check

		d3.select(ele).transition().duration(200)
			.attr('r', function (d) { return d.isActive ? DEFAULT_RADIUS : DEFAULT_RADIUS + 5 })
			.style('fill', function (d) { return d.isActive ? 'black' : 'green' });

		d.isActive = !d.isActive; // update node state
	};

	


	

	/******  DIJKSTRA  ******/

    this.firstStep = null;
    this.doShowSteps = true;
	this.stepCount = 30;
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
            self.node.filter(function(d){
                return !d.visited
            }).transition(15).style("fill", function(d) {
            	dis = d.distance;
                return self.color_scale(d.distance);
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
        // Set beginning Color
        self.node.transition(3).style("fill", function(d) {return self.color_scale(d.distance);});

        var i = 0;
        var timer = d3.interval(stepi, 100, 600);
        function stepi() {
            current.visited = true;
            current.src_dst_links.forEach(function (link) {
                var tar = link.target;
                if (!tar.visited) {
                    // USE LINK.COUNT for Weights. Otherwise we use just 1 for degrees of seperation
                    var dist = (current.distance + Math.sqrt(1000 / link.count));
                    // var dist = current.distance + 1;
                    // var dist = self.st_dev_scale((link.count - tar.mean) / tar.st_dev);
                    tar.distance = Math.min(dist, tar.distance);
                    // **screaming internally**
                }
            });
            tick();
            if (unvisited.length == 0 || current.distance == Infinity) {
                timer.stop();
                return true;
            }

            unvisited.sort(function (a, b) {
                return b.distance - a.distance
            });
            current = unvisited.pop();
            return false;
        }

    };

    // Color scale for Djikstra's based on distance
    this.color_scale = d3.scaleLinear()
        .domain([0, 0.66, 1.04, 1.55, 2.39, 3.0, 4.6, 5.1, 5.5])
        .range(["LawnGreen","GreenYellow","yellow","orange","orangered", "salmon","red", "crimson","FireBrick"])
		.clamp(true);

    this.st_dev_scale = d3.scaleLinear()
		.domain([-2,2])
		.range([0, 6])
		.clamp(true);

	// this is a list of sub-graphs and their simulations
	this.sub_graphs = [];
	this.sub_simulations = [];
	this.sub_graph_color_scale = d3.scaleOrdinal(d3.schemeCategory10); //support colors for up to 10 subgraphs

	this.highlightSubGraph = function (node_ids) {
		var subgraph_nodes = {};
		subgraph_nodes.nodes = [];
		for (var i=0; i < node_ids.length; i++) {
			var node_id = node_ids[i];
			var node = self.node_index[node_id];
			d3.select("#" + node.uuid)
				.style("fill",  self.sub_graph_color_scale(self.sub_graphs.length))
				.style("stroke-width", 3)
				.style("r", DEFAULT_RADIUS);
            subgraph_nodes.nodes.push(node);
		}
		subgraph_nodes.clear = function (self) {
            for (var i=0; i < self.nodes.length; i++) {
                var node = self.nodes[i];
                var elem = document.querySelector('.node');
                var style =getComputedStyle(elem);
                d3.select("#" + node.uuid)
					.style("fill", style.fill)
					.style("stroke-width", s.stroke_width)
					.style("r", DEFAULT_RADIUS)
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

	


	/******  EDGE CONTROL  ******/

    this.edge_scale = d3.scaleLinear()
		.domain([0, 100])
    	.range([d3.min(link_counts), d3.max(link_counts)]);

    this.updateEdges = function(new_edges) {
		self.link = self.link.data(new_edges, function(d) { return d.source.id + "-" + d.target.id; });
		self.link.exit().transition()
		  .attr("stroke-opacity", 0)
		  .attrTween("x1", function(d) { return function() { return d.source.x; }; })
		  .attrTween("x2", function(d) { return function() { return d.target.x; }; })
		  .attrTween("y1", function(d) { return function() { return d.source.y; }; })
		  .attrTween("y2", function(d) { return function() { return d.target.y; }; })
		  .remove();

		self.link = self.link.enter().append("line")
			.call(function(link) { link.transition().attr("stroke-opacity", 1); })
			.merge(self.link);



		self.linkForce.strength(self.linkForceStrengthHandler).links(new_edges);
		self.simulation.alphaTarget(0.3).restart();
	};

    // Removes links that fall below the designated value
    this.edgeConnectionsUpdate = function(value) {
		temp_links = self.original_edges.slice();
		for (var i = 0; i < temp_links.length; i++) {
			if (temp_links[i].count < self.edge_scale(value)) {
                    temp_links.splice(i, 1);
			}
		}
		self.updateEdges(temp_links);
    };


    /******  HELPERS  ******/

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

    // show and hide labels
    this.doShowNodeLabels = true;
    this.onToggleNodeLabels = function (buttonEl) {
    	self.doShowNodeLabels = !self.doShowNodeLabels;
    	self.label.attr("display", self.doShowNodeLabels ? "inline" : "none");
    	$(buttonEl).toggleClass('checked');
    	$('span', buttonEl).text(self.doShowNodeLabels ? "ON" : "OFF");
    }

    this.onToggleSteps = function (buttonEl) {
    	self.doShowSteps = !self.doShowSteps;
    	$(buttonEl).toggleClass('checked');
    	$('span', buttonEl).text(self.doShowSteps ? "ON" : "OFF");
    }



    /******  INITIALIZE  ******/
    // called from window.protoApp.initialize() to resolve any race conditionals
    this.initialize = function () {
    	// Define the simulation
	    self.simulation = d3.forceSimulation()
	        .force("link", self.linkForce)
	        .force("charge", self.chargeForce)
	        .force("center", self.centerForce)
	        .force("collision", self.collisionForce);

		// Actually render the graph once everything is defined
        self.renderGravityWells();
        self.gravityForceUpdate();
		self.renderNodes();
		self.renderLinks();
		self.runSimulation();
    }
    
}


// ProtoApp is the frontend app controlling the front-end and integrating D3 and user interactions
function ProtoApp () {
	var self = this;
	this.globalGraph;
	this.globalGraphData = null;

	this.initialize = function () {
		this.globalGraph = window.globalGraph;
		this.globalGraph.initialize();
		this.addEventListeners();
		this.setSliderDefaults();
	},

	// Subscribe to button clicks
	this.addEventListeners = function () {
		$('#refreshGraph').on('click', this.onRefreshGraph);
		$('#addStubData').on('click', this.onAddStubData);
		$('#toggleNode').on('click', this.onToggleNode);
		$('#ToggleGravity, #ToggleNodeLabels, #ToggleSteps').on('click', this.onToggle);

		// Parameter Sliders
		$('#linkForceSlider, #chargeForceSlider, #collisionForceSlider, #gravityForceSlider, #edgeConnectivitySlider')
			.on('change', this.onControlSliderChange);
		
	};

	this.onToggle = function (e) {
		var handlerStr = 'on' + this.id;
		if (!!self.globalGraph[handlerStr]) self.globalGraph[handlerStr](this);
	},

    this.setSliderDefaults = function () {
        // set the slider values for these constants
        // $('#linkForceSlider').attr('value', DEFAULT_LINK_FORCE_STRENGTH); // <~~~ This does the same as the vanila js! :)
        self.updateSliders(self.globalGraph.simulationStateControl.parameters);

        $('#simulationControls input[type=range]').each(function(i) { // For each slider
        	var rangeEl = this;

        	$('span[id^=' + this.id + ']').each(function(ii) { // For each span starting with current slider ID
        		var attrStr = this.id.replace(rangeEl.id, '').toLowerCase(); // get the attribute name from span ID

        		if (!!$(rangeEl).attr(attrStr)) $(this).text($(rangeEl).attr(attrStr)); // if current slider has an attribute, update the span text to match it
        	});
        });


        // We supply false to prevent updating a simulation that might not exist yet. Will have consistent state if constructed correctly using these constants in GlobalGraph
        this.linkForceSliderUpdate(DEFAULT_LINK_FORCE_STRENGTH, false);
        this.chargeForceSliderUpdate(DEFAULT_CHARGE_FORCE_STRENGTH, false);
        this.collisionForceSliderUpdate(DEFAULT_COLLISION_FORCE_RADIUS, false);
        this.gravityForceSliderUpdate(DEFAULT_GRAVITY_FORCE_STRENGTH, false);
        this.edgeConnectivitySliderUpdate(DEFAULT_EDGE_CONNECTIONS, false);
    },

    this.onControlSliderChange = function (e) { // this : input html; self : protoApp
		var handlerStr = this.id + 'Update';
		if (!!self[handlerStr]) self[handlerStr](this.value, true);
	}


	// Handling Refresh Graph Button
	this.onRefreshGraph = function (e) {

	},

	// Iterate through simulationParameters and update dom elements to match via helpers
	this.updateSliders = function (simulationParameters) {
		for (var param in simulationParameters) {

			var paramHandler;
			switch (param) {
				case "linkForceStrength":
					paramHandler = "linkForce";
				break;
				case "chargeForceStrength":
					paramHandler = "chargeForce";
				break;
				case "collisionForceRadius":
					paramHandler = "collisionForce";
				break;
				case "gravityForceStrength":
					paramHandler = "gravityForce";
				break;
				case "minimumEdgeCount":
					paramHandler = "edgeConnectivity";
				break;
			}
			var sliderEl = document.getElementById(paramHandler + "Slider")
			var sliderValue = sliderEl.value;
			if (simulationParameters[param] !== sliderValue) 
				$(sliderEl).val(simulationParameters[param]).change();
		}
	}

        
    // handling force parameter sliders
    this.linkForceSliderUpdate = function(value, update_simulation) {
        document.getElementById("linkForceSliderSpan").innerHTML = value;
        if (update_simulation) {
            self.globalGraph.linkForceUpdate(value);
        }
    },
    this.chargeForceSliderUpdate = function(value, update_simulation) {
        document.getElementById("chargeForceSliderSpan").innerHTML = value;
        if (update_simulation) {
            self.globalGraph.chargeForceUpdate(value);
        }
    },
    this.collisionForceSliderUpdate = function(value, update_simulation) {
        document.getElementById("collisionForceSliderSpan").innerHTML = value;
        if (update_simulation) {
            self.globalGraph.collisionForceUpdate(value);
        }
    },
    this.gravityForceSliderUpdate = function(value, update_simulation) {
        document.getElementById("gravityForceSliderSpan").innerHTML = value;
        if (update_simulation) {
            self.globalGraph.gravityForceUpdate(value);
        }
    },

	this.edgeConnectivitySliderUpdate = function(value, update_simulation) {
        document.getElementById("edgeConnectivitySliderSpan").innerHTML = value;
        if (update_simulation) {
            self.globalGraph.edgeConnectionsUpdate(value);
        }
    };

    // Callback function for what to do when we graph data from external source
	this.handleStubData = function (data) {
		self.userData = data;
		// do things with stub data
		self.globalGraph.highlightSubGraph(data.nodes.map(function (d) { return d.id }));
	};

};

// generates UUID v4 identifiers. Math.random() isn't a perfect RNG, but should be more than fine for our purposes
function uuid(a) {
	return a ? (a^Math.random()*16>>a/4).toString(16):([1e7]+-1e3+-4e3+-8e3+-1e11).replace(/[018]/g,uuid)
}

window.protoApp = new ProtoApp(); // new it up!



