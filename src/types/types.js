/* @flow */

import {
  GraphQLString,
  GraphQLInt,
  GraphQLFloat,
  GraphQLBoolean,
  GraphQLID,
  GraphQLObjectType,
  GraphQLNonNull,
  GraphQLInterfaceType
} from 'graphql'

import {
  connectionDefinitions,
  connectionArgs,
  connectionFromArray
} from 'graphql-relay'

import {
  mapArrayToObject
} from '../utils/array.js'

import type {
  ClientSchema,
  ClientSchemaField,
  ClientTypes,
  GraphQLFields
} from '../utils/definitions.js'

function parseClientType (typeName: string) {
  switch (typeName) {
    case 'String': return GraphQLString
    case 'Boolean': return GraphQLBoolean
    case 'Int': return GraphQLInt
    case 'Float': return GraphQLFloat
    case 'GraphQLID': return GraphQLID
    // NOTE this marks a relation type which will be overwritten by `injectRelationships`
    default: return { __isRelation: true, typeName }
  }
}

function generateObjectType (
  clientSchema: ClientSchema,
  NodeInterfaceType: GraphQLInterfaceType
): GraphQLObjectType {
  const graphQLFields: GraphQLFields = mapArrayToObject(
    clientSchema.fields,
    (field) => field.fieldName,
    (field) => ({
      type: parseClientType(field.typeName),
      resolve: (obj) => obj[field.fieldName]
    })
  )

  return new GraphQLObjectType({
    name: clientSchema.modelName,
    fields: graphQLFields,
    interfaces: [NodeInterfaceType]
  })
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
      const typeName = objectTypeField.type.typeName

      // 1:n relationship
      if (objectTypeField.list) {
        const connectionType = allClientTypes[typeName].connectionType
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
      // 1:1 relationship
      } else {
        objectTypeField.type = allClientTypes[typeName].objectType
        objectTypeField.resolve = (obj, args, { rootValue: { backend } }) => (
          backend.node(obj[`${fieldName}ID`])
        )
      }
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

export function createTypes (clientSchemas: Array<ClientSchema>): ClientTypes {
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

  return clientTypes
}
