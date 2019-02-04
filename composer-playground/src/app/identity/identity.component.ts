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

import { NgbModal, ModalDismissReasons } from "@ng-bootstrap/ng-bootstrap";
import { DeleteComponent } from "../basic-modals/delete-confirm/delete-confirm.component";

import { IssueIdentityComponent } from "./issue-identity";
import { IdentityIssuedComponent } from "./identity-issued";
import { AlertService } from "../basic-modals/alert.service";
import { ClientService } from "../services/client.service";
import { IdentityCardService } from "../services/identity-card.service";
import {
    IdCard,
    Resource,
    ClassDeclaration,
    AssetDeclaration,
    ParticipantDeclaration
} from "composer-common";
import { TransactionComponent } from "../test/transaction/transaction.component";
import { TransactionDeclaration } from "composer-common";
import { DrawerDismissReasons } from "../common/drawer";

import { Observable } from "rxjs/Observable";
import "rxjs/add/operator/map";
import "rxjs/add/operator/debounceTime";
import "rxjs/add/operator/distinctUntilChanged";

import { saveAs } from "file-saver";
import { Test } from "../../../e2e/component/test";
import { timingSafeEqual } from "crypto";
import { Router } from "@angular/router";

@Component({
    selector: "identity",
    templateUrl: "./identity.component.html",
    styleUrls: ["./identity.component.scss".toString()]
})
export class IdentityComponent implements OnInit {
    private identityCards: Map<string, IdCard>;
    private myIDs: Array<{ ref; usable }>;
    private allIdentities: Object[]; // array of all IDs
    private currentIdentity: string = null;
    private participants: Map<string, Resource> = new Map<string, Resource>();
    private businessNetworkName;
    private reserve;

    private includeOptionalFields: boolean = false;
    private resourceDeclaration: ClassDeclaration = null;
    private resourceAction: string = null;
    private definitionError: string = null;
    private resourceType: string = null;
    private resourceDefinition: string = null;
    private actionInProgress: boolean = false;
    private issueInProgress: boolean = false;
    private userID: string = null;
    private participantFQI: string = null;
    private participantFQIs: string[] = [];
    private issuer: boolean = false;
    private isParticipant: boolean = true;
    private noMatchingParticipant =
        "Named Participant does not exist in Participant Registry.";

    private resources = [];
    private _registry = null;
    private overFlowedResources = {};
    private registryId: string = null;

    modalOk = false;
    hasTransactions = false;
    private registries = {
        assets: [],
        participants: [],
        historian: null
    };
    private chosenRegistry = null;
    private registryReload = false;
    private eventsTriggered = [];
    loaded: boolean = false;
    secret: any;
    user: any;

