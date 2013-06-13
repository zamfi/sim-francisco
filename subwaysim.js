var width = 2000,
    height = 2800;

var svg = d3.select('body').append('svg')
            .attr('width', width).attr('height', height);

var minLat = 90,
    maxLat = -90,
    minLon = 180,
    maxLon = -180,
    latRange = 0,
    lonRange = 0;

var OFFSET_LEN = .0005;

d3.json('subway_data.json', function(error, system) {
  if (error) { return console.log(error); }
  console.log(system);
  var nodes = system.nodes,
      ways = system.ways;
      
  // console.log(nodes, ways);
  for (var k in nodes) {
    var node = nodes[k];
    minLat = Math.min(node.lat, minLat);
    maxLat = Math.max(node.lat, maxLat);
    minLon = Math.min(node.lon, minLon);
    maxLon = Math.max(node.lon, maxLon);
  }
  var lonScale = d3.scale.linear().domain([minLon, maxLon]).range([width*0.05, width*0.95]);
  var latScale = d3.scale.linear().domain([maxLat, minLat]).range([height*0.05, height*0.95]);

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
        adj: line.nodeGraph[k].filter(function(a) {return Number(a) > Number(k)}),
        slope: -1/system.nodes[k].lineSlopes[line.ref]
      });
    }
  });

  var sourceLine = system.lines; //.slice(7, 8);

  var line = svg.selectAll('.line').data(sourceLine)
    .enter().append("g")
    .attr("class", "line")
    .attr("style", function(d) { return "stroke:"+d.color+";fill:none"; });
  
  line.selectAll('.station').data(function(d) { return d.stops.map(function(node) { return {line: d, node: node}; }); })
    .enter().append("circle")
    .attr("class", "station")
    .attr("r", "6")
    .attr("cx", function(d) {return lonScale(nodes[d.node].lon);})
    .attr("cy", function(d) {return latScale(nodes[d.node].lat);})
    .attr("stroke", function(d) { return (nodes[d.node].lines.indexOf(d.line.ref) == 0 ? 'black' : 'none'); });

  function lonOffset(node, line) {
    var offset = nodes[node.ref].lines.indexOf(line.ref);
    return offset * OFFSET_LEN * (! isFinite(node.slope) ? 0 : Math.sqrt(1/(1+(node.slope * node.slope))));
  }
  function latOffset(node, line) {
    return lonOffset(node, line) * (! isFinite(node.slope) ? 1 : node.slope);
  }

  var nodeSegments = line.selectAll('.nodeSeg').data(function(line) { 
    return line.pathNodes.map(function(n) { return {line: line, node: n}; });
  }).enter().append("path")
    .attr("class", "nodeSeg")
    .attr("stroke-width", "2")
    .attr("d", function(d) {
      var thisNode = d.node;
      // var offset = nodes[thisNode.ref].lines.indexOf(d.line.ref);
      // var slope = thisNode.slope;
      if (! thisNode.adj || thisNode.adj.length == 0) {
        console.log("no adjacencies!");
        return null;
      }
      return thisNode.adj.map(function(otherNode) {
        otherNode = d.line.pathNodesByRef[otherNode];
        // var otherOffset = nodes[otherNode.ref].lines.indexOf(d.line.ref);
        // var otherSlope = otherNode.slope;
        return "M "+lonScale(Number(nodes[thisNode.ref].lon)+lonOffset(thisNode, d.line))+
                " "+latScale(Number(nodes[thisNode.ref].lat)+latOffset(thisNode, d.line))+
               "L "+lonScale(Number(nodes[otherNode.ref].lon)+lonOffset(otherNode, d.line))+
                " "+latScale(Number(nodes[otherNode.ref].lat)+latOffset(otherNode, d.line));
      }).join(" ");
    });

  // var pathSegs = line.selectAll('.pathSeg').data(function(line) { return line.segments.map(function(seg) { return {line: line, seg: seg};}); })
  //   .enter().append("path")
  //   .attr("class", "pathSeg")
  //   .attr("stroke-width", "2")
  //   .attr("d", function(d) {
  //     var nds = ways[d.seg].nodes;
  //     var perpSlopes = ways[d.seg].slopes.map(function(x) {return isNaN(x) ? 0 : -1/x});
  //     var offset = ways[d.seg].lines.indexOf(d.line.ref);
  //     
  //     return "M "+nds.map(function(nd, i) {
  //       var lonOffset = offset * OFFSET_LEN * (! isFinite(perpSlopes[i]) ? 0 : Math.sqrt(1/(1+perpSlopes[i]*perpSlopes[i])));
  //       var latOffset = lonOffset * (! isFinite(perpSlopes[i]) ? 1 : perpSlopes[i]);
  //       if (isNaN(lonOffset) || isNaN(latOffset) || isNaN(perpSlopes[i])) {
  //         console.log("NaN: ", lonOffset, latOffset, perpSlopes[i]);
  //       } else {
  //         // console.log(nodes[nd].lon, lonOffset, nodes[nd].lat, latOffset);
  //         // console.log(Number(nodes[nd].lon)+lonOffset, Number(nodes[nd].lat)+latOffset, perpSlopes[i]);
  //       }
  //       return (lonScale(Number(nodes[nd].lon)+lonOffset))+" "+(latScale(Number(nodes[nd].lat)+latOffset));
  //     }).join(" L ");
  //   });
  //   .style("stroke", "none");
  // pathSegs.transition()
  //   .delay(function(d, i) { return 100 * i })
  //   .style("stroke", "inherit");
  
  // pathSegs.
  //   .attr("d", function(line) {
  //     var nds = line.pathNodes;
  //     return "M "+nds.map(function(nd) {
  //       return (lonScale(nodes[nd.node].lon)-nd.offset)+" "+(latScale(nodes[nd.node].lat)-nd.offset);
  //     }).join(" L ");
  //   });
  // var segs = line.selectAll('.track').data(function(d) { return d.segments.map(function(seg) { return {line: d, way: seg}; }); })
  // .enter().append("g");
  // segs.selectAll('.way').data(function(d) { return ways[d.way].nodes.map(function(node) { return {line: d.line, way: d.way, node: node}}); })
  //   .enter().append("circle")
  //   .attr("r", "1")
  //   .attr("transform", function(d) {
  //     var offset = ways[d.way].lines.indexOf(d.line.ref);
  //     return "translate("+(lonScale(nodes[d.node].lon)-offset)+","+(latScale(nodes[d.node].lat)-offset)+")";
  //   });
  // segs.append("path")
  //   .attr("d", function(d) {
  //     var nds = ways[d.way].nodes;
  //     var offset = ways[d.way].lines.indexOf(d.line.ref);
  //     console.log("drawing line at offset", offset);
  //     return "M "+nds.map(function(nd) { 
  //       return (lonScale(nodes[nd].lon)-offset)+" "+(latScale(nodes[nd].lat)-offset);
  //     }).join(" L ");
  //   });
});