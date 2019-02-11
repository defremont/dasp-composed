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
const ipfs = new IPFS({ host: 'ipfs.infura.io', port: 5001, protocol: 'https' });
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
    showUpload: boolean;
    private articleBase64: string = '';
    articleHash: any;

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
                        this.showUpload = true;
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
        ipfs.addJSON({ article: this.articleBase64 }, (err, result) => {
            console.log(err, result);
            this.articleHash = result;
          });
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
        this.showUpload = true;
    }
    ngOnDestroy() {
        this.clientService.getBusinessNetworkConnection().removeAllListeners('event');
    }

    setChosenRegistry(chosenRegistry) {
        this.chosenRegistry = chosenRegistry;
        this.showUpload = false;
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
}
