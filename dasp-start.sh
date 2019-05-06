# !/bin/bash

# Stop Fabric & Teardown Fabric
./fabric-dev-servers/stopFabric.sh && ./fabric-dev-servers/teardownFabric.sh

# Clean Composer
rm -rf ~/.composer

# Clean Docker containers
docker kill $(docker ps -q)

docker rm $(docker ps -aq)

# Clean Docker images
docker rmi $(docker images dev-* -q)

docker rmi $(docker images nodered* -q)

# Start Fabric & Create Peer Admin Card
./fabric-dev-servers/startFabric.sh && ./fabric-dev-servers/createPeerAdminCard.sh

# Install BNA on Hyperledger Faric with Hyperledger Composer
cd ./dasp-hyperledger

composer archive create -t dir -n .

composer network install --card PeerAdmin@hlfv1 --archiveFile dasp-net@0.0.1.bna

composer network start --networkName dasp-net --networkVersion 0.0.1 --networkAdmin admin --networkAdminEnrollSecret adminpw --card PeerAdmin@hlfv1 --file networkadmin.card

composer card import --file networkadmin.card

cd ..

ipfs config Addresses.API /ip4/0.0.0.0/tcp/5001

ipfs config --json API.HTTPHeaders.Access-Control-Allow-Origin '["*"]'

ipfs config --json API.HTTPHeaders.Access-Control-Allow-Methods '["PUT", "GET", "POST"]'

ipfs config Addresses.Gateway /ip4/0.0.0.0/tcp/8081

# Start IPFS, DASP Client & DASP API
ipfs daemon & ./dasp-composed/cli.js & docker run -it -p 1880:1880 --user=root:root -v $(pwd)/node-red-data:/data --name mynodered nodered/node-red-docker


