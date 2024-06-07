**Summary**

My intent with this branch is to learn about API Gateway and Lambda integrations. I used an idea from a previous job and implemented database-manager, a lambda that creates and deletes databases in a Postgres RDS instance.

This Api Gateway manages traffic for the database-manager lambda. Everything is implemented under the resource database-manager , under GET. 


Database creation also includes creation of the following objects:
-  a new database user (the database owner), with the same name as the new database. The database owner is granted admin privileges within the new database.
- A new secret is created for each new database that includes the database owner password.

Database deletion drops the database owner user and the permissions granted in addition to the database itself. 

**Configuration**

The `config.json` file contains the items below.
- vpcId: The vpc id where the resources will be created.
- availabilityZones: The availability zones where the resources will be created.
- privateSubnetIds: The subnet ids where the resources will be created.
- publicSubnetIds: The subnet ids where the resources will be created.
- keyArn: The arn of the key used to encrypt the secrets.
- vpcCidrBlock: The cidr block of the vpc in vpcId.
- secretArn: The ARN of the secret that has root access to the RDS server. This secret is not created in this stack. It is assumed to exist.
- 
The availability zones and subnet parameters must be aligned with each other. Specifically, the first subnet listed in each subnet parameter must correspond to a subnet within the first availability zone specified in the availability zones parameter.

**Sample Execution**

Sample create
```
[ec2-user@ip-10-200-9-53 ~]$ curl "https://prjau6eaff.execute-api.us-west-2.amazonaws.com/test/databasemanager?operation=createDatabase&databaseName=db2"
{"message":"Database created successfully"}
```
Sample drop
```
[ec2-user@ip-10-200-9-53 ~]$ curl "https://prjau6eaff.execute-api.us-west-2.amazonaws.com/test/databasemanager?operation=dropDatabase&databaseName=db2"
{"message":"Admin privileges have been revoked from user db2. Database and user db2 have been dropped. All secrets tagged key=database-manager-database-name , value=db2 were deleted successfully."}
```

**A few notes**

The gateway is behind a VPC Endpoint. It is reachable via the jump server, also created in this stack.

The jump server definition references my local public key file. This can easily be changed to reference a different local file. 

