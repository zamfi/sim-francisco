.SUFFIXES:
.SUFFIXES: .json .js .html
NETWORK=BART

RQ=
ifeq ($(NETWORK),BART)
	RQ="operator"="BART"
endif
# Other RQ's: "operator"="BART"

all: subway_data.json coastline_data.json system_api_data.json 
	
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

system_api_data_xml.json: pull-system-api-data.js node_modules
	node pull-system-api-data.js '$(NETWORK)' > system_api_data_xml.json

system_api_data.json: system_api_data_xml.json process-system-api-data.js subway_data.json node_modules
	node process-system-api-data.js > system_api_data.json

clean:
	rm -rf {subway,coastline,system_api}_data{,_xml}.{xml,json}
	
distclean: clean
	rm -rf node_modules
	