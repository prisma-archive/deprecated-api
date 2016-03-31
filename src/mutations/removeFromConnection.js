/* @flow */

import type {
  ClientTypes,
  ClientSchemaField
} from '../utils/definitions.js'

import {
  GraphQLNonNull,
  GraphQLID,
  GraphQLObjectType
} from 'graphql'

import {
  mutationWithClientMutationId
} from 'graphql-relay'

import { getFieldNameFromModelName, convertInputFieldsToInternalIds } from '../utils/graphql.js'

export default function (
  viewerType: GraphQLObjectType, clientTypes: ClientTypes, modelName: string, connectionField: ClientSchemaField
  ): GraphQLObjectType {
  return mutationWithClientMutationId({
    name: `Remove${connectionField.typeIdentifier}From${connectionField.fieldName}ConnectionOn${modelName}`,
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
      fromId: {
        type: new GraphQLNonNull(GraphQLID)
      },
      toId: {
        type: new GraphQLNonNull(GraphQLID)
      }
    },
    mutateAndGetPayload: (args, { rootValue: { backend, webhooksProcessor } }) => {
      args = convertInputFieldsToInternalIds(args, clientTypes[modelName].clientSchema)
      return backend.removeRelation(
        modelName,
        args.fromId,
        connectionField.fieldName,
        connectionField.typeIdentifier,
        args.toId)
      .then(({fromNode, toNode}) => {
        console.log(fromNode, toNode)
        webhooksProcessor.nodeRemovedFromConnection(
          toNode,
          connectionField.typeIdentifier,
          fromNode,
          modelName,
          connectionField.fieldName)
        return {fromNode, toNode}
      })
      .then(({fromNode, toNode}) => ({[getFieldNameFromModelName(modelName)]: fromNode}))
    }
  })
}
