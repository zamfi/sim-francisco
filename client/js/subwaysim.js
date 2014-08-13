var width = 1024,
    height = 1024;

var lonlat = [-122.25, 37.75];
var scale = 75000;

var svg = d3.select("body").append("svg")
    .attr("id", "map")
    .attr("width", width)
    .attr("height", height).append("g").attr("class", "viewport");

var projection = d3.geo.mercator()
  .center(lonlat).scale(scale).translate([width/2, height/2])
var projector = d3.geo.path().projection(projection)


queue()
  .defer(d3.json, "data/mapcontext_data.topojson")
  .defer(d3.json, "data/subway_routes.topojson")
  .defer(d3.json, "data/gtfs_data.json")
  .await(setupBaseMap);
  
function setupBaseMap(err, mapContext, subwayTopo, gtfsData) {
  var start_t = Date.now();
  console.log("mapcontext", mapContext);
  drawBasemap(mapContext, mapContext.objects.mapcontext_data, svg, projector);
  var baseMap_t = Date.now();
  // console.log("subwaydata", subwayData);
  drawSubwayData(subwayTopo, gtfsData, svg, projection, projector);
  var subway_t = Date.now();
  console.log("mapdraw time", baseMap_t - start_t, "subwaytime", subway_t - subway_t);
  // svgPanZoom('#map', {
  //   minZoom: 1,
  //   maxZoom: 40
  // });
}

var routeNameMap = {
  "San Francisco Int'l Airport": "San Francisco International Airport"
};

var colorMap = {
  'yellow': 'ffff33',
  'orange': 'ff9933',
  'green': '339933',
  'red': 'ff0000',
  'blue': '0099cc'
};

// distance in miles
function lonlatDistance(lonlat1, lonlat2) { 
  var R = 3959; // 6371; // km
  var φ1 = lonlat1[1] * Math.PI/180; // lat1.toRadians();
  var φ2 = lonlat2[1] * Math.PI/180; // lat2.toRadians();
  var Δφ = (lonlat2[1] - lonlat1[1]) * Math.PI/180; // (lat2-lat1).toRadians();
  var Δλ = (lonlat2[0] - lonlat1[0]) * Math.PI/180; // (lon2-lon1).toRadians();

  var a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
          Math.cos(φ1) * Math.cos(φ2) *
          Math.sin(Δλ/2) * Math.sin(Δλ/2);
  var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

  var d = R * c;
  return d;
}

function arrayToObject(array, id) {
  var out = {};
  for (var i = 0; i < array.length; ++i) {
    out[array[i][id]] = array[i];
  }
  return out;
}

function connectionKey(fromAbbr, toAbbr) {
  return [fromAbbr, toAbbr].join("::");
}
function connectionDecode(s) {
  var parts = s.split("::");
  return {
    from: parts[0],
    to: parts[1]
  };
}

