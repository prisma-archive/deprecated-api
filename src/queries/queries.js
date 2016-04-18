/* @flow */

import {
  GraphQLNonNull,
  GraphQLID
} from 'graphql'

import type {
  AllTypes,
  GraphQLFields
} from '../utils/definitions.js'

import {
  fromGlobalId
} from 'graphql-relay'

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
      resolve: (_, args, { operation, rootValue: { currentUser, backend } }) => {
        const { id } = fromGlobalId(args.id)
        return backend.node(modelName, id, clientTypes[modelName].clientSchema, currentUser, operation)
      }
    }
  }

  queryFields['viewer'] = {
    type: viewerType,
    resolve: (_, args, { rootValue: { backend } }) => (
      backend.user()
    )
  }

  queryFields['node'] = {
    name: 'node',
    description: 'Fetches an object given its ID',
    type: input.NodeInterfaceType,
    args: {
      id: {
        type: new GraphQLNonNull(GraphQLID),
        description: 'The ID of an object'
      }
    },
    resolve: (obj, {id}, { operation, rootValue: { currentUser, backend } }) => {
      const {id: internalId, type} = fromGlobalId(id)

      return backend.node(type, internalId, clientTypes[type].clientSchema, currentUser, operation)
      .then((node) => {
        return node
      })
    }
  }

  return queryFields
}
