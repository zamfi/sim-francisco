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

// needed for fancy markers
L.RotatedMarker = L.Marker.extend({
  options: { angle: 0 },
  _setPos: function(pos) {
    L.Marker.prototype._setPos.call(this, pos);
    if (L.DomUtil.TRANSFORM) {
      // use the CSS transform rule if available
      var appendage = ' rotate(' + this.options.angle + 'deg)' + (this.options.flip ? ' scaleX(-1)' : '');
      this._icon.style[L.DomUtil.TRANSFORM] += appendage;
      this._shadow.style[L.DomUtil.TRANSFORM] += appendage;
    } else if (L.Browser.ie) {
      // fallback for IE6, IE7, IE8
      var rad = this.options.angle * L.LatLng.DEG_TO_RAD,
          costheta = Math.cos(rad),
          sintheta = Math.sin(rad);
      var appendage = ' progid:DXImageTransform.Microsoft.Matrix(sizingMethod=\'auto expand\', M11=' +
        costheta + ', M12=' + (-sintheta) + ', M21=' + sintheta + ', M22=' + costheta + ')' + (this.options.flip ? ' FlipH' : '');
      this._icon.style.filter += appendage;
      this._shadow.style.filter += appendage;
    }
  },
  // replace built-in update function to get sub-pixel rendering.
	update: function () {
		if (this._icon) {
			var pos = this._map.project(this._latlng)._subtract(this._map.getPixelOrigin()); 
			this._setPos(pos);
		}
		return this;
	}
});
L.rotatedMarker = function(pos, options) {
  return new L.RotatedMarker(pos, options);
};

function decodeGeometry(encoded, precision) {
  if (precision === undefined) {
    precision = 6; // defaults to 6, thanks to https://github.com/Project-OSRM/osrm-frontend/blob/develop/WebContent/routing/OSRM.RoutingGeometry.js
  }
	precision = Math.pow(10, -precision);
	var len = encoded.length, index=0, lat=0, lng = 0, array = [];
	while (index < len) {
		var b, shift = 0, result = 0;
		do {
			b = encoded.charCodeAt(index++) - 63;
			result |= (b & 0x1f) << shift;
			shift += 5;
		} while (b >= 0x20);
		var dlat = ((result & 1) ? ~(result >> 1) : (result >> 1));
		lat += dlat;
		shift = 0;
		result = 0;
		do {
			b = encoded.charCodeAt(index++) - 63;
			result |= (b & 0x1f) << shift;
			shift += 5;
		} while (b >= 0x20);
		var dlng = ((result & 1) ? ~(result >> 1) : (result >> 1));
		lng += dlng;
		//array.push( {lat: lat * precision, lng: lng * precision} );
		array.push( [lat * precision, lng * precision] );
	}
	return array;
}

// var svgBasemap = d3.select("body").append("svg")
//     .attr("id", "basemap")
//     .attr("width", width)
//     .attr("height", height).append("g").attr("class", "viewport");
//
// var svg = d3.select("body").append("svg")
//     .attr("id", "map")
//     .attr("width", width)
//     .attr("height", height);
// var svgBase = svg.append("g").attr("class", "viewport");
// var svgOverlay = svg.append("g");

// var projection = d3.geo.mercator()
//   .center(lonlat).scale(scale).translate([width/2, height/2])
// var projector = d3.geo.path().projection(projection)


// queue()
//   .defer(d3.json, "data/mapcontext_data.topojson")
//   .defer(d3.json, "data/subway_routes.topojson")
//   .defer(d3.json, "data/gtfs_data.json")
//   .await(setupBaseMap);
  
// function setupBaseMap(err, mapContext, subwayTopo, gtfsData) {
//   var start_t = Date.now();
//   console.log("mapcontext", mapContext);
//   drawBasemap(mapContext, mapContext.objects.mapcontext_data, svgBase, projector);
//   var baseMap_t = Date.now();
//   // console.log("subwaydata", subwayTopo);
//   drawSubwayData(subwayTopo, gtfsData, svgBase, svgOverlay, projection, projector);
//   var subway_t = Date.now();
//   console.log("mapdraw time", baseMap_t - start_t, "subwaytime", subway_t - subway_t);
//   svgPanZoom('#map', {
//     minZoom: 1,
//     maxZoom: 40,
//     fit: false,
//     center: false
//   });
// }

var routeNameMap = {
  "San Francisco Int'l Airport": "San Francisco International Airport"
};

