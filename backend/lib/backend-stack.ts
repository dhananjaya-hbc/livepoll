import * as cdk from 'aws-cdk-lib/core';
import { Construct } from 'constructs';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as appsync from 'aws-cdk-lib/aws-appsync';
import * as path from 'path';
import * as cognito from 'aws-cdk-lib/aws-cognito';

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
    // Cognito User Pool for host authentication
    const userPool = new cognito.UserPool(this, 'LivePollUserPool', {
      userPoolName: 'LivePollUsers',
      selfSignUpEnabled: true,
      signInAliases: { email: true },
      autoVerify: { email: true },
      passwordPolicy: {
        minLength: 8,
        requireLowercase: true,
        requireUppercase: false,
        requireDigits: true,
        requireSymbols: false,
      },
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    const userPoolClient = new cognito.UserPoolClient(this, 'LivePollUserPoolClient', {
      userPool,
      authFlows: { userPassword: true, userSrp: true },
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
        additionalAuthorizationModes: [
          {
            authorizationType: appsync.AuthorizationType.USER_POOL,
            userPoolConfig: { userPool },
          },
        ],
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
          .attribute('hostId').is('$ctx.identity.sub')
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

        // Resolver: closePoll mutation — only the poll's creator can close it
    pollsDataSource.createResolver('ClosePollResolver', {
      typeName: 'Mutation',
      fieldName: 'closePoll',
      requestMappingTemplate: appsync.MappingTemplate.fromFile(
        path.join(__dirname, '../resolvers/closePoll.req.vtl')
      ),
      responseMappingTemplate: appsync.MappingTemplate.fromFile(
        path.join(__dirname, '../resolvers/closePoll.res.vtl')
      ),
    });

    // Output the API URL and Key so they're easy to find after each deploy
    new cdk.CfnOutput(this, 'GraphQLApiUrl', {
      value: api.graphqlUrl,
    });

    new cdk.CfnOutput(this, 'GraphQLApiKey', {
      value: api.apiKey || '',
    });

    new cdk.CfnOutput(this, 'UserPoolId', {
      value: userPool.userPoolId,
    });

    new cdk.CfnOutput(this, 'UserPoolClientId', {
      value: userPoolClient.userPoolClientId,
    });
  }
}