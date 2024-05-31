https://dnx.solutions/how-to-deploy-an-alb-asg-ec2-using-cdk-and-typescript/

This is a blank project for CDK development with TypeScript.

The `cdk.json` file tells the CDK Toolkit how to execute your app.

## Useful commands

- `npm run build` compile typescript to js
- `npm run watch` watch for changes and compile
- `npm run test` perform the jest unit tests
- `npx cdk deploy` deploy this stack to your default AWS account/region
- `npx cdk diff` compare deployed stack with current state
- `npx cdk synth` emits the synthesized CloudFormation template

list the IP addresses associated with the Api Gateway VPC endpoint:

```
aws ec2 describe-vpc-endpoints --vpc-endpoint-ids vpce-1234a --query "VpcEndpoints[*].NetworkInterfaceIds[]" --output text | tr '\t' '\n' | xargs -I {} aws ec2 describe-network-interfaces --network-interface-ids {} --query "NetworkInterfaces[*].PrivateIpAddresses[*].PrivateIpAddress" --output text

```

How to install psql on Amazon Linux 2023, much easier than Amazon Linux 2:

```

[root@ip-10-200-9-53 ~]# dnf install postgresql15.x86_64
Last metadata expiration check: 0:03:47 ago on Thu May 30 21:34:09 2024.
Dependencies resolved.
===============================================================================================
 Package                        Arch        Version                     Repository        Size
===============================================================================================
Installing:
 postgresql15                   x86_64      15.6-1.amzn2023.0.1         amazonlinux      1.6 M
Installing dependencies:
 postgresql15-private-libs      x86_64      15.6-1.amzn2023.0.1         amazonlinux      141 k

Transaction Summary
===============================================================================================
Install  2 Packages

Total download size: 1.8 M
Installed size: 6.9 M
Is this ok [y/N]: y
Downloading Packages:
(1/2): postgresql15-private-libs-15.6-1.amzn2023.0.1.x86_64.rp 467 kB/s | 141 kB     00:00
(2/2): postgresql15-15.6-1.amzn2023.0.1.x86_64.rpm             4.3 MB/s | 1.6 MB     00:00
-----------------------------------------------------------------------------------------------
Total                                                          2.7 MB/s | 1.8 MB     00:00
Running transaction check
Transaction check succeeded.
Running transaction test
Transaction test succeeded.
Running transaction
  Preparing        :                                                                       1/1
  Installing       : postgresql15-private-libs-15.6-1.amzn2023.0.1.x86_64                  1/2
  Installing       : postgresql15-15.6-1.amzn2023.0.1.x86_64                               2/2
  Running scriptlet: postgresql15-15.6-1.amzn2023.0.1.x86_64                               2/2
  Verifying        : postgresql15-15.6-1.amzn2023.0.1.x86_64                               1/2
  Verifying        : postgresql15-private-libs-15.6-1.amzn2023.0.1.x86_64                  2/2

Installed:
  postgresql15-15.6-1.amzn2023.0.1.x86_64 postgresql15-private-libs-15.6-1.amzn2023.0.1.x86_64

Complete!
[root@ip-10-200-9-53 ~]# psql
psql: error: connection to server on socket "/var/run/postgresql/.s.PGSQL.5432" failed: No such file or directory
        Is the server running locally and accepting connections on that socket?


```
