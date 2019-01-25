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
import { Component, OnInit, Input } from "@angular/core";

import { NgbActiveModal } from "@ng-bootstrap/ng-bootstrap";

import { Observable } from "rxjs/Observable";
import "rxjs/add/operator/map";
import "rxjs/add/operator/debounceTime";
import "rxjs/add/operator/distinctUntilChanged";

import { Resource } from "composer-common";
import { DeleteComponent } from "../../basic-modals/delete-confirm/delete-confirm.component";

import { AlertService } from "../../basic-modals/alert.service";
import { ClientService } from "../../services/client.service";

import { TransactionDeclaration } from "composer-common";
import { NgbModal } from "@ng-bootstrap/ng-bootstrap";
import { ResourceComponent } from "../../test/resource/resource.component";
import { RegistryComponent } from "../../test/registry/registry.component";
import { DrawerDismissReasons } from "../../common/drawer";
import { ViewTransactionComponent } from "../../test/view-transaction/view-transaction.component";

@Component({
    selector: "issue-identity-modal",
    templateUrl: "./issue-identity.component.html",
    styleUrls: ["./issue-identity.component.scss".toString()]
})
export class IssueIdentityComponent implements OnInit {
    tableScrolled = false;
    private _registry = null;
    private _reload = null;
    private resources = [];
    hasTransactions = false;
    private expandedResource = null;
    private registryId: string = null;

    private overFlowedResources = {};
    secret: any = null;

    @Input()
    set registry(registry: any) {
        this._registry = registry;
        if (this._registry) {
            this.loadResources();
            this.registryId = this._registry.id;
        }
    }

    @Input()
    set reload(reload) {
        if (this._reload !== null) {
            this.loadResources();
        }
        this._reload = reload;
    }
    @Input() participants: Map<string, Resource> = new Map<string, Resource>();

    private issueInProgress: boolean = false;
    private userID: string = null;
    private participantFQI: string = null;
    private participantFQIs: string[] = [];
    private issuer: boolean = false;
    private isParticipant: boolean = true;
    private noMatchingParticipant =
        "Named Participant does not exist in Participant Registry.";

    constructor(
        private alertService: AlertService,
        private clientService: ClientService,
        private modalService: NgbModal
    ) {}

    loadResources(): Promise<void> {
        console.log("loaded");
        this.overFlowedResources = {};
        return this._registry
            .getAll()
            .then(resources => {
                if (this.isHistorian()) {
                    this.resources = resources.sort((a, b) => {
                        return b.transactionTimestamp - a.transactionTimestamp;
                    });
                } else {
                    this.resources = resources.sort((a, b) => {
                        return a
                            .getIdentifier()
                            .localeCompare(b.getIdentifier());
                    });
                }
            })
            .catch(error => {
                this.alertService.errorStatus$.next(error);
            });
    }
    ngOnInit(): void {
        console.log("ONINITI");
        return this.loadParticipants();
    }
    openNewResourceModal() {
        const modalRef = this.modalService.open(ResourceComponent);
        modalRef.componentInstance.email = this.userID;
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
    loadParticipants() {
        this.participantFQIs = Array.from(this.participants.keys()).sort(
            (a, b) => {
                return a.localeCompare(b);
            }
        );
        console.log("LOADED PART");

        console.log("issue @ " + this.participants);
    }

    search = (text$: Observable<string>) =>
        text$
            .debounceTime(200)
            .distinctUntilChanged()
            .map(term =>
                term === ""
                    ? []
                    : this.participantFQIs
                          .filter(v => new RegExp(term, "gi").test(v))
                          .slice(0, 10)
            );

    issueIdentity(): void {
        this.participantFQI = "org.dasp.net.Author#" + this.userID;
        this.issueInProgress = true;
        let options = { issuer: this.issuer, affiliation: undefined };
        let participant = this.participantFQI.startsWith("resource:")
            ? this.participantFQI
            : "resource:" + this.participantFQI;
        this.clientService
            .issueIdentity(this.userID, participant, options)
            .then(identity => {
                this.issueInProgress = false;
                console.log(identity['userSecret'])
                this.secret = identity['userSecret'];
                return identity;
            })
            .catch(error => {
                this.issueInProgress = false;
                return error;
            });
    }
    actualFQI(userID) {
        this.participantFQI = "org.dasp.net.Author#" + userID;
        this.isValidParticipant();
    }

    
    isValidParticipant() {
        console.log("is valid PART");
        this.loadParticipants();
        let participant = this.participantFQI.startsWith("resource:")
            ? this.participantFQI.slice(9)
            : this.participantFQI;
        if (this.participantFQI === "" || this.getParticipant(participant)) {
            this.isParticipant = true;
        } else {
            this.isParticipant = false;
        }

        console.log("issue @ " + this.participants);
    }

    getParticipant(fqi: string): any {
        return this.participants.get(fqi);
    }
    expandResource(resourceToExpand) {
        if (this.expandedResource === resourceToExpand.getIdentifier()) {
            this.expandedResource = null;
        } else {
            this.expandedResource = resourceToExpand.getIdentifier();
        }
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
