/**
 * Created by bking on 5/30/17.
 */

// function for generating gravitational field from data
function build_gravitational_field(data, key_function, asLinear) {
    var wells = {};
    for (i = 0; i < data.length; i++) {
        var key = key_function(data[i]);
        if (key in wells) {
            wells[key] += 1; //will add x, y when all keys are known
        } else {
            wells[key] = 1;
        }
    }
    return place_wells(wells, asLinear);
}

function place_wells(wells, asLinear) {
    var size =  Object.keys(wells).length;
    if (asLinear) {
        var i = 1.0;
        for (var key in wells) {
            wells[key] = {'x': i / (size + 1), 'y': .5};
            i++;
        }
    } else {
        i = 0;
        // run a false, hidden simulation in a 100 by 100 box, run it a few iterations, and use these positions as well centers
        var nodes = d3.range(size).map(function(i) { return {index: i}; });
        var simulation = d3.forceSimulation()
            .force("charge", d3.forceManyBody().strength(-10))
            .force("center", d3.forceCenter(50, 50))
            .nodes(nodes)
            .stop();

        // See https://github.com/d3/d3-force/blob/master/README.md#simulation_tick
        for (var j = 0, n = Math.ceil(Math.log(simulation.alphaMin()) / Math.log(1 - simulation.alphaDecay())); j < n; ++j) {
            simulation.tick();
        }
        for (var key in wells) {
            wells[key] = {'x': Math.max(.1, Math.min(.9, nodes[i].x / 100)), 'y': Math.max(.1, Math.min(.9, nodes[i].y / 100)),};
            i++;
        }
    }
    return wells;
}