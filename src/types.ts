

export interface IIntegration {
    id: string;
    name: string;
    description: string;
    valid_urls: [String];
    author: String;
    version: String;
    actions: [IAction];
}


export interface IAction {
    name: string;
    call: string;
    call_template: string;
    parameters: [ IParameter ];
}

export interface IParameter {
    name: string;
    type: string;
}


export interface IApiConnection {
    scheme: string;
    host: string;
    version: string;
}

export enum IApiEnvironment {
    Development  = "development",
    Staging      = "staging",
    Production   = "production",
}