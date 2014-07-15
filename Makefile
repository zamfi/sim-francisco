.SUFFIXES:
.SUFFIXES: .json .js .html
NETWORK=BART

RQ=
ifeq ($(NETWORK),BART)
	RQ="operator"="BART"
endif
# Other RQ's: "operator"="BART"

all: data data/subway_data.json data/subway_routes.topojson data/mapcontext_data.topojson data/system_api_data.json 
	
node_modules: package.json
	npm install; touch node_modules

data:
	mkdir data

data/subway_data.xml: pull-subway-data.js osmapi.js node_modules
	node pull-subway-data.js '$(RQ)' > data/subway_data.xml

data/subway_data.json: data/subway_data.xml process-subway-data.js node_modules
	node process-subway-data.js '$(RQ)' > data/subway_data.json

# data/subway_data.geojson: data/subway_data.xml node_modules
# 	node_modules/osmtogeojson/osmtogeojson data/subway_data.xml > data/subway_data.geojson
#
data/subway_routes.topojson: data/subway_data.json
	node_modules/topojson/bin/topojson data/subway_routes.geojson -p > data/subway_routes.topojson

data/mapcontext_data.xml: pull-coastline-data.js osmapi.js data/subway_data.json node_modules
	node pull-coastline-data.js '$(RQ)' > data/mapcontext_data.xml

data/mapcontext_data.geojson: data/mapcontext_data.xml node_modules
	node_modules/osmtogeojson/osmtogeojson data/mapcontext_data.xml > data/mapcontext_data.geojson
	
data/mapcontext_data.topojson: data/mapcontext_data.geojson node_modules
	node_modules/topojson/bin/topojson data/mapcontext_data.geojson -p > data/mapcontext_data.topojson

data/system_api_data_xml.json: pull-system-api-data.js node_modules
	node pull-system-api-data.js '$(NETWORK)' > data/system_api_data_xml.json

data/system_api_data.json: data/system_api_data_xml.json process-system-api-data.js data/subway_data.json node_modules
	node process-system-api-data.js > data/system_api_data.json

clean:
	rm -rf data
	
distclean: clean
	rm -rf node_modules
	