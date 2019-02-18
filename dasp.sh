#!/bin/bash
./fabric-dev-servers/stopFabric.sh && ./fabric-dev-servers/teardownFabric.sh

composer card delete --card admin@dasp-net && composer card delete --card PeerAdmin@hlfv1

docker rm $(docker ps -a -q) -f

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

npm install --prefix ./composer-playground & npm install --prefix ./composer-playground-api

npm start --prefix ./composer-playground & npm start --prefix ./composer-playground-api


