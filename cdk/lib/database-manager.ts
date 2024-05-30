import {Construct} from 'constructs';
import {Architecture, IFunction, Runtime} from 'aws-cdk-lib/aws-lambda';
import {Duration, Stack} from 'aws-cdk-lib';
import {RetentionDays} from 'aws-cdk-lib/aws-logs';
import * as path from 'path';
import {Role, ServicePrincipal} from 'aws-cdk-lib/aws-iam';
import {
  InterfaceVpcEndpoint,
  InterfaceVpcEndpointService,
  SecurityGroup,
  SecurityGroupProps,
  Subnet,
  Vpc,
} from 'aws-cdk-lib/aws-ec2';
import {NodejsFunction} from 'aws-cdk-lib/aws-lambda-nodejs';

export interface DatabaseManagerProps {
  readonly vpcId: string;
  readonly availabilityZones: string[];
  readonly privateSubnetIds: string[];
  readonly vpcCidrBlock: string;
}

export interface DatabaseManagerProps {}

export class DatabaseManager extends Construct {
  public readonly handler: IFunction;

  constructor(scope: Construct, id: string, props: DatabaseManagerProps) {
    super(scope, id);

    const lambdaRole = new Role(this, 'DatabaseManagerHandlerRole', {
      assumedBy: new ServicePrincipal('lambda.amazonaws.com'),
    });

    const resolvedPath = path.join(__dirname, '../src/database-manager.js');
    console.log('Resolved path:', resolvedPath);

    this.handler = new NodejsFunction(this, 'Handler', {
      architecture: Architecture.ARM_64,
      bundling: {
        minify: true,
        sourceMap: true,
      },
      // entry: resolvedPath,
      entry: path.join(__dirname, '../src/database-manager.ts'),
      environment: {
        NODE_EXTRA_CA_CERTS: '/var/runtime/ca-cert.pem',
      },
      handler: 'handler',
      logRetention: RetentionDays.ONE_MONTH,
      memorySize: 512,
      role: lambdaRole,
      runtime: Runtime.NODEJS_20_X,
      timeout: Duration.seconds(30),
      vpc: Vpc.fromVpcAttributes(scope, 'HandlerVpc', {
        vpcId: props.vpcId,
        availabilityZones: props.availabilityZones,
        privateSubnetIds: props.privateSubnetIds,
        vpcCidrBlock: props.vpcCidrBlock,
      }),
    });

    this.handler.addPermission('ApiGatewayInvokePermission', {
      principal: new ServicePrincipal('apigateway.amazonaws.com'),
      action: 'lambda:InvokeFunction',
      sourceArn: `arn:aws:execute-api:${Stack.of(this).region}:${Stack.of(this).account}:*/*/*/*`,
    });

    // Create a reference to the VPC id passed in as a parameter.
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
    const currentRegion = process.env.AWS_REGION;
    const lambdaVpcEndpoint = new InterfaceVpcEndpoint(
      this,
      'DatabaseManagerFunctionVpcEndpoint',
      {
        securityGroups: [vpcEndpointSecurityGroup],
        service: new InterfaceVpcEndpointService(
          `com.amazonaws.${currentRegion}.lambda`,
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
