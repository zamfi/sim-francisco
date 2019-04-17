var express = require('express');
var request = require('request');
var xml2js = require('xml2js');
var Q = require('q');

var fs = require('fs');
var svg2png = require('svg2png');

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

var iconTemplate = {
  train: fs.readFileSync('bart-lead-car.svg', {encoding: 'utf-8'})
};

app.get('/icons/:color/train.png', function(req, res) {
  var color = req.params.color;
  if (color == 'shadow') {
    res.sendFile(__dirname+'/bart-lead-car-shadow.png', {maxAge: 1000*60*60*24*365});
    return;
  }
  if (fs.existsSync('/tmp/train-'+color+'.png')) {
    res.sendFile('/tmp/train-'+color+'.png', {maxAge: 1000*60*60*24*365});
  } else {
    fs.writeFileSync('/tmp/train-'+color+'.svg', iconTemplate.train.replace(/\{%MAIN_COLOR%\}/g, color));
    var svgData = fs.readFileSync('/tmp/train-'+color+'.svg', 'utf8');
    svg2png(svgData).then(buffer => {
      fs.writeFileSync('/tmp/train-'+color+'.png', buffer);
      res.sendFile('/tmp/train-'+color+'.png', {maxAge: 1000*60*60*24*365});
    }).catch (e => {
      console.log(err);
      res.sendStatus(500);
    });
  }
});

app.use(express.static(__dirname))

var server = app.listen(process.env.PORT || 3000, function() {
  console.log('Listening on port %d', server.address().port);
});