import * as cdk from 'aws-cdk-lib/core';
import { Construct } from 'constructs';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as appsync from 'aws-cdk-lib/aws-appsync';
import * as path from 'path';

export class BackendStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // DynamoDB table to store polls
    const pollsTable = new dynamodb.Table(this, 'PollsTable', {
      tableName: 'Polls',
      partitionKey: { name: 'pollId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // DynamoDB table to store individual votes (audit/analytics log)
    const votesTable = new dynamodb.Table(this, 'VotesTable', {
      tableName: 'Votes',
      partitionKey: { name: 'voteId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // AppSync GraphQL API
    const api = new appsync.GraphqlApi(this, 'LivePollApi', {
      name: 'LivePollApi',
      definition: appsync.Definition.fromFile(
        path.join(__dirname, '../graphql/schema.graphql')
      ),
      authorizationConfig: {
        defaultAuthorization: {
          authorizationType: appsync.AuthorizationType.API_KEY,
        },
      },
    });

    // Connect the Polls table as a data source
    const pollsDataSource = api.addDynamoDbDataSource(
      'PollsDataSource',
      pollsTable
    );

    // Resolver: getPoll query — fetch a single poll by pollId
    pollsDataSource.createResolver('GetPollResolver', {
      typeName: 'Query',
      fieldName: 'getPoll',
      requestMappingTemplate: appsync.MappingTemplate.dynamoDbGetItem(
        'pollId',
        'pollId'
      ),
      responseMappingTemplate: appsync.MappingTemplate.dynamoDbResultItem(),
    });

        // Resolver: createPoll mutation — creates a new poll with a generated ID
    pollsDataSource.createResolver('CreatePollResolver', {
      typeName: 'Mutation',
      fieldName: 'createPoll',
      requestMappingTemplate: appsync.MappingTemplate.dynamoDbPutItem(
        appsync.PrimaryKey.partition('pollId').auto(),
        appsync.Values.projecting()
          .attribute('hostId').is('"anonymous-host"')
          .attribute('question').is('$ctx.args.question')
          .attribute('options').is('$ctx.args.options')
          .attribute('voteCounts').is('{}')
          .attribute('status').is('"open"')
          .attribute('createdAt').is('$util.time.nowEpochSeconds()')
      ),
      responseMappingTemplate: appsync.MappingTemplate.dynamoDbResultItem(),
    });

        // Resolver: submitVote mutation — atomically increments vote count for an option
    pollsDataSource.createResolver('SubmitVoteResolver', {
      typeName: 'Mutation',
      fieldName: 'submitVote',
      requestMappingTemplate: appsync.MappingTemplate.fromFile(
        path.join(__dirname, '../resolvers/submitVote.req.vtl')
      ),
      responseMappingTemplate: appsync.MappingTemplate.fromFile(
        path.join(__dirname, '../resolvers/submitVote.res.vtl')
      ),
    });
    
        // Output the API URL and Key so they're easy to find after each deploy
    new cdk.CfnOutput(this, 'GraphQLApiUrl', {
      value: api.graphqlUrl,
    });

    new cdk.CfnOutput(this, 'GraphQLApiKey', {
      value: api.apiKey || '',
    });
  }
}