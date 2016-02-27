/* @flow */

import {
  GraphQLNonNull,
  GraphQLID
} from 'graphql'

import {
  connectionArgs,
  connectionFromArray
} from 'graphql-relay'

import type {
  ClientTypes,
  GraphQLFields
} from '../utils/definitions.js'

export function createQueryEndpoints (
  clientTypes: ClientTypes
): GraphQLFields {
  const queryFields = {}

  for (const modelName in clientTypes) {
    // query single model by id
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

    // query connection for model
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

  return queryFields
}
