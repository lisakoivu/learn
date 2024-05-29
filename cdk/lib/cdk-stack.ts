import {Construct} from 'constructs';
import * as cdk from 'aws-cdk-lib';
import {StackProps} from 'aws-cdk-lib';
import * as p from '../package.json';
import {
  AmazonLinuxGeneration,
  AmazonLinuxImage,
  Instance,
  InstanceType,
  InterfaceVpcEndpointAwsService,
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
  AnyPrincipal,
  Effect,
  ManagedPolicy,
  PolicyStatement,
  Role,
  ServicePrincipal,
} from 'aws-cdk-lib/aws-iam';

import * as os from 'os';
import * as path from 'node:path';
import {
  AccessLogFormat,
  EndpointType,
  LambdaIntegration,
  LogGroupLogDestination,
  MethodLoggingLevel,
  MockIntegration,
  Model,
  RestApi,
} from 'aws-cdk-lib/aws-apigateway';
import {LogGroup} from 'aws-cdk-lib/aws-logs';
import {Hello} from './hello';
import {HitCounter} from './hitcounter';
import {AttributeType, Table} from 'aws-cdk-lib/aws-dynamodb';
import {Code, Function, Runtime} from 'aws-cdk-lib/aws-lambda';

export interface CdkStackProps extends StackProps {
  readonly availabilityZones: string[];
  readonly keyArn: string;
  readonly privateSubnetIds: string[];
  readonly vpcId: string;
}

interface Config {
  readonly availabilityZones: string[];
  readonly keyArn: string;
  readonly privateSubnetIds: string[];
  readonly publicSubnetIds: string[];
  readonly vpcCidrBlock: string;
  readonly vpcId: string;
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
      availabilityZones: config.availabilityZones,
      privateSubnetIds: config.privateSubnetIds,
      publicSubnetIds: config.publicSubnetIds,
      vpcCidrBlock: config.vpcCidrBlock,
      vpcId: config.vpcId,
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
      role: ec2Role,
      securityGroup: securityGroup,
      userData: userData,
      vpc,
      vpcSubnets: {
        subnetType: SubnetType.PUBLIC,
      },
    });


    //-------------------------------------------------------------------------
    // api definition

    const logGroup = new LogGroup(this, 'ApiGatewayAccessLogs', {
      retention: 7,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // Ensure security group allows traffic from VPC
    const apiEndpointSecurityGroup = new SecurityGroup(this, 'ApiEndpointSG', {
      allowAllOutbound: true,
      description: 'Allow traffic to API Gateway endpoint',
      vpc,
    });

    apiEndpointSecurityGroup.addIngressRule(
      Peer.ipv4(vpc.vpcCidrBlock),
      Port.tcp(443),
      'Allow HTTPS traffic from VPC'
    );

    // Create the interface endpoint for execute-api
    const apiEndpoint = vpc.addInterfaceEndpoint('ExecuteApiEndpoint', {
      privateDnsEnabled: true,
      securityGroups: [apiEndpointSecurityGroup],
      service: InterfaceVpcEndpointAwsService.APIGATEWAY,
      subnets: {subnets: privateSubnets},
    });

    const apiResourcePolicy = new PolicyStatement({
      actions: ['execute-api:Invoke'],
      conditions: {
        StringEquals: {
          'aws:SourceVpce': apiEndpoint.vpcEndpointId,
        },
      },
      effect: Effect.ALLOW,
      principals: [new AnyPrincipal()],
      resources: [`arn:aws:execute-api:${this.region}:${this.account}:*`],
    });

    const restApi = new RestApi(this, 'RestApi', {
      cloudWatchRole: true,
      deploy: true,
      deployOptions: {
        accessLogDestination: new LogGroupLogDestination(logGroup),
        accessLogFormat: AccessLogFormat.jsonWithStandardFields(),
        dataTraceEnabled: true,
        loggingLevel: MethodLoggingLevel.INFO,
        metricsEnabled: true,
        stageName: 'test',
      },
      endpointConfiguration: {
        types: [EndpointType.PRIVATE],
        vpcEndpoints: [apiEndpoint],
      },
      policy: new cdk.aws_iam.PolicyDocument({
        statements: [apiResourcePolicy],
      }),
    });


    //-------------------------------------------------------------------------
    // the functions for the api
    const helloFunction = new Hello(this, 'HelloHandler', {});

    const helloWithCounter = new HitCounter(this, 'HelloHitCounter', {
      downstream: helloFunction.handler,
    });

        const helloResource = restApi.root.addResource('hello');
    helloResource.addMethod(
      'GET',
      new LambdaIntegration(helloWithCounter.handler)
    );

    const leiaResource = restApi.root.addResource('leia');
    leiaResource.addMethod('GET', new LambdaIntegration(helloFunction.handler));

    leiaResource.addMethod(
      'POST',
      new LambdaIntegration(helloFunction.handler)
    );

    const table = new Table(this, 'Hits', {
      partitionKey: {name: 'path', type: AttributeType.STRING},
    });

    const hitCounterFunction = new Function(this, 'HitCounterHandler', {
      runtime: Runtime.NODEJS_20_X,
      handler: 'hitcounter.handler',
      code: Code.fromAsset('src'),
      environment: {
        DOWNSTREAM_FUNCTION_NAME: helloFunction.handler.functionName,
        HITS_TABLE_NAME: table.tableName,
      },
    });

    const mockIntegration = new MockIntegration({
      integrationResponses: [
        {
          statusCode: '200',
          responseTemplates: {
            'application/json': JSON.stringify({message: 'Mock response'}),
          },
        },
      ],
      requestTemplates: {
        'application/json': '{"statusCode": 200}',
      },
    });

    // Add a resource and method with the mock integration
    const mockResource = restApi.root.addResource('mock');
    mockResource.addMethod('ANY', mockIntegration, {
      methodResponses: [
        {
          statusCode: '200',
          responseModels: {
            'application/json': Model.EMPTY_MODEL,
          },
        },
      ],
    });

    // const resourcesIntegration = new
  }
}
