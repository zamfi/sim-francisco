var request = require('request');
var xml2js = require('xml2js');
var util = require('util');

var SUBWAY_RELATION = "2621040";
var OSM_BASE_PATH = "http://overpass-api.de/api/interpreter?data=";

var apiCalls = 0;
var cacheHits = 0;
var multiCalls = 0;

function status(arg1, arg2, etc) {
  process.stderr.write(Array.prototype.join.call(arguments, ' '));
}

function doApiGet(query, cb) {
  request.get(OSM_BASE_PATH+encodeURIComponent(query), function(error, response, body) {
    if (!error && response.statusCode == 200) {
      xml2js.parseString(body, cb);
    } else {
      cb(error || response.statusCode);
    }
  });  
}

function getTagValue(obj, key) {
  var tags = obj.tag.filter(function(tag) { return tag.$.k == key; });
  if (tags.length == 0) { return null; }
  return tags[0].$.v;
}

function getTagObject(obj) {
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
      data: getTagObject(obj)
    };
  },
  way: function(obj) {
    return {
      id: obj.$.id,
      nodes: obj.nd.map(function(node) {return node.$.ref}),
      data: getTagObject(obj)
    };
  }
}

function getRefMap(osm, type) {
  var out = {};
  osm[type].forEach(function(obj) {
    out[obj.$.id] = typeConverters[type](obj);
  });
  return out;
}

function getAllLines(cb) {
  var lines = {
    title: "NYC Subway"
  };
  status('Getting line data from Open Street Map...\n');
  doApiGet('(relation["network"="NYC Subway"]);(._;>);out body;', function(err, data) {
    if (err) { return cb(err); }
    
    status('Creating node and way reference maps...\n');
    lines.nodes = getRefMap(data.osm, 'node');
    lines.ways = getRefMap(data.osm, 'way');
    
    status('Processing lines... ');
    data.osm.relation.filter(function(rel) { return getTagValue(rel, 'type') == 'route'; }).forEach(function(rel) {
      var lineData = getTagObject(rel);

      lineData.stops = rel.member.filter(function(m) { return m.$.type == 'node' && m.$.role == 'stop'; }).map(function(m) { return m.$.ref; });
      lineData.segments = rel.member.filter(function(m) { return m.$.type == 'way' }).map(function(m) { return m.$.ref });

      lines[lineData.ref] = lineData;
      status(lineData.ref+' ');
    });
    status('...done\n');
    cb(null, lines);
    // console.log(util.inspect(data, null, null));
  });
}

getAllLines(function(err, lines) {
  // console.log(util.inspect(lines, null, null));
  process.stdout.write(JSON.stringify(lines));
});

// function getRelation(relation, cb) {
//   doApiGet('relation', relation, cb);
// }
// function getWay(way, cb) {
//   doApiGet('way', way, cb);
// }
// function getNode(node, cb) {
//   doApiGet('node', node, cb);
// }
// 
// function fillWays(wayList, cb) {
//   var count = wayList.length;
//   wayList.forEach(function(way, i) {
//     getWay(way, function(err, wayData) {
//       if (err) { return cb(err); }
//       wayList[i] = {id: way, nodes: wayData[0].nd.map(function(node) {return node.$.ref;})};
//       fillNodes(wayList[i].nodes, function(err) {
//         if (err) { return cb(err); }
//         count--;
//         if (count == 0) { cb(null); }        
//       })
//     });
//   })
// }
// 
// function fillNodes(nodeList, cb) {
//   var count = nodeList.length;
//   nodeList.forEach(function(node, i) {
//     getNode(node, function(err, nodeData) {
//       if (err) { return cb(err); }
//       nodeList[i] = {id: node, lat: nodeData[0].$.lat, lon: nodeData[0].$.lon};
//       count--;
//       if (count == 0) { cb(null); }
//     });
//   });
// }
// 
// function getLineData(lineRelation, cb) {
//   var lineData = {
//     ways: [],
//     stops: []
//   };
//   getRelation(lineRelation, function(err, data) {
//     if (err) { return cb(err); }
//     lineData.line = data[0].tag.filter(function(tag) {return tag.$.k == 'ref'})[0].$.v;
//     lineData.ways = data[0].member.filter(function(d) {return d.$.type == 'way'}).map(function(d) {return d.$.ref});
//     lineData.stops = data[0].member.filter(function(d) {return d.$.type == 'node' && d.$.role == 'stop'}).map(function(d) {return d.$.ref});
//     fillWays(lineData.ways, function(err) {
//       if (err) { return cb(err); }
//       fillNodes(lineData.stops, function(err) {
//         if (err) { return cb(err); }
//         cb(null, lineData);
//       })
//     })
//   });
// }
// 
// function getAllLines(cb) {
//   var out = {lines:{}, desc: "NYC Subway Lines"};
//   getRelation(SUBWAY_RELATION, function(err, data) {
//     if (err) { return cb(err); }
//     var count = data[0].member.length;
//     util.error('Getting line data...');
//     data[0].member.forEach(function(d) {
//       getLineData(d.$.ref, function(err, lineData) {
//         if (err) { return cb(err); }
//         count--;
//         util.error("Got line "+lineData.line);
//         if (count == 0) { util.error("...done."); cb(null, out); }
//       });
//     })
//   });  
// }
// 
// getAllLines(function(err, lines) {
//   if (err) {
//     return util.error(err);
//   }
//   util.error("Got all lines... "+cacheHits+" cache hits, "+multiCalls+" multi-calls.");
//   console.log(JSON.stringify(lines));
// })