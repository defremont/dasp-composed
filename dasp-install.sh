# !/bin/bash

# Download Hyperledger Fabric
export FABRIC_VERSION=hlfv12

./fabric-dev-servers/downloadFabric.sh

# Install prereqsities for Hyperledger Composer
chmod u+x prereqs-ubuntu.sh

./prereqs-ubuntu.sh

# Init, Config &  IPFS
ipfs init

ipfs config Addresses.API /ip4/0.0.0.0/tcp/5001

ipfs config --json API.HTTPHeaders.Access-Control-Allow-Origin '["*"]'

ipfs config --json API.HTTPHeaders.Access-Control-Allow-Methods '["PUT", "GET", "POST"]'

ipfs config Addresses.Gateway /ip4/0.0.0.0/tcp/8081

# Install Composer CLI
npm install -g composer-cli@0.20.7

# Install Composer REST-Server
npm install -g composer-rest-server@0.20.7

# Install Generator Hyperledger Composer CLI
npm install -g generator-hyperledger-composer@0.20.7

# Install DASP Client
npm install --prefix ./dasp-composed

# Install GO-IPFS
cd go-ipfs

sudo ./install.sh

cd ..

# Build DASP Client UI
npm run build:prod --prefix ./dasp-composed