var colorMap = {
  'ffff33': 'yellow',
  'ff9933': 'orange',
  '339933': 'green',
  'ff0000': 'red',
  'ee352e': 'red',
  '0099cc': 'blue',
  'd5cfa3': 'silver'
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
        return feature.properties.ref.toLowerCase() == colorMap[route.route_color.toLowerCase()]; 
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
      // path.unshift(endpointLonlats.from);
      // path.push(endpointLonlats.to);
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
      console.log("wtf? coordinates has non-number pair");
      debugger;
      // console.log("interpolatePathDistance with non-number coordinates:", coordinates.map(function(coordinate) {
      //   return coordinate[0] + "("+typeof(coordinate[0])+")"+", "+coordinate[1]+"("+typeof(coordinate[1])+")";
      // }).join(", "), distance);
    }
    var distanceSoFar = 0;
    for (var i = 0; i < coordinates.length-1; ++i) {
      var stepDistance = lonlatDistance(coordinates[i], coordinates[i+1]);
      if (distanceSoFar + stepDistance > distance) {
        return [ coordinates[i][0] + (coordinates[i+1][0]-coordinates[i][0]) * (distance - distanceSoFar)/stepDistance,
                 coordinates[i][1] + (coordinates[i+1][1]-coordinates[i][1]) * (distance - distanceSoFar)/stepDistance ];
      }
      distanceSoFar += stepDistance;
    }
    return coordinates[coordinates.length-1];
  },
  interpolateNormalVector: function(coordinates, distance, window) {
    return {
      from: this.interpolatePathDistance(coordinates, distance-window/2),
      to: this.interpolatePathDistance(coordinates, distance+window/2)
    };
  },
  
  mapCompletionTime: function (totalMinutes, completion) {
    // see Journal 2014.8 for derivation here
    var rampTime = Math.min(15/60, totalMinutes/2);
    var M = totalMinutes;
    var t = M * completion;
    var Vmax = 1/(M-rampTime);
    
    var P = 0;
    if (t < rampTime) {
      P = t*t/2 * Vmax/rampTime; 
    } else if (t < M-rampTime) {
      P = (rampTime/2 + t-rampTime) * Vmax;
    } else if (t < M) {
      var k = (M-t);
      P = (M - rampTime - k*k/(2*rampTime)) * Vmax;
    } else {
      P = 1;
    }
    return P;
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
      var lastStopDepartureTime = this.stopDepartureTime(trip, trip.stops[lastStopIndex]);
      var nextStopArrivalTime = this.stopArrivalTime(trip, trip.stops[nextStopIndex]);
      if (+this.stopDepartureTime(trip, trip.stops[nextStopIndex]) == +nextStopArrivalTime) {
        // leave 20 seconds of time between arrival and departure at the next stop
        nextStopArrivalTime = nextStopArrivalTime.minus(20/60); 
      }
      var completion = Math.min((timeObject - lastStopDepartureTime) / (nextStopArrivalTime - lastStopDepartureTime) || 1, 1);
      var totalSegmentMinutes = (nextStopArrivalTime - lastStopDepartureTime) || 0.5;
      var out = {
        between: [trip.stops[lastStopIndex].stop_id, trip.stops[nextStopIndex].stop_id],
        between_index: [lastStopIndex, nextStopIndex],
        trip: trip,
        completion: this.mapCompletionTime(totalSegmentMinutes, completion)
      };
      var linkKey = connectionKey(out.between[0], out.between[1]);
      // console.log("getting link", this.stationLinks[trip.route_id], trip.stops, linkKey, this.stationLinks[trip.route_id][connectionKey(out.between[0], out.between[1])]);
      var stationLinks = this.stationLinks[trip.route_id][linkKey];
      if (stationLinks instanceof Array &&
          stationLinks[0] instanceof Array &&
          stationLinks[0][0] instanceof Array) {
        stationLinks = stationLinks[0];
      }
      out.position = this.interpolatePathDistance(
        stationLinks, out.completion * this.totalDistance(stationLinks));
      out.vector = this.interpolateNormalVector(
        stationLinks, out.completion * this.totalDistance(stationLinks), 0.1);
      return out;
    }, this);
  },
  
  // map.latLngToLayerPoint rounds to the nearest pixel; subpixel rendering looks much better!
  lonLatToPoint: function(map, lonlat) {
    return map.project(L.latLng([lonlat[1], lonlat[0]]))._subtract(map.getPixelOrigin());
  },
  
  vectorToAngle: function(map, vector) {
    var fromPos = this.lonLatToPoint(map, vector.from);
    var toPos = this.lonLatToPoint(map, vector.to);
    return Math.atan2(toPos.y-fromPos.y, toPos.x-fromPos.x) * 180/Math.PI;
  },
  
  plotTrains: function(map, trainData, trainFeatureLayer) {
    var zoomLevel = map.getZoom();
    var zoomFactor = zoomLevel > 13 ? 1 : Math.pow(1.3, -zoomLevel+13);
    trainFeatureLayer.clearLayers();
    trainData.forEach(function(d) {
      var coordinates = [d.position[1], d.position[0]];
      var angle;
      if (d.vector) {
        angle = this.vectorToAngle(map, d.vector);
      }
      L.rotatedMarker(coordinates,
        {
          icon: L.icon({
            iconUrl: '/icons/'+this.routesById[d.trip.route_id].route_color+'/train.png',
            iconSize: [50/zoomFactor, 25/zoomFactor],
            shadowUrl: '/icons/shadow/train.png',
            shadowSize: [50/zoomFactor, 25/zoomFactor]
          }),
          angle: angle > 90 ? angle - 180 : angle < -90 ? angle + 180 : angle,
          flip: angle > 90 || angle < -90
          // icon: L.mapbox.marker.icon({
          //   'marker-color': this.routesById[d.trip.route_id].route_color,
          //   'marker-symbol': 'rail-metro'
          // })
        }).addTo(trainFeatureLayer);
    }, this);
  },
  
  // drawTrains: function(trainData, svg, projection, projector) {
  //   var sim = this;
  //   var trainGroup = svg.selectAll('.train').data(trainData);
  //   var trainEntry = trainGroup
  //     .enter().append("g")
  //     .attr("class", "train")
  //     .on("click", function(d) {
  //       var out = [d.trip.trip_id, "train bound for", d.trip.stops[d.trip.stops.length-1].stop_id,
  //         "is", Math.round(d.completion*100)+"%", "of the way between", d.between[0], "and", d.between[1],
  //         "\n\nScheduled departure at", d.trip.stops[d.between_index[0]].departure,
  //         "and arrival at", d.trip.stops[d.between_index[1]].arrival];
  //       if (d.trip.delay) {
  //         out.push("\n\nDelayed by", d.trip.delay.departure.minutesSinceStart(), "minutes at", d.trip.delay.at.stop_id);
  //       }
  //       alert(out.join(" "));
  //     });
  //   trainEntry.append("circle")
  //     .attr("class", "traincircle")
  //     .attr("r", 7);
  //   trainGroup.select('.traincircle')
  //     .attr("fill", function(d) {
  //       return '#'+sim.routesById[d.trip.route_id].route_color;
  //     })
  //     .attr("cx", function(d) {
  //       var cx = projection(d.position.coordinates)[0]
  //       if (isNaN(cx)) {
  //         console.log("failed to find X coordinate for trip", d);
  //       }
  //       return cx;
  //     })
  //     .attr("cy", function(d) {
  //       return projection(d.position.coordinates)[1];
  //     });
  //   trainEntry.append("path")
  //     .attr("class", "trainnose");
  //   trainGroup.select('.trainnose')
  //     .attr("stroke-width", function(d) {
  //       return d.trip.delay ? 2 : 1;
  //     })
  //     .attr("d", function(d) {
  //       if (! d.position.nextCoordinates && ! d.position.lastCoordinates) {
  //         // console.log("failed to draw train nose for", d);
  //         return null;
  //       }
  //       var start = projection(d.position.coordinates);
  //       var end = projection(d.position.nextCoordinates || d.position.lastCoordinates);
  //       var len = Math.sqrt((start[0]-end[0])*(start[0]-end[0]) + (start[1]-end[1])*(start[1]-end[1]));
  //       var desiredLength = d.trip.delay ? 15 : 10;
  //       end = [desiredLength * (start[0]-end[0]) / len, desiredLength * (start[1]-end[1]) / len];
  //       return ["M",start.join(" "),
  //               "l",end.join(" ")].join(" ");
  //     });
  //   trainGroup.exit().remove();
  // },

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

