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
  mapToObject
} from '../lib/utils'

import type {
  ClientSchema
} from './types'

function mapClientType (typeName: string) {
  switch (typeName) {
    case 'String': return GraphQLString
    case 'Boolean': return GraphQLBoolean
    case 'Int': return GraphQLInt
    case 'Float': return GraphQLFloat
    case 'GraphQLID': return GraphQLID
    default: return { __isUserType: true, typeName }
  }
}

export const generateObjectType = (clientSchema: ClientSchema, NodeInterfaceType: GraphQLInterfaceType): GraphQLObjectType => {
  const graphQLFields = mapToObject(
    clientSchema.fields,
    (field) => field.name,
    (field) => ({
      type: mapClientType(field.typeName),
      // TODO check me
      resolve: (obj) => obj[field.name]
    })
  )

  return new GraphQLObjectType({
    name: `${clientSchema.name}`,
    fields: graphQLFields,
    interfaces: [ NodeInterfaceType ]
  })
}
