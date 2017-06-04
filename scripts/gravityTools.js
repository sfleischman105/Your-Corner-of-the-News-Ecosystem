/**
 * Created by bking on 5/30/17.
 */

const DEFAULT_GRAVITY_FIELD_PARAMS =  {
    "linkForceStrength" : 6,
    "chargeForceStrength" : -250,
    "gravityForceStrength": .3
};

// function for generating gravitational field from data
function build_gravitational_field(selection, keyFunction, asLinear, width, height, defaultWells) {
    var usingArgumentWells = (defaultWells !== undefined);
    var wells = (usingArgumentWells) ? defaultWells : {};
    if (!usingArgumentWells) {
        var data = selection.data();
        for (var i = 0; i < data.length; i++) {
            var key = keyFunction(data[i]);
            if (key in wells) {
                wells[key] += 1; //will add x, y when all keys are known
            } else {
                wells[key] = 1;
            }
        }
    }
    var result =  {
        gravityWells : (usingArgumentWells) ? wells : place_wells(wells, asLinear, width, height),
        defaultParams: DEFAULT_GRAVITY_FIELD_PARAMS,
        keyFunction : keyFunction,
        updateGravityPosition  : function (d) {
            var well = d.id;
            this.gravityWells[well].x = d.x;
            this.gravityWells[well].y = d.y;
        },
        getGravityWellPosition : function (d) {
            var well = this.keyFunction(d);
            d.well = well; // give node a well
            return this.gravityWells[well]; // dynamically return x position of gravity well
        }
    }
    return result;
}

function place_wells(wells, asLinear, width, height) {
    var size =  Object.keys(wells).length;
    var keys = Object.keys(wells).sort();
    if (asLinear) {
        var i = 1.0;
        for (var k = 0; k < keys.length; k++) {
            wells[keys[k]] = {'x': width * (i / (size + 1)), 'y': height * .5, 'id': keys[k]};
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
            wells[key] = {'x': width * Math.max(.1, Math.min(.9, nodes[i].x / 100)), 'y': height * Math.max(.1, Math.min(.9, nodes[i].y / 100)), 'id': key};
            i++;
        }
    }
    return wells;
}