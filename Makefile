.SUFFIXES:
.SUFFIXES: .json .js .html
NETWORK=BART

RQ=
ifeq ($(NETWORK),BART)
	RQ="operator"="BART"
	STATIONS='http://api.bart.gov/api/stn.aspx?cmd=stns&key=MW9S-E7SL-26DU-VV8V' -o station_data.xml
endif
# Other RQ's: "operator"="BART"

all: subway_data.json coastline_data.json station_data.json 
	
node_modules: package.json
	npm install; touch node_modules

subway_data.xml: pull-subway-data.js osmapi.js node_modules
	node pull-subway-data.js '$(RQ)' > subway_data.xml

subway_data.json: subway_data.xml process-subway-data.js node_modules
	node process-subway-data.js '$(RQ)' > subway_data.json

coastline_data.xml: pull-coastline-data.js osmapi.js subway_data.json node_modules
	node pull-coastline-data.js '$(RQ)' > coastline_data.xml

coastline_data.json: coastline_data.xml process-coastline-data.js node_modules
	node process-coastline-data.js > coastline_data.json

station_data.xml:
	curl $(STATIONS)

station_data.json: station_data.xml process-station-data.js subway_data.json node_modules
	node process-station-data.js > station_data.json

clean:
	rm -rf {subway,coastline,station}_data.{xml,json}
	
distclean: clean
	rm -rf node_modules
	