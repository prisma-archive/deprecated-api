import express from 'express'
import graphqlHTTP from 'express-graphql'
import { generateSchema } from './api'
import mockData from './mock.json'

const app = express()

const fetchTypes = (appId) => {
  return new Promise((resolve, reject) => {
    resolve(mockData)
  })
}

app.use('/graphql/:appId', graphqlHTTP((request) => (
  fetchTypes(request.params.appId)
    .then(generateSchema)
    .then((schema) => ({
      schema,
      rootValue: { request },
      graphiql: true,
      formatError: (error) => error,
      pretty: true
    }))
    .catch(console.log)
)))

const APP_PORT = parseInt(process.env.PORT || 60000)
app.listen(APP_PORT)
console.log('API listening on port ' + APP_PORT)
