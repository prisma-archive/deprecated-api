/* @flow */

import {
  GraphQLString,
  GraphQLInt,
  GraphQLFloat,
  GraphQLBoolean,
  GraphQLID,
  GraphQLObjectType,
  GraphQLInterfaceType
} from 'graphql'

import {
  mapArrayToObject
} from '../utils/array.js'

import type {
  ClientSchema,
  GraphQLFields
} from './types.js'

function parseClientType (typeName: string) {
  switch (typeName) {
    case 'String': return GraphQLString
    case 'Boolean': return GraphQLBoolean
    case 'Int': return GraphQLInt
    case 'Float': return GraphQLFloat
    case 'GraphQLID': return GraphQLID
    default: return { __isRelation: true, typeName }
  }
}

export function generateObjectType (
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
    name: `${clientSchema.modelName}`,
    fields: graphQLFields,
    interfaces: [ NodeInterfaceType ]
  })
}
