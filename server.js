var express = require('express');
var request = require('request');
var xml2js = require('xml2js');
var Q = require('q');

var app = express();

app.set('views', __dirname);
app.engine('html', require('ejs').renderFile);

app.get('/', function(req, res) {
  res.render('index.html');
});

var lastData;

function pullBartData() {
  var deferred = Q.defer();
  request.get('http://api.bart.gov/api/etd.aspx?cmd=etd&orig=ALL&key=MW9S-E7SL-26DU-VV8V', function(err, response, body) {
    xml2js.parseString(body, function(err, data) {
      // stations: [
      //   {name: name,
      //    abbr: abbr,
      //    etd: [
      //      { destination: abbr,
      //        departures: [
      //         { minutes: minutes,
      //           length: # cars
      //           color: e.g., "BLUE",
      //           direction: "North" or "South"
      //         },
      //        ]
      //       },
      //    ]},
      //  ]
      console.log("DATA!", JSON.stringify(data, false, 2));
      var compiledData = {
        stations: data.root.station.map(function(station) {
          return {
            name: station.name[0],
            abbr: station.abbr[0],
            etd: station.etd.map(function(etd) {
              return {
                destination: etd.abbreviation[0],
                departures: etd.estimate.map(function(estimate) {
                  return {
                    minutes: Number(estimate.minutes[0]) || 0,
                    length: Number(estimate.length[0]),
                    color: estimate.hexcolor[0],
                    direction: estimate.direction[0]
                  };
                })
              };
            })
          };
        })
      };
      console.log('resolving...');
      deferred.resolve({data: compiledData, date: new Date(data.root.date[0]+" "+data.root.time[0])});
    });
  });
  return deferred.promise;
}

app.get('/bart', function(req, res) {
  if (! lastData || (lastData.isFulfilled() && (Date.now() - lastData.inspect().value.date) > 60*1000)) {
    lastData = pullBartData();
  }
  Q.when(lastData, function(value) {
    console.log("VALUE!");
    res.writeHeader(200, {'Content-Type': "application/json"});
    res.end(JSON.stringify(value.data));    
  }, function(error) {
    console.log("ERROR!");
  });
})

app.use(express.static(__dirname))

var server = app.listen(3000, function() {
  console.log('Listening on port %d', server.address().port);
});