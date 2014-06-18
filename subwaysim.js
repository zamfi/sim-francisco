var maxWidth, maxHeight;
maxWidth = maxHeight = 600;

var colorMap = {
  'yellow': '#ffff33',
  'orange': '#ff9933',
  'green': '#339933',
  'red': '#ff0000',
  'blue': '#0099cc'
};
function getColor(d, df) {
  var c = d.color || d.colour;
  return colorMap[c] || c || df;
}

d3.json('subway_data.json', function(error, system) {
  if (error) { return console.log(error); }
  console.log(system);
  var nodes = system.nodes,
      ways = system.ways;

  var pixelsPerMile = Math.min(maxWidth / system.extrema.range.width, maxHeight / system.extrema.range.height);
  
  var width = pixelsPerMile*system.extrema.range.width,
      height = pixelsPerMile*system.extrema.range.height;
  
  var BUFFER = 0.08;
  var xScale = d3.scale.linear().domain([0, system.extrema.range.width]).range([width*BUFFER, width*(1-BUFFER)]);
  var yScale = d3.scale.linear().domain([0, system.extrema.range.height]).range([height*(1-BUFFER), height*BUFFER]);

  var svg = d3.select('body').append('svg')
              .attr('width', width).attr('height', height);

  var linesByRef = {}
  var lineNames = [];
  system.lines.forEach(function(line) {
    lineNames.push(line.ref);
    linesByRef[line.ref] = line;
    line.pathNodesByRef = {};
    line.pathNodes = [];
    for (var k in line.nodeGraph) {
      line.pathNodes.push(line.pathNodesByRef[k] = {
        ref: k,
        adj: line.nodeGraph[k] //.filter(function(a) {return Number(a) > Number(k)})
      });
    }
    line.pathNodes.sort(function(a, b) { return a.adj.length - b.adj.length });
  });
  
  function drawAdjacenciesAsGraph() {
    var sourceLine = system.lines; //.filter(function(line) {return line.ref == "B" || line.ref == "Q"}); //.slice(7, 8);
  
    var line = svg.selectAll('.line').data(sourceLine)
      .enter().append("g")
      .attr("class", "line")
      .attr("style", function(d) { 
        console.log("line", d.name, getColor(d, 'unknown'), d.stops);
        return "stroke:"+getColor(d, 'gray')+";fill:none"; 
      });
    
    line.append("path")
      .attr("d", function(line) {
        var graphSegments = [];
        var drawnEdges = {}
        function isDrawn(ref1, ref2) {
          return drawnEdges[[ref1,ref2].sort().join("-")];
        }
        function drawn(ref1, ref2) {
          drawnEdges[[ref1,ref2].sort().join("-")] = true;
        }

        var startNodes = line.pathNodes.filter(function(node) {return node.adj.length <= 1});
        var stack = startNodes.map(function(node) { return {node: node, index: 0}});
        var i = 0;
        while (i < stack.length) {
          var edge = stack[i];
          graphSegments.push("M "+xScale(nodes[edge.node.ref].x)+" "+yScale(nodes[edge.node.ref].y));
          var curNode = edge.node;
          var nextNode = line.pathNodesByRef[edge.node.adj[edge.index]];
          while (nextNode && !isDrawn(nextNode.ref, curNode.ref)) {
            drawn(curNode.ref, nextNode.ref);
            curNode = nextNode;
            graphSegments.push("L "+xScale(nodes[curNode.ref].x)+" "+yScale(nodes[curNode.ref].y));
            nextNode = false;
            var firstRealNode = true;
            for (var j = 0; j < curNode.adj.length; ++j) {
              if (! isDrawn(curNode.adj[j], curNode.ref)) {
                if (firstRealNode) {
                  nextNode = line.pathNodesByRef[curNode.adj[j]];
                  firstRealNode = false;
                } else {
                  stack.push({node: curNode, offset: j});
                }                
              }
            }
          }
          ++i;
        }
        return graphSegments.join(" ");
      });
      
    line.selectAll(".junction").data(function(d) { return d.pathNodes.filter(function(node) { return node.adj.length > 2; })})
      .enter().append("circle")
      .attr("class", "junction")
      .attr("r", "4")
      .attr("stroke-width", "1")
      .attr("cx", function(d) { return xScale(nodes[d.ref].x)})
      .attr("cy", function(d) { return yScale(nodes[d.ref].y)});

    // line.selectAll(".stop").data(function(d) { return d.stops.map(function(stop) { return {node: stop, line: d.name} }); })
    //   .enter().append("circle")
    //   .attr("class", "stop")
    //   .attr("r", "4")
    //   .attr("stroke-width", "1")
    //   .attr("cx", function(d) { return xScale(nodes[d.node].x); })
    //   .attr("cy", function(d) { return yScale(nodes[d.node].y); })
    //   .on("mouseover", function(d) {
    //     console.log("hover line", d.line, nodes[d.node]);
    //   });

    line.selectAll(".endbar").data(function(d) { return d.pathNodes.filter(function(node) { return node.adj.length <= 1; })})
      .enter().append("path")
      .attr("class", "endbar")
      .attr("d", function(d) {
        function perpLine(n1, n2) {
          var ptVec = {
            x: xScale(nodes[n1].x) - xScale(nodes[n2].x),
            y: yScale(nodes[n1].y) - yScale(nodes[n2].y)
          };
          var ptMag = Math.sqrt(ptVec.x*ptVec.x + ptVec.y*ptVec.y);
          ptVec.x /= ptMag;
          ptVec.y /= ptMag;
          return " M "+(xScale(nodes[n1].x)-5*ptVec.y)+" "+(yScale(nodes[n1].y)+5*ptVec.x)+
                 " L "+(xScale(nodes[n1].x)+5*ptVec.y)+" "+(yScale(nodes[n1].y)-5*ptVec.x)        
        }
        return perpLine(d.ref, d.adj[0]);
      }); 
  }
  function drawCoastlines() {
    d3.json('coastline_data.json', function(err, coastlines) {
      console.log(coastlines);
      var waysArray = Object.keys(coastlines.ways).map(function(k) { return coastlines.ways[k].nodes.map(function(nodeRef) { return coastlines.nodes[nodeRef]; }); });
      var coastline = svg.selectAll('.coastline').data(waysArray)
        .enter().append("path")
        .attr("class", "coastline")
        // .attr("style", "fill:none;stroke:#ccc")
        .attr("d", function(d) {
          return "M "+xScale(d[0].x)+" "+yScale(d[0].y) + d.slice(1).map(function(node) { return "L "+xScale(node.x)+" "+yScale(node.y); }).join(" ");
        });
    });
  }
  
  function findClosestStation(stations, x, y) {
    var minD2 = Number.POSITIVE_INFINITY;
    var closestStation;
    stations.forEach(function(station) {
      var d2 = (station.x-x) * (station.x-x) + (station.y-y) * (station.y-y);
      if (d2 < minD2) {
        minD2 = d2;
        closestStation = station.abbr;
      }
    });
    return closestStation;
  }
  function updateStationAbbreviations(stations) {
    system.lines.forEach(function(line) {
      if (! line.stopAbbrToNodeRef) {        
        line.stopAbbrToNodeRef = {};
      }
      line.stops = line.stops.map(function(stop) {
        var closestStation = findClosestStation(stations, nodes[stop].x, nodes[stop].y);
        if (! line.stopAbbrToNodeRef[closestStation]) {
          line.stopAbbrToNodeRef[closestStation] = []
        }
        line.stopAbbrToNodeRef[closestStation].push(stop);
        return closestStation;
      });
    });
  }
  
  var router = {};
  function drawStations() {
    d3.json('system_api_data.json', function(err, data) {
      svg.selectAll('.station').data(data.stations)
        .enter().append("circle")
        .attr("class", "station")
        .attr("r", "3")
        .attr("stroke-width", "1")
        .attr("stroke", "#abcdef")
        .attr("fill", "#abcdef")
        .attr("cx", function(d) { return xScale(d.x); })
        .attr("cy", function(d) { return yScale(d.y); })
        .on("mousedown", function(d) {
          console.log("station click!", d.abbr);
          if (router.endStation || ! router.startStation) {
            router.startStation = d.abbr;
            delete router.endStation;
          } else {
            router.endStation = d.abbr;
            var route = getRoute(router.startStation, router.endStation);
            console.log("routing!", router.startStation, router.endStation, route);
            svg.selectAll('.route').data([]).exit().remove();
            if (route) {
              svg.selectAll('.route').data([{from: router.startStation, to: router.endStation, route: route}])
                .enter().append("path")
                .attr("class", "route")
                .attr("stroke-width", "4")
                .attr("stroke", "black")
                .attr("fill", "none")
                .attr("d", function(d) {
                  return "M "+d.route.map(function(nodeRef) {
                    return xScale(nodes[nodeRef].x)+" "+yScale(nodes[nodeRef].y);
                  }).join(" L ");
                });
              }
          }
        })
        .on("mouseover", function(d) {
          console.log(d);
        });
      updateStationAbbreviations(data.stations);
      // console.log(system.lines);
      drawTrains();
    });
  }
  function findNodePath(line, startNodeRef, endNodeRef) {
    // console.log("finding node path from", startNodeRef, "to", endNodeRef);
    function findNodePath_helper(pathSoFar, startNodeRef, endNodeRef) {
      // console.log("helper -- pathSoFar", pathSoFar);
      var path;
      if (! line.pathNodesByRef[startNodeRef]) { return; }
      line.pathNodesByRef[startNodeRef].adj.forEach(function(nodeRef) {
        // console.log("nodeRef", nodeRef);
        if (path) {
          return;
        }
        if (nodeRef == endNodeRef) {
          path = pathSoFar.concat([nodeRef]);
          return;
        }
        if (pathSoFar.indexOf(nodeRef) != -1) {
          return;
        };
        var testPath = findNodePath_helper(pathSoFar.concat([startNodeRef]), nodeRef, endNodeRef);
        if (testPath) {
          path = testPath;
          return;
        }
      });
      return path;
    }
    try {
      return findNodePath_helper([], startNodeRef, endNodeRef);      
    } catch (e) {
      console.warn("threw an error in findNodePath_helper", e);
    }
  }
  function getLine(from, to, color) {
    console.log("getting line", from, to, color);
    var likelyLine;
    var startNodeRef, endNodeRef;
    system.lines.filter(function(line) { return color ? getColor(line) == color : true; }).forEach(function(line) {
      if (likelyLine) { return; }
      var fromIndex = line.stops.indexOf(from);
      var toIndex = line.stops.indexOf(to);
      if (fromIndex >= 0 && toIndex >= 0 && fromIndex < toIndex) {
        likelyLine = {
          line: line,
          startNodeRef: line.stopAbbrToNodeRef[from][0],
          endNodeRef: line.stopAbbrToNodeRef[to][0]
        };
      }
    });
    return likelyLine;
  }
  function getRoute(from, to, color) {
    var lineData = getLine(from, to, color);
    if (! lineData) { return; }
    return findNodePath(lineData.line, lineData.startNodeRef, lineData.endNodeRef);
  }
  function nodeDistance(aRef, bRef) {
    return Math.sqrt(Math.pow(nodes[aRef].x-nodes[bRef].x, 2) + Math.pow(nodes[aRef].y-nodes[bRef].y, 2));
  }
  function slope(aRef, bRef) {
    return (nodes[bRef].y - nodes[aRef.y]) / (nodes[bRef].x - nodes[bRef].y);
  }
  function interpolatePathDistance(route, distance) {
    var distanceSoFar = 0;
    var lastNodeRef = route[0];
    for (var i = 1; i < route.length; ++i) {
      var nodeRef = route[i];
      var d = nodeDistance(lastNodeRef, nodeRef);
      if (distance < distanceSoFar+d) {
        var ratio = (distance-distanceSoFar) / d;
        return { x: nodes[nodeRef].x + ratio * (nodes[nodeRef].x - nodes[lastNodeRef].x),
                 y: nodes[nodeRef].y + ratio * (nodes[nodeRef].y - nodes[lastNodeRef].y),
                 unitVector: {
                   x: (nodes[nodeRef].x - nodes[lastNodeRef].x) / d,
                   y: (nodes[nodeRef].y - nodes[lastNodeRef].y) / d
                 }
               };
      }
      distanceSoFar += d;
      lastNodeRef = nodeRef;
    }
    var lastNodeRef = route[route.length-2];
    return { x: nodes[nodeRef].x,
             y: nodes[nodeRef].y,
             unitVector: {
               x: (nodes[nodeRef].x - nodes[lastNodeRef].x) / d,
               y: (nodes[nodeRef].y - nodes[lastNodeRef].y) / d
             }
           };
  }
  function drawTrains() {
    d3.json('bart', function(err, data) {
      var trainData = [];
      data.stations.forEach(function(station) {
        station.etd.forEach(function(etd) {
          etd.departures.filter(function(a) { return a.minutes <= 5; }).forEach(function(departure) {
            var line = getLine(station.abbr, etd.destination, departure.color);
            console.log("Got line", line);
            if (! line) { return; }
            var previousStation = line.line.stops[Math.max(line.line.stops.indexOf(station.abbr)-1, 0)];
            var route = getRoute(station.abbr, previousStation/*, departure.color*/);
            if (! route) { return; }
            var position = interpolatePathDistance(route, departure.minutes/60 * 50 /*m/h*/);
            trainData.push({color: departure.color, position: position, destination: etd.destination, arrivingAt: station.abbr, inMinutes: departure.minutes});
          });
        });
      });
      console.log("setting train data", trainData);
      var trains = svg.selectAll(".train").data(trainData)
      var group = trains.enter()
        .append("g")
        .attr("class", "train");
      group.append("circle")
        .attr("cx", function(d) { return xScale(d.position.x) || 0; })
        .attr("cy", function(d) { return yScale(d.position.y) || 0; })
        .attr("r", "4")
        .attr("fill", function(d) { return d.color; })
        .attr("stroke", "black")
        .attr("strokeWeight", "2")
        .on("mouseover", function(d) {
          console.log("train bound for", d.destination, "arriving at", d.arrivingAt, "in", d.inMinutes, "minutes");
        });
      group.append("line")
        .attr("x1", function(d) { return xScale(d.position.x) || 0; })
        .attr("y1", function(d) { return yScale(d.position.y) || 0; })
        .attr("x2", function(d) { return xScale(d.position.x - d.position.unitVector.x)})
        .attr("y2", function(d) { return yScale(d.position.y - d.position.unitVector.y)})
        .attr("strokeWeight", "2")
        .attr("stroke", "black");
      trains.enter()
      trains.exit().remove()
    });
  }
  // drawWays();
  // drawAdjacenciesAsLineSegments();
  drawAdjacenciesAsGraph();
  drawCoastlines();
  drawStations();
});



