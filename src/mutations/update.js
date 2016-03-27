import {
  GraphQLNonNull,
  GraphQLString
} from 'graphql'

import {
  mutationWithClientMutationId
} from 'graphql-relay'

import { getFieldNameFromModelName } from '../utils/graphql.js'

export default function (viewerType, clientTypes, modelName) {
  return mutationWithClientMutationId({
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
        .then((allNodes) => {
          return ({
            // todo: getting all nodes is not efficient
            cursor: cursorForObjectInConnection(allNodes, allNodes.filter((x) => x.id === root.node.id)[0]),
            node: root.node
          })
        })
      }
    },
    inputFields: clientTypes[modelName].updateMutationInputArguments,
    mutateAndGetPayload: (node, { rootValue: { currentUser, backend, webhooksProcessor } }) => {
      return backend.updateNode(modelName, node.id, node, clientTypes[modelName].clientSchema, currentUser)
      .then((node) => {
        webhooksProcessor.nodeUpdated(node, modelName)
        return {node}
      })
    }
  })
}
