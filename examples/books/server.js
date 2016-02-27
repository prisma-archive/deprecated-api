import express from 'express'
import graphqlHTTP from 'express-graphql'
import { graphql } from 'graphql'
import { introspectionQuery } from 'graphql/utilities'
import { generateSchema } from 'graphcool-api'
import mockData from './database.json'

const backend = {}

const fetchTypes = (appId) => new Promise((resolve, reject) => resolve(mockData))

const app = express()

app.use('/', graphqlHTTP((req) => (
  fetchTypes(req.params.appId)
    .then(generateSchema)
    .then((schema) => ({
      schema,
      rootValue: { backend },
      graphiql: true,
      pretty: true
    }))
    .catch(console.log)
)))

app.get('/schema.json', (req, res) => {
  fetchTypes(req.params.appId)
    .then(generateSchema)
    .then((schema) => graphql(schema, introspectionQuery))
    .then((result) => res.send(JSON.stringify(result, null, 2)))
})

const APP_PORT = parseInt(process.env.PORT || 60000)
app.listen(APP_PORT)
console.log('API listening on port ' + APP_PORT)
