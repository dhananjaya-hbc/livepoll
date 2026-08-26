export const amplifyConfig = {
  Auth: {
    Cognito: {
      userPoolId: 'us-east-1_ADL42rErB',
      userPoolClientId: 'mkcvp3g9vlq2kmn3phlrvjjv8',
    },
  },
  API: {
    GraphQL: {
      endpoint: 'https://esvvzyh4vbagfc2fqub3uxhtnm.appsync-api.us-east-1.amazonaws.com/graphql',
      region: 'us-east-1',
      defaultAuthMode: 'apiKey',
      apiKey: 'da2-yf3dc3an75bupm3stcyfh4t5ru',
    },
  },
}