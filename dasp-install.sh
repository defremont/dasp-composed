# !/bin/bash

# Download Hyperledger Fabric
export FABRIC_VERSION=hlfv12

./fabric-dev-servers/downloadFabric.sh

# Install prereqsities for Hyperledger Composer
chmod u+x prereqs-ubuntu.sh

./prereqs-ubuntu.sh

# Init IPFS
ipfs init

ipfs daemon

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
