node_modules: package.json
	npm install

subway_data.json: pull_subway_data.js node_modules
	node pull-subway-data.js > subway_data.json

index.html: subway_data.json template.html code.js
	
clean:
	rm -r subway_data.json index.html node_modules
	