function SubwaySimulator(routeFeatures, apiData) {  
  this.stops = apiData.stops;
  this.stopsByAbbreviation = arrayToObject(apiData.stops, 'stop_id');
  
  this.routes = apiData.routes.filter(function (route) {
    return route.agency_id == 'BART';
  });
  
  this.trips = apiData.trips;
  this.tripsById = arrayToObject(apiData.trips, 'trip_id');

  // console.log("trips by id", this.tripsById);

  apiData.stop_times.forEach(function (stop_time) {
    var trip = this.tripsById[stop_time.trip_id];
    if (! trip) { 
      console.log("stop_time entry refers to phantom trip id", stop_time); 
      return; 
    }
    if (! trip.stops) {
      trip.stops = [];
    }
    // update a little
    stop_time.arrival = Time.fromString(stop_time.arrival_time);
    stop_time.departure = Time.fromString(stop_time.departure_time);
    stop_time.stop_sequence = Number(stop_time.stop_sequence);
    trip.stops.push(stop_time);
  }, this);
  
  var connections = this.stationLinks = {};
  this.trips.forEach(function(trip) {
    if (! trip.stops) {
      console.log("trip without any stops", trip);
      return;
    }
    trip.stops.sort(function (a, b) {
      return a.stop_sequence - b.stop_sequence;
    });
    trip.stops.forEach(function (stop, index) {
      if (index == 0) { return; }
      if (! connections[trip.route_id]) {
        connections[trip.route_id] = {};
      }
      connections[trip.route_id][connectionKey(trip.stops[index-1].stop_id, stop.stop_id)] = true;
    });
  }, this);
  
  this.routeFeatures = routeFeatures;
  this.routes.forEach(function (route) {
    var neededConnections = connections[route.route_id];
    for (var k in neededConnections) {
      var endpoints = connectionDecode(k);
      var endpointLonlats = {
        from: [this.stopsByAbbreviation[endpoints.from].stop_lon, this.stopsByAbbreviation[endpoints.from].stop_lat],
        to: [this.stopsByAbbreviation[endpoints.to].stop_lon, this.stopsByAbbreviation[endpoints.to].stop_lat]
      };
      var possibleRoutes = routeFeatures.filter(function (feature) {
        return colorMap[feature.properties.colour] == route.route_color; // BART-specific here, sadly.
      });
      var endpointsIndexPerRoute = possibleRoutes.map(function (features) {
        return {
          from: features.geometry.coordinates.reduce(function(prev, current, index, coordinates) {
            if (lonlatDistance(current, endpointLonlats.from) < lonlatDistance(coordinates[prev], endpointLonlats.from)) {
              return index;
            } else {
              return prev;
            }
          }, 0),
          to: features.geometry.coordinates.reduce(function(prev, current, index, coordinates) {
            if (lonlatDistance(current, endpointLonlats.to) < lonlatDistance(coordinates[prev], endpointLonlats.to)) {
              return index;
            } else {
              return prev;
            }
          }, 0)
        }
      });
      var chosenRoute = endpointsIndexPerRoute.reduce(function (prev, current, index, points) {
        if (current.from + current.to < points[prev].from + points[prev].to) {
          return index;
        } else {
          return prev;
        }
      }, 0);
      var path = possibleRoutes[chosenRoute].geometry.coordinates.slice(
        Math.min(endpointsIndexPerRoute[chosenRoute].from, endpointsIndexPerRoute[chosenRoute].to),
        Math.max(endpointsIndexPerRoute[chosenRoute].from, endpointsIndexPerRoute[chosenRoute].to)+1); // inclusive
      if (endpointsIndexPerRoute[chosenRoute].from > endpointsIndexPerRoute[chosenRoute].to) {
        path.reverse();
      }
      neededConnections[k] = path;
      // console.log("found connection for endpoints", endpoints.from, endpoints.to, path,
      //             "possible routes was", possibleRoutes, "preferred endpointindex was", endpointsIndexPerRoute,
      //             "chosen route was", chosenRoute);
      console.log("connection", endpoints.from, endpoints.to, chosenRoute, path.length);
    }
  }, this);
  this.routesById = arrayToObject(this.routes, 'route_id');
  
  this.calendar = apiData.calendar;
  this.calendarDates = apiData.calendarDates; // should do something with this at some point.
  
  // console.log("all station links", this.stationLinks);

  // set up feature for each route
  // this.routes.forEach(function(route) {
  //   var fullFrom = this.stationsByAbbreviation[route.from].name;
  //   if (fullFrom in routeNameMap) {
  //     fullFrom = routeNameMap[fullFrom];
  //   }
  //   var fullTo = this.stationsByAbbreviation[route.to].name;
  //   if (fullTo in routeNameMap) {
  //     fullTo = routeNameMap[fullTo];
  //   }
  //   route.feature = routeFeatures.filter(function(feature) {
  //     return feature.properties.from == fullFrom &&
  //              feature.properties.to == fullTo;
  //   })[0];
  //   if (! route.feature) {
  //     alert("D'oh! Failed to find features for route from "+fullFrom+" to "+fullTo);
  //   }
  //   route.stationAbbrToIndex = {};
  //   route.stations.forEach(function(abbr) {
  //     var station = this.stationsByAbbreviation[abbr];
  //     var stationPos = [station.lon, station.lat];
  //     // console.log("route.feature", route.feature);
  //     route.stationAbbrToIndex[abbr] = route.feature.geometry.coordinates.reduce(function(prev, current, index, coordinates) {
  //       if (lonlatDistance(current, stationPos) < lonlatDistance(coordinates[prev], stationPos)) {
  //         return index;
  //       } else {
  //         return prev;
  //       }
  //     }, 0);
  //   }, this);
  // }, this);
  
  // console.log("routes", this.routes);
}

