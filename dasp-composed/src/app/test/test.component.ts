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

var ipfsClient = require('ipfs-http-client')
// connect to ipfs daemon API server
var ipfs = ipfsClient('192.168.1.4', '5001', { protocol: 'http' })
// leaving out the arguments will default to these values
/* tslint:disable-next-line:no-var-requires */
const uuid = require('uuid');
const $ = document.querySelector.bind(document);
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
    private shouldShow: false
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
    tags: any;
    id: any;
    loadingHash: boolean;
    chosenMenu: any = 'upload';
    isReviewer: any;
    title: any;
    details: any;
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
                        let resource = this.registries['participants'][0].getAll();
                        this.registries['participants'][0].getAll()
                            .then(resources => {
                                resource = resources.sort((a, b) => {
                                    return b.date - a.date;
                                });
                                this.isReviewer = resource[0].isReviewer;
                            })
                            .catch(error => {
                                this.alertService.errorStatus$.next(error);
                            });
                    })
                    .catch((error) => {
                        this.alertService.errorStatus$.next(error);
                    });
            })
            .catch((error) => {
                this.alertService.errorStatus$.next(error);
            });
    }

    //Init
    handleFileSelect(evt) {
        var file = evt.dataTransfer ? evt.dataTransfer.files[0] : evt.target.files[0];
        var pattern = 'pdf.*';
        var reader = new FileReader();
        if (!file.type.match(pattern)) {
            alert('invalid format');
            return;
        }
        reader.onload = this._handleReaderLoaded.bind(this);
        reader.readAsDataURL(file);
        const files = evt.target.files; // FileList object

        //files template
        let template = `${Object.keys(files)
            .map(file => `<div class="file file--${file}">
     <div class="name"><span>${files[file].name}</span></div>
     <div class="progress active"></div>
     <div class="done">
	<a href="" target="_blank">
      <svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" version="1.1" x="0px" y="0px" viewBox="0 0 1000 1000">
		<g><path id="path" d="M500,10C229.4,10,10,229.4,10,500c0,270.6,219.4,490,490,490c270.6,0,490-219.4,490-490C990,229.4,770.6,10,500,10z M500,967.7C241.7,967.7,32.3,758.3,32.3,500C32.3,241.7,241.7,32.3,500,32.3c258.3,0,467.7,209.4,467.7,467.7C967.7,758.3,758.3,967.7,500,967.7z M748.4,325L448,623.1L301.6,477.9c-4.4-4.3-11.4-4.3-15.8,0c-4.4,4.3-4.4,11.3,0,15.6l151.2,150c0.5,1.3,1.4,2.6,2.5,3.7c4.4,4.3,11.4,4.3,15.8,0l308.9-306.5c4.4-4.3,4.4-11.3,0-15.6C759.8,320.7,752.7,320.7,748.4,325z"</g>
        </svg>
              </a>
     </div>
    </div>
   `)
            .join("")}`;

        $("#drop").classList.add("hidden");
        $("footer").classList.add("hasFiles");
        $(".importar").classList.add("active");
        $(".importare").classList.add("active");
        setTimeout(() => {
            $(".list-files").innerHTML = template;
        }, 1000);

        Object.keys(files).forEach(file => {
            let load = 2000 + (file.length * 2000); // fake load
            setTimeout(() => {
                $(`.file--${file}`).querySelector(".progress").classList.remove("active");
                $(`.file--${file}`).querySelector(".done").classList.add("anim");
            }, load);
        });
    }

    // trigger input
    triggerFile(event: any) {
        event.preventDefault();
        let element: HTMLElement = document.getElementById('inputt') as HTMLElement;
        element.click();
    }
    import() {
        $(".list-files").innerHTML = "";
        $("footer").classList.remove("hasFiles");
        $(".importar").classList.remove("active");
        $(".importare").classList.remove("active");
        setTimeout(() => {
            $("#drop").classList.remove("hidden");
        }, 500);
    }
    downloadFile() {
        let link = document.createElement("a");
        link.download = "filename";

        ipfs.cat(this.articleHash).then((result) => {
            let jsoned = JSON.parse(result)
            link.href = jsoned[0];

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
    }
    isAdmin() {
        if (
            this.identityCardService.getCurrentIdentityCard()["metadata"]
                .userName === "admin"
        ) {
            return true && this.router.navigate(['/blockchain']);;
        } else {
            return false;
        }
    }
    uploadArticle() {
        this.select("NewArticle");

    }
    select(value: string) {
        // Set first in list as selectedTransaction
        if (this.transactionTypes && this.transactionTypes.length > 0) {
            for (let transactions in this.transactionTypes) {
                if (this.transactionTypes[transactions]["name"] === value) {
                    this.selectedTransaction = this.transactionTypes[transactions];
                    this.selectedTransactionName = this.selectedTransaction.getName();
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
        this.chosenMenu = null;
    }
    setChosenMenu(chosenMenu) {
        this.submitInProgress = false
        this.articleHash = ''
        this.tags = ''
        this.title = ''
        this.chosenMenu = chosenMenu;
        this.chosenRegistry = null
        this.chosenMenu === "upload" ? this.uploadArticle() : null
        this.chosenMenu === "toReview" ? this.chosenRegistry = this.registries['assets'][2] : null
        this.chosenMenu === "myArticles" ? this.chosenRegistry = this.registries['assets'][0] : null
        this.chosenMenu === "publicArticles" ? this.chosenRegistry = this.registries['assets'][0] : null
        this.chosenMenu === "myArticleRevisions" ? this.chosenRegistry = this.registries['assets'][2] : null
        this.chosenMenu === "publicRevisions" ? this.chosenRegistry = this.registries['assets'][2] : null
        this.chosenMenu === "reviewed" ? this.chosenRegistry = this.registries['assets'][2] : null

    }
    loadTransaction() {
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
    async createRevision() {
        this.identityCardService
        let businessNetworkConnection = this.clientService.getBusinessNetworkConnection();

        let businessNetworkDefinition = this.clientService.getBusinessNetwork();
        let serializer = businessNetworkDefinition.getSerializer();

        let resource = serializer.fromJSON({
            $class: "org.dasp.net.CreateRevision",
            article: "resource:org.dasp.net.Article#" + this.id.replace(/"/g, '')
        });


        await businessNetworkConnection.submitTransaction(resource).then(
            this.setChosenMenu('myArticles'),
            this.submitInProgress = false

        );
    }
    tag() {
        let existingJSON = JSON.parse(this.resourceDefinition);
        existingJSON.tags = this.tags;
        this.resourceDefinition = JSON.stringify(existingJSON, null, 2);
        this.onDefinitionChanged();
    }
    titled() {
        let existingJSON = JSON.parse(this.resourceDefinition);
        existingJSON.title = this.title;
        this.resourceDefinition = JSON.stringify(existingJSON, null, 2);
        this.onDefinitionChanged();
    }
    hash() {
        let existingJSON = JSON.parse(this.resourceDefinition);
        existingJSON.hash = this.articleHash;
        this.resourceDefinition = JSON.stringify(existingJSON, null, 2);
        this.onDefinitionChanged();
        this.loadingHash = false;
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
        const input = this.articleBase64;
        await ipfs.add(Buffer.from(JSON.stringify(input)))
            .then(res => {
                const hash = res[0].hash
                this.articleHash = hash;
                return ipfs.cat(hash)
            })
            .then(output => {
                this.hash();
            }).then(() => {
                let json = JSON.parse(this.resourceDefinition);
                let serializer = this.clientService.getBusinessNetwork().getSerializer();
                this.submittedTransaction = serializer.fromJSON(json);

                return this.clientService.getBusinessNetworkConnection().submitTransaction(this.submittedTransaction);
            })
            .then(() => {
                this.definitionError = null;
                this.id = JSON.stringify(this.submittedTransaction["transactionId"]).replace(/"/g, '');
                this.createRevision();
                return this.submittedTransaction;
            })
            .catch((error) => {
                this.definitionError = error.toString();
                this.submitInProgress = false;
            });
    }
}
