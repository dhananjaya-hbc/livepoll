import * as cdk from 'aws-cdk-lib/core';
import { Template, Match } from 'aws-cdk-lib/assertions';
import { BackendStack } from '../lib/backend-stack';

let template: Template;

beforeAll(() => {
  const app = new cdk.App();
  const stack = new BackendStack(app, 'TestBackendStack', {
    env: { account: '123456789012', region: 'us-east-1' },
  });
  template = Template.fromStack(stack);
});

// The schema file is inlined into the synthesized template, so the auth
// directives that gate host-only operations can be asserted from here.
function schemaDefinition(): string {
  const schemas = template.findResources('AWS::AppSync::GraphQLSchema');
  const [schema] = Object.values(schemas);
  return schema.Properties.Definition as string;
}

// Directives sit on the line following the field they apply to.
function lineAfterField(field: string): string {
  const lines = schemaDefinition().split('\n');
  const index = lines.findIndex(
    (line) =>
      line.trim().startsWith(`${field}(`) || line.trim().startsWith(`${field}:`)
  );
  expect(index).toBeGreaterThan(-1);
  return lines[index + 1] ?? '';
}

describe('DynamoDB tables', () => {
  test('Polls table is keyed on pollId', () => {
    template.hasResourceProperties('AWS::DynamoDB::Table', {
      TableName: 'Polls',
      KeySchema: [{ AttributeName: 'pollId', KeyType: 'HASH' }],
    });
  });

  test('Polls table has a hostId GSI so listMyPolls avoids a table scan', () => {
    template.hasResourceProperties('AWS::DynamoDB::Table', {
      TableName: 'Polls',
      GlobalSecondaryIndexes: Match.arrayWith([
        Match.objectLike({
          IndexName: 'hostId-index',
          KeySchema: [
            { AttributeName: 'hostId', KeyType: 'HASH' },
            { AttributeName: 'createdAt', KeyType: 'RANGE' },
          ],
        }),
      ]),
    });
  });

  test('Votes table is keyed on voteId', () => {
    template.hasResourceProperties('AWS::DynamoDB::Table', {
      TableName: 'Votes',
      KeySchema: [{ AttributeName: 'voteId', KeyType: 'HASH' }],
    });
  });
});

describe('AppSync API', () => {
  test('defaults to API key auth with Cognito as an additional mode', () => {
    template.hasResourceProperties('AWS::AppSync::GraphQLApi', {
      AuthenticationType: 'API_KEY',
      AdditionalAuthenticationProviders: Match.arrayWith([
        Match.objectLike({ AuthenticationType: 'AMAZON_COGNITO_USER_POOLS' }),
      ]),
    });
  });

  test('the Votes table is wired as its own data source', () => {
    template.hasResourceProperties('AWS::AppSync::DataSource', {
      Name: 'VotesDataSource',
    });
  });

  test('submitVote is a pipeline that records the vote before incrementing', () => {
    template.hasResourceProperties('AWS::AppSync::Resolver', {
      TypeName: 'Mutation',
      FieldName: 'submitVote',
      Kind: 'PIPELINE',
      PipelineConfig: {
        Functions: [
          { 'Fn::GetAtt': [Match.stringLikeRegexp('RecordVoteFunction'), 'FunctionId'] },
          { 'Fn::GetAtt': [Match.stringLikeRegexp('IncrementVoteCountFunction'), 'FunctionId'] },
        ],
      },
    });
  });

  test.each([
    ['Query', 'getPoll'],
    ['Query', 'listMyPolls'],
    ['Mutation', 'createPoll'],
    ['Mutation', 'submitVote'],
    ['Mutation', 'closePoll'],
  ])('has a resolver wired to %s.%s', (typeName, fieldName) => {
    template.hasResourceProperties('AWS::AppSync::Resolver', {
      TypeName: typeName,
      FieldName: fieldName,
    });
  });
});

describe('schema authorization', () => {
  test.each(['createPoll', 'closePoll', 'listMyPolls'])(
    '%s requires a Cognito session',
    (field) => {
      expect(lineAfterField(field)).toContain('@aws_cognito_user_pools');
    }
  );

  test.each(['getPoll', 'submitVote'])(
    '%s stays open to anonymous API-key callers',
    (field) => {
      expect(lineAfterField(field)).not.toContain('@aws_cognito_user_pools');
    }
  );
});
