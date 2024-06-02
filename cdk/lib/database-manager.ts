import {Construct} from 'constructs';
import {
  Architecture,
  Code,
  Function,
  IFunction,
  Runtime,
} from 'aws-cdk-lib/aws-lambda';
import {Duration, Stack} from 'aws-cdk-lib';
import * as path from 'path';
import {
  Effect,
  ManagedPolicy,
  PolicyStatement,
  Role,
  ServicePrincipal,
} from 'aws-cdk-lib/aws-iam';
import {
  InterfaceVpcEndpoint,
  InterfaceVpcEndpointService,
  SecurityGroup,
  SecurityGroupProps,
  Subnet,
  Vpc,
} from 'aws-cdk-lib/aws-ec2';

export interface DatabaseManagerProps {
  readonly vpcId: string;
  readonly availabilityZones: string[];
  readonly privateSubnetIds: string[];
  readonly vpcCidrBlock: string;
  readonly keyArn: string;
  readonly secretArn: string;
}

export class DatabaseManager extends Construct {
  public readonly handler: IFunction;

  constructor(scope: Construct, id: string, props: DatabaseManagerProps) {
    super(scope, id);

    const lambdaRole = new Role(this, 'DatabaseManagerHandlerRole', {
      assumedBy: new ServicePrincipal('lambda.amazonaws.com'),
    });

    lambdaRole.addManagedPolicy(
      ManagedPolicy.fromAwsManagedPolicyName(
        'service-role/AWSLambdaVPCAccessExecutionRole'
      )
    );

    const resolvedPath = path.join(__dirname, '../dist/database-manager.js');
    console.log('Resolved path:', resolvedPath);

    this.handler = new Function(this, 'Handler', {
      architecture: Architecture.ARM_64,
      code: Code.fromAsset(path.join(__dirname, '../dist/')),
      handler: 'database-manager.handler',
      runtime: Runtime.NODEJS_20_X,
      role: lambdaRole,
      vpc: Vpc.fromVpcAttributes(this, 'HandlerVpc', {
        vpcId: props.vpcId,
        availabilityZones: props.availabilityZones,
        privateSubnetIds: props.privateSubnetIds,
        vpcCidrBlock: props.vpcCidrBlock,
      }),
      memorySize: 512,
      timeout: Duration.seconds(30),
    });

    this.handler.addPermission('ApiGatewayInvokePermission', {
      principal: new ServicePrincipal('apigateway.amazonaws.com'),
      action: 'lambda:InvokeFunction',
      sourceArn: `arn:aws:execute-api:${Stack.of(this).region}:${Stack.of(this).account}:*/*/*/*`,
    });

    const region = process.env.AWS_REGION;
    const account = Stack.of(this).account;

    this.handler.addToRolePolicy(
      new PolicyStatement({
        actions: ['secretsmanager:GetSecretValue'],
        resources: [props.secretArn],
        effect: Effect.ALLOW,
      })
    );

    this.handler.addToRolePolicy(
      new PolicyStatement({
        actions: ['kms:Decrypt'],
        resources: [props.keyArn],
        effect: Effect.ALLOW,
      })
    );

    // // Create a reference to the VPC id passed in as a parameter.
    // This is used to create the VPC endpoint.
    const vpc = Vpc.fromVpcAttributes(this, 'Vpc', {
      vpcId: props.vpcId,
      availabilityZones: props.availabilityZones,
      privateSubnetIds: props.privateSubnetIds,
      vpcCidrBlock: props.vpcCidrBlock,
    });

    // TODO: change allowAllOutbound to false and add specific rules
    const vpcEndpointSecurityGroupProps: SecurityGroupProps = {
      vpc: vpc,
      // securityGroupName: 'VpcEndpointForDatabaseManagerExecutor',
      description:
        'Lambda VPC endpoint for database-manager function, so it can reach RDS.',
      allowAllOutbound: true,
    };

    const vpcEndpointSecurityGroup = new SecurityGroup(
      this,
      'VpcEndpointForDatabaseManagerExecutor',
      vpcEndpointSecurityGroupProps
    );

    // Add an interface VPC endpoint for Lambda
    const lambdaVpcEndpoint = new InterfaceVpcEndpoint(
      this,
      'DatabaseManagerFunctionVpcEndpoint',
      {
        securityGroups: [vpcEndpointSecurityGroup],
        service: new InterfaceVpcEndpointService(
          `com.amazonaws.${region}.lambda`,
          5432
        ),
        subnets: {
          subnets: props.privateSubnetIds.map(id =>
            Subnet.fromSubnetAttributes(this, `Subnet${id}`, {subnetId: id})
          ),
        },
        vpc: vpc,
      }
    );
  }
}
