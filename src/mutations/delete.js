import {
  GraphQLNonNull,
  GraphQLID,
  GraphQLString
} from 'graphql'

import {
  mutationWithClientMutationId
} from 'graphql-relay'

import { getFieldNameFromModelName, convertInputFieldsToInternalIds } from '../utils/graphql.js'

export default function (viewerType, clientTypes, modelName) {
  return mutationWithClientMutationId({
      name: `Delete${modelName}`,
      outputFields: {
        [getFieldNameFromModelName(modelName)]: {
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
      mutateAndGetPayload: (node, { rootValue: { currentUser, backend, webhooksProcessor } }) => {
        node = convertInputFieldsToInternalIds(node, clientTypes[modelName].clientSchema)

        return backend.deleteNode(modelName, node.id, clientTypes[modelName].clientSchema, currentUser)
        .then((node) => {
          webhooksProcessor.nodeDeleted(node, modelName)
          return node
        })
        .then((node) => ({[getFieldNameFromModelName(modelName)]: node}))
      }
    })
}
