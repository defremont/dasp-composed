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
import { Component, NgZone } from '@angular/core';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { LocalStorageService } from 'angular-2-local-storage';
import { ThrowStmt } from '@angular/compiler/src/output/output_ast';

@Component({
    selector: 'version-check-modal',
    templateUrl: './version-check.component.html',
    styleUrls: ['./version-check.component.scss'.toString()]
})
export class VersionCheckComponent {

    constructor(public activeModal: NgbActiveModal,
                private zone: NgZone,
                private localStorageService: LocalStorageService) {
    }
    ngOnInit(){
        this.clearLocalStorage();
        this.activeModal.close();
    }
    public clearLocalStorage() {
        indexedDB.deleteDatabase('_pouch_Composer');
        if (this.localStorageService.clearAll()) {
            this.zone.runOutsideAngular(() => {
                location.reload();
            });
        } else {
            throw new Error('Failed to clear local storage');
        }
    }
}