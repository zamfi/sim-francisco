var fs = require('fs');
var osmapi = require('./osmapi');

var BUFFER = 0.3;

var extrema = JSON.parse(fs.readFileSync('data/subway_data.json', 'utf-8')).extrema;
var bounds = '('+[extrema.minLat-BUFFER, extrema.minLon-BUFFER, extrema.maxLat+BUFFER, extrema.maxLon+BUFFER].join(",")+')';

var keyValues = [
  "leisure=park",
  "natural=wood",
  "landuse=recreation_ground",
  "boundary=national_park",
  "natural=water",
  "natural=coastline",
  "waterway=riverbank",
  "waterway=river",
  "highway=motorway",
  "highway=motorway_link",
  "highway=trunk",
  "highway=primary",
  "highway=secondary",
  "highway=tertiary"
]

var queries = {
  way: keyValues,
  relation: keyValues
};

var queryString = Object.keys(queries).map(function(key) { return queries[key].map(function(q) {return key+bounds+'['+q+']'}).join(';'); }).join(';');

osmapi.doApiGet('('+queryString+');(._;>);out body;', function(err) {
  if (! err) {
    osmapi.status("...done.\n");
  } else {
    osmapi.status("Error:", err);
    process.exit(1);
  }
});