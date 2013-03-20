// Graph Visualization

// Visualization of tracking data interconnections

(function(visualizations){
"use strict";


var graph = new Emitter();
visualizations.graph = graph;
var width = 1000, height = 1000;
var force, vizcanvas, vis;

// There are three phases for a visualization life-cycle:
// init does initialization and receives the existing set of connections
// connection notifies of a new connection that matches existing filter
// remove lets the visualization know it is about to be switched out so it can clean up
graph.on('init', onInit);
graph.on('connection', onConnection);
graph.on('remove', onRemove);

function onInit(connections){
    console.log('initializing graph from %s connections', connections.length);
    vizcanvas = document.querySelector('.vizcanvas');
    vis = d3.select('.vizcanvas');
    // A D3 visualization has a two main components, data-shaping, and setting up the D3 callbacks
    aggregate.emit('load', connections);
    // This binds our data to the D3 visualization and sets up the callbacks
    initGraph();
    aggregate.on('updated', function(){
        // new nodes, reheat graph simulation
        if (force){
            force.start();
        }
    });
    // Differenct visualizations may have different viewBoxes, so make sure we use the right one
    vizcanvas.setAttribute('viewBox', [0,0,width,height].join(' '));
};

function onConnection(connection){
    aggregate.emit('connection', connection);
}

function onRemove(){
    console.log('removing graph');
    if (force){
        force.stop();
        force = null;
    }
    aggregate.emit('reset');
    resetCanvas();
};


// UTILITIES

function point(angle, size){
	return [Math.round(Math.cos(angle) * size), -Math.round(Math.sin(angle) * size)];
}

function polygon(points, size, debug){
    var increment = Math.PI * 2 / points;
    var angles = [], i;
    for (i = 0; i < points; i++){
        angles.push(i * increment + Math.PI/2); // add 90 degrees so first point is up
    }
    return angles.map(function(angle){ return point(angle, size); });
}

function polygonAsString(points, size){
    var poly = polygon(points, size);
    return poly.map(function(pair){return pair.join(',');}).join(' ');
}

// SET UP D3 HANDLERS

function initGraph(){
    // Initialize D3 layout and bind data
    force = d3.layout.force()
        .nodes(aggregate.allnodes)
        .links(aggregate.edges)
        .charge(-500)
        .size([width,height])
        .start();

        // Data binding for links
        var lines = vis.selectAll('.edge')
            .data(aggregate.edges, function(edge){ return edge.name; });

        lines.enter()
            .insert('line', ':first-child')
            .classed('edge', true);

        lines.exit()
            .remove();

 //        var nodes = vis.selectAll('.node')
	//     .data(aggregate.allnodes, function(node){ return node.name; })
 //        .call(force.drag);

	// nodes.enter();

 //        nodes.exit()
 //            .remove();

        var sites = vis.selectAll('.site')
            .data(aggregate.sitenodes, function(node){ return node.name; })
            .call(force.drag);

        sites.enter()
            .append('circle')
	        .attr('cx', 0)
	        .attr('cy', 0)
	        .attr('r', 12)
            .attr('data-name', function(node){ return node.name; })
            .on('mouseenter', tooltip.show)
            .on('mouseleave', tooltip.hide)
            .classed('node', true)
            .classed('site', true);

        var thirdparties = vis.selectAll('.thirdparty')
            .data(aggregate.thirdnodes, function(node){ return node.name; })
            .call(force.drag);

        thirdparties.enter()
            .append('polygon')
    	    .attr('points', polygonAsString(3, 20))
            .attr('data-name', function(node){ return node.name; })
            .on('mouseenter', tooltip.show)
            .on('mouseleave', tooltip.hide)
            .classed('node', true)
            .classed('thirdparty', true);

        var boths = vis.selectAll('.both')
            .data(aggregate.bothnodes, function(node){ return node.name; })
            .call(force.drag);

        boths.enter()
    	    .append('rect')
    	    .attr('x', -9)
    	    .attr('y', -9)
    	    .attr('width', 18)
    	    .attr('height', 18)
            .attr('data-name', function(node){ return node.name; })
            .on('mouseenter', tooltip.show)
            .on('mouseleave', tooltip.hide)
    	    .classed('node', true)
    	    .classed('both', true);

        // update method
        force.on('tick', function(){
            lines
                .attr('x1', function(edge){ return edge.source.x; })
                .attr('y1', function(edge){ return edge.source.y; })
                .attr('x2', function(edge){ return edge.target.x; })
                .attr('y2', function(edge){ return edge.target.y; });
    	    updateNodes(sites);
    	    updateNodes(thirdparties);
    	    updateNodes(boths);
        });
}

function updateNodes(thenodes){
    thenodes
	.attr('transform', function(node){ return 'translate(' + node.x + ',' + node.y + ') scale(' + (1 + .03 * node.weight) + ')'; })
	.classed('visitedYes', function(node){ return node.visited && !node.notVisited; })
	.classed('visitedNo', function(node){ return !node.visited && node.notVisited; })
	.classed('visitedBoth', function(node){ return node.visited && node.notVisited; })
	.classed('secureYes', function(node){ return node.secure && !node.notSecure; })
	.classed('secureNo', function(node){ return !node.secure && node.notSecure; })
	.classed('secureBoth', function(node){ return node.secure && node.notSecure; })
	.classed('cookieYes', function(node){ return node.cookie && !node.notCookie; })
	.classed('cookieNo', function(node){ return !node.cookie && node.notCookie; })
	.classed('cookieBoth', function(node){ return node.cookie && node.notCookie; })
	.attr('data-timestamp', function(node){ return node.lastAccess.toISOString(); });
}



// FIXME: Move this out of visualization so multiple visualizations can use it.
function resetCanvas(){
    // You will still need to remove timer events
    var parent = vizcanvas.parentNode;
    var newcanvas = vizcanvas.cloneNode(false);
    parent.replaceChild(newcanvas, vizcanvas);
    vizcanvas = newcanvas;
}


// update info
document.querySelector('#content').addEventListener('click', function(event){
    if (event.target.mozMatchesSelector('.node')){
        updateInfo(aggregate.nodeForKey(event.target.getAttribute('data-name')));
    }
});

/* Updates info on the right info bar */
function updateInfo(node){

    function getServerInfo(theUrl, callback){
        var xmlHttp = null;
        xmlHttp = new XMLHttpRequest();
        xmlHttp.open( "GET", theUrl, false );
        xmlHttp.send( null );
        callback( (xmlHttp.status == 200) ? JSON.parse(xmlHttp.responseText) : false );
    }

    function resetMap(){
        var preHighlight = document.querySelectorAll(".highlight-country");
        if (preHighlight){
            toArray(preHighlight).forEach(function(element){
                element.classList.remove("highlight-country");
            });
        }
        document.querySelector("#mapcanvas").setAttribute("viewBox", [0,0,2711.3,1196.7].join(" "));
    }

    function updateMap(newCountry, countryCode){
        toArray(newCountry).forEach(function(land){
                    land.classList.add("highlight-country");
                });

                // position the highlighted country in center
                var svgViewBox = document.querySelector("#mapcanvas").getAttribute("viewBox").split(" ");
                var worldDimen = document.querySelector("#mapcanvas").getClientRects()[0];
                var countryDimen = document.querySelector("#"+countryCode).getClientRects()[0];

                var ratio = svgViewBox[2] / worldDimen.width;
                var worldCenter = {
                    x: 0.5*worldDimen.width + worldDimen.left,
                    y: 0.5*worldDimen.height + worldDimen.top
                };
                var countryCenter = {
                    x: 0.5*countryDimen.width + countryDimen.left,
                    y: 0.5*countryDimen.height + countryDimen.top
                };

                var newViewBox = {
                    x: -(worldCenter.x-countryCenter.x) * ratio,
                    y: -(worldCenter.y-countryCenter.y) * ratio,
                    w: svgViewBox[2],
                    h: svgViewBox[3]
                };

                setZoom(newViewBox,'mapcanvas');
    }

    var info = parseUri(node.name); // uses Steven Levithan's parseUri 1.2.2
    var jsonURL = "http://freegeoip.net/json/" + info.host;

    // update content in the side bar when you have the server info ==========
    getServerInfo(jsonURL, function(data){
        document.querySelector(".holder .title").innerHTML = node.name;
        document.querySelector(".holder .url").innerHTML = node.name;

        if ( data == false ){
            document.querySelector("#country").innerHTML = "(Cannot find server location)";
            resetMap();
        }else{
            // update country info only when it is different from the current one
            if ( data.country_name !==  document.querySelector("#country").innerHTML ){
                resetMap();
                document.querySelector("#country").innerHTML = data.country_name;
                var countryOnMap = document.querySelectorAll("svg ." + data.country_code.toLowerCase());
                if ( countryOnMap ){ updateMap(countryOnMap, data.country_code.toLowerCase()); }
            }
        }

        // update the connections list
        var connections = new Array();
        var htmlList = "";
        connections = connections.concat(node.linkedFrom, node.linkedTo);
        connections.forEach(function(conn){
            htmlList = htmlList + "<li>" + conn + "</li>";
        });
        document.querySelector(".connections-list").querySelector(".blue-text").innerHTML = connections.length + " connections from current site";
        document.querySelector(".connections-list ul").innerHTML = htmlList;

        document.querySelector("#content").classList.add("showinfo");
    });

}


})(visualizations);
