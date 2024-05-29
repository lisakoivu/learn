import {Runtime, IFunction, Code, Function} from 'aws-cdk-lib/aws-lambda';
import {Construct} from 'constructs';
import {IEvent} from '../src/enums';
import {PolicyStatement, Role, ServicePrincipal} from 'aws-cdk-lib/aws-iam';
import {Stack} from 'aws-cdk-lib';

export interface HelloProps {}

export class Hello extends Construct {
  public readonly handler: IFunction;

  constructor(scope: Construct, id: string, props: HelloProps) {
    super(scope, id);

    const lambdaRole = new Role(this, 'HelloHandlerRole', {
      assumedBy: new ServicePrincipal('lambda.amazonaws.com'),
    });

    this.handler = new Function(this, 'HelloHandler', {
      runtime: Runtime.NODEJS_20_X,
      handler: 'hello.handler',
      code: Code.fromAsset('src'),
    });

    this.handler.addPermission('ApiGatewayInvokePermission', {
      principal: new ServicePrincipal('apigateway.amazonaws.com'),
      action: 'lambda:InvokeFunction',
      sourceArn: `arn:aws:execute-api:${Stack.of(this).region}:${Stack.of(this).account}:*/*/*/*`,
    });
  }
}
