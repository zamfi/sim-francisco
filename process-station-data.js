var fs = require('fs');
var xml2js = require('xml2js');
var osmapi = require('./osmapi');

var subway = JSON.parse(fs.readFileSync('subway_data.json', 'utf-8'));

var geo = osmapi.geoUtils(subway.extrema.minLat, subway.extrema.minLon, subway.extrema.maxLat, subway.extrema.maxLon);

var xml = fs.readFileSync('station_data.xml', 'utf-8');
getAllStations = function(cb) {
  xml2js.parseString(xml, function(err, data) {
    var geo = osmapi.geoUtils(subway.extrema.minLat, subway.extrema.minLon, subway.extrema.maxLat, subway.extrema.maxLon);
        
    cb(null, data.root.stations[0].station.map(function(station) {
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
}

getAllStations(function(err, stations) {
  process.stdout.write(JSON.stringify(stations, false, 2));
});