    constructor(
        public router: Router,
        private modalService: NgbModal,
        private alertService: AlertService,
        private clientService: ClientService,
        private identityCardService: IdentityCardService
    ) {}
    @Input() resource: any = null;
    ngOnInit(): Promise<any> {
        this.loadAllIdentities();
        this.loadParticipantsIssue();
        console.log(this.participants);
        return this.clientService
            .ensureConnected()
            .then(() => {
                let introspector = this.clientService
                    .getBusinessNetwork()
                    .getIntrospector();
                let modelClassDeclarations = introspector.getClassDeclarations();
                modelClassDeclarations.forEach(modelClassDeclaration => {
                    // Generate list of all known (non-abstract/non-system) transaction types
                    if (
                        !modelClassDeclaration.isAbstract() &&
                        !modelClassDeclaration.isSystemType() &&
                        modelClassDeclaration instanceof TransactionDeclaration
                    ) {
                        this.hasTransactions = true;
                    }
                });

                console.log(this.participants);
                return this.clientService
                    .getBusinessNetworkConnection()
                    .getAllAssetRegistries()
                    .then(assetRegistries => {
                        assetRegistries.forEach(assetRegistry => {
                            let index = assetRegistry.id.lastIndexOf(".");
                            let displayName = assetRegistry.id.substring(
                                index + 1
                            );
                            assetRegistry.displayName = displayName;
                        });

                        this.registries["assets"] = assetRegistries.sort(
                            (a, b) => {
                                return a.id.localeCompare(b.id);
                            }
                        );

                        console.log(this.participants);
                        return this.clientService
                            .getBusinessNetworkConnection()
                            .getAllParticipantRegistries();
                    })
                    .then(participantRegistries => {
                        participantRegistries.forEach(participantRegistry => {
                            let index = participantRegistry.id.lastIndexOf(".");
                            let displayName = participantRegistry.id.substring(
                                index + 1
                            );
                            participantRegistry.displayName = displayName;
                        });

                        this.registries[
                            "participants"
                        ] = participantRegistries.sort((a, b) => {
                            return a.id.localeCompare(b.id);
                        });
                        console.log(this.participants);
                        return this.clientService
                            .getBusinessNetworkConnection()
                            .getHistorian();
                    })
                    .then(historianRegistry => {
                        this.reserve = this.participants.size;
                        console.log(
                            this.reserve + " && " + this.participants.size
                        );
                        this.registries["historian"] = historianRegistry;
                        console.log("chooseando");
                        // set the default registry selection
                        if (this.registries["participants"].length !== 0) {
                            this.chosenRegistry = this.registries[
                                "participants"
                            ][0];
                            console.log(this.registries["participants"][0]);

                            this.setCurrentIdentity(
                                { ref: "admin@dasp-net", usable: true },
                                true
                            );
                        } else if (this.registries["assets"].length !== 0) {
                            this.chosenRegistry = this.registries["assets"][0];
                        } else {
                            this.chosenRegistry = this.registries["historian"];
                        }
                        this._registry = this.chosenRegistry;
                        if (this._registry) {
                            this.loadResources();
                            this.registryId = this._registry.id;
                        }
                        modelClassDeclarations.forEach(
                            modelClassDeclaration => {
                                if (
                                    this.registryId ===
                                    modelClassDeclaration.getFullyQualifiedName()
                                ) {
                                    console.log("if this.registryId");
                                    // Set resource declaration
                                    this.resourceDeclaration = modelClassDeclaration;
                                    this.resourceType = this.retrieveResourceType(
                                        modelClassDeclaration
                                    );

                                    if (this.editMode()) {
                                        console.log("edit mode");
                                        this.resourceAction = "Update";
                                        let serializer = this.clientService
                                            .getBusinessNetwork()
                                            .getSerializer();
                                        this.resourceDefinition = JSON.stringify(
                                            serializer.toJSON(this.resource),
                                            null,
                                            2
                                        );
                                    } else {
                                        console.log("not edit mode");
                                        // Stub out json definition
                                        this.resourceAction = "Create New";
                                    }
                                }
                            }
                        );
                    })
                    .catch(error => {
                        this.alertService.errorStatus$.next(error);
                    });
            })
            .catch(error => {
                this.alertService.errorStatus$.next(error);
            });
    }
    ngOnDestroy() {
        this.clientService
            .getBusinessNetworkConnection()
            .removeAllListeners("event");
    }
    loadParticipantsIssue() {
        this.participantFQIs = Array.from(this.participants.keys()).sort(
            (a, b) => {
                return a.localeCompare(b);
            }
        );
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
        console.log("issueidentity");
        this.loadParticipants();

        this.issueInProgress = true;
        this.isValidParticipant();
        this.generateResource(true);
        console.log("start add");
        this.addOrUpdateResource().then(() => {
            this.reload().then(() => {
                this.createId();
            });
        });
        console.log("final add");
    }

