function drawBasemap(world, object, svg, projector) {
  var timing = {};
  // console.log("world is", world);
  timing.start = Date.now();
  var featureCollection = topojson.feature(world, object);
  timing.feature1 = Date.now();
  // console.log("feature collection is", featureCollection);

  function closeUnclosedCoastlineFeatures(featureCollection) {
    featureCollection.features.filter(NOT(isClosed)).forEach(function(feature) {
      console.log("unclosed coastline:", feature);
      var lineCoordinates = feature.geometry.coordinates[0];
      var bounds = lineCoordinates.reduce(function(prev, cur) {
        if (cur[0] < prev.left) {
          prev.left = cur[0];
        }
        if (cur[0] > prev.right) {
          prev.right = cur[0];
        }
        if (cur[1] < prev.bottom) {
          prev.bottom = cur[1];
        }
        if (cur[1] > prev.top) {
          prev.top = cur[1];
        }
        return prev;
      }, {left: Number.MAX_VALUE, right: -Number.MAX_VALUE, bottom: Number.MAX_VALUE, top: -Number.MAX_VALUE});
      console.log("bounded by", bounds);
      var startPoint = lineCoordinates[0];
      var endPoint = lineCoordinates[lineCoordinates.length-1];
      var boundOrder = ['bottom', 'left', 'top', 'right'];
      function closestBound(lonlat) {
        var distances = boundOrder.map(function(boundKey) {
          switch (boundKey) {
            case 'left':
            case 'right':
              return Math.abs(lonlat[0] - bounds[boundKey]);
            case 'bottom':
            case 'top':
              return Math.abs(lonlat[1] - bounds[boundKey]);
          }
        });
        var shortestIndex = distances.reduce(function(shortestIndex, distance, index) {
          return distance < distances[shortestIndex] ? index : shortestIndex;
        }, 0);
        console.log("distances are", distances, "shortest at", shortestIndex);
        return boundOrder[shortestIndex];
      }
      var endPointClosestBound = closestBound(endPoint);
      var startPointClosestBound = closestBound(startPoint);
      var boundIndex = boundOrder.indexOf(endPointClosestBound);
      console.log("closest bounds are", endPointClosestBound, "to", startPointClosestBound, "; starting at index", boundIndex);
      var boundTrack = [];
      while (boundOrder[boundIndex] != startPointClosestBound) {
        boundTrack.push(boundOrder[boundIndex]);
        boundIndex = (boundIndex + 1) % boundOrder.length;
        if (boundTrack.length > boundOrder.length * 2) {
          // there was an error here.
          break;
        }
      }
      boundTrack.push(boundOrder[boundIndex]);

      console.log("will track bounds", boundTrack);
      function closestPointOnBound(fromPoint, bound) {
        switch(bound) {
          case 'left':
          case 'right':
            return [bounds[bound], fromPoint[1]];
          case 'bottom':
          case 'top':
            return [fromPoint[0], bounds[bound]];
        }
      }
      boundTrack.forEach(function(boundName) {
        lineCoordinates.push(closestPointOnBound(lineCoordinates[lineCoordinates.length-1], boundName));
      });
      lineCoordinates.push(lineCoordinates[0]);
    });
    return featureCollection;
  }

  function generateGeometryPolygons() {
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
              isClosed: isClosed
            },
            id: "compound-segment/"+index,
            arcs: [arcs]
          };
        })
    };
  }

  var coastlineGeometryCollection = generateGeometryPolygons();
  timing.merged = Date.now();
  console.log("geometry collection", world, coastlineGeometryCollection);
  var coastlineFeatureCollection = topojson.feature(world, coastlineGeometryCollection);
  timing.coastlineFeature = Date.now();

  var collections = [
    isPark, AND(isCoastline, NOT(isLineString)), isWater, isRiver, isMinorRoad, isMajorRoad, isHighway
  ].map(function(featureFilter) {
    return {
      type: "FeatureCollection",
      features: featureCollection.features.filter(featureFilter)
    };
  });
  collections.splice(1, 0, closeUnclosedCoastlineFeatures(coastlineFeatureCollection));
  var classNames = ["park", "coast", "coast", "water", "river", "minor-road", "major-road", "highway"];

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