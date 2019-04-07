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
import { NgbModal } from "@ng-bootstrap/ng-bootstrap";
import { AlertService } from "../basic-modals/alert.service";
import { Http } from "@angular/http";
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
import { Router } from "@angular/router";
import { Test } from "../../../e2e/component/test";
import { timingSafeEqual } from "crypto";
const BusinessNetworkConnection = require("composer-client")
    .BusinessNetworkConnection;

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
    private firstName;
    private lastName;
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
    needPass: boolean;
    identity: string;
    pass: any;
    tabS: boolean;
    tabL: boolean = true;
    recPass: boolean = false;
    wrongPass: boolean = false;
    authorError: boolean = false;
    pass2: any;
    validPass: boolean = true;
    successPass: boolean = false;
    constructor(
        private http: Http,
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
                        return this.clientService
                            .getBusinessNetworkConnection()
                            .getHistorian();
                    })
                    .then(historianRegistry => {
                        this.reserve = this.participants.size;
                        this.registries["historian"] = historianRegistry;
                        // set the default registry selection
                        if (this.registries["participants"].length !== 0) {
                            this.chosenRegistry = this.registries[
                                "participants"
                            ][0];
                            if (
                                this.identityCardService.getCurrentIdentityCard()[
                                    "metadata"
                                ].userName !== "admin"
                            ) {
                                this.setCurrentIdentity(
                                    { ref: "admin@dasp-net", usable: true },
                                    true
                                );
                            }
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
                                    // Set resource declaration
                                    this.resourceDeclaration = modelClassDeclaration;
                                    this.resourceType = this.retrieveResourceType(
                                        modelClassDeclaration
                                    );
                                    if (this.editMode()) {
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
    private passwordAgain(pass2){
        if (pass2 === this.pass){
            return this.validPass = true;
        }else{
            return this.validPass = false;
        }
    }
    private password(pass){
        if (pass === this.pass2){
            return this.validPass = true;
        }else{
            return this.validPass = false;
        }
    }
    async newAuthor() {
        this.issueInProgress = true;
        let businessNetworkConnection = this.clientService.getBusinessNetworkConnection();
        let businessNetworkDefinition = this.clientService.getBusinessNetwork();
        let serializer = businessNetworkDefinition.getSerializer();
        let resource = serializer.fromJSON({
            $class: "org.dasp.net.NewAuthor",
            email: this.userID,
            firstName: this.firstName,
            lastName: this.lastName,
            password: this.pass
        });
        try {
            await businessNetworkConnection.submitTransaction(resource);
            await this.identityIssue();
        } catch (error) {
            this.authorError = true;
            this.issueInProgress = false;
        }
    }
    private async passAtv() {
        this.recPass = !this.recPass;
        this.wrongPass = false;
    }
    private async recoverPass() {
        this.issueInProgress = true;
        let businessNetworkConnection = this.clientService.getBusinessNetworkConnection();
        let businessNetworkDefinition = this.clientService.getBusinessNetwork();
        let serializer = businessNetworkDefinition.getSerializer();
        let resource = serializer.fromJSON({
            $class: "org.dasp.net.RecoverPassword",
            author: "resource:org.dasp.net.Details#" + this.userID
        });
        try {
            let result = await businessNetworkConnection.submitTransaction(
                resource
            );
            this.issueInProgress = false;
            this.wrongPass = false;
            this.successPass = true;
        } catch (error) {
            this.successPass = false;
            console.log(error);
            this.wrongPass = true;
            this.issueInProgress = false;
        }
    }
    async identityIssue() {
        let businessNetworkConnection = this.clientService.getBusinessNetworkConnection();
        let businessNetworkDefinition = this.clientService.getBusinessNetwork();
        try {
            await businessNetworkConnection.connect("admin@dasp-net");
            let result = await businessNetworkConnection.issueIdentity(
                "org.dasp.net.Author#" + this.userID,
                this.userID
            );
            this.secret = result.userSecret;
            await this.addIdentityToWallet({
                userID: this.userID,
                userSecret: result.userSecret
            });
            this.issueInProgress = false;
            this.pass = this.secret;
            this.trylog({ ref: this.userID + "@dasp-net", usable: true }, true);
            await businessNetworkConnection.disconnect();
        } catch (error) {
            console.log(error);
        }
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
    private async logIn() {
        if (this.recPass) {
            this.recoverPass();
        } else {
            this.issueInProgress = true;
            try {
                this.issueInProgress = true;
                let businessNetworkConnection = this.clientService.getBusinessNetworkConnection();
                let businessNetworkDefinition = this.clientService.getBusinessNetwork();
                let serializer = businessNetworkDefinition.getSerializer();
                let resource = serializer.fromJSON({
                    $class: "org.dasp.net.LogIn",
                    author: "resource:org.dasp.net.Author#" + this.userID,
                    password: this.pass
                });
                await businessNetworkConnection.connect("admin@dasp-net");
                let result = await businessNetworkConnection.submitTransaction(
                    resource
                );
                if (!result) {
                    this.trylog(
                        { ref: this.userID + "@dasp-net", usable: true },
                        true
                    );
                }
            } catch (error) {
                console.log(error);
                this.wrongPass = true;
                this.issueInProgress = false;
            }
        }
    }
    private async trylog(ID: { ref; usable }, revertOnError: boolean): Promise<void> {
        let cardRef = ID.ref;
        if (this.currentIdentity === cardRef || !ID.usable) {
            return Promise.resolve();
        }
        this.identityCardService
            .setCurrentIdentityCard(cardRef)
            .then(() => {
                this.currentIdentity = cardRef;
                return this.clientService.ensureConnected(true);
            })
            .then(() => {
                this.loadAllIdentities();
                return this.router.navigate(["/panel"]);
            })
            .catch(error => {
                console.log(error);
            });
    }
    actualFQI(userID) {
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
                console.log(error);
                this.alertService.errorStatus$.next(error);
            });
    }
    tab1() {
        this.tabS = true;
        this.tabL = false;
        this.recPass = false;
    }
    tab2() {
        this.tabL = true;
        this.tabS = false;
        this.recPass = false;
    }
    /**
     *  Create resource via json serialisation
     */
    private addOrUpdateResource() {
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
                }
            })
            .then(() => {
                this.actionInProgress = false;
            })
            .catch(error => {
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
        let businessNetworkDefinition = this.clientService.getBusinessNetwork();
        let factory = businessNetworkDefinition.getFactory();
        let id = this.userID ? this.userID : "null";
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
                this.resourceDefinition = JSON.stringify(
                    this.updateExistingJSON(existingJSON, replacementJSON),
                    null,
                    2
                );
            } else {
                // Initial popup, no previous data to protect
                this.resourceDefinition = JSON.stringify(
                    replacementJSON,
                    null,
                    2
                );
            }
            this.onDefinitionChanged();
        } catch (error) {
            console.log(error);
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
    private loadMyIdentities(): void {
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
    private setCurrentIdentity(
        ID: { ref; usable },
        revertOnError: boolean
    ): Promise<void> {
        let cardRef = ID.ref;
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
                this.loadAllIdentities();
                if (
                    this.identityCardService.getCurrentIdentityCard()[
                        "metadata"
                    ].userName !== "admin"
                ) {
                    return this.router.navigate(["/panel"]);
                }
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

    loadParticipants() {
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
        return this.identityCardService.createIdentityCard(
            identity.userID,
            null,
            businessNetworkName,
            identity.userSecret,
            connectionProfile
        );
    }
    private isHistorian(): boolean {
        return (
            this.registryId ===
            "org.hyperledger.composer.system.HistorianRecord"
        );
    }
}
