/* @flow */

import _ from 'lodash'

import {
  mapToObject
} from '../lib/utils'

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
} from './helper'

import type {
  ClientSchema,
  ClientSchemaField
} from './types'

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
) {
  const objectTypeFields = objectType._typeConfig.fields

  clientSchema.fields
  // FIX THIS
    .filter((field) => objectTypeFields[field.name].__isUserType)
    .forEach((clientSchemaField: ClientSchemaField) => {
      console.log('jooooo');
      const fieldName = clientSchemaField.name
      const objectTypeField = objectType._typeConfig.fields[fieldName]

      if (objectTypeField.list) { // 1:n relationship
        const connectionType = allClientTypes[objectTypeField.typeName].connectionType
        objectTypeField.type = connectionType
        objectTypeField.args = connectionArgs
        objectTypeField.resolve = (_, args) => {
          // TODO implement me
          const { edges, pageInfo } = connectionFromArray([], args)
          return {
            edges,
            pageInfo,
            totalCount: 0
          }
        }
      } else { // 1:1 relationship
        objectTypeField.type = allClientTypes[objectTypeField.typeName].objectType
        objectTypeField.resolve = () => {
          // TODO implement me
          return {}
        }
      }

      delete(objectTypeField.__isUserType)
      delete(objectTypeField.typeName)
    })
}

function injectNonNull (
  objectType: GraphQLObjectType,
  clientSchema: ClientSchema
) {
  const objectTypeFields = objectType._typeConfig.fields

  clientSchema.fields
    .filter((field) => !field.nullable)
    .forEach((clientSchemaField: ClientSchemaField) => {
      const fieldName = clientSchemaField.name
      const objectTypeField = objectType._typeConfig.fields[fieldName]
      objectTypeField.type = new GraphQLNonNull(objectTypeField.type)
    })
}

export const generateSchema = (clientSchemas: Array<ClientSchema>): GraphQLSchema => {

  const NodeInterfaceType = new GraphQLInterfaceType({
    name: 'NodeInterface',
    fields: () => ({
      id: { type: GraphQLID }
    }),
    resolveType: (node) => {
      console.log(node);
      return GraphQLBoolean
      // return userTypes[node.type.split(':')[1]];
    }
  })

  // generate object types without relationships properties
  const clientTypes: ClientTypes = mapToObject(
    clientSchemas,
    (clientSchema) => clientSchema.name,
    (clientSchema) => {
      const objectType = generateObjectType(clientSchema, NodeInterfaceType)
      const { connectionType, edgeType } = connectionDefinitions({
        name: clientSchema.name,
        nodeType: objectType,
        connectionFields: () => ({
          totalCount: {
            type: GraphQLInt,
            resolve: (conn) => conn.totalCount
          }
        })
      })
      return { clientSchema, objectType, connectionType, edgeType }
    }
  )

  // set relationship properties
  for (const schemaName in clientTypes) {
    injectRelationships(
      clientTypes[schemaName].objectType,
      clientTypes[schemaName].clientSchema,
      clientTypes
    )
  }

  // set nullable properties
  for (const schemaName in clientTypes) {
    injectNonNull(
      clientTypes[schemaName].objectType,
      clientTypes[schemaName].clientSchema
    )
  }

  // generate query endpoints
  const queryFields = {}
  for (const schemaName in clientTypes) {
    queryFields[schemaName] = {
      type: clientTypes[schemaName].objectType,
      args: {
        id: {
          type: new GraphQLNonNull(GraphQLID)
        }
      },
      resolve: () => ({
      })
    }
    queryFields[`all${schemaName}s`] = {
      type: clientTypes[schemaName].connectionType,
      args: connectionArgs,
      resolve: (_, args) => {
        // TODO implement me
        const { edges, pageInfo } = connectionFromArray([], args)
        return {
          edges,
          pageInfo,
          totalCount: 0
        }
      }
    }
  }

  // generate mutation endpoints

  return new GraphQLSchema({
    query: new GraphQLObjectType({
      name: 'RootQueryType',
      fields: queryFields
    }),
    mutation: new GraphQLObjectType({
      name: 'RootMutationType',
      fields: {
        viewer: {
          type: GraphQLBoolean
        }
      }
    })
  })
}

//export const createRoot = () => {

  //const queryFields = createQueryFields()
  //const mutationFields = createMudationFields()

  //return new GraphQLSchema({
    //query: new GraphQLObjectType({
      //name: 'RootQueryType',
      //fields: queryFields
    //}),
    //mutation: new GraphQLObjectType({
      //name: 'RootMutationType',
      //fields: mutationFields
    //})
  //})
//}
