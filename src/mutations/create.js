/* @flow */

import {
  GraphQLObjectType
} from 'graphql'

import type {
  ClientTypes
} from '../utils/definitions.js'

import {
  mutationWithClientMutationId,
  offsetToCursor
} from 'graphql-relay'

import {
  getFieldNameFromModelName,
  getFieldsForBackRelations,
  patchConnectedNodesOnIdFields,
  convertInputFieldsToInternalIds
} from '../utils/graphql.js'

function getFieldsOfType (args, clientSchema, typeIdentifier) {
  return clientSchema.fields.filter((field) => field.typeIdentifier === typeIdentifier && args[field.fieldName])
}

export default function (
  viewerType: GraphQLObjectType, clientTypes: ClientTypes, modelName: string
  ): GraphQLObjectType {
  return mutationWithClientMutationId({
    name: `Create${modelName}`,
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
        ({
          cursor: offsetToCursor(0), // todo: do we sort ascending or descending?
          node: root.node,
          viewer: backend.user()
        })
      }
    },
    inputFields: clientTypes[modelName].createMutationInputArguments,
    mutateAndGetPayload: (node, { rootValue: { currentUser, backend, webhooksProcessor } }) => {
      node = convertInputFieldsToInternalIds(node, clientTypes[modelName].clientSchema)
      return Promise.all(getFieldsOfType(node, clientTypes[modelName].clientSchema, 'Password').map((field) =>
        backend.hashAsync(node[field.fieldName]).then((hashed) => {
          node[field.fieldName] = hashed
        })
      ))
      .then(() =>
        backend.createNode(modelName, node, clientTypes[modelName].clientSchema, currentUser)
      ).then((node) => (
        // todo: also remove from backRelation when set to null
        // todo: also add to 1-many connection when updating node
        // add in corresponding connection
        Promise.all(getFieldsForBackRelations(node, clientTypes[modelName].clientSchema)
          .map((field) => {
            const backRelationField =
            clientTypes[field.typeIdentifier].clientSchema.fields
            .filter((x) => x.fieldName === field.backRelationName)[0]

            if (backRelationField.isList) {
              return backend.createRelation(
                field.typeIdentifier,
                node[`${field.fieldName}Id`],
                field.backRelationName,
                modelName,
                node.id)
              .then(({fromNode, toNode}) => fromNode)
            } else {
              console.log('currentUser', currentUser)
              return backend.node(
                field.typeIdentifier,
                node[`${field.fieldName}Id`],
                clientTypes[field.typeIdentifier].clientSchema,
                currentUser)
              .then((relationNode) => {
                console.log('relationNode', relationNode)
                relationNode[`${field.backRelationName}Id`] = node.id
                return backend.updateNode(
                  field.typeIdentifier,
                  relationNode.id,
                  relationNode,
                  clientTypes[field.typeIdentifier].clientSchema,
                  currentUser)
              })
            }
          })
        )
        .then((connectedNodes) => ({connectedNodes, node}))
      ))
      .then(({connectedNodes, node}) => {
        const patchedNode = patchConnectedNodesOnIdFields(node, connectedNodes, clientTypes[modelName].clientSchema)
        webhooksProcessor.nodeCreated(patchedNode, modelName)
        return node
      })
      .then((node) => ({ node }))
    }
  })
}
