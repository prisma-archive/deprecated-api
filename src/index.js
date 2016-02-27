/* @flow */

import {
  GraphQLSchema,
  GraphQLObjectType
} from 'graphql'

import {
  createTypes
} from './types/types.js'

import {
  createQueryEndpoints
} from './queries/queries.js'

import {
  createMutationEndpoints
} from './mutations/mutations.js'

import type {
  ClientSchema,
  ClientTypes
} from './utils/definitions.js'

export function generateSchema (clientSchemas: Array<ClientSchema>): GraphQLSchema {
  // create types from client schemas
  const clientTypes: ClientTypes = createTypes(clientSchemas)

  // generate query endpoints
  const queryFields = createQueryEndpoints(clientTypes)

  // generate mutation endpoints
  const mutationFields = createMutationEndpoints(clientTypes)

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
