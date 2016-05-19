/* @flow */
import deepcopy from 'deepcopy'

import type {
  ClientTypes,
  SchemaType
} from '../utils/definitions.js'

import {
  isScalar
} from '../utils/graphql.js'

import {
  GraphQLNonNull,
  GraphQLID,
  GraphQLObjectType
} from 'graphql'

import {
  mutationWithClientMutationId,
  toGlobalId
} from 'graphql-relay'

import simpleMutation from './simpleMutation.js'

import {
  getFieldNameFromModelName,
  convertInputFieldsToInternalIds,
  convertIdToExternal } from '../utils/graphql.js'

export default function (
  viewerType: GraphQLObjectType, clientTypes: ClientTypes, modelName: string, schemaType: SchemaType
  ): GraphQLObjectType {
  const config = {
    name: `Delete${modelName}`,
    outputFields: {
      [getFieldNameFromModelName(modelName)]: {
        type: clientTypes[modelName].objectType
      },
      deletedId: {
        type: new GraphQLNonNull(GraphQLID)
      },
      viewer: {
        type: viewerType,
        resolve: (_, args, { rootValue: { backend } }) => (
          backend.user()
        )
      }
    },
    inputFields: {
      id: {
        type: new GraphQLNonNull(GraphQLID)
      }
    },
    mutateAndGetPayload: (args, { rootValue: { currentUser, backend, webhooksProcessor } }) => {
      const node = convertInputFieldsToInternalIds(args, clientTypes[modelName].clientSchema)

      return backend.node(
          modelName,
          node.id,
          clientTypes[modelName].clientSchema,
          currentUser)
        .then((nodeToDelete) => {
          if (nodeToDelete === null) {
            return Promise.reject(`'${modelName}' with id '${node.id}' does not exist`)
          }

          return backend.deleteNode(modelName, node.id, clientTypes[modelName].clientSchema, currentUser)
            .then((node) => {
              webhooksProcessor.nodeDeleted(convertIdToExternal(modelName, node), modelName)
              return node
            })
            .then((node) => ({[getFieldNameFromModelName(modelName)]: node, deletedId: args.id}))
        })
    }
  }

  if (schemaType === 'SIMPLE') {
    return simpleMutation(config,
      clientTypes[modelName].objectType,
      (root) => root[getFieldNameFromModelName(modelName)])
  } else {
    return mutationWithClientMutationId(config)
  }
}
