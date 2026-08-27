// The only hand-written Lambda in this project. Every user-facing operation is a
// direct AppSync-to-DynamoDB VTL resolver, because each one is a request/response
// call AppSync can serve without a function. Closing expired polls is different:
// it is a background job on a timer, with no incoming request to attach a
// resolver to — which is exactly what Lambda is for.
//
// Note this deliberately does NOT use DynamoDB's native TTL. TTL *deletes* items,
// and an expired poll should stay readable with its results intact, just closed
// to new votes.
//
// This sweep is not the enforcement mechanism: submitVote's conditional write
// already rejects votes on an expired poll. This job exists so the stored status
// catches up with reality, rather than leaving polls that read as "open".
import {
  ConditionalCheckFailedException,
  DynamoDBClient,
  QueryCommand,
  UpdateItemCommand,
  type AttributeValue,
} from '@aws-sdk/client-dynamodb';

const client = new DynamoDBClient({});

const TABLE_NAME = process.env.TABLE_NAME!;
const INDEX_NAME = process.env.INDEX_NAME!;

interface SweepResult {
  closed: number;
  skipped: number;
}

export const handler = async (): Promise<SweepResult> => {
  const now = String(Math.floor(Date.now() / 1000));
  let startKey: Record<string, AttributeValue> | undefined;
  let closed = 0;
  let skipped = 0;

  do {
    const page = await client.send(
      new QueryCommand({
        TableName: TABLE_NAME,
        IndexName: INDEX_NAME,
        KeyConditionExpression: '#status = :open AND expiresAt <= :now',
        ExpressionAttributeNames: { '#status': 'status' },
        ExpressionAttributeValues: {
          ':open': { S: 'open' },
          ':now': { N: now },
        },
        ExclusiveStartKey: startKey,
      })
    );

    for (const item of page.Items ?? []) {
      try {
        await client.send(
          new UpdateItemCommand({
            TableName: TABLE_NAME,
            Key: { pollId: item.pollId },
            UpdateExpression: 'SET #status = :closed',
            // Re-check the status: the host may have closed it since the query ran.
            ConditionExpression: '#status = :open',
            ExpressionAttributeNames: { '#status': 'status' },
            ExpressionAttributeValues: {
              ':closed': { S: 'closed' },
              ':open': { S: 'open' },
            },
          })
        );
        closed += 1;
      } catch (error) {
        if (error instanceof ConditionalCheckFailedException) {
          skipped += 1;
        } else {
          throw error;
        }
      }
    }

    startKey = page.LastEvaluatedKey;
  } while (startKey);

  console.log(`Closed ${closed} expired poll(s); skipped ${skipped} already closed.`);
  return { closed, skipped };
};
