function drawBasemap(world, object, svg, projector) {
  var timing = {};
  // console.log("world is", world);
  timing.start = Date.now();
  var featureCollection = topojson.feature(world, object);
  timing.feature1 = Date.now();
  // console.log("feature collection is", featureCollection);

  function mergedCoastlines() {
    var coastlineSegments = object.geometries.filter(AND(isCoastline, isLineString));
    // create canonical point objects for use in object equivalence
    var canonicalPoints = {}
    function canonicalPoint(lonlat) {
      if (! canonicalPoints[lonlat[0]]) {
        canonicalPoints[lonlat[0]] = {};
      }
      if (! canonicalPoints[lonlat[0]][lonlat[1]]) {
        canonicalPoints[lonlat[0]][lonlat[1]] = lonlat;
      }
      return canonicalPoints[lonlat[0]][lonlat[1]];
    }
    function arcStart(arc) {
      return canonicalPoint(arc[0]);
    }
    function arcEnd(arc) {
      return canonicalPoint(arc.reduce(function(previousValue, currentValue) {
        return [previousValue[0] + currentValue[0], previousValue[1] + currentValue[1]];
      }));
    }
    // arc indices are twos-complement inverted (~ operator) to indicate arc point reversal.
    var startPoints = coastlineSegments.map(function(geometry) {
      var startArcIndex = geometry.arcs[0];
      var startPoint = startArcIndex < 0 ? arcEnd(world.arcs[~startArcIndex]) : arcStart(world.arcs[startArcIndex]);
      return startPoint;
    });
    var endPoints = coastlineSegments.map(function(geometry) {
      var endArcIndex = geometry.arcs[geometry.arcs.length-1]
      var endPoint = endArcIndex < 0 ? arcStart(world.arcs[~endArcIndex]) : arcEnd(world.arcs[endArcIndex]);
      return endPoint;
    });
    var previousSegments = coastlineSegments.map(function(geometry, index) {
      var previousSegmentIndex = endPoints.indexOf(startPoints[index]);
      return previousSegmentIndex < 0 ? null : previousSegmentIndex;
    });
    var nextSegments = coastlineSegments.map(function(geometry, index) {
      var nextSegmentIndex = startPoints.indexOf(endPoints[index]);
      return nextSegmentIndex < 0 ? null : nextSegmentIndex;
    });
    // console.log("coastline is", coastlineSegments, startPoints, endPoints, previousSegments, nextSegments);

    var compoundSegments = [];
    unhitSegments = coastlineSegments.slice();
    unhitSegments.forEach(function(geometry, index) {
      if (geometry !== null) {
        var currentCompound = [index]
        compoundSegments.push(currentCompound);
        unhitSegments[index] = null;
        var nextSegment = nextSegments[index];
        while (nextSegment !== null && unhitSegments[nextSegment] !== null) {
          currentCompound.push(nextSegment);
          unhitSegments[nextSegment] = null;
          nextSegment = nextSegments[nextSegment];
        }
        var prevSegment = previousSegments[index]
        while (prevSegment !== null && unhitSegments[prevSegment] !== null) {
          currentCompound.unshift(prevSegment);
          unhitSegments[prevSegment] = null;
          prevSegment = previousSegments[prevSegment];
        }
      }
    });
    return {
      type: "GeometryCollection",
      geometries: 
        compoundSegments.map(function(segmentIndices, index) {
          var isClosed = previousSegments[segmentIndices[0]] == segmentIndices[segmentIndices.length-1];
          var arcs = segmentIndices.reduce(function(oldArcs, segIndex) {
            return oldArcs.concat(coastlineSegments[segIndex].arcs);
          }, []);
          return {
            type: "Polygon",
            properties: {
              natural: "coastline",
              mergedFrom: segmentIndices.map(function(segIndex) {
                return coastlineSegments[segIndex].id
              }).join(","),
              inverted: !isClosed
            },
            id: "compound-segment/"+index,
            arcs: isClosed ? 
              [arcs.map(function(arc) {
                return ~arc;
              }).reverse()] : 
              [arcs]
          };
        }).sort(function(a, b) {
          return (b.properties.inverted ? 1 : 0) - (a.properties.inverted ? 1 : 0);
        })
    };
  }

  var coastlineGeometryCollection = mergedCoastlines();
  timing.merged = Date.now();
  console.log("geometry collection", world, coastlineGeometryCollection);
  var coastlineFeatureCollection = topojson.feature(world, coastlineGeometryCollection);
  timing.coastlineFeature = Date.now();

  var collections = [
    AND(isCoastline, NOT(isLineString)), isPark, isWater, isRiver, isMinorRoad, isMajorRoad, isHighway
  ].map(function(featureFilter) {
    return {
      type: "FeatureCollection",
      features: featureCollection.features.filter(featureFilter)
    };
  });
  collections.unshift({type: "FeatureCollection", features: coastlineFeatureCollection.features.filter(NOT(isInverted)) });
  collections.unshift({type: "FeatureCollection", features: coastlineFeatureCollection.features.filter(isInverted) });
  var classNames = ["coast-inverted", "coast", "coast", "park", "water", "river", "minor-road", "major-road", "highway"];

  timing.svgStart = Date.now();

  classNames.forEach(function(className, index) {
    svg.append("path")
        .attr("class", className)
        .datum(collections[index])
        .attr("d", projector);
  });

  timing.svg = Date.now();
  console.log("basemap feature1", timing.feature1 - timing.start, 
              "merged", timing.merged - timing.feature1,
              "coastline", timing.coastlineFeature - timing.merged,
              "collection processing", timing.svgStart - timing.coastlineFeature,
              "svg", timing.svg - timing.svgStart);
}