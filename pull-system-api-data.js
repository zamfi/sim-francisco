var Q = require('q');
var request = require('request');

function doApiGet(query) {
  var deferred = Q.defer();
  var queryUrl = "http://api.bart.gov/api/"+query+"&key=MW9S-E7SL-26DU-VV8V";
  console.warn('Getting query data...', queryUrl, "\n");
  request.get(queryUrl, function(error, response, body) {
    if (!error && response.statusCode == 200) {
      deferred.resolve(body);
    } else {
      deferred.reject(error || response.statusCode);
    }
  });  
  return deferred.promise;
}

var stationQuery = 'stn.aspx?cmd=stns';
// var schedulesQuery = 'sched.aspx?cmd=scheds';
// var routesQuery = 'route.aspx?cmd=routes';
var routeInfoQuery = 'route.aspx?cmd=routeinfo&route=all'; // &route = <route number> &sched = <schedule number>

Q.all([stationQuery, routeInfoQuery].map(doApiGet)).then(function(results) {
  var xmlData = {
    stations: results[0],
    routes: results[1]
  };
  console.warn("Retrieved all queries.")
  process.stdout.write(JSON.stringify(xmlData));
}, function(error) {
  console.warn("FAILED!", error);
  process.exit(1);
});