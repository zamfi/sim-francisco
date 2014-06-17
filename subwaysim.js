var maxWidth, maxHeight;
maxWidth = maxHeight = 600;

var colorMap = {
  'yellow': 'orange'
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
        console.log("line", d.name, d.stops);
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
      line.stops = line.stops.map(function(stop) {
        return findClosestStation(stations, nodes[stop].x, nodes[stop].y);
      });
    });
  }
  
  function drawStations() {
    d3.json('station_data.json', function(err, stations) {
      svg.selectAll('.station').data(stations)
        .enter().append("circle")
        .attr("class", "station")
        .attr("r", "3")
        .attr("stroke-width", "1")
        .attr("stroke", "#abcdef")
        .attr("fill", "none")
        .attr("cx", function(d) { return xScale(d.x); })
        .attr("cy", function(d) { return yScale(d.y); })
        .on("mouseover", function(d) {
          console.log(d);
        });
      updateStationAbbreviations(stations);
      console.log(system.lines);
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