function SimRunner(sim, map, trainFeatureLayer) {
  this.sim = sim;
  this.map = map;
  this.trainFeatureLayer = trainFeatureLayer;

  this.minutes = 4*60;
  this.lastUpdate = new Date();
  
  this.realtime = true;
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
  // sim.drawTrains(trainData, this.trainGroup, this.projection, this.projector);    
  this.sim.plotTrains(this.map, trainData, this.trainFeatureLayer);
  // console.log("updated train positions in ", Date.now() - now, "ms");

  // var times = this.svgOverlay.selectAll('.time').data([now]);
  // times
  //   .enter()
  //   .append('text')
  //   .classed('time', true)
  //   .attr('x', 3)
  //   .attr('y', 15);
  // times
  //   .text(time);
}
SimRunner.prototype.updateRealtime = function() {
  var sim = this.sim;
  $.getJSON('/realtime', function (updates) {
    console.log("got realtime data!", updates);
    sim.applyRealtimeData(updates);
  });
}
SimRunner.prototype.start = function() {
  this.lastUpdate = new Date();
  this.updateFunction = function() {
    if (! this.updateInterval) {
      return;
    }
    this.updateTrainPositions();
    requestAnimationFrame(this.updateFunction);
  }.bind(this);
  this.updateInterval = requestAnimationFrame(this.updateFunction);
  this.updateTrainPositions();
}
SimRunner.prototype.stop = function() {
  cancelAnimationFrame(this.updateInterval);
  delete this.updateInterval;
}
SimRunner.prototype.isRunning = function() {
  return !! this.updateInterval;
}

