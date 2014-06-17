var xml2js = require('xml2js');
var fs = require('fs');
var osmapi = require('./osmapi');

var subway = JSON.parse(fs.readFileSync('subway_data.json', 'utf-8'));

function getAllCoastlines(cb) {
  var xml = fs.readFileSync('coastline_data.xml', 'utf-8');
  xml2js.parseString(xml, function(err, data) {
    if (err) { return cb(err); }
    
    var geo = osmapi.geoUtils(subway.extrema.minLat, subway.extrema.minLon, subway.extrema.maxLat, subway.extrema.maxLon);
    
    var coastlines = {};
    osmapi.status("Extracting nodes and ways from coastline data...\n");
    coastlines.nodes = osmapi.getRefMap(data.osm, 'node');
    coastlines.ways = osmapi.getRefMap(data.osm, 'way');
    
    for (var k in coastlines.nodes) {
      var node = coastlines.nodes[k];
      var pos = geo.pos(node.lat, node.lon);
      node.x = pos.x;
      node.y = pos.y;
    }
    osmapi.status("...done.\n");
    cb(null, coastlines);
  });
}


getAllCoastlines(function(err, coastlines) {
  process.stdout.write(JSON.stringify(coastlines));
});