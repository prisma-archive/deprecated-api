/* @flow */

import {
  GraphQLID,
  GraphQLNonNull
} from 'graphql'

import {
  mutationWithClientMutationId,
  cursorForObjectInConnection,
  offsetToCursor
} from 'graphql-relay'

import type {
  GraphQLFields,
  AllTypes
} from '../utils/definitions.js'

export function createMutationEndpoints (
  input: AllTypes
): GraphQLFields {
  const mutationFields = {}
  const clientTypes = input.clientTypes
  const viewerType = input.viewerType

  for (const modelName in clientTypes) {
    // create node
    mutationFields[`create${modelName}`] = mutationWithClientMutationId({
      name: `Create${modelName}`,
      outputFields: {
        node: {
          type: clientTypes[modelName].objectType
        },
        viewer: {
          type: viewerType,
          resolve: (_, args, { rootValue: { backend } }) => (
            backend.user()
          )
        },
        edge: {
          type: clientTypes[modelName].edgeType,
          resolve: (root, args, { rootValue: { backend } }) => backend.allNodesByType(modelName)
          .then((allNodes) => ({
            cursor: offsetToCursor(0), // todo: do we sort ascending or descending?
            node: root.node,
            viewer: backend.user()
          }))
        }
      },
      inputFields: clientTypes[modelName].mutationInputArguments,
      mutateAndGetPayload: (node, { rootValue: { backend } }) => {
        return backend.createNode(modelName, node).then((node) => ({node}))
      }
    })

    // update node
    // todo: make id input argument NOT NULL
    mutationFields[`update${modelName}`] = mutationWithClientMutationId({
      name: `Update${modelName}`,
      outputFields: {
        node: {
          type: clientTypes[modelName].objectType
        },
        viewer: {
          type: viewerType,
          resolve: (_, args, { rootValue: { backend } }) => (
            backend.user()
          )
        },
        edge: {
          type: clientTypes[modelName].edgeType,
          resolve: (root, { rootValue: { backend } }) => ({
            cursor: cursorForObjectInConnection(backend.allNodesByType(modelName), root.node),
            node: root.node
          })
        }
      },
      inputFields: clientTypes[modelName].mutationInputArguments,
      mutateAndGetPayload: (node, { rootValue: { backend } }) => {
        return backend.updateNode(modelName, node.id, node).then((node) => ({node}))
      }
    })

    // delete node
    mutationFields[`delete${modelName}`] = mutationWithClientMutationId({
      name: `Delete${modelName}`,
      outputFields: {
        node: {
          type: clientTypes[modelName].objectType
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
      mutateAndGetPayload: (node, { rootValue: { backend } }) => {
        return backend.deleteNode(modelName, node.id).then((node) => ({node}))
      }
    })
  }

  return mutationFields
}
