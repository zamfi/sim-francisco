var fs = require('fs');
var Q = require('q');
var csvParse = require('csv-parse');

function getGtfsData(feedFileName) {
  console.warn("getting GTFS data for", feedFileName);
  var deferred = Q.defer();
  fs.readFile(process.argv[3]+'/'+feedFileName+'.txt', function (err, data) {
    if (err) {
      return deferred.reject(err);
    }
    csvParse(data, {columns: true}, function (err, output) {
      if (err) {
        console.warn("error parsing data", err);
        return deferred.reject(err);
      }
      console.warn("got data for", feedFileName);
      deferred.resolve(output);
    });
  });
  return deferred.promise;
}

var neededFiles = ['routes', 'trips', 'stops', 'stop_times', 'calendar', 'calendar_dates'];
Q.all(neededFiles.map(getGtfsData)).then(function (values) {
  var output = {};
  neededFiles.forEach(function (filename, index) {
    output[filename] = values[index];
  });
  process.stdout.write(JSON.stringify(output, false, 2));
  console.warn("done.");
}, function (err) {
  console.warn("Failed to write files", err);
});
