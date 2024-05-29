import {Construct} from 'constructs';
import {StackProps} from 'aws-cdk-lib';
import {Code, Function, Runtime} from 'aws-cdk-lib/aws-lambda';

export interface HelloProps extends StackProps {}

export class Hello extends Construct {
  constructor(scope: Construct, id: string) {
    super(scope, id);

    const helloFunction = new Function(this, 'HelloHandler', {
      runtime: Runtime.NODEJS_20_X,
      code: Code.fromAsset('lambda'),
      handler: 'hello.handler',
    });
  }
}
