# DASP v0.0.1
Decentralized Autonomous Scientific Publisher\
Install & Use guide\

DASP pré-requisitos\
Hyperledger Fabric\
Hyperledger Composer\
IPFS Daemon s\

Hyperledger Composer pré-requisitos
Para executar o Hyperledger Composer e o Hyperledger Fabric, recomendamos que você tenha pelo menos 4 GB de memória.
A seguir estão pré-requisitos para instalar as ferramentas de desenvolvimento necessárias:

Sistemas operacionais: Ubuntu Linux 14.04 / 16.04 LTS (ambos de 64 bits) ou Mac OS 10.12
Mecanismo do Docker: Versão 17.03 ou superior
Docker-Compose: versão 1.8 ou superior
Node: 8.9 ou superior (a versão 9 da nota não é suportada)
Npm: v5.x
Git: 2.9.x ou superior
Python: 2.7.x 
Um editor de código de sua escolha, recomendamos o VSCode.


Hyperledger Composer pré-requisitos
Se você está rodando no Ubuntu, você pode baixar os pré-requisitos usando os seguintes comandos:
curl -O https://hyperledger.github.io/composer/latest/prereqs-ubuntu.sh chmod u+x prereqs-ubuntu.sh
Em seguida, execute o script - como isso usa brevemente o sudo durante sua execução, você será solicitado a fornecer sua senha.
./prereqs-ubuntu.sh



Instalando Componentes
Ferramentas essenciais do CLI:	
npm install -g composer-cli@0.20.7
Utilitário para executar um servidor REST em sua máquina para expor suas redes de negócios como APIs RESTful:	
npm install -g composer-rest-server@0.20.7
Útil para gerar ativos de aplicativos:
npm install -g generator-hyperledger-composer@0.20.7




Instalando o IPFS a partir do pacote
Primeiro, baixe a versão correta do IPFS para sua plataforma:
https://dist.ipfs.io/#go-ipfs


Após o download, descompacte o arquivo e mova o ipfs binário para algum lugar nos executáveis $PATH usando o install.sh script:
tar xvfz go-ipfs.tar.gz
cd go-ipfs
./install.sh

Utilizando o script para iniciar o DASP
Dentro do pacote dasp-composed contém um arquivo chamado dasp.sh execute-o:
./dasp.sh

Esse script limpa o fabric, limpa docker, reinicia o fabric, instala o business card, instala e inicia o ipfs daemon, instala o node-red no docker com o flow apropriado; instala e inicia o projeto client e api.

Após todo o processo, você pode acessar o dasp: http://localhost:3000

