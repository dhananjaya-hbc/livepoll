import * as cdk from 'aws-cdk-lib/core';
import { Construct } from 'constructs';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';

export class BackendStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // DynamoDB table to store polls
    const pollsTable = new dynamodb.Table(this, 'PollsTable', {
      tableName: 'Polls',
      partitionKey: { name: 'pollId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST, // no capacity planning needed, free-tier friendly
      removalPolicy: cdk.RemovalPolicy.DESTROY, // deletes table when we destroy the stack (fine for a learning project)
    });
  }
}