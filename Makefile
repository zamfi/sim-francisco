.SUFFIXES:
.SUFFIXES: .json .js .html
NETWORK=BART

all: data data/subway_data.json data/subway_routes.topojson data/mapcontext_data.topojson data/gtfs_data.json
	
node_modules: package.json
	npm install; touch node_modules

data:
	mkdir data

data/subway_data.xml: pull-subway-data.js osmapi.js node_modules
	node pull-subway-data.js '$(NETWORK)' > data/subway_data.xml

data/subway_data.json: data/subway_data.xml process-subway-data.js node_modules
	node process-subway-data.js '$(NETWORK)' > data/subway_data.json

data/subway_routes.topojson: data/subway_data.json
	node_modules/topojson/bin/topojson data/subway_routes.geojson -p > data/subway_routes.topojson

data/mapcontext_data.xml: pull-coastline-data.js osmapi.js data/subway_data.json node_modules
	node pull-coastline-data.js '$(NETWORK)' > data/mapcontext_data.xml

data/mapcontext_data.geojson: data/mapcontext_data.xml node_modules
	node_modules/osmtogeojson/osmtogeojson data/mapcontext_data.xml > data/mapcontext_data.geojson
	
data/mapcontext_data.topojson: data/mapcontext_data.geojson node_modules
	node_modules/topojson/bin/topojson -s 0.000000001 data/mapcontext_data.geojson -p > data/mapcontext_data.topojson

data/gtfs_data: pull-gtfs-data.js node_modules
	node pull-gtfs-data.js '$(NETWORK)' data/gtfs_data

data/gtfs_data.json: data/gtfs_data process-gtfs-data.js node_modules
	node process-gtfs-data.js '$(NETWORK)' data/gtfs_data > data/gtfs_data.json

clean:
	rm -rf data
	
distclean: clean
	rm -rf node_modules
	