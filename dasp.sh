# !/bin/bash
./fabric-dev-servers/stopFabric.sh && ./fabric-dev-servers/teardownFabric.sh

composer card delete --card admin@dasp-net && composer card delete --card PeerAdmin@hlfv1

docker rm $(docker ps -a -q) -f

docker rm mynodered

#docker rmi $(docker images -a -q) -f

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

ipfs daemon & npm start --prefix ./dasp-composed & npm start --prefix ./dasp-composed-api & docker run -it -p 1880:1880 --user=root:root -v $(pwd)/node-red-data:/data --name mynodered nodered/node-red-docker
