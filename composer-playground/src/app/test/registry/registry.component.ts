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
import { Component, Input } from "@angular/core";
import { NgbModal } from "@ng-bootstrap/ng-bootstrap";

import { ClientService } from "../../services/client.service";
import { AlertService } from "../../basic-modals/alert.service";
import { ResourceComponent } from "../resource/resource.component";
import { DeleteComponent } from "../../basic-modals/delete-confirm/delete-confirm.component";
import { ViewTransactionComponent } from "../view-transaction/view-transaction.component";
import { DrawerDismissReasons } from "../../common/drawer";
import { IdentityCardService } from "app/services/identity-card.service";
const IPFS = require("ipfs-mini");
const ipfs = new IPFS({
    host: "ipfs.infura.io",
    port: 5001,
    protocol: "https"
});
@Component({
    selector: "registry",
    templateUrl: "./registry.component.html",
    styleUrls: ["./registry.component.scss".toString()]
})
export class RegistryComponent {
    tableScrolled = false;
    private rate = false;
    private _registry = null;
    private _reload = null;
    private _type = null;
    private resources = [];
    private author = this.identityCardService.getCurrentIdentityCard()[
        "metadata"
    ].userName;

    private expandedResource = null;
    private registryId: string = null;

    private overFlowedResources = {};
    notes: any;
    points: any;
    loading: boolean;
    uploadInput: boolean;
    articleHash: any;
    articleBase64: any;
    showChangeHash: boolean = true;
    needReschedule: boolean;
    currentdate: Date;
    secret: any;

    @Input()
    set registry(registry: any) {
        this._registry = registry;
        if (this._registry) {
            this.loadResources();
            this.registryId = this._registry.id;
        }
    }
    @Input()
    set type(type: any) {
        this._type = type;
    }

    @Input()
    set reload(reload) {
        if (this._reload !== null) {
            this.loadResources();
        }
        this._reload = reload;
    }

    constructor(
        private clientService: ClientService,
        private alertService: AlertService,
        private modalService: NgbModal,
        private identityCardService: IdentityCardService
    ) { }

    loadResources(): Promise<void> {

        this.overFlowedResources = {};
        return this._registry
            .getAll()
            .then(resources => {
                if (this.isHistorian()) {
                    this.resources = resources.sort((a, b) => {
                        return a.transactionTimestamp - b.transactionTimestamp;
                    });
                } else {
                    this.resources = resources.sort((a, b) => {
                        return b.date - a.date;
                    });
                }
                this.currentdate = new Date();
                console.log(this.resources);
                console.log(this.author);
                this.secret = this.identityCardService.getIdentityCard(this.author + "@dasp-net")["metadata"].enrollmentSecret;

            })
            .catch(error => {
                this.alertService.errorStatus$.next(error);
            });
    }
    rateModal(definition) {
        this.rate = definition;

    }
    closeRateModal() {
        this.rate = false;
    }
    downloadFile(hash) {
        let link = document.createElement("a");
        link.download = "filename";
        ipfs.catJSON(hash)
            .then(result => {
                link.href = result.article;
                console.log(result);

                link.click();
            })
            .catch(console.log);
    }
    async rateRevision(id) {
        this.loading = true;
        this.identityCardService;
        let businessNetworkConnection = this.clientService.getBusinessNetworkConnection();

        let businessNetworkDefinition = this.clientService.getBusinessNetwork();
        let serializer = businessNetworkDefinition.getSerializer();

        let resource = serializer.fromJSON({
            $class: "org.dasp.net.RateRevision",
            revision: "resource:org.dasp.net.Revision#" + id,
            notes: this.notes,
            points: this.points
        });
        console.log(resource);
        await businessNetworkConnection.submitTransaction(resource).then(() => {
            this.loadResources();
            return (this.loading = false);
        });
    }
    async reviewAccept(id) {
        this.loading = true;
        this.identityCardService;
        let businessNetworkConnection = this.clientService.getBusinessNetworkConnection();

        let businessNetworkDefinition = this.clientService.getBusinessNetwork();
        let serializer = businessNetworkDefinition.getSerializer();

        let resource = serializer.fromJSON({
            $class: "org.dasp.net.ReviewAccept",
            revision: "resource:org.dasp.net.Revision#" + id
        });
        console.log(resource);
        await businessNetworkConnection.submitTransaction(resource).then(() => {
            this.loadResources();
            return (this.loading = false);
        });
    }
    async reviewRejected(id) {
        this.loading = true;
        this.identityCardService;
        let businessNetworkConnection = this.clientService.getBusinessNetworkConnection();

        let businessNetworkDefinition = this.clientService.getBusinessNetwork();
        let serializer = businessNetworkDefinition.getSerializer();

        let resource = serializer.fromJSON({
            $class: "org.dasp.net.ReviewRejected",
            revision: "resource:org.dasp.net.Revision#" + id
        });
        console.log(resource);
        await businessNetworkConnection.submitTransaction(resource).then(() => {
            this.loadResources();
            return (this.loading = false);
        });
    }
    /**
     * Submit the TransactionDeclaration definition
     */
    private async ipfsUpload() {
        this.loading = true;
        await ipfs.addJSON({ article: this.articleBase64 }, (err, result) => {
            console.log(err, result);
            this.articleHash = result;
            return this.changeHash(this.articleHash).then(() => {
                this.createRevisions(this.rate);
            });
        })
    }
    private showUpload(id) {
        this.uploadInput = true;
        this.showChangeHash = false;
        this.rate = id;
    }
    handleInputChange(e) {
        this.uploadInput = false;
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
        this.ipfsUpload();
        console.log(reader)
        console.log(this.articleBase64)
    }
    async changeHash(id) {
        this.loading = true;
        this.identityCardService;
        let businessNetworkConnection = this.clientService.getBusinessNetworkConnection();

        let businessNetworkDefinition = this.clientService.getBusinessNetwork();
        let serializer = businessNetworkDefinition.getSerializer();

        let resource = serializer.fromJSON({
            $class: "org.dasp.net.NewHash",
            article: "resource:org.dasp.net.Article#" + this.rate,
            newHash: id
        });
        console.log(resource);
        await businessNetworkConnection.submitTransaction(resource).then(() => {
        });
    }
    async createRevisions(article) {
        this.loading = true;
        this.identityCardService;
        let businessNetworkConnection = this.clientService.getBusinessNetworkConnection();

        let businessNetworkDefinition = this.clientService.getBusinessNetwork();
        let serializer = businessNetworkDefinition.getSerializer();

        let resource = serializer.fromJSON({
            $class: "org.dasp.net.CreateRevision",
            article: "resource:org.dasp.net.Article#" + article
        });
        console.log(resource);
        await businessNetworkConnection.submitTransaction(resource).then(() => {
            this.loadResources();
            return (this.loading = false);
        });
    }
    async publish(id) {
        this.loading = true;
        this.identityCardService;
        let businessNetworkConnection = this.clientService.getBusinessNetworkConnection();

        let businessNetworkDefinition = this.clientService.getBusinessNetwork();
        let serializer = businessNetworkDefinition.getSerializer();

        let resource = serializer.fromJSON({
            $class: "org.dasp.net.PublishRevision",
            revision: "resource:org.dasp.net.Revision#" + id
        });
        console.log(resource);
        await businessNetworkConnection.submitTransaction(resource).then(() => {
            this.loadResources();
            return (this.loading = false);
        });
    }
    async reschedule(id) {
        this.loading = true;
        this.identityCardService;
        let businessNetworkConnection = this.clientService.getBusinessNetworkConnection();

        let businessNetworkDefinition = this.clientService.getBusinessNetwork();
        let serializer = businessNetworkDefinition.getSerializer();

        let resource = serializer.fromJSON({
            $class: "org.dasp.net.Scheduler",
            revision: "resource:org.dasp.net.Revision#" + id
        });
        console.log(resource);
        await businessNetworkConnection.submitTransaction(resource).then(() => {
            this.loadResources();
            return (this.loading = false);
        });
    }
    serialize(resource: any): string {
        let serializer = this.clientService
            .getBusinessNetwork()
            .getSerializer();
        return JSON.stringify(serializer.toJSON(resource), null, 2);
    }

