
function featureFilter(propKey, propValue) {
  return function(feature) {
    return ('properties' in feature) && feature.properties[propKey] === propValue;
  }
}
function OR(f1, f2, f3, etc) {
  var functions = Array.prototype.slice.call(arguments);
  return function(feature) {
    return functions.some(function(f) {
      return f(feature);
    });
  }
}
function AND(f1, f2, f3, etc) {
  var functions = Array.prototype.slice.call(arguments);
  return function(feature) {
    return functions.every(function(f) {
      return f(feature);
    });
  }
}
function NOT(f) {
  return function(feature) { return ! f(feature); };
}
var isHighway = featureFilter("highway", "motorway");
var isMajorRoad = OR(featureFilter("highway", "trunk"), featureFilter("highway", "primary"), featureFilter("highway", "motorway_link"), featureFilter("highway", "secondary"));
var isMinorRoad = featureFilter("highway", "tertiary");
var isCoastline = featureFilter("natural", "coastline");
var isWater = OR(featureFilter("natural", "water"), featureFilter("waterway", "riverbank"));
var isRiver = featureFilter("waterway", "river");
var isPark = OR(featureFilter("leisure", "park"), featureFilter("natural", "wood"), featureFilter("landuse", "recreation_ground"), featureFilter("boundary", "national_park"));

var isInverted = featureFilter("inverted", true);
var isLineString = function(feature) {
  return (feature.geometry ? feature.geometry.type : feature.type) == "LineString";
}

featureOrdering = [ isCoastline, isPark, isWater, isRiver, isMinorRoad, isMajorRoad, isHighway ];
function featurePriority(feature) {
  for (var i = 0; i < featureOrdering.length; ++i) {
    if (featureOrdering[i](feature)) {
      return i;
    }
  }
  return 0;
}