SubwaySimulator.prototype = {
  activeServiceFilter: function(day) {
    var activeServices = this.calendar.filter(function(service) {
      return service[day] == 1;
    });
    return function(trip) {
      return activeServices.some(function(service) {
        return trip.service_id == service.service_id;
      });
    }
  },
  
  totalDistance: function(coordinates) {
    var total = 0;
    for (var i = 1; i < coordinates.length; ++i) {
      total += lonlatDistance(coordinates[i-1], coordinates[i]);
    }
    return total;
  },
  interpolatePathDistance: function(coordinates, distance) {
    var distanceSoFar = 0;
    for (var i = 0; i < coordinates.length-1; ++i) {
      var stepDistance = lonlatDistance(coordinates[i], coordinates[i+1]);
      if (distanceSoFar + stepDistance > distance) {
        return {
          coordinates:
            [ coordinates[i][0] + (coordinates[i+1][0]-coordinates[i][0]) * (distance - distanceSoFar)/stepDistance,
              coordinates[i][1] + (coordinates[i+1][1]-coordinates[i][1]) * (distance - distanceSoFar)/stepDistance ],
          nextCoordinates: coordinates[i+1]
        }
      }
      distanceSoFar += stepDistance;
    }
    return {
      coordinates: coordinates[coordinates.length-1],
      lastCoordinates: coordinates[coordinates.length-2]
    };
  },
  
  stopDepartureTime: function(trip, stop) {
    return Time.fromMinutesSinceStart(stop.departure + (trip.delay ? trip.delay.departure : 0));
  },
  stopArrivalTime: function(trip, stop) {
    return Time.fromMinutesSinceStart(stop.arrival + (trip.delay ? trip.delay.arrival : 0));
  },
  trainPositions: function(timeObject, dayOfWeek) {
    var activeTrains = this.trips.filter(this.activeServiceFilter(dayOfWeek)).filter(function(trip) {
      return timeObject > trip.stops[0].departure && timeObject < trip.stops[trip.stops.length-1].arrival;
    });
    // console.log("active trains!", activeTrains.length, activeTrains);
    return activeTrains.map(function(trip) {
      var nextStopIndex;
      var lastStopIndex;
      for (var i = 0; i < trip.stops.length; ++i) {
        if (this.stopDepartureTime(trip, trip.stops[i]) <= timeObject) {
          lastStopIndex = i;
        }
        if (this.stopArrivalTime(trip, trip.stops[i]) >= timeObject && nextStopIndex === undefined) {
          nextStopIndex = i;
        }
      }
      if (lastStopIndex == nextStopIndex) {
        nextStopIndex++;
      }
      var out = {
        between: [trip.stops[lastStopIndex].stop_id, trip.stops[nextStopIndex].stop_id],
        between_index: [lastStopIndex, nextStopIndex],
        trip: trip,
        completion: (timeObject - this.stopDepartureTime(trip, trip.stops[lastStopIndex])) / (this.stopArrivalTime(trip, trip.stops[nextStopIndex]) - this.stopDepartureTime(trip, trip.stops[lastStopIndex]))
      };
      var linkKey = connectionKey(out.between[0], out.between[1]);
      // console.log("getting link", this.stationLinks[trip.route_id], trip.stops, linkKey, this.stationLinks[trip.route_id][connectionKey(out.between[0], out.between[1])]);
      out.position = this.interpolatePathDistance(
        this.stationLinks[trip.route_id][linkKey],
        out.completion * this.totalDistance(this.stationLinks[trip.route_id][linkKey]));
      return out;
    }, this);
  },
  
  drawTrains: function(trainData, svg, projection, projector) {
    var sim = this;
    var trainGroup = svg.selectAll('.train').data(trainData);
    var trainEntry = trainGroup
      .enter().append("g")
      .attr("class", "train")
      .on("click", function(d) {
        var out = [d.trip.trip_id, "train bound for", d.trip.stops[d.trip.stops.length-1].stop_id,
          "is", Math.round(d.completion*100)+"%", "of the way between", d.between[0], "and", d.between[1],
          "\n\nScheduled departure at", d.trip.stops[d.between_index[0]].departure, 
          "and arrival at", d.trip.stops[d.between_index[1]].arrival];
        if (d.trip.delay) {
          out.push("\n\nDelayed by", d.trip.delay.departure.minutesSinceStart(), "minutes at", d.trip.delay.at.stop_id);
        }
        alert(out.join(" "));
      });
    trainEntry.append("circle")
      .attr("class", "traincircle")
      .attr("r", 5);
    trainGroup.select('.traincircle')
      .attr("fill", function(d) { 
        return '#'+sim.routesById[d.trip.route_id].route_color;
      })
      .attr("cx", function(d) {
        return projection(d.position.coordinates)[0];
      })
      .attr("cy", function(d) {
        return projection(d.position.coordinates)[1];
      });
    trainEntry.append("path")
      .attr("class", "trainnose");
    trainGroup.select('.trainnose')
      .attr("stroke-width", function(d) {
        return d.trip.delay ? 2 : 1;
      })
      .attr("d", function(d) {
        if (! d.position.nextCoordinates && ! d.position.lastCoordinates) {
          // console.log("failed to draw train nose for", d);
          return null;
        }
        var start = projection(d.position.coordinates);
        var end = projection(d.position.nextCoordinates || d.position.lastCoordinates);
        var len = Math.sqrt((start[0]-end[0])*(start[0]-end[0]) + (start[1]-end[1])*(start[1]-end[1]));
        var desiredLength = d.trip.delay ? 15 : 10;
        end = [desiredLength * (start[0]-end[0]) / len, desiredLength * (start[1]-end[1]) / len];
        return ["M",start.join(" "),
                "l",end.join(" ")].join(" ");
      });
    trainGroup.exit().remove();
  },

  applyRealtimeData: function(realtime) {
    realtime.entity.forEach(function(entity) {
      var tripUpdate = entity.trip_update;
      var tripId = tripUpdate.trip.trip_id;
      tripUpdate.stop_time_update.forEach(function(update) {
        var stopSequence = update.stop_sequence;
        var arrivalDelay = update.arrival && update.arrival.delay;
        var departureDelay = update.departure && update.departure.delay;
        var trip = this.tripsById[tripId];
        var tripStop = trip.stops.filter(function(stop) {
          return stop.stop_sequence == stopSequence;
        })[0];
        if (arrivalDelay || departureDelay) {
          trip.delay = {
            departure: Time.fromMinutesSinceStart((departureDelay || arrivalDelay)/60),
            arrival: Time.fromMinutesSinceStart((arrivalDelay || departureDelay)/60),
            at: tripStop
          };
          console.log("Found delayed train!", tripId, tripStop);
        } else {
          delete tripStop.delay;
        }
      }, this);
    }, this);
  }
  // trainPositions: function(stationEtdData) {
  //   var trainData = [];
  //   var sim = this;
  //   sim.lastStationEtdData = stationEtdData;
  //   stationEtdData.forEach(function(station) {
  //     station.etd.forEach(function(etd) {
  //       etd.departures.filter(function(a) { return a.minutes <= 8; }).forEach(function(departure) {
  //         var route = sim.chooseLikelyRoute(departure.color, etd.destination, station.abbr);
  //         if (! route) { return; }
  //         console.log("Got route", route.from, "->", route.to, "for", departure.color, "train going to", etd.destination, "via", station.abbr);
  //         var previousStation = route.stations[Math.max(route.stations.indexOf(station.abbr)-1, 0)];
  //         var coordinates = sim.routeCoordinates(route, station.abbr, previousStation);
  //         if (! coordinates) { return; }
  //         console.log("got coordinates", coordinates);
  //         var position = sim.interpolatePathDistance(coordinates, departure.minutes/60 * 40 /*m/h*/);
  //         console.log("got position", position);
  //         trainData.push({color: departure.color, position: position, destination: etd.destination, arrivingAt: station.abbr, inMinutes: departure.minutes, route: route});
  //       });
  //     });
  //   });
  //   return trainData;
  // },
  //
  // drawTrains: function(trainData, svg, projection, projector) {
  //   var trainGroup = svg.selectAll('.train').data(trainData)
  //     .enter().append("g")
  //     .attr("class", "train")
  //     .on("click", function(d) {
  //       alert("train bound for "+d.destination+" arrives at "+d.arrivingAt+" in "+d.inMinutes+" minutes.\n\nVia route "+d.route.from+"->"+d.route.to+".");
  //     });
  //   trainGroup.append("circle")
  //     .attr("class", "traincircle")
  //     .attr("fill", function(d) { return d.color; })
  //     .attr("r", 5)
  //     .attr("cx", function(d) {
  //       return projection(d.position.coordinates)[0];
  //     })
  //     .attr("cy", function(d) {
  //       return projection(d.position.coordinates)[1];
  //     });
  //   trainGroup.append("path")
  //     .attr("class", "trainnose")
  //     .attr("d", function(d) {
  //       if (! d.position.nextCoordinates && ! d.position.lastCoordinates) {
  //         return "";
  //       }
  //       var start = projection(d.position.coordinates);
  //       var end = projection(d.position.nextCoordinates || d.position.lastCoordinates);
  //       var len = Math.sqrt((start[0]-end[0])*(start[0]-end[0]) + (start[1]-end[1])*(start[1]-end[1]));
  //       end = [10 * (start[0]-end[0]) / len, 10 * (start[1]-end[1]) / len];
  //       return ["M",start.join(" "),
  //               "l",end.join(" ")].join(" ");
  //     });
  // },
  //
  // chooseLikelyRoute: function(color, destination, nextStop) {
  //   for (var i = 0; i < this.routes.length; ++i) {
  //     if (this.routes[i].color == color &&
  //         (nextStop in this.routes[i].stationAbbrToIndex) &&
  //         (destination in this.routes[i].stationAbbrToIndex) &&
  //         (nextStop == destination || this.routes[i].stations.indexOf(destination) > this.routes[i].stations.indexOf(nextStop))) {
  //       return this.routes[i];
  //     }
  //   }
  //   return null;
  // },
  // routeCoordinates: function(route, from, to) {
  //   var i = route.stationAbbrToIndex[from],
  //       j = route.stationAbbrToIndex[to];
  //   var coordinateList = route.feature.geometry.coordinates.slice(Math.min(i, j), Math.max(i, j)+1);
  //   return i < j ? coordinateList : coordinateList.reverse();
  // }
}

