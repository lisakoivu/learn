import {Client, Client as PGClient, ClientConfig as PGClientConfig} from 'pg';
// import {log} from 'node:util';

// interface ExtendedClientConfig extends PGClientConfig {
//   readOnly?: boolean;
// }
// --------------------------------------------------------------

export interface IDatabaseClient {
  connect: () => Promise<void>;
  query: (text: string, params?: any[]) => Promise<any>;
  end: () => Promise<void>;
}

export class DatabaseClient implements IDatabaseClient {
  private client: PGClient;

  constructor(config: {
    user: string;
    host: string;
    database: string;
    password: string;
    port: number;
    ssl: {rejectUnauthorized: boolean};
  }) {
    this.client = new PGClient(config);
  }

  async connect(): Promise<void> {
    await this.client.connect();
  }

  async query(text: string, params?: any[]): Promise<any> {
    return this.client.query(text, params);
  }

  async end(): Promise<void> {
    await this.client.end();
  }

  // --------------------------------------------------------------
  public async createDatabase(databaseName: string): Promise<string | null> {
    console.log(
      `starting createDatabase: creating database named ${databaseName} meow`
    );
    try {
      await this.connect();
      const res = await this.client.query(`CREATE DATABASE ${databaseName}`);
      await this.end();
      return `Database ${databaseName} created. Result is ${res}`;
    } catch (error) {
      console.error(`Error creating database. Exiting. ${error}`);
      throw error;
    }
  }

  public async selectDate(): Promise<string | null> {
    console.log('starting selectDate');
    try {
      await this.connect();
      const res = await this.client.query('SELECT NOW()');
      await this.end();
      return res.rows[0].now;
    } catch (error) {
      console.error(`Error selecting date. Exiting. ${error}`);
      throw error;
    }
  }
}
