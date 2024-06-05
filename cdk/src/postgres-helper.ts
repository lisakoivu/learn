import {Client as PGClient} from 'pg';

export interface IDatabaseClient {
  connect: () => Promise<void>;
  query: (text: string, params?: any[]) => Promise<any>;
  end: () => Promise<void>;
}

export class DatabaseClient implements IDatabaseClient {
  private client: PGClient;
  private isConnected: boolean = false;

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
    if (!this.isConnected) {
      await this.client.connect();
      this.isConnected = true;
    }
  }

  async query(text: string, params?: any[]): Promise<any> {
    await this.connect();
    return this.client.query(text, params);
  }

  async end(): Promise<void> {
    if (this.isConnected) {
      await this.client.end();
      this.isConnected = false;
    }
  }

  public async createDatabase(databaseName: string): Promise<string | null> {
    console.log(
      `starting createDatabase: creating database named ${databaseName}`
    );
    try {
      const res = await this.client.query(`CREATE DATABASE ${databaseName}`);
      return `Database ${databaseName} created. Result is ${res}`;
    } catch (error) {
      console.error(`Error creating database. Exiting. ${error}`);
      throw error;
    }
  }

  public async createUser(userName: string): Promise<string | null> {
    console.log(`starting createUser: creating user named ${userName}`);
    try {
      const res = await this.client.query(`CREATE USER ${userName}`);
      return `User ${userName} created. Result is ${res}`;
    } catch (error) {
      console.error(`Error creating user. Exiting. ${error}`);
      throw error;
    }
  }

  public async grantAdminPrivileges(userName: string): Promise<string | null> {
    console.log(
      `starting grantAdminPrivileges: granting admin privileges to user ${userName}`
    );
    let res = null;
    try {
      res = await this.client.query(
        `GRANT ALL PRIVILEGES ON DATABASE ${userName} TO ${userName}`
      );
      res = await this.client.query(
        `GRANT USAGE ON SCHEMA public TO ${userName}`
      );
      res = await this.client.query(
        `GRANT CREATE ON SCHEMA public TO ${userName}`
      );
      res = await this.client.query(
        `GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO ${userName}`
      );
      res = await this.client.query(
        `GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO ${userName}`
      );
      res = await this.client.query(
        `GRANT ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA public TO ${userName}`
      );
      res = await this.client.query(
        `ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL PRIVILEGES ON TABLES TO ${userName}`
      );
      res = await this.client.query(
        `ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL PRIVILEGES ON SEQUENCES TO ${userName}`
      );
      res = await this.client.query(
        `ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL PRIVILEGES ON FUNCTIONS TO ${userName}`
      );

      return `Admin privileges granted to user ${userName}. Result is ${res}`;
    } catch (error) {
      console.error(`Error granting admin privileges. Exiting. ${res}`);
      throw error;
    }
  }

  public async changePassword(
    userName: string,
    newPassword: string
  ): Promise<string | null> {
    console.log(
      `starting changePassword: changing password for user ${userName}`
    );
    try {
      const res = await this.client.query(
        `ALTER USER ${userName} WITH ENCRYPTED PASSWORD '${newPassword}'`
      );
      return `Password changed for user ${userName}. Result is ${res}`;
    } catch (error) {
      console.error(`Error changing password. Exiting. ${error}`);
      throw error;
    }
  }

  public async killDatabaseSessions(
    databaseName: string
  ): Promise<string | null> {
    console.log(
      `starting killDatabaseSessions: killing sessions for database ${databaseName}`
    );
    try {
      const res = await this.client.query(
        `SELECT pg_terminate_backend(pg_stat_activity.pid) FROM pg_stat_activity WHERE pg_stat_activity.datname = '${databaseName}' AND pid <> pg_backend_pid();`
      );
      return `Sessions killed for database ${databaseName}. Result is ${res}`;
    } catch (error) {
      console.error(`Error killing sessions. Exiting. ${error}`);
      throw error;
    }
  }

  public async dropDatabase(databaseName: string): Promise<string | null> {
    console.log(
      `starting dropDatabase: dropping database named ${databaseName}`
    );
    let res = null;
    try {
      // add kill sessions
      res = await this.killDatabaseSessions(databaseName);
      res = await this.client.query(`DROP DATABASE ${databaseName}`);
      return `Database ${databaseName} dropped. Result is ${res}`;
    } catch (error) {
      console.error(`Error dropping database. Exiting. ${error}`);
      throw error;
    }
  }
  public async selectDate(): Promise<string | null> {
    console.log('starting selectDate');
    try {
      await this.connect();
      const res = await this.client.query('SELECT NOW()');
      return res.rows[0].now;
    } catch (error) {
      console.error(`Error selecting date. Exiting. ${error}`);
      throw error;
    } finally {
      await this.end();
    }
  }
}
