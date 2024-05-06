import {Construct} from 'constructs';
import * as cdk from 'aws-cdk-lib';
import {Stack, StackProps} from 'aws-cdk-lib';
import {
  InstanceProfile,
  ManagedPolicy,
  Role,
  ServicePrincipal,
} from 'aws-cdk-lib/aws-iam';
import {
  Instance,
  InstanceType,
  SecurityGroup,
  Peer,
  Port,
  InstanceClass,
  InstanceSize,
  AmazonLinuxGeneration,
  AmazonLinuxImage,
  SubnetSelection,
  ISubnet,
  Subnet,
} from 'aws-cdk-lib/aws-ec2';
import {FileSystem, LifecyclePolicy} from 'aws-cdk-lib/aws-efs';
import * as p from '../package.json';
import {Vpc} from 'aws-cdk-lib/aws-ec2';
import {Key} from 'aws-cdk-lib/aws-kms';

export interface CdkStackProps extends StackProps {
  readonly vpcId: string;
  readonly availabilityZones: string[];
  readonly privateSubnetIds: string[];
  readonly keyArn: string;
}

export class CdkStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: CdkStackProps) {
    super(scope, id, props);
    this.addMetadata('Version', p.version);
    this.addMetadata('Name', p.name);

    const vpc = Vpc.fromVpcAttributes(this, 'Vpc', {
      vpcId: props.vpcId,
      availabilityZones: props.availabilityZones,
      privateSubnetIds: props.privateSubnetIds,
    });

    const key = Key.fromKeyArn(this, 'sharedKey', props.keyArn);

    // security group for EFS
    const securityGroup = new SecurityGroup(this, 'EFSSecurityGroup', {
      vpc: vpc,
      allowAllOutbound: true, // Allow outbound traffic on all ports
      securityGroupName: 'EFSSecurityGroup',
    });

    // Add an inbound rule to allow connections on port 2049
    securityGroup.addIngressRule(
      Peer.anyIpv4(),
      Port.tcp(2049),
      'Allow NFS Connections'
    );

    // Create a new Amazon EFS file system
    const fileSystem = new FileSystem(this, 'MyEfsFileSystem', {
      vpc: vpc,
      lifecyclePolicy: LifecyclePolicy.AFTER_14_DAYS, // Example lifecycle policy
      securityGroup: securityGroup, // Associate the security group with the file system
      encrypted: true,
      kmsKey: key,
    });

    // Create mount targets for the file system
    fileSystem.addAccessPoint('MyAccessPoint', {
      createAcl: {
        ownerGid: '1000',
        ownerUid: '1000',
        permissions: '755',
      },
      path: '/my-mount-point', // Example mount point path
      posixUser: {
        gid: '1000',
        uid: '1000',
      },
      // securityGroup: [securityGroup], // Associate the security group with the mount target
    });

    // security group for the ec2 instance
    const ec2SecurityGroup = new SecurityGroup(this, 'Ec2SecurityGroup', {
      vpc: vpc,
      allowAllOutbound: true, // Allow outbound traffic on all ports
      securityGroupName: 'Ec2SecurityGroup',
    });

    // Add an inbound rule to allow connections on port 22
    ec2SecurityGroup.addIngressRule(
      Peer.anyIpv4(),
      Port.tcp(22),
      'Allow SSH Connections'
    );

    const subnets: ISubnet[] = props.privateSubnetIds.map((subnetId, index) =>
      Subnet.fromSubnetAttributes(this, `subnet${index + 1}`, {
        subnetId: subnetId,
        availabilityZone: props.availabilityZones[index],
      })
    );

    const subnetSelection: SubnetSelection = {
      subnets: subnets,
    };

    const ec2Role = new Role(this, 'Ec2Role', {
      assumedBy: new ServicePrincipal('ec2.amazonaws.com'),
      managedPolicies: [
        ManagedPolicy.fromAwsManagedPolicyName('AmazonSSMManagedInstanceCore'),
      ],
    });

    // Create an instance profile
    // const instanceProfile = new InstanceProfile(this, 'InstanceProfile', {
    //   role: ec2Role,
    //   instanceProfileName: 'EC2InstanceProfile',
    // });

    const instance = new Instance(this, 'targetInstance', {
      vpc: vpc,
      securityGroup: ec2SecurityGroup,
      vpcSubnets: subnetSelection,
      instanceType: InstanceType.of(
        InstanceClass.BURSTABLE2,
        InstanceSize.MEDIUM,
      ),
      role: ec2Role,
      machineImage: new AmazonLinuxImage({
        generation: AmazonLinuxGeneration.AMAZON_LINUX_2,
      }),
    });
  }
}
