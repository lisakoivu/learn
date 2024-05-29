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
