/* @flow */

import {
  GraphQLNonNull,
  GraphQLID,
  GraphQLObjectType
} from 'graphql'

import type {
  ClientTypes,
  ClientSchemaField
} from '../utils/definitions.js'

import {
  mutationWithClientMutationId,
  offsetToCursor
} from 'graphql-relay'

import { getFieldNameFromModelName, convertInputFieldsToInternalIds } from '../utils/graphql.js'

export default function (
  viewerType: GraphQLObjectType, clientTypes: ClientTypes, modelName: string, connectionField: ClientSchemaField
  ): GraphQLObjectType {
  return mutationWithClientMutationId({
    name: `Add${connectionField.typeIdentifier}To${connectionField.fieldName}ConnectionOn${modelName}`,
    outputFields: {
      [getFieldNameFromModelName(modelName)]: {
        type: clientTypes[modelName].objectType,
        resolve: (root) => root.fromNode
      },
      viewer: {
        type: viewerType,
        resolve: (_, args, { rootValue: { backend } }) => (
          backend.user()
        )
      },
      edge: {
        type: clientTypes[connectionField.typeIdentifier].edgeType,
        resolve: (root) => ({
          cursor: offsetToCursor(0), // cursorForObjectInConnection(backend.allNodesByType(modelName), root.node),
          node: root.toNode
        })
      }
    },
    inputFields: {
      fromId: {
        type: new GraphQLNonNull(GraphQLID)
      },
      toId: {
        type: new GraphQLNonNull(GraphQLID)
      }
    },
    mutateAndGetPayload: (args, { rootValue: { currentUser, backend, webhooksProcessor } }) => {
      args = convertInputFieldsToInternalIds(args, clientTypes[modelName].clientSchema)

      return backend.createRelation(
        modelName,
        args.fromId,
        connectionField.fieldName,
        connectionField.typeIdentifier,
        args.toId)
      .then(({fromNode, toNode}) => {
        // todo: also remove from backRelation when removed from relation
        // add 1-1 connection if backRelation is present
        if (connectionField.backRelationName) {
          toNode[`${connectionField.backRelationName}Id`] = args.fromId
          console.log('toNode', toNode)
          return backend.updateNode(
            connectionField.typeIdentifier,
            args.toId,
            toNode,
            clientTypes[connectionField.typeIdentifier].clientSchema,
            currentUser)
          .then((toNode) => ({fromNode, toNode}))
        }
        return {fromNode, toNode}
      })
      .then(({fromNode, toNode}) => {
        webhooksProcessor.nodeAddedToConnection(
          toNode,
          connectionField.typeIdentifier,
          fromNode,
          modelName,
          connectionField.fieldName)
        return {fromNode, toNode}
      })
      .then(({fromNode, toNode}) => ({fromNode, toNode}))
    }
  })
}
