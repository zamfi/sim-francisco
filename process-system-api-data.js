var fs = require('fs');
var Q = require('q');
var xml2js = require('xml2js');
var osmapi = require('./osmapi');

var subway = JSON.parse(fs.readFileSync('data/subway_data.json', 'utf-8'));

var geo = osmapi.geoUtils(subway.extrema.minLat, subway.extrema.minLon, subway.extrema.maxLat, subway.extrema.maxLon);

var xmlData = JSON.parse(fs.readFileSync('data/system_api_data_xml.json', 'utf-8'));

function getAllStations() {
  var deferred = Q.defer();
  xml2js.parseString(xmlData.stations, function(err, data) {
    var geo = osmapi.geoUtils(subway.extrema.minLat, subway.extrema.minLon, subway.extrema.maxLat, subway.extrema.maxLon);
        
    deferred.resolve(data.root.stations[0].station.map(function(station) {
      for (k in station) {
        if (station.hasOwnProperty(k)) {
          if (station[k] instanceof Array && station[k].length == 1) {
            station[k] = station[k][0];
          }
        }
        station.lat = station.gtfs_latitude;
        station.lon = station.gtfs_longitude;
        var pos = geo.pos(station.lat, station.lon);
        station.x = pos.x;
        station.y = pos.y;
      }
      return station;
    }));
  });
  return deferred.promise;
}

function getAllRoutes() {
  var deferred = Q.defer();
  xml2js.parseString(xmlData.routes, function(err, data) {
    deferred.resolve(data.root.routes[0].route.map(function(route) {
      return {
        routeNo: route.number[0],
        from: route.origin[0],
        to: route.destination[0],
        color: route.color[0],
        stations: route.config[0].station
      };
    }));
  });
  return deferred.promise;
}

Q.all([getAllStations(), getAllRoutes()]).then(function(values) {
  process.stdout.write(JSON.stringify({
    stations: values[0],
    routes: values[1]
  }, false, 2));
});