var request = require('request');
var xml2js = require('xml2js');
var Q = require('q')
var Time = require('./client/js/time').Time;

function BartAPI(key) {
  this.key = key || 'MW9S-E7SL-26DU-VV8V';
}
BartAPI.prototype = {
  fetch: function (url, cmd, args) {
    var requestUrl = 'http://api.bart.gov/api/'+url+'.aspx?cmd='+cmd+'&key='+this.key;
    for (var k in args) {
      if (args.hasOwnProperty(k) && args[k] !== undefined) {
        requestUrl += "&"+k+"="+args[k];
      }
    }
    var deferred = Q.defer();
    request.get(requestUrl, function (err, response, body) {
      if (err) {
        deferred.reject("Failed to get API request: " + err);
        return;
      }
      xml2js.parseString(body, function (err, data) {
        if (err) {
          deferred.reject("Failed to parse API response: " + err);
          return
        }
        deferred.resolve(data);
      });
    })
    return deferred.promise;
  },
  
  etd: function (orig, plat, dir) {
    var fetchResult = this.fetch('etd', 'etd', {
      orig: orig || 'ALL', plat: plat, dir: dir
    });
    return fetchResult.then(function(data) {
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
      return({data: compiledData, date: new Date(data.root.date[0]+" "+data.root.time[0])});
    });
  },
  
  routes: function(sched, date) {
    return this.fetch('route', 'routes', {
      sched: sched,
      date: date
    }).then(function (data) {
      return {
        routes: data.root.routes[0].route.map(function (route) {
          return ['name', 'abbr', 'routeID', 'number', 'color'].reduce(function (object, key) {
             object[key] = route[key][0];
             return object;
           }, {});
        })
      }
    });
  },
  
  routeInfo: function (route, sched, date) {
    return this.fetch('route', 'routeinfo', {
      route: route || 'all',
      sched: sched,
      date: date
    }).then(function (data) {
      return {
        routes: data.root.routes[0].route.map(function (route) {
          var info = 
            ['name', 'abbr', 'routeID', 'number', 'origin', 'destination', 
             'direction', 'color', 'holidays', 'num_stns'].reduce(function (object, key) {
               object[key] = route[key][0];
               return object;
             }, {});
          info.stations = route.config[0].station;
          return info;
        })
      }
    });
  },
  
  routeSched: function (route, sched, date) {
    return this.fetch('sched', 'routesched', {
      route: route,
      sched: sched,
      date: date
    }).then(function (data) {
      return {
        schedNum: data.root.sched_num[0],
        route: data.root.route[0].train.map(function (train) {
          return {
            trainNumber: train.$.index,
            arrivals: train.stop.map(function (stop) {
              return {
                station: stop.$.station,
                time: stop.$.origTime
              };
            })
          }
        })
      }
    });
  }
}

exports.BartAPI = BartAPI;

if (require.main === module) {
  // run some tests!
  console.log("Running tests...");
  
  var api = new BartAPI();
  
  api.routeInfo().then(function (routes) {
    var id = routes.routes[0].number;
    console.log("Got routes", routes, "using", id);
    return api.routeSched(id);
  }).then(function (routeSched) {
    console.log("Got route schedule", JSON.stringify(routeSched, false, 2));
    return api.etd();
  }).then(function (etd) {
    console.log("Got ETD!", etd);
  }).fail(function (reason) {
    console.log("Failure!", reason);
  }).fin(function () {
    console.log("Done!");    
  });
}

// exports.pullBartData = function() {
//   var deferred = Q.defer();
//   request.get('http://api.bart.gov/api/etd.aspx?cmd=etd&orig=ALL&key=MW9S-E7SL-26DU-VV8V', function(err, response, body) {
//     xml2js.parseString(body, function(err, data) {
//       // stations: [
//       //   {name: name,
//       //    abbr: abbr,
//       //    etd: [
//       //      { destination: abbr,
//       //        departures: [
//       //         { minutes: minutes,
//       //           length: # cars
//       //           color: e.g., "BLUE",
//       //           direction: "North" or "South"
//       //         },
//       //        ]
//       //       },
//       //    ]},
//       //  ]
//       // console.log("DATA!", JSON.stringify(data, false, 2));
//       var compiledData = {
//         stations: data.root.station.map(function(station) {
//           return {
//             name: station.name[0],
//             abbr: station.abbr[0],
//             etd: station.etd.map(function(etd) {
//               return {
//                 destination: etd.abbreviation[0],
//                 departures: etd.estimate.map(function(estimate) {
//                   return {
//                     minutes: Number(estimate.minutes[0]) || 0,
//                     length: Number(estimate.length[0]),
//                     color: estimate.hexcolor[0],
//                     direction: estimate.direction[0]
//                   };
//                 })
//               };
//             })
//           };
//         })
//       };
//       console.log('resolving...');
//       deferred.resolve({data: compiledData, date: new Date(data.root.date[0]+" "+data.root.time[0])});
//     });
//   });
//   return deferred.promise;
// }
//
