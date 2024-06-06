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

  public async grantAdminPrivilegesSystemContext(
    userName: string
  ): Promise<string | null> {
    console.log(
      `starting grantAdminPrivilegesSystemContext: granting system admin privileges to user ${userName}`
    );
    let res = null;
    try {
      res = await this.client.query(
        `GRANT ALL PRIVILEGES ON DATABASE ${userName} TO ${userName}`
      );
      res = await this.client.query(
        `GRANT USAGE ON SCHEMA public TO ${userName}`
      );
      console.log(
        `grant usage on schema public result ${res.command}, ${res.rowCount}, ${res.fields}, ${res.oid}`
      );
      await this.end();
      return `Admin system context privileges granted to user ${userName}. Result is ${res}`;
    } catch (error) {
      console.error(
        `Error granting system context admin privileges. Exiting. ${res}`
      );
      throw error;
    }
  }

  public async revokeAdminPrivilegesSystemContext(
    userName: string
  ): Promise<string | null> {
    console.log(
      `starting revokeAdminPrivilegesSystemContext: revoking system admin privileges from user ${userName}`
    );
    try {
      let res = null;
      // let res = await this.client.query(
      //   `REVOKE ALL PRIVILEGES ON DATABASE ${userName} FROM ${userName}`
      // );
      //
      // console.log(
      //   `revoke all privileges on database ${userName} result: ${res.command}, ${res.rowCount}, ${res.fields}, ${res.oid}, ${JSON.stringify(res)}`
      // );

      res = await this.client.query(
        `REVOKE CREATE, USAGE ON SCHEMA PUBLIC FROM ${userName}`
      );

      console.log(
        `revoke create, usage on schema public result ${res.command}, ${res.rowCount}, ${res.fields}, ${res.oid}, ${JSON.stringify(res)}`
      );

      return `Admin system context privileges revoked from user ${userName}. Result is ${res}`;
    } catch (error) {
      console.error(
        `Error revoking system context admin privileges. Exiting. ${error}`
      );
      throw error;
    }
  }

  public async grantAdminPrivilegesDatabaseContext(
    userName: string,
    host: string,
    password: string
  ): Promise<string | null> {
    console.log(
      `starting grantAdminPrivilegesDatabaseContext: granting system admin privileges to user ${userName} on host ${host}`
    );
    // from here, all grants must be within the context of the target database

    let res = null;
    res = await this.client.query(
      `GRANT CREATE ON SCHEMA public TO ${userName}`
    );

    console.log(
      `grant create on schema public result ${res.command}, ${res.rowCount}, ${res.fields}, ${res.oid} ${JSON.stringify(res)}`
    );
    res = await this.client.query(
      `GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO ${userName}`
    );

    console.log(
      `grant all privileges on all tables in schema public result ${res.command}, ${res.rowCount}, ${res.fields}, ${res.oid} ${JSON.stringify(res)}`
    );

    res = await this.client.query(
      `GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO ${userName}`
    );

    console.log(
      `grant all privileges on all sequences in schema public result ${res.command}, ${res.rowCount}, ${res.fields}, ${res.oid} ${JSON.stringify(res)}`
    );
    res = await this.client.query(
      `GRANT ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA public TO ${userName}`
    );

    console.log(
      `grant all privileges on all functions in schema public result ${res.command}, ${res.rowCount}, ${res.fields}, ${res.oid} ${JSON.stringify(res)}`
    );
    res = await this.client.query(
      `ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL PRIVILEGES ON TABLES TO ${userName}`
    );

    res = await this.client.query(
      `ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL PRIVILEGES ON SEQUENCES TO ${userName}`
    );

    await this.client.query(
      `ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL PRIVILEGES ON FUNCTIONS TO ${userName}`
    );

    await this.client.query(
      `ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL PRIVILEGES ON TABLES TO ${userName}`
    );

    await this.client.query(
      `ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL PRIVILEGES ON SEQUENCES TO ${userName}`
    );

    await this.client.query(
      `ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL PRIVILEGES ON FUNCTIONS TO ${userName}`
    );

    await this.client.query(
      `ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL PRIVILEGES ON TABLES TO ${userName}`
    );

    return `Admin privileges granted to user ${userName}. Result is ${res}`;
  }
  catch(error: any) {
    console.error(
      `Error granting database context admin privileges. Exiting. ${error}`
    );
    throw error;
  }

  public async revokeAdminPrivilegesDatabaseContext(
    userName: string
  ): Promise<string | null> {
    console.log(
      `starting revokeAdminPrivilegesDatabaseContext: revoking database admin privileges from user ${userName}`
    );

    try {
      await this.client.query(
        `REVOKE CREATE ON SCHEMA public FROM ${userName}`
      );

      await this.client.query(
        `REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public FROM ${userName}`
      );

      await this.client.query(
        `REVOKE ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public FROM ${userName}`
      );

      await this.client.query(
        `REVOKE ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA public FROM ${userName}`
      );

      await this.client.query(
        `ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL PRIVILEGES ON TABLES FROM ${userName}`
      );

      await this.client.query(
        `ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL PRIVILEGES ON SEQUENCES FROM ${userName}`
      );

      await this.client.query(
        `ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL PRIVILEGES ON FUNCTIONS FROM ${userName}`
      );

      await this.client.query(
        `ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL PRIVILEGES ON TABLES FROM ${userName}`
      );

      await this.client.query(
        `ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL PRIVILEGES ON SEQUENCES FROM ${userName}`
      );

      await this.client.query(
        `ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL PRIVILEGES ON FUNCTIONS FROM ${userName}`
      );

      await this.client.query(
        `ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL PRIVILEGES ON TABLES FROM ${userName}`
      );

      return `Database context admin privileges have been revoked from user ${userName}.`;
    } catch (error) {
      console.error(
        `Error revoking database context admin privileges. Exiting. ${error}`
      );
      throw error;
    }
  }

  public async dropUser(userName: string): Promise<string | null> {
    console.log(`starting dropUser: dropping user named ${userName}`);
    try {
      const res = await this.client.query(`DROP ROLE ${userName}`);
      return `User ${userName} dropped. Result is ${res}`;
    } catch (error) {
      console.error(`Error dropping user. Exiting. ${error}`);
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
    try {
      const res = await this.client.query(
        `SELECT pg_terminate_backend(pg_stat_activity.pid) FROM pg_stat_activity WHERE pg_stat_activity.datname = '${databaseName}' AND pid <> pg_backend_pid();`
      );
      return `Sessions killed for database ${databaseName}.`;
    } catch (error) {
      console.error(`Error killing sessions. Exiting. ${error}`);
      throw error;
    }
  }

  public async dropDatabase(databaseName: string): Promise<string | null> {
    let res = null;
    try {
      // add kill sessions
      res = await this.killDatabaseSessions(databaseName);
      res = await this.client.query(`DROP DATABASE ${databaseName}`);
      res = await this.revokeAdminPrivilegesDatabaseContext(databaseName);
      res = await this.revokeAdminPrivilegesSystemContext(databaseName);
      return `Database ${databaseName} dropped.`;
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
