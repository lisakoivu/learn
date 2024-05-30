// export interface IEvent {
//   readonly path: string;
// }

export interface IEvent {
  [path: string]: any;
}
export interface IEmptyEvent {}

export enum SupportedOperations {
  CREATEDB = 'createDb',
  SELECT = 'select',
  MULTIPLY = 'multiply',
  DIVIDE = 'divide',
}

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
