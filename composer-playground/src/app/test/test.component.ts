/*
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
import { Component, OnDestroy, OnInit } from '@angular/core';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { ClientService } from '../services/client.service';
import { AlertService } from '../basic-modals/alert.service';
import { TransactionComponent } from './transaction/transaction.component';
import { TransactionDeclaration } from 'composer-common';
import { DrawerDismissReasons } from '../common/drawer';

import { IdentityCardService } from "../../app/services/identity-card.service";
import { Router } from '@angular/router';
import { THIS_EXPR } from '@angular/compiler/src/output/output_ast';
const IPFS = require('ipfs-mini');
const ipfs = new IPFS({ host: "ipfs.infura.io", port: 5001, protocol: "https"});

/* tslint:disable-next-line:no-var-requires */
const uuid = require('uuid');
@Component({
    selector: 'app-test',
    templateUrl: './test.component.html',
    styleUrls: [
        './test.component.scss'.toString()
    ]
})

export class TestComponent implements OnInit, OnDestroy {

    hasTransactions = false;
    private registries = {
        assets: [],
        participants: [],
        historian: null
    };
    private chosenRegistry = null;
    private registryReload = false;
    private eventsTriggered = [];
    private articleBase64: string = '';
    articleHash: any;
    // from transaction
    private transactionTypes: TransactionDeclaration[] = [];
    private selectedTransaction = null;
    private selectedTransactionName: string = null;
    private hiddenTransactionItems = new Map();
    private submittedTransaction = null;
    private includeOptionalFields: boolean = false;

    private resourceDefinition: string = null;
    private submitInProgress: boolean = false;
    private showToReview: boolean;
    private showMyRevisions: boolean;
    private definitionError: string = null;


    private codeConfig = {
        lineNumbers: true,
        lineWrapping: true,
        readOnly: false,
        mode: 'application/ld+json',
        autofocus: true,
        extraKeys: {
            'Ctrl-Q': (cm) => {
                cm.foldCode(cm.getCursor());
            }
        },
        foldGutter: true,
        gutters: ['CodeMirror-linenumbers', 'CodeMirror-foldgutter'],
        scrollbarStyle: 'simple'
    };
    isPaid: any;
    tags: any;
    id: any;
    loadingHash: boolean;
    chosenMenu: any = 'upload';
    constructor(private clientService: ClientService,
        public router: Router,
        private alertService: AlertService,
        private modalService: NgbModal,
        private identityCardService: IdentityCardService) {
    }

