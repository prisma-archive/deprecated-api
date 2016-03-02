/* @flow */

import {
  GraphQLNonNull,
  GraphQLID,
  GraphQLObjectType
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
  const viewerFields = {}

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
        backend.node(modelName, args.id)
      )
    }

    // query connection for model
    // curerntly relay does not support connections on the root query. They will fix this eventually
    // adding a viewer node is the suggested workaround https://github.com/facebook/relay/issues/112
    viewerFields[`all${modelName}s`] = {
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

  queryFields['viewer'] = {
    type: new GraphQLObjectType({
      name: 'Viewer',
      fields: viewerFields
    }),
    resolve: () => ({})
  }

  return queryFields
}