// function drawWays() {
//   var waysArray = [];
//   for (var wayId in ways) {
//     waysArray.push(ways[wayId]);
//   }
// 
//   var way = svg.selectAll('.way').data(waysArray)
//     .enter().append("g")
//     .attr("class", "way")
//     .attr("style", "stroke:#ccc;fill:none;");
//   way.append("path")
//     .attr("stroke-width", "1")
//     .attr("d", function(d) {
//       var wayNodes = d.nodes.map(function(nodeRef) {return nodes[nodeRef]});
//       return "M " + wayNodes.map(function(node) {
//         return xScale(node.x) + " " + yScale(node.y);
//       }).join(" L ");
//     });
// 
//   way.append("path")
//     .attr("class", "endbar")
//     .attr("d", function(d) {
//       function perpLine(n1, n2) {
//         var ptVec = {
//           x: xScale(nodes[n1].x) - xScale(nodes[n2].x),
//           y: yScale(nodes[n1].y) - yScale(nodes[n2].y)
//         };
//         var ptMag = Math.sqrt(ptVec.x*ptVec.x + ptVec.y*ptVec.y);
//         ptVec.x /= ptMag;
//         ptVec.y /= ptMag;
//         return " M "+(xScale(nodes[n1].x)-5*ptVec.y)+" "+(yScale(nodes[n1].y)+5*ptVec.x)+
//                " L "+(xScale(nodes[n1].x)+5*ptVec.y)+" "+(yScale(nodes[n1].y)-5*ptVec.x)        
//       }
//       return perpLine(d.nodes[0], d.nodes[1])+perpLine(d.nodes[d.nodes.length-1], d.nodes[d.nodes.length-2]);
//     }); 
// 
//   way.selectAll('.node').data(function(d) { return d.nodes; })
//     .enter().append("circle")
//     .attr("class", "node")
//     .attr("style", "fill:black;stroke:none;")
//     .attr("r", "0.75")
//     .attr("cx", function(d) { return xScale(nodes[d].x); })
//     .attr("cy", function(d) { return yScale(nodes[d].y); });    
// }
// function drawAdjacenciesAsLineSegments() {
//   console.log(system.lines);
//   var sourceLine = system.lines; //.slice(7, 8);
// 
//   var line = svg.selectAll('.line').data(sourceLine)
//     .enter().append("g")
//     .attr("class", "line")
//     .attr("style", function(d) { return "stroke:"+getColor(d, "blue")+";fill:none"; });
// 
//   // line.selectAll('.station').data(function(d) { return d.stops.map(function(node) { return {line: d, node: node}; }); })
//   //   .enter().append("circle")
//   //   .attr("class", "station")
//   //   .attr("r", "6")
//   //   .attr("cx", function(d) {return xScale(nodes[d.node].x);})
//   //   .attr("cy", function(d) {return yScale(nodes[d.node].y);})
//   //   .attr("stroke", function(d) { return (nodes[d.node].lines.indexOf(d.line.ref) == 0 ? 'black' : 'none'); });
// 
//   var nodeSegments = line.selectAll('.nodeSeg').data(function(line) { 
//     return line.pathNodes.map(function(n) { return {line: line, node: n}; });
//   }).enter().append("path")
//     .attr("class", "nodeSeg")
//     .attr("stroke-width", "1")
//     .attr("d", function(d) {
//       var thisNode = d.node;
//       // var offset = nodes[thisNode.ref].lines.indexOf(d.line.ref);
//       // var slope = thisNode.slope;
//       if (! thisNode.adj || thisNode.adj.length == 0) {
//         console.log("no adjacencies!");
//         return null;
//       }
//       return thisNode.adj.filter(function(a) {return Number(a) > Number(thisNode.ref)}).map(function(otherNode) {
//         otherNode = d.line.pathNodesByRef[otherNode];
//         // var otherOffset = nodes[otherNode.ref].lines.indexOf(d.line.ref);
//         // var otherSlope = otherNode.slope;
//         return "M "+xScale(Number(nodes[thisNode.ref].x))+
//                 " "+yScale(Number(nodes[thisNode.ref].y))+
//                "L "+xScale(Number(nodes[otherNode.ref].x))+
//                 " "+yScale(Number(nodes[otherNode.ref].y));
//       }).join(" ");
//     });    
// }