import express from 'express'
import graphqlHTTP from 'express-graphql'
import { graphql } from 'graphql'
import { introspectionQuery } from 'graphql/utilities'
// import { generateSchema } from 'graphcool-api'
import { generateSchema } from '../../src'
import clientSchemas from './mock/schemas.json'
import database from './mock/data.json'
import cuid from 'cuid'

const getNode = (type, id) => (
  database[type][id]
    ? Promise.resolve(database[type][id])
    : Promise.reject(`no ${type} exists with id ${id}`)
)
const backend = {
  node: getNode,
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
  ),

  createNode: (type, node) => (
    new Promise((resolve, reject) => {
      node.id = cuid()
      database[type][node.id] = node;

      resolve(node)
    })
  ),
  updateNode: (type, id, newNode) => (
    getNode(type, id).then(node => {
      Object.keys(newNode).forEach(key => {
        if(key != "clientMutationId"){
          node[key] = newNode[key]
        }
      })
      database[type][id] = node;

      return node
    })
  ),
  deleteNode: (type, id) => (
    new Promise((resolve, reject) => {
      const node = database[type][id]
      delete database[type][id];

      resolve(node)
    })
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
