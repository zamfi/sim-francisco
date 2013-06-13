Array.prototype.first = function() { return this[0]; }
Array.prototype.last = function() { return this[this.length-1]; }
Array.prototype.pushIfAbsent = function(v) { if (this.indexOf(v) < 0) { this.push(v); } }

var fs = require('fs');
var xml2js = require('xml2js');
var util = require('util');

function status(arg1, arg2, etc) {
  process.stderr.write(Array.prototype.join.call(arguments, ' '));
}

function getTagValue(obj, key) {
  var tags = obj.tag.filter(function(tag) { return tag.$.k == key; });
  if (tags.length == 0) { return null; }
  return tags[0].$.v;
}

function getTagObject(obj) {
  if (! obj.tag) { return; }
  var out = {};
  obj.tag.forEach(function(tag) {
    out[tag.$.k] = tag.$.v;
  });
  return out;
}

var typeConverters = {
  node: function(obj) {
    return {
      id: obj.$.id,
      lat: obj.$.lat,
      lon: obj.$.lon,
      data: getTagObject(obj),
      lines: []
    };
  },
  way: function(obj) {
    return {
      id: obj.$.id,
      nodes: obj.nd.map(function(node) {return node.$.ref}),
      data: getTagObject(obj),
      lines: []
    };
  }
}

function getRefMap(osm, type) {
  var out = {};
  osm[type].forEach(function(obj) {
    out[obj.$.id] = typeConverters[type](obj);
  });
  return out;
}

function getAllLines(cb) {
  var system = {
    title: "NYC Subway",
    lines: []
  };
  var xml = fs.readFileSync('subway_data.xml', 'utf-8');
  xml2js.parseString(xml, function(err, data) {
    if (err) { return cb(err); }
    
    status('Creating node and way reference maps...\n');
    system.nodes = getRefMap(data.osm, 'node');
    system.ways = getRefMap(data.osm, 'way');
    function normalize(slope) {
      return slope;
    }
    for (var k in system.ways) {
      var way = system.ways[k];
      
      way.slopes = way.nodes.map(function(node, i) {
        if (i == 0) {
          return normalize((system.nodes[way.nodes[i+1]].lat - system.nodes[node].lat) / (system.nodes[way.nodes[i+1]].lon - system.nodes[node].lon));
        } else if (i == way.nodes.length-1) {
          return normalize((system.nodes[node].lat - system.nodes[way.nodes[i-1]].lat) / (system.nodes[node].lon - system.nodes[way.nodes[i-1]].lon));
        } else {
          return normalize((system.nodes[way.nodes[i+1]].lat - system.nodes[way.nodes[i-1]].lat) / (system.nodes[way.nodes[i+1]].lon - system.nodes[way.nodes[i-1]].lon));
        }
      });      
    }
    
    var allNodes = []
    for (var k in system.nodes) {
      allNodes.push(system.nodes[k]);
    }
    allNodes.sort(function(a, b) {
      if (a.lat != b.lat) {
        return a.lat - b.lat;
      } else {
        return a.lon - b.lon;
      }
    });
    for (var i = 0; i < allNodes.length-1; ++i) {
      if (allNodes[i].lat == allNodes[i+1].lat && allNodes[i].lon == allNodes[i+1].lat) {
        status('Duplicate nodes...', allNodes[i].id, allNodes[i+1].id, "\n");
      }
    }
    
    status('Processing lines... ');
    data.osm.relation.filter(function(rel) { return getTagValue(rel, 'type') == 'route'; }).forEach(function(rel) {
      var lineData = getTagObject(rel);

      lineData.stops = rel.member.filter(function(m) { return m.$.type == 'node' && m.$.role == 'stop'; }).map(function(m) { return m.$.ref; });
      lineData.segments = rel.member.filter(function(m) { return m.$.type == 'way' }).map(function(m) { return m.$.ref });

      system.lines.push(lineData);
      status(lineData.ref+' ');

      // compute a full node adjacency matrix for line.
      var adjacencies = {};
      function addAdjacency(a, b) {
        if (! adjacencies[a]) {
          adjacencies[a] = [];
        }
        if (! adjacencies[b]) {
          adjacencies[b] = [];
        }
        adjacencies[a].pushIfAbsent(b);
        adjacencies[b].pushIfAbsent(a);
      }
      lineData.segments.forEach(function(wayRef) {
        system.ways[wayRef].nodes.forEach(function(ndRef, i) {
          if (! adjacencies[ndRef]) {
            adjacencies[ndRef] = [];
          }
          if (i > 0) {
            addAdjacency(ndRef, system.ways[wayRef].nodes[i-1]);
          }
          if (i < system.ways[wayRef].nodes.length-1) {
            addAdjacency(ndRef, system.ways[wayRef].nodes[i+1]);
          }
        });
      })
      lineData.nodeGraph = adjacencies;
    });

    // note lines in ways & nodes.
    system.lines.sort(function(a, b) {return (a.ref < b.ref ? -1 : 1)});
    system.lines.forEach(function(line) {
      line.stops.forEach(function(nodeRef) {
        system.nodes[nodeRef].lines.pushIfAbsent(line.ref);
        system.nodes[nodeRef].lines.sort()
      });
      line.segments.forEach(function(wayRef) {
        system.ways[wayRef].lines.pushIfAbsent(line.ref);
        system.ways[wayRef].lines.sort()
        system.ways[wayRef].nodes.forEach(function(nodeRef, i) {
          system.nodes[nodeRef].lines.pushIfAbsent(line.ref);
          system.nodes[nodeRef].lines.sort();

          // note the slope on a per-line basis;
          if (! system.nodes[nodeRef].lineSlopes) {
            system.nodes[nodeRef].lineSlopes = {};
          }
          system.nodes[nodeRef].lineSlopes[line.ref] = system.ways[wayRef].slopes[i];
        });
      });
    });

    status('...done\n');
    cb(null, system);
  });
}

getAllLines(function(err, system) {
  process.stdout.write(JSON.stringify(system));
});