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
  .defer(d3.json, "data/system_api_data.json")
  .await(setupBaseMap);
  
function setupBaseMap(err, mapContext, subwayData, apiData) {
  var start_t = Date.now();
  // console.log("mapcontext", mapContext);
  drawBasemap(mapContext, mapContext.objects.mapcontext_data, svg, projector);
  var baseMap_t = Date.now();
  // console.log("subwaydata", subwayData);
  drawSubwayData(subwayData, apiData, svg, projection, projector);
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
  'yellow': '#ffff33',
  'orange': '#ff9933',
  'green': '#339933',
  'red': '#ff0000',
  'blue': '#0099cc'
};

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

// function lonlatDistanceSquared(projection, lonlat1, lonlat2) {
//   var pos1 = projection(lonlat1);
//   var pos2 = projection(lonlat2);
//   return (pos1[0] - pos2[0]) * (pos1[0] - pos2[0]) + (pos1[1] - pos2[1]) * (pos1[1] - pos2[1]);
// }

function SubwaySimulator(routeFeatures, apiData) {  
  this.stations = apiData.stations;
  this.stationsByAbbreviation = {};
  apiData.stations.forEach(function(station) {
    this.stationsByAbbreviation[station.abbr] = station;
  }, this);
  this.routes = apiData.routes;
  
  // set up feature for each route
  this.routes.forEach(function(route) {
    var fullFrom = this.stationsByAbbreviation[route.from].name;
    if (fullFrom in routeNameMap) {
      fullFrom = routeNameMap[fullFrom];
    }
    var fullTo = this.stationsByAbbreviation[route.to].name;
    if (fullTo in routeNameMap) {
      fullTo = routeNameMap[fullTo];
    }
    route.feature = routeFeatures.filter(function(feature) {
      return feature.properties.from == fullFrom &&
               feature.properties.to == fullTo;
    })[0];
    if (! route.feature) {
      alert("D'oh! Failed to find features for route from "+fullFrom+" to "+fullTo);
    }
    route.stationAbbrToIndex = {};
    route.stations.forEach(function(abbr) {
      var station = this.stationsByAbbreviation[abbr];
      var stationPos = [station.lon, station.lat];
      // console.log("route.feature", route.feature);
      route.stationAbbrToIndex[abbr] = route.feature.geometry.coordinates.reduce(function(prev, current, index, coordinates) {
        if (lonlatDistance(current, stationPos) < lonlatDistance(coordinates[prev], stationPos)) {
          return index;
        } else {
          return prev;
        }
      }, 0);
    }, this);
  }, this);
  
  console.log("routes", this.routes);
}

SubwaySimulator.prototype = {
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
  
  trainPositions: function(stationEtdData) {
    var trainData = [];
    var sim = this;
    sim.lastStationEtdData = stationEtdData;
    stationEtdData.forEach(function(station) {
      station.etd.forEach(function(etd) {
        etd.departures.filter(function(a) { return a.minutes <= 8; }).forEach(function(departure) {
          var route = sim.chooseLikelyRoute(departure.color, etd.destination, station.abbr);
          if (! route) { return; }
          console.log("Got route", route.from, "->", route.to, "for", departure.color, "train going to", etd.destination, "via", station.abbr);
          var previousStation = route.stations[Math.max(route.stations.indexOf(station.abbr)-1, 0)];
          var coordinates = sim.routeCoordinates(route, station.abbr, previousStation);
          if (! coordinates) { return; }
          console.log("got coordinates", coordinates);
          var position = sim.interpolatePathDistance(coordinates, departure.minutes/60 * 40 /*m/h*/);
          console.log("got position", position);
          trainData.push({color: departure.color, position: position, destination: etd.destination, arrivingAt: station.abbr, inMinutes: departure.minutes, route: route});
        });
      });
    });
    return trainData;
  },
  
  drawTrains: function(trainData, svg, projection, projector) {
    var trainGroup = svg.selectAll('.train').data(trainData)
      .enter().append("g")
      .attr("class", "train")
      .on("click", function(d) {
        alert("train bound for "+d.destination+" arrives at "+d.arrivingAt+" in "+d.inMinutes+" minutes.\n\nVia route "+d.route.from+"->"+d.route.to+".");
      });
    trainGroup.append("circle")
      .attr("class", "traincircle")
      .attr("fill", function(d) { return d.color; })
      .attr("r", 5)
      .attr("cx", function(d) {
        return projection(d.position.coordinates)[0];
      })
      .attr("cy", function(d) {
        return projection(d.position.coordinates)[1];
      });
    trainGroup.append("path")
      .attr("class", "trainnose")
      .attr("d", function(d) {
        if (! d.position.nextCoordinates && ! d.position.lastCoordinates) {
          return "";
        }
        var start = projection(d.position.coordinates);
        var end = projection(d.position.nextCoordinates || d.position.lastCoordinates);
        var len = Math.sqrt((start[0]-end[0])*(start[0]-end[0]) + (start[1]-end[1])*(start[1]-end[1]));
        end = [10 * (start[0]-end[0]) / len, 10 * (start[1]-end[1]) / len];
        return ["M",start.join(" "),
                "l",end.join(" ")].join(" ");
      });
  },

  chooseLikelyRoute: function(color, destination, nextStop) {
    for (var i = 0; i < this.routes.length; ++i) {
      if (this.routes[i].color == color && 
          (nextStop in this.routes[i].stationAbbrToIndex) &&
          (destination in this.routes[i].stationAbbrToIndex) &&
          (nextStop == destination || this.routes[i].stations.indexOf(destination) > this.routes[i].stations.indexOf(nextStop))) {
        return this.routes[i];
      }
    }
    return null;
  },
  routeCoordinates: function(route, from, to) {
    var i = route.stationAbbrToIndex[from],
        j = route.stationAbbrToIndex[to];
    var coordinateList = route.feature.geometry.coordinates.slice(Math.min(i, j), Math.max(i, j)+1);
    return i < j ? coordinateList : coordinateList.reverse();
  }
}

function drawSubwayData(subwayData, apiData, svg, projection, projector) {
  var routeFeatures = topojson.feature(subwayData, subwayData.objects.subway_routes).features;
  var sim = new SubwaySimulator(routeFeatures, apiData)
  svg.selectAll(".line")
    .data(routeFeatures)
    .enter().append("path")
      .attr("class", "line")
      // .on("mouseover", function(d) {
      //   console.log(d);
      // })
      .attr("d", projector);
  svg.selectAll(".station")
    .data(apiData.stations)
    .enter().append("path")
      .attr("class", "station")
      .attr("d", function(d) {
        return projector({type: "Point", coordinates: [Number(d.lon), Number(d.lat)]});
      })
      .on("click", function(d) {
        if (sim.lastStationEtdData) {
          alert(JSON.stringify(sim.lastStationEtdData.filter(function(station) {
            return station.abbr == d.abbr;
          })[0], false, 2));
        }
      });
  var trainGroup = svg.append("g");
  d3.json('/bart', function(err, stationEtdData) {
    console.log("got bart data", stationEtdData);
    var trainData = sim.trainPositions(stationEtdData.stations);
    console.log("assumed train positions", trainData);
    sim.drawTrains(trainData, trainGroup, projection, projector);
  });
}

