var request = require('request');

exports.status = function(arg1, arg2, etc) {
  process.stderr.write(Array.prototype.join.call(arguments, ' '));
}

var OSM_BASE_PATH = "http://overpass.osm.rambler.ru/cgi/interpreter?data=";

exports.doApiGet = function(query, cb) {
  var queryUrl = OSM_BASE_PATH+encodeURIComponent(query);
  exports.status('Getting network data...', queryUrl, "\n");
  request.get(queryUrl, function(error, response, body) {
    if (!error && response.statusCode == 200) {
      process.stdout.write(body, cb);
    } else {
      cb(error || response.statusCode);
    }
  });  
}


// creates a rectilinear approximation of distance / degree of lat or lon 
// depending on center lat/lon
exports.geoUtils = function(minLat, minLon, maxLat, maxLon) {
  var midLat = (minLat + maxLat) / 2;
  var midLon = (minLon + maxLon) / 2;

  var geo = {
    milesPerLat: 24860 / 360,
    milesPerLon: 24901 * Math.cos(midLat * Math.PI / 180) / 360,
    pos: function(lat, lon) { 
      return {
        x: this.milesPerLon * (lon-minLon),
        y: this.milesPerLat * (lat-minLat)
      };
    },
    dist: function(lat1, lon1, lat2, lon2) {
      var pos1 = this.pos(lat1, lon1),
          pos2 = this.pos(lat2, lon2);
      var delta = { x: pos2.x - pos1.x, y: pos2.y - pos1.y };
      return Math.sqrt(delta.x*delta.x + delta.y*delta.y);
    }
  };
  var mileRange = geo.pos(maxLat, maxLon);
  geo.range = { width: mileRange.x, height: mileRange.y };
  return geo;
}

exports.getTagValue = function(obj, key) {
  var tags = obj.tag.filter(function(tag) { return tag.$.k == key; });
  if (tags.length == 0) { return null; }
  return tags[0].$.v;
}

exports.getTagObject = function(obj) {
  if (! obj.tag) { return; }
  var out = {};
  obj.tag.forEach(function(tag) {
    out[tag.$.k] = tag.$.v;
  });
  return out;
}

var typeConverters = {
  node: function(obj) {
    return {
      id: obj.$.id,
      lat: obj.$.lat,
      lon: obj.$.lon,
      data: exports.getTagObject(obj)
    };
  },
  way: function(obj) {
    return {
      id: obj.$.id,
      nodes: obj.nd.map(function(node) {return node.$.ref}),
      data: exports.getTagObject(obj)
    };
  }
}

exports.getRefMap = function(osm, type) {
  var out = {};
  osm[type].forEach(function(obj) {
    out[obj.$.id] = typeConverters[type](obj);
  });
  return out;
}