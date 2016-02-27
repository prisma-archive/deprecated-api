import express from 'express'
import graphqlHTTP from 'express-graphql'
import { graphql } from 'graphql'
import { introspectionQuery } from 'graphql/utilities'
 import { generateSchema } from 'graphcool-api'
//import { generateSchema } from '../../src'
import clientSchemas from './mock/schemas.json'
import database from './mock/data.json'

const backend = {
  node: (id) => (
    new Promise((resolve, reject) => {
      for (const modelName in database) {
        if (database[modelName][id]) {
          return resolve(database[modelName][id])
        }
      }
      reject()
    })
  ),
  allNodesByType: (type, args) => (
    new Promise((resolve, reject) => {
      if (database[type]) {
        resolve(Object.values(database[type]))
      }
      reject()
    })
  ),
  allNodesByRelation: (parentId, relationFieldName, args) => (
    new Promise((resolve, reject) => resolve([]))
  )
}

const fetchTypes = () => new Promise((resolve, reject) => resolve(clientSchemas))

const app = express()

app.get('/schema.json', (req, res) => {
  fetchTypes()
    .then((clientSchemas) => generateSchema(clientSchemas))
    .then((schema) => graphql(schema, introspectionQuery))
    .then((result) => res.send(JSON.stringify(result, null, 2)))
})

app.use('/', graphqlHTTP((req) => (
  fetchTypes()
    .then((clientSchemas) => generateSchema(clientSchemas))
    .then((schema) => ({
      schema,
      rootValue: { backend },
      graphiql: true,
      pretty: true
    }))
    .catch((error) => console.error(error.stack))
)))

const APP_PORT = parseInt(process.env.PORT || 60000)
app.listen(APP_PORT)
console.log('API listening on port ' + APP_PORT)