    expandResource(resourceToExpand) {
        if (this.expandedResource === resourceToExpand.getIdentifier()) {
            this.expandedResource = null;
        } else {
            this.expandedResource = resourceToExpand.getIdentifier();
        }
    }

    openNewResourceModal() {
        const modalRef = this.modalService.open(ResourceComponent);
        modalRef.componentInstance.registryId = this._registry.id;
        modalRef.result
            .then(() => {
                // refresh current resource list
                this.loadResources();
            })
            .catch(error => {
                if (error !== DrawerDismissReasons.ESC) {
                    this.alertService.errorStatus$.next(error);
                }
            });
    }

    hasOverFlow(overflow: boolean, resource: any) {
        if (overflow) {
            this.overFlowedResources[resource.getIdentifier()] = resource;
        }
    }

    editResource(resource: any) {
        const editModalRef = this.modalService.open(ResourceComponent);
        editModalRef.componentInstance.registryId = this._registry.id;
        editModalRef.componentInstance.resource = resource;
        editModalRef.result
            .then(() => {
                // refresh current resource list
                this.loadResources();
            })
            .catch(error => {
                if (error !== DrawerDismissReasons.ESC) {
                    this.alertService.errorStatus$.next(error);
                }
            });
    }

    openDeleteResourceModal(resource: any) {
        const confirmModalRef = this.modalService.open(DeleteComponent);
        confirmModalRef.componentInstance.headerMessage =
            "Delete Asset/Participant";
        confirmModalRef.componentInstance.deleteMessage =
            "This action will be recorded in the Historian, and cannot be reversed. Are you sure you want to delete?";
        confirmModalRef.componentInstance.fileType = resource.$type;
        confirmModalRef.componentInstance.fileName = resource.getIdentifier();
        confirmModalRef.componentInstance.action = "delete";
        confirmModalRef.result
            .then(result => {
                if (result) {
                    this._registry
                        .remove(resource)
                        .then(() => {
                            this.loadResources();
                        })
                        .catch(error => {
                            this.alertService.errorStatus$.next(
                                "Removing the selected item from the registry failed:" +
                                error
                            );
                        });
                } else {
                    // TODO: we should always get called with a code for this usage of the
                    // modal but will that always be true
                }
            })
            .catch(error => {
                if (error !== DrawerDismissReasons.ESC) {
                    this.alertService.errorStatus$.next(error);
                }
            });
    }

    viewTransactionData(transaction: any) {
        return this.clientService
            .resolveTransactionRelationship(transaction)
            .then(resolvedTransction => {
                let transactionModalRef = this.modalService.open(
                    ViewTransactionComponent
                );
                transactionModalRef.componentInstance.transaction = resolvedTransction;
                transactionModalRef.componentInstance.events =
                    transaction.eventsEmitted;

                transactionModalRef.result.catch(error => {
                    if (error && error !== DrawerDismissReasons.ESC) {
                        this.alertService.errorStatus$.next(error);
                    }
                });
            });
    }

    updateTableScroll(hasScroll) {
        this.tableScrolled = hasScroll;
    }

    private isHistorian(): boolean {
        return (
            this.registryId ===
            "org.hyperledger.composer.system.HistorianRecord"
        );
    }
}
