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
import { Output, EventEmitter } from "@angular/core";
import { ClientService } from "../../services/client.service";
import { AlertService } from "../../basic-modals/alert.service";
import { ResourceComponent } from "../resource/resource.component";
import { DeleteComponent } from "../../basic-modals/delete-confirm/delete-confirm.component";
import { TestComponent } from "../test.component";
import { ViewTransactionComponent } from "../view-transaction/view-transaction.component";
import { DrawerDismissReasons } from "../../common/drawer";
import { IdentityCardService } from "app/services/identity-card.service";
var ipfsClient = require("ipfs-http-client");

// connect to ipfs daemon API server
//
var ipfs = ipfsClient("10.126.1.112", "5001", { protocol: "http" }); // leaving out the arguments will default to these values

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
    details: boolean = true;
    initials: string = "";
    color: string = "";
    concept: any;
    options = [
        { name: "Rejected", value: 2 },
        { name: "Weak Rejected", value: 4 },
        { name: "Border Line", value: 6 },
        { name: "Weak Accepted", value: 8 },
        { name: "Accepted", value: 10 }
    ];
    @Output() someEvent = new EventEmitter<string>();
    @Output() loadCount = new EventEmitter<string>();
    showChangePassword: boolean = false;
    pass: any;
    validPass: boolean = false;
    pass2: any;
    oldPass: any;
    errorPass: boolean = false;

    private registries = {
        assets: [],
        participants: [],
        historian: null
    };

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
    ) {}
    getInitials(firstName, lastName) {
        if (this.initials === "") {
            let firstLetter = firstName.charAt(0);
            let lastLetter = lastName.charAt(0);
            this.initials =
                firstLetter.toUpperCase() + lastLetter.toUpperCase();
        }
        return this.initials;
    }
    getColor(email) {
        if (this.color === "") {
            var hash = 0,
                len = email.length;
            for (var i = 0; i < len; i++) {
                hash = (hash << 5) - hash + email.charCodeAt(i);
                hash |= 0; // to 32bit integer
            }
            let fullValue = hash;

            var hue = Math.floor(fullValue * 360) / 1000;

            var color = "hsl(" + hue + ", 55%, 55%)";
            this.color = color;
            return this.color;
        }
    }
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
                this.secret = this.identityCardService.getIdentityCard(
                    this.author + "@dasp-net"
                )["metadata"].enrollmentSecret;
            })
            .catch(error => {
                this.alertService.errorStatus$.next(error);
            });
    }
    rateModal(definition) {
        this.rate = definition;
        this.details = false;
    }
    closeRateModal() {
        this.rate = false;
        this.points = "";
        this.notes = "";
    }
    downloadFile(hash, title) {
        let link = document.createElement("a");
        link.download = title;

        ipfs.cat(hash)
            .then(result => {
                let jsoned = JSON.parse(result);
                link.href = jsoned;
                link.click();
            })
            .catch(console.log);
    }
    async isPublic(id) {
        await this.clientService
            .getBusinessNetworkConnection()
            .getAllAssetRegistries()
            .then(assetRegistries => {
                assetRegistries.forEach(assetRegistry => {
                    let index = assetRegistry.id.lastIndexOf(".");
                    let displayName = assetRegistry.id.substring(index + 1);
                    assetRegistry.displayName = displayName;
                });
                this.registries["assets"] = assetRegistries.sort((a, b) => {
                    return a.id.localeCompare(b.id);
                });
            });
        this.registries["assets"][0].getAll().then(resources => {
            resources = resources.sort((a, b) => {
                return b.date - a.date;
            });
            resources.forEach(resource => {
                if (id.getIdentifier() === resource.getIdentifier()) {
                    console.log("achou msm id");
                    if (!resource.published) {
                        console.log("nao e public");
                        return false;
                    } else {
                        console.log("e public");
                        return true;
                    }
                }
            });
        });
        // articles.forEach(article => {
        //     console.log(article.getIdentifier());
        // });
        console.log(id);

        console.log(this.registries["assets"][0].getAll());
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
            points: this.concept
        });
        await businessNetworkConnection.submitTransaction(resource).then(() => {
            this.closeRateModal();
            this.loadResources();
            this.loadCount.next();
            this.someEvent.next("reviewed");
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
        await businessNetworkConnection.submitTransaction(resource).then(() => {
            this.loadCount.next();
            this.loadResources();
            return (this.loading = false);
        });
    }
    /**
     * Submit the TransactionDeclaration definition
     */
    private async ipfsUpload() {
        this.loading = true;
        const input = this.articleBase64;
        await ipfs
            .add(Buffer.from(JSON.stringify(input)))
            .then(res => {
                const hash = res[0].hash;
                this.articleHash = hash;
                return ipfs.cat(hash);
            })
            .then(output => {
                return this.changeHash(this.articleHash).then(() => {
                    this.createRevisions(this.rate);
                });
            });
    }
    private showUpload(id) {
        this.uploadInput = true;
        this.showChangeHash = false;
        this.rate = id;
    }
    handleInputChange(e) {
        this.uploadInput = false;
        var file = e.dataTransfer ? e.dataTransfer.files[0] : e.target.files[0];
        var pattern = "pdf.*";
        var reader = new FileReader();
        if (!file.type.match(pattern)) {
            alert("invalid format");
            return;
        }
        reader.onload = this._handleReaderLoaded.bind(this);
        reader.readAsDataURL(file);
    }
    _handleReaderLoaded(e) {
        let reader = e.target;
        this.articleBase64 = reader.result;
        this.ipfsUpload();
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
        await businessNetworkConnection
            .submitTransaction(resource)
            .then(() => {});
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
        await businessNetworkConnection.submitTransaction(resource).then(() => {
            this.loadResources();
            //go to reviewed
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
    private async changePassword() {
        this.loading = true;
        this.identityCardService;
        let businessNetworkConnection = this.clientService.getBusinessNetworkConnection();

        let businessNetworkDefinition = this.clientService.getBusinessNetwork();
        let serializer = businessNetworkDefinition.getSerializer();

        let resource = serializer.fromJSON({
            $class: "org.dasp.net.ChangePassword",
            user: "resource:org.dasp.net.Author#" + this.author,
            author: "resource:org.dasp.net.Details#" + this.author,
            oldPassword: this.oldPass,
            newPassword: this.pass
        });
        await businessNetworkConnection
            .submitTransaction(resource)
            .then(() => {
                this.showChangePassword = !this.showChangePassword;
                this.loadResources();
                this.errorPass = false;
                return (this.loading = false);
            })
            .catch(error => {
                console.log(error);
                this.errorPass = true;
                return (this.loading = false);
            });
    }
    private showChangePass() {
        this.showChangePassword = !this.showChangePassword;
    }

    private passwordAgain(pass2) {
        if (pass2 === this.pass) {
            return (this.validPass = true);
        } else {
            return (this.validPass = false);
        }
    }
    private password(pass) {
        if (pass === this.pass2) {
            return (this.validPass = true);
        } else {
            return (this.validPass = false);
        }
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
