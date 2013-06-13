var request = require('request');
var xml2js = require('xml2js');
var util = require('util');

var OSM_BASE_PATH = "http://overpass.osm.rambler.ru/cgi/interpreter?data=";

function status(arg1, arg2, etc) {
  process.stderr.write(Array.prototype.join.call(arguments, ' '));
}

function doApiGet(query, cb) {
  var queryUrl = OSM_BASE_PATH+encodeURIComponent(query);
  status('Getting network data...', queryUrl, "\n");
  request.get(queryUrl, function(error, response, body) {
    if (!error && response.statusCode == 200) {
      process.stdout.write(body, cb);
    } else {
      cb(error || response.statusCode);
    }
  });  
}

doApiGet('(relation["network"="NYC Subway"]);(._;>);out body;', function(err) {
  if (! err) {
    status("...done");
  } else {
    status("Error:", err);
    process.exit(1);
  }
});