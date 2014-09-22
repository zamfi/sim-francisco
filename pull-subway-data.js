var osmapi = require('./osmapi');

var systemQueries = {
  BART: '"operator"="BART"',
  MTA: '"network"="NYC Subway"'
}

var queryArg = process.argv[2] || 'BART';

osmapi.doApiGet('(relation['+systemQueries[queryArg]+']);(._;>);out body;', function(err) {
  if (! err) {
    osmapi.status("...done.\n");
  } else {
    osmapi.status("Error:", err);
    process.exit(1);
  }
});