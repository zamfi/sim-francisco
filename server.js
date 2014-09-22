var express = require('express');
var request = require('request');
var xml2js = require('xml2js');
var Q = require('q');

// var bartApi = new (require('./bart-api').BartAPI)();
var gtfs = require('./gtfs-realtime');

var app = express();

app.set('views', __dirname);
app.engine('html', require('ejs').renderFile);

app.use(express.static(__dirname+'/client'));
app.get('/', function(req, res) {
  res.render('index.html');
});
app.get('/test', function(req, res) {
  res.render('test.html');
});

var lastData;

// app.get('/bart', function(req, res) {
//   if (! lastData || (lastData.isFulfilled() && (Date.now() - lastData.inspect().value.date) > 60*1000)) {
//     lastData = bartApi.etd('ALL');
//   }
//   Q.when(lastData, function(value) {
//     console.log("VALUE!", JSON.stringify(value.data, false, 2));
//     res.writeHeader(200, {'Content-Type': "application/json"});
//     res.end(JSON.stringify(value.data));
//   }, function(error) {
//     console.log("ERROR!");
//   });
// });

app.get('/realtime', function(req, res) {
  if (! lastData || lastData.isRejected() || (lastData.isFulfilled() && (Date.now() - lastData.inspect().value.lastUpdate) > 60*1000)) {
    lastData = gtfs.getGtfsRealtimeUpdates();
  } else {
    console.log("request for /realtime, no pull required; last pull was", Date.now() - lastData.inspect().value.lastUpdate, "ms ago");
  }
  Q.when(lastData, function (value) {
    res.writeHeader(200, {'Content-Type': "application/json"});
    res.end(JSON.stringify(value.data));
  }, function (error) {
    console.log("ERROR!");
    res.writeHeader(500, {'Content-Type': "application/json"});
    res.end(JSON.stringify({msg: "Failed to get realtime data", error: error}));
  });
});

app.use(express.static(__dirname))

var server = app.listen(process.env.PORT || 3000, function() {
  console.log('Listening on port %d', server.address().port);
});