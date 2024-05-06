#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import {CdkStack} from '../lib/cdk-stack';

const app = new cdk.App();
new CdkStack(app, 'CdkStack', {
  vpcId: 'vpc-09186ce91104e20c6',
  availabilityZones: ['us-west-2b', 'us-west-2a'],
  privateSubnetIds: ['subnet-0ca25478c2d35b8e4', 'subnet-094a6a1daa32e3a52'],
  keyArn:
    'arn:aws:kms:us-west-2:825434587220:key/mrk-7a27a6cf08124ca6b01ed91e476aeb0f',

  /* If you don't specify 'env', this stack will be environment-agnostic.
   * Account/Region-dependent features and context lookups will not work,
   * but a single synthesized template can be deployed anywhere. */
  /* Uncomment the next line to specialize this stack for the AWS Account
   * and Region that are implied by the current CLI configuration. */
  // env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: process.env.CDK_DEFAULT_REGION },
  /* Uncomment the next line if you know exactly what Account and Region you
   * want to deploy the stack to. */
  // env: { account: '123456789012', region: 'us-east-1' },
  /* For more information, see https://docs.aws.amazon.com/cdk/latest/guide/environments.html */
});