    ngOnInit(): Promise<any> {
        return this.clientService.ensureConnected()
            .then(() => {

                let introspector = this.clientService.getBusinessNetwork().getIntrospector();
                let modelClassDeclarations = introspector.getClassDeclarations();
                modelClassDeclarations.forEach((modelClassDeclaration) => {
                    // Generate list of all known (non-abstract/non-system) transaction types
                    if (!modelClassDeclaration.isAbstract() && !modelClassDeclaration.isSystemType() && modelClassDeclaration instanceof TransactionDeclaration) {
                        this.hasTransactions = true;
                    }
                });

                return this.clientService.getBusinessNetworkConnection().getAllAssetRegistries()
                    .then((assetRegistries) => {
                        assetRegistries.forEach((assetRegistry) => {
                            let index = assetRegistry.id.lastIndexOf('.');
                            let displayName = assetRegistry.id.substring(index + 1);
                            assetRegistry.displayName = displayName;
                        });

                        this.registries['assets'] = assetRegistries.sort((a, b) => {
                            return a.id.localeCompare(b.id);
                        });
                        this.loadTransaction();
                        this.select("NewArticle");

                        return this.clientService.getBusinessNetworkConnection().getAllParticipantRegistries();
                    })
                    .then((participantRegistries) => {
                        participantRegistries.forEach((participantRegistry) => {
                            let index = participantRegistry.id.lastIndexOf('.');
                            let displayName = participantRegistry.id.substring(index + 1);
                            participantRegistry.displayName = displayName;
                        });

                        this.registries['participants'] = participantRegistries.sort((a, b) => {
                            return a.id.localeCompare(b.id);
                        });

                        return this.clientService.getBusinessNetworkConnection().getHistorian();
                    })
                    .then((historianRegistry) => {
                        this.registries['historian'] = historianRegistry;
                    })
                    .catch((error) => {
                        this.alertService.errorStatus$.next(error);
                    });
            })
            .catch((error) => {
                this.alertService.errorStatus$.next(error);
            });
    }
    downloadFile(){
        let link = document.createElement("a");
        link.download = "filename";
        ipfs.catJSON(this.articleHash).then((result) => {
            link.href = result.article;
            console.log(result);

            link.click();

        }).catch(console.log);

}
    handleInputChange(e) {
        var file = e.dataTransfer ? e.dataTransfer.files[0] : e.target.files[0];
        var pattern = 'pdf.*';
        var reader = new FileReader();
        if (!file.type.match(pattern)) {
          alert('invalid format');
          return;
        }
        reader.onload = this._handleReaderLoaded.bind(this);
        reader.readAsDataURL(file);
      }
      _handleReaderLoaded(e) {
        let reader = e.target;
        this.articleBase64 = reader.result;
        console.log(reader)
        console.log(this.articleBase64)
      }
    isAdmin() {
        if (
            this.identityCardService.getCurrentIdentityCard()["metadata"]
                .userName === "admin"
        ) {
            return true && this.router.navigate(['/login']);;
        } else {
            return false;
        }
    }
    uploadArticle(){
        this.select("NewArticle");

    }
    select(value:string){
        // Set first in list as selectedTransaction
        if (this.transactionTypes && this.transactionTypes.length > 0) {
            for (let transactions in this.transactionTypes){
                if (this.transactionTypes[transactions]["name"] === value){
                    this.selectedTransaction = this.transactionTypes[transactions];
                    this.selectedTransactionName = this.selectedTransaction.getName();
                    console.log(this.selectedTransactionName);
                }

            }


            // We wish to hide certain items in a transaction, set these here
            this.hiddenTransactionItems.set(this.selectedTransaction.getIdentifierFieldName(), uuid.v4());
            this.hiddenTransactionItems.set('timestamp', new Date());

            // Create a resource definition for the base item
            this.generateTransactionDeclaration();
        }

    }
    ngOnDestroy() {
        this.clientService.getBusinessNetworkConnection().removeAllListeners('event');
    }

    setChosenRegistry(chosenRegistry) {
        this.chosenRegistry = chosenRegistry;
        console.log(this.registries['assets'][1]);

        this.chosenMenu = null
    }
    setChosenMenu(chosenMenu) {
        this.chosenMenu = chosenMenu;
        this.chosenRegistry = null
        this.chosenMenu === "upload" ? this.uploadArticle() : null
        this.chosenMenu === "toReview" ? this.chosenRegistry = this.registries['assets'][1] : null
        this.chosenMenu === "myArticles" ? this.chosenRegistry = this.registries['assets'][0] : null
        this.chosenMenu === "publicArticles" ? this.chosenRegistry = this.registries['assets'][0] : null
        this.chosenMenu === "myArticleRevisions" ? this.chosenRegistry = this.registries['assets'][1] : null

    }
    loadTransaction(){
        let introspector = this.clientService.getBusinessNetwork().getIntrospector();
        this.transactionTypes = introspector.getClassDeclarations()
            .filter((modelClassDeclaration) => {
                // Non-abstract, non-system transactions only please!
                return !modelClassDeclaration.isAbstract() &&
                    !modelClassDeclaration.isSystemType() &&
                    modelClassDeclaration instanceof TransactionDeclaration;
            })
            .sort((a, b) => {
                if (a.getName() < b.getName()) {
                  return -1;
                } else if (a.getName() > b.getName()) {
                  return 1;
                } else {
                  return 0;
                }
            });


    }

