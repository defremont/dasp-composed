# !/bin/bash

# Download Hyperledger Fabric
export FABRIC_VERSION=hlfv12

./fabric-dev-servers/downloadFabric.sh

# Install prereqsities for Hyperledger Composer
chmod u+x prereqs-ubuntu.sh

./prereqs-ubuntu.sh

# Install GO-IPFS
tar xvfz go-ipfs_v0.4.19_linux-amd64.tar

cd go-ipfs

./install.sh

cd ..

# Init, Config &  IPFS
ipfs init

ipfs config Addresses.API /ip4/0.0.0.0/tcp/5001

ipfs config --json API.HTTPHeaders.Access-Control-Allow-Origin '["*"]'

ipfs config --json API.HTTPHeaders.Access-Control-Allow-Methods '["PUT", "GET", "POST"]'

# Install Composer CLI
npm install -g composer-cli@0.20.7

# Install Composer REST-Server
npm install -g composer-rest-server@0.20.7

# Install Generator Hyperledger Composer CLI
npm install -g generator-hyperledger-composer@0.20.7

# Install DASP Client
npm install --prefix ./dasp-composed

# Install DASP API
npm install --prefix ./dasp-composed-api

