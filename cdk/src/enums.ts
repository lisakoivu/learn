// export interface IEvent {
//   readonly path: string;
// }

export interface IEvent {
  [path: string]: any;
}
export interface IEmptyEvent {}

// export enum SupportedOperations {
//   CREATEDB = 'createDb',
//   SELECT = 'select',
//   DROPDB = 'dropDb',
// }

export enum SecretKeys {
  ENDPOINT = 'endpoint',
  ENGINE = 'engine',
  PASSWORD = 'password',
  PORT = 'port',
  USERNAME = 'username',
}

export enum EventParameters {
  DATABASENAME = 'databaseName',
  OPERATION = 'operation',
  SECRETARN = 'secretArn',
}

export interface IEvent {
  [EventParameters.DATABASENAME]: string;
  [EventParameters.OPERATION]: string;
  [EventParameters.SECRETARN]: string;
}

export interface IConfig {
  databaseName: string;
  userName: string;
  endpoint: string;
  port: number;
  password: string;
  secretArn: string;
}
