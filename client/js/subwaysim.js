var width = 1000,
    height = 700;

var agency = "BART";
var debug = true;

var agencyInfo = {
  MTA: {
    lonlat: [-73.9, 40.75],
    scale: 130000,
    agency_id: "MTA NYCT"
  },
  BART: {
    lonlat: [-122.25, 37.79],
    scale: 65000,
    agency_id: "BART"
  }
}

var lonlat = agencyInfo[agency].lonlat;
var scale = agencyInfo[agency].scale;

// var svgBasemap = d3.select("body").append("svg")
//     .attr("id", "basemap")
//     .attr("width", width)
//     .attr("height", height).append("g").attr("class", "viewport");
//
var svg = d3.select("body").append("svg")
    .attr("id", "map")
    .attr("width", width)
    .attr("height", height);
var svgBase = svg.append("g").attr("class", "viewport");
var svgOverlay = svg.append("g");

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
  drawBasemap(mapContext, mapContext.objects.mapcontext_data, svgBase, projector);
  var baseMap_t = Date.now();
  // console.log("subwaydata", subwayTopo);
  drawSubwayData(subwayTopo, gtfsData, svgBase, svgOverlay, projection, projector);
  var subway_t = Date.now();
  console.log("mapdraw time", baseMap_t - start_t, "subwaytime", subway_t - subway_t);
  svgPanZoom('#map', {
    minZoom: 1,
    maxZoom: 40,
    fit: false,
    center: false
  });
}

var routeNameMap = {
  "San Francisco Int'l Airport": "San Francisco International Airport"
};

