/* @flow */

import {
  GraphQLNonNull,
  GraphQLID
} from 'graphql'

import type {
  AllTypes,
  GraphQLFields
} from '../utils/definitions.js'

export function createQueryEndpoints (
  input: AllTypes
): GraphQLFields {
  const queryFields = {}
  const clientTypes = input.clientTypes
  const viewerType = input.viewerType

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
  }

  queryFields['viewer'] = {
    type: viewerType,
    resolve: (_, args, { rootValue: { backend } }) => (
      backend.user()
    )
  }

  return queryFields
}
