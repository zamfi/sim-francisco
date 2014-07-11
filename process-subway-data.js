Array.prototype.first = function() { return this[0]; }
Array.prototype.last = function() { return this[this.length-1]; }
Array.prototype.pushIfAbsent = function(v) { if (this.indexOf(v) < 0) { this.push(v); } }

var fs = require('fs');
var xml2js = require('xml2js');
var osmapi = require('./osmapi');

function getAllLines(cb) {
  var xml = fs.readFileSync('data/subway_data.xml', 'utf-8');
  xml2js.parseString(xml, function(err, data) {
    if (err) { return cb(err); }

    var system = {
      title: process.argv[2] || "NYC Subway",
      lines: []
    };
    
    osmapi.status('Creating node and way reference maps...\n');
    system.nodes = osmapi.getRefMap(data.osm, 'node');
    system.ways = osmapi.getRefMap(data.osm, 'way');

    var extrema = {
      minLat: 90, maxLat: -90,
      minLon: 180, maxLon: -180
    };
    for (var k in system.nodes) {
      var node = system.nodes[k];
      extrema.minLat = Math.min(extrema.minLat, node.lat);
      extrema.maxLat = Math.max(extrema.maxLat, node.lat);
      extrema.minLon = Math.min(extrema.minLon, node.lon);
      extrema.maxLon = Math.max(extrema.maxLon, node.lon);
    }

    var geo = osmapi.geoUtils(extrema.minLat, extrema.minLon, extrema.maxLat, extrema.maxLon);
    extrema.range = geo.range;
    system.extrema = extrema;
    
    for (var k in system.nodes) {
      var node = system.nodes[k];
      var pos = geo.pos(node.lat, node.lon);
      node.x = pos.x;
      node.y = pos.y;
    }
    
    osmapi.status('Processing lines... ');
    data.osm.relation.filter(function(rel) { return osmapi.getTagValue(rel, 'type') == 'route'; }).forEach(function(rel) {
      var lineData = osmapi.getTagObject(rel);

      lineData.stops = rel.member.filter(function(m) { return m.$.type == 'node' && m.$.role == 'stop'; }).map(function(m) { return m.$.ref; });
      lineData.segments = rel.member.filter(function(m) { return m.$.type == 'way' }).map(function(m) { return m.$.ref });

      system.lines.push(lineData);
      osmapi.status(lineData.ref+' ');

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

    osmapi.status('...done.\n');
    cb(null, system);
  });
}

getAllLines(function(err, system) {
  process.stdout.write(JSON.stringify(system));
});