var colorMap = {
  'ffff33': 'yellow',
  'ff9933': 'orange',
  '339933': 'green',
  'ff0000': 'red',
  'ee352e': 'red',
  '0099cc': 'blue'
  // 'yellow': 'ffff33',
  // 'orange': 'ff9933',
  // 'green': '339933',
  // 'red': 'ff0000',
  // 'blue': '0099cc'
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
    return route.agency_id == agencyInfo[agency].agency_id;
  });
  
  this.trips = apiData.trips;
  this.tripsById = arrayToObject(apiData.trips, 'trip_id');

  // console.log("trips by id", this.tripsById);

  apiData.stop_times.forEach(function (stop_time) {
    var trip = this.tripsById[stop_time.trip_id];
    if (! trip) { 
      // console.log("stop_time entry refers to phantom trip id", stop_time);
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
      // console.log("trip without any stops", trip);
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
  // console.log("routeFeatures", routeFeatures, routeFeatures.some(function(routeFeature) {
  //   typeof(routeFeature.geometry.coordinates[0]) != 'number' || typeof(routeFeature.geometry.coordinates[0]) != 'number';
  // }));
  this.routes.forEach(function (route) {
    var neededConnections = connections[route.route_id];
    for (var k in neededConnections) {
      var endpoints = connectionDecode(k);
      var endpointLonlats = {
        from: [Number(this.stopsByAbbreviation[endpoints.from].stop_lon), Number(this.stopsByAbbreviation[endpoints.from].stop_lat)],
        to: [Number(this.stopsByAbbreviation[endpoints.to].stop_lon), Number(this.stopsByAbbreviation[endpoints.to].stop_lat)]
      };
      var possibleRoutes = routeFeatures.filter(function (feature) {
        return (feature.properties.colour || feature.properties.color) == colorMap[route.route_color.toLowerCase()]; 
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
      if (possibleRoutes.length == 0 || ! possibleRoutes[chosenRoute]) {
        console.log("couldn't find corresponding route for route", route, chosenRoute, possibleRoutes);
      }
      var path = possibleRoutes[chosenRoute].geometry.coordinates.slice(
        Math.min(endpointsIndexPerRoute[chosenRoute].from, endpointsIndexPerRoute[chosenRoute].to),
        Math.max(endpointsIndexPerRoute[chosenRoute].from, endpointsIndexPerRoute[chosenRoute].to)+1); // inclusive
      if (endpointsIndexPerRoute[chosenRoute].from > endpointsIndexPerRoute[chosenRoute].to) {
        path.reverse();
      }
      if (path.length < 1) {
        console.log("couldn't find a path for", k);
      }
      path.unshift(endpointLonlats.from);
      path.push(endpointLonlats.to);
      neededConnections[k] = path;
      // console.log("found connection for endpoints", endpoints.from, endpoints.to, path,
      //             "possible routes was", possibleRoutes, "preferred endpointindex was", endpointsIndexPerRoute,
      //             "chosen route was", chosenRoute);
      // console.log("connection", endpoints.from, endpoints.to, chosenRoute, path.length);
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
    if (! coordinates) {
      return Number.MIN_VALUE;
    }
    for (var i = 1; i < coordinates.length; ++i) {
      total += lonlatDistance(coordinates[i-1], coordinates[i]);
    }
    return total;
  },
  interpolatePathDistance: function(coordinates, distance) {
    if (coordinates.some(function(coordinatePair) {
      return typeof(coordinatePair[0]) != 'number' || typeof(coordinatePair[1]) != 'number';
    })) {
      // console.log("interpolatePathDistance with non-number coordinates:", coordinates.map(function(coordinate) {
      //   return coordinate[0] + "("+typeof(coordinate[0])+")"+", "+coordinate[1]+"("+typeof(coordinate[1])+")";
      // }).join(", "), distance);
    }
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
          // break;
        }
        // if (this.stopArrivalTime(trip, trip.stops[i]) >= timeObject && nextStopIndex === undefined) {
        //   nextStopIndex = i;
        // }
      }
      nextStopIndex = Math.min(lastStopIndex+1, trip.stops.length-1);
      // if (lastStopIndex == nextStopIndex) {
      //   nextStopIndex++;
      // }
      var out = {
        between: [trip.stops[lastStopIndex].stop_id, trip.stops[nextStopIndex].stop_id],
        between_index: [lastStopIndex, nextStopIndex],
        trip: trip,
        completion: (timeObject - this.stopDepartureTime(trip, trip.stops[lastStopIndex])) / ((this.stopArrivalTime(trip, trip.stops[nextStopIndex]) - this.stopDepartureTime(trip, trip.stops[lastStopIndex])) || 1)
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
      .attr("r", 7);
    trainGroup.select('.traincircle')
      .attr("fill", function(d) { 
        return '#'+sim.routesById[d.trip.route_id].route_color;
      })
      .attr("cx", function(d) {
        var cx = projection(d.position.coordinates)[0]
        if (isNaN(cx)) {
          console.log("failed to find X coordinate for trip", d);
        }
        return cx;
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
          // console.log("Found delayed train!", tripId, tripStop);
        } else {
          delete tripStop.delay;
        }
      }, this);
    }, this);
  }
}

function SimRunner(sim, svgOverlay, trainGroup, projection, projector) {
  this.sim = sim;
  this.svgOverlay = svgOverlay;
  this.trainGroup = trainGroup;
  this.projection = projection;
  this.projector = projector;

  this.minutes = 4*60;
  this.lastUpdate = new Date();
  
  this.realtime = false;
  if (this.realtime) {
    this.realtimeInterval = setInterval(this.updateRealtime.bind(this), 61000);
    this.updateRealtime();
  }
}
SimRunner.prototype.updateTrainPositions = function() {
  var now = new Date();
  
  if (! this.realtime) {
    this.minutes += (+now - this.lastUpdate) / (1000); // 1 minute per second;
    now.setHours(this.minutes / 60);
    now.setMinutes(Math.floor(this.minutes % 60));
    now.setSeconds((this.minutes % 1) * 60);
    // console.log("minutes", minutes, now);
    this.lastUpdate = new Date();
  }
  
  var hour = now.getHours();
  var time = new Time(hour < 3 ? 24+hour : hour, now.getMinutes() + now.getSeconds()/60 + now.getMilliseconds()/60000);
  var trainData = this.sim.trainPositions(time, ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][now.getDay()]);
  // console.log("train positions!", trainData);
  sim.drawTrains(trainData, this.trainGroup, this.projection, this.projector);    
  // console.log("updated train positions in ", Date.now() - now, "ms");

  var times = this.svgOverlay.selectAll('.time').data([now]);
  times
    .enter()
    .append('text')
    .classed('time', true)
    .attr('x', 3)
    .attr('y', 15);
  times
    .text(time);
}
SimRunner.prototype.updateRealtime = function() {
  d3.json('/realtime', function (err, updates) {
    console.log("got realtime data!", updates);
    this.sim.applyRealtimeData(updates);
  });
}
SimRunner.prototype.start = function() {
  this.lastUpdate = new Date();
  this.updateInterval = setInterval(this.updateTrainPositions.bind(this), 50);
  this.updateTrainPositions();
}
SimRunner.prototype.stop = function() {
  clearInterval(this.updateInterval);
}

function drawSubwayData(subwayData, apiData, svg, svgOverlay, projection, projector) {
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

  var simRunner = window.simRunner = new SimRunner(sim, svgOverlay, trainGroup, projection, projector);
  simRunner.start();
}

function pause() {
}