function drawSubwayData(subwayData, apiData, map) {
  console.log("topographical data", subwayData);
  console.log("gtfs data", apiData);
  console.log("stop_time sample", apiData.stop_times.slice(100, 200));
  var routeFeatures = topojson.feature(subwayData, subwayData.objects.subway_routes);
  var sim = window.sim = new SubwaySimulator(routeFeatures.features, apiData)
  
  var trackFeatureLayer = L.mapbox.featureLayer(routeFeatures).addTo(map);
  trackFeatureLayer.setStyle({
    color: 'gray',
    weight: 4
  });
  var trainFeatureLayer = L.mapbox.featureLayer().addTo(map);
  // svg.selectAll(".line")
  //   .data(routeFeatures)
  //   .enter().append("path")
  //     .attr("class", "line")
  //     // .on("mouseover", function(d) {
  //     //   console.log(d);
  //     // })
  //     .attr("d", projector);
  // svg.selectAll(".station")
  //   .data(apiData.stops)
  //   .enter().append("path")
  //     .attr("class", "station")
  //     .attr("d", function(d) {
  //       return projector({type: "Point", coordinates: [Number(d.stop_lon), Number(d.stop_lat)]});
  //     })
  //     .on("click", function(d) {
  //       if (sim.lastStationEtdData) {
  //         alert(JSON.stringify(sim.lastStationEtdData.filter(function(station) {
  //           return station.abbr == d.abbr;
  //         })[0], false, 2));
  //       }
  //     });
  // svg.selectAll(".stationLink")
  //   .data(Object.keys(sim.stationLinks['01']))
  //   .enter().append("path")
  //     .attr("class", "stationLink")
  //     .attr("d", function (d) {
  //       // console.log("link", d, "yields", sim.stationLinks['01'][d]);
  //       return projector({ type: "LineString", coordinates: sim.stationLinks['01'][d] });
  //     });
  // var trainGroup = svg.append("g");

  var simRunner = window.simRunner = new SimRunner(sim, map, trainFeatureLayer);
  simRunner.start();
}

$(function() {
  var src, dst;
  L.mapbox.accessToken = 'pk.eyJ1IjoiemFtZmkiLCJhIjoiS3pqd2FzOCJ9.5pXWQcVx39wMbSxu8HL1Dw';
  var map = L.mapbox.map('map', 'zamfi.j7fanp6l')
      .setView(lonlat.reverse(), 12)
      .on('click', function(e) {
        if (!src) {
          src = e.latlng;
        } else {
          dst = e.latlng;
          $.ajax({
            url: 'http://localhost:5000/viaroute',
            data: {
              loc: [src.lat+","+src.lng, dst.lat+","+dst.lng]
            },
            traditional: true,
            dataType: "jsonp",
            jsonp: "jsonp",
            success: function(data, status, xhr) {
              src = null;
              dst = null;
              alert(JSON.stringify(data));
              var routeCoordinates = decodeGeometry(data.route_geometry);
              console.log(routeCoordinates);
              var geojson = {type: "LineString", coordinates: routeCoordinates.map(function(latlng) {
                return latlng.slice().reverse();
              })};
              L.geoJson(geojson).addTo(map);
            },
            cache: true
          });
        }
        alert("You clicked at "+e.latlng);
      });
  $.getJSON('data/subway_routes.topojson', function(subwayTopo) {
    $.getJSON('data/gtfs_data.json', function(gtfsData) {
      drawSubwayData(subwayTopo, gtfsData, map);
      $('#pausebutton').on('click', function() {
        if (window.simRunner.isRunning()) {
          window.simRunner.stop();
          $(this).text('Resume');
        } else {
          window.simRunner.start();
          $(this).text('Pause');
        }
      });
      $('#realtime').on('change', function() {
        window.simRunner.realtime = ! $(this).is(":checked");
        if (window.simRunner.realtime) {
          $('#pausebutton').hide();
        } else {
          $('#pausebutton').show();
        }
      });
    });
  });
  map.legendControl.addLegend(document.getElementById('legend').innerHTML);
});
