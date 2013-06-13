.SUFFIXES:
.SUFFIXES: .json .js .html

all: subway_data.json
	
node_modules: package.json
	npm install; touch node_modules

subway_data.xml: pull-subway-data.js node_modules
	node pull-subway-data.js > subway_data.xml

subway_data.json: subway_data.xml process-subway-data.js node_modules
	node process-subway-data.js > subway_data.json
	
clean:
	rm -rf subway_data.xml subway_data.json node_modules
	