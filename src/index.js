/* @flow */

import {
  mapArrayToObject
} from './utils/array.js'

import {
  GraphQLSchema,
  GraphQLObjectType,
  GraphQLInterfaceType,
  GraphQLBoolean,
  GraphQLInt,
  GraphQLNonNull,
  GraphQLID
} from 'graphql'

import {
  connectionDefinitions,
  connectionArgs,
  connectionFromArray
} from 'graphql-relay'

import {
  generateObjectType
} from './schema/helper.js'

import type {
  ClientSchema,
  ClientSchemaField
} from './schema/types.js'

type ClientTypes = {
  [key: string]: {
    objectType: GraphQLObjectType,
    edgeType: GraphQLObjectType,
    connectionType: GraphQLObjectType,
    clientSchema: ClientSchema
  }
}

function injectRelationships (
  objectType: GraphQLObjectType,
  clientSchema: ClientSchema,
  allClientTypes: ClientTypes
): void {
  const objectTypeFields = objectType._typeConfig.fields

  clientSchema.fields
    .filter((field) => objectTypeFields[field.fieldName].type.__isRelation)
    .forEach((clientSchemaField: ClientSchemaField) => {
      const fieldName = clientSchemaField.fieldName
      const objectTypeField = objectTypeFields[fieldName]

      if (objectTypeField.list) { // 1:n relationship
        const connectionType = allClientTypes[objectTypeField.type.typeName].connectionType
        objectTypeField.type = connectionType
        objectTypeField.args = connectionArgs
        objectTypeField.resolve = (obj, args, { rootValue: { backend } }) => (
          backend.allNodesByRelation(obj.id, fieldName, args)
            .then((array) => {
              const { edges, pageInfo } = connectionFromArray(array, args)
              return {
                edges,
                pageInfo,
                totalCount: 0
              }
            })
        )
      } else { // 1:1 relationship
        objectTypeField.type = allClientTypes[objectTypeField.type.typeName].objectType
        objectTypeField.resolve = (obj, args, { rootValue: { backend } }) => (
          backend.nodeById(obj[`${fieldName}ID`])
        )
      }

      delete objectTypeField.__isUserType
      delete objectTypeField.typeName
    })
}

function wrapWithNonNull (
  objectType: GraphQLObjectType,
  clientSchema: ClientSchema
): void {
  clientSchema.fields
    .filter((field) => !field.nullable)
    .forEach((clientSchemaField: ClientSchemaField) => {
      const fieldName = clientSchemaField.fieldName
      const objectTypeField = objectType._typeConfig.fields[fieldName]
      objectTypeField.type = new GraphQLNonNull(objectTypeField.type)
    })
}

export function generateSchema (clientSchemas: Array<ClientSchema>): GraphQLSchema {
  const clientTypes: ClientTypes = {}

  const NodeInterfaceType = new GraphQLInterfaceType({
    name: 'NodeInterface',
    fields: () => ({
      id: { type: GraphQLID }
    }),
    resolveType: (node) => {
      console.log(node)
      return GraphQLBoolean
    }
  })

  // generate object types without relationships properties since we need all of the object types first
  mapArrayToObject(
    clientSchemas,
    (clientSchema) => clientSchema.modelName,
    (clientSchema) => {
      const objectType = generateObjectType(clientSchema, NodeInterfaceType)
      const { connectionType, edgeType } = connectionDefinitions({
        name: clientSchema.modelName,
        nodeType: objectType,
        connectionFields: () => ({
          totalCount: {
            type: GraphQLInt,
            resolve: (conn) => conn.totalCount
          }
        })
      })
      return { clientSchema, objectType, connectionType, edgeType }
    },
    clientTypes
  )

  // set relationship properties
  for (const modelName in clientTypes) {
    injectRelationships(
      clientTypes[modelName].objectType,
      clientTypes[modelName].clientSchema,
      clientTypes
    )
  }

  // set nullable properties
  for (const modelName in clientTypes) {
    wrapWithNonNull(
      clientTypes[modelName].objectType,
      clientTypes[modelName].clientSchema
    )
  }

  // generate query endpoints
  const queryFields = {}
  for (const modelName in clientTypes) {
    queryFields[modelName] = {
      type: clientTypes[modelName].objectType,
      args: {
        id: {
          type: new GraphQLNonNull(GraphQLID)
        }
      },
      resolve: (_, args, { rootValue: { backend } }) => (
        backend.node(args.id)
      )
    }
    queryFields[`all${modelName}s`] = {
      type: clientTypes[modelName].connectionType,
      args: connectionArgs,
      resolve: (_, args, { rootValue: { backend } }) => (
        backend.allNodesByType(modelName, args)
          .then((array) => {
            const { edges, pageInfo } = connectionFromArray(array, args)
            return {
              edges,
              pageInfo,
              totalCount: 0
            }
          })
      )
    }
  }

  // generate mutation endpoints
  const mutationFields = {
    viewer: {
      type: GraphQLBoolean
    }
  }

  return new GraphQLSchema({
    query: new GraphQLObjectType({
      name: 'RootQueryType',
      fields: queryFields
    }),
    mutation: new GraphQLObjectType({
      name: 'RootMutationType',
      fields: mutationFields
    })
  })
}
