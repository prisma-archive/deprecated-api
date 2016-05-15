/* @flow */

import type {
  ClientTypes,
  SchemaType
} from '../utils/definitions.js'

import {
  GraphQLObjectType
} from 'graphql'

import {
  mutationWithClientMutationId,
  cursorForObjectInConnection
} from 'graphql-relay'

import { 
  getFieldNameFromModelName,
  convertInputFieldsToInternalIds,
  convertIdToExternal } from '../utils/graphql.js'

import simpleMutation from './simpleMutation.js'

export default function (
  viewerType: GraphQLObjectType, clientTypes: ClientTypes, modelName: string, schemaType: SchemaType
  ): GraphQLObjectType {
  const config = {
    name: `Update${modelName}`,
    outputFields: {
      [getFieldNameFromModelName(modelName)]: {
        type: clientTypes[modelName].objectType,
        resolve: (root) => root.node
      },
      viewer: {
        type: viewerType,
        resolve: (_, args, { rootValue: { backend } }) => (
          backend.user()
        )
      },
      edge: {
        type: clientTypes[modelName].edgeType,
        resolve: (root, args, { rootValue: { currentUser, backend } }) =>
        backend.allNodesByType(modelName, args, clientTypes[modelName].clientSchema, currentUser)
        .then(({array}) => {
          return ({
            // todo: getting all nodes is not efficient
            cursor: cursorForObjectInConnection(array, array.filter((x) => x.id === root.node.id)[0]),
            node: root.node
          })
        })
      }
    },
    inputFields: clientTypes[modelName].updateMutationInputArguments,
    mutateAndGetPayload: (node, { rootValue: { currentUser, backend, webhooksProcessor } }) => {
      // todo: currently we don't handle setting a relation to null. Use removeXfromConnection instead
      node = convertInputFieldsToInternalIds(node, clientTypes[modelName].clientSchema)

      return backend.node(
        modelName,
        node.id,
        clientTypes[modelName].clientSchema,
        currentUser)
      .then((oldNode) => {
        if (oldNode === null) {
          return Promise.reject(`'No ${modelName}' with id '${node.id}' exists`)
        }

        return backend.updateNode(modelName, node.id, node, clientTypes[modelName].clientSchema, currentUser)
        .then((node) => {
          webhooksProcessor.nodeUpdated(convertIdToExternal(modelName, node), modelName)
          return {node}
        })
      })
    }
  }

  if (schemaType === 'SIMPLE') {
    return simpleMutation(config, clientTypes[modelName].objectType, (root) => root.node)
  } else {
    return mutationWithClientMutationId(config)
  }
}
