import {Construct} from 'constructs';
import * as cdk from 'aws-cdk-lib';
import {StackProps} from 'aws-cdk-lib';
import * as p from '../package.json';
import {
  AmazonLinuxGeneration,
  AmazonLinuxImage,
  Instance,
  InstanceType,
  Peer,
  Port,
  SecurityGroup,
  Subnet,
  SubnetType,
  UserData,
  Vpc,
} from 'aws-cdk-lib/aws-ec2';
import {Key} from 'aws-cdk-lib/aws-kms';
import * as fs from 'fs';
import {
  ManagedPolicy,
  PolicyStatement,
  Role,
  ServicePrincipal,
} from 'aws-cdk-lib/aws-iam';
import * as os from 'os';
import * as path from 'node:path';

export interface CdkStackProps extends StackProps {
  readonly vpcId: string;
  readonly availabilityZones: string[];
  readonly privateSubnetIds: string[];
  readonly keyArn: string;
}

interface Config {
  readonly vpcId: string;
  readonly vpcCidrBlock: string;
  readonly availabilityZones: string[];
  readonly privateSubnetIds: string[];
  readonly keyArn: string;
  readonly publicSubnetIds: string[];
}

export class CdkStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: CdkStackProps) {
    super(scope, id, props);
    this.addMetadata('Version', p.version);
    this.addMetadata('Name', p.name);

    const config: Config = JSON.parse(
      fs.readFileSync('./configs/config.json', 'utf8').trim()
    );

    const key = Key.fromKeyArn(this, 'sharedKey', config.keyArn);

    const vpc = Vpc.fromVpcAttributes(this, 'Vpc', {
      vpcId: config.vpcId,
      vpcCidrBlock: config.vpcCidrBlock, // Include vpcCidrBlock
      availabilityZones: config.availabilityZones,
      privateSubnetIds: config.privateSubnetIds,
      publicSubnetIds: config.publicSubnetIds,
    });

    // Map the subnet IDs to ISubnet with availabilityZone
    const privateSubnets = config.privateSubnetIds.map((subnetId, index) =>
      Subnet.fromSubnetAttributes(this, `Subnet-${subnetId}`, {
        subnetId: subnetId,
        availabilityZone: config.availabilityZones[index],
      })
    );
    //-------------------------------------------------------------------------
    // ec2 instance to test api calls and allow jump access to postgres database
    const ec2Role = new Role(this, 'EC2InstanceRole', {
      assumedBy: new ServicePrincipal('ec2.amazonaws.com'),
    });

    ec2Role.addToPolicy(
      new PolicyStatement({
        actions: ['execute-api:Invoke'],
        resources: ['*'],
      })
    );

    ec2Role.addManagedPolicy(
      ManagedPolicy.fromAwsManagedPolicyName('AmazonSSMManagedInstanceCore')
    );

    // Construct the path to the public key file in the ~/.ssh directory
    const homeDir = os.homedir();
    const publicKeyPath = path.join(homeDir, '.ssh', 'lisamariekoivu.pub');

    // Read the public key file
    const publicKey = fs.readFileSync(publicKeyPath, 'utf8').trim();

    // Define user data to add your public key
    const userData = UserData.forLinux();
    userData.addCommands(
      'mkdir -p /home/ec2-user/.ssh',
      `echo "${publicKey}" >> /home/ec2-user/.ssh/authorized_keys`,
      'chown -R ec2-user:ec2-user /home/ec2-user/.ssh',
      'chmod 700 /home/ec2-user/.ssh',
      'chmod 600 /home/ec2-user/.ssh/authorized_keys'
    );
    ``;

    // Create a security group
    const securityGroup = new SecurityGroup(this, 'JumpServerSG', {
      vpc,
      description: 'Allow access to the jump server.',
      allowAllOutbound: true,
    });

    // Allow SSH access from anywhere (or restrict to your IP range)
    securityGroup.addIngressRule(
      Peer.ipv4('97.100.3.218/32'),
      Port.allTraffic(),
      'Allow SSH access from the internet'
    );

    const ec2Instance = new Instance(this, 'JumpServer', {
      instanceType: new InstanceType('t2.small'),
      machineImage: new AmazonLinuxImage({
        generation: AmazonLinuxGeneration.AMAZON_LINUX_2,
      }),
      securityGroup: securityGroup,
      userData: userData,
      vpc,
      role: ec2Role,
      vpcSubnets: {
        subnetType: SubnetType.PUBLIC,
      },
    });

  }
}