    reload() {
        console.log(this.reserve + " && " + this.participants.size);

        console.log("start test");

        this.loadAllIdentities();
        this.loadParticipantsIssue();
        console.log("1");

        console.log(this.participants);
        if (this.participants > this.reserve) {
            this.loaded = false;
        }
        return this.clientService
            .ensureConnected()
            .then(() => {
                let introspector = this.clientService
                    .getBusinessNetwork()
                    .getIntrospector();
                let modelClassDeclarations = introspector.getClassDeclarations();
                modelClassDeclarations.forEach(modelClassDeclaration => {
                    // Generate list of all known (non-abstract/non-system) transaction types
                    if (
                        !modelClassDeclaration.isAbstract() &&
                        !modelClassDeclaration.isSystemType() &&
                        modelClassDeclaration instanceof TransactionDeclaration
                    ) {
                        this.hasTransactions = true;
                    }
                });
                console.log("2");

                console.log(this.participants);
                return this.clientService
                    .getBusinessNetworkConnection()
                    .getAllAssetRegistries()
                    .then(assetRegistries => {
                        assetRegistries.forEach(assetRegistry => {
                            let index = assetRegistry.id.lastIndexOf(".");
                            let displayName = assetRegistry.id.substring(
                                index + 1
                            );
                            assetRegistry.displayName = displayName;
                        });

                        this.registries["assets"] = assetRegistries.sort(
                            (a, b) => {
                                return a.id.localeCompare(b.id);
                            }
                        );

                        console.log("3");
                        console.log(this.participants);
                        return this.clientService
                            .getBusinessNetworkConnection()
                            .getAllParticipantRegistries();
                    })
                    .then(participantRegistries => {
                        console.log(this.participants);
                        participantRegistries.forEach(participantRegistry => {
                            let index = participantRegistry.id.lastIndexOf(".");
                            let displayName = participantRegistry.id.substring(
                                index + 1
                            );
                            participantRegistry.displayName = displayName;
                        });
                        console.log(this.participants);

                        this.registries[
                            "participants"
                        ] = participantRegistries.sort((a, b) => {
                            return a.id.localeCompare(b.id);
                        });
                        console.log("é aqui");

                        console.log("4");
                        console.log(this.participants);
                        return this.clientService
                            .getBusinessNetworkConnection()
                            .getHistorian();
                    })
                    .then(historianRegistry => {
                        this.registries["historian"] = historianRegistry;
                        console.log("chooseando");
                        // set the default registry selection
                        if (this.registries["participants"].length !== 0) {
                            this.chosenRegistry = this.registries[
                                "participants"
                            ][0];
                        } else if (this.registries["assets"].length !== 0) {
                            this.chosenRegistry = this.registries["assets"][0];
                        } else {
                            this.chosenRegistry = this.registries["historian"];
                        }
                        this._registry = this.chosenRegistry;
                        if (this._registry) {
                            this.loadResources();
                            this.registryId = this._registry.id;
                        }
                        modelClassDeclarations.forEach(
                            modelClassDeclaration => {
                                if (
                                    this.registryId ===
                                    modelClassDeclaration.getFullyQualifiedName()
                                ) {
                                    console.log("if this.registryId");
                                    // Set resource declaration
                                    this.resourceDeclaration = modelClassDeclaration;
                                    this.resourceType = this.retrieveResourceType(
                                        modelClassDeclaration
                                    );

                                    if (this.editMode()) {
                                        console.log("edit mode");
                                        this.resourceAction = "Update";
                                        let serializer = this.clientService
                                            .getBusinessNetwork()
                                            .getSerializer();
                                        this.resourceDefinition = JSON.stringify(
                                            serializer.toJSON(this.resource),
                                            null,
                                            2
                                        );
                                    } else {
                                        console.log("not edit mode");
                                        // Stub out json definition
                                        this.resourceAction = "Create New";
                                        //    this.generateResource(true);
                                    }
                                }
                            }
                        );
                    })
                    .catch(error => {
                        console.log('ERROR catch 1');
                        console.log(error);
                        
                        this.alertService.errorStatus$.next(error);
                    });
            })
            .catch(error => {
                console.log('ERROR catch 2');
                console.log(error);
                this.alertService.errorStatus$.next(error);
            });
    }
    actualFQI(userID) {
        console.log("actualFQI");
        this.participantFQI = "org.dasp.net.Author#" + userID;
        this.isValidParticipant();
    }
    isValidParticipant() {
        let participant = this.participantFQI.startsWith("resource:")
            ? this.participantFQI.slice(9)
            : this.participantFQI;
        if (this.participantFQI === "" || this.getParticipant(participant)) {
            this.isParticipant = true;
        } else {
            this.isParticipant = false;
        }
    }
    loadResources(): Promise<void> {
        console.log("load resources");
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
                console.log('ERROR catch loadres');
                console.log(error);
                this.alertService.errorStatus$.next(error);
            });
    }
    createId() {
        console.log("start createid");

        this.actionInProgress = false;
        let options = { issuer: this.issuer, affiliation: undefined };
        let participant = this.participantFQI.startsWith("resource:")
            ? this.participantFQI
            : "resource:" + this.participantFQI;
        this.clientService
            .issueIdentity(this.userID, participant, options)
            .then(identity => {
                console.log("create id ok");

                this.issueInProgress = false;
                console.log(JSON.stringify(identity["userID"]));
                this.secret = identity["userSecret"];
                this.user = identity["userID"];
                console.log("IDENTIDADE CARREGADA");
                return this.addIdentityToWallet({
                    userID: identity["userID"],
                    userSecret: identity["userSecret"]
                }).then(() => {
                    this.router.navigate(['./test']);
                    return this.setCurrentIdentity(
                        { ref: this.user + "@dasp-net", usable: true },
                        true
                    );
                });
            })
            .catch(error => {
                this.issueInProgress = false;
                console.log("create id erro@@@");
                console.log(JSON.stringify(error));
                console.log(error);
                console.log("@@wtfit"+error);
                let string: any = JSON.stringify(error)
                let mySubString = string.split('code\\\":').pop().split(',')[0]
                // string = string.split(':'&&',').find(function(v){ 
                //     return v.indexOf('0') > -1;
                //   });
                console.log(mySubString);
                
                if(mySubString !== "0"){
                    this.issueIdentity();                    
                }
                console.log('@@@JA REGISTRADO@@@');
                return error;
            });
    }

    /**
     *  Create resource via json serialisation
     */
    private addOrUpdateResource() {
        console.log("addorup");

        this.actionInProgress = true;
        return this.retrieveResourceRegistry(this.resourceType)
            .then(registry => {
                let json = JSON.parse(this.resourceDefinition);
                let serializer = this.clientService
                    .getBusinessNetwork()
                    .getSerializer();
                let resource = serializer.fromJSON(json);
                resource.validate();
                if (this.editMode()) {
                    return registry.update(resource);
                } else {
                    registry.add(resource);
                    console.log("add resource");
                }
            })
            .then(() => {
                console.log("then do addudop");
                this.actionInProgress = false;
            })
            .catch(error => {
                console.log("catch do addudop");
                this.definitionError = error.toString();
                this.actionInProgress = false;
            });
    }
    private editMode(): boolean {
        return this.resource ? true : false;
    }
    /**
     * Retrieve a ResourceRegistry for the passed string resource type instance
     */
    private retrieveResourceRegistry(type) {
        let client = this.clientService;
        let id = this.registryId;

        function isAsset() {
            return client.getBusinessNetworkConnection().getAssetRegistry(id);
        }

        function isTransaction() {
            return client
                .getBusinessNetworkConnection()
                .getTransactionRegistry(id);
        }

        function isParticipant() {
            return client
                .getBusinessNetworkConnection()
                .getParticipantRegistry(id);
        }

        let types = {
            Asset: isAsset,
            Participant: isParticipant,
            Transaction: isTransaction
        };

        return types[type]();
    }

    /**
     * Retrieve string description of resource type instance
     */
    private retrieveResourceType(modelClassDeclaration): string {
        if (modelClassDeclaration instanceof TransactionDeclaration) {
            return "Transaction";
        } else if (modelClassDeclaration instanceof AssetDeclaration) {
            return "Asset";
        } else if (modelClassDeclaration instanceof ParticipantDeclaration) {
            return "Participant";
        }
    }

    /**
     * Generate the json description of a resource
     */
    private generateResource(withSampleData?: boolean): void {
        console.log("generate resource");
        console.log(withSampleData);
        let businessNetworkDefinition = this.clientService.getBusinessNetwork();
        let factory = businessNetworkDefinition.getFactory();

        let id = this.userID ? this.userID : "null";
        console.log(this.userID);
        // if (!this.idFieldHasRegex()) {
        //     let idx = Math.round(Math.random() * 9999).toString();
        //     id = leftPad(idx, 4, '0');
        // }

        try {
            const generateParameters = {
                generate: withSampleData ? "sample" : "empty",
                includeOptionalFields: this.includeOptionalFields,
                disableValidation: true,
                allowEmptyId: true
            };
            let resource = factory.newResource(
                this.resourceDeclaration.getNamespace(),
                this.resourceDeclaration.getName(),
                id,
                generateParameters
            );
            let serializer = this.clientService
                .getBusinessNetwork()
                .getSerializer();
            const serializeValidationOptions = {
                validate: false
            };
            let replacementJSON = serializer.toJSON(
                resource,
                serializeValidationOptions
            );
            let existingJSON = JSON.parse(this.resourceDefinition);
            if (existingJSON) {
                console.log("existing");

                this.resourceDefinition = JSON.stringify(
                    this.updateExistingJSON(existingJSON, replacementJSON),
                    null,
                    2
                );
            } else {
                console.log("else ex");

                // Initial popup, no previous data to protect
                this.resourceDefinition = JSON.stringify(
                    replacementJSON,
                    null,
                    2
                );
            }
            this.onDefinitionChanged();
        } catch (error) {
            console.log("error");

            // We can't generate a sample instance for some reason.
            this.definitionError = error.toString();
        }
    }
    private updateExistingJSON(previousJSON, toUpdateWithJSON): object {
        for (let key in toUpdateWithJSON) {
            if (
                previousJSON.hasOwnProperty(key) &&
                toUpdateWithJSON.hasOwnProperty(key)
            ) {
                if (
                    previousJSON[key] !== null &&
                    typeof previousJSON[key] === "object" &&
                    toUpdateWithJSON[key] !== null &&
                    typeof toUpdateWithJSON[key] === "object"
                ) {
                    toUpdateWithJSON[key] = this.updateExistingJSON(
                        previousJSON[key],
                        toUpdateWithJSON[key]
                    );
                } else if (
                    previousJSON[key].toString().length > 0 &&
                    previousJSON[key] !== 0
                ) {
                    toUpdateWithJSON[key] = previousJSON[key];
                }
            }
        }
        return toUpdateWithJSON;
    }
    /**
     * Validate json definition of resource
     */
    onDefinitionChanged() {
        console.log("ondefinitionchanged");

        try {
            let json = JSON.parse(this.resourceDefinition);
            let serializer = this.clientService
                .getBusinessNetwork()
                .getSerializer();
            let resource = serializer.fromJSON(json);
            resource.validate();
            this.definitionError = null;
        } catch (error) {
            this.definitionError = error.toString();
        }
    }

    setChosenRegistry(chosenRegistry) {
        this.chosenRegistry = chosenRegistry;
    }
    modalOkc() {
        this.modalOk = !this.modalOk;
    }

    getParticipant(fqi: string): any {
        return this.participants.get(fqi);
    }

    submitTransaction() {
        const modalRef = this.modalService.open(TransactionComponent);

        modalRef.result
            .then(transaction => {
                // refresh current resource list
                this.registryReload = !this.registryReload;

                let plural = this.eventsTriggered.length > 1 ? "s" : "";

                let txMessage = `<p>Transaction ID <b>${transaction.getIdentifier()}</b> was submitted</p>`;
                let message = {
                    title: "Submit Transaction Successful",
                    text: txMessage.toString(),
                    icon: "#icon-transaction",
                    link: null,
                    linkCallback: null
                };

                if (this.eventsTriggered.length > 0) {
                    // because this won't exist on the callback
                    let events = this.eventsTriggered;
                    message.link = `${events.length} event${plural} triggered`;
                    message.linkCallback = () => {
                        this.alertService.transactionEvent$.next({
                            transaction: transaction,
                            events: events
                        });
                    };
                    this.eventsTriggered = [];
                }

                this.alertService.successStatus$.next(message);
            })
            .catch(error => {
                if (error !== DrawerDismissReasons.ESC) {
                    this.alertService.errorStatus$.next(error);
                }
            });
    }

    initializeEventListener() {
        const businessNetworkConnection = this.clientService.getBusinessNetworkConnection();
        // Prevent multiple listeners being created
        if (businessNetworkConnection.listenerCount("event") === 0) {
            businessNetworkConnection.on("event", event => {
                this.eventsTriggered.push(event);
            });
        }
    }
    loadAllIdentities(): Promise<void> {
        console.log("load all ids");

        // this.issueNewId();
        return this.clientService
            .ensureConnected()
            .then(() => {
                return this.loadParticipants();
            })
            .then(() => {
                this.businessNetworkName = this.clientService
                    .getBusinessNetwork()
                    .getName();
                return this.clientService
                    .getBusinessNetworkConnection()
                    .getIdentityRegistry();
            })
            .then(registry => {
                return registry.getAll();
            })
            .then(ids => {
                // get the card ref for each identity
                let connectionProfile = this.identityCardService
                    .getCurrentIdentityCard()
                    .getConnectionProfile();
                let qpn: string = this.identityCardService.getQualifiedProfileName(
                    connectionProfile
                );

                ids.sort((a, b) => {
                    return a.name.localeCompare(b.name);
                });

                ids.filter(id => {
                    id.ref = this.identityCardService.getCardRefFromIdentity(
                        id.name,
                        this.businessNetworkName,
                        qpn
                    );
                });

                ids.forEach((el, index) => {
                    if (
                        el["participant"].getType() !== "NetworkAdmin" &&
                        ids[index]["state"] !== "REVOKED"
                    ) {
                        if (
                            !this.getParticipant(
                                el["participant"].getNamespace() +
                                    "." +
                                    el["participant"].getType() +
                                    "#" +
                                    el["participant"].getIdentifier()
                            )
                        ) {
                            ids[index]["state"] = "BOUND PARTICIPANT NOT FOUND";
                        }
                    }
                });
                this.allIdentities = ids;
            })
            .then(() => {
                return this.loadMyIdentities();
            })
            .catch(error => {
                this.alertService.errorStatus$.next(error);
            });
    }

    private  loadMyIdentities(): void {
        this.currentIdentity = this.identityCardService.currentCard;

        let businessNetwork = this.identityCardService
            .getCurrentIdentityCard()
            .getBusinessNetworkName();
        let connectionProfile = this.identityCardService
            .getCurrentIdentityCard()
            .getConnectionProfile();
        let qpn = this.identityCardService.getQualifiedProfileName(
            connectionProfile
        );

        this.identityCards = this.identityCardService.getAllCardsForBusinessNetwork(
            businessNetwork,
            qpn
        );

        let cardRefs = Array.from(this.identityCards.keys());
        this.myIDs = cardRefs
            .map(elm => {
                let id = this.allIdentities.find(el => {
                    return el["ref"] === elm;
                });
                return {
                    ref: elm,
                    usable:
                        id["state"] !== "BOUND PARTICIPANT NOT FOUND" &&
                        id["state"] !== "REVOKED"
                };
            })
            .sort((a, b) => {
                return a.ref.localeCompare(b.ref);
            });
    }

    private  issueNewId(): Promise<void> {
        console.log("ISSUEN");
        let modalRef = this.modalService.open(IssueIdentityComponent);
        console.log(modalRef);
        modalRef.componentInstance.participants = this.participants;

        return modalRef.result
            .then(result => {
                if (result) {
                    let connectionProfile = this.identityCardService
                        .getCurrentIdentityCard()
                        .getConnectionProfile();
                    if (connectionProfile["x-type"] === "web") {
                        return this.addIdentityToWallet(result);
                    } else {
                        return this.showNewId(result);
                    }
                }
            })
            .catch(reason => {
                if (
                    reason &&
                    reason !== ModalDismissReasons.BACKDROP_CLICK &&
                    reason !== ModalDismissReasons.ESC
                ) {
                    this.alertService.errorStatus$.next(reason);
                }
            })
            .then(() => {
                return this.loadAllIdentities();
            })
            .catch(reason => {
                this.alertService.errorStatus$.next(reason);
            });
    }

    private  setCurrentIdentity(
        ID: { ref; usable },
        revertOnError: boolean
    ): Promise<void> {
        let cardRef = ID.ref;
        console.log(cardRef);
        console.log(ID);
        if (this.currentIdentity === cardRef || !ID.usable) {
            return Promise.resolve();
        }

        let startIdentity = this.currentIdentity;

        this.identityCardService
            .setCurrentIdentityCard(cardRef)
            .then(() => {
                this.currentIdentity = cardRef;
                this.alertService.busyStatus$.next({
                    title: "Reconnecting...",
                    text: "Using identity " + this.currentIdentity
                });
                return this.clientService.ensureConnected(true);
            })
            .then(() => {
                this.alertService.busyStatus$.next(null);
                return this.loadAllIdentities();
            })
            .catch(error => {
                this.alertService.busyStatus$.next(null);
                this.alertService.errorStatus$.next(error);
                if (revertOnError) {
                    this.setCurrentIdentity(
                        { ref: this.currentIdentity, usable: true },
                        false
                    );
                }
            });
    }

    private  openRemoveModal(cardRef: string): Promise<void> {
        let userID = this.identityCards.get(cardRef).getUserName();

        // show confirm/delete dialog first before taking action
        const confirmModalRef = this.modalService.open(DeleteComponent);
        confirmModalRef.componentInstance.headerMessage = "Remove ID";
        confirmModalRef.componentInstance.fileAction = "remove";
        confirmModalRef.componentInstance.fileType = "ID";
        confirmModalRef.componentInstance.fileName = userID;
        confirmModalRef.componentInstance.deleteMessage =
            "Take care when removing IDs: you usually cannot re-add them. Make sure you leave at least one ID that can be used to issue new IDs.";
        confirmModalRef.componentInstance.confirmButtonText = "Remove";

        return confirmModalRef.result.then(
            () => {
                this.alertService.busyStatus$.next({
                    title: "Removing ID",
                    text: "Removing identity " + userID + " from your wallet"
                });
                return this.removeIdentity(cardRef);
            },
            reason => {
                // runs this when user presses 'cancel' button on the modal
                if (
                    reason &&
                    reason !== ModalDismissReasons.BACKDROP_CLICK &&
                    reason !== ModalDismissReasons.ESC
                ) {
                    this.alertService.busyStatus$.next(null);
                    this.alertService.errorStatus$.next(reason);
                }
            }
        );
    }

    private revokeIdentity(identity): Promise<void> {
        // show confirm/delete dialog first before taking action
        const confirmModalRef = this.modalService.open(DeleteComponent);
        confirmModalRef.componentInstance.headerMessage = "Revoke Identity";
        confirmModalRef.componentInstance.fileType = "identity";
        confirmModalRef.componentInstance.fileName = identity.name;
        confirmModalRef.componentInstance.deleteMessage =
            "Are you sure you want to do this?";
        confirmModalRef.componentInstance.confirmButtonText = "Revoke";
        confirmModalRef.componentInstance.action = "revoke";

        return confirmModalRef.result.then(
            () => {
                this.alertService.busyStatus$.next({
                    title: "Revoking identity within business network",
                    text: "Revoking identity " + identity.name
                });

                return this.clientService
                    .revokeIdentity(identity)
                    .then(() => {
                        // only try and remove it if its in the wallet
                        let walletIdentity = this.myIDs.find(myIdentity => {
                            return identity.ref === myIdentity.ref;
                        });

                        if (walletIdentity) {
                            return this.removeIdentity(identity.ref);
                        }
                    })
                    .then(() => {
                        return this.loadAllIdentities();
                    })
                    .then(() => {
                        // Send alert
                        this.alertService.busyStatus$.next(null);
                        this.alertService.successStatus$.next({
                            title: "Revoke Successful",
                            text: identity.name + " was successfully revoked.",
                            icon: "#icon-bin_icon"
                        });
                    })
                    .catch(error => {
                        this.alertService.busyStatus$.next(null);
                        this.alertService.errorStatus$.next(error);
                    });
            },
            reason => {
                // runs this when user presses 'cancel' button on the modal
                if (
                    reason &&
                    reason !== ModalDismissReasons.BACKDROP_CLICK &&
                    reason !== ModalDismissReasons.ESC
                ) {
                    this.alertService.busyStatus$.next(null);
                    this.alertService.errorStatus$.next(reason);
                }
            }
        );
    }

    loadParticipants() {
        console.log("load participants");

        return this.clientService
            .getBusinessNetworkConnection()
            .getAllParticipantRegistries()
            .then(participantRegistries => {
                return Promise.all(
                    participantRegistries.map(registry => {
                        return registry.getAll();
                    })
                );
            })
            .then(participantArrays => {
                return Promise.all(
                    participantArrays.reduce(
                        (accumulator, currentValue) =>
                            accumulator.concat(currentValue),
                        []
                    )
                );
            })
            .then(allParticipants => {
                return Promise.all(
                    allParticipants.map(registryParticipant => {
                        return this.participants.set(
                            registryParticipant.getFullyQualifiedIdentifier(),
                            registryParticipant
                        );
                    })
                );
            })
            .catch(error => {
                this.alertService.errorStatus$.next(error);
            });
    }
    private removeIdentity(cardRef: string): Promise<void> {
        let userID = this.identityCards.get(cardRef).getUserName();
        return this.identityCardService
            .deleteIdentityCard(cardRef)
            .then(() => {
                return this.loadAllIdentities();
            })
            .then(() => {
                // Send alert
                this.alertService.busyStatus$.next(null);
                this.alertService.successStatus$.next({
                    title: "Removal Successful",
                    text: userID + " was successfully removed.",
                    icon: "#icon-bin_icon"
                });
            })
            .catch(error => {
                this.alertService.busyStatus$.next(null);
                this.alertService.errorStatus$.next(error);
            });
    }

    private showNewId(identity: { userID; userSecret }): Promise<any> {
        const modalRef = this.modalService.open(IdentityIssuedComponent);
        modalRef.componentInstance.userID = identity.userID;
        modalRef.componentInstance.userSecret = identity.userSecret;

        return modalRef.result.then(result => {
            if (result.choice === "add") {
                this.alertService.successStatus$.next({
                    title: "ID Card added to wallet",
                    text:
                        "The ID card " +
                        this.identityCardService
                            .getIdentityCard(result.cardRef)
                            .getUserName() +
                        " was successfully added to your wallet",
                    icon: "#icon-role_24"
                });
            } else if (result.choice === "export") {
                return this.exportIdentity(result.card);
            }
        });
    }

    private exportIdentity(card: IdCard): Promise<any> {
        let fileName = card.getUserName() + ".card";

        return card.toArchive().then(archiveData => {
            let file = new Blob([archiveData], {
                type: "application/octet-stream"
            });
            return saveAs(file, fileName);
        });
    }

    private addIdentityToWallet(identity: {
        userID;
        userSecret;
    }): Promise<any> {
        let currentCard = this.identityCardService.getCurrentIdentityCard();
        let connectionProfile = currentCard.getConnectionProfile();
        let businessNetworkName = currentCard.getBusinessNetworkName();

        return this.identityCardService
            .createIdentityCard(
                identity.userID,
                null,
                businessNetworkName,
                identity.userSecret,
                connectionProfile
            )
            .then((cardRef: string) => {
                this.alertService.successStatus$.next({
                    title: "ID Card added to wallet",
                    text:
                        "The ID card " +
                        this.identityCardService
                            .getIdentityCard(cardRef)
                            .getUserName() +
                        " was successfully added to your wallet",
                    icon: "#icon-role_24"
                });
            });
    }
    private isHistorian(): boolean {
        return (
            this.registryId ===
            "org.hyperledger.composer.system.HistorianRecord"
        );
    }
}