function drawSubwayData(subwayData, apiData, svg, projection, projector) {
  console.log("topographical data", subwayData);
  console.log("gtfs data", apiData);
  console.log("stop_time sample", apiData.stop_times.slice(100, 200));
  var routeFeatures = topojson.feature(subwayData, subwayData.objects.subway_routes).features;
  var sim = window.sim = new SubwaySimulator(routeFeatures, apiData)
  svg.selectAll(".line")
    .data(routeFeatures)
    .enter().append("path")
      .attr("class", "line")
      // .on("mouseover", function(d) {
      //   console.log(d);
      // })
      .attr("d", projector);
  svg.selectAll(".station")
    .data(apiData.stops)
    .enter().append("path")
      .attr("class", "station")
      .attr("d", function(d) {
        return projector({type: "Point", coordinates: [Number(d.stop_lon), Number(d.stop_lat)]});
      })
      .on("click", function(d) {
        if (sim.lastStationEtdData) {
          alert(JSON.stringify(sim.lastStationEtdData.filter(function(station) {
            return station.abbr == d.abbr;
          })[0], false, 2));
        }
      });
  // svg.selectAll(".stationLink")
  //   .data(Object.keys(sim.stationLinks['01']))
  //   .enter().append("path")
  //     .attr("class", "stationLink")
  //     .attr("d", function (d) {
  //       // console.log("link", d, "yields", sim.stationLinks['01'][d]);
  //       return projector({ type: "LineString", coordinates: sim.stationLinks['01'][d] });
  //     });
  var trainGroup = svg.append("g");

  function updateTrainPositions() {
    var now = new Date();
    var hour = now.getHours();
    var trainData = sim.trainPositions(new Time(hour < 3 ? 24+hour : hour, now.getMinutes() + now.getSeconds()/60 + now.getMilliseconds()/60000), ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][now.getDay()]);
    // console.log("train positions!", trainData);
    sim.drawTrains(trainData, trainGroup, projection, projector);    
    // console.log("updated train positions in ", Date.now() - now, "ms");
  }
  setInterval(updateTrainPositions, 50);
  updateTrainPositions();
  
  function updateRealtime() {
    d3.json('/realtime', function (err, updates) {
      console.log("got realtime data!", updates);
      sim.applyRealtimeData(updates);
    });
  }
  setInterval(updateRealtime, 60000);
  updateRealtime();
  
  // d3.json('/bart', function(err, stationEtdData) {
  //   console.log("got bart data", stationEtdData);
  //   var trainData = sim.trainPositions(stationEtdData.stations);
  //   console.log("assumed train positions", trainData);
  //   sim.drawTrains(trainData, trainGroup, projection, projector);
  // });
}

