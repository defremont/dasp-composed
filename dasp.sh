# !/bin/bash

curl -O https://hyperledger.github.io/composer/latest/prereqs-ubuntu.sh

chmod u+x prereqs-ubuntu.sh

./prereqs-ubuntu.sh

./fabric-dev-servers/stopFabric.sh && ./fabric-dev-servers/teardownFabric.sh

npm install -g composer-cli@0.20.7

npm install -g composer-rest-server@0.20.7

npm install -g generator-hyperledger-composer@0.20.7

# composer card delete --card admin@dasp-net && composer card delete --card PeerAdmin@hlfv1

docker rm $(docker ps -a -q) -f

# docker rmi $(docker images -a -q) -f

rm -rf ~/.composer

docker images -a | grep "dev-peer0" | awk '{print $3}' | xargs docker rmi

export FABRIC_VERSION=hlfv12
./fabric-dev-servers/downloadFabric.sh

./fabric-dev-servers/startFabric.sh && ./fabric-dev-servers/createPeerAdminCard.sh

cd ./dasp-hyperledger
composer archive create -t dir -n .
composer network install --card PeerAdmin@hlfv1 --archiveFile dasp-net@0.0.1.bna
composer network start --networkName dasp-net --networkVersion 0.0.1 --networkAdmin admin --networkAdminEnrollSecret adminpw --card PeerAdmin@hlfv1 --file networkadmin.card
composer card import --file networkadmin.card
composer network ping --card admin@dasp-net 

cd ..

ipfs init

ipfs config Addresses.API /ip4/0.0.0.0/tcp/5001

ipfs config --json API.HTTPHeaders.Access-Control-Allow-Origin '["*"]'

ipfs config --json API.HTTPHeaders.Access-Control-Allow-Methods '["PUT", "GET", "POST"]'

npm install --prefix ./dasp-composed

npm install --prefix ./dasp-composed-api


ipfs daemon & npm start --prefix ./dasp-composed/node_modules/composer-playground-api & npm start --prefix ./dasp-composed & docker run -it -p 1880:1880 --user=root:root -v $(pwd)/node-red-data:/data --name mynodered nodered/node-red-docker