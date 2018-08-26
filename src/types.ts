
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