var Q = require('q');
var request = require('request');
var ProtoBuf = require('protobufjs');

var gtfs_realtime = ProtoBuf.loadProtoFile('./gtfs-realtime.proto');

function parseData(data) {
  var feedMessage = gtfs_realtime.build('transit_realtime.FeedMessage');
  var message = feedMessage.decode(data);
  return message;
}

exports.getGtfsRealtimeUpdates = function getGtfsRealtimeUpdates() {
  var deferred = Q.defer()
  request.get({url: 'http://api.bart.gov/gtfsrt/tripupdate.aspx', encoding: null}, function (err, response, body) {
    if (err) {
      console.log("Failed to get real-time GTFS data", err);
      deferred.reject("Failed to get GTFS data: "+err);
      return;
    }
    try {
      var out = {
        data: parseData(body),
        lastUpdate: new Date()
      };
      deferred.resolve(out);
    } catch (e) {
      console.log("Failed to parse realtime feed data:", err);
      deferred.reject(e);
    }
  });
  return deferred.promise;
}
