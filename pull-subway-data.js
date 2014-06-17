var osmapi = require('./osmapi');

var queryArg = process.argv[2] || '"network"="NYC Subway"';

osmapi.doApiGet('(relation['+queryArg+']);(._;>);out body;', function(err) {
  if (! err) {
    osmapi.status("...done.\n");
  } else {
    osmapi.status("Error:", err);
    process.exit(1);
  }
});