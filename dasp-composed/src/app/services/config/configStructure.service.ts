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
export class Config {
  public webonly: boolean = false;
  public title: string = '';
  public banner: Array<string> = ['', ''];
  public links: object = {
    github: <string> '',
    legal: <string> ''
  };
  public analyticsID: string = null;

  setValuesFromObject(values: object): void {
    this.overwriteConfigWithUserConfig(this, values);
  }

  setToDefault(): void {
    this.webonly = false;
    this.title = 'Descentralized Autonomous Software Publisher';
    this.banner = ['DASP', ''];
    this.links = {
      github: <string> 'https://gitlab.com/gercom',
      legal: <string> 'https://www.apache.org/licenses/LICENSE-2.0'
    };
    this.analyticsID = null;
  }

  private overwriteConfigWithUserConfig(baseConfig: object, userConfig: object) {
    for (let key in baseConfig) {
      if (baseConfig.hasOwnProperty(key) && userConfig.hasOwnProperty(key)) {
        if (baseConfig[key] instanceof Object && userConfig[key] instanceof Object) {
          baseConfig[key] = this.overwriteConfigWithUserConfig(baseConfig[key], userConfig[key]);
        } else {
          baseConfig[key] = userConfig[key];
        }
      }
    }
    return baseConfig;
  }
}