    submitTransaction() {

        const modalRef = this.modalService.open(TransactionComponent);

        modalRef.result.then((transaction) => {
            // refresh current resource list
            this.registryReload = !this.registryReload;

            let plural = (this.eventsTriggered.length > 1) ? 's' : '';

            let txMessage = `<p>Transaction ID <b>${transaction.getIdentifier()}</b> was submitted</p>`;
            let message = {
                title: 'Submit Transaction Successful',
                text: txMessage.toString(),
                icon: '#icon-transaction',
                link: null,
                linkCallback: null
            };

            if (this.eventsTriggered.length > 0) {
                // because this won't exist on the callback
                let events = this.eventsTriggered;
                message.link = `${events.length} event${plural} triggered`;
                message.linkCallback = () => {
                    this.alertService.transactionEvent$.next({ transaction: transaction, events: events });
                };
                this.eventsTriggered = [];
            }

            this.alertService.successStatus$.next(message);
        })
            .catch((error) => {
                if (error !== DrawerDismissReasons.ESC) {
                    this.alertService.errorStatus$.next(error);
                }
            });
    }
    initializeEventListener() {
        const businessNetworkConnection = this.clientService.getBusinessNetworkConnection();
        // Prevent multiple listeners being created
        if (businessNetworkConnection.listenerCount('event') === 0) {
            businessNetworkConnection.on('event', (event) => {
                this.eventsTriggered.push(event);
            });
        }
    }
    // from transaction

    /**
     * Process the user selection of a TransactionType
     * @param {TransactionDeclaration} transactionType - the user selected TransactionDeclaration
     */
    onTransactionSelect(transactionType) {
        this.selectedTransaction = transactionType;
        this.selectedTransactionName = this.selectedTransaction.getName();
        this.resourceDefinition = null;
        this.includeOptionalFields = false;
        this.generateTransactionDeclaration();
    }

