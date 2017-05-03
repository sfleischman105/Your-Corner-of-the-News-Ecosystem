/**
 * Created by stephenf on 5/3/17.
 */


d3.rebind = function(target, source) {
    var i = 1, n = arguments.length, method;
    while (++i < n) target[method = arguments[i]] = d3_rebind(target, source, source[method]);
    return target;
};

function d3_rebind(target, source, method) {
    return function() {
        var value = method.apply(source, arguments);
        return value === source ? target : value;
    };
}

d3.dijkstra = function() {


    var dijkstra = {}, nodes, edges, first, dispatch = d3.dispatch("start", "tick", "step", "end");

    dijkstra.run = function (clicked_node) {
        first = clicked_node;

        var unvisited = [];

        nodes.forEach(function (d) {
            if (d != first) {
                d.distance = Infinity;
                unvisited.push(d);
                d.visited = false;
            }
        });

        var current = first;
        current.distance = 0;

        function stepi() {
            current.visited = true;
            current.links.forEach( function(link) {
                var dist = current.distance + link.count;
                tar.distance = Math.min(dist, tar.distance);

            });
            if (unvisited.length == 0 || current.distance == Infinity) {
                dispatch.end()
                return true;
            }

            unvisited.sort(function(a, b) {
                return b.distance - a.distance
            });

            current = unvisited.pop()

            dispatch.tick();

            return false;
        }

        d3.timer(tick);

    };

    dijkstra.nodes = function(_) {
        if (!arguments.length)
            return nodes;
        else {
            nodes = _;
            return dijkstra;
        }
    };

    dijkstra.edges = function(_) {
        if (!arguments.length)
            return edges;
        else {
            edges = _;
            return dijkstra;
        }
    };

    dijkstra.first = function (_) {
        if (!arguments.length)
            return first;
        else {
            first = _;
            return dijkstra;
        }
    };

    dispatch.on("start.code", dijkstra.run);

    return d3.rebind(dijkstra, dispatch, "on", "end", "start", "tick");
};
