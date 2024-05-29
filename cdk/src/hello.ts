import {App, Stack, StackProps} from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';

export interface HelloStackProps extends StackProps{}
export class Hello extends Stack {
  constructor(scope: App, id: string, props?: HelloStackProps) {
    super(scope, id, props);

    // defines an AWS Lambda resource
    const hello = new lambda.Function(this, 'HelloHandler', {
      runtime: lambda.Runtime.NODEJS_20_X, // execution environment
      code: lambda.Code.fromAsset('src'), // code loaded from "lambda" directory
      handler: 'hello.handler', // file is "hello", function is "handler"
    });
  }
}
