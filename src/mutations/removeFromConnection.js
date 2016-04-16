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
    mutateAndGetPayload: (args, { rootValue: { currentUser, backend, webhooksProcessor } }) => {
      args = convertInputFieldsToInternalIds(args, clientTypes[modelName].clientSchema, ['fromId', 'toId'])

      function backRelationExists () {
        return connectionField.backRelationName &&
              !clientTypes[connectionField.typeIdentifier].clientSchema.fields
              .filter((x) => x.fieldName === connectionField.backRelationName)[0].isList
      }

      function removeBackRelation () {
        return backend.node(
          connectionField.typeIdentifier,
          args.toId,
          clientTypes[connectionField.typeIdentifier].clientSchema,
          currentUser)
        .then((toNode) => {
          toNode[`${connectionField.backRelationName}Id`] = null

          backend.updateNode(
            connectionField.typeIdentifier,
            args.toId,
            toNode,
            clientTypes[connectionField.typeIdentifier].clientSchema,
            currentUser)
        })
      }

      return (backRelationExists()
      ? removeBackRelation()
      : Promise.resolve()
      ).then(() =>
        backend.removeRelation(
          modelName,
          args.fromId,
          connectionField.fieldName,
          connectionField.typeIdentifier,
          args.toId))
      .then(({fromNode, toNode}) => {
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