    /**
     * Validate the definition of the TransactionDeclaration, accounting for hidden fields.
     */
    onDefinitionChanged() {
        try {
            let json = JSON.parse(this.resourceDefinition);
            // Add required items that are hidden from user
            this.hiddenTransactionItems.forEach((value, key) => {
                json[key] = value;
            });
            let serializer = this.clientService.getBusinessNetwork().getSerializer();
            let resource = serializer.fromJSON(json);
            resource.validate();
            this.definitionError = null;
        } catch (error) {
            this.definitionError = error.toString();
        }
    }
    async createRevision(){
        this.identityCardService
        let businessNetworkConnection = this.clientService.getBusinessNetworkConnection();

        let businessNetworkDefinition = this.clientService.getBusinessNetwork();
        let serializer = businessNetworkDefinition.getSerializer();

        let resource = serializer.fromJSON({
            $class: "org.dasp.net.CreateRevision",
            article: "resource:org.dasp.net.Article#"+this.id.replace(/"/g, '')
        });
        console.log(resource);


        await businessNetworkConnection.submitTransaction(resource);
    }
    paid(){
        console.log(this.resourceDefinition);
        let existingJSON = JSON.parse(this.resourceDefinition);
        console.log(existingJSON);
        existingJSON.paid = this.isPaid;
        this.resourceDefinition = JSON.stringify(existingJSON, null, 2);
        this.onDefinitionChanged();
    }
    tag(){
        console.log(this.resourceDefinition);
        let existingJSON = JSON.parse(this.resourceDefinition);
        console.log(existingJSON);
        existingJSON.tags = this.tags;
        this.resourceDefinition = JSON.stringify(existingJSON, null, 2);
        this.onDefinitionChanged();
    }
    hash(){
        console.log(this.resourceDefinition);
        let existingJSON = JSON.parse(this.resourceDefinition);
        console.log(existingJSON);
        existingJSON.hash = this.articleHash;
        this.resourceDefinition = JSON.stringify(existingJSON, null, 2);
        this.onDefinitionChanged();
        this.loadingHash = false;
    }
    async test(){
        this.loadingHash = true;
        await ipfs.addJSON({ article: this.tags, test: 1}, (err, result) => {
            console.log(err, result);
            this.articleHash = result;
            this.loadingHash = false;
        })
    }
    /**
     * Generate a TransactionDeclaration definition, accounting for need to hide fields
     */
    private generateTransactionDeclaration(withSampleData?: boolean): void {
        let businessNetworkDefinition = this.clientService.getBusinessNetwork();
        let factory = businessNetworkDefinition.getFactory();
        const generateParameters = {
            generate: withSampleData ? 'sample' : 'empty',
            includeOptionalFields: this.includeOptionalFields
        };
        let resource = factory.newTransaction(
            this.selectedTransaction.getModelFile().getNamespace(),
            this.selectedTransaction.getName(),
            undefined,
            generateParameters);
            console.log(resource);
            this.articleHash ? resource.hash = this.articleHash : null;
        let serializer = this.clientService.getBusinessNetwork().getSerializer();
        try {
            let replacementJSON = serializer.toJSON(resource);
            let existingJSON = JSON.parse(this.resourceDefinition);
            // remove hidden items from json
            this.hiddenTransactionItems.forEach((value, key) => {
                delete replacementJSON[key];
            });
            if (existingJSON) {
                this.resourceDefinition = JSON.stringify(this.updateExistingJSON(existingJSON, replacementJSON), null, 2);
            } else {
                // Initial popup, no previous data to protect
                this.resourceDefinition = JSON.stringify(replacementJSON, null, 2);
            }
            this.onDefinitionChanged();
        } catch (error) {
            // We can't generate a sample instance for some reason.
            this.definitionError = error.toString();
        }
    }

    private updateExistingJSON(previousJSON, toUpdateWithJSON): object {
        for (let key in toUpdateWithJSON) {
            if (previousJSON.hasOwnProperty(key) && toUpdateWithJSON.hasOwnProperty(key)) {
                if (previousJSON[key] !== null && typeof previousJSON[key] === 'object' && toUpdateWithJSON[key] !== null && typeof toUpdateWithJSON[key] === 'object') {
                    toUpdateWithJSON[key] = this.updateExistingJSON(previousJSON[key], toUpdateWithJSON[key]);
                } else if (previousJSON[key].toString().length > 0 && previousJSON[key] !== 0) {
                    toUpdateWithJSON[key] = previousJSON[key];
                }
            }
        }
        return toUpdateWithJSON;
    }

    /**
     * Submit the TransactionDeclaration definition
     */
    private async submitSpecTransaction() {
        this.submitInProgress = true;
        this.loadingHash = true;
        await ipfs.addJSON({ article: this.articleBase64 }, (err, result) => {
            console.log(err, result);
            this.articleHash = result;
            this.hash();
            return Promise.resolve()
                .then(() => {
                    let json = JSON.parse(this.resourceDefinition);
                    let serializer = this.clientService.getBusinessNetwork().getSerializer();
                    this.submittedTransaction = serializer.fromJSON(json);

                    return this.clientService.getBusinessNetworkConnection().submitTransaction(this.submittedTransaction);
                })
                .then(() => {
                    this.submitInProgress = false;
                    this.definitionError = null;
                    console.log(this.submittedTransaction);
                    console.log(JSON.stringify(this.submittedTransaction["transactionId"]).replace(/"/g, ''));
                    this.id = JSON.stringify(this.submittedTransaction["transactionId"]).replace(/"/g, '');
                    this.createRevision();
                    return this.submittedTransaction;
                })
                .catch((error) => {
                    this.definitionError = error.toString();
                    this.submitInProgress = false;
                });
          })
    }
}
