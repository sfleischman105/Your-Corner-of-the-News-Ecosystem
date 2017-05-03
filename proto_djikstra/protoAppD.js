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

    // static variable to control size of each node
    var init_size = 7;

    // initializes fields for each node to be used later by dijkstra
    graph.nodes.forEach( function(d) {
        d.links = [];
        d.distance = 0;
        d.visited = false;
    });



    // d3 selection containing all edge lines
    this.link = svg.append("g") // todo: change this var name to edge?
        .attr("class", "link")
        .selectAll(".link")
        .data(graph.edges)
        .enter().append("line")
        .attr("stroke-width", 2);
    // .attr("stroke-width", function(d) { return Math.sqrt(d.count); });

    // d3 selection containing all node circles
    this.node = svg.append("g")
        .attr("class", "node")
        .selectAll(".node")
        .data(graph.nodes)
        .enter().append("circle")
        .attr("r", function (d) {
            if (d.count) return d.count * init_size;
            return init_size;
        })
        .attr("fill", function (d) {
            return d.isActive ? "steelblue" : "black";
        })
        .call(d3.drag()
            .on("start", dragStarted)
            .on("drag", dragged)
            .on("end", dragEnded));

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

    // Increases node size when mouse moves over
    this.node.on("mouseover", function() {
        d3.select(this)
            .attr("r",init_size + 4)
    });

    // Reverts size back to normal after mouse moves out of eahc node
    this.node.on("mouseout", function() {
        d3.select(this)
            .attr("r",init_size)
    });

    // Appends the list of links to each node to include links that have that node as the source
    graph.edges.forEach( function(d) {
        var src = d.source;
        src.links.push(d);
    });

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
        return "crimson";
    }


    // d3 selector, when a node is clicked calls dijkstra with that node at the initial node
    this.node.on("click", dijkstra);

    // Function to change the color of each node. Called by dijkstra
    function tick() {
        self.node.style("fill", function(d) {
            return color(d.distance);
        });
    }

    // Given a starting node, runs djikstras algorthm to determine the distances each node is from
    // the starting node. Also calls 'tick'() to change color corresponding to distance
    // Modifies the distance attribute of each node
    function dijkstra(first) {
        var unvisited = [];
        graph.nodes.forEach(function (d) {
            if (d != first) {
                d.distance = Infinity;
                unvisited.push(d);
                d.visited = false;
            }
        });

        var current = first;
        current.distance = 0;
        var done = false;

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
            if (unvisited.length == 0 || current.distance == Infinity) {
                done = true;
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
            if(elapsed > 500) {
                if(!done) {
                    stepi();
                } else {
                    timer.stop();
                }
            }
        });
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




