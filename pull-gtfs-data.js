var Q = require('q');
var request = require('request');
var fs = require('fs');
var AdmZip = require('adm-zip');

var TRANSIT_FEEDS = {
  BART: 'http://www.bart.gov/dev/schedules/google_transit.zip'
};

function pullGtfsZipfile(network) {
  var deferred = Q.defer();
  request.get({url: TRANSIT_FEEDS[network], encoding: null}, function (error, response, body) {
    if (!error && response.statusCode == 200) {
      deferred.resolve(body);
    } else {
      deferred.reject(error || response.statusCode);
    }
  });
  return deferred.promise;
}

var GTFS_FILES = [ 
  'agency.txt',
  'stops.txt',
  'routes.txt',
  'trips.txt',
  'stop_times.txt',
  'calendar.txt',
  'calendar_dates.txt',
  'fare_attributes.txt',
  'fare_rules.txt',
  'shapes.txt',
  'frequencies.txt',
  'transfers.txt',
  'feed_info.txt'
];

function writeZipfileData(destination, zipfile) {
  var zip = new AdmZip(zipfile);
  try {
    fs.mkdirSync(destination);    
  } catch (e) {
    if (e.code != 'EEXIST') {
      throw e;
    }
  }
  zip.getEntries().forEach(function (zipEntry) {
    if (GTFS_FILES.indexOf(zipEntry.entryName) >= 0) {
      console.log("extracting", zipEntry.entryName);
      zip.extractEntryTo(zipEntry, destination, false, true);
    }
  });
}

pullGtfsZipfile(process.argv[2] || 'BART')
  .then(writeZipfileData.bind(null, process.argv[3] || 'data/gtfs_data'))
  .then(function () {
    console.log("GTFS data fully extracted.");
  }, function (err) {
    console.log("Failed to extract GTFS data: ", err);
  });